# 国际象棋子项目 · 阶段 1（规则速成：工具①②）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付两个可日常使用的教学工具——① 走法几何、② 规则与将杀——外加子项目导航页与注册表。阶段 1 结束时，一个完全不会下棋的人可以打开 `chess/index.html`，自己点着把规则学完。

**Architecture:** 两个工具共用一个新的可测交互内核 `chess/core/interact.js`（选择、命中、高亮层、走法栈、非法走法的理由生成），它是纯逻辑、零 DOM、可在 node 下测试。工具本身是单文件 HTML，通过 `VizEngine.init({ SCENES, PARAMS, TOOL })` 的声明式配置驱动，`inline_core.py` 把四个 core 模块注入进去。

**Tech Stack:** 纯 ES2015、Canvas 2D、零依赖、零构建。Python 3 仅用于内联同步。

## Global Constraints

- **零依赖**：不得引入任何 npm 包、CDN 资源、外部字体或图片。
- **单文件可用**：`chess/tools/*.html` 必须 `file://` 双击可用。
- **UMD 双导出**：`core/*.js` 既支持 `module.exports`（node 测试），也挂到 `window`。
- **模块顶层不得触碰 DOM**：`document` / `window` / `localStorage` / `location` 只能在函数体内出现。这是 core 模块能被 node 测试的前提。
- **英文默认、中文可切**（规格 §1.6）。所有面向用户的文案是 `{zh, en}` 对象，经引擎的 `t()` 渲染。
- **标准术语**（规格 §3）：King/Queen/Rook/Bishop/Knight/Pawn、`a1`–`h8`、rank/file/diagonal、square（不用 grid）。战术术语用标准英文并配中文：`别子 pin`、`叉 fork`。
- **canvas 是主角**：工具 ①② **不使用分屏**（分屏只属于 ④⑤，规格 §1.5）。所有 UI 浮在 canvas 之上。
- **一切按时间推进，不按帧计数**。开发机是 30Hz 外接显示器；按帧计数的动画会慢一半。引擎已是 `dt` 驱动。
- **性能预算**：32 子单帧绘制耗时 ≤4ms，强制光栅化后测量，**探针开销单列并排除**（规格 §2.5）。
- **并行开工纪律**：`git status --short` 后只暂存自己的路径，禁止 `git add -A` / `git commit -a`。
- **规格来源**：`docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md` §4①②、§5。有冲突以规格为准并记一笔。

## 已有的内核接口（阶段 0 交付，本阶段只消费不修改）

```js
// chess-core.js
WHITE=1 BLACK=-1 EMPTY=0 P=1 N=2 B=3 R=4 Q=5 K=6
SQ(file,rank) fileOf(sq) rankOf(sq) offBoard(sq) toAlg(sq) fromAlg('e4')
Position.fromFEN(fen, { requireKings })   // requireKings 默认 true
new Position()                            // 空盘，直接写 board[] 摆子
pos.clone() pos.toFEN() pos.kingSq(colour)
pos.pseudoLegalMoves() pos.legalMoves()   // → Move[]
pos.attacksFrom(sq) pos.attackedBy(sq, colour)   // 攻击几何，含友方占据格
pos.isAttacked(sq, by) pos.inCheck(colour) pos.status()
pos.make(move)                            // 不可变，返回新 Position
FLAG = { CAPTURE:1, EP:2, CASTLE_K:4, CASTLE_Q:8, DOUBLE:16, PROMO:32 }
moveToSAN(pos, move) parseSAN(pos, s) moveToUCI(move) parseUCI(pos, s)
sameMove(a, b)                            // 比较 from/to/promo
// Move = { from, to, piece, captured, promo, flags }

// viz-engine.js
init({ canvas, SCENES, PARAMS, TOOL, VERSION, ENGINE_VERSION, autoLoop })
cam  makeCam() proj(C,[x,y,z]) unproject(C,[sx,sy],planeZ) viewInfo() withContext(ctx,fn)
strokePoly line3 glowDot solidDot label3 arrowAt drawAxes drawGridXY
clamp fmt fmtS t bindOrbit

// board-render.js
layout({files,ranks,cell}) → { files, ranks, cell, w, h, squareCenter(f,r), squareCorners(f,r) }
drawBoard(ctx,C,E,spec) drawCoordLabels(ctx,C,E,spec) drawPiece(ctx,C,E,{code,center,scale,alpha})
pickSquare(C,E,[sx,sy],L) → { file, rank } | null
fileLabel(i) isLight(f,r) PIECE_BOX=100 PIECE_ANCHOR=[50,88] CODE_KEY PIECE_PATHS
```

**引擎要求页面提供的 DOM id**（缺一个就会静默失效）：
`brandDesc btnFold btnLang btnPlay btnReset panel panelTitle paramsHost readout recHost tabsNav tips togglesHost verBadge viewsHost`

## File Structure

| 文件 | 责任 |
|---|---|
| `chess/core/interact.js` | ★ 交互内核：选择状态、走法栈与撤销、非法走法的理由生成。纯逻辑、零 DOM |
| `chess/core/interact.test.js` | 上者的测试 |
| `chess/tools/_skeleton.html` | 扩充为完整的工具骨架（引擎要求的全部 DOM id + 面板结构），两个工具从它复制 |
| `chess/tools/chess-moves-geometry.html` | 工具① |
| `chess/tools/chess-rules-check-mate.html` | 工具② |
| `chess/index.html` | 子项目导航页 |
| `chess/chess-tools.json` | 子项目注册表 |
| `chess/scripts/inline_core.py` | 增加 `INTERACT` 源 |
| `index.html`（主站） | 加一处入口链接，不触碰其 `TOOLS` 数组 |

**为什么 `interact.js` 单独成模块**：两个工具都要"点子→高亮→落子"，工具 ④⑤ 之后还要。写在任一工具里都会被另一个复制，而复制品会漂移。它同时是本阶段唯一可做 TDD 的部分——其余是视觉，只能靠验收标准。

---

## Task 1: `interact.js` — 选择状态与高亮层

**Files:**
- Create: `chess/core/interact.js`
- Test: `chess/core/interact.test.js`

**Interfaces:**
- Consumes: `chess-core.js` 的 `Position` / `sameMove` / `toAlg`
- Produces: `Interact.create({ position })` → `st`；`Interact.select(st, sq)`；`Interact.clear(st)`；`Interact.highlights(st)` → `{ selected, targets, pseudoOnly, lastMove, check }`（全部是格索引数组，`selected`/`check` 为单值或 −1）

