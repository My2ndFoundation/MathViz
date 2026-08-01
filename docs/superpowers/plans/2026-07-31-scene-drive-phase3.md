# 场景时间驱动 · 阶段 3 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 93 个静止页签动起来——每个要么声明 `drive`（随时间走的量），要么显式写 `drive: null` 并注明理由。

**Architecture:** 阶段 1 在 starter 里建好了 `drive` 机制（`driveValue` / `applyDrive` / `driveInfo` / 每页签自动播放与 loop-pingpong 切换 / 驱动时钟偏移），阶段 1 同时让录制器经 `REC.Bridge` 消费它。**但这套引擎和阶段 2 的 `params` 一样，只存在于 starter，50 个工具一个都没有。** 因此本阶段第一件事就是把引擎脚本化地落到全部工具，然后才谈声明——这是阶段 2 中途才发现的教训，这次提前做。

**Tech Stack:** 无构建、无测试框架。验证靠 `node --check` 语法门禁 + 浏览器内断言 + `scripts/audit-scenes.html`。

设计依据：[docs/superpowers/specs/2026-07-31-scene-scoped-params-and-drive-design.md](../specs/2026-07-31-scene-scoped-params-and-drive-design.md) §B、§C、§D、§G 阶段 3。

## 实测基线（阶段 2 合并后，用当前审计工具测得）

| 指标 | 数值 |
|---|---|
| 页签总数 | 188 |
| 滑块无效率 | 33%（阶段 2 前为 67%） |
| 漏声明页签 | 0 |
| **静止页签** | **93，跨 38 个工具** |
| **全部页签都静止的工具** | **7** |

七个全静止工具：`limit-essence-3d`、`recurrence-iteration-dynamics-3d`、`conditional-probability-bayes-3d`、`sequences-series-essence-3d`、`least-squares-orthogonal-projection-3d`、`combinatorics-generating-functions-3d`、`huffman-coding-text-3d`。

## Global Constraints

- **只处理静止页签。** 95 个已有动画的页签不动——它们由引擎时钟经 `theta` 直接驱动，不需要额外的驱动量。§8 的措辞在 Task 1 里相应修订。
- **`trig-essence-3d-new` 排除在外**（`engine-version: pre-declarative`，无 `SCENES`）。
- **版本号按 minor 递增**（`1.0.1` → `1.1.0`）。理由与阶段 2 不同：阶段 2 只是不再摆出无效控件，能力无增减；本阶段**新增了自动播放这项能力**，画面行为真实改变，属于功能新增。
- **版本三处落地（§10）**：HTML meta、HTML 头注释 changelog、`tools.json`。前两处在批次里做，第三处统一在最后一个任务做——`tools.json` 是单个数组，并行改会文本冲突。
- **所有面向用户的文案双语** `{ zh, en }`。
- 零外部依赖，工具保持单文件、可独立打开。
- **语法门禁**：`awk '/<script>/{f=1;next}/<\/script>/{f=0}f' outputs/FILE.html | node --check /dev/stdin`

## 驱动声明的判定程序（本阶段的质量核心）

阶段 2 的 `params` 可以靠探针加源码机械推导。**`drive` 不行**——它问的是"这个场景在演示什么，什么量应该随时间走"，是数学与教学判断。没有自动方法，判定程序如下：

**第一步：读 `brand` 与 `tips`。** 每个场景的这两段文案就是作者用中文写下的"这一页要让人看见什么"。设计系统 §7 要求 tips「只讲一个顿悟点」，所以它通常直接点名了那个应该动的量。

**第二步：找这个演示的自变量。** 就是"用户会去拖哪根滑块才能看见事情发生"的那个量。典型对应关系：

| 场景在演示 | 自变量通常是 |
|---|---|
| 某个角度/相位的几何后果 | 角度参数（`circular`） |
| 某个标量参数如何改变形状 | 该标量（`linear`） |
| 逼近 / 极限 / 收敛 | 步数、项数、细分数（`linear`，从粗到细） |
| 一族曲线或一族变换 | 族参数（`linear`） |
| 离散选择（预设、算法选项） | **通常不该驱动**，见下 |

**第三步：确认它在该场景的 `params` 里。** 阶段 2 已经声明了每个场景真正读取哪些滑块。驱动量必须是其中之一——驱动一根本页签看不见的滑块没有意义。

**第四步：定值域。** 一般取该参数 `map` 之后的完整 `[min, max]`。若某一端是退化情形（例如振幅为 0 时图形消失、离心率为 1 时曲线变直线），把该端收进来一点，并在注释里说明为什么。

**第五步：定 `kind`。** 判据只有一条——**从 `to` 跳回 `from` 时画面会不会跳变**：

- 会跳变 → `linear`（默认 `pingpong`，走到头折返，永远不跳）
- 不会跳变（首尾天然相接，如角度绕满一圈） → `circular`（默认 `loop`）

**第六步：定 `period`。** 房规默认 **8 秒**。简单场景可用 5–6 秒，需要时间读数或结构复杂的用 10–12 秒。判据是"一个不熟悉这个概念的人能否跟上"。

**第七步：若该参数带 `map`，必须补 `invMap`。** 否则滑块无法回显驱动值（§8 硬约束）。例如 `map: v => v * Math.PI / 180` 对应 `invMap: v => v * 180 / Math.PI`。

### 什么时候该写 `drive: null`

静止不总是缺陷。以下情形是**正当的静止**，写 `drive: null` 并在同一行注释说明理由：

- **静态参照图**：本页签的作用就是给出一个不随时间变化的结构，供其他页签对照
- **由用户输入驱动**：内容来自文本框或类似输入而非时间（`huffman-coding-text-3d` 四个页签都属此类）
- **全部参数都是离散选择**：驱动一个预设选择器只会让画面每隔几帧闪一次，不是动画
- **驱动会破坏教学意图**：作者要求读者停下来看一个定格的构造

