import { readdirSync, readFileSync } from "node:fs";
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
 * what ships); `expectedCounts` (registry `programs` field) is cross-checked.
 */
export function readPythonSources(
  mvPath: string,
  registeredTools: Map<string, number | undefined>,
): ProgramSource[] {
  const root = join(mvPath, "python/programs");
  const out: ProgramSource[] = [];
  const seen = new Set<string>();
  const chapters = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("ch"))
    .map((d) => d.name)
    .sort();
  for (const ch of chapters) {
    const chapter = JSON.parse(readFileSync(join(root, ch, "chapter.json"), "utf8")) as Chapter;
    if (!registeredTools.has(chapter.tool)) continue;
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
        source: readFileSync(join(root, ch, file), "utf8"),
      });
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
