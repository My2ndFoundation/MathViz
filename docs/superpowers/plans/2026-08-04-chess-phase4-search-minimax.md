# 国际象棋子项目 · 阶段 4（工具④ 博弈树与 α-β）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 `chess/tools/chess-search-minimax.html`（**注册**的第四个工具）：左边是 minimax / α-β 的真实源码在单步跑，右边是随调用栈长出来的博弈树；走到 `if (beta <= alpha) { break; }` 那一行时，树上整片枝子塌掉。

**Architecture:** 树**完全从调用栈推导**，`interp.js` 零改动——`search()` 的每一帧就是树上一个节点，帧身份用 push 步下标（`Debugger.frameIds`），节点的搜索状态直接读 `Debugger.locals(cur, depth)`（实测已确认 `bd` / `depth` / `alpha` / `beta` / `white` / `ms` / `best` / `v` 全都在里面）。新增 `chess/core/tree-model.js` 承担全部树逻辑：**纯函数 + 增量游标**，零 DOM，node 可测；工具页只做渲染与接线。

**Tech Stack:** 纯 ES2015、Canvas 2D、零依赖、零构建。复用 `viz-engine.js` / `board-render.js` / `interp.js` / `debugger.js` / `editor.js`。

---

## Global Constraints

- **零依赖**：不得引入任何 npm 包、CDN 资源、外部字体或图片。
- **单文件可用**：`chess/tools/chess-search-minimax.html` 必须 `file://` 双击可用。
- **UMD 双导出**：`core/*.js` 既支持 `module.exports`（node 测试），也挂到 `window`。
- **纯逻辑核不得触碰 DOM**：`document` / `window` / `localStorage` / `location` 只能出现在明确标注的 DOM 层函数体内。`tree-model.js` **完全没有 DOM 层**——它只产出数据，渲染在工具页里。
- **英文默认、中文可切**（规格 §1.6）。所有面向用户的文案是 `{zh, en}` 对象。
- **一切按时间推进，不按帧计数**——开发机外接显示器是 **30Hz**。用 `VizEngine.state.dt`。阶段 3b 正是在这里抓到「60fps 走 9 步/秒、30fps 走 10 步/秒」的跨刷新率发散。
- **性能预算是每帧绘制耗时 ≤4ms**，不是 fps。
- **只暂存显式路径，禁止 `git add -A` / `git commit -a`。**
- **本工具要注册**（与阶段 3b 的验收页不同）：`chess/chess-tools.json` 与 `chess/index.html` 都要加，且 `python3 scripts/sync_registry.py --check` 必须 exit 0。
- **规格来源**：`docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md` §1.4、§1.5、§2.7、§2.8、§4④、§5.4。

### 给每一位执行者的硬性要求

> **如果本计划里某段代码是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。**

阶段 3a 的九个任务、阶段 3b 的六个任务里，**每一个执行者都报出了至少一个真问题**。3b 里这条规矩推翻了一整套方案（变量面板的「深度窗口回放」），并抓出计划作者写的四处错误——其中一处会让修复变成**静默 no-op**，一处提出的测试修法**根本不能判别**，还有一处给的「二选一」是个**假两难**（两个选项都会留下 bug）。**假定本计划至少有一处是错的。**

---

## 阶段 3b 交给本阶段的硬约束

这些是 3b 实施中**实测得出**的。

### 约束 1：树的节点身份必须是 push 步下标，不能是深度

3b 的琥珀色闪烁最初按**深度**认帧，结果是错的：`return f(1) + f(1);` 会在连续两步里产生同深度的一次 pop 和一次 push，深度认帧会把两个不同的帧当成同一个，**静默藏起一个刚诞生的绑定**。改用 push 步下标后，「`push-index > 基准游标` ⟺ 该帧在基准时刻不存在」被证明是**精确**判据，不是启发式。

`Debugger.frameIds(cur)` 就是为此存在的。**树的节点 id 用它，不要自己按深度编号。**

### 约束 2：`locals(cur, depth)` 是每帧的，且返回 null-prototype 对象

**不要对它调 `.hasOwnProperty()`**（会抛）。用 `name in obj` 或 `Object.prototype.hasOwnProperty.call(obj, name)`。这条写在 `locals` 的文档注释里。

非有限的 `depth`（`NaN` / 非整数 / `±Infinity` / 非数字）返回**空对象**，不夹到边界——夹住会安静地显示另一帧的变量。

### 约束 3：截断轨迹是性能最坏点，而撞墙演示恰好就是它

`matchFrames`（`debugger.js:243-254`）在**被截断**的轨迹上是 **O(trace.length) 而非 O(cursor)**：帧永远不关闭，早退分支是死代码。实测 200k 步截断轨迹：`i=5000 → 3.46 ms`、`i=100000 → 8.88 ms`、`i=199999 → 16.12 ms`；**一次五区重算在约 20k 步就越过 4ms 绘制预算**。

**而深度 4 的 `tree` tab 正是一条截断轨迹**（200,000 步、`truncated: true`）。所以本阶段的「撞墙演示」与「性能最坏点」是同一格。

