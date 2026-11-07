// Ported from MathTestBuddy trainer/src/lib/ai/jobs.ts. Kept: the state machine (queued → running
// → an ending), single-use tickets and per-job MCP path segments, the platform terminal-state map
// (a platform job that ended without our answer ends ours: completed → failed), the app-side
// deadline (past it, poll cancels the platform job and times ours out), settlement (settled_at once
// the platform job is seen ended, also after our answer arrived), lost jobs (404, or never
// submitted at startup), startup reconciliation, every awaited platform call sitting between
// transactions, never inside one. Dropped: draft/solve's resubmission, back-off and budget (every
// job here is interactive: LOST_POLICY is "fail" for all three workflows), and the separate
// result_received → applied step (the answer is written to `messages` in the same transaction that
// accepts it, so there is nothing left to re-apply at startup).
import { randomBytes } from "node:crypto";
import {
  ENGINE_PREFERENCE,
  type EngineChoice,
  type PlatformClient,
} from "../agent/platform/client";
import type { Db } from "../db/handle";
import { newId } from "../db/ids";
import type { AiJobRow } from "../db/schema";
import type { Locale } from "../i18n/locale";
import { type PyState, toPyState } from "../py-state";

/**
 * AI jobs (design §7.4): one per question sent to the platform. The agent behind a job reaches the
 * app through its one-time MCP path, reads the task with its ticket and answers with
 * mv_submit_answer (lib/mcp/tools.ts); the answer lands in `messages` and the job is `completed`.
 *
 * Statuses: queued, running (open) → completed | failed | timed_out | cancelled | lost. `error`
 * says why a job ended without an answer: the platform's submit code (engine_not_granted, …),
 * 'needs-blank-done' (the agent kept writing out a blank it may not reveal), 'lost', a deadline.
 */

export type Workflow = "ask" | "hint" | "library";
export const WORKFLOWS: readonly Workflow[] = ["ask", "hint", "library"];
export const isWorkflow = (v: unknown): v is Workflow =>
  typeof v === "string" && (WORKFLOWS as readonly string[]).includes(v);

/** maxRuntimeSeconds asked of the platform: each workflow's manifest value (tests compare). */
export const WORKFLOW_RUNTIME_SECONDS: Readonly<Record<Workflow, number>> = Object.freeze({
  ask: 150,
  hint: 90,
  library: 300,
});
/** The app-side deadline is the runtime plus this, so the platform's own limit normally ends it. */
export const DEADLINE_GRACE_SECONDS = 15;

export type SubjectType = "tool" | "program" | "blank" | "library";
export const SUBJECT_TYPES: readonly SubjectType[] = ["tool", "program", "blank", "library"];

/**
 * What a thread is about. ids: a tool or program id; a blank is `<programId>/<blankId>`; the
 * library's id is ignored (any string, conventionally 'all').
 */
export interface Subject {
  type: SubjectType;
  id: string;
}

export const blankSubject = (programId: string, blankId: string) => `${programId}/${blankId}`;
export function parseBlankSubject(id: string): { programId: string; blankId: string } | null {
  const i = id.indexOf("/");
  if (i <= 0 || i === id.length - 1 || id.indexOf("/", i + 1) !== -1) return null;
  return { programId: id.slice(0, i), blankId: id.slice(i + 1) };
}

export interface JobInput {
  subjects: Subject[];
  /** The bridge state when the question was asked; null = nothing reported (nothing allowed). */
  pyState: PyState | null;
  locale: Locale;
}

export type Now = () => string;
const systemNow: Now = () => new Date().toISOString();
interface NowOpt {
  now?: Now;
}

export const OPEN = ["queued", "running"];
const isOpen = (status: string) => OPEN.includes(status);
/** Platform terminal states → ours, when the platform job ended without our answer. */
const TERMINAL: Readonly<Record<string, string>> = Object.freeze({
  completed: "failed",
  succeeded: "failed",
  failed: "failed",
  timed_out: "timed_out",
  cancelled: "cancelled",
});

const getRow = (db: Db, id: string) =>
  db.prepare("SELECT * FROM ai_jobs WHERE id = ?").get<AiJobRow>(id);
const addSeconds = (at: string, s: number) => new Date(Date.parse(at) + s * 1000).toISOString();

