import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * One program's raw material for the AI (design §6.3). Deliberately a whitelist: `run` (the
 * expected stdout) never leaves the web repo — the page never shows output, and some blanked
 * literals can only be recovered from it, so handing it to the AI would leak the answer.
 * `check`, `chunks` and the runner fields (`requires`, `runtime`, `entry`, …) are build-time data
 * and are left out too.
 */
export interface ProgramSource {
  id: string;
  tool: string;
  title: unknown;
  blurb: unknown;
  notes: unknown;
  lineNotes: unknown;
  tags: unknown;
  boards: unknown;
  level: unknown;
  /** The `.py` file verbatim, BLANK directives included. */
  source: string;
}

interface Chapter {
  tool: string;
  programs: Record<string, unknown>[];
}

/**
 * Programs of every `python/programs/ch*` chapter whose tool is in `registeredTools`, sorted by
 * program id. A chapter whose tool is not registered contributes nothing (the registry decides
 * what ships); the registry `programs` count is cross-checked. A registered tool with no chapter,
 * or a chapter naming a `.py` that is missing, throws with the tool id — shipping a tool with
 * zero or fewer sources silently would leave the AI with nothing to draw on for that page.
 */
export function readPythonSources(
  mvPath: string,
  registeredTools: Map<string, number | undefined>,
): ProgramSource[] {
  const root = join(mvPath, "python/programs");
  const out: ProgramSource[] = [];
  const seen = new Set<string>();
  const covered = new Set<string>();
  const chapters = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("ch"))
    .map((d) => d.name)
    .sort();
  for (const ch of chapters) {
    const chapter = JSON.parse(readFileSync(join(root, ch, "chapter.json"), "utf8")) as Chapter;
    if (!registeredTools.has(chapter.tool)) continue;
    if (covered.has(chapter.tool))
      throw new Error(`${chapter.tool}: more than one chapter (${ch})`);
    covered.add(chapter.tool);
    const expected = registeredTools.get(chapter.tool);
    if (expected !== undefined && expected !== chapter.programs.length) {
      throw new Error(
        `${ch}: ${chapter.programs.length} programs, registry says ${expected} for ${chapter.tool}`,
      );
    }
    for (const p of chapter.programs) {
      const id = p.id;
      const file = p.file;
      if (typeof id !== "string" || typeof file !== "string" || file.includes("/")) {
        throw new Error(`${ch}: program without id/file`);
      }
      if (seen.has(id)) throw new Error(`duplicate program id ${id}`);
      seen.add(id);
      const pyPath = join(root, ch, file);
      if (!existsSync(pyPath)) {
        throw new Error(`${chapter.tool}: program ${id} names ${ch}/${file}, which does not exist`);
      }
      out.push({
        id,
        tool: chapter.tool,
        title: p.title,
        blurb: p.blurb,
        notes: p.notes,
        lineNotes: p.lineNotes,
        tags: p.tags,
        boards: p.boards,
        level: p.level,
        source: readFileSync(pyPath, "utf8"),
      });
    }
  }
  const missing = [...registeredTools.keys()].filter((t) => !covered.has(t));
  if (missing.length > 0) {
    throw new Error(`registered python tools with no chapter: ${missing.sort().join(", ")}`);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
