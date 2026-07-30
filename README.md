# MathViz · 数学可视化

**Interactive visualizations for learning mathematics.** Each tool takes a single abstract concept — a trigonometric identity, a transform, a theorem — and turns it into a rotatable 3D scene you can play with in the browser. The idea is simple: *the same mathematical object, viewed from a different angle, becomes a different curve.* Rotate it until the relationship suddenly makes sense.

This is a growing collection. **More tools will be added over time.**

## Design

Every tool follows one aesthetic — a **dark "oscilloscope / astronomical instrument"**: a deep blue-black glass background, phosphor-colored traces (one curve, one color), serif-italic math notation, and a full-screen canvas as the star with a thin frost of UI floating over it. Everything is built to a shared [design system](design-system/math-viz-design-system.md).

Each tool is a **single, zero-dependency `.html` file** — open it and it runs. No install, no server, no build. Works offline, hands off to a student, embeds in an `<iframe>`.

## Tools

| Tool | Concept |
|---|---|
| [三角函数的本质 · 单位圆 / 正弦 / 正切](outputs/trig-essence-3d-new.html) | The circle, sine, and tangent as one motion measured different ways |
| [傅立叶变换的本质 · Fourier Essence](outputs/fourier-essence-3d.html) | How a signal winds around a circle and its frequencies emerge |
| [复数乘法的本质 · Complex Multiplication](outputs/complex-mult-3d.html) | Why multiplying two complex numbers adds their angles and multiplies their lengths |
| [直角坐标 × 极坐标](outputs/cartesian-polar-coordinate-3d.html) | The same point as (x, y) or (r, θ), and the same function read as Cartesian or polar |
| [圆锥曲线的本质](outputs/conic-essence-3d.html) | Ellipse, parabola, and hyperbola as one cone sliced at continuously changing angles |
| [凯利公式的本质 · Kelly Criterion](outputs/kelly-essence-3d.html) | Why the optimal bet size is a peak, not "more" — long-run growth crests at f* = p − q/b |
| [三角恒等式的本质 · Trig Identities](outputs/trig-identity-3d.html) | The whole identity handbook as one machine: angle sums as rotation, reduction formulas as mirrors, the auxiliary angle as vector addition |
| [导数与微分的本质 · Derivatives](outputs/derivative-essence-3d.html) | Replace curved with flat: secants snapping into tangents, increments splitting into dy + o(Δx), and partial derivatives spanning the tangent plane |
| [万能代换的本质 · Weierstrass Substitution](outputs/weierstrass-essence-3d.html) | t = tan(x/2) as the slope of a chord from (−1,0): half angles from the inscribed angle theorem, rational points and Pythagorean triples, and why trig integrals rationalize |
| [反三角函数的本质 · Inverse Trig](outputs/inverse-trig-essence-3d.html) | Retrieving the angle from a value: principal branches on the circle, the y=x mirror with reciprocal slopes, and arcsin(sin θ) folding into a triangle wave |
| [极限的本质 · Limits](outputs/limit-essence-3d.html) | Order decides everything: infinitesimals under rescaling, series one order apart converging or diverging, and a microscope sorting smooth, kinked, and broken |
| [离散傅里叶变换 · The DFT](outputs/dft-essence-3d.html) | Sampling, the spectrum corridor, bit-perfect inverse reconstruction, and filtering as frequency-domain surgery |
| [线性代数的本质 · Linear Algebra](outputs/linear-essence-3d.html) | One pair of vectors read three ways: addition & dot-product shadows, the cross product as signed area, and matrices as space-warping columns |
| [高斯分布的本质 · The Gaussian](outputs/gaussian-essence-3d.html) | Where the bell curve comes from: σ at the inflection point, sums becoming bells (CLT), and random beads piling into theory |
| [微积分的本质 · Calculus, Single to Triple](outputs/calculus-essence-3d.html) | Integration as slice → evaluate → stack: FTC in 1D, then double and triple integrals as integrals of integrals |
| [泰勒展开的本质 · Taylor Expansion](outputs/taylor-essence-3d.html) | How polynomials hug a function order by order — and why they can never hug past the radius of convergence |
| [参数方程的本质 · Parametric Curves](outputs/parametric-curves-3d.html) | One moving point, two coordinate logs: lift the motion into (x, y, t) and the component graphs are its shadows |
| [三维直线与平面的本质 · Lines & Planes](outputs/lines-planes-3d.html) | Direction vectors and normal vectors pinning freedom and constraint: lines collapse to points, planes fill the view, skew lines "cross" yet never meet |
| [双曲函数的本质 · Hyperbolic Functions](outputs/hyperbolic-functions-3d.html) | cosh and sinh as the unit hyperbola's natural coordinates — u is twice the sector area, and a hanging chain is not a parabola |
| [微分方程与相空间 · Differential Equations](outputs/differential-equations-phase-space-3d.html) | Whole trajectories hiding in a local direction rule: direction fields, the (t, y, y′) lift, and damping reshaping phase-plane orbits |
| [曲面、等高线、梯度和切平面 · Surface, Contours & Gradient](outputs/gradient-contours-surface-3d.html) | Contours as horizontal slices, the gradient cutting perpendicularly through them, and the tangent plane as the local linear stand-in |
| [运动学：一个运动，多张图像 · Kinematics](outputs/kinematics-projectile-3d.html) | One motion, many graphs: s–t, v–t and the phase view for rectilinear motion; x–t, y–t and the true path for projectiles |
| [递推、迭代与稳定性 · Recurrence & Iteration](outputs/recurrence-iteration-dynamics-3d.html) | The cobweb machine: staircases converge, spirals alternate, escapes diverge — and Newton–Raphson is the same machine with tangent lines |
| [能量、势能与相图 · Energy & Phase Portrait](outputs/energy-phase-portrait-3d.html) | Phase-portrait orbits as level sets of E = ½mv² + V(x): turning points, wells, and the separatrix between bound and escape |
| [e 的本质 · The Essence of e](outputs/e-essence-3d.html) | Six roads to 2.71828…: compound limit, self-derivative, growing at its own height, unit area under 1/x, the statistical 1/e, and Euler's formula bending growth into rotation |
| [π 的本质 · The Essence of π](outputs/pi-essence-3d.html) | Five roads to 3.14159…: a wheel unrolled flat, Archimedes' polygon squeeze, the pizza jigsaw becoming πr², deterministic darts and needles voting, and the Leibniz series biting down |
| [φ 的本质 · The Essence of φ](outputs/phi-essence-3d.html) | Five roads to 1.61803…: the self-similar golden cut, Fibonacci tiling, the all-1s continued fraction making φ the most irrational number, sunflower phyllotaxis at 137.5°, and the pentagram's endless φ's |
| [i 的本质 · The Essence of i](outputs/i-essence-3d.html) | i as the quarter turn: two right angles make a U-turn, Cardano's cubic detour through √(−121), roots hiding off the paper, the conjugate mirror twin, and i unmasked as a rotation matrix |
| [条件概率与贝叶斯更新 · Conditional Probability & Bayes](outputs/conditional-probability-bayes-3d.html) | Conditioning as delete-and-renormalize: the area model, path-multiplying tree diagrams, Bayes inversion in natural frequencies, and independent vs mutually exclusive untangled |
| [指数与对数的本质 · Exponentials & Logarithms](outputs/exponential-logarithm-essence-3d.html) | Equal input steps become equal multiples; logs count the multiplications back — mirror inverses across y = x, multiplication turned into addition, doubling time and half-life |
| [函数的本质 · Functions, Maps & Inverses](outputs/function-mapping-transformations-3d.html) | A function as a mapping web that collapses into its graph face-on: input vs output transformations, composition as a relay, and inverses as a 3D page-turn about y = x |
| [二项式定理 · Pascal 三角形与概率 · The Binomial Theorem](outputs/binomial-pascal-probability-3d.html) | One C(n,k), four faces: expansion coefficient, Pascal node, left-right path count, and binomial probability weight — counting becoming the bell curve's ancestor |
| [力矩、平衡与质心 · Moments, Equilibrium & Centre of Mass](outputs/torque-equilibrium-centre-mass-3d.html) | Moments set by perpendicular distance, balance as two moment traces coinciding, plumb lines crossing at the centre of mass, and toppling when gravity's line leaves the base |
| [力、约束与自由体图 · Forces & Free-Body Diagrams](outputs/forces-free-body-diagrams-3d.html) | Isolate the body, draw only external forces, let the axes follow the constraint: incline decomposition, the normal force as a response, static friction capping at μR, and connected particles |
| [随机变量、期望与方差 · Random Variables, E(X) & Var](outputs/random-variable-expectation-variance-3d.html) | Outcomes mapped to numbers, expectation as the balance point of probability mass, variance as weighted squared distance, and how aX+b moves μ and σ differently |
| [数列与级数的本质 · Sequences & Series](outputs/sequences-series-essence-3d.html) | A sequence is a function on the integers; a series is the sequence of its accumulated terms — geometric tiling to a/(1−r), and the harmonic series proving terms→0 is not enough |
| [基底与换坐标的本质 · Basis & Change of Coordinates](outputs/basis-change-coordinates-3d.html) | The same vector pinned in space while its coordinates rewrite under a skewed basis: B as the coordinates→world relay, and near-parallel bases making the numbers explode |
| [线性方程组、秩与零空间 · Linear Systems, Rank & Null Spaces](outputs/linear-systems-rank-nullspace-3d.html) | Solving as intersecting constraints: walls collapsing to a point, three planes acting out four fates, columns painting the column space, and det→0 squashing an input line to a dot |
| [模运算、最大公约数与同余 · Modular Arithmetic, GCD & CRT](outputs/modular-arithmetic-euclid-crt-3d.html) | The integer line rolled into a helix of period m, multiplication as a shuffle that needs coprimality, Euclid cutting squares down to the gcd, and the CRT diagonal filling the residue lattice |
| [最小二乘与正交投影 · Least Squares & Orthogonal Projection](outputs/least-squares-orthogonal-projection-3d.html) | When Ax = b has no solution: b projected orthogonally onto the column space, residuals perpendicular to it, SSE as a paraboloid bowl, and the normal equations as the right angle at its bottom |
| [证明的本质 · The Essence of Proof](outputs/proof-logic-induction-3d.html) | P→Q as set inclusion (contrapositive = the same picture), quantifier order on a truth grid, n²−n+41 dying to one counterexample, and induction as a wave toppling infinitely many dominoes |
| [优化、凸性与梯度下降 · Optimisation & Gradient Descent](outputs/optimization-convexity-gradient-descent-3d.html) | Descent as repeated local steps: learning-rate regimes on a 1-D curve, zig-zag across a badly conditioned valley, local minima in a double well, and ∇f = λ∇g tangency on a constraint circle |