/** The job's input, defensively: a malformed row reads as no subjects and no state. */
export function inputOf(job: Pick<AiJobRow, "input">): JobInput {
  try {
    const v = JSON.parse(job.input) as Partial<JobInput>;
    return {
      subjects: Array.isArray(v.subjects) ? v.subjects : [],
      // re-checked on every read: a malformed state (a string `given`…) must not widen anything
      pyState: toPyState(v.pyState),
      locale: v.locale === "zh" ? "zh" : "en",
    };
  } catch {
    return { subjects: [], pyState: null, locale: "en" };
  }
}

export interface JobSpec {
  threadId: string;
  workflow: Workflow;
  subjects: Subject[];
  pyState: PyState | null;
  locale?: Locale;
}

export interface CreatedJob {
  id: string;
  ticket: string;
  mcpSegment: string;
}

/** A queued job with a fresh ticket (64 hex) and MCP path segment (32 hex). */
export function createJob(db: Db, spec: JobSpec, { now = systemNow }: NowOpt = {}): CreatedJob {
  const at = now();
  const id = newId(at);
  const ticket = randomBytes(32).toString("hex");
  const mcpSegment = randomBytes(16).toString("hex");
  const input: JobInput = {
    subjects: spec.subjects.map((s) => ({ type: s.type, id: s.id })),
    pyState: spec.pyState,
    locale: spec.locale ?? "en",
  };
  db.prepare(
    `INSERT INTO ai_jobs (id, thread_id, workflow, status, ticket, mcp_segment, input, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?)`,
  ).run(id, spec.threadId, spec.workflow, ticket, mcpSegment, JSON.stringify(input), at, at);
  return { id, ticket, mcpSegment };
}

const WORKFLOW_BRIEF: Readonly<Record<Workflow, string>> = Object.freeze({
  ask: "Answer the student's question about the program, blank or page in the task.",
  hint: "Give the student ONE short hint for the blank in the task: a nudge toward the idea, never the code.",
  library:
    "Answer the student's question from this app's library. Use mv_search_library and mv_read_item to find the relevant items (search terms may be Chinese or English), and cite every item you used.",
});

/** The job's instruction: what to do, the ticket, and the rule the server enforces. */
export function instructionFor(job: Pick<AiJobRow, "workflow" | "ticket" | "input">): string {
  const workflow = isWorkflow(job.workflow) ? job.workflow : "ask";
  const { locale } = inputOf(job);
  const tools =
    workflow === "library"
      ? "mv_get_task, mv_search_library, mv_read_item, mv_list_groups, mv_submit_answer"
      : workflow === "ask"
        ? "mv_get_task, mv_read_item, mv_submit_answer"
        : "mv_get_task, mv_submit_answer";
  return [
    "You are the tutor inside MathViz, a practice app for an A-level Computer Science student.",
    WORKFLOW_BRIEF[workflow],
    `Ticket: ${job.ticket}`,
    `Use only these MCP tools: ${tools}.`,
    "1. Call mv_get_task with the ticket first. It holds the student's question, the conversation so far and the material.",
    "2. Code the student has not uncovered yet is shown as a placeholder line `# ___ (blank <id>) ___`. Never write that code out, in a code block or in prose: explain the idea, point at the hint, ask a guiding question.",
    `3. Reply in ${locale === "zh" ? "Simplified Chinese" : "English"}, in Markdown. Call mv_submit_answer once with the ticket, the text, the ids of the library items you relied on (citations, e.g. "program:<id>" or "tool:<id>"), and revealsAnswer.`,
    "4. If mv_submit_answer refuses your answer, rewrite it without the code it names and submit again. A second refusal ends the job.",
  ].join("\n");
}

export interface SubmitDeps extends NowOpt {
  platform: PlatformClient | null;
  /** The engine preference; default ENGINE_PREFERENCE (Claude, then Codex). */
  engines?: readonly EngineChoice[];
}

export interface SubmitOutcome {
  jobId: string;
  submitted: boolean;
  /** The submit's error code when it was not submitted. */
  error: string | null;
}

interface Failure {
  code?: unknown;
  status?: unknown;
  name?: unknown;
}

/** The code a failed submit is recorded with: the platform's code, else http_<status>, else the name. */
export function submitErrorCode(e: unknown): string {
  const f = (typeof e === "object" && e !== null ? e : {}) as Failure;
  if (typeof f.code === "string" && f.code) return f.code;
  if (typeof f.status === "number" && f.status > 0) return `http_${f.status}`;
  return typeof f.name === "string" ? f.name : "submit_failed";
}

/**
 * Create a job and send it to the platform. A refused or failed submit ends the job at once
 * (failed, settled, `error` = the platform's code): nobody waits for an interactive job to be
 * retried, and the student can ask again.
 */