**这就是那个被推迟到阶段 4 的架构决定的落点**：`tree-model.js` 必须是**增量**的——游标 ±1 时增量更新，只在跳转/换轨迹时全量重建。不许在 `debugger.js` 里加缓存（那会赔掉零 DOM 的前提，约 4,100 条 node 断言正建立在它之上）。

### 约束 4：学习者会在一行上停两次

`interp.js` 在进帧前会把调用方攒下的 pending 刷成**它自己的一步**，所以单步可能连续两步停在同一源码行（先看到赋值生效，再进帧）。而且那条被刷出来的 delta 记的是**调用点的行号**，于是「在 `for` 头上声明的变量」会在高亮停在调用行时浮现。

**任何假定「下一步一定换行」的 UI 逻辑都是错的。** 树模型尤其要注意：一个节点对应一个 `push` 步，不是一行。

### 约束 5：`Debugger` 与 `Editor` 各有一个 `refresh`，语义相反

`Debugger` 的 handle `refresh` **会推进琥珀色基准并清掉选中帧**；`Editor` 的 `refresh` 是纯重绘。工具④ 两个 handle 都要拿。**写一个统一的 resize 处理函数同时调这两个，会静默污染调试器的「本步变化」基准。** 调试器那边要用 `redraw()`（3b 为此专门加的）。

### 约束 6：子集里没有三元运算符，宿主桥接是写死的五个名字

`a ? b : c` 报 `unsupported`。宿主只有 `log` / `mark` / `place` / `clear` / `attacked`，**不可扩展**；工具④ 一个都不用。

### 约束 7：`_test.js` 的 `eq` 有假阴性陷阱

`eq` 用 `JSON.stringify` 比较，而 `JSON.stringify(function(){})` 与 `JSON.stringify(undefined)` **都是 `undefined`**。断言「某值不存在」一律用 `T.ok(typeof x === 'undefined', …)`。

---

## 已有的接口（本阶段只消费，不修改）

```js
// chess/core/debugger.js（阶段 3b，497 条测试）
Debugger.create(trace) → cur
Debugger.goto/step/stepIn/stepOver/stepOut/runTo(cur[, n]) → bool
Debugger.currentLine(cur) / visitedLines(cur) / output(cur) / boardState(cur)
Debugger.callStack(cur)  → [{ name, line, depth }]        // 由外到内，length === trace[cur.i].depth
Debugger.frameIds(cur)   → number[]                        // 与 callStack 逐项对齐；每项是该帧 push 步的下标
Debugger.locals(cur[, depth]) → { …vars }                  // null-prototype；depth 省略 = 最内层帧
Debugger.mount(el, cur, opts) → handle                     // handle.refresh 推进琥珀基准；resize 用 handle.redraw
Debugger.playSteps(acc, dt, sps, cap) → { steps, acc }     // 按时间推进，cap 省略时用内置 240

// chess/core/editor.js（阶段 3b，3625 条测试）
Editor.highlight(src) / check(src) / lineStarts(src) / matchBracket(src, caret)
Editor.mount(el, { value, onChange }) → handle              // handle.refresh 是纯重绘

// chess/core/interp.js（阶段 3a/3b，647 条测试）
Interp.run(src, { host, limit }) → { result, trace }
  Step = { line, depth, frameOp, frameName, varDelta, boardOps, out }
  trace.truncated / trace.limit
Interp.STEP_LIMIT = 200000                                 // ⚠ MAX_DEPTH **没有导出**

// chess/core/viz-engine.js
VizEngine.init({ canvas, SCENES, PARAMS, TOOL, VERSION, ENGINE_VERSION, autoLoop })
VizEngine.state.dt   // 帧时长的唯一出处
VizEngine.t(obj)     // i18n
proj / strokePoly / line3 / glowDot / solidDot / label3 / withContext / viewInfo

// chess/core/board-render.js
BoardRender.layout({ files, ranks, cell, z }) / drawBoard / drawPiece / pickSquare / pieceAutoScale
```

**实测确认（不要凭推测）**：在一个 `search` 帧上，`Debugger.locals(cur)` 返回

```
bd    = [5,0,2,0,0,1,1,0,0,0,-1,-1,0,-2,0,-5]   // 该节点的局面
depth = 2 · alpha = -99999 · beta = 99999 · white = true
ms    = [1,4,43,41,36,89,90,107]                 // 走法表 → ms.length 就是该节点的分支数
best / mv / from / to / cap / v                  // 进入循环后才有
```

**剪枝因此是可判定的**：一个 `ms.length === 8` 的节点若只产生了 3 个子帧，说明第 4 个之后被剪掉了。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `chess/core/tree-model.js` | ★ 博弈树：从轨迹建树 + 增量游标 + 布局。纯逻辑，零 DOM |
| `chess/core/tree-model.test.js` | 树模型测试（零 DOM，用真实轨迹做 fixture） |
| `chess/core/algos/minimax.js` | ★ 被解释执行、也被显示的同一份算法源码 |
| `chess/core/algos/minimax.test.js` | 对拍：α-β 与纯 minimax 返回同一个值 |
| `chess/tools/chess-search-minimax.html` | 工具页：分栏、四个 tab、树渲染、调试器接线 |
| `chess/scripts/inline_core.py` | 加 `TREE-MODEL` 与 `ALGOS` 两个源 |
| `chess/chess-tools.json` / `chess/index.html` | 注册 |

