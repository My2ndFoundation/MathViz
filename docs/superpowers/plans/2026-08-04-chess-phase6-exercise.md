# 阶段 6：`exercise.js` 挖空练习 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让工具⑤ 的三道题从「看算法跑」变成「把算法的关键一行填出来」——挖空直接声明在算法源码里，判定比行为不比文本，判错时把调试器停在两个版本行为分歧的第一步。

**Architecture:** 新增纯逻辑核 `chess/core/exercise.js`（UMD、不碰 DOM、不认识任何一道题），三个导出：`parse` 从源码里解析 `// >>> BLANK` 指令并生成占位版源码、`judge` 比对两次运行的可观测行为并定位第一处分歧、`hintAt` 给分级提示。工具页只做 UI：模式开关、占位渲染、Check、双轨各自定位、`localStorage`。参考答案就是那份正在运行的源码本身，所以参考与练习不可能漂移。

**Tech Stack:** 零依赖原生 JS（ES5 风格的 UMD 模块）、`chess/core/_test.js` 的三函数断言库（`ok` / `eq` / `throws`）、`chess/core/interp.js` 的 ES 子集解释器、Canvas 2D。无构建、无包管理器。

## Global Constraints

- **零依赖**：不得引入任何 npm 包、CDN 资源、外部字体或图片。
- **单文件可用**：`chess/tools/chess-board-algorithms.html` 必须 `file://` 双击可用。
- **UMD 双导出**：`chess/core/*.js` 既支持 `module.exports`，也挂到 `window`。
- **纯逻辑核不得触碰 DOM**：`document` / `window` / `localStorage` / `location` 不得出现在 `chess/core/exercise.js` 里。
- **英文默认、中文可切**（§1.6）。所有面向用户的文案是 `{zh, en}` 对象，切换语言后必须真的重绘。
- **一切按时间推进，不按帧计数**——开发机外接显示器是 30Hz。用 `VizEngine.state.dt` 与 `Debugger.playSteps`。
- **性能预算是每帧绘制耗时 ≤4ms**（其中约 2.8 ms 是全屏 canvas 的固定成本）。当前实测 p50 3.0 / p90 3.4 / max 4.2 ms（3×7 连播 340 帧）。
- **`null` 表示「不知道」，永远不许变成数字或布尔值**——判不了就显示 `—` 与「跑不完，判不了」，不显示「错」。
- **不改 `chess/core/interp.js` / `debugger.js` / `editor.js` / `tree-model.js`。** 若发现非改不可，**停下来报告**（阶段 4 正是这样发现了 `interp.js` 的一个真缺陷——值得，但要经过裁定，不要顺手改）。
- **约束 6**：公开导出的省略参数是本项目反复出现的缺陷类（已抓到六次：`playSteps` 的 `cap`、`refresh` 的基准、`TreeModel.seek` 的游标、`__algoTick` 的 `dt`、`AlgoQueens.source` 的 `N` 没被断言钉住、三份 `algos` 的 `source(opts)`）。**本阶段新增的每一个导出，都问一遍「少传一个参数会怎样」，并让它大声失败。**
- **约束 7**：`_test.js` 的 `eq` 用 `JSON.stringify` 比较，而 `JSON.stringify(function(){})` 与 `JSON.stringify(undefined)` **都是 `undefined`**；断言「某值不存在」要写 `T.ok(typeof x === 'undefined', …)`。
- **相机按 §5.3 常规条**：`1` 正视 `{az:0, el:0, dist:14}`、`2` 桌面 45° `{az:0, el:-Math.PI/4, dist:15}`（负仰角不是笔误：`eye.y = dist·sin(el)`，rank 0 在负 y）。
- **版本落三处**：`chess/chess-tools.json` 的 `version` + `changelog`、HTML 的 `tool-version` meta、**以及脚本里的 `VERSION` 常量**——chess 引擎的角标读的是常量不是 meta，工具① 与工具④ 都栽过。工具⑤ 当前是 **1.0.1**（PR #92 修窄屏叠字时升的），本阶段升 **1.1.0**。
- **提交纪律**：`git status --short` 后**只暂存显式路径**，禁止 `git add -A` / `git commit -a`（多 session 并行，这条是事故换来的规矩）。

## §2.9 定下、本阶段必须遵守的四条

1. **`tourKnight` 进练习模式时降为「参考 vs 她」**，DFS 那份不跑、只以只读文本留在旁边当对照。练习 UI 三题同形。
2. **整份源码照旧可编辑**，挖空区只是被替换成占位行。`editor.js` 一行不改。
3. **Run 只跑，判定归 Check。**
4. **练习模式下两条轨道各自定位，不共用游标**——阶段 5 的 `syncTracks` 是「一个游标同时推两条」，练习模式必须绕开它。

边界：任一边撞 `STEP_LIMIT`（200,000）且分歧没在截断之前出现 → **不给判决**。Check 要跑两遍（queens N=8 是 15.7 万步 ×2）→ 必须进 `withBusy`。

## 对规格的两处补充（本计划新增，实现后要回写规格）

规格 §2.9 的指令示例只有 `level` 与 `hint`，落地时缺两样：

- **`id`**：`localStorage` 的键必须稳定。用行号或顺序号当键，源码改一行她的作答就丢了。所以每个挖空显式声明 `id=`，并在 `parse` 里对重复 id 大声失败。
- **`fill`**：占位行的初始内容。挖掉一段之后源码还必须能跑（她按 Run 要看得见「什么都没填时是什么样」），而通用地生成一个语法正确的占位是做不到的——`return` 里挖表达式和挖一整个函数需要的占位形状完全不同。所以由指令自己声明。

指令的最终形状：

```js
// >>> BLANK id=safe-return level=1 fill="return true;" hint="这一格会被已放置的皇后攻击吗？" hintEn="Is this square attacked by a queen already placed?"
return !cols[c] && !diagDown[r + c] && !diagUp[r - c + N];
// <<< BLANK
```

## File Structure

| 文件 | 职责 |
|---|---|
| `chess/core/exercise.js`（新建）| 纯逻辑核。`parse` / `judge` / `hintAt` 三个导出，不认识任何一道题 |
| `chess/core/exercise.test.js`（新建）| `parse` / `judge` / `hintAt` 的单元测试，含全部大声失败的路径 |
| `chess/core/exercise-blanks.test.js`（新建）| §7.4 的三项断言 × 六个挖空 = 18 条。要 `require` `exercise.js` 与三份 `algos` |
| `chess/core/algos/queens.js`（改）| 只在 `BODY` 数组里插入 BLANK 指令行 |
| `chess/core/algos/knight-path.js`（改）| 同上 |
| `chess/core/algos/tour-warnsdorff.js`（改）| 同上。`tour-dfs.js` **不动**（它是只读对照） |
| `chess/tools/chess-board-algorithms.html`（改）| `PROBLEMS` 里加 `check` 声明；练习模式 UI；`localStorage`；版本 |
| `chess/scripts/inline_core.py`（改，两行）| `SOURCES` 与 `OPTIONAL_TAGS` 各加一个 `EXERCISE`——这是核心模块内联的单一来源，`check.py` 直接 import 它，不用改 |
| `chess/chess-tools.json`（改）| `version` 1.1.0 + `changelog` |

