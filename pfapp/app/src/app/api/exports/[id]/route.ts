import { EXPORT_CHUNK_LIMIT, readRaw } from "@/lib/http/body";
import { route } from "@/lib/http/route";
import { appendExport, exportResponse } from "@/lib/server/exports";

/**
 * POST /api/exports/:id?offset=<n> (raw bytes) → {received, complete}: one chunk.
 * GET /api/exports/:id → the finished file as an attachment (what `<a download>` saves).
 * lib/server/exports.ts.
 */
export const dynamic = "force-dynamic";

export const POST = route("POST", async (app, { req, params, query }) => {
  const bytes = await readRaw(req, { limit: EXPORT_CHUNK_LIMIT });
  const offset = Number(query.get("offset"));
  return { body: appendExport(app.dataDir, params.id ?? "", offset, bytes) };
});

export const GET = route("GET", (app, { params }) => exportResponse(app.dataDir, params.id ?? ""));
