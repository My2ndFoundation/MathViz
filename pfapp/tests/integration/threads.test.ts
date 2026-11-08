import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { join } from "node:path";
import { DELETE as deleteJob, GET as getJob } from "../../app/src/app/api/jobs/[id]/route";
import { DELETE, GET, POST } from "../../app/src/app/api/mcp/[[...path]]/route";
import { DELETE as deleteNote } from "../../app/src/app/api/notes/[id]/route";
import { GET as listNotes, POST as postNote } from "../../app/src/app/api/notes/route";
import { DELETE as deleteThreadNotes } from "../../app/src/app/api/notes/threads/[id]/route";
import { GET as listNoteThreads } from "../../app/src/app/api/notes/threads/route";
import { GET as getThread, POST as postFollowUp } from "../../app/src/app/api/threads/[id]/route";
import { GET as findThread, POST as postThread } from "../../app/src/app/api/threads/route";
import { failureText } from "../../app/src/components/qa/thread-view";
import { createPlatformClient } from "../../app/src/lib/agent/platform/client";
import { buildTask } from "../../app/src/lib/ai/context";
import { blankSubject, createJob, inputOf } from "../../app/src/lib/ai/jobs";
import { blanksOf } from "../../app/src/lib/ai/leak";
import { REDACTED } from "../../app/src/lib/content/index-builder";
import { importAddonFile } from "../../app/src/lib/content/manual-import";
import { newId } from "../../app/src/lib/db/ids";
import { migrationsDir } from "../../app/src/lib/db/open";
import type { AiJobRow } from "../../app/src/lib/db/schema";
import { CSRF_HEADER } from "../../app/src/lib/http/guard";
import { MESSAGES } from "../../app/src/lib/i18n/locale";
import { startAi } from "../../app/src/lib/server/ai";
import { type AppContext, createAppContext, setAppContext } from "../../app/src/lib/server/context";
import { MAX_SUBJECT_THREADS } from "../../app/src/lib/server/qa";
import { setAiLang } from "../../app/src/lib/server/settings";
import { loadTarget } from "../../app/src/lib/target";
import { buildPfaddon, extractPayload, pickBlankProgram, tmp } from "../helpers/content-fixtures";
import { type Agent, type FakePlatform, startFakePlatform, type ToolCall } from "./fake-platform";

/**
 * The Q&A and notes API (plan Task 11) over the route handlers, called as Next calls them, with
 * the MCP route served on a real loopback port for the fake platform's scripted agents. The
 * content is the real python payload from this checkout; which lines a blank holds and which tool
 * a program belongs to are read from the program, never hard-coded.
 */

setDefaultTimeout(60_000);

const PY = loadTarget("python");
const MIGRATIONS = migrationsDir(join(import.meta.dir, "..", ".."));
let PROG = "";

let PAYLOAD = "";
let ADDON = "";
let FIRST_ANSWER = "";
let FIRST_BLANK = "";
let PROG_TOOL = "";

let app: { port: number; stop: () => void } | null = null;
let ctx: AppContext | null = null;
let fake: FakePlatform | null = null;
const opened: AppContext[] = [];

function serveMcp() {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/api/mcp" && !url.pathname.startsWith("/api/mcp/")) {
        return new Response("not found", { status: 404 });
      }
      const rest = url.pathname.slice("/api/mcp".length).split("/").filter(Boolean);
      const params = Promise.resolve(rest.length ? { path: rest } : {});
      const h = req.method === "POST" ? POST : req.method === "DELETE" ? DELETE : GET;
      return h(req, { params });
    },
  });
  return { port: server.port as number, stop: () => server.stop(true) };
}

async function start(
  agents: Partial<Record<string, Agent>> = {},
  { platform = true }: { platform?: boolean } = {},
): Promise<{ ctx: AppContext; fake: FakePlatform }> {
  app ??= serveMcp();
  fake = await startFakePlatform({ appPort: app.port, agents });
  const dataDir = tmp("threads-data");
  await importAddonFile(ADDON, dataDir, PY.appId);
  ctx = await createAppContext(
    { PRIMEFORGE_DATA_DIR: dataDir, MATHVIZ_TARGET: "python", PRIMEFORGE_PORT: String(app.port) },
    {
      migrationsDir: MIGRATIONS,
      platform: platform ? createPlatformClient({ apiUrl: fake.url, secret: fake.secret }) : null,
      log: () => {},
    },
  );
  opened.push(ctx);
  setAppContext(ctx);
  if (platform) expect(await startAi(ctx, { retryMs: 0 })).toBe(true);
  return { ctx, fake };
}

