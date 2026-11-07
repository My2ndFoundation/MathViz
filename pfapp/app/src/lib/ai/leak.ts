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

const ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
});

/**
 * The form both sides are compared in: NFKC (full-width punctuation → ASCII), the five common
 * HTML entities decoded, Markdown backslash escapes undone (`\*` → `*`), then zero-width
 * characters (U+200B–U+200D, U+2060, U+FEFF) and all Unicode whitespace removed. Each of those
 * renders the same for the student, so none may be a way past the check.
 */
export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/&(?:lt|gt|amp|quot|#39);/g, (e) => ENTITIES[e] ?? e)
    .replace(/\\([!-/:-@[-`{-~])/g, "$1")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, "")
    .replace(/\s+/gu, "");

/** Python's keywords (hard, and the soft ones that start a statement). */
const PY_KEYWORDS = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case".split(
    " ",
  ),
);
const PY_KEYWORD_LIST = [...PY_KEYWORDS].sort((a, b) => b.length - a.length);

/**
 * Whether a normalised answer line is only Python keywords and punctuation (`break`, `else:`,
 * `returnNone`): whitespace is gone, so the letters are split back into keywords (any split
 * counts). Such a line is an ordinary word in prose — "use break here" — and is matched against
 * whole reply lines only (controller ruling, Task 10 fix round 1).
 */
export function keywordOnly(normalised: string): boolean {
  if (!/[A-Za-z]/.test(normalised)) return false;
  if (/[0-9\u0080-\uFFFF]/u.test(normalised)) return false;
  const runs = normalised.split(/[^A-Za-z_]+/).filter((r) => r !== "");
  const splits = (w: string): boolean => {
    const ok = new Array<boolean>(w.length + 1).fill(false);
    ok[0] = true;
    for (let i = 0; i < w.length; i++) {
      if (!ok[i]) continue;
      for (const k of PY_KEYWORD_LIST) if (w.startsWith(k, i)) ok[i + k.length] = true;
    }
    return ok[w.length] === true;
  };
  return runs.every(splits);
}

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
 * The first forbidden line `text` gives away, else null; both sides normalised (normalize). A line
 * of only keywords and punctuation (keywordOnly: `break`, `else:`) hits only when some line of the
 * text equals it — with or without a trailing `#` comment; every other line hits as a substring
 * anywhere in the text. No length floor.
 */
export function leakCheck(text: string, forbidden: readonly string[]): string | null {
  const flat = normalize(text);
  let lines: Set<string> | null = null;
  for (const f of forbidden) {
    const n = normalize(f);
    if (n === "") continue;
    if (keywordOnly(n)) {
      lines ??= new Set(
        text.split(/\r?\n/).flatMap((l) => {
          const a = normalize(l);
          return [a, a.split("#")[0] as string];
        }),
      );
      if (lines.has(n)) return f;
    } else if (flat.includes(n)) return f;
  }
  return null;
}