`chess/scripts/check.py` 的 `core_tests` 门用 **`rglob`** 扫 `core/` 与 `games/` 下的全部 `*.test.js`（含子目录——阶段 4 曾因为用 `glob` 让 `core/algos/minimax.test.js` 整个落在门外，那个洞已经补上）。所以本阶段两个新测试文件会被自动收进去，**但 Task 1 仍要实测确认计数 +1**：这类「应该自动生效」的假设本项目已经错过两次。

---

## Task 1: `exercise.js` 的 `parse()`

**Files:**
- Create: `chess/core/exercise.js`
- Create: `chess/core/exercise.test.js`

**Interfaces:**
- Produces: `module.exports` / `root.Exercise` = `{ parse, judge, hintAt }`（本任务只实现 `parse`，另两个在 Task 2/3 补上；本任务先不要导出它们）
- `parse(source)` → `{ blanks: Blank[], placeholder: string }`
  - `Blank` = `{ id: string, level: 1|2|3, fill: string, hint: {zh,en}, body: string, indent: string, startLine: number, endLine: number }`
  - `startLine` / `endLine` 是**挖空体**在原源码里的 1-based 行号闭区间（不含两行指令）
  - `indent` 是挖空体第一行的前导空白，占位行要用同样的缩进
  - `placeholder` 是把每个挖空体（连同两行指令）替换成占位块之后的完整源码

- [ ] **Step 1: 写失败的测试**

Create `chess/core/exercise.test.js`：

```js
'use strict';
const T = require('./_test.js');
const E = require('./exercise.js');

/* ---------- parse：正常路径 ---------- */

const SRC = [
  'function safe(r, c) {',
  '  // >>> BLANK id=safe-return level=1 fill="return true;" hint="会被攻击吗？" hintEn="Is it attacked?"',
  '  return !cols[c] && !diagDown[r + c];',
  '  // <<< BLANK',
  '}',
].join('\n');

const p = E.parse(SRC);
T.eq(p.blanks.length, 1, 'parse 找到一个挖空');
T.eq(p.blanks[0].id, 'safe-return', 'id 解析正确');
T.eq(p.blanks[0].level, 1, 'level 是数字 1，不是字符串');
T.eq(p.blanks[0].fill, 'return true;', 'fill 解析正确');
T.eq(p.blanks[0].hint.zh, '会被攻击吗？', 'zh 提示解析正确');
T.eq(p.blanks[0].hint.en, 'Is it attacked?', 'en 提示解析正确');
T.eq(p.blanks[0].body, '  return !cols[c] && !diagDown[r + c];', '挖空体保留原缩进');
T.eq(p.blanks[0].indent, '  ', 'indent 是挖空体第一行的前导空白');
T.eq(p.blanks[0].startLine, 3, 'startLine 是挖空体的 1-based 行号');
T.eq(p.blanks[0].endLine, 3, 'endLine 同上');

/* 占位版：两行指令与挖空体一起被换掉，fill 用挖空体的缩进 */
const lines = p.placeholder.split('\n');
T.eq(lines.length, 5, '占位版行数 = 5（1 行注释 + 1 行 fill 替换掉 3 行）');
T.ok(lines[1].indexOf('会被攻击吗？') >= 0, '占位注释里带着中文提示');
T.eq(lines[2], '  return true;', 'fill 行用了挖空体的缩进');
T.ok(p.placeholder.indexOf('BLANK') === -1, '占位版里不再有 BLANK 指令');
T.ok(p.placeholder.indexOf('diagDown') === -1, '占位版里不再有参考答案');

/* 没有挖空的源码：blanks 为空，placeholder 与原文逐字节相同 */
const plain = E.parse('const a = 1;\nreturn a;');
T.eq(plain.blanks.length, 0, '没有指令时挖空清单为空');
T.eq(plain.placeholder, 'const a = 1;\nreturn a;', '没有指令时占位版就是原文');

/* 多个挖空 */
const two = E.parse([
  '// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A"',
  'x;',
  '// <<< BLANK',
  'mid;',
  '// >>> BLANK id=b level=2 fill="2;" hint="乙" hintEn="B"',
  'y;',
  'z;',
  '// <<< BLANK',
].join('\n'));
T.eq(two.blanks.length, 2, '两个挖空都找到');
T.eq(two.blanks[1].id, 'b', '第二个挖空的 id');
T.eq(two.blanks[1].body, 'y;\nz;', '多行挖空体用换行连接');
T.eq(two.blanks[1].startLine, 6, '第二个挖空体的起始行号');
T.eq(two.blanks[1].endLine, 7, '第二个挖空体的结束行号');

/* ---------- parse：每一条都必须大声失败（约束 6） ---------- */

T.throws(function () { E.parse(); }, 'parse() 少了 source —— 抛');
T.throws(function () { E.parse(123); }, 'parse(非字符串) —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK level=1 fill="1;" hint="甲" hintEn="A"\nx;\n// <<< BLANK');
}, '缺 id —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK id=a fill="1;" hint="甲" hintEn="A"\nx;\n// <<< BLANK');
}, '缺 level —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=1 hint="甲" hintEn="A"\nx;\n// <<< BLANK');
}, '缺 fill —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=1 fill="1;" hintEn="A"\nx;\n// <<< BLANK');
}, '缺 hint —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=1 fill="1;" hint="甲"\nx;\n// <<< BLANK');
}, '缺 hintEn —— 抛（英文是默认语言，缺了比缺中文更严重）');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=4 fill="1;" hint="甲" hintEn="A"\nx;\n// <<< BLANK');
}, 'level=4 越界 —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A"\nx;');
}, '有 >>> 没有 <<< —— 抛');
T.throws(function () {
  E.parse('x;\n// <<< BLANK');
}, '有 <<< 没有 >>> —— 抛');
T.throws(function () {
  E.parse([
    '// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A"',
    '// >>> BLANK id=b level=1 fill="2;" hint="乙" hintEn="B"',
    'x;',
    '// <<< BLANK',
    '// <<< BLANK',
  ].join('\n'));
}, '嵌套 —— 抛');
T.throws(function () {
  E.parse([
    '// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A"',
    'x;',
    '// <<< BLANK',
    '// >>> BLANK id=a level=1 fill="2;" hint="乙" hintEn="B"',
    'y;',
    '// <<< BLANK',
  ].join('\n'));
}, '重复 id —— 抛（localStorage 的键靠它，撞了会互相覆盖）');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A"\n// <<< BLANK');
}, '空挖空体 —— 抛');

/* judge / hintAt 本任务还没有，确认它们确实还没导出（约束 7：用 typeof） */
T.ok(typeof E.judge === 'undefined', 'judge 属于 Task 2，本任务不导出');
T.ok(typeof E.hintAt === 'undefined', 'hintAt 属于 Task 3，本任务不导出');

T.report();
```

- [ ] **Step 2: 跑测试确认它因为正确的原因失败**

```bash
node chess/core/exercise.test.js
```
预期：`Cannot find module './exercise.js'`。

- [ ] **Step 3: 实现 `parse`**

