# 场景作用域参数迁移 · 阶段 2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 50 个已发布工具的每个场景补上 `params` 声明，让参数面板只显示对当前页签真正有效的滑块。

**Architecture:** 阶段 1 已把机制建好——场景声明 `params` 数组，`switchTab()` 按它显隐滑块，省略即显示全部。本阶段只填数据，不动引擎。声明内容取「审计工具实测有效」与「源码实际引用」两个集合的**并集**：探针测不出作者本意，源码扫不出间接调用，两者互补且并集偏向安全方向。50 个工具分 6 批并行改 HTML，`tools.json` 是单个数组、并行改会文本冲突，故统一放到最后一个串行任务。

**Tech Stack:** 无构建、无测试框架。验证靠 `node --check` 语法门禁 + 浏览器内断言 + `scripts/audit-scenes.html`。

设计依据：[docs/superpowers/specs/2026-07-31-scene-scoped-params-and-drive-design.md](../specs/2026-07-31-scene-scoped-params-and-drive-design.md) §A、§G 阶段 2。

## Global Constraints

- **本阶段只加 `params`，不碰 `drive`。** `drive` 是阶段 3 的工作（72 个静止页签，每个都要判断数学含义）。§8 清单里关于 `drive` 的那条在阶段 3 完成前不适用于存量工具。
- **`trig-essence-3d-new` 排除在外**——它是 `engine-version: pre-declarative` 的遗留实现，没有 `SCENES`，本机制不适用。可迁移工具共 **50** 个。
- **不改引擎**：`design-system/`、`app.html`、`scripts/` 一律不动。本阶段只改 `outputs/*.html` 与 `tools.json`。
- **版本号按 patch 递增**（`1.0.0` → `1.0.1`，`1.2.0` → `1.2.1`）。理由：滑块的**行为**没有任何变化——它们在那些页签上本来就不起作用；变的只是不再把无效控件摆出来。没有能力增减，属于误导性呈现的修复。
- **版本三处落地（§10）**：HTML 的 `<meta name="tool-version">`、HTML 头注释的 changelog 块、`tools.json` 的 `version` + `changelog`。前两处在批次任务里做，第三处统一在最后一个任务做。
- **所有面向用户的文案双语** `{ zh, en }`——本阶段唯一的用户可见文案是 `tools.json` 的 changelog 条目。
- **零外部依赖**，工具保持单文件、可独立打开。
- **语法门禁**（每个被改动的工具都要过）：
  ```bash
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' outputs/FILE.html | node --check /dev/stdin
  ```

## 声明规则（本阶段的质量核心）

对每个场景，`params` 取**并集**：

```
params = (审计工具实测有效的键)  ∪  (该场景源码实际引用的键)
```

两个来源各有盲区，必须都用：

| 来源 | 盲区 |
|---|---|
| 审计工具（像素比对） | 测不出作者本意。某个滑块本该有效但当前实现漏读了、或其效果在测试取值处恰好消失（例如仅当某开关打开时才生效），会被报成无效 |
| 源码扫描 | 工具普遍在 `SCENES` 之外定义模块级辅助函数（`f1` / `rho` / `sim` 之类），场景经由它们间接读参数，直接 grep 场景体会漏 |

**方向很重要**：漏声明（滑块有效却被面板藏起来）比多声明（摆出一个无效滑块）危险得多——后者只是维持现状，前者是新造的功能缺失。取并集就是刻意偏向安全方向。

源码交叉核对的具体做法，以 `weierstrass-essence-3d` 的 `chord` 场景为例：

```bash
# 1. 场景体直接引用的
sed -n '/^  chord: {/,/^  rational: {/p' outputs/weierstrass-essence-3d.html | grep -o 'state\.[a-zA-Z_]\w*' | sort -u

# 2. 场景体调用了哪些模块级辅助函数（再对每个 grep 一次 state.*）
sed -n '/^  chord: {/,/^  rational: {/p' outputs/weierstrass-essence-3d.html | grep -oE '\b[a-z][A-Za-z0-9_]*\(' | sort -u
```

把第 2 步查到的辅助函数名再回到文件里找定义、扫它引用的 `state.*`，递归一层通常就够。得到的键集合与 `PARAMS` 的 key 求交（`state` 里还有 toggles 的键，不是滑块，不进 `params`）。

## File Structure

| 文件 | 改动 | 任务 |
|---|---|---|
| `outputs/*.html` × 50 | 每个场景加 `params` 数组；`<meta name="tool-version">` patch 递增；头注释 changelog 加一行 | Task 1–6（各一批，可并行） |
| `tools.json` | 50 个条目的 `version` + `changelog`；随后跑 `scripts/sync_registry.py` | Task 7（串行） |