`pseudoOnly` 是**伪合法减合法的差集**——规格 §4② 的 `legal` 页要用它把"被别住"直接画出来。

- [ ] **Step 1: 写失败的测试**

Create `chess/core/interact.test.js`：

```js
'use strict';
const T = require('./_test.js');
const C = require('./chess-core.js');
const I = require('./interact.js');

const START = C.START_FEN;
function at(a) { return C.fromAlg(a); }

// ---- 选择 ----
const st = I.create({ position: C.Position.fromFEN(START) });
T.eq(I.highlights(st).selected, -1, '初始无选中');
T.eq(I.highlights(st).targets, [], '初始无目标格');

I.select(st, at('e2'));
const h1 = I.highlights(st);
T.eq(h1.selected, at('e2'), '选中 e2');
T.eq(h1.targets.map(C.toAlg).sort(), ['e3', 'e4'], 'e2 的兵有两个合法目标');

// 选中对方的子：不选中，也不给目标
I.select(st, at('e7'));
T.eq(I.highlights(st).selected, -1, '轮到白方时点黑子不选中');

// 选中空格：清空
I.select(st, at('e2'));
I.select(st, at('d5'));
T.eq(I.highlights(st).selected, -1, '点空格清空选择');

// ---- pseudoOnly：被别住的子 ----
// 白王 e1、白马 f1、黑车 h1 —— 马被别在第一横行上
const pinned = I.create({ position: C.Position.fromFEN('4k3/8/8/8/8/8/8/4KN1r w - - 0 1') });
I.select(pinned, at('f1'));
const hp = I.highlights(pinned);
T.eq(hp.targets, [], '被别住的马没有合法目标');
T.ok(hp.pseudoOnly.length > 0, '被别住的马有伪合法目标 —— 差集非空');
T.ok(hp.pseudoOnly.every(sq => !hp.targets.some(t => t === sq)),
     'pseudoOnly 与 targets 不相交（它就是差集）');

// 未被别住时差集为空
const free = I.create({ position: C.Position.fromFEN('4k3/8/8/8/8/8/8/4KN2 w - - 0 1') });
I.select(free, at('f1'));
T.eq(I.highlights(free).pseudoOnly, [], '未被别住时差集为空');

// ---- check 高亮 ----
const chk = I.create({ position: C.Position.fromFEN('4k3/4R3/8/8/8/8/8/4K3 b - - 0 1') });
T.eq(I.highlights(chk).check, at('e8'), '被将军时高亮己方王的格');
T.eq(I.highlights(free).check, -1, '未被将军时不高亮');

T.report();
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interact.test.js`
Expected: FAIL —— `Cannot find module './interact.js'`

- [ ] **Step 3: 写实现**

Create `chess/core/interact.js`：

```js
/* 交互内核：选择、高亮层、走法栈、非法走法的理由。
   纯逻辑、零 DOM —— 工具负责画，本模块负责「现在该高亮哪些格」。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chess-core.js'));
  else root.Interact = factory(root.ChessCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  function create(opts) {
    return {
      pos: opts.position,
      stack: [opts.position],   // 局面栈，stack[i] 是走完第 i 步之后的局面
      idx: 0,
      sel: -1,
      selMoves: [],             // 选中格的合法走法
      selPseudo: [],            // 选中格的伪合法走法
      lastMove: null,
    };
  }

  function clear(st) { st.sel = -1; st.selMoves = []; st.selPseudo = []; }

  function select(st, sq) {
    const v = st.pos.board[sq];
    // 空格、或对方的子：一律清空。教学工具里「点错了」应当无声复位，
    // 而不是给一个需要再点一次才能消掉的半选中状态。
    if (v === C.EMPTY || (v > 0 ? C.WHITE : C.BLACK) !== st.pos.turn) { clear(st); return false; }
    st.sel = sq;
    st.selMoves = st.pos.legalMoves().filter(function (m) { return m.from === sq; });
    st.selPseudo = st.pos.pseudoLegalMoves().filter(function (m) { return m.from === sq; });
    return true;
  }

  function highlights(st) {
    const targets = st.selMoves.map(function (m) { return m.to; });
    const pseudoOnly = [];
    for (let i = 0; i < st.selPseudo.length; i++) {
      const to = st.selPseudo[i].to;
      if (targets.indexOf(to) < 0 && pseudoOnly.indexOf(to) < 0) pseudoOnly.push(to);
    }
    const me = st.pos.turn;
    const k = st.pos.kingSq(me);
    return {
      selected: st.sel,
      targets: dedupe(targets),
      pseudoOnly: pseudoOnly,
      lastMove: st.lastMove ? [st.lastMove.from, st.lastMove.to] : [],
      check: (k >= 0 && st.pos.inCheck(me)) ? k : -1,
    };
  }

  function dedupe(a) {
    const out = [];
    for (let i = 0; i < a.length; i++) if (out.indexOf(a[i]) < 0) out.push(a[i]);
    return out;
  }

  return { create: create, select: select, clear: clear, highlights: highlights };
});
```

> `targets` 去重是必要的：一个兵走到底排会产生四条升变走法，`to` 相同。不去重的话那一格会被画四遍，半透明高亮会叠成不同的颜色。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interact.test.js`
Expected: PASS，输出以 `0 failed` 结尾

- [ ] **Step 5: 提交**

```bash
git add chess/core/interact.js chess/core/interact.test.js
git commit -m "feat(chess): 交互内核 —— 选择状态与高亮层（含伪合法差集）"
```

---

## Task 2: `interact.js` — 走法栈、撤销与再分支

**Files:**
- Modify: `chess/core/interact.js`
- Test: `chess/core/interact.test.js`

**Interfaces:**
- Consumes: Task 1 的 `st`
- Produces: `Interact.tryMove(st, from, to, promo)` → `{ ok: true, move, san }` 或 `{ ok: false, reason }`（`reason` 由 Task 3 填充，本任务先返回 `null`）；`Interact.undo(st)` → bool；`Interact.redo(st)` → bool；`Interact.canUndo(st)` / `canRedo(st)`

规格 §5.2 要求"走法栈支持任意回退与再分支"——回退后再走新棋，应当**截断**旧分支，而不是与之冲突。

- [ ] **Step 1: 写失败的测试**

追加到 `interact.test.js`（`T.report()` 之前）：

```js
// ---- 走法栈 ----
const s2 = I.create({ position: C.Position.fromFEN(START) });
T.eq(I.canUndo(s2), false, '初始不能撤销');
T.eq(I.canRedo(s2), false, '初始不能重做');

