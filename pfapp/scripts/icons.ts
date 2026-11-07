/**
 * bun scripts/icons.ts [--check]
 *
 * The four pfapp icons (`targets/<t>/icon.svg`), generated — never hand-edited. One M/V mark, four
 * accents: math cyan, chess violet, crypto rose, python emerald (design §7.6).
 *
 * Sources, both in the web version, so the icons follow the brand rather than a copy of it:
 *  - the mark: the already-derived transparent M/V mark in `docs/brand-assets.json` (`brand`, a
 *    64 px PNG data URI written by `scripts/apply_branding.py`, which keys out the logo's white
 *    ground and drops its axes — the original logo's axes are invisible on the dark background).
 *    Its alpha is traced into vector outlines (marching squares at half coverage, linear
 *    interpolation), because a pfapp icon may not embed an image: PrimeForge's icon check is an
 *    allowlist without `<image>` (PrimeForge-Desktop docs/app-icon-standard.md).
 *  - the colours: `--bg-deep` and the `--trace-*` accents in `design-system/math-viz-starter.html`.
 *
 * The icon standard's strict rules, met by construction and asserted by tests/unit/icons.test.ts:
 * a square viewBox, the first drawn element an opaque full-bleed `<rect>` with square corners, no
 * text, comment, style or script, at most 64 KB. A `<title>` (the app's English name) is allowed
 * there and draws nothing. The window rounds the corners itself (22.5%), so
 * the mark is fitted inside a centred box clear of them.
 *
 * `--check` regenerates in memory and exits 1 if any icon on disk differs (the same split the web
 * version's apply_branding.py uses: the committed output is compared, nothing is re-encoded).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { loadTarget, type TargetId } from "../app/src/lib/target";

const PFAPP = resolve(import.meta.dir, "..");
const MV = resolve(process.env.MATHVIZ_PATH ?? join(PFAPP, ".."));

export const ACCENT: Record<TargetId, string> = {
  math: "--trace-cyan",
  chess: "--trace-violet",
  crypto: "--trace-rose",
  python: "--trace-emerald",
};

/** The canvas side, and the box the mark is fitted into (centred, clear of the rounded corners). */
const SIDE = 128;
const BOX = 92;
const THRESHOLD = 0.5;

// ---------- PNG (8-bit palette with tRNS, or 8-bit RGBA) ----------

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Alpha in [0, 1], row-major. */
export function pngAlpha(png: Buffer): { w: number; h: number; alpha: Float64Array } {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let type = 0;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const kind = png.toString("latin1", pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (kind === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8] as number;
      type = data[9] as number;
      if (data[12] !== 0) throw new Error("interlaced PNG");
    } else if (kind === "tRNS") trns = Buffer.from(data);
    else if (kind === "IDAT") idat.push(Buffer.from(data));
    pos += 12 + len;
  }
  if (depth !== 8 || (type !== 3 && type !== 6)) {
    throw new Error(`unsupported PNG: depth ${depth}, colour type ${type}`);
  }
  const bpp = type === 6 ? 4 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)] as number;
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i] as number;
      const a = i >= bpp ? (px[y * stride + i - bpp] as number) : 0;
      const b = y > 0 ? (px[(y - 1) * stride + i] as number) : 0;
      const c = i >= bpp && y > 0 ? (px[(y - 1) * stride + i - bpp] as number) : 0;
      const v =
        f === 0
          ? x
          : f === 1
            ? x + a
            : f === 2
              ? x + b
              : f === 3
                ? x + ((a + b) >> 1)
                : x + paeth(a, b, c);
      px[y * stride + i] = v & 0xff;
    }
  }
  const alpha = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (type === 6) alpha[i] = (px[i * 4 + 3] as number) / 255;
    else {
      const idx = px[i] as number;
      alpha[i] = (trns && idx < trns.length ? (trns[idx] as number) : 255) / 255;
    }
  }
  return { w, h, alpha };
}

// ---------- tracing ----------

type Pt = [number, number];

/**
 * Closed outlines of {alpha >= t}, in pixel units (sample i at x = i + 0.5). Marching squares on a
 * zero-padded grid, so every outline closes; saddles are split by the cell's mean. Outlines are not
 * oriented: the path uses fill-rule evenodd, which needs none.
 */
