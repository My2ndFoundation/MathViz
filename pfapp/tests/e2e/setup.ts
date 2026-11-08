/**
 * E2E harness: the BUILT app (MATHVIZ_TARGET=$E2E_TARGET, default python) started the way PrimeForge starts it —
 * `node app/primeforge-entry.mjs` (in-process Next, production, the shell CSP without
 * 'unsafe-eval'), on a free 127.0.0.1 port, with its own temp PRIMEFORGE_DATA_DIR and the
 * PRIMEFORGE_* variables the platform sets. Without the fake platform there is no
 * PRIMEFORGE_API_URL, so the only content source is the manual import (what the empty state's
 * import writes). The Q&A and python specs start their own app with the fake platform
 * (startFakePlatform) behind PRIMEFORGE_API_URL / _SECRET — the variables PrimeForge itself sets,
 * so there is no test-only switch in the app — except the development store (fakeStoreEnv:
 * MATHVIZ_FAKE_ADDONS with MATHVIZ_E2E=1, after Math Test Buddy's MTB_FAKE_ADDONS / MTB_E2E),
 * which the settings spec uses to install the content pack "from the store".
 *
 * globalSetup (default export): builds the app when .next is older than its sources, extracts the
 * python pack once (tests/e2e/prepare.ts, under Bun), and starts one app with the pack installed.
 * The specs read where it is from process.env (E2E_*). startApp() starts further apps (the empty
 * state, the restart on another port).
 *
 * E2E_TARGET=math|chess|crypto runs the suite against that target (its build, its pack, its app
 * id); the python-only tests skip themselves (`onlyPython`).
 *
 * E2E_PACK=<pack.json> uses that pack ({payload, catalog, pfaddon, version}, as `prepare.ts pack`
 * prints) instead of extracting one — for negative controls run against a doctored copy.
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

const PFAPP = path.resolve(__dirname, "..", "..");
const NEXT = path.join(PFAPP, "node_modules", ".bin", "next");
const ENTRY = path.join(PFAPP, "app", "primeforge-entry.mjs");
/** The target under test (E2E_TARGET, default python). */
export const TARGET = process.env.E2E_TARGET ?? "python";
if (!["math", "chess", "crypto", "python"].includes(TARGET)) {
  throw new Error(`E2E_TARGET=${JSON.stringify(TARGET)}: expected math|chess|crypto|python`);
}
export const IS_PYTHON = TARGET === "python";
/** targets/<TARGET>/target.json: the names the app shows come from here, never from a spec. */
export const TARGET_INFO = JSON.parse(
  readFileSync(path.join(PFAPP, "targets", TARGET, "target.json"), "utf8"),
) as {
  appId: string;
  pack: { en: string; zh: string };
  libraryExample: { en: string; zh: string };
};
const APP_ID = TARGET_INFO.appId;

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

/** The target a build is for (scripts/build-local.ts STAMP; the entry checks it). */
const STAMP = path.join(PFAPP, "app", ".next", "mathviz-target");

/**
 * `next build` for TARGET unless .next is a TARGET build (its stamp) newer than every source the
 * build reads: `bun run build -- --target math` leaves a math build in app/.next.
 */
const hasRecorder = (): boolean => {
  try {
    return statSync(path.join(PFAPP, "app", "public", "recorder", "rec.js")).isFile();
  } catch {
    return false;
  }
};

export function ensureBuilt(): void {
  let built = 0;
  try {
    if (readFileSync(STAMP, "utf8").trim() === TARGET) {
      built = statSync(path.join(PFAPP, "app", ".next", "BUILD_ID")).mtimeMs;
    }
  } catch {
    // never built, or not stamped
  }
  const sources = Math.max(
    newest(path.join(PFAPP, "app", "src")),
    newest(path.join(PFAPP, "app", "next.config.mjs")),
    newest(path.join(PFAPP, "targets")),
    newest(path.join(PFAPP, "package.json")),
  );
  if (built > sources && (TARGET !== "math" || hasRecorder())) return;
  // the maths recorder, from the web shell (scripts/recorder.ts runs under Bun)
  bun(["scripts/recorder.ts", "--target", TARGET]);
  execFileSync(NEXT, ["build", "app"], {
    cwd: PFAPP,
    stdio: "inherit",
    env: { ...process.env, MATHVIZ_TARGET: TARGET },
  });
  writeFileSync(STAMP, `${TARGET}\n`);
}

export function preparePack(): Pack {
  const given = process.env.E2E_PACK;
  if (given) return JSON.parse(readFileSync(given, "utf8")) as Pack;
  return JSON.parse(bun(["tests/e2e/prepare.ts", "pack"])) as Pack;
}

/**
 * A directory holding `pfaddon` as the development store's one offer (<dir>/content/{addon.json,
 * payload/}), for an app started with fakeStoreEnv(dir).
 */
export function storeDir(pfaddon: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "pfapp-e2e-store-"));
  bun(["tests/e2e/prepare.ts", "store", pfaddon, dir]);
  return dir;
}

