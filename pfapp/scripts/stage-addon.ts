/**
 * bun run stage:addon -- --target <math|chess|crypto|python> [--release | --status]
 *
 * The content pack of one target (`app.primeforge.mathviz.<t>/content`) as a pf add-on stage,
 * built from this repository alone: `content/<t>/primeforge.json` names this script as its `build`
 * and `dist/addon` (that is, `content/<t>/dist/addon/`; `pf pack` writes beside it, into
 * `dist/packages/`) as its stage, holding `addon.json` and `payload/`.
 *
 * It is PrimeForge-Desktop's `scripts/build-mathviz-addon.ts`, everything but the signing, moved
 * here with the same result — the same payload bytes (this repository's own extractor), the same
 * `addon.json`, and the same version decision, against the release record that now lives here,
 * `content/releases.json` (seeded with the desktop's `scripts/mathviz-content-releases.json` as it
 * stood, so nothing already published is versioned again):
 *
 * - the payload's **fingerprint** (sha256 over every payload file but provenance.json, recomputed
 *   from the files and held to provenance.json) equals the last recorded release's → nothing to
 *   release: `--release` and `--status` exit **2** (and `--release` leaves no stage, so a `pf pack`
 *   after it packs nothing); the plain build still writes a stage, with that release's own version,
 *   so `pf dev` can link it — never a new version for the same content;
 * - otherwise the next version is a patch above the last recorded one, `1.0.0` for the first.
 *
 * Only a **successful publish** moves the record: after `pf publish`, run
 * `bun run record:addon -- <the .pfaddon>` (`scripts/record-addon.ts`), which reads the version and
 * the fingerprint from the signed package itself. The build prints that command.
 *
 * A build never lets a package already built for its version be overwritten with other bytes (it may
 * be the published, unrecorded one): with `--release` that is a refusal naming both ways out; without
 * it, a warning. When that package holds exactly this pack (same fingerprint, same addon.json), the
 * stage is written from the package's own bytes, so `pf pack` is a no-op instead of a refusal.
 *
 * Modes:
 * - plain (what `pf dev` and `pf build` run): a dirty checkout is a warning, and provenance.json says
 *   `clean: false` — `record:addon` refuses such a package;
 * - `--release`: the whole MathViz checkout must be clean (pf's clean-git gate sees only
 *   `content/<t>/`), before and after; then `pf pack`;
 * - `--status`: extracts into a temporary directory, prints the fingerprint, the last release, the
 *   files that differ from it and the version a build would make, writes nothing.
 *
 * `pf dev` watches `content/<t>/` and ignores `dist/`. Nothing this script does there reads as an
 * edit: the extractor writes into a temporary directory outside the project, the stage is copied
 * by bytes (cpSync clones on APFS, and FSEvents then reports the clone's SOURCE), and an old stage
 * is renamed out of the project before it is deleted.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { loadTarget, type TargetId } from "../app/src/lib/target";
import { extract } from "../extract/index";
import { headSha } from "../extract/provenance";
import { PFAPP, parseTarget } from "./build-local";
import { clearStage, copyTree, dirtyCheckout, MATHVIZ } from "./stage-pfapp";

export const TARGETS: readonly TargetId[] = ["math", "chess", "crypto", "python"];

/** A pf add-on project per target: `content/<t>/`, its stage `content/<t>/dist/addon/`. */
export const STAGE = "dist/addon";
export const contentProjectDir = (t: TargetId, pfapp: string = PFAPP): string =>
  join(pfapp, "content", t);
export const addonStageDir = (t: TargetId, pfapp: string = PFAPP): string =>
  join(contentProjectDir(t, pfapp), STAGE);
/** Where `pf pack` writes by default (`<project>/dist/packages`). */
export const packagesDir = (t: TargetId, pfapp: string = PFAPP): string =>
  join(contentProjectDir(t, pfapp), "dist", "packages");

export class AddonError extends Error {}

export interface FileHash {
  path: string;
  sha256: string;
}

