'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const R = require('./rook-cover.js');

/* 宿主侧独立参照：行段/列段建图 + 匈牙利最大匹配。
   独立参照不是把被测源码抄一遍——被测源码跑在 ES 子集里、用的是两趟扫描
   （先找空位再请人挪窝）与逐格 mark；这一份用邻接表与递归，只保证答案相同。 */
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

/* 四档盘：简报给的那四档，一个数都没改。
   （标签改了一个字：`[3,10,13,17,18]` 是**五**个障碍，简报写成「四障碍」。） */
const BOARDS = [
  ['5×5 空盘',   5, 5, [],                                5],
  ['5×5 五障碍', 5, 5, [3, 10, 13, 17, 18],               6],
  ['6×6 九障碍', 6, 6, [0, 6, 8, 9, 14, 20, 24, 26, 27],  7],
  ['6×7 九障碍', 6, 7, [4, 6, 7, 8, 26, 31, 33, 35, 37],  9],
];

/* ---- 源码必须在 interp.js 的 ES 子集里合法（三元运算符等等会当场抛）----
   **这一条排在所有断言最前面是有意的**：源码一旦不合法，下面每一次 I.run
   都会当场抛，整个文件在第一条断言上就中止 —— 那时谁都说不清是哪儿坏了。
   放在最前面，报出来的第一句话就是「不在子集里」，还带着解析器的原话。 */
{
  let err = null;
  try { I.parse(R.source({ W: 6, H: 7, blocked: [4, 6, 7, 8, 26, 31, 33, 35, 37] })); } catch (e) { err = e; }
  T.ok(err === null, 'rook-cover 的源码在子集里合法' + (err ? '：' + err.message : ''));
}

/* ================= 几何验证工具 =================

   下面这几个函数只认「棋盘上的真事实」——格子、障碍、车沿直线看得多远——
   一个段编号都不碰。它们要能在「段编号建错了」的时候照样说真话，所以不能
   跟被测源码（或上面那份参照）共用任何一张表。 */

function emptySquares(W, H, blocked) {
  const b = new Set(blocked), out = [];
  for (let s = 0; s < W * H; s++) if (!b.has(s)) out.push(s);
  return out;
}

/* 回放 place / clear，重建「跑完之后盘上还站着哪些车」。
   clear 会把那一格的棋子收回去（增广路把一辆车请下来时就是这么干的），
   所以这里必须真的把它从列表里删掉，不能只数 place。 */
function placedRooks(W, H, blocked) {
  const seq = [];
  const kinds = [];
  I.run(R.source({ W: W, H: H, blocked: blocked }), { host: {
    place: function (sq, piece) { seq.push(sq); kinds.push(piece); },
    clear: function (sq) { const at = seq.lastIndexOf(sq); if (at >= 0) { seq.splice(at, 1); kinds.splice(at, 1); } },
  } });
  return { squares: seq, pieces: kinds };
}

/* 一辆车站在 sq 上，沿四个方向看出去能看到哪些格子（含它自己）。
   **撞上障碍就停**——这正是「一辆车只管得住它所在的那一截」在棋盘上的样子。
   别的车不挡路：下面另有一条断言证明这些车两两互不攻击（谁也不在谁的
   那一截上），挡不挡路因此不影响任何一个结论。 */
function sight(W, H, blockedSet, sq) {
  const out = [sq];
  const x = sq % W, y = (sq - x) / W;
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  for (let k = 0; k < 4; k++) {
    let cx = x + DX[k], cy = y + DY[k];
    while (cx >= 0 && cx < W && cy >= 0 && cy < H) {
      const t = cy * W + cx;
      if (blockedSet.has(t)) break;
      out.push(t);
      cx += DX[k]; cy += DY[k];
    }
  }
  return out;
}

/* 没被任何一辆车看到的空格；空数组 = 这批车真的盖住了整块盘。 */
function uncovered(W, H, blocked, rooks) {
  const b = new Set(blocked), cov = new Set();
  for (const s of rooks) for (const t of sight(W, H, b, s)) cov.add(t);
  return emptySquares(W, H, blocked).filter(function (s) { return !cov.has(s); });
}

/* 互相看得见的一对车（谁也不该看见谁）；null = 两两互不攻击。 */
function attackingPair(W, H, blocked, rooks) {
  const b = new Set(blocked), set = new Set(rooks);
  for (const s of rooks) {
    for (const t of sight(W, H, b, s)) {
      if (t !== s && set.has(t)) return [s, t];
    }
  }
  return null;
}

