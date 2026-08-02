# 国际象棋子项目 · 阶段 0（内核与渲染基建）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建成 `chess/` 子项目的地基——一个经 perft 验证的合法走法生成器、参数化棋盘与棋子渲染器、裁剪后的 3D 引擎，以及把它们注入单文件工具的同步脚本。本阶段不产出任何可见工具。

**Architecture:** 走法生成器采用 0x88 表示，内部用 `_make`/`_unmake` 变异以支撑 perft 的百万级节点，对外只暴露不可变的 `make()`（`clone()` 后变异）——一份变异逻辑、两套 API，不会因两条代码路径而分歧。渲染层把棋盘尺寸参数化（`files × ranks`），棋子写成 SVG 路径经 `Path2D` 交给 Canvas 2D。全部模块用 UMD 包装，既能被 `node` 加载做测试，也能被内联进 html。

**Tech Stack:** 纯 ES2015 JavaScript（零依赖、零构建）、Canvas 2D、Python 3（仅同步脚本）、`node` 自带能力做测试运行器。

## Global Constraints

- **零依赖**：不得引入任何 npm 包、CDN 资源、外部字体或图片。测试运行器自己写。
- **单文件可用**：`chess/tools/*.html` 最终必须 `file://` 双击可用。`core/*.js` 是编辑源，运行时被内联。
- **UMD 双导出**：每个 `core/*.js` 既支持 `module.exports`（node 测试），也挂到 `window`（浏览器内联）。
- **默认语言英文**：本子项目 `en` 默认、`zh` 可切，与主仓库相反（规格 §1.6）。
- **标准术语**：SAN 为默认记法，同时支持 UCI。棋子/坐标一律标准英文（King/Queen/Rook/Bishop/Knight/Pawn，`a1`–`h8`，rank/file/diagonal，square 而非 grid）。
- **减号用 U+2212（−）**，数值默认 2 位小数——沿用主仓库文案规范。
- **并行开工纪律**：`git status --short` 后只暂存自己的路径，禁止 `git add -A` / `git commit -a`（CLAUDE.md）。
- **规格来源**：`docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md`。有冲突以规格为准，并在计划里记一笔。

### 与规格的三处签名偏差（已核对，均为实现层面的细化）

| 规格 §2.3 / §2.4 写的 | 本计划实际采用 | 理由 |
|---|---|---|
| `Move.toSAN(pos)` / `Move.toUCI()` | `ChessCore.moveToSAN(pos, move)` / `moveToUCI(move)` | `Move` 是普通对象而非类，挂原型会让 `_make`/`_unmake` 里的百万次对象创建变贵 |
| `drawBoard(C, {…, origin, …})` | `drawBoard(ctx, C, E, spec)`，无 `origin`（棋盘恒以原点为中心）| `ctx`/`E` 显式注入而非引用全局，模块才能在 node 里加载与测试 |
| `drawPiece(C, {piece, square, …, facing})` | `drawPiece(ctx, C, E, {code, center, scale, alpha})` | `board-render` 不认识 `chess-core` 的格编码，传世界坐标可保持两模块解耦；`facing` 对朝向相机的剪影无意义，等真上 3D 再加 |

`status()` 不含 `'repetition'`：三次重复需要局面历史，单个 `Position` 判不了，由阶段 2 的走法栈负责（详见 Task 7）。

## File Structure

| 文件 | 责任 |
|---|---|
| `chess/core/_test.js` | 极简零依赖测试运行器（`eq` / `ok` / `throws` / `report`）|
| `chess/core/chess-core.js` | 0x88 棋盘、走法生成、合法性、FEN/SAN/UCI/PGN、perft |
| `chess/core/chess-core.test.js` | 内核全部测试，含 perft 参考值 |
| `chess/core/board-render.js` | `drawBoard` 参数化棋盘 + `drawPiece` 棋子渲染 + `PIECE_PATHS` |
| `chess/core/viz-engine.js` | 从 `math-viz-starter.html` 裁剪出的 3D 引擎 |
| `chess/scripts/inline_core.py` | 把 `core/*.js` 注入 `tools/*.html` 的 GENERATED 标记区 |
| `chess/scripts/check.py` | 校验内联副本一致 + 对每个 html 跑 `node --check` |
| `chess/tools/_skeleton.html` | 供 `inline_core.py` 验证用的最小工具骨架 |

**为什么 `chess-core.js` 不再拆分**：走法生成、FEN、SAN 三者共享同一套 0x88 常量与 `Position` 内部字段，拆开会把私有细节变成跨文件接口。它是一个单一职责单元——"一局棋的规则"。预计 900–1100 行。

---

## Task 1: 测试运行器与 0x88 坐标基础

**Files:**
- Create: `chess/core/_test.js`
- Create: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `ChessCore.SQ(file, rank) → int`、`ChessCore.fileOf(sq) → 0..7`、`ChessCore.rankOf(sq) → 0..7`、`ChessCore.offBoard(sq) → bool`、`ChessCore.toAlg(sq) → 'e4'`、`ChessCore.fromAlg('e4') → int`；常量 `WHITE=1` `BLACK=-1` `EMPTY=0` `P=1 N=2 B=3 R=4 Q=5 K=6`

- [ ] **Step 1: 写测试运行器**

Create `chess/core/_test.js`：

```js
'use strict';
let passed = 0;
const failures = [];

function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failures.push(label + '\n    expected: ' + e + '\n    actual:   ' + a);
}

function ok(cond, label) {
  if (cond) { passed++; return; }
  failures.push(label + '\n    expected truthy, got: ' + cond);
}

function throws(fn, label) {
  try { fn(); } catch (e) { passed++; return; }
  failures.push(label + '\n    expected a throw, none happened');
}

function report() {
  for (const f of failures) console.error('FAIL  ' + f);
  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  process.exit(failures.length ? 1 : 0);
}

module.exports = { eq, ok, throws, report };
```

- [ ] **Step 2: 写失败的测试**

Create `chess/core/chess-core.test.js`：

```js
'use strict';
const T = require('./_test.js');
const C = require('./chess-core.js');

// ---- 0x88 坐标 ----
T.eq(C.SQ(0, 0), 0, 'a1 是 0');
T.eq(C.SQ(7, 7), 119, 'h8 是 119');
T.eq(C.fileOf(C.SQ(4, 3)), 4, 'e4 的 file 是 4');
T.eq(C.rankOf(C.SQ(4, 3)), 3, 'e4 的 rank 是 3');
T.eq(C.offBoard(C.SQ(4, 3)), false, 'e4 在盘内');
T.eq(C.offBoard(8), true, '索引 8 越界');
T.eq(C.offBoard(120), true, '索引 120 越界');
T.eq(C.toAlg(C.SQ(4, 3)), 'e4', 'SQ(4,3) 的代数记号是 e4');
T.eq(C.fromAlg('e4'), C.SQ(4, 3), 'e4 解析回 SQ(4,3)');
T.eq(C.toAlg(C.fromAlg('h8')), 'h8', 'h8 往返一致');
T.eq(C.toAlg(C.fromAlg('a1')), 'a1', 'a1 往返一致');
T.throws(() => C.fromAlg('z9'), 'fromAlg 对非法坐标应抛错');

T.report();
```

- [ ] **Step 3: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— `Cannot find module './chess-core.js'`

- [ ] **Step 4: 写最小实现**

Create `chess/core/chess-core.js`：

```js
/* 国际象棋内核 —— 0x88 表示、走法生成、FEN/SAN/UCI/PGN。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChessCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WHITE = 1, BLACK = -1;
  const EMPTY = 0, P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;

  // 0x88：索引 = rank * 16 + file。盘内格的第 4、7 位必为 0，
  // 所以越界检测是一次按位与，不需要两次范围比较。
  function SQ(file, rank) { return rank * 16 + file; }
  function fileOf(s) { return s & 7; }
  function rankOf(s) { return s >> 4; }
  function offBoard(s) { return (s & 0x88) !== 0; }

  function toAlg(s) {
    return String.fromCharCode(97 + fileOf(s)) + (rankOf(s) + 1);
  }

  function fromAlg(a) {
    if (typeof a !== 'string' || a.length !== 2) throw new Error('Bad square: ' + a);
    const f = a.charCodeAt(0) - 97, r = a.charCodeAt(1) - 49;
    if (f < 0 || f > 7 || r < 0 || r > 7) throw new Error('Bad square: ' + a);
    return SQ(f, r);
  }

  return { WHITE, BLACK, EMPTY, P, N, B, R, Q, K,
           SQ, fileOf, rankOf, offBoard, toAlg, fromAlg };
});
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node chess/core/chess-core.test.js`
Expected: PASS —— 输出以 `0 failed` 结尾（通过数随测试增补而变，不要写死）

- [ ] **Step 6: 提交**

```bash
git add chess/core/_test.js chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): 0x88 坐标基础与零依赖测试运行器"
```

---

## Task 2: FEN 解析与序列化

**Files:**
- Modify: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: Task 1 的 `SQ` / `fromAlg` / `toAlg` / 棋子常量
- Produces: `Position` 构造函数，字段 `board`(Int8Array 128)、`turn`、`castling`(位掩码 1=K 2=Q 4=k 8=q)、`ep`(格索引或 −1)、`half`、`full`、`kingW`、`kingB`；`Position.fromFEN(str) → Position`；`pos.toFEN() → str`；`pos.clone() → Position`；`pos.kingSq(colour) → int`

棋子编码：`board[sq]` 为 0 表示空；白方 `+1..+6`、黑方 `−1..−6`，绝对值即 `P..K`。

- [ ] **Step 1: 写失败的测试**

追加到 `chess/core/chess-core.test.js`（`T.report()` 之前）：

```js
// ---- FEN ----
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const p0 = C.Position.fromFEN(START);
T.eq(p0.board[C.fromAlg('e1')], C.K, 'e1 是白王');
T.eq(p0.board[C.fromAlg('e8')], -C.K, 'e8 是黑王');
T.eq(p0.board[C.fromAlg('a1')], C.R, 'a1 是白车');
T.eq(p0.board[C.fromAlg('d8')], -C.Q, 'd8 是黑后');
T.eq(p0.board[C.fromAlg('e4')], C.EMPTY, 'e4 为空');
T.eq(p0.turn, C.WHITE, '初始轮到白方');
T.eq(p0.castling, 15, '初始四项易位权俱全');
T.eq(p0.ep, -1, '初始无吃过路兵目标格');
T.eq(p0.half, 0, '初始半步计数为 0');
T.eq(p0.full, 1, '初始回合数为 1');
T.eq(p0.kingW, C.fromAlg('e1'), '白王位置记录正确');
T.eq(p0.kingB, C.fromAlg('e8'), '黑王位置记录正确');
T.eq(p0.toFEN(), START, '初始局面 FEN 往返一致');

const KIWI = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
T.eq(C.Position.fromFEN(KIWI).toFEN(), KIWI, 'Kiwipete FEN 往返一致');

const EPFEN = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
const pep = C.Position.fromFEN(EPFEN);
T.eq(pep.ep, C.fromAlg('f6'), '吃过路兵目标格解析正确');
T.eq(pep.toFEN(), EPFEN, '带 ep 的 FEN 往返一致');

const NOCASTLE = '8/8/4k3/8/8/4K3/8/8 b - - 12 34';
const pnc = C.Position.fromFEN(NOCASTLE);
T.eq(pnc.castling, 0, '无易位权解析为 0');
T.eq(pnc.turn, C.BLACK, '轮到黑方');
T.eq(pnc.half, 12, '半步计数解析正确');
T.eq(pnc.full, 34, '回合数解析正确');
T.eq(pnc.toFEN(), NOCASTLE, '残局 FEN 往返一致');

const cl = p0.clone();
cl.board[C.fromAlg('e2')] = C.EMPTY;
T.eq(p0.board[C.fromAlg('e2')], C.P, 'clone 是深拷贝，改副本不影响原局面');

T.throws(() => C.Position.fromFEN('rnbqkbnr/pppppppp/8/8 w - -'), 'FEN 横行数不足应抛错');
T.throws(() => C.Position.fromFEN('rnbqkbnr/ppppXppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'), 'FEN 未知棋子字符应抛错');
T.throws(() => C.Position.fromFEN('rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'), 'FEN 某横行格数不足 8 应抛错');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— `C.Position is not a constructor`

- [ ] **Step 3: 写实现**

在 `chess-core.js` 的 `fromAlg` 之后、`return` 之前插入：

```js
  const FEN_TO_CODE = { p: P, n: N, b: B, r: R, q: Q, k: K };
  const CODE_TO_FEN = { 1: 'p', 2: 'n', 3: 'b', 4: 'r', 5: 'q', 6: 'k' };

  function Position() {
    this.board = new Int8Array(128);
    this.turn = WHITE;
    this.castling = 0;      // 1=K 2=Q 4=k 8=q
    this.ep = -1;
    this.half = 0;
    this.full = 1;
    this.kingW = -1;
    this.kingB = -1;
  }

  Position.prototype.kingSq = function (colour) {
    return colour === WHITE ? this.kingW : this.kingB;
  };

  Position.prototype.clone = function () {
    const p = new Position();
    p.board.set(this.board);
    p.turn = this.turn; p.castling = this.castling; p.ep = this.ep;
    p.half = this.half; p.full = this.full;
    p.kingW = this.kingW; p.kingB = this.kingB;
    return p;
  };

  Position.fromFEN = function (fen) {
    const parts = String(fen).trim().split(/\s+/);
    if (parts.length < 4) throw new Error('Bad FEN: expected at least 4 fields, got ' + parts.length);
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Bad FEN: expected 8 ranks, got ' + rows.length);

    const p = new Position();
    for (let r = 0; r < 8; r++) {
      const row = rows[7 - r];          // FEN 从第 8 横行开始写
      let f = 0;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        const lower = ch.toLowerCase();
        const code = FEN_TO_CODE[lower];
        if (!code) throw new Error('Bad FEN: unknown piece "' + ch + '"');
        if (f > 7) throw new Error('Bad FEN: rank ' + (r + 1) + ' overflows');
        const s = SQ(f, r);
        const signed = (ch === lower) ? -code : code;
        p.board[s] = signed;
        if (code === K) { if (signed > 0) p.kingW = s; else p.kingB = s; }
        f++;
      }
      if (f !== 8) throw new Error('Bad FEN: rank ' + (r + 1) + ' has ' + f + ' squares, expected 8');
    }

    p.turn = parts[1] === 'b' ? BLACK : WHITE;
    if (parts[2] !== '-') {
      if (parts[2].indexOf('K') >= 0) p.castling |= 1;
      if (parts[2].indexOf('Q') >= 0) p.castling |= 2;
      if (parts[2].indexOf('k') >= 0) p.castling |= 4;
      if (parts[2].indexOf('q') >= 0) p.castling |= 8;
    }
    p.ep = parts[3] === '-' ? -1 : fromAlg(parts[3]);
    p.half = parts.length > 4 ? parseInt(parts[4], 10) : 0;
    p.full = parts.length > 5 ? parseInt(parts[5], 10) : 1;
    return p;
  };

  Position.prototype.toFEN = function () {
    const rows = [];
    for (let r = 7; r >= 0; r--) {
      let row = '', gap = 0;
      for (let f = 0; f < 8; f++) {
        const v = this.board[SQ(f, r)];
        if (v === EMPTY) { gap++; continue; }
        if (gap) { row += gap; gap = 0; }
        const ch = CODE_TO_FEN[Math.abs(v)];
        row += v > 0 ? ch.toUpperCase() : ch;
      }
      if (gap) row += gap;
      rows.push(row);
    }
    let cast = '';
    if (this.castling & 1) cast += 'K';
    if (this.castling & 2) cast += 'Q';
    if (this.castling & 4) cast += 'k';
    if (this.castling & 8) cast += 'q';
    return rows.join('/') + ' ' + (this.turn === WHITE ? 'w' : 'b') +
           ' ' + (cast || '-') +
           ' ' + (this.ep < 0 ? '-' : toAlg(this.ep)) +
           ' ' + this.half + ' ' + this.full;
  };
