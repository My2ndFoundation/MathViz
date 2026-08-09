# 阶段 9c：`pathCount`（动态规划）+ 付「每格带标量」那笔账 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给工具⑤ 加第六道题 `pathCount`（车每步只走一格、只往右或往上，数从 a1 到 h8 有多少条路；盘上有墙），并借它付清「每格带一个标量」那笔账 —— 把 `mark(sq, kind)` 的 `kind` 从 `string` 放宽成 `string | number`。

**Architecture:** 标量走**既有的 `kind` 槽位**，不加新钩子 —— 规格 §4⑤ 已量过：`interp.js` 原样塞进 boardOp、`debugger.js` 原样读回、撤销拿 `from` 旧值回退，**页面层以下零改动**。第三根轴也是免费的：入口写成 `fillLayer(d)` 按反对角线层递归，调用深度 = `r + c` = 层号，与 `knightPath` 的 `expand(frontier, d)` 逐字同构。真正要新写的只有两样：**页面层怎么把一个数字画到格子上**，以及**一道防「静默不画」的门**。

**Tech Stack:** 零依赖 ES 子集 JavaScript（`node` 直跑 + 浏览器内联）；Python 3 的 `chess/scripts/check.py`（九道门）与 `chess/scripts/inline_core.py`；无构建、无包管理器。

## Global Constraints

**每次派发子代理都必须带上这一句：**

> 如果计划里某段代码是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。

- **规格**是 `docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md`，本阶段相关的是 **§4⑤**（含「9c 开工前定下的（2026-08-09）」六条与「四道题的裁定」）、**§2.4**（`board-render` 接口）、**§2.9**（挖空，本阶段**不做**）、**§5.3**（相机与侧视）、**§7**（验收门）。
- **本阶段的基线 commit 是 `e21b2b8`**，分支 `claude/chess-phase9c`。
- **格子编号 `sq = r * N + c`**，`r` 是行（`r=0` 是棋盘**最下面**一行）、`c` 是列（`c=0` 最左）。于是 0 号格 = a1。这与 `BoardRender.layout()` 的 `squareCenter(file, rank)`、`chess-core.js` 的 `SQ(file, rank)` 同向 —— **别在中间翻上下**。
- **生成出来的教学源码，读者是一个没学过棋、正在学算法的十六岁学生。** 本仓维护者注释是另一套口吻，两者不要混。
- **`render(parts, lang)` 那一整段在所有 algos 里逐字节相同**，`check.py` 的 `bilingual_algos_check()` 逐字节核对。新文件必须**原样抄**，一个字节都不许改。
- **两种语言的行数必须逐段相等**（规格 §1.6）。行数一差，切一次语言 `Step.line` / `pristine` / `answerRange` / `judge.herSrc` 同时指错地方。
- **`source(opts)` 的 `lang` 必填、无默认值**；缺了当场抛。
- ES 子集（约束**生成出来的**教学源码，不约束 `path-count.js` 自身）：**没有模板字面量、没有正则字面量、没有 `for…in`、没有 `try/catch`**，字符串用 `+` 拼。可用：`let`/`const`、数组与索引、对象字面量与属性、`if/else`、`for`、`for…of`、`while`、函数与递归、箭头函数。
- **宿主桥接只有五个**：`mark(sq, kind)` / `place(sq, piece)` / `clear(sq)` / `log(msg)` / `attacked(sq)`。**不许加第六个。**
- **`git status --short` 之后只暂存显式路径**；禁止 `git add -A` / `git commit -a`。
- ⚠ **不要在 commit 之前手工跑 `inline_core.py`**：`.githooks/pre-commit` 跑的是 `--print-changed`，**只在它自己真的改了文件时才补暂存**；你先跑过它就判「无变化」，内联镜像会悬空没进 commit。要么让钩子自己来，要么在 `git add` 里显式列上那些 HTML。（阶段 9b 踩过两次。）
- ⚠ **突变实验前把文件拷进 scratchpad，文件名带任务前缀**，**备份拷在突变的前一刻**。**绝不要用 `git checkout --` 还原**，用 `cp`。
- ⚠ **只看 `check.py` 的退出码会误判** —— 要在输出里找到你想验的**那道门自己那一行**。⚠ **实现者在跑的时候不要跑门**：工作树不是静止的，那一刻的读数不作数。
- 单测 = `node chess/core/algos/xxx.test.js`；总门 = `python3 chess/scripts/check.py`。本仓无构建/lint/包管理器。
- ⚠ **本地绿 ≠ CI 绿**。开 PR 后 `gh pr checks <PR#>`。

## 这道题的四档盘面（数字是**实测**的，不是估的）

| 档 | 盘面 | 墙 | 答案 |
|---|---|---|---|
| 0 | 4×4 空盘 | 无 | **20**（= C(6,3)，小到能手数） |
| 1 | 8×8 空盘 | 无 | **3432**（= C(14,7)，规格点名的那个数） |
| 2 | 8×8 | c4 / d5 / e6（`sq` = 26 / 35 / 44） | **1287** |
| 3 | 8×8 | 整条反对角线 `r+c=7`：h1 g2 f3 e4 d5 c6 b7 a8（`sq` = 7 14 21 28 35 42 49 56） | **0** |

档 1→2 是这四档里最有分量的一课：**三堵墙把 3432 砍成 1287，六成没了**。档 3 是另一课：**0 是一个真实的答案，不是「没算出来」**。

---

## 文件结构