**写 `drive: null` 不是偷懒的出口。** 报告里必须给出理由，审查会检查理由是否成立。93 个页签里若有超过三分之一被判为正当静止，那多半是判定程序没认真执行。

---

## Task 1: 驱动引擎集中落地与 §8 修订

**必须最先做。** 后续所有批次都依赖它，且它单独可验。

**Files:**
- Modify: `design-system/math-viz-design-system.md`（§8 清单第 2 条）
- Modify: 全部 50 个 `outputs/*.html`

**Interfaces:**
- Consumes: `design-system/math-viz-starter.html` 里的驱动引擎实现（真源）
- Produces: 50 个工具中可运行的 `drive` 机制。批次任务依赖 `applyDrive` / `driveInfo` / `driveValue` / `buildDrive` / `autoPlay` / `driveMode` / `driveOff` 存在且与 starter 一致

### 为什么这一步必须在批次之前

阶段 2 里我把"机制已就位"当成了事实，六个批次因此把 `params` 声明进了没有消费方的文件，中途才被一个 agent 发现。**已核实：`applyDrive` / `driveInfo` / `driveValue` / `buildDrive` / `autoPlay` / `driveMode` / `driveHost` 在 50 个工具里出现次数均为 0。** 同样的错不犯第二次。

- [ ] **Step 1: §8 清单第 2 条改为可执行的措辞**

现在的写法要求"每个场景必须声明 `drive`，或显式写 `drive: null` 并注释理由"，字面上要求 188 个场景全部写一遍，而其中 95 个本就由引擎时钟经 `theta` 驱动，写 `drive: null` 只是噪音。改为按结果判定：

在 `design-system/math-viz-design-system.md` 的 §8 清单里，把

```
□ 每个场景声明 drive，或显式写 drive: null 并注释理由（静态对照场景合法，但须是有意识的选择）
```

替换为

```
□ 没有静止页签：每个页签要么由引擎时钟驱动、要么声明 drive，要么显式写 drive: null 并注释理由（静态对照场景合法，但须是有意识的选择）
```

- [ ] **Step 2: 建立 RED 基线**

```bash
for s in applyDrive driveInfo driveValue buildDrive autoPlay driveMode driveOff driveHost; do
  printf "%-12s " "$s"; grep -l "$s" outputs/*.html 2>/dev/null | wc -l
done
```
预期：八行全是 `0`。记进报告。

- [ ] **Step 3: 从 starter 抽取驱动引擎的完整清单**

真源是 `design-system/math-viz-starter.html`。驱动机制比阶段 2 的 `params` 大得多，逐项从文件里读出**逐字文本**，不要凭记忆：

```bash
# CSS：.drive / .dmode 规则
grep -n "^\.drive\|^\.drive \.dmode" design-system/math-viz-starter.html
# DOM 容器
grep -n "driveHost" design-system/math-viz-starter.html
# 双语文案
grep -n "autoPlay:\|pingpong:\|loop:" design-system/math-viz-starter.html
# 引擎函数与每页签状态
sed -n '/^const paramWraps/,/^function buildDrive/p' design-system/math-viz-starter.html
sed -n '/^function buildDrive/,/^}/p' design-system/math-viz-starter.html
# 挂接点
grep -n "applyDrive();\|syncParamSlider(\|buildDrive();\|driveOff\b" design-system/math-viz-starter.html
```

要移植的完整集合：`.drive` / `.dmode` CSS、`#driveHost` DOM、`UI` 字典的 `autoPlay`/`pingpong`/`loop` 三条双语文案、`autoPlay`/`driveMode`/`driveOff`/`driveOffAt` 四张按页签的表、`driveValue`/`applyDrive`/`driveInfo`/`syncParamSlider`/`setAutoPlay`/`refreshDriveRow`/`buildDrive` 七个函数、`frame()` 里的驱动求值与滑块同步、`switchTab()` 里 `.drive[data-tab]` 的显隐、`resetSim()` 里对 `driveOff`/`driveOffAt` 的归零、`buildParams()` 里"拖动被驱动滑块则关闭自动播放"的监听、以及启动序列里的 `buildDrive()`。

**`resetSim()` 的归零不能漏**：没有它，重置把 `state.t` 归零而偏移仍在，驱动会停在一个任意相位。

- [ ] **Step 4: 写幂等的移植脚本**

手改 50 个文件必然漂移——这正是本仓库引擎变成 51 份略有差异副本的原因。**必须写脚本**，且必须幂等。

已知障碍：

- **`cartesian-polar-coordinate-3d` 用 `paramRefs` 而非 `paramWraps`**（阶段 2 的记录），且它的 `configParam` 走 `suppressed` 标志。驱动引擎里的 `syncParamSlider` 要按该文件的实际结构接入，不要并列引入第二套登记表。
- 各工具的 `frame()` / `switchTab()` / `resetSim()` / `buildParams()` 文本可能有细微差异。**基于稳定锚点定位，命中失败就报错并跳过该文件**，绝不模糊匹配硬塞。跳过并列出来是可接受的结果，静默塞错位置不是。

- [ ] **Step 5: 语法门禁全量**

```bash
fail=0
for f in outputs/*.html; do
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "$f" | node --check /dev/stdin || { echo "FAIL $f"; fail=1; }
done
[ $fail -eq 0 ] && echo "51 个工具全部通过"
```

- [ ] **Step 6: 结构验收**

```bash
for s in applyDrive driveInfo driveValue buildDrive autoPlay driveMode driveOff driveHost; do
  printf "%-12s " "$s"; grep -l "$s" outputs/*.html 2>/dev/null | wc -l
done
echo "版本号未被本任务改动（预期无输出）:"; git diff main -- outputs/ | grep "^[-+].*tool-version"
```
预期：八行全是 `50`；版本号无输出（版本由批次任务改）。

- [ ] **Step 7: 浏览器验收——引擎在没有任何 `drive` 声明时必须完全无害**

