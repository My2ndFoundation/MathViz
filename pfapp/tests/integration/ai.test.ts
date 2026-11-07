import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DELETE, GET, POST } from "../../app/src/app/api/mcp/[[...path]]/route";
import { createPlatformClient } from "../../app/src/lib/agent/platform/client";
import { loadProgram } from "../../app/src/lib/ai/context";
import {
  blankSubject,
  NEEDS_BLANK_DONE,
  pollJob,
  reconcileJobs,
  type Subject,
  submitJob,
  WORKFLOW_RUNTIME_SECONDS,
  type Workflow,
} from "../../app/src/lib/ai/jobs";
import { blanksOf } from "../../app/src/lib/ai/leak";
import { importAddonFile } from "../../app/src/lib/content/manual-import";
import { newId } from "../../app/src/lib/db/ids";
import { migrationsDir } from "../../app/src/lib/db/open";
import type { AiJobRow, MessageRow } from "../../app/src/lib/db/schema";
import { LEAK_REFUSAL, WORKFLOW_TOOLS } from "../../app/src/lib/mcp/tools";
import type { PyState } from "../../app/src/lib/py-state";
import { startAi } from "../../app/src/lib/server/ai";
import { type AppContext, createAppContext, setAppContext } from "../../app/src/lib/server/context";
import { loadTarget } from "../../app/src/lib/target";
import { buildPfaddon, extractPayload, tmp } from "../helpers/content-fixtures";
import {
  type Agent,
  type FakePlatform,
  type PYTHON_MANIFEST,
  startFakePlatform,
  type ToolCall,
} from "./fake-platform";

/**
 * AI jobs end to end over real HTTP and real MCP: the app's MCP route handler served on a loopback
 * port, the fake platform's scripted agents connecting to it the way the platform points an engine
 * at a job's one-time path. The content is the real python payload from this checkout (manual
 * import); which lines a blank holds is read from the program source, never hard-coded.
 */

setDefaultTimeout(60_000);

const PY = loadTarget("python");
const MIGRATIONS = migrationsDir(join(import.meta.dir, "..", ".."));
const PROG = "celsius-to-fahrenheit";

let PAYLOAD = "";
let ADDON = "";
let ANSWERS: string[] = [];
let FIRST_ANSWER = "";

let app: { port: number; stop: () => void } | null = null;
let ctx: AppContext | null = null;
let fake: FakePlatform | null = null;
const opened: AppContext[] = [];

/** The MCP route on a real port; the request goes in exactly as the platform sends it. */
function serveApp() {
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
  dataDir = tmp("ai-data"),
): Promise<{ ctx: AppContext; fake: FakePlatform; dataDir: string }> {
  app ??= serveApp();
  fake = await startFakePlatform({ appPort: app.port, agents });
  await importAddonFile(ADDON, dataDir, PY.appId);
  ctx = await createAppContext(
    { PRIMEFORGE_DATA_DIR: dataDir, MATHVIZ_TARGET: "python", PRIMEFORGE_PORT: String(app.port) },
    {
      migrationsDir: MIGRATIONS,
      platform: createPlatformClient({ apiUrl: fake.url, secret: fake.secret }),
      log: () => {},
    },
  );
  opened.push(ctx);
  setAppContext(ctx);
  expect(await startAi(ctx, { retryMs: 0 })).toBe(true);
  return { ctx, fake, dataDir };
}

function newThread(c: AppContext, question: string): string {
  const at = new Date().toISOString();
  const id = newId(at);
  c.db
    .prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(id, question.slice(0, 40), at, at);
  c.db
    .prepare(
      "INSERT INTO messages (id, thread_id, role, text, created_at) VALUES (?, ?, 'user', ?, ?)",
    )
    .run(newId(at), id, question, at);
  return id;
}

const blankState = (given: string[] = []): PyState => ({
  progId: PROG,
  mode: "blank",
  blankId: null,
  given,
});

async function ask(
  c: AppContext,
  f: FakePlatform,
  workflow: Workflow,
  subjects: Subject[],
  pyState: PyState | null,
  question = "为什么这里要这样写？",
) {
  const threadId = newThread(c, question);
  const out = await submitJob(
    c.db,
    { threadId, workflow, subjects, pyState },
    {
      platform: c.ai.platform,
    },
  );
  expect(out.submitted).toBe(true);
  await f.idle();
  const job = c.db
    .prepare("SELECT * FROM ai_jobs WHERE id = ?")
    .get<AiJobRow>(out.jobId) as AiJobRow;
  const fj = [...f.jobs.values()].find((j) => j.id === job.platform_job_id);
  const messages = c.db
    .prepare("SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at, id")
    .all<MessageRow>(threadId);
  return { job, calls: fj?.calls ?? [], messages, threadId };
}

