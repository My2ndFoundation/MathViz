/**
 * bun run build -- --target <math|chess|crypto|python>
 *
 * Builds one target and lays it out in `build/<target>/` exactly as a PrimeForge package's root
 * (design §8): what PrimeForge-Desktop's `scripts/build-mathviz.ts` (plan Task 13) takes from here,
 * so that script only installs the production dependencies (frozen, from the bun.lock staged
 * here), checks the tree and signs it. The arrangement is MathTestBuddy's as PFD's
 * build-mathtestbuddy.ts stages it (stageTree / STAGED_PATHS):
 *
 *   .next/            the production build (MATHVIZ_TARGET=<target>), without cache/ and dev/
 *   drizzle/          the migrations, read at run time from the cwd (src/lib/db/open.ts)
 *   primeforge-entry.mjs  what PrimeForge runs (app/primeforge-entry.mjs)
 *   next.config.mjs   loaded by `next()` at every start (.mjs: a .ts config needs SWC, native)
 *   package.json      verbatim but for `version`, set to the target's manifest version (four apps
 *                     share one package.json and version independently; PFD's builders require the
 *                     two to agree)
 *   bun.lock          verbatim, for the frozen install
 *   public/           when app/public exists: the maths recorder (scripts/recorder.ts writes it for
 *                     the math target only, from the web shell app.html)
 *   manifest.json     targets/<target>/manifest.json
 *   icon.svg          targets/<target>/icon.svg (scripts/icons.ts)
 *
 * Copies dereference symlinks; the staged tree is then checked for symlinks and for the build
 * machine's path to this checkout (PFD refuses both before it signs; .next/required-server-files.*
 * are exempt, as there — the in-process server reads neither field).
 *
 * The build stamps `app/.next/mathviz-target`; the entry refuses to start a build stamped for
 * another target than PRIMEFORGE_APP_ID names, and the e2e harness rebuilds a build that is not
 * python's.
 */
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { loadTarget, type TargetId } from "../app/src/lib/target";
import { icons } from "./icons";
import { writeRecorder } from "./recorder";

export const PFAPP = resolve(import.meta.dir, "..");
const APP = join(PFAPP, "app");
export const ENTRY = "primeforge-entry.mjs";
export const STAMP = "mathviz-target";

/** What a package root holds, beside `.next` (copied separately, without cache/ and dev/). */
export const STAGED: readonly { from: string; to: string; optional?: boolean }[] = [
  { from: "app/drizzle", to: "drizzle" },
  { from: `app/${ENTRY}`, to: ENTRY },
  { from: "app/next.config.mjs", to: "next.config.mjs" },
  { from: "package.json", to: "package.json" },
  { from: "bun.lock", to: "bun.lock" },
  { from: "app/public", to: "public", optional: true },
];

/** Exempt from the checkout-path scan, as in PFD build-livestudiolab.ts CHECKOUT_PATH_EXEMPT. */
export const CHECKOUT_PATH_EXEMPT: readonly RegExp[] = [
  /^\.next\/required-server-files\.json$/,
  /^\.next\/required-server-files\.js$/,
];

interface Manifest {
  id: string;
  version: string;
  entry: string;
  port: number;
  runtime: string;
  art?: { icon?: string };
}

export function parseTarget(argv: string[]): TargetId {
  const i = argv.indexOf("--target");
  const id = i >= 0 ? argv[i + 1] : argv.find((a) => a.startsWith("--target="))?.slice(9);
  return loadTarget(id).id;
}

/**
 * The target's manifest checked against target.json and the entry (no web-version input: this is
 * what `bun run test` asserts, and a web PR must not turn that red — design §9).
 */
export function checkManifest(t: TargetId): Manifest {
  const target = loadTarget(t);
  const dir = join(PFAPP, "targets", t);
  const m = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Manifest;
  const problems: string[] = [];
  if (m.id !== target.appId) problems.push(`id ${m.id}, target.json says ${target.appId}`);
  if (m.port !== target.port) problems.push(`port ${m.port}, target.json says ${target.port}`);
  if (m.entry !== ENTRY) problems.push(`entry ${m.entry}, the package's entry is ${ENTRY}`);
  if (m.runtime !== "node@24") problems.push(`runtime ${m.runtime}, expected node@24`);
  if (m.art?.icon !== "icon.svg") problems.push(`art.icon ${m.art?.icon}, expected icon.svg`);
  if (!/^\d+\.\d+\.\d+$/.test(m.version ?? "")) problems.push(`version ${m.version}`);
  if (problems.length) throw new Error(`targets/${t}/manifest.json: ${problems.join("; ")}`);
  return m;
}

/**
 * checkManifest plus the icon's freshness against the generator, whose inputs are the web
 * version's design tokens and brand mark. Only the build's preflight checks this: a stale icon
 * matters when a package is made, and nowhere else.
 */