export function trace(w: number, h: number, alpha: Float64Array, t = THRESHOLD): Pt[][] {
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : (alpha[y * w + x] as number);
  // a crossing on the edge between two samples, keyed by the edge
  const point = (key: string, x0: number, y0: number, x1: number, y1: number): [string, Pt] => {
    const a = at(x0, y0);
    const b = at(x1, y1);
    const f = a === b ? 0.5 : (t - a) / (b - a);
    return [key, [x0 + (x1 - x0) * f + 0.5, y0 + (y1 - y0) * f + 0.5]];
  };
  const adj = new Map<string, string[]>();
  const where = new Map<string, Pt>();
  const link = (p: [string, Pt], q: [string, Pt]) => {
    where.set(p[0], p[1]);
    where.set(q[0], q[1]);
    adj.set(p[0], [...(adj.get(p[0]) ?? []), q[0]]);
    adj.set(q[0], [...(adj.get(q[0]) ?? []), p[0]]);
  };
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const tl = at(x, y) >= t;
      const tr = at(x + 1, y) >= t;
      const br = at(x + 1, y + 1) >= t;
      const bl = at(x, y + 1) >= t;
      const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = point(`h${x},${y}`, x, y, x + 1, y);
      const R = point(`v${x + 1},${y}`, x + 1, y, x + 1, y + 1);
      const B = point(`h${x},${y + 1}`, x, y + 1, x + 1, y + 1);
      const L = point(`v${x},${y}`, x, y, x, y + 1);
      const mid = (at(x, y) + at(x + 1, y) + at(x + 1, y + 1) + at(x, y + 1)) / 4 >= t;
      switch (c) {
        case 1:
        case 14:
          link(L, B);
          break;
        case 2:
        case 13:
          link(B, R);
          break;
        case 3:
        case 12:
          link(L, R);
          break;
        case 4:
        case 11:
          link(T, R);
          break;
        case 6:
        case 9:
          link(T, B);
          break;
        case 7:
        case 8:
          link(L, T);
          break;
        case 5: // tr + bl
          if (mid) {
            link(L, T);
            link(B, R);
          } else {
            link(T, R);
            link(L, B);
          }
          break;
        case 10: // tl + br
          if (mid) {
            link(T, R);
            link(L, B);
          } else {
            link(L, T);
            link(B, R);
          }
          break;
      }
    }
  }
  const loops: Pt[][] = [];
  const seen = new Set<string>();
  for (const start of [...adj.keys()].sort()) {
    if (seen.has(start)) continue;
    const loop: Pt[] = [];
    let prev = "";
    let cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      loop.push(where.get(cur) as Pt);
      const next = (adj.get(cur) ?? []).find((n) => n !== prev && !seen.has(n));
      if (!next) break;
      prev = cur;
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** Ramer–Douglas–Peucker on a closed loop (split at its first point and its farthest one). */
function simplify(loop: Pt[], eps: number): Pt[] {
  const rdp = (pts: Pt[]): Pt[] => {
    if (pts.length < 3) return pts;
    const [ax, ay] = pts[0] as Pt;
    const [bx, by] = pts[pts.length - 1] as Pt;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let best = -1;
    let at = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i] as Pt;
      const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > best) {
        best = d;
        at = i;
      }
    }
    if (best <= eps) return [pts[0] as Pt, pts[pts.length - 1] as Pt];
    return [...rdp(pts.slice(0, at + 1)).slice(0, -1), ...rdp(pts.slice(at))];
  };
  const [x0, y0] = loop[0] as Pt;
  let far = 0;
  let fd = -1;
  loop.forEach(([x, y], i) => {
    const d = Math.hypot(x - x0, y - y0);
    if (d > fd) {
      fd = d;
      far = i;
    }
  });
  const a = rdp(loop.slice(0, far + 1));
  const b = rdp([...loop.slice(far), loop[0] as Pt]);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

// ---------- the icon ----------

/** The value of `--name` in the starter's :root. */
export function token(css: string, name: string): string {
  const m = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
  if (!m?.[1]) throw new Error(`design-system/math-viz-starter.html has no ${name}`);
  return m[1].toLowerCase();
}

/** The mark as one evenodd path in icon coordinates. */
export function markPath(png: Buffer): string {
  const { w, h, alpha } = pngAlpha(png);
  const loops = trace(w, h, alpha).map((l) => simplify(l, 0.12));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const l of loops) {
    for (const [x, y] of l) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  const s = BOX / Math.max(x1 - x0, y1 - y0);
  const ox = (SIDE - (x1 - x0) * s) / 2 - x0 * s;
  const oy = (SIDE - (y1 - y0) * s) / 2 - y0 * s;
  const n = (v: number) => {
    const r = Math.round(v * 10) / 10;
    return Object.is(r, -0) ? "0" : String(r);
  };
  return loops
    .map(
      (l) =>
        `M${l.map(([x, y], i) => `${i === 1 ? "L" : i > 1 ? " " : ""}${n(x * s + ox)} ${n(y * s + oy)}`).join("")}Z`,
    )
    .join("");
}

export function iconSvg(path: string, bg: string, accent: string, title: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIDE} ${SIDE}">`,
    `<title>${title}</title>`,
    `<rect x="0" y="0" width="${SIDE}" height="${SIDE}" fill="${bg}"/>`,
    `<path fill="${accent}" fill-rule="evenodd" d="${path}"/>`,
    "</svg>",
    "",
  ].join("\n");
}

/** Every target's icon, from the web version in `mv`. */
export function icons(mv: string = MV): Record<TargetId, string> {
  const assets = JSON.parse(readFileSync(join(mv, "docs", "brand-assets.json"), "utf8")) as {
    brand: string;
  };
  const b64 = /^data:image\/png;base64,(.+)$/.exec(assets.brand)?.[1];
  if (!b64) throw new Error("docs/brand-assets.json `brand` is not a PNG data URI");
  const path = markPath(Buffer.from(b64, "base64"));
  const css = readFileSync(join(mv, "design-system", "math-viz-starter.html"), "utf8");
  const bg = token(css, "--bg-deep");
  const out = {} as Record<TargetId, string>;
  for (const [t, name] of Object.entries(ACCENT) as [TargetId, string][]) {
    out[t] = iconSvg(path, bg, token(css, name), loadTarget(t).name.en);
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
