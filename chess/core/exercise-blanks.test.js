'use strict';
/* §7.4：每个挖空必须过三关 ——
     ① 参考答案通过自己的判定（check 声明写错时这条就不成立）
     ② 至少一个已知错误变体被判错，且分歧步精确匹配（±0）
     ③ 至少一个「正确但写法不同」的变体被判对（专防判定过严，最容易漏写）
   第 ③ 项同时是挖空选点的筛子：写不出等价改写的位置不适合做成练习。 */
const T = require('./_test.js');
const E = require('./exercise.js');
const I = require('./interp.js');

/* 每道挖空题的 check 声明必须与工具页 PROBLEMS 里的那一份一致。
   这里重复一遍是有意的：测试不该 require 一个 html。Task 7 要在页面里
   加一条注释指回这个文件。 */
const CHECK_QUEENS = { result: true, boardOps: true, counters: ['solutions'] };

/* 三关的通用跑法。variant 是 (src) => src 的改写函数。 */
function threeGates(name, refSrc, check, wrongFn, wrongStepExpected, equivFn) {
  const ref = I.run(refSrc, { host: {} });
  T.ok(!ref.trace.truncated, name + '：参考运行未截断');

  // ① 参考答案通过自己的判定
  const self = E.judge(ref, I.run(refSrc, { host: {} }), check);
  T.eq(self.status, 'pass', name + ' ①：参考答案通过自己的判定');

  // ② 已知错误变体被判错，且分歧步精确
  const wrongSrc = wrongFn(refSrc);
  T.ok(wrongSrc !== refSrc, name + ' ②：错误变体确实改动了源码');
  const wrong = E.judge(ref, I.run(wrongSrc, { host: {} }), check);
  T.eq(wrong.status, 'fail', name + ' ②：错误变体被判错');
  /* `divergence` 只在 fail 时非空。不设防的 `wrong.divergence.refStep` 在
     判定退化成「永远判对」时会抛 TypeError —— 那仍然是红的，但红成一段
     栈回溯，看不出期望值和实际值。改成三目取值，同样一条断言，失败时
     报的是「expected 76, actual null」。 */
  T.eq(wrong.divergence ? wrong.divergence.refStep : null, wrongStepExpected,
       name + ' ②：分歧步精确匹配（参考侧第 ' + wrongStepExpected + ' 步）');

  // ③ 等价改写被判对
  const equivSrc = equivFn(refSrc);
  T.ok(equivSrc !== refSrc, name + ' ③：等价改写确实改动了源码');
  const equiv = E.judge(ref, I.run(equivSrc, { host: {} }), check);
  T.eq(equiv.status, 'pass', name + ' ③：等价改写被判对（防判定过严）');
}

/* ---------- queens ---------- */

const Q = require('./algos/queens.js');
const qSrc = Q.source({ N: 5 });

/* 声明的挖空确实能被解析出来，且 id 与 level 是说好的那些 */
const qBlanks = E.parse(qSrc).blanks;
T.eq(qBlanks.length, 2, 'queens 声明了两个挖空');
T.eq(qBlanks[0].id, 'safe-return', 'queens 第一个挖空的 id');
T.eq(qBlanks[0].level, 1, 'queens 第一个挖空是 1 级');
T.eq(qBlanks[1].id, 'undo', 'queens 第二个挖空的 id');
T.eq(qBlanks[1].level, 2, 'queens 第二个挖空是 2 级');

/* 占位版必须仍然能跑（她按 Run 时什么都没填也不该报错） */
const qPlace = I.run(E.parse(qSrc).placeholder, { host: {} });
T.ok(!qPlace.trace.truncated, 'queens 占位版能跑完，不截断');
T.ok(qPlace.result !== undefined, 'queens 占位版有返回值（虽然答案不对）');

/* ↑ 上面两条只钉了 N=5。**滑杆整段 N=4..8 都要跑得完** —— 简报原本给的
   `fill="return true;"`（恒真）在 N>=6 会跑成满 N^N 棵树、撞上 200,000 步
   上限被截断，judge 于是返回 'unknown' 而不是 'fail'：她开着默认棋盘按
   Run，看到的是「跑不完，没法判」，而 §2.9 要的是「跑得完但答错」。
   queens.js 文件头验过的那道缝写的也是**恒假**表达式（「程序照常跑完，
   result 变成 0 —— 不抛、不截断」）。所以 fill 用 `return false;`，
   并把这一条断言从一个 N 加宽到整条滑杆 —— 这就是那个修正的牙齿。 */
