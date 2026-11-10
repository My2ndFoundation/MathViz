/**
 * bun run stage:pfapp -- --target <math|chess|crypto|python> [--allow-stale-icon] [--release]
 *
 * The PrimeForge stage of one target, built from this repository alone, for `pf` (PrimeForge-SDK):
 * `targets/<t>/primeforge.json` names this script as its `build` and `dist/pfapp` (that is,
 * `targets/<t>/dist/pfapp/`; `pf pack` writes beside it, into `dist/packages/`) as its stage, so
 * `pf dev`, `pf check`, `pf pack` and `pf build` work from a MathViz checkout with no
 * PrimeForge-Desktop checkout beside it.
 *
 * It is PrimeForge-Desktop's `scripts/build-mathviz.ts` `buildStage`, everything but the signing,
 * moved here with the same result:
 *
 *   1. the preflight: the target's manifest (build-local's checkManifest, and the desktop's rules:
 *      a declared `ui.window`, no `platforms`), the icon's freshness (strict unless
 *      --allow-stale-icon), a `.mjs` Next config and no native driver in the dependencies;
 *   2. `bun install --frozen-lockfile` here, then `bun scripts/build-local.ts --target <t>`, which
 *      writes `build/<t>/` (unchanged, so the desktop's build:mathviz still takes it from there);
 *   3. `build/<t>/` copied into the stage entry by entry (BUILD_ENTRIES, the desktop's list): an
 *      entry it does not list, a missing one, or a `.next` stamped for another target is refused;
 *      the staged manifest must be targets/<t>/manifest.json byte for byte, its package.json carry
 *      the manifest's version, its bun.lock be this package's;
 *   4. the production install the desktop runs, from that bun.lock (`--production --omit=optional
 *      --frozen-lockfile --ignore-scripts --linker hoisted`), and every `node_modules/.bin` removed.
 *
 * The checks the desktop then runs (symlinks, native code, native drivers, the checkout's path, the
 * profile ids, the icon standard, the lockfile) are `pf check`'s gates, run by `pf pack` too.
 *
 * Two things `pf` cannot see from `targets/<t>/` and this script therefore does itself:
 * - **A clean checkout.** pf's clean-git gate covers only the project directory, `targets/<t>/`;
 *   the app's code is in `app/`. MathViz's rule is the whole checkout. With `--release` a dirty
 *   checkout (before or after the build) is refused; without it, it is named as a warning, because
 *   `pf dev` runs this build while you are editing.
 * - **Freshness.** `pf pack` packs whatever stage exists; to pack, build first (`pf build`, or this
 *   script with `--release` and then `pf pack`).
 *
 * `pf dev` watches `targets/<t>/` and rebuilds on a change there, ignoring `dist/`. Nothing this
 * script writes inside the project fires an event it would read as an edit: the stage is copied by
 * bytes (cpSync clones on APFS, and FSEvents then reports the clone's SOURCE), and an old stage is
 * renamed out of the project before it is deleted (an in-place delete of ~10k files collapses into
 * one event naming the project root). build-local copies the icon by bytes for the same reason.
 *
 * Children are spawned with the `cwd` option (never `bun --cwd <dir> run`: Bun 1.3 prints its usage
 * and exits 0) and never see a signing seed.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { TargetId } from "../app/src/lib/target";
import { checkManifest, ENTRY, PFAPP, parseTarget, readManifest, STAMP } from "./build-local";

export const MATHVIZ = resolve(PFAPP, "..");

/** A pf project per target: `targets/<t>/`, with its stage at `targets/<t>/dist/pfapp/`. */
export const STAGE = "dist/pfapp";
export const projectDir = (t: TargetId): string => join(PFAPP, "targets", t);
export const stageDir = (t: TargetId): string => join(projectDir(t), STAGE);

/**
 * What `build/<t>/` holds — build-local's STAGED plus `.next`, `manifest.json` and `icon.svg`. The
 * same list as PrimeForge-Desktop's scripts/build-mathviz.ts BUILD_ENTRIES: a new entry is a change
 * to the package's contents, and belongs on both lists in the same change.
 */
export const BUILD_ENTRIES: readonly { name: string; optional?: boolean }[] = [
  { name: ".next" },
  { name: "drizzle" },
  { name: ENTRY },
  { name: "next.config.mjs" },
  { name: "package.json" },
  { name: "bun.lock" },
  { name: "public", optional: true },
  { name: "manifest.json" },
  { name: "icon.svg" },
];

