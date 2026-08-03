# 国际象棋子项目 · 阶段 3b（调试器与内嵌编辑器）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 `chess/core/debugger.js`（④⑤ 共用的调试器面板）、`chess/core/editor.js`（可编辑、带语法高亮与实时检查的代码面板），以及 `chess/tools/_debugger-preview.html`（**不注册**的验收页，让这两个纯 UI 模块能真的被打开看一眼）。

**Architecture:** 每个模块都切成**可测的纯逻辑核** + **薄 DOM 层**。调试器的核是一个在 3a 轨迹上移动的游标（`step`/`back`/`stepIn`/`stepOver`/`stepOut`/`runTo`），以及由游标派生的四份显示数据（当前行、调用栈、变量、输出）——全部零 DOM、node 可测。编辑器的核是「token 流 → 高亮片段」与「解析错误 → 波浪线位置」两个纯函数，DOM 层只做透明 `textarea` 叠加与滚动同步。

**Tech Stack:** 纯 ES2015、Canvas 2D（棋盘由既有 `board-render.js` 画）、零依赖、零构建。

---

## Global Constraints

- **零依赖**：不得引入任何 npm 包、CDN 资源、外部字体或图片。**不能用 CodeMirror / Monaco**（规格 §2.8）。
- **单文件可用**：`chess/tools/*.html` 必须 `file://` 双击可用。
- **UMD 双导出**：`core/*.js` 既支持 `module.exports`（node 测试），也挂到 `window`。
- **纯逻辑核不得触碰 DOM**：`document` / `window` / `localStorage` / `location` 只能出现在明确标注的 DOM 层函数体内。这是这两个模块能被 node 测试的前提。
- **英文默认、中文可切**（规格 §1.6）。所有面向用户的文案是 `{zh, en}` 对象。
- **`\` 一键折叠代码面板回全屏棋盘**（规格 §1.5 的承诺）——分屏是本子项目对设计系统第 2 条原则的**明文推翻**，折叠是它的代价。
- **调试器键位沿用主流调试器**（规格 §5.4）：`F10` 步过、`F11` 步入、`Shift+F11` 步出、`F9` 设/清断点、`F5` 跑到断点。**代码面板获得焦点时这些键仍生效，但方向键与文本编辑键归编辑器。**
- **一切按时间推进，不按帧计数**（开发机是 30Hz 外接显示器）。用 `VizEngine.state.dt`。
- **只暂存显式路径，禁止 `git add -A` / `git commit -a`。**
- **规格来源**：`docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md` §1.5、§2.7、§2.8、§5.4。

### 给每一位执行者的硬性要求

> **如果本计划里某段代码是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。**

阶段 3a 的九个任务里，**每一个执行者都报出了至少一个真问题**，其中三次是在纠正我：两次我的心智模型错了，一次我给的探测脚本在原理上测不到它要测的东西。这条规矩在这个项目里回报极高。

---

## 阶段 3a 交给本阶段的六条硬约束

这些是 3a 实施过程中**实测得出**的，不是推测。**违反其中任何一条都会产生一个静默显示错值的调试器**——对教学工具而言，这比崩溃更糟。

### 约束 1：变量面板必须用「深度窗口回放」，不得用全局扁平回放

3a 的轨迹里，每条 `varDelta` 只带 `{ name, from, to }`，**不带作用域标识**。递归时同名参数会在不同帧各有一份：

```
step 1  depth 1  [{"name":"n","to":3}]
step 3  depth 2  [{"name":"n","to":2}]
step 5  depth 3  [{"name":"n","to":1}]
step 8  depth 3  [{"name":"n","from":1}]   ← 各帧退出时都有恢复条目
```

**全局按名扁平回放会跨帧串味**：回放到 depth 3 时，`n` 会被更浅或更深的帧覆盖。轨迹里的信息是够的（`depth` / `frameOp` 划得出帧的区间），**但消费方必须正确使用它**。

**阶段 5 的六道算法题全是递归**——这条错了，那六道题的变量面板全是错的。

### 约束 2：词法器是共享契约，高亮必须用 `Interp.tokenize`

规格 §2.8：「高亮看到的 token 流与执行看到的是同一份——不存在『高亮说这是关键字、解释器说不是』的分歧」。

`Interp.tokenize` 为此**专门产出 `comment` token**并给每个 token 带 `line` / `col` / `start` / `end`。**不要自己写一个正则高亮器。**

3a 还修过一个相关的坑：模板串内部嵌套字符串的裸换行错误，最初只在 `parse()` 的第二遍词法化时才浮现，**直接调 `tokenize()` 看不到**——因为高亮器正是直接调 `tokenize()` 的，那会导致该报错的地方画不出波浪线。现已修复，但这说明**高亮路径与执行路径必须走同一个入口**。

### 约束 3：浏览器里要重测递归深度的崩点

3a 的 `MAX_DEPTH = 500` 是**在 node 下**校准的：冷启动约 674 层时引擎抛裸 `RangeError`，500 留了约 26% 余量。

**但解释器的真实部署环境是浏览器**（内联进 `tools/*.html`），浏览器对嵌套生成器的栈深度未必与 node 一致。**本阶段第一次有页面可以跑**——必须在真实浏览器里重测一次，确认 500 在那边也先于引擎崩、给出干净报错。

### 约束 4：`STEP_LIMIT` 是架构上限，不是可调旋钮

默认 `200000`（每步约 426 字节，约 81 MB）。实测：N 皇后 N=8 需 73,904 步（放得下）；**朴素回溯 DFS 骑士巡游 5×5 需 472,717 步、6×6 需 13,393,996 步**（GB 量级，「先跑完记全轨迹」这套架构装不下）。

Warnsdorff 启发式版只要 3,523–5,670 步。

**对本阶段的影响**：验收页的示例程序必须选在预算内的规模。规格 §5 想让 `tourDFS` 与 `tourWarnsdorff` 并排对比「指数 vs 近线性」——那是阶段 5 的事，但**如果你在验收页放朴素 DFS，要把「撞上上限」呈现成这一课的内容，而不是让人以为工具坏了**。

### 约束 5：TDZ 已实现，行为变了

块内 `let`/`const` 在执行到声明语句之前处于暂时性死区，提前读取抛 `Cannot access 'x' before initialization`。**编辑器的示例代码若依赖旧的「静默读到外层」行为会报错。**

### 约束 6（追加）：把 `hoistLexicalDecls` + `hoistFunctionDecls` 抽成共用前置

3a 最后一轮修的那个 TDZ 缺口，根因是 **`callInterpreted` 与 `evalBlockBody` 各有一套语句循环**——前者为了绑定 push/pop 帧标记而手写。当时只给 `evalBlockBody` 接了 `hoistLexicalDecls`，函数体顶层的前向引用就绕过了 TDZ。

修复者的判断（我采纳）：把那两行前置（`hoistLexicalDecls` + `hoistFunctionDecls`）抽成一个共用 helper，两处都调，**不动两个循环的主体**。表面积小、易验证。

**这是 3b 的早期项**，在动 `interp.js` 之前先做掉——不做的话，下一次往前置里加东西时会以完全相同的方式再漏一次。

### 约束 7：`_test.js` 的 `eq` 有一个假阴性陷阱

`_test.js` 的 `eq` 用 `JSON.stringify` 比较，而 **`JSON.stringify(function(){})` 与 `JSON.stringify(undefined)` 都是 `undefined`**。于是 `T.eq(某个函数, undefined)` **会通过**。

3a 的沙箱断言最初正是这个形态，靠变异往返才发现。**本阶段凡是要断言「某值是 undefined / 不存在」的地方，用 `T.ok(typeof x === 'undefined', …)` 而不是 `T.eq(x, undefined)`。**

---

## 已有的接口（本阶段只消费，不修改）

```js
// chess/core/interp.js（阶段 3a，605+ 条测试）
Interp.tokenize(src) → Token[]
  Token = { type, value, line, col, start, end }
  type ∈ 'num'|'str'|'tpl'|'name'|'kw'|'punct'|'comment'|'eof'
Interp.KEYWORDS                       // 子集内的关键字表（高亮上色要用）
Interp.parse(src) → { type:'Program', body }   // 抛 { message, line, col, category }
  category ∈ 'syntax' | 'unsupported' | 'runtime'
Interp.parseExpression(src)
Interp.run(src, { host, limit }) → { result, trace, host }
  Step = { line, depth, frameOp, frameName, varDelta, boardOps, out }
    frameOp ∈ 'push' | 'pop' | null
    varDelta = [ { name, from, to } ]        // from 为 undefined 表示此前不存在
    boardOps = [ { kind, sq, to, from } ]    // kind ∈ 'mark'|'place'|'clear'
  trace.truncated / trace.limit             // 到达上限时 truncated=true，**没有 omitted 字段**
Interp.STEP_LIMIT = 200000
Interp.MAX_DEPTH = 500

// chess/core/viz-engine.js
VizEngine.init({ canvas, SCENES, PARAMS, TOOL, VERSION, ENGINE_VERSION, autoLoop })
VizEngine.state.dt        // 帧时长的唯一出处，已 clamp 到 [0, 0.05]
VizEngine.t(obj)          // i18n
VizEngine.syncPresetHighlight(tabId, key)
proj / unproject / strokePoly / line3 / glowDot / solidDot / label3 / withContext / viewInfo

// chess/core/board-render.js
BoardRender.layout({ files, ranks, cell, z }) / drawBoard / drawPiece / pickSquare / pieceAutoScale

// chess/core/_test.js
eq(actual, expected, label)   // ⚠ JSON.stringify 比较，见约束 6
ok(cond, label) / throws(fn, label) / report()
```

---

## File Structure

| 文件 | 责任 |
|---|---|
| `chess/core/debugger.js` | ★ 调试器：轨迹游标（纯逻辑）+ 四份显示数据的派生 + 薄 DOM 渲染 |
| `chess/core/debugger.test.js` | 游标与派生数据的测试（零 DOM） |
| `chess/core/editor.js` | ★ 编辑器：高亮片段与波浪线位置（纯函数）+ 透明 textarea 叠加层 |
| `chess/core/editor.test.js` | 两个纯函数的测试（零 DOM） |
| `chess/tools/_debugger-preview.html` | 验收页。**不注册、不进 `chess-tools.json`、不上导航页** |
| `chess/scripts/inline_core.py` | 加 `DEBUGGER` / `EDITOR` 两个可选源 |

**为什么每个模块都切成「纯逻辑核 + 薄 DOM 层」**：这两个模块的绝大多数缺陷会出在逻辑上（游标走错帧、高亮片段错位、波浪线指错列），而这些**在 node 里测比在浏览器里测便宜两个数量级**。DOM 层留薄，是为了让浏览器验收只需要确认「接线对了」，而不是去验证逻辑。

### 任务依赖

```
Task 1 游标（纯逻辑）→ Task 2 派生显示数据（纯逻辑）
Task 3 高亮片段（纯函数）→ Task 4 波浪线与实时检查（纯函数）
                                    ↓
Task 5 验收页骨架 + 两个模块的 DOM 层接线
                                    ↓
Task 6 浏览器验收 + 浏览器里重测栈深 + 内联接线
```

Task 1–2 与 Task 3–4 **文件不重叠，可并行**（`debugger.js` / `editor.js`）。Task 5–6 串行。

---

## Task 1: 调试器游标（纯逻辑）

**Files:**
- Create: `chess/core/debugger.js`
- Test: `chess/core/debugger.test.js`

**Interfaces:**
- Consumes: `Interp.run(...).trace`
- Produces:

```js
Debugger.create(trace)  → cur    // { trace, i, breakpoints: Set-like 对象 }
Debugger.goto(cur, i)   → bool   // 夹到 [0, trace.length-1]
Debugger.step(cur, +1|-1) → bool
Debugger.stepOver(cur)  → bool   // 前进到 depth <= 当前深度 的下一步
Debugger.stepIn(cur)    → bool   // 就是前进一步
Debugger.stepOut(cur)   → bool   // 前进到 depth < 当前深度 的下一步
Debugger.runTo(cur)     → bool   // 前进到下一个断点行；没有则到末尾
Debugger.toggleBreak(cur, line) / Debugger.hasBreak(cur, line)
```

**核心设计（约束 1 的来源）**：步入/步过/步出**全部是在已记录的轨迹上移动下标**，不驱动生成器——「后退」只有先跑完再回放才做得到（规格 §2.7）。判据是每条 Step 的 `depth`。

- [ ] **Step 1: 写失败的测试**

Create `chess/core/debugger.test.js`：

```js
'use strict';
const T = require('./_test.js');
const I = require('./interp.js');
const D = require('./debugger.js');

/* 用真实的解释器轨迹做 fixture，而不是手搓一个假 trace ——
   手搓的假 trace 会悄悄偏离真实形状，而这个模块的全部正确性
   都建立在「真实轨迹长什么样」上。 */