本任务不声明任何 `drive`，所以落地后**所有工具的行为必须与落地前完全一致**。起服务器（`python3 -m http.server 8831`，Bash `run_in_background: true`），自建浏览器标签页，对至少 8 个工具（须含 `cartesian-polar-coordinate-3d`）执行：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const shown = [...document.querySelectorAll('#paramsHost .ctl')]
    .filter(e => e.style.display !== 'none').length;
  return { tab: k, declared: SCENES[k].params.length, shown,
           driveRow: !!document.querySelector('.drive[data-tab="' + k + '"]'),
           ok: SCENES[k].params.length === shown };
})
```

预期每个页签 `ok: true` 且 `driveRow: false`——没有 `drive` 声明的场景不该出现驱动控制行。再确认 `typeof applyDrive === 'function'` 且 `applyDrive()` 在无声明时是空操作（调用前后 `JSON.stringify(state)` 不变）。

- [ ] **Step 8: 提交**

```bash
git add design-system/math-viz-design-system.md outputs/
git commit -m "feat(tools): 驱动引擎集中落地 50 个工具，§8 改为按结果判定静止页签"
```

---

## Task 2: 驱动声明 · 批次 1（8 个工具 / 19 个静止页签）

**Files:**
- Modify: `outputs/pi-essence-3d.html`(4)、`outputs/combinatorics-generating-functions-3d.html`(4)、`outputs/exponential-logarithm-essence-3d.html`(3)、`outputs/algorithmic-complexity-growth-3d.html`(3)、`outputs/random-variable-expectation-variance-3d.html`(2)、`outputs/complex-mult-3d.html`(1)、`outputs/cartesian-polar-coordinate-3d.html`(1)、`outputs/forces-free-body-diagrams-3d.html`(1)

括号内是该工具的静止页签数。**只处理静止页签**，已有动画的页签不动。

**Interfaces:**
- Consumes: Task 1 落地的驱动引擎；阶段 2 已声明的 `SCENES[*].params`
- Produces: 本批 8 个 HTML 的 meta 版本号（minor 递增），供最后的注册表任务读取

- [ ] **Step 1: 确认本批的静止页签清单**

起服务器（`python3 -m http.server 8832`，Bash `run_in_background: true`），开 `scripts/audit-scenes.html` 点「开始审计」，记下本批 8 个工具中「驱动」列显示 `无 · 静止` 的页签。应与下表一致，不一致以实测为准并在报告里说明：

```
pi-essence-3d                          arch, area, prob, series
combinatorics-generating-functions-3d  rules, coeff, conv, fib
exponential-logarithm-essence-3d       grow, inverse, mullog
algorithmic-complexity-growth-3d       bigO, halving, rectree
random-variable-expectation-variance-3d vari, lin
complex-mult-3d                        roots
cartesian-polar-coordinate-3d          morph
forces-free-body-diagrams-3d           incline
```

- [ ] **Step 2: 逐场景走判定程序**

对每个静止页签，按本计划「驱动声明的判定程序」七步走。**先读该场景的 `brand` 与 `tips`**——它们是作者写下的"这一页要让人看见什么"，是判定的起点。

在报告里为每个页签记一段：场景在演示什么（引 `tips` 原话）、选定的驱动量与理由、值域与为何如此取、`kind` 的判据（从 `to` 跳回 `from` 会不会跳变）、`period` 与理由。

判为正当静止的，写明属于哪一类（静态参照 / 用户输入驱动 / 全离散参数 / 驱动破坏教学意图）。

- [ ] **Step 3: 写入 `drive` 声明**

在场景对象里，紧跟已有的 `params:` 那一行之后插入，与 starter 的写法一致：

```js
  arch: {
    label: { zh: '阿基米德夹逼', en: 'Archimedes' },
    params: ['archN'],
    /* 边数越多越逼近圆：这是本页的顿悟点，让它自己从粗到细走一遍 */
    drive: { key: 'archN', from: 3, to: 96, period: 10, kind: 'linear' },
    brand: { … },
```

正当静止的写法：

```js
    /* 静止对照：本页给出不随时间变化的构造，供「展开一圈」页对照 */
    drive: null,
```

若驱动量带 `map` 而缺 `invMap`，在 `PARAMS` 里补上。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

meta 的 **minor** 位加一、patch 归零（`1.0.1` → `1.1.0`）。头注释 changelog 最上方加一行：

```
    1.1.0  2026-07-31  静止页签接入时间驱动：自动播放可开关，往返/循环可切换
```

注意 changelog 标题文案有两种写法（`版本记录（新→旧）：` 与 `版本记录（changelog，新→旧）：`），**保持各文件原有写法**。

- [ ] **Step 5: 语法门禁**

```bash
for f in pi-essence-3d combinatorics-generating-functions-3d exponential-logarithm-essence-3d algorithmic-complexity-growth-3d random-variable-expectation-variance-3d complex-mult-3d cartesian-polar-coordinate-3d forces-free-body-diagrams-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：8 行全 OK。

- [ ] **Step 6: 浏览器验收**

对每个工具开 `http://localhost:8832/outputs/<id>.html`，控制台执行：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const d = SCENES[k].drive;
  if (!d) return { tab: k, drive: 'null' };
  const t0 = state.t, v0 = state[d.key];
  state.t += d.period / 4; applyDrive();
  const v1 = state[d.key];
  state.t = t0; applyDrive();
  return { tab: k, key: d.key, kind: d.kind,
           moved: Math.abs(v1 - v0) > 1e-9,
           inRange: v1 >= Math.min(d.from, d.to) - 1e-9 && v1 <= Math.max(d.from, d.to) + 1e-9,
           driveRow: !!document.querySelector('.drive[data-tab="' + k + '"]') };
})
```

每个有 `drive` 的页签必须 `moved: true`、`inRange: true`、`driveRow: true`。

再验证首尾无跳变——一整轮结束应回到起点：

```js
Object.keys(SCENES).filter(k => SCENES[k].drive).map(k => {
  switchTab(k);
  const d = SCENES[k].drive;
  const a = driveValue(d, 0, driveMode[k]);
  const b = driveValue(d, d.period, driveMode[k]);
  return { tab: k, seamless: Math.abs(a - b) < 1e-9 };
})
```
预期全部 `seamless: true`。

- [ ] **Step 7: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有本批 8 个 `outputs/*.html`，**不含 `tools.json`**。

```bash
git add outputs/pi-essence-3d.html outputs/combinatorics-generating-functions-3d.html outputs/exponential-logarithm-essence-3d.html outputs/algorithmic-complexity-growth-3d.html outputs/random-variable-expectation-variance-3d.html outputs/complex-mult-3d.html outputs/cartesian-polar-coordinate-3d.html outputs/forces-free-body-diagrams-3d.html
git commit -m "feat(tools): 批次 1 静止页签接入时间驱动（8 个工具 / 19 个页签）"
```

---

## Task 3: 驱动声明 · 批次 2（8 个工具 / 19 个静止页签）

**Files:**
- Modify: `outputs/phi-essence-3d.html`(4)、`outputs/huffman-coding-text-3d.html`(4)、`outputs/binomial-pascal-probability-3d.html`(3)、`outputs/conic-essence-3d.html`(2)、`outputs/trig-identity-3d.html`(2)、`outputs/basis-change-coordinates-3d.html`(2)、`outputs/kelly-essence-3d.html`(1)、`outputs/markov-chains-stationary-distribution-3d.html`(1)

**Interfaces:**
- Consumes: Task 1 落地的驱动引擎；阶段 2 已声明的 `SCENES[*].params`
- Produces: 本批 8 个 HTML 的 meta 版本号（minor 递增）

**本批两个特殊情况：**

- **`huffman-coding-text-3d` 四个页签全静止，但很可能全部是正当静止**——它的内容由文本框（`TEXT_STATE.raw`）驱动，不是时间。仍要逐页签走判定程序（例如「建树」页的合并步数是否该随时间推进？），但若结论是 `drive: null`，理由写"由用户输入驱动"。
- **`basis-change-coordinates-3d` 有作者手写的 `autoMorph` 开关**（`morphS()` 里 `state.autoMorph ? … : state.k`）——**整个 `drive` 机制就是从它泛化来的**。声明 `drive` 时要判断：是让引擎接管、退役 `autoMorph`，还是两者共存。若退役，须同时移除 `autoMorph` 开关与 `morphS()` 里的分支，并在报告里说明。

- [ ] **Step 1: 确认本批的静止页签清单**

起服务器（`python3 -m http.server 8833`，Bash `run_in_background: true`），开 `scripts/audit-scenes.html` 点「开始审计」，记下本批 8 个工具中「驱动」列为 `无 · 静止` 的页签。预期：

```
phi-essence-3d                          cut, fib, frac, star
huffman-coding-text-3d                  freq, build, codes, encode
binomial-pascal-probability-3d          expand, pascal, dist
conic-essence-3d                        cone, dandelin
trig-identity-3d                        rot, sym
basis-change-coordinates-3d             std, skew
kelly-essence-3d                        mountain
markov-chains-stationary-distribution-3d simplex
```

- [ ] **Step 2: 逐场景走判定程序**

按本计划「驱动声明的判定程序」七步走，先读 `brand` 与 `tips`。报告里每页签记一段：演示什么（引 `tips`）、驱动量与理由、值域、`kind` 判据、`period` 理由。正当静止的写明类别。

- [ ] **Step 3: 写入 `drive` 声明**

紧跟场景的 `params:` 之后插入：

```js
  cone: {
    label: { zh: '圆锥截线', en: 'Conic sections' },
    params: ['e'],
    /* 离心率连续变化时截线由椭圆经抛物线变双曲线，这是本页的顿悟点 */
    drive: { key: 'e', from: 0.1, to: 2.4, period: 10, kind: 'linear' },
    brand: { … },
