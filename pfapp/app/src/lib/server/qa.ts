// After MathTestBuddy trainer/src/lib/api/threads.ts (commit c7df343). Kept: zod schemas with a
// trimmed, length-capped message, a thread per question with its subjects, the question written
// before its job is submitted (outside any transaction), 202 {threadId}, 503 ai_unavailable before
// anything is stored, 409 while the thread's job is still open, notes one per message, LIKE search
// with `%`/`_`/`\` escaped. Changed: subjects are this app's (tool / program / blank / library),
// the body names its workflow, the page's bridge state travels with it (and is re-checked here),
// a follow-up is POST /api/threads/:id (MTB: /:id/messages), and the job id is returned so the
// page polls GET /api/jobs/:id.
import { z } from "zod";
import { loadProgram } from "../ai/context";
import {
  blankSubject,
  cancelJob,
  OPEN,
  parseBlankSubject,
  pollJob,
  type Subject,
  type SubjectType,
  submitJob,
  WORKFLOWS,
  type Workflow,
} from "../ai/jobs";
import { blanksOf } from "../ai/leak";
import type { Db } from "../db/handle";
import { newId } from "../db/ids";
import type { AiJobRow } from "../db/schema";
import { readJson } from "../http/body";
import { HttpError } from "../http/errors";
import type { Handler } from "../http/route";
import { LOCALES, type Locale } from "../i18n/locale";
import { type PyState, toPyState } from "../py-state";
import type { AppContext } from "./context";
import { getLang } from "./settings";

/**
 * The Q&A and notes API (design §7.4, §7.5; plan Task 11):
 *
 *   POST   /api/threads       {subjects, message, workflow, pyState?, locale?} → 202 {threadId, jobId}
 *   GET    /api/threads/:id   {id, title, subjects, messages, job}
 *   POST   /api/threads/:id   {message, workflow, pyState?, locale?}   a follow-up → 202 {threadId, jobId}
 *   GET    /api/jobs/:id      {id, status, threadId, error} (one platform poll while it is open)
 *   DELETE /api/jobs/:id      cancel → {id, status, threadId, error}
 *   POST   /api/notes         {messageId} → 201 {id} (200 with the existing note's id)
 *   GET    /api/notes?q=      {notes}, newest first
 *   DELETE /api/notes/:id     204
 *
 * `pyState` is checked field by field as the shell's bridge parser checks it (toPyState); an
 * invalid one is stored as null, which allows no answer line at all. `hint` needs the page in
 * blank mode with a focused blank: anything else is 400 hint_needs_blank, and the focused blank
 * becomes one of the job's subjects. `library` is always about the library (subjects replaced).
 */

export const MAX_MESSAGE_CHARS = 4000;
export const MAX_SUBJECTS = 8;
const MAX_TITLE_CHARS = 80;
const MAX_NOTES = 500;
const MAX_QUERY_CHARS = 200;
const LIBRARY: Subject = { type: "library", id: "all" };

const SUBJECT_TYPES = ["tool", "program", "blank", "library"] as const satisfies SubjectType[];
const subjectSchema = z.strictObject({
  type: z.enum(SUBJECT_TYPES),
  id: z.string().min(1).max(200),
});
const messageSchema = z
  .string()
  .max(MAX_MESSAGE_CHARS)
  .transform((s) => s.trim())
  .pipe(z.string().min(1));
const workflowSchema = z.enum(WORKFLOWS as [Workflow, ...Workflow[]]);
const createSchema = z.strictObject({
  subjects: z.array(subjectSchema).min(1).max(MAX_SUBJECTS),
  message: messageSchema,
  workflow: workflowSchema,
  pyState: z.unknown().optional(),
  locale: z.enum(LOCALES).optional(),
});
const followUpSchema = z.strictObject({
  message: messageSchema,
  workflow: workflowSchema,
  pyState: z.unknown().optional(),
  locale: z.enum(LOCALES).optional(),
});
const noteSchema = z.strictObject({ messageId: z.string().min(1).max(64) });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new HttpError(400, "bad_request");
  return r.data;
}

const now = () => new Date().toISOString();
const sameSubject = (a: Subject, b: Subject) => a.type === b.type && a.id === b.id;

