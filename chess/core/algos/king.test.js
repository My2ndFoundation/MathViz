'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const G = require('./king-greedy.js');
const X = require('./king-exact.js');

/* ================= 宿主侧独立参照 =================

   两份参照都**不建覆盖表**，每次要用的时候按几何现算（王的九宫 = 切比雪夫
   距离 ≤ 1）。被测源码走的是「先建一张 covers 表、之后全靠表」，两边的数据
   结构因此没有一行是共用的 —— 表建错了，这里照样说真话。

   ⚠ **贪心的参照不能换扫描序**（这是对简报的一处订正，理由写在文件末尾那段
   注释里）：换了序就是另一个算法，实测 6×6 [6,24,35] 上正序 6、倒序 5。
   贪心的独立性靠「几何 vs 覆盖表」拿到，不靠顺序。
   **精确的参照换了序**（目标格取最后一个没人管的、候选倒着试）—— 精确解的
   答案与顺序无关，换序正是它能换的那一半独立性。 */

function neighborhood(W, H, blockedSet, s) {
  const out = [];
  const x = s % W, y = (s - x) / W;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const t = ny * W + nx;
      if (!blockedSet.has(t)) out.push(t);
    }
  }
  return out;
}

function emptySquares(W, H, blocked) {
  const b = new Set(blocked), out = [];
  for (let s = 0; s < W * H; s++) if (!b.has(s)) out.push(s);
  return out;
}

/* 贪心：每一轮挑「新照顾到的空格最多」的那一格，并列时取编号小的。
   并列取小是**算法的一部分**，不是实现细节 —— 见文件头那条订正。 */
function hostGreedy(W, H, blocked) {
  const b = new Set(blocked), empty = emptySquares(W, H, blocked);
  const done = new Set();
  const kings = [];
  while (done.size < empty.length) {
    let best = -1, bestGain = 0;
    for (const s of empty) {
      let gain = 0;
      for (const t of neighborhood(W, H, b, s)) if (!done.has(t)) gain++;
      if (gain > bestGain) { bestGain = gain; best = s; }
    }
    for (const t of neighborhood(W, H, b, best)) done.add(t);
    kings.push(best);
  }
  return { k: kings.length, kings: kings };
}

/* 精确：迭代加深，但目标格取**最后一个**没人管的空格、候选**倒着**试。
   顺序全反了，答案必须一模一样 —— 那才是「最少」这两个字的意思。
   cap 是给测试自己用的保险丝，超过就返回 null（本文件只在随机盘上用）。 */
function hostExact(W, H, blocked, cap) {
  const b = new Set(blocked), empty = emptySquares(W, H, blocked);
  const seen = new Array(W * H).fill(0);
  let left = empty.length, limit = -1;
  const chosen = [];
  function search(n) {
    if (left === 0) return true;
    if (n === limit) return false;
    let target = -1;
    for (const s of empty) if (seen[s] === 0) target = s;   // 最后一个，不是第一个
    const cand = neighborhood(W, H, b, target).slice().reverse();
    for (const s of cand) {
      for (const t of neighborhood(W, H, b, s)) { if (seen[t] === 0) left--; seen[t]++; }
      chosen.push(s);
      if (search(n + 1)) return true;
      chosen.pop();
      for (const t of neighborhood(W, H, b, s)) { seen[t]--; if (seen[t] === 0) left++; }
    }
    return false;
  }
  for (;;) {
    limit++;
    if (cap !== undefined && limit > cap) return { k: null, kings: null };
    if (search(0)) return { k: limit, kings: chosen.slice() };
  }
}

/* 没被任何一个王照顾到的空格。空数组 = 这批王真的支配了整块盘。
   只认几何：王的九宫，墙不挡（王是跨格照顾的，中间有没有墙都一样）。 */
function undominated(W, H, blocked, kings) {
  const b = new Set(blocked), cov = new Set();
  for (const s of kings) for (const t of neighborhood(W, H, b, s)) cov.add(t);
  return emptySquares(W, H, blocked).filter(function (s) { return !cov.has(s); });
}

