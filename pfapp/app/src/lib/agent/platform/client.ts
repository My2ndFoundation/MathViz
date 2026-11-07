// Ported from MathTestBuddy trainer/src/lib/agent/platform/client.ts. Kept: PlatformError (status 0
// = no answer, code 'timeout' | 'network'), the bearer on every call, /ai/mcp registration, the one
// re-registration and retry when a submit is refused 409 mcp_registration_required, the engine
// preference (`engines` on POST /ai/jobs), getJob/cancelJob answering null on 404, /ai/engines and
// /ai/platform answering null on an older platform. Dropped: the speech client (this app has no
// voice input).

/**
 * The PrimeForge platform API client: /ai/mcp, /ai/jobs (submit, read, cancel), /ai/engines,
 * /ai/platform. Every call carries PRIMEFORGE_API_SECRET as a bearer. Never logs; errors carry the
 * HTTP status and the platform's `code`, never the secret.
 */

export class PlatformError extends Error {
  override readonly name = "PlatformError";
  readonly status: number;
  readonly code: string | null;
  constructor(message: string, { status, code }: { status?: number; code?: string | null } = {}) {
    super(message);
    this.status = status ?? 0;
    this.code = code ?? null;
  }
}

export interface EngineChoice {
  engine: string;
  model?: string;
  effort?: string;
}

/** One entry of GET /ai/engines, as the platform reports it. */
export interface EngineInfo {
  engine?: unknown;
  granted?: unknown;
  usable?: unknown;
  [k: string]: unknown;
}

/**
 * The engine preference every job is sent with (design §4 item 11, §7.6): Claude first, Codex when
 * Claude cannot run it. The platform runs the first entry that is granted and usable; Codex is
 * granted only by the person, in Desktop. With neither usable the submit is refused with the
 * platform's code (engine_not_granted / engine_unavailable), which the job records as its error
 * and the panel turns into the clear guidance §7.6 asks for (MESSAGES.error.engine_*). No
 * pre-check of /ai/engines: the platform's refusal is the one authority on what may run.
 */
export const ENGINE_PREFERENCE: readonly EngineChoice[] = Object.freeze([
  Object.freeze({ engine: "claude" }),
  Object.freeze({ engine: "codex" }),
]);

export interface SubmitSpec {
  workflow: string;
  instruction: string;
  mcpPathSegment?: string;
  maxRuntimeSeconds?: number;
  engines?: readonly EngineChoice[];
}

export interface SubmitReply {
  jobId: string;
  platformJobId: string;
  engine: string | null;
  model: string | null;
  applied: unknown;
}

/** What the app needs of the platform (the real client, or a test double). */
export interface PlatformClient {
  registerMcp(token: string): Promise<unknown>;
  submitJob(spec: SubmitSpec): Promise<{
    jobId?: unknown;
    platformJobId?: unknown;
    engine?: unknown;
    model?: unknown;
  }>;
  getJob(id: string): Promise<unknown>;
  cancelJob(id: string): Promise<unknown>;
  engines?(): Promise<unknown>;
  platform?(): Promise<unknown>;
}

export interface PlatformClientConfig {
  apiUrl: string;
  secret: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
  /**
   * Called (once) when a submit is refused 409 mcp_registration_required, before the one retry.
   * Default: register the last token given to registerMcp again (if any).
   */
  onReregister?: () => Promise<unknown>;
}

type Json = Record<string, unknown> | null;
const field = (j: unknown, k: string): unknown =>
  typeof j === "object" && j !== null ? (j as Record<string, unknown>)[k] : undefined;