const r1 = I.tryMove(s2, at('e2'), at('e4'));
T.eq(r1.ok, true, 'e2e4 是合法走法');
T.eq(r1.san, 'e4', '返回 SAN');
T.eq(s2.pos.turn, C.BLACK, '走完轮到黑方');
T.eq(I.highlights(s2).lastMove.map(C.toAlg), ['e2', 'e4'], 'lastMove 记录起讫格');
T.eq(I.highlights(s2).selected, -1, '走完自动清空选择');
T.eq(I.canUndo(s2), true, '走过一步后可以撤销');

I.tryMove(s2, at('e7'), at('e5'));
T.eq(I.canUndo(s2), true, '两步后仍可撤销');

T.eq(I.undo(s2), true, '撤销成功');
T.eq(s2.pos.turn, C.BLACK, '撤销一步后轮回黑方');
T.eq(I.canRedo(s2), true, '撤销后可以重做');
T.eq(I.redo(s2), true, '重做成功');
T.eq(s2.pos.turn, C.WHITE, '重做后轮回白方');

// 回退后走新棋 = 开新分支，旧分支被截断
I.undo(s2);
I.undo(s2);
T.eq(s2.pos.toFEN(), START, '连撤两步回到初始局面');
T.eq(I.canRedo(s2), true, '此时可以重做');
I.tryMove(s2, at('d2'), at('d4'));
T.eq(I.canRedo(s2), false, '走了新棋之后旧分支被截断，不能再重做');
T.eq(I.canUndo(s2), true, '新分支上仍可撤销');

// 非法走法不进栈
const before = s2.stack.length;
const bad = I.tryMove(s2, at('d4'), at('d8'));
T.eq(bad.ok, false, 'd4d8 不是合法走法');
T.eq(s2.stack.length, before, '非法走法不改变走法栈');

// 升变必须指定棋子，否则拒绝并给出待选项
const pr = I.create({ position: C.Position.fromFEN('4k3/4P3/8/8/8/8/8/4K3 w - - 0 1') });
const need = I.tryMove(pr, at('e7'), at('e8'));
T.eq(need.ok, false, '未指定升变棋子时不落子');
T.eq(need.needsPromotion, true, '而是要求先选升变棋子');
T.eq(need.choices.sort(), [C.Q, C.R, C.B, C.N].sort(), '给出四个待选项');
const done = I.tryMove(pr, at('e7'), at('e8'), C.N);
T.eq(done.ok, true, '指定马之后落子成功');
T.eq(done.san, 'e8=N', 'underpromotion 的 SAN 正确');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interact.test.js`
Expected: FAIL —— `I.tryMove is not a function`

- [ ] **Step 3: 写实现**

在 `interact.js` 的 `return` 之前插入：

```js
  const PROMO_CHOICES = [C.Q, C.R, C.B, C.N];

  function tryMove(st, from, to, promo) {
    const legal = st.pos.legalMoves().filter(function (m) {
      return m.from === from && m.to === to;
    });
    if (!legal.length) return { ok: false, reason: null };

    // 同一 from/to 有多条走法，只可能是升变（四选一）。
    // 没指定就不猜——猜成后是最常见的默认，但那样 underpromotion 永远走不出来。
    if (legal.length > 1 || (legal[0].flags & C.FLAG.PROMO)) {
      if (!promo) {
        return { ok: false, needsPromotion: true, choices: PROMO_CHOICES.slice(), reason: null };
      }
    }
    const m = promo
      ? legal.filter(function (x) { return x.promo === promo; })[0]
      : legal[0];
    if (!m) return { ok: false, reason: null };

    const san = C.moveToSAN(st.pos, m);
    st.stack.length = st.idx + 1;      // 截断旧分支
    st.pos = st.pos.make(m);
    st.stack.push(st.pos);
    st.idx = st.stack.length - 1;
    st.lastMove = m;
    clear(st);
    return { ok: true, move: m, san: san };
  }

  function canUndo(st) { return st.idx > 0; }
  function canRedo(st) { return st.idx < st.stack.length - 1; }

  function undo(st) {
    if (!canUndo(st)) return false;
    st.idx--; st.pos = st.stack[st.idx]; st.lastMove = null; clear(st);
    return true;
  }

  function redo(st) {
    if (!canRedo(st)) return false;
    st.idx++; st.pos = st.stack[st.idx]; st.lastMove = null; clear(st);
    return true;
  }
```

在 `return` 的对象里加上 `tryMove`、`undo`、`redo`、`canUndo`、`canRedo`、`PROMO_CHOICES`。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interact.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/interact.js chess/core/interact.test.js
git commit -m "feat(chess): 走法栈、撤销重做与再分支截断，升变四选一"
```

---

## Task 3: `interact.js` — 非法走法的具体理由

**Files:**
- Modify: `chess/core/interact.js`
- Test: `chess/core/interact.test.js`

**Interfaces:**
- Consumes: Task 2 的 `tryMove`
- Produces: `Interact.explain(pos, from, to)` → `{ code, zh, en }`；`tryMove` 失败时 `reason` 填入该对象

规格 §5.2：**非法走法当场拒绝并说明理由，文案要具体** —— `Illegal: your king would be in check from the bishop on g5`，而不是"不能这么走"。这是本工具最重要的教学环节：初学者犯的错，工具要能说出错在哪。

`code` 取值：`'not-your-piece'` / `'empty'` / `'shape'`（这个子不这么走）/ `'blocked'`（路上有子）/ `'own-piece'`（落点是己方子）/ `'exposes-king'`（走完自己的王被将）/ `'still-in-check'`（正被将军且这步没解决）。

- [ ] **Step 1: 写失败的测试**

追加到 `interact.test.js`：

