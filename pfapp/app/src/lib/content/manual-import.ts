import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadTarget } from "../target";
import { AddonFileError, MAX_ADDON_BYTES, unpackContentAddon } from "./pfaddon";

/**
 * Manually imported content packs: `<dataDir>/addons-manual/<version>/`, holding `addon.json` and
 * `payload/` — the same shape as one version of a store install (PFD app-installer), so
 * findContent reads both the same way.
 */
export const MANUAL_DIR = "addons-manual";

/**
 * Import a `.pfaddon` (gzip tar): it must be `appId`'s content pack (addon.json `appId` and
 * `id = <appId>/content`), with safe entries only (pfaddon.ts). It is unpacked into a staging
 * directory beside the target and moved into place by rename, so a half-written import is never
 * at `<version>/`; re-importing a version replaces it. Returns the version.
 */
export async function importAddonFile(
  file: string,
  dataDir: string,
  appId: string = loadTarget().appId,
): Promise<string> {
  const st = statSync(file);
  if (!st.isFile()) throw new AddonFileError(`${file} is not a file`);
  if (st.size > MAX_ADDON_BYTES)
    throw new AddonFileError(`the file is over ${MAX_ADDON_BYTES} bytes`);
  const { addon, manifestText, payload } = unpackContentAddon(readFileSync(file), appId);

  const root = path.join(dataDir, MANUAL_DIR);
  mkdirSync(root, { recursive: true });
  const stage = path.join(root, `.import-${randomBytes(6).toString("hex")}`);
  try {
    mkdirSync(path.join(stage, "payload"), { recursive: true });
    writeFileSync(path.join(stage, "addon.json"), manifestText);
    const base = path.join(stage, "payload");
    for (const [rel, data] of payload) {
      // readTar already refused absolute and `..` paths; this is the belt to that brace
      const dest = path.resolve(base, rel);
      if (!dest.startsWith(base + path.sep)) throw new AddonFileError(`unsafe entry path: ${rel}`);
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, data);
    }
    const target = path.join(root, addon.version);
    const aside = path.join(root, `.old-${randomBytes(6).toString("hex")}`);
    let moved = false;
    try {
      renameSync(target, aside);
      moved = true;
    } catch {
      // no earlier import of this version
    }
    try {
      renameSync(stage, target);
    } catch (e) {
      if (moved) renameSync(aside, target);
      throw e;
    }
    if (moved) rmSync(aside, { recursive: true, force: true });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  return addon.version;
}