| 文件 | 责任 | 本阶段动作 |
|---|---|---|
| `chess/core/algos/path-count.js` | 第六道题的**算法源码生成器**（吐字符串，不算路径） | **新建**（双语） |
| `chess/core/algos/path-count.test.js` | 它的测试（宿主侧 DP 对拍 + 三道双语门） | **新建** |
| `chess/tools/chess-board-algorithms.html` | 工具⑤ | 声明 `PROBLEMS.pathCount`、`GENERATED:ALGOS` 标记行加名字、`onMark` 数字分支、写数字的渲染、`kinds` 契约措辞、把「认不出的 mark 种类」从静默改成响、定版 1.4.0 |
| `chess/chess-tools.json` | 工具注册表 | 工具⑤ 1.3.0 → 1.4.0 + changelog |

**只有 `path-count.js` 与 `path-count.test.js` 是新建的。** 规格 §4⑤ 的可扩展性要求是「新增一道题 = 加一个键 + 一个 `algos/*.js` + 在 `GENERATED:ALGOS` 标记行上加一个名字」—— 本阶段**额外**动的两处（写数字的渲染、静默改成响）都是**付那笔账**，不是这道题自己的开销。**这个区分要在报告里讲清楚**：如果除此之外还动了别的地方，那就是架构没做到，要回头改架构而不是接受（规格原话）。

---

## 并行编排

| 轮 | 并行 | 依据 |
|---|---|---|
| 1 | **Task 1 单独** | 生成器与测试是后面所有任务的输入 |
| 2 | **Task 2 单独** | 它改的是**六道题共用**的 mark 分发路径，不能和别的任务并行 |
| 3 | **Task 3 → 4 → 5 串行** | 三个都改 `chess-board-algorithms.html`，并行只会制造冲突 |
| 4 | **Task 6 单独** | 浏览器验收，要前面全部落地 |
| 5 | **Task 7 ∥ Task 8** | Task 7 只加测试（探针），Task 8 动 `chess-tools.json` + HTML 的版本号两处 —— 文件不相交 |

---

## Task 1：`path-count.js` 双语生成器 + 它的测试

**Files:**
- Create: `chess/core/algos/path-count.js`
- Create: `chess/core/algos/path-count.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `require('./path-count.js').source({ N, blocked, lang })` → 一段源码字符串。`N` 与 `lang` 必填、`blocked` 可选（省略 = 空数组）。入口函数名 **`fillLayer`**，顶层 `fillLayer(0); return ways[N * N - 1];`

- [ ] **Step 1: 先抄那段逐字节相同的双语渲染助手**

```bash
sed -n '/^  \/\* ================= 双语渲染/,/^  }$/p' chess/core/algos/queens.js > /tmp/render-block.txt
wc -l /tmp/render-block.txt
```

把这一整段（注释 + `function render(parts, lang) { … }`）**逐字节**抄进新文件。**一个字节都不许改** —— `check.py` 的 `bilingual_algos_check()` 会拿它跟另外八份逐字节比。

- [ ] **Step 2: 写会失败的测试**

新建 `chess/core/algos/path-count.test.js`：

```js
'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const P = require('./path-count.js');

/* 宿主侧的独立参照 DP —— 不是写死期望值，是另写一份实现来对拍。
   规格 §7.3 的判据是「跟另一份实现一致」，写死的期望值只能覆盖
   测试作者想到的输入。 */
function hostCount(N, blocked) {
  const B = {};
  for (let i = 0; i < blocked.length; i++) B[blocked[i]] = true;
  const dp = [];
  for (let r = 0; r < N; r++) { dp.push(new Array(N).fill(0)); }
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (B[r * N + c]) { dp[r][c] = 0; continue; }
      if (r === 0 && c === 0) { dp[r][c] = 1; continue; }
      dp[r][c] = (r > 0 ? dp[r - 1][c] : 0) + (c > 0 ? dp[r][c - 1] : 0);
    }
  }
  return dp[N - 1][N - 1];
}

/* 四档盘面 + 两组额外形状。四档的答案在计划里是实测写死的，这里**不**写死 ——
   拿 hostCount 对拍，两边都错成同一个数的可能性远低于我把某个数抄错。 */
const CASES = [
  { N: 4, blocked: [], tag: '档0 4×4 空盘' },
  { N: 8, blocked: [], tag: '档1 8×8 空盘' },
  { N: 8, blocked: [26, 35, 44], tag: '档2 8×8 三堵墙' },
  { N: 8, blocked: [7, 14, 21, 28, 35, 42, 49, 56], tag: '档3 8×8 整条反对角线' },
  { N: 1, blocked: [], tag: '1×1（起点就是终点）' },
  { N: 5, blocked: [0], tag: '起点自己被堵上' },
];
let n = 0;
for (const cs of CASES) {
  const r = I.run(P.source({ N: cs.N, blocked: cs.blocked, lang: 'zh' }), { host: {} });
  T.ok(!r.trace.truncated, cs.tag + ' —— 没撞步数上限');
  T.eq(r.result, hostCount(cs.N, cs.blocked), cs.tag + ' —— 与宿主侧 DP 一致');
  n++;
}
T.eq(n, 6, '六组都对拍过');

/* 计划里那四个数是实测写死的。这四条**不是**上面那组的重复：上面比的是
   「两份实现一致」，这四条钉的是「那个一致的数就是计划里写的数」——
   两份实现同时错成同一个数，只有这四条拦得住。 */
T.eq(hostCount(4, []), 20, '档0 = 20');
T.eq(hostCount(8, []), 3432, '档1 = 3432（C(14,7)）');
T.eq(hostCount(8, [26, 35, 44]), 1287, '档2 = 1287');
T.eq(hostCount(8, [7, 14, 21, 28, 35, 42, 49, 56]), 0, '档3 = 0（整条反对角线堵死）');

