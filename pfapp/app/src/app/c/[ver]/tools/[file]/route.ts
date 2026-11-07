import { openToolFile } from "@/lib/content/serve";
import { TOOL_CACHE_CONTROL, TOOL_CSP } from "@/lib/http/csp";
import { HttpError } from "@/lib/http/errors";
import { route } from "@/lib/http/route";

/**
 * GET /c/<content version>/tools/<file>: a tool page of the installed content pack, for the
 * shell's same-origin iframe (design §7.3). The version in the URL makes every pack upgrade a new
 * URL, so the page may be cached for good. Any other version, or a name not in the catalog: 404.
 */
export const dynamic = "force-dynamic";

export const GET = route("GET", (app, { params }) => {
  const found = openToolFile(app.db, app.content, params.ver ?? "", params.file ?? "");
  if (!found) throw new HttpError(404, "not_found");
  return new Response(found.body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-length": String(found.size),
      "content-security-policy": TOOL_CSP,
      "cache-control": TOOL_CACHE_CONTROL,
      "x-content-type-options": "nosniff",
    },
  });
});