/** Whether the installed content has this subject. */
function subjectExists(app: AppContext, s: Subject): boolean {
  const { db } = app;
  switch (s.type) {
    case "library":
      return true;
    case "tool":
      return !!db.prepare("SELECT 1 AS x FROM catalog_items WHERE id = ?").get(s.id);
    case "program":
      return !!db.prepare("SELECT 1 AS x FROM library_docs WHERE id = ?").get(`program:${s.id}`);
    case "blank": {
      const ref = parseBlankSubject(s.id);
      const dir = app.content?.dir;
      if (!ref || !dir) return false;
      const p = loadProgram(dir, ref.programId);
      return !!p && blanksOf(p.source).some((b) => b.id === ref.blankId);
    }
    default:
      return false;
  }
}

/**
 * The job's subjects and state for one question: hint's guard (400), the focused blank added to
 * a hint, the library in place of anything else for `library`, then every subject checked (404).
 */
function plan(
  app: AppContext,
  workflow: Workflow,
  asked: readonly Subject[],
  rawState: unknown,
): { subjects: Subject[]; pyState: PyState | null } {
  const pyState = rawState === undefined ? null : toPyState(rawState);
  let subjects: Subject[] = [];
  for (const s of asked) if (!subjects.some((x) => sameSubject(x, s))) subjects.push(s);
  if (workflow === "hint") {
    if (pyState?.mode !== "blank" || !pyState.blankId) {
      throw new HttpError(400, "hint_needs_blank");
    }
    const blank: Subject = { type: "blank", id: blankSubject(pyState.progId, pyState.blankId) };
    if (!subjects.some((x) => sameSubject(x, blank))) subjects.push(blank);
  }
  if (workflow === "library") subjects = [LIBRARY];
  for (const s of subjects) {
    if (!subjectExists(app, s)) throw new HttpError(404, "unknown_subject");
  }
  return { subjects, pyState };
}

function requireAi(app: AppContext) {
  if (!app.ai.platform) throw new HttpError(503, "ai_unavailable");
}

const titleOf = (message: string) => {
  const one = message.replace(/\s+/g, " ").trim();
  return [...one].length > MAX_TITLE_CHARS
    ? `${[...one].slice(0, MAX_TITLE_CHARS - 1).join("")}…`
    : one;
};

/** Her message, then the job for it (submitted now; a refused submit ends the job, still 202). */
async function ask(
  app: AppContext,
  threadId: string,
  text: string,
  workflow: Workflow,
  subjects: Subject[],
  pyState: PyState | null,
  locale: Locale | undefined,
) {
  const { db } = app;
  const at = now();
  db.transaction(() => {
    db.prepare(
      "INSERT INTO messages (id, thread_id, role, text, created_at) VALUES (?, ?, 'user', ?, ?)",
    ).run(newId(at), threadId, text, at);
    const sub = db.prepare(
      "INSERT OR IGNORE INTO thread_subjects (thread_id, subject_type, subject_id) VALUES (?, ?, ?)",
    );
    for (const s of subjects) sub.run(threadId, s.type, s.id);
    db.prepare("UPDATE threads SET updated_at = ? WHERE id = ?").run(at, threadId);
  });
  const out = await submitJob(
    db,
    { threadId, workflow, subjects, pyState, locale: locale ?? getLang(db, app.target) },
    { platform: app.ai.platform },
  );
  app.log("qa.asked", { workflow, submitted: out.submitted, error: out.error });
  return { status: 202, body: { threadId, jobId: out.jobId } };
}

export const postThread: Handler = async (app, { req }) => {
  const body = parse(createSchema, await readJson(req));
  const { subjects, pyState } = plan(app, body.workflow, body.subjects, body.pyState);
  requireAi(app);
  const at = now();
  const threadId = newId(at);
  app.db
    .prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(threadId, titleOf(body.message), at, at);
  return ask(app, threadId, body.message, body.workflow, subjects, pyState, body.locale);
};

function threadSubjects(db: Db, threadId: string): Subject[] {
  return db
    .prepare(
      "SELECT subject_type AS type, subject_id AS id FROM thread_subjects WHERE thread_id = ? ORDER BY rowid",
    )
    .all<{ type: SubjectType; id: string }>(threadId)
    .map((s) => ({ type: s.type, id: s.id }));
}

