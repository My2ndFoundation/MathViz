import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { BLANK_OPEN, REDACT_MIN_CHARS, REDACTED } from "../content/index-builder";
import { isRegularFile } from "../content/installed";
import type { Db } from "../db/handle";
import type { AiJobRow } from "../db/schema";
import type { PyState } from "../py-state";
import { inputOf, parseBlankSubject, readProgramsOf, type Subject } from "./jobs";
import {
  allowedBlanks,
  type Blank,
  blanksOf,
  forbiddenAnswerLines,
  isAllowed,
  leakCheck,
  normalize,
} from "./leak";

/**
 * The material an agent is handed for a python program (design §7.4): title, notes, lineNotes and
 * source, read from the content pack's `source/<id>.json` (design §6.3: `run.expect` is not in the
 * pack at all). A blank the student may not see yet is cut out of what leaves this file: its body
 * becomes one placeholder line, and every lineNote anchored on one of its lines goes too (`at` is
 * the line itself, and the note usually explains it). The BLANK directive line stays — its tiered
 * `hint` is what the page shows the student anyway.
 */

const bilingual = z.object({ en: z.string().optional(), zh: z.string().optional() });
const lineNote = z.object({ at: z.string(), en: z.string().optional(), zh: z.string().optional() });

const programSchema = z.object({
  id: z.string().min(1),
  tool: z.string().optional(),
  title: bilingual.optional(),
  blurb: bilingual.optional(),
  notes: z
    .object({ en: z.array(z.string()).optional(), zh: z.array(z.string()).optional() })
    .optional(),
  lineNotes: z.array(lineNote).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string(),
});

export type Program = z.infer<typeof programSchema>;
export type LineNote = z.infer<typeof lineNote>;

/** A program id as the extractor writes them (kebab-case file stems): nothing path-like. */
const PROGRAM_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** `source/<id>.json` of the payload at `dir`, or null (unknown id, not a regular file, malformed). */
export function loadProgram(dir: string, id: string): Program | null {
  if (!PROGRAM_ID.test(id)) return null;
  const file = path.join(dir, "source", `${id}.json`);
  if (!isRegularFile(file)) return null;
  try {
    const p = programSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    return p.id === id ? p : null;
  } catch {
    return null;
  }
}

export interface ProgramContext {
  id: string;
  tool: string | null;
  title: { en?: string; zh?: string };
  blurb: { en?: string; zh?: string };
  notes: { en?: string[]; zh?: string[] };
  lineNotes: LineNote[];
  tags: string[];
  source: string;
}

/** What a hint tier that would give a hidden blank's answer away is replaced by. */
export const HINT_WITHHELD = "(hint withheld)";
const TIER_SEP = " || ";

/**
 * A hidden blank's hint tiers, with every tier that contains one of the blank's own answer lines
 * (leakCheck) replaced by HINT_WITHHELD: the agent may use the hints, so it must never be handed
 * one it cannot repeat (stack-array-top-pointer's `push` hint spells out `self.top = self.top + 1`).
 */
export function safeTiers(hint: string | null, blank: Blank, hidden: boolean): string[] {
  if (hint === null) return [];
  const tiers = hint.split(TIER_SEP);
  if (!hidden) return tiers;
  const own = blank.body.map(normalize).filter((l) => l !== "");
  return tiers.map((t) => (leakCheck(t, own) === null ? t : HINT_WITHHELD));
}

/** The `# >>> BLANK` directive line with its hint / hintEn tiers passed through safeTiers. */
function safeDirective(line: string, blank: Blank): string {
  return line.replace(/\b(hint|hintEn)="([^"]*)"/g, (_m, name: string, value: string) => {
    return `${name}="${safeTiers(value, blank, true).join(TIER_SEP)}"`;
  });
}

export const placeholder = (indent: string, id: string) => `${indent}# ___ (blank ${id}) ___`;
const indentOf = (lines: readonly string[]) =>
  /^\s*/.exec(lines.find((l) => l.trim() !== "") ?? "")?.[0] ?? "";