```js
// ---- 非法走法的理由 ----
function why(fen, from, to) { return I.explain(C.Position.fromFEN(fen), at(from), at(to)); }

T.eq(why(START, 'e4', 'e5').code, 'empty', '起点是空格');
T.eq(why(START, 'e7', 'e6').code, 'not-your-piece', '轮到白方时动黑子');
T.eq(why(START, 'a1', 'a3').code, 'blocked', '车被自家兵挡住');
T.eq(why(START, 'b1', 'd2').code, 'own-piece', '落点是己方棋子');
T.eq(why(START, 'g1', 'g3').code, 'shape', '马不这么走');

// 被别住：走完自己的王会被将
const pinFen = '4k3/8/8/8/8/8/8/4KN1r w - - 0 1';
const ex = why(pinFen, 'f1', 'd2');
T.eq(ex.code, 'exposes-king', '被别住的马一动，王就暴露');
T.ok(/rook on h1/.test(ex.en), '英文理由点名了攻击者及其所在格：' + ex.en);
T.ok(/h1/.test(ex.zh), '中文理由同样点名格子：' + ex.zh);

// 正被将军，走一步不相干的棋
const inChk = '4k3/4r3/8/8/8/8/8/4K1N1 w - - 0 1';
const ex2 = why(inChk, 'g1', 'f3');
T.eq(ex2.code, 'still-in-check', '被将军时走别处仍是将军');
T.ok(/e7/.test(ex2.en), '点名将军的子在 e7：' + ex2.en);

// 合法走法返回 null
T.eq(I.explain(C.Position.fromFEN(START), at('e2'), at('e4')), null, '合法走法没有理由');

// tryMove 失败时把理由带出来
const s3 = I.create({ position: C.Position.fromFEN(pinFen) });
const bad3 = I.tryMove(s3, at('f1'), at('d2'));
T.eq(bad3.ok, false, '被别住的走法失败');
T.eq(bad3.reason.code, 'exposes-king', '失败结果里带着理由');
```

- [ ] **Step 2: 运行确认失败**

Run: `node chess/core/interact.test.js`
Expected: FAIL —— `I.explain is not a function`

- [ ] **Step 3: 写实现**

```js
  const PIECE_EN = { 1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king' };
  const PIECE_ZH = { 1: '兵', 2: '马', 3: '象', 4: '车', 5: '后', 6: '王' };

  function explain(pos, from, to) {
    if (pos.legalMoves().some(function (m) { return m.from === from && m.to === to; })) return null;

    const v = pos.board[from];
    if (v === C.EMPTY) {
      return msg('empty', 'There is no piece on ' + C.toAlg(from) + '.',
                          C.toAlg(from) + ' 上没有棋子。');
    }
    const mine = v > 0 ? C.WHITE : C.BLACK;
    if (mine !== pos.turn) {
      const side = pos.turn === C.WHITE ? ['White', '白方'] : ['Black', '黑方'];
      return msg('not-your-piece', 'It is ' + side[0] + " to move; that piece is not yours.",
                                   '现在轮到' + side[1] + '走，那不是你的子。');
    }
    const tv = pos.board[to];
    if (tv !== C.EMPTY && (tv > 0 ? C.WHITE : C.BLACK) === mine) {
      return msg('own-piece', 'Your own ' + PIECE_EN[Math.abs(tv)] + ' already stands on ' + C.toAlg(to) + '.',
                              C.toAlg(to) + ' 上是你自己的' + PIECE_ZH[Math.abs(tv)] + '。');
    }

    const pseudo = pos.pseudoLegalMoves().some(function (m) { return m.from === from && m.to === to; });
    if (!pseudo) {
      // 走法形状对不对，与路上有没有挡子，是两件事：
      // 空盘上重算一次同一颗子的攻击域，够得着就说明是被挡住，够不着才是走法不对。
      const bare = new C.Position();
      bare.board[from] = v;
      const reach = bare.attacksFrom(from).indexOf(to) >= 0;
      const name = PIECE_EN[Math.abs(v)], nameZh = PIECE_ZH[Math.abs(v)];
      if (reach) {
        return msg('blocked', 'The ' + name + ' on ' + C.toAlg(from) + ' is blocked before it reaches ' + C.toAlg(to) + '.',
                              C.toAlg(from) + ' 的' + nameZh + '到 ' + C.toAlg(to) + ' 的路上有子挡着。');
      }
      return msg('shape', 'A ' + name + ' cannot move from ' + C.toAlg(from) + ' to ' + C.toAlg(to) + '.',
                          nameZh + '不能从 ' + C.toAlg(from) + ' 走到 ' + C.toAlg(to) + '。');
    }

    // 伪合法但不合法 —— 只可能是王被暴露。走一步看看谁在打王。
    // 必须用生成器产出的那个 Move 对象，不能手搓一个：吃过路兵的被吃兵不在落点格，
    // 手搓的对象缺 FLAG.EP，_make 就不会把它移走，于是攻击者名单会算错。
    const pm = pos.pseudoLegalMoves().filter(function (m) {
      return m.from === from && m.to === to;
    })[0];
    const after = pos.make(pm);
    const k = after.kingSq(mine);
    const attackers = k >= 0 ? after.attackedBy(k, -mine) : [];
    const desc = attackers.map(function (sq) {
      return PIECE_EN[Math.abs(after.board[sq])] + ' on ' + C.toAlg(sq);
    }).join(' and ');
    const descZh = attackers.map(function (sq) {
      return C.toAlg(sq) + ' 的' + PIECE_ZH[Math.abs(after.board[sq])];
    }).join('、');

    if (pos.inCheck(mine)) {
      return msg('still-in-check', 'You are in check; after ' + C.toAlg(from) + C.toAlg(to) +
                 ' your king is still attacked by the ' + desc + '.',
                 '你正被将军；走 ' + C.toAlg(from) + C.toAlg(to) + ' 之后，王仍被' + descZh + '攻击。');
    }
    return msg('exposes-king', 'Illegal: after ' + C.toAlg(from) + C.toAlg(to) +
               ' your king would be attacked by the ' + desc + '.',
               '不合法：走 ' + C.toAlg(from) + C.toAlg(to) + ' 之后，你的王会被' + descZh + '攻击。');
  }

  function msg(code, en, zh) { return { code: code, en: en, zh: zh }; }
```

把 `tryMove` 里两处 `reason: null` 改为 `reason: explain(st.pos, from, to)`，并在 `return` 的对象里加上 `explain`。

> `needsPromotion` 那条分支不要填 `reason` —— 它不是错误，是"还需要你选一个"。

- [ ] **Step 4: 运行确认通过**

Run: `node chess/core/interact.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/interact.js chess/core/interact.test.js
git commit -m "feat(chess): 非法走法的具体理由 —— 点名攻击者及其所在格"
```

---

## Task 4: 工具骨架与内联扩展

**Files:**
- Modify: `chess/scripts/inline_core.py`
- Modify: `chess/tools/_skeleton.html`

**Interfaces:**
- Consumes: Task 1–3 的 `interact.js`
- Produces: `_skeleton.html` 含引擎要求的全部 DOM id 与四个 GENERATED 区间；`inline_core.py` 认识 `INTERACT` 标记

- [ ] **Step 1: 给 `inline_core.py` 加一个源**

在 `SOURCES` 字典里加：

```python
    'INTERACT': ROOT / 'core' / 'interact.js',
```