const callsTo = (calls: ToolCall[], tool: string) => calls.filter((c) => c.tool === tool);

beforeAll(async () => {
  PAYLOAD = await extractPayload("python");
  ADDON = buildPfaddon(PAYLOAD, PY.appId, "1.0.0");
  const program = loadProgram(PAYLOAD, PROG);
  if (!program) throw new Error(`${PROG} is not in the payload`);
  ANSWERS = blanksOf(program.source).flatMap((b) => b.body.filter((l) => l.trim() !== ""));
  FIRST_ANSWER = ANSWERS[0] as string;
  expect(ANSWERS.length).toBeGreaterThanOrEqual(2);
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

describe("workflow limits match the manifest", () => {
  test("tools.allow and maxRuntimeSeconds of every workflow of every target", () => {
    for (const t of ["python", "math", "chess", "crypto"]) {
      const m = JSON.parse(
        readFileSync(join(import.meta.dir, `../../targets/${t}/manifest.json`), "utf8"),
      ) as typeof PYTHON_MANIFEST;
      for (const w of m.ai.workflows) {
        const tools: string[] = [...WORKFLOW_TOOLS[w.id as Workflow]];
        expect([t, w.id, tools]).toEqual([t, w.id, w.tools.allow]);
        expect([t, w.id, WORKFLOW_RUNTIME_SECONDS[w.id as Workflow]]).toEqual([
          t,
          w.id,
          w.maxRuntimeSeconds,
        ]);
      }
    }
  });
});

describe("a well-behaved engine", () => {
  test("the answer lands in messages; only citations present in the library survive", async () => {
    const tool = "py-basics";
    const agents = {
      ask: (async ({ callT }) =>
        callT("mv_submit_answer", {
          text: "先想想 `/` 和 `//` 有什么不同。",
          citations: [
            `program:${PROG}`,
            `tool:${tool}`,
            "program:no-such-program",
            "x",
            `program:${PROG}`,
          ],
          revealsAnswer: false,
        })) as Agent,
    };
    const { ctx: c, fake: f } = await start(agents);
    const r = await ask(c, f, "ask", [{ type: "program", id: PROG }], blankState());
    expect(f.errors).toEqual([]);
    expect(r.job.status).toBe("completed");
    expect(r.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(r.messages[1]?.text).toContain("`//`");
    expect(JSON.parse(r.messages[1]?.citations ?? "[]")).toEqual([
      `program:${PROG}`,
      `tool:${tool}`,
    ]);
    expect(callsTo(r.calls, "mv_submit_answer").map((x) => [x.isError, x.text])).toEqual([
      [false, "Accepted."],
    ]);

    // the task the agent read: the question, and the program without its answer lines
    const task = JSON.parse(callsTo(r.calls, "mv_get_task")[0]?.text ?? "{}");
    expect(task.question).toBe("为什么这里要这样写？");
    expect(task.subjects[0].id).toBe(PROG);
    expect(task.subjects[0].answersShown).toEqual([]);
    for (const l of ANSWERS)
      expect(JSON.stringify(task)).not.toContain(JSON.stringify(l.trim()).slice(1, -1));
    expect(task.subjects[0].source).toContain("# ___ (blank ");

    // the submit carried the engine preference and the manifest's runtime; settlement follows
    expect(f.submits[0]?.engines).toEqual([{ engine: "claude" }, { engine: "codex" }]);
    expect(f.submits[0]?.maxRuntimeSeconds).toBe(150);
    const p = await pollJob(
      c.db,
      c.ai.platform as NonNullable<AppContext["ai"]["platform"]>,
      r.job.id,
    );
    expect(p.status).toBe("completed");
    const row = c.db.prepare("SELECT settled_at FROM ai_jobs WHERE id = ?").get<AiJobRow>(r.job.id);
    expect(row?.settled_at).not.toBeNull();
  });

  test("a submit refused 409 mcp_registration_required registers again and goes through", async () => {
    const { ctx: c, fake: f } = await start();
    const before = f.registrations;
    f.requireRegistration();
    const r = await ask(c, f, "ask", [{ type: "program", id: PROG }], blankState());
    expect(f.registrations).toBe(before + 1);
    expect(r.job.status).toBe("completed");
  });
});

describe("an engine that does not follow the rules", () => {
  /** Pastes the first answer line into its reply, every time, and claims it reveals nothing. */
  const unruly: Agent = async ({ callT }) => {
    const text = `直接写成这样就行：\n\n\`\`\`python\n${FIRST_ANSWER.replace(/ /g, "   ")}\n\`\`\``;
    await callT("mv_submit_answer", { text, citations: [], revealsAnswer: false });
    await callT("mv_submit_answer", { text: `${text}\n（再试一次）`, citations: [] });
    await callT("mv_submit_answer", { text: "第三次", citations: [] });
  };

  test("first paste: a tool error; second: the job fails needs-blank-done; no answer stored", async () => {
    const { ctx: c, fake: f } = await start({ ask: unruly });
    const r = await ask(c, f, "ask", [{ type: "program", id: PROG }], blankState());
    const submits = callsTo(r.calls, "mv_submit_answer");
    expect(submits.map((x) => x.isError)).toEqual([true, true]);
    expect(submits[0]?.text).toBe(LEAK_REFUSAL);
    expect(submits[1]?.text).toContain(LEAK_REFUSAL);
    // the third call never reaches a tool: the ended job's MCP path is gone (404 not_found)
    expect(f.errors.map((e) => e.error)).toEqual([expect.stringMatching(/not_found/)]);
    expect(r.job.status).toBe("failed");
    expect(r.job.error).toBe(NEEDS_BLANK_DONE);
    expect(r.job.error).toBe("needs-blank-done");
    expect(r.messages.map((m) => m.role)).toEqual(["user"]);
  });

  test("the same paste is accepted once the student has had that blank filled in", async () => {
    const { ctx: c, fake: f } = await start({ ask: unruly });
    const program = loadProgram(PAYLOAD, PROG);
    const owner = blanksOf(program?.source ?? "").find((b) => b.body.includes(FIRST_ANSWER));
    const r = await ask(
      c,
      f,
      "ask",
      [{ type: "program", id: PROG }],
      blankState([owner?.id ?? ""]),
    );
    expect(callsTo(r.calls, "mv_submit_answer")[0]?.text).toBe("Accepted.");
    expect(r.job.status).toBe("completed");
  });

  test("read mode allows it; no bridge state at all does not", async () => {
    const read = await start({ ask: unruly });
    const ok = await ask(read.ctx, read.fake, "ask", [{ type: "program", id: PROG }], {
      progId: PROG,
      mode: "read",
      blankId: null,
      given: [],
    });
    expect(ok.job.status).toBe("completed");
    await read.fake.close();
    const none = await start({ ask: unruly });
    const no = await ask(none.ctx, none.fake, "ask", [{ type: "program", id: PROG }], null);
    expect([no.job.status, no.job.error]).toEqual(["failed", NEEDS_BLANK_DONE]);
  });

  test("a hint for a blank subject is guarded the same way", async () => {
    const { ctx: c, fake: f } = await start({ hint: unruly });
    const program = loadProgram(PAYLOAD, PROG);
    const owner = blanksOf(program?.source ?? "").find((b) => b.body.includes(FIRST_ANSWER));
    const r = await ask(
      c,
      f,
      "hint",
      [{ type: "blank", id: blankSubject(PROG, owner?.id ?? "") }],
      {
        ...blankState(),
        blankId: owner?.id ?? null,
      },
    );
    const task = JSON.parse(callsTo(r.calls, "mv_get_task")[0]?.text ?? "{}");
    expect(task.subjects[0].blank.answerShown).toBe(false);
    expect(task.subjects[0].blank.hints.zh.length).toBe(2);
    expect(task.subjects[0].excerpt).toContain(`# ___ (blank ${owner?.id}) ___`);
    expect(task.subjects[0].excerpt).not.toContain(FIRST_ANSWER.trim());
    expect([r.job.status, r.job.error]).toEqual(["failed", NEEDS_BLANK_DONE]);
  });
});

describe("tools by workflow, enforced by the server", () => {
  const probe: Agent = async ({ call, callT }) => {
    await call("mv_search_library", { query: "递归" });
    await call("mv_read_item", { id: `program:${PROG}` });
    await call("mv_list_groups", {});
    await callT("mv_submit_answer", { text: "看看提示。", citations: [] });
  };

  test("hint may use only get_task and submit_answer", async () => {
    const { ctx: c, fake: f } = await start({ hint: probe });
    const r = await ask(c, f, "hint", [{ type: "program", id: PROG }], blankState());
    expect(r.calls.map((x) => [x.tool, x.isError])).toEqual([
      ["mv_get_task", false],
      ["mv_search_library", true],
      ["mv_read_item", true],
      ["mv_list_groups", true],
      ["mv_submit_answer", false],
    ]);
    for (const x of r.calls.slice(1, 4)) expect(x.text).toMatch(/not allowed for this job/);
    expect(r.job.status).toBe("completed");
  });

  test("ask may also read items, but not search or list", async () => {
    const { ctx: c, fake: f } = await start({ ask: probe });
    const r = await ask(c, f, "ask", [{ type: "program", id: PROG }], blankState());
    expect(r.calls.map((x) => [x.tool, x.isError])).toEqual([
      ["mv_get_task", false],
      ["mv_search_library", true],
      ["mv_read_item", false],
      ["mv_list_groups", true],
      ["mv_submit_answer", false],
    ]);
  });
});

describe("the library workflow", () => {
  test("search 递归 finds items; read_item in blank mode gives no answer line; list_groups lists", async () => {
    let hits: { id: string; title: string }[] = [];
    let readOther: Record<string, unknown> | null = null;
    const agents = {
      library: (async ({ call, callT }) => {
        const s = await call("mv_search_library", { query: "递归", limit: 5 });
        hits = JSON.parse(s.text).hits;
        await call("mv_read_item", { id: `program:${PROG}` });
        const other = hits.find((h) => h.id.startsWith("program:") && h.id !== `program:${PROG}`);
        if (other) readOther = JSON.parse((await call("mv_read_item", { id: other.id })).text);
        await call("mv_read_item", { id: "program:no-such-program" });
        await call("mv_list_groups", {});
        await callT("mv_submit_answer", {
          text: "递归就是函数调用自己，并且每次都离基本情况更近一步。",
          citations: hits.slice(0, 2).map((h) => h.id),
        });
      }) as Agent,
    };
    const { ctx: c, fake: f } = await start(agents);
    // the student is on PROG in read mode: that program's answers are allowed, no other program's
    const r = await ask(c, f, "library", [{ type: "library", id: "all" }], {
      progId: "some-other-program",
      mode: "read",
      blankId: null,
      given: [],
    });
    expect(f.errors).toEqual([]);
    expect(hits.length).toBeGreaterThan(0);
    const reads = callsTo(r.calls, "mv_read_item");
    expect(reads[0]?.isError).toBe(false);
    for (const l of ANSWERS) expect(reads[0]?.text).not.toContain(JSON.stringify(l).slice(1, -1));
    expect(reads[0]?.text).toContain("# ___ (blank ");
    if (readOther) {
      const other = readOther as { programId: string; source: string; answersShown: unknown };
      expect(other.answersShown).toEqual([]);
      const p = loadProgram(PAYLOAD, other.programId);
      for (const b of blanksOf(p?.source ?? "")) {
        for (const l of b.body.filter((x) => x.trim().length >= 10)) {
          expect(other.source).not.toContain(l);
        }
      }
    }
    expect(reads.at(-1)?.isError).toBe(true);
    const groups = JSON.parse(callsTo(r.calls, "mv_list_groups")[0]?.text ?? "{}").groups;
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].items[0].id).toMatch(/^tool:/);
    expect(r.job.status).toBe("completed");
    expect(JSON.parse(r.messages[1]?.citations ?? "[]")).toEqual(hits.slice(0, 2).map((h) => h.id));

    const row = c.db
      .prepare("SELECT read_programs FROM ai_jobs WHERE id = ?")
      .get<AiJobRow>(r.job.id);
    expect(JSON.parse(row?.read_programs ?? "[]")).toContain(PROG);
  });

  test("a library answer pasting a program it read is refused", async () => {
    const agents = {
      library: (async ({ call, callT }) => {
        await call("mv_read_item", { id: `program:${PROG}` });
        await callT("mv_submit_answer", { text: FIRST_ANSWER, citations: [] });
      }) as Agent,
    };
    const { ctx: c, fake: f } = await start(agents);
    const r = await ask(c, f, "library", [{ type: "library", id: "all" }], null);
    expect(callsTo(r.calls, "mv_submit_answer")[0]?.text).toBe(LEAK_REFUSAL);
  });
});

describe("the MCP surface", () => {
  const mcpCall = (port: number, p: string, token: string | null) =>
    fetch(`http://127.0.0.1:${port}${p}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "mv_list_groups", arguments: {} },
      }),
    });

  test("no bearer 401, a dead segment 404, the static path serves no job, a bad Host 403", async () => {
    const { ctx: c } = await start();
    const port = app?.port as number;
    expect((await mcpCall(port, "/api/mcp", null)).status).toBe(401);
    expect((await mcpCall(port, "/api/mcp", "x".repeat(64))).status).toBe(401);
    expect((await mcpCall(port, `/api/mcp/t/${"a".repeat(32)}`, c.ai.mcpToken)).status).toBe(404);
    expect((await mcpCall(port, "/api/mcp/t/short", c.ai.mcpToken)).status).toBe(404);
    expect((await mcpCall(port, "/api/mcp/x/y/z", c.ai.mcpToken)).status).toBe(404);
    const r = await mcpCall(port, "/api/mcp", c.ai.mcpToken);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { result: { isError: boolean; content: { text: string }[] } };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0]?.text).toMatch(/serves no job/);
    const evil = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
      method: "POST",
      headers: { origin: "http://evil.example", authorization: `Bearer ${c.ai.mcpToken}` },
      body: "{}",
    });
    expect(evil.status).toBe(403);
  });
});

describe("startup reconciliation", () => {
  test("running jobs the platform finished, lost or never got are taken back", async () => {
    const first = await start();
    const { ctx: c, fake: f, dataDir } = first;
    f.sim.hold.add("ask");
    const ended = newThread(c, "一");
    const a = await submitJob(
      c.db,
      {
        threadId: ended,
        workflow: "ask",
        subjects: [{ type: "program", id: PROG }],
        pyState: null,
      },
      { platform: c.ai.platform },
    );
    const b = await submitJob(
      c.db,
      { threadId: ended, workflow: "ask", subjects: [], pyState: null },
      { platform: c.ai.platform },
    );
    const platformOf = (id: string) =>
      c.db.prepare("SELECT platform_job_id FROM ai_jobs WHERE id = ?").get<AiJobRow>(id)
        ?.platform_job_id as string;
    // both seen running
    const client = c.ai.platform as NonNullable<AppContext["ai"]["platform"]>;
    f.finish(platformOf(a.jobId), "running");
    expect((await pollJob(c.db, client, a.jobId)).status).toBe("running");
    // a job the app created but never got a platform id for (it stopped mid-submit)
    const at = new Date().toISOString();
    c.db
      .prepare(
        "INSERT INTO ai_jobs (id, thread_id, workflow, status, ticket, created_at, updated_at) VALUES (?, ?, 'ask', 'running', ?, ?, ?)",
      )
      .run("never", ended, "t".repeat(64), at, at);

    // the app stops; meanwhile the platform finishes a (without an answer) and forgets b
    const pa = platformOf(a.jobId);
    const pb = platformOf(b.jobId);
    c.close();
    opened.splice(opened.indexOf(c), 1);
    f.finish(pa, "completed");
    f.sim.notFound.add(pb);

    const restarted = await createAppContext(
      {
        PRIMEFORGE_DATA_DIR: dataDir,
        MATHVIZ_TARGET: "python",
        PRIMEFORGE_PORT: String(app?.port),
      },
      {
        migrationsDir: MIGRATIONS,
        platform: createPlatformClient({ apiUrl: f.url, secret: f.secret }),
        log: () => {},
      },
    );
    opened.push(restarted);
    const s = await reconcileJobs(
      restarted.db,
      restarted.ai.platform as NonNullable<AppContext["ai"]["platform"]>,
    );
    expect(s).toEqual({ polled: 0, lost: 2, ended: 1, errors: [] });
    const rows = restarted.db
      .prepare("SELECT id, status, settled_at FROM ai_jobs ORDER BY id")
      .all<AiJobRow>();
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(a.jobId)?.status).toBe("failed");
    expect(byId.get(b.jobId)?.status).toBe("lost");
    expect(byId.get("never")?.status).toBe("lost");
    for (const r of rows) expect(r.settled_at).not.toBeNull();
    // a second pass has nothing left to do
    expect(
      await reconcileJobs(
        restarted.db,
        restarted.ai.platform as NonNullable<AppContext["ai"]["platform"]>,
      ),
    ).toEqual({
      polled: 0,
      lost: 0,
      ended: 0,
      errors: [],
    });
  });
});
