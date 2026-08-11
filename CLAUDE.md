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
- `chess/` and `cryptography/` — two **independent subprojects**, each with its own registry, core modules, navigation shell and validation gate. Everything above this line describes the maths collection only; see "Subprojects" below before touching either.

## Registry sync is automated

`tools.json` is the single source of truth; `scripts/sync_registry.py` propagates it:

- **`app.html`** is rewritten automatically between the `/* >>> GENERATED:TOOLS */` … `/* <<< GENERATED:TOOLS */` markers. Never edit that block by hand.
- **`index.html`** is *partly* generated: `version` / `engine` on every `TOOLS` entry are **rewritten** from `tools.json` (they are facts, not copy), while id / file / cat / accent are only *checked*, because the entries also carry hand-written `desc`/`tag` copy a generator shouldn't invent. If the check fails, write the entry yourself.

  The version rewrite exists because the old check ignored those two fields, and **48 of 62 entries had silently drifted** — `pi`/`phi` sat at `1.0.0` in the gallery while `tools.json` said `1.2.0`. A mirrored field that nothing verifies will drift; the gallery now prints those numbers on the cards, and printing a wrong version is worse than printing none.

**Version numbers are also cache keys.** `app.html` stamps every iframe URL as `<file>?lang=<l>&v=<version>`, and the gallery cards do the same. GitHub Pages serves HTML with `cache-control: max-age=600` and browsers hold copies well past that — a shipped upgrade could sit invisible behind a stale copy until the user cleared their cache (this happened). The version in the URL makes a new release a new URL. The gallery page itself gets `?v=<fingerprint>` — a djb2 hash over all `id:version` pairs — since it embeds its own copy of the registry. Consequences: `minimal()` in `sync_registry.py` must keep emitting `version`, and app.html's runtime `tools.json` mapping must keep copying `d.version`. Drop either and every URL silently becomes `?v=0`, which is the same as having no cache key at all.

Three layers keep it honest, so "remember to mirror it" is never a step:

```bash
python3 scripts/sync_registry.py          # rewrite app.html, report index.html gaps
python3 scripts/sync_registry.py --check  # verify only; exit 1 if out of sync
```

- `.githooks/pre-commit` runs it on any commit touching `tools.json` / `app.html` / `index.html`, re-stages a regenerated `app.html`, and blocks the commit if `index.html` still lags. Enable once per clone: `git config core.hooksPath .githooks` (bypass with `--no-verify`).
- `.github/workflows/registry-sync.yml` re-runs `--check` on every push and PR, plus the `node --check` syntax gate over `app.html`, `index.html` and every tool — so a clone without the hook configured still can't merge drift.

## Subprojects — `chess/` and `cryptography/`

> **MathViz owns the ecosystem; each subproject owns itself.**

`chess/` and `cryptography/` sit beside the maths collection, not inside it. They share the
repository, the deployment, the design philosophy and the single-file/bilingual rules — and share
nothing else. Both have the same shape:

```
<sub>/app.html  <sub>/index.html  <sub>/<sub>-tools.json  core/  tools/  scripts/
```

**Registry isolation is a hard boundary.** Three registries, mutually disjoint:
`tools.json` → `outputs/*.html`, `chess/chess-tools.json` → `chess/tools/*.html`,
`cryptography/cryptography-tools.json` → `cryptography/tools/*.html`.
**Never register a chess or cryptography tool in the root `tools.json`**, and never point a
subproject registry at `../outputs/`. `scripts/sync_registry.py` does not govern subprojects; each
has its own gate, run by `.githooks/pre-commit` and `.github/workflows/registry-sync.yml`:

```bash
python3 chess/scripts/check.py
python3 cryptography/scripts/check.py
```

**Editing model (both).** `core/**/*.js` is the single edit source; `scripts/inline_core.py`
injects it into the `/* >>> GENERATED:X */ … /* <<< GENERATED:X */` regions of `tools/*.html` so
each page stays self-contained and `file://`-openable. **Never hand-edit a GENERATED region** —
change `core/`, then re-run the script. Each subproject also owns its i18n keys
(`chess-lang` / `chess-nav`, `cryptography-lang` / `cryptography-nav`) and defaults to **English**,
unlike the maths tools' Chinese default.

### cryptography/ specifics

**All five chapters are built — 27 tools, 16 gates.** The planned scope is closed, so new work here
is upgrades, fixes, or tools beyond the original plan, not "continue chapter N".

