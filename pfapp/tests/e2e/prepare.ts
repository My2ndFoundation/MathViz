/**
 * The e2e fixtures, made under Bun (the extractor and the content helpers use Bun APIs; Playwright
 * runs its setup under Node and calls this as a subprocess):
 *
 *   bun tests/e2e/prepare.ts pack                     → {payload, catalog, pfaddon, version} (JSON)
 *   bun tests/e2e/prepare.ts install <pfaddon> <dir>  → imports it as a manual import into <dir>
 *
 * The python pack is extracted from this checkout with requireClean: false, so a dirty working
 * tree can still run the tests.
 */
import { join } from "node:path";
import { importAddonFile } from "../../app/src/lib/content/manual-import";
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
} else {
  console.error("usage: bun tests/e2e/prepare.ts pack | install <pfaddon> <dataDir>");
  process.exit(2);
}
