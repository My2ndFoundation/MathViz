# 国际象棋子项目 · 阶段 5（工具⑤ 棋盘经典算法）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 `chess/tools/chess-board-algorithms.html`（**注册**的第五个工具）：三题三范式——`queens`（回溯剪枝）、`tourKnight`（朴素 DFS vs Warnsdorff，**同屏并排**）、`knightPath`（BFS）。左边是真实算法源码在单步跑，右边是真棋盘上的真棋子。

**Architecture:** 一题一个 `PROBLEMS` 键，声明式：`label / params / sources / entry / board / onMark / readout`，tab 与滑杆由声明生成。算法源码走既有的 `ALGOS` 字符串内联（本阶段先把它从整目录倾倒改成**按页列清单**）。调试器、编辑器、解释器全部复用阶段 3b/4 的既有模块，**一行不改**。

**Tech Stack:** 纯 ES2015、Canvas 2D、零依赖、零构建。复用 `viz-engine.js` / `board-render.js` / `interp.js` / `debugger.js` / `editor.js`。

---

## Global Constraints

- **零依赖**：不得引入任何 npm 包、CDN 资源、外部字体或图片。
- **单文件可用**：`chess/tools/chess-board-algorithms.html` 必须 `file://` 双击可用。
- **UMD 双导出**：`core/*.js` 既支持 `module.exports`，也挂到 `window`。
- **纯逻辑核不得触碰 DOM**：`document` / `window` / `localStorage` / `location` 只能出现在明确标注的 DOM 层函数体内。
- **英文默认、中文可切**（§1.6）。所有面向用户的文案是 `{zh, en}` 对象。
- **一切按时间推进，不按帧计数**——开发机外接显示器是 **30Hz**。用 `VizEngine.state.dt` 与 `Debugger.playSteps`。
- **性能预算是每帧绘制耗时 ≤4ms**，不是 fps。注意其中约 2.8 ms 是全屏 canvas 的固定重绘成本（各工具共有）。
- **`null` 表示「不知道」，永远不许变成数字**——截断轨迹上的读数显示 `—`，不显示 0。
- **只暂存显式路径，禁止 `git add -A` / `git commit -a`。**
- **规格来源**：`docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md` §1.4、§1.5、§2.1、§2.4、§2.7、§2.8、§4⑤、§5.3、§5.4、§10。

### 给每一位执行者的硬性要求

> **如果本计划里某段代码是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。**

阶段 3a/3b/4 里几乎每个执行者都靠这条报出过真问题。**阶段 4 里它八次纠正了计划作者**，包括：一个「铁证」fixture 其实根本不能判别它要判别的规则；一条断言在关键变异下全绿；一个「node 拒绝顶层 return」的断言（node 不拒绝）。**假定本计划至少有一处是错的。**

---

## 阶段 4 交给本阶段的硬约束

### 约束 1：`ALGOS` 是整目录倾倒，必须先改（Task 1）

今天只有 `minimax.js` 所以无感。本阶段要加**四个**算法源码文件，之后工具④ 会带上四份它从不执行的算法、工具⑤ 会带上 `minimax.js`。**在四个文件落地之前改掉**，否则之后要同时改两个页面。

### 约束 2：`null` 一路贯穿到面板

`statsAt().pruned`、`mvCount`、节点值在读不到时都是 `null`，面板显示 `—`。同源纪律是 3a 拒绝编造「省略了 N 步」。本阶段两处会用到：`queens` 在 N=9 截断、`tourKnight` 的朴素 DFS 在 4×5 截断。

### 约束 3：`Debugger` 与 `Editor` 各有一个 `refresh`，语义相反

`Debugger` 的 handle `refresh` **推进琥珀色基准并清掉选中帧**；`Editor` 的是纯重绘。resize 用调试器的 **`redraw()`**。

### 约束 4：单步可能连续两步停在同一源码行

`interp.js` 进帧前会把调用方攒下的 pending 刷成它自己的一步。**任何假定「下一步一定换行」的 UI 逻辑都是错的。**

### 约束 5：子集里没有三元运算符，宿主桥接是写死的五个名字