export async function submitJob(
  db: Db,
  spec: JobSpec,
  { platform, engines = ENGINE_PREFERENCE, now = systemNow }: SubmitDeps,
): Promise<SubmitOutcome> {
  const created = createJob(db, spec, { now });
  const row = getRow(db, created.id) as AiJobRow;
  if (!platform) {
    markSubmitFailed(db, created.id, "ai_unavailable", { now });
    return { jobId: created.id, submitted: false, error: "ai_unavailable" };
  }
  const runtime = WORKFLOW_RUNTIME_SECONDS[spec.workflow];
  try {
    const r = await platform.submitJob({
      workflow: spec.workflow,
      instruction: instructionFor(row),
      mcpPathSegment: created.mcpSegment,
      maxRuntimeSeconds: runtime,
      engines,
    });
    const at = now();
    db.prepare(
      `UPDATE ai_jobs SET platform_job_id = ?, engine = ?, model = ?, deadline_at = ?, updated_at = ?
        WHERE id = ?`,
    ).run(
      String(r.platformJobId ?? r.jobId),
      typeof r.engine === "string" ? r.engine : null,
      typeof r.model === "string" ? r.model : null,
      addSeconds(at, runtime + DEADLINE_GRACE_SECONDS),
      at,
      created.id,
    );
    return { jobId: created.id, submitted: true, error: null };
  } catch (e) {
    const code = submitErrorCode(e);
    markSubmitFailed(db, created.id, code, { now });
    return { jobId: created.id, submitted: false, error: code };
  }
}

/** The platform never took the job: it ends failed and settled (there is nothing to poll). */
export function markSubmitFailed(
  db: Db,
  id: string,
  code: string,
  { now = systemNow }: NowOpt = {},
) {
  const at = now();
  db.prepare(
    `UPDATE ai_jobs SET status = 'failed', error = ?, settled_at = coalesce(settled_at, ?), updated_at = ?
      WHERE id = ? AND status IN ('queued', 'running')`,
  ).run(code, at, at, id);
}

/** The open job behind a per-job MCP path segment, or null (unknown, ended, past its deadline). */
export function segmentJob(db: Db, segment: unknown, { now = systemNow }: NowOpt = {}) {
  if (typeof segment !== "string" || !segment) return null;
  const job = db.prepare("SELECT * FROM ai_jobs WHERE mcp_segment = ?").get<AiJobRow>(segment);
  return job && jobAcceptsCalls(job, now) ? job : null;
}

/** Open, and not past its app-side deadline. */
export function jobAcceptsCalls(job: AiJobRow, now: Now = systemNow): boolean {
  if (!isOpen(job.status)) return false;
  return !job.deadline_at || Date.parse(now()) <= Date.parse(job.deadline_at);
}

/** Note that the agent read a python program (its blanks are then guarded in this job's answer). */
export function recordReadProgram(db: Db, jobId: string, programId: string): void {
  db.transaction(() => {
    const row = getRow(db, jobId);
    if (!row) return;
    let read: string[] = [];
    try {
      const v = JSON.parse(row.read_programs) as unknown;
      if (Array.isArray(v)) read = v.filter((x): x is string => typeof x === "string");
    } catch {
      // a malformed list starts again
    }
    if (read.includes(programId)) return;
    db.prepare("UPDATE ai_jobs SET read_programs = ? WHERE id = ?").run(
      JSON.stringify([...read, programId]),
      jobId,
    );
  });
}

