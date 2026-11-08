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
import { getAiLang, getLang } from "./settings";

/**
 * The Q&A and notes API (design §7.4, §7.5; plan Task 11):
 *
 *   POST   /api/threads       {subjects, message, workflow, pyState?, locale?} → 202 {threadId, jobId}
 *   GET    /api/threads?subject=<tool|program>:<id>   {thread: <as GET /api/threads/:id> | null}
 *   GET    /api/threads?subject=…&list=1   {threads: [{id, title, updatedAt, messageCount, hasNotes}]}
 *   GET    /api/threads/:id   {id, title, subjects, messages, job}
 *   POST   /api/threads/:id   {message, workflow, pyState?, locale?}   a follow-up → 202 {threadId, jobId}
 *   GET    /api/jobs/:id      {id, status, threadId, error} (one platform poll while it is open)
 *   DELETE /api/jobs/:id      cancel → {id, status, threadId, error}
 *   POST   /api/notes         {messageId} → 201 {id} (200 with the existing note's id)
 *   GET    /api/notes?q=      {notes}, newest first
 *   DELETE /api/notes/:id     204
 *   GET    /api/notes/threads?q=&group=   {threads, groups}: one row per conversation with notes
 *   DELETE /api/notes/threads/:id          204: that conversation's notes (the conversation stays)
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
/** `program:` + an id of at most 200 characters (subjectSchema's cap). */
const MAX_LOOKUP_CHARS = 208;
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
  // the reply language: the asking page's (else the shell's), unless the aiLang setting names one
  const aiLang = getAiLang(db);
  const replyIn = aiLang === "page" ? (locale ?? getLang(db, app.target)) : aiLang;
  const out = await submitJob(
    db,
    { threadId, workflow, subjects, pyState, locale: replyIn },
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

/**
 * A thread's subjects are fixed when it is created (Task 11 review, Minor 1): a follow-up may not
 * turn it into a conversation about something else. A library thread is followed up with
 * `library` only; any other thread with `ask` or `hint` only — and a hint only for a blank of a
 * program the thread is already about. Anything else is 400 workflow_mismatch.
 */
function followUpFits(had: readonly Subject[], workflow: Workflow, pyState: PyState | null) {
  const library = had.some((s) => s.type === "library");
  if (library !== (workflow === "library")) throw new HttpError(400, "workflow_mismatch");
  if (workflow !== "hint" || !pyState) return;
  const programs = new Set<string>();
  for (const s of had) {
    if (s.type === "program") programs.add(s.id);
    const ref = s.type === "blank" ? parseBlankSubject(s.id) : null;
    if (ref) programs.add(ref.programId);
  }
  if (!programs.has(pyState.progId)) throw new HttpError(400, "workflow_mismatch");
}

export const postFollowUp: Handler = async (app, { req, params }) => {
  const body = parse(followUpSchema, await readJson(req));
  const id = params.id ?? "";
  if (!threadExists(app.db, id)) throw new HttpError(404, "not_found");
  const had = threadSubjects(app.db, id);
  followUpFits(had, body.workflow, body.pyState === undefined ? null : toPyState(body.pyState));
  const { subjects, pyState } = plan(app, body.workflow, had, body.pyState);
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

/** A thread as GET /api/threads/:id answers it; null when there is no such thread. */
function threadView(app: AppContext, id: string) {
  const { db } = app;
  const t = db
    .prepare("SELECT id, title FROM threads WHERE id = ?")
    .get<{ id: string; title: string }>(id);
  if (!t) return null;
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
    id: t.id,
    title: t.title,
    workflow: job?.workflow ?? null,
    subjects: threadSubjects(db, t.id),
    messages,
    job: job ? jobView(job) : null,
  };
}

export const getThread: Handler = (app, { params }) => {
  const view = threadView(app, params.id ?? "");
  if (!view) throw new HttpError(404, "not_found");
  return { body: view };
};

const lookupSchema = z
  .string()
  .regex(/^(tool|program):.+$/)
  .max(MAX_LOOKUP_CHARS)
  .transform((v) => {
    const i = v.indexOf(":");
    return { type: v.slice(0, i) as "tool" | "program", id: v.slice(i + 1) };
  });

/** Every thread a tool page may reopen for a subject: non-archived, about it, never a library thread. */
const ABOUT_SUBJECT = `t.archived = 0
          AND EXISTS (SELECT 1 FROM thread_subjects s
                       WHERE s.thread_id = t.id AND s.subject_type = ? AND s.subject_id = ?)
          AND NOT EXISTS (SELECT 1 FROM thread_subjects s
                           WHERE s.thread_id = t.id AND s.subject_type = 'library')`;
/** The ask panel's conversation switcher lists at most this many, newest first. */
export const MAX_SUBJECT_THREADS = 50;

/** One row of the ask panel's conversation switcher. */
export interface SubjectThreadRow {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  hasNotes: boolean;
}

/**
 * The conversation a tool page reopens with: the newest (updated_at, then id) non-archived thread
 * about that tool or program, never a library thread. A program thread that has had a hint also
 * has the blank as a subject, but it keeps the program (a hint is asked with the program subject,
 * and plan() only adds to it), so it is still found here. An id with no thread is {thread: null}.
 *
 * With `&list=1`: every such thread instead, newest first, capped at MAX_SUBJECT_THREADS —
 * {threads: [{id, title, updatedAt, messageCount, hasNotes}]} — for the panel's switcher, so an
 * earlier conversation about the same program stays reachable.
 */
export const findThread: Handler = (app, { query }) => {
  const s = parse(lookupSchema, query.get("subject"));
  if (query.get("list") === "1") {
    const rows = app.db
      .prepare(
        `SELECT t.id, t.title, t.updated_at,
                (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id) AS message_count,
                EXISTS (SELECT 1 FROM notes n JOIN messages m ON m.id = n.message_id
                         WHERE m.thread_id = t.id) AS has_notes
           FROM threads t
          WHERE ${ABOUT_SUBJECT}
          ORDER BY t.updated_at DESC, t.id DESC LIMIT ?`,
      )
      .all<{
        id: string;
        title: string;
        updated_at: string;
        message_count: number;
        has_notes: number;
      }>(s.type, s.id, MAX_SUBJECT_THREADS);
    const threads: SubjectThreadRow[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: r.updated_at,
      messageCount: Number(r.message_count),
      hasNotes: Boolean(r.has_notes),
    }));
    return { body: { threads } };
  }
  const row = app.db
    .prepare(
      `SELECT t.id FROM threads t
        WHERE ${ABOUT_SUBJECT}
        ORDER BY t.updated_at DESC, t.id DESC LIMIT 1`,
    )
    .get<{ id: string }>(s.type, s.id);
  return { body: { thread: row ? threadView(app, row.id) : null } };
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
  subjects: SubjectView[];
  createdAt: string;
}

