# 阶段 7：`rookCover` 与 `kingDominate` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给工具⑤ 补上最后两道题——带障碍盘上的**最大匹配 = 最少线覆盖**（二分图匹配 + König 定理；⚠ **不是**「最少的车数」，见 Task 2 那一节的订正）与**最少王支配**（贪心与精确同屏并排），并让「最优解你等不起」这件事在屏幕上可见。

**Architecture:** 两题都不需要新架构。`rookCover` 是单轨，复用 `queens` / `knightPath` 的形状；`kingDominate` 是双轨，复用 `tourKnight` 的「同屏并排」。真正的新东西只有三个算法源码与「障碍格」这一个盘面概念。增广路直接画在棋盘上——它落在棋盘上正好是一条横一段竖一段的**交替行走**，不需要任何抽象图。

**Tech Stack:** 零依赖原生 JS（UMD）、`chess/core/_test.js`、`chess/core/interp.js` 的 ES 子集解释器、Canvas 2D。无构建、无包管理器。

## Global Constraints

- **零依赖**：不得引入任何 npm 包、CDN 资源、外部字体或图片。
- **单文件可用**：`chess/tools/chess-board-algorithms.html` 必须 `file://` 双击可用。
- **UMD 双导出**：`chess/core/*.js` 既支持 `module.exports`，也挂到 `window`。
- **纯逻辑核不得触碰 DOM**：`document` / `window`（除 UMD 挂载）/ `localStorage` / `location` 不得出现在 `chess/core/algos/*.js` 里。
- **英文默认、中文可切**（§1.6）。所有面向用户的文案是 `{zh, en}` 对象，切语言后必须真的重绘。
- **一切按时间推进，不按帧计数**——开发机外接显示器是 30Hz。
- **每帧绘制耗时 ≤4ms**（口径是**帧回调时长**：`performance.now()` 包 rAF 回调，量的是 JS 工作量，不含浏览器后续 paint/composite。阶段 6 实测 p95 1.3 ms）。
- **`null` 表示「不知道」，永远不许变成数字或布尔值。**
- **不改 `chess/core/interp.js` / `debugger.js` / `editor.js` / `tree-model.js`。** 若发现非改不可，**停下来报告**（阶段 4 正是这样发现了 `interp.js` 的一个真缺陷——值得，但要经过裁定）。
- **不改阶段 5/6 已交付的五份 `algos/*.js` 与 `exercise.js`**（`queens` / `tour-dfs` / `tour-warnsdorff` / `knight-path` 与它们的挖空指令行）。
- **子集里没有三元运算符**；宿主桥接是写死的五个名字 `log` / `mark` / `place` / `clear` / `attacked`；`Interp.STEP_LIMIT = 200000`。
- **约束 6**（本项目已抓到八次的缺陷类）：**每个新增导出，都问一遍「少传一个参数会怎样」，并让它大声失败。**
- **约束 7**：`_test.js` 的 `eq` 用 `JSON.stringify` 比较，`JSON.stringify(function(){})` 与 `JSON.stringify(undefined)` **都是 `undefined`**；断言「某值不存在」要写 `T.ok(typeof x === 'undefined', …)`。
- **相机按 §5.3 常规条**：`1` 正视 `{az:0, el:0, dist:14}`、`2` 桌面 45° `{az:0, el:-Math.PI/4, dist:15}`（**负仰角不是笔误**：`eye.y = dist·sin(el)`，rank 0 在负 y）。
- **版本落三处**：`chess/chess-tools.json` 的 `version` + `changelog`、HTML 的 `tool-version` meta、**以及脚本里的 `VERSION` 常量**——chess 引擎的角标读的是**常量不是 meta**（阶段 6 审核复核过：运行期没有任何地方读那个 meta）。工具⑤ 当前 **1.1.0**，本阶段升 **1.2.0**。
- **提交纪律**：`git status --short` 后**只暂存显式路径**，禁止 `git add -A` / `git commit -a`。**注意 `.githooks/pre-commit` 会重跑 `inline_core.py`，它从磁盘读 `chess/core/**/*.js` 再 `git add`——「只暂存显式路径」挡不住别的 session 未提交的改动被卷进来**（阶段 6 发生过一次）。提交前逐条看清 `git status --short` 里每个路径都是自己的。
- **共享 scratchpad 的文件名要带任务前缀**（`t2-` / `t4-`）——阶段 6 两个 session 都写 `probe-quote.js`，一个覆盖了另一个。

