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

/* ======== 以下都是简报之外补的，不改上面任何一条 ========

   补的第一条理由写在这里：上面那一段的注释说它在钉「先访问的距离不大于后
   访问的」，可它真正断言的只有 `seen.length > 20` —— 一份深度优先的实现照样
   能在 8×8 上喊出几百次 mark 并全绿通过。层序这件事在简报的测试里**没有被
   任何一条断言碰到**。下面 hostDist + 单调性那一段才是它承诺的那道门。 */

// ---- 源码必须在 interp.js 的 ES 子集里合法（三元运算符等等会当场抛）----
{
  let err = null;
  try { I.parse(K.source({ W: 8, start: 0, target: 63 })); } catch (e) { err = e; }
  T.ok(err === null, 'knight-path 的源码在子集里合法' + (err ? '：' + err.message : ''));
}

/* ---- 层序：`ok` 标记的先后顺序，按宿主侧距离必须单调不减 ----

   `mark(sq, 'ok')` 在这份源码里的意思是「这一格第一次被到达，而这就是它的
   最短步数」。把这些格子按被标记的先后排成一列，它们的距离必须是
   0,1,1,…,2,2,…,3,… —— 单调不减。这正是「一层铺完再铺下一层」的定义，
   也是 DFS 无论如何做不到的事（DFS 会先冲到距离 5 再回头捡距离 1）。 */
function hostDist(W, s) {
  const DX = [1, 2, 2, 1, -1, -2, -2, -1], DY = [2, 1, -1, -2, -2, -1, 1, 2];
  const dist = new Array(W * W).fill(-1); dist[s] = 0;
  const q = [s];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], x = cur % W, y = (cur - x) / W;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      if (nx >= 0 && nx < W && ny >= 0 && ny < W) {
        const nb = ny * W + nx;
        if (dist[nb] === -1) { dist[nb] = dist[cur] + 1; q.push(nb); }
      }
    }
  }
  return dist;
}
function discoveryOrder(W, s, t) {
  const order = [];
  I.run(K.source({ W: W, start: s, target: t }), { host: {
    mark: function (sq, kind) { if (kind === 'ok') { order.push(sq); } },
  } });
  return order;
}
let orderChecked = 0;
for (const [W, s, t] of [[8, 0, 63], [6, 0, 35], [8, 12, 40]]) {
  const order = discoveryOrder(W, s, t);
  const dist = hostDist(W, s);
  T.ok(order.length > 5, W + 'x' + W + ' ' + s + '→' + t + '：确认了 ' + order.length + ' 个格子，这条门没有空转');
  T.eq(order[0], s, W + 'x' + W + ' ' + s + '→' + t + '：第一个被确认的就是出发格');
  let bad = null, prev = -1, dup = null;
  const once = Object.create(null);
  for (const sq of order) {
    if (once[sq]) { dup = sq; break; }
    once[sq] = 1;
    if (dist[sq] < prev) { bad = sq; break; }
    prev = dist[sq];
  }
  T.ok(dup === null, W + 'x' + W + ' ' + s + '→' + t + '：没有一格被确认两次' +
       (dup === null ? '' : '（' + dup + ' 重了）'));
  T.ok(bad === null, W + 'x' + W + ' ' + s + '→' + t +
       '：确认顺序按距离单调不减 —— 这就是层序' +
       (bad === null ? '' : '（走到 ' + bad + ' 时距离从 ' + prev + ' 掉到 ' + dist[bad] + '）'));
  T.eq(dist[order[order.length - 1]], hostBFS(W, s, t),
       W + 'x' + W + ' ' + s + '→' + t + '：最后一个被确认的就是目标格，它的层号就是答案');
  orderChecked++;
}
T.eq(orderChecked, 3, '三组都验过层序');

/* ---- 摆出来的那条路线：独立验证它真是一条合法的最短路 ----

   跟 tour.test.js 同一个理由：不能只看返回值。一个「返回 6 但盘上摆出一串
   乱七八糟的马」的实现会骗过所有只看 result 的断言，而盘上那串马正是她看到
   的东西。所以回放 place / clear 重建盘面，再独立验证：每一步都是合法马步、
   一头是出发格、另一头是目标格、长度恰好等于返回的最短距离 + 1。 */