顺序无关（脚本按标记名匹配），但 `interact.js` 依赖 `chess-core.js`，所以在 HTML 里 **`GENERATED:CHESS-CORE` 必须排在 `GENERATED:INTERACT` 之前**——UMD 包装读的是 `root.ChessCore`，它得先存在。

- [ ] **Step 2: 把 `_skeleton.html` 扩成完整骨架**

`_skeleton.html` 目前只有 canvas 和三个 GENERATED 区间。补上引擎要求的全部 DOM id。结构（class 名沿用设计系统 §3）：

```html
<canvas id="scene"></canvas>

<div class="brand">
  <h1></h1>
  <p id="brandDesc"></p>
</div>

<nav id="tabsNav" class="tabs"></nav>

<aside id="panel" class="panel">
  <header>
    <span id="panelTitle"></span>
    <span id="verBadge" class="ver"></span>
    <button id="btnFold" class="fold"></button>
  </header>
  <div id="paramsHost"></div>
  <div id="togglesHost"></div>
  <div id="viewsHost"></div>
  <div id="readout" class="readout"></div>
  <div id="recHost"></div>
  <footer>
    <button id="btnPlay" class="btn"></button>
    <button id="btnReset" class="btn"></button>
    <button id="btnLang" class="btn"></button>
  </footer>
</aside>

<p id="tips" class="tips"></p>

<script>
/* >>> GENERATED:VIZ-ENGINE */
/* <<< GENERATED:VIZ-ENGINE */
/* >>> GENERATED:CHESS-CORE */
/* <<< GENERATED:CHESS-CORE */
/* >>> GENERATED:INTERACT */
/* <<< GENERATED:INTERACT */
/* >>> GENERATED:BOARD-RENDER */
/* <<< GENERATED:BOARD-RENDER */
</script>
<script>
/* 工具专属声明写这里，在 GENERATED 区之外 */
</script>
```

样式从 `design-system/math-viz-starter.html` 的 `<style>` 块整体搬运（设计令牌 + 组件），把默认语言相关的东西按 §1.6 处理。

- [ ] **Step 3: 验证**

Run:
```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py
node -e "
const fs=require('fs');const s=fs.readFileSync('chess/tools/_skeleton.html','utf8');
const need=['brandDesc','btnFold','btnLang','btnPlay','btnReset','panel','panelTitle',
            'paramsHost','readout','recHost','tabsNav','tips','togglesHost','verBadge','viewsHost'];
const missing=need.filter(id=>!new RegExp('id=\"'+id+'\"').test(s));
if(missing.length){console.error('缺少 DOM id：'+missing.join(', '));process.exit(1);}
console.log('DOM 契约完整：'+need.length+' 个 id');
const ci=s.indexOf('GENERATED:CHESS-CORE'), ii=s.indexOf('GENERATED:INTERACT');
if(ci<0||ii<0||ci>ii){console.error('CHESS-CORE 必须排在 INTERACT 之前');process.exit(1);}
console.log('内联顺序正确');
"
```
Expected: `check.py` exit 0；DOM 契约完整；内联顺序正确。

- [ ] **Step 4: 提交**

```bash
git add chess/scripts/inline_core.py chess/tools/_skeleton.html
git commit -m "build(chess): 内联 interact.js，_skeleton.html 补齐引擎的 DOM 契约"
```

---

## Task 5: 工具① `chess-moves-geometry`

**Files:**
- Create: `chess/tools/chess-moves-geometry.html`（从 `_skeleton.html` 复制）

**Interfaces:**
- Consumes: 四个 core 模块
- Produces: 一个可用工具；`TOOL.id = 'chess-moves-geometry'`

**顿悟**（规格 §4①）：每个棋子就是一组向量规则；而"控制中心"是可以量出来的数，不是口号。

四个 tab，`views` 的第一项必须是 `iso`（双击回家）：

| tab | 内容 | 顿悟视角 |
|---|---|---|
| `piece` | 选棋种（PARAMS 滑杆 + `map`）、点格子放子，高亮 `attacksFrom` 的全部格 | `iso` + `top`（正交俯视看覆盖形状）|
| `field` | 从放子格出发的**最少步数场**，z = 步数，每格标数字 | `side`（正交侧视看阶梯高度）—— 这是本工具的顿悟视角 |
| `mobility` | 该棋种在 64 格各自的攻击格数，作为高度场 | `iso` + `top` |
| `metric` | 王的切比雪夫距离等距环；车的两步可达 | `top` |

**关键实现点：**

1. **最少步数场用 BFS，数据来自 `attacksFrom`**：

```js
function minMoveField(code, fromSq) {
  const dist = {};
  dist[fromSq] = 0;
  let frontier = [fromSq];
  while (frontier.length) {
    const next = [];
    for (let i = 0; i < frontier.length; i++) {
      const s = frontier[i];
      const bare = new ChessCore.Position();
      bare.board[s] = code;               // 空盘上的单子：场是几何性质，与其他子无关
      const reach = bare.attacksFrom(s);
      for (let j = 0; j < reach.length; j++) {
        const t = reach[j];
        if (dist[t] === undefined) { dist[t] = dist[s] + 1; next.push(t); }
      }
    }
    frontier = next;
  }
  return dist;
}
```

> 必须用 `new Position()` 而非 `fromFEN` —— 空盘无王，`fromFEN` 默认会拒绝。这是阶段 0 特意为本工具留的口子。

2. **`field` 与 `mobility` 的高度场画法**：每格中心竖一根到 `z = k * 步数` 的细线 + 顶端一个 `glowDot`，相邻格顶点用 `strokePoly` 连成网格。`k` 取 `0.35`（8 步的场高约 2.8，与棋盘 8 的边长比例协调）。

3. **必须验证的三个数**（写进 `readout()`，也是验收依据）：

| 断言 | 值 |
|---|---|
| 马从 a1 到 h8 的最少步数 | **6** |
| 马的正相邻（同行/同列）最少步数，全盘任意格 | **恒为 3** |
| 马的对角相邻最少步数 | **中心 2、角上 4** |
| 骑士在 d4 的攻击格数 / 在 a1 的攻击格数 | **8 / 2** |
| 后在中心 d4 / 角上 a1 的攻击格数 | **27 / 21** |

`mobility` 页的 `tips` 要点出后两行——"占中心"从此是一个数字。

4. **`metric` 页**：王到任意格的最少步数 = **切比雪夫距离** `max(|Δfile|, |Δrank|)`，画成同心方环；车在空盘上两步可达全盘，画成十字 + 其余全覆盖。`tips` 点明这是 L∞ 范数的具象。