Task 1–6 只碰 `outputs/`，彼此文件不重叠，可完全并行。Task 7 必须最后做。

---

## Task 1: 迁移批次 1（9 个工具）

**Files:**
- Modify: `outputs/fourier-essence-3d.html`、`outputs/complex-mult-3d.html`、`outputs/cartesian-polar-coordinate-3d.html`、`outputs/conic-essence-3d.html`、`outputs/kelly-essence-3d.html`、`outputs/derivative-essence-3d.html`、`outputs/trig-identity-3d.html`、`outputs/weierstrass-essence-3d.html`、`outputs/inverse-trig-essence-3d.html`

**Interfaces:**
- Consumes: 阶段 1 已落地的引擎——场景的 `params` 字段（字符串数组）、`switchTab()` 里的 `syncParamVisibility()`、`scripts/audit-scenes.html`
- Produces: 无代码接口。Task 7 依赖本任务把 9 个 HTML 的 meta 版本号改好，它据此填 `tools.json`

- [ ] **Step 1: 起服务器并跑审计，取本批 9 个工具的实测初稿**

```bash
python3 -m http.server 8777
```
（Bash，`run_in_background: true`。先确认 8777 没被占用。）

浏览器开 `http://localhost:8777/scripts/audit-scenes.html`，点「开始审计」。它会按 `tools.json` 顺序逐个跑，本批 9 个正好是前 9 个（`trig-essence-3d-new` 会渲染成「探测失败」行，跳过它）。

把每个工具每个页签的「实测 params 初稿」列抄下来。**不要直接采用**——它是初稿，下一步要交叉核对。

- [ ] **Step 2: 逐场景做源码交叉核对**

对本批每个工具的每个场景，按本计划「声明规则」一节的两条 `sed`/`grep` 配方，查出源码实际引用的 `state.*` 键，与 `PARAMS` 的 key 求交，再与 Step 1 的实测初稿取并集。

对每一处**两者不一致**的键，在报告里记一行：键名、哪边有哪边没有、你判断该不该声明、依据是什么。这是本任务最有价值的产出——不一致处正是探针或源码扫描各自失效的地方。

- [ ] **Step 3: 写入 `params` 声明**

在每个场景对象里，紧跟 `label:` 那一行之后插入 `params`，与阶段 1 在 starter 里确立的写法一致：

```js
  chord: {
    label: { zh: '弦 · 半角', en: 'Chord · Half angle' },
    params: ['xAng'],
    brand: { … },
```

数组元素顺序按 `PARAMS` 中的声明顺序排列，便于人工比对。

**顺带清理**：这些工具里有作者为了弥补引擎缺陷、把页签名塞进滑块标签的补丁，例如 `weierstrass-essence-3d` 的
`label: { zh: '角 <i>x</i>（弦·半角页）', en: 'Angle <i>x</i> (chord tab)' }`。
`params` 生效后这类括号后缀成了冗余噪音，**删掉括号部分，保留纯参数名**：

```js
  { key: 'xAng', label: { zh: '角 <i>x</i>', en: 'Angle <i>x</i>' }, … },
```

只删这种「指明属于哪个页签」的后缀，不要动其他标签内容。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

每个改动的工具，`<meta name="tool-version" content="X.Y.Z">` 的 patch 位加一。**注意本批的版本起点不都是 `1.0.0`**：`fourier-essence-3d` 与 `cartesian-polar-coordinate-3d` 是 `1.1.0` → `1.1.1`，`complex-mult-3d` 是 `1.2.0` → `1.2.1`，其余按各自当前 meta 值递增。

头注释的 changelog 块最上方加一行，格式与该文件已有条目一致：

```
    1.0.1  2026-07-31  参数面板按页签显示：各场景声明 params，只列出对当前页签有效的滑块
```

⚠️ **本批四个工具的 changelog 标题文案与其他工具不同**：`fourier-essence-3d`、`complex-mult-3d`、`cartesian-polar-coordinate-3d`、`conic-essence-3d` 写的是 `版本记录（新→旧）：`，其余 46 个写的是 `版本记录（changelog，新→旧）：`。**保持各文件原有写法，不要统一**——那是无关的改动，会把这批 diff 弄脏。Task 7 的校验脚本两种都认。

- [ ] **Step 5: 语法门禁**