/* 回放 place / clear，重建「跑完那一刻盘上还站着哪些王」。
   精确那一份会把王收回去（`take`），所以必须真的删，不能只数 place。 */
function placedKings(M, W, H, blocked) {
  const seq = [], kinds = [];
  const r = I.run(M.source({ W: W, H: H, blocked: blocked }), { host: {
    place: function (sq, piece) { seq.push(sq); kinds.push(piece); },
    clear: function (sq) { const at = seq.lastIndexOf(sq); if (at >= 0) { seq.splice(at, 1); kinds.splice(at, 1); } },
  } });
  return { squares: seq, pieces: kinds, result: r.result, truncated: r.trace.truncated };
}

/* 一次 run 的画像：返回值、解释器步数、有没有撞墙、四种 mark 各几次、最深调用栈。 */
function probe(M, W, H, blocked) {
  const kinds = { try: 0, ok: 0, cut: 0, back: 0 };
  const r = I.run(M.source({ W: W, H: H, blocked: blocked }), { host: {
    mark: function (sq, kind) { kinds[kind] = (kinds[kind] || 0) + 1; },
  } });
  let depth = 0;
  for (const st of r.trace) if (st.depth > depth) depth = st.depth;
  return { result: r.result, steps: r.trace.length, truncated: r.trace.truncated,
           kinds: kinds, depth: depth };
}

/* ================= 四档盘 =================

   `eK === null` 表示那一档的精确解撞上 `Interp.STEP_LIMIT`（200,000）。
   最后一档是这道题的落点 —— 不是遗憾，是「为什么现实里用贪心」：
   贪心一眨眼给出 8，精确那边跑不完，于是我们**并不知道** 8 是不是最优。
   `null` 是「不知道」，永远不许在任何一处变成数字。

   ⚠ **第三档换过一次**（实测逼出来的，简报预警过这一条）。简报给的是
   `6×6 [6,10,25,28,32,34,35]`（贪心 7 / 精确 5）。那一档的**精确解在解释器里
   跑不完**：设计时量的是 24,779 次算法操作，而解释器步数是算法操作数的
   三十倍上下（本文件另外三档实测 33× / 30× / 30×），乘出来 ~30 万，实测正是
   200,000 撞墙、`result` 变成 `undefined`。四档里有两档撞墙，「差距那一课」
   就只剩一档在演了。
   换成 `6×6 [1, 4, 24]`：**同样是 6×6、同样是三堵墙，只是位置不同** ——
   贪心从 6 变成 **8**，精确两块都是 4。差距从 2 拉到 4（整整一倍的王），
   而精确只要 41,627 步，比留下来的第二档还便宜。
   新档的 `k` 由一份**穷举**（按 k 从小到大枚举所有子集，零剪枝）独立验过：
   3 个王盖不满，4 个可以（[7,10,25,28]）。 */
const BOARDS = [
  ['5×5 三堵墙',            5, 5, [6, 12, 18], 4, 4],
  ['6×6 三堵墙',            6, 6, [6, 24, 35], 6, 4],
  ['6×6 三堵墙·换个位置',   6, 6, [1, 4, 24],  8, 4],
  ['7×7 三堵墙',            7, 7, [16, 24, 32], 8, null],
];

/* ---- 两份源码都要在 interp.js 的 ES 子集里合法 ----
   **排在所有断言最前面是有意的**（照 rook-cover.test.js 的先例）：源码一旦
   不合法，下面每一次 I.run 都会当场抛，整个文件停在第一条断言上，那时谁都
   说不清是哪儿坏了。放最前面，第一句话就是「不在子集里」，还带着解析器原话。 */
for (const [name, M] of [['king-greedy', G], ['king-exact', X]]) {
  let err = null;
  try { I.parse(M.source({ W: 6, H: 6, blocked: [6, 24, 35] })); } catch (e) { err = e; }
  T.ok(err === null, name + ' 的源码在子集里合法' + (err ? '：' + err.message : ''));
}

/* ================= 四档：k、撞墙、以及「贪心不会更好」 ================= */

