/**
 * bun scripts/icons.ts [--check]
 *
 * The four pfapp icons (`targets/<t>/icon.svg`), generated — never hand-edited. One M/V mark, four
 * accents: math cyan, chess violet, crypto rose, python emerald (design §7.6).
 *
 * The mark is **drawn as geometry**, not traced. It is the logo in `docs/logo.png` redrawn: an M over a
 * V with one full period of a true sine running through both, a dot at each end, the letters cut where
 * the wave crosses them (the wave is drawn twice: a thick stroke in the ground colour that cuts, then the
 * thin accent stroke on top). Read together it is a fox's face — the M its ears, the V its chin. The
 * logo's axes are left out: on the dark ground they are invisible (the same call apply_branding.py makes).
 *
 * The geometry is copied from PrimeForge-Desktop `assets/logos/mathviz/make.py` (2026-11-08), where the
 * mark was redrawn for the store, the console and the content packs' icons; this script writes the same
 * bytes that script writes for `<t>.svg`, so the app icon and the store logo are one drawing. Until then
 * these icons traced the 64 px PNG mark in `docs/brand-assets.json` (marching squares), and every edge
 * came out ragged at icon size. Change the geometry in both places, or the two drift.
 *
 * The colours still come from the web version: `--bg-deep` and the `--trace-*` accents in
 * `design-system/math-viz-starter.html`, so a token change reaches the icons through `--check`.
 *
 * The icon standard's strict rules (PrimeForge-Desktop docs/app-icon-standard.md), met by construction
 * and asserted by tests/unit/icons.test.ts: a square viewBox, the first drawn element an opaque
 * full-bleed `<rect>` with square corners, no text, comment, style, script or image, at most 64 KB. A
 * `<title>` (the app's English name) is allowed and draws nothing. The window rounds the corners itself
 * (22.5%), so the mark is fitted with room left for them.
 *
 * `--check` regenerates in memory and exits 1 if any icon on disk differs (the same split the web
 * version's apply_branding.py uses: the committed output is compared, nothing is re-encoded).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadTarget, type TargetId } from "../app/src/lib/target";

const PFAPP = resolve(import.meta.dir, "..");
const MV = resolve(process.env.MATHVIZ_PATH ?? join(PFAPP, ".."));

export const ACCENT: Record<TargetId, string> = {
  math: "--trace-cyan",
  chess: "--trace-violet",
  crypto: "--trace-rose",
  python: "--trace-emerald",
};

/** The canvas side. */
const SIDE = 1024;
/** The mark in the logo's own coordinates (the 1254 px logo shown at 900), centred and scaled into SIDE. */
const FIT = "translate(512 512) scale(0.98) translate(-452 -505)";
const M = "M244 470V204L447 372L649 204V492";
const V = "M230 535H305L449.3 746L590 535H665L465 835H435Z";
/** One full period of y = sin x, crossing its midline at the logo's vertical axis: up left, down right. */
const X0 = 145;
const X1 = 759;
const MID = 540;
const AMP = 85;
const STEPS = 240;

/** Python's `f"{v:.1f}"`, which make.py uses: round-half-even on the exact binary value. */
function f1(v: number): string {
  // Both round the exact binary value; they differ only on an exact tie, where toFixed goes up and
  // Python goes to even. A binary double ties at one decimal only when its fraction is exactly .25 or
  // .75 (k/20 is exact in binary only for k a multiple of 5); `v * 4` is exact, so test it there.
  if (Number.isInteger(v * 4) && !Number.isInteger(v * 2)) {
    const down = Math.floor(v * 10);
    return ((down % 2 === 0 ? down : down + 1) / 10).toFixed(1);
  }
  const s = v.toFixed(1);
  return s === "-0.0" ? "0.0" : s;
}

export function wave(): string {
  const pts: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    pts.push(
      `${f1(X0 + (i * (X1 - X0)) / STEPS)} ${f1(MID - AMP * Math.sin((2 * Math.PI * i) / STEPS))}`,
    );
  }
  return `M${pts.join("L")}`;
}

export function iconSvg(bg: string, accent: string, title: string): string {
  const w = wave();
  const ends: [number, number][] = [
    [X0, MID],
    [X1, MID],
  ];
  const halo = ends.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="44" fill="${bg}"/>`).join("");
  const dots = ends
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="24" fill="${accent}"/>`)
    .join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIDE} ${SIDE}">`,
    `<title>${title}</title>`,
    `<rect x="0" y="0" width="${SIDE}" height="${SIDE}" fill="${bg}"/>`,
    `<g transform="${FIT}">`,
    `<path d="${M}" fill="none" stroke="${accent}" stroke-width="56" stroke-linejoin="round"/>`,
    `<path d="${V}" fill="${accent}"/>`,
    `<path d="${w}" fill="none" stroke="${bg}" stroke-width="68" stroke-linecap="round" stroke-linejoin="round"/>`,
    halo,
    `<path d="${w}" fill="none" stroke="${accent}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>`,
    dots,
    "</g>",
    "</svg>",
    "",
  ].join("\n");
}

/** The value of `--name` in the starter's :root. */
export function token(css: string, name: string): string {
  const m = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
  if (!m?.[1]) throw new Error(`design-system/math-viz-starter.html has no ${name}`);
  return m[1].toLowerCase();
}

/** Every target's icon, coloured from the web version in `mv`. */
export function icons(mv: string = MV): Record<TargetId, string> {
  const css = readFileSync(join(mv, "design-system", "math-viz-starter.html"), "utf8");
  const bg = token(css, "--bg-deep");
  const out = {} as Record<TargetId, string>;
  for (const [t, name] of Object.entries(ACCENT) as [TargetId, string][]) {
    out[t] = iconSvg(bg, token(css, name), loadTarget(t).name.en);
  }
  return out;
}

export const iconFile = (t: TargetId) => join(PFAPP, "targets", t, "icon.svg");

if (import.meta.main) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const [t, svg] of Object.entries(icons()) as [TargetId, string][]) {
    const file = iconFile(t);
    if (check) {
      let have = "";
      try {
        have = readFileSync(file, "utf8");
      } catch {
        // missing
      }
      if (have !== svg) {
        stale++;
        console.error(`icons: targets/${t}/icon.svg is not what scripts/icons.ts generates`);
      }
    } else {
      writeFileSync(file, svg);
      console.log(`icons: targets/${t}/icon.svg (${Buffer.byteLength(svg)} bytes)`);
    }
  }
  if (stale > 0) process.exit(1);
}