Create `chess/core/exercise.js`。照 `chess/core/algos/queens.js` 的 UMD 包装形状（`(function (root, factory) { … })(this, function () { … })`），文件头写一段「这个模块是干什么的、为什么参考答案就是源码本身」的中文注释。

实现要点：

- 指令行的识别：整行 trim 之后以 `// >>> BLANK` 开头 / 等于 `// <<< BLANK`。
- 属性解析：`id=` 与 `level=` 是**裸值**（到下一个空白为止），`fill=` / `hint=` / `hintEn=` 是**双引号包起来的**。用一个属性扫描器逐个取，不要写一条巨大的正则——阶段 5 的教训是「一条聪明的正则」在空格与边界上会静默漏掉东西（`[\w\-.,]*` 不含空格，差点让整个清单对两个脚本都不可见）。
- 每一条校验失败都 `throw new Error(...)`，消息里带上**行号**与**这一行的原文**——错的时候要能一眼定位。
- 占位块的形状（`indent` 是挖空体首行的前导空白）：

```
<indent>/* 在这里写：<hint.zh>  （第 <level> 级；Check 会跑你的版本和参考版本，比行为不比写法） */
<indent><fill>
```

  注释行用中文提示；英文提示由 UI 层在 `lang=en` 时替换渲染（占位源码只有一份，语言切换不重跑解释器——**这一点在 Task 7 里要落实**）。

- [ ] **Step 4: 跑测试确认通过**

```bash
node chess/core/exercise.test.js
```
预期：全部 passed、0 failed。

- [ ] **Step 5: 确认新测试文件真的被门收进去了**

```bash
python3 chess/scripts/check.py 2>&1 | grep -i "测试"
```
预期：`core/games 测试` 那一行的文件数从 **13** 变成 **14**（`core_tests` 用 `rglob`，新文件应当自动进门）。**如果没变**，说明扫描范围没覆盖到——**停下来报告**，不要自己改 `check.py` 的扫描逻辑（它是七道门的一部分，改它要经过裁定）。

- [ ] **Step 6: 提交**

```bash
git status --short
git add chess/core/exercise.js chess/core/exercise.test.js
git commit -m "feat(chess): exercise.js 的 parse —— 挖空指令解析与占位源码生成"
```

---

## Task 2: `judge()` 与分歧定位

**Files:**
- Modify: `chess/core/exercise.js`
- Modify: `chess/core/exercise.test.js`

**Interfaces:**
- Consumes: Task 1 的 `parse`
- Produces: `judge(refRun, herRun, check)` → `{ status, divergence }`
  - `refRun` / `herRun` 是 `Interp.run()` 的返回值（`{ result, trace }`，`trace.truncated` 挂在数组上）
  - `check` = `{ result: boolean, boardOps: boolean, counters: string[] }`。**三个键都必须显式给出**，缺一个就抛（§2.9：这一条不能有默认值，默认值会悄悄把正确答案判错）
  - `status` ∈ `'pass'` / `'fail'` / `'unknown'`
  - `divergence` = `null`（pass 或 unknown）或 `{ kind, refStep, herStep, opIndex, ref, her }`
    - `kind` ∈ `'boardOps'` / `'counters'` / `'result'`
    - `refStep` / `herStep` 是**两条轨迹各自**的 0-based 步号（§2.9 第 4 条：它们通常不相等）
    - `opIndex` 是展平后的棋盘事件序号（`kind === 'boardOps'` 时有效，否则 `null`）
    - `ref` / `her` 是那一处的两边取值，供 UI 并排显示

- [ ] **Step 1: 写失败的测试**

追加到 `chess/core/exercise.test.js`（在 `T.report()` 之前）：

```js
/* ---------- judge ---------- */

const I = require('./interp.js');
const Q = require('./algos/queens.js');

/* 参考：交付的 queens 源码本身。N=5 有 10 个解、2,621 步，够小够快。 */
const REF = I.run(Q.source({ N: 5 }), { host: {} });
const CHECK = { result: true, boardOps: true, counters: ['solutions'] };

/* 参考答案通过自己的判定 —— 拿同一份源码再跑一遍 */
const same = I.run(Q.source({ N: 5 }), { host: {} });
const vSame = E.judge(REF, same, CHECK);
T.eq(vSame.status, 'pass', '参考答案与自己比对：pass');
T.eq(vSame.divergence, null, 'pass 时没有分歧点');

/* 错误变体：把 safe 的一条线删掉（漏查一条斜线），解数一定变多 */
const WRONG = Q.source({ N: 5 }).replace(
  '!diagUp[r - c + N]', 'true');
T.ok(WRONG !== Q.source({ N: 5 }), '错误变体确实改动了源码');
const vWrong = E.judge(REF, I.run(WRONG, { host: {} }), CHECK);
T.eq(vWrong.status, 'fail', '漏查一条斜线：fail');
T.eq(vWrong.divergence.kind, 'boardOps', '第一处分歧出现在棋盘事件上');
T.ok(vWrong.divergence.refStep >= 0, '分歧点带着参考侧的步号');
T.ok(vWrong.divergence.herStep >= 0, '分歧点带着她那一侧的步号');

/* 等价改写：把 && 拆成三条 if —— 行为必须完全相同 */
const EQUIV = Q.source({ N: 5 }).replace(
  '  return !cols[c] && !diagDown[r + c] && !diagUp[r - c + N];',
  [
    '  if (cols[c]) { return false; }',
    '  if (diagDown[r + c]) { return false; }',
    '  if (diagUp[r - c + N]) { return false; }',
    '  return true;',
  ].join('\n'));
T.ok(EQUIV !== Q.source({ N: 5 }), '等价改写确实改动了源码');
const vEquiv = E.judge(REF, I.run(EQUIV, { host: {} }), CHECK);
T.eq(vEquiv.status, 'pass', '等价改写：pass —— 步数不同不算分歧');

/* 截断：任一边跑不完且分歧没在截断前出现 —— 不给判决 */
const short = I.run(Q.source({ N: 5 }), { host: {}, limit: 200 });
T.eq(short.trace.truncated, true, '限 200 步确实截断了');
const vTrunc = E.judge(REF, short, CHECK);
T.eq(vTrunc.status, 'unknown', '截断且未发现分歧：unknown，不是 fail');
T.eq(vTrunc.divergence, null, 'unknown 时没有分歧点');

/* 截断之前就已经分歧 —— 这时候可以判 */
const shortWrong = I.run(WRONG, { host: {}, limit: 2000 });
const vTruncWrong = E.judge(REF, shortWrong, CHECK);
T.eq(vTruncWrong.status, 'fail', '截断前已分歧：照样判 fail');

/* counters 单独起作用：只比解数，不比棋盘事件 */
const vCountOnly = E.judge(REF, I.run(WRONG, { host: {} }),
                           { result: false, boardOps: false, counters: ['solutions'] });
T.eq(vCountOnly.status, 'fail', '只比 counters 也能抓到漏查斜线');
T.eq(vCountOnly.divergence.kind, 'counters', '这时分歧类型是 counters');

/* check 的每一个键都必须显式给出（§2.9：不许有默认值） */
T.throws(function () { E.judge(REF, same); }, 'judge 少了 check —— 抛');
T.throws(function () { E.judge(REF, same, { result: true }); }, 'check 缺 boardOps —— 抛');
T.throws(function () { E.judge(REF, same, { result: true, boardOps: true }); }, 'check 缺 counters —— 抛');
T.throws(function () { E.judge(REF, same, { result: false, boardOps: false, counters: [] }); },
         'check 三项全关 —— 抛（这样的判定永远判对，等于没判）');
T.throws(function () { E.judge(same, undefined, CHECK); }, 'judge 少了 herRun —— 抛');
T.throws(function () { E.judge(undefined, same, CHECK); }, 'judge 少了 refRun —— 抛');
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node chess/core/exercise.test.js
```
预期：`E.judge is not a function`。

