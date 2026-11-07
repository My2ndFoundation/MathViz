// Ported from MathTestBuddy trainer/src/lib/http/route.ts (commit c7df343). Kept: the
// route(method, handler) glue, read-only mode (every write → 409 read_only), {status, body} as
// JSON or the handler's own Response, errors as {error: {code, message}}, logging route prefixes
// and codes only. Changed: the services come from lib/server/context (getAppContext) instead of
// MTB's registry; the browser guard runs here as well as in the proxy (below); no `connection()`
// (Next 16 route handlers are dynamic unless they opt into caching, and each route file says
// `dynamic = "force-dynamic"`), so the handlers can be called directly in tests.
import { type AppContext, getAppContext } from "../server/context";
import { errorResponse, jsonResponse, mapError } from "./errors";
import { check, MUTATING } from "./guard";

/**
 * Route handler glue (src/app/**\/route.ts). The guard (lib/http/guard) runs on every request in
 * src/proxy.ts; it runs again here, against the context's own port and token, so that a route is
 * never reachable unguarded — a proxy matcher that misses a path, or a handler called directly,
 * still gets Host / Origin / Sec-Fetch-Site / CSRF.
 */

type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };

export interface HandlerInput {
  req: Request;
  params: Record<string, string>;
  query: URLSearchParams;
}

export type HandlerResult = Response | { status?: number; body?: unknown };

export type Handler = (
  app: AppContext,
  input: HandlerInput,
) => HandlerResult | Promise<HandlerResult>;

export function route(method: string, handler: Handler) {
  const writes = MUTATING.has(method);
  return async (req: Request, ctx?: RouteContext): Promise<Response> => {
    let app: AppContext;
    try {
      app = await getAppContext();
    } catch {
      return errorResponse(503, "not_ready");
    }
    const refusal = check(
      { method: req.method, header: (n) => req.headers.get(n) },
      { port: app.port, csrfToken: app.csrfToken },
    );
    if (refusal) {
      app.log("http.refused", { code: refusal.code });
      return errorResponse(refusal.status, refusal.code);
    }
    if (writes && app.db.readOnly) return errorResponse(409, "read_only");
    const url = new URL(req.url);
    try {
      const raw = ctx?.params ? await ctx.params : {};
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) if (typeof v === "string") params[k] = v;
      const out = await handler(app, { req, params, query: url.searchParams });
      if (out instanceof Response) return out;
      return jsonResponse(out.status ?? 200, out.body ?? null);
    } catch (e) {
      const { status, code } = mapError(e);
      if (status >= 500) {
        const x = e as { name?: unknown; code?: unknown } | null;
        app.log("http.error", {
          method,
          path: url.pathname.split("/").slice(0, 3).join("/"),
          error: typeof x?.name === "string" ? x.name : "Error",
          code: typeof x?.code === "string" ? x.code : null,
        });
      }
      return errorResponse(status, code);
    }
  };
}
