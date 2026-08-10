---
name: crypto-viz-tool
description: >-
  Build or upgrade a single-file, zero-dependency interactive cryptography visualisation inside the
  `cryptography/` subproject. Use this skill WHENEVER the developer wants to create, add, make, or
  build a visualisation, teaching tool, interactive demo, or "可视化" for any cryptography or
  cryptanalysis concept — e.g. 凯撒 / 维吉尼亚 / Playfair / Hill / 换位 / Enigma / 转轮机 /
  频率分析 / Kasiski / 一次一密 / DES / AES / RSA / Diffie-Hellman / 哈希 / SHA / BB84 / E91 /
  量子密钥分发 / 后量子 — even if they only say "做一个 X 的可视化", "add a tool for Y", or
  "可视化一下 Z". Also use it when improving, adjusting, upgrading, or 改进/调整/升级 an existing
  tool under `cryptography/tools/` — version bump and changelog rules apply. Do NOT use it for the
  maths tools in `outputs/` (that is `math-viz-tool`), for anything under `chess/`, or for editing
  the architecture spec itself.
---

# Building a CryptoViz Teaching Tool

`cryptography/` is an **independent subproject**, parallel to `chess/`. It shares MathViz's
identity, design philosophy, repository and deployment — and shares **nothing** else. One rule
governs everything below:

> **MathViz owns the ecosystem; Cryptography owns itself.**

## Scope — every path you touch lives here

```
Target root:  cryptography/
Tool output:  cryptography/tools/
Skeleton:     cryptography/tools/_skeleton.html
Registry:     cryptography/cryptography-tools.json
Core:         cryptography/core/          (+ cryptography/core/algos/)
Examples:     cryptography/examples/
Build:        cryptography/scripts/inline_core.py
Validation:   cryptography/scripts/check.py
```

## The hard rule

> **Never register a CryptoViz tool in `/tools.json`.**

The root registry manages `/outputs/*.html` only. There are three registries — root, `chess/`,
`cryptography/` — and they are mutually disjoint (architecture spec §8). Equally: never point
`cryptography-tools.json` at anything outside `cryptography/tools/`.

Do not modify `/tools.json`, `/app.html`, `/index.html`'s `TOOLS` array, `/scripts/sync_registry.py`,
`outputs/**`, or `chess/**`. The only root file with a Cryptography reference is `/index.html`'s
Subprojects card, and it already exists.

## Authoring flow

1. **Start from the skeleton.** `cp cryptography/tools/_skeleton.html cryptography/tools/crypto-<name>.html`.
   Never invent a new tool shell — the skeleton carries the design tokens, i18n, tab system,
   animation clock, transport controls and the GENERATED markers.
2. **Change `GENERATED:ALGOS none` to the algorithms this page actually calls**, e.g.
   `GENERATED:ALGOS vigenere.js,beaufort.js`. `none` is the template's explicit opt-out; leaving
   the list *empty* is a hard error on purpose (empty is the shape a slip takes).
3. **Algorithms go in `core/algos/`, not in the page.** A tool page decides how to draw, animate
   and explain; the algorithm module only defines the maths (`encrypt` / `decrypt` / `bruteForce` / …).
   Shared analysis (frequency, χ², IoC, Kasiski, hill-climbing) belongs in `core/cryptanalysis.js`.
4. **Never hand-edit inside a `GENERATED:` region.** Edit `core/`, then run
   `python3 cryptography/scripts/inline_core.py`.
5. **Register it** in `cryptography-tools.json`, and add the matching entry to the `FALLBACK` array
   in **both** `cryptography/app.html` and `cryptography/index.html` — `file://` has no other data
   source, so a missing FALLBACK entry means the tool is invisible offline while fine online.
6. **Run the gate**: `python3 cryptography/scripts/check.py` must exit 0.

## Fixed vocabulary