/** A request as the shell's own page sends it: right Host, same-origin, the CSRF token on writes. */
function req(method: string, path: string, body?: unknown, { csrf = true } = {}) {
  const c = ctx as AppContext;
  const headers: Record<string, string> = {
    host: `127.0.0.1:${c.port}`,
    "sec-fetch-site": "same-origin",
  };
  if (csrf && method !== "GET") headers[CSRF_HEADER] = c.csrfToken;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`http://127.0.0.1:${c.port}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

// biome-ignore lint/suspicious/noExplicitAny: JSON bodies of the API under test
type Json = any;
async function call(res: Promise<Response> | Response): Promise<{ status: number; body: Json }> {
  const r = await res;
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}

const blankState = (over: Record<string, unknown> = {}) => ({
  progId: PROG,
  mode: "blank",
  blankId: FIRST_BLANK,
  given: [],
  ...over,
});

const jobRow = (id: string) =>
  (ctx as AppContext).db
    .prepare("SELECT * FROM ai_jobs WHERE id = ?")
    .get<AiJobRow>(id) as AiJobRow;

const fakeJobOf = (f: FakePlatform, row: AiJobRow) =>
  [...f.jobs.values()].find((j) => j.id === row.platform_job_id);

const getTask = (calls: ToolCall[]) =>
  JSON.parse(calls.find((c) => c.tool === "mv_get_task")?.text ?? "{}");

beforeAll(async () => {
  PAYLOAD = await extractPayload("python");
  ADDON = buildPfaddon(PAYLOAD, PY.appId, "1.0.0");
  // chosen by shape, never by id (a content wave must not turn this red)
  const program = pickBlankProgram(PAYLOAD);
  PROG = program.id;
  const first = blanksOf(program.source).find((b) => b.body.some((l) => l.trim() !== ""));
  if (!first) throw new Error(`${PROG} has no blank`);
  FIRST_BLANK = first.id;
  FIRST_ANSWER = (first.body.find((l) => l.trim() !== "") as string).trim();
  PROG_TOOL = program.tool ?? "";
  expect(PROG_TOOL).not.toBe("");
}, 120_000);

afterEach(async () => {
  await fake?.close();
  fake = null;
});

afterAll(() => {
  setAppContext(null);
  app?.stop();
  for (const c of opened) c.close();
});

describe("ask → answer → note", () => {
  test("POST /api/threads 202; the fake platform answers; the thread holds one question and one answer", async () => {
    const { fake: f } = await start();
    const r = await call(
      postThread(
        req("POST", "/api/threads", {
          subjects: [{ type: "program", id: PROG }],
          message: "Why multiply by 9/5?",
          workflow: "ask",
          pyState: blankState(),
        }),
      ),
    );
    expect(r.status).toBe(202);
    expect(typeof r.body.threadId).toBe("string");
    expect(typeof r.body.jobId).toBe("string");
    await f.idle();

    const j = await call(
      getJob(req("GET", `/api/jobs/${r.body.jobId}`), params({ id: r.body.jobId })),
    );
    expect(j.status).toBe(200);
    expect(j.body).toMatchObject({ status: "completed", threadId: r.body.threadId, error: null });

    const t = await call(
      getThread(req("GET", `/api/threads/${r.body.threadId}`), params({ id: r.body.threadId })),
    );
    expect(t.status).toBe(200);
    expect(t.body.messages.map((m: Json) => m.role)).toEqual(["user", "assistant"]);
    expect(t.body.messages[0].text).toBe("Why multiply by 9/5?");
    expect(t.body.subjects).toEqual([{ type: "program", id: PROG }]);
    // the citation is resolved to the program's page inside its tool
    expect(t.body.messages[1].citations).toEqual([
      {
        id: `program:${PROG}`,
        title: { en: expect.any(String), zh: expect.any(String) },
        href: `/tool/${PROG_TOOL}?prog=${PROG}`,
      },
    ]);
    expect(t.body.job).toMatchObject({ id: r.body.jobId, status: "completed" });

    // save the answer as a note, list it, filter it, delete it
    const answerId = t.body.messages[1].id as string;
    const n = await call(postNote(req("POST", "/api/notes", { messageId: answerId })));
    expect(n.status).toBe(201);
    const again = await call(postNote(req("POST", "/api/notes", { messageId: answerId })));
    expect([again.status, again.body.id]).toEqual([200, n.body.id]);
    const all = await call(listNotes(req("GET", "/api/notes")));
    expect(all.body.notes.length).toBe(1);
    expect(all.body.notes[0]).toMatchObject({
      id: n.body.id,
      messageId: answerId,
      threadId: r.body.threadId,
      question: "Why multiply by 9/5?",
    });
    // what the notes page filters by: the program, and the tool it belongs to
    expect(all.body.notes[0].subjects).toEqual([
      {
        type: "program",
        id: PROG,
        title: { en: expect.any(String), zh: expect.any(String) },
        toolId: PROG_TOOL,
        programId: PROG,
      },
    ]);
    const hit = await call(listNotes(req("GET", "/api/notes?q=division")));
    expect(hit.body.notes.length).toBe(1);
    const byQuestion = await call(listNotes(req("GET", "/api/notes?q=multiply")));
    expect(byQuestion.body.notes.length).toBe(1);
    const miss = await call(listNotes(req("GET", "/api/notes?q=zzzz-no-such-word")));
    expect(miss.body.notes.length).toBe(0);
    // a LIKE wildcard is a literal character, not "anything"
    const wild = await call(listNotes(req("GET", "/api/notes?q=%25")));
    expect(wild.body.notes.length).toBe(0);
    const del = await call(
      deleteNote(req("DELETE", `/api/notes/${n.body.id}`), params({ id: n.body.id })),
    );
    expect(del.status).toBe(204);
    const none = await call(listNotes(req("GET", "/api/notes")));
    expect(none.body.notes).toEqual([]);
    const gone = await call(
      deleteNote(req("DELETE", `/api/notes/${n.body.id}`), params({ id: n.body.id })),
    );
    expect(gone.status).toBe(404);
  });

  test("a student's own message cannot be saved as a note; an unknown one is 404", async () => {
    await start();
    const r = await call(
      postThread(
        req("POST", "/api/threads", {
          subjects: [{ type: "tool", id: PROG_TOOL }],
          message: "What is this page for?",
          workflow: "ask",
        }),
      ),
    );
    await fake?.idle();
    const t = await call(
      getThread(req("GET", `/api/threads/${r.body.threadId}`), params({ id: r.body.threadId })),
    );
    const mine = await call(
      postNote(req("POST", "/api/notes", { messageId: t.body.messages[0].id })),
    );
    expect(mine.status).toBe(400);
    const unknown = await call(postNote(req("POST", "/api/notes", { messageId: "nope" })));
    expect(unknown.status).toBe(404);
  });
});

describe("a machine with no AI engine this app may use (design §7.6)", () => {
  for (const code of ["engine_not_granted", "engine_unavailable"] as const) {
    test(`a submit refused ${code}: the job fails with that code and the panel says what to do`, async () => {
      const { fake: f } = await start();
      f.refuseEngines(code);
      const r = await call(
        postThread(
          req("POST", "/api/threads", {
            subjects: [{ type: "program", id: PROG }],
            message: "Why?",
            workflow: "ask",
            pyState: blankState(),
          }),
        ),
      );
      expect(r.status).toBe(202);
      const j = await call(
        getJob(req("GET", `/api/jobs/${r.body.jobId}`), params({ id: r.body.jobId })),
      );
      expect(j.body).toMatchObject({ status: "failed", error: code });
      expect(f.submits).toEqual([]);
      // what the panel shows for that job: the guidance, never "try again"
      const failure = { kind: "job", status: j.body.status, error: j.body.error } as const;
      for (const locale of ["en", "zh"] as const) {
        const text = failureText(failure, locale);
        expect(text).toBe(MESSAGES[locale].error[code]);
        expect(text).toContain("PrimeForge Desktop");
        expect(text).not.toBe(MESSAGES[locale].qa.failed.replace("{code}", code));
      }
    });
  }
});

describe("POST /api/threads validation", () => {
  const hint = (pyState: unknown) =>
    call(
      postThread(
        req("POST", "/api/threads", {
          subjects: [{ type: "program", id: PROG }],
          message: "A hint, please.",
          workflow: "hint",
          ...(pyState === undefined ? {} : { pyState }),
        }),
      ),
    );

  test("hint is 400 unless the page reports blank mode with a focused blank", async () => {
    await start();
    expect((await hint(undefined)).status).toBe(400);
    expect((await hint(null)).status).toBe(400);
    expect((await hint(blankState({ mode: "read" }))).status).toBe(400);
    expect((await hint(blankState({ mode: "trace" }))).status).toBe(400);
    expect((await hint(blankState({ blankId: null }))).status).toBe(400);
    // invalid state = no state at all
    expect((await hint(blankState({ given: "all" }))).status).toBe(400);
    expect((await hint(blankState({ mode: "BLANK" }))).status).toBe(400);
    expect((await hint(undefined)).body.error.code).toBe("hint_needs_blank");
    expect(
      (ctx as AppContext).db.prepare("SELECT COUNT(*) AS n FROM threads").get<{ n: number }>()?.n,
    ).toBe(0);
  });

  test("a valid hint is about the focused blank: its blank subject is added to the job", async () => {
    const { fake: f } = await start();
    const r = await hint(blankState());
    expect(r.status).toBe(202);
    await f.idle();
    const row = jobRow(r.body.jobId);
    expect(row.workflow).toBe("hint");
    expect(inputOf(row).subjects).toContainEqual({
      type: "blank",
      id: blankSubject(PROG, FIRST_BLANK),
    });
    expect(row.status).toBe("completed");
  });

  test("an invalid pyState on an ask is stored as no state (nothing allowed)", async () => {
    const { fake: f } = await start();
    const r = await call(
      postThread(
        req("POST", "/api/threads", {
          subjects: [{ type: "program", id: PROG }],
          message: "Explain the formula",
          workflow: "ask",
          pyState: { progId: PROG, mode: "read", blankId: null, given: [1] },
        }),
      ),
    );
    expect(r.status).toBe(202);
    await f.idle();
    expect(inputOf(jobRow(r.body.jobId)).pyState).toBeNull();
    expect(JSON.parse(jobRow(r.body.jobId).input).pyState).toBeNull();
  });

  test("bad bodies are 400, unknown subjects 404, a write without the CSRF token 403", async () => {
    await start();
    const post = (body: unknown, opts?: { csrf?: boolean }) =>
      call(postThread(req("POST", "/api/threads", body, opts)));
    const ok = { subjects: [{ type: "program", id: PROG }], message: "Hi", workflow: "ask" };
    expect((await post({ ...ok, workflow: "solve" })).status).toBe(400);
    expect((await post({ ...ok, message: "   " })).status).toBe(400);
    expect((await post({ ...ok, message: "x".repeat(4001) })).status).toBe(400);
    expect((await post({ ...ok, subjects: [] })).status).toBe(400);
    expect((await post({ ...ok, subjects: [{ type: "page", id: "x" }] })).status).toBe(400);
    expect((await post({ ...ok, subjects: [{ type: "program", id: "no-such" }] })).status).toBe(
      404,
    );
    expect((await post({ ...ok, subjects: [{ type: "tool", id: "no-such" }] })).status).toBe(404);
    expect((await post(ok, { csrf: false })).status).toBe(403);
  });

  test("without the platform: 503 ai_unavailable, nothing stored", async () => {
    await start({}, { platform: false });
    const r = await call(
      postThread(
        req("POST", "/api/threads", {
          subjects: [{ type: "program", id: PROG }],
          message: "Hi",
          workflow: "ask",
        }),
      ),
    );
    expect([r.status, r.body.error.code]).toEqual([503, "ai_unavailable"]);
    expect(
      (ctx as AppContext).db.prepare("SELECT COUNT(*) AS n FROM threads").get<{ n: number }>()?.n,
    ).toBe(0);
  });
});

describe("the library workflow", () => {
  test("subjects become the library; the answer's citations resolve to tool and program pages", async () => {
    const library: Agent = async ({ call: c, callT }) => {
      const s = await c("mv_search_library", { query: "Fahrenheit", limit: 5 });
      const { hits } = JSON.parse(s.text) as { hits: { id: string }[] };
      const prog = hits.find((h) => h.id === `program:${PROG}`);
      return callT("mv_submit_answer", {
        text: "See the conversion program.",
        citations: [prog?.id ?? `program:${PROG}`, `tool:${PROG_TOOL}`],
        revealsAnswer: false,
      });
    };
    const { fake: f } = await start({ library });
    const r = await call(
      postThread(
        req("POST", "/api/threads", {
          subjects: [{ type: "program", id: PROG }],
          message: "Where do I convert temperatures?",
          workflow: "library",
        }),
      ),
    );
    expect(r.status).toBe(202);
    await f.idle();
    expect(inputOf(jobRow(r.body.jobId)).subjects).toEqual([{ type: "library", id: "all" }]);
    const t = await call(
      getThread(req("GET", `/api/threads/${r.body.threadId}`), params({ id: r.body.threadId })),
    );
    expect(t.body.messages[1].citations.map((c: Json) => c.href)).toEqual([
      `/tool/${PROG_TOOL}?prog=${PROG}`,
      `/tool/${PROG_TOOL}`,
    ]);
    expect(t.body.workflow).toBe("library");
  });
});

describe("follow-ups and the conversation handed to the agent", () => {
  /** A thread whose earlier turns quote the first answer line: a pasted attempt and a read-mode answer. */
  function seededThread(c: AppContext): string {
    const at = "2026-01-01T10:00:00.000Z";
    const id = newId(at);
    c.db
      .prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(id, "seeded", at, at);
    c.db
      .prepare(
        "INSERT INTO thread_subjects (thread_id, subject_type, subject_id) VALUES (?, 'program', ?)",
      )
      .run(id, PROG);
    const msg = c.db.prepare(
      "INSERT INTO messages (id, thread_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    msg.run(newId(at), id, "user", `Is this right?\n    ${FIRST_ANSWER}\nthanks`, at);
    const at2 = "2026-01-01T10:00:01.000Z";
    msg.run(newId(at2), id, "assistant", `In read mode you can see it: \`${FIRST_ANSWER}\`.`, at2);
    return id;
  }

  const followUp = (threadId: string, pyState: unknown, workflow = "ask") =>
    call(
      postFollowUp(
        req("POST", `/api/threads/${threadId}`, {
          message: "And the next line?",
          workflow,
          pyState,
        }),
        params({ id: threadId }),
      ),
    );

  test("not read mode: earlier messages reach the agent with the answer lines redacted", async () => {
    const { ctx: c, fake: f } = await start();
    const threadId = seededThread(c);
    const r = await followUp(threadId, blankState());
    expect(r.status).toBe(202);
    expect(r.body.threadId).toBe(threadId);
    await f.idle();
    const row = jobRow(r.body.jobId);
    const task = getTask(fakeJobOf(f, row)?.calls ?? []);
    expect(task.question).toBe("And the next line?");
    expect(task.conversation.map((m: Json) => m.role)).toEqual(["student", "tutor"]);
    const flat = JSON.stringify(task.conversation);
    expect(flat).not.toContain(FIRST_ANSWER);
    expect(flat.replace(/\s+/g, "")).not.toContain(FIRST_ANSWER.replace(/\s+/g, ""));
    expect(task.conversation[0].text).toContain("Is this right?");
    expect(task.conversation[0].text).toContain(REDACTED);
    expect(task.conversation[1].text).toContain(REDACTED);
    expect(row.status).toBe("completed");
  });

  test("the same with no bridge state at all", async () => {
    const { ctx: c, fake: f } = await start();
    const threadId = seededThread(c);
    const r = await followUp(threadId, undefined);
    await f.idle();
    const task = getTask(fakeJobOf(f, jobRow(r.body.jobId))?.calls ?? []);
    expect(JSON.stringify(task.conversation)).not.toContain(FIRST_ANSWER);
  });

  test("read mode: the conversation is handed over as it was", async () => {
    const { ctx: c, fake: f } = await start();
    const threadId = seededThread(c);
    const r = await followUp(threadId, { progId: PROG, mode: "read", blankId: null, given: [] });
    await f.idle();
    const task = getTask(fakeJobOf(f, jobRow(r.body.jobId))?.calls ?? []);
    expect(task.conversation[0].text).toBe(`Is this right?\n    ${FIRST_ANSWER}\nthanks`);
    expect(task.conversation[1].text).toContain(FIRST_ANSWER);
  });

  test("a follow-up while the thread's job is still open is 409; cancel ends it", async () => {
    const { fake: f } = await start();
    f.sim.hold.add("ask");
    const r = await call(
      postThread(
        req("POST", "/api/threads", {
          subjects: [{ type: "program", id: PROG }],
          message: "Hold on",
          workflow: "ask",
          pyState: blankState(),
        }),
      ),
    );
    expect(r.status).toBe(202);
    const busy = await followUp(r.body.threadId, blankState());
    expect([busy.status, busy.body.error.code]).toEqual([409, "thread_busy"]);
    const running = await call(
      getJob(req("GET", `/api/jobs/${r.body.jobId}`), params({ id: r.body.jobId })),
    );
    expect(["queued", "running"]).toContain(running.body.status);
    const cancel = await call(
      deleteJob(req("DELETE", `/api/jobs/${r.body.jobId}`), params({ id: r.body.jobId })),
    );
    expect([cancel.status, cancel.body.status]).toEqual([200, "cancelled"]);
    const after = await call(
      getJob(req("GET", `/api/jobs/${r.body.jobId}`), params({ id: r.body.jobId })),
    );
    expect(after.body.status).toBe("cancelled");
    const unknown = await call(getJob(req("GET", "/api/jobs/nope"), params({ id: "nope" })));
    expect(unknown.status).toBe(404);
    f.release("ask");
    await f.idle();
  });

  test("a thread's subjects are fixed: a follow-up that would change them is 400 workflow_mismatch", async () => {
    const { ctx: c, fake: f } = await start();
    const programThread = seededThread(c);
    const lib = await followUp(programThread, undefined, "library");
    expect([lib.status, lib.body.error.code]).toEqual([400, "workflow_mismatch"]);
    // a hint for a blank of another program than the thread is about
    const other = await followUp(programThread, blankState({ progId: `${PROG}-other` }), "hint");
    expect([other.status, other.body.error.code]).toEqual([400, "workflow_mismatch"]);
    // switching between ask and hint on the thread's own program is fine
    expect((await followUp(programThread, blankState(), "hint")).status).toBe(202);
    await f.idle();

    const r = await call(
      postThread(
        req("POST", "/api/threads", {
          subjects: [{ type: "library", id: "all" }],
          message: "Where are loops?",
          workflow: "library",
        }),
      ),
    );
    await f.idle();
    for (const w of ["ask", "hint"]) {
      const x = await followUp(r.body.threadId, blankState(), w);
      expect([w, x.status, x.body.error.code]).toEqual([w, 400, "workflow_mismatch"]);
    }
    expect((await followUp(r.body.threadId, undefined, "library")).status).toBe(202);
    await f.idle();
    const jobs = c.db.prepare("SELECT COUNT(*) AS n FROM ai_jobs").get<{ n: number }>()?.n;
    expect(jobs).toBe(3);
  });

  test("history is redacted against every subject the thread has had, not only the job's", async () => {
    const { ctx: c } = await start();
    const threadId = seededThread(c);
    const at = new Date().toISOString();
    c.db
      .prepare(
        "INSERT INTO messages (id, thread_id, role, text, created_at) VALUES (?, ?, 'user', ?, ?)",
      )
      .run(newId(at), threadId, "Now about the library", at);
    // a job about the library alone, with no bridge state (as a crafted request might make one)
    const job = createJob(c.db, {
      threadId,
      workflow: "library",
      subjects: [{ type: "library", id: "all" }],
      pyState: null,
    });
    const task = buildTask(c.db, c.content?.dir ?? null, jobRow(job.id));
    const flat = JSON.stringify(task.conversation);
    expect(flat).not.toContain(FIRST_ANSWER);
    expect(flat).toContain(REDACTED);
  });

  test("an unknown thread is 404", async () => {
    await start();
    expect(
      (await call(getThread(req("GET", "/api/threads/nope"), params({ id: "nope" })))).status,
    ).toBe(404);
    expect((await followUp("nope", blankState())).status).toBe(404);
  });
});

