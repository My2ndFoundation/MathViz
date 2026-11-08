import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  createReadStream,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { HttpError } from "../http/errors";

/**
 * Files the app hands the student to save: a video from the recorder, a tool page's own export.
 * PrimeForge's window saves only an `<a download>` that points at a same-origin URL that answers a
 * plain GET — a `blob:` or `data:` download is refused (design §5.3) — so the page uploads the
 * bytes here first and then downloads them back from `/api/exports/<id>`.
 *
 * In `<dataDir>/exports/`: `<id>.json` (name, type, size) and `<id>.bin` (the bytes so far). The
 * upload is chunked (EXPORT_CHUNK_LIMIT each, lib/http/body) because a 4K recording is larger than
 * the proxy buffers; each chunk names its offset, which must be the bytes received so far, so a
 * chunk sent twice or out of order is refused rather than corrupting the file. A file can be
 * downloaded only once it is complete. Everything older than a day is removed when the next export
 * starts: the student saved it long ago, or never will.
 */

export const EXPORT_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const KEEP_MS = 24 * 60 * 60 * 1000;
const ID = /^[0-9a-f]{32}$/;

/** What may be handed over, by extension: what the recorder and the tool pages write. */
const TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  json: "application/json",
  csv: "text/csv",
  txt: "text/plain",
  pgn: "application/x-chess-pgn",
  png: "image/png",
  svg: "image/svg+xml",
};

interface Meta {
  name: string;
  type: string;
  size: number;
  created: number;
}

const dirOf = (dataDir: string) => path.join(dataDir, "exports");

/** A file name safe on every platform, keeping its extension; null when the extension is not allowed. */
export function safeName(raw: unknown): { name: string; type: string } | null {
  if (typeof raw !== "string") return null;
  const base = raw.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  const type = TYPES[ext];
  if (!type) return null;
  const stem =
    base
      .slice(0, dot)
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^[-.]+|-+$/g, "")
      .slice(0, 120) || "export";
  return { name: `${stem}.${ext}`, type };
}

function prune(dir: string, now: number): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const n of names) {
    const f = path.join(dir, n);
    try {
      if (now - statSync(f).mtimeMs > KEEP_MS) rmSync(f, { force: true });
    } catch {
      // gone already
    }
  }
}

function readMeta(dataDir: string, id: string): Meta {
  if (!ID.test(id)) throw new HttpError(404, "not_found");
  try {
    return JSON.parse(readFileSync(path.join(dirOf(dataDir), `${id}.json`), "utf8")) as Meta;
  } catch {
    throw new HttpError(404, "not_found");
  }
}

function received(dataDir: string, id: string): number {
  try {
    return statSync(path.join(dirOf(dataDir), `${id}.bin`)).size;
  } catch {
    return 0;
  }
}

/** Start an export of `size` bytes called `name`. */
export function createExport(
  dataDir: string,
  input: { name: unknown; size: unknown },
  now: number = Date.now(),
): { id: string; name: string } {
  const safe = safeName(input.name);
  if (!safe) throw new HttpError(400, "bad_name");
  const size = input.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0 || size > EXPORT_MAX_BYTES) {
    throw new HttpError(400, "bad_size");
  }
  const dir = dirOf(dataDir);
  mkdirSync(dir, { recursive: true });
  prune(dir, now);
  const id = randomBytes(16).toString("hex");
  const meta: Meta = { name: safe.name, type: safe.type, size, created: now };
  writeFileSync(path.join(dir, `${id}.bin`), new Uint8Array(0));
  writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(meta));
  return { id, name: safe.name };
}

/** Append one chunk at `offset` (the bytes received so far). */
export function appendExport(
  dataDir: string,
  id: string,
  offset: number,
  bytes: Uint8Array,
): { received: number; complete: boolean } {
  const meta = readMeta(dataDir, id);
  const have = received(dataDir, id);
  if (!Number.isInteger(offset) || offset !== have) throw new HttpError(409, "bad_offset");
  if (bytes.byteLength === 0 || have + bytes.byteLength > meta.size) {
    throw new HttpError(400, "bad_size");
  }
  appendFileSync(path.join(dirOf(dataDir), `${id}.bin`), bytes);
  const now = have + bytes.byteLength;
  return { received: now, complete: now === meta.size };
}

/** The finished file, as an attachment. */
export function exportResponse(dataDir: string, id: string): Response {
  const meta = readMeta(dataDir, id);
  if (received(dataDir, id) !== meta.size) throw new HttpError(409, "incomplete");
  const stream = createReadStream(path.join(dirOf(dataDir), `${id}.bin`));
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      "content-type": meta.type,
      "content-length": String(meta.size),
      "content-disposition": `attachment; filename="${meta.name}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