/** One recorded release of a target's content pack (the desktop's ContentRelease, unchanged). */
export interface ContentRelease {
  version: string;
  fingerprint: string;
  /** The MathViz commit the payload was extracted from. */
  sha: string;
  /** The app version the pack required, so a later build can say when that moves. */
  minAppVersion?: string;
  /** Every payload file but provenance.json, so `--status` can name what changed since. */
  files: FileHash[];
}

export type ContentReleases = Partial<Record<TargetId, ContentRelease>>;

/** `addon.json`, exactly the fields and order the desktop's build:mathviz-addon writes. */
export interface AddonJson {
  format: 1;
  id: string;
  appId: string;
  version: string;
  kind: "content";
  title: string;
  minAppVersion: string;
  unpackedBytes: number;
}

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const appIdOf = (t: TargetId): string => `app.primeforge.mathviz.${t}`;
export const addonIdOf = (appId: string): string => `${appId}/content`;
/** pf pack's name: `<slug>-<version>.pfaddon`, the slug being `content`. */
export const packageFileName = (version: string): string => `content-${version}.pfaddon`;

/** `content/releases.json`, or `MATHVIZ_CONTENT_RELEASES` (tests, proofs). */
export function releasesPath(
  env: Record<string, string | undefined> = process.env,
  pfapp: string = PFAPP,
): string {
  return resolve(env.MATHVIZ_CONTENT_RELEASES ?? join(pfapp, "content", "releases.json"));
}

export function readReleases(path: string): ContentReleases {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new AddonError(`${path} is not a JSON object`);
  }
  return raw as ContentReleases;
}

/** Keys sorted, two-space JSON and a newline: the desktop's writeReleases, byte for byte. */
export function writeReleases(path: string, releases: ContentReleases): void {
  const sorted: ContentReleases = {};
  for (const k of Object.keys(releases).sort() as TargetId[]) {
    const entry = releases[k];
    if (entry) sorted[k] = entry;
  }
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
}