**为什么树模型是独立核**：阶段 3b 把纯核与薄壳切开，换来约 4,100 条 node 断言，而全部三次「静默显示错值」的缺陷都是被 node 测试或差分对拍抓到的，没有一次是靠看画面。树模型的缺陷（认错帧、剪枝判错、布局重叠）同样属于这一类。

### 任务依赖

```
Task 1 algos/minimax.js + 对拍          ← 必须最先做
        ↓ （树模型的测试拿它的真实轨迹当 fixture）
Task 2 建树 → Task 3 增量游标 + 剪枝判定 → Task 4 布局
        ↓
Task 5 内联接线（TREE-MODEL / ALGOS）
        ↓
Task 6 工具页骨架 + 调试器接线 + tree/prune 两个 tab
        ↓
Task 7 order / shannon 两个 tab
        ↓
Task 8 注册 + 浏览器验收 + 全量门
```

**全部串行。** Task 2–4 的测试全都 `require('./algos/minimax.js')` 并拿它跑出来的**真实轨迹**当 fixture——手搓假 trace 会悄悄偏离真实形状，而树模型的全部正确性都建立在「真实轨迹长什么样」上。所以 Task 1 不能与它们并行。

---

## Task 1: `algos/minimax.js` 与对拍测试

**Files:**
- Create: `chess/core/algos/minimax.js`
- Test: `chess/core/algos/minimax.test.js`

**Interfaces:**

```js
// module.exports（node）与 root.AlgoMinimax（浏览器）都是这个对象：
source({ mode, depth, position }) → string   // mode ∈ 'plain' | 'ab' | 'ordered'
                                             // position 省略时用 DEFAULT_POSITION
POSITIONS                                    // { H: [...16 个数字], … }
DEFAULT_POSITION = 'H'
```

内联进 html 之后，`ALGOS['minimax.js']` 是**源码字符串**（Task 5），而 `AlgoMinimax.source(...)` 是**生成那个字符串的函数**——工具页用后者，因为 `mode` / `depth` 要随 tab 与滑杆变。

**这份源码同时被显示和被执行**（规格 §2.1）——`source()` 返回的字符串既喂给 `Interp.run`，也喂给 `Editor.mount` 的初值。**不可能漂移。**

起始局面 **H** = `K.N. / .PP. / ..pp / .n.k`（`[5,0,2,0, 0,1,1,0, 0,0,-1,-1, 0,-2,0,-5]`，`sq = rank*4 + file`，正=白 负=黑，`1=P 2=N 4=R 5=K`）。它是**测着挑的**，实测见规格 §4④。

**写这份源码时的子集约束（约束 6）**：没有三元运算符；`applyMove` 必须用 **make/unmake**（就地改再改回）而非整盘拷贝——实测差一整层深度。

- [ ] **Step 1: 写失败的测试**

Create `chess/core/algos/minimax.test.js`：

