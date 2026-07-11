---
name: math-viz-tool
description: >-
  Build a new single-file, zero-dependency interactive 3D visualization teaching tool for a
  specified math or physics concept in this repo, following the design system under `design-system/`.
  Use this skill WHENEVER the developer wants to create, add, make, or build a new visualization,
  teaching tool, interactive demo, or "可视化" for any mathematical or physical concept — e.g.
  三角函数 / 傅立叶 / 复数 / 向量 / 圆锥曲线 / 导数 / 概率分布 / 简谐振动 — even if they only say
  "做一个 X 的可视化", "add a tool for Y", or "可视化一下 Z" without naming the design system or the
  starter template. Do NOT use it for editing the design system docs themselves, or for building
  unrelated web pages / charts / dashboards that aren't a math-concept viz built on this engine.
---

# Building a Math-Viz Teaching Tool

This repo is a collection of single-file, zero-dependency HTML tools that each turn one abstract
concept into a rotatable 3D scene. They all share one Canvas-2D engine and one strict visual
identity — the dark "oscilloscope / astronomical instrument" look. Your job with this skill is to
produce a **new tool that a stranger could not tell apart** from the existing ones: same engine,
same tokens, same drawing language, same interaction grammar.

The design system is the source of truth. Do not invent tokens, colors, fonts, or engine behavior —
reuse what's already defined. Your creativity goes into the **math** (what to draw and which angle
makes it click), not into the chrome.

## Read these first — they are authoritative

Before writing any code, read both, in full:

1. **`design-system/math-viz-design-system.md`** — tokens, transparency vocabulary, layout, component
   specs, the Canvas drawing language (§4), the interaction vocabulary (§5), data/state conventions
   (§6), and the new-tool checklist (§8). This is the spec; follow it literally.
2. **`design-system/math-viz-starter.html`** — the engine + a declarative config layer. Note the three
   edit points marked ①②③: `PARAMS`, `SCENES`, `pushSample`. Everything below them (camera, projection,
   drawing parts, interaction, main loop) is the engine — you compose with it, you don't rewrite it.

`CLAUDE.md` has a condensed architecture overview if you want orientation before the deep read.

## The five non-negotiable principles (from the spec)

Hold these in mind the entire time — every decision serves them:

1. **Single file, zero dependencies.** One `.html` that opens offline. No CDNs, no build.
2. **The canvas is the star.** Full-screen render; title, tabs, panel, hint all float over it and never
   split it.
3. **One curve, one color, reused in six places** — legend dot, curve body, projection dash, head glow
   dot, bold readout value, formula label. Curves take colors in the fixed order
   rose → violet → emerald → orange; cyan is reserved for source geometry / UI accent; amber for
   measurement annotations (θ, period).