## 这一阶段的实测事实（设计时量出来的，不要重新推导；若与你测的不符，那是数据，报告出来）

`kingDominate` 的**算法操作数**（解释器步数还要再乘几倍）：

| 盘 | 贪心 k / ops | 精确 k / ops |
|---|---|---|
| 5×5 三障碍 `[6,12,18]` | 4 / 488 | 4 / 1,440 |
| **6×6 障碍 `[6,24,35]`** | **6** / 1,362 | **4** / 6,952 |
| 6×6 七障碍 `[6,10,25,28,32,34,35]` | 7 / 1,211 | 5 / 24,779 |
| **7×7 三障碍 `[16,24,32]`** | 8 / 2,512 | 8 / **7,180,601** |
| 8×8 空盘 | 9 / 4,356 | 9 / **72,560,984** |

**矩形空盘上贪心与精确没有差距**（4×4 / 5×5 / 5×6 / 6×6 / 6×7 / 7×7 / 7×8 / 8×8 八种盘实测全部相同）——差距只在有障碍时出现。

## File Structure

| 文件 | 职责 |
|---|---|
| `chess/core/_test.js`（改）| `T.throws` 加可选消息 pattern（向后兼容，15 个测试文件不用动） |
| `chess/core/exercise-blanks.test.js`（改）| 加一条「插入指令行不改变步数」的常驻门 |
| `chess/core/algos/rook-cover.js`（新）| 增广路匹配 + König 最小点覆盖 |
| `chess/core/algos/rook-cover.test.js`（新）| 对拍独立参照实现 |
| `chess/core/algos/king-greedy.js`（新）| 贪心支配集 |
| `chess/core/algos/king-exact.js`（新）| 迭代加深精确支配集 |
| `chess/core/algos/king.test.js`（新）| 两份一起测（照 `tour.test.js` 一份覆盖两份源码的先例） |
| `chess/tools/chess-board-algorithms.html`（改）| 两个 `PROBLEMS` 键 + 两处 `GENERATED:ALGOS` 名字 + 版本 |
| `chess/chess-tools.json`（改）| `version` 1.2.0 + `changelog` |

---

## Task 1: 两件基建

**Files:**
- Modify: `chess/core/_test.js`
- Modify: `chess/core/exercise-blanks.test.js`

**Interfaces:**
- Produces: `T.throws(fn, label, pattern?)` —— `pattern` 是可选的字符串或正则；给了就要求异常消息匹配，不给则维持现状（**15 个测试文件一行不用改**）

**为什么先做这个**：阶段 6 的最终审核点名了这两条。本分支约 30 条 must-throw 断言目前是**消息盲的**——一条本该报「缺 hintEn=」的守卫换成任何 `TypeError` 也照样绿；而「插入指令行不改变步数」是阶段 6 最有分量的一条标准，却只靠一次性测量确认过，没有回归门。两件都做完，后面四个任务写的新断言才站在实地上。

- [ ] **Step 1: 写失败的测试**

在 `chess/core/exercise.test.js` 末尾（`T.report()` 之前）加：