/* ---- mark 通道：这道题发的是**数字**，不是四种状态之一 ---- */
const marks = [];
I.run(P.source({ N: 4, blocked: [], lang: 'zh' }), { host: {
  mark: function (sq, kind) { marks.push([sq, kind]); },
} });
T.ok(marks.length >= 16, '每一格都被标过（' + marks.length + ' 次）');
const nums = marks.filter(function (m) { return typeof m[1] === 'number'; });
T.ok(nums.length >= 16, '标出来的值里有数字 —— 这就是「每格带一个标量」那笔账');
T.ok(marks.filter(function (m) { return m[1] === 'try'; }).length > 0,
     '也发了 try（正在算这一格），数字与状态两种 kind 并存');

/* ---- 三道双语门（规格 §7.5）---- */
const zh = P.source({ N: 8, blocked: [26, 35, 44], lang: 'zh' });
const en = P.source({ N: 8, blocked: [26, 35, 44], lang: 'en' });
T.ok(zh !== en, '两种语言真的不一样');
T.eq(zh.split('\n').length, en.split('\n').length, '① 行数同一（规格 §1.6 的逐行对齐）');
T.eq(I.run(zh, { host: {} }).trace.length, I.run(en, { host: {} }).trace.length,
     '② 步数同一（注释不产生步）');
T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(en.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
     '③ 英文变体抽掉注释后没有汉字');

/* lang 必填 —— 默认成任何一种都是让同一个缺陷换个地方复活 */
T.throws(function () { P.source({ N: 4 }); }, 'lang 缺席当场抛',
         'source({ lang }) 少了 lang');
T.throws(function () { P.source({ N: 4, lang: 'fr' }); }, 'lang 只认 zh/en',
         'source({ lang }) 的 lang 只认 "zh" 或 "en"');
T.throws(function () { P.source({ lang: 'zh' }); }, 'N 缺席当场抛',
         'source({ N }) 少了 N');

T.report();
```

- [ ] **Step 3: 跑一遍，确认它失败**

```bash
node chess/core/algos/path-count.test.js
```

期望：`Cannot find module './path-count.js'`。

- [ ] **Step 4: 写生成器的可执行骨架**

`chess/core/algos/path-count.js` 的 UMD 包装与 `render()` 照抄 `queens.js`（Step 1 已抄）。**生成出来的源码，可执行部分逐字如下** —— 注释与散文由你写（见 Step 5），但这些代码行是定的：

```js
/* 下面这些是 HEAD / BODY 里的**字符串**片段，不是本文件的代码。
   两种语言下逐字相同，所以它们是 parts 里的纯字符串元素。 */
'const ways = [];',
'for (let i = 0; i < N * N; i = i + 1) { ways.push(0); }',
'',
'const wall = [];',
'for (let i = 0; i < N * N; i = i + 1) { wall.push(false); }',
'for (const w of BLOCKED) { wall[w] = true; }',
'',
'function fillLayer(d) {',
'  if (d > (N - 1) + (N - 1)) { return; }',
'  for (let r = 0; r < N; r = r + 1) {',
'    const c = d - r;',
'    if (c < 0 || c >= N) { continue; }',
'    const sq = r * N + c;',
'    mark(sq, "try");',
'    if (wall[sq]) {',
'      ways[sq] = 0;',
'    } else if (r === 0 && c === 0) {',
'      ways[sq] = 1;',
'    } else {',
'      let n = 0;',
'      if (r > 0) { n = n + ways[sq - N]; }',
'      if (c > 0) { n = n + ways[sq - 1]; }',
'      ways[sq] = n;',
'    }',
'    mark(sq, ways[sq]);',
'  }',
'  fillLayer(d + 1);',
'}',
'',
'fillLayer(0);',
'return ways[N * N - 1];',
```

`source(opts)` 把 `N` 与 `BLOCKED` 拼进去：

```js
  function source(opts) {
    const o = opts || {};
    if (o.N === undefined || o.N === null) {
      throw new Error('source({ N }) 少了 N —— 棋盘边长没有默认值，必须写明');
    }
    const N = o.N;
    if (typeof N !== 'number' || !isFinite(N) || Math.floor(N) !== N || N < 1) {
      throw new Error('N 必须是 >= 1 的整数，收到：' + N);
    }
    const blocked = o.blocked === undefined || o.blocked === null ? [] : o.blocked;
    if (!Array.isArray(blocked)) {
      throw new Error('blocked 必须是一个数组（没有墙就传 [] 或省略），收到：' + blocked);
    }
    for (let i = 0; i < blocked.length; i = i + 1) {
      const s = blocked[i];
      if (typeof s !== 'number' || !isFinite(s) || Math.floor(s) !== s ||
          s < 0 || s >= N * N) {
        throw new Error('blocked 里的格子必须是 0 到 ' + (N * N - 1) +
                        ' 之间的整数，收到：' + s);
      }
    }
    return render(HEAD, o.lang)
      .concat(['const N = ' + N + ';'])
      .concat(['const BLOCKED = [' + blocked.join(', ') + '];'])
      .concat(render(BODY, o.lang))
      .join('\n');
  }

  return { source: source };