```js
'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const A = require('./minimax.js');

// ---- 源码必须能被解释器解析（子集合法性）----
for (const mode of ['plain', 'ab', 'ordered']) {
  let err = null;
  try { I.parse(A.source({ mode: mode, depth: 2 })); } catch (e) { err = e; }
  T.ok(err === null, mode + ' 模式的源码在子集里合法' + (err ? '：' + err.message : ''));
}

// ---- 关键不变量：剪枝不许改变答案 ----
/* 这是本阶段的对拍测试。α-β 只允许省掉搜索，不允许算出别的值。
   拿纯 minimax 当参照，而不是写死期望值——3a 的经验是差分对拍
   抓到的真问题比任何手写期望值都多。 */
let compared = 0;
for (const depth of [1, 2, 3]) {
  const plain = I.run(A.source({ mode: 'plain', depth: depth }), { host: {} });
  const ab = I.run(A.source({ mode: 'ab', depth: depth }), { host: {} });
  T.ok(!plain.trace.truncated, 'depth ' + depth + ' 纯 minimax 未截断');
  T.ok(!ab.trace.truncated, 'depth ' + depth + ' α-β 未截断');
  T.eq(ab.result, plain.result, 'depth ' + depth + '：α-β 与纯 minimax 返回同一个值');
  compared++;
}
T.eq(compared, 3, '三个深度都做了对拍');

// ---- 走法排序同样不许改变答案 ----
for (const depth of [1, 2, 3]) {
  const plain = I.run(A.source({ mode: 'plain', depth: depth }), { host: {} });
  const ord = I.run(A.source({ mode: 'ordered', depth: depth }), { host: {} });
  T.eq(ord.result, plain.result, 'depth ' + depth + '：吃子优先序不改变极小极大值');
}

// ---- α-β 必须真的省下步数 ----
for (const depth of [2, 3]) {
  const p = I.run(A.source({ mode: 'plain', depth: depth }), { host: {} }).trace.length;
  const a = I.run(A.source({ mode: 'ab', depth: depth }), { host: {} }).trace.length;
  T.ok(a < p, 'depth ' + depth + '：α-β 步数更少（' + a + ' < ' + p + '）');
}

// ---- 吃子优先序必须比随机序剪得更狠（order tab 的全部内容）----
const abSteps = I.run(A.source({ mode: 'ab', depth: 3 }), { host: {} }).trace.length;
const ordSteps = I.run(A.source({ mode: 'ordered', depth: 3 }), { host: {} }).trace.length;
T.ok(ordSteps < abSteps, '吃子优先序比自然序剪得更狠（' + ordSteps + ' < ' + abSteps + '）');

// ---- 深度 4 的撞墙必须真的发生（规格 §4④ 的这一课）----
const wall = I.run(A.source({ mode: 'plain', depth: 4 }), { host: {} });
T.eq(wall.trace.truncated, true, 'depth 4 的纯 minimax 撞上 STEP_LIMIT —— 这就是这一课');
const survive = I.run(A.source({ mode: 'ab', depth: 4 }), { host: {} });
T.eq(survive.trace.truncated, false, 'depth 4 的 α-β 跑得完 —— 同一格，一个做不到、一个做得到');

/* 注：「源码里没有三元运算符」这条**不要**写成 `src.indexOf('?') === -1`
   ——注释里一个中文问号就会让它无端变红，而且它什么也没多证明：
   上面那三条 `I.parse()` 已经证明了子集合法性（三元会抛 unsupported）。 */

// ---- 三个 mode 的源码除了剪枝那几行以外必须逐字相同 ----
/* 学习者切 tab 时看到的应该是**同一份算法**多了或少了剪枝，而不是两份
   各写各的代码。两份独立维护的源码迟早漂移，而漂移之后「对比」就不再
   是对比了。 */
const plainLines = A.source({ mode: 'plain', depth: 3 }).split('\n');
const abLines = A.source({ mode: 'ab', depth: 3 }).split('\n');
const onlyInAb = abLines.filter(function (l) { return plainLines.indexOf(l) === -1; });
T.ok(onlyInAb.length > 0, 'α-β 确实多出了几行');
T.ok(onlyInAb.length <= 6, 'α-β 只比纯 minimax 多出不超过 6 行（实际多出：' +
     onlyInAb.length + ' 行）—— 多出来的应该只有剪枝');
for (const l of onlyInAb) {
  T.ok(/alpha|beta/.test(l), '多出来的每一行都与 alpha/beta 有关：' + l.trim());
}

T.report();
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/algos/minimax.test.js`
Expected: FAIL —— `Cannot find module './minimax.js'`

- [ ] **Step 3: 写实现**

参考实测通过的骨架（make/unmake、走法编码成 `from*16+to`、预计算 KNIGHT/KING/ROOK 偏移表、`evaluate` = 子力值 + 中心控制）。三个 mode 的差别只在循环体里那两三行，**其余源码逐字相同**——学习者切 tab 时看到的是同一份算法多/少了剪枝那两行。

- [ ] **Step 4: 运行确认通过 + 提交**

```bash
node chess/core/algos/minimax.test.js
git add chess/core/algos/minimax.js chess/core/algos/minimax.test.js
git commit -m "feat(chess): minimax/α-β 算法源码与对拍测试 —— 剪枝不许改变答案"
```

---

## Task 2: 从轨迹建树（纯函数）

**Files:**
- Create: `chess/core/tree-model.js`
- Test: `chess/core/tree-model.test.js`

**Interfaces:**
- Consumes: `Interp.run(...).trace`、`Debugger.create/goto/callStack/frameIds/locals`
- Produces:

```js
TreeModel.build(trace, entryName)   → tree
  // tree = { nodes: Map-like(id → Node), rootId, order: number[] }
  // Node = { id, parentId, depth, childIds: number[], pushStep, popStep, mvCount, value, alpha, beta, white }
  // id 就是该帧 push 步的下标（约束 1）；popStep 为 -1 表示轨迹截断、该帧从未关闭
TreeModel.nodeAt(tree, id)          → Node | null
```

`build` 扫一遍整条轨迹，把每个 `frameOp === 'push' && frameName === entryName` 的步变成一个节点，父节点是当时栈上最近的同名帧。**不看深度，看栈**——深度会被 `evaluate` / `genMoves` 这些非 `search` 帧顶高。

- [ ] **Step 1: 写失败的测试**

Create `chess/core/tree-model.test.js`：