5. **交互**：点格子放子（不是走子——本工具没有对手）。`Interact` 在这里只用到 `pickSquare` 与高亮绘制，不用 `tryMove`。

6. **自动演示**（规格 §5.1：全交互与自动演示是同一条时间轴）。骨架里的 `btnPlay` 由引擎绑好，工具只需要定义"播放时发生什么"：本工具是**依次巡回六种棋子**，每种停留约 2.5 秒，让人不动手也能看完一遍全部走法。

   两条硬性要求：

   - **按 `dt` 累加，不按帧计数**。开发机是 30Hz 外接显示器，按帧计数会让巡回速度慢一半。引擎每帧给的 `dt` 已经 `clamp` 到 `[0, 0.05]`。
   - **用户一点棋盘就暂停**（`state.running = false`），并且不要跳回自动序列的位置——停在他点的那一步。这正是规格那句"你不动它就自己走，你一落子它就停在你这一步"。

- [ ] **Step 1: 复制骨架并填三个编辑点**

```bash
cp chess/tools/_skeleton.html chess/tools/chess-moves-geometry.html
```
填 `TOOL`、`PARAMS`、`SCENES`，其余不动。

- [ ] **Step 2: 用 node 验证那五组数（不依赖浏览器）**

把 `minMoveField` 与攻击计数逻辑写成工具内的函数后，用 node 直接对内核复算一遍：

```bash
node -e "
const C=require('./chess/core/chess-core.js');
function field(code,from){const d={};d[from]=0;let q=[from];
  while(q.length){const n=[];for(const s of q){const b=new C.Position();b.board[s]=code;
  for(const t of b.attacksFrom(s))if(d[t]===undefined){d[t]=d[s]+1;n.push(t);}}q=n;}return d;}
const f=field(C.N,C.fromAlg('a1'));
console.log('a1→h8', f[C.fromAlg('h8')], '(应为 6)');
console.log('a1→b1', f[C.fromAlg('b1')], '(应为 3)');
console.log('a1→b2', f[C.fromAlg('b2')], '(应为 4)');
const d4=field(C.N,C.fromAlg('d4'));
console.log('d4→e5', d4[C.fromAlg('e5')], '(应为 2)');
function atk(code,sq){const b=new C.Position();b.board[sq]=code;return b.attacksFrom(sq).length;}
console.log('马 d4/a1:', atk(C.N,C.fromAlg('d4')), '/', atk(C.N,C.fromAlg('a1')), '(应为 8 / 2)');
console.log('后 d4/a1:', atk(C.Q,C.fromAlg('d4')), '/', atk(C.Q,C.fromAlg('a1')), '(应为 27 / 21)');
"
```
Expected: 全部与上表一致。**任何一个对不上，都说明工具里的场算法与内核不一致，必须先修好再继续。**

- [ ] **Step 3: 浏览器验收**

`python3 -m http.server` 已由 `.claude/launch.json` 的 `mathviz` 配置提供（端口 8777）。用 preview 工具打开 `/chess/tools/chess-moves-geometry.html`，逐条确认：

1. 四个 tab 都能切换，每个 tab 的 `views` 第一项是 `iso`，双击画布回到 `iso`
2. 点棋盘任意格能放子，攻击域立即高亮
3. `field` 页切到 `side` 视角时，阶梯高度肉眼可辨；马的场明显不是平的
4. 语言切换按钮能在 EN/ZH 间切换，且**默认是 EN**
5. `readout()` 里的数字与 Step 2 的 node 复算一致
6. 绘制耗时 ≤4ms（用与 `_piece-preview.html` 相同的分项探针，回读单列排除）