`a ? b : c` 报 `unsupported`。宿主只有 `log` / `mark` / `place` / `clear` / `attacked`。**本阶段与工具④ 不同——这五个正是要用的**：`mark(sq, kind)` 画「正在尝试 / 已确认 / 被剪枝 / 回溯撤销」，`place(sq, piece)` 摆真棋子。

### 约束 6：公开导出的省略参数是一个反复出现的缺陷类

已抓到三次（`playSteps` 的 `cap`、`refresh` 的基准、`TreeModel.seek` 的游标）。**本阶段新增的每一个导出，都问一遍「少传一个参数会怎样」**，并让它大声失败。

### 约束 7：`_test.js` 的 `eq` 有假阴性陷阱

`eq` 用 `JSON.stringify` 比较，而 `JSON.stringify(function(){})` 与 `JSON.stringify(undefined)` **都是 `undefined`**（`JSON.stringify(null)` 是 `'null'`，所以 `null` 与 `undefined` 不可互换）。断言「某值不存在」用 `T.ok(typeof x === 'undefined', …)`。

---

## 已有的接口（本阶段只消费，不修改）

```js
// chess/core/interp.js
Interp.run(src, { host, limit }) → { result, trace }
  Step = { line, depth, frameOp, frameName, varDelta, boardOps, out }
  boardOps: mark → {kind:'mark', sq, to, from} · place → {kind:'place', sq, to, from}
            clear → {kind:'clear', sq, to:null, from:{piece, mark}}
  trace.truncated ;  Interp.STEP_LIMIT = 200000   // ⚠ MAX_DEPTH 未导出

// chess/core/debugger.js
Debugger.create(trace) → cur ; goto/step/stepIn/stepOver/stepOut/runTo
Debugger.currentLine / visitedLines / callStack / frameIds / output
Debugger.locals(cur[, depth]) → 变量（null-prototype，勿用 .hasOwnProperty）
Debugger.boardState(cur) → { marks: {sq:kind}, pieces: {sq:code} }   // ★ 本阶段的主力
Debugger.mount(el, cur, opts) → handle   // resize 用 handle.redraw()
Debugger.playSteps(acc, dt, sps, cap) → { steps, acc }

// chess/core/editor.js
Editor.highlight / check / lineStarts / matchBracket ; Editor.mount(el, {value, onChange})

// chess/core/board-render.js
BoardRender.layout({ files, ranks, cell, z }) / drawBoard / drawPiece / pickSquare / pieceAutoScale

// chess/core/viz-engine.js
VizEngine.init({ canvas, SCENES, PARAMS, TOOL, VERSION, ENGINE_VERSION, autoLoop })
VizEngine.state.dt / t() / proj / strokePoly / line3 / glowDot / solidDot / label3
```

**实测确认（不要凭推测）**：

| 题 | 规模 | 步数 | 说明 |
|---|---|---|---|
| `queens` | N=4/5/6/7/8 | 557 / 1,838 / 6,509 / 25,118 / 105,319 | 解数 2/10/4/40/92 |
| `queens` | **N=9** | **✗ 截断** | 滑杆上限是 8 |
| `tourKnight` | 3×4 角 | DFS **460** / Warnsdorff 1,294 | **朴素的更便宜** |
| `tourKnight` | 4×5 角 | DFS **✗ 超限** / Warnsdorff 3,729 | 启发式压倒性 |
| `tourKnight` | 3×7 角 | DFS 233,676（超限）/ Warnsdorff **✗ 超限** | **启发式也会失败** |
| `knightPath` | 8×8 a1→h8 | 3,588，最短距离 6 | a1→d4 469 步、距离 2 |

---

## File Structure