```js
/* ---------- T.throws 的可选消息 pattern ---------- */
let patternWorked = false;
try {
  T.throws(function () { throw new Error('少了 hintEn='); }, '匹配得上', /hintEn/);
  patternWorked = true;
} catch (e) { patternWorked = false; }
T.ok(patternWorked, 'T.throws 的第三个参数匹配得上时照常通过');

/* 匹配不上时必须判失败——用一个探针计数器验证它真的记了一次 failed */
const failedBefore = T.failedCount();
T.throws(function () { throw new Error('别的错'); }, '匹配不上应当算失败', /hintEn/);
T.ok(T.failedCount() === failedBefore + 1, 'pattern 匹配不上时 T.throws 记一次失败');
```

**注意**：这需要 `_test.js` 导出一个读失败计数的办法（`failedCount()`）。**如果你认为让测试库自省是个坏主意，停下来报告**——替代方案是把 pattern 的行为做成一个独立的小测试脚本。

- [ ] **Step 2: 跑测试确认失败**

```bash
node chess/core/exercise.test.js
```
预期：`T.failedCount is not a function`。

- [ ] **Step 3: 实现**

`_test.js` 的 `throws(fn, label, pattern)`：捕获异常后，若 `pattern` 给了就检查 `String(err.message)` 是否匹配（字符串用 `indexOf`，正则用 `test`），不匹配则记失败并打印**期望的 pattern 与实际消息**。`pattern` 省略时行为**逐字不变**。

- [ ] **Step 4: 跑通，并确认 15 个既有测试文件一条不红**

```bash
node chess/core/exercise.test.js
node chess/core/exercise-blanks.test.js
node chess/core/algos/queens.test.js
node chess/core/algos/tour.test.js
node chess/core/algos/knight-path.test.js
python3 chess/scripts/check.py;   echo "gate exit=$?"
```
七道门必须跑到底、exit 0。

- [ ] **Step 5: 加「插入指令行不改变步数」的常驻门**

在 `chess/core/exercise-blanks.test.js` 里加，对**五个挖空所在的三份源码 × 它们各自的参数档位**逐一断言：

```js
/* 常驻门：指令行是注释，注释不产生步。
   阶段 6 靠一次性测量确认过这件事，但没有回归门——
   任何一次「顺手把指令行挪进代码里」都会悄悄改变步数，而那会同时
   动摇「参考答案就是那份正在跑的源码」这个支点。 */
function stepsOf(src) { return I.run(src, { host: {} }).trace.length; }
for (const [label, src] of REAL_SOURCES) {
  const clean = E.parse(src, 'en').clean;
  T.eq(stepsOf(clean), stepsOf(src), label + '：剥掉指令行后步数不变');
  T.eq(I.run(clean, { host: {} }).result, I.run(src, { host: {} }).result,
       label + '：剥掉指令行后返回值不变');
}
```

`REAL_SOURCES` 覆盖 queens N=4..8、knightPath 的两组、tourWarnsdorff 的四块盘。

- [ ] **Step 6: 做突变确认两条门都有牙**

把一行指令行改成真代码（例如把 `// >>> BLANK …` 改成 `let _x = 1;`），确认步数门变红；把 `T.throws` 的 pattern 检查删掉，确认 Step 1 那两条变红。**推荐 `require.cache` 注入**（不改磁盘、不碰 HEAD、进程退出即失效）。

- [ ] **Step 7: 提交**

```bash
git status --short
git add chess/core/_test.js chess/core/exercise.test.js chess/core/exercise-blanks.test.js
git commit -m "test(chess): T.throws 认消息、步数不变上常驻门"
```

---

## Task 2: `rook-cover.js` 与它的测试

**Files:**
- Create: `chess/core/algos/rook-cover.js`
- Create: `chess/core/algos/rook-cover.test.js`

**Interfaces:**
- Produces: `module.exports` / `root.AlgoRookCover` = `{ source({ W, H, blocked }) → string }`（与既有四份同形）
  - `blocked` 是障碍格编号的数组；**三个参数都没有默认值，少一个就抛**（约束 6）