- **Chapters** (`chapter`, 1–5, no others): 1 古典密码 · 2 机械密码 · 3 密码分析 ·
  4 现代密码学 · 5 量子时代密码学. Both `app.html` and `index.html` group by this field and their
  `CHAPTER_LABELS` objects must stay byte-identical.
- **Accents**: only `cyan` `rose` `violet` `emerald` `orange`. Anything else renders as the
  magenta `--trace-unpaired` sentinel, which no tool may ever legitimately use.
- **i18n**: storage key `cryptography-lang` (never `mathviz-lang`, never `chess-lang`); nav state
  `cryptography-nav`. Priority `?lang=` → localStorage → **`en`**. All user-facing copy is a
  `{zh, en}` object.

## Non-negotiables inherited from the design system

1. Single file, zero dependencies — `file://` double-click must work.
2. Canvas is the star: full-screen, panels float over it and never split it.
3. One curve = one colour, reused in six places (legend dot, curve body, projection dash, head glow,
   bold readout value, formula label). Enable order: rose → violet → emerald → orange.
4. All maths symbols in serif italic — use `VizEngine.mathFont(px, weight)`, don't assemble font
   strings by hand.
5. Every tool needs an **epiphany view** (顿悟视角): a preset that makes the abstract relation
   suddenly visible. For Caesar it is the mod-26 helix, where "wrapping around" becomes one turn.

## Fitting things to the canvas — the rule five bugs taught

Canvas neither clips nor complains: content that doesn't fit simply runs off the edge, and
the clipped cells still look like part of the message. It is invisible on a desktop viewport,
so it ships. This has happened **five** times here (Caesar's message strip, Hill's break tab,
Quagmire's Chinese copy overflowing by 84.5px, Morse's readings list, and the skeleton's
title/tab-bar overlap).

Every one had the same shape:

```js
const cell = clamp((availW - gap * (n - 1)) / n, MIN, MAX);   // WRONG
```

Fixing the cell **count** first and then clamping the width means `MIN` turns "doesn't fit"
into "draws past the edge". Do it the other way round — use `VizEngine.fitCells()`:

```js
const { n, cell, total, truncated } = VizEngine.fitCells(availW, letters.length, { gap: 3 });
// draw n cells; if truncated, say so — an ellipsis, or "1–24 / 26"
```

Truncation must be **stated**, never left to the canvas edge. And always check 375px before
you call a tool done; the design system's five principles say the canvas is the star, which
means it is also the thing most likely to lie to you at a width you didn't look at.

## Versioning

Three places move together on every publish or upgrade:
registry `version` + `changelog` → the HTML's `<meta name="tool-version">` → the panel badge
(which reads the meta, so it needs no separate edit). `check.py` compares the first two.
**The version is also a cache key** — `app.html` and the gallery stamp `?v=<version>` onto every
URL, because GitHub Pages plus browser caching has previously hidden a shipped upgrade behind a
stale copy.

## Portability is a hard constraint, and it is enforced

`cryptography/` must still run correctly after being copied somewhere else entirely. So **no file
under `core/`, `examples/` or `tools/` may contain a parent-directory relative path**. The only
outward references in the whole subtree are the single `PARENT_HOME` constant in `app.html` and
`index.html` (the "back to MathViz" link, which hides itself when the parent is absent).
`check.py` counts these; adding one anywhere else fails the build.

Two related traps the gates also cover:
- Never write a literal `<`+`script>` sequence in a `core/` or `examples/` file, **including inside
  comments** — the repo's awk extraction recipe silently drops such lines, and paired with a
  `<`+`!--` it can flip the HTML tokenizer and swallow the whole page.
- `CRYPTO-CORE` must be inlined **before** `CRYPTANALYSIS` and `ALGOS`. Those modules capture
  `root.CryptoCore` at load time; get the order wrong and the page loads clean, then dies on the
  user's first interaction.

## Reference

Architecture spec: `docs/superpowers/cryptography.md`.
Design system: `design-system/math-viz-design-system.md` (the visual language is shared).