```js
'use strict';
const T = require('./_test.js');
const I = require('./interp.js');
const D = require('./debugger.js');
const TM = require('./tree-model.js');
const ALGO = require('./algos/minimax.js');

/* 用真实解释器轨迹做 fixture。手搓假 trace 会悄悄偏离真实形状，
   而这个模块的全部正确性都建立在「真实轨迹长什么样」上——3b 的
   词法器审查正是靠「拿原生 JS 当参照」抓出 5 条 Critical 的。 */
const SRC = ALGO.source({ mode: 'plain', depth: 2 });
const trace = I.run(SRC, { host: {} }).trace;
T.ok(!trace.truncated, '前提：depth 2 的纯 minimax 不会截断');

const tree = TM.build(trace, 'search');

// ---- 根 ----
T.ok(tree.rootId >= 0, '有根节点');
const root = TM.nodeAt(tree, tree.rootId);
T.eq(root.parentId, -1, '根没有父节点');
T.eq(root.depth, 0, '根的搜索深度是 0');

// ---- 节点 id 就是 push 步下标（约束 1）----
for (const id of tree.order) {
  T.eq(trace[id].frameOp, 'push', 'id ' + id + ' 指向一个 push 步');
  T.eq(trace[id].frameName, 'search', 'id ' + id + ' 指向的是 search 帧');
}
T.ok(tree.order.length > 3, '树里不止一个节点（否则下面的断言都是空转）');

// ---- 父子关系与调用栈一致 ----
/* 对每个节点，用调试器把游标移到它的 push 步，读 callStack/frameIds，
   验证树里的父链与运行时栈里的 search 帧序列**逐项相同**。
   这是拿一个独立参照对拍，而不是自己跟自己对。 */
const cur = D.create(trace);
let checked = 0;
for (const id of tree.order) {
  D.goto(cur, id);
  const stack = D.callStack(cur);
  const ids = D.frameIds(cur);
  const runtimeSearchIds = [];
  for (let k = 0; k < stack.length; k++) {
    if (stack[k].name === 'search') { runtimeSearchIds.push(ids[k]); }
  }
  const modelChain = [];
  let n = TM.nodeAt(tree, id);
  while (n) { modelChain.unshift(n.id); n = n.parentId < 0 ? null : TM.nodeAt(tree, n.parentId); }
  T.eq(modelChain, runtimeSearchIds, '节点 ' + id + ' 的父链与运行时调用栈一致');
  checked++;
}
T.ok(checked >= 4, '父链对拍至少跑了 4 个节点，不是空转');

// ---- 搜索深度逐层加一 ----
for (const id of tree.order) {
  const n = TM.nodeAt(tree, id);
  if (n.parentId < 0) { continue; }
  T.eq(n.depth, TM.nodeAt(tree, n.parentId).depth + 1, '子节点深度 = 父 + 1');
}

// ---- childIds 与 parentId 互为反向 ----
for (const id of tree.order) {
  for (const c of TM.nodeAt(tree, id).childIds) {
    T.eq(TM.nodeAt(tree, c).parentId, id, 'childIds 与 parentId 互相对得上');
  }
}

// ---- 越界 / 空输入不抛 ----
T.ok(TM.nodeAt(tree, 999999) === null, '不存在的 id 返回 null');
const empty = TM.build(I.run('', { host: {} }).trace, 'search');
T.eq(empty.order, [], '空轨迹建出空树');
T.eq(empty.rootId, -1, '空树没有根');

T.report();
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/tree-model.test.js`
Expected: FAIL —— `Cannot find module './tree-model.js'`

- [ ] **Step 3: 写实现**

Create `chess/core/tree-model.js`，UMD 包装照 `chess/core/debugger.js`。核心注释要写清：

```js
  /* 节点 id **就是该帧 push 步在轨迹里的下标**，不是按深度编号的序号。
     阶段 3b 用深度认帧栽过：`return f(1) + f(1);` 会在连续两步里产生
     同深度的一次 pop 和一次 push，深度认帧把两个不同的帧当成同一个，
     静默藏起一个刚诞生的绑定。push 步下标是全局唯一且单调的，
     「push-index > 某个游标 ⟺ 该帧在那个时刻还不存在」是精确判据。

     父子关系按**栈**判定而不是按 Step.depth：depth 会被 evaluate /
     genMoves 这些非 search 帧顶高，同一层的两个 search 节点可能有
     不同的 Step.depth。扫轨迹时自己维护一个 search 帧栈即可。 */
```

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/tree-model.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/tree-model.js chess/core/tree-model.test.js
git commit -m "feat(chess): 博弈树建树 —— 节点 id 用 push 步下标，父子按栈判定"
```

---

## Task 3: 增量游标与剪枝判定

**Files:**
- Modify: `chess/core/tree-model.js`
- Test: `chess/core/tree-model.test.js`

**Interfaces:**

```js
TreeModel.createView(tree, trace) → view          // { tree, trace, i, visible: Set-like, spineIds: [] }
TreeModel.seek(view, i)          → view           // 增量：|i - view.i| 小就增量推进，否则全量重建
TreeModel.visibleAt(view)        → number[]       // 截至当前游标**已经被访问过**的节点 id
TreeModel.spineAt(view)          → number[]       // 当前根到最内层 search 帧的路径
TreeModel.prunedAt(view)         → number[]       // 截至当前游标**已确定被剪掉**的节点的父 id
TreeModel.statsAt(view)          → { visited, pruned, mvTotal, truncated }
```

**剪枝判据（实测得出）**：一个节点的 `ms.length`（`mvCount`）说明它有几个可走的分支；若它**已经出帧**（`popStep >= 0` 且 `popStep <= i`）而实际产生的子节点少于 `mvCount`，差额就是被剪掉的分支。轨迹截断时 `popStep === -1`，该节点的剪枝**不可判定**，必须报告为「未知」而不是「0」。

- [ ] **Step 1: 写失败的测试**

追加到 `tree-model.test.js`（`T.report()` 之前）：

```js
// ============ 增量游标与剪枝 ============

