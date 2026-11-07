import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { loadProgram, type Program } from "../../app/src/lib/ai/context";
import { type Blank, blanksOf, keywordOnly, leakCheck, normalize } from "../../app/src/lib/ai/leak";
import { REDACT_MIN_CHARS } from "../../app/src/lib/content/index-builder";
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

/**
 * A python program from `payload`, chosen by the shape the anti-leak tests need rather than by id
 * (design §9: a legitimate content change on the web must not turn pfapp's tests red):
 *  - a tool, an English title and English notes;
 *  - two or more blanks, each with a hint, and each with a lineNote anchored on one of its answer
 *    lines;
 *  - every answer line long enough to be redacted from prose (REDACT_MIN_CHARS) and not a bare
 *    keyword line (those match whole reply lines only);
 *  - no answer line shared between blanks, and none occurring anywhere outside its blank's body
 *    (so "hidden" can be asserted as "absent from what the agent was handed").
 * The first such program by id. Throws when none exists, so a test built on it fails loudly
 * instead of skipping.
 */
export function pickBlankProgram(payload: string): Program {
  const ids = readdirSync(join(payload, "source"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
  for (const id of ids) {
    const p = loadProgram(payload, id);
    if (p && fitsBlankProgram(p)) return p;
  }
  throw new Error(`no python program in ${payload} has the shape pickBlankProgram needs`);
}

export const answerLines = (b: Blank) => b.body.filter((l) => l.trim() !== "");

function fitsBlankProgram(p: Program): boolean {
  if (!p.tool || !p.title?.en || !p.notes?.en?.length) return false;
  const blanks = blanksOf(p.source);
  if (blanks.length < 2) return false;
  const ats = new Set((p.lineNotes ?? []).map((n) => n.at));
  const seen = new Set<string>();
  for (const b of blanks) {
    const lines = answerLines(b);
    if (lines.length === 0 || !b.hint.zh) return false;
    if (!lines.some((l) => ats.has(l))) return false;
    for (const l of lines) {
      const t = l.trim();
      if ([...t].length < REDACT_MIN_CHARS || keywordOnly(normalize(t)) || seen.has(t))
        return false;
      seen.add(t);
    }
  }
  const src = p.source.split("\n");
  const inBody = new Set<number>();
  for (const b of blanks) for (let i = b.open + 1; i < b.close; i++) inBody.add(i);
  const outside = src.filter((_, i) => !inBody.has(i)).join("\n");
  return ![...seen].some((t) => outside.includes(t));
}

/**
 * A blank (and its program) whose zh hint has a tier that spells out the blank's own answer
 * (leakCheck) and a tier that does not: what HINT_WITHHELD exists for. The first by program id;
 * throws when none exists.
 */
export function pickSelfRevealingHint(payload: string): { program: Program; blank: Blank } {
  const ids = readdirSync(join(payload, "source"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
  for (const id of ids) {
    const p = loadProgram(payload, id);
    if (!p) continue;
    for (const b of blanksOf(p.source)) {
      const own = answerLines(b).map(normalize);
      const tiers = (b.hint.zh ?? "").split(" || ").filter((t) => t !== "");
      if (own.length === 0 || tiers.length < 2) continue;
      const leaks = tiers.map((t) => leakCheck(t, own) !== null);
      if (leaks.includes(true) && leaks.includes(false)) return { program: p, blank: b };
    }
  }
  throw new Error(`no blank in ${payload} has a hint tier that contains its own answer`);
}