/** Replace every occurrence of a hidden answer line long enough to tell apart from prose. */
function redactProse(text: string, hidden: readonly string[]): string {
  let out = text;
  for (const a of hidden) if (out.includes(a)) out = out.split(a).join(REDACTED);
  return out;
}

/**
 * The program as the agent may see it. `allowed` comes from allowedBlanks. Besides the source and
 * the lineNotes, hidden answer lines of REDACT_MIN_CHARS or more are also taken out of the prose
 * (title, blurb, notes), as the library index does: a note that happened to quote one would only
 * get the agent's answer refused by submit_answer.
 */
export function programContext(program: Program, allowed: "all" | Set<string>): ProgramContext {
  const lines = program.source.split("\n");
  const hidden = blanksOf(program.source).filter((b) => !isAllowed(allowed, b.id));
  const hiddenLines = new Set<string>();
  for (const b of hidden) for (const l of b.body) if (l.trim() !== "") hiddenLines.add(l.trim());

  let source = program.source;
  if (hidden.length > 0) {
    const out: string[] = [];
    let i = 0;
    for (const b of hidden) {
      out.push(...lines.slice(i, b.open));
      out.push(safeDirective(lines[b.open] as string, b));
      out.push(placeholder(indentOf(b.body), b.id));
      i = b.close; // the `# <<< BLANK` line itself is kept
    }
    out.push(...lines.slice(i));
    source = out.join("\n");
  }

  const long = [...hiddenLines]
    .filter((l) => [...l].length >= REDACT_MIN_CHARS)
    .sort((a, b) => b.length - a.length);
  const prose = (s: string | undefined) => (s === undefined ? undefined : redactProse(s, long));
  const both = (b: { en?: string; zh?: string } | undefined) => ({
    ...(b?.en !== undefined ? { en: prose(b.en) } : {}),
    ...(b?.zh !== undefined ? { zh: prose(b.zh) } : {}),
  });

  return {
    id: program.id,
    tool: program.tool ?? null,
    title: both(program.title),
    blurb: both(program.blurb),
    notes: {
      ...(program.notes?.en ? { en: program.notes.en.map((n) => redactProse(n, long)) } : {}),
      ...(program.notes?.zh ? { zh: program.notes.zh.map((n) => redactProse(n, long)) } : {}),
    },
    // notes on hidden lines go; the text of the rest is redacted like the other prose
    lineNotes: (program.lineNotes ?? [])
      .filter((n) => !hiddenLines.has(n.at.trim()))
      .map((n) => ({
        ...n,
        ...(n.en !== undefined ? { en: redactProse(n.en, long) } : {}),
        ...(n.zh !== undefined ? { zh: redactProse(n.zh, long) } : {}),
      })),
    tags: program.tags ?? [],
    source,
  };
}

// ---------------------------------------------------------------- what mv_get_task / mv_read_item hand over

/** Lines of context either side of a blank, for a `blank` subject. */
export const BLANK_EXCERPT_LINES = 8;

const programLibraryId = (id: string) => `program:${id}`;
const toolLibraryId = (id: string) => `tool:${id}`;

/** A program as the agent may see it under the job's bridge state (§7.4 rules via allowedBlanks). */
export function programMaterial(dir: string, programId: string, pyState: PyState | null) {
  const program = loadProgram(dir, programId);
  if (!program) return null;
  const allowed = allowedBlanks(programId, pyState);
  return {
    libraryId: programLibraryId(programId),
    answersShown: allowed === "all" ? "all" : [...allowed],
    ...programContext(program, allowed),
  };
}