let boardsChecked = 0, gapSeen = 0;
for (const [label, W, H, blocked, gK, eK] of BOARDS) {
  const g = I.run(G.source({ W: W, H: H, blocked: blocked }), { host: {} });
  T.ok(!g.trace.truncated, label + ' 贪心未截断——它永远跑得完，这是这道题的一半');
  T.eq(g.result, gK, label + ' 贪心的王数');
  T.eq(g.result, hostGreedy(W, H, blocked).k, label + ' 贪心与宿主侧独立参照一致');

  const e = I.run(X.source({ W: W, H: H, blocked: blocked }), { host: {} });
  if (eK === null) {
    T.eq(e.trace.truncated, true, label + ' 精确解撞上限——这是这一课，不是故障');
    T.ok(typeof e.result === 'undefined', label + ' 撞墙时没有返回值');
  } else {
    T.ok(!e.trace.truncated, label + ' 精确解未截断');
    T.eq(e.result, eK, label + ' 精确的王数');
    T.eq(e.result, hostExact(W, H, blocked).k, label + ' 精确与宿主侧独立参照一致（换了搜索序）');
    T.ok(g.result >= e.result, label + ' 贪心不会比精确更好');
    if (g.result > e.result) gapSeen++;
  }
  boardsChecked++;
}
T.eq(boardsChecked, 4, '四档盘都跑过');
T.ok(gapSeen >= 1, '至少有一档贪心比精确差（差距那一课，实测 ' + gapSeen + ' 档）');

/* ---- 摆出来的王真的支配了所有空格 —— 两份都验，不只是比数字 ----
   只比一个数字的话，一份「返回 4 但盘上乱摆」的实现能通过上面每一条，
   而盘上那些王正是她看到的东西。 */
{
  let domChecked = 0;
  for (const [label, W, H, blocked, , eK] of BOARDS) {
    const pairs = [['贪心', G, true]];
    if (eK !== null) pairs.push(['精确', X, true]);
    for (const [who, M] of pairs) {
      const p = placedKings(M, W, H, blocked);
      T.eq(p.squares.length, p.result, label + ' ' + who + '：盘上站着的王数 = 返回的那个数');
      T.eq(p.pieces.filter(function (q) { return q !== 'wK'; }), [],
           label + ' ' + who + '：摆的全是 "wK"（字符串棋子，跟 queens 的 "wQ" 同一个约定）');
      T.eq(p.squares.filter(function (s) { return blocked.indexOf(s) >= 0; }), [],
           label + ' ' + who + '：没有王站在墙上');
      T.eq(p.squares.length - new Set(p.squares).size, 0,
           label + ' ' + who + '：没有两个王站在同一格');
      const miss = undominated(W, H, blocked, p.squares);
      T.eq(miss, [], label + ' ' + who + '：每一个空格都挨着某个王（或者自己站着一个）');
      domChecked++;
    }
  }
  T.eq(domChecked, 7, '四档贪心 + 三档精确，七次支配性验证都做了');
}

/* ---- 第四档：贪心一眨眼，精确跑不完 ---- */
{
  const [label, W, H, blocked] = [BOARDS[3][0], BOARDS[3][1], BOARDS[3][2], BOARDS[3][3]];
  const pg = probe(G, W, H, blocked);
  const px = probe(X, W, H, blocked);
  T.ok(!pg.truncated, label + '：贪心跑完了（' + pg.steps + ' 步）');
  T.eq(px.truncated, true, label + '：精确撞墙（' + px.steps + ' 步就停在上限上）');
  T.ok(typeof px.result === 'undefined', label + '：撞墙那一边没有返回值，不是 0 也不是 8');
  T.ok(px.steps > pg.steps * 10, label + '：撞墙那一边至少比贪心贵十倍（实测 ' +
       px.steps + ' vs ' + pg.steps + '，而且 200,000 只是上限，真值不知道有多大）');
  const p = placedKings(G, W, H, blocked);
  T.eq(undominated(W, H, blocked, p.squares), [],
       label + '：贪心那 8 个王真的盖满了——「跑不完」说的是不知道最优是多少，' +
       '不是贪心那一份不算数');
}