```

⚠ **三处容易写错的**：

1. **`fillLayer` 必须是递归的**（末尾 `fillLayer(d + 1)`），不能写成外层 `for` 循环。第三根轴（`z` = 反对角线层号）靠的就是**调用深度**——写成循环，深度塔就是平的，而规格 §4⑤ 的裁定 ③ 明说 z 立的是层号。
2. **`mark(sq, ways[sq])` 发的是数字**，不是 `String(ways[sq])`。这就是这笔账本身。
3. **`d` 的上界是 `(N - 1) + (N - 1)`**，不是 `N`。8×8 的层号跑到 **14**。

- [ ] **Step 5: 写双语散文**

`HEAD` 与 `BODY` 里的散文片段是 `{ zh: [], en: [] }`，**两边行数必须相等**。要讲到的四件事（缺一件这道题就只是一段代码）：

1. **格子编号约定**：`sq = r * N + c`，`r=0` 是最下面一行、`c=0` 最左，0 号格 = a1。她要能自己反推格子。
2. **为什么要限成「一次一格、只往右或往上」**：车本来滑一整行，路径数是**无限**的（可以来回踏）；限成这样，计数才有限 —— 而**「无环」正是动态规划能成立的前提**。她刚在 `rookCover` 里见过会滑的车，对照是现成的。
3. **为什么按反对角线一层一层填**：同一层的格子**互不依赖**（都只看上一层），所以这一层可以整层一起算；而下一层只依赖已经算完的上一层。**这就是「为什么这个顺序可以填」**，不是「我们选了这个顺序」。
4. **墙上的格子是 0，起点自己被堵上也是 0**：0 是一个**真实的答案**，不是「没算出来」。

**英文以中文为底本重写，不是逐句对译**；判据是「两边各自读起来都像母语者写给十六岁读者的」。写不成等行数**停下来报告**，不许塞废话或砍内容凑数。

- [ ] **Step 6: 跑一遍，确认它通过**

```bash
node chess/core/algos/path-count.test.js
```

期望：全绿。**特别看那四条写死的数**（20 / 3432 / 1287 / 0）—— 它们与「两份实现一致」是两道不同的门，前者拦的是「两边同时错成一个数」。

- [ ] **Step 7: 突变验证 —— 递归写成循环会被抓吗**

把 `fillLayer` 末尾的 `'  fillLayer(d + 1);'` 删掉，改成在 `'fillLayer(0);'` 那一行外面套一个 `for` 循环（`'for (let d = 0; d <= (N-1)+(N-1); d = d + 1) { fillLayer(d); }'`），跑：

```bash
node chess/core/algos/path-count.test.js
```

**期望：仍然全绿。** 这不是失败 —— 这一步要让你**亲眼看到**：结果正确性测不出「递归还是循环」，而第三根轴完全依赖它。**所以这一条只能靠 Task 6 的浏览器验收守**，报告里要写明这件事。验完从 scratchpad 备份还原。

- [ ] **Step 8: Commit**

```bash
git status --short
git add chess/core/algos/path-count.js chess/core/algos/path-count.test.js
git commit -m "feat(chess): path-count.js —— 第六道题的双语算法源码生成器"
git status --short
```

---

## Task 2：把「认不出的 mark 种类」从静默变成响

这是 9c 唯一要**新立**的一道门，也是规格 §4⑤ 裁定 ② 点名的那处风险：

> `onMark(kind)` 返回 `null` 的种类**不画，也不报错**。数字若没被 `onMark` 接住，格子就是空的，全页照常绿。

跟阶段 8 的「白名单空了」、9a 的「抛了就算过」是同一类：**缺省行为是沉默**。

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`（mark 分发处 + `kinds` 的契约注释）

**Interfaces:**
- Consumes: 无
- Produces: 一个 mark 值若被算法真的发出来、而 `onMark` 认不出，页面**当场停住并说明是哪道题、哪个值**

- [ ] **Step 1: 找到那两处**

```bash
grep -n "onMark" chess/tools/chess-board-algorithms.html
```

你要找的是**两处**：① `kinds` 字段的契约注释（在 `PROBLEMS` 上方那段声明层文档里，今天写的是「这道题会用到的 mark 种类，决定图例的行与顺序」）；② 画格子时调用 `P.onMark(kind)` 并在返回 `null` 时跳过的那一处。

- [ ] **Step 2: 先确认没有哪道题在靠「静默跳过」活着**

```bash
node -e '
const fs = require("fs");
const s = fs.readFileSync("chess/tools/chess-board-algorithms.html", "utf8");
const m = s.match(/kinds:\s*\[[^\]]*\]/g) || [];
console.log("六道题声明的 kinds：");
m.forEach(function (x) { console.log("  " + x); });
'
grep -rn "mark(" chess/core/algos/*.js | grep -o "mark([^)]*)" | sort -u | head -20
```

**判据**：每道题**实际发出的** kind 必须都在它自己的 `kinds` 里。若发现有哪道题发了 `kinds` 里没有的值（那说明它正靠静默跳过活着），**停下来报告** —— 那是一个既有缺陷，不是这个任务能顺手改的。

- [ ] **Step 3: 改契约注释**

把 `kinds` 那一行的说明从

> `kinds     []           这道题会用到的 mark 种类，决定图例的行与顺序`

改成

> `kinds     []           **图例的行与顺序**。不要求每一行都对应一个真被发出来的
>                         mark 值 —— 连续的数值域（阶段 9c 的 pathCount）就是用
>                         一行代表整个域（那一行的 kind 是 'num'，算法从不发它）。
>                         反过来也不成立：真被发出来的值必须能被 onMark 认出，
>                         认不出会当场停住（见下面那道门）。`

- [ ] **Step 4: 写会失败的测试 —— 用一个临时探针**

页面层没有 node 测试，所以这道门用**一次性探针**验证，验完删掉（阶段 9b Task 6 用过同一个做法）。在 scratchpad 里写 `t2-probe.js`：

