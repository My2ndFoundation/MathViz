// What PrimeForge executes: `<bundled node> primeforge-entry.mjs`, cwd = the read-only install
// directory, environment = the PRIMEFORGE_* variables + HOME + TMPDIR, no PATH. Modelled on
// MathTestBuddy trainer/primeforge-entry.mjs (itself the entry PrimeForge-Desktop
// scripts/build-livestudiolab.ts writes): Next is started in-process through its public `next()`
// API, so nothing is spawned.
//
// Three differences from MathTestBuddy's, each because one Next build serves four apps:
// - Which app this is comes from the platform (PRIMEFORGE_APP_ID = app.primeforge.mathviz.<target>),
//   and is handed to the app as MATHVIZ_TARGET (src/lib/target.ts). In a package the manifest.json
//   beside this file must name the same id — a package installed under another app's id refuses to
//   start rather than serve the wrong content.
// - PRIMEFORGE_API_URL / _SECRET are not required: without them the app runs with manual imports
//   only and no AI (the e2e suite's "no platform" app). PrimeForge always sets both.
// - The build must be stamped for that target (`.next/mathviz-target`, written by
//   scripts/build-local.ts and the e2e harness).
// - The working directory is set to this file's directory, so the migrations (`./drizzle`, src/lib/
//   db/open.ts migrationsDir) are found however the file is started.
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TAG = "[mathviz]";
const PREFIX = "app.primeforge.mathviz.";
const TARGETS = ["math", "chess", "crypto", "python"];

const fail = (msg) => {
  process.stderr.write(`${TAG} ${msg}\n`);
  process.exit(1);
};

const missing = ["PRIMEFORGE_APP_ID", "PRIMEFORGE_DATA_DIR", "PRIMEFORGE_PORT"].filter(
  (n) => !process.env[n],
);
if (missing.length > 0) fail(`not provided by the platform: ${missing.join(", ")}`);
if (!process.env.PRIMEFORGE_API_URL || !process.env.PRIMEFORGE_API_SECRET) {
  process.stderr.write(`${TAG} no PRIMEFORGE_API_URL/_SECRET: manual imports only, no AI\n`);
}

const appId = process.env.PRIMEFORGE_APP_ID;
const target = appId.startsWith(PREFIX) ? appId.slice(PREFIX.length) : "";
if (!TARGETS.includes(target))
  fail(`PRIMEFORGE_APP_ID ${JSON.stringify(appId)} is not a MathViz app`);
if (process.env.MATHVIZ_TARGET && process.env.MATHVIZ_TARGET !== target) {
  fail(`MATHVIZ_TARGET=${process.env.MATHVIZ_TARGET} but PRIMEFORGE_APP_ID names ${target}`);
}

const port = Number(process.env.PRIMEFORGE_PORT);
if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
  fail(`PRIMEFORGE_PORT ${JSON.stringify(process.env.PRIMEFORGE_PORT)} is not a port`);
}

const dir = dirname(fileURLToPath(import.meta.url));
const manifestFile = join(dir, "manifest.json");
if (existsSync(manifestFile)) {
  const id = JSON.parse(readFileSync(manifestFile, "utf8")).id;
  if (id !== appId) fail(`this package is ${id}, started as ${appId}`);
}
// the build is per target (scripts/build-local.ts stamps it): never serve another target's build
const stampFile = join(dir, ".next", "mathviz-target");
const built = existsSync(stampFile) ? readFileSync(stampFile, "utf8").trim() : null;
if (built !== target)
  fail(`.next is ${built ? `a ${built} build` : "not a stamped build"}, not ${target}'s`);

process.env.NODE_ENV = "production";
process.env.MATHVIZ_TARGET = target;
process.chdir(dir);

const { default: next } = await import("next");
const app = next({ dev: false, dir, hostname: "127.0.0.1", port });
const handle = app.getRequestHandler();
await app.prepare();

// 127.0.0.1 exactly: PrimeForge's app window shows only http://127.0.0.1:<port>, and the guard
// (src/lib/http/guard.ts) refuses any other Host.
const server = createServer((req, res) => handle(req, res));
server.on("error", (e) => fail(`cannot listen on 127.0.0.1:${port}: ${e.message}`));
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`${TAG} ${target} listening on http://127.0.0.1:${port}\n`);
});

// SIGTERM: close the database (src/lib/server/context.ts keeps the process's context on
// globalThis), then the HTTP server. Bounded: PrimeForge kills the process a few seconds later.
let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  setTimeout(() => process.exit(0), 4000).unref();
  try {
    const ctx = await globalThis[Symbol.for("mathviz.pfapp.appContext")];
    ctx?.close();
  } catch {
    // exit anyway
  }
  server.close(() => process.exit(0));
  server.closeAllConnections?.();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
