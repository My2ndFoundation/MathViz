# MathViz · 数学可视化

**Interactive visualizations for learning mathematics.** Each tool takes a single abstract concept — a trigonometric identity, a transform, a theorem — and turns it into a rotatable 3D scene you can play with in the browser. The idea is simple: *the same mathematical object, viewed from a different angle, becomes a different curve.* Rotate it until the relationship suddenly makes sense.

This is a growing collection. **More tools will be added over time.**

## Design

Every tool follows one aesthetic — a **dark "oscilloscope / astronomical instrument"**: a deep blue-black glass background, phosphor-colored traces (one curve, one color), serif-italic math notation, and a full-screen canvas as the star with a thin frost of UI floating over it. Everything is built to a shared [design system](design-system/math-viz-design-system.md).

Each tool is a **single, zero-dependency `.html` file** — open it and it runs. No install, no server, no build. Works offline, hands off to a student, embeds in an `<iframe>`.

## Tools

| Tool | Concept |
|---|---|
| [三角函数的本质 · 单位圆与正弦波](outputs/trig-essence-3d.html) | How uniform circular motion on the unit circle unfolds into the sine wave over time |
| [三角函数的本质 · 单位圆 / 正弦 / 正切](outputs/trig-essence-3d-new.html) | The circle, sine, and tangent as one motion measured different ways |
| [傅立叶变换的本质 · Fourier Essence](outputs/fourier-essence-3d.html) | How a signal winds around a circle and its frequencies emerge |

## Usage

Open any file in `outputs/` directly in a browser — no setup required.

```bash
git clone git@github.com:My2ndFoundation/MathViz.git
open MathViz/outputs/trig-essence-3d.html   # macOS; or just double-click the file
```

**Controls** (mouse or touch): drag to rotate · scroll / pinch to zoom · right-click or Shift-drag to pan · double-click to reset the view · `Space` to pause · `1`–`9` for preset viewing angles · `T` to switch tabs.

## Building a new tool

Everything needed to author a new visualization lives in `design-system/`:

- **[`math-viz-design-system.md`](design-system/math-viz-design-system.md)** — the design spec and source of truth (tokens, components, canvas drawing language, interaction vocabulary).
- **[`math-viz-starter.html`](design-system/math-viz-starter.html)** — a ready-to-run template with the full engine. Copy it, then declare your parameters and scenes; the camera, projection, and interaction come for free.

See [`CLAUDE.md`](CLAUDE.md) for the engine architecture and authoring model.

## Status

Early and evolving. The design system and engine are stable; the library of tools is being expanded.