const SRC = [
  'function inner(x) {',      // 1
  '  return x + 1;',          // 2
  '}',                        // 3
  'function outer(y) {',      // 4
  '  const a = inner(y);',    // 5
  '  return a * 2;',          // 6
  '}',                        // 7
  'const r = outer(3);',      // 8
  'return r;',                // 9
].join('\n');
const trace = I.run(SRC, { host: {} }).trace;

// ---- 基本移动 ----
const cur = D.create(trace);
T.eq(cur.i, 0, '初始停在第 0 步');
T.eq(D.step(cur, 1), true, '前进一步');
T.eq(cur.i, 1, 'i 变成 1');
T.eq(D.step(cur, -1), true, '后退一步');
T.eq(cur.i, 0, 'i 回到 0');
T.eq(D.step(cur, -1), false, '已在开头，再后退无效');
T.eq(D.goto(cur, 9999), true, '越界被夹到末尾');
T.eq(cur.i, trace.length - 1, '夹到最后一步');
T.eq(D.step(cur, 1), false, '已在末尾，再前进无效');

// ---- 步入 / 步过 / 步出：判据是 depth ----
/* 找到第一处 frameOp==='push' 的位置，它的前一步就是「即将进入函数的那一行」。 */
const pushAt = trace.findIndex(s => s.frameOp === 'push');
T.ok(pushAt > 0, '轨迹里有入帧标记');

