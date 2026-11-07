import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * A fake PrimeForge platform service for the AI integration tests, after MathTestBuddy's
 * tests/integration/fake-platform.ts. A real HTTP server with the app-facing routes of
 * platform-service/src/api.ts and their shapes: POST /ai/mcp, GET /ai/platform, GET /ai/engines,
 * POST /ai/jobs, GET /ai/jobs/:id, POST /ai/jobs/:id/cancel — each bearer-checked with the app's
 * platform secret, each refusal with the platform's status and code (400 for a bad segment or
 * runtime, 409 mcp_registration_required before the MCP secret is registered).
 *
 * Behind each submitted job runs a scripted agent for its workflow: it connects to the app's MCP
 * endpoint as the platform points an engine at it (Streamable HTTP,
 * http://127.0.0.1:<appPort><jobPathPrefix><segment>, Authorization: Bearer <registered secret>),
 * calls mv_get_task with the ticket from its instruction, then does what its script says; the
 * platform job then completes. Unlike MTB's, `call` does not throw on a tool error: the
 * anti-leak tests need to see refusals, so every call's result is returned and recorded.
 *
 * Switches (fake.sim):
 *   hold: Set of workflows   the agent waits until release(workflow); the job stays running
 *   notFound: Set of job ids GET/cancel answer 404 (the platform lost the job)
 * requireRegistration() makes the next submit fail 409 mcp_registration_required.
 */

interface Manifest {
  ai: {
    mcp: { path: string; jobPathPrefix: string };
    workflows: { id: string; maxRuntimeSeconds: number; tools: { allow: string[] } }[];
  };
}
export const PYTHON_MANIFEST = JSON.parse(
  readFileSync(path.join(import.meta.dir, "../../targets/python/manifest.json"), "utf8"),
) as Manifest;

const JOB_PATH_SEGMENT = /^[A-Za-z0-9_-]{22,128}$/;
const MIN_MCP_SECRET_LENGTH = 64;
const MIN_RUNTIME_SECONDS = 30;
const TERMINAL = new Set(["completed", "failed", "cancelled", "timed_out"]);

// biome-ignore lint/suspicious/noExplicitAny: tool results and tasks are free-form JSON from the app
export type Json = any;

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  isError: boolean;
  text: string;
}

export const textOf = (r: Json): string =>
  (r?.content ?? [])
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n");

export interface FakeJob {
  id: string;
  workflow: string;
  instruction: string;
  segment: string | null;
  engines: unknown;
  status: string;
  held: boolean;
  calls: ToolCall[];
}

export type Call = (tool: string, args?: Record<string, unknown>) => Promise<ToolCall>;
export type Agent = (a: {
  task: Json;
  call: Call;
  /** call with the job's ticket added (for get_task / submit_answer). */
  callT: Call;
  job: FakeJob;
}) => Promise<unknown>;

/** A well-behaved tutor: cites the subject, never writes code out. */
const goodAnswer: Agent = async ({ task, callT }) => {
  const s = task.subjects?.[0];
  return callT("mv_submit_answer", {
    text: "Think about the order the operations happen in, and which kind of division keeps the fraction.",
    citations: s?.libraryId ? [s.libraryId] : [],
    revealsAnswer: false,
  });
};

export const DEFAULT_AGENTS: Readonly<Record<string, Agent>> = Object.freeze({
  ask: goodAnswer,
  hint: goodAnswer,
  library: goodAnswer,
});

export interface FakePlatform {
  secret: string;
  url: string;
  appPort: number;
  mcpSecret: string | null;
  agents: Record<string, Agent>;
  sim: { hold: Set<string>; notFound: Set<string> };
  jobs: Map<string, FakeJob>;
  submits: { workflow: string; maxRuntimeSeconds: unknown; engines: unknown; segment: unknown }[];
  registrations: number;
  cancels: string[];
  errors: { jobId: string; error: string }[];
  requireRegistration(): void;
  release(workflow: string): void;
  /** End a job on the platform side (the agent's run is over, with or without an answer). */
  finish(id: string, status: string): void;
  idle(): Promise<void>;
  close(): Promise<void>;
}

export interface FakePlatformOptions {
  appPort: number;
  agents?: Partial<Record<string, Agent>>;
  manifest?: Manifest;
}

