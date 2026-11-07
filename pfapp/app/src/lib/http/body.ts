// Ported from MathTestBuddy trainer/src/lib/http/body.ts (commit c7df343). Kept: readRaw (declared
// length checked first, then counted while reading), readJson, the 256 KiB JSON limit. Dropped:
// MTB's per-route limits (pack import, photos) until this app has such routes.
import { HttpError } from "./errors";

/** Request bodies: raw bytes with a size limit, and JSON objects. */

export const JSON_LIMIT = 256 * 1024;

/**
 * The body limit of an /api path. The proxy refuses a declared Content-Length over it before Next
 * buffers the body; the route counts the bytes it reads.
 */
export function bodyLimitFor(_pathname: string): number {
  return JSON_LIMIT;
}

/**
 * The whole body; 413 body_too_large past `limit` (checked against Content-Length first, then while
 * reading — a declared length is not trusted).
 */
export async function readRaw(
  req: Pick<Request, "headers" | "body">,
  { limit = JSON_LIMIT }: { limit?: number } = {},
): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new HttpError(413, "body_too_large");
  if (!req.body) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      reader.releaseLock();
      throw new HttpError(413, "body_too_large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** A JSON object body: {} when empty; 400 bad_json when not JSON or not an object. */
export async function readJson(
  req: Pick<Request, "headers" | "body">,
  { limit = JSON_LIMIT }: { limit?: number } = {},
): Promise<Record<string, unknown>> {
  const raw = await readRaw(req, { limit });
  if (!raw.length) return {};
  let v: unknown;
  try {
    v = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new HttpError(400, "bad_json");
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new HttpError(400, "bad_json");
  return v as Record<string, unknown>;
}