const abSrc = ALGO.source({ mode: 'ab', depth: 3 });
const abTrace = I.run(abSrc, { host: {} }).trace;
T.ok(!abTrace.truncated, '前提：depth 3 的 α-β 不会截断');
const abTree = TM.build(abTrace, 'search');

// ---- 增量与全量必须给出同一个答案（这条是本任务的命脉）----
/* 增量推进最典型的坏法是「和全量算出来的不一样，但只在某些路径上」。
   拿全量重建当参照逐点对拍，而不是相信增量自己。 */
let mismatches = 0, sampled = 0;
const stride = Math.max(1, Math.floor(abTrace.length / 60));
const inc = TM.createView(abTree, abTrace);
for (let i = 0; i < abTrace.length; i += stride) {
  TM.seek(inc, i);                                   // 增量路径
  const fresh = TM.createView(abTree, abTrace);
  TM.seek(fresh, i);                                 // 全量路径（新 view，必然全量）
  if (JSON.stringify(TM.visibleAt(inc)) !== JSON.stringify(TM.visibleAt(fresh))) { mismatches++; }
  if (JSON.stringify(TM.spineAt(inc)) !== JSON.stringify(TM.spineAt(fresh))) { mismatches++; }
  sampled++;
}
T.eq(mismatches, 0, '增量推进与全量重建逐点一致');
T.ok(sampled >= 30, '对拍采样了至少 30 个游标位置');

// ---- 后退也要对（不能只在前进方向上正确）----
let backMismatch = 0;
for (let i = abTrace.length - 1; i >= 0; i -= stride) {
  TM.seek(inc, i);
  const fresh = TM.createView(abTree, abTrace);
  TM.seek(fresh, i);
  if (JSON.stringify(TM.visibleAt(inc)) !== JSON.stringify(TM.visibleAt(fresh))) { backMismatch++; }
}
T.eq(backMismatch, 0, '反向推进同样与全量一致');

// ---- 可见节点单调增长 ----
const grow = TM.createView(abTree, abTrace);
let prevLen = 0, grew = 0;
for (let i = 0; i < abTrace.length; i += stride) {
  TM.seek(grow, i);
  const len = TM.visibleAt(grow).length;
  T.ok(len >= prevLen, '可见节点数不随游标前进而减少（i=' + i + '）');
  if (len > prevLen) { grew++; }
  prevLen = len;
}
T.ok(grew >= 5, '可见节点确实在增长，不是恒为 0');

// ---- 剪枝：α-β 必须剪掉一些，纯 minimax 一个都不剪 ----
const abEnd = TM.createView(abTree, abTrace);
TM.seek(abEnd, abTrace.length - 1);
const abStats = TM.statsAt(abEnd);
T.ok(abStats.pruned > 0, 'α-β 到末尾时确实剪掉了分支：' + abStats.pruned);

const plainTrace = I.run(ALGO.source({ mode: 'plain', depth: 3 }), { host: {} }).trace;
T.ok(!plainTrace.truncated, '前提：depth 3 的纯 minimax 不截断');
const plainTree = TM.build(plainTrace, 'search');
const plainEnd = TM.createView(plainTree, plainTrace);
TM.seek(plainEnd, plainTrace.length - 1);
T.eq(TM.statsAt(plainEnd).pruned, 0, '纯 minimax 一个分支都不剪 —— 这是两个 tab 的全部区别');

// ---- α-β 访问的节点必须严格少于纯 minimax ----
T.ok(TM.statsAt(abEnd).visited < TM.statsAt(plainEnd).visited,
     'α-β 访问的节点更少：' + TM.statsAt(abEnd).visited + ' < ' + TM.statsAt(plainEnd).visited);

// ---- 截断轨迹：剪枝不可判定时不许报 0（约束 3）----
const cutTrace = I.run(ALGO.source({ mode: 'plain', depth: 4 }), { host: {} }).trace;
T.eq(cutTrace.truncated, true, '前提：depth 4 的纯 minimax 会截断');
const cutTree = TM.build(cutTrace, 'search');
const cutView = TM.createView(cutTree, cutTrace);
TM.seek(cutView, cutTrace.length - 1);
const cutStats = TM.statsAt(cutView);
T.eq(cutStats.truncated, true, '截断轨迹的 stats 要如实标出 truncated');
/* 截断时根本没跑完，「剪了多少」是不知道的。报一个数字就是编造，
   与 3a 拒绝编造「省略了 N 步」是同一条纪律。 */
T.ok(TM.nodeAt(cutTree, cutTree.rootId).popStep === -1, '根帧从未关闭 —— 截断的直接体现');

// ---- seek 越界与空树不抛 ----
const safe = TM.createView(TM.build(I.run('', { host: {} }).trace, 'search'), []);
for (const i of [-5, 0, 999999]) {
  let threw = false;
  try { TM.seek(safe, i); TM.visibleAt(safe); TM.spineAt(safe); TM.statsAt(safe); }
  catch (e) { threw = true; }
  T.ok(!threw, '空树上 seek(' + i + ') 不抛异常');
}
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/tree-model.test.js`
Expected: FAIL —— `TM.createView is not a function`

- [ ] **Step 3: 写实现**

要点注释：

```js
  /* seek 是增量的，因为**撞墙演示恰好就是性能最坏点**：深度 4 的 tree tab
     是一条 200,000 步的截断轨迹，而截断轨迹里帧永不关闭，debugger.js 的
     matchFrames 早退分支失效、每次推导退化成 O(trace.length)——实测
     i=199999 时一次五区重算 16.12 ms，预算是 4 ms。
     所以：游标 ±1 时只处理跨过的那几步，只有跳转/换轨迹才全量重建。
     缓存放在这里而不是 debugger.js 里——那个模块的零 DOM 纯度是约 4,100
     条 node 断言的前提，不能为了性能赔掉。 */