- [ ] **Step 4: 提交**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py
git add chess/tools/chess-moves-geometry.html
git commit -m "feat(chess): 工具① 走法几何 —— 攻击域、最少步数场、机动性、距离度量"
```

---

## Task 6: 工具② `chess-rules-check-mate`

**Files:**
- Create: `chess/tools/chess-rules-check-mate.html`（从 `_skeleton.html` 复制）

**Interfaces:**
- Consumes: 四个 core 模块，特别是 `Interact` 的全部 API
- Produces: `TOOL.id = 'chess-rules-check-mate'`

**顿悟**（规格 §4②）：合法走法 = 伪合法 ∩ 不自杀。将死不是一种特殊状态，是"合法走法集合为空且正被将军"。

| tab | 内容 |
|---|---|
| `legal` | **伪合法 vs 合法同屏双色高亮**，差集正好是被别住的子。整个工具最关键的一页 |
| `special` | 易位（四个前提逐条亮灯）、吃过路兵（含时间窗）、升变（含 underpromotion）|
| `check` | z = ply：展开对手所有应手，全部落空 = checkmate；无合法走法但未被将军 = stalemate |
| `mate` | 基本杀法 K+Q vs K、K+R vs K |

**关键实现点：**

1. **`legal` 页的双色**：`Interact.highlights(st).targets` 用 emerald，`pseudoOnly` 用 rose。两者不相交（Task 1 已断言）。`tips` 文案：*"The rose squares are where this piece could go if the rules stopped at movement. They are forbidden because moving there would expose your king — that is what a pin is."*

2. **`special` 页的易位四前提**，逐条独立求值并各配一盏灯（全绿才允许易位）：

```js
function castlingChecks(pos, side, kingside) {
  const home = side === ChessCore.WHITE ? ChessCore.fromAlg('e1') : ChessCore.fromAlg('e8');
  const rookSq = home + (kingside ? 3 : -4);
  const step = kingside ? 1 : -1;
  const bit = side === ChessCore.WHITE ? (kingside ? 1 : 2) : (kingside ? 4 : 8);
  const between = kingside ? [home + 1, home + 2] : [home - 1, home - 2, home - 3];
  return [
    { key: 'rights',  ok: !!(pos.castling & bit) },
    { key: 'rook',    ok: pos.board[rookSq] === (side === ChessCore.WHITE ? ChessCore.R : -ChessCore.R) },
    { key: 'empty',   ok: between.every(function (s) { return pos.board[s] === ChessCore.EMPTY; }) },
    { key: 'safe',    ok: !pos.isAttacked(home, -side) &&
                          !pos.isAttacked(home + step, -side) &&
                          !pos.isAttacked(home + step * 2, -side) },
  ];
}
```

> `safe` 只查王的起点、路径、终点三格。**长易位时 b 列（`home−3`）必须为空但不必安全** —— 王不经过它。这一条是易位规则里最常被写错的地方，`tips` 要专门点出来。

3. **`check` 页的 z 轴**：当前局面在 z=0；对手的每一步应手在 z=1，画成从当前局面发散的线；如果某一层一个节点都没有，就是将死。将死局面下这一层应当**可见地空掉**——这是"将死 = 合法走法集合为空"的视觉证明。

4. **预置局面**（`views` 的 `onSelect` 里加载，`tips` 说明每个演示什么）：

| 键 | FEN | 演示 |
|---|---|---|
| `pin` | `4k3/8/8/8/8/8/8/4KN1r w - - 0 1` | 别子：马一步也不能走 |
| `castleOk` | `r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1` | 四前提全绿 |
| `castleThrough` | `r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1` | f1 被攻击 → 短易位灯灭、长易位仍绿 |
| `castleB1` | `r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1` | b1 被攻击**不影响**长易位 |
| `ep` | `rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3` | 吃过路兵，且只在这一步有效 |
| `foolsMate` | `rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3` | 将死：白方合法走法为 0 |
| `stalemate` | `7k/5Q2/6K1/8/8/8/8/8 b - - 0 1` | 逼和：黑方合法走法为 0 但未被将军 |
| `mateKQ` | `4k3/8/8/8/8/8/8/3QK3 w - - 0 1` | K+Q vs K 基本杀法 |
| `mateKR` | `4k3/8/8/8/8/8/8/3RK3 w - - 0 1` | K+R vs K 基本杀法 |

5. **交互**：完整的点击落子。点子 → 高亮 → 点目标格落子；非法走法用 `Interact.explain` 的文案显示在 `tips` 区，**并且不落子**。升变弹四选一。`Ctrl/Cmd+Z` 撤销、`Ctrl/Cmd+Shift+Z` 重做。`F` 翻转棋盘视角（白方 ⇄ 黑方）——这是棋盘专属键，由工具自己监听（引擎不提供，规格已定）。

   注意引擎已经摘掉了 `Space` 与 `r` 的绑定（阶段 0 PR #68），所以 `F` 与 `Ctrl+Z` 不会与引擎冲突；但你自己的键盘监听**必须复用引擎那套焦点保护的判据**——`document.activeElement` 是 `input`/`textarea`/`select`/`isContentEditable` 时一律不响应。

6. **自动演示**（规格 §5.1）：播放时**依次巡回本页的预置局面**，每个停留约 3 秒并把该局面的 `tips` 一并换掉。同样按 `dt` 累加而非帧计数；**用户一落子就暂停**，停在他走的那一步，不跳回序列。

- [ ] **Step 1: 复制骨架并填三个编辑点**

```bash
cp chess/tools/_skeleton.html chess/tools/chess-rules-check-mate.html
```

- [ ] **Step 2: 用 node 验证九个预置局面**

```bash
node -e "
const C=require('./chess/core/chess-core.js');
const cases=[
 ['pin','4k3/8/8/8/8/8/8/4KN1r w - - 0 1',p=>p.legalMoves().filter(m=>m.from===C.fromAlg('f1')).length,0],
 ['foolsMate','rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',p=>p.status(),'checkmate'],
 ['stalemate','7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',p=>p.status(),'stalemate'],
 ['castleOk','r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',p=>p.legalMoves().filter(m=>m.flags&(C.FLAG.CASTLE_K|C.FLAG.CASTLE_Q)).length,2],
 ['castleThrough','r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1',p=>p.legalMoves().filter(m=>m.flags&C.FLAG.CASTLE_K).length,0],
 ['castleB1','r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1',p=>p.legalMoves().filter(m=>m.flags&C.FLAG.CASTLE_Q).length,1],
 ['ep','rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',p=>p.legalMoves().filter(m=>m.flags&C.FLAG.EP).length,1],
];
let bad=0;
for(const [name,fen,fn,want] of cases){
  const got=fn(C.Position.fromFEN(fen));
  const ok=JSON.stringify(got)===JSON.stringify(want);
  if(!ok) bad++;
  console.log((ok?'✓':'✗'), name, '→', got, '(应为', want+')');
}
process.exit(bad?1:0);
"
```
Expected: 七条全部 ✓。**任何一条不符，说明该 FEN 抄错了，必须先修 FEN 而不是改期望值。**

- [ ] **Step 3: 浏览器验收**

打开 `/chess/tools/chess-rules-check-mate.html`，逐条确认：

1. `legal` 页加载 `pin` 局面，点 f1 的马 → **没有 emerald 格、有 rose 格**，差集可见
2. 点一个子再点合法目标格 → 真的落子，轮次翻转
3. 点一个非法目标格 → **不落子**，`tips` 区显示具体理由并**点名攻击者所在格**
4. `special` 页四盏灯随预置局面正确亮灭；`castleB1` 局面下长易位仍为绿
5. `check` 页在 `foolsMate` 下，对手应手那一层**可见地为空**
6. 兵走到底排弹出四选一，选马能走出 underpromotion
7. `Ctrl/Cmd+Z` 撤销生效；`F` 翻转视角
8. 默认语言是 EN
9. 绘制耗时 ≤4ms

- [ ] **Step 4: 提交**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py
git add chess/tools/chess-rules-check-mate.html
git commit -m "feat(chess): 工具② 规则与将杀 —— 伪合法减合法、易位四前提、将死与逼和"
```

---

## Task 7: 子项目导航页与注册表

**Files:**
- Create: `chess/index.html`
- Create: `chess/chess-tools.json`

**Interfaces:**
- Consumes: 两个工具的 `TOOL.id`
- Produces: 子项目入口

`chess-tools.json` 的结构照主站 `tools.json` 的单条目形状（去掉与主站分类相关的字段）：

