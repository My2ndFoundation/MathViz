import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { loadTarget, type TargetId } from "../../app/src/lib/target";
import { extract } from "../../extract/index";

/**
 * Content-pack fixtures shared by the unit and integration tests: a real payload extracted from this
 * checkout, and `.pfaddon` files built from it (optionally with hostile extra entries). Every count a
 * test expects is derived from the payload, never hard-coded.
 */

/** The MathViz checkout the payload is extracted from. */
export const MV = resolve(process.env.MATHVIZ_PATH ?? join(import.meta.dir, "../../.."));

export const tmp = (tag: string) => mkdtempSync(join(tmpdir(), `pfapp-content-${tag}-`));

/** Extract `id`'s payload from this checkout; returns the payload directory. */
export async function extractPayload(id: TargetId): Promise<string> {
  const out = tmp("payload");
  await extract(loadTarget(id), MV, out, { requireClean: false });
  return join(out, "payload");
}

export const addonJson = (appId: string, version: string, over: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: 1,
    id: `${appId}/content`,
    appId,
    version,
    kind: "content",
    title: "MathViz content",
    unpackedBytes: 1024 * 1024 * 1024,
    ...over,
  });

/** A raw ustar header: no path checks, any typeflag (so tests can build hostile archives). */
export function header(path: string, size: number, type: string, link = ""): Buffer {
  const h = Buffer.alloc(512);
  h.write(path, 0, 100, "utf8");
  h.write("0000644\0", 100, 8, "latin1");
  h.write("0000000\0", 108, 8, "latin1");
  h.write("0000000\0", 116, 8, "latin1");
  h.write(`${size.toString(8).padStart(11, "0")}\0`, 124, 12, "latin1");
  h.write("00000000000\0", 136, 12, "latin1");
  h.write(type, 156, 1, "latin1");
  h.write(link, 157, 100, "utf8");
  h.write("ustar\0", 257, 6, "latin1");
  h.write("00", 263, 2, "latin1");
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : (h[i] as number);
  h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "latin1");
  return h;
}

export type Entry = { path: string; data?: Buffer; type?: string; link?: string };

export function tarOf(entries: Entry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const data = e.data ?? Buffer.alloc(0);
    blocks.push(header(e.path, data.length, e.type ?? (e.data ? "0" : "5"), e.link));
    if (data.length) {
      const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
      data.copy(padded);
      blocks.push(padded);
    }
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

/** Payload-relative paths under dir, directories with a trailing slash, sorted. */
export function walk(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(`${rel}/`, ...walk(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}

/** `payload` as a .pfaddon of `appId`'s content pack, plus optional extra (hostile) entries. */
export function buildPfaddon(
  payload: string,
  appId: string,
  version: string,
  over: Record<string, unknown> = {},
  extra: Entry[] = [],
): string {
  const entries: Entry[] = [
    { path: "addon.json", data: Buffer.from(addonJson(appId, version, over)) },
    { path: "payload/" },
  ];
  for (const rel of walk(payload)) {
    entries.push(
      rel.endsWith("/")
        ? { path: `payload/${rel}` }
        : { path: `payload/${rel}`, data: readFileSync(join(payload, rel)) },
    );
  }
  entries.push(...extra);
  const file = join(tmp("pfaddon"), `content-${version}.pfaddon`);
  writeFileSync(file, gzipSync(tarOf(entries)));
  return file;
}