const over = D.create(trace);
D.goto(over, pushAt - 1);
const depthBefore = trace[pushAt - 1].depth;
D.stepOver(over);
T.ok(trace[over.i].depth <= depthBefore, '步过之后深度不高于原来 —— 整个函数调用被跳过了');

const into = D.create(trace);
D.goto(into, pushAt - 1);
D.stepIn(into);
T.eq(into.i, pushAt, '步入就是前进一步，落在入帧那一步');

const out = D.create(trace);
D.goto(out, pushAt);
const depthIn = trace[pushAt].depth;
D.stepOut(out);
T.ok(trace[out.i].depth < depthIn, '步出之后深度严格变小');

// 在最外层步出：走到末尾而不是原地不动
const outTop = D.create(trace);
D.goto(outTop, 0);
D.stepOut(outTop);
T.eq(outTop.i, trace.length - 1, '在深度 0 步出 = 跑到末尾');

// ---- 断点 ----
const bp = D.create(trace);
T.eq(D.hasBreak(bp, 2), false, '初始没有断点');
D.toggleBreak(bp, 2);
T.eq(D.hasBreak(bp, 2), true, '设上了');
D.toggleBreak(bp, 2);
T.eq(D.hasBreak(bp, 2), false, '再点一次取消');

const run = D.create(trace);
D.toggleBreak(run, 2);          // inner 的 return 那一行
D.goto(run, 0);
T.eq(D.runTo(run), true, '跑到断点');
T.eq(trace[run.i].line, 2, '停在断点所在的行');

