import { readJson } from "@/lib/http/body";
import { route } from "@/lib/http/route";
import { createExport } from "@/lib/server/exports";

/** POST /api/exports {name, size} → {id, name}: start a file to save (lib/server/exports.ts). */
export const dynamic = "force-dynamic";

export const POST = route("POST", async (app, { req }) => {
  const body = await readJson(req);
  return { status: 201, body: createExport(app.dataDir, { name: body.name, size: body.size }) };
});