```

在 `return` 的对象里加上 `Position`。

- [ ] **Step 4: 运行测试确认通过**

Run: `node chess/core/chess-core.test.js`
Expected: PASS —— 输出以 `0 failed` 结尾

- [ ] **Step 5: 提交**

```bash
git add chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): FEN 解析与序列化，Position 深拷贝"
```

---

## Task 3: 伪合法走法生成（不含易位与吃过路兵）

**Files:**
- Modify: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: Task 2 的 `Position`
- Produces: `pos.pseudoLegalMoves() → Move[]`；`Move` 是普通对象 `{ from, to, piece, captured, promo, flags }`，其中 `piece`/`captured` 是带符号的棋子码（`captured` 为 0 表示未吃子），`promo` 为 0 或 `N|B|R|Q`，`flags` 是位掩码常量 `FLAG.CAPTURE=1` `FLAG.EP=2` `FLAG.CASTLE_K=4` `FLAG.CASTLE_Q=8` `FLAG.DOUBLE=16` `FLAG.PROMO=32`

本任务只生成：滑行子（B/R/Q）沿射线、跳跃子（N/K）单步、兵的推进与斜吃（**含升变**，因为升变是兵走到底排的必然结果，与推进同一段逻辑）。易位与吃过路兵在 Task 5。

- [ ] **Step 1: 写失败的测试**

追加到测试文件：

```js
// ---- 伪合法走法生成 ----
function movesFrom(pos, from) {
  return pos.pseudoLegalMoves()
    .filter(m => m.from === C.fromAlg(from))
    .map(m => C.toAlg(m.to)).sort();
}

// 空盘上的单子机动性
const rookMid = C.Position.fromFEN('8/8/8/3R4/8/8/8/K6k w - - 0 1');
T.eq(movesFrom(rookMid, 'd5').length, 14, '空盘中央的车有 14 个走法');

const knightMid = C.Position.fromFEN('8/8/8/3N4/8/8/8/K6k w - - 0 1');
T.eq(movesFrom(knightMid, 'd5'), ['b4','b6','c3','c7','e3','e7','f4','f6'], '空盘中央的马有 8 个走法');

const knightCorner = C.Position.fromFEN('N7/8/8/8/8/8/8/K6k w - - 0 1');
T.eq(movesFrom(knightCorner, 'a8'), ['b6','c7'], '角上的马只有 2 个走法');

const bishopMid = C.Position.fromFEN('8/8/8/3B4/8/8/8/K6k w - - 0 1');
T.eq(movesFrom(bishopMid, 'd5').length, 13, '空盘中央的象有 13 个走法');

const queenMid = C.Position.fromFEN('8/8/8/3Q4/8/8/8/K6k w - - 0 1');
T.eq(movesFrom(queenMid, 'd5').length, 27, '空盘中央的后有 27 个走法');

// 滑行被己方子挡住、可吃对方子
const blocked = C.Position.fromFEN('8/8/8/3R4/8/8/3P4/K2r3k w - - 0 1');
T.eq(movesFrom(blocked, 'd5'), ['a5','b5','c5','d3','d4','d6','d7','d8','e5','f5','g5','h5'],
     '车被己方兵挡在 d3，不能到 d2/d1');

const canCapture = C.Position.fromFEN('8/8/8/3R4/8/8/3r4/K6k w - - 0 1');
T.ok(movesFrom(canCapture, 'd5').indexOf('d2') >= 0, '车能吃到 d2 的黑车');
T.ok(movesFrom(canCapture, 'd5').indexOf('d1') < 0, '车不能穿过被吃的子到 d1');

// 兵：推进、双步、斜吃
const pawns = C.Position.fromFEN('8/8/8/8/8/3p1p2/4P3/K6k w - - 0 1');
T.eq(movesFrom(pawns, 'e2'), ['d3','e3','e4','f3'], '初始行的白兵：单步、双步、两侧斜吃');

const pawnBlocked = C.Position.fromFEN('8/8/8/8/8/4n3/4P3/K6k w - - 0 1');
T.eq(movesFrom(pawnBlocked, 'e2'), [], '正前方有子时白兵不能推进，也不能斜吃正前方');

const pawnNoDouble = C.Position.fromFEN('8/8/8/8/4n3/8/4P3/K6k w - - 0 1');
T.eq(movesFrom(pawnNoDouble, 'e2'), ['e3'], '双步落点被占时只能走单步');

const blackPawn = C.Position.fromFEN('8/4p3/3P1P2/8/8/8/8/K6k b - - 0 1');
T.eq(movesFrom(blackPawn, 'e7'), ['d6','e5','e6','f6'], '黑兵方向相反，同样有双步与斜吃');

// 升变：一个落点产生四条走法
const promo = C.Position.fromFEN('8/4P3/8/8/8/8/8/K6k w - - 0 1');
const promoMoves = promo.pseudoLegalMoves().filter(m => m.from === C.fromAlg('e7'));
T.eq(promoMoves.length, 4, '兵到底排产生四条升变走法');
T.eq(promoMoves.map(m => m.promo).sort(), [C.N, C.B, C.R, C.Q].sort(), '四种升变棋子齐全');
T.ok(promoMoves.every(m => m.flags & C.FLAG.PROMO), '升变走法都带 PROMO 标志');

// 只生成当前一方的走法
const turnCheck = C.Position.fromFEN('8/4p3/8/8/8/8/4P3/K6k w - - 0 1');
T.ok(turnCheck.pseudoLegalMoves().every(m => m.piece > 0), '轮到白方时不生成黑方走法');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— `pos.pseudoLegalMoves is not a function`

- [ ] **Step 3: 写实现**

插入到 `chess-core.js` 中（`Position.prototype.toFEN` 之后）：

```js
  const FLAG = { CAPTURE: 1, EP: 2, CASTLE_K: 4, CASTLE_Q: 8, DOUBLE: 16, PROMO: 32 };

  // 0x88 下的方向偏移：+16 是往上一横行，+1 是往右一直列。
  const OFF_N = [33, 31, 18, 14, -33, -31, -18, -14];
  const OFF_B = [17, 15, -17, -15];
  const OFF_R = [16, 1, -16, -1];
  const OFF_K = [17, 16, 15, 1, -17, -16, -15, -1];
  const SLIDE = { 3: OFF_B, 4: OFF_R, 5: OFF_K };   // B / R / Q 共用射线表
  const PROMO_PIECES = [Q, R, B, N];

  function mk(from, to, piece, captured, promo, flags) {
    return { from: from, to: to, piece: piece,
             captured: captured || 0, promo: promo || 0, flags: flags || 0 };
  }

  Position.prototype.pseudoLegalMoves = function () {
    const out = [];
    const me = this.turn, bd = this.board;

    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }        // 跳过越界半区
      const v = bd[s];
      if (v === EMPTY || (v > 0 ? WHITE : BLACK) !== me) continue;
      const type = Math.abs(v);

      if (type === P) { pawnMoves(this, s, me, out); continue; }

      if (type === N || type === K) {
        const offs = type === N ? OFF_N : OFF_K;
        for (let i = 0; i < offs.length; i++) {
          const to = s + offs[i];
          if (to & 0x88) continue;
          const tv = bd[to];
          if (tv !== EMPTY && (tv > 0 ? WHITE : BLACK) === me) continue;
          out.push(mk(s, to, v, tv, 0, tv === EMPTY ? 0 : FLAG.CAPTURE));
        }
        continue;
      }

      const offs = SLIDE[type];
      for (let i = 0; i < offs.length; i++) {
        let to = s + offs[i];
        while (!(to & 0x88)) {
          const tv = bd[to];
          if (tv === EMPTY) { out.push(mk(s, to, v, 0, 0, 0)); to += offs[i]; continue; }
          if ((tv > 0 ? WHITE : BLACK) !== me) out.push(mk(s, to, v, tv, 0, FLAG.CAPTURE));
          break;                                  // 无论敌我，射线到此为止
        }
      }
    }
    return out;
  };

  function pawnMoves(pos, s, me, out) {
    const bd = pos.board;
    const dir = me === WHITE ? 16 : -16;
    const startRank = me === WHITE ? 1 : 6;
    const lastRank = me === WHITE ? 7 : 0;
    const piece = me === WHITE ? P : -P;

    const one = s + dir;
    if (!(one & 0x88) && bd[one] === EMPTY) {
      pushPawn(out, s, one, piece, 0, lastRank, 0);
      const two = s + dir * 2;
      if (rankOf(s) === startRank && !(two & 0x88) && bd[two] === EMPTY) {
        out.push(mk(s, two, piece, 0, 0, FLAG.DOUBLE));
      }
    }
    const caps = [dir + 1, dir - 1];
    for (let i = 0; i < 2; i++) {
      const to = s + caps[i];
      if (to & 0x88) continue;
      const tv = bd[to];
      if (tv === EMPTY || (tv > 0 ? WHITE : BLACK) === me) continue;
      pushPawn(out, s, to, piece, tv, lastRank, FLAG.CAPTURE);
    }
  }

  function pushPawn(out, from, to, piece, captured, lastRank, flags) {
    if (rankOf(to) !== lastRank) { out.push(mk(from, to, piece, captured, 0, flags)); return; }
    for (let i = 0; i < PROMO_PIECES.length; i++) {
      out.push(mk(from, to, piece, captured, PROMO_PIECES[i], flags | FLAG.PROMO));
    }
  }
```

在 `return` 的对象里加上 `FLAG`。

> **注意 `s += 7`**：0x88 棋盘里索引 8–15、24–31…是越界半区。命中后直接跳过 7 格再让 `s++` 走到下一横行的起点，比逐格判断快得多。

- [ ] **Step 4: 运行测试确认通过**

Run: `node chess/core/chess-core.test.js`
Expected: PASS —— 全部通过

- [ ] **Step 5: 提交**

```bash
git add chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): 伪合法走法生成 —— 滑行子、跳跃子、兵与升变"
```

---

## Task 4: 走法的施加与撤销

**Files:**
- Modify: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: Task 3 的 `Move` 与 `FLAG`
- Produces: `pos._make(move) → undo`（**变异**，内部用）；`pos._unmake(move, undo)`（**变异**，还原）；`pos.make(move) → Position`（**不可变**，公开 API，等价于 `clone()._make()`）

**关于不可变性**：规格 §2.3 声明 `Position` 不可变。这里的做法是**一份变异逻辑、两套 API**——公开的 `make()` 仍返回新对象、语义不变；内部的 `_make`/`_unmake` 供 perft 与树搜索用，避免百万级节点的对象分配。两者共用同一段落子代码，不存在第二条路径可以分歧。

本任务只处理普通走法与升变的施加/撤销；易位与吃过路兵的施加在 Task 5 一并补上（届时修改同一函数）。

- [ ] **Step 1: 写失败的测试**