/** The production install, exactly as the desktop's build:mathviz runs it in its stage. */
export const PRODUCTION_INSTALL: readonly string[] = [
  "install",
  "--production",
  "--omit=optional",
  "--frozen-lockfile",
  "--ignore-scripts",
  "--linker",
  "hoisted",
];

/** Native SQLite drivers and sharp: a PrimeForge app carries no native code. */
const NATIVE_DEPENDENCIES = ["@libsql/client", "libsql", "better-sqlite3", "sqlite3", "sharp"];

export class StageError extends Error {}

/**
 * Copies by bytes (following symlinks, keeping permission bits), never cpSync / copyFileSync: on
 * APFS those clone, and FSEvents then reports the SOURCE path too.
 */
export function copyTree(
  src: string,
  dst: string,
  skip: (src: string) => boolean = () => false,
): void {
  if (skip(src)) return;
  const st = statSync(src);
  if (st.isDirectory()) {
    mkdirSync(dst, { recursive: true });
    for (const name of readdirSync(src).sort()) copyTree(join(src, name), join(dst, name), skip);
    return;
  }
  if (!st.isFile()) throw new StageError(`${src} is neither a file nor a directory`);
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, readFileSync(src));
  chmodSync(dst, st.mode & 0o777);
}

/** Moves an old stage out of the project before deleting it (one event, under the ignored dist/). */
export function clearStage(dir: string): void {
  if (!existsSync(dir)) return;
  const aside = join(mkdtempSync(join(tmpdir(), "mathviz-old-stage-")), "stage");
  try {
    renameSync(dir, aside);
  } catch {
    // tmpdir on another volume: deleting in place is all that is left
    rmSync(dirname(aside), { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
    return;
  }
  rmSync(dirname(aside), { recursive: true, force: true });
}

/** `build/<t>/` → the stage, refusing a build for another target or of another shape. */
export function stageBuild(buildDir: string, stage: string, t: TargetId): void {
  if (!existsSync(buildDir)) throw new StageError(`the build left no ${buildDir}`);
  const known = new Set(BUILD_ENTRIES.map((e) => e.name));
  const extra = readdirSync(buildDir)
    .filter((n) => !known.has(n))
    .sort();
  if (extra.length > 0) {
    throw new StageError(
      `${buildDir} holds entries the package does not carry: ${extra.join(", ")} — add them to ` +
        "BUILD_ENTRIES here and in PrimeForge-Desktop's scripts/build-mathviz.ts if the app reads " +
        "them at run time, or stop build-local writing them",
    );
  }
  const missing = BUILD_ENTRIES.filter((e) => !e.optional && !existsSync(join(buildDir, e.name)));
  if (missing.length > 0) {
    throw new StageError(`${buildDir} is missing ${missing.map((e) => e.name).join(", ")}`);
  }
  const stampFile = join(buildDir, ".next", STAMP);
  const stamped = existsSync(stampFile) ? readFileSync(stampFile, "utf8").trim() : "(none)";
  if (stamped !== t) {
    throw new StageError(
      `${buildDir}/.next is stamped "${stamped}", not "${t}" — not a ${t} build`,
    );
  }
  clearStage(stage);
  mkdirSync(stage, { recursive: true });
  for (const e of BUILD_ENTRIES) {
    const from = join(buildDir, e.name);
    if (existsSync(from)) copyTree(from, join(stage, e.name));
  }
}

/**
 * The stage against its sources: the manifest is targets/<t>/manifest.json byte for byte (a stale
 * build otherwise), package.json carries its version, bun.lock is this package's (the lockfile pf's
 * gate reads is the stage's copy, so it must be this one).
 */
export function checkStage(stage: string, t: TargetId, pfapp: string = PFAPP): void {
  const problems: string[] = [];
  const source = readFileSync(join(pfapp, "targets", t, "manifest.json"));
  if (!readFileSync(join(stage, "manifest.json")).equals(source)) {
    problems.push(`manifest.json differs from targets/${t}/manifest.json (a stale build)`);
  }
  const m = JSON.parse(source.toString("utf8")) as { version: string };
  const pkg = JSON.parse(readFileSync(join(stage, "package.json"), "utf8")) as { version: string };
  if (pkg.version !== m.version) {
    problems.push(`package.json says ${pkg.version}, the manifest ${m.version}`);
  }
  if (!readFileSync(join(stage, "bun.lock")).equals(readFileSync(join(pfapp, "bun.lock")))) {
    problems.push("bun.lock differs from pfapp/bun.lock");
  }
  if (problems.length > 0) throw new StageError(`the stage ${stage}: ${problems.join("; ")}`);
}

/**
 * What the desktop's build:mathviz refuses before it builds, beyond build-local's checkManifest:
 * the apps open in a PrimeForge window, the package is pure JavaScript (no `platforms`), the Next
 * config is .mjs (a .ts one needs SWC, native, at every start), no native driver is a dependency.
 */
export function packagingProblems(t: TargetId, pfapp: string = PFAPP): string[] {
  const problems: string[] = [];
  const m = JSON.parse(readFileSync(join(pfapp, "targets", t, "manifest.json"), "utf8")) as {
    ui?: { window?: unknown };
    platforms?: string[];
  };
  if (!m.ui?.window) problems.push(`targets/${t}/manifest.json declares no ui.window`);
  if (m.platforms) problems.push(`targets/${t}/manifest.json declares platforms`);
  if (!existsSync(join(pfapp, "app", "next.config.mjs"))) problems.push("no app/next.config.mjs");
  const pkg = JSON.parse(readFileSync(join(pfapp, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  for (const n of NATIVE_DEPENDENCIES) {
    if (pkg.dependencies?.[n]) problems.push(`${n} in the production dependencies`);
  }
  return problems;
}

/** Every `node_modules/.bin` under `dir` removed (links to executables an app has no use for). */
export function removeBinDirs(dir: string): number {
  let removed = 0;
  const walk = (d: string, inNodeModules: boolean): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const full = join(d, e.name);
      if (e.name === ".bin" && inNodeModules) {
        rmSync(full, { recursive: true, force: true });
        removed += 1;
        continue;
      }
      walk(full, inNodeModules || e.name === "node_modules");
    }
  };
  walk(dir, false);
  return removed;
}

/** The environment of every child: everything but the two signing seeds. */
export function childEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined && k !== "PRIMEFORGE_SIGNING_KEY" && k !== "PRIMEFORGE_DEVELOPER_KEY") {
      out[k] = v;
    }
  }
  return out;
}