/**
 * A note's subject as the notes page filters by it (spec §7.4 "按主题"): its title, and for a
 * program or a blank the program and the tool it belongs to — so a program note is found under its
 * tool too. Titles fall back to the id when the content no longer has the item.
 */
export interface SubjectView {
  type: SubjectType;
  id: string;
  title: { en: string; zh: string } | null;
  toolId: string | null;
  programId: string | null;
}

function subjectViews(app: AppContext, subjects: readonly Subject[]): SubjectView[] {
  const tool = app.db.prepare("SELECT title_en, title_zh FROM catalog_items WHERE id = ?");
  return subjects.map((s): SubjectView => {
    if (s.type === "library") return { ...s, title: null, toolId: null, programId: null };
    if (s.type === "tool") {
      const t = tool.get<{ title_en: string; title_zh: string }>(s.id);
      return {
        ...s,
        title: { en: t?.title_en ?? s.id, zh: t?.title_zh ?? s.id },
        toolId: s.id,
        programId: null,
      };
    }
    const programId = s.type === "blank" ? (parseBlankSubject(s.id)?.programId ?? s.id) : s.id;
    const p = app.content ? loadProgram(app.content.dir, programId) : null;
    const en = p?.title?.en ?? p?.title?.zh ?? programId;
    return { ...s, title: { en, zh: p?.title?.zh ?? en }, toolId: p?.tool ?? null, programId };
  });
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
    subjects: subjectViews(app, threadSubjects(app.db, r.thread_id)),
    createdAt: r.created_at,
  }));
  return { body: { notes } };
};