```json
{
  "schemaVersion": 1,
  "tools": [
    {
      "id": "chess-moves-geometry",
      "file": "tools/chess-moves-geometry.html",
      "accent": "rose",
      "phase": 1,
      "kicker": { "en": "Rules", "zh": "规则" },
      "title": { "en": "Geometry of Movement", "zh": "走法的几何本质" },
      "desc": {
        "en": "Every piece is a set of vectors. Place one anywhere and watch its attack domain; then stand the minimum-move field up as a third axis and see that a knight's distance field is not flat — orthogonally adjacent squares are always 3 moves away, while diagonally adjacent ones are 2 in the middle and 4 in the corner. \"Control the centre\" stops being a slogan and becomes a number: a knight attacks 8 squares from d4 and 2 from a1.",
        "zh": "每个棋子就是一组向量。把它放到任意格上看它的攻击域；再把最少步数场立成第三根轴，就会看到马的距离场不是平的——正相邻恒为 3 步，而对角相邻在中心是 2 步、在角上是 4 步。「占中心」从此不是口号而是一个数字：马在 d4 攻击 8 格，在 a1 只有 2 格。"
      },
      "tag": { "en": "attack domain · min-move field · mobility", "zh": "攻击域 · 最少步数场 · 机动性" },
      "version": "1.0.0",
      "engine": "chess-1.0.0",
      "changelog": [
        { "version": "1.0.0", "date": "2026-08-02",
          "en": "First release: attack domain, minimum-move field, mobility height map, distance metrics.",
          "zh": "首发：攻击域、最少步数场、机动性高度场、距离度量。" }
      ]
    },
    {
      "id": "chess-rules-check-mate",
      "file": "tools/chess-rules-check-mate.html",
      "accent": "violet",
      "phase": 1,
      "kicker": { "en": "Rules", "zh": "规则" },
      "title": { "en": "Rules, Legality and Mate", "zh": "规则、合法性与将杀" },
      "desc": {
        "en": "A legal move is a pseudo-legal move that does not expose your own king. Both sets are drawn at once in two colours, and the difference between them is exactly what a pin is. Castling's four preconditions each get their own indicator, including the one everyone gets wrong: on the queenside the b-file square must be empty but need not be safe, because the king never passes over it. Checkmate is not a special state — it is the move list going empty while the king is attacked.",
        "zh": "合法走法就是不让自己的王暴露的伪合法走法。两个集合同屏双色画出，它们的差集正好就是「别子」。易位的四个前提各有一盏灯，包括那条几乎人人写错的：长易位时 b 列必须为空但不必安全，因为王根本不经过它。将死不是一种特殊状态——它就是合法走法列表空掉、而王正被攻击。"
      },
      "tag": { "en": "pseudo-legal minus legal · castling · mate", "zh": "伪合法减合法 · 易位 · 将杀" },
      "version": "1.0.0",
      "engine": "chess-1.0.0",
      "changelog": [
        { "version": "1.0.0", "date": "2026-08-02",
          "en": "First release: pseudo-legal/legal diff, castling preconditions, en passant window, checkmate and stalemate.",
          "zh": "首发：伪合法/合法差集、易位四前提、吃过路兵时间窗、将死与逼和。" }
      ]
    }
  ]
}
```

`chess/index.html`：单文件、零依赖、EN 默认、`?lang=` 与 `localStorage` 可切（沿用引擎的 i18n 机制，但导航页不需要整个引擎——只抄 `resolveLang` / `t` 两个函数即可，约 15 行）。运行时 `fetch('chess-tools.json')`；`file://` 下 fetch 会失败，因此**内嵌一份同样的最小列表作为回退**，与主站 `app.html` 的做法一致。

页面内容：标题、一句话说明这套工具是干什么的、按 `phase` 分组的卡片列表（阶段 1 两张，后续阶段留位）。

- [ ] **Step 1: 建两个文件**

- [ ] **Step 2: 验证 JSON 与回退一致**

```bash
node -e "
const fs=require('fs');
const j=JSON.parse(fs.readFileSync('chess/chess-tools.json','utf8'));
const h=fs.readFileSync('chess/index.html','utf8');
let bad=0;
for(const t of j.tools){
  if(!fs.existsSync('chess/'+t.file)){console.error('文件不存在: '+t.file);bad++;}
  if(h.indexOf(t.id)<0){console.error('index.html 的回退列表缺少: '+t.id);bad++;}
  for(const k of ['kicker','title','desc','tag'])
    if(!t[k].en||!t[k].zh){console.error(t.id+' 的 '+k+' 缺少 en 或 zh');bad++;}
}
console.log(bad?'✗ '+bad+' 处问题':'✓ 注册表与回退一致，双语完整，文件都存在');
process.exit(bad?1:0);
"
```
Expected: `✓ 注册表与回退一致，双语完整，文件都存在`

- [ ] **Step 3: 浏览器验收**

打开 `/chess/index.html`：两张卡片都在、默认 EN、点进去能打开工具、`?lang=zh` 切中文。

- [ ] **Step 4: 提交**

```bash
git add chess/index.html chess/chess-tools.json
git commit -m "feat(chess): 子项目导航页与注册表"
```

---

## Task 8: 主站入口与集成验收

**Files:**
- Modify: `index.html`（主站，仅加一处链接）

**Interfaces:**
- Consumes: Task 7 的 `chess/index.html`

规格 §9 明确：对主站的唯一改动是加一个指向 `chess/index.html` 的入口链接，**不触碰其 `TOOLS` 数组**，因此不影响 `scripts/sync_registry.py --check`。

- [ ] **Step 1: 加链接**

在主站 `index.html` 的合适位置（页脚或分类列表之后）加一个链接块，双语，说明这是一个独立子项目。不要动 `TOOLS` 数组的任何一行。

- [ ] **Step 2: 确认主站注册表校验未被打破**

```bash
python3 scripts/sync_registry.py --check
echo "sync_registry exit=$?"
git diff --stat index.html
```
Expected: `sync_registry.py --check` exit 0；`index.html` 的改动只有新增的链接块。

- [ ] **Step 3: 全量验收**

```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py; echo "chess gate exit=$?"
python3 scripts/sync_registry.py --check; echo "main registry exit=$?"
node chess/core/interact.test.js
git status --short
```
Expected: 两个门都 exit 0；interact 测试通过；`git status --short` 列出的每个路径都是本任务应当改的。

- [ ] **Step 4: 提交**

```bash
git add index.html
git commit -m "docs(site): 主站加入 chess 子项目入口"
```

---

## 阶段 1 完成标准

- [ ] `node chess/core/interact.test.js` 通过
- [ ] `python3 chess/scripts/check.py` exit 0（内联一致性 + `node --check` + 三个测试套件）
- [ ] `python3 scripts/sync_registry.py --check` exit 0（主站注册表未被打破）
- [ ] 工具① 的五组数与 node 复算一致（Task 5 Step 2）
- [ ] 工具② 的七个预置局面与 node 复算一致（Task 6 Step 2）
- [ ] 两个工具在浏览器里逐条通过各自的验收清单
- [ ] 两个工具的绘制耗时 ≤4ms（分项探针，回读单列排除）
- [ ] 默认语言是 EN，切换与 `?lang=` 均生效
- [ ] `chess/index.html` 在 `http://` 与 `file://` 下都能列出两个工具

**下一阶段**：阶段 2（工具③ 棋谱回放 + 30 局历史棋谱与双语背景故事）。