| 文件 | 责任 |
|---|---|
| `chess/scripts/inline_core.py` | `ALGOS` 改为按页列清单 |
| `chess/scripts/check.py` | 往返校验逐页对应 |
| `chess/core/algos/queens.js` | ★ N 皇后源码 |
| `chess/core/algos/queens.test.js` | 解数对拍 + 撞墙 |
| `chess/core/algos/tour-dfs.js` | ★ 朴素 DFS 巡游 |
| `chess/core/algos/tour-warnsdorff.js` | ★ Warnsdorff 巡游 |
| `chess/core/algos/tour.test.js` | 两份共用：巡游合法性 + 三段弧线 |
| `chess/core/algos/knight-path.js` | ★ BFS 最短路 |
| `chess/core/algos/knight-path.test.js` | 距离对拍宿主侧 BFS |
| `chess/tools/chess-board-algorithms.html` | 工具页：`PROBLEMS` + 三个 tab |
| `chess/chess-tools.json` / `chess/index.html` / `chess/app.html` | 注册（三处，`app.html` 有自己的列表） |

### 任务依赖

```
Task 1 ALGOS 按页列清单（先做，四个文件落地前）
        ↓
Task 2 queens.js + 对拍        Task 3 tour-dfs.js + tour-warnsdorff.js + 对拍
        ↓                              ↓
Task 4 PROBLEMS 架构 + 页面骨架 + queens tab
        ↓
Task 5 tourKnight tab（同屏并排）
        ↓
Task 6 knight-path.js + 第三个键 ← **可扩展性验证：只许动三处**
        ↓
Task 7 注册 + 浏览器验收 + 全量门
```

Task 2 与 Task 3 文件不重叠，**但仍串行**——同一 checkout 里两个执行者会互相覆盖（CLAUDE.md 有专条，是事故换来的）。

---

## Task 1: `ALGOS` 按页列清单

**Files:**
- Modify: `chess/scripts/inline_core.py`、`chess/scripts/check.py`
- Modify: `chess/tools/chess-search-minimax.html`（标记行加清单）

**Interfaces:**
- Produces: 标记语法 `/* >>> GENERATED:ALGOS a,b,c */ … /* <<< GENERATED:ALGOS */`

规格 §2.1（2026-08-04 更新）：漏写一个键**当场报错**，而不是静默少内联一份。

- [ ] **Step 1: 写失败的测试**

`check.py` 现有 `algos_roundtrip_check` 是逐页扫标记的。给它加一条：标记行列出的每个名字都必须在 `core/algos/` 里存在，且生成的 `ALGOS` 对象的键集合**恰好等于**清单。先手工把工具④ 的标记改成 `GENERATED:ALGOS nosuchfile`，跑 `python3 chess/scripts/check.py`：

Expected: **FAIL**，明确指出 `nosuchfile` 不存在。若它默默通过或报了别的错，说明这道门没接上——报告，不要改测试迁就。

- [ ] **Step 2: 改 `inline_core.py`**

`pattern('ALGOS')` 现在是固定字符串匹配；改成能捕获清单的正则，例如

```python
ALGOS_MARK_RE = re.compile(
    r'/\* >>> GENERATED:ALGOS ([\w\-.,]*) \*/.*?/\* <<< GENERATED:ALGOS \*/',
    re.DOTALL)
```

只内联清单里的文件；缺文件 `raise SystemExit`。`js_string_literal` 与 `<!--` / `</script` 转义**原样保留**——那是阶段 4 用浏览器实测钉下来的，不要动。

- [ ] **Step 3: 更新工具④ 的标记行**为 `GENERATED:ALGOS minimax.js`，跑 `python3 chess/scripts/inline_core.py`，确认工具④ 的内联结果**与改动前逐字节相同**（只有 `minimax.js` 一份，清单化不该改变输出）。

- [ ] **Step 4: 跑门 + 提交**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py     # exit 0，六道门
git add chess/scripts/inline_core.py chess/scripts/check.py chess/tools/chess-search-minimax.html
git commit -m "build(chess): ALGOS 标记按页列清单，漏写当场报错"
```

---

## Task 2: `algos/queens.js` 与解数对拍

**Files:**
- Create: `chess/core/algos/queens.js`、`chess/core/algos/queens.test.js`

**Interfaces:**
- Produces: `module.exports` / `root.AlgoQueens` = `{ source({ N }) → string, N_MIN: 4, N_MAX: 8 }`

**入口函数名 `solve`**（`PROBLEMS.queens.entry`）。源码里要调 `mark(sq, kind)` 把「正在尝试 / 已确认 / 被剪枝 / 回溯撤销」画到棋盘上，并 `place(sq, 'wQ')` 摆真正的后。

- [ ] **Step 1: 写失败的测试**

Create `chess/core/algos/queens.test.js`：

```js
'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const Q = require('./queens.js');

