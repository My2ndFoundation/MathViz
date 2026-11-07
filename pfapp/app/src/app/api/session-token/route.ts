import { route } from "@/lib/http/route";

/**
 * GET /api/session-token: the process's CSRF token, for the x-primeforge-csrf header on writes.
 * Only a same-origin page can read it (the guard refuses cross-site requests; no CORS header).
 */
export const dynamic = "force-dynamic";

export const GET = route("GET", (app) => ({ body: { token: app.csrfToken } }));