```

（键名与数值是示意，以你实际判定为准。）正当静止写 `drive: null,` 并在上一行注释理由。驱动量带 `map` 而缺 `invMap` 的，在 `PARAMS` 里补上。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

meta 的 minor 位加一、patch 归零。头注释 changelog 最上方加：

```
    1.1.0  2026-07-31  静止页签接入时间驱动：自动播放可开关，往返/循环可切换
```

保持各文件原有的 changelog 标题写法。

- [ ] **Step 5: 语法门禁**

```bash
for f in phi-essence-3d huffman-coding-text-3d binomial-pascal-probability-3d conic-essence-3d trig-identity-3d basis-change-coordinates-3d kelly-essence-3d markov-chains-stationary-distribution-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：8 行全 OK。

- [ ] **Step 6: 浏览器验收**

对每个工具开 `http://localhost:8833/outputs/<id>.html`，执行驱动生效断言：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const d = SCENES[k].drive;
  if (!d) return { tab: k, drive: 'null' };
  const t0 = state.t, v0 = state[d.key];
  state.t += d.period / 4; applyDrive();
  const v1 = state[d.key];
  state.t = t0; applyDrive();
  return { tab: k, key: d.key, kind: d.kind,
           moved: Math.abs(v1 - v0) > 1e-9,
           inRange: v1 >= Math.min(d.from, d.to) - 1e-9 && v1 <= Math.max(d.from, d.to) + 1e-9,
           driveRow: !!document.querySelector('.drive[data-tab="' + k + '"]') };
})
```
每个有 `drive` 的页签须 `moved/inRange/driveRow` 全 true。

再验首尾无跳变：

```js
Object.keys(SCENES).filter(k => SCENES[k].drive).map(k => {
  switchTab(k);
  const d = SCENES[k].drive;
  return { tab: k, seamless: Math.abs(driveValue(d, 0, driveMode[k]) - driveValue(d, d.period, driveMode[k])) < 1e-9 };
})
```
预期全 `seamless: true`。

`huffman-coding-text-3d` 额外确认文本框仍然可用（改字画面跟着变）。若 `basis-change-coordinates-3d` 退役了 `autoMorph`，确认原有的往返演示行为由引擎驱动等价复现。

- [ ] **Step 7: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有本批 8 个 `outputs/*.html`，不含 `tools.json`。

```bash
git add outputs/phi-essence-3d.html outputs/huffman-coding-text-3d.html outputs/binomial-pascal-probability-3d.html outputs/conic-essence-3d.html outputs/trig-identity-3d.html outputs/basis-change-coordinates-3d.html outputs/kelly-essence-3d.html outputs/markov-chains-stationary-distribution-3d.html
git commit -m "feat(tools): 批次 2 静止页签接入时间驱动（8 个工具 / 19 个页签）"
```

---

## Task 4: 驱动声明 · 批次 3（8 个工具 / 19 个静止页签）

**Files:**
- Modify: `outputs/conditional-probability-bayes-3d.html`(4)、`outputs/derivative-essence-3d.html`(3)、`outputs/recurrence-iteration-dynamics-3d.html`(3)、`outputs/modular-arithmetic-euclid-crt-3d.html`(3)、`outputs/weierstrass-essence-3d.html`(2)、`outputs/linear-systems-rank-nullspace-3d.html`(2)、`outputs/lines-planes-3d.html`(1)、`outputs/information-entropy-coding-3d.html`(1)

**Interfaces:**
- Consumes: Task 1 落地的驱动引擎；阶段 2 已声明的 `SCENES[*].params`
- Produces: 本批 8 个 HTML 的 meta 版本号（minor 递增）

**本批的重点工具：`weierstrass-essence-3d`** —— 这是用户最初报告问题时举的例子。它的 `chord` 页作者原本就期望"角 x 随时间变化来展现图像"，`rational` 页同理（弦斜率 t）。这两个页签的驱动量几乎是给定的，是检验判定程序是否好用的标尺。

`recurrence-iteration-dynamics-3d` 三个页签全静止，且迭代类场景的自变量通常是**迭代步数**——注意区分"步数"（离散、`linear`、从 0 到 N）与"参数"（连续）。

- [ ] **Step 1: 确认本批的静止页签清单**

起服务器（`python3 -m http.server 8834`，Bash `run_in_background: true`），开 `scripts/audit-scenes.html` 点「开始审计」，记下「驱动」列为 `无 · 静止` 的页签。预期：

```
conditional-probability-bayes-3d      area, tree, bayes, indep
derivative-essence-3d                 secant, diff, chain
recurrence-iteration-dynamics-3d      cobweb, lift, newton
modular-arithmetic-euclid-crt-3d      modops, euclid, crt
weierstrass-essence-3d                chord, rational
linear-systems-rank-nullspace-3d      rows, planes
lines-planes-3d                       dist
information-entropy-coding-3d         coding
```

- [ ] **Step 2: 逐场景走判定程序**

按七步走，先读 `brand` 与 `tips`。报告里每页签记一段：演示什么（引 `tips`）、驱动量与理由、值域、`kind` 判据、`period` 理由。正当静止写明类别。

- [ ] **Step 3: 写入 `drive` 声明**

紧跟 `params:` 之后插入。`weierstrass-essence-3d` 的 `chord` 页示例——`xAng` 带 `map: v => v * Math.PI / 180`，故须同时补 `invMap`：

```js
  chord: {
    label: { zh: '弦 · 半角', en: 'Chord · Half angle' },
    params: ['xAng'],
    /* 角 x 扫过整个范围时弦、半角与投影同步变化，正是本页要让人看见的 */
    drive: { key: 'xAng', from: -Math.PI, to: Math.PI, period: 10, kind: 'circular' },
    brand: { … },
