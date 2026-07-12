# MathViz Batch Build-out (from batch.md)

**Goal:** Execute the new-tool + enhancement roadmap in `docs/superpowers/batch.md`, then re-categorize the landing page by math subject area.

**Base:** branch synced to `main` (16 tools). Decisions: borderline items **extended as tabs** (not standalone); **execute everything** in P1→P2→P3 waves via parallel `math-viz-tool` subagents.

## Orchestration rules (every subagent)

- Use the `math-viz-tool` skill. Do Steps 1–3 (build + syntax gate + §8 self-check). **Do NOT do Step 4 registration.**
- **Never touch `tools.json`, `index.html`, or `README.md`** — the orchestrator centralizes all registry writes + the final by-subject re-categorization.
- DO set, inside the tool's own HTML: `<meta name="tool-version">`, `<meta name="engine-version">`, and the header changelog block.
- Syntax gate is mandatory: `awk '/<script>/{f=1;next}/<\/script>/{f=0}f' <file> | node --check /dev/stdin`.
- Eyebrow constant `INTERACTIVE MATH · 交互式数学` verbatim; engine diff = zero (scene-level helpers only); all copy `{zh,en}`; one-curve-one-color in six places; epiphany view required.
- Report back: file path, version, the epiphany view (which number key), one-line essence, syntax-gate result.

## New standalone tools (8)

| # | File | Concept | Wave |
|---|------|---------|------|
| 1 | `parametric-curves-3d` | Parametric curves = one moving point, two coordinate logs; x·t / y·t / x·y projections; circle, cycloid, Lissajous; velocity/acceleration vectors | P1 |
| 2 | `lines-planes-3d` | r=a+λd lines, (r−a)·n=0 planes, plane∩plane=line (n₁×n₂), skew lines + common perpendicular, distances | P1 |
| 3 | `hyperbolic-functions-3d` | unit circle vs unit hyperbola; cos/sin vs cosh/sinh; sector-area parameter; catenary vs parabola | P1 |
| 4 | `differential-equations-phase-space-3d` | dy/dt=f(t,y) direction field; 3D lift (t,y,y'); 2nd-order damping ζ (under/critical/over) as (t,x,v) spirals | P1 |
| 5 | `gradient-contours-surface-3d` | z=f(x,y) surface; level slices → contours; ∇f ⟂ contours, steepest ascent; directional derivative; tangent plane | P2 |
| 6 | `kinematics-projectile-3d` | (t,s,v) rectilinear → s-t / v-t / phase; (t,x,y) projectile → uniform×parabola sharing one time | P2 |
| 7 | `recurrence-iteration-dynamics-3d` | x_{n+1}=f(x_n) cobweb; (n,x_n,x_{n+1}) 3D; fixed points, convergence/divergence, Newton–Raphson | P2 |
| 8 | `energy-phase-portrait-3d` | E=½mv²+V(x); (x,v,E) energy surface; SHM/pendulum/double-well; phase portrait projection | P3 |

## Enhancements — new tab + minor version bump (5)

| # | Tool | New tab(s) | Wave |
|---|------|-----------|------|
| A | `complex-mult-3d` | De Moivre (angle ×n) · n-th roots (n even points) · loci ( |z−a|=r, |z−a|=|z−b|, arg) | P1 |
| B | `linear-essence-3d` | Eigenvectors = invariant directions; Av=λv; Aⁿv dominance; det=∏λ, trace=Σλ | P1 |
| C | `cartesian-polar-coordinate-3d` | Jacobian = local area scaling; dr·dθ cell → r·dr·dθ sector | P2 |
| D | `gaussian-essence-3d` | 2D joint distribution / covariance; ρ tilts the density hill; marginals as shadows; regression line | P3 |
| E | `calculus-essence-3d` | Volume of revolution (disk/shell) | P3 |

## Dropped
- batch §7 derivative-local-linearisation: overlaps existing `derivative-essence-3d` (tangent, dy, tangent plane). Only chain-rule is new — fold later if desired.

## Final step (orchestrator, after all builds)
1. Register all new tools in `tools.json` + `index.html` TOOLS + `README` table; bump the 5 enhanced tools' versions in `tools.json`.
2. **Re-categorize `index.html`** into subject sections (三角函数 / 复数 / 坐标与几何 / 线性代数 / 微积分与分析 / 微分方程与动力系统 / 力学 / 概率统计 / 信号处理).
3. Full syntax gate over all files; browser spot-check; commit.
