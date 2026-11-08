import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildRecorder, writeRecorder } from "../../scripts/recorder";
import { tmp } from "../helpers/content-fixtures";

// a synthetic web shell: the markers and the swapped lookups, never the real app.html's code
const shell = (stages = 2, mains = 2, cssLive = 2) =>
  [
    "<style>",
    "body{}",
    "/* ===== 录制器 ===== */",
    ".rec-btn{}",
    ...Array.from({ length: cssLive }, () => ".stage.rec-live{overflow:hidden}"),
    "</style>",
    "<script>",
    "var frame, curId;",
    "/* ================= 录制器 ================= */",
    "var REC = {};",
    ...Array.from({ length: stages }, () => "document.querySelector('.stage');"),
    ...Array.from({ length: mains }, () => "document.querySelector('main.stage');"),
    "/* ===== REC:UI ===== */",
    "/* ===== /REC:UI ===== */",
    "function boot(){}",
    "</script>",
  ].join("\n");

describe("the maths recorder, generated from the web shell (scripts/recorder.ts)", () => {
  test("takes the block and its styles, swapping the stage lookups", () => {
    const { js, css } = buildRecorder(shell());
    expect(js).toContain("'use strict';\n/* ================= 录制器 ================= */");
    expect(js).toContain("var REC = {};");
    expect(js.trimEnd().endsWith("/* ===== /REC:UI ===== */")).toBe(true);
    expect(js).not.toContain("function boot");
    expect(js).not.toContain("var frame");
    expect(js).not.toContain("querySelector");
    expect(js.split("REC_HOST.stage()").length - 1).toBe(4);
    expect(css).toContain(".rec-btn{}");
    expect(css).not.toContain("body{}");
    expect(css).not.toContain("</style>");
    expect(css.split(".rec-stage.rec-live").length - 1).toBe(2);
  });

  test("a web shell whose lookups changed fails loudly, naming the script to update", () => {
    expect(() => buildRecorder(shell(1))).toThrow(
      /expected 2 .*found 1 — update scripts\/recorder.ts/,
    );
    expect(() => buildRecorder(shell(2, 3))).toThrow(/found 3/);
    expect(() => buildRecorder(shell(2, 2, 0))).toThrow(/styles: expected 2/);
    expect(() => buildRecorder("<style></style>")).toThrow(/expected exactly one/);
  });

  test("only the maths app gets one: any other target removes the directory", () => {
    const dir = join(tmp("recorder"), "recorder");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "rec.js"), "stale");
    writeRecorder("python", dir);
    expect(existsSync(dir)).toBe(false);
    // its now-empty parent too (public/ ships whenever it exists)
    expect(existsSync(join(dir, ".."))).toBe(false);
  });
});