/** `git status --porcelain` of the whole MathViz checkout (empty when clean). */
export function dirtyCheckout(root: string = MATHVIZ): string {
  const r = Bun.spawnSync(["git", "-C", root, "status", "--porcelain"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (r.exitCode !== 0) throw new StageError(`git status failed in ${root}: ${r.stderr}`);
  return r.stdout.toString().trimEnd();
}

async function run(cmd: string[], cwd: string, what: string): Promise<void> {
  const proc = Bun.spawn(cmd, {
    cwd,
    env: childEnv(process.env),
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) throw new StageError(`${what} failed (exit ${code}): ${cmd.join(" ")} in ${cwd}`);
}

function clean(release: boolean, when: string): void {
  const dirty = dirtyCheckout();
  if (dirty === "") return;
  const list = dirty.split("\n").slice(0, 10).join("\n");
  if (release) {
    throw new StageError(
      `the MathViz checkout has uncommitted changes ${when} — a release must be reproducible ` +
        `from a commit:\n${list}`,
    );
  }
  console.warn(
    `warning: the MathViz checkout has uncommitted changes ${when}; this stage is for pf dev, ` +
      `not for a package (build with --release before pf pack):\n${list}`,
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const t = parseTarget(argv);
  const release = argv.includes("--release");
  const allowStaleIcon = argv.includes("--allow-stale-icon");
  if (release && allowStaleIcon) {
    throw new StageError("--release refuses a stale icon; drop --allow-stale-icon");
  }
  const manifest = readManifest(t, { allowStaleIcon });
  checkManifest(t);
  const problems = packagingProblems(t);
  if (problems.length > 0) {
    throw new StageError(`MathViz ${t} cannot be packaged: ${problems.join("; ")}`);
  }
  clean(release, "before the build");

  const bun = process.execPath;
  console.log(`Staging ${manifest.id} ${manifest.version} into targets/${t}/${STAGE}/…`);
  await run([bun, "install", "--frozen-lockfile"], PFAPP, "installing pfapp's dependencies");
  const buildArgs = [bun, join(PFAPP, "scripts", "build-local.ts"), "--target", t];
  if (allowStaleIcon) buildArgs.push("--allow-stale-icon");
  await run(buildArgs, PFAPP, `the ${t} build`);
  clean(release, "after the build (everything it writes must be gitignored)");

  const stage = stageDir(t);
  stageBuild(join(PFAPP, "build", t), stage, t);
  checkStage(stage, t);
  await run([bun, ...PRODUCTION_INSTALL], stage, "the production install");
  console.log(`Removed ${removeBinDirs(stage)} node_modules/.bin director(ies)`);
  console.log(`\n${stage}: ${manifest.id} ${manifest.version}. Next: pf check (or pf pack).`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