```js
// ---- 施加与撤销 ----
function findMove(pos, from, to, promo) {
  const f = C.fromAlg(from), t = C.fromAlg(to);
  const m = pos.pseudoLegalMoves().find(x =>
    x.from === f && x.to === t && (promo ? x.promo === promo : !x.promo));
  if (!m) throw new Error('测试用例找不到走法 ' + from + to);
  return m;
}

const mk1 = C.Position.fromFEN(START);
const e4 = findMove(mk1, 'e2', 'e4');
const after = mk1.make(e4);
T.eq(after.board[C.fromAlg('e4')], C.P, 'make 后 e4 是白兵');
T.eq(after.board[C.fromAlg('e2')], C.EMPTY, 'make 后 e2 为空');
T.eq(after.turn, C.BLACK, 'make 后轮到黑方');
T.eq(after.ep, C.fromAlg('e3'), '双步推进设置 ep 目标格为 e3');
T.eq(after.half, 0, '兵走动使半步计数归零');
T.eq(after.full, 1, '白方走完回合数不变');
T.eq(mk1.board[C.fromAlg('e2')], C.P, 'make 不修改原局面');
T.eq(mk1.turn, C.WHITE, 'make 不修改原局面的轮次');

const blackMoved = after.make(findMove(after, 'e7', 'e5'));
T.eq(blackMoved.full, 2, '黑方走完回合数 +1');

// _make / _unmake 必须精确还原
const roundTrip = C.Position.fromFEN(KIWI);
const before = roundTrip.toFEN();
for (const m of roundTrip.pseudoLegalMoves()) {
  const undo = roundTrip._make(m);
  roundTrip._unmake(m, undo);
  if (roundTrip.toFEN() !== before) {
    T.eq(roundTrip.toFEN(), before, '_unmake 未能还原走法 ' + C.toAlg(m.from) + C.toAlg(m.to));
    break;
  }
}
T.eq(roundTrip.toFEN(), before, 'Kiwipete 全部伪合法走法 make/unmake 后局面不变');

// 吃子与半步计数
const capPos = C.Position.fromFEN('8/8/8/3r4/8/8/3R4/K6k w - - 7 20');
const cap = findMove(capPos, 'd2', 'd5');
const capAfter = capPos.make(cap);
T.eq(capAfter.board[C.fromAlg('d5')], C.R, '吃子后落点是白车');
T.eq(capAfter.half, 0, '吃子使半步计数归零');

const quiet = C.Position.fromFEN('8/8/8/8/8/8/3R4/K6k w - - 7 20');
T.eq(quiet.make(findMove(quiet, 'd2', 'd4')).half, 8, '非吃子非兵走动使半步计数 +1');

// 升变
const promoPos = C.Position.fromFEN('8/4P3/8/8/8/8/8/K6k w - - 0 1');
const promoQ = promoPos.make(findMove(promoPos, 'e7', 'e8', C.Q));
T.eq(promoQ.board[C.fromAlg('e8')], C.Q, '升变后 e8 是白后');
T.eq(promoQ.board[C.fromAlg('e7')], C.EMPTY, '升变后 e7 为空');

// 王移动后位置记录同步
const kingPos = C.Position.fromFEN('8/8/8/8/8/8/8/K6k w - - 0 1');
T.eq(kingPos.make(findMove(kingPos, 'a1', 'b1')).kingW, C.fromAlg('b1'), '白王移动后 kingW 同步更新');

// 易位权因走动而失去
const rights = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
T.eq(rights.make(findMove(rights, 'e1', 'e2')).castling, 12, '白王走动后失去 KQ，保留 kq');
T.eq(rights.make(findMove(rights, 'a1', 'a2')).castling, 13, 'a1 车走动后失去 Q');
T.eq(rights.make(findMove(rights, 'h1', 'h2')).castling, 14, 'h1 车走动后失去 K');

const rookTaken = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
const takeA8 = rookTaken.pseudoLegalMoves().find(m =>
  m.from === C.fromAlg('a1') && m.to === C.fromAlg('a8'));
// a1 车离家清 Q(2)，a8 车被吃清 q(8)：15 − 2 − 8 = 5（剩 K 与 k）
T.eq(rookTaken.make(takeA8).castling, 5, 'a1 车吃掉 a8 车后，双方各失一项后翼易位权');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— `pos.make is not a function`

- [ ] **Step 3: 写实现**

```js
  // 易位权掩码：某格一旦被"离开或被占据"，对应的权利就消失。
  // 例如 a1 既是白后翼车的家，也是黑车吃过来时会落到的格，两种情况都该清 Q。
  const CASTLE_MASK = new Int8Array(128).fill(15);
  CASTLE_MASK[SQ(4, 0)] = 12;   // e1：白王一动，K 与 Q 全没
  CASTLE_MASK[SQ(0, 0)] = 13;   // a1：清 Q
  CASTLE_MASK[SQ(7, 0)] = 14;   // h1：清 K
  CASTLE_MASK[SQ(4, 7)] = 3;    // e8：清 k 与 q
  CASTLE_MASK[SQ(0, 7)] = 7;    // a8：清 q
  CASTLE_MASK[SQ(7, 7)] = 11;   // h8：清 k

  Position.prototype._make = function (m) {
    const undo = { castling: this.castling, ep: this.ep, half: this.half,
                   kingW: this.kingW, kingB: this.kingB };
    const bd = this.board;

    bd[m.from] = EMPTY;
    bd[m.to] = m.promo ? (this.turn === WHITE ? m.promo : -m.promo) : m.piece;

    if (Math.abs(m.piece) === K) {
      if (this.turn === WHITE) this.kingW = m.to; else this.kingB = m.to;
    }

    this.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
    this.ep = (m.flags & FLAG.DOUBLE)
      ? m.from + (this.turn === WHITE ? 16 : -16)
      : -1;
    this.half = (Math.abs(m.piece) === P || m.captured) ? 0 : this.half + 1;
    if (this.turn === BLACK) this.full++;
    this.turn = -this.turn;
    return undo;
  };

  Position.prototype._unmake = function (m, undo) {
    const bd = this.board;
    this.turn = -this.turn;
    if (this.turn === BLACK) this.full--;
    bd[m.from] = m.piece;
    bd[m.to] = m.captured;
    this.castling = undo.castling; this.ep = undo.ep; this.half = undo.half;
    this.kingW = undo.kingW; this.kingB = undo.kingB;
  };

  Position.prototype.make = function (m) {
    const p = this.clone();
    p._make(m);
    return p;
  };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node chess/core/chess-core.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): 走法施加与撤销 —— 一份变异逻辑、两套 API"
```

---

## Task 5: 攻击检测

**Files:**
- Modify: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: Task 3 的偏移表
- Produces: `pos.isAttacked(square, byColour) → bool`；`pos.inCheck(colour) → bool`；`pos.attackedBy(square, byColour) → int[]`（攻击该格的所有己方棋子所在格）；`pos.attacksFrom(square) → int[]`（该格棋子能攻击到的所有格）

- [ ] **Step 1: 写失败的测试**

```js
// ---- 攻击检测 ----
const atk = C.Position.fromFEN('8/8/8/3q4/8/8/8/K6k w - - 0 1');
T.eq(atk.isAttacked(C.fromAlg('d1'), C.BLACK), true, '黑后沿直列攻击 d1');
T.eq(atk.isAttacked(C.fromAlg('h1'), C.BLACK), true, '黑后沿斜线攻击 h1');
T.eq(atk.isAttacked(C.fromAlg('e3'), C.BLACK), false, 'e3 不在黑后的任一射线上');

const blockAtk = C.Position.fromFEN('8/8/8/3q4/8/3P4/8/K6k w - - 0 1');
T.eq(blockAtk.isAttacked(C.fromAlg('d1'), C.BLACK), false, '中间有子挡住时不算攻击');
T.eq(blockAtk.isAttacked(C.fromAlg('d3'), C.BLACK), true, '挡路的那颗子本身是被攻击的');

const knightAtk = C.Position.fromFEN('8/8/8/3n4/8/8/8/K6k w - - 0 1');
T.eq(knightAtk.isAttacked(C.fromAlg('c3'), C.BLACK), true, '马攻击 c3');
T.eq(knightAtk.isAttacked(C.fromAlg('d3'), C.BLACK), false, '马不攻击同一直列的 d3');

// 兵的攻击是斜的，不是正前方 —— 最常写错的一处
const pawnAtk = C.Position.fromFEN('8/8/8/8/8/4p3/8/K6k w - - 0 1');
T.eq(pawnAtk.isAttacked(C.fromAlg('d2'), C.BLACK), true, '黑兵斜向攻击 d2');
T.eq(pawnAtk.isAttacked(C.fromAlg('f2'), C.BLACK), true, '黑兵斜向攻击 f2');
T.eq(pawnAtk.isAttacked(C.fromAlg('e2'), C.BLACK), false, '黑兵不攻击正前方的 e2');
T.eq(pawnAtk.isAttacked(C.fromAlg('e4'), C.BLACK), false, '黑兵不向后攻击');

const wPawnAtk = C.Position.fromFEN('8/8/8/8/4P3/8/8/K6k w - - 0 1');
T.eq(wPawnAtk.isAttacked(C.fromAlg('d5'), C.WHITE), true, '白兵向上斜攻 d5');
T.eq(wPawnAtk.isAttacked(C.fromAlg('d3'), C.WHITE), false, '白兵不向下攻击');

// 将军
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4K2R b K - 0 1').inCheck(C.BLACK), false,
     '车与黑王不同列时未将军');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4K2R w K - 0 1').inCheck(C.WHITE), false,
     '白方未被将军');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/R3K3 b Q - 0 1').inCheck(C.BLACK), false,
     'a1 车不攻击 e8');
T.eq(C.Position.fromFEN('4k3/4R3/8/8/8/8/8/4K3 b - - 0 1').inCheck(C.BLACK), true,
     'e7 车将军 e8 的黑王');

// attackedBy：c6 同时在 c2 车的直列上、又是 d4 马的跳点
const multi = C.Position.fromFEN('8/8/2p5/8/3N4/8/2R5/K6k w - - 0 1');
T.eq(multi.attackedBy(C.fromAlg('c6'), C.WHITE).map(C.toAlg).sort(), ['c2','d4'].sort(),
     'c6 同时被 c2 的车与 d4 的马攻击');
T.eq(multi.attackedBy(C.fromAlg('c4'), C.WHITE).map(C.toAlg), ['c2'],
     'c4 只被车攻击 —— d4 到 c4 是一格，不是马步');

// attacksFrom：盘上不能有己方子占住跳点，否则会被走法生成器过滤掉
const lone = C.Position.fromFEN('8/8/8/8/3N4/8/8/K6k w - - 0 1');
T.eq(lone.attacksFrom(C.fromAlg('d4')).length, 8, '空旷处的马攻击 8 格');
T.eq(lone.attacksFrom(C.fromAlg('e5')), [], '空格没有攻击范围');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— `pos.isAttacked is not a function`

- [ ] **Step 3: 写实现**

```js
  // 从被攻击格反向扫射线：与其枚举所有敌子的走法，不如站在目标格上
  // 沿八个方向看出去，遇到的第一颗子是不是"能这样打过来"的类型。
  Position.prototype.isAttacked = function (target, by) {
    const bd = this.board;

    for (let i = 0; i < OFF_N.length; i++) {
      const s = target + OFF_N[i];
      if (s & 0x88) continue;
      const v = bd[s];
      if (v !== EMPTY && (v > 0 ? WHITE : BLACK) === by && Math.abs(v) === N) return true;
    }

    for (let i = 0; i < OFF_K.length; i++) {
      const dir = OFF_K[i];
      const diagonal = (dir === 17 || dir === 15 || dir === -17 || dir === -15);
      let s = target + dir, dist = 1;
      while (!(s & 0x88)) {
        const v = bd[s];
        if (v !== EMPTY) {
          if ((v > 0 ? WHITE : BLACK) === by) {
            const t = Math.abs(v);
            if (t === Q) return true;
            if (t === (diagonal ? B : R)) return true;
            if (dist === 1) {
              if (t === K) return true;
              // 兵只在"从目标格看出去的斜前方"才构成攻击：
              // 白兵攻击的是它上方两格，所以从目标格看应在 +17 / +15 方向。
              if (t === P && diagonal) {
                if (by === WHITE && (dir === -17 || dir === -15)) return true;
                if (by === BLACK && (dir === 17 || dir === 15)) return true;
              }
            }
          }
          break;                      // 无论敌我，这条射线到此为止
        }
        s += dir; dist++;
      }
    }
    return false;
  };

  Position.prototype.inCheck = function (colour) {
    const k = this.kingSq(colour);
    return k < 0 ? false : this.isAttacked(k, -colour);
  };

  Position.prototype.attackedBy = function (target, by) {
    const out = [], saved = this.turn;
    this.turn = by;
    const ms = this.pseudoLegalMoves();
    this.turn = saved;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.to !== target) continue;
      if (!isAttackingMove(m)) continue;
      if (out.indexOf(m.from) < 0) out.push(m.from);
    }
    return out;
  };

  // 走法 ≠ 攻击：兵的正前方推进不吃子，易位也不是"攻击落点"。
  // Task 6 加入易位后这条过滤才真正生效，但先写在这里免得日后忘。
  function isAttackingMove(m) {
    if (m.flags & (FLAG.CASTLE_K | FLAG.CASTLE_Q)) return false;
    if (Math.abs(m.piece) === P && fileOf(m.from) === fileOf(m.to)) return false;
    return true;
  }

  Position.prototype.attacksFrom = function (from) {
    const v = this.board[from];
    if (v === EMPTY) return [];
    const out = [], saved = this.turn;
    this.turn = v > 0 ? WHITE : BLACK;
    const ms = this.pseudoLegalMoves();
    this.turn = saved;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.from !== from) continue;
      if (!isAttackingMove(m)) continue;
      if (out.indexOf(m.to) < 0) out.push(m.to);
    }
    return out;
  };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node chess/core/chess-core.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): 攻击检测 —— 从目标格反向扫射线"
```

---

## Task 6: 易位与吃过路兵

**Files:**
- Modify: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: Task 4 的 `_make`/`_unmake`、Task 5 的 `isAttacked`
- Produces: `pseudoLegalMoves()` 现在也产出易位（`FLAG.CASTLE_K` / `CASTLE_Q`）与吃过路兵（`FLAG.EP`）；`_make`/`_unmake` 正确处理这两类走法（含被吃兵不在落点格这一特殊情形）

- [ ] **Step 1: 写失败的测试**