```js
/* 一次性探针：把工具⑤ 的页面脚本抽出来求值，喂一个 onMark 认不出的 kind，
   看它是静默跳过还是当场停住。验完删掉，不留在仓库里。 */
const fs = require('fs');
const s = fs.readFileSync('chess/tools/chess-board-algorithms.html', 'utf8');
const hit = /onMark\(([A-Za-z0-9_.]+)\)/.exec(s);
console.log('onMark 调用点：', hit && hit[0]);
console.log('返回 null 之后紧跟的那几行：');
const i = s.indexOf(hit[0]);
console.log(s.slice(i - 200, i + 400));
```

```bash
node /private/tmp/.../scratchpad/t2-probe.js
```

读那段上下文，确认今天的行为确实是「`null` 就 `return` / `continue`」。**把这段原始输出贴进报告**——它是「改之前确实是静默的」的证据。

- [ ] **Step 5: 让它响**

把那处 `if (!m) return;`（或 `continue;`）改成当场抛，措辞要点名**是哪道题、哪个值、以及该怎么办**：

```js
        const m = P.onMark(kind);
        if (!m) {
          /* 阶段 9c 立的门。改之前这里是静默 return —— 一个 onMark 认不出的
             kind 会让那一格什么都不画，而全页照常绿。9c 把 kind 放宽成
             string | number（每格带一个标量）之后，这个沉默的代价变成了
             「整块棋盘的数字一个都不显示，没有任何一处报错」。
             缺省行为是沉默的东西，迟早会沉默地坏掉。 */
          throw new Error(
            'PROBLEMS.' + key + '.onMark 认不出这个 mark 值：' + JSON.stringify(kind) +
            '（类型 ' + typeof kind + '）。算法真的发出了它，但 onMark 返回了 null，' +
            '于是这一格什么都不会画。要么在 onMark 里接住它，要么让算法别发它。'
          );
        }
```

（`key` 是当前题目在 `PROBLEMS` 里的键名；如果那一处拿不到 `key`，用手边能拿到的最具体的标识，**但必须点名到题**——只说「认不出 12」没法定位。）

- [ ] **Step 6: 验证六道既有题一条都没被误伤**

```bash
python3 chess/scripts/check.py 2>&1 | tail -12
```

期望：exit 0，九道门全过。这一步不是形式主义 —— 你刚改的是**六道题共用**的分发路径。

- [ ] **Step 7: 浏览器验收（这道门唯一的活人判据）**

```bash
# preview_start {name:"mathviz"}，每次调用带显式 tabId
```

打开工具⑤，**六个 tab 逐个点一遍并各 Run 一次**，确认没有一处抛出你新加的那个错。⚠ 标签不在前台时 `rAF` 完全不跑。

**如果哪道题抛了**，那说明 Step 2 的判据漏了它 —— 停下来报告，不要放宽这道门。

- [ ] **Step 8: Commit**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "fix(chess): onMark 认不出的 mark 值不再静默跳过 —— 9c 那笔账唯一要立的门"
git status --short
```

---

## Task 3：`onMark` 的数字分支 + 把数字画到格子上

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**Interfaces:**
- Consumes: Task 2 的门（数字若没被接住会当场响）
- Produces: 画格子那一段认得 `{ color, label, text }` 里的 `text` 字段 —— 有 `text` 就在格心写这个字符串

- [ ] **Step 1: 确认写字的原语是现成的**

```bash
grep -n "label3" chess/core/board-render.js | head
grep -n "function label3" chess/core/viz-engine.js
```

期望：`board-render.js` 的 `drawCoordLabels` 正是拿 `E.label3(C, [x, y, z], text, { color, size, align })` 在 `L.squareCenter(f, r)` 附近画字。**「在格子上写数字」不需要任何新渲染能力** —— 这是规格 §4⑤ 裁定 ⑤ 量过的。

- [ ] **Step 2: 给 `onMark` 的返回值加一个 `text` 字段**

在声明层文档里 `onMark` 那一行的说明后面补：

> `text`（可选）—— 有它就在格心写这个字符串。给「每格带一个标量」那一类用
> （阶段 9c 的 pathCount 写路径数）。省略 = 只上色，跟前五题一样。

- [ ] **Step 3: 画格子时写字**

在画完格子底色之后、画棋子之前，加：

```js
        /* 每格带一个标量（阶段 9c，规格 §4⑤ 裁定 ⑤）：onMark 返回了 text
           就在格心写上去。字号跟着格子走，不写死 —— 4×4 与 8×8 的格子边长
           差一倍，写死会在小盘上糊成一团、在大盘上小得看不见。 */
        if (m.text) {
          E.label3(C, [ctr[0], ctr[1], L.z], m.text,
                   { color: m.color, size: Math.round(L.cell * 0.34), align: 'center' });
        }
```

（`ctr` 是这一格的 `L.squareCenter(f, r)`；若那一段用的是别的变量名，跟着改。）

- [ ] **Step 4: 突变验证 —— 字号写死会怎样**

把 `Math.round(L.cell * 0.34)` 改成写死的 `12`，起浏览器看 4×4 与 8×8 两档：

- 期望：**能一眼看出问题**（小盘上字挤、大盘上字小）。截图存证。
- 这一步是为了让「字号跟着格子走」这句注释**有实测支撑**，而不是一句想当然。验完还原。

- [ ] **Step 5: Commit**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): onMark 加 text 字段 —— 在格心写标量，字号跟着格子走"
git status --short
```

---

## Task 4：声明 `PROBLEMS.pathCount`