export async function startFakePlatform(opts: FakePlatformOptions): Promise<FakePlatform> {
  const manifest = opts.manifest ?? PYTHON_MANIFEST;
  const secret = randomBytes(32).toString("hex");
  let jobN = 0;
  let mustRegister = false;
  const running = new Set<Promise<void>>();

  const fake: FakePlatform = {
    secret,
    url: "",
    appPort: opts.appPort,
    mcpSecret: null,
    agents: { ...DEFAULT_AGENTS, ...(opts.agents as Record<string, Agent>) },
    sim: { hold: new Set(), notFound: new Set() },
    jobs: new Map(),
    submits: [],
    registrations: 0,
    cancels: [],
    errors: [],
    requireRegistration() {
      mustRegister = true;
    },
    release(workflow) {
      fake.sim.hold.delete(workflow);
      for (const j of fake.jobs.values()) {
        if (j.workflow === workflow && j.held) {
          j.held = false;
          start(j);
        }
      }
    },
    finish(id, status) {
      const j = fake.jobs.get(id);
      if (j && !TERMINAL.has(j.status)) j.status = status;
    },
    async idle() {
      while (running.size) await Promise.allSettled([...running]);
    },
    close: async () => {},
  };

  async function runAgent(j: FakeJob) {
    const agent = fake.agents[j.workflow];
    const ticket = /Ticket: ([A-Za-z0-9_-]+)/.exec(j.instruction)?.[1];
    if (!agent || !ticket) throw new Error(`no agent or ticket for workflow ${j.workflow}`);
    const url = new URL(
      `http://127.0.0.1:${fake.appPort}${j.segment ? `${manifest.ai.mcp.jobPathPrefix}${j.segment}` : manifest.ai.mcp.path}`,
    );
    const client = new Client({ name: "fake-agent", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { authorization: `Bearer ${fake.mcpSecret}` } },
    });
    await client.connect(transport);
    try {
      const call: Call = async (tool, args = {}) => {
        const r = await client.callTool({ name: tool, arguments: args });
        const c: ToolCall = { tool, args, isError: r.isError === true, text: textOf(r) };
        j.calls.push(c);
        return c;
      };
      const callT: Call = (tool, args = {}) => call(tool, { ticket, ...args });
      const got = await callT("mv_get_task");
      if (got.isError) throw new Error(`mv_get_task refused: ${got.text}`);
      await agent({ task: JSON.parse(got.text), call, callT, job: j });
    } finally {
      await client.close().catch(() => {});
    }
  }

  function start(j: FakeJob) {
    if (fake.sim.hold.has(j.workflow)) {
      j.held = true;
      return;
    }
    const p = (async () => {
      await new Promise((r) => setImmediate(r));
      if (TERMINAL.has(j.status)) return;
      j.status = "running";
      try {
        await runAgent(j);
      } catch (e) {
        fake.errors.push({ jobId: j.id, error: String((e as Error)?.message ?? e) });
      }
      // the agent's run is over: with or without an answer, the platform job completes
      if (!TERMINAL.has(j.status)) j.status = "completed";
    })();
    running.add(p);
    void p.finally(() => running.delete(p));
  }

  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  async function readBody(req: IncomingMessage): Promise<Json> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return null;
    }
  }

  async function submit(req: IncomingMessage, res: ServerResponse) {
    const body = await readBody(req);
    const workflow = typeof body?.workflow === "string" ? body.workflow : "";
    const instruction = typeof body?.instruction === "string" ? body.instruction : "";
    if (!workflow || !instruction) {
      return json(res, 400, { error: "workflow and instruction are required" });
    }
    const declared = manifest.ai.workflows.find((w) => w.id === workflow);
    if (!declared) return json(res, 400, { error: "unknown workflow", code: "unknown_workflow" });
    const segment = body.mcpPathSegment;
    if (segment !== undefined && (typeof segment !== "string" || !JOB_PATH_SEGMENT.test(segment))) {
      return json(res, 400, {
        error: "mcpPathSegment must be 22–128 characters of A–Z a–z 0–9 _ -",
      });
    }
    const rt = body.maxRuntimeSeconds;
    if (
      rt !== undefined &&
      (typeof rt !== "number" ||
        !Number.isInteger(rt) ||
        rt < MIN_RUNTIME_SECONDS ||
        rt > declared.maxRuntimeSeconds)
    ) {
      return json(res, 400, { error: "maxRuntimeSeconds out of range" });
    }
    if (mustRegister || !fake.mcpSecret) {
      mustRegister = false;
      fake.mcpSecret = null;
      return json(res, 409, {
        error: "register this app's MCP secret first",
        code: "mcp_registration_required",
      });
    }
    const id = `job-${++jobN}`;
    const j: FakeJob = {
      id,
      workflow,
      instruction,
      segment: typeof segment === "string" ? segment : null,
      engines: body.engines,
      status: "queued",
      held: false,
      calls: [],
    };
    fake.jobs.set(id, j);
    fake.submits.push({ workflow, maxRuntimeSeconds: rt, engines: body.engines, segment });
    const first = Array.isArray(body.engines) ? body.engines[0] : null;
    json(res, 202, {
      jobId: id,
      applied: { engine: { engine: first?.engine ?? "claude", model: "fake-model" } },
    });
    start(j);
  }

  const server = createServer((req, res) => {
    void (async () => {
      if (req.headers.authorization !== `Bearer ${secret}`) {
        return json(res, 401, { error: "unauthorised" });
      }
      const url = new URL(req.url ?? "/", "http://x");
      const m = /^\/ai\/jobs\/([^/]+)(\/cancel)?$/.exec(url.pathname);
      if (url.pathname === "/ai/mcp" && req.method === "POST") {
        const body = await readBody(req);
        const s = typeof body?.secret === "string" ? body.secret : "";
        if (s.length < MIN_MCP_SECRET_LENGTH) return json(res, 400, { error: "short secret" });
        fake.mcpSecret = s;
        fake.registrations++;
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/ai/platform" && req.method === "GET") {
        return json(res, 200, { features: ["job-mcp-path", "job-cancel", "engine-choice"] });
      }
      if (url.pathname === "/ai/engines" && req.method === "GET") {
        return json(res, 200, {
          engines: [
            { engine: "claude", supported: true, granted: true, usable: true, models: [] },
            { engine: "codex", supported: true, granted: false, usable: false, models: [] },
          ],
        });
      }
      if (url.pathname === "/ai/jobs" && req.method === "POST") return submit(req, res);
      if (m) {
        const id = decodeURIComponent(m[1] as string);
        const j = fake.jobs.get(id);
        if (!j || fake.sim.notFound.has(id)) return json(res, 404, { error: "not found" });
        if (m[2] && req.method === "POST") {
          fake.cancels.push(id);
          if (!TERMINAL.has(j.status)) j.status = "cancelled";
          return json(res, 200, { status: j.status });
        }
        if (req.method === "GET") return json(res, 200, { status: j.status, engine: "claude" });
      }
      return json(res, 404, { error: "not found" });
    })().catch(() => json(res, 500, { error: "internal" }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fake.close = () =>
    new Promise<void>((r) => {
      server.closeAllConnections?.();
      server.close(() => r());
    });
  return fake;
}
