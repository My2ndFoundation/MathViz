// Ported from MathTestBuddy trainer/src/lib/content/addon-format.ts (readTar, checkPath) and
// trainer/src/lib/content/addon.ts (unpackAddon, the addon.json schema) at commit 3e01e49. Kept:
// the strict ustar reader (regular files and directories only; no links, devices or extension
// headers; no absolute, `.`, `..`, empty or repeated paths; nothing under a file), the root layout
// (exactly addon.json + payload/), the gzip-trailer size cap checked before inflating, the
// unpackedBytes check. Changed: gunzip is node:zlib (no fflate — no dependency), whose
// maxOutputLength caps the output and which checks the CRC and size itself; the addon.json schema
// takes the expected appId as a parameter (four apps, one codebase) and follows PFD's
// parseAddonManifest (packages/app-contract/src/addon-manifest.ts), `requires` included; errors
// are AddonFileError. Dropped: the writer (the pfapp never packs; PFD's publish:addon does).
import { gunzipSync } from "node:zlib";
import { z } from "zod";

export class AddonFileError extends Error {
  override readonly name = "AddonFileError";
}
const bad = (detail: string) => new AddonFileError(detail);

/** The contract's limits (PFD app-installer / app-contract). */
export const MAX_ADDON_BYTES = 512 * 1024 * 1024;
export const MAX_ADDON_UNPACKED_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_ADDON_ENTRIES = 100_000;
/** What the app unpacks on import: well below the contract's 2 GiB (a content pack is ~15 MB). */
export const MAX_IMPORT_UNPACKED_BYTES = 512 * 1024 * 1024;

export type TarEntry =
  | { path: string; kind: "file"; data: Uint8Array }
  | { path: string; kind: "dir" };

const BLOCK = 512;
const NAME_FIELD = 100;
const PREFIX_FIELD = 155;
const MAX_PATH = 255;
const byteLength = (s: string) => Buffer.byteLength(s, "utf8");

/** Relative, no `.`, `..` or empty segments, no backslash, no drive letter. */
function checkPath(p: string): void {
  if (!p) throw bad("entry path is empty");
  if (byteLength(p) > MAX_PATH) throw bad(`entry path is over ${MAX_PATH} bytes: ${p}`);
  if (p.includes("\\")) throw bad(`backslash in entry path: ${p}`);
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) throw bad(`absolute entry path: ${p}`);
  if (p.split("/").some((s) => s === ".." || s === "." || s === "")) {
    throw bad(`unsafe entry path: ${p}`);
  }
}

function checksum(header: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : (header[i] as number);
  return sum;
}

function readString(b: Uint8Array, at: number, len: number): string {
  const s = b.subarray(at, at + len);
  const nul = s.indexOf(0);
  return Buffer.from(s.subarray(0, nul === -1 ? len : nul)).toString("utf8");
}

function readOctal(b: Uint8Array, at: number, len: number): number {
  const t = readString(b, at, len).trim();
  if (t === "") return 0;
  if (!/^[0-7]+$/.test(t)) throw bad("a numeric header field is not octal");
  return Number.parseInt(t, 8);
}

const TYPE_NAMES: Record<string, string> = {
  "1": "hardlink",
  "2": "symlink",
  "3": "character device",
  "4": "block device",
  "6": "FIFO",
  x: "PAX header",
  g: "PAX global header",
  L: "GNU longname",
  K: "GNU longlink",
};

/** Read a ustar archive strictly (see the header). Throws AddonFileError. */
export function readTar(
  tar: Uint8Array,
  {
    maxEntries = MAX_ADDON_ENTRIES,
    maxBytes = MAX_ADDON_UNPACKED_BYTES,
  }: { maxEntries?: number; maxBytes?: number } = {},
): TarEntry[] {
  const out: TarEntry[] = [];
  const seen = new Set<string>();
  const files = new Set<string>();
  const parents = new Set<string>();
  let offset = 0;
  let total = 0;
  for (;;) {
    if (offset + BLOCK > tar.length) throw bad("the archive ends without its terminator");
    const h = tar.subarray(offset, offset + BLOCK);
    if (h.every((b) => b === 0)) break;
    if (readString(h, 257, 6) !== "ustar") throw bad("not a ustar header");
    if (readOctal(h, 148, 8) !== checksum(h)) throw bad("header checksum mismatch");
    const type = String.fromCharCode(h[156] as number);
    const isFile = type === "0" || type === "\0";
    if (!isFile && type !== "5") {
      throw bad(`refused entry type: ${TYPE_NAMES[type] ?? `typeflag ${JSON.stringify(type)}`}`);
    }
    const prefix = readString(h, 345, PREFIX_FIELD);
    const name = readString(h, 0, NAME_FIELD);
    const p = (prefix ? `${prefix}/${name}` : name).replace(/\/+$/, "");
    checkPath(p);
    if (seen.has(p)) throw bad(`entry appears twice: ${p}`);
    seen.add(p);
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join("/");
      if (files.has(parent)) throw bad(`entry under a file: ${p}`);
      parents.add(parent);
    }
    if (out.length + 1 > maxEntries) throw bad(`more than ${maxEntries} entries`);
    const size = readOctal(h, 124, 12);
    offset += BLOCK;
    if (!isFile) {
      if (size !== 0) throw bad(`directory entry with data: ${p}`);
      out.push({ path: p, kind: "dir" });
      continue;
    }
    if (parents.has(p)) throw bad(`a file where a directory is needed: ${p}`);
    files.add(p);
    total += size;
    if (total > maxBytes) throw bad(`the files hold more than ${maxBytes} bytes`);
    if (offset + size > tar.length) throw bad("entry data runs past the end of the archive");
    out.push({ path: p, kind: "file", data: tar.subarray(offset, offset + size) });
    offset += Math.ceil(size / BLOCK) * BLOCK;
  }
  return out;
}