**这一条同时是「加一题只许动三处」那条架构要求的验证。**

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**Interfaces:**
- Consumes: Task 1 的 `path-count.js`、Task 3 的 `text` 字段
- Produces: 工具⑤ 的第六个 tab

- [ ] **Step 1: `GENERATED:ALGOS` 标记行加名字**

```bash
grep -n "GENERATED:ALGOS " chess/tools/chess-board-algorithms.html
```

在那一行末尾加 `,path-count.js`。**不要手改下面那个块** —— 它由 `inline_core.py` 生成。

- [ ] **Step 2: 写声明**

照 `knightPath` 的形状（它是「证明只动三处」的那一道，最干净）：

```js
    pathCount: {
      label: PC.tab, brand: PC.brand, tips: PC.tips,
      /* 四档盘面，答案分别是 20 / 3432 / 1287 / 0（path-count.test.js 钉着）。
         档1→档2 是这四档里最有分量的一课：三堵墙把 3432 砍成 1287，六成没了。
         档3 是另一课：整条反对角线堵死 = 0，而 0 是一个真实的答案。 */
      params: [{ key: 'board', label: PC.paramBoard, min: 0, max: 3, step: 1, value: 1,
                 fmt: function (v) { return PC_BOARDS[Math.round(v)].name; } }],
      sources: ['path-count.js'],
      /* 入口是**递归**那一个：fillLayer(d) 填第 d 条反对角线，末尾调
         fillLayer(d + 1)。于是调用深度 = r + c = 层号，第三根轴不需要
         任何额外声明就是对的 —— 跟 knightPath 的 expand(frontier, d) 同构。 */
      entry: 'fillLayer',
      source: function (st, M, file, lang) {
        const b = PC_BOARDS[Math.round(st.board)];
        return M[file].source({ N: b.N, blocked: b.blocked, lang: lang });
      },
      check: { result: true, boardOps: true, counters: [] },
      board: function (st) {
        const b = PC_BOARDS[Math.round(st.board)];
        return { files: b.N, ranks: b.N, blocked: b.blocked };
      },
      zLabel: { zh: '反对角线层号（= r + c）', en: 'Anti-diagonal layer (= r + c)' },
      /* 'num' 只用于图例那一行，算法从不发它 —— 它代表整个数值域
         （见 kinds 的契约说明）。真发出来的是 'try' 与一个个数字。 */
      kinds: ['try', 'num'],
      onMark: function (kind) {
        if (kind === 'try') return { color: C_TRY, label: PC.kTry };
        if (kind === 'num') return { color: C_NUM, label: PC.kNum };
        if (typeof kind === 'number') {
          return { color: C_NUM, label: null, text: String(kind) };
        }
        return null;
      },
      exportName: function (st) {
        return 'path-count-' + PC_BOARDS[Math.round(st.board)].name + '.js';
      },
      readout: function (a, st) { /* Task 5 写 */ return ''; },
    },
```

并在文件里合适的位置加：

```js
  /* 四档盘面。sq = r * N + c，r=0 是最下面一行 —— 与 path-count.js 同一个约定。
     档2 的三堵墙是 c4 / d5 / e6；档3 是整条反对角线 r + c = 7。 */
  const PC_BOARDS = [
    { name: '4×4', N: 4, blocked: [] },
    { name: '8×8', N: 8, blocked: [] },
    { name: '8×8 + 3', N: 8, blocked: [26, 35, 44] },
    { name: '8×8 ⧸', N: 8, blocked: [7, 14, 21, 28, 35, 42, 49, 56] },
  ];
```

⚠ **`C_NUM` 是一个新颜色常量**，要按文件顶上那段「一个含义 = 一个字面量」的规矩加，并且**图例标签的显示宽度 ≤ 72**（CJK 算 2），否则 `validateDecl` 判死。

- [ ] **Step 3: 跑门**

```bash
python3 chess/scripts/check.py 2>&1 | tail -12
```

期望：exit 0；`ALGOS 往返校验` 那一行的份数从 8 变 **9**；`双语 algos 普查` 从 `8 份双语` 变 **`9 份双语`**。

**如果 `validateDecl` 抛了**，读它说的是哪一条（三条硬约束：`sources` 超过一份要自己声明 `sideView`、`onMark().label` 宽度、`exerciseSources`）。`pathCount` 只有一份 source，第一条不适用。

- [ ] **Step 4: 数一遍「动了几处」**

```bash
git diff --stat
```

**期望：只有 `chess/tools/chess-board-algorithms.html` 一个文件**（加上钩子会带进来的内联镜像），而它里面的改动应当只有**三处**：`GENERATED:ALGOS` 标记行、`PC_BOARDS`、`PROBLEMS.pathCount`（外加 `C_NUM` 与文案常量）。

**如果你发现为了让这道题跑起来还得改渲染、tab、滑杆、图例、读数、相机里的任何一处 —— 停下来报告。** 规格 §4⑤ 的原话：「如果加它时还改了别的地方，那就是架构没做到，要回头改架构而不是接受。」（Task 2 与 Task 3 改的那两处是**付账**，不算这道题的开销 —— 这个区分要在报告里讲清楚。）

- [ ] **Step 5: Commit**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): 工具⑤ 第六道题 pathCount —— 加一个键 + 一份 algos + 标记行一个名字"
git status --short
```

---

## Task 5：双语文案（tab / brand / tips / 图例 / 读数）

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`

**Interfaces:**
- Consumes: Task 4 的声明骨架（`PC.*` 与 `readout`）
- Produces: 无

- [ ] **Step 1: 写文案常量**