for (const N of [4, 5, 6, 7, 8]) {
  const p = I.run(E.parse(Q.source({ N: N })).placeholder, { host: {} });
  T.ok(!p.trace.truncated, 'queens 占位版 N=' + N + ' 跑得完，不截断');
  T.ok(p.result !== undefined, 'queens 占位版 N=' + N + ' 有返回值（虽然答案不对）');
}

/* safe-return 的占位是恒假，`undo` 那一段落在 `if (safe(r, c))` 里面，
   于是全盘占位时它一步都跑不到。单独把 undo 换成占位（safe 用参考答案）
   再钉一次：这一条挖空自己的占位也必须跑得完。 */
const undoOnly = qSrc.replace(
  '      cols[c] = 0; diagDown[r + c] = 0; diagUp[r - c + N] = 0;',
  '      cols[c] = 0;');
const undoOnlyRun = I.run(undoOnly, { host: {} });
T.ok(!undoOnlyRun.trace.truncated, 'queens 只把 undo 换成占位时也跑得完');
T.ok(undoOnlyRun.result !== undefined, 'queens 只把 undo 换成占位时有返回值');

threeGates('queens/safe-return', qSrc, CHECK_QUEENS,
  function (s) { return s.replace('!diagUp[r - c + N]', 'true'); },
  /* 实测值，不是推导值：漏查 diagUp 之后，第 6 条棋盘事件上参考说 sq=6 是
     cut、她的版本说是 ok，参考侧发生在第 76 步（她那边第 79 步）。 */
  76,
  function (s) {
    return s.replace(
      '  return !cols[c] && !diagDown[r + c] && !diagUp[r - c + N];',
      [
        '  if (cols[c]) { return false; }',
        '  if (diagDown[r + c]) { return false; }',
        '  if (diagUp[r - c + N]) { return false; }',
        '  return true;',
      ].join('\n'));
  });

threeGates('queens/undo', qSrc, CHECK_QUEENS,
  function (s) {
    return s.replace('      cols[c] = 0; diagDown[r + c] = 0; diagUp[r - c + N] = 0;',
                     '      cols[c] = 0;');
  },
  /* 实测值：只还原 cols、两条斜线一直占着，第 52 条棋盘事件上参考说 sq=8
     是 ok、她的版本说是 cut，参考侧第 276 步（她那边第 265 步）。 */
  276,
  /* 简报原本给的等价改写是「三条赋值换顺序」。它确实被判对，但**没有牙齿**：
     换顺序不增不减语句，实测步数 2,621，跟参考**一模一样**。于是一个偷偷
     变严的判定（比如改成顺带比 trace.length）根本不会被这条断言抓到——
     safe-return 那条会红（3,014 vs 2,621），undo 这条照样绿。
     换成「先把两个斜线下标取成 const，再倒着还原」：同样是一份正确答案，
     但它多两条语句、实测 2,727 步，形状真的不同，比 trace.length 就会红。 */
  function (s) {
    return s.replace('      cols[c] = 0; diagDown[r + c] = 0; diagUp[r - c + N] = 0;',
      [
        '      const dDown = r + c;',
        '      const dUp = r - c + N;',
        '      diagUp[dUp] = 0; diagDown[dDown] = 0; cols[c] = 0;',
      ].join('\n'));
  });

/* 简报那份「纯换顺序」的等价改写也留着单独钉一条：它没牙齿，但它说的是
   另一件事——三条赋值彼此独立，顺序不该被判定当回事。 */
const undoReorder = qSrc.replace(
  '      cols[c] = 0; diagDown[r + c] = 0; diagUp[r - c + N] = 0;',
  '      diagUp[r - c + N] = 0; diagDown[r + c] = 0; cols[c] = 0;');
T.ok(undoReorder !== qSrc, 'queens/undo：换顺序的改写确实改动了源码');
T.eq(E.judge(I.run(qSrc, { host: {} }), I.run(undoReorder, { host: {} }), CHECK_QUEENS).status,
     'pass', 'queens/undo：三条赋值换顺序也判对');

T.report();
