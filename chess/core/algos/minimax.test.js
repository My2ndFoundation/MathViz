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

// ---- ordered 也必须与 ab 共用同一份源码（两段式，不是一条正则打三家）----
/* 上面那条 plain↔ab 的 diff 管不到 ordered。少了这一段，一次「给 ordered
   单独复制一份源码」的重构可以全身而过：onlyInAb 仍是 4，三个 mode 仍然
   返回同一个值，ordSteps 仍然小于 abSteps —— 而 order tab 从此不再是对比，
   可它的全部内容就是对比。
   为什么必须分两段而不是把 ordered 也塞进上面那条正则：排序那几行**压根
   不含 alpha/beta**（它谈的是 caps/quiet/ms），硬要一条正则同时管住三个
   mode，只能靠往排序代码里塞 alpha/beta 字样去迁就断言 —— 那是为了断言
   去污染源码，正好是不该做的事。
   于是：第一段查「有没有丢东西」（ordered ⊇ ab，逐行），第二段查「多出来
   的是不是只有排序那一块」（数量、位置连成一片、且只谈 caps/quiet/ms）。 */
const ordLines = A.source({ mode: 'ordered', depth: 3 }).split('\n');

// 第一段：ordered 必须逐行包含 ab 的全部内容 —— 这条才是防「另写一份」的那道锁。
const missingFromOrd = abLines.filter(function (l) { return ordLines.indexOf(l) === -1; });
T.eq(missingFromOrd, [], 'ordered 没有丢掉 α-β 的任何一行 —— 它是在 α-β 之上加排序，不是另写一份');

// 第二段：ordered 比 ab 多出来的，必须只有排序那一块。
const ordOnly = ordLines.filter(function (l) { return abLines.indexOf(l) === -1; });
T.ok(ordOnly.length > 0, 'ordered 确实多出了排序那几行');
T.ok(ordOnly.length <= 14, 'ordered 只比 α-β 多出不超过 14 行（实际多出：' +
     ordOnly.length + ' 行）');

/* 多出来的行必须**挤在一起**。散落各处 = 源码被整份改写过；连成一片 =
   只插入了一块。窗口按行号算而不要求严格连续，因为块里的 `  }` 这类行
   在 ab 里本来就有，会被 filter 漏掉，在窗口中间留个洞。 */
const ordOnlyIdx = [];
ordLines.forEach(function (l, i) { if (abLines.indexOf(l) === -1) { ordOnlyIdx.push(i); } });
const span = ordOnlyIdx[ordOnlyIdx.length - 1] - ordOnlyIdx[0] + 1;
T.ok(span <= 14, '多出来的行连成一片（跨 ' + span + ' 行，不超过 14）—— 不是散落在整份源码里');

/* 而且这一块只能在谈排序。判据：要么是注释（整块的说明文字），要么这行
   代码只碰排序用的那几个名字 —— caps / quiet / ms 两个桶和被分桶的走法
   q / qt。碰到 bd、best、depth、search 之类就说明多出来的不只是排序。 */
const SORTING_NAMES = /caps|quiet|\bms\b|\bq\b|\bqt\b/;
for (const l of ordOnly) {
  const code = l.replace(/\/\/.*$/, '').trim();          // 去掉行尾注释
  const isCommentOnly = code === '' || code.indexOf('/*') === 0 || !/[;{}=]/.test(code);
  T.ok(isCommentOnly || SORTING_NAMES.test(code),
       '多出来的每一行都只在谈排序（caps/quiet/ms/q）：' + l.trim());
}

// ---- 钉住公布出去的那几个值（不是步数）----
/* 王的分值那个 bug 能活下来，正是因为这几个参考值没有任何守卫：VAL 错开
   一格，深度 3 静默地从 136 变成 112，测试全绿。
   钉**值**不钉**步数**：值是这个算法的意思，不许无声漂移；步数是它的代价，
   本来就该在使用者改动源码时改变（规格 §2.8 就指望她去改）。 */
const EXPECTED = { 1: 124, 2: 0, 3: 136 };
for (const depth of [1, 2, 3]) {
  const r = I.run(A.source({ mode: 'plain', depth: depth }), { host: {} });
  T.eq(r.result, EXPECTED[depth], 'depth ' + depth + ' 的极小极大值是公布的那个：' + EXPECTED[depth]);
}
/* 深度 4 只能拿 α-β 问 —— plain 在这一格撞墙、返回 undefined，
   而那正是这一课本身（上面已经断言过 truncated）。 */
T.eq(survive.result, -12, 'depth 4 的极小极大值是公布的 −12（问 α-β，因为 plain 在这一格跑不完）');

T.report();