```

- [ ] **Step 4: 运行确认通过 + 提交**

```bash
node chess/core/tree-model.test.js
git add chess/core/tree-model.js chess/core/tree-model.test.js
git commit -m "feat(chess): 树的增量游标与剪枝判定，截断时如实报未知"
```

---

## Task 4: 布局（按子树宽度压缩）

**Files:**
- Modify: `chess/core/tree-model.js`
- Test: `chess/core/tree-model.test.js`

**Interfaces:**

```js
TreeModel.layout(tree, opts) → { pos: id → { x, y, z }, width, maxDepth }
  // opts = { spanX, spanZ }；z = 搜索深度（规格 §1.4：z 轴就是调用栈深度）
```

横向空间按**子树叶子数**分配，父节点居于其子节点的中点。这样即使有四万片叶子，整棵树也压缩进固定宽度，「被剪掉的那块体积」才看得出来。

- [ ] **Step 1: 写失败的测试**

追加到 `tree-model.test.js`：

```js
// ============ 布局 ============
const lay = TM.layout(abTree, { spanX: 10, spanZ: 1.5 });

// ---- 同一层的节点不许重叠 ----
const byDepth = {};
for (const id of abTree.order) {
  const d = TM.nodeAt(abTree, id).depth;
  if (!byDepth[d]) { byDepth[d] = []; }
  byDepth[d].push(lay.pos[id].x);
}
let layers = 0;
for (const d of Object.keys(byDepth)) {
  const xs = byDepth[d].slice().sort(function (a, b) { return a - b; });
  for (let k = 1; k < xs.length; k++) {
    T.ok(xs[k] > xs[k - 1], '第 ' + d + ' 层的节点横坐标严格递增，没有重叠');
  }
  layers++;
}
T.ok(layers >= 3, '至少三层参与了重叠检查');

// ---- z 就是搜索深度 ----
for (const id of abTree.order) {
  T.eq(lay.pos[id].z, TM.nodeAt(abTree, id).depth * 1.5, 'z = 深度 × spanZ');
}

// ---- 父节点在子节点的横向中点 ----
let midChecked = 0;
for (const id of abTree.order) {
  const n = TM.nodeAt(abTree, id);
  if (n.childIds.length === 0) { continue; }
  let lo = Infinity, hi = -Infinity;
  for (const c of n.childIds) { lo = Math.min(lo, lay.pos[c].x); hi = Math.max(hi, lay.pos[c].x); }
  T.ok(Math.abs(lay.pos[id].x - (lo + hi) / 2) < 1e-9, '父节点居于子节点中点');
  midChecked++;
}
T.ok(midChecked >= 3, '中点检查至少跑了 3 个内部节点');

// ---- 整棵树压在 spanX 之内 ----
for (const id of abTree.order) {
  T.ok(Math.abs(lay.pos[id].x) <= 5 + 1e-9, '横坐标压缩在 ±spanX/2 之内');
}