const threadExists = (db: Db, id: string) =>
  !!db.prepare("SELECT 1 AS x FROM threads WHERE id = ?").get(id);

export const postFollowUp: Handler = async (app, { req, params }) => {
  const body = parse(followUpSchema, await readJson(req));
  const id = params.id ?? "";
  if (!threadExists(app.db, id)) throw new HttpError(404, "not_found");
  const { subjects, pyState } = plan(app, body.workflow, threadSubjects(app.db, id), body.pyState);
  requireAi(app);
  const open = app.db
    .prepare(
      `SELECT 1 AS x FROM ai_jobs WHERE thread_id = ? AND status IN (${OPEN.map(() => "?").join(", ")})`,
    )
    .get(id, ...OPEN);
  if (open) throw new HttpError(409, "thread_busy");
  return ask(app, id, body.message, body.workflow, subjects, pyState, body.locale);
};

// ---------------------------------------------------------------- reading

export interface CitationView {
  id: string;
  title: { en: string; zh: string };
  /** Locale-less path in this app (`/tool/<id>`, `/tool/<id>?prog=<id>`); the page prefixes it. */
  href: string;
}

/** Library ids as links into the app; an id the content no longer has is left out. */
export function resolveCitations(app: AppContext, ids: readonly string[]): CitationView[] {
  const out: CitationView[] = [];
  const tool = app.db.prepare("SELECT id, title_en, title_zh FROM catalog_items WHERE id = ?");
  for (const id of ids) {
    if (id.startsWith("tool:")) {
      const t = tool.get<{ id: string; title_en: string; title_zh: string }>(id.slice(5));
      if (t) {
        out.push({
          id,
          title: { en: t.title_en, zh: t.title_zh },
          href: `/tool/${encodeURIComponent(t.id)}`,
        });
      }
    } else if (id.startsWith("program:") && app.content) {
      const programId = id.slice("program:".length);
      const p = loadProgram(app.content.dir, programId);
      if (!p?.tool || !tool.get(p.tool)) continue;
      const en = p.title?.en ?? p.title?.zh ?? programId;
      out.push({
        id,
        title: { en, zh: p.title?.zh ?? en },
        href: `/tool/${encodeURIComponent(p.tool)}?prog=${encodeURIComponent(programId)}`,
      });
    }
  }
  return out;
}

const citationIds = (json: string): string[] => {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export interface MessageView {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations: CitationView[];
  noteId: string | null;
  createdAt: string;
}

export interface JobView {
  id: string;
  status: string;
  threadId: string;
  workflow: string;
  error: string | null;
}

const jobView = (
  j: Pick<AiJobRow, "id" | "status" | "thread_id" | "workflow" | "error">,
): JobView => ({
  id: j.id,
  status: j.status,
  threadId: j.thread_id,
  workflow: j.workflow,
  error: j.error ?? null,
});

export const getThread: Handler = (app, { params }) => {
  const { db } = app;
  const t = db
    .prepare("SELECT id, title FROM threads WHERE id = ?")
    .get<{ id: string; title: string }>(params.id ?? "");
  if (!t) throw new HttpError(404, "not_found");
  const rows = db
    .prepare(
      `SELECT m.id, m.role, m.text, m.citations, m.created_at, n.id AS note_id
         FROM messages m LEFT JOIN notes n ON n.message_id = m.id
        WHERE m.thread_id = ? ORDER BY m.created_at, m.id`,
    )
    .all<{
      id: string;
      role: string;
      text: string;
      citations: string;
      created_at: string;
      note_id: string | null;
    }>(t.id);
  const job = db
    .prepare("SELECT * FROM ai_jobs WHERE thread_id = ? ORDER BY created_at DESC, id DESC LIMIT 1")
    .get<AiJobRow>(t.id);
  const messages: MessageView[] = rows.map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    text: m.text,
    citations: resolveCitations(app, citationIds(m.citations)),
    noteId: m.note_id,
    createdAt: m.created_at,
  }));
  return {
    body: {
      id: t.id,
      title: t.title,
      workflow: job?.workflow ?? null,
      subjects: threadSubjects(db, t.id),
      messages,
      job: job ? jobView(job) : null,
    },
  };
};