- [ ] **Step 3: 实现 `judge`**

在 `chess/core/exercise.js` 里加，并把 `judge` 加进导出对象。要点：

- **展平棋盘事件**：遍历 `trace`，把每一步的 `boardOps` 依次摊平成 `{ step, kind, sq, to }`。**只比 `kind` / `sq` / `to`，不比 `from`**——`from` 是影子盘算出来的前值，是派生量。
- **counters 取末值**：遍历 `trace` 的 `varDelta`（形状 `{ name, from, to }`），取该名字最后一次的 `to`；从没出现过就是 `null`（不是 0——`null` 表示「不知道」）。
- **判定顺序**：先 `boardOps`（它能给出步号，反馈最有用），再 `counters`，最后 `result`。
- **截断语义**：先按上面的顺序找分歧；**找到了就照常判 fail**（截断不影响已经发生的分歧）。没找到、且任一边 `trace.truncated` 为真 → `status = 'unknown'`。两边都跑完且没分歧 → `'pass'`。
- 每个缺参数 / 缺键都 `throw`，消息里说清缺的是哪一个。

- [ ] **Step 4: 跑测试确认通过**

```bash
node chess/core/exercise.test.js
```
预期：全部 passed、0 failed。

- [ ] **Step 5: 提交**

```bash
git status --short
git add chess/core/exercise.js chess/core/exercise.test.js
git commit -m "feat(chess): exercise.js 的 judge —— 比行为不比文本，定位第一处分歧"
```

---

## Task 3: `hintAt()` 分级提示

**Files:**
- Modify: `chess/core/exercise.js`
- Modify: `chess/core/exercise.test.js`

**Interfaces:**
- Consumes: Task 1 的 `Blank` 形状
- Produces: `hintAt(blank, level)` → `{ zh, en }`
  - `level` ∈ 1..4：1 = 文字提示（直接用 `blank.hint`）；2 = 点明涉及哪几个变量；3 = 结构骨架（保留控制流、挖掉表达式）；4 = 完整答案（`blank.body`）
  - 3 级与 4 级的正文是源码，中英两侧正文相同、只有前面那句说明不同

- [ ] **Step 1: 写失败的测试**

追加到 `chess/core/exercise.test.js`：

```js
/* ---------- hintAt ---------- */

const hb = E.parse([
  '// >>> BLANK id=h level=1 fill="return true;" hint="会被攻击吗？" hintEn="Is it attacked?"',
  'if (cols[c]) { return false; }',
  'return !diagDown[r + c];',
  '// <<< BLANK',
].join('\n')).blanks[0];

const h1 = E.hintAt(hb, 1);
T.ok(h1.zh.indexOf('会被攻击吗？') >= 0, '第 1 级就是文字提示（中文）');
T.ok(h1.en.indexOf('Is it attacked?') >= 0, '第 1 级就是文字提示（英文）');

const h2 = E.hintAt(hb, 2);
T.ok(h2.zh.indexOf('cols') >= 0, '第 2 级点出了 cols');
T.ok(h2.zh.indexOf('diagDown') >= 0, '第 2 级点出了 diagDown');
T.ok(h2.zh.indexOf('return') === -1, '第 2 级不列关键字，只列变量');
T.ok(h2.zh.indexOf('if') === -1, '第 2 级不列关键字（if 不是变量）');

const h3 = E.hintAt(hb, 3);
T.ok(h3.zh.indexOf('if') >= 0, '第 3 级保留了控制流关键字');
T.ok(h3.zh.indexOf('cols[c]') === -1, '第 3 级把表达式挖掉了');
T.ok(h3.zh.indexOf('…') >= 0, '第 3 级用省略号标出被挖掉的位置');

const h4 = E.hintAt(hb, 4);
T.ok(h4.zh.indexOf('!diagDown[r + c]') >= 0, '第 4 级是完整答案');
T.eq(h4.zh.indexOf('…'), -1, '第 4 级没有省略号');

T.throws(function () { E.hintAt(hb); }, 'hintAt 少了 level —— 抛');
T.throws(function () { E.hintAt(undefined, 1); }, 'hintAt 少了 blank —— 抛');
T.throws(function () { E.hintAt(hb, 0); }, 'level=0 越界 —— 抛');
T.throws(function () { E.hintAt(hb, 5); }, 'level=5 越界 —— 抛');
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node chess/core/exercise.test.js
```
预期：`E.hintAt is not a function`。

- [ ] **Step 3: 实现 `hintAt`**

要点：

- **第 2 级的变量清单**：用 `/[A-Za-z_$][A-Za-z0-9_$]*/g` 扫挖空体，减去一张 ES 关键字表（`if` / `else` / `for` / `while` / `return` / `const` / `let` / `function` / `true` / `false` / `null`），去重后保留出现顺序。
- **第 3 级的结构骨架**：机械生成，不另写一份答案（另写一份就会漂移，这与「参考答案就是源码本身」是同一条纪律）。规则：把 `if (…)` / `while (…)` / `for (…)` 括号里的内容、以及 `return` 与 `=` 右侧的内容，全部替换成 `…`，其余原样保留。
- 中英两侧的**正文相同**（都是源码），只有前面那句说明分别用中英文。

- [ ] **Step 4: 跑测试确认通过**

```bash
node chess/core/exercise.test.js
```

- [ ] **Step 5: 提交**

```bash
git status --short
git add chess/core/exercise.js chess/core/exercise.test.js
git commit -m "feat(chess): exercise.js 的 hintAt —— 四级提示，骨架机械生成不另写一份"
```

---

## Task 4: `queens` 的两个挖空 + §7.4 的六条断言

**Files:**
- Modify: `chess/core/algos/queens.js`（**只在 `BODY` 数组里插入指令行**）
- Create: `chess/core/exercise-blanks.test.js`

**Interfaces:**
- Consumes: `E.parse` / `E.judge`
- Produces: `chess/core/exercise-blanks.test.js` 的断言形状——Task 5 照抄它给另外四个挖空用

**背景**：`chess/core/algos/queens.js` 的源码是一个字符串数组 `BODY`，`source({N})` 把 `HEAD` + N 的声明 + `BODY` 拼起来。**指令行也是数组里的一个字符串元素**，例如 `'// >>> BLANK id=safe-return level=1 fill="return true;" hint="…" hintEn="…"',`。

两个挖空：