/** One blank: the source around it (hidden blanks as placeholders), its tiered hints, whether it is open. */
function blankMaterial(dir: string, subjectId: string, pyState: PyState | null) {
  const ref = parseBlankSubject(subjectId);
  if (!ref) return null;
  const program = loadProgram(dir, ref.programId);
  if (!program) return null;
  const blank = blanksOf(program.source).find((b) => b.id === ref.blankId);
  if (!blank) return null;
  const allowed = allowedBlanks(ref.programId, pyState);
  const ctx = programContext(program, allowed);
  const lines = ctx.source.split("\n");
  const at = lines.findIndex(
    (l) => BLANK_OPEN.test(l) && new RegExp(`\\bid=${escapeRe(ref.blankId)}(\\s|$)`).test(l),
  );
  const from = Math.max(0, at - BLANK_EXCERPT_LINES);
  const to = Math.min(lines.length, at + BLANK_EXCERPT_LINES + 2);
  return {
    program: { id: program.id, libraryId: programLibraryId(program.id), title: ctx.title },
    blank: {
      id: blank.id,
      answerShown: isAllowed(allowed, blank.id),
      hints: {
        zh: safeTiers(blank.hint.zh, blank, !isAllowed(allowed, blank.id)),
        en: safeTiers(blank.hint.en, blank, !isAllowed(allowed, blank.id)),
      },
    },
    excerpt: lines.slice(from, to).join("\n"),
    lineNotes: ctx.lineNotes,
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function toolMaterial(db: Db, toolId: string) {
  const doc = db
    .prepare("SELECT id, title, body FROM library_docs WHERE id = ?")
    .get<{ id: string; title: string; body: string }>(toolLibraryId(toolId));
  return doc ? { libraryId: doc.id, title: doc.title, text: doc.body } : null;
}

/** The job's subject materials. An unknown subject is listed as missing rather than dropped. */
function subjectMaterial(db: Db, dir: string | null, s: Subject, pyState: PyState | null) {
  const missing = { type: s.type, id: s.id, missing: true };
  if (s.type === "library") {
    return {
      type: s.type,
      note: "Search the library with mv_search_library and read items with mv_read_item.",
    };
  }
  if (s.type === "tool") {
    const m = toolMaterial(db, s.id);
    return m ? { type: s.type, id: s.id, ...m } : missing;
  }
  if (!dir) return missing;
  const m =
    s.type === "program" ? programMaterial(dir, s.id, pyState) : blankMaterial(dir, s.id, pyState);
  return m ? { type: s.type, id: s.id, ...m } : missing;
}

interface MessageLite {
  role: string;
  text: string;
}

/**
 * An earlier message of the conversation as the agent may see it (Task 10 review, Minor 3): a
 * read-mode answer or the student's pasted attempt can quote a hidden answer line, and an agent
 * that repeats its own history would then be refused by submit_answer for something it was handed.
 * `forbidden` is forbiddenForJob's list (empty in read mode for the program). Every line of the
 * text that leakCheck flags is replaced by REDACTED (its indentation kept); if the text as a whole
 * still gives a line away (one split over several lines), all of it is.
 */
export function redactHistory(text: string, forbidden: readonly string[]): string {
  if (forbidden.length === 0) return text;
  const out = text
    .split("\n")
    .map((l) => (leakCheck(l, forbidden) === null ? l : `${/^\s*/.exec(l)?.[0] ?? ""}${REDACTED}`))
    .join("\n");
  return leakCheck(out, forbidden) === null ? out : REDACTED;
}

/**
 * The answer lines the conversation handed to the agent must not contain: forbiddenForJob over
 * every subject the thread has ever had as well as the job's own (Task 11 review, Minor 1 —
 * defence in depth: a later job about fewer subjects must not unlock what an earlier turn quoted).
 */
export function forbiddenForHistory(db: Db, dir: string | null, job: AiJobRow): string[] {
  const input = inputOf(job);
  const subjects: Subject[] = [...input.subjects];
  const rows = db
    .prepare(
      "SELECT subject_type AS type, subject_id AS id FROM thread_subjects WHERE thread_id = ?",
    )
    .all<{ type: Subject["type"]; id: string }>(job.thread_id);
  for (const r of rows) {
    if (!subjects.some((s) => s.type === r.type && s.id === r.id)) {
      subjects.push({ type: r.type, id: r.id });
    }
  }
  return forbiddenForJob(dir, { ...job, input: JSON.stringify({ ...input, subjects }) });
}

/** What mv_get_task returns for a job. */
export function buildTask(db: Db, dir: string | null, job: AiJobRow) {
  const input = inputOf(job);
  const messages = db
    .prepare(
      "SELECT role, text FROM messages WHERE thread_id = ? AND created_at <= ? ORDER BY created_at, id",
    )
    .all<MessageLite>(job.thread_id, job.created_at);
  let last = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      last = i;
      break;
    }
  }
  const ps = input.pyState;
  const forbidden = forbiddenForHistory(db, dir, job);
  return {
    workflow: job.workflow,
    locale: input.locale,
    question: last >= 0 ? (messages[last] as MessageLite).text : "",
    conversation: (last >= 0 ? messages.slice(0, last) : messages).map((m) => ({
      role: m.role === "user" ? "student" : "tutor",
      text: redactHistory(m.text, forbidden),
    })),
    page: ps ? { programId: ps.progId, mode: ps.mode, focusedBlank: ps.blankId } : null,
    subjects: input.subjects.map((s) => subjectMaterial(db, dir, s, input.pyState)),
    rules: [
      "A line `# ___ (blank <id>) ___` stands for code the student has not uncovered yet: never write that code out.",
      "The `hint` / `hintEn` of a `# >>> BLANK` line are tiered hints (split at ` || `) the student can already open; you may use them.",
      "A tier shown as `(hint withheld)` would give the hidden code away and is not available to you.",
      "Cite library items by id (program:<id>, tool:<id>).",
    ],
  };
}