```

对应在 `PARAMS` 里：

```js
  { key: 'xAng', …, map: v => v * Math.PI / 180, invMap: v => v * 180 / Math.PI },
```

正当静止写 `drive: null,` 并在上一行注释理由。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

meta 的 minor 位加一、patch 归零。头注释 changelog 最上方加：

```
    1.1.0  2026-07-31  静止页签接入时间驱动：自动播放可开关，往返/循环可切换
```

保持各文件原有的 changelog 标题写法。

- [ ] **Step 5: 语法门禁**

```bash
for f in conditional-probability-bayes-3d derivative-essence-3d recurrence-iteration-dynamics-3d modular-arithmetic-euclid-crt-3d weierstrass-essence-3d linear-systems-rank-nullspace-3d lines-planes-3d information-entropy-coding-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：8 行全 OK。

- [ ] **Step 6: 浏览器验收**

对每个工具开 `http://localhost:8834/outputs/<id>.html`，执行驱动生效断言：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const d = SCENES[k].drive;
  if (!d) return { tab: k, drive: 'null' };
  const t0 = state.t, v0 = state[d.key];
  state.t += d.period / 4; applyDrive();
  const v1 = state[d.key];
  state.t = t0; applyDrive();
  return { tab: k, key: d.key, kind: d.kind,
           moved: Math.abs(v1 - v0) > 1e-9,
           inRange: v1 >= Math.min(d.from, d.to) - 1e-9 && v1 <= Math.max(d.from, d.to) + 1e-9,
           driveRow: !!document.querySelector('.drive[data-tab="' + k + '"]') };
})
```
每个有 `drive` 的页签须三项全 true。

再验首尾无跳变：

```js
Object.keys(SCENES).filter(k => SCENES[k].drive).map(k => {
  switchTab(k);
  const d = SCENES[k].drive;
  return { tab: k, seamless: Math.abs(driveValue(d, 0, driveMode[k]) - driveValue(d, d.period, driveMode[k])) < 1e-9 };
})
```
预期全 `seamless: true`。

**`weierstrass-essence-3d` 额外做肉眼验收**：切到「弦·半角」页，角 x 应自己扫动且弦、半角、投影同步变化；勾掉「自动播放」应定格；拖动角 x 滑块应自动关闭自动播放。这是用户最初报告的场景，要确认它真的被修好了。

若某个驱动量补了 `invMap`，确认自动播放时滑块位置跟着动、读数与滑块一致。

- [ ] **Step 7: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有本批 8 个 `outputs/*.html`，不含 `tools.json`。

```bash
git add outputs/conditional-probability-bayes-3d.html outputs/derivative-essence-3d.html outputs/recurrence-iteration-dynamics-3d.html outputs/modular-arithmetic-euclid-crt-3d.html outputs/weierstrass-essence-3d.html outputs/linear-systems-rank-nullspace-3d.html outputs/lines-planes-3d.html outputs/information-entropy-coding-3d.html
git commit -m "feat(tools): 批次 3 静止页签接入时间驱动（8 个工具 / 19 个页签）"
```

---

## Task 5: 驱动声明 · 批次 4（7 个工具 / 18 个静止页签）

**Files:**
- Modify: `outputs/sequences-series-essence-3d.html`(4)、`outputs/limit-essence-3d.html`(3)、`outputs/e-essence-3d.html`(3)、`outputs/proof-logic-induction-3d.html`(3)、`outputs/inverse-trig-essence-3d.html`(2)、`outputs/vector-fields-divergence-curl-3d.html`(2)、`outputs/gradient-contours-surface-3d.html`(1)

**Interfaces:**
- Consumes: Task 1 落地的驱动引擎；阶段 2 已声明的 `SCENES[*].params`
- Produces: 本批 7 个 HTML 的 meta 版本号（minor 递增）

**本批含两个全静止工具**（`sequences-series-essence-3d`、`limit-essence-3d`），它们目前完全是静态插图，收益最直接。两者都是"逼近/收敛"主题——判定程序里对应的自变量通常是**项数或细分数，从粗到细**，`linear`。

`proof-logic-induction-3d` 的归纳法页签，自变量很可能是**归纳步数** n；注意 n 是离散的，值域取整数区间，`period` 要留够让人看清每一步。

- [ ] **Step 1: 确认本批的静止页签清单**

起服务器（`python3 -m http.server 8835`，Bash `run_in_background: true`），开 `scripts/audit-scenes.html` 点「开始审计」，记下「驱动」列为 `无 · 静止` 的页签。预期：

```
sequences-series-essence-3d       ladder, partial, geoseries, harmonic
limit-essence-3d                  order, series, micro
e-essence-3d                      deriv, area, stat
proof-logic-induction-3d          implication, quantifiers, counterexample
inverse-trig-essence-3d           circle, mirror
vector-fields-divergence-curl-3d  curl, grad
gradient-contours-surface-3d      tan
```

- [ ] **Step 2: 逐场景走判定程序**

按七步走，先读 `brand` 与 `tips`。报告里每页签记一段：演示什么（引 `tips`）、驱动量与理由、值域、`kind` 判据、`period` 理由。正当静止写明类别。

- [ ] **Step 3: 写入 `drive` 声明**

紧跟 `params:` 之后插入。逼近类场景示例：

```js
  partial: {
    label: { zh: '部分和', en: 'Partial sums' },
    params: ['nTerms'],
    /* 项数从少到多，部分和逐步逼近极限——这是本页唯一要传达的事 */
    drive: { key: 'nTerms', from: 1, to: 40, period: 12, kind: 'linear' },
    brand: { … },