**题面**（⚠ **2026-08-06 订正，以这一段为准**）：带障碍盘上，行被障碍断成若干**行段**、列断成若干**列段**；一个空格同时属于一个行段与一个列段——那就是二分图的一条边。要问的是两件事，答案是同一个数（König：最大匹配 = 最小点覆盖）：
① **最多能摆几辆互相吃不到的车？** ② **要盖住每个空格，最少要点亮几条线（段）？**

原写的「**最大匹配 = 最少的车数**」**不成立**，是 Task 2 的执行者发现、审查独立验证的：**一辆车是一条边**，一次占住一个行段和一个列段，所以 k 辆车最多点亮 2k 个点；König 给的是「最少的**线**」不是「最少的**车**」。最小反例是 2×2 挖一格（最大匹配 2、一辆车就盖满）；60 块随机小盘里 49 块最少车数严格更小、反向一次没有；本计划四档盘上「最大匹配 / 最少车数」是 **5/5、7/4、7/5、9/5**。下表的 `k` 一栏因此读作「**最大匹配 = 最少的线数**」，不是「最少的车数」。
「算完之后这些车顺手也盖住了所有空格」是真的（最大匹配必是极大匹配），但**必须括注「≠ 最少」**。

**画法**（这决定源码里 `mark`/`place` 怎么调）：
- 增广路 = 棋盘上一条**横一段竖一段的交替行走**：`mark(sq, 'try')` 点亮正在试的格、`mark(sq, 'ok')` 确认进入匹配、`mark(sq, 'cut')` 走不通、`mark(sq, 'back')` 回退
- 匹配边 = 一个空格上**站着的车**：`place(sq, 'wR')`
- 最小点覆盖 = 平面上亮起来的若干条行段/列段条带（由显示层根据轨迹推导，源码只负责 `mark`）

- [ ] **Step 1: 写失败的测试**

Create `chess/core/algos/rook-cover.test.js`。**对拍一份独立参照实现**（宿主侧写一个匈牙利算法，不复用被测源码的任何表）：

```js
'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const R = require('./rook-cover.js');

/* 宿主侧独立参照：行段/列段建图 + 匈牙利最大匹配。
   独立参照不是把被测源码抄一遍——被测源码跑在 ES 子集里、用的是
   位掩码与逐格扫描；这一份用邻接表与递归，只保证答案相同。 */
function hostMaxMatch(W, H, blocked) {
  const b = new Set(blocked);
  const rowSeg = new Array(W * H).fill(-1), colSeg = new Array(W * H).fill(-1);
  let nr = 0;
  for (let y = 0; y < H; y++) { let cur = -1;
    for (let x = 0; x < W; x++) { const s = y * W + x;
      if (b.has(s)) { cur = -1; continue; }
      if (cur < 0) { cur = nr++; } rowSeg[s] = cur; } }
  let nc = 0;
  for (let x = 0; x < W; x++) { let cur = -1;
    for (let y = 0; y < H; y++) { const s = y * W + x;
      if (b.has(s)) { cur = -1; continue; }
      if (cur < 0) { cur = nc++; } colSeg[s] = cur; } }
  const adj = Array.from({ length: nr }, () => []);
  for (let s = 0; s < W * H; s++) if (!b.has(s)) adj[rowSeg[s]].push(colSeg[s]);
  const mc = new Array(nc).fill(-1);
  const tryK = (r, seen) => {
    for (const c of adj[r]) {
      if (seen[c]) continue;
      seen[c] = 1;
      if (mc[c] < 0 || tryK(mc[c], seen)) { mc[c] = r; return true; }
    }
    return false;
  };
  let m = 0;
  for (let r = 0; r < nr; r++) if (tryK(r, new Array(nc).fill(0))) m++;
  return m;
}

/* 四档盘：实测值，不是候选。设计时量出来的，见下面的表。 */
const BOARDS = [
  ['5×5 空盘',   5, 5, [],                                5],
  ['5×5 四障碍', 5, 5, [3, 10, 13, 17, 18],               6],
  ['6×6 九障碍', 6, 6, [0, 6, 8, 9, 14, 20, 24, 26, 27],  7],
  ['6×7 九障碍', 6, 7, [4, 6, 7, 8, 26, 31, 33, 35, 37],  9],
];

for (const [label, W, H, blocked, expectK] of BOARDS) {
  const r = I.run(R.source({ W: W, H: H, blocked: blocked }), { host: {} });
  T.ok(!r.trace.truncated, label + ' 未截断');
  T.eq(r.result, hostMaxMatch(W, H, blocked), label + ' 的最大匹配与宿主侧匈牙利一致');
  T.eq(r.result, expectK, label + ' 的最大匹配是设计时量的那个数');
}

/* 摆出来的车必须真的构成一个合法覆盖——不只是返回一个数 */
/* 回放 place，检查：每个空格都被某辆车沿行/列（不穿过障碍）看得到 */

/* 约束 6：三个参数各缺一次 */
T.throws(function () { R.source(); }, 'source() 少了全部参数', /W/);
T.throws(function () { R.source({ H: 6, blocked: [] }); }, '少了 W', /W/);
T.throws(function () { R.source({ W: 6, blocked: [] }); }, '少了 H', /H/);
T.throws(function () { R.source({ W: 6, H: 6 }); }, '少了 blocked', /blocked/);
```

