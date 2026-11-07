import { BLANK_CLOSE, BLANK_OPEN } from "../content/index-builder";
import type { PyState } from "../py-state";

/**
 * Not leaking a blank's answer (design §7.4, anti-goal 3). What this guards against is an
 * accidental spoiler: read mode shows the whole program and "fill it in" gives the answer away in
 * one click, so a student set on getting the answer cannot be stopped and need not be.
 *
 * The rule: an answer may be touched only when the bridge reports read mode for that very program,
 * or the student has already had that blank filled in (`given`). Everything else — blank or trace
 * mode, another program, no bridge state at all (`null`) — allows nothing.
 *
 * Three layers use this file: the material handed to the agent has the disallowed blanks replaced
 * (context.ts), and `submit_answer` refuses an answer that contains a disallowed answer line
 * (leakCheck) — the only layer that holds against a Codex job, which no tool allow-list binds.
 */

/** One `# >>> BLANK id=… … # <<< BLANK` region of a program's source. */
export interface Blank {
  id: string;
  /** Index (into source.split("\n")) of the `# >>> BLANK` directive line. */
  open: number;
  /** Index of the `# <<< BLANK` line. */
  close: number;
  /** The answer: the lines strictly between the two, verbatim. */
  body: string[];
  /** The directive's `hint` / `hintEn` (tiers split by ` || `), or null. */
  hint: { zh: string | null; en: string | null };
}

const BLANK_ID = /\bid=([^\s"]+)/;
const attr = (line: string, name: string): string | null => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(line);
  return m ? (m[1] as string) : null;
};

/** The blanks of a source, in order. An unclosed blank runs to the end of the source. */
export function blanksOf(source: string): Blank[] {
  const lines = source.split("\n");
  const out: Blank[] = [];
  let cur: Blank | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (BLANK_OPEN.test(line)) {
      if (cur) out.push({ ...cur, close: i });
      const id = BLANK_ID.exec(line)?.[1] ?? `#${out.length + 1}`;
      const hint = { zh: attr(line, "hint"), en: attr(line, "hintEn") };
      cur = { id, open: i, close: -1, body: [], hint };
    } else if (cur && BLANK_CLOSE.test(line)) {
      out.push({ ...cur, close: i });
      cur = null;
    } else if (cur) cur.body.push(line);
  }
  if (cur) out.push({ ...cur, close: lines.length });
  return out;
}

/** The blank ids of `programId` whose answers may be touched, or 'all' (read mode). */
export function allowedBlanks(programId: string, pyState: PyState | null): "all" | Set<string> {
  if (!pyState || pyState.progId !== programId) return new Set();
  if (pyState.mode === "read") return "all";
  return new Set(pyState.given);
}

export const isAllowed = (allowed: "all" | Set<string>, blankId: string) =>
  allowed === "all" || allowed.has(blankId);

/** All Unicode whitespace removed (JS `\s` covers U+3000, NBSP, tabs, line breaks…). */
export const normalize = (s: string) => s.replace(/\s+/gu, "");

/** The answer lines of the blanks `allowed` does not cover, whitespace removed, distinct. */
export function forbiddenAnswerLines(
  program: { source: string },
  allowed: "all" | Set<string>,
): string[] {
  if (allowed === "all") return [];
  const out = new Set<string>();
  for (const b of blanksOf(program.source)) {
    if (allowed.has(b.id)) continue;
    for (const l of b.body) {
      const n = normalize(l);
      if (n !== "") out.add(n);
    }
  }
  return [...out];
}

/**
 * The first forbidden line `text` contains once both have their whitespace removed, else null.
 * No length floor: a one-word answer line (`else:`, `break`) is checked like any other.
 */
export function leakCheck(text: string, forbidden: readonly string[]): string | null {
  const flat = normalize(text);
  for (const f of forbidden) {
    const n = normalize(f);
    if (n !== "" && flat.includes(n)) return f;
  }
  return null;
}