/* 一次 run 里出现过的 mark 种类计数 + 最深的调用栈深度。
   深度就是增广路的长度：顶层语句 depth 0，walk 的第一层 1，
   被请去挪窝的那个行段是 2 —— 「横一段竖一段」走了几个来回，这里就是几。 */
function probe(W, H, blocked) {
  const kinds = { try: 0, ok: 0, cut: 0, back: 0 };
  const r = I.run(R.source({ W: W, H: H, blocked: blocked }), { host: {
    mark: function (sq, kind) { kinds[kind] = (kinds[kind] || 0) + 1; },
  } });
  let depth = 0;
  for (const st of r.trace) if (st.depth > depth) depth = st.depth;
  return { result: r.result, steps: r.trace.length, truncated: r.trace.truncated, kinds: kinds, depth: depth };
}

/* ================= 四档盘 ================= */

let boardsChecked = 0;
for (const [label, W, H, blocked, expectK] of BOARDS) {
  const r = I.run(R.source({ W: W, H: H, blocked: blocked }), { host: {} });
  T.ok(!r.trace.truncated, label + ' 未截断');
  T.eq(r.result, hostMaxMatch(W, H, blocked), label + ' 的最大匹配与宿主侧匈牙利一致');
  T.eq(r.result, expectK, label + ' 的最大匹配是设计时量的那个数');

  /* 摆出来的车必须真的是那么些车、真的站在空格上、真的两两互不攻击、
     并且真的盖住了每一个空格 —— 只比一个数字的话，一份「返回 9 但盘上
     胡乱摆」的实现能骗过上面三条，而盘上那些车正是她看到的东西。 */
  const placed = placedRooks(W, H, blocked);
  T.eq(placed.squares.length, r.result, label + '：盘上站着的车数 = 返回的那个数');
  T.eq(placed.pieces.filter(function (p) { return p !== 'wR'; }), [],
       label + '：摆的全是 "wR"（字符串棋子，跟 queens 的 "wQ" 同一个约定）');
  const onWall = placed.squares.filter(function (s) { return blocked.indexOf(s) >= 0; });
  T.eq(onWall, [], label + '：没有一辆车站在障碍上');
  const dup = placed.squares.length - new Set(placed.squares).size;
  T.eq(dup, 0, label + '：没有两辆车站在同一格');
  const pair = attackingPair(W, H, blocked, placed.squares);
  T.ok(pair === null, label + '：这些车两两互不攻击（这就是「匹配」在棋盘上的样子）' +
       (pair === null ? '' : '——但 ' + pair[0] + ' 看得见 ' + pair[1]));
  const miss = uncovered(W, H, blocked, placed.squares);
  T.eq(miss, [], label + '：每一个空格都被某辆车沿行或列（不穿过障碍）看得到');
  boardsChecked++;
}
T.eq(boardsChecked, 4, '四档盘都验过');

/* ---- 空盘：闭式解 min(W, H)，而且一次挪窝都不该发生 ----
   空盘上每行摆一个就够了，谁也不用请谁让位 —— 这正是「这道题必须有障碍」
   的那条对照：匹配根本没上场，`back` 一次都没有。

   **深度那一条要分情况**（实测发现，简报表只给了正方形那一档）：
   行段不比列段多的时候（H <= W），每个行段第一趟就能找到一个还空着的列段，
   增广路最深只有 1 层 —— 第一档 5×5 空盘正是这一种，一眼看得出「匹配没上场」。
   行段比列段多的时候（H > W），多出来的那些行段**注定找不到位子**：它们会把
   每个列段都问一遍、顺着问下去，深度自然大于 1。但**照样一次 back 都没有** ——
   深度是「找失败了要走多远才知道」，back 是「真的有人挪了窝」，这是两件事。 */
let plainChecked = 0;
for (const [W, H] of [[5, 5], [6, 6], [4, 7], [7, 4], [1, 5], [8, 8]]) {
  const p = probe(W, H, []);
  T.eq(p.result, Math.min(W, H), W + '×' + H + ' 空盘：答案就是 min(W, H) = ' + Math.min(W, H));
  T.eq(p.kinds.back, 0, W + '×' + H + ' 空盘：一次 back 都没有——没人需要挪窝');
  if (H <= W) {
    T.eq(p.depth, 1, W + '×' + H + ' 空盘（行段不比列段多）：增广路最深只有 1 层');
  } else {
    T.ok(p.depth > 1, W + '×' + H + ' 空盘（行段比列段多）：多出来的行段注定落空，' +
         '会一路问下去（最深 ' + p.depth + ' 层），但仍然没有一次 back');
  }
  plainChecked++;
}
T.eq(plainChecked, 6, '六块空盘都验过');