function placedPath(W, s, t) {
  const seq = [];
  I.run(K.source({ W: W, start: s, target: t }), { host: {
    place: function (sq) { seq.push(sq); },
    clear: function (sq) { const at = seq.lastIndexOf(sq); if (at >= 0) { seq.splice(at, 1); } },
  } });
  return seq;
}
function isKnightWalk(seq, W) {
  for (let i = 1; i < seq.length; i++) {
    const ax = seq[i - 1] % W, ay = (seq[i - 1] - ax) / W;
    const bx = seq[i] % W, by = (seq[i] - bx) / W;
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    if (!((dx === 1 && dy === 2) || (dx === 2 && dy === 1))) {
      return 'step ' + i + ' is not a knight move';
    }
  }
  const seen2 = {};
  for (const sq of seq) { if (seen2[sq]) { return 'square ' + sq + ' appears twice'; } seen2[sq] = 1; }
  return null;
}
let pathChecked = 0;
for (const [W, s, t] of [[8, 0, 63], [8, 0, 27], [5, 0, 24], [8, 12, 40]]) {
  const d = hostBFS(W, s, t);
  const seq = placedPath(W, s, t);
  T.eq(seq.length, d + 1,
       W + 'x' + W + ' ' + s + '→' + t + '：盘上摆着 ' + (d + 1) + ' 匹马（最短 ' + d + ' 步就是 ' + (d + 1) + ' 格）');
  const why = isKnightWalk(seq, W);
  T.ok(why === null, W + 'x' + W + ' ' + s + '→' + t + '：那串马是一条合法的马步路线' +
       (why ? '：' + why : ''));
  T.ok(seq.indexOf(s) >= 0 && seq.indexOf(t) >= 0,
       W + 'x' + W + ' ' + s + '→' + t + '：路线的两头正是出发格与目标格');
  pathChecked++;
}
T.eq(pathChecked, 4, '四组都验过盘上那条路线');

/* ---- 到不了的时候：返回 −1，盘上一匹马都不摆 ----
   2×2 上马一步都走不出去。**「到不了」必须是 −1，不许变成 0** —— 0 是
   「已经站在目标上」，把这两件事混成同一个数字是这一题最不能出的错。 */
{
  const r = I.run(K.source({ W: 2, start: 0, target: 3 }), { host: {} });
  T.eq(r.result, hostBFS(2, 0, 3), '2x2 0→3 到不了：与宿主侧 BFS 一致（−1）');
  T.eq(r.result, -1, '到不了返回 −1，不是 0');
  T.eq(placedPath(2, 0, 3).length, 0, '到不了的时候盘上一匹马都不摆');
}
// 出发格就是目标格：0 步，而且盘上就那一匹马。
{
  const r = I.run(K.source({ W: 8, start: 27, target: 27 }), { host: {} });
  T.eq(r.result, 0, '出发格就是目标格：0 步');
  T.eq(placedPath(8, 27, 27), [27], '这时候盘上只有出发格那一匹马');
}

/* ---- 缺参数当场抛（阶段 5 约束 6：省略参数已经是本仓库抓到过五次的缺陷类）---- */
T.throws(function () { K.source({ start: 0, target: 63 }); }, '缺 W 当场抛');
T.throws(function () { K.source({ W: 8, target: 63 }); }, '缺 start 当场抛');
T.throws(function () { K.source({ W: 8, start: 0 }); }, '缺 target 当场抛');
T.throws(function () { K.source(); }, '连 opts 都没有也当场抛');
T.throws(function () { K.source({ W: 8, start: 64, target: 0 }); }, 'start 越界当场抛');
T.throws(function () { K.source({ W: 8, start: 0, target: 64 }); }, 'target 越界当场抛');
T.throws(function () { K.source({ W: 8, start: -1, target: 0 }); }, 'start 为负当场抛');
T.throws(function () { K.source({ W: 8.5, start: 0, target: 1 }); }, 'W 不是整数当场抛');
// 但**不**校验「跑不跑得完」，也不校验「到不到得了」：那两件事要跑出来给她看。
{
  let err = null;
  try { K.source({ W: 2, start: 0, target: 3 }); } catch (e) { err = e; }
  T.ok(err === null, '明知到不了的 2×2 照常吐源码');
}

/* ---- 约束 7：断言「某个导出不存在」要用 typeof ----
   `JSON.stringify(function(){})` 与 `JSON.stringify(undefined)` 都是 undefined，
   写成 T.eq(K.N_MAX, undefined) 会在 K.N_MAX 是个函数时照样绿。 */
T.ok(typeof K.source === 'function', '导出的形状与 queens / tour 同形：{ source }');

T.report();