export function readProgramsOf(job: Pick<AiJobRow, "read_programs">): string[] {
  try {
    const v = JSON.parse(job.read_programs) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** The message text limit an answer is held to. */
export const MAX_ANSWER_CHARS = 20_000;
export const NEEDS_BLANK_DONE = "needs-blank-done";

export type AnswerOutcome =
  | { accepted: true; messageId: string; citations: string[] }
  | { accepted: false; reason: "job_closed" }
  | { accepted: false; reason: "leak"; failed: boolean };

/**
 * mv_submit_answer's database side, in one transaction. `leak` is leakCheck's verdict on the text
 * (computed by the caller, which holds the content): a hit refuses the answer, and the second hit
 * in the same job fails it with error 'needs-blank-done'. A clean answer is written to `messages`
 * (role 'assistant'), its citations narrowed to ids present in library_docs, and the job is
 * completed. `revealsAnswer` is not an input here: the agent's own claim is never trusted.
 */
export function acceptAnswer(
  db: Db,
  jobId: string,
  { text, citations, leak }: { text: string; citations: readonly string[]; leak: string | null },
  { now = systemNow }: NowOpt = {},
): AnswerOutcome {
  return db.transaction((): AnswerOutcome => {
    const job = getRow(db, jobId);
    if (!job || !jobAcceptsCalls(job, now)) return { accepted: false, reason: "job_closed" };
    const at = now();
    if (leak !== null) {
      const n = job.leak_rejections + 1;
      const failed = n >= 2;
      db.prepare(
        `UPDATE ai_jobs SET leak_rejections = ?, status = CASE WHEN ? THEN 'failed' ELSE status END,
                error = CASE WHEN ? THEN ? ELSE error END, updated_at = ? WHERE id = ?`,
      ).run(n, failed ? 1 : 0, failed ? 1 : 0, NEEDS_BLANK_DONE, at, jobId);
      return { accepted: false, reason: "leak", failed };
    }
    const known = new Set<string>();
    const check = db.prepare("SELECT 1 AS x FROM library_docs WHERE id = ?");
    for (const c of citations) if (!known.has(c) && check.get(c)) known.add(c);
    const kept = [...known];
    const messageId = newId(at);
    db.prepare(
      "INSERT INTO messages (id, thread_id, role, text, citations, created_at) VALUES (?, ?, 'assistant', ?, ?, ?)",
    ).run(messageId, job.thread_id, text, JSON.stringify(kept), at);
    db.prepare("UPDATE threads SET updated_at = ? WHERE id = ?").run(at, job.thread_id);
    db.prepare(
      "UPDATE ai_jobs SET status = 'completed', error = NULL, updated_at = ? WHERE id = ?",
    ).run(at, jobId);
    return { accepted: true, messageId, citations: kept };
  });
}

// ---------------------------------------------------------------- polling and reconciliation

export interface JobsPlatform {
  getJob(platformJobId: string): Promise<unknown>;
  cancelJob?(platformJobId: string): Promise<unknown>;
}

const isNotFound = (e: unknown) => {
  const x = e as { status?: unknown; code?: unknown } | null | undefined;
  return x?.status === 404 || x?.code === "not_found";
};
const message = (e: unknown) =>
  String((e as { message?: unknown } | null | undefined)?.message ?? e);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

type PollOutcome = "none" | "polled" | "ended" | "lost";

/** End an open job without an answer; only a job still open is touched (an answer may have won). */
function endOpen(db: Db, id: string, status: string, reason: string, now: Now, settle: boolean) {
  const at = now();
  return (
    db
      .prepare(
        `UPDATE ai_jobs SET status = ?, error = ?, updated_at = ?,
                settled_at = CASE WHEN ? THEN coalesce(settled_at, ?) ELSE settled_at END
          WHERE id = ? AND status IN ('queued', 'running')`,
      )
      .run(status, reason, at, settle ? 1 : 0, at, id).changes > 0
  );
}

/** One job, one platform look: the core of pollJob and of reconcileJobs. */
async function pollOne(
  db: Db,
  platform: JobsPlatform,
  j: AiJobRow,
  now: Now,
  { startup = false }: { startup?: boolean } = {},
): Promise<{ row: AiJobRow; outcome: PollOutcome }> {
  const reread = () => getRow(db, j.id) as AiJobRow;
  if (j.settled_at) return { row: j, outcome: "none" };

  if (!j.platform_job_id) {
    // a submit in flight — unless the app stopped before it got a platform job id
    if (startup && isOpen(j.status)) {
      const ended = endOpen(db, j.id, "lost", "never submitted to the platform", now, true);
      return { row: reread(), outcome: ended ? "lost" : "none" };
    }
    return { row: j, outcome: "none" };
  }

  let raw: unknown = null;
  try {
    raw = await platform.getJob(j.platform_job_id);
  } catch (e) {
    if (!isNotFound(e)) throw e;
  }
  const at = now();
  if (raw === null || typeof raw !== "object") {
    // the platform no longer knows the job (404, or it restarted)
    if (isOpen(j.status) && endOpen(db, j.id, "lost", "platform job not found", now, true)) {
      return { row: reread(), outcome: "lost" };
    }
    db.prepare(
      `UPDATE ai_jobs SET platform_status = coalesce(platform_status, 'not_found'), settled_at = ?, updated_at = ?
        WHERE id = ? AND settled_at IS NULL`,
    ).run(at, at, j.id);
    return { row: reread(), outcome: "polled" };
  }

  const r = raw as Record<string, unknown>;
  const status = str(r.status);
  const terminal = status !== undefined && Object.hasOwn(TERMINAL, status);
  const fresh = reread(); // an answer may have arrived while we were asking
  db.prepare(
    `UPDATE ai_jobs SET platform_status = coalesce(?, platform_status), engine = coalesce(?, engine),
            model = coalesce(?, model), settled_at = CASE WHEN ? THEN ? ELSE settled_at END,
            status = CASE WHEN status IN ('queued', 'running') AND ? THEN ? ELSE status END,
            updated_at = ?
      WHERE id = ?`,
  ).run(
    status ?? null,
    str(r.engine) ?? null,
    str(r.model) ?? null,
    terminal ? 1 : 0,
    at,
    !terminal && status !== undefined ? 1 : 0,
    status === "running" ? "running" : "queued",
    at,
    j.id,
  );

  if (terminal) {
    if (isOpen(fresh.status)) {
      const code = str(r.errorCode);
      const reason = code ?? `platform job ${status} without an answer`;
      if (endOpen(db, j.id, TERMINAL[status as string] as string, reason, now, true)) {
        return { row: reread(), outcome: "ended" };
      }
    }
    return { row: reread(), outcome: "polled" };
  }

  // app-side deadline: the platform has not ended it → cancel it there; ours times out now and
  // settles when the platform reports the end
  if (isOpen(fresh.status) && fresh.deadline_at && Date.parse(at) > Date.parse(fresh.deadline_at)) {
    try {
      await platform.cancelJob?.(j.platform_job_id);
    } catch {
      // best effort; the platform's own runtime limit ends it anyway
    }
    if (endOpen(db, j.id, "timed_out", "deadline passed", now, false)) {
      return { row: reread(), outcome: "ended" };
    }
  }
  return { row: reread(), outcome: "polled" };
}

export interface PollResult {
  status: string;
  platformStatus: string | null;
  error: string | null;
  changed: boolean;
}

/**
 * Poll one job (the thread view's "is it done yet", Task 11): updates platform_status, engine and
 * model; ends an open job whose platform job ended without an answer, was lost, or ran past its
 * deadline; settles it once the platform job has ended. A settled job is not polled again.
 */
export async function pollJob(
  db: Db,
  platform: JobsPlatform,
  jobId: string,
  { now = systemNow }: NowOpt = {},
): Promise<PollResult> {
  const before = getRow(db, jobId);
  if (!before) throw new Error(`No such AI job: ${jobId}`);
  const { row } = await pollOne(db, platform, before, now);
  return {
    status: row.status,
    platformStatus: row.platform_status ?? null,
    error: row.error ?? null,
    changed: row.status !== before.status || row.settled_at !== before.settled_at,
  };
}

export interface ReconcileSummary {
  polled: number;
  lost: number;
  ended: number;
  errors: { jobId: string; error: string }[];
}

/**
 * Startup reconciliation: every job not yet settled gets one platform look (a job never
 * submitted is lost). Each job on its own: a failure on one is recorded and the others still run.
 */
export async function reconcileJobs(
  db: Db,
  platform: JobsPlatform,
  { now = systemNow }: NowOpt = {},
): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { polled: 0, lost: 0, ended: 0, errors: [] };
  const rows = db
    .prepare("SELECT * FROM ai_jobs WHERE settled_at IS NULL ORDER BY created_at, id")
    .all<AiJobRow>();
  for (const j of rows) {
    try {
      const { outcome } = await pollOne(db, platform, j, now, { startup: true });
      if (outcome === "lost") summary.lost++;
      else if (outcome === "ended") summary.ended++;
      else if (outcome === "polled") summary.polled++;
    } catch (e) {
      summary.errors.push({ jobId: j.id, error: message(e) });
    }
  }
  return summary;
}

/** Cancel an open job (the "thinking…" view's cancel): ours ends now, the platform's best effort. */
export async function cancelJob(
  db: Db,
  platform: JobsPlatform | null,
  jobId: string,
  { now = systemNow }: NowOpt = {},
): Promise<boolean> {
  const row = getRow(db, jobId);
  if (!row || !isOpen(row.status)) return false;
  const ended = endOpen(
    db,
    jobId,
    "cancelled",
    "cancelled by the student",
    now,
    !row.platform_job_id,
  );
  if (ended && row.platform_job_id && platform?.cancelJob) {
    try {
      await platform.cancelJob(row.platform_job_id);
    } catch {
      // the job ends on its own; settlement follows the next poll
    }
  }
  return ended;
}