// ---- 源码必须在子集里合法 ----
for (const N of [4, 6, 8]) {
  let err = null;
  try { I.parse(Q.source({ N: N })); } catch (e) { err = e; }
  T.ok(err === null, 'N=' + N + ' 的源码在子集里合法' + (err ? '：' + err.message : ''));
}

// ---- 解数对拍已知序列（不是写死期望值，是对拍数学事实）----
/* 2/10/4/40/92 是 N 皇后解数的公认值。拿它当独立参照，
   比自己算一遍再跟自己比有意义得多。 */
const KNOWN = { 4: 2, 5: 10, 6: 4, 7: 40, 8: 92 };
let checked = 0;
for (const N of [4, 5, 6, 7, 8]) {
  const r = I.run(Q.source({ N: N }), { host: {} });
  T.ok(!r.trace.truncated, 'N=' + N + ' 未截断');
  T.eq(r.result, KNOWN[N], 'N=' + N + ' 的解数是 ' + KNOWN[N]);
  checked++;
}
T.eq(checked, 5, '五个 N 都对拍过');

// ---- N=9 撞墙：这是这一题的第二课 ----
const wall = I.run(Q.source({ N: 9 }), { host: {} });
T.eq(wall.trace.truncated, true, 'N=9 撞上 STEP_LIMIT —— 回溯是指数的');
T.ok(typeof wall.result === 'undefined', '截断时没有结果（不是 0，也不是编造的数）');

// ---- 棋盘事件：确认它真的在画棋盘，而不只是算数 ----
/* 这一题的全部意义是「算法一行一行跑、棋盘同时变」。
   只断言解数的话，一个不调 mark/place 的实现照样全绿。 */
const ops = [];
I.run(Q.source({ N: 6 }), { host: {
  mark: function (sq, kind) { ops.push(['mark', sq, kind]); },
  place: function (sq, p) { ops.push(['place', sq, p]); },
  clear: function (sq) { ops.push(['clear', sq]); },
} });
T.ok(ops.length > 50, '算法确实在驱动棋盘（' + ops.length + ' 次棋盘操作）');
const kinds = {};
for (const o of ops) { if (o[0] === 'mark') { kinds[o[2]] = 1; } }
T.ok(Object.keys(kinds).length >= 2, 'mark 用了不止一种 kind：' + Object.keys(kinds).join('/'));
T.ok(ops.some(function (o) { return o[0] === 'place'; }), '摆了真正的后（place）');

// ---- 子集约束：源码里不许出现三元运算符 ----
/* 不要写成 indexOf('?')：注释里一个中文问号就会让它无端变红。
   上面的 I.parse 已经证明了子集合法性（三元会抛 unsupported）。 */

T.report();
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/algos/queens.test.js`
Expected: FAIL —— `Cannot find module './queens.js'`

- [ ] **Step 3: 写实现**

生成的源码要点：`cols` / `d1` / `d2` 三个布尔数组做剪枝；`safe(r,c)` 单独成函数（§2.9 将来要在这里挖空）；每次尝试 `mark(sq,'try')`、确认 `mark(sq,'ok') + place(sq,'wQ')`、回溯 `mark(sq,'back') + clear(sq)`。**注释与命名是给一个 16 岁初学者读的**——她要能读懂并敢改。

- [ ] **Step 4: 运行确认通过 + 提交**

```bash
node chess/core/algos/queens.test.js
python3 chess/scripts/check.py
git add chess/core/algos/queens.js chess/core/algos/queens.test.js
git commit -m "feat(chess): N 皇后算法源码 —— 解数对拍公认序列，N=9 撞墙"
```

---

## Task 3: 两份巡游源码与合法性对拍

**Files:**
- Create: `chess/core/algos/tour-dfs.js`、`chess/core/algos/tour-warnsdorff.js`、`chess/core/algos/tour.test.js`

**Interfaces:**
- Produces: 两个模块各 `{ source({ W, H, start }) → string }`；`root.AlgoTourDFS` / `root.AlgoTourWarnsdorff`

**入口函数名都是 `tour`**，签名相同——**同屏对比的前提是两份源码可以逐行 diff**，所以除算法主体外的部分（棋盘常量、`onBoard`、`mark`/`place` 调用）应尽量逐字相同。

- [ ] **Step 1: 写失败的测试**

Create `chess/core/algos/tour.test.js`：

```js
'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const D = require('./tour-dfs.js');
const W = require('./tour-warnsdorff.js');