describe("GET /api/threads?subject= (the tool page reopens its conversation)", () => {
  const find = (subject: string | null) =>
    call(
      findThread(
        req(
          "GET",
          subject === null ? "/api/threads" : `/api/threads?subject=${encodeURIComponent(subject)}`,
        ),
      ),
    );
  const ask = (
    subjects: unknown,
    message: string,
    workflow = "ask",
    pyState: unknown = undefined,
  ) =>
    call(
      postThread(
        req("POST", "/api/threads", {
          subjects,
          message,
          workflow,
          ...(pyState === undefined ? {} : { pyState }),
        }),
      ),
    );

  test("none → null; after a question about a program, the program's thread with its messages", async () => {
    const { fake: f } = await start();
    expect(await find(`program:${PROG}`)).toEqual({ status: 200, body: { thread: null } });
    expect(await find(`tool:${PROG_TOOL}`)).toEqual({ status: 200, body: { thread: null } });
    expect(await find("program:no-such")).toEqual({ status: 200, body: { thread: null } });

    const r = await ask([{ type: "program", id: PROG }], "Why multiply by 9/5?");
    await f.idle();
    const got = await find(`program:${PROG}`);
    expect(got.status).toBe(200);
    expect(got.body.thread.id).toBe(r.body.threadId);
    expect(
      got.body.thread.messages.map((m: Json) => [m.role, m.role === "user" ? m.text : ""]),
    ).toEqual([
      ["user", "Why multiply by 9/5?"],
      ["assistant", ""],
    ]);
    expect(got.body.thread.job).toMatchObject({ id: r.body.jobId, status: "completed" });
    // the same body GET /api/threads/:id answers
    const byId = await call(
      getThread(req("GET", `/api/threads/${r.body.threadId}`), params({ id: r.body.threadId })),
    );
    expect(got.body.thread).toEqual(byId.body);
    // a program thread is not the tool's thread
    expect((await find(`tool:${PROG_TOOL}`)).body.thread).toBeNull();
  });

  test("an open job comes back with the thread, so the page can resume polling", async () => {
    const { fake: f } = await start();
    f.sim.hold.add("ask");
    const r = await ask([{ type: "tool", id: PROG_TOOL }], "Still thinking?");
    const got = await find(`tool:${PROG_TOOL}`);
    expect(got.body.thread.id).toBe(r.body.threadId);
    expect(["queued", "running"]).toContain(got.body.thread.job.status);
    f.release("ask");
    await f.idle();
  });

  test("a thread that has had a hint (a blank subject added) is still found by its program", async () => {
    const { fake: f } = await start();
    const r = await ask([{ type: "program", id: PROG }], "A hint, please.", "hint", blankState());
    expect(r.status).toBe(202);
    await f.idle();
    const got = await find(`program:${PROG}`);
    expect(got.body.thread.id).toBe(r.body.threadId);
    expect(got.body.thread.subjects).toContainEqual({
      type: "blank",
      id: blankSubject(PROG, FIRST_BLANK),
    });
    // and a hint follow-up on an ask thread keeps it findable too
    const a = await ask([{ type: "program", id: PROG }], "Explain it");
    await f.idle();
    const h = await call(
      postFollowUp(
        req("POST", `/api/threads/${a.body.threadId}`, {
          message: "And a hint?",
          workflow: "hint",
          pyState: blankState(),
        }),
        params({ id: a.body.threadId }),
      ),
    );
    expect(h.status).toBe(202);
    await f.idle();
    expect((await find(`program:${PROG}`)).body.thread.id).toBe(a.body.threadId);
  });

  test("the newest of two wins — by the last message, not by creation", async () => {
    const { ctx: c, fake: f } = await start();
    const older = await ask([{ type: "program", id: PROG }], "First question");
    await f.idle();
    const newer = await ask([{ type: "program", id: PROG }], "Second question");
    await f.idle();
    expect((await find(`program:${PROG}`)).body.thread.id).toBe(newer.body.threadId);
    // ordered by updated_at (the last message), not by creation: an older stamp loses
    c.db
      .prepare("UPDATE threads SET updated_at = ? WHERE id = ?")
      .run("2000-01-01T00:00:00.000Z", newer.body.threadId);
    expect((await find(`program:${PROG}`)).body.thread.id).toBe(older.body.threadId);
    c.db.prepare("UPDATE threads SET archived = 1 WHERE id = ?").run(older.body.threadId);
    // an archived thread is not reopened
    expect((await find(`program:${PROG}`)).body.thread.id).toBe(newer.body.threadId);
  });

  test("a library thread is never returned, even one that also names the program", async () => {
    const { ctx: c, fake: f } = await start();
    const lib = await ask([{ type: "program", id: PROG }], "Where are loops?", "library");
    expect(lib.status).toBe(202);
    await f.idle();
    expect((await find(`program:${PROG}`)).body.thread).toBeNull();
    // a crafted row: library and program both (plan() never stores this; the lookup still refuses it)
    c.db
      .prepare(
        "INSERT INTO thread_subjects (thread_id, subject_type, subject_id) VALUES (?, 'program', ?)",
      )
      .run(lib.body.threadId, PROG);
    expect((await find(`program:${PROG}`)).body.thread).toBeNull();
  });

  test("&list=1: every conversation about the subject, newest first, with counts and a notes mark", async () => {
    const { ctx: c, fake: f } = await start();
    const list = async (subject: string) => {
      const r = await call(
        findThread(req("GET", `/api/threads?subject=${encodeURIComponent(subject)}&list=1`)),
      );
      expect(r.status).toBe(200);
      return r.body.threads as Json[];
    };
    expect(await list(`program:${PROG}`)).toEqual([]);
    const older = await ask([{ type: "program", id: PROG }], "First question");
    await f.idle();
    const newer = await ask([{ type: "program", id: PROG }], "Second question");
    await f.idle();
    // a follow-up: two more messages on the older one
    expect(
      (
        await call(
          postFollowUp(
            req("POST", `/api/threads/${older.body.threadId}`, {
              message: "And then?",
              workflow: "ask",
            }),
            params({ id: older.body.threadId }),
          ),
        )
      ).status,
    ).toBe(202);
    await f.idle();
    // not listed: another subject, a library thread, an archived one
    await ask([{ type: "tool", id: PROG_TOOL }], "About the tool");
    await f.idle();
    const lib = await ask([{ type: "program", id: PROG }], "Library question", "library");
    await f.idle();
    // a library thread that also names the program (plan() never stores this; the list refuses it)
    c.db
      .prepare(
        "INSERT INTO thread_subjects (thread_id, subject_type, subject_id) VALUES (?, 'program', ?)",
      )
      .run(lib.body.threadId, PROG);
    const gone = await ask([{ type: "program", id: PROG }], "Archived question");
    await f.idle();
    c.db.prepare("UPDATE threads SET archived = 1 WHERE id = ?").run(gone.body.threadId);
    // a saved note on the newer one
    const nt = await call(
      getThread(
        req("GET", `/api/threads/${newer.body.threadId}`),
        params({ id: newer.body.threadId }),
      ),
    );
    const answer = nt.body.messages.find((m: Json) => m.role === "assistant");
    expect((await call(postNote(req("POST", "/api/notes", { messageId: answer.id })))).status).toBe(
      201,
    );

    const rows = await list(`program:${PROG}`);
    // the older one was followed up last: updated_at orders, not creation
    expect(rows.map((r) => r.id)).toEqual([older.body.threadId, newer.body.threadId]);
    expect(rows.map((r) => [r.title, r.messageCount, r.hasNotes])).toEqual([
      ["First question", 4, false],
      ["Second question", 2, true],
    ]);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual([
        "hasNotes",
        "id",
        "messageCount",
        "title",
        "updatedAt",
      ]);
      expect(Number.isNaN(Date.parse(r.updatedAt))).toBe(false);
    }
    // the first row is the thread the single lookup reopens
    expect((await find(`program:${PROG}`)).body.thread.id).toBe(rows[0].id);
    expect((await list(`tool:${PROG_TOOL}`)).length).toBe(1);

    // capped at MAX_SUBJECT_THREADS, the newest kept
    const add = c.db.prepare(
      "INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    );
    const about = c.db.prepare(
      "INSERT INTO thread_subjects (thread_id, subject_type, subject_id) VALUES (?, 'program', ?)",
    );
    for (let i = 0; i < MAX_SUBJECT_THREADS + 5; i++) {
      const at = new Date(Date.UTC(2001, 0, 1, 0, i)).toISOString();
      add.run(`bulk-${String(i).padStart(3, "0")}`, `bulk ${i}`, at, at);
      about.run(`bulk-${String(i).padStart(3, "0")}`, PROG);
    }
    const capped = await list(`program:${PROG}`);
    expect(MAX_SUBJECT_THREADS).toBe(50);
    expect(capped.length).toBe(MAX_SUBJECT_THREADS);
    expect(capped.slice(0, 2).map((r) => r.id)).toEqual([older.body.threadId, newer.body.threadId]);
    expect(capped[2].id).toBe(`bulk-0${MAX_SUBJECT_THREADS + 4}`);
    expect(capped.at(-1).id).toBe(`bulk-00${7}`);
    expect(capped.at(-1).messageCount).toBe(0);
    // newest first throughout
    const stamps = capped.map((r) => r.updatedAt);
    expect([...stamps].sort().reverse()).toEqual(stamps);
  });

  test("a bad subject is 400", async () => {
    await start();
    for (const bad of [
      null,
      "",
      "program",
      "program:",
      `blank:${blankSubject(PROG, FIRST_BLANK)}`,
      "library:all",
      `page:${PROG}`,
      `:${PROG}`,
      `program:${"x".repeat(201)}`,
    ]) {
      const r = await find(bad);
      expect([bad, r.status, r.body.error.code]).toEqual([bad, 400, "bad_request"]);
      const l = await call(
        findThread(
          req(
            "GET",
            `/api/threads?${bad === null ? "" : `subject=${encodeURIComponent(bad)}&`}list=1`,
          ),
        ),
      );
      expect([bad, l.status]).toEqual([bad, 400]);
    }
  });
});