// 没有断点时跑到末尾
const runNone = D.create(trace);
D.goto(runNone, 0);
D.runTo(runNone);
T.eq(runNone.i, trace.length - 1, '没有断点就跑到末尾');

T.report();
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/debugger.test.js`
Expected: FAIL —— `Cannot find module './debugger.js'`

- [ ] **Step 3: 写实现**

Create `chess/core/debugger.js`。UMD 包装照 `chess/core/replay.js` 的写法。核心：

```js
  /* 步入 / 步过 / 步出全部是在**已记录的轨迹**上移动下标，不驱动生成器。
     这是规格 §2.7「先跑完、记全轨迹、再回放」的直接后果 —— 「后退」只有
     这样才做得到，而后退是这套调试器最贵的功能。判据是每条 Step 的 depth：
       步入 = 前进一步（深度可能变大）
       步过 = 前进到 depth <= 当前
       步出 = 前进到 depth <  当前
     在最外层步出没有「更浅的下一步」，此时跑到末尾 —— 这与主流调试器
     一致（VS Code 里在顶层 Step Out 就是继续跑完）。 */
```

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/debugger.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/debugger.js chess/core/debugger.test.js
git commit -m "feat(chess): 调试器游标 —— 在已记录的轨迹上按 depth 做步入/步过/步出"
```

---

## Task 2: 由游标派生的四份显示数据（纯逻辑）

**Files:**
- Modify: `chess/core/debugger.js`
- Test: `chess/core/debugger.test.js`

**Interfaces:**
- Consumes: Task 1 的 `cur`
- Produces:

```js
Debugger.currentLine(cur)   → number
Debugger.visitedLines(cur)  → number[]        // 已执行过的行（留淡色痕迹）
Debugger.callStack(cur)     → [{ name, line, depth }]   // 由外到内
Debugger.locals(cur)        → { [name]: value }         // **当前帧**的局部变量
Debugger.output(cur)        → string[]                  // 截至当前步的日志
Debugger.boardState(cur)    → { marks: {sq:kind}, pieces: {sq:code} }
```

**`locals` 是本任务的全部难点，也是约束 1 的落点。**

- [ ] **Step 1: 写失败的测试**

追加到 `debugger.test.js`（`T.report()` 之前）：