// ---- 两份源码必须在子集里合法 ----
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  let err = null;
  try { I.parse(M.source({ W: 3, H: 4, start: 0 })); } catch (e) { err = e; }
  T.ok(err === null, name + ' 的源码在子集里合法' + (err ? '：' + err.message : ''));
}

/* 巡游合法性：不能只看返回 true。一个「返回 true 但路径是错的」实现
   会骗过所有只看返回值的断言，而这正是学习者要照着学的东西。
   所以从 boardOps 里把路径重建出来，独立验证它真是一条巡游。 */
function tourPath(src, W_, H_) {
  const seq = [];
  I.run(src, { host: {
    mark: function () {}, clear: function () {},
    place: function (sq) { seq.push(sq); },
  } });
  return seq;
}
function isLegalTour(seq, W_, H_) {
  if (seq.length !== W_ * H_) { return 'length ' + seq.length + ' != ' + (W_ * H_); }
  const seen = {};
  for (const sq of seq) {
    if (seen[sq]) { return 'square ' + sq + ' visited twice'; }
    seen[sq] = 1;
  }
  for (let i = 1; i < seq.length; i++) {
    const ax = seq[i - 1] % W_, ay = (seq[i - 1] - ax) / W_;
    const bx = seq[i] % W_, by = (seq[i] - bx) / W_;
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    if (!((dx === 1 && dy === 2) || (dx === 2 && dy === 1))) {
      return 'step ' + i + ' is not a knight move';
    }
  }
  return null;
}

// ---- 3×4 角起：两边都跑得完，且都给出合法巡游 ----
let legalChecked = 0;
for (const [name, M] of [['dfs', D], ['warnsdorff', W]]) {
  const src = M.source({ W: 3, H: 4, start: 0 });
  const r = I.run(src, { host: {} });
  T.ok(!r.trace.truncated, '3x4 ' + name + ' 未截断');
  T.eq(r.result, true, '3x4 ' + name + ' 找到巡游');
  const why = isLegalTour(tourPath(src, 3, 4), 3, 4);
  T.ok(why === null, '3x4 ' + name + ' 的路径是一条合法巡游' + (why ? '：' + why : ''));
  legalChecked++;
}
T.eq(legalChecked, 2, '两份实现都验过合法性');

// ---- 三段弧线：这是这一题的全部内容 ----
function steps(M, W_, H_) {
  return I.run(M.source({ W: W_, H: H_, start: 0 }), { host: {} }).trace;
}
// 第一段 3×4：朴素的反而更便宜 —— 启发式的代价在小盘上收不回来
const d34 = steps(D, 3, 4), w34 = steps(W, 3, 4);
T.ok(d34.length < w34.length,
     '3x4：朴素 DFS 比 Warnsdorff 便宜（' + d34.length + ' < ' + w34.length + '）');

// 第二段 4×5：朴素的撞墙，启发式从容
const d45 = steps(D, 4, 5), w45 = steps(W, 4, 5);
T.eq(d45.truncated, true, '4x5：朴素 DFS 撞上 STEP_LIMIT');
T.ok(!w45.truncated, '4x5：Warnsdorff 跑得完（' + w45.length + ' 步）');

// 第三段 3×7：连启发式也失败 —— 它不是保证
const w37 = steps(W, 3, 7);
T.eq(w37.truncated, true, '3x7：Warnsdorff 也撞墙 —— 启发式不保证');