```js
// ---- 易位 ----
const cst = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
T.eq(movesFrom(cst, 'e1').sort(), ['c1','d1','d2','e2','f1','f2','g1'].sort(),
     '两侧易位权俱全时白王有 7 个走法（含 c1 与 g1）');

const cstAfter = cst.make(cst.pseudoLegalMoves().find(m => m.flags & C.FLAG.CASTLE_K));
T.eq(cstAfter.board[C.fromAlg('g1')], C.K, '短易位后王在 g1');
T.eq(cstAfter.board[C.fromAlg('f1')], C.R, '短易位后车在 f1');
T.eq(cstAfter.board[C.fromAlg('e1')], C.EMPTY, '短易位后 e1 为空');
T.eq(cstAfter.board[C.fromAlg('h1')], C.EMPTY, '短易位后 h1 为空');
T.eq(cstAfter.kingW, C.fromAlg('g1'), '短易位后 kingW 更新');
T.eq(cstAfter.castling, 12, '短易位后白方失去全部易位权');

const cstQ = cst.make(cst.pseudoLegalMoves().find(m => m.flags & C.FLAG.CASTLE_Q));
T.eq(cstQ.board[C.fromAlg('c1')], C.K, '长易位后王在 c1');
T.eq(cstQ.board[C.fromAlg('d1')], C.R, '长易位后车在 d1');
T.eq(cstQ.board[C.fromAlg('a1')], C.EMPTY, '长易位后 a1 为空');

// 易位的四个前提，逐条测
const occupied = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1');
T.ok(!occupied.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_K),
     '王与车之间有子时不能短易位');

const bOccupied = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1');
T.ok(!bOccupied.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_Q),
     '长易位路径上 b1 有子时不能长易位（b1 必须为空，尽管王不经过它）');

const noRight = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w Qkq - 0 1');
T.ok(!noRight.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_K),
     '没有 K 权时不能短易位');

const inChk = C.Position.fromFEN('r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1');
T.ok(!inChk.pseudoLegalMoves().some(m => m.flags & (C.FLAG.CASTLE_K | C.FLAG.CASTLE_Q)),
     '被将军时不能易位');

const throughChk = C.Position.fromFEN('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
T.ok(!throughChk.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_K),
     'f1 受攻击时不能短易位（王不能穿过被攻击的格）');
T.ok(throughChk.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_Q),
     'f1 受攻击不影响长易位');

const landChk = C.Position.fromFEN('r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1');
T.ok(!landChk.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_K),
     'g1 受攻击时不能短易位（落点也不能被攻击）');

// b1 被攻击不妨碍长易位 —— 王不经过 b1
const b1Atk = C.Position.fromFEN('r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1');
T.ok(b1Atk.pseudoLegalMoves().some(m => m.flags & C.FLAG.CASTLE_Q),
     'b1 被攻击不影响长易位，因为王不经过 b1');

// ---- 吃过路兵 ----
const ep = C.Position.fromFEN('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
const epMove = ep.pseudoLegalMoves().find(m => m.flags & C.FLAG.EP);
T.ok(epMove, '存在吃过路兵走法');
T.eq(C.toAlg(epMove.from), 'e5', '吃过路兵的起点是 e5');
T.eq(C.toAlg(epMove.to), 'f6', '吃过路兵的落点是 f6');
const epAfter = ep.make(epMove);
T.eq(epAfter.board[C.fromAlg('f6')], C.P, '吃过路兵后 f6 是白兵');
T.eq(epAfter.board[C.fromAlg('f5')], C.EMPTY, '被吃的黑兵在 f5 被移走，不在落点格');
T.eq(epAfter.board[C.fromAlg('e5')], C.EMPTY, 'e5 为空');
T.eq(epAfter.ep, -1, '吃过路兵后 ep 目标格清空');

// ep 只在紧接的那一步有效
const epGone = ep.make(findMove(ep, 'd2', 'd3'));
T.eq(epGone.ep, -1, '走了别的棋之后 ep 目标格消失');

// unmake 必须把被吃的过路兵放回它原来的格，而不是落点格
const epRT = C.Position.fromFEN('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
const epBefore = epRT.toFEN();
const undoEp = epRT._make(epMove);
epRT._unmake(epMove, undoEp);
T.eq(epRT.toFEN(), epBefore, '吃过路兵的 make/unmake 精确还原');

// 易位的 unmake 也要把车放回去
const cRT = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
const cBefore = cRT.toFEN();
for (const m of cRT.pseudoLegalMoves()) {
  const u = cRT._make(m);
  cRT._unmake(m, u);
}
T.eq(cRT.toFEN(), cBefore, '含易位的全部走法 make/unmake 后局面不变');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— 易位与吃过路兵走法均未生成

- [ ] **Step 3: 修改 `pawnMoves`，加入吃过路兵**

在 `pawnMoves` 的斜吃循环里，把跳过空格的那一行改为：

```js
    for (let i = 0; i < 2; i++) {
      const to = s + caps[i];
      if (to & 0x88) continue;
      const tv = bd[to];
      if (tv === EMPTY) {
        if (to === pos.ep && pos.ep >= 0) {
          // 被吃的兵不在落点格，而在落点格的"身后"一格
          const victim = to - dir;
          out.push(mk(s, to, piece, bd[victim], 0, FLAG.CAPTURE | FLAG.EP));
        }
        continue;
      }
      if ((tv > 0 ? WHITE : BLACK) === me) continue;
      pushPawn(out, s, to, piece, tv, lastRank, FLAG.CAPTURE);
    }
```

- [ ] **Step 4: 在 `pseudoLegalMoves` 末尾加入易位生成**

在 `return out;` 之前插入：

```js
    castleMoves(this, me, out);
    return out;
  };

  function castleMoves(pos, me, out) {
    const bd = pos.board;
    const home = me === WHITE ? SQ(4, 0) : SQ(4, 7);
    if (bd[home] !== (me === WHITE ? K : -K)) return;
    if (pos.isAttacked(home, -me)) return;          // 被将军时不能易位

    const kBit = me === WHITE ? 1 : 4;
    const qBit = me === WHITE ? 2 : 8;
    const rookK = home + 3, rookQ = home - 4;

    if ((pos.castling & kBit) && bd[rookK] === (me === WHITE ? R : -R) &&
        bd[home + 1] === EMPTY && bd[home + 2] === EMPTY &&
        !pos.isAttacked(home + 1, -me) && !pos.isAttacked(home + 2, -me)) {
      out.push(mk(home, home + 2, bd[home], 0, 0, FLAG.CASTLE_K));
    }
    // 长易位：b 列（home−3）必须为空，但王不经过它，所以不检查它是否被攻击
    if ((pos.castling & qBit) && bd[rookQ] === (me === WHITE ? R : -R) &&
        bd[home - 1] === EMPTY && bd[home - 2] === EMPTY && bd[home - 3] === EMPTY &&
        !pos.isAttacked(home - 1, -me) && !pos.isAttacked(home - 2, -me)) {
      out.push(mk(home, home - 2, bd[home], 0, 0, FLAG.CASTLE_Q));
    }
  }
```

- [ ] **Step 5: 修改 `_make` / `_unmake` 处理两类特殊走法**

在 `_make` 里，`bd[m.from] = EMPTY;` 之前插入：

```js
    if (m.flags & FLAG.EP) {
      bd[m.to - (this.turn === WHITE ? 16 : -16)] = EMPTY;   // 被吃的兵不在落点格
    } else if (m.flags & FLAG.CASTLE_K) {
      bd[m.to + 1] = EMPTY; bd[m.to - 1] = this.turn === WHITE ? R : -R;
    } else if (m.flags & FLAG.CASTLE_Q) {
      bd[m.to - 2] = EMPTY; bd[m.to + 1] = this.turn === WHITE ? R : -R;
    }
```

在 `_unmake` 里，`bd[m.to] = m.captured;` 之后插入：

```js
    if (m.flags & FLAG.EP) {
      bd[m.to] = EMPTY;                                       // 落点本来是空的
      bd[m.to - (this.turn === WHITE ? 16 : -16)] = m.captured;
    } else if (m.flags & FLAG.CASTLE_K) {
      bd[m.to - 1] = EMPTY; bd[m.to + 1] = this.turn === WHITE ? R : -R;
    } else if (m.flags & FLAG.CASTLE_Q) {
      bd[m.to + 1] = EMPTY; bd[m.to - 2] = this.turn === WHITE ? R : -R;
    }
```

> `_unmake` 里 `this.turn` 已在函数开头翻转回走子方，所以这里的方向判断与 `_make` 一致。

- [ ] **Step 6: 运行测试确认通过**

Run: `node chess/core/chess-core.test.js`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): 易位与吃过路兵 —— 含四个前提与被吃兵不在落点格"
```

---

## Task 7: 合法走法过滤与局面状态

**Files:**
- Modify: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: Task 5 的 `inCheck`、Task 6 的完整 `pseudoLegalMoves`
- Produces: `pos.legalMoves() → Move[]`；`pos.status() → 'ongoing'|'check'|'checkmate'|'stalemate'|'insufficient'|'fifty'`

**说明**：`'repetition'`（三次重复）需要局面历史，不是单个 `Position` 能判断的，因此不在 `status()` 内——它由棋谱回放层（阶段 2）在有走法栈时判定。这是对规格 §2.3 的一处细化，已如实记在此。

- [ ] **Step 1: 写失败的测试**

```js
// ---- 合法走法过滤 ----
T.eq(C.Position.fromFEN(START).legalMoves().length, 20, '初始局面有 20 个合法走法');

// 被别住的子不能动
const pinned = C.Position.fromFEN('4k3/8/8/8/8/8/4N3/4K2r w - - 0 1');
T.eq(pinned.legalMoves().filter(m => m.from === C.fromAlg('e2')).length, 0,
     '被 h1 车沿第一横行别住的马一步也不能走');
T.ok(pinned.pseudoLegalMoves().filter(m => m.from === C.fromAlg('e2')).length > 0,
     '同一颗子的伪合法走法不为零 —— 差集正是"被别住"');

// 沿别住方向仍可移动
const pinLine = C.Position.fromFEN('4k3/8/8/8/8/8/4R3/4K2r w - - 0 1');
T.ok(pinLine.legalMoves().some(m => m.from === C.fromAlg('e2') && m.to === C.fromAlg('e3')),
     '被沿直列别住的车仍可沿该直列移动');

// 被将军时只能应将
const mustBlock = C.Position.fromFEN('4k3/8/8/8/8/8/8/r3K3 w - - 0 1');
T.ok(mustBlock.legalMoves().every(m => !mustBlock.make(m).inCheck(C.WHITE)),
     '所有合法走法走完之后白王都不再被将军');

// 王不能走到被攻击的格
const kingSafe = C.Position.fromFEN('4k3/8/8/8/8/8/8/4K2r w - - 0 1');
T.ok(!kingSafe.legalMoves().some(m => m.to === C.fromAlg('f1')),
     '白王不能走到仍被 h1 车攻击的 f1');

// ---- status ----
T.eq(C.Position.fromFEN(START).status(), 'ongoing', '初始局面进行中');
T.eq(C.Position.fromFEN('4k3/4R3/8/8/8/8/8/4K3 b - - 0 1').status(), 'check', '被将军但可逃');
T.eq(C.Position.fromFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3').status(),
     'checkmate', 'Fool\'s Mate 是将死');
T.eq(C.Position.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').status(), 'stalemate',
     '黑王无合法走法且未被将军 —— 逼和');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1').status(), 'insufficient',
     '王对王是子力不足');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4KB2 w - - 0 1').status(), 'insufficient',
     '王象对王是子力不足');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4KN2 w - - 0 1').status(), 'insufficient',
     '王马对王是子力不足');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/4KR2 w - - 0 1').status(), 'ongoing',
     '王车对王不是子力不足');
T.eq(C.Position.fromFEN('4k3/8/8/8/8/8/8/R3K3 w - - 100 60').status(), 'fifty',
     '半步计数达到 100 触发五十步规则');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— `pos.legalMoves is not a function`

- [ ] **Step 3: 写实现**

```js
  Position.prototype.legalMoves = function () {
    const me = this.turn, out = [];
    const ms = this.pseudoLegalMoves();
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      const undo = this._make(m);
      if (!this.isAttacked(this.kingSq(me), -me)) out.push(m);
      this._unmake(m, undo);
    }
    return out;
  };

  function insufficientMaterial(pos) {
    let minors = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const t = Math.abs(pos.board[s]);
      if (t === EMPTY || t === K) continue;
      if (t === P || t === R || t === Q) return false;
      minors++;
      if (minors > 1) return false;      // 两个轻子起就可能杀（含异色象）
    }
    return true;
  }

  Position.prototype.status = function () {
    const has = this.legalMoves().length > 0;
    const chk = this.inCheck(this.turn);
    if (!has) return chk ? 'checkmate' : 'stalemate';
    if (insufficientMaterial(this)) return 'insufficient';
    if (this.half >= 100) return 'fifty';
    return chk ? 'check' : 'ongoing';
  };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node chess/core/chess-core.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): 合法走法过滤与局面状态判定"
```

---

## Task 8: perft —— 本阶段的硬验收门

**Files:**
- Modify: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: Task 7 的 `legalMoves`、Task 4 的 `_make`/`_unmake`
- Produces: `ChessCore.perft(pos, depth) → number`；`ChessCore.perftDivide(pos, depth) → { [uci]: count }`（调试用，定位是哪一支的数目不对）

**这是阶段 0 的核心门。perft 不过，后面五个工具全是错的。**

- [ ] **Step 1: 写失败的测试**

```js
// ---- perft ----
// 参考值取自国际象棋编程社区的公认定值。任何一处对不上，
// 都说明走法生成器在某个边界上错了 —— 而人眼查不出这类错。
const PERFT = [
  { name: '初始局面', fen: START,
    counts: [20, 400, 8902, 197281, 4865609] },
  { name: 'Kiwipete', fen: KIWI,
    counts: [48, 2039, 97862, 4085603] },
  { name: '位置3（兵与车的边界）', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    counts: [14, 191, 2812, 43238, 674624] },
  { name: '位置4（升变与别子）', fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    counts: [6, 264, 9467, 422333] },
  { name: '位置5', fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    counts: [44, 1486, 62379, 2103487] },
  { name: '位置6', fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    counts: [46, 2079, 89890, 3894594] },
];