```bash
for f in fourier-essence-3d complex-mult-3d cartesian-polar-coordinate-3d conic-essence-3d kelly-essence-3d derivative-essence-3d trig-identity-3d weierstrass-essence-3d inverse-trig-essence-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：9 行全 OK。

- [ ] **Step 6: 浏览器验收——声明数与实际显示数必须相等**

对本批每个工具，开 `http://localhost:8777/outputs/<id>.html`，控制台执行：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const shown = [...document.querySelectorAll('#paramsHost .ctl')]
    .filter(e => e.style.display !== 'none').length;
  return { tab: k, declared: SCENES[k].params.length, shown, ok: SCENES[k].params.length === shown };
})
```

预期：每个页签 `ok: true`。任何一行 `false` 说明声明里有 `PARAMS` 中不存在的键（拼写错误），必须修掉。

再确认一件事——**切换页签后再切回来，滑块的值没有丢**（`params` 只管可见性，值是跨页签共享的 `state`）：

```js
switchTab(Object.keys(SCENES)[0]);
const before = JSON.stringify(state);
Object.keys(SCENES).forEach(k => switchTab(k));
switchTab(Object.keys(SCENES)[0]);
JSON.stringify(state) === before   // 期望 true
```

- [ ] **Step 7: 确认改动范围并提交**

```bash
git diff --name-only
```
预期：只有本批 9 个 `outputs/*.html`。**`tools.json` 不能出现**——它归 Task 7。

```bash
git add outputs/fourier-essence-3d.html outputs/complex-mult-3d.html outputs/cartesian-polar-coordinate-3d.html outputs/conic-essence-3d.html outputs/kelly-essence-3d.html outputs/derivative-essence-3d.html outputs/trig-identity-3d.html outputs/weierstrass-essence-3d.html outputs/inverse-trig-essence-3d.html
git commit -m "feat(tools): 批次 1 声明场景作用域 params（9 个工具）"
```

---

## Task 2: 迁移批次 2（9 个工具）

**Files:**
- Modify: `outputs/limit-essence-3d.html`、`outputs/dft-essence-3d.html`、`outputs/linear-essence-3d.html`、`outputs/gaussian-essence-3d.html`、`outputs/calculus-essence-3d.html`、`outputs/taylor-essence-3d.html`、`outputs/parametric-curves-3d.html`、`outputs/lines-planes-3d.html`、`outputs/hyperbolic-functions-3d.html`

**Interfaces:**
- Consumes: 同 Task 1
- Produces: 本批 9 个 HTML 的 meta 版本号，供 Task 7 填 `tools.json`

流程与 Task 1 完全相同（Step 1–7），只是工具清单不同。逐条重述以便独立阅读：

- [ ] **Step 1: 起服务器并跑审计取初稿**

```bash
python3 -m http.server 8777
```
（Bash，`run_in_background: true`。先确认端口没被占用。）

开 `http://localhost:8777/scripts/audit-scenes.html` 点「开始审计」，抄下本批 9 个工具每个页签的「实测 params 初稿」列。审计按 `tools.json` 顺序跑，本批是第 10–18 个（`trig-essence-3d-new` 的探测失败行不计入）。

- [ ] **Step 2: 逐场景做源码交叉核对**

按本计划「声明规则」一节的配方，对每个场景查源码实际引用的 `state.*` 键（含经模块级辅助函数间接引用的），与 `PARAMS` 的 key 求交，再与实测初稿取并集。每处不一致在报告里记一行：键名、哪边有哪边没有、判断、依据。

**本批有两个已知的硬骨头**：`calculus-essence-3d` 在 `SCENES` 之外定义了 `f1` / `f2` / `rho` / `sim` 等辅助函数，场景经由它们读 `amp` / `k` / `fam`；`lines-planes-3d` 五个场景共用同一批向量参数。这两个尤其不能只信探针。

- [ ] **Step 3: 写入 `params` 声明**

每个场景对象里紧跟 `label:` 之后插入 `params`，元素顺序按 `PARAMS` 声明顺序：

```js
  sine: {
    label: { zh: '正弦', en: 'Sine' },
    params: ['a', 'N'],
    brand: { … },
```

若发现滑块标签里有「（某某页）」这类为弥补引擎缺陷而加的页签后缀，一并删除后缀、保留纯参数名。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

meta 的 patch 位加一；头注释 changelog 块最上方加一行：

```
    1.0.1  2026-07-31  参数面板按页签显示：各场景声明 params，只列出对当前页签有效的滑块
```

- [ ] **Step 5: 语法门禁**

```bash
for f in limit-essence-3d dft-essence-3d linear-essence-3d gaussian-essence-3d calculus-essence-3d taylor-essence-3d parametric-curves-3d lines-planes-3d hyperbolic-functions-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：9 行全 OK。

- [ ] **Step 6: 浏览器验收**

对每个工具开 `http://localhost:8777/outputs/<id>.html`，控制台执行：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const shown = [...document.querySelectorAll('#paramsHost .ctl')]
    .filter(e => e.style.display !== 'none').length;
  return { tab: k, declared: SCENES[k].params.length, shown, ok: SCENES[k].params.length === shown };
})
```
预期：每个页签 `ok: true`。

再验证切页签往返后滑块值不丢：

```js
switchTab(Object.keys(SCENES)[0]);
const before = JSON.stringify(state);
Object.keys(SCENES).forEach(k => switchTab(k));
switchTab(Object.keys(SCENES)[0]);
JSON.stringify(state) === before   // 期望 true
```

- [ ] **Step 7: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有本批 9 个 `outputs/*.html`，**不含 `tools.json`**。

```bash
git add outputs/limit-essence-3d.html outputs/dft-essence-3d.html outputs/linear-essence-3d.html outputs/gaussian-essence-3d.html outputs/calculus-essence-3d.html outputs/taylor-essence-3d.html outputs/parametric-curves-3d.html outputs/lines-planes-3d.html outputs/hyperbolic-functions-3d.html
git commit -m "feat(tools): 批次 2 声明场景作用域 params（9 个工具）"
```

---

## Task 3: 迁移批次 3（9 个工具）

**Files:**
- Modify: `outputs/differential-equations-phase-space-3d.html`、`outputs/gradient-contours-surface-3d.html`、`outputs/kinematics-projectile-3d.html`、`outputs/recurrence-iteration-dynamics-3d.html`、`outputs/energy-phase-portrait-3d.html`、`outputs/e-essence-3d.html`、`outputs/pi-essence-3d.html`、`outputs/phi-essence-3d.html`、`outputs/i-essence-3d.html`

**Interfaces:**
- Consumes: 同 Task 1
- Produces: 本批 9 个 HTML 的 meta 版本号，供 Task 7

- [ ] **Step 1: 起服务器并跑审计取初稿**

```bash
python3 -m http.server 8777
```
（Bash，`run_in_background: true`。先确认端口没被占用。）

开 `http://localhost:8777/scripts/audit-scenes.html` 点「开始审计」，抄下本批 9 个工具每页签的「实测 params 初稿」。

- [ ] **Step 2: 逐场景做源码交叉核对**

按「声明规则」的配方查源码引用键，与实测初稿取并集。每处不一致记一行到报告。

**本批参数最多、页签最多，是全仓库最容易出错的一批**：`e-essence-3d` 6 个页签 8 个参数、`pi-essence-3d` 5 个页签 7 个参数、`phi-essence-3d` 5 个页签 8 个参数、`i-essence-3d` 5 个页签 12 个参数。逐个场景慢慢来，不要图快。

- [ ] **Step 3: 写入 `params` 声明**

每个场景紧跟 `label:` 之后插入，元素顺序按 `PARAMS` 声明顺序：

```js
  roll: {
    label: { zh: '滚圆', en: 'Rolling circle' },
    params: ['wr'],
    brand: { … },
```

发现滑块标签里有页签后缀的一并删除后缀。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

meta 的 patch 位加一；头注释 changelog 最上方加一行：

```
    1.0.1  2026-07-31  参数面板按页签显示：各场景声明 params，只列出对当前页签有效的滑块
```

- [ ] **Step 5: 语法门禁**

```bash
for f in differential-equations-phase-space-3d gradient-contours-surface-3d kinematics-projectile-3d recurrence-iteration-dynamics-3d energy-phase-portrait-3d e-essence-3d pi-essence-3d phi-essence-3d i-essence-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：9 行全 OK。

- [ ] **Step 6: 浏览器验收**

对每个工具开 `http://localhost:8777/outputs/<id>.html`，控制台执行：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const shown = [...document.querySelectorAll('#paramsHost .ctl')]
    .filter(e => e.style.display !== 'none').length;
  return { tab: k, declared: SCENES[k].params.length, shown, ok: SCENES[k].params.length === shown };
})
```
预期：每个页签 `ok: true`。

再验证切页签往返后滑块值不丢：

```js
switchTab(Object.keys(SCENES)[0]);
const before = JSON.stringify(state);
Object.keys(SCENES).forEach(k => switchTab(k));
switchTab(Object.keys(SCENES)[0]);
JSON.stringify(state) === before   // 期望 true
```

- [ ] **Step 7: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有本批 9 个 `outputs/*.html`，**不含 `tools.json`**。

```bash
git add outputs/differential-equations-phase-space-3d.html outputs/gradient-contours-surface-3d.html outputs/kinematics-projectile-3d.html outputs/recurrence-iteration-dynamics-3d.html outputs/energy-phase-portrait-3d.html outputs/e-essence-3d.html outputs/pi-essence-3d.html outputs/phi-essence-3d.html outputs/i-essence-3d.html
git commit -m "feat(tools): 批次 3 声明场景作用域 params（9 个工具）"
```

---

## Task 4: 迁移批次 4（9 个工具）

**Files:**
- Modify: `outputs/conditional-probability-bayes-3d.html`、`outputs/exponential-logarithm-essence-3d.html`、`outputs/function-mapping-transformations-3d.html`、`outputs/binomial-pascal-probability-3d.html`、`outputs/torque-equilibrium-centre-mass-3d.html`、`outputs/forces-free-body-diagrams-3d.html`、`outputs/random-variable-expectation-variance-3d.html`、`outputs/sequences-series-essence-3d.html`、`outputs/basis-change-coordinates-3d.html`

**Interfaces:**
- Consumes: 同 Task 1
- Produces: 本批 9 个 HTML 的 meta 版本号，供 Task 7

- [ ] **Step 1: 起服务器并跑审计取初稿**

```bash
python3 -m http.server 8777
```
（Bash，`run_in_background: true`。先确认端口没被占用。）

开 `http://localhost:8777/scripts/audit-scenes.html` 点「开始审计」，抄下本批 9 个工具每页签的「实测 params 初稿」。

- [ ] **Step 2: 逐场景做源码交叉核对**

按「声明规则」的配方查源码引用键，与实测初稿取并集。每处不一致记一行到报告。

**本批有一个特殊情况**：`basis-change-coordinates-3d` 定义了 `morphS()` 辅助函数，它同时读 `state.autoMorph`（一个 toggle）与 `state.k`（一个滑块）。只有 `k` 进 `params`，`autoMorph` 是开关不是滑块。这是「求交 PARAMS 的 key」那一步存在的原因。

- [ ] **Step 3: 写入 `params` 声明**

每个场景紧跟 `label:` 之后插入，元素顺序按 `PARAMS` 声明顺序：

```js
  skew: {
    label: { zh: '斜基底', en: 'Skew basis' },
    params: ['b1Len', 'b2Len', 'k'],
    brand: { … },
```

发现滑块标签里有页签后缀的一并删除后缀。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

meta 的 patch 位加一；头注释 changelog 最上方加一行：

```
    1.0.1  2026-07-31  参数面板按页签显示：各场景声明 params，只列出对当前页签有效的滑块
```

- [ ] **Step 5: 语法门禁**

```bash
for f in conditional-probability-bayes-3d exponential-logarithm-essence-3d function-mapping-transformations-3d binomial-pascal-probability-3d torque-equilibrium-centre-mass-3d forces-free-body-diagrams-3d random-variable-expectation-variance-3d sequences-series-essence-3d basis-change-coordinates-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：9 行全 OK。

- [ ] **Step 6: 浏览器验收**

对每个工具开 `http://localhost:8777/outputs/<id>.html`，控制台执行：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const shown = [...document.querySelectorAll('#paramsHost .ctl')]
    .filter(e => e.style.display !== 'none').length;
  return { tab: k, declared: SCENES[k].params.length, shown, ok: SCENES[k].params.length === shown };
})
```
预期：每个页签 `ok: true`。

再验证切页签往返后滑块值不丢：

```js
switchTab(Object.keys(SCENES)[0]);
const before = JSON.stringify(state);
Object.keys(SCENES).forEach(k => switchTab(k));
switchTab(Object.keys(SCENES)[0]);
JSON.stringify(state) === before   // 期望 true
```

- [ ] **Step 7: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有本批 9 个 `outputs/*.html`，**不含 `tools.json`**。

```bash
git add outputs/conditional-probability-bayes-3d.html outputs/exponential-logarithm-essence-3d.html outputs/function-mapping-transformations-3d.html outputs/binomial-pascal-probability-3d.html outputs/torque-equilibrium-centre-mass-3d.html outputs/forces-free-body-diagrams-3d.html outputs/random-variable-expectation-variance-3d.html outputs/sequences-series-essence-3d.html outputs/basis-change-coordinates-3d.html
git commit -m "feat(tools): 批次 4 声明场景作用域 params（9 个工具）"
```

---

## Task 5: 迁移批次 5（9 个工具）

**Files:**
- Modify: `outputs/linear-systems-rank-nullspace-3d.html`、`outputs/modular-arithmetic-euclid-crt-3d.html`、`outputs/least-squares-orthogonal-projection-3d.html`、`outputs/proof-logic-induction-3d.html`、`outputs/optimization-convexity-gradient-descent-3d.html`、`outputs/algorithmic-complexity-growth-3d.html`、`outputs/graph-theory-network-algorithms-3d.html`、`outputs/markov-chains-stationary-distribution-3d.html`、`outputs/combinatorics-generating-functions-3d.html`

**Interfaces:**
- Consumes: 同 Task 1
- Produces: 本批 9 个 HTML 的 meta 版本号，供 Task 7

- [ ] **Step 1: 起服务器并跑审计取初稿**

```bash
python3 -m http.server 8777
```
（Bash，`run_in_background: true`。先确认端口没被占用。）

开 `http://localhost:8777/scripts/audit-scenes.html` 点「开始审计」，抄下本批 9 个工具每页签的「实测 params 初稿」。

- [ ] **Step 2: 逐场景做源码交叉核对**

按「声明规则」的配方查源码引用键，与实测初稿取并集。每处不一致记一行到报告。

**本批需格外当心**：`modular-arithmetic-euclid-crt-3d` 的 `crt` 页签有 10 个有效参数（全仓库最多），而同工具其他页签只有 2 个——这种极端不均正是 `params` 要解决的情形，别把 `crt` 的清单误抄到别的页签。`least-squares-orthogonal-projection-3d` 与 `combinatorics-generating-functions-3d` 是全静止工具，`params` 照常声明，`drive` 留给阶段 3。

- [ ] **Step 3: 写入 `params` 声明**

每个场景紧跟 `label:` 之后插入，元素顺序按 `PARAMS` 声明顺序：

```js
  crt: {
    label: { zh: '中国剩余定理', en: 'CRT' },
    params: ['m1', 'm2', 'a1', 'a2', 'nMax', 'gsel', 'base', 'expo', 'modN', 'step'],
    brand: { … },
```

（上面的键名是示意；以你实际核对出的为准。）发现滑块标签里有页签后缀的一并删除后缀。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

meta 的 patch 位加一；头注释 changelog 最上方加一行：

```
    1.0.1  2026-07-31  参数面板按页签显示：各场景声明 params，只列出对当前页签有效的滑块
```

- [ ] **Step 5: 语法门禁**

```bash
for f in linear-systems-rank-nullspace-3d modular-arithmetic-euclid-crt-3d least-squares-orthogonal-projection-3d proof-logic-induction-3d optimization-convexity-gradient-descent-3d algorithmic-complexity-growth-3d graph-theory-network-algorithms-3d markov-chains-stationary-distribution-3d combinatorics-generating-functions-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：9 行全 OK。

- [ ] **Step 6: 浏览器验收**

对每个工具开 `http://localhost:8777/outputs/<id>.html`，控制台执行：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const shown = [...document.querySelectorAll('#paramsHost .ctl')]
    .filter(e => e.style.display !== 'none').length;
  return { tab: k, declared: SCENES[k].params.length, shown, ok: SCENES[k].params.length === shown };
})
```
预期：每个页签 `ok: true`。

再验证切页签往返后滑块值不丢：

```js
switchTab(Object.keys(SCENES)[0]);
const before = JSON.stringify(state);
Object.keys(SCENES).forEach(k => switchTab(k));
switchTab(Object.keys(SCENES)[0]);
JSON.stringify(state) === before   // 期望 true
```

- [ ] **Step 7: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有本批 9 个 `outputs/*.html`，**不含 `tools.json`**。

```bash
git add outputs/linear-systems-rank-nullspace-3d.html outputs/modular-arithmetic-euclid-crt-3d.html outputs/least-squares-orthogonal-projection-3d.html outputs/proof-logic-induction-3d.html outputs/optimization-convexity-gradient-descent-3d.html outputs/algorithmic-complexity-growth-3d.html outputs/graph-theory-network-algorithms-3d.html outputs/markov-chains-stationary-distribution-3d.html outputs/combinatorics-generating-functions-3d.html
git commit -m "feat(tools): 批次 5 声明场景作用域 params（9 个工具）"
```

---

## Task 6: 迁移批次 6（5 个工具）

**Files:**
- Modify: `outputs/vector-fields-divergence-curl-3d.html`、`outputs/svd-pca-dimensionality-reduction-3d.html`、`outputs/line-integrals-green-stokes-3d.html`、`outputs/information-entropy-coding-3d.html`、`outputs/huffman-coding-text-3d.html`

**Interfaces:**
- Consumes: 同 Task 1
- Produces: 本批 5 个 HTML 的 meta 版本号，供 Task 7

- [ ] **Step 1: 起服务器并跑审计取初稿**

```bash
python3 -m http.server 8777
```
（Bash，`run_in_background: true`。先确认端口没被占用。）

开 `http://localhost:8777/scripts/audit-scenes.html` 点「开始审计」，抄下本批 5 个工具每页签的「实测 params 初稿」。

- [ ] **Step 2: 逐场景做源码交叉核对**

按「声明规则」的配方查源码引用键，与实测初稿取并集。每处不一致记一行到报告。

**本批的特殊情况**：`huffman-coding-text-3d` 的核心输入是一个文本框（`TEXT_STATE.raw`）而不是滑块——它不在 `PARAMS` 里，因此不进 `params`，但它对每个页签都有效。声明 `params` 时不要因为「这个页签好像没什么滑块有用」就把该有的漏掉。该工具版本号当前是 `1.0.1`（刚修过视角高亮），本次递增到 `1.0.2`。

- [ ] **Step 3: 写入 `params` 声明**

每个场景紧跟 `label:` 之后插入，元素顺序按 `PARAMS` 声明顺序：

```js
  curl: {
    label: { zh: '旋度', en: 'Curl' },
    params: ['field', 'px', 'py', 'loopR', 'nArrow', 'scaleV', 'omega'],
    brand: { … },
```

（键名是示意；以实际核对结果为准。）发现滑块标签里有页签后缀的一并删除后缀。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

meta 的 patch 位加一（`huffman-coding-text-3d` 是 `1.0.1` → `1.0.2`，其余按各自当前值）；头注释 changelog 最上方加一行：

```
    1.0.1  2026-07-31  参数面板按页签显示：各场景声明 params，只列出对当前页签有效的滑块
```

（huffman 那行写 `1.0.2`。）

- [ ] **Step 5: 语法门禁**

```bash
for f in vector-fields-divergence-curl-3d svd-pca-dimensionality-reduction-3d line-integrals-green-stokes-3d information-entropy-coding-3d huffman-coding-text-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：5 行全 OK。

- [ ] **Step 6: 浏览器验收**

对每个工具开 `http://localhost:8777/outputs/<id>.html`，控制台执行：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const shown = [...document.querySelectorAll('#paramsHost .ctl')]
    .filter(e => e.style.display !== 'none').length;
  return { tab: k, declared: SCENES[k].params.length, shown, ok: SCENES[k].params.length === shown };
})
```
预期：每个页签 `ok: true`。

再验证切页签往返后滑块值不丢：

```js
switchTab(Object.keys(SCENES)[0]);
const before = JSON.stringify(state);
Object.keys(SCENES).forEach(k => switchTab(k));
switchTab(Object.keys(SCENES)[0]);
JSON.stringify(state) === before   // 期望 true
```

`huffman-coding-text-3d` 额外确认一件事：文本框输入仍然生效（在文本框里改几个字，画面跟着变），因为它不受 `params` 管辖。

- [ ] **Step 7: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有本批 5 个 `outputs/*.html`，**不含 `tools.json`**。

```bash
git add outputs/vector-fields-divergence-curl-3d.html outputs/svd-pca-dimensionality-reduction-3d.html outputs/line-integrals-green-stokes-3d.html outputs/information-entropy-coding-3d.html outputs/huffman-coding-text-3d.html
git commit -m "feat(tools): 批次 6 声明场景作用域 params（5 个工具）"
```

---

## Task 7: 注册表登记与全量验收

**必须最后做**，依赖 Task 1–6 全部合并。`tools.json` 是单个 JSON 数组，并行改不同条目会文本冲突，所以 50 个版本号统一在这里落。

**Files:**
- Modify: `tools.json`
- Modify（由脚本自动重写）: `app.html`、`index.html`

**Interfaces:**
- Consumes: Task 1–6 写进 50 个 HTML 的 `<meta name="tool-version">` 值
- Produces: 无

- [ ] **Step 1: 从 HTML 读回真实版本号，写进 `tools.json`**

不要手抄——以 HTML 的 meta 为准，脚本同步，避免抄错：

```bash
python3 - <<'PY'
import json, re, pathlib, collections
ROOT = pathlib.Path('.')
d = json.load(open('tools.json', encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
CH = collections.OrderedDict([
    ('date', '2026-07-31'),
    ('zh', '参数面板按页签显示：各场景声明 params，只列出对当前页签有效的滑块'),
    ('en', 'Parameter panel is now scene-scoped: each scene declares params, so only sliders that affect the current tab are shown')])
changed = []
for t in d['tools']:
    if t['id'] == 'trig-essence-3d-new':
        continue
    src = (ROOT / t['file']).read_text(encoding='utf-8')
    m = re.search(r'<meta name="tool-version" content="([^"]+)">', src)
    v = m.group(1)
    if v == t['version']:
        continue                      # 该工具本轮没被改动
    entry = collections.OrderedDict([('version', v)]); entry.update(CH)
    t['version'] = v
    t['changelog'].insert(0, entry)
    changed.append((t['id'], v))
with open('tools.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2); f.write('\n')
print(f'更新 {len(changed)} 个条目')
for i, v in changed: print(f'  {i:<46} -> {v}')
PY
```

预期：`更新 50 个条目`。**如果少于 50，说明某个批次漏改了 meta 版本号——停下来查清楚是哪个工具，不要继续。**

- [ ] **Step 2: 同步注册表镜像**

```bash
python3 scripts/sync_registry.py
```
预期：`app.html: 已同步（51 个工具）` 与 `index.html: 已同步（51 个工具）` 两行。

- [ ] **Step 3: 一致性校验**

确认三处版本号完全一致（HTML meta / HTML 头注释 changelog / tools.json）：

```bash
python3 - <<'PY'
import json, re, pathlib
d = json.load(open('tools.json', encoding='utf-8'))
bad = []
for t in d['tools']:
    if t['id'] == 'trig-essence-3d-new':
        continue
    src = pathlib.Path(t['file']).read_text(encoding='utf-8')
    meta = re.search(r'<meta name="tool-version" content="([^"]+)">', src).group(1)
    # 46 个工具写「版本记录（changelog，新→旧）：」，另 4 个写「版本记录（新→旧）：」，两种都认
    head = re.search(r'版本记录（(?:changelog，)?新→旧）：\s*\n\s*([0-9.]+)', src)
    head = head.group(1) if head else '(缺)'
    if not (meta == t['version'] == head):
        bad.append((t['id'], meta, t['version'], head))
print('全部一致' if not bad else '不一致：')
for b in bad: print(f'  {b[0]:<46} meta={b[1]} json={b[2]} head={b[3]}')
PY
```
预期：`全部一致`。

- [ ] **Step 4: 语法门禁全量**

```bash
fail=0
for f in outputs/*.html app.html index.html; do
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "$f" | node --check /dev/stdin || { echo "FAIL $f"; fail=1; }
done
[ $fail -eq 0 ] && echo "全部通过"
python3 scripts/sync_registry.py --check
```
预期：`全部通过`，以及两行 `已同步`。

- [ ] **Step 5: 审计工具全量复核**

起服务器，开 `http://localhost:8777/scripts/audit-scenes.html` 点「开始审计」，等它跑完（数分钟；本浏览器标签页被节流会更慢，可分段观察）。

阶段 1 给审计工具加了集合差判定，本步就是用它验收：

- **不能出现任何「漏声明」行**（红色，滑块实测有效却不在 `params` 里）——这是本阶段唯一的危险错误方向，出现一个就要回去修
- 允许出现「多声明」行（橙色，声明了但实测无效）——多为探针在测试取值处测不到效果，属于刻意偏安全的一侧；在报告里逐条列出并说明为何保留
- 底部「滑块无效率」应从 67% 大幅下降。**不要为了让这个数字好看而删掉存疑的声明**——宁可多声明。

- [ ] **Step 6: 抽样人工验收**

挑三个代表，肉眼确认：

- `weierstrass-essence-3d`：切到「弦·半角」页只剩「角 x」一个滑块；切到「有理点」页只剩「弦斜率 t」；滑块标签里的「（弦·半角页）」后缀已消失
- `i-essence-3d`：12 个参数，各页签显示数明显不同，且 `matrix` 页签不再摆出一堆无效滑块
- `huffman-coding-text-3d`：文本框仍然可用，改字画面跟着变

- [ ] **Step 7: 提交**

```bash
git add tools.json app.html index.html
git commit -m "feat(registry): 阶段 2 的 50 个工具版本登记与镜像同步"
```

---

## Self-Review 记录

**Spec 覆盖**：spec §A（场景作用域参数）的数据侧 → Task 1–6；§G 阶段 2 描述的「审计工具生成初稿 + 人工复核 + 分批提交 + 每工具 patch 版本号 + changelog」→ Task 1–6 的 Step 1/2/4 与 Task 7；§10 版本三处落地 → Task 1–6 的 Step 4（前两处）+ Task 7 的 Step 1（第三处）与 Step 3（一致性校验）。§8 清单里 `drive` 那条本阶段不适用，已在 Global Constraints 说明。

**已知取舍（有意为之）**：
- **只做 `params`，不碰 `drive`**。`drive` 需要逐场景判断数学含义（什么量该随时间走、值域、circular 还是 linear），无法批量生成，堆进本阶段会让每个批次都无法审。
- **版本按 patch 递增**。滑块的行为没有变化——它们在那些页签上本来就不起作用；变的只是不再摆出无效控件。没有能力增减，属误导性呈现的修复。若判断应为 minor，改动仅限每个 HTML 的 meta 一处与 Task 7 的脚本，成本很低。
- **`tools.json` 集中到 Task 7**。它是单个 JSON 数组，六个批次并行改不同条目必然文本冲突；集中处理换来六个批次真正的零冲突并行。代价是分支中途 HTML 与 `tools.json` 的版本号短暂不一致，无门禁会因此失败（`sync_registry.py` 不校验版本号）。
- **`trig-essence-3d-new` 完全排除**。`engine-version: pre-declarative`，没有 `SCENES`，本机制不适用；它保持 51 个工具中的一员但不参与迁移。