```js
// ============ 派生显示数据 ============

// ---- 当前行与已访问行 ----
const disp = D.create(trace);
D.goto(disp, 0);
T.eq(D.currentLine(disp), trace[0].line, '当前行取自当前步');
D.goto(disp, 5);
T.ok(D.visitedLines(disp).indexOf(trace[0].line) >= 0, '已访问行含第 0 步的行');
T.ok(D.visitedLines(disp).indexOf(trace[trace.length - 1].line) < 0,
     '还没走到的行不算已访问');

// ---- 调用栈 ----
const st = D.create(trace);
const deepest = trace.reduce((best, s, k) => s.depth > trace[best].depth ? k : best, 0);
D.goto(st, deepest);
const stack = D.callStack(st);
T.eq(stack.length, trace[deepest].depth, '栈深与该步的 depth 一致');
T.ok(stack.every((f, k) => k === 0 || f.depth > stack[k - 1].depth), '由外到内深度递增');

// ---- locals：**必须是当前帧的**（约束 1）----
/* 递归里同名参数在不同帧各有一份。全局按名扁平回放会跨帧串味 ——
   这条测试就是拿递归来钉死它。 */
const REC = [
  'function fact(n) {',        // 1
  '  if (n <= 1) { return 1; }', // 2
  '  return n * fact(n - 1);', // 3
  '}',                         // 4
  'return fact(3);',           // 5
].join('\n');
const rt = I.run(REC, { host: {} }).trace;

/* 找到最深那一帧里的某一步（n 应该是 1），以及一个较浅帧里的步（n 应该是 3）。 */
const deepIdx = rt.reduce((best, s, k) => s.depth > rt[best].depth ? k : best, 0);
const deepCur = D.create(rt); D.goto(deepCur, deepIdx);
T.eq(D.locals(deepCur).n, 1, '最深帧里 n === 1');

const shallowIdx = rt.findIndex(s => s.depth === 1 && s.varDelta.some(d => d.name === 'n'));
const shallowCur = D.create(rt); D.goto(shallowCur, shallowIdx);
T.eq(D.locals(shallowCur).n, 3, '第一帧里 n === 3 —— 没有被更深的帧串味');

/* 块作用域遮蔽：3a 已经让轨迹在作用域退出时补恢复 delta，
   所以 locals 在块结束之后要看到外层的值。 */
const SH = 'let a = 1;\n{ let a = 2; }\nreturn a;';
const sht = I.run(SH, { host: {} }).trace;
const shc = D.create(sht); D.goto(shc, sht.length - 1);
T.eq(D.locals(shc).a, 1, '块结束后 a 是外层的 1，不是内层的 2');

// ---- 输出 ----
const OUT = 'log("a");\nlog("b");\nlog("c");';
const ot = I.run(OUT, { host: {} }).trace;
const oc = D.create(ot);
D.goto(oc, ot.length - 1);
T.eq(D.output(oc), ['a', 'b', 'c'], '截至末尾有三行');
const oc2 = D.create(ot);
const secondLog = ot.findIndex((s, k) => ot.slice(0, k + 1).filter(x => x.out).length === 2);
D.goto(oc2, secondLog);
T.eq(D.output(oc2), ['a', 'b'], '截至第二条日志只有两行 —— 输出跟着游标走');

// ---- 棋盘状态：正放与反放都要对 ----
const BD = 'mark(5, "trying");\nmark(5, "confirmed");\nclear(5);';
const bt = I.run(BD, { host: {} }).trace;
const bc = D.create(bt);
const afterFirst = bt.findIndex(s => s.boardOps.length);
D.goto(bc, afterFirst);
T.eq(D.boardState(bc).marks[5], 'trying', '第一次标记后是 trying');
D.goto(bc, bt.length - 1);
T.ok(typeof D.boardState(bc).marks[5] === 'undefined', 'clear 之后这一格没有标记');
D.goto(bc, afterFirst);
T.eq(D.boardState(bc).marks[5], 'trying', '**反放回去仍然是 trying** —— 撤销信息真的被用上了');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/debugger.test.js`
Expected: FAIL —— `D.currentLine is not a function`

- [ ] **Step 3: 写实现**

`locals` 的实现要点（**这是本阶段最容易做错的地方**）：

```js
  /* locals 必须只反映**当前帧**的局部变量。
     3a 的 varDelta 只带 { name, from, to }，**不带作用域标识** —— 递归时
     同名参数在不同帧各有一份，全局按名扁平回放会跨帧串味（回放到深帧时，
     n 会被浅帧或更深帧的值覆盖）。
     轨迹里的信息是够的：用 depth 与 frameOp 划出「当前帧从哪一步开始」，
     只回放那个区间内的 varDelta。
     阶段 5 的六道算法题全是递归 —— 这里错了，那六道题的变量面板全是错的。 */
```

具体做法：从 `cur.i` 向前扫，找到当前帧的起点（最近一个 `frameOp === 'push'` 且其 `depth` 等于当前 `depth` 的位置；若当前 `depth === 0` 则起点是 0），然后只回放 `[起点, cur.i]` 区间内的 `varDelta`。

`boardState` 则是全区间回放 `[0, cur.i]` 的 `boardOps`（棋盘是全局的，不分帧），`marks` 与 `pieces` **分两个槽**（3a 的 B-4 修复把它们分开了，撤销才不会互相覆盖）。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/debugger.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/debugger.js chess/core/debugger.test.js
git commit -m "feat(chess): 调试器的四份显示数据 —— locals 用深度窗口回放，不跨帧串味"
```

---

## Task 3: 高亮片段（纯函数）

**Files:**
- Create: `chess/core/editor.js`
- Test: `chess/core/editor.test.js`

**Interfaces:**
- Consumes: `Interp.tokenize` / `Interp.KEYWORDS`
- Produces: `Editor.highlight(src)` → `[{ text, cls }]`（`cls ∈ 'kw'|'num'|'str'|'tpl'|'comment'|'name'|'punct'|'plain'`）

**约束 2 的落点**：高亮必须走 `Interp.tokenize`，**不许自己写正则高亮器**。

- [ ] **Step 1: 写失败的测试**

Create `chess/core/editor.test.js`：

```js
'use strict';
const T = require('./_test.js');
const I = require('./interp.js');
const E = require('./editor.js');

function classesOf(src) { return E.highlight(src).map(p => p.cls); }
function textOf(src) { return E.highlight(src).map(p => p.text).join(''); }

// ---- 最重要的一条：片段拼回去必须与原文逐字节相同 ----
/* 高亮层与透明 textarea 是逐字符对齐的两层，只要有一个字符错位，
   光标就会与它下面的文字对不上 —— 这是这类编辑器最典型的坏法。 */
