// Ported from MathTestBuddy trainer/src/lib/http/errors.ts (commit c7df343). Kept: HttpError,
// the {error: {code, message: 'error.<code>'}} body, jsonResponse/errorResponse, recognising
// errors by name and shape rather than instanceof. Dropped: MTB's data-layer and pack codes; the
// only data-layer code here is the database's read_only.

/**
 * The HTTP error type and the JSON error body. Error bodies are {error: {code, message}} with
 * message = the UI string key 'error.<code>' (lib/i18n/messages → error).
 *
 * The proxy imports this file too. Errors are recognised by name and shape, not instanceof — Next
 * may bundle a module once per entry (the proxy, each route).
 */

export class HttpError extends Error {
  override readonly name = "HttpError";
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`HTTP ${status} ${code}`);
  }
}

export const errorBody = (code: string) => ({ error: { code, message: `error.${code}` } });

/** JSON response. Never sets Access-Control-Allow-Origin. */
export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  // a 204 or 304 may not carry a body: Node's Response throws a TypeError for one
  if (status === 204 || status === 304) {
    return new Response(null, { status, headers: { "cache-control": "no-store", ...headers } });
  }
  return new Response(JSON.stringify(body ?? null), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export const errorResponse = (status: number, code: string) =>
  jsonResponse(status, errorBody(code));

/** Data-layer error codes → HTTP status. */
const STATUS_OF: Record<string, number> = {
  read_only: 409,
};

interface Coded {
  name?: unknown;
  status?: unknown;
  code?: unknown;
}

/** Any thrown value → {status, code}: HttpError as given, data-layer codes, else 500 internal. */
export function mapError(e: unknown): { status: number; code: string } {
  const c = (typeof e === "object" && e !== null ? e : {}) as Coded;
  if (c.name === "HttpError" && typeof c.status === "number" && typeof c.code === "string") {
    return { status: c.status, code: c.code };
  }
  if (typeof c.code === "string" && Object.hasOwn(STATUS_OF, c.code)) {
    return { status: STATUS_OF[c.code] as number, code: c.code };
  }
  return { status: 500, code: "internal" };
}
