// After MathTestBuddy trainer/src/lib/api/ai-jobs.ts (getAiJobs). Kept: the shape {ai, active,
// recent} read from the app's own ai_jobs table (the platform has no "list my jobs" endpoint),
// active oldest first, the latest RECENT_JOBS finished ones newest first, inputs and answers left
// out. Changed: no `today` (this app tracks no cost or budget, so it is omitted rather than faked);
// `ai` is lib/server/ai aiStatus() — the Settings → AI card's source too, so the two never
// disagree; "finished" is a status that is no longer open (lib/ai/jobs OPEN), not settled_at (a
// cancelled or answered job may wait a poll for its settlement); each row carries its thread's
// title and where it was asked; open jobs get one platform look first (as GET /api/jobs/:id does),
// so a job whose page was closed still ends here instead of sitting "running" until a restart.
import { loadProgram } from "../ai/context";
import { OPEN, parseBlankSubject, pollJob } from "../ai/jobs";
import type { Handler } from "../http/route";
import { type AiAvailability, aiStatus } from "./ai";
import type { AppContext } from "./context";

/** How many finished jobs the queue lists. */
export const RECENT_JOBS = 20;

export interface AiJobView {
  id: string;
  workflow: string;
  status: string;
  threadId: string;
  /** The thread's title (the first question, shortened). */
  title: string;
  /** Locale-less path to where it was asked (`/tool/<id>`, `/tool/<id>?prog=<id>`, `/ask`); null if gone. */
  href: string | null;
  engine: string | null;
  model: string | null;
  error: string | null;
  createdAt: string;
  /** When it ended (settlement, or its last change before that); null while open. */
  settledAt: string | null;
  durationMs: number | null;
}

export interface AiJobsView {
  ai: { available: boolean; reason: string | null; state: AiAvailability };
  active: AiJobView[];
  recent: AiJobView[];
}

interface Row {
  id: string;
  workflow: string;
  status: string;
  thread_id: string;
  title: string;
  engine: string | null;
  model: string | null;
  error: string | null;
  created_at: string;
  ended_at: string | null;
}

const COLUMNS = `j.id, j.workflow, j.status, j.thread_id, t.title, j.engine, j.model, j.error,
  j.created_at, CASE WHEN j.status IN (${OPEN.map(() => "?").join(", ")}) THEN NULL
  ELSE coalesce(j.settled_at, j.updated_at) END AS ended_at`;

/** Where a thread was asked: the library page, a program on its tool's page, or a tool page. */
function hrefOf(app: AppContext, threadId: string): string | null {
  const subjects = app.db
    .prepare(
      "SELECT subject_type AS type, subject_id AS id FROM thread_subjects WHERE thread_id = ? ORDER BY rowid",
    )
    .all<{ type: string; id: string }>(threadId);
  if (subjects.some((s) => s.type === "library")) return "/ask";
  const tool = app.db.prepare("SELECT 1 AS x FROM catalog_items WHERE id = ?");
  const program = subjects.find((s) => s.type === "program" || s.type === "blank");
  if (program && app.content) {
    const programId =
      program.type === "blank" ? parseBlankSubject(program.id)?.programId : program.id;
    const p = programId ? loadProgram(app.content.dir, programId) : null;
    if (p?.tool && programId && tool.get(p.tool)) {
      return `/tool/${encodeURIComponent(p.tool)}?prog=${encodeURIComponent(programId)}`;
    }
  }
  const t = subjects.find((s) => s.type === "tool");
  if (t && tool.get(t.id)) return `/tool/${encodeURIComponent(t.id)}`;
  return null;
}

function view(app: AppContext, r: Row): AiJobView {
  const end = r.ended_at ? Date.parse(r.ended_at) : Number.NaN;
  const start = Date.parse(r.created_at);
  return {
    id: r.id,
    workflow: r.workflow,
    status: r.status,
    threadId: r.thread_id,
    title: r.title,
    href: hrefOf(app, r.thread_id),
    engine: r.engine,
    model: r.model,
    error: r.error,
    createdAt: r.created_at,
    settledAt: r.ended_at,
    durationMs: Number.isFinite(end) && Number.isFinite(start) ? Math.max(0, end - start) : null,
  };
}

/** The queue as GET /api/ai/jobs answers it. */
export async function aiJobsView(app: AppContext): Promise<AiJobsView> {
  const { db } = app;
  const platform = app.ai.platform;
  if (platform) {
    const open = db
      .prepare(
        `SELECT id FROM ai_jobs WHERE status IN (${OPEN.map(() => "?").join(", ")})
           AND settled_at IS NULL AND platform_job_id IS NOT NULL`,
      )
      .all<{ id: string }>(...OPEN);
    await Promise.all(
      open.map(async ({ id }) => {
        try {
          await pollJob(db, platform, id);
        } catch (e) {
          app.log("ai.queue_poll_failed", { error: e instanceof Error ? e.name : "Error" });
        }
      }),
    );
  }
  const marks = OPEN.map(() => "?").join(", ");
  const active = db
    .prepare(
      `SELECT ${COLUMNS} FROM ai_jobs j JOIN threads t ON t.id = j.thread_id
        WHERE j.status IN (${marks}) ORDER BY j.created_at, j.id`,
    )
    .all<Row>(...OPEN, ...OPEN)
    .map((r) => view(app, r));
  const recent = db
    .prepare(
      `SELECT ${COLUMNS} FROM ai_jobs j JOIN threads t ON t.id = j.thread_id
        WHERE j.status NOT IN (${marks})
        ORDER BY coalesce(j.settled_at, j.updated_at) DESC, j.id DESC LIMIT ?`,
    )
    .all<Row>(...OPEN, ...OPEN, RECENT_JOBS)
    .map((r) => view(app, r));
  const s = await aiStatus(app);
  return {
    ai: { available: s.state === "available", reason: s.code, state: s.state },
    active,
    recent,
  };
}

/** GET /api/ai/jobs: the top bar's AI indicator and its queue panel, and Settings → AI. */
export const getAiJobs: Handler = async (app) => ({ body: await aiJobsView(app) });
