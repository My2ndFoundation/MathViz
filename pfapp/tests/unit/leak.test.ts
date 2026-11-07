import { beforeAll, describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  HINT_WITHHELD,
  loadProgram,
  type Program,
  programContext,
  safeTiers,
} from "../../app/src/lib/ai/context";
import { inputOf } from "../../app/src/lib/ai/jobs";
import {
  allowedBlanks,
  blanksOf,
  forbiddenAnswerLines,
  keywordOnly,
  leakCheck,
  normalize,
} from "../../app/src/lib/ai/leak";
import { REDACTED } from "../../app/src/lib/content/index-builder";
import type { PyState } from "../../app/src/lib/py-state";
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

describe("fix round 1", () => {
  test("keyword-only lines match whole reply lines only; other lines stay substrings", () => {
    for (const k of ["break", "else:", "pass", "finally:", "return None", "continue"]) {
      expect(keywordOnly(normalize(k))).toBe(true);
    }
    for (const k of ["x = 1", "temp = a", "case _:", "if n < 2:", "return celsius * 9 / 5 + 32"]) {
      expect(keywordOnly(normalize(k))).toBe(false);
    }
    const f = ["break", "else:", "pass"].map(normalize);
    expect(leakCheck("use break here, so the loop stops; a bypass is not needed", f)).toBeNull();
    expect(leakCheck("an else: branch catches the rest", f)).toBeNull();
    expect(leakCheck("就这样：\n```python\n        break\n```", f)).toBe("break");
    expect(leakCheck("    break  # stop scanning", f)).toBe("break");
    expect(leakCheck("else:", f)).toBe("else:");
    // a longer line still hits anywhere, as a substring
    const longer = [normalize("self.top = self.top + 1")];
    expect(leakCheck("先写 self.top=self.top+1 再存", longer)).toBe(longer[0] as string);
  });

  test("normalisation: zero-width, NFKC, Markdown escapes and HTML entities do not hide a line", () => {
    const forbidden = forbiddenAnswerLines(program, new Set());
    const line = ((answers.get("formula") ?? [])[0] as string).trim();
    expect(leakCheck(line.replace(/\*/g, "\\*"), forbidden)).not.toBeNull();
    expect(leakCheck(line.split("").join("​"), forbidden)).not.toBeNull();
    expect(leakCheck(line.replace(/\*/g, "＊").replace(/\+/g, "＋"), forbidden)).not.toBeNull();
    expect(leakCheck(`${line.replace("/", "⁠/")}﻿`, forbidden)).not.toBeNull();
    const lt = [normalize("if n < 2:")];
    expect(leakCheck("写成 if n &lt; 2: 就行", lt)).toBe(lt[0] as string);
    expect(
      leakCheck("&quot;x&quot; &amp;&amp; &#39;y&#39;", [normalize(`"x" && 'y'`)]),
    ).not.toBeNull();
  });

  test("a hint tier that spells out its own hidden answer is withheld (stack-array-top-pointer)", () => {
    const p = loadProgram(PAYLOAD, "stack-array-top-pointer") as Program;
    const forbidden = forbiddenAnswerLines(p, new Set());
    const raw = blanksOf(p.source).find((b) => b.id === "push") as NonNullable<
      ReturnType<typeof blanksOf>[number]
    >;
    // the premise: some tier of the push hint does contain its own answer line
    expect((raw.hint.zh ?? "").split(" || ").some((t) => leakCheck(t, forbidden) !== null)).toBe(
      true,
    );
    const hidden = programContext(p, new Set());
    expect(leakCheck(hidden.source, forbidden)).toBeNull();
    expect(hidden.source).toContain(HINT_WITHHELD);
    // tiers that do not give it away are kept
    expect(hidden.source).toMatch(/hint="\(hint withheld\) \|\| [^"(]/);
    const tiers = safeTiers(raw.hint.zh, raw, true);
    expect(tiers.length).toBe((raw.hint.zh ?? "").split(" || ").length);
    expect(tiers).toContain(HINT_WITHHELD);
    expect(tiers.some((t) => t !== HINT_WITHHELD)).toBe(true);
    // allowed: the hints are as written
    expect(programContext(p, "all").source).toBe(p.source);
    expect(programContext(p, new Set(["push", "pop"])).source).not.toContain(HINT_WITHHELD);
  });

  test("lineNote text on visible lines is redacted like the other prose", () => {
    const hiddenLine = "        total = total + values[index]";
    const synthetic: Program = {
      id: "synthetic",
      source: `def f(values):\n    total = 0\n# >>> BLANK id=acc level=1 hint="add"\n${hiddenLine}\n# <<< BLANK\n    return total`,
      lineNotes: [
        {
          at: "    total = 0",
          en: `Later: ${hiddenLine.trim()} adds up.`,
          zh: `之后 ${hiddenLine.trim()}`,
        },
        { at: hiddenLine, en: "on the hidden line" },
      ],
    };
    const ctx = programContext(synthetic, new Set());
    expect(ctx.lineNotes.length).toBe(1);
    expect(ctx.lineNotes[0]?.en).toBe(`Later: ${REDACTED} adds up.`);
    expect(ctx.lineNotes[0]?.zh).toBe(`之后 ${REDACTED}`);
    expect(programContext(synthetic, "all").lineNotes[0]?.en).toContain(hiddenLine.trim());
  });

  test("a stored pyState is re-validated when read; invalid means none", () => {
    const row = (pyState: unknown) => ({ input: JSON.stringify({ subjects: [], pyState }) });
    const good = { progId: PROG, mode: "blank", blankId: null, given: ["formula"] };
    expect(inputOf(row(good)).pyState).toEqual(good as PyState);
    expect(inputOf(row({ ...good, given: "formula" })).pyState).toBeNull();
    expect(inputOf(row({ ...good, mode: "everything" })).pyState).toBeNull();
    expect(inputOf(row({ ...good, progId: 7 })).pyState).toBeNull();
    expect(inputOf(row("read")).pyState).toBeNull();
    // and nothing is allowed under it
    expect(allowedBlanks(PROG, inputOf(row({ ...good, given: "formula" })).pyState)).toEqual(
      new Set(),
    );
  });
});