/* ---- 四档的解释器步数：余量守卫 ----

   步数不钉死（钉死了改一行注释都要来改测试），钉的是**余量**。
   实测（`Interp.STEP_LIMIT` = 200,000）：

     档                              贪心 k / 步数     精确 k / 步数
     ① 5×5 [6,12,18]                  4 /  3,983       4 /  18,174
     ② 6×6 [6,24,35]                  6 /  8,154       4 /  71,742
     ③ 6×6 [1,4,24]                   8 /  9,625       4 /  41,627
     ④ 7×7 [16,24,32]                 8 / 13,578     ✗ 撞墙 200,000

   前三档精确都在 120,000 以下 —— 余量至少 40%。将来任何把某一档推过线的
   改动会在这里**大声失败**，而不是变成一次神秘的截断（那正是简报预警、
   而第三档真的撞上的那件事）。同一条先例见 tour-warnsdorff 的 150,000 余量断言。 */
{
  const budget = [];
  for (const [label, W, H, blocked, , eK] of BOARDS) {
    const pg = probe(G, W, H, blocked);
    T.ok(!pg.truncated && pg.steps < 30000,
         label + ' 贪心 ' + pg.steps + ' 步，稳稳在 30,000 以内（它永远跑得完）');
    if (eK !== null) {
      const px = probe(X, W, H, blocked);
      T.ok(!px.truncated && px.steps < 120000,
           label + ' 精确 ' + px.steps + ' 步，余量至少 40%');
      budget.push(px.steps);
    }
  }
  T.eq(budget.length, 3, '三档精确各自量过步数余量');
}

/* ---- 矩形空盘上两份完全相同 ----
   规格原写的「差距可见」被订正过，就是因为这一条：矩形盘上王的结构太规整，
   贪心自然挑中 3×3 块的中心，那恰好最优。**差距只在有墙的时候才出现。**
   八种尺寸在宿主侧全量验（精确那一份在 7×7 以上要跑两千多万次操作，
   只有宿主侧跑得动；解释器里那是第四档撞墙的同一堵墙）。 */
{
  let same = 0;
  for (const [W, H] of [[4, 4], [5, 5], [5, 6], [6, 6], [6, 7], [7, 7], [7, 8], [8, 8]]) {
    const a = hostGreedy(W, H, []).k, b = hostExact(W, H, []).k;
    T.eq(a, b, W + '×' + H + ' 空盘：贪心与精确相同（都是 ' + b + '）');
    same++;
  }
  T.eq(same, 8, '八种矩形空盘都验过——空盘上贪心不吃亏');
}

/* ---- 解释器里跑得动的那几块空盘：两份都要跑得完、答案相同 ---- */
{
  let n = 0;
  for (const [W, H] of [[4, 4], [5, 5], [5, 6], [6, 6]]) {
    const pg = probe(G, W, H, []), px = probe(X, W, H, []);
    T.ok(!pg.truncated && !px.truncated, W + '×' + H + ' 空盘：两份都跑得完');
    T.eq(pg.result, px.result, W + '×' + H + ' 空盘：两份给出同一个数（' + pg.result + '）');
    T.eq(pg.result, hostGreedy(W, H, []).k, W + '×' + H + ' 空盘：与宿主侧参照一致');
    n++;
  }
  T.eq(n, 4, '四块空盘在解释器里也验过');
}