for (const c of PERFT) {
  for (let d = 1; d <= c.counts.length; d++) {
    const t0 = Date.now();
    const got = C.perft(C.Position.fromFEN(c.fen), d);
    const ms = Date.now() - t0;
    T.eq(got, c.counts[d - 1], 'perft ' + c.name + ' depth ' + d + '（用时 ' + ms + 'ms）');
  }
}
```

> 位置 3–6 是国际象棋编程社区标准 perft 测试集里最擅长揪出边界 bug 的几个局面：位置 4 专攻升变与别子，位置 3 专攻兵与车的相互作用。**它们比初始局面更能发现问题**——初始局面 depth 5 全对而位置 4 depth 3 错，是很常见的情形。

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— `C.perft is not a function`

- [ ] **Step 3: 写实现**

```js
  function perft(pos, depth) {
    if (depth <= 0) return 1;
    const ms = pos.legalMoves();
    if (depth === 1) return ms.length;     // 叶子层不必真的走一遍
    let n = 0;
    for (let i = 0; i < ms.length; i++) {
      const undo = pos._make(ms[i]);
      n += perft(pos, depth - 1);
      pos._unmake(ms[i], undo);
    }
    return n;
  }

  // 分支计数：某个 depth 的总数对不上时，用它逐支比对，
  // 一层一层缩小范围直到定位到具体是哪个走法算错了。
  function perftDivide(pos, depth) {
    const out = {};
    const ms = pos.legalMoves();
    for (let i = 0; i < ms.length; i++) {
      const undo = pos._make(ms[i]);
      out[moveToUCI(ms[i])] = perft(pos, depth - 1);
      pos._unmake(ms[i], undo);
    }
    return out;
  }

  function moveToUCI(m) {
    const PROMO_CH = { 2: 'n', 3: 'b', 4: 'r', 5: 'q' };
    return toAlg(m.from) + toAlg(m.to) + (m.promo ? PROMO_CH[m.promo] : '');
  }
```

在 `return` 的对象里加上 `perft`、`perftDivide`、`moveToUCI`。

- [ ] **Step 4: 运行测试并检查耗时**

Run: `node chess/core/chess-core.test.js`
Expected: PASS，全部 perft 值精确匹配。

若某个 depth 对不上，用 `perftDivide` 定位：

```bash
node -e "const C=require('./chess/core/chess-core.js');
console.log(C.perftDivide(C.Position.fromFEN('<出错的 FEN>'), 3));"
```

把输出与参考实现的 divide 结果逐支比对，找到数目不同的那一支，对该支再走一层 divide，直到定位到具体走法。

**性能验收**：整个测试文件应在 **90 秒内**跑完。若超时，先确认 `legalMoves` 里没有在循环中重复调用 `pseudoLegalMoves`；仍超时则把位置 5、6 的最深一层降一级并在测试里注明原因——但**初始局面 depth 5 与 Kiwipete depth 4 不可降**（规格 §7.1 明文必测）。

- [ ] **Step 5: 提交**

```bash
git add chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): perft 与分支计数 —— 六个标准局面全部对上参考值"
```

---

## Task 9: SAN 生成与解析

**Files:**
- Modify: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: Task 7 的 `legalMoves`、Task 8 的 `moveToUCI`
- Produces: `ChessCore.moveToSAN(pos, move) → str`（`pos` 是**走这步之前**的局面）；`ChessCore.parseSAN(pos, str) → Move`（解析失败抛错）

- [ ] **Step 1: 写失败的测试**

```js
// ---- SAN ----
function san(fen, from, to, promo) {
  const p = C.Position.fromFEN(fen);
  const f = C.fromAlg(from), t = C.fromAlg(to);
  const m = p.legalMoves().find(x => x.from === f && x.to === t && (promo ? x.promo === promo : !x.promo));
  return C.moveToSAN(p, m);
}

T.eq(san(START, 'e2', 'e4'), 'e4', '兵推进只写落点');
T.eq(san(START, 'g1', 'f3'), 'Nf3', '子力走动写棋子字母 + 落点');
T.eq(san('8/8/8/3r4/8/8/3R4/K6k w - - 0 1', 'd2', 'd5'), 'Rxd5', '吃子用 x');
T.eq(san('8/8/8/8/8/8/4p3/3P3K b - - 0 1', 'e2', 'e1', C.Q), 'e1=Q+', '升变写 =Q，并带将军号');
T.eq(san('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1', 'g1'), 'O-O', '短易位');
T.eq(san('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1', 'c1'), 'O-O-O', '长易位');
T.eq(san('4k3/8/8/8/8/8/8/4R2K w - - 0 1', 'e1', 'e7'), 'Re7+', '将军加 +');
T.eq(san('4k3/8/4Q3/8/8/8/8/4K3 w - - 0 1', 'e6', 'e7'), 'Qe7+', '后将军');
// 后落 g7 与黑王贴身，且被 g6 的白王保护 —— 这才是真将死。
// （若白王不在 g6，黑王可以 Kxg7，就只是将军而非将死。）
T.eq(san('7k/Q7/6K1/8/8/8/8/8 w - - 0 1', 'a7', 'g7'), 'Qg7#', '将死加 #');

// 兵吃子写起始直列
T.eq(san('8/8/8/3p4/4P3/8/8/K6k w - - 0 1', 'e4', 'd5'), 'exd5', '兵吃子写 e 列 + x');

// 消歧：两颗同种子都能到同一格
T.eq(san('8/8/8/8/8/8/8/R6R w - - 0 1', 'a1', 'd1'), 'Rad1', '同一横行两车 —— 用直列消歧');
T.eq(san('8/8/8/8/8/8/8/R6R w - - 0 1', 'h1', 'd1'), 'Rhd1', '另一侧同理');
T.eq(san('R7/8/8/8/8/8/8/R7 w - - 0 1', 'a1', 'a5'), 'R1a5', '同一直列两车 —— 用横行消歧');
T.eq(san('R7/8/8/8/8/8/8/R7 w - - 0 1', 'a8', 'a5'), 'R8a5', '另一侧同理');
T.eq(san('Q6Q/8/8/8/8/8/8/Q6Q w - - 0 1', 'a1', 'd4'), 'Qa1d4', '直列与横行都不足以消歧时写全格');
// h1 车沿第一横行到 b1 的路上只有空格（a1 在 b1 更左侧，挡不住），
// 所以两车都能到 b1，仍需消歧。
T.eq(san('8/8/8/8/8/8/8/R6R w - - 0 1', 'a1', 'b1'), 'Rab1', 'b1 两车皆可达，用直列消歧');
T.eq(san('8/8/8/8/8/8/8/R6R w - - 0 1', 'h1', 'g1'), 'Rhg1', 'g1 同理');

// 解析：SAN 往返
const sanCases = [
  [START, 'e4'], [START, 'Nf3'], [START, 'd4'],
  ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'O-O'],
  ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'O-O-O'],
  ['8/8/8/3r4/8/8/3R4/K6k w - - 0 1', 'Rxd5'],
  ['8/8/8/8/8/8/8/R6R w - - 0 1', 'Rad1'],
  ['8/8/8/3p4/4P3/8/8/K6k w - - 0 1', 'exd5'],
  ['8/8/8/8/8/8/4p3/3P3K b - - 0 1', 'e1=Q+'],
];
for (const [fen, s] of sanCases) {
  const p = C.Position.fromFEN(fen);
  T.eq(C.moveToSAN(p, C.parseSAN(p, s)), s, 'SAN 往返一致：' + s);
}

// 宽容解析：带不带 +/# 都应该认
const relaxed = C.Position.fromFEN('4k3/8/8/8/8/8/8/4R2K w - - 0 1');
T.eq(C.moveToSAN(relaxed, C.parseSAN(relaxed, 'Re7')), 'Re7+', '省略 + 也能解析');

T.throws(() => C.parseSAN(C.Position.fromFEN(START), 'Qh5'), 'SAN 指向非法走法应抛错');
T.throws(() => C.parseSAN(C.Position.fromFEN(START), 'zz9'), 'SAN 语法错误应抛错');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— `C.moveToSAN is not a function`

- [ ] **Step 3: 写实现**

```js
  const SAN_CH = { 1: '', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  const SAN_TO_CODE = { N: N, B: B, R: R, Q: Q, K: K };

  function moveToSAN(pos, m) {
    if (!m) throw new Error('moveToSAN: move is required');
    let s;
    if (m.flags & FLAG.CASTLE_K) s = 'O-O';
    else if (m.flags & FLAG.CASTLE_Q) s = 'O-O-O';
    else {
      const type = Math.abs(m.piece);
      if (type === P) {
        s = (m.flags & FLAG.CAPTURE) ? toAlg(m.from)[0] + 'x' : '';
        s += toAlg(m.to);
        if (m.promo) s += '=' + SAN_CH[m.promo];
      } else {
        s = SAN_CH[type] + disambiguate(pos, m) +
            ((m.flags & FLAG.CAPTURE) ? 'x' : '') + toAlg(m.to);
      }
    }
    const after = pos.make(m);
    if (after.inCheck(after.turn)) s += after.legalMoves().length ? '+' : '#';
    return s;
  }

  // 消歧规则：先试直列，不够再试横行，还不够就写全格。
  function disambiguate(pos, m) {
    const type = Math.abs(m.piece);
    const rivals = pos.legalMoves().filter(x =>
      x.to === m.to && x.from !== m.from && Math.abs(x.piece) === type);
    if (!rivals.length) return '';
    const sameFile = rivals.some(x => fileOf(x.from) === fileOf(m.from));
    const sameRank = rivals.some(x => rankOf(x.from) === rankOf(m.from));
    if (!sameFile) return toAlg(m.from)[0];
    if (!sameRank) return toAlg(m.from)[1];
    return toAlg(m.from);
  }

  const SAN_RE = /^([NBRQK])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=?([NBRQ]))?[+#]?$/;

  function parseSAN(pos, text) {
    const s = String(text).trim().replace(/[!?]+$/, '');
    const legal = pos.legalMoves();

    if (s === 'O-O' || s === '0-0') {
      const m = legal.find(x => x.flags & FLAG.CASTLE_K);
      if (!m) throw new Error('Illegal SAN "' + text + '": kingside castling is not available');
      return m;
    }
    if (s === 'O-O-O' || s === '0-0-0') {
      const m = legal.find(x => x.flags & FLAG.CASTLE_Q);
      if (!m) throw new Error('Illegal SAN "' + text + '": queenside castling is not available');
      return m;
    }

    const g = SAN_RE.exec(s);
    if (!g) throw new Error('Bad SAN syntax: "' + text + '"');
    const type = g[1] ? SAN_TO_CODE[g[1]] : P;
    const hintF = g[2] ? g[2].charCodeAt(0) - 97 : -1;
    const hintR = g[3] ? g[3].charCodeAt(0) - 49 : -1;
    const to = fromAlg(g[5]);
    const promo = g[6] ? SAN_TO_CODE[g[6]] : 0;

    const hits = legal.filter(x =>
      Math.abs(x.piece) === type && x.to === to &&
      (promo ? x.promo === promo : !x.promo) &&
      (hintF < 0 || fileOf(x.from) === hintF) &&
      (hintR < 0 || rankOf(x.from) === hintR));

    if (hits.length === 1) return hits[0];
    if (!hits.length) throw new Error('Illegal SAN "' + text + '" in position ' + pos.toFEN());
    throw new Error('Ambiguous SAN "' + text + '": ' + hits.length + ' moves match');
  }
```

> 注意 SAN 正则里兵吃子的起始直列（`exd5` 的 `e`）与子力消歧的直列（`Rad1` 的 `a`）落在同一个捕获组 `g[2]`——两者语义相同（都是"起点在这一列"），所以一条规则就够。

- [ ] **Step 4: 运行测试确认通过**

Run: `node chess/core/chess-core.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): SAN 生成与解析，含完整消歧规则"
```

---

## Task 10: UCI 生成与解析

**Files:**
- Modify: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: Task 8 的 `moveToUCI`、Task 7 的 `legalMoves`
- Produces: `ChessCore.parseUCI(pos, str) → Move`

规格 §3.1 要求 SAN ⇄ UCI 双记法：棋书与棋谱说 SAN，算法题与引擎接口说 UCI。

- [ ] **Step 1: 写失败的测试**

```js
// ---- UCI ----
const u0 = C.Position.fromFEN(START);
T.eq(C.moveToUCI(C.parseSAN(u0, 'e4')), 'e2e4', 'SAN e4 的 UCI 是 e2e4');
T.eq(C.moveToUCI(C.parseSAN(u0, 'Nf3')), 'g1f3', 'SAN Nf3 的 UCI 是 g1f3');
T.eq(C.moveToSAN(u0, C.parseUCI(u0, 'e2e4')), 'e4', 'UCI e2e4 的 SAN 是 e4');

const uc = C.Position.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
T.eq(C.moveToUCI(C.parseSAN(uc, 'O-O')), 'e1g1', '短易位的 UCI 记王的起讫格');
T.eq(C.moveToSAN(uc, C.parseUCI(uc, 'e1c1')), 'O-O-O', 'UCI e1c1 解析回长易位');

const up = C.Position.fromFEN('8/8/8/8/8/8/4p3/3P3K b - - 0 1');
T.eq(C.moveToUCI(C.parseUCI(up, 'e2e1q')), 'e2e1q', '升变的 UCI 带小写棋子字母');
T.eq(C.moveToSAN(up, C.parseUCI(up, 'e2e1n')), 'e1=N', 'underpromotion 也能解析');

T.throws(() => C.parseUCI(u0, 'e2e5'), 'UCI 指向非法走法应抛错');
T.throws(() => C.parseUCI(u0, 'xx'), 'UCI 语法错误应抛错');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— `C.parseUCI is not a function`

- [ ] **Step 3: 写实现**

```js
  const UCI_RE = /^([a-h][1-8])([a-h][1-8])([nbrq])?$/;
  const UCI_TO_CODE = { n: N, b: B, r: R, q: Q };

  function parseUCI(pos, text) {
    const g = UCI_RE.exec(String(text).trim());
    if (!g) throw new Error('Bad UCI syntax: "' + text + '" (expected e.g. e2e4 or e7e8q)');
    const from = fromAlg(g[1]), to = fromAlg(g[2]);
    const promo = g[3] ? UCI_TO_CODE[g[3]] : 0;
    const m = pos.legalMoves().find(x =>
      x.from === from && x.to === to && (promo ? x.promo === promo : !x.promo));
    if (!m) throw new Error('Illegal UCI move "' + text + '" in position ' + pos.toFEN());
    return m;
  }
