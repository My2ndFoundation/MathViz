# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A collection of **single-file, zero-dependency HTML math/physics visualization teaching tools** with a bilingual Chinese/English UI (Chinese default). Each `.html` opens directly in a browser — no build system, package manager, or dependencies. All tools share one Canvas-2D engine that renders a rotatable 3D scene ("dark oscilloscope / astronomical instrument" aesthetic).

- `design-system/math-viz-design-system.md` — **the design spec and source of truth** (Chinese). Tokens, components, canvas drawing language, interaction vocabulary.
- `design-system/math-viz-starter.html` — the canonical starting template. Contains all design tokens + the full engine + a declarative config layer. **Copy this to make a new tool.**
- `outputs/*.html` — finished tools built on the engine.
- `tools.json` — the registry of record for every published tool (id, bilingual copy, semver `version`, `engine`, `changelog`); `index.html` embeds a mirrored `TOOLS` array, and both are updated together whenever a tool is published or upgraded.
- `app.html` — the navigation shell: a collapsible sidebar plus a main content area that loads a tool in an **iframe** (iframe, not injection: every tool is a whole page with its own top-level `state`/`cam`, full-screen canvas and keyboard shortcuts, so two of them in one document would collide). It reads `tools.json` at runtime when served, and falls back to its own embedded minimal list (id / file / cat / accent / title / kicker) when opened from `file://`. That fallback list is **generated, not hand-maintained** — see below. Tools themselves are never modified and stay independently openable.
- `archive/` — retired tools that are no longer registered or linked from the landing page (e.g. `trig-essence-3d.html`, the original hand-written tool the design system was extracted from).
- `scripts/sync_registry.py` — propagates `tools.json` into its mirrors (see below).

## Registry sync is automated

`tools.json` is the single source of truth; `scripts/sync_registry.py` propagates it:

- **`app.html`** is rewritten automatically between the `/* >>> GENERATED:TOOLS */` … `/* <<< GENERATED:TOOLS */` markers. Never edit that block by hand.
- **`index.html`** is only *checked* (id / file / cat / accent against `tools.json`), because its `TOOLS` entries carry hand-written `desc`/`tag` copy that a generator shouldn't invent. If the check fails, write the entry yourself.

Three layers keep it honest, so "remember to mirror it" is never a step:

```bash
python3 scripts/sync_registry.py          # rewrite app.html, report index.html gaps
python3 scripts/sync_registry.py --check  # verify only; exit 1 if out of sync
```

- `.githooks/pre-commit` runs it on any commit touching `tools.json` / `app.html` / `index.html`, re-stages a regenerated `app.html`, and blocks the commit if `index.html` still lags. Enable once per clone: `git config core.hooksPath .githooks` (bypass with `--no-verify`).
- `.github/workflows/registry-sync.yml` re-runs `--check` on every push and PR, plus the `node --check` syntax gate over `app.html`, `index.html` and every tool — so a clone without the hook configured still can't merge drift.

## Commands

There is no build/lint/test toolchain. To develop:

- **Run**: open the `.html` file directly in a browser (or use the `/run` skill).
- **Syntax check** (the design system's only acceptance gate, §8): `node --check` cannot read `.html`, so extract the inline script first:
  ```
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' outputs/FILE.html | node --check /dev/stdin
  ```

## Design-system-first discipline

The markdown spec governs the code. When changing a design token, **change the doc first, then the code** (per the spec's footer). Every tool must honor the five non-negotiable principles and pass the §8 self-check.

The five principles: (1) single file, zero dependencies; (2) canvas is the star — full-screen, all UI floats over it and never splits it; (3) **one curve = one color reused in six places** (legend dot, curve body, projection dash, head glow dot, bold readout value, formula label); (4) all math symbols in serif italic (`--font-math`: Georgia → Songti SC), in Canvas and HTML alike; (5) every tool needs an "epiphany view" (顿悟视角) — an orthographic preset that makes the abstract relation suddenly visible.

## Engine architecture (in the starter and every output)

- **Orbital camera** in spherical params `{az, el, dist, tx, ty, tz}`, up = (0,1,0). Perspective projection `FOCAL = 1.2·min(H, W·1.1)`, near-clip `NEAR = 0.15` with per-segment clipping. Polylines support `null` break points (for asymptote discontinuities).
- **World coordinates**: x horizontal, y vertical (geometry lives on plane z=0), **z = time axis** (visible length `WAVE_LEN = 8`). History curves "flow out" of the geometry along +z; the newest sample sits at z=0.
- **Fixed painter's-algorithm draw order**: background → grid → reference dashes → axes/ticks → history curves → structure lines → circle → angle arc → radius → projection dashes → head glow dots → main point → formula labels.
- **Single shared state, per-tab view**: all tabs share one `state` (params) and `samples` (history) — the theme is "same motion, different measurement." Only the camera and display toggles are per-tab; each tab remembers its own camera.
- **History invariant**: `pushSample()` records the *true value at that instant*. Changing a parameter mid-run never recomputes past samples — the historical waveform keeps its real trajectory.
- Phase is integrated (`theta += ω·dt`); φ is applied at display only (`th = theta + phi`). `dt` is clamped to `[0, 0.05]` to survive background-tab jumps.
- **Pause freezes only the simulation** — camera, rendering, and sliders keep working (the current point uses live params).

## Authoring model — three edit points

New tools modify only three things, all marked ①②③ near the top of the `<script>`. Everything below (camera / projection / drawing parts / interaction / main loop) is the engine and is normally untouched.

1. **`PARAMS`** — declare sliders (UI auto-generated): `{ key, label, min, max, step, value, fmt, map? }`. `label` may contain `<i>math symbol</i>`.
2. **`SCENES`** — one key = one tab. Required: `label, brand, tips, views (first entry MUST be `iso`, the double-click home), toggles (curves colored in fixed order rose → violet → emerald → orange), draw(C), readout()`. Optional: `sampleWindow()`, `views[x].onSelect` (linkage, e.g. auto-enable a curve).
3. **`pushSample()`** — extend the recorded sample fields (record true values).

Compose `draw(C)` from engine parts: `drawAxes / drawGridXY / drawTimeGrid / drawPeriodBracket / drawCircle / drawAngleArc / strokePoly / line3 / glowDot / solidDot / label3 / arrowAt`. See §8 of the spec for the full new-tool checklist and the Claude Code task-brief template.

Note: the original hand-written tool the design system was extracted from now lives in `archive/trig-essence-3d.html` and predates the declarative PARAMS/SCENES layer — follow the starter's declarative model, not that file. `outputs/trig-essence-3d-new.html` is its non-declarative legacy replacement: a hand-written static panel, bilingual via `data-i18n` attributes plus a page-local `STR` dict (not the PARAMS/SCENES `RELABEL` mechanism), `engine-version: pre-declarative`. `fourier-essence-3d.html` is a current example that uses the declarative engine.

## Conventions

- UI is bilingual (zh default, en switchable); code comments and the design doc are Chinese.
- Colors are declared as CSS vars in `:root` and reused as **the same literal values inside Canvas**. Curve enable order is fixed: rose → violet → emerald → orange.
- Text: minus sign is U+2212 (−), values default to 2 decimals, angles are integers, `|v| > 999` shows ±∞.
- `tips` copy explains exactly one epiphany and points to a specific view or toggle.
- All user-facing copy is a `{zh,en}` object rendered through the engine's `t()` (§9); the language toggle switches instantly and persists via `localStorage`, and `?lang=en`/`?lang=zh` opens a tool directly in that language.
- Versions land in three places on every publish or upgrade: `tools.json` (`version` + `changelog`), the HTML's `tool-version` meta + header changelog block, and the panel version badge (which reads the meta, so it never needs separate editing) (§10).