/* ---- 有障碍的那三档：增广路真的走起来了 ----
   这三条是上面那组空盘断言的对手戏。没有它们，一份「永远只做第一趟贪心、
   从不递归」的实现照样能通过空盘那六条 —— 它只会在有障碍的盘上少数几辆车。 */
{
  const deep = probe(6, 7, [4, 6, 7, 8, 26, 31, 33, 35, 37]);
  T.ok(deep.kinds.back > 0, '6×7 九障碍：确实有车被请下来挪过窝（back ' + deep.kinds.back + ' 次）');
  T.ok(deep.depth > 1, '6×7 九障碍：增广路不止一层（最深 ' + deep.depth + '）');
  const mid = probe(6, 6, [0, 6, 8, 9, 14, 20, 24, 26, 27]);
  T.ok(mid.kinds.back > 0, '6×6 九障碍：也有车挪过窝（back ' + mid.kinds.back + ' 次）');
  T.ok(mid.depth > 1, '6×6 九障碍：增广路不止一层（最深 ' + mid.depth + '）');
}

/* ---- 四种 mark 都用到了，而且只有这四种 ---- */
{
  const p = probe(6, 7, [4, 6, 7, 8, 26, 31, 33, 35, 37]);
  const kinds = Object.keys(p.kinds).sort();
  T.eq(kinds, ['back', 'cut', 'ok', 'try'], '只喊这四种 mark，一种都不多');
  T.ok(p.kinds.try > 0 && p.kinds.ok > 0 && p.kinds.cut > 0 && p.kinds.back > 0,
       '四种 mark 每一种都真的喊到过');
  T.eq(p.kinds.ok - p.kinds.back, p.result,
       'ok 减去 back 正好是最后站住的车数（每挪一次窝，就是一进一出）');
}

/* ================= 随机盘扫一遍 =================

   四档盘是挑出来的，挑出来的盘只能证明「这四块盘上对」。行段/列段的建法
   一旦有偏差（比如把「一行只算一段」写成了「碰到障碍就重开一段但忘了
   最后一格」），最容易在没人挑过的形状上露馅。固定种子的伪随机盘，
   跑完既是对拍也是覆盖验证。 */