```

在 `return` 的对象里加上 `parseUCI`、`moveToSAN`、`parseSAN`。

- [ ] **Step 4: 运行测试确认通过**

Run: `node chess/core/chess-core.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): UCI 解析 —— 与 SAN 双向互通"
```

---

## Task 11: PGN 解析与写出

**Files:**
- Modify: `chess/core/chess-core.js`
- Test: `chess/core/chess-core.test.js`

**Interfaces:**
- Consumes: Task 9 的 `parseSAN` / `moveToSAN`
- Produces: `ChessCore.parsePGN(text) → { headers, moves, result, positions }`，其中 `moves` 是 `Move[]`、`positions` 是逐步的 `Position[]`（长度 = `moves.length + 1`，含起始局面）；`ChessCore.writePGN(headers, moves, startFEN) → str`

**范围**（规格 §9）：只支持主线 + 标准标签对。遇到变着 `( … )` 与注释 `{ … }` 时**跳过并记入 `skipped` 计数**，不报错退出。

- [ ] **Step 1: 写失败的测试**

```js
// ---- PGN ----
const FOOLS = [
  '[Event "Fool\'s Mate"]',
  '[Site "?"]',
  '[Date "????.??.??"]',
  '[White "?"]',
  '[Black "?"]',
  '[Result "0-1"]',
  '',
  '1. f3 e5 2. g4 Qh4# 0-1',
].join('\n');

const g1 = C.parsePGN(FOOLS);
T.eq(g1.headers.Event, "Fool's Mate", 'PGN 标签解析正确');
T.eq(g1.headers.Result, '0-1', 'Result 标签解析正确');
T.eq(g1.result, '0-1', '棋谱结果解析正确');
T.eq(g1.moves.length, 4, 'Fool\'s Mate 共 4 个半步');
T.eq(g1.positions.length, 5, 'positions 比 moves 多一个起始局面');
T.eq(g1.positions[0].toFEN(), START, 'positions[0] 是初始局面');
T.eq(g1.positions[4].status(), 'checkmate', '最后一个局面是将死');

// 走法逐步重放 —— 抄错一步就会在这里当场走不通
const replayed = g1.moves.map((m, i) => C.moveToSAN(g1.positions[i], m));
T.eq(replayed, ['f3', 'e5', 'g4', 'Qh4#'], '逐步重放得到原样的 SAN 序列');

// 归一化往返
const written = C.writePGN(g1.headers, g1.moves);
T.eq(C.parsePGN(written).moves.length, 4, 'writePGN 的输出能被 parsePGN 读回');
T.ok(written.indexOf('1. f3 e5 2. g4 Qh4#') >= 0, 'writePGN 输出标准的回合编号格式');

// Scholar's Mate
const SCHOLARS = '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7# 1-0';
const g2 = C.parsePGN(SCHOLARS);
T.eq(g2.moves.length, 7, 'Scholar\'s Mate 共 7 个半步');
T.eq(g2.result, '1-0', '无标签时也能从结果标记读出胜负');
T.eq(g2.positions[7].status(), 'checkmate', 'Scholar\'s Mate 结尾是将死');

// 注释与变着被跳过而非报错
const WITH_NOISE = '1. e4 {好棋} e5 2. Nf3 (2. f4 exf4) Nc6 *';
const g3 = C.parsePGN(WITH_NOISE);
T.eq(g3.moves.length, 4, '注释与变着被跳过，主线 4 个半步');
T.ok(g3.skipped > 0, '跳过的内容被计数，不静默');

// 从非初始局面开始
const FROM_FEN = '[FEN "4k3/8/8/8/8/8/8/4K2R w K - 0 1"]\n[SetUp "1"]\n\n1. O-O *';
const g4 = C.parsePGN(FROM_FEN);
T.eq(g4.positions[0].toFEN(), '4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'FEN 标签作为起始局面');
T.eq(C.moveToSAN(g4.positions[0], g4.moves[0]), 'O-O', '从自定义局面开始的走法解析正确');

// 抄错的棋谱必须报错，且指明第几步
T.throws(() => C.parsePGN('1. e4 e5 2. Qh5 Qh4 3. Nf7 *'),
         '非法走法应抛错（Nf7 在该局面下走不通）');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/chess-core.test.js`
Expected: FAIL —— `C.parsePGN is not a function`

- [ ] **Step 3: 写实现**

```js
  const TAG_RE = /\[\s*(\w+)\s*"((?:[^"\\]|\\.)*)"\s*\]/g;
  const RESULTS = ['1-0', '0-1', '1/2-1/2', '*'];

  function parsePGN(text) {
    const src = String(text);
    const headers = {};
    let m, tagEnd = 0;
    TAG_RE.lastIndex = 0;
    // 注意：exec 返回 null 时 lastIndex 会被重置为 0，所以必须在循环里
    // 自己记住最后一个标签的结束位置，不能循环结束后再读 lastIndex。
    while ((m = TAG_RE.exec(src))) {
      headers[m[1]] = m[2].replace(/\\(.)/g, '$1');
      tagEnd = TAG_RE.lastIndex;
    }
    const body = src.slice(tagEnd);      // 无标签时 tagEnd 为 0，即全文

    let skipped = 0;
    // 逐层剥掉 { } 注释与 ( ) 变着（可嵌套）
    let clean = '', depth = 0;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '{' || ch === '(') { depth++; if (depth === 1) skipped++; continue; }
      if (ch === '}' || ch === ')') { if (depth > 0) depth--; continue; }
      if (depth === 0) clean += ch;
    }
    clean = clean.replace(/;[^\n]*/g, '')          // 行注释
                 .replace(/\$\d+/g, '')            // NAG
                 .replace(/\d+\s*\.(\.\.)?/g, ' ') // 回合编号
                 .replace(/\s+/g, ' ').trim();

    const startFEN = (headers.SetUp === '1' && headers.FEN) ? headers.FEN
                   : (headers.FEN || null);
    let pos = startFEN ? Position.fromFEN(startFEN) : Position.fromFEN(START_FEN);

    const moves = [], positions = [pos];
    let result = '*';
    const tokens = clean ? clean.split(' ') : [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (!tk) continue;
      if (RESULTS.indexOf(tk) >= 0) { result = tk; break; }
      let mv;
      try {
        mv = parseSAN(pos, tk);
      } catch (e) {
        throw new Error('PGN move ' + (moves.length + 1) + ' ("' + tk + '") is illegal: ' + e.message);
      }
      moves.push(mv);
      pos = pos.make(mv);
      positions.push(pos);
    }
    if (headers.Result && RESULTS.indexOf(headers.Result) >= 0 && result === '*') {
      result = headers.Result;
    }
    return { headers: headers, moves: moves, positions: positions,
             result: result, skipped: skipped, startFEN: startFEN };
  }

  function writePGN(headers, moves, startFEN) {
    const out = [];
    const seven = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
    for (let i = 0; i < seven.length; i++) {
      const k = seven[i];
      const v = (headers && headers[k] != null) ? String(headers[k]) : '?';
      out.push('[' + k + ' "' + v.replace(/["\\]/g, '\\$&') + '"]');
    }
    for (const k in headers) {
      if (seven.indexOf(k) >= 0) continue;
      out.push('[' + k + ' "' + String(headers[k]).replace(/["\\]/g, '\\$&') + '"]');
    }
    out.push('');

    let pos = startFEN ? Position.fromFEN(startFEN) : Position.fromFEN(START_FEN);
    const toks = [];
    for (let i = 0; i < moves.length; i++) {
      if (pos.turn === WHITE) toks.push(pos.full + '.');
      toks.push(moveToSAN(pos, moves[i]));
      pos = pos.make(moves[i]);
    }
    const res = (headers && headers.Result) || '*';
    toks.push(res);

    // 按 80 列折行，这是 PGN 的通行写法
    let line = '';
    for (let i = 0; i < toks.length; i++) {
      if (line && line.length + 1 + toks[i].length > 80) { out.push(line); line = ''; }
      line = line ? line + ' ' + toks[i] : toks[i];
    }
    if (line) out.push(line);
    return out.join('\n') + '\n';
  }
```

在文件顶部常量区加上：

```js
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
```

并在 `return` 的对象里加上 `parsePGN`、`writePGN`、`START_FEN`。

- [ ] **Step 4: 运行测试确认通过**

Run: `node chess/core/chess-core.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add chess/core/chess-core.js chess/core/chess-core.test.js
git commit -m "feat(chess): PGN 解析与写出 —— 主线支持，变着与注释跳过并计数"
```

---

## Task 12: 裁剪 3D 引擎

**Files:**
- Create: `chess/core/viz-engine.js`
- Read: `design-system/math-viz-starter.html`

**Interfaces:**
- Consumes: 无（独立模块）
- Produces: `VizEngine.init({ canvas })`；相机 `VizEngine.cam`（`{az, el, dist, tx, ty, tz}`）与 `makeCam() → C`；投影 `proj(C, [x,y,z]) → [sx,sy] | null`；绘图原语 `strokePoly(C, pts, opt)`、`line3(C, a, b, opt)`、`glowDot(s, r, core, mid)`、`solidDot(C, p, r, color)`、`label3(C, p, text, opt)`、`arrowAt(C, tip3, before3, color)`、`drawAxes(C, opt)`、`drawGridXY(C, g, step)`；工具函数 `clamp` / `fmt` / `fmtS` / `t(strObj)`；交互 `bindOrbit(canvas)`

**从 starter 搬运的区段**（按行号，以 `design-system/math-viz-starter.html` 当前版本为准，搬运时以区段注释定位而非硬编码行号）：

| starter 区段 | 处置 |
|---|---|
| `i18n 核心（引擎区）` | **保留**，但默认语言改 `en`、`localStorage` 键改 `chess-lang` |
| `常量与状态` | **部分保留**：`NEAR`、`FONT_CN`、`FONT_MATH`、`REDUCED`。**删除** `WAVE_LEN`、`samples`、`state.theta`、`pushSample` |
| `画布` | **原样保留**（`resize` / DPR / `bgGrad`）|
| `基础数学` | **原样保留** |
| `轨道相机与投影` | **原样保留**（`makeCam` / `camPt` / `scr` / `proj` / `clipNear` / `polyPath` / `strokePoly` / `line3`）|
| `常用场景部件` | **部分保留**：`glowDot` / `solidDot` / `label3` / `arrowAt` / `drawAxes` / `drawGridXY`。**删除** `drawTimeGrid` / `drawPeriodBracket` / `drawCircle` / `drawAngleArc` / `readoutHead` —— 这些是三角函数工具专用 |
| `主绘制与主循环` | **保留** `frameError` 与 `requestAnimationFrame` 循环骨架。**删除**时间积分 `theta += ω·dt` |
| `场景作用域参数与时间驱动` | **删除整段** —— 棋是离散的，没有连续时间驱动 |
| `UI 生成` | **保留**（滑杆/开关由声明生成的机制在算法工具里仍要用）|
| `视角与页签` | **保留**视角预设与相机补间（`tween` / `lastView` / `cams`）。**录制部分单独处理**，见下 |
| `播放/重置/折叠` | **保留** |
| `语言切换` | **保留**，默认改 `en` |
| `交互：旋转/平移/缩放` | **原样保留** |
| `启动` | **改写**为 `VizEngine.init()` |

**录制框架（§11）**：starter 里 `recState` / `recHooks` / 序列化 / 下载上传 / 回放时钟这一整套**整体搬运**，但把"存档格式"的序列化与反序列化留成钩子——阶段 2 会把它接到 PGN 上（规格 §1.3）。本任务只搬运骨架并确认它在没有 `RECORD` 声明时完全静默（starter 已有此行为）。

- [ ] **Step 1: 建立文件骨架与 UMD 包装**

Create `chess/core/viz-engine.js`：

```js
/* 3D 渲染引擎 —— 由 design-system/math-viz-starter.html 裁剪而来。
   保留：轨道相机、透视投影与近裁剪、绘图原语、设计令牌、UI 组件、
         i18n、录制回放骨架。
   删除：连续时间积分、samples 环形缓冲、三角函数专用部件。
   编辑源，运行时被内联进 tools/*.html。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VizEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // 搬运内容按上表逐段填入
  return { /* 见 Interfaces */ };
});
```

- [ ] **Step 2: 逐段搬运**

按上表处置逐段复制。搬运时把区段注释一并带过来（例如 `/* ================= 轨道相机与投影 ================= */`），这样将来对照 starter 的改动时能一眼对上。

把 i18n 的两处默认值改掉：

```js
  const LANG_KEY = 'chess-lang';
  function resolveLang() {
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (q === 'en' || q === 'zh') return q;
      const s = localStorage.getItem(LANG_KEY);
      if (s === 'en' || s === 'zh') return s;
    } catch (e) { /* file:// 下 localStorage 可能不可用 */ }
    return 'en';                       // 本子项目默认英文（规格 §1.6）
  }
  function t(s) { return (s && typeof s === 'object') ? (s[LANG] != null ? s[LANG] : s.en) : s; }
