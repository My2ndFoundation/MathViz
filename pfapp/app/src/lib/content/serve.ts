import { closeSync, constants, createReadStream, fstatSync, lstatSync, openSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { Db } from "../db/handle";
import type { FoundContent } from "./installed";

/**
 * Opening a tool page of the installed content pack for /c/<ver>/tools/<file> (design §7.3). The
 * name must be a catalog file (`catalog_items.file = 'tools/<file>'`) — the catalog is the allow
 * list, so `..`, absolute paths and stray files in the directory never match — and the file must
 * be a regular file directly in a real `tools/` directory: opened with O_NOFOLLOW and checked on
 * the descriptor, so a link swapped in after the check is not followed either.
 */

export interface ToolFile {
  body: ReadableStream;
  size: number;
}

/** null: not a tool page of this content version. */
export function openToolFile(
  db: Db,
  content: FoundContent | null,
  ver: string,
  file: string,
): ToolFile | null {
  if (!content || ver !== content.version) return null;
  // the belt to the catalog's brace: one plain path segment
  if (!file || file !== path.basename(file) || file.startsWith(".") || file.includes("\\")) {
    return null;
  }
  const rel = `tools/${file}`;
  const row = db.prepare("SELECT 1 AS ok FROM catalog_items WHERE file = ?").get(rel);
  if (!row) return null;

  const dir = path.join(content.dir, "tools");
  try {
    if (!lstatSync(dir).isDirectory()) return null;
  } catch {
    return null;
  }
  let fd: number;
  try {
    fd = openSync(path.join(dir, file), constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    return null; // absent, or a symbolic link (ELOOP)
  }
  const st = fstatSync(fd);
  if (!st.isFile()) {
    closeSync(fd);
    return null;
  }
  // node:stream/web and the DOM lib declare the same ReadableStream twice; the runtime object is one
  const stream = createReadStream("", { fd, autoClose: true });
  return { body: Readable.toWeb(stream) as unknown as ReadableStream, size: st.size };
}