```

（键名与数值是示意，以实际判定为准。）正当静止写 `drive: null,` 并在上一行注释理由。带 `map` 的驱动量须补 `invMap`。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

meta 的 minor 位加一、patch 归零。头注释 changelog 最上方加：

```
    1.1.0  2026-07-31  静止页签接入时间驱动：自动播放可开关，往返/循环可切换
```

保持各文件原有的 changelog 标题写法。

- [ ] **Step 5: 语法门禁**

```bash
for f in sequences-series-essence-3d limit-essence-3d e-essence-3d proof-logic-induction-3d inverse-trig-essence-3d vector-fields-divergence-curl-3d gradient-contours-surface-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：7 行全 OK。

- [ ] **Step 6: 浏览器验收**

对每个工具开 `http://localhost:8835/outputs/<id>.html`，执行驱动生效断言：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const d = SCENES[k].drive;
  if (!d) return { tab: k, drive: 'null' };
  const t0 = state.t, v0 = state[d.key];
  state.t += d.period / 4; applyDrive();
  const v1 = state[d.key];
  state.t = t0; applyDrive();
  return { tab: k, key: d.key, kind: d.kind,
           moved: Math.abs(v1 - v0) > 1e-9,
           inRange: v1 >= Math.min(d.from, d.to) - 1e-9 && v1 <= Math.max(d.from, d.to) + 1e-9,
           driveRow: !!document.querySelector('.drive[data-tab="' + k + '"]') };
})
```
每个有 `drive` 的页签须三项全 true。

再验首尾无跳变：

```js
Object.keys(SCENES).filter(k => SCENES[k].drive).map(k => {
  switchTab(k);
  const d = SCENES[k].drive;
  return { tab: k, seamless: Math.abs(driveValue(d, 0, driveMode[k]) - driveValue(d, d.period, driveMode[k])) < 1e-9 };
})
```
预期全 `seamless: true`。

**两个全静止工具额外做肉眼验收**：`sequences-series-essence-3d` 与 `limit-essence-3d` 现在应当整个工具都有动画，不再是静态插图。

- [ ] **Step 7: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有本批 7 个 `outputs/*.html`，不含 `tools.json`。

```bash
git add outputs/sequences-series-essence-3d.html outputs/limit-essence-3d.html outputs/e-essence-3d.html outputs/proof-logic-induction-3d.html outputs/inverse-trig-essence-3d.html outputs/vector-fields-divergence-curl-3d.html outputs/gradient-contours-surface-3d.html
git commit -m "feat(tools): 批次 4 静止页签接入时间驱动（7 个工具 / 18 个页签）"
```

---

## Task 6: 驱动声明 · 批次 5（7 个工具 / 18 个静止页签）

**Files:**
- Modify: `outputs/least-squares-orthogonal-projection-3d.html`(4)、`outputs/gaussian-essence-3d.html`(3)、`outputs/i-essence-3d.html`(3)、`outputs/optimization-convexity-gradient-descent-3d.html`(3)、`outputs/linear-essence-3d.html`(2)、`outputs/svd-pca-dimensionality-reduction-3d.html`(2)、`outputs/torque-equilibrium-centre-mass-3d.html`(1)

**Interfaces:**
- Consumes: Task 1 落地的驱动引擎；阶段 2 已声明的 `SCENES[*].params`
- Produces: 本批 7 个 HTML 的 meta 版本号（minor 递增）

**本批含一个全静止工具**（`least-squares-orthogonal-projection-3d`，4 个页签）。最小二乘/正交投影主题的自变量通常是**被投影向量的方向或数据点位置**。

`optimization-convexity-gradient-descent-3d` 的梯度下降页签，自变量很可能是**迭代步数**或**学习率**——注意这两者演示的是不同的事，读 `tips` 判断作者要讲哪一个。

- [ ] **Step 1: 确认本批的静止页签清单**

起服务器（`python3 -m http.server 8836`，Bash `run_in_background: true`），开 `scripts/audit-scenes.html` 点「开始审计」，记下「驱动」列为 `无 · 静止` 的页签。预期：

```
least-squares-orthogonal-projection-3d     proj, cols, fit, normal
gaussian-essence-3d                        bell, clt, joint
i-essence-3d                               roots, conj, matrix
optimization-convexity-gradient-descent-3d one, valley, convex
linear-essence-3d                          vec, cross
svd-pca-dimensionality-reduction-3d        pca, recon
torque-equilibrium-centre-mass-3d          com
```

- [ ] **Step 2: 逐场景走判定程序**

按七步走，先读 `brand` 与 `tips`。报告里每页签记一段：演示什么（引 `tips`）、驱动量与理由、值域、`kind` 判据、`period` 理由。正当静止写明类别。

- [ ] **Step 3: 写入 `drive` 声明**

紧跟 `params:` 之后插入。角度类驱动示例（注意 `kind: 'circular'`，因为绕满一圈首尾相接）：

```js
  proj: {
    label: { zh: '正交投影', en: 'Orthogonal projection' },
    params: ['vAng', 'vLen'],
    /* 向量方向绕一圈，投影长度与残差随之起伏——投影的几何含义就在这个过程里 */
    drive: { key: 'vAng', from: 0, to: 2 * Math.PI, period: 10, kind: 'circular' },
    brand: { … },