describe("the reply language (settings.aiLang)", () => {
  const ask = (locale?: "en" | "zh") =>
    call(
      postThread(
        req("POST", "/api/threads", {
          subjects: [{ type: "program", id: PROG }],
          message: "Which language?",
          workflow: "ask",
          ...(locale ? { locale } : {}),
        }),
      ),
    );

  test("'page' (the default): the asking page's locale, else the shell's; 'en' / 'zh' win over it", async () => {
    const { ctx: c, fake: f } = await start();
    const localeOf = async (locale?: "en" | "zh") => {
      const r = await ask(locale);
      expect(r.status).toBe(202);
      await f.idle();
      return inputOf(jobRow(r.body.jobId)).locale;
    };
    expect(await localeOf("zh")).toBe("zh");
    expect(await localeOf("en")).toBe("en");
    expect(await localeOf()).toBe("en"); // python's defaultLang, nothing stored
    setAiLang(c.db, "zh");
    expect(await localeOf("en")).toBe("zh");
    expect(await localeOf()).toBe("zh");
    setAiLang(c.db, "en");
    expect(await localeOf("zh")).toBe("en");
    setAiLang(c.db, "page");
    expect(await localeOf("zh")).toBe("zh");
  });

  test("a follow-up follows the setting too", async () => {
    const { ctx: c, fake: f } = await start();
    const r = await ask("en");
    await f.idle();
    setAiLang(c.db, "zh");
    const up = await call(
      postFollowUp(
        req("POST", `/api/threads/${r.body.threadId}`, {
          message: "Again?",
          workflow: "ask",
          locale: "en",
        }),
        params({ id: r.body.threadId }),
      ),
    );
    expect(up.status).toBe(202);
    await f.idle();
    expect(inputOf(jobRow(up.body.jobId)).locale).toBe("zh");
  });
});

