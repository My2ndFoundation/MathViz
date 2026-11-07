import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import type { Target, TargetId } from "../app/src/lib/target";

export type Bilingual = { en: string; zh: string };

/**
 * Where each target's group labels live on the web version. The extractor reads them from the
 * navigation page instead of restating them, so a relabel on the web reaches the app on the next
 * extraction. `shape` says whether the literal is a `{n: label}` object or the root `CATS` array.
 */
const SOURCES: Record<TargetId, { page: string; name: string; shape: "object" | "cats" }> = {
  math: { page: "index.html", name: "CATS", shape: "cats" },
  chess: { page: "chess/app.html", name: "PHASE_LABELS", shape: "object" },
  crypto: { page: "cryptography/app.html", name: "CHAPTER_LABELS", shape: "object" },
  python: { page: "python/app.html", name: "MODULE_LABELS", shape: "object" },
};

/**
 * Cut the literal assigned to `var|let|const <name> =` out of `text`: the balanced `{…}` / `[…]`
 * starting after the `=`, skipping strings and comments. Only that literal is evaluated — never
 * the rest of the page script.
 */
export function sliceLiteral(text: string, name: string): string {
  const m = new RegExp(`\\b(?:var|let|const)\\s+${name}\\s*=\\s*`).exec(text);
  if (!m) throw new Error(`literal ${name} not found`);
  const start = m.index + m[0].length;
  const open = text[start];
  if (open !== "{" && open !== "[") throw new Error(`${name} is not an object/array literal`);
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const c = text[i] as string;
    if (c === '"' || c === "'" || c === "`") {
      i++;
      while (i < text.length && text[i] !== c) i += text[i] === "\\" ? 2 : 1;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) break;
      i = end + 1;
    } else if (c === "{" || c === "[") {
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
    i++;
  }
  throw new Error(`unterminated literal ${name}`);
}

function bilingual(v: unknown, where: string): Bilingual {
  const o = v as { en?: unknown; zh?: unknown } | null;
  if (!o || typeof o.en !== "string" || typeof o.zh !== "string" || !o.en || !o.zh) {
    throw new Error(`${where}: expected {en, zh} non-empty strings`);
  }
  return { en: o.en, zh: o.zh };
}

/** Group id (as a string: "1", "trig") → its bilingual label, in the page's own order. */
export function readGroupLabels(target: Target, mvPath: string): Record<string, Bilingual> {
  const src = SOURCES[target.id];
  const text = readFileSync(join(mvPath, src.page), "utf8");
  // A bare context with no globals: the literal is data, and a data literal needs none.
  const value: unknown = runInNewContext(`(${sliceLiteral(text, src.name)})`, Object.create(null), {
    timeout: 1000,
  });
  const out: Record<string, Bilingual> = {};
  if (src.shape === "cats") {
    if (!Array.isArray(value)) throw new Error(`${src.name} is not an array`);
    for (const c of value as { key?: unknown; label?: unknown }[]) {
      if (typeof c.key !== "string" || !c.key) throw new Error(`${src.name}: entry without key`);
      out[c.key] = bilingual(c.label, `${src.name}.${c.key}`);
    }
  } else {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = bilingual(v, `${src.name}.${k}`);
    }
  }
  if (Object.keys(out).length === 0) throw new Error(`${src.name} is empty`);
  return out;
}