**四档盘是设计时实测选定的**（下表），不要另选。选它们的判据是 **k < min(行段数, 列段数)**——只有这时最大匹配才真的在做事；大多数随机盘上 k 恰好等于行段数，退化成「每段一个」，König 无戏可唱：

| 档 | 行段 / 列段 | 空格 | 最大匹配 k（= 最少的**线**数，**不是**最少车数） | `walk` 最深递归 | 算法访问数 | 这一段教什么 |
|---|---|---|---|---|---|---|
| 5×5 空盘 | 5 / 5 | 25 | **5 = 行数** | 1 | 722 步 · try/ok/cut/back 15/5/0/0 | **匹配根本没上场**——每行一个就够，这就是为什么这道题必须有障碍 |
| 5×5 `[3,14,17,18,21]` | 8 / 8 | 20 | **7**（比两边少 1）| 6 | 1,156 步 · 53/9/17/2 | 匹配第一次真的做事 |
| 6×6 `[0,6,8,9,14,20,24,26,27]` | 10 / 10 | 27 | **7**（少 3）| 4 | 1,411 步 · 46/8/17/1 | 差距更大 |
| 6×7 `[4,6,7,8,26,31,33,35,37]` | 12 / 12 | 33 | **9**（少 3）| **7** | 2,149 步 · 121/10/52/1 | 塔最高的一档 |

**第二档在修复轮 1 换过**：原写的 `[3,10,13,17,18]` 在最终实现下退化了（k=6 但 `back=0`，六辆车全是第一趟贪心坐下的），换成 `[3,14,17,18,21]`；它标的「增广路最深 5」在任何贪心优先取空列的实现里都达不到。

**⚠ 「最深递归」不等于「增广路最长」（2026-08-06 Task 3 实测订正）。** 上表末列那几个深度（1 / 6 / 4 / 7）**每一档都属于一次失败的搜索**；真正走通的增广路浅得多：1 / 3 / 2 / 2。原先在第四档写的「增广路最长的一档——横竖交替走七段」是错的：那 7 层里一辆车都没多。这不是缺点，是这一档最好的一句话——**正是那几趟失败的搜索问过的段，圈定了 König 的那些线**。

解释器步数只有 722–2,149，离 200,000 的上限差两个数量级，**`rookCover` 这边不存在撞墙风险**。第一档（空盘）是有意留的对照：它让「为什么要有障碍」这件事不用讲、看一眼就知道。

- [ ] **Step 2: 跑测试确认失败**

```bash
node chess/core/algos/rook-cover.test.js
```
预期：`Cannot find module './rook-cover.js'`。