| id | 位置 | level | fill | 等价改写 | 错误变体 |
|---|---|---|---|---|---|
| `safe-return` | `safe()` 的那一行 `return` | 1 | `return true;` | 拆成三条 `if (…) return false;` 再 `return true;` | 把 `!diagUp[r - c + N]` 换成 `true`（漏查一条斜线）|
| `undo` | 回溯撤销那三行赋值 | 2 | `cols[c] = 0;` | 三条赋值换顺序 | 只还原 `cols`，不还原两条斜线 |

- [ ] **Step 1: 写失败的测试**

Create `chess/core/exercise-blanks.test.js`：

```js
'use strict';
/* §7.4：每个挖空必须过三关 ——
     ① 参考答案通过自己的判定（check 声明写错时这条就不成立）
     ② 至少一个已知错误变体被判错，且分歧步精确匹配（±0）
     ③ 至少一个「正确但写法不同」的变体被判对（专防判定过严，最容易漏写）
   第 ③ 项同时是挖空选点的筛子：写不出等价改写的位置不适合做成练习。 */
const T = require('./_test.js');
const E = require('./exercise.js');
const I = require('./interp.js');

/* 每道挖空题的 check 声明必须与工具页 PROBLEMS 里的那一份一致。
   这里重复一遍是有意的：测试不该 require 一个 html。Task 7 要在页面里
   加一条注释指回这个文件。 */
const CHECK_QUEENS = { result: true, boardOps: true, counters: ['solutions'] };

/* 三关的通用跑法。variant 是 (src) => src 的改写函数。 */
function threeGates(name, refSrc, check, wrongFn, wrongStepExpected, equivFn) {
  const ref = I.run(refSrc, { host: {} });
  T.ok(!ref.trace.truncated, name + '：参考运行未截断');

  // ① 参考答案通过自己的判定
  const self = E.judge(ref, I.run(refSrc, { host: {} }), check);
  T.eq(self.status, 'pass', name + ' ①：参考答案通过自己的判定');

  // ② 已知错误变体被判错，且分歧步精确
  const wrongSrc = wrongFn(refSrc);
  T.ok(wrongSrc !== refSrc, name + ' ②：错误变体确实改动了源码');
  const wrong = E.judge(ref, I.run(wrongSrc, { host: {} }), check);
  T.eq(wrong.status, 'fail', name + ' ②：错误变体被判错');
  T.eq(wrong.divergence.refStep, wrongStepExpected,
       name + ' ②：分歧步精确匹配（参考侧第 ' + wrongStepExpected + ' 步）');

  // ③ 等价改写被判对
  const equivSrc = equivFn(refSrc);
  T.ok(equivSrc !== refSrc, name + ' ③：等价改写确实改动了源码');
  const equiv = E.judge(ref, I.run(equivSrc, { host: {} }), check);
  T.eq(equiv.status, 'pass', name + ' ③：等价改写被判对（防判定过严）');
}

/* ---------- queens ---------- */

const Q = require('./algos/queens.js');
const qSrc = Q.source({ N: 5 });

/* 声明的挖空确实能被解析出来，且 id 与 level 是说好的那些 */
const qBlanks = E.parse(qSrc).blanks;
T.eq(qBlanks.length, 2, 'queens 声明了两个挖空');
T.eq(qBlanks[0].id, 'safe-return', 'queens 第一个挖空的 id');
T.eq(qBlanks[0].level, 1, 'queens 第一个挖空是 1 级');
T.eq(qBlanks[1].id, 'undo', 'queens 第二个挖空的 id');
T.eq(qBlanks[1].level, 2, 'queens 第二个挖空是 2 级');

/* 占位版必须仍然能跑（她按 Run 时什么都没填也不该报错） */
const qPlace = I.run(E.parse(qSrc).placeholder, { host: {} });
T.ok(!qPlace.trace.truncated, 'queens 占位版能跑完，不截断');
T.ok(qPlace.result !== undefined, 'queens 占位版有返回值（虽然答案不对）');

threeGates('queens/safe-return', qSrc, CHECK_QUEENS,
  function (s) { return s.replace('!diagUp[r - c + N]', 'true'); },
  0,   /* ← 占位：跑一次拿真实步号填进来（见 Step 3） */
  function (s) {
    return s.replace(
      '  return !cols[c] && !diagDown[r + c] && !diagUp[r - c + N];',
      [
        '  if (cols[c]) { return false; }',
        '  if (diagDown[r + c]) { return false; }',
        '  if (diagUp[r - c + N]) { return false; }',
        '  return true;',
      ].join('\n'));
  });

threeGates('queens/undo', qSrc, CHECK_QUEENS,
  function (s) {
    return s.replace('      cols[c] = 0; diagDown[r + c] = 0; diagUp[r - c + N] = 0;',
                     '      cols[c] = 0;');
  },
  0,   /* ← 占位：同上 */
  function (s) {
    return s.replace('      cols[c] = 0; diagDown[r + c] = 0; diagUp[r - c + N] = 0;',
                     '      diagUp[r - c + N] = 0; diagDown[r + c] = 0; cols[c] = 0;');
  });

T.report();
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node chess/core/exercise-blanks.test.js
```
预期：`queens 声明了两个挖空` 那条红（现在是 0 个）。

- [ ] **Step 3: 往 `queens.js` 插入两组指令行，并填上真实的分歧步号**

先插指令行（`BODY` 数组里，指令是数组元素、不是被挖代码的一部分），再跑一段一次性脚本把两个错误变体的真实 `refStep` 量出来：

```bash
node -e "
const E=require('./chess/core/exercise.js'), I=require('./chess/core/interp.js'), Q=require('./chess/core/algos/queens.js');
const s=Q.source({N:5}), ref=I.run(s,{host:{}});
const C={result:true,boardOps:true,counters:['solutions']};
const w1=s.replace('!diagUp[r - c + N]','true');
const w2=s.replace('      cols[c] = 0; diagDown[r + c] = 0; diagUp[r - c + N] = 0;','      cols[c] = 0;');
console.log('safe-return refStep =', E.judge(ref,I.run(w1,{host:{}}),C).divergence.refStep);
console.log('undo        refStep =', E.judge(ref,I.run(w2,{host:{}}),C).divergence.refStep);
"
```

把打印出来的两个数字填回测试里那两处占位的 `0`。**这两个数字是实测值，不是推导值**——§7.4 要求分歧步 ±0 精确匹配，正是为了让「判定悄悄变松」无处可藏。

插入指令后必须确认**步数没变**（注释不产生步）：

```bash
node -e "
const I=require('./chess/core/interp.js'), Q=require('./chess/core/algos/queens.js');
for (const N of [4,5,6,7,8]) {
  const r=I.run(Q.source({N:N}),{host:{}});
  console.log('N='+N, r.trace.length, 'solutions='+r.result);
}
"
```
预期与规格 §4⑤ 的表逐格一致：**770 / 2,621 / 9,500 / 37,049 / 156,772**，解数 **2 / 10 / 4 / 40 / 92**。**若有任何一格不同，停下来报告**——那说明指令行改变了被执行的源码，整个「参考答案就是源码本身」的前提就出问题了。

