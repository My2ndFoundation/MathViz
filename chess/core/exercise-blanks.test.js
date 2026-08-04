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

/* 三关的通用跑法。variant 是 (src) => src 的改写函数。

   `wrongDiv` 是**一个对象**而不是一个裸的步号：`{ refStep, herStep, opIndex }`。
   从前这里只收一个 `wrongStepExpected`，而调用处的注释却在描述「第 6 条棋盘
   事件上参考说 sq=6 是 cut」这种关于 `kind` / `opIndex` 的事 —— 注释声称钉住
   的东西比断言实际钉住的多，那正是注释开始漂移的方式。用具名字段而不是再加
   几个位置参数：位置参数一多，抄第五遍的时候顺序就会错；也**不要**把三个数
   包成一个对象去一次性 `T.eq` —— `_test.js` 的 eq 比的是 `JSON.stringify`，
   键的顺序不同就会红成一条看不懂的失败。三条标量断言，各报各的。 */
function threeGates(name, refSrc, check, wrongFn, wrongDiv, equivFn) {
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
  const d = wrong.divergence;

  /* **kind 必须先钉住，否则下面那个步号根本不是「分歧的那一步」。**
     exercise.js 的 judge 写得很清楚：只有 `kind === 'boardOps'` 时 refStep
     才是真正的第一处分歧；`counters` / `result` 比的是末值，它们的 refStep
     只是「能跳过去的合理位置」。少了这一条，一个跳过 boardOps 比较的判定
     会让分歧悄悄退化成 `{kind:'counters', refStep:2479}` —— 实测它之所以
     还能被下面那条抓住，纯粹是因为 2479 恰好不等于 76 和 276，是巧合不是
     设计。挖空选点也靠这一条：错误变体如果不在棋盘上分歧，这道题就给不出
     §2.9 要的那种「跑到第几步为止你和参考一致」的反馈。 */
  T.eq(d ? d.kind : null, 'boardOps',
       name + ' ②：分歧是棋盘事件（只有这个 kind 的 refStep 才配叫「分歧的那一步」）');
  T.eq(d ? d.refStep : null, wrongDiv.refStep,
       name + ' ②：分歧步精确匹配（参考侧第 ' + wrongDiv.refStep + ' 步）');
  T.eq(d ? d.herStep : null, wrongDiv.herStep,
       name + ' ②：分歧步精确匹配（她那侧第 ' + wrongDiv.herStep + ' 步）');
  T.eq(d ? d.opIndex : null, wrongDiv.opIndex,
       name + ' ②：分歧落在第 ' + wrongDiv.opIndex + ' 条棋盘事件上');

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

/* ↑ 上面两条只钉了 N=5。**滑杆整段 N=4..8 都要跑得完**。

   简报原本给的 `fill="return true;"`（恒真）等于把剪枝整个拿掉，搜索树
   退化成满的 N^N 棵树。实测（`I.run(placeholder, { host: {} })`）：

     N=4  7,444 步   trunc=false  result=256
     N=5  85,186 步  trunc=false  result=3125
     N=6  200,000 步 trunc=true   result=undefined
     N=7  200,000 步 trunc=true   result=undefined
     N=8  200,000 步 trunc=true   result=undefined

   N>=6 撞上 `Interp.STEP_LIMIT` 被截断、`result` 是 `undefined` —— 这直接
   违反「占位版必须仍然能跑」本身，不需要再借 judge 说什么。

   **不要把它说成 judge 会返回 'unknown'**（这里从前就是这么写错的）：
   `unknown` 要求「**没找到分歧**且有一侧截断」（见 exercise.js 的 judge），
   而恒真占位在头一百步内就在 boardOps 上分歧了，实测每一档都是 `fail`：
   N=6 {kind:'boardOps', refStep:76, herStep:79, opIndex:4}、
   N=8 {kind:'boardOps', refStep:92, herStep:95, opIndex:4}。

   真正的理由是上面那张表，外加 queens.js 文件头把**恒假**记录为验证过的
   那道缝（「程序照常跑完，result 变成 0 —— 不抛、不截断」）。所以 fill 用
   `return false;`，并把这一条断言从一个 N 加宽到整条滑杆 —— 简报那两条
   在 N=5 下是绿的，加宽才是这个修正的牙齿。 */
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
     cut、她的版本说是 ok，参考侧发生在第 76 步（她那边第 79 步）。
     这句话里的每一个数现在都被上面那四条断言钉住了。 */
  { refStep: 76, herStep: 79, opIndex: 6 },
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
     是 ok、她的版本说是 cut，参考侧第 276 步（她那边第 265 步）。
     同上，这句话里的每一个数都被钉住了。 */
  { refStep: 276, herStep: 265, opIndex: 52 },
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