export function readManifest(t: TargetId, opts: { allowStaleIcon?: boolean } = {}): Manifest {
  const m = checkManifest(t);
  if (readFileSync(join(PFAPP, "targets", t, "icon.svg"), "utf8") !== icons()[t]) {
    const why = `targets/${t}/icon.svg is stale (run \`bun scripts/icons.ts\`)`;
    // CI builds to prove the app still builds, not to ship it: a web design change that has not
    // been carried into the icons yet must not turn that red (design §9). The signing build keeps
    // the refusal.
    if (!opts.allowStaleIcon) throw new Error(why);
    console.warn(`warning: ${why}; continuing (--allow-stale-icon)`);
  }
  return m;
}

/** Every path under `dir` (files only), relative, sorted. */
function files(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...files(dir, r));
    else out.push(r);
  }
  return out.sort();
}

export function assertNoSymlinks(dir: string): void {
  const walk = (rel: string): void => {
    for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (lstatSync(join(dir, r)).isSymbolicLink()) throw new Error(`${r} is a symlink`);
      if (e.isDirectory()) walk(r);
    }
  };
  walk("");
}

export function checkoutPathHits(dir: string, checkout: string): string[] {
  const needle = Buffer.from(checkout, "utf8");
  return files(dir).filter(
    (r) =>
      !CHECKOUT_PATH_EXEMPT.some((x) => x.test(r)) && readFileSync(join(dir, r)).includes(needle),
  );
}

export function stage(t: TargetId, out: string, manifest: Manifest): void {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const next = join(APP, ".next");
  if (readFileSync(join(next, STAMP), "utf8").trim() !== t) {
    throw new Error(`app/.next is not a ${t} build`);
  }
  const skip = new Set([join(next, "cache"), join(next, "dev")]);
  cpSync(next, join(out, ".next"), {
    recursive: true,
    dereference: true,
    filter: (src) => !skip.has(src),
  });
  for (const s of STAGED) {
    const from = join(PFAPP, s.from);
    if (!existsSync(from)) {
      if (s.optional) continue;
      throw new Error(`${s.from} is missing`);
    }
    cpSync(from, join(out, s.to), { recursive: true, dereference: true });
  }
  const pkg = JSON.parse(readFileSync(join(PFAPP, "package.json"), "utf8")) as { version: string };
  pkg.version = manifest.version;
  writeFileSync(join(out, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(
    join(out, "manifest.json"),
    readFileSync(join(PFAPP, "targets", t, "manifest.json")),
  );
  // By bytes, not cpSync: on APFS that clones, and FSEvents can then report the source,
  // targets/<t>/icon.svg, which is inside the pf project `pf dev` watches (measured on a large
  // tree in Live Studio Lab; not reproduced for this one file, kept as the safe form).
  writeFileSync(join(out, "icon.svg"), readFileSync(join(PFAPP, "targets", t, "icon.svg")));
}

/** `next build app` for `t` (with its public/ assets: the maths recorder), then stamp the build. */
async function nextBuild(t: TargetId): Promise<void> {
  writeRecorder(t);
  const proc = Bun.spawn([join(PFAPP, "node_modules", ".bin", "next"), "build", "app"], {
    cwd: PFAPP,
    env: { ...process.env, MATHVIZ_TARGET: t, NODE_ENV: "production" },
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await proc.exited) !== 0) throw new Error(`next build failed for ${t}`);
  writeFileSync(join(APP, ".next", STAMP), `${t}\n`);
}

function sizeOf(p: string): number {
  const st = statSync(p);
  if (!st.isDirectory()) return st.size;
  return readdirSync(p).reduce((n, e) => n + sizeOf(join(p, e)), 0);
}

async function main(): Promise<void> {
  let t: TargetId;
  let manifest: Manifest;
  try {
    t = parseTarget(process.argv.slice(2));
    manifest = readManifest(t, { allowStaleIcon: process.argv.includes("--allow-stale-icon") });
  } catch (e) {
    console.error((e as Error).message);
    console.error("usage: bun run build -- --target <math|chess|crypto|python>");
    process.exit(1);
  }
  await nextBuild(t);
  const out = join(PFAPP, "build", t);
  stage(t, out, manifest);
  assertNoSymlinks(out);
  const hits = checkoutPathHits(out, resolve(PFAPP, ".."));
  if (hits.length) {
    throw new Error(
      `these carry the build machine's path to the checkout:\n  ${hits.join("\n  ")}`,
    );
  }
  console.log(`\nbuild/${t}/ (${manifest.id} ${manifest.version}):`);
  for (const e of readdirSync(out).sort()) {
    console.log(`  ${e.padEnd(24)} ${(sizeOf(join(out, e)) / 1024).toFixed(1).padStart(10)} KiB`);
  }
  console.log(`  ${"total".padEnd(24)} ${(sizeOf(out) / 1024).toFixed(1).padStart(10)} KiB`);
}

if (import.meta.main) await main();