- [ ] **Step 4: 跑测试确认通过**

```bash
node chess/core/exercise-blanks.test.js
node chess/core/algos/queens.test.js
```
预期：两个都全绿。

- [ ] **Step 5: 重新内联并跑全量门**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;   echo "gate exit=$?"
```
预期：exit 0，七道门都跑到底。

- [ ] **Step 6: 提交**

```bash
git status --short
git add chess/core/algos/queens.js chess/core/exercise-blanks.test.js chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): queens 的两个挖空 + §7.4 的六条断言"
```

（`chess-board-algorithms.html` 出现在这里是因为 `inline_core.py` 会重新生成它的内联区间——**只暂存它，不要手改它**。）

---

## Task 5: `knightPath` 与 `tourKnight` 的四个挖空 + 十二条断言

**Files:**
- Modify: `chess/core/algos/knight-path.js`
- Modify: `chess/core/algos/tour-warnsdorff.js`（`tour-dfs.js` **不动**）
- Modify: `chess/core/exercise-blanks.test.js`

**Interfaces:**
- Consumes: Task 4 建立的 `threeGates(name, refSrc, check, wrongFn, wrongStepExpected, equivFn)`

四个挖空：

| 题 | id | 位置 | level | fill | 等价改写 | 错误变体 |
|---|---|---|---|---|---|---|
| `knightPath` | `seen-test` | `if (dist[nb] >= 0)` | 1 | `if (false) {` | `if (dist[nb] !== -1) {` | `if (dist[nb] > 0) {`（漏掉出发格）|
| `knightPath` | `on-board` | `onBoard()` 的 `return` | 1 | `return true;` | `return !(x < 0 \|\| x >= W \|\| y < 0 \|\| y >= W);` | 漏掉 `y < W` 那一项 |
| `tourKnight` | `degree-count` | `degree()` 里的 `if (!visited[…]) { d = d + 1; }` | 1 | `d = d + 0;` | 先全数再减去已访问的 | 把 `!visited` 写成 `visited` |
| `tourKnight` | `degree-fn` | 整个 `degree()` 函数 | 3 | 返回常数 0 的同签名函数 | 循环写法自由（例如倒着数）| 返回 `8 - d` |

`check` 声明：

- `knightPath`：`{ result: true, boardOps: true, counters: [] }`（没有需要单独盯的计数器，返回值就是距离）
- `tourKnight`：`{ result: true, boardOps: true, counters: [] }`

**`degree-fn` 的等价改写要当心**：`degree()` 的返回值参与排序，而排序在并列时的打破方式会改变巡游路线。等价改写必须**只改数出路的写法、不改数出来的值**（例如倒着遍历八个方向再数），不能改成任何会改变并列顺序的东西。这正是规格里「Warnsdorff 那段排序故意不挖」的同一个坑——它在这里以更小的形式再出现一次。

- [ ] **Step 1: 写失败的测试**

追加到 `chess/core/exercise-blanks.test.js`（`T.report()` 之前）。照 Task 4 的形状，每个挖空一组 `threeGates`，外加每题一组「挖空清单对得上」与「占位版能跑」的断言：

```js
/* ---------- knightPath ---------- */

const KP = require('./algos/knight-path.js');
const CHECK_KP = { result: true, boardOps: true, counters: [] };
const kpSrc = KP.source({ W: 6, start: 0, target: 35 });

const kpBlanks = E.parse(kpSrc).blanks;
T.eq(kpBlanks.length, 2, 'knightPath 声明了两个挖空');
T.eq(kpBlanks[0].id, 'on-board', 'knightPath 第一个挖空的 id（按出现顺序）');
T.eq(kpBlanks[1].id, 'seen-test', 'knightPath 第二个挖空的 id');

const kpPlace = I.run(E.parse(kpSrc).placeholder, { host: {} });
T.ok(!kpPlace.trace.truncated, 'knightPath 占位版能跑完');

/* ---------- tourKnight（Warnsdorff 那一份） ---------- */

const TW = require('./algos/tour-warnsdorff.js');
const CHECK_TOUR = { result: true, boardOps: true, counters: [] };
const twSrc = TW.source({ W: 3, H: 4, start: 0 });

const twBlanks = E.parse(twSrc).blanks;
T.eq(twBlanks.length, 2, 'tour-warnsdorff 声明了两个挖空');

/* tour-dfs 是只读对照，一个挖空都不许有（§2.9 阶段 6 第 1 条） */
const TD = require('./algos/tour-dfs.js');
T.eq(E.parse(TD.source({ W: 3, H: 4, start: 0 })).blanks.length, 0,
     'tour-dfs 没有挖空 —— 它是只读对照');
```

然后是四组 `threeGates`，分歧步先填 `0`。

- [ ] **Step 2: 跑测试确认失败**

```bash
node chess/core/exercise-blanks.test.js
```

- [ ] **Step 3: 插入指令行并填上真实分歧步号**

照 Task 4 Step 3 的一次性脚本形状，把四个错误变体的 `refStep` 量出来填回去。

插入后确认**四块盘与 knightPath 的步数一格不变**：

```bash
node -e "
const I=require('./chess/core/interp.js');
const D=require('./chess/core/algos/tour-dfs.js'), W2=require('./chess/core/algos/tour-warnsdorff.js'), KP=require('./chess/core/algos/knight-path.js');
for (const [W,H] of [[3,4],[3,5],[4,5],[3,7]]) {
  const d=I.run(D.source({W:W,H:H,start:0}),{host:{}}), w=I.run(W2.source({W:W,H:H,start:0}),{host:{}});
  console.log(W+'x'+H, d.trace.length, d.trace.truncated?'TRUNC':d.result, '|', w.trace.length, w.trace.truncated?'TRUNC':w.result);
}
for (const [W,s,t] of [[8,0,63],[8,0,27]]) {
  const r=I.run(KP.source({W:W,start:s,target:t}),{host:{}});
  console.log('kp '+W+' '+s+'->'+t, r.trace.length, r.result);
}
"
```
预期（规格 §4⑤）：3×4 → 898 / 3,092；3×5 → 34,988 / 120,650；4×5 → TRUNC(200000) / 7,283；3×7 → 两边 TRUNC；`knightPath` → 5,086 距离 6、347 距离 2。**任何一格不同就停下来报告。**

- [ ] **Step 4: 跑测试确认通过**

```bash
node chess/core/exercise-blanks.test.js
node chess/core/algos/tour.test.js
node chess/core/algos/knight-path.test.js
```

- [ ] **Step 5: 重新内联并跑全量门**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;   echo "gate exit=$?"
```

- [ ] **Step 6: 提交**

```bash
git status --short
git add chess/core/algos/knight-path.js chess/core/algos/tour-warnsdorff.js chess/core/exercise-blanks.test.js chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): knightPath 与 tourKnight 的四个挖空 + 十二条断言"
```

---

## Task 6: 工具页的练习模式骨架

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**Interfaces:**
- Consumes: `Exercise.parse`（页面通过 `GENERATED:CORE` 内联区间拿到——**要在标记行里加 `exercise.js`**，与阶段 5 Task 1 给 `ALGOS` 做的是同一套机制；具体标记名用 Grep 在文件里确认，不要照本文猜）
- Produces: 页面级状态 `exerciseOn`（布尔）与 `blanksOf(pid)`；Task 7/8 在它上面加 Check 与提示

**这一任务不做判定、不做提示、不做持久化**，只做到「能进能出、占位源码能跑」。

- [ ] **Step 1: 把 `exercise.js` 接进页面的内联机制**

核心模块走的是 `chess/scripts/inline_core.py` 顶部的 `SOURCES` 表（标记 `/* >>> GENERATED:<TAG> */ … /* <<< GENERATED:<TAG> */`），与 `ALGOS` 那套「按页列清单」是**两套不同的机制**：`ALGOS` 内联的是**字符串字面量**（源码要被显示和解释执行），核心模块内联的是**代码**。`exercise.js` 是代码，走前者。

三处改动：

1. `chess/scripts/inline_core.py` 的 `SOURCES` 加一行 `'EXERCISE': ROOT / 'core' / 'exercise.js',`
2. 同文件的 `OPTIONAL_TAGS` 集合加 `'EXERCISE'`（只有工具⑤ 有这块，别的页缺它是正常的，不该 WARN）
3. 工具页里加一对空标记：`/* >>> GENERATED:EXERCISE */` / `/* <<< GENERATED:EXERCISE */`，放在 `GENERATED:EDITOR` 之后、`GENERATED:ALGOS` 之前

`chess/scripts/check.py` **不用改**——它 `import inline_core`，标记表是单一来源。

然后：

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;   echo "gate exit=$?"
```
**七道门必须全部跑到底、exit 0。** 注意阶段 5 Task 4 踩过的坑：**一对中间什么都没有的标记，两个分支都不匹配**，页面会带着一个 undefined 的模块发布而门报成功——那一轮为此加了第七道门 `algos_marker_shape_check()`。所以这一步先加空标记、跑一次生成、再确认标记之间**真的填进了内容**（`grep -c "Exercise" chess/tools/chess-board-algorithms.html` 应当远大于 0）。

- [ ] **Step 2: 在 `PROBLEMS` 的每个键上加 `check` 声明**

三个键各加一行，值与 `chess/core/exercise-blanks.test.js` 里的那份**逐字一致**，并在旁边写一条注释指向那个文件（两份必须一起改）：

```js
check: { result: true, boardOps: true, counters: ['solutions'] },   // 与 exercise-blanks.test.js 的 CHECK_QUEENS 一致
```

`validateDecl()`（阶段 5 Task 5 加的启动期声明校验）要**同时校验 `check`**：三个键必须齐全、`counters` 必须是数组、三项不许全关。缺了或写错 → 整页停住（这是既有机制，照它现有的形状加，不要另造一套）。

- [ ] **Step 3: 练习模式开关**

在参数面板加一个开关（照既有 `TOGGLES` 的形状），文案 `{zh: '练习模式', en: 'Exercise mode'}`。打开时：

- 每条轨道的源码换成 `Exercise.parse(src).placeholder`，重新 `runTrack`（**放进 `withBusy`**）
- `tourKnight` 降为「参考 vs 她」：轨道 0 = 参考 Warnsdorff（跑）、轨道 1 = 她的 Warnsdorff（跑）；**`tour-dfs.js` 那份不跑**，以只读文本留在旁边当对照（§2.9 阶段 6 第 1 条）
- 关闭时恢复原样

**语言切换不许重跑解释器**：占位注释里的中文提示在 `lang=en` 时由 UI 层替换渲染。若发现做不到（例如提示文字是解释器输入的一部分），**停下来报告**，不要顺手把重跑加进语言切换——那会让切一次语言等 400 ms。

- [ ] **Step 4: 浏览器验收（本任务只验三条）**

预览：`mcp__Claude_Browser__preview_start {name: "mathviz"}`（8777；端口可能被别的 session 占着，那就 `{url: "http://localhost:8777/..."}` 复用）。**每次调用带显式 `tabId`。** 面板 rAF 只有被 fronted 时才走；验状态读 `window.__algoProbe()`，**第一条永远先断言 `tool === 'chess-board-algorithms'`**。`claude-in-chrome` 在这台机器上连不上本地 http、且会给 `file://` 强拼 `https://`——不要用它。需要写截图文件时用 headless Chrome + CDP（node 自带 WebSocket、零依赖）。

1. 三题各开一次练习模式：编辑器里出现占位行、按 Run 能跑完不报错
2. `tourKnight` 练习模式下左边是只读的 `tour-dfs`、右边是可编辑的 Warnsdorff
3. 关掉练习模式回到原样，读数与阶段 5 一致

- [ ] **Step 5: 提交**

```bash
git status --short
git add chess/scripts/inline_core.py chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): 工具⑤ 练习模式骨架 —— 占位源码进编辑器，tourKnight 降为参考对照"
```

---

## Task 7: Check、判定与分歧定位

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**Interfaces:**
- Consumes: `Exercise.judge`、Task 6 的 `exerciseOn`
- Produces: 探针字段 `exercise`（供 Task 9 的浏览器验收断言）

- [ ] **Step 1: Check 按钮与判定**

练习模式下在 Run 旁边出现 Check。按下时（**全程在 `withBusy` 里**）：

1. 跑参考版本（原始 `algos` 源码，不是编辑器内容）
2. 跑她的版本（编辑器内容）
3. `Exercise.judge(ref, her, PROBLEMS[pid].check)`

三种结果三种呈现：

- `pass` → 绿色「对了」+ 一句说明这道挖空教的是什么
- `fail` → 红色 + 「跑到第 N 步为止你和参考完全一致，第 N+1 步……」+ 两边取值并排
- `unknown` → **不是红色**：「跑不完，判不了」——任一边撞 200,000 上限且分歧没在截断前出现。**绝不显示为「错」**

- [ ] **Step 2: 分歧定位——两条轨道各自 goto**

这是 §2.9 阶段 6 第 4 条，也是本任务最容易写错的地方：`divergence.refStep` 与 `divergence.herStep` **通常不相等**。把参考那条轨道 `goto(refStep)`、她那条 `goto(herStep)`，**绕开 `syncTracks`**（阶段 5 的双轨是一个游标推两条）。

写完自己验一遍：造一个已知分歧的错误答案，读探针确认 `tracks[0].i !== tracks[1].i` 且两个数字分别等于 `judge` 报的两个步号。**如果它们相等，说明 `syncTracks` 又把它们拉齐了——那是这条最典型的失败形态。**

- [ ] **Step 3: 探针**

`window.__algoProbe()` 增加一个 `exercise` 字段：`{ on, blankId, status, refStep, herStep }`；没进练习模式时是 `null`（不是 `{}`，也不是 `false`）。**第一个字段仍然是 `tool`。**

- [ ] **Step 4: 浏览器验收**

1. queens 练习模式：什么都不改直接 Check → `pass`（占位 `fill` 恰好是错的，所以这一条应当是 `fail`；**以实际为准，把实际结果写进报告**，不要硬套预期）
2. 填对 → `pass`；填一个已知错误 → `fail` 且两条轨道停在**不同**的步号上（读探针，贴出两个数字）
3. N=8 时 Check：观察是否卡帧（两次 15.7 万步）。若卡，说明没有真正进 `withBusy`
4. 截断路径：把 N 调到 8 并写一个会跑爆的答案 → 读数显示「跑不完，判不了」，不是「错」

- [ ] **Step 5: 提交**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): 工具⑤ Check 与分歧定位 —— 两条轨道各自停在自己的那一步"
```

---

## Task 8: 分级提示与 `localStorage`

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**Interfaces:**
- Consumes: `Exercise.hintAt`

- [ ] **Step 1: 提示阶梯**

一个「提示」按钮，每按一次进一级（1→4），当前级别显示在旁边。第 4 级是完整答案，**且第 4 级要有一个「填进去」按钮**——§2.9：任何时候都可以直接看答案并继续，卡住而无法前进只会让她关掉页面。

- [ ] **Step 2: `localStorage`**

键 `chess.exercise.v1.<problem>.<blank>`，值 `{ text, attempts, hintLevel, solvedAt }`。

- 只在练习模式下写，正常模式一个字节都不碰
- 读不出来 / JSON 坏了 → 当作没有，**不要抛**（这是唯一一处「静默降级」是对的地方：她的浏览器存储坏了不该让整个工具打不开）。但要在控制台留一条 `console.warn`
- `localStorage` 不可用（隐私模式）→ 同样降级，功能照常，只是不记

**`localStorage` 只能出现在明确标注的 DOM 层函数体内**（全局约束）——`chess/core/exercise.js` 里一次都不许出现。

- [ ] **Step 3: 浏览器验收**

1. 填一半 → 刷新页面 → 内容还在，`attempts` 累加
2. 用到第 3 级提示 → 刷新 → 提示级别还在第 3 级
3. 关掉练习模式再打开 → 不丢
4. 在控制台里把那个键的值改成 `{` → 刷新 → 页面照常打开，控制台有一条 warn

- [ ] **Step 4: 提交**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): 工具⑤ 四级提示与 localStorage —— 随时可以看答案并继续"
```

---

## Task 9: 版本、全量门与浏览器验收

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`（版本两处 + changelog）
- Modify: `chess/chess-tools.json`（`version` + `changelog`）

- [ ] **Step 1: 版本落三处**

工具⑤ 从 **1.0.1** 升到 **1.1.0**（加了功能，不是修 bug）：`chess-tools.json` 的 `version` 与 `changelog`、HTML 的 `tool-version` meta、**以及脚本里的 `VERSION` 常量**。角标读的是常量——改完在浏览器里确认角标显示 `v1.1.0`。

注册三处的条目本身不变（`id` / `file` / `accent` / `phase` 都不动），但**要核对三处仍然逐字段一致**。

- [ ] **Step 2: 全量门**

```bash
node chess/core/exercise.test.js
node chess/core/exercise-blanks.test.js
node chess/core/algos/queens.test.js
node chess/core/algos/tour.test.js
node chess/core/algos/knight-path.test.js
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py;            echo "chess gate exit=$?"
python3 scripts/sync_registry.py --check;  echo "main registry exit=$?"
git status --short
```
`check.py` 必须 exit 0 且**七道门都跑到底**。

- [ ] **Step 3: 浏览器验收（截图存档）**

截图存进 `.superpowers/sdd/2026-08-04-chess-phase6-exercise/task-9-screenshots/` 并在报告里列出文件名——**用户看截图是本阶段的正式验收环节**。阶段 0–2 的三次截图各抓出一个多轮代码审核漏掉的问题，阶段 4 当场抓到五个，阶段 5 的「并排两块盘在侧视里重合」与「z 轴说明被面板压住」都是看图抓到的、代码审读抓不到。

逐条确认：

1. 三题各开练习模式，占位行显示正确、Run 能跑
2. 六个挖空各填一次正确答案 → 全部 `pass`
3. 每题各填一次已知错误 → `fail`，且两条轨道**停在不同步号**（贴探针读数）
4. 截断路径 → 「跑不完，判不了」，不是「错」
5. 四级提示逐级展开；第 4 级能一键填入
6. 刷新后作答与提示级别都还在
7. `tourKnight` 练习模式：左只读 DFS、右可编辑 Warnsdorff
8. 语言切换 EN⇄ZH，**默认 EN**；提示、判定结果、占位注释**全部**跟着切
9. 关掉练习模式 → 阶段 5 的行为一字不差地回来（四档盘、并排两块盘、一个游标推两条）
10. 帧时：queens N=8 练习模式下连播，每帧绘制耗时 ≤4ms（口径是**帧回调时长**：`performance.now()` 包住 rAF 回调，量的是 JS 工作量，不含浏览器后续的 paint/composite）
11. 角标显示 `v1.1.0`
12. 窄窗口（<900px）下练习模式的新控件不叠字（PR #92 刚修过一轮同类问题）

- [ ] **Step 4: 提交**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html chess/chess-tools.json
git commit -m "feat(chess): 工具⑤ 1.1.0 —— 挖空练习定版"
```

---

## 阶段 6 完成标准

- [ ] `exercise.test.js` / `exercise-blanks.test.js` / 三个 `algos/*.test.js` 全绿；`check.py` exit 0 七道门；`sync_registry --check` exit 0
- [ ] 六个挖空各过 §7.4 三关，**十八条断言**，其中六条分歧步是 ±0 精确匹配的实测值
- [ ] **插入指令行没有改变任何一格步数**（queens 五档、tourKnight 四块盘、knightPath 两组，与规格 §4⑤ 逐格一致）
- [ ] 判错时两条轨道**各自**停在自己的那一步（探针里两个步号不相等）
- [ ] 截断时显示「跑不完，判不了」，不是「错」
- [ ] `tour-dfs.js` 一个挖空都没有（它是只读对照）
- [ ] `editor.js` / `interp.js` / `debugger.js` / `tree-model.js` 一行未改
- [ ] 刷新后作答与提示级别都在；`localStorage` 坏了页面照常打开
- [ ] 版本落三处（含 `VERSION` 常量），角标显示 `v1.1.0`
- [ ] 默认 EN；关掉练习模式后阶段 5 的行为一字不差

**下一阶段**：阶段 7 —— `rookCover`（二分图匹配 + König 定理）与 `kingDominate`（贪心 vs 精确）。

### 本阶段明确**不做**的事

- **不挖 Warnsdorff 那段手写选择排序。** 换成插入排序是货真价实的「正确但写法不同」，但两者在候选出路数并列时的打破方式不一样，会走出另一条同样合法的巡游、`boardOps` 全不一样而被判错——正是 §7.4「判定过严」的教科书案例。留到实际用过一轮之后再定（§8 本来就说这一阶段的产出质量要在使用之后复盘）。
- **不做计分、评级、进度条、成就**（§9）。存下的尝试次数只为将来做「哪些概念反复卡住」的回顾视图。
- **不做 Export .js**（§2.8 的另一半，与本阶段无依赖关系）。
- **不改 `chess/scripts/check.py` 的扫描逻辑。** 若新测试文件没被自动收进门，停下来报告。