```

（键名与数值是示意，以实际判定为准。）正当静止写 `drive: null,` 并在上一行注释理由。带 `map` 的驱动量须补 `invMap`。

- [ ] **Step 4: 版本号与 changelog（HTML 两处）**

meta 的 minor 位加一、patch 归零。头注释 changelog 最上方加：

```
    1.1.0  2026-07-31  静止页签接入时间驱动：自动播放可开关，往返/循环可切换
```

保持各文件原有的 changelog 标题写法。

- [ ] **Step 5: 语法门禁**

```bash
for f in least-squares-orthogonal-projection-3d gaussian-essence-3d i-essence-3d optimization-convexity-gradient-descent-3d linear-essence-3d svd-pca-dimensionality-reduction-3d torque-equilibrium-centre-mass-3d; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期：7 行全 OK。

- [ ] **Step 6: 浏览器验收**

对每个工具开 `http://localhost:8836/outputs/<id>.html`，执行驱动生效断言：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  const d = SCENES[k].drive;
  if (!d) return { tab: k, drive: 'null' };
  const t0 = state.t, v0 = state[d.key];
  state.t += d.period / 4; applyDrive();
  const v1 = state[d.key];
  state.t = t0; applyDrive();
  return { tab: k, key: d.key, kind: d.kind,
           moved: Math.abs(v1 - v0) > 1e-9,
           inRange: v1 >= Math.min(d.from, d.to) - 1e-9 && v1 <= Math.max(d.from, d.to) + 1e-9,
           driveRow: !!document.querySelector('.drive[data-tab="' + k + '"]') };
})
```
每个有 `drive` 的页签须三项全 true。

再验首尾无跳变：

```js
Object.keys(SCENES).filter(k => SCENES[k].drive).map(k => {
  switchTab(k);
  const d = SCENES[k].drive;
  return { tab: k, seamless: Math.abs(driveValue(d, 0, driveMode[k]) - driveValue(d, d.period, driveMode[k])) < 1e-9 };
})
```
预期全 `seamless: true`。

**`least-squares-orthogonal-projection-3d` 额外做肉眼验收**：它此前整个工具都是静态插图，现在四个页签应当都有动画。

- [ ] **Step 7: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有本批 7 个 `outputs/*.html`，不含 `tools.json`。

```bash
git add outputs/least-squares-orthogonal-projection-3d.html outputs/gaussian-essence-3d.html outputs/i-essence-3d.html outputs/optimization-convexity-gradient-descent-3d.html outputs/linear-essence-3d.html outputs/svd-pca-dimensionality-reduction-3d.html outputs/torque-equilibrium-centre-mass-3d.html
git commit -m "feat(tools): 批次 5 静止页签接入时间驱动（7 个工具 / 18 个页签）"
```

---

## Task 7: 注册表登记与全量验收

**必须最后做**，依赖 Task 1–6 全部合并。

**Files:**
- Modify: `tools.json`
- Modify（由脚本自动重写）: `app.html`、`index.html`

**Interfaces:**
- Consumes: Task 2–6 写入 38 个 HTML 的 `<meta name="tool-version">`
- Produces: 无

- [ ] **Step 1: 从 HTML 读回版本号，写进 `tools.json`**

以 HTML 的 meta 为准，脚本同步，不手抄：

```bash
python3 - <<'PY'
import json, re, pathlib, collections
d = json.load(open('tools.json', encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
CH = collections.OrderedDict([
    ('date', '2026-07-31'),
    ('zh', '静止页签接入时间驱动：自动播放可开关，往返/循环可切换'),
    ('en', 'Static tabs now animate: a per-tab auto-play toggle with switchable ping-pong / loop modes')])
changed = []
for t in d['tools']:
    if t['id'] == 'trig-essence-3d-new':
        continue
    src = pathlib.Path(t['file']).read_text(encoding='utf-8')
    v = re.search(r'<meta name="tool-version" content="([^"]+)">', src).group(1)
    if v == t['version']:
        continue
    e = collections.OrderedDict([('version', v)]); e.update(CH)
    t['version'] = v
    t['changelog'].insert(0, e)
    changed.append((t['id'], v))
with open('tools.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2); f.write('\n')
print(f'更新 {len(changed)} 个条目')
for i, v in changed: print(f'  {i:<46} -> {v}')
PY
```

预期：`更新 38 个条目`（本阶段只动了 38 个工具，其余 12 个未改）。**若数字不是 38，停下来查是哪个批次漏改了 meta。**

- [ ] **Step 2: 同步注册表镜像**

```bash
python3 scripts/sync_registry.py
```
预期两行 `已同步（51 个工具）`。

- [ ] **Step 3: 三处版本号一致性校验**

```bash
python3 - <<'PY'
import json, re, pathlib
d = json.load(open('tools.json', encoding='utf-8'))
bad = []
for t in d['tools']:
    if t['id'] == 'trig-essence-3d-new': continue
    src = pathlib.Path(t['file']).read_text(encoding='utf-8')
    meta = re.search(r'<meta name="tool-version" content="([^"]+)">', src).group(1)
    m = re.search(r'版本记录（(?:changelog，)?新→旧）：\s*\n\s*([0-9.]+)', src)
    head = m.group(1) if m else '(缺)'
    if not (meta == t['version'] == head): bad.append((t['id'], meta, t['version'], head))
print('全部一致' if not bad else bad)
PY
```
预期：`全部一致`。

- [ ] **Step 4: 语法门禁与注册表校验**

```bash
fail=0
for f in outputs/*.html app.html index.html; do
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "$f" | node --check /dev/stdin || { echo "FAIL $f"; fail=1; }
done
[ $fail -eq 0 ] && echo "全部通过"
python3 scripts/sync_registry.py --check
```

- [ ] **Step 5: 审计全量复核——静止页签必须清零（或有据可查）**

起服务器，开 `scripts/audit-scenes.html` 点「开始审计」，等它跑完。

- 「静止页签」计数应从 **93** 大幅下降。**剩余的每一个都必须对应一处显式 `drive: null`**——审计工具看不到 `drive: null` 的注释理由，所以逐个对照批次报告核实。
- 不得出现新的「漏声明」行——本阶段不改 `params`，出现即为回归。
- 滑块无效率应维持在 33% 左右；显著上升说明某个批次误改了 `params`。

- [ ] **Step 6: 录制器贯通验收**

阶段 1 已让录制器经 `REC.Bridge` 消费 `applyDrive` / `driveInfo`，但此前 50 个工具都没有这两个函数，所以**这条路径从未在真实工具上跑通过**。现在必须验：

开 `http://localhost:8777/app.html?tool=weierstrass-essence-3d`，切到「弦·半角」页，把下载改成捕获 Blob：

```js
window.__p = null;
REC.Encoder.download = function(b, n){ window.__p = { name: n, bytes: b.size, type: b.type }; };
REC.CFG.visual = 'overlay'; REC.CFG.aspect = '16:9'; REC.CFG.res = '1080p';
REC.CFG.drive = 'offline'; REC.CFG.duration = 0.1; REC.CFG.loop = false;
var h = REC.Bridge.get();
window.__v0 = h.state.xAng;
REC.UI.run();
```

截图 2–3 张推动 rAF，然后读：

```js
({ probe: window.__p, before: window.__v0, after: REC.Bridge.get().state.xAng,
   moved: Math.abs(REC.Bridge.get().state.xAng - window.__v0) > 1e-9 })
```

预期：产出非零 Blob，且 `moved: true`——证明离线录制真的沿用了场景驱动。再确认 `REC.UI.effDur()` 在勾选无缝循环时吸附到该场景 `drive.period` 的整数倍。

- [ ] **Step 7: 抽样人工验收**

挑三个代表肉眼确认：

- `weierstrass-essence-3d`「弦·半角」页：角 x 自己扫动，弦与半角同步变化；这是用户最初报告的场景
- `limit-essence-3d`：此前整个工具静态，现在三个页签都有动画
- 任一带 `circular` 驱动的页签：一整轮结束时首尾衔接，无跳变

- [ ] **Step 8: 提交**

```bash
git add tools.json app.html index.html
git commit -m "feat(registry): 阶段 3 的 38 个工具版本登记与镜像同步"
```

---

## Self-Review 记录

**Spec 覆盖**：§B 时间驱动（`drive` 字段、`driveValue` 纯函数、`applyDrive`）→ Task 1 落地引擎 + Task 2–6 声明；§C 交互模型（自动播放开关、模式切换、拖动接管、per-tab 记忆）→ Task 1 落地；§D 与录制器的交互 → Task 7 Step 6 首次在真实工具上验证；§8 清单第 2 条 → Task 1 Step 1 修订为按结果判定；§G 阶段 3「按工具分批」→ Task 2–6。无遗漏。

**已知取舍（有意为之）**：
- **只处理 93 个静止页签**，95 个已有动画的不动。§8 原措辞要求 188 个场景全部声明，但其中 95 个由 `theta` 直接驱动，写 `drive: null` 纯属噪音——故把规则改为按结果判定「不得有静止页签」。
- **版本按 minor 递增**，与阶段 2 的 patch 不同：本阶段新增了自动播放这项能力，画面行为真实改变。
- **引擎落地放在第一个任务**，而非像阶段 2 那样假定已就位。已核实 8 个驱动相关标识符在 50 个工具里出现次数均为 0。
- **`drive: null` 需要理由且会被审查**。判定程序若认真执行，93 个页签里正当静止的应是少数；超过三分之一就说明程序没被执行。