4. **All math symbols in serif italic** (`--font-math`), in Canvas and HTML alike.
5. **Every tool needs an epiphany view (顿悟视角).** Beyond `iso`, at least one orthographic preset
   that makes the abstract relation suddenly visible (e.g. "the circle collapses into a vibrating
   segment"). A tool without one has failed, no matter how polished — so nail this before you build.

## Hold these exactly — this is where a capable agent drifts

The repo is well-documented and you are smart, so most of a tool comes out right on instinct. The
real value here is the handful of strict points that instinct quietly bends — and bending them is
exactly what makes a new tool feel *almost* like the others but subtly off. Guard these three:

- **The eyebrow is a brand constant: `INTERACTIVE MATH · 交互式数学`, verbatim.** It is tempting to
  make it topic-specific (`COMPLEX PLANE`, `FOURIER`…), but every tool in the fleet shares this exact
  line — it is part of how a stranger cannot tell the tools apart. Put the topic in the `<h1>`, never
  in the eyebrow.
- **Engine diff = zero.** Everything below ①②③ in the starter is shared infrastructure, and the
  starter is its single source of truth. If you catch yourself editing `drawAxes` or any engine
  function to fit your scene, stop and add a *scene-level* helper above `SCENES` instead (this is how
  `fourier-essence-3d.html` adds its own axes). Forking the engine per-tool fragments the fleet and
  silently breaks the "copy the starter" contract for whoever builds the next tool.
- **The shared clock governs the streamed history, not every quantity.** §6's "same motion, different
  measurement" is about the time-evolving history: one `theta` integrates the clock, `pushSample`
  records true values, and tabs share that state. It is **not** a mandate to animate everything. If a
  concept is clearest with operands the user *poses* — two complex numbers, two vectors, a matrix —
  give those plain sliders and let the clock drive only an optional demo or streaming view. Static
  parameters posed by sliders are fully in-model; forcing an artificial "motion" onto a static
  relationship usually hurts the pedagogy. Decide, per concept, what genuinely moves.

## Step 1 — Pin down the concept before touching code

A great tool starts from a sharp answer to: **what is the single "aha", and which viewing angle
delivers it?** Work through the design system's task-brief template (§8) with the developer. If they
gave a full spec, confirm it against this list; if the idea is vague, help think it through — this is
the highest-leverage part of the work, don't rush past it.

- **Concept & the aha** — the one relationship the tool exists to reveal, in a sentence.
- **数学内容** — the core relation / identity / theorem, written out (the actual formulas you'll plot).
- **The generating motion** — what single motion or parameter sweep produces the object? (The engine
  runs one shared clock `theta += ω·dt`; history "flows out" along the time axis z.)
- **PARAMS** — the sliders: `{ key, label (with <i>math</i>), min, max, step, value, fmt, map? }`.
- **SCENES (tabs)** — for each: name, what it draws, and **its epiphany view**. First view is always
  `iso`. Name views "object + plane" (`圆 x·y`, `正弦 y·t`).
- **Curve palette** — assign in enable order rose → violet → emerald → orange. If you need a fifth
  curve, first question whether the scene is overloaded.
- **Singularities / unbounded values** — asymptotes, poles, branch cuts? Plan for §6: clip at `CLIP`
  world units, break the polyline (`null` points) at asymptotes and draw the dashed asymptote, mark
  `∞`. Adaptive subdivision keeps steep segments smooth.

State the finalized spec back to the developer briefly before building, so a wrong assumption is
caught now and not after 800 lines of canvas code.

## Step 2 — Build from the starter, not from scratch

1. **Copy** `design-system/math-viz-starter.html` to `outputs/<slug>.html`. Match the existing naming:
   concept-based, e.g. `complex-essence-3d.html`, `conic-essence-3d.html` (`-essence-3d` for
   "本质/essence" themes, `-3d` otherwise).
2. Change `<title>` and the brand `<h1>`; the eyebrow stays `INTERACTIVE MATH · 交互式数学`.
3. Fill in **① PARAMS**, **② SCENES** (first view `iso`; `toggles` colored in enable order), and
   **③ pushSample** — record the *true value at that instant*, never a recomputed one, so mid-run
   parameter changes leave history intact (§6).
4. Compose each `draw(C)` from engine parts — reuse, don't reinvent:
   `drawAxes · drawGridXY · drawTimeGrid · drawPeriodBracket · drawCircle · drawAngleArc ·
   strokePoly · line3 · glowDot · solidDot · label3 · arrowAt`. Follow the line-type and dash
   vocabulary in §4.2 and the painter's-algorithm draw order in §4.5.
5. Write the copy to the §7 rules: Chinese UI, math symbols left as-is for the math font, `−` is
   U+2212, two decimals, `tips` explains exactly one aha and points at a specific view or toggle.

Keep the diff to the engine at zero unless a genuinely new primitive is needed — and if it is, add it
in the engine's style and consider whether it belongs back in the starter.

## Step 3 — Verify by actually running it (don't declare done on faith)

The design system's acceptance gate plus a real look in a browser:

- **Syntax check** the embedded script (`node --check` can't read `.html`, so extract first):
  ```
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' outputs/<slug>.html | node --check /dev/stdin
  ```
- **Open it and look.** Serve the repo (`python3 -m http.server`) and load the file, or use the
  `/run` skill / browser tools. Then confirm, by interacting:
  - It renders with no console errors; drag rotates, scroll zooms, double-click re-centers.
  - Each tab's **epiphany view** actually makes the relation pop (press its number key).
  - Curves obey "six places, one color"; math is serif italic everywhere.
  - **Pause still lets the camera move** (pause freezes only the simulation).
  - Changing a slider mid-run does **not** rewrite past history.
  - Mobile: the panel collapses into a bottom drawer at ≤760px.
- **Run the §8 self-check list** and fix anything that fails.

Only after the run looks right should you tell the developer it's done — and point them at the epiphany
view so they see the payoff immediately.

## Quick reference: the SCENES shape

```js
myScene: {
  label: '页签名',
  brand: '一句话讲清数学本质 + 一句交互引导',
  tips:  '一个顿悟点 + 指向具体视角或开关',
  views: {
    iso:   { label: '立体', az: -0.7, el: 0.35, dist: 8.5, tx: 0, ty: 0, tz: 0 }, // first = iso
    front: { label: '正视 x·y', az: 0.001, el: 0.02, dist: 6.5 },                 // epiphany view
  },
  toggles: [ { key: 'showTrail', label: '运动轨迹', color: '#fb7185', checked: true } ],
  sampleWindow: () => TAU / state.omega * 1.05 + 0.3,
  draw(C) { /* compose from engine parts; painter's order per §4.5 */ },
  readout() { return readoutHead() + '<div class="sinC">…<b>value</b></div>'; },
}
```
