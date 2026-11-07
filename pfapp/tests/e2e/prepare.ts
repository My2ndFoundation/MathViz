/**
 * The e2e fixtures, made under Bun (the extractor and the content helpers use Bun APIs; Playwright
 * runs its setup under Node and calls this as a subprocess):
 *
 *   bun tests/e2e/prepare.ts pack                     → {payload, catalog, pfaddon, version} (JSON)
 *   bun tests/e2e/prepare.ts install <pfaddon> <dir>  → imports it as a manual import into <dir>
 *   bun tests/e2e/prepare.ts store <pfaddon> <dir>    → unpacks it as <dir>/content/{addon.json,
 *                                                       payload/}: the development store's offer
 *                                                       (MATHVIZ_FAKE_ADDONS_DIR, lib/addons/fake)
 *
 * The python pack is extracted from this checkout with requireClean: false, so a dirty working
 * tree can still run the tests.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { importAddonFile } from "../../app/src/lib/content/manual-import";
import { unpackContentAddon } from "../../app/src/lib/content/pfaddon";
import { loadTarget } from "../../app/src/lib/target";
import { buildPfaddon, extractPayload } from "../helpers/content-fixtures";

const PY = loadTarget("python");
const E2E_VERSION = "1.0.0";

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "pack") {
  const payload = await extractPayload("python");
  const pfaddon = buildPfaddon(payload, PY.appId, E2E_VERSION);
  console.log(
    JSON.stringify({
      payload,
      catalog: join(payload, "catalog.json"),
      pfaddon,
      version: E2E_VERSION,
    }),
  );
} else if (cmd === "install" && a && b) {
  console.log(JSON.stringify({ version: await importAddonFile(a, b, PY.appId) }));
} else if (cmd === "store" && a && b) {
  const { addon, manifestText, payload } = unpackContentAddon(readFileSync(a), PY.appId);
  const root = join(b, "content");
  mkdirSync(join(root, "payload"), { recursive: true });
  writeFileSync(join(root, "addon.json"), manifestText);
  for (const [rel, data] of payload) {
    const dest = join(root, "payload", rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
  }
  console.log(JSON.stringify({ version: addon.version }));
} else {
  console.error(
    "usage: bun tests/e2e/prepare.ts pack | install <pfaddon> <dataDir> | store <pfaddon> <dir>",
  );
  process.exit(2);
}
