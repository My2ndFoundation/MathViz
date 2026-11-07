// Ported from MathTestBuddy trainer/src/lib/mcp/route.ts. Kept: the segment syntax check (else 404)
// and the request handed on with its body unread. Changed: the services come from getAppContext,
// and the Host/Origin guard runs here too (as lib/http/route does for every other route), in its MCP
// form — no CSRF, no Sec-Fetch-Site: the bearer stands in for both.
import { errorResponse } from "../http/errors";
import { check } from "../http/guard";
import { type AppContext, getAppContext } from "../server/context";
import { handleMcpRequest } from "./server";

/** The per-job path segment the platform accepts (22–128 of A–Z a–z 0–9 _ -). */
const SEGMENT = /^[A-Za-z0-9_-]{22,128}$/;

/**
 * The MCP route's body (app/api/mcp/[[...path]]/route.ts): `path` is the catch-all — absent for
 * /api/mcp, ["t", <segment>] for a job's own path, anything else 404.
 */
export async function serveMcp(
  req: Request,
  path: readonly string[] | undefined,
): Promise<Response> {
  let app: AppContext;
  try {
    app = await getAppContext();
  } catch {
    return errorResponse(503, "not_ready");
  }
  const refusal = check(
    { method: req.method, header: (n) => req.headers.get(n) },
    { port: app.port, csrfToken: app.csrfToken, mcp: true },
  );
  if (refusal) {
    app.log("http.refused", { code: refusal.code });
    return errorResponse(refusal.status, refusal.code);
  }
  let segment: string | null = null;
  if (path && path.length > 0) {
    if (path.length !== 2 || path[0] !== "t" || !SEGMENT.test(path[1] ?? "")) {
      return errorResponse(404, "not_found");
    }
    segment = path[1] as string;
  }
  return handleMcpRequest(req, {
    db: app.db,
    contentDir: app.content?.dir ?? null,
    mcpToken: app.ai.mcpToken,
    segment,
    platform: app.ai.platform,
  });
}