for (const src of [
  'let x = 1;',
  '// 注释\nlet y = 2;',
  'const s = "hi";',
  'const t = `a${b}c`;',
  'function f(a, b) { return a + b; }',
  '  let indented = 1;\n\n\nlet after = 2;',
  'let 中文 = 1; // 中文注释',
]) {
  T.eq(textOf(src), src, '片段拼回原文（逐字节）：' + JSON.stringify(src.slice(0, 24)));
}

// ---- 类别 ----
T.ok(classesOf('let x = 1;').indexOf('kw') >= 0, 'let 是关键字');
T.ok(classesOf('let x = 1;').indexOf('num') >= 0, '1 是数字');
T.ok(classesOf('const s = "hi";').indexOf('str') >= 0, '字符串');
T.ok(classesOf('// hi\nlet a=1;').indexOf('comment') >= 0, '注释有自己的类别');
T.ok(classesOf('const t = `a${b}c`;').indexOf('tpl') >= 0, '模板串');

// 空白也要有片段（否则拼不回原文），类别是 plain
T.ok(classesOf('let  x').indexOf('plain') >= 0, '空白是 plain 片段');

// ---- 高亮不能因为语法错误就整个罢工 ----
/* 使用者打字打到一半，源码几乎总是暂时不合法的。高亮是词法层的事，
   与语法是否合法无关 —— 这一条错了，编辑器会在每次敲键时闪烁。 */
T.eq(textOf('let x = ;'), 'let x = ;', '语法错误的源码仍然能高亮');
T.eq(textOf('function f( {'), 'function f( {', '括号不配对仍然能高亮');

// ---- 词法层报错的源码：降级但不抛 ----
/* `'abc`（未闭合字符串）会让 tokenize 抛错。高亮层必须兜住，
   把剩余部分当纯文本，而不是让整个编辑器炸掉。 */
const broken = E.highlight("let s = 'abc");
T.ok(broken.map(p => p.text).join('') === "let s = 'abc", '词法错误时也要拼回原文');

// ---- 空输入 ----
T.eq(E.highlight(''), [], '空源码给空数组');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/editor.test.js`
Expected: FAIL —— `Cannot find module './editor.js'`

- [ ] **Step 3: 写实现**

```js
  /* 高亮直接复用 Interp.tokenize，不自己写正则高亮器（规格 §2.8）——
     这样高亮看到的 token 流与执行看到的是同一份，不会出现「高亮说这是
     关键字、解释器说不是」的分歧。
     tokenize 专门产出 comment token 就是为了这里。

     两条不变量：
     1. 片段拼回去必须与原文逐字节相同（高亮层与透明 textarea 逐字符对齐，
        错一个字符光标就与文字对不上）。所以 token 之间的空白也要产出
        plain 片段。
     2. tokenize 抛错时（未闭合字符串之类）必须降级为纯文本，不能让整个
        编辑器炸掉 —— 使用者打字打到一半，源码几乎总是暂时不合法的。 */
```

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/editor.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/editor.js chess/core/editor.test.js
git commit -m "feat(chess): 编辑器高亮片段 —— 复用解释器词法器，拼回原文逐字节相同"
```

---

## Task 4: 波浪线位置与实时语法检查（纯函数）

**Files:**
- Modify: `chess/core/editor.js`
- Test: `chess/core/editor.test.js`

**Interfaces:**
- Consumes: `Interp.parse`
- Produces: `Editor.check(src)` → `null`（无错）或 `{ line, col, category, message, index }`；`Editor.lineStarts(src)` → `number[]`

`index` 是错误位置在源码里的字符下标（波浪线要用它定位）。

- [ ] **Step 1: 写失败的测试**

追加到 `editor.test.js`：

```js
// ---- 实时语法检查 ----
T.eq(E.check('let x = 1;'), null, '合法代码没有错误');
T.eq(E.check(''), null, '空源码没有错误');

const bad = E.check('let x = ;');
T.ok(bad, '语法错误被报出来');
T.eq(bad.category, 'syntax', '类别是 syntax');
T.eq(bad.line, 1, '行号');

const unsup = E.check('class Foo {}');
T.eq(unsup.category, 'unsupported', 'class 报 unsupported 而不是 syntax');
T.ok(/class/.test(unsup.message), '消息点名了 class：' + unsup.message);

/* 两个类别对使用者的意义完全不同，编辑器要用不同的措辞：
   unsupported = 「这是合法的 JS，但不在这个解释器的子集里」
   syntax      = 「这根本不是合法的 JS」 */
const unsup2 = E.check('const r = a ?? b;');
T.eq(unsup2.category, 'unsupported', '?? 是 unsupported');
T.ok(!/三元|ternary/i.test(unsup2.message), '?? 的消息不该说成三元运算符：' + unsup2.message);

// ---- index：波浪线定位 ----
const multi = E.check('let a = 1;\nlet b = 2;\nclass Foo {}');
T.eq(multi.line, 3, '第 3 行');
T.ok(typeof multi.index === 'number', 'index 是数字');
T.eq('let a = 1;\nlet b = 2;\nclass Foo {}'.slice(multi.index, multi.index + 5), 'class',
     'index 切出来正好是出错的那个词');

// ---- lineStarts：DOM 层把 index 换算成行/列要用 ----
T.eq(E.lineStarts('abc'), [0], '单行');
T.eq(E.lineStarts('a\nbb\nccc'), [0, 2, 5], '每行起点的字符下标');
T.eq(E.lineStarts(''), [0], '空源码也有一行');

// ---- 词法层的错误也要被 check 接住 ----
const lex = E.check("let s = 'abc");
T.ok(lex, '未闭合字符串被 check 报出来');
T.eq(lex.line, 1, '行号正确');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/editor.test.js`
Expected: FAIL —— `E.check is not a function`

