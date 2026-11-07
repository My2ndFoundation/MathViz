// Ported from MathTestBuddy trainer/src/lib/http/guard.ts (commit c7df343). Kept: rules 1–5 and
// their order, the CSRF header name, the constant-time compare, effectivePort's
// PRIMEFORGE_PORT → PORT order. Changed: the fallback port is the target's (each of the four apps
// has its own manifest port) instead of MTB's 26452; the per-process token lives on globalThis
// (processCsrfToken), because Next bundles the proxy and each route separately and they must agree.
// Kept since Task 10: the MCP exemption (rules 3 and 4 do not apply to /api/mcp/**, which carries a
// bearer a browser cannot obtain, checked by the MCP route).

/**
 * The browser-surface protections PrimeForge requires of every app with a browser interface.
 * Applied by src/proxy.ts to every request, and again by lib/http/route.ts to every route handler:
 *  1. Host is exactly 127.0.0.1:<port> or localhost:<port> for the EFFECTIVE port (effectivePort:
 *     PRIMEFORGE_PORT, which the user can change; never assume the manifest's). This is the only
 *     rule that stops DNS rebinding: after a rebind the attacker's page is same-origin with itself,
 *     but its Host header names the attacker's domain.
 *  2. Origin, when present, is the same origin as Host (a same-origin fetch may omit it).
 *  3. Writes carry x-primeforge-csrf, obtained from a same-origin GET /api/session-token.
 *  4. Sec-Fetch-Site, when present, is 'same-origin' or 'none' — on every method: a cross-site GET
 *     (a link, an <img>, a foreign page framing /c/…) must not get anything either.
 *  5. No response ever has Access-Control-Allow-Origin (no route sets it; the proxy never does).
 * The MCP surface (/api/mcp, /api/mcp/t/<segment>) is exempt from rules 3 and 4: the platform calls
 * it with a bearer (the MCP secret this app registered), checked by the MCP route.
 *
 * No Node APIs: the proxy imports this file.
 */

export const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const CSRF_HEADER = "x-primeforge-csrf";
/** Sec-Fetch-Site values a request may carry (a request without the header is allowed). */
const SAME_SITE_OK = new Set(["same-origin", "none"]);

/**
 * The port the app is served on: PRIMEFORGE_PORT (PrimeForge starts the app there), else PORT — which
 * `next start` / `next dev` set to the port they actually listen on — else `fallback` (the target's
 * manifest port).
 */
export function effectivePort(env: Record<string, string | undefined>, fallback: number): number {
  for (const v of [env.PRIMEFORGE_PORT, env.PORT]) {
    const n = Number(v);
    if (v && Number.isInteger(n) && n > 0 && n < 65536) return n;
  }
  return fallback;
}

/** A fresh CSRF token (64 hex). */
export function newCsrfToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

const TOKEN_KEY = Symbol.for("mathviz.pfapp.csrfToken");

/** This process's CSRF token: one per process, shared by the proxy and every route bundle. */
export function processCsrfToken(): string {
  const g = globalThis as { [TOKEN_KEY]?: string };
  g[TOKEN_KEY] ??= newCsrfToken();
  return g[TOKEN_KEY];
}

/** Constant time over equal lengths. */
export function tokensMatch(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || !b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type Refusal = { status: 403; code: "bad_host" | "bad_origin" | "cross_site" | "bad_csrf" };

export interface GuardRequest {
  method?: string;
  /** Header lookup by lower-case name; null when absent. */
  header(name: string): string | null;
}

/** null = may proceed. */
export function check(
  req: GuardRequest,
  { port, csrfToken, mcp = false }: { port: number; csrfToken: string | null; mcp?: boolean },
): Refusal | null {
  const host = req.header("host") ?? "";
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
    return { status: 403, code: "bad_host" };
  }
  const origin = req.header("origin");
  if (origin !== null && origin !== `http://${host}`) return { status: 403, code: "bad_origin" };
  if (mcp) return null;
  const site = req.header("sec-fetch-site");
  if (site !== null && !SAME_SITE_OK.has(site)) return { status: 403, code: "cross_site" };
  if (!MUTATING.has(String(req.method ?? "GET").toUpperCase())) return null;
  if (!tokensMatch(req.header(CSRF_HEADER) ?? "", csrfToken)) {
    return { status: 403, code: "bad_csrf" };
  }
  return null;
}

/** Whether a path is the MCP surface (exempt from CSRF and Sec-Fetch-Site; bearer-checked there). */
export const isMcpPath = (p: string) => p === "/api/mcp" || p.startsWith("/api/mcp/");