```

> `t()` 的兜底从 `s.zh` 改成 `s.en` —— 与默认语言一致，否则缺 `en` 键时会突然冒出中文。

- [ ] **Step 3: 语法检查**

Run: `node --check chess/core/viz-engine.js`
Expected: 无输出（通过）

- [ ] **Step 4: 确认删除彻底**

Run:
```bash
grep -nE 'WAVE_LEN|pushSample|samples|drawTimeGrid|drawPeriodBracket|drawAngleArc|state\.theta' chess/core/viz-engine.js
```
Expected: 无输出。若有命中，说明该删的没删干净。

- [ ] **Step 5: 确认导出完整**

Run:
```bash
node -e "
const E = require('./chess/core/viz-engine.js');
const need = ['makeCam','proj','strokePoly','line3','glowDot','solidDot','label3',
              'arrowAt','drawAxes','drawGridXY','clamp','fmt','fmtS','t','init','bindOrbit'];
const missing = need.filter(k => typeof E[k] === 'undefined');
if (missing.length) { console.error('缺少导出：' + missing.join(', ')); process.exit(1); }
console.log('导出完整：' + need.length + ' 项');
"
```
Expected: `导出完整：16 项`

> 这一步在 node 里加载浏览器模块会因缺少 `document` 而失败——因此 `init` 与 `bindOrbit` 必须写成**调用时才碰 DOM**，模块顶层不得直接访问 `document`。这是本任务的一条硬约束，它同时让引擎可测。

- [ ] **Step 6: 提交**

```bash
git add chess/core/viz-engine.js
git commit -m "feat(chess): 裁剪 3D 引擎 —— 去掉连续时间驱动与三角函数专用部件"
```

---

## Task 13: 参数化棋盘渲染

**Files:**
- Create: `chess/core/board-render.js`
- Test: `chess/core/board-render.test.js`

**Interfaces:**
- Consumes: Task 12 的 `proj` / `strokePoly` / `label3`（通过参数注入，不硬依赖全局）
- Produces: `BoardRender.layout({ files, ranks, cell }) → { files, ranks, cell, w, h, squareCenter(f, r) → [x,y,z], squareCorners(f, r) → [[x,y,z]×4] }`；`BoardRender.drawBoard(ctx, C, E, spec)`；`BoardRender.fileLabel(i) → 'a'..'l'`

棋盘躺在 **z = 0 平面**上，中心在原点。`squareCenter` 返回世界坐标；`cell` 是一格的世界边长（默认 1）。

- [ ] **Step 1: 写失败的测试**

Create `chess/core/board-render.test.js`：

```js
'use strict';
const T = require('./_test.js');
const BR = require('./board-render.js');

// ---- 布局 ----
const L8 = BR.layout({ files: 8, ranks: 8, cell: 1 });
T.eq(L8.w, 8, '8×8 棋盘宽 8');
T.eq(L8.h, 8, '8×8 棋盘高 8');
T.eq(L8.squareCenter(0, 0), [-3.5, -3.5, 0], 'a1 的中心在左下');
T.eq(L8.squareCenter(7, 7), [3.5, 3.5, 0], 'h8 的中心在右上');
T.eq(L8.squareCenter(4, 3), [0.5, -0.5, 0], 'e4 的中心');
T.ok(L8.squareCenter(0, 0).every(v => Math.abs(v) < 4), '棋盘以原点为中心');

// 非 8×8
const L4 = BR.layout({ files: 4, ranks: 4, cell: 1 });
T.eq(L4.squareCenter(0, 0), [-1.5, -1.5, 0], '4×4 棋盘 a1 的中心');
T.eq(L4.squareCenter(3, 3), [1.5, 1.5, 0], '4×4 棋盘 d4 的中心');

const L12 = BR.layout({ files: 12, ranks: 12, cell: 1 });
T.eq(L12.squareCenter(11, 11), [5.5, 5.5, 0], '12×12 棋盘右上角的中心');

// 非方形（为将来的变体题留的）
const L58 = BR.layout({ files: 5, ranks: 8, cell: 1 });
T.eq(L58.w, 5, '非方形棋盘宽度取 files');
T.eq(L58.h, 8, '非方形棋盘高度取 ranks');

// cell 缩放
const Lc = BR.layout({ files: 8, ranks: 8, cell: 0.5 });
T.eq(Lc.squareCenter(0, 0), [-1.75, -1.75, 0], 'cell=0.5 时坐标等比缩小');
T.eq(Lc.w, 4, 'cell=0.5 时总宽减半');

// 四角
const c = L8.squareCorners(0, 0);
T.eq(c.length, 4, '一格有 4 个角');
T.eq(c[0], [-4, -4, 0], 'a1 的左下角就是棋盘的左下角');
T.eq(c[2], [-3, -3, 0], 'a1 的右上角');

// ---- 直列标注 ----
T.eq(BR.fileLabel(0), 'a', '第 0 列是 a');
T.eq(BR.fileLabel(7), 'h', '第 7 列是 h');
T.eq(BR.fileLabel(11), 'l', '12×12 棋盘的最后一列是 l');

// ---- 格子明暗 ----
T.eq(BR.isLight(0, 0), false, 'a1 是深色格（国际象棋惯例：右下角为浅色）');
T.eq(BR.isLight(7, 0), true, 'h1 是浅色格');
T.eq(BR.isLight(0, 7), true, 'a8 是浅色格');

T.report();
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/board-render.test.js`
Expected: FAIL —— `Cannot find module './board-render.js'`

- [ ] **Step 3: 写实现**

Create `chess/core/board-render.js`：

```js
/* 参数化棋盘与棋子渲染。棋盘躺在 z=0 平面、以原点为中心。
   算法工具与规则工具共用同一套 —— 八皇后摆的是真正的后。
   零依赖；node 与浏览器双用。编辑源，运行时被内联。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BoardRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function layout(spec) {
    const files = (spec && spec.files) || 8;
    const ranks = (spec && spec.ranks) || 8;
    const cell = (spec && spec.cell) || 1;
    const w = files * cell, h = ranks * cell;
    const x0 = -w / 2, y0 = -h / 2;

    return {
      files: files, ranks: ranks, cell: cell, w: w, h: h,
      squareCenter: function (f, r) {
        return [x0 + (f + 0.5) * cell, y0 + (r + 0.5) * cell, 0];
      },
      squareCorners: function (f, r) {
        const x = x0 + f * cell, y = y0 + r * cell;
        return [[x, y, 0], [x + cell, y, 0], [x + cell, y + cell, 0], [x, y + cell, 0]];
      },
    };
  }

  function fileLabel(i) { return String.fromCharCode(97 + i); }

  // a1 是深色格。第 0 列第 0 行 → (0+0)%2===0 → 深。
  function isLight(f, r) { return ((f + r) & 1) === 1; }

  return { layout: layout, fileLabel: fileLabel, isLight: isLight };
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node chess/core/board-render.test.js`
Expected: PASS —— 输出以 `0 failed` 结尾

- [ ] **Step 5: 加上 `drawBoard`（浏览器侧，无法在 node 里断言）**

在 `return` 之前插入：

```js
  const SQ_DARK = 'rgba(30,41,59,0.55)';
  const SQ_LIGHT = 'rgba(148,163,184,0.16)';
  const EDGE = 'rgba(159,176,200,0.55)';
  const COORD = 'rgba(159,176,200,0.75)';

  /* ctx: CanvasRenderingContext2D；C: 相机；E: VizEngine（注入而非全局引用，
     这样本模块在 node 里可加载、可测，不需要 DOM）。 */
  function drawBoard(ctx, C, E, spec) {
    const L = spec.layout || layout(spec);
    const mask = spec.mask || null;

    for (let r = 0; r < L.ranks; r++) {
      for (let f = 0; f < L.files; f++) {
        if (mask && mask(f, r) === false) continue;
        const cs = L.squareCorners(f, r);
        const pts = cs.map(function (p) { return E.proj(C, p); });
        if (pts.some(function (p) { return !p; })) continue;   // 近裁剪掉的格不画
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = isLight(f, r) ? SQ_LIGHT : SQ_DARK;
        ctx.fill();
      }
    }

    // 外框
    const o = L.squareCorners(0, 0)[0];
    const frame = [o, [o[0] + L.w, o[1], 0], [o[0] + L.w, o[1] + L.h, 0], [o[0], o[1] + L.h, 0], o];
    E.strokePoly(C, frame, { color: EDGE, width: 1.4 });

    if (spec.coords !== false) {
      for (let f = 0; f < L.files; f++) {
        const c = L.squareCenter(f, 0);
        E.label3(C, [c[0], o[1] - 0.42 * L.cell, 0], fileLabel(f),
                 { color: COORD, size: 12, align: 'center' });
      }
      for (let r = 0; r < L.ranks; r++) {
        const c = L.squareCenter(0, r);
        E.label3(C, [o[0] - 0.42 * L.cell, c[1], 0], String(r + 1),
                 { color: COORD, size: 12, align: 'center' });
      }
    }
    return L;
  }
```

在 `return` 的对象里加上 `drawBoard`。

- [ ] **Step 6: 语法检查并确认 node 仍可加载**

Run: `node chess/core/board-render.test.js`
Expected: 仍然 PASS（`drawBoard` 未被调用，但模块顶层不碰 DOM，所以加载无碍）

- [ ] **Step 7: 提交**

```bash
git add chess/core/board-render.js chess/core/board-render.test.js
git commit -m "feat(chess): 参数化棋盘渲染 —— 尺寸可变、坐标标注自适应"
```

---

## Task 14: 棋子 SVG 路径与渲染

**Files:**
- Modify: `chess/core/board-render.js`
- Modify: `chess/core/board-render.test.js`
- Create: `chess/tools/_piece-preview.html`

**Interfaces:**
- Consumes: Task 13 的 `layout`
- Produces: `BoardRender.PIECE_PATHS`（`{ P, N, B, R, Q, K }` → SVG path `d` 字符串数组，坐标在 `0..100` 方框内、y 向下）；`BoardRender.drawPiece(ctx, C, E, { code, center, scale, alpha })`，`code` 为带符号棋子码（正=白、负=黑）

**性能预算**：32 子 @ 60fps（规格 §2.5）。本任务末尾必须实测并记录。

- [ ] **Step 1: 写失败的测试**

追加到 `chess/core/board-render.test.js`（`T.report()` 之前）：

```js
// ---- 棋子路径 ----
const KEYS = ['P', 'N', 'B', 'R', 'Q', 'K'];
for (const k of KEYS) {
  T.ok(Array.isArray(BR.PIECE_PATHS[k]), k + ' 有路径数组');
  T.ok(BR.PIECE_PATHS[k].length > 0, k + ' 的路径数组非空');
  for (const d of BR.PIECE_PATHS[k]) {
    T.ok(typeof d === 'string' && d.length > 0, k + ' 的每条路径都是非空字符串');
    T.ok(/^M/.test(d.trim()), k + ' 的路径以 M 开头');
    T.ok(/[zZ]\s*$/.test(d.trim()), k + ' 的路径以 z 闭合');
    // 坐标必须落在 0..100 的设计框内，否则缩放会串位
    const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
    T.ok(nums.every(n => n >= -10 && n <= 110), k + ' 的坐标在设计框范围内');
  }
}
T.eq(Object.keys(BR.PIECE_PATHS).sort(), KEYS.slice().sort(), '六种棋子齐全，无多余键');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node chess/core/board-render.test.js`
Expected: FAIL —— `Cannot read properties of undefined (reading 'P')`

- [ ] **Step 3: 写路径数据与 `drawPiece`**

在 `board-render.js` 的 `return` 之前插入：

```js
  /* 棋子写成 SVG 路径（0..100 方框，y 向下，底座压在 y≈98）。
     运行时用 Path2D 交给 Canvas 2D 绘制 —— 保留 SVG 的作者体验，
     又不引入任何外部文件或加载器。将来若上 3D，替换 drawPiece 即可，
     路径数据可作为旋转体的侧影复用（马除外）。 */
  const PIECE_PATHS = {
    P: [
      'M39 24 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 z',
      'M40 37 h20 l3 8 h-26 z',
      'M44 47 h12 l7 31 h-26 z',
      'M28 78 h44 v10 h-44 z',
      'M24 88 h52 v10 h-52 z',
    ],
    N: [
      'M32 88 c-2 -27 9 -41 21 -49 c-3 -6 -7 -8 -11 -8 l7 -11 c7 1 13 6 17 12 ' +
      'c7 12 8 31 6 56 z',
      'M44 26 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 z',
      'M24 88 h52 v10 h-52 z',
    ],
    B: [
      'M50 10 c9 7 15 17 15 27 c0 9 -7 15 -15 15 c-8 0 -15 -6 -15 -15 ' +
      'c0 -10 6 -20 15 -27 z',
      'M46 22 h8 v6 h6 v8 h-6 v6 h-8 v-6 h-6 v-8 h6 z',
      'M40 54 h20 l5 24 h-30 z',
      'M28 78 h44 v10 h-44 z',
      'M24 88 h52 v10 h-52 z',
    ],
    R: [
      'M28 14 h9 v7 h8 v-7 h10 v7 h8 v-7 h9 v20 h-6 v32 h8 v12 h-48 v-12 h8 v-32 h-6 z',
      'M24 88 h52 v10 h-52 z',
    ],
    Q: [
      'M24 32 l7 34 h38 l7 -34 l-12 16 l-8 -24 l-7 24 l-7 -24 l-8 24 z',
      'M22 28 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 z',
      'M70 28 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 z',
      'M46 18 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 z',
      'M31 66 h38 l4 12 h-46 z',
      'M24 88 h52 v10 h-52 z',
    ],
    K: [
      'M46 6 h8 v9 h9 v8 h-9 v11 h-8 v-11 h-9 v-8 h9 z',
      'M30 36 c7 -8 33 -8 40 0 l-5 30 h-30 z',
      'M31 66 h38 l4 12 h-46 z',
      'M24 88 h52 v10 h-52 z',
    ],
  };

  const CODE_KEY = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };

  const WHITE_FILL = 'rgba(226,232,240,0.94)';
  const WHITE_EDGE = 'rgba(15,23,42,0.85)';
  const BLACK_FILL = 'rgba(15,23,42,0.90)';
  const BLACK_EDGE = 'rgba(148,163,184,0.90)';

  const pathCache = Object.create(null);
  function path2d(d) {
    if (!pathCache[d]) pathCache[d] = new Path2D(d);
    return pathCache[d];
  }

  /* 棋子画成朝向相机的剪影：把它的世界坐标投影成屏幕点，
     然后在屏幕空间里以该点为基准绘制。这样任意相机角度下都读得清。 */
  function drawPiece(ctx, C, E, o) {
    const s = E.proj(C, o.center);
    if (!s) return;
    const key = CODE_KEY[Math.abs(o.code)];
    if (!key) return;
    const white = o.code > 0;
    const k = (o.scale || 1) / 100;

    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(s[0], s[1]);
    ctx.scale(k, k);
    ctx.translate(-50, -88);            // 以底座中点对齐格心
    ctx.fillStyle = white ? WHITE_FILL : BLACK_FILL;
    ctx.strokeStyle = white ? WHITE_EDGE : BLACK_EDGE;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    const ds = PIECE_PATHS[key];
    for (let i = 0; i < ds.length; i++) {
      const p = path2d(ds[i]);
      ctx.fill(p);
      ctx.stroke(p);
    }
    ctx.restore();
  }