照另外五道题的形状加一个 `PC` 文案对象，每一条都是 `{ zh, en }`。要写的：`tab` / `brand` / `paramBoard` / `kTry` / `kNum` / `tips`。

**`tips` 只讲一个顿悟，并指向一个具体的视图或开关**（这是全仓的规矩）。这道题的顿悟是**为什么这个顺序可以填**：

- 必须说到：**按 `3` 切侧视看深度塔** —— 每一层就是一条反对角线，同一层的格子互不依赖、可以整层一起算，而下一层只依赖已经算完的上一层。
- 必须说到那条限制：**车本来滑一整行、路径数是无限的（可以来回踏）；限成一次一格、不往回走，计数才有限** —— 而「无环」正是动态规划能成立的前提。她刚在 `rookCover` 里见过会滑的车。
- 必须说到四档的对照：**3432 → 1287，三堵墙砍掉六成**；最后一档整条反对角线堵死 = **0**，而 **0 是一个真实的答案，不是「没算出来」**。

- [ ] **Step 2: 写 `readout`**

照 `knightPath` 的形状。**三种结局三种写法，没有一种是把「不知道」印成数字**：

```js
      readout: function (a, st) {
        const m = a.main, lines = [];
        if (!m) return '';
        let verdict;
        /* 截断 → 「—」。0 是一个**真实的答案**（整条对角线被堵死），
           所以它走的是正常那一支，不是「不知道」那一支 ——
           这两件事在这道题上特别容易混，档3 就是专门摆出来的那一档。 */
        if (m.truncated || m.result === null) verdict = bval('—', C_DIM);
        else verdict = bval(fmtInt(m.result), C_NUM);
        lines.push(a.row(PC.rowPaths, verdict));
        return lines.join('<br>');
      },
```

- [ ] **Step 3: 跑门**

```bash
python3 chess/scripts/check.py 2>&1 | tail -6
node --check <(awk '/<script>/{f=1;next}/<\/script>/{f=0}f' chess/tools/chess-board-algorithms.html)
```

期望：exit 0，九道门全过。

- [ ] **Step 4: Commit**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html
git commit -m "feat(chess): pathCount 的双语文案与读数 —— tips 讲「为什么这个顺序可以填」"
git status --short
```

---

## Task 6：浏览器验收

**这一条是 Task 1 Step 7 留下的那个缺口唯一的守卫**（结果正确性测不出「递归还是循环」，而第三根轴完全依赖它）。

**Files:** 无（只验，不改）

- [ ] **Step 1: 起预览**

```bash
# preview_start {name:"mathviz"}，之后每次调用带显式 tabId
```

打开 `chess/tools/chess-board-algorithms.html`，切到第六个 tab。

- [ ] **Step 2: 逐条勾（每条都要截图或读数存证）**

1. **数字真的画在格子上** —— 档1（8×8 空盘）Run 完，右上角那格写着 **3432**，a1 写着 **1**。
2. **深度塔是斜的，不是平的** —— 按 `3` 切侧视。**塔有 15 层**（层号 0…14）。若塔是平的（只有一层），说明 `fillLayer` 被写成了循环而不是递归 —— **那正是 Task 1 Step 7 说的那个缺口，报告里要点名**。
3. **同一层的格子在同一高度** —— 侧视下，一条反对角线上的格子应当落在同一层。
4. **墙画成斜纹、且不参与计数** —— 切到档2，三格斜纹；档3 一整条斜纹对角线。
5. **档3 的答案是 0，而且它显示成 `0` 不是「—」** —— 这是「0 是真实答案」那一课的落点。**读数区要写 0**。
6. **字号跟着格子走** —— 档0（4×4）与档1（8×8）各截一张，两档的数字都读得清。
7. **切语言** —— 中英各看一次，图例两行（`try` 与 `num`）都在，tips 两种语言都通顺。
8. **Task 2 那道门没误伤** —— 六个 tab 逐个 Run 一次，没有一处抛「onMark 认不出」。

- [ ] **Step 3: 把八条的结论写进报告**

每一条写「过 / 不过 + 证据」。**不许写「应该没问题」** —— 没验就写没验。

---

## Task 7：「立成高度」可行性探针（付 9f 那笔账）

规格 §4⑤ 裁定 ⑥：9c 不实现它，但要**拿同一条数字通道跑一段探针**验证这条路走得通。**探针不落成工具、不进注册表。**

**Files:**
- Create: `chess/core/algos/path-count.probe.test.js`

**Interfaces:**
- Consumes: Task 1 的 `path-count.js`
- Produces: 无（纯测试 + 两个书面结论）

- [ ] **Step 1: 写探针**

```js
'use strict';
/* 「立成高度」可行性探针（阶段 9c 收尾，规格 §4⑤ 裁定 ⑥）。
   9f 的 fieldBFS 要把每格的标量**立成高度**，而 9c 只实现了「写数字」。
   这一段不实现高度，它只回答一个问题：**同一条数字通道够不够 9f 用**。
   探针不落成工具、不进注册表。 */
const T = require('../_test.js');
const I = require('../interp.js');
const P = require('./path-count.js');

/* 拿一个**值域小**的例子模拟 fieldBFS 的形状：距离 0–6。
   pathCount 自己的值会涨到几千（所以它写数字），但通道是同一条。 */
const marks = [];
I.run(P.source({ N: 4, blocked: [], lang: 'zh' }), { host: {
  mark: function (sq, kind) { if (typeof kind === 'number') marks.push([sq, kind]); },
} });

T.ok(marks.length > 0, '探针：数字确实通过 mark 通道送出来了');