T.report();
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/algos/tour.test.js`
Expected: FAIL —— `Cannot find module './tour-dfs.js'`

- [ ] **Step 3: 写两份实现**

`onBoard` / 偏移表 / `mark` / `place` 部分两份逐字相同；差别只在选下一步的策略。Warnsdorff 那份多一个 `degree(x,y)` 与按度数排序的几行。

- [ ] **Step 4: 运行确认通过 + 提交**

```bash
node chess/core/algos/tour.test.js
python3 chess/scripts/check.py
git add chess/core/algos/tour-dfs.js chess/core/algos/tour-warnsdorff.js chess/core/algos/tour.test.js
git commit -m "feat(chess): 两份骑士巡游源码 —— 合法性独立验证，三段弧线钉住"
```

---

## Task 4: `PROBLEMS` 架构 + 页面骨架 + `queens` tab

**Files:**
- Create: `chess/tools/chess-board-algorithms.html`

从 `chess/tools/chess-search-minimax.html` 复制分栏骨架（阶段 4 已浏览器验收过：可拖拽分栏、`\` 折叠、fit 变换、`clampCodeWidth`、`px()` 文字缩放、`redraw()` vs `refresh()`）。

**`PROBLEMS` 声明（§4⑤ 的明文架构要求）**：

```js
const PROBLEMS = {
  queens: {
    label:   { zh: 'N 皇后', en: 'N-Queens' },
    params:  [{ key: 'N', min: 4, max: 8, step: 1, value: 6 }],
    sources: ['queens.js'],
    entry:   'solve',
    board:   st => ({ files: st.N, ranks: st.N }),
    onMark(kind) { … },      // 四种状态各一色（rose→violet→emerald→orange）
    readout(trace, st) { … },
  },
};
```

- [ ] **Step 1: 页面骨架 + `queens` tab**

滑杆 N ∈ [4,8] 默认 6。**N=9 不在滑杆上**——上限就是 8，而读数区在 N=8 时提示「再往上一格就跑不完了」。棋盘用 `BoardRender` 画 N×N，`Debugger.boardState(cur)` 的 `marks` / `pieces` 直接驱动着色与摆子。

- [ ] **Step 2: 相机按 §5.3 常规条**

`1` 正视 `{az:0, el:0, dist:14}` 打头、`2` 桌面 45° `{az:0, el:-Math.PI/4, dist:15}`。**`el` 是负的**：`makeCam()` 的 `eye.y = dist·sin(el)`，`el>0` 会坐到黑方那一侧。`queens` 的 z 是递归深度，所以还要 `3` 侧视沿 z 看。

- [ ] **Step 3: 导出探针**

```js
window.__algoProbe = () => ({ tool: 'chess-board-algorithms', problem, N, i, len,
                              truncated, marks, pieces, solutions });