- [ ] **Step 3: 实现**

照 `chess/core/algos/queens.js` 的结构（UMD、`HEAD`/`BODY` 字符串数组、`source(opts)` 三段式校验）。生成的源码必须在 ES 子集内：**无三元运算符**，宿主只用 `mark` / `place` / `log`。

行段/列段的编号方式要在源码注释里讲清楚——这是这道题唯一的抽象跳跃，值得用两三句话把它落回棋盘：「同一行里被障碍隔开的两截，是两个不同的段；一辆车只能管住它所在的那一截。」

- [ ] **Step 4: 量解释器步数并核对四档**

四档的**算法访问数**已在上表给定；**解释器步数要你自己量**（它取决于你怎么写）。四档都应当远在 200,000 以内。把实测表贴进报告，并与上表的最大匹配逐格对照——**任何一格对不上就停下来报告**，那说明行段/列段的建法与参照实现不一致。

- [ ] **Step 5: 跑通全部门**

```bash
node chess/core/algos/rook-cover.test.js
python3 chess/scripts/check.py;   echo "gate exit=$?"
```

- [ ] **Step 6: 提交**

```bash
git status --short
git add chess/core/algos/rook-cover.js chess/core/algos/rook-cover.test.js
git commit -m "feat(chess): rook-cover —— 增广路就是车在棋盘上的交替行走"
```

---

## Task 3: `rookCover` 的 `PROBLEMS` 键

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`（**只许动三处**）

**验收判据与阶段 5 Task 6 相同**：加这一题只许动 ① 一个 `PROBLEMS` 键（含它紧邻其上的文案常量块——阶段 5 的审查判过这不算越界，`Q`/`K`/`KP` 三个先例同形）；② 一个 `algos/*.js`（Task 2 已交付）；③ 该页 `GENERATED:ALGOS` 标记行加一个名字。

**如果你发现还得改别的地方（渲染、tab 生成、滑杆逻辑、读数框架、相机），那是架构没做到——停下来报告，回头改架构，不要接受。** 报告里贴 `git diff --stat` 为证。

- [ ] **Step 1: 加键**

`check` 声明按 §2.9 的规矩**三键齐全、显式写**（本阶段不加挖空，但 `check` 是 `validateDecl` 的必填项——**确认这一点**，若 `validateDecl` 允许无挖空的题目省略 `check`，照它的实际行为写并在报告里说明）。

- [ ] **Step 2: 相机**

`rookCover` 的 z 轴是增广路轮次，所以除 `1` 正视 / `2` 桌面 45° 外还要给一个沿 z 的侧视（阶段 5 定的规矩：凡是把第三根轴立起来的 tab 都要）。若默认 `SPAN_Z` 让取景失真，用阶段 5 加的可声明字段 `spanZ`（**注意 `validateDecl` 会校验它必须是有限正数**）。

- [ ] **Step 3: 浏览器验收（本任务只验四条）**

用 **headless Chrome + CDP，随机端口 + 硬断言目标 URL**（**Claude 浏览器面板在这台机器上做不了这类验收**：`document.hidden===true`、rAF 一帧不走）。验状态读 `window.__algoProbe()`，**第一条永远先断言 `tool === 'chess-board-algorithms'`**。
1. 四档盘各跑一遍，车数与 Task 2 的实测表一致
2. 增广路在棋盘上**看得出是横竖交替的**
3. 侧视下轮次分层清楚
4. 其余四题一字未变（切过去再切回来）

- [ ] **Step 4: 提交**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): 第四题 rookCover —— 只动三处"
```

---

## Task 4: `king-greedy.js` / `king-exact.js` 与它们的测试

**Files:**
- Create: `chess/core/algos/king-greedy.js`
- Create: `chess/core/algos/king-exact.js`
- Create: `chess/core/algos/king.test.js`

**Interfaces:**
- Produces: `root.AlgoKingGreedy` / `root.AlgoKingExact` = `{ source({ W, H, blocked }) → string }`，两份**同形**

**两份源码要能逐行对比**——照 `tour-dfs.js` / `tour-warnsdorff.js` 的先例：共同部分（建覆盖表、`mark`/`place` 的调法）逐字相同，只有「选哪个王」那一段不同。**阶段 5 为此建了一道机器可判的门**（剥掉注释与空行后，一份的每一行必须按原顺序出现在另一份里）——`king-greedy` 与 `king-exact` 的结构差异比那两份巡游大，**这道门大概率不适用；判断它适不适用，并在报告里说明**。

- [ ] **Step 1: 写失败的测试**

`king.test.js` 一份覆盖两份源码（照 `tour.test.js` 的先例）。必须包含：

```js
/* 四档盘：设计时实测选定，`eK === null` 表示那一档精确解撞墙。
   最后一档是这道题的落点——不是遗憾，是「为什么现实里用贪心」。 */