```

在 `return` 的对象里加上 `PIECE_PATHS`、`drawPiece`。

- [ ] **Step 4: 运行测试确认通过**

Run: `node chess/core/board-render.test.js`
Expected: PASS

- [ ] **Step 5: 建预览页做视觉验收与帧率实测**

Create `chess/tools/_piece-preview.html` —— 一个只做两件事的临时页面：把六种棋子各画一遍（白/黑、24px 与 96px 两档），以及在 8×8 盘上摆满 32 子转相机测帧率。页面内联 `board-render.js` 与 `viz-engine.js` 的内容（本阶段手工粘贴，Task 15 之后改由 `inline_core.py` 注入）。

帧率探针写在页面里：

```js
let frames = 0, t0 = performance.now(), fps = 0;
function tick() {
  frames++;
  const now = performance.now();
  if (now - t0 >= 1000) { fps = frames; frames = 0; t0 = now; }
  document.getElementById('fps').textContent = fps + ' fps';
  cam.az += 0.006;                     // 持续转相机，测最坏情况
  draw();
  requestAnimationFrame(tick);
}
```

- [ ] **Step 6: 视觉与性能验收**

在浏览器打开 `chess/tools/_piece-preview.html`，逐条确认：

1. **24px 下六种棋子可区分** —— 尤其 B 与 P（都是圆头）、Q 与 K（都是冠状）。分不清就调整该棋子的路径，直到分得清。
2. **黑白两方在深色背景上都读得清** —— 黑子靠浅色描边成立。
3. **32 子 + 持续转相机 ≥ 55fps**（预算 60fps，留 5 帧余量）。

若帧率不达标，按此顺序处理：① 确认 `Path2D` 走的是 `pathCache` 而非每帧新建；② 合并每种棋子的多条路径为单条（用 `Path2D.addPath`）；③ 仍不达标则按规格 §10 降级为纯色圆盘 + 棋子字母，并把实测数字记进本计划的完成记录。

把实测帧率写进提交信息，这是规格 §2.5 要求的"从第一天起记录性能预算"。

- [ ] **Step 7: 提交**

```bash
git add chess/core/board-render.js chess/core/board-render.test.js chess/tools/_piece-preview.html
git commit -m "feat(chess): 棋子 SVG 路径与 Path2D 渲染（32 子实测 NN fps）"
```

---

## Task 15: 内联同步脚本与校验

**Files:**
- Create: `chess/scripts/inline_core.py`
- Create: `chess/scripts/check.py`
- Create: `chess/tools/_skeleton.html`
- Modify: `.githooks/pre-commit`
- Modify: `.github/workflows/registry-sync.yml`

**Interfaces:**
- Consumes: Task 1–14 的全部 `core/*.js`
- Produces: `python3 chess/scripts/inline_core.py` 重写全部 `chess/tools/*.html` 的 GENERATED 区间；`python3 chess/scripts/check.py` 仅校验，不一致则 exit 1

标记区间（规格 §2.1）：

```
/* >>> GENERATED:CHESS-CORE */ … /* <<< GENERATED:CHESS-CORE */
/* >>> GENERATED:BOARD-RENDER */ … /* <<< GENERATED:BOARD-RENDER */
/* >>> GENERATED:VIZ-ENGINE */ … /* <<< GENERATED:VIZ-ENGINE */
```

- [ ] **Step 1: 建最小工具骨架**

Create `chess/tools/_skeleton.html`：

```html
<!doctype html>
<meta charset="utf-8">
<meta name="tool-version" content="0.0.0">
<meta name="engine-version" content="chess-0.1.0">
<title>Chess subproject skeleton</title>
<canvas id="scene"></canvas>
<script>
/* >>> GENERATED:VIZ-ENGINE */
/* <<< GENERATED:VIZ-ENGINE */
/* >>> GENERATED:CHESS-CORE */
/* <<< GENERATED:CHESS-CORE */
/* >>> GENERATED:BOARD-RENDER */
/* <<< GENERATED:BOARD-RENDER */
</script>
```

这个骨架的唯一用途是让同步脚本有东西可注入、有东西可校验。真正的工具从阶段 1 起才出现。

- [ ] **Step 2: 写 `inline_core.py`**

Create `chess/scripts/inline_core.py`：

```python
#!/usr/bin/env python3
"""把 chess/core/*.js 注入 chess/tools/*.html 的 GENERATED 标记区间。

core/*.js 是唯一编辑源；每个 html 运行时完全自足，file:// 双击可用。
照抄 scripts/sync_registry.py 的纪律：生成区间禁止手改。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = {
    'VIZ-ENGINE': ROOT / 'core' / 'viz-engine.js',
    'CHESS-CORE': ROOT / 'core' / 'chess-core.js',
    'BOARD-RENDER': ROOT / 'core' / 'board-render.js',
}


def block(tag: str, body: str) -> str:
    return (f'/* >>> GENERATED:{tag} */\n'
            f'{body.rstrip()}\n'
            f'/* <<< GENERATED:{tag} */')


def pattern(tag: str) -> re.Pattern:
    return re.compile(
        r'/\* >>> GENERATED:' + re.escape(tag) + r' \*/.*?'
        r'/\* <<< GENERATED:' + re.escape(tag) + r' \*/',
        re.DOTALL)


def render(text: str) -> tuple[str, list[str]]:
    """返回注入后的文本与本文件缺失的标记列表。"""
    missing = []
    for tag, src in SOURCES.items():
        pat = pattern(tag)
        if not pat.search(text):
            missing.append(tag)
            continue
        body = src.read_text(encoding='utf-8')
        text = pat.sub(lambda _m: block(tag, body), text, count=1)
    return text, missing


def main(check_only: bool = False) -> int:
    for src in SOURCES.values():
        if not src.exists():
            print(f'ERROR: 缺少编辑源 {src.relative_to(ROOT.parent)}', file=sys.stderr)
            return 1

    tools = sorted((ROOT / 'tools').glob('*.html'))
    if not tools:
        print('WARN: chess/tools/ 下没有 html，本次无事可做')
        return 0

    stale = []
    for path in tools:
        original = path.read_text(encoding='utf-8')
        updated, missing = render(original)
        if missing:
            print(f'WARN: {path.name} 缺少标记区间：{", ".join(missing)}')
        if updated == original:
            continue
        stale.append(path.name)
        if not check_only:
            path.write_text(updated, encoding='utf-8')

    if check_only and stale:
        print('ERROR: 以下文件的内联副本与编辑源不一致：', file=sys.stderr)
        for name in stale:
            print(f'  - {name}', file=sys.stderr)
        print('修复：python3 chess/scripts/inline_core.py', file=sys.stderr)
        return 1

    if stale:
        print(f'已更新 {len(stale)} 个文件：{", ".join(stale)}')
    else:
        print(f'{len(tools)} 个文件已是最新')
    return 0


if __name__ == '__main__':
    sys.exit(main(check_only='--check' in sys.argv))
```

- [ ] **Step 3: 写 `check.py`**

Create `chess/scripts/check.py`：

```python
#!/usr/bin/env python3
"""子项目校验门：内联副本一致性 + 每个 html 的内联脚本语法。

对应规格 §7 的第 5、6 道门。第 1–4 道由 node 测试文件负责。
"""
import pathlib
import re
import subprocess
import sys

import inline_core

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT_RE = re.compile(r'<script>(.*?)</script>', re.DOTALL)


def node_check() -> int:
    tools = sorted((ROOT / 'tools').glob('*.html'))
    failed = []
    for path in tools:
        blocks = SCRIPT_RE.findall(path.read_text(encoding='utf-8'))
        if not blocks:
            print(f'WARN: {path.name} 里没有内联 <script>')
            continue
        source = '\n'.join(blocks)
        proc = subprocess.run(['node', '--check', '-'],
                              input=source, text=True, capture_output=True)
        if proc.returncode != 0:
            failed.append((path.name, proc.stderr.strip()))

    for name, err in failed:
        print(f'ERROR: {name} 语法检查失败\n{err}', file=sys.stderr)
    if not failed:
        print(f'node --check：{len(tools)} 个文件通过')
    return 1 if failed else 0


def core_tests() -> int:
    rc = 0
    for test in sorted((ROOT / 'core').glob('*.test.js')):
        proc = subprocess.run(['node', str(test)])
        if proc.returncode != 0:
            print(f'ERROR: {test.name} 未通过', file=sys.stderr)
            rc = 1
    return rc


if __name__ == '__main__':
    sys.exit(inline_core.main(check_only=True) or node_check() or core_tests())
```

> `node --check -` 从标准输入读取。这是 CLAUDE.md 里那条 `awk` 提取技巧的等价做法，但把提取逻辑写进脚本，不必每次手敲。

- [ ] **Step 4: 运行同步与校验**

Run:
```bash
python3 chess/scripts/inline_core.py
python3 chess/scripts/check.py
```
Expected: 先输出 `已更新 1 个文件：_skeleton.html`，随后 `check.py` 全部通过（内联一致、`node --check` 通过、两个测试文件通过）。

- [ ] **Step 5: 验证校验门真的会拦人**

Run:
```bash
printf '\n// 手改内联区，应该被拦下\n' >> chess/tools/_skeleton.html
python3 chess/scripts/check.py; echo "exit=$?"
git checkout chess/tools/_skeleton.html 2>/dev/null || python3 chess/scripts/inline_core.py
```
Expected: `check.py` 报错并 `exit=1`。**若 exit=0，说明校验门形同虚设，必须先修好再继续。**

> 这一步是在测试"测试本身"。一个永远通过的校验门比没有校验门更危险，因为它给人以虚假的安全感。

- [ ] **Step 6: 接进 pre-commit hook**

Modify `.githooks/pre-commit` —— 在现有 `sync_registry.py` 逻辑之后追加：

```sh
# ---- chess 子项目 ----
if git diff --cached --name-only | grep -qE '^chess/(core|tools|scripts)/'; then
  if ! python3 chess/scripts/inline_core.py; then
    echo "chess: inline_core.py 失败，提交中止" >&2
    exit 1
  fi
  git add chess/tools/*.html 2>/dev/null || true
  if ! python3 chess/scripts/check.py; then
    echo "chess: check.py 未通过，提交中止" >&2
    exit 1
  fi
fi
```

> `git add chess/tools/*.html` 只暂存本子项目自己的路径 —— 遵守 CLAUDE.md 的并行开工纪律，绝不 `git add -A`。

- [ ] **Step 7: 接进 CI**

Modify `.github/workflows/registry-sync.yml` —— 在现有 job 的最后追加一步：

```yaml
      - name: chess subproject gates
        run: |
          python3 chess/scripts/check.py
```

- [ ] **Step 8: 端到端确认**

Run:
```bash
node chess/core/chess-core.test.js
node chess/core/board-render.test.js
node --check chess/core/viz-engine.js
python3 chess/scripts/check.py
git status --short
```
Expected: 四条命令全部成功；`git status --short` 列出的每一个路径都在 `chess/` 下（并行纪律自查）。

- [ ] **Step 9: 提交**

```bash
git add chess/scripts/inline_core.py chess/scripts/check.py chess/tools/_skeleton.html \
        .githooks/pre-commit .github/workflows/registry-sync.yml
git commit -m "build(chess): 内联同步脚本与校验门，接进 pre-commit 与 CI"
```

---

## 阶段 0 完成标准

全部勾选后阶段 0 才算完成：

- [ ] `node chess/core/chess-core.test.js` 通过，**六个 perft 局面全部对上参考值**，总耗时 < 90 秒
- [ ] `node chess/core/board-render.test.js` 通过
- [ ] `node --check chess/core/viz-engine.js` 通过，且 `grep` 确认时间驱动与三角函数部件已删净
- [ ] `python3 chess/scripts/check.py` 通过，且**手改内联区时确实会被拦下**（Task 15 Step 5）
- [ ] `chess/tools/_piece-preview.html` 里六种棋子在 24px 下可区分，32 子转相机 ≥ 55fps，实测值已记入提交信息
- [ ] `git status --short` 里没有任何 `chess/` 之外的改动（除 hook 与 CI 两个文件）

**下一阶段**：阶段 1（工具 ①② + `chess/index.html` + `chess-tools.json`）。届时 `_skeleton.html` 与 `_piece-preview.html` 应被真正的工具取代或删除。