/* ① 柱高要的单位：宿主拿到的是**原始数值**，不是格式化过的字符串 ——
   所以 9f 可以直接拿它当高度，不必反解析。 */
T.ok(marks.every(function (m) { return typeof m[1] === 'number' && isFinite(m[1]); }),
     '探针①：拿到的是可直接当高度用的有限数值，不是字符串');

/* ② 0 值：0 是一个**真实的答案**（墙上的格子、够不到的格子），
   不是「没有值」。通道必须能把 0 与「从没标过」区分开。 */
const zeroRun = [];
I.run(P.source({ N: 5, blocked: [0], lang: 'zh' }), { host: {
  mark: function (sq, kind) { if (typeof kind === 'number') zeroRun.push([sq, kind]); },
} });
T.ok(zeroRun.some(function (m) { return m[1] === 0; }),
     '探针②：0 是被真的标出来的值，不是缺席 —— 9f 画柱子时 0 要画成贴地的一格，不是不画');

/* ③ 值域跨度：pathCount 到几千，fieldBFS 只有 0–6。
   同一条通道两种量级都过得去，说明 9f 不需要另开一条。 */
const big = marks.map(function (m) { return m[1]; }).sort(function (a, b) { return b - a; })[0];
T.ok(big >= 20, '探针③：同一条通道扛得住 pathCount 的量级（本例最大 ' + big + '）');

T.report();
```

- [ ] **Step 2: 跑**

```bash
node chess/core/algos/path-count.probe.test.js
```

期望：全绿。**若哪一条红了，那就是探针发现了真东西 —— 停下来报告，不要就地改测试去迁就。**（红了不是失败，是这个探针成功了。）

- [ ] **Step 3: 回答那两个问题（写进报告，不写进代码）**

规格裁定 ⑥ 点名要答的两条：

1. **柱高取什么单位？** —— 结合探针① 与工具① 的 `field` tab（去看它怎么把距离立起来的），给出「9f 应当怎么把 0–6 的距离映射成高度」的建议**与理由**。要具体到：跟盘面尺寸的关系（`L.cell` 的多少倍）、以及为什么不是线性映射到某个固定像素高度。
2. **值为 0 的格子怎么画？** —— 探针② 证明了 0 是真被标出来的。给出「贴地画一格 / 不画 / 别的」的建议**与理由**。

**这两个答案不在这个任务里落地**，是给 9f 的输入。**不许顺手实现高度。**

- [ ] **Step 4: Commit**

```bash
git status --short
git add chess/core/algos/path-count.probe.test.js
git commit -m "test(chess): 立成高度可行性探针 —— 9c 付账，答两个问题给 9f"
git status --short
```

---

## Task 8：工具⑤ 定版 1.4.0 + 注册表同步

**Files:**
- Modify: `chess/tools/chess-board-algorithms.html`（`<meta name="tool-version">` 与 `const VERSION` 两处）
- Modify: `chess/chess-tools.json`

- [ ] **Step 1: 两处版本号一起改**

```bash
grep -n 'tool-version' chess/tools/chess-board-algorithms.html
grep -n 'const VERSION' chess/tools/chess-board-algorithms.html
```

两处都从 `1.3.0` 改成 `1.4.0`。**面板角标读的是传进 `E.init` 的 `VERSION`，跟 meta 是两个地方** —— 只改一处会让角标与 meta 不一致。

- [ ] **Step 2: `chess-tools.json`**

工具⑤ 的 `version` 改成 `1.4.0`，`changelog` 加一条：新增第六道题 `pathCount`（动态规划），并说明「每格带一个标量」这条能力（`mark` 的 `kind` 放宽成 `string | number`）。**`desc` 那段长文也要补上这道题** —— 它是这个工具在首页的门面，五道题的描述都在里面，少一道就对不上了。

- [ ] **Step 3: 跑全量门 + 注册表同步检查**

```bash
python3 chess/scripts/check.py 2>&1 | tail -12
python3 scripts/sync_registry.py --check
```

期望：`check.py` exit 0 九道门；`sync_registry --check` 已同步。

⚠ `chess/chess-tools.json` 与根目录的 `tools.json` **是两份不同的注册表**。`sync_registry.py` 管的是后者（`app.html` / `index.html` 的 62 个工具）。**先确认这次改动要不要动根目录那份** —— 阶段 9a 的 Task 8 复核过「`index.html`/`app.html` 不带工具版本」，若结论仍然成立就不动它，并在报告里写明你**复核过**而不是假设。

- [ ] **Step 4: 角标实测**

浏览器打开工具⑤，看右上角面板的版本角标写的是 `v1.4.0`。**截图存证** —— meta 与 `VERSION` 两处不一致时角标会露馅。

- [ ] **Step 5: Commit**

```bash
git status --short
git add chess/tools/chess-board-algorithms.html chess/chess-tools.json
git commit -m "feat(chess): 工具⑤ 1.4.0 —— 第六道题 pathCount"
git status --short
```

---

## 收尾（不是一个 Task，是每次派发都要核的）

八个任务落地后，在**干净树**上跑：

```bash
git status --short          # 先确认是空的，下面的读数才作数
node chess/core/algos/path-count.test.js
node chess/core/algos/path-count.probe.test.js
python3 chess/scripts/check.py
python3 scripts/sync_registry.py --check
```

期望：测试无 FAIL；`check.py` exit 0 且九道门各自那一行都在，其中 **`双语 algos 普查：9 份双语`**、**`ALGOS 往返校验：… 9 份算法源码`**。

开 PR 之后：

```bash
gh pr checks <PR#>
```

**本地绿 ≠ CI 绿。** 不要自己合并，用户在对话里确认。