describe("GET /api/notes/threads (the notes page: one row per conversation)", () => {
  interface Seed {
    subjects: [string, string][];
    title?: string;
    /** [role, text, saved?]; a saved message is an assistant answer with a note. */
    msgs: [string, string, boolean?][];
  }
  let clock = Date.parse("2026-02-01T10:00:00.000Z");
  const tick = () => {
    clock += 1000;
    return new Date(clock).toISOString();
  };

  /** A thread written straight into the database, its messages one second apart, its notes in order. */
  function seed(c: AppContext, s: Seed): { id: string; messageIds: string[] } {
    const at = tick();
    const id = newId(at);
    c.db
      .prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(id, s.title ?? s.msgs[0]?.[1] ?? "", at, at);
    for (const [type, sid] of s.subjects) {
      c.db
        .prepare(
          "INSERT INTO thread_subjects (thread_id, subject_type, subject_id) VALUES (?, ?, ?)",
        )
        .run(id, type, sid);
    }
    const messageIds: string[] = [];
    for (const [role, text, saved] of s.msgs) {
      const mAt = tick();
      const mid = newId(mAt);
      messageIds.push(mid);
      c.db
        .prepare(
          "INSERT INTO messages (id, thread_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(mid, id, role, text, mAt);
      if (saved) {
        const nAt = tick();
        c.db
          .prepare("INSERT INTO notes (id, message_id, created_at) VALUES (?, ?, ?)")
          .run(newId(nAt), mid, nAt);
      }
    }
    return { id, messageIds };
  }

  const list = (qs = "") =>
    call(listNoteThreads(req("GET", `/api/notes/threads${qs ? `?${qs}` : ""}`)));

  /** A tool in a catalog group other than the program's tool's (picked from the catalog, never by id). */
  function otherGroupTool(c: AppContext): { tool: string; group: string; progGroup: string } {
    const progGroup = (
      c.db
        .prepare("SELECT grp FROM catalog_items WHERE id = ?")
        .get<{ grp: string }>(PROG_TOOL) as {
        grp: string;
      }
    ).grp;
    const other = c.db
      .prepare("SELECT id, grp FROM catalog_items WHERE grp <> ? ORDER BY ord LIMIT 1")
      .get<{ id: string; grp: string }>(progGroup);
    if (!other) throw new Error("the pack has one catalog group: no second group to filter by");
    return { tool: other.id, group: other.grp, progGroup };
  }

  test("two saved answers in one thread are one row, with its question, note count and follow-ups", async () => {
    const { ctx: c } = await start({}, { platform: false });
    const a = seed(c, {
      subjects: [["program", PROG]],
      msgs: [
        ["user", "First question about loops"],
        ["assistant", "An unsaved answer about pebbles"],
        ["user", "Second question"],
        ["assistant", "Saved answer one about rivers", true],
        ["user", "Third question"],
        ["assistant", "Saved answer two about mountains", true],
        ["user", "Fourth question"],
      ],
    });
    // a conversation with nothing saved is not listed
    seed(c, {
      subjects: [["program", PROG]],
      msgs: [
        ["user", "Q"],
        ["assistant", "A"],
      ],
    });
    const r = await list();
    expect(r.status).toBe(200);
    expect(r.body.threads.length).toBe(1);
    const row = r.body.threads[0];
    expect(row).toMatchObject({
      id: a.id,
      question: "First question about loops",
      notes: 2,
      followUps: 2,
      kind: "program",
      href: `/tool/${PROG_TOOL}?prog=${PROG}&thread=${a.id}`,
      available: true,
    });
    expect(row.subject).toMatchObject({ type: "program", id: PROG, toolId: PROG_TOOL });
    expect(row.group.id).toBe(otherGroupTool(c).progGroup);
    // the newest saved answer's date
    const newest = c.db
      .prepare(
        "SELECT max(n.created_at) AS at FROM notes n JOIN messages m ON m.id = n.message_id WHERE m.thread_id = ?",
      )
      .get<{ at: string }>(a.id);
    expect(row.latestNoteAt).toBe(newest?.at);
    // the old one-row-per-note list still has both notes
    expect((await call(listNotes(req("GET", "/api/notes")))).body.notes.length).toBe(2);
  });

  test("search: the question, the title and saved answers match; an unsaved answer does not", async () => {
    const { ctx: c } = await start({}, { platform: false });
    const a = seed(c, {
      subjects: [["program", PROG]],
      title: "Title about kettles",
      msgs: [
        ["user", "Question about loops"],
        ["assistant", "Unsaved words about pebbles"],
        ["user", "Asked about lanterns"],
        ["assistant", "Saved words about rivers", true],
      ],
    });
    const ids = async (q: string) =>
      (await list(new URLSearchParams({ q }).toString())).body.threads.map((t: Json) => t.id);
    expect(await ids("loops")).toEqual([a.id]);
    expect(await ids("kettles")).toEqual([a.id]);
    expect(await ids("rivers")).toEqual([a.id]);
    // the question the saved answer replied to, as GET /api/notes matched it
    expect(await ids("lanterns")).toEqual([a.id]);
    expect(await ids("pebbles")).toEqual([]);
    expect(await ids("%")).toEqual([]);
  });

  test("group filter: a catalog group's threads, the library's, and counts for the chips", async () => {
    const { ctx: c } = await start({}, { platform: false });
    const { tool, group, progGroup } = otherGroupTool(c);
    const a = seed(c, {
      subjects: [["program", PROG]],
      msgs: [
        ["user", "About the program"],
        ["assistant", "Saved", true],
      ],
    });
    const b = seed(c, {
      subjects: [["tool", tool]],
      msgs: [
        ["user", "About the other tool"],
        ["assistant", "Saved", true],
      ],
    });
    const l = seed(c, {
      subjects: [["library", "all"]],
      msgs: [
        ["user", "About everything"],
        ["assistant", "Saved", true],
      ],
    });
    const all = await list();
    // newest saved answer first
    expect(all.body.threads.map((t: Json) => t.id)).toEqual([l.id, b.id, a.id]);
    expect(all.body.groups).toEqual({ [progGroup]: 1, [group]: 1, library: 1 });
    const lib = all.body.threads[0];
    expect(lib).toMatchObject({ kind: "library", group: null, href: `/ask?thread=${l.id}` });
    expect(all.body.threads[1]).toMatchObject({
      kind: "tool",
      href: `/tool/${tool}?thread=${b.id}`,
    });
    const ids = async (g: string) =>
      (await list(`group=${encodeURIComponent(g)}`)).body.threads.map((t: Json) => t.id);
    expect(await ids(progGroup)).toEqual([a.id]);
    expect(await ids(group)).toEqual([b.id]);
    expect(await ids("library")).toEqual([l.id]);
    expect(await ids("no-such-group")).toEqual([]);
    // the counts are over the search, before the group filter
    const filtered = await list(`group=${encodeURIComponent(group)}`);
    expect(filtered.body.groups).toEqual(all.body.groups);
  });

  test("what it is about: a blank alone, a program or tool the content no longer has, no subject at all", async () => {
    const { ctx: c } = await start({}, { platform: false });
    const { progGroup } = otherGroupTool(c);
    const saved = (q: string): [string, string, boolean?][] => [
      ["user", q],
      ["assistant", "Saved", true],
    ];
    const blank = seed(c, {
      subjects: [["blank", blankSubject(PROG, FIRST_BLANK)]],
      msgs: saved("About a blank"),
    });
    const goneProg = seed(c, {
      subjects: [["program", "no-such-program"]],
      msgs: saved("Gone program"),
    });
    const goneProgTool = seed(c, {
      subjects: [
        ["program", "no-such-program"],
        ["tool", PROG_TOOL],
      ],
      msgs: saved("Gone program, its tool kept"),
    });
    const goneTool = seed(c, { subjects: [["tool", "no-such-tool"]], msgs: saved("Gone tool") });
    const none = seed(c, { subjects: [], msgs: saved("No subject") });
    const r = await list();
    expect(r.status).toBe(200);
    const by = Object.fromEntries(r.body.threads.map((t: Json) => [t.question, t]));
    expect(by["About a blank"]).toMatchObject({
      id: blank.id,
      kind: "program",
      available: true,
      href: `/tool/${PROG_TOOL}?prog=${PROG}&thread=${blank.id}`,
      subject: { type: "blank", programId: PROG, toolId: PROG_TOOL },
    });
    expect(by["About a blank"].group.id).toBe(progGroup);
    expect(by["Gone program"]).toMatchObject({
      id: goneProg.id,
      kind: "program",
      available: false,
      href: null,
      group: null,
      subject: { type: "program", id: "no-such-program", toolId: null },
    });
    // as the AI queue does: a tool the thread is also about, when the program's is gone
    expect(by["Gone program, its tool kept"]).toMatchObject({
      id: goneProgTool.id,
      kind: "program",
      available: false,
      href: `/tool/${PROG_TOOL}?thread=${goneProgTool.id}`,
    });
    expect(by["Gone program, its tool kept"].group.id).toBe(progGroup);
    expect(by["Gone tool"]).toMatchObject({
      id: goneTool.id,
      kind: "tool",
      available: false,
      href: null,
      group: null,
    });
    expect(by["No subject"]).toMatchObject({
      id: none.id,
      kind: "tool",
      subject: null,
      available: true,
      href: null,
      group: null,
    });
    // `available` is what a follow-up meets: a gone subject is 404 unknown_subject (checked before
    // the platform, so without one every other thread gets as far as 503 ai_unavailable)
    for (const t of r.body.threads as Json[]) {
      const f = await call(
        postFollowUp(
          req("POST", `/api/threads/${t.id}`, { message: "More?", workflow: "ask" }),
          params({ id: t.id }),
        ),
      );
      expect([t.question, f.status, f.body.error.code]).toEqual(
        t.available ? [t.question, 503, "ai_unavailable"] : [t.question, 404, "unknown_subject"],
      );
    }
  });

  test("DELETE /api/notes/threads/:id removes that thread's notes only; the conversation stays", async () => {
    const { ctx: c } = await start({}, { platform: false });
    const a = seed(c, {
      subjects: [["program", PROG]],
      msgs: [
        ["user", "Q1"],
        ["assistant", "A1", true],
        ["user", "Q2"],
        ["assistant", "A2", true],
      ],
    });
    const b = seed(c, {
      subjects: [["program", PROG]],
      msgs: [
        ["user", "Other"],
        ["assistant", "Kept", true],
      ],
    });
    const del = await call(
      deleteThreadNotes(req("DELETE", `/api/notes/threads/${a.id}`), params({ id: a.id })),
    );
    expect(del.status).toBe(204);
    expect((await list()).body.threads.map((t: Json) => t.id)).toEqual([b.id]);
    const t = await call(getThread(req("GET", `/api/threads/${a.id}`), params({ id: a.id })));
    expect(t.body.messages.length).toBe(4);
    expect(t.body.messages.every((m: Json) => m.noteId === null)).toBe(true);
    const again = await call(
      deleteThreadNotes(req("DELETE", `/api/notes/threads/${a.id}`), params({ id: a.id })),
    );
    expect(again.status).toBe(404);
    const noCsrf = await call(
      deleteThreadNotes(
        req("DELETE", `/api/notes/threads/${b.id}`, undefined, { csrf: false }),
        params({ id: b.id }),
      ),
    );
    expect(noCsrf.status).toBe(403);
    expect((await list()).body.threads.length).toBe(1);
  });
});
