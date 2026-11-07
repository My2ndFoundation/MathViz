import { beforeAll, describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadProgram, type Program, programContext } from "../../app/src/lib/ai/context";
import {
  allowedBlanks,
  blanksOf,
  forbiddenAnswerLines,
  leakCheck,
  normalize,
} from "../../app/src/lib/ai/leak";
import { extractPayload } from "../helpers/content-fixtures";

/**
 * The anti-leak rules (design §7.4) on a real python program from this checkout's payload:
 * celsius-to-fahrenheit has two blanks (`formula`, `round-to-int`), each with a lineNote anchored
 * on its answer line. What the blanks hold is read from the source itself, never hard-coded.
 */

const PROG = "celsius-to-fahrenheit";
let PAYLOAD = "";
let program: Program;
let answers: Map<string, string[]>;

beforeAll(async () => {
  PAYLOAD = await extractPayload("python");
  program = loadProgram(PAYLOAD, PROG) as Program;
  answers = new Map(
    blanksOf(program.source).map((b) => [b.id, b.body.filter((l) => l.trim() !== "")]),
  );
}, 60_000);

const lineNoteAts = (ctx: ReturnType<typeof programContext>) => ctx.lineNotes.map((n) => n.at);

describe("allowedBlanks", () => {
  test("read mode allows every blank of its own program", () => {
    expect(allowedBlanks(PROG, { progId: PROG, mode: "read", blankId: null, given: [] })).toBe(
      "all",
    );
  });
  test("blank and trace modes allow exactly the given blanks", () => {
    const s = allowedBlanks(PROG, {
      progId: PROG,
      mode: "blank",
      blankId: "formula",
      given: ["formula"],
    });
    expect(s).toEqual(new Set(["formula"]));
    expect(allowedBlanks(PROG, { progId: PROG, mode: "trace", blankId: null, given: [] })).toEqual(
      new Set(),
    );
  });
  test("no state, or another program's state, allows nothing", () => {
    expect(allowedBlanks(PROG, null)).toEqual(new Set());
    expect(
      allowedBlanks(PROG, { progId: "other", mode: "read", blankId: null, given: [] }),
    ).toEqual(new Set());
    expect(
      allowedBlanks(PROG, { progId: "other", mode: "blank", blankId: null, given: ["formula"] }),
    ).toEqual(new Set());
  });
});

describe("programContext", () => {
  test("the program has two blanks, each with a lineNote on its answer line", () => {
    expect([...answers.keys()].sort()).toEqual(["formula", "round-to-int"]);
    const ats = (program.lineNotes ?? []).map((n) => n.at);
    for (const lines of answers.values()) expect(lines.some((l) => ats.includes(l))).toBe(true);
  });

  test("nothing allowed: no answer line and no lineNote on one; placeholders keep indentation", () => {
    const ctx = programContext(program, new Set());
    for (const lines of answers.values()) {
      for (const l of lines) {
        expect(ctx.source).not.toContain(l.trim());
        expect(lineNoteAts(ctx)).not.toContain(l);
      }
    }
    expect(ctx.lineNotes).toEqual([]);
    expect(ctx.source).toContain("    # ___ (blank formula) ___");
    expect(ctx.source).toContain("    # ___ (blank round-to-int) ___");
    // the hints stay: the directive lines are what the student is shown as tiered hints
    expect(ctx.source).toMatch(/# >>> BLANK id=formula .*hint="/);
    expect(ctx.title.en).toBeTruthy();
    expect(ctx.notes.en?.length).toBeGreaterThan(0);
  });

  test("one blank given: its answer and lineNote are back, the other blank's are not", () => {
    const ctx = programContext(program, new Set(["formula"]));
    for (const l of answers.get("formula") ?? []) {
      expect(ctx.source).toContain(l);
      expect(lineNoteAts(ctx)).toContain(l);
    }
    for (const l of answers.get("round-to-int") ?? []) {
      expect(ctx.source).not.toContain(l.trim());
      expect(lineNoteAts(ctx)).not.toContain(l);
    }
    expect(ctx.source).toContain("# ___ (blank round-to-int) ___");
    expect(ctx.source).not.toContain("# ___ (blank formula) ___");
  });

  test("read mode: the source is the original, every lineNote kept", () => {
    const ctx = programContext(program, "all");
    expect(ctx.source).toBe(program.source);
    expect(ctx.lineNotes.length).toBe((program.lineNotes ?? []).length);
  });
});

describe("forbiddenAnswerLines and leakCheck", () => {
  test("forbidden lines are the disallowed blanks' answer lines, whitespace removed", () => {
    const all = [...answers.values()].flat().map(normalize);
    expect(forbiddenAnswerLines(program, new Set()).sort()).toEqual([...new Set(all)].sort());
    expect(forbiddenAnswerLines(program, "all")).toEqual([]);
    const some = forbiddenAnswerLines(program, new Set(["formula"]));
    expect(some).toEqual((answers.get("round-to-int") ?? []).map(normalize));
    for (const f of some) expect(f).not.toMatch(/\s/);
  });

  test("an answer line with extra whitespace inside prose is caught", () => {
    const forbidden = forbiddenAnswerLines(program, new Set());
    const line = (answers.get("formula") ?? [])[0] as string;
    const spaced = line.trim().split("").join(" ").replace(/ {2}/g, "　 \t");
    const text = `你可以这样写：\n\n\`\`\`python\n${spaced}\n\`\`\`\n就好了。`;
    expect(leakCheck(text, forbidden)).toBe(normalize(line));
  });

  test("text unrelated to the blanks is clean", () => {
    const forbidden = forbiddenAnswerLines(program, new Set());
    expect(
      leakCheck("华氏度和摄氏度之间是线性关系；想想 0 度和 100 度分别对应什么。", forbidden),
    ).toBeNull();
    expect(leakCheck("anything", [])).toBeNull();
  });

  test("every program in the payload parses, and every blank has an id", () => {
    const files = readdirSync(join(PAYLOAD, "source")).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const p = loadProgram(PAYLOAD, f.replace(/\.json$/, "")) as Program;
      for (const b of blanksOf(p.source)) expect(b.id).toMatch(/^[\w-]+$/);
    }
  });

  test("an unknown or malformed program id loads as null", () => {
    expect(loadProgram(PAYLOAD, "no-such-program")).toBeNull();
    expect(loadProgram(PAYLOAD, "../catalog")).toBeNull();
  });
});
