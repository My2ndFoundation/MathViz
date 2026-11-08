import { readFileSync } from "node:fs";
import path from "node:path";
import type { TargetId } from "../target";

const SEMVER = /^\d+\.\d+\.\d+$/;
let cached: { key: string; version: string | null } | null = null;

/**
 * The running app's own version, read from the manifest it ships with, never a constant: in a
 * package that is `<install dir>/manifest.json` (scripts/build-local.ts stages
 * targets/<target>/manifest.json there, and the entry makes the install dir the cwd), so it is
 * always the installed package's version. From the source tree (the e2e harness starts the entry
 * in pfapp/app, `next dev app` runs in pfapp/) it is targets/<target>/manifest.json. A manifest
 * that names another app, or no readable one, gives null: the top bar then shows no app version.
 */
export function appVersion(
  target: TargetId,
  appId: string,
  cwd: string = process.cwd(),
): string | null {
  const key = `${cwd}\0${target}\0${appId}`;
  if (cached?.key === key) return cached.version;
  let version: string | null = null;
  for (const file of [
    path.join(cwd, "manifest.json"),
    path.join(cwd, "..", "targets", target, "manifest.json"),
    path.join(cwd, "targets", target, "manifest.json"),
  ]) {
    try {
      const m = JSON.parse(readFileSync(file, "utf8")) as { id?: unknown; version?: unknown };
      if (m.id === appId && typeof m.version === "string" && SEMVER.test(m.version)) {
        version = m.version;
        break;
      }
    } catch {
      // not here: the next place
    }
  }
  cached = { key, version };
  return version;
}