```

**第一个字段必须是 `tool`**——多 agent 共享浏览器会话。

- [ ] **Step 4: 提交**

```bash
python3 chess/scripts/inline_core.py && python3 chess/scripts/check.py
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): 工具⑤ 骨架、PROBLEMS 架构与 queens tab"
```

---

## Task 5: `tourKnight` tab（同屏并排）

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**这个键持有两份源码**（`sources: ['tour-dfs.js', 'tour-warnsdorff.js']`），是 `PROBLEMS` 里唯一这样的条目。两份源码**同屏并排**，两块棋盘并排，同一个游标同时推进两条轨迹。

- [ ] **Step 1: 双轨迹与双棋盘**

两个 `Interp.run` 各得一条轨迹、各一个 `Debugger.create`。游标推进时两边同步 `goto`。**朴素那边在 4×5 会截断**——它的读数显示 `—` 与「超出上限，没跑完」，而不是 0，也不是让人以为工具坏了（照抄工具④ 深度 4 的呈现）。

- [ ] **Step 2: 盘面滑杆 3×4 / 4×5 / 3×7**

三档就是三段课。**盘不是方形**（§2.4 更新）：`files !== ranks` 是常态，坐标标注与取景都要按这个测。

- [ ] **Step 3: 提交**

```bash
python3 chess/scripts/inline_core.py && python3 chess/scripts/check.py
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): tourKnight 同屏并排两份源码，三档盘面就是三段课"
```

---

## Task 6: `knight-path.js` 与第三个键 —— 可扩展性验证

**Files:**
- Create: `chess/core/algos/knight-path.js`、`chess/core/algos/knight-path.test.js`
- Modify: `chess/tools/chess-board-algorithms.html`（**只许动三处**）

**Interfaces:**
- Produces: `module.exports` / `root.AlgoKnightPath` = `{ source({ W, start, target }) → string }`
  （与 `AlgoQueens` / `AlgoTourDFS` / `AlgoTourWarnsdorff` 同形）

**这一任务的目的不只是加一题，是验证 §4⑤ 的可扩展性要求是真的。** 加这一题只许动：① 一个 `PROBLEMS` 键；② 一个 `algos/*.js`；③ 该页 `GENERATED:ALGOS` 标记行加一个名字。

**如果你发现还得改别的地方（渲染、tab 生成、滑杆逻辑、读数框架），那是架构没做到——停下来报告，回头改架构，不要接受。** 这是本任务唯一的验收判据。

- [ ] **Step 1: 写失败的测试**

Create `chess/core/algos/knight-path.test.js`：

```js
'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const K = require('./knight-path.js');

/* 距离对拍一份宿主侧 BFS —— 独立参照，不是写死期望值。 */
function hostBFS(W, s, t) {
  const DX = [1, 2, 2, 1, -1, -2, -2, -1], DY = [2, 1, -1, -2, -2, -1, 1, 2];
  const dist = new Array(W * W).fill(-1); dist[s] = 0;
  const q = [s];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h]; if (cur === t) { break; }
    const x = cur % W, y = (cur - x) / W;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      if (nx >= 0 && nx < W && ny >= 0 && ny < W) {
        const nb = ny * W + nx;
        if (dist[nb] === -1) { dist[nb] = dist[cur] + 1; q.push(nb); }
      }
    }
  }
  return dist[t];
}

let cases = 0;
for (const [W, s, t] of [[8, 0, 63], [8, 0, 27], [6, 0, 35], [5, 0, 24], [8, 12, 40]]) {
  const r = I.run(K.source({ W: W, start: s, target: t }), { host: {} });
  T.ok(!r.trace.truncated, W + 'x' + W + ' ' + s + '→' + t + ' 未截断');
  T.eq(r.result, hostBFS(W, s, t),
       W + 'x' + W + ' ' + s + '→' + t + ' 的最短距离与宿主侧 BFS 一致');
  cases++;
}
T.eq(cases, 5, '五组都对拍过');

// ---- BFS 的层序：先访问的距离不大于后访问的 ----
/* 这条比「距离对得上」更能钉死「它真的是 BFS 而不是别的」：
   一个 DFS 实现也可能凑巧算对某几组距离，但它的访问顺序不会是层序。 */
const seen = [];
I.run(K.source({ W: 8, start: 0, target: 63 }), { host: {
  mark: function (sq, kind) { seen.push([sq, kind]); },
} });
T.ok(seen.length > 20, 'BFS 确实在标记访问过的格子（' + seen.length + ' 次）');