const jobRow = (db: Db, id: string) =>
  db.prepare("SELECT * FROM ai_jobs WHERE id = ?").get<AiJobRow>(id);

/** One platform look while the job is not settled; a platform error leaves the row as it is. */
export const getJob: Handler = async (app, { params }) => {
  const id = params.id ?? "";
  const row = jobRow(app.db, id);
  if (!row) throw new HttpError(404, "not_found");
  if (app.ai.platform && !row.settled_at) {
    try {
      await pollJob(app.db, app.ai.platform, id);
    } catch (e) {
      app.log("qa.poll_failed", { error: e instanceof Error ? e.name : "Error" });
    }
  }
  return { body: jobView(jobRow(app.db, id) as AiJobRow) };
};

export const deleteJob: Handler = async (app, { params }) => {
  const id = params.id ?? "";
  if (!jobRow(app.db, id)) throw new HttpError(404, "not_found");
  await cancelJob(app.db, app.ai.platform, id);
  return { body: jobView(jobRow(app.db, id) as AiJobRow) };
};

// ---------------------------------------------------------------- notes

export const postNote: Handler = async (app, { req }) => {
  const { messageId } = parse(noteSchema, await readJson(req));
  const { db } = app;
  const m = db.prepare("SELECT role FROM messages WHERE id = ?").get<{ role: string }>(messageId);
  if (!m) throw new HttpError(404, "not_found");
  if (m.role !== "assistant") throw new HttpError(400, "bad_request");
  return db.transaction(() => {
    const existing = db
      .prepare("SELECT id FROM notes WHERE message_id = ?")
      .get<{ id: string }>(messageId);
    if (existing) return { status: 200, body: { id: existing.id } };
    const at = now();
    const id = newId(at);
    db.prepare("INSERT INTO notes (id, message_id, created_at) VALUES (?, ?, ?)").run(
      id,
      messageId,
      at,
    );
    return { status: 201, body: { id } };
  });
};

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface NoteView {
  id: string;
  messageId: string;
  threadId: string;
  threadTitle: string;
  question: string;
  text: string;
  citations: CitationView[];
  subjects: Subject[];
  createdAt: string;
}

export const getNotes: Handler = (app, { query }) => {
  const q = (query.get("q") ?? "").trim().slice(0, MAX_QUERY_CHARS);
  const like = `%${escapeLike(q)}%`;
  const rows = app.db
    .prepare(
      `SELECT * FROM (
         SELECT n.id AS id, n.created_at AS created_at, m.id AS message_id, m.text AS text,
                m.citations AS citations, t.id AS thread_id, t.title AS thread_title,
                coalesce((SELECT u.text FROM messages u
                           WHERE u.thread_id = m.thread_id AND u.role = 'user'
                             AND (u.created_at < m.created_at OR (u.created_at = m.created_at AND u.id < m.id))
                           ORDER BY u.created_at DESC, u.id DESC LIMIT 1), '') AS question
           FROM notes n JOIN messages m ON m.id = n.message_id JOIN threads t ON t.id = m.thread_id)
        WHERE ? = '' OR text LIKE ? ESCAPE '\\' OR question LIKE ? ESCAPE '\\' OR thread_title LIKE ? ESCAPE '\\'
        ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all<{
      id: string;
      created_at: string;
      message_id: string;
      text: string;
      citations: string;
      thread_id: string;
      thread_title: string;
      question: string;
    }>(q, like, like, like, MAX_NOTES);
  const notes: NoteView[] = rows.map((r) => ({
    id: r.id,
    messageId: r.message_id,
    threadId: r.thread_id,
    threadTitle: r.thread_title,
    question: r.question,
    text: r.text,
    citations: resolveCitations(app, citationIds(r.citations)),
    subjects: threadSubjects(app.db, r.thread_id),
    createdAt: r.created_at,
  }));
  return { body: { notes } };
};

export const deleteNote: Handler = (app, { params }) => {
  const r = app.db.prepare("DELETE FROM notes WHERE id = ?").run(params.id ?? "");
  if (r.changes === 0) throw new HttpError(404, "not_found");
  return { status: 204 };
};
