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
   只断言解数的话，一个不调 mark/place 的实现照样全绿。

   但「调了 50 次以上」「用了 2 种以上 kind」同样**没有牙齿**：随机乱标、
   把后摆在互相攻击的格子上、摆了不收，三种实现都能轻松凑够次数，而解数
   那几条断言靠纯算术照样全绿 —— 画面和数字于是可以各说各话，正好是这段
   注释自称要防的那件事。所以下面比的不是次数，是**不变量**，而且最后一组
   把棋盘事件跟解数用的**同一条公认序列**对上：棋盘上真的摆出过 KNOWN[N]
   个不同的满盘格局，且每一个都是合法的 N 皇后布局。 */
const BOARD_N = 6;
const ops = [];
I.run(Q.source({ N: BOARD_N }), { host: {
  mark: function (sq, kind) { ops.push(['mark', sq, kind]); },
  place: function (sq, p) { ops.push(['place', sq, p]); },
  clear: function (sq) { ops.push(['clear', sq]); },
} });

/* 回放棋盘事件，重建「此刻盘上有哪几个后」。 */
let places = 0, clears = 0, strayClear = 0, doublePlace = 0, peak = 0, liveCount = 0;
const live = {};                 // sq → true
const configs = {};              // 满盘格局去重：'2,9,19,26,33,40' → 1
for (const o of ops) {
  if (o[0] === 'place') {
    places++;
    if (live[o[1]]) { doublePlace++; }
    live[o[1]] = true; liveCount++;
    if (liveCount > peak) { peak = liveCount; }
    if (liveCount === BOARD_N) { configs[Object.keys(live).sort().join(',')] = 1; }
  } else if (o[0] === 'clear') {
    clears++;
    if (live[o[1]]) { delete live[o[1]]; liveCount--; } else { strayClear++; }
  }
}
T.eq(places, clears, 'place 与 clear 一一对应（' + places + ' / ' + clears + '）');
T.eq(doublePlace, 0, '没有把后摆到一个已经有后的格子上');
T.eq(strayClear, 0, '没有 clear 过一个本来就没有后的格子');
T.eq(liveCount, 0, '跑完之后棋盘是空的 —— 每个后都被回溯收了回去');
T.eq(peak, BOARD_N, '同时在场的后最多 ' + BOARD_N + ' 个，不多不少');

/* 一个格局合法吗：N 个格子，两两不同行、不同列、不同对角线。
   这一段是独立于被测源码另写的裁判，不复用它的 cols/diagDown/diagUp。 */
function legalConfig(sqs, N) {
  if (sqs.length !== N) { return false; }
  for (let i = 0; i < N; i++) {
    const ci = sqs[i] % N, ri = (sqs[i] - ci) / N;
    if (ri < 0 || ri >= N) { return false; }
    for (let j = i + 1; j < N; j++) {
      const cj = sqs[j] % N, rj = (sqs[j] - cj) / N;
      if (ri === rj || ci === cj) { return false; }
      if (ri - ci === rj - cj || ri + ci === rj + cj) { return false; }
    }
  }
  return true;
}
const seen = Object.keys(configs);
T.eq(seen.length, KNOWN[BOARD_N],
     '棋盘上真的摆出过 ' + KNOWN[BOARD_N] + ' 个不同的满盘格局（棋盘事件对上了公认解数）');
let verified = 0;
for (const key of seen) {
  const sqs = key.split(',').map(Number);
  T.ok(legalConfig(sqs, BOARD_N), '格局 [' + key + '] 是合法的 ' + BOARD_N + ' 皇后布局');
  verified++;
}
T.eq(verified, KNOWN[BOARD_N], '每一个格局都真的查过（这条防的是上面那个循环空转）');

/* mark 的编舞：§2.7 的四种状态一个不少，而且每个 ok / cut 之前都有
   同一格上的 try —— 「先亮起来说我要试这一格，再判定」。 */
const KINDS = { try: 0, ok: 0, cut: 0, back: 0 };
let unknownKind = 0, orphan = 0, lastTry = null;
for (const o of ops) {
  if (o[0] !== 'mark') { continue; }
  const kind = o[2];
  if (Object.prototype.hasOwnProperty.call(KINDS, kind)) { KINDS[kind]++; } else { unknownKind++; }
  if (kind === 'try') { lastTry = o[1]; }
  else if (kind === 'ok' || kind === 'cut') { if (o[1] !== lastTry) { orphan++; } }
}
T.eq(unknownKind, 0, 'mark 只用了 §2.7 的四种 kind');
T.ok(KINDS.try > 0 && KINDS.ok > 0 && KINDS.cut > 0 && KINDS.back > 0,
     '四种状态都画到了：' + JSON.stringify(KINDS));
T.eq(orphan, 0, '每个 ok / cut 之前都有同一格上的 try —— 先亮起再判定');
T.eq(KINDS.ok + KINDS.cut, KINDS.try, 'try 过的每一格最后都有了结论');
T.eq(KINDS.ok, places, '每一次「已确认」都真的摆了一个后');
T.eq(KINDS.back, clears, '每一次「回溯撤销」都真的收回了一个后');

// ---- 子集约束：源码里不许出现三元运算符 ----
/* 不要写成 indexOf('?')：注释里一个中文问号就会让它无端变红。
   上面的 I.parse 已经证明了子集合法性（三元会抛 unsupported）。 */

/* ---- 缺参数当场抛（阶段 5 约束 6：省略参数已经是本仓库抓到过五次的缺陷类）----

   这一份是四个模块里最早写的，写下的时候约束 6 那一轮教训还没发生，于是
   `source()` 的校验**实现了却没有被任何一条断言钉住**：今天谁给 N 加一个
   默认值（哪怕只是 `const N = o.N === undefined ? 8 : o.N;`），上面所有对拍、
   撞墙、编舞的断言仍旧全绿——它们每一条都显式传了 N。那正是这道题最不能出的
   错：界面写着 6、跑的却是 8（见 queens.js `source()` 头上的注释）。
   形状与 tour.test.js / knight-path.test.js 同源。 */
T.throws(function () { Q.source(); }, '连 opts 都没有也当场抛');
T.throws(function () { Q.source({}); }, '缺 N 当场抛 —— N 没有默认值');
T.throws(function () { Q.source({ N: 0 }); }, 'N < 1 当场抛');
T.throws(function () { Q.source({ N: 4.5 }); }, 'N 不是整数当场抛');
T.throws(function () { Q.source({ N: '8' }); }, 'N 是字符串当场抛（不许悄悄当 8 用）');
/* 但**不**拿 N_MIN / N_MAX 当校验边界：N=9 撞墙那一条要靠 source(9) 真吐源码。
   （上面的 wall 那一段已经跑过它了，这里只把这个取舍写明。） */

T.report();