const BOARDS = [
  ['5×5 三障碍', 5, 5, [6, 12, 18],                        4, 4],
  ['6×6 三障碍', 6, 6, [6, 24, 35],                        6, 4],
  ['6×6 七障碍', 6, 6, [6, 10, 25, 28, 32, 34, 35],        7, 5],
  ['7×7 三障碍', 7, 7, [16, 24, 32],                       8, null],
];

/* 四档盘的 k 与「贪心 ≥ 精确」——这是这道题的全部教学内容 */
for (const [label, W, H, blocked, gK, eK] of BOARDS) {
  const g = I.run(G.source({ W, H, blocked }), { host: {} });
  T.eq(g.result, gK, label + ' 贪心的王数');
  if (eK === null) {
    /* 7×7 那一档：精确解跑不完 */
    const e = I.run(X.source({ W, H, blocked }), { host: {} });
    T.eq(e.trace.truncated, true, label + ' 精确解撞上限——这是这一课，不是故障');
    T.ok(typeof e.result === 'undefined', label + ' 撞墙时没有返回值');
  } else {
    const e = I.run(X.source({ W, H, blocked }), { host: {} });
    T.ok(!e.trace.truncated, label + ' 精确解未截断');
    T.eq(e.result, eK, label + ' 精确的王数');
    T.ok(g.result >= e.result, label + ' 贪心不会比精确更好');
  }
}

/* 摆出来的王必须真的支配所有空格——两份都要验，不只是比数字 */
/* 与宿主侧独立参照对拍（贪心用不同的扫描序、精确用不同的搜索顺序） */
```

**至少一档必须 `gK > eK`**（差距那一课），**且 7×7 那一档必须撞墙**。

- [ ] **Step 2: 跑测试确认失败** → **Step 3: 实现** → **Step 4: 实测四档并填表**

设计时量的**算法操作数**在「这一阶段的实测事实」那一节；**解释器步数要你自己量**，因为它取决于你怎么写。四档的候选：`5×5 [6,12,18]`、`6×6 [6,24,35]`、`6×6 [6,10,25,28,32,34,35]`、`7×7 [16,24,32]`。**若某一档的解释器步数与预期不符（尤其 6×6 七障碍那档 24,779 ops 可能乘出 200,000 以上），那是数据——报告出来，换档或调整，不要改算法去凑。**

- [ ] **Step 5: 跑通全部门** → **Step 6: 提交**

```bash
git add chess/core/algos/king-greedy.js chess/core/algos/king-exact.js chess/core/algos/king.test.js
git commit -m "feat(chess): 王的支配集 —— 贪心与精确两份源码"
```

---

## Task 5: `kingDominate` 的 `PROBLEMS` 键（双轨）

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`（**只许动三处**）

`sources: ['king-greedy.js', 'king-exact.js']`——`PROBLEMS` 里第二个持有两份源码的条目。

