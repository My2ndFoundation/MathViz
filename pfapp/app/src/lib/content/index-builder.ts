import { lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Db } from "../db/handle";
import { type FoundContent, isRegularFile } from "./installed";

/**
 * The catalog table and the library index, built from a content pack's payload (design §7.1
 * step 3, §7.5). Rebuilt whole, in one transaction, whenever the pack differs from the one
 * `content_state` records; otherwise left alone.
 *
 * catalog_groups: the pack's `groups` (order and labels); catalog_items.grp refers to them.
 *
 * library_docs (and through its triggers library_fts):
 * - `tool:<id>`    one per catalog item: titles, kicker, desc, tag, group label (zh and en).
 * - `program:<id>` (python) one per `source/<id>.json`: titles, blurb, notes, tags, and the source
 *   with every blanked region removed — answer lines, and the BLANK directive lines that carry the
 *   hints. lineNotes are left out (a note anchored on a blanked line quotes it in `at`, and often
 *   explains it). Then any answer line of any program (REDACT_MIN_CHARS or longer) that still
 *   occurs anywhere — another program's plain code, prose — is replaced by REDACTED. Search
 *   results never give an answer away (design §7.4, anti-goal 3).
 * Math/chess/crypto readable page text arrives in phase 2.
 */

const bilingual = z.object({ en: z.string(), zh: z.string() });

const catalogSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      file: z.string().min(1),
      group: z.string(),
      groupLabel: bilingual,
      order: z.number().int(),
      accent: z.string(),
      version: z.string(),
      title: bilingual,
      kicker: bilingual.optional(),
      desc: bilingual.optional(),
      tag: bilingual.optional(),
    }),
  ),
  /** The web navigation page's group order and labels (absent: first appearance among items). */
  groups: z.array(z.object({ id: z.string().min(1), label: bilingual })).optional(),
});

/** The pack's groups in order; without catalog.groups, the items' own groupLabel, first seen first. */
function groupsOf(catalog: z.infer<typeof catalogSchema>) {
  if (catalog.groups) return catalog.groups;
  const seen = new Map<string, { id: string; label: { en: string; zh: string } }>();
  for (const it of catalog.items) {
    if (!seen.has(it.group)) seen.set(it.group, { id: it.group, label: it.groupLabel });
  }
  return [...seen.values()];
}

const notesSchema = z
  .object({ en: z.array(z.string()).default([]), zh: z.array(z.string()).default([]) })
  .partial();

const sourceSchema = z.object({
  id: z.string().min(1),
  title: bilingual.partial().optional(),
  blurb: bilingual.partial().optional(),
  notes: notesSchema.optional(),
  tags: z.array(z.string()).optional(),
  source: z.string(),
});

const provenanceSchema = z.object({ sha: z.string() }).partial();

export const BLANK_OPEN = /^\s*#\s*>>>\s*BLANK\b/;
export const BLANK_CLOSE = /^\s*#\s*<<<\s*BLANK\s*$/;

/**
 * Prose quoting an answer line this long is redacted from the index (shorter answer lines —
 * `break`, `continue`, `else:` — are ordinary words in prose and cannot be told apart).
 */
export const REDACT_MIN_CHARS = 10;
export const REDACTED = "____";

/** The source without its blanked regions, and the (trimmed, non-empty) answer lines it held. */
export function stripBlanks(source: string): { kept: string; answers: string[] } {
  const kept: string[] = [];
  const answers: string[] = [];
  let inBlank = false;
  for (const line of source.split("\n")) {
    if (BLANK_OPEN.test(line)) {
      inBlank = true;
      continue;
    }
    if (BLANK_CLOSE.test(line)) {
      inBlank = false;
      continue;
    }
    if (inBlank) {
      const t = line.trim();
      if (t !== "") answers.push(t);
    } else kept.push(line);
  }
  return { kept: kept.join("\n"), answers };
}

/**
 * Replace every occurrence of a long-enough answer line. `answers` must be sorted longest first,
 * so a line that contains a shorter answer is replaced whole.
 */
function redact(text: string, answers: readonly string[]): string {
  let out = text;
  for (const a of answers) if (out.includes(a)) out = out.split(a).join(REDACTED);
  return out;
}

const both = (b: { en?: string; zh?: string } | undefined): string[] =>
  b ? [b.en, b.zh].filter((s): s is string => typeof s === "string" && s !== "") : [];

const joinTitle = (b: { en?: string; zh?: string } | undefined, fallback: string): string => {
  const parts = both(b);
  return parts.length ? [...new Set(parts)].join(" · ") : fallback;
};

interface Doc {
  id: string;
  kind: "tool" | "program";
  title: string;
  body: string;
}