export function nextVersion(last: string | undefined): string {
  if (last === undefined) return "1.0.0";
  const m = VERSION.exec(last);
  if (!m) throw new AddonError(`the recorded version "${last}" is not MAJOR.MINOR.PATCH`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

/**
 * The version a build makes. Unchanged content (the last release's fingerprint) keeps the last
 * release's version — it is never a new one.
 */
export function decideVersion(
  last: ContentRelease | undefined,
  fingerprint: string,
): { unchanged: boolean; version: string } {
  if (last && last.fingerprint === fingerprint) return { unchanged: true, version: last.version };
  return { unchanged: false, version: nextVersion(last?.version) };
}

export function addonManifestFor(o: {
  appId: string;
  appName: string;
  version: string;
  minAppVersion: string;
  unpackedBytes: number;
}): AddonJson {
  return {
    format: 1,
    id: addonIdOf(o.appId),
    appId: o.appId,
    version: o.version,
    kind: "content",
    title: `${o.appName} content`,
    minAppVersion: o.minAppVersion,
    unpackedBytes: o.unpackedBytes,
  };
}

export const addonJsonText = (a: AddonJson): string => `${JSON.stringify(a, null, 2)}\n`;

/**
 * The same pack, for a package already built: every addon.json field equal but `unpackedBytes`,
 * which counts provenance.json too — and that file names the commit and whether the checkout was
 * clean, neither of which is content (the fingerprint, compared beside this, is the content).
 */
export function sameAddon(a: AddonJson, b: AddonJson): boolean {
  const canon = (m: AddonJson) =>
    JSON.stringify(
      Object.entries(m)
        .filter(([k]) => k !== "unpackedBytes")
        .sort(([x], [y]) => (x < y ? -1 : 1)),
    );
  return canon(a) === canon(b);
}

const sha256 = (data: Buffer): string => createHash("sha256").update(data).digest("hex");

export interface Provenance {
  target: string;
  sha: string;
  clean: boolean;
  fingerprint: string;
  files: FileHash[];
}

export interface Digest {
  fingerprint: string;
  files: FileHash[];
  provenance: Provenance;
  /** Every payload file's bytes, provenance.json included (addon.json's unpackedBytes). */
  bytes: number;
}

/**
 * The extractor's rule — sha256 over `"<sha256>  <path>\n"` in path order, provenance.json left out —
 * recomputed from the files, and a provenance.json that disagrees refused: what is packed and what
 * is recorded are the files themselves, not a claim about them.
 */
export function digestOf(files: ReadonlyMap<string, Buffer>, where: string): Digest {
  let bytes = 0;
  const hashes: FileHash[] = [];
  for (const p of [...files.keys()].sort()) {
    const data = files.get(p) as Buffer;
    bytes += data.length;
    if (p !== "provenance.json") hashes.push({ path: p, sha256: sha256(data) });
  }
  const fingerprint = sha256(Buffer.from(hashes.map((f) => `${f.sha256}  ${f.path}\n`).join("")));
  const prov = files.get("provenance.json");
  if (!prov) throw new AddonError(`${where} has no provenance.json`);
  const provenance = JSON.parse(prov.toString("utf8")) as Provenance;
  if (provenance.fingerprint !== fingerprint) {
    throw new AddonError(
      `${where}: the payload's fingerprint is ${fingerprint}, but its provenance.json says ` +
        `${provenance.fingerprint} — the payload was changed after extraction`,
    );
  }
  return { fingerprint, files: hashes, provenance, bytes };
}

/** Every file under `dir`, by `/`-separated relative path. */
export function readTree(dir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (rel: string): void => {
    for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else out.set(p, readFileSync(join(dir, p)));
    }
  };
  walk("");
  return out;
}

/** `+ added`, `- removed`, `~ changed`, in path order. */
export function diffFiles(
  before: readonly FileHash[] | undefined,
  after: readonly FileHash[],
): string[] {
  const a = new Map((before ?? []).map((f) => [f.path, f.sha256] as const));
  const b = new Map(after.map((f) => [f.path, f.sha256] as const));
  const out: string[] = [];
  for (const p of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    if (!a.has(p)) out.push(`  + ${p}`);
    else if (!b.has(p)) out.push(`  - ${p}`);
    else if (a.get(p) !== b.get(p)) out.push(`  ~ ${p}`);
  }
  return out;
}

const MAX_UNPACKED = 2 * 1024 * 1024 * 1024;
const BLOCK = 512;

/**
 * A `.pfaddon`'s tar, read in memory: pf's strict ustar subset (regular files and directories,
 * name + prefix), anything else refused. Returns the files by path; directories are implied.
 */
export function readTar(tar: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const str = (b: Buffer, at: number, len: number) => {
    const s = b.subarray(at, at + len);
    const nul = s.indexOf(0);
    return (nul < 0 ? s : s.subarray(0, nul)).toString("utf8");
  };
  let off = 0;
  while (off + BLOCK <= tar.length) {
    const h = tar.subarray(off, off + BLOCK);
    if (h.every((x) => x === 0)) return files;
    if (str(h, 257, 5) !== "ustar") throw new AddonError("the package is not a ustar archive");
    const size = Number.parseInt(str(h, 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(h[156] as number);
    const name = str(h, 0, 100);
    const prefix = str(h, 345, 155);
    const path = (prefix ? `${prefix}/${name}` : name).replace(/\/+$/, "");
    if (path === "" || path.startsWith("/") || path.split("/").includes("..")) {
      throw new AddonError(`the package holds an unsafe path: ${JSON.stringify(path)}`);
    }
    off += BLOCK;
    if (type === "0" || type === "\0") {
      files.set(path, Buffer.from(tar.subarray(off, off + size)));
      off += Math.ceil(size / BLOCK) * BLOCK;
    } else if (type !== "5") {
      throw new AddonError(`the package holds an entry of type ${JSON.stringify(type)}: ${path}`);
    }
  }
  throw new AddonError("the package's archive has no terminator");
}

function parseAddonJson(text: string, where: string): AddonJson {
  const m = JSON.parse(text) as Partial<AddonJson>;
  const ok =
    m.format === 1 &&
    typeof m.id === "string" &&
    typeof m.appId === "string" &&
    m.id === addonIdOf(m.appId) &&
    typeof m.version === "string" &&
    VERSION.test(m.version) &&
    m.kind === "content";
  if (!ok) throw new AddonError(`${where}: addon.json is not a MathViz content pack's`);
  return m as AddonJson;
}

/** A built `.pfaddon` read back from its own bytes: its addon.json, payload and digest. */
export function readPackedAddon(file: string): {
  manifest: AddonJson;
  addonText: Buffer;
  payload: Map<string, Buffer>;
  digest: Digest;
} {
  const all = readTar(gunzipSync(readFileSync(file), { maxOutputLength: MAX_UNPACKED }));
  const addonText = all.get("addon.json");
  if (!addonText) throw new AddonError(`${file} has no addon.json`);
  const payload = new Map<string, Buffer>();
  for (const [p, data] of all) {
    if (p.startsWith("payload/")) payload.set(p.slice("payload/".length), data);
    else if (p !== "addon.json") throw new AddonError(`${file} holds ${p}, outside payload/`);
  }
  const manifest = parseAddonJson(addonText.toString("utf8"), file);
  return { manifest, addonText, payload, digest: digestOf(payload, `${file}'s payload`) };
}

/** `app.primeforge.mathviz.<t>/content` → that target; any other add-on id → null. */
export function contentTargetOf(addonId: string): TargetId | null {
  return TARGETS.find((t) => addonIdOf(appIdOf(t)) === addonId) ?? null;
}

export function releaseEntry(manifest: AddonJson, digest: Digest): ContentRelease {
  return {
    version: manifest.version,
    fingerprint: digest.fingerprint,
    sha: digest.provenance.sha,
    ...(manifest.minAppVersion ? { minAppVersion: manifest.minAppVersion } : {}),
    files: digest.files,
  };
}

export interface PublishedRecord {
  target: TargetId;
  entry: ContentRelease;
  /** This version was already recorded with this very fingerprint: nothing was written. */
  already: boolean;
}

/**
 * Records a published package: everything read from the signed `.pfaddon` itself (its addon.json and
 * the digest of its payload), never from the working tree, so MathViz moving on or a later build
 * cannot make a published pack unrecordable. Idempotent: the version already recorded with this
 * fingerprint is `already`, nothing written. Refuses, writing nothing, a package that is not a
 * MathViz content pack, has no `.sig` beside it, was extracted from a dirty checkout or for another
 * target, is not the version after the last recorded, or is a recorded version with another
 * fingerprint. The desktop's `recordPublished`, with the same rules.
 */
export function recordPublished(file: string, releasesFile: string): PublishedRecord {
  if (!existsSync(`${file}.sig`)) {
    throw new AddonError(
      `no ${file}.sig: record the package that was published, with its signature`,
    );
  }
  const { manifest, digest } = readPackedAddon(file);
  const target = contentTargetOf(manifest.id);
  if (!target) throw new AddonError(`${file} is ${manifest.id}, not a MathViz content pack`);
  const p = digest.provenance;
  if (p.target !== target || p.clean !== true) {
    throw new AddonError(
      `${file}'s provenance says target ${p.target}, clean ${p.clean}; a release is ${target} from a ` +
        "clean checkout (bun run stage:addon -- --target <t> --release, then pf pack)",
    );
  }
  const releases = readReleases(releasesFile);
  const last = releases[target];
  if (last && last.version === manifest.version) {
    if (last.fingerprint === digest.fingerprint) return { target, entry: last, already: true };
    throw new AddonError(
      `${target} ${manifest.version} is recorded with fingerprint ${last.fingerprint}, but ${file} ` +
        `has ${digest.fingerprint}`,
    );
  }
  const expected = nextVersion(last?.version);
  if (manifest.version !== expected) {
    throw new AddonError(
      `the last recorded ${target} release is ${last?.version ?? "none"}, so the next is ` +
        `${expected}, not ${manifest.version}`,
    );
  }
  const entry = releaseEntry(manifest, digest);
  writeReleases(releasesFile, { ...releases, [target]: entry });
  return { target, entry, already: false };
}

/** The target's app manifest, held to what a content pack needs. */
export function readAppManifest(
  t: TargetId,
  pfapp: string = PFAPP,
): { id: string; name: string; version: string } {
  const where = `targets/${t}/manifest.json`;
  const m = JSON.parse(readFileSync(join(pfapp, "targets", t, "manifest.json"), "utf8")) as {
    id?: unknown;
    name?: unknown;
    version?: unknown;
    capabilities?: unknown;
  };
  if (m.id !== appIdOf(t))
    throw new AddonError(`${where}: id is ${String(m.id)}, not ${appIdOf(t)}`);
  if (typeof m.name !== "string" || m.name === "") throw new AddonError(`${where}: no name`);
  if (typeof m.version !== "string" || !VERSION.test(m.version)) {
    throw new AddonError(`${where}: version is not MAJOR.MINOR.PATCH`);
  }
  if (!Array.isArray(m.capabilities) || !m.capabilities.includes("addons")) {
    throw new AddonError(
      `${m.id} does not declare the addons capability, so it could never read its content pack`,
    );
  }
  return { id: m.id, name: m.name, version: m.version };
}

/** Writes the stage: `addon.json` + `payload/` (by bytes), after moving any old stage aside. */
export function writeStage(
  stage: string,
  addonText: Buffer | string,
  payload: string | Map<string, Buffer>,
): void {
  clearStage(stage);
  mkdirSync(join(stage, "payload"), { recursive: true });
  if (typeof payload === "string") copyTree(payload, join(stage, "payload"));
  else {
    for (const [p, data] of [...payload].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const dest = join(stage, "payload", p);
      mkdirSync(join(dest, ".."), { recursive: true });
      writeFileSync(dest, data);
    }
  }
  writeFileSync(join(stage, "addon.json"), addonText);
}

interface Args {
  target: TargetId;
  release: boolean;
  status: boolean;
}

const USAGE =
  "usage: bun run stage:addon -- --target <math|chess|crypto|python> [--release | --status]";

export function parseArgs(argv: readonly string[]): Args {
  for (const a of argv) {
    if (
      a.startsWith("--") &&
      !["--target", "--release", "--status"].includes(a) &&
      !a.startsWith("--target=")
    ) {
      throw new AddonError(USAGE);
    }
  }
  const release = argv.includes("--release");
  const status = argv.includes("--status");
  if (release && status) throw new AddonError(USAGE);
  return { target: parseTarget([...argv]), release, status };
}

/** Exit code: 0 staged (or reported), 2 nothing to release (--release, --status). Throws otherwise. */
export async function main(argv: readonly string[]): Promise<number> {
  const { target: t, release, status } = parseArgs(argv);
  const app = readAppManifest(t);
  const releasesFile = releasesPath();
  const last = readReleases(releasesFile)[t];
  const stage = addonStageDir(t);

  const dirty = dirtyCheckout();
  if (dirty !== "") {
    const list = dirty.split("\n").slice(0, 10).join("\n");
    if (release) {
      throw new AddonError(
        `the MathViz checkout has uncommitted changes — a release must be reproducible from a commit:\n${list}`,
      );
    }
    console.warn(
      "warning: the MathViz checkout has uncommitted changes; this payload's provenance says clean: " +
        `false, and record:addon refuses such a package (release with --release):\n${list}`,
    );
  }
  const sha = headSha(MATHVIZ);

  const tmp = mkdtempSync(join(tmpdir(), "mathviz-addon-"));
  try {
    await extract(loadTarget(t), MATHVIZ, tmp, { requireClean: release });
    const payloadDir = join(tmp, "payload");
    const digest = digestOf(readTree(payloadDir), payloadDir);
    const p = digest.provenance;
    if (p.target !== t || p.sha !== sha || p.clean !== (dirty === "")) {
      throw new AddonError(
        `provenance.json says target ${p.target}, MathViz ${p.sha}, clean ${p.clean}; expected ` +
          `${t}, ${sha}, clean ${dirty === ""}`,
      );
    }
    const changes = diffFiles(last?.files, digest.files);
    const { unchanged, version } = decideVersion(last, digest.fingerprint);

    console.log(`target        ${t} (${addonIdOf(app.id)})`);
    console.log(`MathViz       ${sha}${dirty === "" ? "" : " (uncommitted changes)"}`);
    console.log(`fingerprint   ${digest.fingerprint}`);
    console.log(
      `payload       ${digest.files.length} content files + provenance.json, ${digest.bytes} bytes`,
    );
    console.log(
      `last release  ${last ? `${last.version} (${last.fingerprint}, MathViz ${last.sha})` : "none"}`,
    );
    console.log(
      `changed       ${changes.length} content file(s) since ${last ? last.version : "nothing (a first release)"}`,
    );
    if (last) for (const c of changes) console.log(c);

    if (unchanged) {
      console.log(`unchanged since ${version}: nothing to release`);
      if (status) return 2;
      if (release) {
        clearStage(stage); // so a pf pack after this packs nothing
        return 2;
      }
    } else {
      console.log(`next version ${version}`);
    }
    // minAppVersion is the target app's current version (design §8); say so whenever it moves.
    const minAppVersion = app.version;
    console.log(`minAppVersion ${minAppVersion}`);
    if (!unchanged && last?.minAppVersion !== minAppVersion) {
      console.log(
        `warning: this pack requires ${app.id} ${minAppVersion} or newer` +
          (last ? ` (the last release required ${last.minAppVersion ?? "nothing recorded"})` : "") +
          ". Publish that app version first — otherwise nobody can install this pack.",
      );
    }
    if (status) return 0;

    const addon = addonManifestFor({
      appId: app.id,
      appName: app.name,
      version,
      minAppVersion,
      unpackedBytes: digest.bytes,
    });
    const file = join(packagesDir(t), packageFileName(version));
    if (existsSync(file)) {
      const packed = readPackedAddon(file);
      const same =
        packed.digest.fingerprint === digest.fingerprint && sameAddon(packed.manifest, addon);
      if (same) {
        writeStage(stage, packed.addonText, packed.payload);
        console.log(`${file} already holds exactly this pack: the stage is its own bytes`);
      } else {
        const why =
          `${file} already holds ${packed.manifest.id} ${packed.manifest.version} with fingerprint ` +
          `${packed.digest.fingerprint}, and this payload is ${digest.fingerprint}. If that package ` +
          `was published, record it first (bun run record:addon -- ${file}) and build again for ` +
          `${nextVersion(version)}; if it never was, delete it and its .sig, then build again.`;
        if (release) throw new AddonError(why);
        console.warn(`warning: ${why}`);
        writeStage(stage, addonJsonText(addon), payloadDir);
      }
    } else {
      writeStage(stage, addonJsonText(addon), payloadDir);
    }

    console.log(`\n${stage}: ${addon.id} ${version}`);
    if (unchanged) {
      console.log(
        `This is ${version} again, for pf dev. It is already released: do not pack and publish it.`,
      );
    } else if (release) {
      if (dirtyCheckout() !== "") {
        throw new AddonError("the build left uncommitted changes in the MathViz checkout");
      }
      console.log(`Next, from ${contentProjectDir(t)}:`);
      console.log(`  pf pack                      # → ${file}`);
      console.log(`  pf publish ${file}`);
      console.log("Then, once the store has it live, record the release and commit the record:");
      console.log(`  (cd ${PFAPP} && bun run record:addon -- ${file})`);
      console.log(
        `  git add pfapp/content/releases.json && git commit -m "content(${t}): ${version} published"`,
      );
    } else {
      console.log(
        `For pf dev. A release is built from a clean checkout: bun run stage:addon -- --target ${t} --release`,
      );
    }
    return 0;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
