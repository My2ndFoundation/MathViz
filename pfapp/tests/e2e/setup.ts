/**
 * E2E harness (a minimal version of what plan Task 12 extends): the BUILT app under `next start`
 * (production: the shell CSP without 'unsafe-eval', as PrimeForge runs it), MATHVIZ_TARGET=python,
 * on a free 127.0.0.1 port, with its own temp PRIMEFORGE_DATA_DIR. No PrimeForge platform: no
 * PRIMEFORGE_API_URL, so the only content source is the manual import (what the empty state's
 * import writes). The Q&A spec starts its own app with the fake platform (startFakePlatform)
 * behind PRIMEFORGE_API_URL / _SECRET — the variables PrimeForge itself sets, so there is no
 * test-only switch in the app.
 *
 * globalSetup (default export): builds the app when .next is older than its sources, extracts the
 * python pack once (tests/e2e/prepare.ts, under Bun), and starts one app with the pack installed.
 * The specs read where it is from process.env (E2E_*). startApp() starts further apps (the empty
 * state).
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const PFAPP = path.resolve(__dirname, "..", "..");
const NEXT = path.join(PFAPP, "node_modules", ".bin", "next");

export interface Pack {
  payload: string;
  catalog: string;
  pfaddon: string;
  version: string;
}

export interface RunningApp {
  base: string;
  port: number;
  dataDir: string;
  stop(): Promise<void>;
}

function bun(args: string[]): string {
  return execFileSync("bun", args, {
    cwd: PFAPP,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function newest(p: string): number {
  const st = statSync(p);
  if (!st.isDirectory()) return st.mtimeMs;
  let m = st.mtimeMs;
  for (const e of readdirSync(p)) m = Math.max(m, newest(path.join(p, e)));
  return m;
}

/** `next build` unless .next/BUILD_ID is newer than every source the build reads. */
export function ensureBuilt(): void {
  let built = 0;
  try {
    built = statSync(path.join(PFAPP, "app", ".next", "BUILD_ID")).mtimeMs;
  } catch {
    // never built
  }
  const sources = Math.max(
    newest(path.join(PFAPP, "app", "src")),
    newest(path.join(PFAPP, "app", "next.config.mjs")),
    newest(path.join(PFAPP, "targets")),
    newest(path.join(PFAPP, "package.json")),
  );
  if (built > sources) return;
  execFileSync(NEXT, ["build", "app"], {
    cwd: PFAPP,
    stdio: "inherit",
    env: { ...process.env, MATHVIZ_TARGET: "python" },
  });
}

export function preparePack(): Pack {
  return JSON.parse(bun(["tests/e2e/prepare.ts", "pack"])) as Pack;
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      s.close(() => (a && typeof a === "object" ? resolve(a.port) : reject(new Error("no port"))));
    });
  });
}

async function waitReady(base: string, child: ChildProcess, ms = 60_000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`next start exited with ${child.exitCode}`);
    try {
      const res = await fetch(`${base}/api/session-token`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${base} did not become ready`);
}

export interface FakePlatformProcess {
  url: string;
  secret: string;
  stop(): Promise<void>;
}

/**
 * The fake PrimeForge platform (tests/e2e/fake-platform-server.ts, under Bun) for an app that will
 * listen on `appPort`. Pass its url and secret to startApp as PRIMEFORGE_API_URL / _SECRET.
 */
export function startFakePlatform(appPort: number): Promise<FakePlatformProcess> {
  const child = spawn("bun", ["tests/e2e/fake-platform-server.ts", String(appPort)], {
    cwd: PFAPP,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const stop = () =>
    new Promise<void>((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", () => resolve());
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    });
  return new Promise((resolve, reject) => {
    let out = "";
    child.once("exit", (code) => reject(new Error(`fake platform exited with ${code}`)));
    child.stdout?.on("data", (d) => {
      out += d;
      const line = out.split("\n")[0];
      if (out.includes("\n") && line) {
        const { url, secret } = JSON.parse(line) as { url: string; secret: string };
        resolve({ url, secret, stop });
      }
    });
  });
}

/**
 * Start the built app on a free port (or `port`); `pfaddon` (if given) is installed first as a
 * manual import; `env` is added to the app's environment (the fake platform's PRIMEFORGE_API_*).
 */
export async function startApp({
  pfaddon,
  port: wanted,
  env: extra = {},
}: {
  pfaddon?: string;
  port?: number;
  env?: Record<string, string>;
} = {}): Promise<RunningApp> {
  const dataDir = mkdtempSync(path.join(tmpdir(), "pfapp-e2e-data-"));
  if (pfaddon) bun(["tests/e2e/prepare.ts", "install", pfaddon, dataDir]);
  const port = wanted ?? (await freePort());
  const base = `http://127.0.0.1:${port}`;
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith("PRIMEFORGE_")) env[k] = v;
  }
  Object.assign(env, {
    NODE_ENV: "production",
    MATHVIZ_TARGET: "python",
    PRIMEFORGE_DATA_DIR: dataDir,
    PRIMEFORGE_PORT: String(port),
    PORT: String(port),
    ...extra,
  });
  const child: ChildProcess = spawn(NEXT, ["start", "app", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: PFAPP,
    env: env as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout?.on("data", (d) => {
    log += d;
  });
  child.stderr?.on("data", (d) => {
    log += d;
  });
  try {
    await waitReady(base, child);
  } catch (e) {
    child.kill("SIGKILL");
    throw new Error(`${(e as Error).message}\n${log}`);
  }
  return {
    base,
    port,
    dataDir,
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
      }),
  };
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  ensureBuilt();
  const pack = preparePack();
  const app = await startApp({ pfaddon: pack.pfaddon });
  process.env.E2E_BASE = app.base;
  process.env.E2E_CATALOG = pack.catalog;
  process.env.E2E_PFADDON = pack.pfaddon;
  process.env.E2E_CONTENT_VERSION = pack.version;
  return () => app.stop();
}