/** A payload JSON file; a symbolic link (or anything not a regular file) is refused. */
function readJson(file: string): unknown {
  if (!isRegularFile(file)) {
    throw new Error(`${path.basename(file)} is not a regular file (a symbolic link?): ${file}`);
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Whether anything is at p, a dangling link included (existsSync follows links). */
const present = (p: string): boolean => {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

function buildDocs(dir: string) {
  const catalog = catalogSchema.parse(readJson(path.join(dir, "catalog.json")));
  const docs: Doc[] = catalog.items.map((it) => ({
    id: `tool:${it.id}`,
    kind: "tool",
    title: joinTitle(it.title, it.id),
    body: [...both(it.kicker), ...both(it.desc), ...both(it.tag), ...both(it.groupLabel)].join(
      "\n",
    ),
  }));
  const sourceDir = path.join(dir, "source");
  // Every program's answer lines, redacted from every document — not only from their own program:
  // one program's blank is often another's plain line (128 of 988 long answer lines in the python
  // pack when this was written), and a search for the answer would otherwise find it there.
  const answers = new Set<string>();
  if (present(sourceDir) && !lstatSync(sourceDir).isDirectory()) {
    throw new Error(`source/ is not a directory (a symbolic link?): ${sourceDir}`);
  }
  if (present(sourceDir)) {
    for (const f of readdirSync(sourceDir).sort()) {
      if (!f.endsWith(".json")) continue;
      const p = sourceSchema.parse(readJson(path.join(sourceDir, f)));
      const { kept, answers: own } = stripBlanks(p.source);
      for (const a of own) if ([...a].length >= REDACT_MIN_CHARS) answers.add(a);
      const prose = [
        ...both(p.blurb),
        ...(p.notes?.en ?? []),
        ...(p.notes?.zh ?? []),
        (p.tags ?? []).join(" "),
      ].join("\n");
      docs.push({
        id: `program:${p.id}`,
        kind: "program",
        title: joinTitle(p.title, p.id),
        body: `${prose}\n${kept}`,
      });
    }
  }
  const longestFirst = [...answers].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  for (const d of docs) {
    d.title = redact(d.title, longestFirst);
    d.body = redact(d.body, longestFirst);
  }
  return { catalog, docs };
}

/**
 * Rebuild `catalog_items` and `library_docs`/`library_fts` from `content` unless `content_state`
 * already records this version and source commit. Returns whether it rebuilt. A read-only
 * database (written by a newer app) is left as it is.
 */
export function ensureIndexed(db: Db, content: FoundContent): boolean {
  if (db.readOnly) return false;
  const provFile = path.join(content.dir, "provenance.json");
  // absent → sha null; present must be a regular file (readJson refuses a link)
  const sha = present(provFile) ? (provenanceSchema.parse(readJson(provFile)).sha ?? null) : null;
  const state = db
    .prepare("SELECT addon_version, mv_sha FROM content_state WHERE id = 1")
    .get<{ addon_version: string | null; mv_sha: string | null }>();
  if (state && state.addon_version === content.version && state.mv_sha === sha) return false;

  // Parse everything before touching the database: a bad payload leaves the old index in place.
  const { catalog, docs } = buildDocs(content.dir);
  db.transaction(() => {
    // Plain DELETE + INSERT: the library_docs triggers keep library_fts in step row by row.
    db.exec("DELETE FROM catalog_items");
    db.exec("DELETE FROM catalog_groups");
    db.exec("DELETE FROM library_docs");
    const item = db.prepare(
      "INSERT INTO catalog_items (id, grp, ord, title_en, title_zh, file, version, accent, tag_en, tag_zh) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const it of catalog.items) {
      item.run(
        it.id,
        it.group,
        it.order,
        it.title.en,
        it.title.zh,
        it.file,
        it.version,
        it.accent,
        it.tag?.en ?? null,
        it.tag?.zh ?? null,
      );
    }
    const group = db.prepare(
      "INSERT INTO catalog_groups (id, ord, label_en, label_zh) VALUES (?, ?, ?, ?)",
    );
    groupsOf(catalog).forEach((g, i) => {
      group.run(g.id, i, g.label.en, g.label.zh);
    });
    const doc = db.prepare("INSERT INTO library_docs (id, kind, title, body) VALUES (?, ?, ?, ?)");
    for (const d of docs) doc.run(d.id, d.kind, d.title, d.body);
    db.prepare(
      `INSERT INTO content_state (id, addon_version, addon_source, mv_sha) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET addon_version = excluded.addon_version,
         addon_source = excluded.addon_source, mv_sha = excluded.mv_sha`,
    ).run(content.version, content.source, sha);
  });
  return true;
}