function lcg(seed) {
  let s = seed >>> 0;
  return function () { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
}
{
  const rnd = lcg(20260807);
  let n = 0, worstSteps = 0;
  while (n < 40) {
    const W = 3 + Math.floor(rnd() * 4);      // 3..6
    const H = 3 + Math.floor(rnd() * 4);      // 3..6
    const blocked = [];
    for (let s = 0; s < W * H; s++) if (rnd() < 0.28) blocked.push(s);
    if (blocked.length === 0 || blocked.length === W * H) continue;
    const tag = W + '×' + H + ' [' + blocked.join(',') + ']';
    const r = I.run(R.source({ W: W, H: H, blocked: blocked }), { host: {} });
    T.ok(!r.trace.truncated, tag + ' 未截断');
    T.eq(r.result, hostMaxMatch(W, H, blocked), tag + ' 的最大匹配与宿主侧匈牙利一致');
    const placed = placedRooks(W, H, blocked).squares;
    T.eq(placed.length, r.result, tag + '：盘上站着的车数 = 返回的那个数');
    T.ok(attackingPair(W, H, blocked, placed) === null, tag + '：这些车两两互不攻击');
    T.eq(uncovered(W, H, blocked, placed), [], tag + '：每个空格都被看得到');
    if (r.trace.length > worstSteps) worstSteps = r.trace.length;
    n++;
  }
  T.eq(n, 40, '四十块随机盘都跑过');
  T.ok(worstSteps < 200000, '随机盘里最贵的一块也才 ' + worstSteps + ' 步，离 200,000 的上限很远');
}

/* ---- 整块盘全是障碍 / 只剩一格：0 与 1，不许变成别的 ---- */
{
  const all = [];
  for (let s = 0; s < 9; s++) all.push(s);
  const r0 = I.run(R.source({ W: 3, H: 3, blocked: all }), { host: {} });
  T.eq(r0.result, 0, '整块盘都是障碍：一辆车都不用摆');
  T.eq(placedRooks(3, 3, all).squares, [], '这时候盘上一辆车都没有');
  const one = all.filter(function (s) { return s !== 4; });
  const r1 = I.run(R.source({ W: 3, H: 3, blocked: one }), { host: {} });
  T.eq(r1.result, 1, '只剩中间一格：一辆车');
  T.eq(placedRooks(3, 3, one).squares, [4], '那辆车就站在剩下的那一格上');
}

/* ---- 缺参数当场抛，而且抛的是**说得出缺了谁**的那句话 ----
   （约束 6：公开导出的省略参数是本仓库抓到过八次的缺陷类。
   pattern 是 `T.throws` 的第三个参数——不带 pattern 只证明了「抛了」，
   一句「Cannot read properties of undefined」也能让那种断言变绿。）

   ⚠ pattern 用的是 `/少了 W/` 而不是简报写的 `/W/`：三句报错的开头都是
   **同一句签名** `source({ W, H, blocked })`，里头 W、H、blocked 三个字母
   全在。于是 `/W/` 对这三句里的任何一句都成立——把 W 的那道守卫整个删掉，
   报的是「少了 H」，`/W/` 照样绿。实测过：删掉 W 守卫之后，简报那四条
   pattern 断言一条都不红。要点名，就得连「少了」两个字一起要。 */
T.throws(function () { R.source(); }, 'source() 少了全部参数，先点名 W', /少了 W/);
T.throws(function () { R.source({ H: 6, blocked: [] }); }, '少了 W', /少了 W/);
T.throws(function () { R.source({ W: 6, blocked: [] }); }, '少了 H', /少了 H/);
T.throws(function () { R.source({ W: 6, H: 6 }); }, '少了 blocked', /少了 blocked/);

/* ---- 参数不合法也当场抛 ----
   同一条理由：pattern 要咬住那句**故意写的**报错，不能让一句偶然的
   TypeError 冒充。`blocked: 3` 那条尤其典型——就算把 Array.isArray 那道
   守卫整个删掉，后面 `blocked.join(', ')` 也会抛一句
   「blocked.join is not a function」，`/blocked/` 照样绿。实测过。 */
T.throws(function () { R.source({ W: 0, H: 5, blocked: [] }); }, 'W = 0 当场抛', /W 必须是/);
T.throws(function () { R.source({ W: 5.5, H: 5, blocked: [] }); }, 'W 不是整数当场抛', /W 必须是/);
T.throws(function () { R.source({ W: 5, H: -1, blocked: [] }); }, 'H 为负当场抛', /H 必须是/);
T.throws(function () { R.source({ W: 5, H: 5, blocked: 3 }); }, 'blocked 不是数组当场抛', /blocked 必须是一个数组/);
T.throws(function () { R.source({ W: 5, H: 5, blocked: [25] }); }, 'blocked 里有越界格子当场抛', /收到：25/);
T.throws(function () { R.source({ W: 5, H: 5, blocked: [-1] }); }, 'blocked 里有负数当场抛', /blocked 里的格子/);
T.throws(function () { R.source({ W: 5, H: 5, blocked: [1.5] }); }, 'blocked 里有小数当场抛', /blocked 里的格子/);
// 但**不**校验「盘上还剩不剩空格」：整块盘都是障碍要生成出来跑给她看（上面那条）。
{
  let err = null;
  const all = [];
  for (let s = 0; s < 9; s++) all.push(s);
  try { R.source({ W: 3, H: 3, blocked: all }); } catch (e) { err = e; }
  T.ok(err === null, '一格空的都没有的盘照常吐源码');
}

/* ---- 约束 7：断言「某个导出不存在」要用 typeof ----
   `JSON.stringify(function(){})` 与 `JSON.stringify(undefined)` 都是 undefined，
   写成 T.eq(R.W_MAX, undefined) 会在 R.W_MAX 是个函数时照样绿。 */
T.ok(typeof R.source === 'function', '导出的形状与 queens / knight-path 同形：{ source }');
T.ok(typeof R.W_MAX === 'undefined', '没有偷偷带一个滑杆上限出来');
T.ok(typeof R.BOARDS === 'undefined', '也没有把四档盘写死在模块里——那是页面的事');
T.eq(Object.keys(R).sort(), ['source'], '导出的键就只有 source 一个');

T.report();