- [ ] **Step 3: 写实现**

`check(src)` 包住 `Interp.parse` 的抛错，把 `{ message, line, col, category }` 转成上面的形状，并用 `lineStarts` 把 `(line, col)` 换算成 `index`。**空源码要返回 `null` 而不是报错。**

- [ ] **Step 4: 运行确认通过 + 提交**

```bash
node chess/core/editor.test.js
git add chess/core/editor.js chess/core/editor.test.js
git commit -m "feat(chess): 实时语法检查与波浪线定位，区分 syntax 与 unsupported"
```

---

## Task 5: 验收页与两个模块的 DOM 层

**Files:**
- Create: `chess/tools/_debugger-preview.html`
- Modify: `chess/core/debugger.js`（加 DOM 渲染）
- Modify: `chess/core/editor.js`（加透明 textarea 叠加层）
- Modify: `chess/scripts/inline_core.py`

**Interfaces:**
- Produces: `Debugger.mount(el, cur, opts)`；`Editor.mount(el, { value, onChange })`

**`_debugger-preview.html` 不注册**——不进 `chess-tools.json`、不上 `chess/index.html`，与既有的 `_piece-preview.html` / `_skeleton.html` 同一性质。它存在的唯一理由是**让这两个纯 UI 模块能真的被打开看一眼**（阶段 0–2 里，用户三次截图各抓出一个多轮代码审核都漏掉的问题）。

- [ ] **Step 1: 编辑器的 DOM 层**

透明 `textarea` 叠在高亮层上（规格 §2.8）：

- `<textarea>` 文字透明（`color: transparent`）但**光标可见**（`caret-color`），负责全部输入、选区、原生撤销、IME
- 底下一层 `<pre>` 渲染 `Editor.highlight(src)` 的片段
- **两者字体度量必须完全一致**（同一个 `font-family` / `font-size` / `line-height` / `letter-spacing` / `tab-size`），否则字符会错位
- 滚动同步：`textarea` 的 `scrollTop` / `scrollLeft` 同步给 `<pre>`
- 行号槽在左侧，**断点点在它上面**（规格 §2.8）
- 输入防抖后调 `Editor.check`，有错则在该位置画波浪线、行号槽内点红点、悬停显示消息
- **有语法错时 `Run` 按钮禁用**（规格 §2.8：不会跑到一半才崩）

- [ ] **Step 2: 调试器的 DOM 层**

五个区（规格 §2.7）：代码（当前行高亮 + 已执行行留淡色痕迹）、调用栈（可点击跳到该帧）、变量（本步变化的值闪一下）、输出（每步一行）、读数。

控制条：`播放 / 暂停 / 单步 / 后退 / 步入 / 步过 / 步出 / 跑到断点 / 速度`。

键位（规格 §5.4）：`F10` 步过、`F11` 步入、`Shift+F11` 步出、`F9` 断点、`F5` 跑到断点。**代码面板获得焦点时这些键仍生效，但方向键与文本编辑键归编辑器**——这条要专门做：在 `keydown` 里判断是不是这五个键，是则 `preventDefault` 并处理，否则放行给 textarea。

- [ ] **Step 3: 验收页**

左右分栏（可拖拽调宽），左边代码面板、右边棋盘（用既有 `BoardRender` 画一块 8×8）。`\` 一键折叠代码面板回全屏棋盘（规格 §1.5）。

页面内置两三段示例程序（**规模必须在 `STEP_LIMIT = 200000` 之内**，见约束 4）：

- 一段 N 皇后 N=6（实测 4,370 步）——回溯与 `mark`/`clear` 的典型形态
- 一段马的最短路 BFS 8×8——`mark` 的另一种用法
- 一段故意写错的（比如 `class Foo {}` 或缺分号），用来看实时检查与 `Run` 禁用

- [ ] **Step 4: 内联接线**

`inline_core.py` 的 `SOURCES` 加 `'DEBUGGER'` 与 `'EDITOR'`，并加进 `OPTIONAL_TAGS`（只有验收页与将来的 ④⑤ 有这两个标记区）。

- [ ] **Step 5: 提交**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py
git add chess/core/debugger.js chess/core/editor.js chess/tools/_debugger-preview.html chess/scripts/inline_core.py chess/tools/*.html
git commit -m "feat(chess): 调试器与编辑器的 DOM 层，以及不注册的验收页"
```