*The original hand-written `trig-essence-3d` has been archived to `archive/`.*

## Usage

Open any file in `outputs/` directly in a browser — no setup required.

```bash
git clone git@github.com:My2ndFoundation/MathViz.git
open MathViz/outputs/trig-essence-3d-new.html   # macOS; or just double-click the file
```

**Controls** (mouse or touch): drag to rotate · scroll / pinch to zoom · right-click or Shift-drag to pan · double-click to reset the view · `Space` to pause · `1`–`9` for preset viewing angles · `T` to switch tabs.

## Building a new tool

Everything needed to author a new visualization lives in `design-system/`:

- **[`math-viz-design-system.md`](design-system/math-viz-design-system.md)** — the design spec and source of truth (tokens, components, canvas drawing language, interaction vocabulary).
- **[`math-viz-starter.html`](design-system/math-viz-starter.html)** — a ready-to-run template with the full engine. Copy it, then declare your parameters and scenes; the camera, projection, and interaction come for free.

See [`CLAUDE.md`](CLAUDE.md) for the engine architecture and authoring model.

Every tool is registered in **[`tools.json`](tools.json)** — the authoritative source for the landing page. Each entry carries a semver `version` and a `changelog` (bump the version and append an entry whenever a tool changes); the landing page's embedded `TOOLS` array mirrors it field-for-field (minus the changelog, which the page doesn't display).

All tools support **bilingual (中文 / English) UI** — a language toggle in the panel switches instantly, the choice persists via `localStorage`, and `?lang=en` (or `?lang=zh`) opens a tool directly in that language, which the landing page's card links use automatically.

## Status

Early and evolving. The design system and engine are stable; the library of tools is being expanded.