/** What mv_read_item returns for a library id; null when there is no such item. */
export function readItem(db: Db, dir: string | null, id: string, pyState: PyState | null) {
  if (id.startsWith("program:")) {
    if (!dir) return null;
    const programId = id.slice("program:".length);
    const m = programMaterial(dir, programId, pyState);
    return m ? { kind: "program", programId, ...m } : null;
  }
  if (id.startsWith("tool:")) {
    const m = toolMaterial(db, id.slice("tool:".length));
    return m ? { kind: "tool", ...m } : null;
  }
  return null;
}

/** The sidebar's groups and their items, for mv_list_groups. */
export function listGroups(db: Db) {
  const groups = db
    .prepare("SELECT id, label_en, label_zh FROM catalog_groups ORDER BY ord, id")
    .all<{ id: string; label_en: string; label_zh: string }>();
  const items = db
    .prepare("SELECT id, grp, title_en, title_zh FROM catalog_items ORDER BY grp, ord, id")
    .all<{ id: string; grp: string; title_en: string; title_zh: string }>();
  return groups.map((g) => ({
    id: g.id,
    label: { en: g.label_en, zh: g.label_zh },
    items: items
      .filter((i) => i.grp === g.id)
      .map((i) => ({ id: toolLibraryId(i.id), title: { en: i.title_en, zh: i.title_zh } })),
  }));
}

/**
 * Every answer line this job's answer must not contain: the hidden blanks of each python program
 * the job touches — its program and blank subjects, the program the student has open (pyState),
 * and every program the agent read with mv_read_item.
 */
export function forbiddenForJob(dir: string | null, job: AiJobRow): string[] {
  if (!dir) return [];
  const input = inputOf(job);
  const ids = new Set<string>();
  for (const s of input.subjects) {
    if (s.type === "program") ids.add(s.id);
    if (s.type === "blank") {
      const ref = parseBlankSubject(s.id);
      if (ref) ids.add(ref.programId);
    }
  }
  if (input.pyState) ids.add(input.pyState.progId);
  for (const p of readProgramsOf(job)) ids.add(p);
  const out = new Set<string>();
  for (const id of ids) {
    const p = loadProgram(dir, id);
    if (!p) continue;
    for (const f of forbiddenAnswerLines(p, allowedBlanks(id, input.pyState))) out.add(f);
  }
  return [...out];
}
