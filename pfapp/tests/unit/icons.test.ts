import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { TargetId } from "../../app/src/lib/target";
import { ACCENT, iconFile, icons, token } from "../../scripts/icons";

/**
 * The four pfapp icons (scripts/icons.ts) against PrimeForge's icon standard, strict mode
 * (PrimeForge-Desktop docs/app-icon-standard.md): the checks its first-party build scripts make
 * before they pack, restated here so a broken icon is red in this repository, not on the signing
 * machine.
 */

const TARGETS = Object.keys(ACCENT) as TargetId[];
const MV = resolve(import.meta.dir, "..", "..", "..");
const css = readFileSync(join(MV, "design-system", "math-viz-starter.html"), "utf8");
const onDisk = (t: TargetId) => readFileSync(iconFile(t), "utf8");

describe("pfapp icons", () => {
  test("targets/<t>/icon.svg is exactly what scripts/icons.ts generates (bun scripts/icons.ts)", () => {
    const want = icons();
    for (const t of TARGETS) expect([t, onDisk(t)]).toEqual([t, want[t]]);
  });

  test("each manifest declares icon.svg at the package root", () => {
    for (const t of TARGETS) {
      const m = JSON.parse(readFileSync(join(MV, "pfapp", "targets", t, "manifest.json"), "utf8"));
      expect([t, m.art?.icon]).toEqual([t, "icon.svg"]);
    }
  });

  for (const t of TARGETS) {
    test(`${t}: strict icon rules`, () => {
      const svg = onDisk(t);
      expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(65536);
      // nothing that runs, loads, needs fonts or that the allowlist refuses outright
      expect(svg).not.toMatch(/<!--|<!|<\?|<text|<style|<script|<image|<foreignObject|href=|url\(/);
      expect(svg).not.toMatch(/\son[a-z]+=/i);
      // only the elements an icon of this shape needs
      const tags = [...svg.matchAll(/<([a-zA-Z]+)/g)].map((m) => m[1]);
      expect(new Set(tags)).toEqual(new Set(["svg", "title", "rect", "path"]));
      // a square viewBox; the root carries no opacity, clip, mask or transform of its own
      const root = /^<svg\b([^>]*)>/.exec(svg)?.[1] ?? "";
      const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(root);
      expect(vb?.[1]).toBe(vb?.[2]);
      expect(root).not.toMatch(/opacity|clip|mask|transform|display|visibility/);
      const side = vb?.[1];
      // the first drawn element: an opaque full-bleed rect with square corners and no stroke
      const first = /^<svg\b[^>]*>\s*(?:<title>[^<]*<\/title>\s*)?<([a-z]+)\b([^>]*)\/>/.exec(svg);
      expect(first?.[1]).toBe("rect");
      const a = first?.[2] ?? "";
      expect(a).toContain(`width="${side}"`);
      expect(a).toContain(`height="${side}"`);
      expect(a).toMatch(/\bx="0"/);
      expect(a).toMatch(/\by="0"/);
      expect(a).not.toMatch(/\b(rx|ry|stroke|opacity|fill-opacity|clip-path|mask|transform)=/);
      expect(a).toContain(`fill="${token(css, "--bg-deep")}"`);
      // the mark in this target's accent from the web version's tokens
      expect(svg).toContain(`<path fill="${token(css, ACCENT[t])}"`);
    });
  }

  test("one mark: the four icons differ only in the accent", () => {
    const strip = (s: string) =>
      s.replace(/<path fill="#[0-9a-f]{6}"/, '<path fill="X"').replace(/<title>[^<]*</, "<title><");
    const marks = new Set(TARGETS.map((t) => strip(onDisk(t))));
    expect(marks.size).toBe(1);
    expect(new Set(TARGETS.map((t) => token(css, ACCENT[t]))).size).toBe(4);
  });
});