---

## Task 6: 浏览器验收、浏览器里重测栈深、全量门

**Files:**
- Modify: 上一任务的产物（修验收中发现的问题）

- [ ] **Step 1: 浏览器验收清单**

预览服务器用 `mcp__Claude_Browser__preview_start` 带 `{name: "mathviz"}`（8777 端口）。**每次调用带显式 `tabId`**——多 agent 共享浏览器会话。**面板 rAF 被节流到约每十二秒一帧**，要验状态就读探针，别靠看画面。

页面要导出一个探针：

```js
window.__dbgProbe = function () {
  return { tool: '_debugger-preview', i: cur.i, len: cur.trace.length,
           line: Debugger.currentLine(cur), depth: cur.trace[cur.i].depth,
           stack: Debugger.callStack(cur).length,
           locals: Debugger.locals(cur), breakpoints: [...],
           checkError: Editor.check(editorValue()) };
};
```

**第一条永远是断言 `__dbgProbe().tool === '_debugger-preview'`。**

逐条确认（**每条都要截图或探针读数**）：

1. 载入 N 皇后示例，点 `Run` → 轨迹生成，读数显示步数
2. 单步前进若干步 → 当前行高亮跟着走，已执行行留淡色痕迹
3. **后退** → 棋盘上的标记真的退回去了（这是整套架构存在的理由）
4. 步入 / 步过 / 步出 → `depth` 按预期变化（探针读 `depth`）
5. 在某行点行号槽设断点 → 红点出现；`F5` 跑到断点 → 停在该行
6. `F10` / `F11` / `Shift+F11` / `F9` 四个键位生效
7. **焦点在代码面板里时**：`F10` 仍然步过，但方向键仍然移动光标（规格 §5.4）
8. 改代码 → 高亮跟着变；打出一个 `class Foo {}` → 波浪线出现、行号槽红点、`Run` 禁用
9. `\` 折叠代码面板 → 棋盘全屏；再按一次恢复
10. 分栏可拖拽调宽
11. 语言切换 EN⇄ZH，**默认 EN**
12. 递归示例（`fact(3)` 之类）里步进到深帧 → **变量面板显示的是当前帧的 `n`，不是别的帧的**（约束 1 的活体验证）

- [ ] **Step 2: 在浏览器里重测递归深度崩点（约束 3）**

3a 的 `MAX_DEPTH = 500` 是在 node 下校准的（冷启动约 674 层引擎崩）。**浏览器未必一样。**

在验收页的控制台里跑：

```js
(() => {
  const out = [];
  for (const n of [100, 200, 300, 400, 450, 490]) {
    try { Interp.run('function f(k){ if(k<=0){return 0;} return 1+f(k-1); } return f('+n+');', {host:{}}); out.push(n + ':ok'); }
    catch (e) { out.push(n + ':' + (e.category === 'runtime' && /depth/i.test(e.message) ? 'clean' : 'RAW:' + e.name)); }
  }
  return out.join(' ');
})()
```

**预期**：全部 `ok`（都在 500 以下）。然后测 `510` / `600`，预期是 `clean`（我们的守卫先触发）。

**如果浏览器里出现 `RAW:RangeError`，说明浏览器的栈比 node 浅，`MAX_DEPTH` 要跟着降——停下来报告，那是需要我裁定的事。**

- [ ] **Step 3: 全量门**

```bash
node chess/core/debugger.test.js
node chess/core/editor.test.js
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;            echo "chess gate exit=$?"
python3 scripts/sync_registry.py --check;  echo "main registry exit=$?"
git status --short
```

- [ ] **Step 4: 提交**

---

## 阶段 3b 完成标准

- [ ] `node chess/core/debugger.test.js` 与 `node chess/core/editor.test.js` 全绿
- [ ] `python3 chess/scripts/check.py` exit 0（会自动收进这两个新测试文件）
- [ ] `python3 scripts/sync_registry.py --check` exit 0
- [ ] **变量面板在递归算法上显示的是当前帧的值**（约束 1，有 node 测试 + 浏览器活体验证两道）
- [ ] 高亮片段拼回原文**逐字节相同**，且语法错误时不罢工
- [ ] 实时检查区分 `syntax` 与 `unsupported`，`?.` / `??` 的消息**不再说成三元运算符**
- [ ] 后退真的能把棋盘退回去
- [ ] `F10`/`F11`/`Shift+F11`/`F9`/`F5` 五个键位生效，且焦点在编辑器里时方向键仍归编辑器
- [ ] `\` 折叠代码面板回全屏棋盘（规格 §1.5 的承诺）
- [ ] **浏览器里重测过递归深度崩点**，`MAX_DEPTH = 500` 在浏览器里也先于引擎触发
- [ ] `_debugger-preview.html` **不在** `chess-tools.json` 与 `chess/index.html` 里
- [ ] 默认语言 EN

**下一阶段**：阶段 4（工具④ 博弈树 + α-β，分屏调试器的第一个真实宿主）。
