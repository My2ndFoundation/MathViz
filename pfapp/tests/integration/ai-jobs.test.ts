import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { GET as aiJobsRoute } from "../../app/src/app/api/ai/jobs/route";
import { DELETE as deleteJob } from "../../app/src/app/api/jobs/[id]/route";
import { createPlatformClient, type PlatformClient } from "../../app/src/lib/agent/platform/client";
import {
  acceptAnswer,
  blankSubject,
  cancelJob,
  createJob,
  reconcileJobs,
  submitJob,
} from "../../app/src/lib/ai/jobs";
import { blanksOf } from "../../app/src/lib/ai/leak";
import { importAddonFile } from "../../app/src/lib/content/manual-import";
import { migrationsDir } from "../../app/src/lib/db/open";
import { CSRF_HEADER } from "../../app/src/lib/http/guard";
import { startAi } from "../../app/src/lib/server/ai";
import { RECENT_JOBS } from "../../app/src/lib/server/ai-jobs";
import { type AppContext, createAppContext, setAppContext } from "../../app/src/lib/server/context";
import { loadTarget } from "../../app/src/lib/target";
import { buildPfaddon, extractPayload, pickBlankProgram, tmp } from "../helpers/content-fixtures";
import { type FakePlatform, startFakePlatform } from "./fake-platform";

/**
 * GET /api/ai/jobs (the top bar's AI indicator and its queue panel, Settings → AI) over the route
 * handler, with threads and jobs written straight into a fresh database (no content pack: every
 * row here is synthetic) and, where the platform matters, the fake platform over HTTP.
 */

setDefaultTimeout(30_000);

const MIGRATIONS = migrationsDir(`${import.meta.dir}/../..`);
let ctx: AppContext | null = null;
let fake: FakePlatform | null = null;

afterEach(async () => {
  setAppContext(null);
  ctx?.close();
  ctx = null;
  await fake?.close();
  fake = null;
});

/** The python pack from this checkout, extracted once, for the tests that need real programs. */
let pack: { addon: string; payload: string } | null = null;
async function pythonPack() {
  if (!pack) {
    const payload = await extractPayload("python");
    pack = { payload, addon: buildPfaddon(payload, loadTarget("python").appId, "1.0.0") };
  }
  return pack;
}

async function start({
  platform = false,
  register = true,
  content = false,
}: {
  platform?: boolean;
  register?: boolean;
  content?: boolean;
} = {}) {
  if (platform) fake = await startFakePlatform({ appPort: 1 });
  const dataDir = tmp("ai-jobs-data");
  if (content)
    await importAddonFile((await pythonPack()).addon, dataDir, loadTarget("python").appId);
  const c = await createAppContext(
    { PRIMEFORGE_DATA_DIR: dataDir, MATHVIZ_TARGET: "python" },
    {
      migrationsDir: MIGRATIONS,
      platform: fake ? createPlatformClient({ apiUrl: fake.url, secret: fake.secret }) : null,
      log: () => {},
    },
  );
  ctx = c;
  setAppContext(c);
  if (fake && register) expect(await startAi(c, { retryMs: 0 })).toBe(true);
  return c;
}

const req = (c: AppContext, method: string, path: string) =>
  new Request(`http://127.0.0.1:${c.port}${path}`, {
    method,
    headers: {
      host: `127.0.0.1:${c.port}`,
      "sec-fetch-site": "same-origin",
      ...(method === "GET" ? {} : { [CSRF_HEADER]: c.csrfToken }),
    },
  });

// biome-ignore lint/suspicious/noExplicitAny: JSON bodies of the API under test
type Json = any;
async function queue(c: AppContext): Promise<Json> {
  const res = await aiJobsRoute(req(c, "GET", "/api/ai/jobs"));
  expect(res.status).toBe(200);
  return res.json();
}

const at = (minute: number, second = 0) =>
  new Date(Date.UTC(2026, 10, 7, 9, minute, second)).toISOString();