/* ================= 两份各用哪些 mark =================

   这一节钉的是**两份算法的性格**，不是显示细节：
     贪心 —— 没有一次 'back'。它从不反悔，挑完就定了。
     精确 —— 没有一次 'cut'。它不淘汰任何候选，每一个都真的摆上去试过。
   （`knight-path.js` 的文件头有同一条先例：少的那一种 mark 本身就是一句话。）
   谁把贪心写成「摆错了再收回来」，或者把精确写成「先筛一遍候选」，这里当场红。 */
{
  const [, W, H, blocked] = BOARDS[2];
  const pg = probe(G, W, H, blocked), px = probe(X, W, H, blocked);
  T.eq(Object.keys(pg.kinds).filter(function (k) { return pg.kinds[k] > 0; }).sort(),
       ['cut', 'ok', 'try'], '贪心只喊 try / ok / cut——一次 back 都没有');
  T.eq(pg.kinds.back, 0, '贪心从不反悔：back 恒为 0');
  T.eq(pg.kinds.ok, pg.result, '贪心喊了几次 ok，盘上就有几个王');
  /* 把 try / cut 的**个数**也钉死，不能只钉「> 0」。
     贪心每摆一个王，就把所有空格从头到尾掂量一遍：那一轮 try 恰好 |empty| 次；
     一轮里除了最后站住的那个擂主，别的每一格都吃一记 cut（老擂主是被顶下去
     的时候吃的，输家是当场吃的）—— 恰好 |empty| − 1 次。
     ⚠ 只写 `cut > 0` 是**没有牙**的：贪心里有两处 mark 'cut'（顶擂主的那处、
     输家那处），删掉任何一处，`cut > 0` 照样绿。实测过（突变 G2）。 */
  const nEmpty = W * H - blocked.length;
  T.eq(pg.kinds.try, pg.result * nEmpty,
       '贪心每摆一个王就把 ' + nEmpty + ' 个空格全掂量一遍：try 恰好 ' + (pg.result * nEmpty) + ' 次');
  T.eq(pg.kinds.cut, pg.result * (nEmpty - 1),
       '每一轮里除了站住的那个擂主，别的每一格都吃一记 cut：恰好 ' +
       (pg.result * (nEmpty - 1)) + ' 次');

  T.eq(Object.keys(px.kinds).filter(function (k) { return px.kinds[k] > 0; }).sort(),
       ['back', 'ok', 'try'], '精确只喊 try / ok / back——一次 cut 都没有');
  T.eq(px.kinds.cut, 0, '精确不淘汰候选：cut 恒为 0');
  T.eq(px.kinds.ok - px.kinds.back, px.result,
       'ok 减去 back 正好是最后站住的王数（摆上去又收回来的一进一出）');
  T.ok(px.kinds.back > 0, '精确真的收回去过（back ' + px.kinds.back + ' 次）');
  /* 精确里每一次 'try' 后面紧跟着一次 `put`（也就是一次 'ok'）—— 它**不淘汰**，
     试就是真的摆上去。所以两个数必须逐个相等，不是「差不多」。
     漏掉这一条，一份「先粗筛一遍候选再摆」的实现能通过上面每一条。 */
  T.eq(px.kinds.try, px.kinds.ok, '精确的每一次 try 后面都真的摆上去了：try === ok');
}

/* ---- 递归深度 = 已经摆了几个王 ----
   两份的入口函数都叫 `cover(n)`，n 都是「已经摆了几个王」，于是第三根轴
   （§1.4「z 轴 = 入口函数的递归深度」）在两条轨道上是同一个意思。
   贪心的塔恰好 k 层（每摆一个王往下一层，摆完那一层直接返回）；
   精确的塔最深就是它当前允许的王数。 */
{
  const [, W, H, blocked, gK, eK] = BOARDS[1];
  const pg = probe(G, W, H, blocked), px = probe(X, W, H, blocked);
  T.eq(pg.depth, gK + 1, '贪心的塔 = 王数 + 1（最后那一层是「查完了，返回」）');
  T.eq(px.depth, eK + 1, '精确的塔 = 最少王数 + 1（最深那一层正是走通的那次）');
}

/* ================= 随机盘扫一遍 =================

   四档盘是挑出来的，挑出来的盘只能证明「这四块盘上对」。覆盖表的建法一旦
   有偏差（比如把角上的九宫算成九格、或者把墙也算进要照顾的格子），最容易
   在没人挑过的形状上露馅。固定种子的伪随机盘，跑完既是对拍也是覆盖验证。 */