Chapters are a fixed closed set — 1 古典密码 · 2 机械密码 · 3 密码分析 · 4 现代密码学 ·
5 量子时代密码学; both `app.html` and `index.html` group by `chapter` and their `CHAPTER_LABELS`
must stay byte-identical. Accents are the closed set cyan / rose / violet / emerald / orange.
New tools are copied from `cryptography/tools/_skeleton.html` — the template opts out of algorithms
with `GENERATED:ALGOS none` and *does* participate in inlining; an **empty** list is a hard error on
purpose, because empty is the shape a slip takes (write the markers, fill them in later).
Authoring workflow: `.claude/skills/crypto-viz-tool/SKILL.md`. Architecture: `docs/superpowers/cryptography.md`.
**How it was built and what to know before changing it: `docs/superpowers/prompts/cryptography-handoff.md`** —
it carries the API signatures that trip people up, the four quantum gates, and every brief error that
implementers caught.

Two more things that bite and are not guessable. **The FALLBACK arrays must carry `version`**: the
gallery's version badge and the `?v=` cache key both read it, and under `file://` FALLBACK is the only
data source — omit it and every card offline reads `vundefined` while the site looks perfect.
`fallback_check()` only compares **id sets**, so it will not catch this for you. And **`_skeleton.html`
deliberately has no `GENERATED:QUANTUM-SIM` markers** — inlining a quantum simulator into a Caesar page
is dead weight; the pages that need it add the pair themselves.

Three invariants `check.py` enforces that you will not guess, each with an incident behind it:

1. **Portability.** No file under `core/`, `examples/` or `tools/` may contain a parent-directory
   relative path. The whole `cryptography/` directory must still run after being copied elsewhere;
   the only outward references are the single `PARENT_HOME` constant in `app.html` / `index.html`
   (the "back to MathViz" link, which hides itself when the parent is absent). This decays
   silently otherwise — one stray `../outputs/foo.js` breaks nothing until someone moves the folder.
2. **No literal `<` + `script` + `>` sequence in a `core/` or `examples/` `.js` file, including
   inside comments.** The repo's `awk '/<script>/{f=1;next}…'` extraction recipe silently drops such
   lines, so the syntax gate would be checking different bytes than the browser runs; paired with a
   `<` + `!--` it can flip the HTML tokenizer and swallow the page. One was inherited from chess.
3. **`CRYPTO-CORE` must be inlined before `CRYPTANALYSIS`, `ALGOS` and `QUANTUM-SIM`.** Those modules
   capture `root.CryptoCore` at load, so the wrong order gives a page that loads clean and then dies on
   the user's first interaction. Verified: with the order swapped, the inline gate, the syntax gate and
   the algorithm-evaluation gate are all green — only the order gate is red.

A related trap worth knowing when adding gates: `node -e` **and** `node` reading a script on stdin
both define `module` and `require`, so a UMD module tested that way takes its **node** branch. To
exercise the browser branch you need `vm` with a bare context. A gate that tests the wrong branch is
worse than no gate — it advertises coverage it does not have.

## Commands

There is no build/lint/test toolchain. To develop:

- **Run**: open the `.html` file directly in a browser (or use the `/run` skill).
- **Syntax check** (the design system's only acceptance gate, §8): `node --check` cannot read `.html`, so extract the inline script first:
  ```
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' outputs/FILE.html | node --check /dev/stdin
  ```

**A green gate on your machine is not a green gate.** After opening a PR, actually read the CI verdict:

```bash
gh pr checks <PR#>
```

Everyone here develops on macOS; CI runs on Linux, and the two disagree in ways no local run can show you. This is not hypothetical — `chess/scripts/check.py` passed locally while CI failed on **four consecutive merges** (#97, #98, #99, #100), including one that changed nothing but two markdown files. Cause: Linux caps a *single* `argv` element at `MAX_ARG_STRLEN` = 128 KiB (a different limit from `ARG_MAX`), macOS has no such per-argument cap, and `algos_roundtrip_check` was passing a 225 KB inlined block as one `node -e` argument. For four merges, `registry-sync.yml` — the gate whose whole job is "a clone without the hook still can't merge drift" — was reporting red into a void.

That specific hole is now closed structurally (`check.py`'s `run_node()` puts scripts on stdin, and loudly refuses an oversized `argv` script *on your machine*). The habit is what stops the next one: **the gate you never look at is not protecting you.**

## Parallel work discipline

Multiple sessions and multiple build agents routinely run against this repo at once. Five rules, each earned the hard way:

1. **Give every parallel builder its own worktree.** Launch build subagents with `isolation: "worktree"` so each gets an isolated copy of the repo. Distinct `outputs/*.html` files do *not* make concurrent work safe — the collisions happen through shared state, not shared files.

2. **Never `git add -A` / `git commit -a` while other work may be in flight. Stage explicit paths.** A blanket stage sweeps up whatever another session happens to have half-written. This actually happened: a replay-progress fix committed an unrelated tool's mid-build snapshot, and that unfinished file rode a PR onto `main` unregistered. Cheap to avoid, tedious to unpick.

3. **Always pass an explicit `tabId` to browser tools.** Untargeted `javascript_exec` lands on whatever tab is fronted — which may be another agent's page. Two agents have silently driven each other's tools, producing verification numbers attributed to the wrong file. When it matters, assert `TOOL.id` in the probe itself before trusting a measurement.

4. **The scratchpad is shared — prefix every temp file with your task.** The scratchpad directory is per-session in name only: two agents on the same repo path land in the same directory. This actually happened in chess phase 6 — two sessions each wrote `probe-quote.js`, and one silently overwrote the other's driver mid-verification. Name them `t5-probe.js` / `t8-probe.js`, never `probe.js`.

5. **A pre-commit hook that regenerates files can pull another session's uncommitted work into your commit.** `.githooks/pre-commit` re-runs `chess/scripts/inline_core.py`, which reads `chess/core/**/*.js` **off disk** — not from the index. So whatever another session has saved but not committed gets inlined into the HTML the hook then re-stages. This is how one chess phase-6 commit carried off another session's half-written BLANK markers. **"Stage explicit paths" does not stop this** — the hook stages more after you do. Read every path in `git status --short` after the hook runs, not just before.

Before committing, `git status --short` and confirm every listed path is yours.

## Verifying your own work

Four rules from a 27-tool build in which **5 of the 13 subagents dispatched for chapters 4–5 returned
a factual error in the brief they were given, and every one of them was right** (a sixth surfaced a
real bug in shared core). The failures were never sloppiness; they were measurements that could not
have detected what they claimed to rule out.

1. **A result of "zero" or "all passed" is not evidence until a negative control fails.** Break the
   thing the check guards and confirm it goes red. Three probes shipped in one session without this
   and all three measured nothing: one compared `String(object)` to itself (`'[object Object]'`) and
   reported a structural law "confirmed" over 3600 cases; one ran a loop whose body never executed
   because every candidate was shorter than the required length; one enumerated too small a coefficient
   range and reported a lattice mismatch that did not exist. Each looked like a strong positive result.
   This is the same family as the `node -e` branch trap below — *a method that structurally cannot
   observe the thing it is used to exclude.*

2. **For standard algorithms, check against an independent implementation, not against the agent that
   used the constant.** Node's built-in `crypto` is a free OpenSSL: AES-128-ECB, SHA-256 and MD5 over
   every byte length 0–200 (covers the 55/56 and 63/64 padding boundaries). **OpenSSL 3 disables single
   DES**, but `3DES(k,k,k) === DES`, so `des-ede3-ecb` with a tripled key still gives a reference. An
   implementation agreeing with a vector *you* supplied only proves self-consistency.

3. **Put the measurement protocol in a brief, never the expected value.** Numbers that reproduce on
   your bench routinely do not reproduce on theirs — different corpus, different RNG stream ordering,
   different sample size — and an implementer told to match a number will either waste time or quietly
   tune until it matches. Ask for their number and the protocol that produced it. When the two disagree,
   prefer the claim that holds on both benches over the sharper one that holds only on yours.

4. **Verify the artifact, not the intention.** `git mv` stages the *pre-edit* blob, so a commit made
   after editing-then-moving a file can record only the rename — `git show --name-status` said `R100`
   while 198 lines of content sat unstaged. Read what the commit actually contains.

When a constant has already been "fixed" once by making it bigger, **do not make it bigger again**.
The narrow-screen tab bar was moved 52 → 66px for exactly this bug and broke again, because both fixes
assumed a single-line title. Making the assumption *true* (`white-space:nowrap`) cost less than moving
the constant would have, and cannot recur.

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
