import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { AddonError, type AddonsClient } from "../addons/client";
import { MANUAL_DIR } from "./manual-import";
import { contentAddonId, parseContentManifest } from "./pfaddon";

/**
 * Finding the content pack to run on (design §7.1 step 2). Two sources:
 *
 * - **store**: what PrimeForge's `GET /addons/v1/installed` reports — installed *and usable*
 *   (entitled) add-ons, each with the absolute `path` of its current version's `payload/`. The
 *   platform lays these out as `PRIMEFORGE_ADDONS_DIR/<slug>/<version>/payload/` (PFD
 *   app-installer/src/addon.ts; PRIMEFORGE_ADDONS_DIR is already `<addonsRoot>/<appId>`), but the
 *   directory is never scanned: only the API knows which installs are entitled, so a scan would
 *   resurrect a refunded pack. PRIMEFORGE_ADDONS_DIR is the containment root a reported path must
 *   sit inside (MTB's placeProblem).
 * - **manual**: `<DATA_DIR>/addons-manual/<version>/{addon.json,payload/}` (manual-import.ts).
 *
 * The highest version wins; on a tie the store copy (signed, verified by the platform) does.
 */

export interface ContentEnv {
  appId: string;
  /** PRIMEFORGE_DATA_DIR (or the development data dir). */
  dataDir: string;
  /** PRIMEFORGE_ADDONS_DIR, when the platform names it. */
  addonsDir?: string | null;
  /** null outside PrimeForge (development): no store packs. */
  addons: Pick<AddonsClient, "installed"> | null;
  log?: (event: string, fields?: Record<string, unknown>) => void;
}

export interface FoundContent {
  /** Absolute path of the payload directory (catalog.json, tools/, source/, provenance.json). */
  dir: string;
  version: string;
  source: "store" | "manual";
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** MAJOR.MINOR.PATCH comparison; both must match SEMVER. */
export function compareVersions(a: string, b: string): number {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] as number) - (y[i] as number);
    if (d !== 0) return d;
  }
  return 0;
}

const isRealDir = (p: string): boolean => {
  try {
    return lstatSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** A regular file, not a symbolic link (PFD's installer reads its own files the same way). */
export const isRegularFile = (p: string): boolean => {
  try {
    return lstatSync(p).isFile();
  } catch {
    return false;
  }
};

/**
 * Why a payload directory is unusable, or null. `root` is the directory the payload must sit in;
 * null means none is required (the manual copy, which this app wrote itself).
 */
function placeProblem(dir: string, root: string | null): string | null {
  if (!path.isAbsolute(dir)) return "the payload path is not absolute";
  if (!isRealDir(dir)) return "the payload is not a directory (or is a symbolic link)";
  if (root !== null) {
    try {
      const r = realpathSync(root);
      const real = realpathSync(dir);
      if (real !== r && !real.startsWith(r + path.sep)) {
        return "the payload is outside the add-ons directory";
      }
    } catch {
      return "the add-ons directory is missing";
    }
  }
  if (!isRegularFile(path.join(dir, "catalog.json"))) {
    return "the payload has no catalog.json (or it is a symbolic link)";
  }
  return null;
}

/** Logged once per process: the platform reported store rows but named no add-ons directory. */
let warnedNoRoot = false;

async function storeCandidates(env: ContentEnv): Promise<FoundContent[]> {
  if (!env.addons) return [];
  let rows: Awaited<ReturnType<AddonsClient["installed"]>>;
  try {
    rows = await env.addons.installed();
  } catch (e) {
    // The platform is local, so this is rare; the manual copy (if any) still serves.
    env.log?.("content.installed_failed", { code: e instanceof AddonError ? e.code : "error" });
    return [];
  }
  if (rows === "unsupported" || rows.length === 0) return [];
  // Fail closed: without PRIMEFORGE_ADDONS_DIR there is no root to hold the reported paths to,
  // and an unchecked path would let any directory holding a catalog.json pass as the store pack.
  const root = env.addonsDir?.trim() ? env.addonsDir : null;
  if (root === null) {
    if (!warnedNoRoot) env.log?.("content.store_no_addons_dir", { rows: rows.length });
    warnedNoRoot = true;
    return [];
  }
  const out: FoundContent[] = [];
  for (const a of rows) {
    if (a.addonId !== contentAddonId(env.appId) || !SEMVER.test(a.version)) continue;
    const problem = placeProblem(a.path, root);
    if (problem) {
      env.log?.("content.store_refused", { version: a.version, problem });
      continue;
    }
    out.push({ dir: a.path, version: a.version, source: "store" });
  }
  return out;
}

function manualCandidates(env: ContentEnv): FoundContent[] {
  const root = path.join(env.dataDir, MANUAL_DIR);
  if (!isRealDir(root)) return [];
  const out: FoundContent[] = [];
  for (const name of readdirSync(root)) {
    if (!SEMVER.test(name)) continue; // staging (.import-*) and anything foreign
    const versionDir = path.join(root, name);
    if (!isRealDir(versionDir)) continue;
    try {
      const addonFile = path.join(versionDir, "addon.json");
      if (!lstatSync(addonFile).isFile()) continue;
      const m = parseContentManifest(readFileSync(addonFile, "utf8"), env.appId);
      if (m.version !== name) continue;
    } catch {
      continue;
    }
    const dir = path.join(versionDir, "payload");
    if (placeProblem(dir, null)) continue;
    out.push({ dir, version: name, source: "manual" });
  }
  return out;
}

export async function findContent(env: ContentEnv): Promise<FoundContent | null> {
  const all = [...(await storeCandidates(env)), ...manualCandidates(env)];
  let best: FoundContent | null = null;
  for (const c of all) {
    if (best === null) {
      best = c;
      continue;
    }
    const d = compareVersions(c.version, best.version);
    if (d > 0 || (d === 0 && c.source === "store" && best.source === "manual")) best = c;
  }
  return best;
}
