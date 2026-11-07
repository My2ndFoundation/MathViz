import type { Db, SqlArg } from "../db/handle";

/**
 * Searching the library (design §7.5). The query is split on whitespace and every term must match
 * (AND). Terms of 3+ characters go to `library_fts MATCH` (trigram), each quoted as an fts5 string
 * so user input is never fts5 syntax; shorter terms — 递归, 排序, two-character Chinese terms that
 * trigram cannot see — are `LIKE '%term%'` on the same title/body, `%`/`_`/`\` escaped. The
 * fallback is per term, not per query: a short term inside a trigram query matches nothing useful
 * (Task 5's probe), so it is taken out of the MATCH and applied as a LIKE beside it. With any fts
 * term, rows are ranked by bm25; with LIKE terms only, in index order.
 */

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
}

const MIN_TRIGRAM = 3;
/** trigram counts one token per character position, so this is roughly characters. */
const SNIPPET_TOKENS = 48;
const SNIPPET_CHARS = 80;

const quoteFts = (term: string) => `"${term.replace(/"/g, '""')}"`;
const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Up to SNIPPET_CHARS around the first case-insensitive hit of any term in body. */
function likeSnippet(body: string, terms: readonly string[]): string {
  const lower = body.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t.toLowerCase());
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  const flat = (s: string) => s.replace(/\s+/g, " ").trim();
  if (at === -1) return flat(body.slice(0, SNIPPET_CHARS));
  const start = Math.max(0, at - SNIPPET_CHARS / 2);
  const end = Math.min(body.length, start + SNIPPET_CHARS);
  return `${start > 0 ? "…" : ""}${flat(body.slice(start, end))}${end < body.length ? "…" : ""}`;
}

export function searchLibrary(db: Db, q: string, limit = 8): SearchHit[] {
  const terms = q.split(/\s+/).filter((t) => t !== "");
  if (terms.length === 0 || limit <= 0) return [];
  const long = terms.filter((t) => [...t].length >= MIN_TRIGRAM);
  const short = terms.filter((t) => [...t].length < MIN_TRIGRAM);

  const likeSql = short.map(() => "(d.title LIKE ? ESCAPE '\\' OR d.body LIKE ? ESCAPE '\\')");
  const likeArgs: SqlArg[] = short.flatMap((t) => {
    const p = `%${escapeLike(t)}%`;
    return [p, p];
  });

  if (long.length > 0) {
    const where = ["library_fts MATCH ?", ...likeSql].join(" AND ");
    const rows = db
      .prepare(
        `SELECT d.id AS id, d.title AS title, d.body AS body,
                snippet(library_fts, 1, '', '', '…', ${SNIPPET_TOKENS}) AS snip
           FROM library_fts JOIN library_docs d ON d.rowid = library_fts.rowid
          WHERE ${where}
          ORDER BY bm25(library_fts), d.rowid
          LIMIT ?`,
      )
      .all<{ id: string; title: string; body: string; snip: string | null }>(
        long.map(quoteFts).join(" "),
        ...likeArgs,
        limit,
      );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      // a title-only hit gives an empty body snippet: fall back to the start of the body
      snippet: r.snip?.trim() ? r.snip : likeSnippet(r.body, terms),
    }));
  }

  const rows = db
    .prepare(
      `SELECT d.id AS id, d.title AS title, d.body AS body FROM library_docs d
        WHERE ${likeSql.join(" AND ")} ORDER BY d.rowid LIMIT ?`,
    )
    .all<{ id: string; title: string; body: string }>(...likeArgs, limit);
  return rows.map((r) => ({ id: r.id, title: r.title, snippet: likeSnippet(r.body, terms) }));
}
