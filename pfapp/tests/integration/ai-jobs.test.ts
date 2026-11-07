import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { GET as aiJobsRoute } from "../../app/src/app/api/ai/jobs/route";
import { DELETE as deleteJob } from "../../app/src/app/api/jobs/[id]/route";
import { createPlatformClient } from "../../app/src/lib/agent/platform/client";
import { createJob, submitJob } from "../../app/src/lib/ai/jobs";
import { migrationsDir } from "../../app/src/lib/db/open";
import { CSRF_HEADER } from "../../app/src/lib/http/guard";
import { startAi } from "../../app/src/lib/server/ai";
import { RECENT_JOBS } from "../../app/src/lib/server/ai-jobs";
import { type AppContext, createAppContext, setAppContext } from "../../app/src/lib/server/context";
import { tmp } from "../helpers/content-fixtures";
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

async function start({
  platform = false,
  register = true,
}: {
  platform?: boolean;
  register?: boolean;
} = {}) {
  if (platform) fake = await startFakePlatform({ appPort: 1 });
  const c = await createAppContext(
    { PRIMEFORGE_DATA_DIR: tmp("ai-jobs-data"), MATHVIZ_TARGET: "python" },
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
      href: "/ask",
      engine: null,
      model: null,
      error: null,
      createdAt: at(3),
      settledAt: null,
      durationMs: null,
    });
    expect(v.active[1].href).toBe("/tool/py-x");
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
