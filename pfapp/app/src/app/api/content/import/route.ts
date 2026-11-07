import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { importAddonFile, MANUAL_DIR } from "@/lib/content/manual-import";
import { AddonFileError } from "@/lib/content/pfaddon";
import { bodyLimitFor, IMPORT_PATH, readRaw, UPLOAD_FILE_LIMIT } from "@/lib/http/body";
import { HttpError } from "@/lib/http/errors";
import { route } from "@/lib/http/route";
import { firstToolId } from "@/lib/server/catalog";

/**
 * POST /api/content/import (multipart, field `file`, CSRF): the empty state's "import a local
 * content pack". The upload is checked for gzip before anything is unpacked, written to a staging
 * file in the data directory, imported (lib/content/manual-import: appId, safe entries, atomic
 * rename), and the content found again. Answers {version, firstTool}: the version now served and
 * the first catalog item, which the page opens.
 */
export const dynamic = "force-dynamic";

const isGzip = (b: Uint8Array) => b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b;

export const POST = route("POST", async (app, { req }) => {
  const raw = await readRaw(req, { limit: bodyLimitFor(IMPORT_PATH) });
  let form: FormData;
  try {
    form = await new Response(raw as Uint8Array<ArrayBuffer>, {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new HttpError(400, "bad_request");
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) throw new HttpError(400, "bad_request");
  if (file.size > UPLOAD_FILE_LIMIT) throw new HttpError(413, "body_too_large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isGzip(bytes)) throw new HttpError(400, "not_gzip");

  const stage = mkdtempSync(path.join(app.dataDir, ".upload-"));
  let version: string;
  try {
    const f = path.join(stage, "content.pfaddon");
    writeFileSync(f, bytes);
    version = await importAddonFile(f, app.dataDir, app.target.appId);
  } catch (e) {
    if (e instanceof Error && e.name === AddonFileError.name) throw new HttpError(400, "bad_addon");
    throw e;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  app.log("content.imported", { version });
  const found = await app.refreshContent();
  const first = found ? firstToolId(app.db) : null;
  if (!found || !first) {
    // the import is the pack findContent chose, and it would not index: take it out again so it
    // does not stay installed (and shadow an older usable import), then look once more
    rmSync(path.join(app.dataDir, MANUAL_DIR, version), { recursive: true, force: true });
    app.log("content.import_unusable", { version });
    await app.refreshContent();
    throw new HttpError(422, "bad_addon");
  }
  return { body: { version: found.version, firstTool: first } };
});