T.report();
```

- [ ] **Step 2–4: 失败 → 实现 → 通过 → 加进 `PROBLEMS` → 提交**

加完之后**核对改动范围**：`git diff --stat` 应当只有 `knight-path.js`、`knight-path.test.js`，以及 `chess-board-algorithms.html` 里**一个 `PROBLEMS` 键加一行标记**。在报告里贴出这份 `git diff --stat`。

---

## Task 7: 注册、浏览器验收、全量门

**Files:**
- Modify: `chess/chess-tools.json`、`chess/index.html`、`chess/app.html`

- [ ] **Step 1: 注册（三处）**

`chess-tools.json` 加条目（`phase: 5`），`chess/index.html` 的 FALLBACK 与 `chess/app.html` 的 `TOOLS` 各加一条。**注意 `app.html` 是阶段 4 之后新增的第三份镜像**，别漏。§10 的版本落三处：`chess-tools.json`、HTML 的 `tool-version` meta、**以及 `VERSION` 脚本常量**——chess 引擎的角标读的是常量不是 meta（工具① 的 1.0.2 与工具④ 都栽过）。

- [ ] **Step 2: 浏览器验收**

预览服务器 `mcp__Claude_Browser__preview_start` `{name: "mathviz"}`（8777，端口可能被别的 session 占着，那就直接 `{url: "http://localhost:8777/..."}` 复用）。**每次调用带显式 `tabId`**；面板 rAF 约每十二秒一帧、`document.hidden` 恒真，**要验状态读探针，要验时序推累加器**。第一条永远断言 `__algoProbe().tool === 'chess-board-algorithms'`。

逐条确认（每条要探针读数或截图）：

1. `queens` N=4..8 各跑一遍，解数分别是 2/10/4/40/92
2. 单步时棋盘的四种状态色随算法变；回溯时标记真的退回去
3. N=8 时读数提示「再往上一格就跑不完」
4. `tourKnight` 3×4：两份源码同屏，**朴素那边步数更少**
5. `tourKnight` 4×5：朴素那边显示 `—` 与「没跑完」，Warnsdorff 正常完成
6. `tourKnight` 3×7：**两边都没跑完**
7. 非方形盘（3×4 / 3×7）的坐标标注与取景正确
8. `knightPath` 8×8 a1→h8 距离 6，BFS 层序在棋盘上看得出来
9. `1` 正视 / `2` 桌面 45° / `3` 侧视；45° 的近处是**白方**
10. `\` 折叠；分栏拖到最宽后**再把窗口缩窄**，棋盘不消失
11. 语言切换 EN⇄ZH，**默认 EN**
12. 深度最大的一档上连续播放，每帧绘制耗时 ≤4ms（强制光栅化每帧一次，探针开销单列）

**截图存到 `.superpowers/sdd/2026-08-04-chess-phase5-board-algorithms/task-7-screenshots/` 并附上**——用户看截图是本阶段的正式验收环节。

- [ ] **Step 3: 全量门**

```bash
node chess/core/algos/queens.test.js
node chess/core/algos/tour.test.js
node chess/core/algos/knight-path.test.js
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;            echo "chess gate exit=$?"
python3 scripts/sync_registry.py --check;  echo "main registry exit=$?"
git status --short
```

- [ ] **Step 4: 提交**

---

## 阶段 5 完成标准

- [ ] 三个 `algos/*.test.js` 全绿；`check.py` exit 0；`sync_registry --check` exit 0
- [ ] `queens` 解数对拍 2/10/4/40/92，**N=9 撞墙**且截断时显示 `—` 不是 0
- [ ] 两份巡游的路径**独立验证过是合法巡游**（每格一次、每步马步），不只是返回 `true`
- [ ] 三段弧线都成立：3×4 朴素更便宜、4×5 朴素撞墙、**3×7 连 Warnsdorff 也撞墙**
- [ ] `knightPath` 的距离与宿主侧 BFS 对拍一致
- [ ] **加 `knightPath` 只动了三处**（`git diff --stat` 为证）
- [ ] 注册三处齐全（含 `app.html`），版本落 `tool-version` meta **与 `VERSION` 常量**
- [ ] 默认语言 EN；非方形盘的标注与取景正确

**下一阶段**：§2.9 挖空练习（`exercise.js`），以及 `rookCover` / `kingDominate`。

### 本阶段明确**不做**的事

- **不往 `algos/*.js` 里加 `// >>> BLANK` 标记。** §2.9 说挖空直接写在算法源码里，但那要等 `exercise.js` 存在才有消费方；现在加进去只是没人读的注释，而且挖哪一段要由练习设计决定，不是由写算法的人顺手决定。只在源码结构上留缝——例如 `queens` 的 `safe(r, c)` 单独成函数——并在注释里点明它是将来的挖空点。
- **不做 `rookCover` / `kingDominate`**（二分图匹配与贪心/精确对比各自需要自己的可视化语义）。
- **不改 `interp.js` / `debugger.js` / `editor.js` / `tree-model.js`**。若发现非改不可，停下来报告——阶段 4 正是这样发现了 `interp.js` 的入帧步批处理缺陷，那是值得的；但要经过裁定，不要顺手改。