- [ ] **Step 1: 加键**（含双轨声明与四档盘滑杆）
- [ ] **Step 2: 7×7 那一档的读数**

**撞墙那一档必须显示「跑不完，判不了」**，且**不许显示「8 是最优」**——贪心给出 8，工具没有证明它最优。照工具④ 深度 4 与阶段 6 `unknown` 通道的既有呈现。**`null` 永不变成数字。**

- [ ] **Step 3: 浏览器验收（五条）**

1. 四档各跑一遍，两块棋盘并排、一个游标推两条
2. **6×6 `[6,24,35]` 上左边摆 6 个王、右边摆 4 个**——这是这一阶段最锋利的一屏，**值一张截图**
3. 7×7：贪心正常给出 8，精确那边「跑不完，判不了」
4. 侧视下选取轮次分层
5. 练习模式（阶段 6）在这两道新题上的表现——它们没有挖空，**确认不会因此报错或显示半个面板**

- [ ] **Step 4: 提交**

---

## Task 6: 定版、全量门、浏览器验收

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`（版本两处 + changelog）、`chess/chess-tools.json`

- [ ] **Step 1: 版本落三处**（1.1.0 → **1.2.0**）。注册三处条目不变，但**核对逐字段一致**。
- [ ] **Step 2: 全量门**

```bash
node chess/core/exercise.test.js
node chess/core/exercise-blanks.test.js
node chess/core/algos/queens.test.js
node chess/core/algos/tour.test.js
node chess/core/algos/knight-path.test.js
node chess/core/algos/rook-cover.test.js
node chess/core/algos/king.test.js
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;            echo "chess gate exit=$?"
python3 scripts/sync_registry.py --check;  echo "main registry exit=$?"
git status --short
```

- [ ] **Step 3: 浏览器验收（截图是用户的正式验收环节）**

截图存进 `.superpowers/sdd/2026-08-05-chess-phase7-cover-dominate/task-6-screenshots/`。逐条：五题各开一次；`rookCover` 的增广路交替行走；`kingDominate` 6×6 那一档的 6 vs 4；7×7 的「跑不完，判不了」；练习模式在五题上都正常（三题有挖空、两题没有）；语言切换；角标 `v1.2.0`；窄窗口不叠字；帧回调 ≤4ms。

- [ ] **Step 4: 提交**

---

## 阶段 7 完成标准

- [ ] 七个测试文件全绿；`check.py` exit 0 七道门；`sync_registry --check` exit 0
- [ ] `rookCover` 四档的最大匹配与宿主侧匈牙利对拍一致，且**摆出来的车经独立验证真的覆盖了所有空格**（覆盖是真的，但**不是最少的车数**——见订正）
- [ ] `kingDominate` 四档：至少一档 **贪心 > 精确**，且 **7×7 那一档精确解撞墙**并显示「跑不完，判不了」
- [ ] 两题**各自只动了三处**（`git diff --stat` 为证）
- [ ] `T.throws` 认消息；「插入指令行不改变步数」有常驻门，两者都经突变确认有牙
- [ ] 阶段 5/6 的行为一字不差（五题里前三题、练习模式、挖空全部照旧）
- [ ] 版本落三处（含 `VERSION` 常量），角标 `v1.2.0`

**下一阶段**：阶段 8 扩展题目（`bitboard` / `pathCount` / `independent` / `fieldBFS`），以及给这两道新题补挖空（§8 明写这一阶段的产出质量应在实际用过一轮之后复盘）。

### 本阶段明确**不做**的事

- **不给两道新题加挖空。** §8 说这一阶段的产出质量应在她实际用过一轮之后复盘；挖空选点需要先看得懂算法，而这两个算法连一轮实际使用都还没经过。
- **不做 8×8 的精确支配集**——7.26 千万次操作，不可能进这个工具。这不是遗憾，是 `kingDominate` 最后一档要讲的那件事。
- **不加「棋种」可调**（后能走斜线，二分图模型当场失效）。