export const deleteNote: Handler = (app, { params }) => {
  const r = app.db.prepare("DELETE FROM notes WHERE id = ?").run(params.id ?? "");
  if (r.changes === 0) throw new HttpError(404, "not_found");
  return { status: 204 };
};

// ---------------------------------------------------------------- notes, one row per conversation

/** The notes page's group filter for library threads (a catalog group id is never this). */
export const LIBRARY_GROUP = "library";

/**
 * A conversation with saved answers, as the notes page lists it (one row per thread): its question
 * (the first message she wrote), the date of its newest saved answer, how many answers are saved,
 * how many questions she asked after the first saved one, what it is about (`subject`: the
 * program, else the tool, else the library), the catalog group that belongs to, and the page to
 * go back to (locale-less, always naming this conversation: `/ask?thread=<id>` for the library,
 * `/tool/<t>?prog=<p>&thread=<id>` or `/tool/<t>?thread=<id>` otherwise; when the program's tool
 * is gone, a tool the thread is also about that the content still has; null when none is left).
 * `available` is false when the installed content no longer has one of its subjects: a follow-up
 * would be refused (404 unknown_subject), so the page does not offer one.
 */
export interface NoteThreadView {
  id: string;
  title: string;
  question: string;
  latestNoteAt: string;
  notes: number;
  followUps: number;
  kind: "tool" | "program" | "library";
  subject: SubjectView | null;
  group: { id: string; label: { en: string; zh: string } } | null;
  href: string | null;
  available: boolean;
}

/** The subject a thread is listed under: the library, else its first program (or blank's), else its first tool. */
function primarySubject(subjects: readonly SubjectView[]): SubjectView | null {
  return (
    subjects.find((s) => s.type === "library") ??
    subjects.find((s) => s.type === "program") ??
    subjects.find((s) => s.type === "blank") ??
    subjects.find((s) => s.type === "tool") ??
    null
  );
}

function noteThreadView(
  app: AppContext,
  row: { id: string; title: string; question: string; latest: string },
): NoteThreadView {
  const { db } = app;
  const msgs = db
    .prepare(
      `SELECT m.role, n.id AS note_id FROM messages m LEFT JOIN notes n ON n.message_id = m.id
        WHERE m.thread_id = ? ORDER BY m.created_at, m.id`,
    )
    .all<{ role: string; note_id: string | null }>(row.id);
  const first = msgs.findIndex((m) => m.note_id !== null);
  const followUps = first < 0 ? 0 : msgs.slice(first + 1).filter((m) => m.role === "user").length;
  const notes = msgs.filter((m) => m.note_id !== null).length;
  const had = threadSubjects(db, row.id);
  const views = subjectViews(app, had);
  const subject = primarySubject(views);
  const kind = subject?.type === "library" ? "library" : subject?.programId ? "program" : "tool";
  // a follow-up re-checks every subject the thread has (plan → subjectExists); the library always fits
  const available = kind === "library" || had.every((s) => subjectExists(app, s));
  const thread = `thread=${encodeURIComponent(row.id)}`;
  let group: NoteThreadView["group"] = null;
  let href: string | null = null;
  if (kind === "library") href = `/ask?${thread}`;
  const toolRow = db.prepare(
    `SELECT i.id, i.grp, g.label_en, g.label_zh FROM catalog_items i
       LEFT JOIN catalog_groups g ON g.id = i.grp WHERE i.id = ?`,
  );
  type ToolRow = { id: string; grp: string; label_en: string | null; label_zh: string | null };
  // the subject's own tool, else (its program gone) a tool the thread is also about, as the queue does
  const own = subject?.toolId ? toolRow.get<ToolRow>(subject.toolId) : undefined;
  const tool =
    own ??
    (kind === "library"
      ? undefined
      : views
          .filter((v) => v.type === "tool")
          .map((v) => toolRow.get<ToolRow>(v.id))
          .find((t) => t !== undefined));
  if (tool) {
    group = {
      id: tool.grp,
      label: { en: tool.label_en ?? tool.grp, zh: tool.label_zh ?? tool.grp },
    };
    href =
      own && kind === "program" && subject?.programId
        ? `/tool/${encodeURIComponent(tool.id)}?prog=${encodeURIComponent(subject.programId)}&${thread}`
        : `/tool/${encodeURIComponent(tool.id)}?${thread}`;
  }
  return {
    id: row.id,
    title: row.title,
    question: row.question,
    latestNoteAt: row.latest,
    notes,
    followUps,
    kind,
    subject,
    group,
    href,
    available,
  };
}

