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
   只断言解数的话，一个不调 mark/place 的实现照样全绿。 */
const ops = [];
I.run(Q.source({ N: 6 }), { host: {
  mark: function (sq, kind) { ops.push(['mark', sq, kind]); },
  place: function (sq, p) { ops.push(['place', sq, p]); },
  clear: function (sq) { ops.push(['clear', sq]); },
} });
T.ok(ops.length > 50, '算法确实在驱动棋盘（' + ops.length + ' 次棋盘操作）');
const kinds = {};
for (const o of ops) { if (o[0] === 'mark') { kinds[o[2]] = 1; } }
T.ok(Object.keys(kinds).length >= 2, 'mark 用了不止一种 kind：' + Object.keys(kinds).join('/'));
T.ok(ops.some(function (o) { return o[0] === 'place'; }), '摆了真正的后（place）');

// ---- 子集约束：源码里不许出现三元运算符 ----
/* 不要写成 indexOf('?')：注释里一个中文问号就会让它无端变红。
   上面的 I.parse 已经证明了子集合法性（三元会抛 unsupported）。 */

T.report();
