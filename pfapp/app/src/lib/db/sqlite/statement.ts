// Copied from MathTestBuddy trainer/src/lib/db/sqlite/statement.ts (commit d2ff986). Changes: no
// `import "server-only"` (pfapp has no such package and bun test has no stub for it).
/**
 * Single-statement guard, ported from Live Studio Lab (ADR-057). Stricter than the old driver, not
 * a match for it: node:sqlite, bun:sqlite and @libsql/client 0.18 all run only the first statement
 * of a string and silently drop the rest. Migration files are split on `--> statement-breakpoint`
 * and run piece by piece, so a hand-written migration missing a breakpoint would run only half way
 * without an error. Now a multi-statement string is refused before it runs.
 *
 * The rule is ported from SQLite's `sqlite3_complete()` (src/complete.c): the same token classes and
 * state-transition table, so the semicolons in `CREATE TRIGGER … BEGIN …; …; END;` do not end the
 * statement. Semicolons inside strings, quoted identifiers and comments do not count either.
 */

const Tok = {
  Semi: 0,
  Ws: 1,
  Other: 2,
  Explain: 3,
  Create: 4,
  Temp: 5,
  Trigger: 6,
  End: 7,
} as const;
type Tok = (typeof Tok)[keyof typeof Tok];

// complete.c's trans[8][8]: rows are the current state, columns the token. State 1 = a complete statement has just ended (or none has begun).
const TRANS: readonly (readonly number[])[] = [
  /* 0 INVALID */ [1, 0, 2, 3, 4, 2, 2, 2],
  /* 1 START   */ [1, 1, 2, 3, 4, 2, 2, 2],
  /* 2 NORMAL  */ [1, 2, 2, 2, 2, 2, 2, 2],
  /* 3 EXPLAIN */ [1, 3, 3, 2, 4, 2, 2, 2],
  /* 4 CREATE  */ [1, 4, 2, 2, 2, 4, 5, 2],
  /* 5 TRIGGER */ [6, 5, 5, 5, 5, 5, 5, 5],
  /* 6 SEMI    */ [6, 6, 5, 5, 5, 5, 5, 7],
  /* 7 END     */ [1, 7, 5, 5, 5, 5, 5, 5],
];

const isIdChar = (c: string): boolean => /[A-Za-z0-9_$]/.test(c) || c.charCodeAt(0) >= 0x80;

function keyword(word: string): Tok {
  switch (word.toLowerCase()) {
    case "create":
      return Tok.Create;
    case "trigger":
      return Tok.Trigger;
    case "temp":
    case "temporary":
      return Tok.Temp;
    case "end":
      return Tok.End;
    case "explain":
      return Tok.Explain;
    default:
      return Tok.Other;
  }
}

/** Yields tokens one by one; an unterminated comment or string runs to the end (prepare reports the syntax error itself). */
function* tokens(sql: string): Generator<Tok> {
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i] as string;
    if (c === ";") {
      i++;
      yield Tok.Semi;
    } else if (c === " " || c === "\r" || c === "\t" || c === "\n" || c === "\f") {
      i++;
      yield Tok.Ws;
    } else if (c === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      yield Tok.Ws;
    } else if (c === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i + 2);
      i = nl === -1 ? n : nl + 1;
      yield Tok.Ws;
    } else if (c === "[") {
      const end = sql.indexOf("]", i + 1);
      i = end === -1 ? n : end + 1;
      yield Tok.Other;
    } else if (c === "`" || c === '"' || c === "'") {
      // A doubled-quote escape ('it''s') reads as two adjacent strings; the result is Other either way.
      const end = sql.indexOf(c, i + 1);
      i = end === -1 ? n : end + 1;
      yield Tok.Other;
    } else if (isIdChar(c)) {
      let j = i + 1;
      while (j < n && isIdChar(sql[j] as string)) j++;
      const word = sql.slice(i, j);
      i = j;
      yield keyword(word);
    } else {
      i++;
      yield Tok.Other;
    }
  }
}

/** How many statements the string holds: 0, 1, or 2 (meaning "more than one"). A final statement without a semicolon counts. */
export function countStatements(sql: string): 0 | 1 | 2 {
  let state = 0;
  let count = 0;
  let open = false; // the current statement has had a non-whitespace token
  for (const tok of tokens(sql)) {
    const next = TRANS[state]?.[tok] ?? 2;
    if (tok !== Tok.Semi && tok !== Tok.Ws && !open) {
      open = true;
      count++;
      if (count > 1) return 2;
    }
    if (next === 1) open = false;
    state = next;
  }
  return count as 0 | 1;
}

const verdicts = new Map<string, 0 | 1 | 2>();

/**
 * Empty and multi-statement strings throw RangeError (wording from better-sqlite3). The verdict is
 * cached by SQL text: drizzle generates a limited set of shapes, and parameters are not in the text.
 */
export function assertSingleStatement(sql: string): void {
  let verdict = verdicts.get(sql);
  if (verdict === undefined) {
    verdict = countStatements(sql);
    if (verdicts.size >= 2000) verdicts.clear();
    verdicts.set(sql, verdict);
  }
  if (verdict === 0) throw new RangeError("The supplied SQL string contains no statements");
  if (verdict === 2)
    throw new RangeError("The supplied SQL string contains more than one statement");
}