/**
 * GET /api/notes/threads?q=&group= — the conversations that have saved answers, newest saved answer
 * first. `q` matches (LIKE, wildcards literal, as GET /api/notes) the thread's title, its first
 * question, any saved answer, or the question a saved answer replied to. `group` keeps the threads
 * of one catalog group (LIBRARY_GROUP: the library's); `groups` counts every group over the `q`
 * matches before that filter, so the page can show its filter chips with their counts.
 */
export const getNoteThreads: Handler = (app, { query }) => {
  const q = (query.get("q") ?? "").trim().slice(0, MAX_QUERY_CHARS);
  const group = query.get("group") ?? "";
  const like = `%${escapeLike(q)}%`;
  const rows = app.db
    .prepare(
      `SELECT x.id, x.title, x.question, x.latest FROM (
         SELECT t.id AS id, t.title AS title,
                coalesce((SELECT u.text FROM messages u WHERE u.thread_id = t.id AND u.role = 'user'
                           ORDER BY u.created_at, u.id LIMIT 1), '') AS question,
                (SELECT max(n.created_at) FROM notes n JOIN messages m ON m.id = n.message_id
                  WHERE m.thread_id = t.id) AS latest
           FROM threads t) x
        WHERE x.latest IS NOT NULL
          AND (? = '' OR x.title LIKE ? ESCAPE '\\' OR x.question LIKE ? ESCAPE '\\'
               OR EXISTS (
                 SELECT 1 FROM notes n JOIN messages m ON m.id = n.message_id
                  WHERE m.thread_id = x.id
                    AND (m.text LIKE ? ESCAPE '\\'
                         OR coalesce((SELECT u.text FROM messages u
                                       WHERE u.thread_id = m.thread_id AND u.role = 'user'
                                         AND (u.created_at < m.created_at
                                              OR (u.created_at = m.created_at AND u.id < m.id))
                                       ORDER BY u.created_at DESC, u.id DESC LIMIT 1), '')
                            LIKE ? ESCAPE '\\')))
        ORDER BY x.latest DESC, x.id DESC LIMIT ?`,
    )
    .all<{ id: string; title: string; question: string; latest: string }>(
      q,
      like,
      like,
      like,
      like,
      MAX_NOTES,
    );
  const all = rows.map((r) => noteThreadView(app, r));
  const groupOf = (t: NoteThreadView) => (t.kind === "library" ? LIBRARY_GROUP : t.group?.id);
  const groups: Record<string, number> = {};
  for (const t of all) {
    const g = groupOf(t);
    if (g) groups[g] = (groups[g] ?? 0) + 1;
  }
  const threads = group ? all.filter((t) => groupOf(t) === group) : all;
  return { body: { threads, groups } };
};

/** DELETE /api/notes/threads/:id — every saved answer of that thread (the conversation stays); 204. */
export const deleteThreadNotes: Handler = (app, { params }) => {
  const r = app.db
    .prepare("DELETE FROM notes WHERE message_id IN (SELECT id FROM messages WHERE thread_id = ?)")
    .run(params.id ?? "");
  if (r.changes === 0) throw new HttpError(404, "not_found");
  return { status: 204 };
};
