/**
 * bun run record:addon -- <content-<version>.pfaddon>
 *
 * After `pf publish` made a content pack live: records that release in `content/releases.json`, so
 * the next `stage:addon` decides the next version from it. Reads the version, the target and the
 * fingerprint from the signed package itself (its addon.json and the digest of its payload), never
 * from the working tree. Idempotent — running it again for the same package writes nothing — so it
 * is safe to repeat. Then commit `pfapp/content/releases.json`.
 *
 * pf has no hook after a publish, which is why this is a command of its own; `stage:addon
 * --release` prints it. Run it only after the store accepted the package: a record of a version the
 * store never had would make the next build skip it.
 */
import { resolve } from "node:path";
import { recordPublished, releasesPath } from "./stage-addon";

const args = process.argv.slice(2);
if (args.length !== 1 || args[0]?.startsWith("--")) {
  console.error("usage: bun run record:addon -- <path to content-<version>.pfaddon>");
  process.exit(1);
}
try {
  const file = resolve(args[0] as string);
  const releasesFile = releasesPath();
  const rec = recordPublished(file, releasesFile);
  console.log(
    rec.already
      ? `${rec.target} ${rec.entry.version} was already recorded in ${releasesFile}: nothing written`
      : `recorded ${rec.target} ${rec.entry.version} (fingerprint ${rec.entry.fingerprint}, MathViz ${rec.entry.sha}) in ${releasesFile} — commit it`,
  );
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