// ---- addon.json -----------------------------------------------------------------------------------

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ADDON_ID = /^app\.primeforge\.[a-z0-9]+(\.[a-z0-9]+)*\/[a-z0-9]+(-[a-z0-9]+)*$/;

const manifestSchema = z
  .object({
    format: z.literal(1),
    id: z.string().regex(ADDON_ID, "id must be <appId>/<slug>"),
    appId: z.string().regex(/^app\.primeforge\.[a-z0-9]+(\.[a-z0-9]+)*$/),
    version: z.string().regex(SEMVER, "version must be MAJOR.MINOR.PATCH"),
    kind: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9._-]*$/),
    title: z.string().min(1).max(200),
    minAppVersion: z.string().regex(SEMVER).optional(),
    unpackedBytes: z.number().int().min(0).max(MAX_ADDON_UNPACKED_BYTES),
    distribution: z.enum(["any", "restricted-only"]).default("any"),
    requires: z
      .array(z.object({ addon: z.string().regex(ADDON_ID), version: z.string() }))
      .max(16)
      .optional(),
  })
  .refine((m) => m.id.startsWith(`${m.appId}/`), {
    message: "id must start with the appId and a slash",
    path: ["id"],
  });

export type AddonManifest = z.infer<typeof manifestSchema>;

/** The content pack's add-on id for an app (design §6.1). */
export const contentAddonId = (appId: string) => `${appId}/content`;

/**
 * Parse addon.json and hold it to this app's content pack: `appId` must be ours and `id` must be
 * `<appId>/content`. Throws AddonFileError.
 */
export function parseContentManifest(text: string, appId: string): AddonManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw bad("addon.json is not JSON");
  }
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    throw bad(`addon.json: ${i ? `${i.path.join(".") || "addon"}: ${i.message}` : "invalid"}`);
  }
  const m = parsed.data;
  if (m.appId !== appId) throw bad(`addon.json: this pack is for ${m.appId}, not ${appId}`);
  if (m.id !== contentAddonId(appId)) {
    throw bad(`addon.json: ${m.id} is not this app's content pack (${contentAddonId(appId)})`);
  }
  return m;
}

// ---- unpacking -----------------------------------------------------------------------------------

const isGzip = (b: Uint8Array) => b[0] === 0x1f && b[1] === 0x8b;

/**
 * Unpack a .pfaddon: exactly addon.json (a file) and payload/ (a directory) at the root, addon.json
 * this app's content pack, payload/ holding no more than its unpackedBytes. Returns the payload
 * files by path inside payload/. Throws AddonFileError.
 */
export function unpackContentAddon(
  bytes: Uint8Array,
  appId: string,
): { addon: AddonManifest; manifestText: string; payload: Map<string, Uint8Array> } {
  if (bytes.length > MAX_ADDON_BYTES) throw bad(`the file is over ${MAX_ADDON_BYTES} bytes`);
  if (bytes.length < 18 || !isGzip(bytes)) throw bad("not a gzip file");
  // the trailer's ISIZE (size mod 2^32) is a cheap early refusal; maxOutputLength is the real cap
  const size = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 4, 4).getUint32(
    0,
    true,
  );
  if (size > MAX_IMPORT_UNPACKED_BYTES) {
    throw bad(`the archive unpacks to more than ${MAX_IMPORT_UNPACKED_BYTES} bytes`);
  }
  let tar: Uint8Array;
  try {
    tar = gunzipSync(bytes, { maxOutputLength: MAX_IMPORT_UNPACKED_BYTES + 2 * BLOCK });
  } catch (e) {
    throw bad(`does not decompress: ${e instanceof Error ? e.message : String(e)}`);
  }
  const entries = readTar(tar, { maxBytes: MAX_IMPORT_UNPACKED_BYTES });
  const roots = new Set(entries.map((e) => e.path.split("/")[0]));
  const extra = [...roots].filter((r) => r !== "addon.json" && r !== "payload");
  if (extra.length) throw bad(`unexpected root entries: ${extra.join(", ")}`);
  const atAddon = entries.filter((e) => e.path.split("/")[0] === "addon.json");
  const manifest = atAddon[0];
  if (atAddon.length !== 1 || manifest?.kind !== "file") throw bad("no addon.json file");
  if (!roots.has("payload")) throw bad("no payload/ directory");
  if (entries.some((e) => e.path === "payload" && e.kind !== "dir")) {
    throw bad("payload is not a directory");
  }
  const manifestText = Buffer.from(manifest.data).toString("utf8");
  const addon = parseContentManifest(manifestText, appId);
  const payload = new Map<string, Uint8Array>();
  let total = 0;
  for (const e of entries) {
    if (e.kind !== "file" || !e.path.startsWith("payload/")) continue;
    payload.set(e.path.slice("payload/".length), e.data);
    total += e.data.length;
  }
  if (total > addon.unpackedBytes) {
    throw bad(`addon.json says unpackedBytes ${addon.unpackedBytes}, payload/ holds ${total}`);
  }
  if (!payload.has("catalog.json")) throw bad("payload/ has no catalog.json");
  return { addon, manifestText, payload };
}