export function createPlatformClient({
  apiUrl,
  secret,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = 15_000,
  onReregister,
}: PlatformClientConfig) {
  const base = String(apiUrl ?? "").replace(/\/+$/, "");
  let lastToken: string | null = null;

  async function send(method: string, path: string, body?: unknown): Promise<Response> {
    try {
      return await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${secret}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const name = (e as { name?: unknown } | null)?.name;
      const timedOut = name === "TimeoutError" || name === "AbortError";
      throw new PlatformError(
        `platform request ${method} ${path.split("/").slice(0, 3).join("/")} failed: ${String(name ?? "error")}`,
        { status: 0, code: timedOut ? "timeout" : "network" },
      );
    }
  }

  async function call(method: string, path: string, body?: unknown) {
    const res = await send(method, path, body);
    const json = (await res.json().catch(() => null)) as Json;
    return { status: res.status, ok: res.ok, json };
  }

  const refused = (what: string, r: { status: number; json: Json }) => {
    const code = field(r.json, "code");
    return new PlatformError(`the platform refused ${what}: ${r.status}`, {
      status: r.status,
      code: typeof code === "string" ? code : null,
    });
  };

  const jobPath = (id: string) => `/ai/jobs/${encodeURIComponent(String(id))}`;

  async function registerMcp(token: string): Promise<{ ok: true }> {
    const r = await call("POST", "/ai/mcp", { secret: token });
    if (!r.ok) throw refused("the MCP registration", r);
    lastToken = token;
    return { ok: true };
  }

  const reregister =
    onReregister ??
    (async () => {
      if (lastToken) await registerMcp(lastToken);
    });

  async function submitJob({
    workflow,
    instruction,
    mcpPathSegment,
    maxRuntimeSeconds,
    engines,
  }: SubmitSpec): Promise<SubmitReply> {
    const body: Record<string, unknown> = { workflow, instruction };
    if (mcpPathSegment !== undefined) body.mcpPathSegment = mcpPathSegment;
    if (maxRuntimeSeconds !== undefined) body.maxRuntimeSeconds = maxRuntimeSeconds;
    if (engines !== undefined) body.engines = engines;
    let r = await call("POST", "/ai/jobs", body);
    if (r.status === 409 && field(r.json, "code") === "mcp_registration_required") {
      let again = true;
      try {
        await reregister();
      } catch {
        again = false;
      }
      if (again) r = await call("POST", "/ai/jobs", body);
    }
    const jobId = field(r.json, "jobId");
    if (!r.ok || typeof jobId !== "string") throw refused("the job", r);
    const applied = field(r.json, "applied") ?? {};
    const engine = field(applied, "engine");
    const name = field(engine, "engine");
    const model = field(engine, "model");
    return {
      jobId,
      platformJobId: jobId,
      engine: typeof name === "string" ? name : null,
      model: typeof model === "string" ? model : null,
      applied,
    };
  }

  /** The job's public state; null when the platform does not know it (404). */
  async function getJob(id: string): Promise<unknown> {
    const r = await call("GET", jobPath(id));
    if (r.status === 404) return null;
    if (!r.ok) throw refused("the job read", r);
    return r.json;
  }

  /** The job's state after the cancel; null on 404. */
  async function cancelJob(id: string): Promise<unknown> {
    const r = await call("POST", `${jobPath(id)}/cancel`);
    if (r.status === 404) return null;
    if (!r.ok) throw refused("the cancel", r);
    return r.json;
  }

  /** The engine choices; null when engine choice is unavailable (404/503). */
  async function engines(): Promise<EngineInfo[] | null> {
    const r = await call("GET", "/ai/engines");
    if (r.status === 404 || r.status === 503) return null;
    if (!r.ok) throw refused("the engine list", r);
    const list = field(r.json, "engines");
    return Array.isArray(list) ? (list as EngineInfo[]) : null;
  }

  /** Features etc.; null on an older platform (404). */
  async function platform(): Promise<unknown> {
    const r = await call("GET", "/ai/platform");
    if (r.status === 404) return null;
    if (!r.ok) throw refused("the platform read", r);
    return r.json;
  }

  return { registerMcp, submitJob, getJob, cancelJob, engines, platform };
}
