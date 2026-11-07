// Ported from MathTestBuddy trainer/src/proxy.ts (commit c7df343). Kept: the order — browser
// guards (the MCP surface only Host and Origin) → pages answer GET and HEAD only → a declared body
// over the limit is refused (413) → pages get their CSP; never sets Access-Control-Allow-Origin.
// Dropped: the startup-failure page, the locale rewrite (the language is a setting, not a URL
// segment). Added: /c/… is left to its route, which sets the tool pages' own CSP.
import { type NextRequest, NextResponse } from "next/server";
import { bodyLimitFor } from "@/lib/http/body";
import { shellCsp } from "@/lib/http/csp";
import { errorResponse } from "@/lib/http/errors";
import { check, effectivePort, isMcpPath, processCsrfToken } from "@/lib/http/guard";
import { loadTarget } from "@/lib/target";

/**
 * Request entry (Next 16 proxy, Node runtime, every path). The route handlers run the same guard
 * again (lib/http/route), so this is the first line, not the only one.
 */
export function proxy(request: NextRequest): Response | undefined {
  const { pathname } = request.nextUrl;
  const refusal = check(
    { method: request.method, header: (n) => request.headers.get(n) },
    {
      port: effectivePort(process.env, loadTarget().port),
      csrfToken: processCsrfToken(),
      mcp: isMcpPath(pathname),
    },
  );
  if (refusal) return errorResponse(refusal.status, refusal.code);

  const api = pathname === "/api" || pathname.startsWith("/api/");
  if (!api && request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse(405, "method_not_allowed");
  }
  if (api && Number(request.headers.get("content-length")) > bodyLimitFor(pathname)) {
    return errorResponse(413, "body_too_large");
  }
  // the API answers JSON; /c/… sets the tool pages' CSP itself (a shell CSP here would replace it)
  if (api || pathname.startsWith("/_next/") || pathname.startsWith("/c/")) return undefined;
  const res = NextResponse.next();
  res.headers.set("content-security-policy", shellCsp());
  return res;
}