function thread(c: AppContext, title: string, subject: { type: string; id: string }) {
  const id = `t-${title}`;
  c.db
    .prepare(
      "INSERT INTO threads (id, title, archived, created_at, updated_at) VALUES (?, ?, 0, ?, ?)",
    )
    .run(id, title, at(0), at(0));
  c.db
    .prepare("INSERT INTO thread_subjects (thread_id, subject_type, subject_id) VALUES (?, ?, ?)")
    .run(id, subject.type, subject.id);
  return id;
}

/** A job created at `created`; `end` = [status, settled_at | null, updated_at] ends it. */
function job(
  c: AppContext,
  threadId: string,
  created: string,
  end?: [string, string | null, string],
  workflow: "ask" | "hint" | "library" = "ask",
) {
  const { id } = createJob(
    c.db,
    { threadId, workflow, subjects: [], pyState: null },
    {
      now: () => created,
    },
  );
  if (end) {
    c.db
      .prepare(
        "UPDATE ai_jobs SET status = ?, settled_at = ?, updated_at = ?, error = ? WHERE id = ?",
      )
      .run(end[0], end[1], end[2], end[0] === "failed" ? "engine_unavailable" : null, id);
  }
  return id;
}

describe("GET /api/ai/jobs", () => {
  test("shape: open jobs oldest first, finished newest first, each with its thread and where it was asked", async () => {
    const c = await start();
    c.db
      .prepare(
        `INSERT INTO catalog_items (id, grp, ord, title_en, title_zh, file, version, accent)
         VALUES ('py-x', 'g', 0, 'X', 'X', 'tools/py-x.html', '1.0.0', 'cyan')`,
      )
      .run();
    const lib = thread(c, "library-q", { type: "library", id: "all" });
    const tool = thread(c, "tool-q", { type: "tool", id: "py-x" });
    const gone = thread(c, "gone-q", { type: "tool", id: "py-gone" });
    const later = job(c, tool, at(5));
    const earlier = job(c, lib, at(3), undefined, "library");
    const done = job(c, tool, at(1), ["completed", at(2), at(2)]);
    const failed = job(c, gone, at(1), ["failed", at(4, 30), at(4, 30)]);
    // a cancelled job not yet settled (its platform job has not been seen ended) still counts as finished
    const cancelled = job(c, lib, at(1), ["cancelled", null, at(3, 30)], "library");

    const v = await queue(c);
    expect(Object.keys(v).sort()).toEqual(["active", "ai", "recent"]);
    expect(v.active.map((j: Json) => j.id)).toEqual([earlier, later]);
    expect(v.recent.map((j: Json) => j.id)).toEqual([failed, cancelled, done]);

    const a = v.active[0];
    expect(a).toEqual({
      id: earlier,
      workflow: "library",
      status: "queued",
      threadId: lib,
      title: "library-q",
      href: `/ask?thread=${lib}`,
      engine: null,
      model: null,
      error: null,
      createdAt: at(3),
      settledAt: null,
      durationMs: null,
    });
    expect(v.active[1].href).toBe(`/tool/py-x?thread=${tool}`);
    const [f, x, d] = v.recent;
    expect(f).toMatchObject({ status: "failed", error: "engine_unavailable", href: null });
    expect(f.settledAt).toBe(at(4, 30));
    expect(f.durationMs).toBe(210_000);
    expect(x).toMatchObject({ status: "cancelled", settledAt: at(3, 30), durationMs: 150_000 });
    expect(d).toMatchObject({ status: "completed", title: "tool-q", durationMs: 60_000 });
    // no cost or budget: this app tracks none
    expect(JSON.stringify(v)).not.toMatch(/cost|budget|today/i);
  });

  test(`recent is capped at ${RECENT_JOBS}, the newest kept`, async () => {
    const c = await start();
    const t = thread(c, "many", { type: "library", id: "all" });
    const ids: string[] = [];
    for (let i = 0; i < RECENT_JOBS + 5; i++) {
      ids.push(job(c, t, at(0, i), ["completed", at(10, i), at(10, i)]));
    }
    const v = await queue(c);
    expect(v.active).toEqual([]);
    expect(v.recent).toHaveLength(RECENT_JOBS);
    expect(v.recent.map((j: Json) => j.id)).toEqual(ids.slice(5).reverse());
  });

  test("a cancelled job moves from active to recent (DELETE /api/jobs/:id)", async () => {
    const c = await start();
    const t = thread(c, "to-cancel", { type: "library", id: "all" });
    const id = job(c, t, at(0));
    expect((await queue(c)).active.map((j: Json) => j.id)).toEqual([id]);
    const res = await deleteJob(req(c, "DELETE", `/api/jobs/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);
    const v = await queue(c);
    expect(v.active).toEqual([]);
    expect(v.recent.map((j: Json) => [j.id, j.status])).toEqual([[id, "cancelled"]]);
  });

  test("an open job whose platform job ended is ended by the queue read itself", async () => {
    const c = await start({ platform: true });
    const f = fake as FakePlatform;
    f.sim.hold.add("ask"); // the agent never starts: the platform job stays open until we end it
    const t = thread(c, "held", { type: "library", id: "all" });
    const s = await submitJob(
      c.db,
      { threadId: t, workflow: "ask", subjects: [], pyState: null },
      { platform: c.ai.platform as NonNullable<AppContext["ai"]["platform"]> },
    );
    expect(s.submitted).toBe(true);
    let v = await queue(c);
    expect(v.active.map((j: Json) => j.id)).toEqual([s.jobId]);
    expect(v.active[0].engine).toBe("claude");
    const row = c.db
      .prepare("SELECT platform_job_id FROM ai_jobs WHERE id = ?")
      .get<{ platform_job_id: string }>(s.jobId);
    f.finish(row?.platform_job_id as string, "failed");
    v = await queue(c);
    expect(v.active).toEqual([]);
    expect(v.recent.map((j: Json) => [j.id, j.status])).toEqual([[s.jobId, "failed"]]);
  });

  test("finished time, duration and order are when our job ended, not when a later start settled it", async () => {
    const c = await start({ platform: true });
    const f = fake as FakePlatform;
    f.sim.hold.add("ask"); // the platform jobs stay open: only reconcile at the next start settles them
    const platform = c.ai.platform as NonNullable<AppContext["ai"]["platform"]>;
    const t = thread(c, "monday", { type: "library", id: "all" });
    // a is asked first and answered last; b is asked later and answered first (so the order by end
    // is not the order by id, which is what a tie on settlement time falls back to)
    const a = await submitJob(
      c.db,
      { threadId: t, workflow: "ask", subjects: [], pyState: null },
      { platform, now: () => at(1) },
    );
    const b = await submitJob(
      c.db,
      { threadId: t, workflow: "ask", subjects: [], pyState: null },
      { platform, now: () => at(2) },
    );
    const answer = { text: "An answer.", citations: [], leak: null };
    expect(acceptAnswer(c.db, b.jobId, answer, { now: () => at(3) }).accepted).toBe(true);
    expect(acceptAnswer(c.db, a.jobId, answer, { now: () => at(3, 30) }).accepted).toBe(true);
    const before = await queue(c);
    expect(before.recent.map((j: Json) => j.id)).toEqual([a.jobId, b.jobId]);

    // the app is closed; two days later it starts and reconcile settles both
    for (const id of [a.jobId, b.jobId]) {
      const row = c.db
        .prepare("SELECT platform_job_id FROM ai_jobs WHERE id = ?")
        .get<{ platform_job_id: string }>(id);
      f.finish(row?.platform_job_id as string, "completed");
    }
    const wednesday = "2026-11-09T08:00:00.000Z";
    await reconcileJobs(c.db, platform, { now: () => wednesday });
    const settled = c.db
      .prepare("SELECT count(*) AS n FROM ai_jobs WHERE settled_at = ?")
      .get<{ n: number }>(wednesday);
    expect(settled?.n).toBe(2);
    const after = await queue(c);
    expect(after.recent.map((j: Json) => [j.id, j.settledAt, j.durationMs])).toEqual([
      [a.jobId, at(3, 30), 150_000],
      [b.jobId, at(3), 60_000],
    ]);
  });

  test("cancelled while its submit is in flight: the platform job the submit then starts is cancelled too", async () => {
    const c = await start();
    const t = thread(c, "early-cancel", { type: "library", id: "all" });
    let release: (v: { platformJobId: string; jobId: string }) => void = () => {};
    const cancelled: string[] = [];
    const platform = {
      submitJob: () =>
        new Promise((r) => {
          release = r;
        }),
      cancelJob: async (id: string) => {
        cancelled.push(id);
        return null;
      },
    } as unknown as PlatformClient;
    const pending = submitJob(
      c.db,
      { threadId: t, workflow: "ask", subjects: [], pyState: null },
      { platform },
    );
    // the queue lists it (no platform id yet) and she cancels it there
    const open = (await queue(c)).active;
    expect(open.map((j: Json) => j.status)).toEqual(["queued"]);
    expect(await cancelJob(c.db, platform, open[0].id)).toBe(true);
    expect(cancelled).toEqual([]); // nothing to cancel on the platform yet
    release({ platformJobId: "pf-1", jobId: "pf-1" });
    await pending;
    expect(cancelled).toEqual(["pf-1"]);
    const v = await queue(c);
    expect(v.active).toEqual([]);
    expect(v.recent.map((j: Json) => j.status)).toEqual(["cancelled"]);
  });

  test("a program or blank thread links to the program inside its tool (?prog=, &thread=); a gone program falls back", async () => {
    const c = await start({ content: true });
    // chosen by shape, never by id (a content wave must not turn this red)
    const program = pickBlankProgram((await pythonPack()).payload);
    const blank = blanksOf(program.source)[0];
    if (!program.tool || !blank) throw new Error(`${program.id}: no tool or no blank`);
    const want = (t: string) =>
      `/tool/${encodeURIComponent(program.tool as string)}?prog=${encodeURIComponent(program.id)}&thread=${t}`;
    const prog = thread(c, "prog", { type: "program", id: program.id });
    const blankOnly = thread(c, "blank", {
      type: "blank",
      id: blankSubject(program.id, blank.id),
    });
    const gone = thread(c, "gone", { type: "program", id: "no-such-program" });
    const goneWithTool = thread(c, "gone-tool", { type: "program", id: "no-such-program" });
    c.db
      .prepare(
        "INSERT INTO thread_subjects (thread_id, subject_type, subject_id) VALUES (?, 'tool', ?)",
      )
      .run(goneWithTool, program.tool);
    for (const t of [prog, blankOnly, gone, goneWithTool]) job(c, t, at(1));
    const href = Object.fromEntries((await queue(c)).active.map((j: Json) => [j.title, j.href]));
    expect(href).toEqual({
      prog: want(prog),
      blank: want(blankOnly),
      gone: null,
      "gone-tool": `/tool/${encodeURIComponent(program.tool)}?thread=${goneWithTool}`,
    });
  });

  test("ai: no platform → off with ai_unavailable", async () => {
    const c = await start();
    expect((await queue(c)).ai).toEqual({
      available: false,
      reason: "ai_unavailable",
      state: "unavailable",
    });
  });

  test("ai: a platform the app has not registered with → not_registered", async () => {
    const c = await start({ platform: true, register: false });
    expect((await queue(c)).ai).toEqual({
      available: false,
      reason: "not_registered",
      state: "unavailable",
    });
  });

  test("ai: registered with an engine it may use → available, no reason", async () => {
    const c = await start({ platform: true });
    expect((await queue(c)).ai).toEqual({ available: true, reason: null, state: "available" });
  });
});