/**
 * The development store (app/src/lib/addons/fake.ts) instead of PrimeForge's: MATHVIZ_FAKE_ADDONS,
 * which a production build honours only with MATHVIZ_E2E=1. The install takes `installMs`.
 */
export const fakeStoreEnv = (dir: string, installMs = 4000): Record<string, string> => ({
  MATHVIZ_FAKE_ADDONS: "1",
  MATHVIZ_E2E: "1",
  MATHVIZ_FAKE_ADDONS_DIR: dir,
  MATHVIZ_FAKE_ADDONS_INSTALL_MS: String(installMs),
});

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
    if (child.exitCode !== null) throw new Error(`the entry exited with ${child.exitCode}`);
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
 * Start the built app through its PrimeForge entry on a free port (or `port`), with a fresh temp
 * data directory (or `dataDir`, to start again on the same data); `pfaddon` (if given) is
 * installed first as a manual import; `env` is added to the app's environment (the fake
 * platform's PRIMEFORGE_API_*). `stop()` sends SIGTERM, as PrimeForge does, and waits for exit.
 */
export async function startApp({
  pfaddon,
  port: wanted,
  dataDir: givenDataDir,
  env: extra = {},
}: {
  pfaddon?: string;
  port?: number;
  dataDir?: string;
  env?: Record<string, string>;
} = {}): Promise<RunningApp> {
  const dataDir = givenDataDir ?? mkdtempSync(path.join(tmpdir(), "pfapp-e2e-data-"));
  if (pfaddon) bun(["tests/e2e/prepare.ts", "install", pfaddon, dataDir]);
  const port = wanted ?? (await freePort());
  const base = `http://127.0.0.1:${port}`;
  // what PrimeForge gives an app: the PRIMEFORGE_* variables, HOME and TMPDIR — no PATH, no
  // NODE_ENV, no MATHVIZ_TARGET (the entry derives the target from PRIMEFORGE_APP_ID)
  const env: Record<string, string> = {
    HOME: process.env.HOME ?? tmpdir(),
    TMPDIR: tmpdir(),
    PRIMEFORGE_APP_ID: APP_ID,
    PRIMEFORGE_DATA_DIR: dataDir,
    PRIMEFORGE_PORT: String(port),
    ...extra,
  };
  const child: ChildProcess = spawn(process.execPath, [ENTRY], {
    cwd: tmpdir(),
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
  // One root per run, removed at the end: specs restart apps on an existing data dir, so a data
  // dir cannot be removed when its app stops. Workers inherit TMPDIR like the E2E_* below.
  const root = mkdtempSync(path.join(tmpdir(), "pfapp-e2e-run-"));
  process.env.TMPDIR = root;
  const removeRoot = () => rmSync(root, { recursive: true, force: true });
  try {
    const pack = preparePack();
    const app = await startApp({ pfaddon: pack.pfaddon });
    process.env.E2E_BASE = app.base;
    process.env.E2E_CATALOG = pack.catalog;
    process.env.E2E_PFADDON = pack.pfaddon;
    process.env.E2E_CONTENT_VERSION = pack.version;
    return async () => {
      await app.stop();
      removeRoot();
    };
  } catch (e) {
    removeRoot();
    throw e;
  }
}

/** What the ask panel on a tool page is about: python's open program (its bridge), else the tool. */
export interface AskSubject {
  type: "program" | "tool";
  id: string;
  /** `<type>:<id>`, as /api/threads?subject= takes it. */
  key: string;
  /** Locale-less link to it in this app (a citation's href without the /<locale>). */
  href: string;
  /** The ask button's English label. */
  askLabel: string;
  /** Text the panel's context line contains. */
  context: string;
}

/**
 * Wait until the tool page `toolId` is ready to be asked about and say what a question is about.
 * Python: the page has reported its open program (data-py-prog). Elsewhere: the frame has its src
 * and the subject is the tool itself.
 */
export async function askSubject(page: Page, toolId: string): Promise<AskSubject> {
  const frameEl = page.getByTestId("tool-frame");
  if (IS_PYTHON) {
    await expect(frameEl).toHaveAttribute("data-py-prog", /./);
    const id = (await frameEl.getAttribute("data-py-prog")) as string;
    return {
      type: "program",
      id,
      key: `program:${id}`,
      href: `/tool/${toolId}?prog=${id}`,
      askLabel: "Ask about this program",
      context: id,
    };
  }
  await expect(frameEl).toHaveAttribute("src", /./);
  return {
    type: "tool",
    id: toolId,
    key: `tool:${toolId}`,
    href: `/tool/${toolId}`,
    askLabel: "Ask about this tool",
    context: "About this tool",
  };
}

/** The tool page is ready to be asked about (askSubject without the answer). */
export async function frameReady(page: Page): Promise<void> {
  const frameEl = page.getByTestId("tool-frame");
  if (IS_PYTHON) await expect(frameEl).toHaveAttribute("data-py-prog", /./);
  else await expect(frameEl).toHaveAttribute("src", /./);
}