// ---- 空树 ----
const el = TM.layout(TM.build(I.run('', { host: {} }).trace, 'search'), { spanX: 10, spanZ: 1.5 });
T.eq(el.width, 0, '空树宽度为 0');
```

- [ ] **Step 2–4: 失败 → 实现 → 通过 → 提交**

```bash
node chess/core/tree-model.test.js
git add chess/core/tree-model.js chess/core/tree-model.test.js
git commit -m "feat(chess): 树布局按子树宽度压缩，父节点居中，z = 搜索深度"
```

---

## Task 5: 内联接线

**Files:**
- Modify: `chess/scripts/inline_core.py`

`SOURCES` 加 `'TREE-MODEL'`；另加一个 `ALGOS` 处理分支——`algos/*.js` **不是作为代码内联，而是作为字符串**（规格 §2.1），所以生成的块形如

```js
const ALGOS = { 'minimax.js': "…源码字符串…" };
```

`TREE-MODEL` 与 `ALGOS` 都进 `OPTIONAL_TAGS`（只有 ④⑤ 有这两个标记区）。

- [ ] **Step 1: 加源 + 跑生成 + 验证**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;  echo "chess gate exit=$?"
```

- [ ] **Step 2: 提交**

```bash
git add chess/scripts/inline_core.py chess/tools/*.html
git commit -m "build(chess): inline_core 加 TREE-MODEL 与 ALGOS（算法源码以字符串内联）"
```

---

## Task 6: 工具页骨架 + 调试器接线 + `tree` / `prune` 两个 tab

**Files:**
- Create: `chess/tools/chess-search-minimax.html`

从 `chess/tools/_skeleton.html` 复制起步，分栏布局照 `chess/tools/_debugger-preview.html`（阶段 3b 已验收过的那套：可拖拽分栏、`\` 折叠、fit 变换缩放+居中）。

- [ ] **Step 1: 页面骨架与分栏**

左边 `Editor.mount` + `Debugger.mount`，右边 canvas 画树。**resize 时调用 `dbg.redraw()` 而不是 `dbg.refresh()`**（约束 5）。

- [ ] **Step 2: `tree` tab（纯 minimax）**

`Interp.run(AlgoMinimax.source({ mode: 'plain', depth: depth }))` → `Debugger.create` → `TreeModel.build/createView`。每次游标移动 `TreeModel.seek`，画 `visibleAt` 的节点与边，`spineAt` 加粗。

**深度 4 时轨迹截断**：读数区要明确写出「超出 200,000 步上限，搜索没有跑完」，而不是让人以为工具坏了（规格 §4④、约束 3）。

- [ ] **Step 3: `prune` tab（同一棵树开 α-β）**

同上换 `mode: 'ab'`。被剪的枝染灰塌陷。读数区并排显示两个 tab 的访问节点数。

- [ ] **Step 4: 提交**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py
git add chess/tools/chess-search-minimax.html chess/tools/*.html
git commit -m "feat(chess): 工具④ 骨架、调试器接线与 tree/prune 两个 tab"
```

---

## Task 7: `order` 与 `shannon` 两个 tab

**Files:**
- Modify: `chess/tools/chess-search-minimax.html`

- [ ] **Step 1: `order` tab**

同一深度下 `mode: 'ab'` 与 `mode: 'ordered'` 并排，读数显示两者的访问节点数与步数——**O(b^d) 与 O(b^(d/2)) 的实物证明**。

- [ ] **Step 2: `shannon` tab**

纯图表，无调试器（规格 §4④）：分支因子 35 的指数爆炸 vs 可观测宇宙原子数。这个 tab 不跑解释器，也不建树。

- [ ] **Step 3: 提交**

---

## Task 8: 注册、浏览器验收、全量门

**Files:**
- Modify: `chess/chess-tools.json`、`chess/index.html`

- [ ] **Step 1: 注册**

与阶段 3b 的验收页不同，**本工具要注册**。`chess-tools.json` 加条目，`chess/index.html` 的 FALLBACK 列表同步。

- [ ] **Step 2: 浏览器验收**

预览服务器 `mcp__Claude_Browser__preview_start` `{name: "mathviz"}`（8777）。**每次调用带显式 `tabId`**；面板 rAF 被节流到约每十二秒一帧、`document.hidden` 恒真，**要验状态就读探针，要验时序就直接推累加器**。页面导出 `window.__treeProbe()`，**第一条永远是断言 `tool === 'chess-search-minimax'`**。

逐条确认（每条要探针读数或截图）：

1. 深度 1/2/3，`tree` 与 `prune` 两个 tab 都跑得完，读数显示的极小极大值**两边相同**
2. **深度 4：`tree` tab 明确停在「超出上限」，`prune` tab 跑完** —— 这一阶段的核心一课
3. 单步/后退/步入/步过/步出/跑到断点，树上的脊跟着走
4. 走到 `if (beta <= alpha) { break; }` 那一行，**整片枝子塌掉**
5. 变量面板显示**当前帧**的 `alpha`/`beta`/`best`（3b 的约束 1 在真实宿主上的活体验证）
6. 点调用栈的某一帧 → 树上对应节点选中、变量面板换成那一帧
7. `\` 折叠代码面板回全屏树；分栏可拖拽且树不被裁（3b 修过的 fit 变换）
8. 语言切换 EN⇄ZH，**默认 EN**
9. **深度 4 的 `tree` tab 上连续播放**，测每帧绘制耗时 ≤4ms（约束 3 的最坏点，强制光栅化每帧只做一次，探针开销单列并排除）

- [ ] **Step 3: 全量门**

```bash
node chess/core/tree-model.test.js
node chess/core/algos/minimax.test.js
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;            echo "chess gate exit=$?"
python3 scripts/sync_registry.py --check;  echo "main registry exit=$?"
git status --short
```

- [ ] **Step 4: 提交**

---

## 阶段 4 完成标准

- [ ] `node chess/core/tree-model.test.js` 与 `node chess/core/algos/minimax.test.js` 全绿
- [ ] `python3 chess/scripts/check.py` exit 0
- [ ] `python3 scripts/sync_registry.py --check` exit 0（本工具**已注册**）
- [ ] **α-β 与纯 minimax 在三个深度返回同一个值**（对拍测试 + 页面读数两道）
- [ ] **深度 4：纯 minimax 撞墙、α-β 跑完**，且撞墙被呈现成这一课而不是故障
- [ ] 树的节点身份用 push 步下标，父链与运行时调用栈逐项对拍一致
- [ ] 增量游标与全量重建**逐点一致**（正向与反向都测）
- [ ] 截断轨迹上剪枝报「未知」而不是 0
- [ ] 深度 4 连续播放时每帧绘制 ≤4ms（增量模型在最坏点上撑住）
- [ ] 默认语言 EN

**下一阶段**：阶段 5（工具⑤ 棋盘经典算法，六道题）与 §2.9 的挖空练习。
