'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const A = require('./minimax.js');

// ---- 源码必须能被解释器解析（子集合法性）----
for (const mode of ['plain', 'ab', 'ordered']) {
  let err = null;
  try { I.parse(A.source({ mode: mode, depth: 2 })); } catch (e) { err = e; }
  T.ok(err === null, mode + ' 模式的源码在子集里合法' + (err ? '：' + err.message : ''));
}

// ---- 关键不变量：剪枝不许改变答案 ----
/* 这是本阶段的对拍测试。α-β 只允许省掉搜索，不允许算出别的值。
   拿纯 minimax 当参照，而不是写死期望值——3a 的经验是差分对拍
   抓到的真问题比任何手写期望值都多。 */
let compared = 0;
for (const depth of [1, 2, 3]) {
  const plain = I.run(A.source({ mode: 'plain', depth: depth }), { host: {} });
  const ab = I.run(A.source({ mode: 'ab', depth: depth }), { host: {} });
  T.ok(!plain.trace.truncated, 'depth ' + depth + ' 纯 minimax 未截断');
  T.ok(!ab.trace.truncated, 'depth ' + depth + ' α-β 未截断');
  T.eq(ab.result, plain.result, 'depth ' + depth + '：α-β 与纯 minimax 返回同一个值');
  compared++;
}
T.eq(compared, 3, '三个深度都做了对拍');

// ---- 走法排序同样不许改变答案 ----
for (const depth of [1, 2, 3]) {
  const plain = I.run(A.source({ mode: 'plain', depth: depth }), { host: {} });
  const ord = I.run(A.source({ mode: 'ordered', depth: depth }), { host: {} });
  T.eq(ord.result, plain.result, 'depth ' + depth + '：吃子优先序不改变极小极大值');
}

// ---- α-β 必须真的省下步数 ----
for (const depth of [2, 3]) {
  const p = I.run(A.source({ mode: 'plain', depth: depth }), { host: {} }).trace.length;
  const a = I.run(A.source({ mode: 'ab', depth: depth }), { host: {} }).trace.length;
  T.ok(a < p, 'depth ' + depth + '：α-β 步数更少（' + a + ' < ' + p + '）');
}

// ---- 吃子优先序必须比随机序剪得更狠（order tab 的全部内容）----
const abSteps = I.run(A.source({ mode: 'ab', depth: 3 }), { host: {} }).trace.length;
const ordSteps = I.run(A.source({ mode: 'ordered', depth: 3 }), { host: {} }).trace.length;
T.ok(ordSteps < abSteps, '吃子优先序比自然序剪得更狠（' + ordSteps + ' < ' + abSteps + '）');

// ---- 深度 4 的撞墙必须真的发生（规格 §4④ 的这一课）----
const wall = I.run(A.source({ mode: 'plain', depth: 4 }), { host: {} });
T.eq(wall.trace.truncated, true, 'depth 4 的纯 minimax 撞上 STEP_LIMIT —— 这就是这一课');
const survive = I.run(A.source({ mode: 'ab', depth: 4 }), { host: {} });
T.eq(survive.trace.truncated, false, 'depth 4 的 α-β 跑得完 —— 同一格，一个做不到、一个做得到');

/* 注：「源码里没有三元运算符」这条**不要**写成 `src.indexOf('?') === -1`
   ——注释里一个中文问号就会让它无端变红，而且它什么也没多证明：
   上面那三条 `I.parse()` 已经证明了子集合法性（三元会抛 unsupported）。 */

// ---- 三个 mode 的源码除了剪枝那几行以外必须逐字相同 ----
/* 学习者切 tab 时看到的应该是**同一份算法**多了或少了剪枝，而不是两份
   各写各的代码。两份独立维护的源码迟早漂移，而漂移之后「对比」就不再
   是对比了。 */
const plainLines = A.source({ mode: 'plain', depth: 3 }).split('\n');
const abLines = A.source({ mode: 'ab', depth: 3 }).split('\n');
const onlyInAb = abLines.filter(function (l) { return plainLines.indexOf(l) === -1; });
T.ok(onlyInAb.length > 0, 'α-β 确实多出了几行');
T.ok(onlyInAb.length <= 6, 'α-β 只比纯 minimax 多出不超过 6 行（实际多出：' +
     onlyInAb.length + ' 行）—— 多出来的应该只有剪枝');
for (const l of onlyInAb) {
  T.ok(/alpha|beta/.test(l), '多出来的每一行都与 alpha/beta 有关：' + l.trim());
}

T.report();