function lcg(seed) {
  let s = seed >>> 0;
  return function () { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
}
{
  const rnd = lcg(20260807);
  let n = 0, worstG = 0, worstX = 0, xTrunc = 0;
  while (n < 30) {
    const W = 3 + Math.floor(rnd() * 3);      // 3..5
    const H = 3 + Math.floor(rnd() * 3);      // 3..5
    const blocked = [];
    for (let s = 0; s < W * H; s++) if (rnd() < 0.25) blocked.push(s);
    if (blocked.length === W * H) continue;
    const tag = W + '×' + H + ' [' + blocked.join(',') + ']';

    const g = I.run(G.source({ W: W, H: H, blocked: blocked }), { host: {} });
    T.ok(!g.trace.truncated, tag + ' 贪心未截断');
    T.eq(g.result, hostGreedy(W, H, blocked).k, tag + ' 贪心与宿主侧参照一致');
    const gp = placedKings(G, W, H, blocked).squares;
    T.eq(undominated(W, H, blocked, gp), [], tag + ' 贪心摆出来的王盖满了');
    if (g.trace.length > worstG) worstG = g.trace.length;

    const x = I.run(X.source({ W: W, H: H, blocked: blocked }), { host: {} });
    if (x.trace.truncated) {
      xTrunc++;
      T.ok(typeof x.result === 'undefined', tag + ' 精确撞墙时没有返回值');
    } else {
      T.eq(x.result, hostExact(W, H, blocked).k, tag + ' 精确与宿主侧参照一致（换了搜索序）');
      T.ok(g.result >= x.result, tag + ' 贪心不会比精确更好');
      const xp = placedKings(X, W, H, blocked).squares;
      T.eq(undominated(W, H, blocked, xp), [], tag + ' 精确摆出来的王盖满了');
      if (x.trace.length > worstX) worstX = x.trace.length;
    }
    n++;
  }
  T.eq(n, 30, '三十块随机盘都跑过');
  T.ok(worstG < 200000, '随机盘里贪心最贵的一块也才 ' + worstG + ' 步');
  T.ok(worstX > 0, '随机盘里至少有一块精确跑完了（最贵 ' + worstX + ' 步，撞墙 ' + xTrunc + ' 块）');
}

/* ---- 整块盘全是墙 / 只剩一格：0 与 1，不许变成别的 ----
   全是墙那一档尤其要跑：贪心的 `cover(0)` 一步不做就返回 0，精确的迭代加深
   必须**从 0 问起**（问「0 个王够不够」），否则会答 1。 */
{
  const all = [];
  for (let s = 0; s < 9; s++) all.push(s);
  for (const [name, M] of [['贪心', G], ['精确', X]]) {
    const r0 = I.run(M.source({ W: 3, H: 3, blocked: all }), { host: {} });
    T.eq(r0.result, 0, name + '：整块盘都是墙，一个王都不用摆');
    T.eq(placedKings(M, 3, 3, all).squares, [], name + '：这时候盘上一个王都没有');
    const one = all.filter(function (s) { return s !== 4; });
    const r1 = I.run(M.source({ W: 3, H: 3, blocked: one }), { host: {} });
    T.eq(r1.result, 1, name + '：只剩中间一格，一个王');
    T.eq(placedKings(M, 3, 3, one).squares, [4], name + '：那个王就站在剩下的那一格上');
  }
}

/* ================= 两份源码的可对比性 =================

   §4⑤ 的落点是「同一个问题、同一块盘、两份可以逐行对比的源码」并排显示。

   **阶段 5 给 `tour-dfs` / `tour-warnsdorff` 建的那道门在这里不适用**，
   而且不是「凑合一下也能用」，是**方向上就不成立**：那道门比的是子序列
   （剥掉注释与空行后，朴素那份的每一行按原顺序出现在 Warnsdorff 那份里），
   它成立的前提是**两份是包含关系** —— Warnsdorff 就是朴素回溯多插了一个
   `degree()` 和一段排序，别的一个字没动。
   这一对不是包含关系：贪心是「一个循环挑最大覆盖、挑完就定」，精确是
   「迭代加深 + 回溯」。贪心有 `bestGain` 那段擂台，精确没有；精确有 `take()`、
   有 `limit`、有那圈迭代加深的 while，贪心一个都没有。**两个方向的子序列
   都不成立**，硬套只会得到一条恒红的断言（或者为了让它绿而把两份写成
   一份，那就没有两个算法了）。

   换成一道**方向正确的**门：两份源码里有一整段是**逐字节相同**的 ——
   从「以下逐字相同」那条横线到「分水岭」那条横线之间，建墙、列空格、建覆盖表、
   记 seen/left、`put()` 全都在里头。这段共用文本必须一个字节都不差；
   剩下的差异就正好是「挑哪个王」这个主意本身。
   这道门与 tour 那道门守的是同一件事（她把两边一 diff，diff 出来的就该
   正好是那个主意），只是换成了这一对的正确形状。 */
const MARK_A = '/* ===== 从这里到下面那条分水岭为止，两份源码逐字相同 ===== */';
const MARK_B = '/* ===== 分水岭：从这里往下两份不一样了 —— 差的就是「挑哪个王」 ===== */';
{
  const opts = { W: 6, H: 6, blocked: [6, 24, 35] };
  const sg = G.source(opts), sx = X.source(opts);
  const shared = function (src, name) {
    const a = src.indexOf(MARK_A), b = src.indexOf(MARK_B);
    T.ok(a >= 0, name + ' 里有「以下逐字相同」那条横线');
    T.ok(b > a, name + ' 里有「分水岭」那条横线，而且在前一条之后');
    return src.slice(a, b + MARK_B.length);
  };
  const cg = shared(sg, 'king-greedy'), cx = shared(sx, 'king-exact');
  T.eq(cg === cx, true, '两条横线之间的那一整段，两份逐字节相同');
  T.ok(cg.split('\n').length > 40,
       '共用的那一段有 ' + cg.split('\n').length + ' 行，这道门没有空转');
  /* 分水岭之后必须真的不一样 —— 否则上面那条「逐字节相同」可以靠把两份
     写成同一份来满足，而那样就没有两个算法了。 */
  const tailG = sg.slice(sg.indexOf(MARK_B) + MARK_B.length);
  const tailX = sx.slice(sx.indexOf(MARK_B) + MARK_B.length);
  T.ok(tailG !== tailX, '分水岭之后两份确实分道扬镳了');
  T.ok(tailG.indexOf('bestGain') >= 0, '贪心那一半里有「擂台」（bestGain）');
  T.ok(tailX.indexOf('function take') >= 0, '精确那一半里有「把王收回去」（take）');
  T.ok(tailG.indexOf('function take') < 0, '贪心那一半里没有 take——它从不收回');
  T.ok(tailX.indexOf('bestGain') < 0, '精确那一半里没有擂台——它不挑，它全试');
  /* 共用段里必须真的装着那些共用的东西，不能只是两条挨着的横线。 */
  for (const needle of ['const wall = []', 'const empty = []', 'const covers = []',
                        'const seen = []', 'let left = empty.length', 'function put(s)']) {
    T.ok(cg.indexOf(needle) >= 0, '共用段里有 `' + needle + '`');
  }
}

/* ---- 两份的入口函数同名同义 ----
   页面（Task 5）的 `PROBLEMS.kingDominate.entry` 只有一个名字，两条轨道共用。
   两份都必须叫 `cover`，而且 `cover(n)` 的 n 都是「已经摆了几个王」。 */
{
  const opts = { W: 5, H: 5, blocked: [6, 12, 18] };
  for (const [name, src] of [['king-greedy', G.source(opts)], ['king-exact', X.source(opts)]]) {
    T.ok(src.indexOf('function cover(n) {') >= 0, name + ' 的入口函数叫 cover(n)');
    T.ok(src.indexOf('cover(n + 1)') >= 0, name + ' 的 cover 是递归那一个，不是外壳');
  }
}

/* ---- 缺参数当场抛，而且抛的是**说得出缺了谁**的那句话 ----
   （约束 6：公开导出的省略参数是本仓库抓到过八次的缺陷类。）

   ⚠ pattern 用 `/少了 W/` 而不是 `/W/`：三句报错的开头都是同一句签名
   `source({ W, H, blocked })`，里头 W、H、blocked 三个字母全在，于是 `/W/`
   对这三句里的任何一句都成立 —— 把 W 那道守卫整个删掉，报的是「少了 H」，
   `/W/` 照样绿。本阶段的控制器就是这么写的，三道守卫全删了 4 条断言还全绿。
   要点名，就得连「少了」两个字一起要。 */
for (const [name, M] of [['king-greedy', G], ['king-exact', X]]) {
  T.throws(function () { M.source(); }, name + '：连 opts 都没有，先点名 W', /少了 W/);
  T.throws(function () { M.source({ H: 6, blocked: [] }); }, name + '：少了 W', /少了 W/);
  T.throws(function () { M.source({ W: 6, blocked: [] }); }, name + '：少了 H', /少了 H/);
  T.throws(function () { M.source({ W: 6, H: 6 }); }, name + '：少了 blocked', /少了 blocked/);

  /* 参数不合法也当场抛。同一条理由：pattern 要咬住那句**故意写的**报错。
     `blocked: 3` 那条尤其典型 —— 就算把 Array.isArray 那道守卫整个删掉，
     后面 `blocked.join(', ')` 也会抛「blocked.join is not a function」，
     一条 `/blocked/` 照样绿。 */
  T.throws(function () { M.source({ W: 0, H: 5, blocked: [] }); }, name + '：W = 0', /W 必须是/);
  T.throws(function () { M.source({ W: 5.5, H: 5, blocked: [] }); }, name + '：W 不是整数', /W 必须是/);
  T.throws(function () { M.source({ W: 5, H: -1, blocked: [] }); }, name + '：H 为负', /H 必须是/);
  T.throws(function () { M.source({ W: 5, H: 5, blocked: 3 }); }, name + '：blocked 不是数组',
           /blocked 必须是一个数组/);
  T.throws(function () { M.source({ W: 5, H: 5, blocked: [25] }); }, name + '：blocked 越界', /收到：25/);
  T.throws(function () { M.source({ W: 5, H: 5, blocked: [-1] }); }, name + '：blocked 有负数',
           /blocked 里的格子/);
  T.throws(function () { M.source({ W: 5, H: 5, blocked: [1.5] }); }, name + '：blocked 有小数',
           /blocked 里的格子/);
  /* 但**不**校验「盘上还剩不剩空格」，也**不**校验「跑不跑得完」：
     整块盘都是墙要吐出来跑（答案 0），7×7 那一档明知精确会撞墙也要吐出来跑 ——
     撞墙那一屏正是这道题的落点。 */
  let err = null;
  const all = [];
  for (let s = 0; s < 9; s++) all.push(s);
  try { M.source({ W: 3, H: 3, blocked: all }); } catch (e) { err = e; }
  T.ok(err === null, name + '：一格空的都没有的盘照常吐源码');
  err = null;
  try { M.source({ W: 7, H: 7, blocked: [16, 24, 32] }); } catch (e) { err = e; }
  T.ok(err === null, name + '：明知精确会撞墙的 7×7 照常吐源码');
}

/* ---- 约束 7：断言「某个导出不存在」要用 typeof ----
   `JSON.stringify(function(){})` 与 `JSON.stringify(undefined)` 都是 undefined，
   写成 T.eq(M.BOARDS, undefined) 会在 M.BOARDS 是个函数时照样绿。 */
for (const [name, M] of [['king-greedy', G], ['king-exact', X]]) {
  T.ok(typeof M.source === 'function', name + ' 的导出与 queens / rook-cover 同形：{ source }');
  T.ok(typeof M.BOARDS === 'undefined', name + ' 没有把四档盘写死在模块里——那是页面的事');
  T.ok(typeof M.W_MAX === 'undefined', name + ' 没有偷偷带一个滑杆上限出来');
  T.eq(Object.keys(M).sort(), ['source'], name + ' 导出的键就只有 source 一个');
}

T.report();
