'use strict';
/* §7.4：每个挖空必须过三关 ——
     ① 参考答案通过自己的判定（check 声明写错时这条就不成立）
     ② 至少一个已知错误变体被判错，且分歧步精确匹配（±0）
     ③ 至少一个「正确但写法不同」的变体被判对（专防判定过严，最容易漏写）
   第 ③ 项同时是挖空选点的筛子：写不出等价改写的位置不适合做成练习。 */
const T = require('./_test.js');
const E = require('./exercise.js');
const I = require('./interp.js');

/* `parse(source, lang)` 的第二个参数是必填的（占位注释那一行的语言，见
   exercise.js 的文件头）。这个文件里的断言比的全是**行为**，跟占位注释是
   中文还是英文毫无关系，所以统一走这个包装，省得每个调用点重复一遍。
   语言本身的断言在 exercise.test.js 里，那边直接调 `E.parse(src, lang)`。 */
function parseZh(src) { return E.parse(src, 'zh'); }

/* 每道挖空题的 check 声明必须与工具页 PROBLEMS 里的那一份一致。
   这里重复一遍是有意的：测试不该 require 一个 html。Task 7 要在页面里
   加一条注释指回这个文件。 */
const CHECK_QUEENS = { result: true, boardOps: true, counters: ['solutions'] };
/* knightPath 与 tourKnight 都没有需要单独盯的计数器：前者的返回值就是距离，
   后者的返回值就是「找没找到」。`counters: []` 是**声明**不是遗漏 —— judge 的
   assertCheck 在三项全关时会抛，这两题 result 与 boardOps 都开着。 */
const CHECK_KP = { result: true, boardOps: true, counters: [] };
const CHECK_TOUR = { result: true, boardOps: true, counters: [] };

/* 三关的通用跑法。variant 是 (src) => src 的改写函数。

   `wrongDiv` 是**一个对象**而不是一个裸的步号：
   `{ refStep, herStep, opIndex, refSq, herSq, refTo, herTo }`。
   从前这里只收一个 `wrongStepExpected`，而调用处的注释却在描述「第 6 条棋盘
   事件上参考说 sq=6 是 cut」这种关于 `kind` / `opIndex` 的事 —— 注释声称钉住
   的东西比断言实际钉住的多，那正是注释开始漂移的方式。用具名字段而不是再加
   几个位置参数：位置参数一多，抄第五遍的时候顺序就会错；也**不要**把几个数
   包成一个对象去一次性 `T.eq` —— `_test.js` 的 eq 比的是 `JSON.stringify`，
   键的顺序不同就会红成一条看不懂的失败。标量断言，各报各的。

   ⚠ **`sq` 与 `to` 也在里面，而且 ref 与 her 各钉一份。** 修这条之前只钉了
   `kind`/`refStep`/`herStep`/`opIndex`，于是五处调用点的注释里那句「参考在看
   sq=X、她的版本在看 sq=Y」一条断言都没有 —— 跟上一段说的是同一种漂移，只差
   一个字段。最要紧的是 knightPath/on-board：她那侧 `sq=68`（8×8 上不存在的
   格子号）**就是那道挖空的全部教学点**。顺带一提，queens/safe-return 那处
   `opIndex === 6` 与 `refSq === 6` 相等纯属巧合，钉住之后就不会有人误读成
   「sq 早就被 opIndex 顺带钉住了」。
   `d.ref` / `d.her` 在长度不等的那条分支里**可以是 null**（judge 里 `r`/`h`
   两个三目），所以取值要连 `d.ref` 一起防，不能只防 `d`。 */
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
  T.eq(d && d.ref ? d.ref.sq : null, wrongDiv.refSq,
       name + ' ②：那一条事件上参考在看 sq=' + wrongDiv.refSq);
  T.eq(d && d.her ? d.her.sq : null, wrongDiv.herSq,
       name + ' ②：那一条事件上她的版本在看 sq=' + wrongDiv.herSq);
  T.eq(d && d.ref ? d.ref.to : null, wrongDiv.refTo,
       name + ' ②：参考给那一格的判词是 ' + wrongDiv.refTo);
  T.eq(d && d.her ? d.her.to : null, wrongDiv.herTo,
       name + ' ②：她的版本给那一格的判词是 ' + wrongDiv.herTo);

  // ③ 等价改写被判对
  const equivSrc = equivFn(refSrc);
  T.ok(equivSrc !== refSrc, name + ' ③：等价改写确实改动了源码');
  const equiv = E.judge(ref, I.run(equivSrc, { host: {} }), check);
  T.eq(equiv.status, 'pass', name + ' ③：等价改写被判对（防判定过严）');
}

/* ---------- queens ---------- */

const Q = require('./algos/queens.js');
const qSrc = Q.source({ N: 5, lang: 'zh' });

/* 声明的挖空确实能被解析出来，且 id 与 level 是说好的那些 */
const qBlanks = parseZh(qSrc).blanks;
T.eq(qBlanks.length, 2, 'queens 声明了两个挖空');
/* ⚠ 下标必须走三目，理由跟 blankOf 里那段、跟 threeGates 里不设防的
   `wrong.divergence` 是同一条：源码里少声明一个挖空时，裸的 `qBlanks[0].id`
   会抛 TypeError，`T.report()` 一次都跑不到 —— 上面那条 `length === 2` 明明
   已经红了，却一个字都印不出来，整轮只剩一段栈回溯。实测（把 safe-return
   的两行指令删掉）确认过。knightPath 与 tourKnight 两处本来就是这么写的，
   只有这里走了形。 */
T.eq(qBlanks[0] ? qBlanks[0].id : null, 'safe-return', 'queens 第一个挖空的 id');
T.eq(qBlanks[0] ? qBlanks[0].level : null, 1, 'queens 第一个挖空是 1 级');
T.eq(qBlanks[1] ? qBlanks[1].id : null, 'undo', 'queens 第二个挖空的 id');
T.eq(qBlanks[1] ? qBlanks[1].level : null, 2, 'queens 第二个挖空是 2 级');

/* 占位版必须仍然能跑（她按 Run 时什么都没填也不该报错） */
const qPlace = I.run(parseZh(qSrc).placeholder, { host: {} });
T.ok(!qPlace.trace.truncated, 'queens 占位版能跑完，不截断');
T.ok(qPlace.result !== undefined, 'queens 占位版有返回值（虽然答案不对）');

/* ↑ 上面两条只钉了 N=5。**滑杆整段 N=4..8 都要跑得完**。

   简报原本给的 `fill="return true;"`（恒真）等于把剪枝整个拿掉，搜索树
   退化成满的 N^N 棵树。实测（`I.run(placeholder, { host: {} })`）：

     N=4  8,124 步   trunc=false  result=256
     N=5  92,996 步  trunc=false  result=3125
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
  const p = I.run(parseZh(Q.source({ N: N, lang: 'zh' })).placeholder, { host: {} });
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
     这句话里的每一个数现在都被上面那八条断言钉住了 —— 包括两个 sq 与两个
     判词，它们从前只在这段注释里存在。 */
  { refStep: 76, herStep: 79, opIndex: 6,
    refSq: 6, herSq: 6, refTo: 'cut', herTo: 'ok' },
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
  { refStep: 276, herStep: 265, opIndex: 52,
    refSq: 8, herSq: 8, refTo: 'ok', herTo: 'cut' },
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

/* ---------- knightPath ---------- */

const KP = require('./algos/knight-path.js');

/* 用的是工具页 knightPath 那一档的默认值（`KP_W = 8` / `KP_START = 0` /
   目标格滑杆的初值 `W*W-1`）。它同时是 knight-path.js 文件头实测表里最贵的
   一档：5,086 步、距离 6、整块盘都铺遍。插指令行前后逐格相同。 */
const kpSrc = KP.source({ W: 8, start: 0, target: 63, lang: 'zh' });

const kpBlanks = parseZh(kpSrc).blanks;
T.eq(kpBlanks.length, 2, 'knightPath 声明了两个挖空');
T.eq(kpBlanks[0] ? kpBlanks[0].id : null, 'on-board', 'knightPath 第一个挖空的 id（按出现顺序）');
T.eq(kpBlanks[0] ? kpBlanks[0].level : null, 1, 'knightPath 的 on-board 是 1 级');
T.eq(kpBlanks[1] ? kpBlanks[1].id : null, 'seen-test', 'knightPath 第二个挖空的 id');
T.eq(kpBlanks[1] ? kpBlanks[1].level : null, 1, 'knightPath 的 seen-test 是 1 级');

/* ---- 占位版必须仍然能跑：**目标格滑杆全程**（1..63），不是一档 ----

   两个 `fill` 都跟简报给的**相反**，两处都是实测逼出来的，各挡一种事故：

   ① `on-board` 简报给的是 `fill="return true;"`（恒真）。它不截断（滑杆全程
      最多 9,726 步），所以「占位版能跑完」这一条抓不住它 —— 抓住它的是下面那条
      **越界格子事件**：恒真的 onBoard 会让 `nb = ny * W + nx` 算出 −15、68 这类
      **棋盘上根本不存在的格子号**，滑杆全程实测 10,561 条 mark 事件落在
      `sq < 0 || sq > 63` 上。棋盘层会被要求去画不存在的格子（`Debugger.boardState`
      不校验 sq，它只是一张以 sq 为键的表）。附带的第二件事：恒真版在 63 个目标格
      里有 38 个**答案照样对**，一个「按 Run 就给出正确读数」的占位版会让 Check
      看起来像在刁难人。改成 `return false;`：越界事件 0 条、结果恒为 −1（到不了）、
      滑杆全程最多 280 步。

   ② `seen-test` 简报给的是 `fill="if (false) {"`（永不认为碰过）。它也不截断
      （最多 52,998 步），但它 **63 个目标格全部答对** —— 逐层同步的 BFS 即使
      把「碰过没有」整个关掉，第一次生成目标格的那一层仍然正好是最短距离，
      于是占位版跑出来的读数跟参考一模一样。占位版的答案不能是对的。
      改成 `if (true) {`（一律当成碰过）：一层都铺不出去，结果恒为 −1，最多 288 步。

   共同的形状跟 queens 的 `return false;` 一致：占位一律往**过紧**的方向倒，
   不往过松的方向倒。过紧只是搜不出东西，过松会漫出棋盘或撞上限。 */
const kpPlaceBad = [];
let kpPlaceOffBoard = 0;
let kpPlaceRight = 0;
for (let target = 1; target <= 63; target++) {
  const src = KP.source({ W: 8, start: 0, target: target, lang: 'zh' });
  const p = I.run(parseZh(src).placeholder, { host: {} });
  if (p.trace.truncated || p.result === undefined) kpPlaceBad.push(target);
  if (p.result === I.run(src, { host: {} }).result) kpPlaceRight++;
  for (let i = 0; i < p.trace.length; i++) {
    const ops = p.trace[i].boardOps || [];
    for (let j = 0; j < ops.length; j++) {
      if (ops[j].sq < 0 || ops[j].sq > 63) kpPlaceOffBoard++;
    }
  }
}
T.eq(kpPlaceBad.length, 0,
     'knightPath 占位版在目标格滑杆全程（1..63）都跑得完、都有返回值' +
     (kpPlaceBad.length ? '；出问题的目标格：' + kpPlaceBad.join(',') : ''));
T.eq(kpPlaceOffBoard, 0,
     'knightPath 占位版一次都没有往棋盘外的格子号上写事件（挡住 fill="return true;"）');
T.eq(kpPlaceRight, 0,
     'knightPath 占位版在滑杆全程一个目标格都没答对（挡住 fill="if (false) {"）');

/* `on-board` 的占位是恒假，于是全盘占位时 `seen-test` 那一段一步都跑不到
   （跟 queens 的 undo 落在 `if (safe(...))` 里面是同一件事）。所以每个挖空
   还要**单独**拿自己的占位跑一次，别的挖空用参考答案。

   下面从 `parse()` 出来的挖空对象里取 `fill` 与 `body`，**不把占位文本再抄
   一遍**。这一条是被突变测试逼出来的：先前这里写死了 `if (true) {`，于是把
   源码里的 `fill=` 改成简报那个恒假版之后，整套测试仍然全绿 —— 断言钉的是
   测试自己抄的那份文本，不是源码里声明的那一份。

   **「这个 id 在不在」只查一次，查在循环外面。** 修复轮 1 之前它在 63 次目标格
   循环**里面**，于是删掉一个挖空会红 67 条，其中 63 条是同一行重复 —— 红的
   条数不再说明问题有多大，失败清单也没法读了。挖空清单是**每份源码一样**的
   （`source()` 只换 W/START/TARGET 三行常量），本来就没有逐档查的道理。 */
function blankOf(src, id) {
  const blanks = parseZh(src).blanks;
  for (let i = 0; i < blanks.length; i++) if (blanks[i].id === id) return blanks[i];
  /* 找不到就记一条失败、返回 null，**不抛**。抛出去的话 `T.report()` 根本跑不到，
     上面那几条「id 是不是说好的那个」的断言明明已经红了却一个字都印不出来，
     整轮只剩一段栈回溯 —— 跟 threeGates 里不设防的 `wrong.divergence.refStep`
     是同一种失败形态。 */
  T.ok(false, 'knightPath：源码里没有 id=' + id + ' 这个挖空（挖空清单变了？）');
  return null;
}
const KP_IDS = ['on-board', 'seen-test'];
const kpBlankOf = {};
for (let k = 0; k < KP_IDS.length; k++) kpBlankOf[KP_IDS[k]] = blankOf(kpSrc, KP_IDS[k]);

const kpOnlyBad = { 'on-board': [], 'seen-test': [] };
const kpOnlyRight = { 'on-board': 0, 'seen-test': 0 };
let kpOnlyOffBoard = 0;
for (let target = 1; target <= 63; target++) {
  const src = KP.source({ W: 8, start: 0, target: target, lang: 'zh' });
  const refResult = I.run(src, { host: {} }).result;
  for (let k = 0; k < KP_IDS.length; k++) {
    const b = kpBlankOf[KP_IDS[k]];
    if (!b) continue;   // 上面已经为它记过一条失败，别再重复 63 遍
    const p = I.run(src.replace(b.body, b.indent + b.fill), { host: {} });
    if (p.trace.truncated || p.result === undefined) kpOnlyBad[KP_IDS[k]].push(target);
    if (p.result === refResult) kpOnlyRight[KP_IDS[k]]++;
    for (let i = 0; i < p.trace.length; i++) {
      const ops = p.trace[i].boardOps || [];
      for (let j = 0; j < ops.length; j++) if (ops[j].sq < 0 || ops[j].sq > 63) kpOnlyOffBoard++;
    }
  }
}
T.eq(kpOnlyBad['on-board'].length, 0,
     'knightPath 只把 on-board 换成占位时，滑杆全程跑得完、有返回值' +
     (kpOnlyBad['on-board'].length ? '；出问题的目标格：' + kpOnlyBad['on-board'].join(',') : ''));
T.eq(kpOnlyBad['seen-test'].length, 0,
     'knightPath 只把 seen-test 换成占位时，滑杆全程跑得完、有返回值' +
     (kpOnlyBad['seen-test'].length ? '；出问题的目标格：' + kpOnlyBad['seen-test'].join(',') : ''));
T.eq(kpOnlyRight['on-board'], 0,
     'knightPath 的 on-board 占位单独跑时，滑杆全程一个目标格都没答对');
T.eq(kpOnlyRight['seen-test'], 0,
     'knightPath 的 seen-test 占位单独跑时，滑杆全程一个目标格都没答对' +
     '（挡住 fill="if (false) {" —— 那一版 63 个目标格全答对）');
T.eq(kpOnlyOffBoard, 0,
     'knightPath 两个挖空各自单独占位时，也一次都没往棋盘外的格子号上写事件');

threeGates('knightPath/on-board', kpSrc, CHECK_KP,
  /* 漏掉 `y < W` 那一项：上边界没人管了，波纹从棋盘顶上漫出去。 */
  function (s) {
    return s.replace('  return x >= 0 && x < W && y >= 0 && y < W;',
                     '  return x >= 0 && x < W && y >= 0;');
  },
  /* 实测值，不是推导值：第 133 条棋盘事件上参考在看 sq=61（**f8**：编号是
     `sq = y*W + x`，61 % 8 = 5 → f 列，(61 − 5) / 8 = 7 → 第 8 行；从前这里
     写的是 g8，算错了一个字母），她的版本在看 **sq=68 —— 一个 8×8 棋盘上不
     存在的格子号**，参考侧第 1,371 步（她那边第 1,364 步；她少几步是因为漏查
     一项，`&&` 短路得更早）。两边的判词都是 try：分歧不在「怎么判」，而在
     **判的是哪一格**，这正是漏掉边界检查的样子。 */
  { refStep: 1371, herStep: 1364, opIndex: 133,
    refSq: 61, herSq: 68, refTo: 'try', herTo: 'try' },
  /* 四条边拆成四条 if 再 return true —— 跟 queens/safe-return 那条同形，也同样
     有牙齿：实测 6,592 步 vs 参考 5,086 步，形状真的不同，一个偷偷改成顺带比
     trace.length 的判定会在这里红。

     **这是有意偏离规格 §2.9 的挖空表**：那里给的等价改写是
     `return !(x < 0 || x >= W || y < 0 || y >= W)`（德摩根一次）。那一版确实也
     被判对，但它**没有牙齿** —— 一个表达式换成另一个表达式，语句数不变、步数
     跟参考一模一样，于是一个偷偷变严的判定在它上面照样绿。换成四条 if 是同一
     道题的另一份正确答案（她真会这么写），而且形状真的不同。规格那一版在下面
     单独钉了一条，它说的是另一件事：德摩根改写也必须判对。 */
  function (s) {
    return s.replace('  return x >= 0 && x < W && y >= 0 && y < W;',
      [
        '  if (x < 0) { return false; }',
        '  if (x >= W) { return false; }',
        '  if (y < 0) { return false; }',
        '  if (y >= W) { return false; }',
        '  return true;',
      ].join('\n'));
  });

threeGates('knightPath/seen-test', kpSrc, CHECK_KP,
  /* `>= 0` 写成 `> 0`：dist 恰好是 0 的那一格 —— 出发格 —— 不再算「碰过」。 */
  function (s) {
    return s.replace('        if (dist[nb] >= 0) {', '        if (dist[nb] > 0) {');
  },
  /* 实测值：第 14 条棋盘事件上参考说 sq=0（a1，出发格）是 cut、她的版本说是 ok，
     参考侧第 361 步（她那边第 363 步）。分歧落在出发格上正是这个错法的定义 ——
     报出来的那一条事件本身就把 bug 指出来了。 */
  { refStep: 361, herStep: 363, opIndex: 14,
    refSq: 0, herSq: 0, refTo: 'cut', herTo: 'ok' },
  /* 换一种说法问同一件事（`!== -1`），顺手取个名字。实测 5,386 步 vs 参考
     5,086 步 —— 多一条语句，步数真的不同。 */
  function (s) {
    return s.replace('        if (dist[nb] >= 0) {',
      [
        '        const already = dist[nb] !== -1;',
        '        if (already) {',
      ].join('\n'));
  });

/* 规格 §2.9 挖空表给 `on-board` 的那份等价改写（德摩根一次）也留着单独钉一条：
   它没牙齿（实测 5,086 步，跟参考**一模一样**），但它说的是另一件事 —— 同一个
   条件反过来写也必须判对。跟 queens/undo 那条「三条赋值换顺序」同一个用意。 */
const kpDeMorgan = kpSrc.replace('  return x >= 0 && x < W && y >= 0 && y < W;',
                                 '  return !(x < 0 || x >= W || y < 0 || y >= W);');
T.ok(kpDeMorgan !== kpSrc, 'knightPath/on-board：德摩根改写确实改动了源码');
T.eq(E.judge(I.run(kpSrc, { host: {} }), I.run(kpDeMorgan, { host: {} }), CHECK_KP).status,
     'pass', 'knightPath/on-board：规格给的德摩根改写也判对');

/* ---------- tourKnight（Warnsdorff 那一份） ---------- */

const TW = require('./algos/tour-warnsdorff.js');
const TD = require('./algos/tour-dfs.js');
/* 四块盘就是工具页 `TOUR_BOARDS` 的四档；3×4 是滑杆初值。 */
const TOUR_BOARDS = [[3, 4], [3, 5], [4, 5], [3, 7]];
const twSrc = TW.source({ W: 3, H: 4, start: 0, lang: 'zh' });

/* ---- 这里只有**一个**挖空，不是简报和规格 §2.9 说的两个 ----

   计划与规格给 tourKnight 排了两个挖空：`degree-count`（1 级，`degree()` 里
   那一句 `if (!visited[…]) { d = d + 1; }`）与 `degree-fn`（3 级，整个
   `degree()` 函数）。**这两个挖空不可能同时存在**：后者的挖空体把前者整个
   包在里面，而 `exercise.js` 的 `parse()` 见到嵌套的 `>>> BLANK` 会当场抛
   （「BLANK 指令嵌套」，exercise.test.js 里有一条专门钉着它）。Task 6 拿到的
   是 `Exercise.parse(src).placeholder` 一份，所有挖空一起解析，没有「按难度
   挑一个」的入口。实测确认过：把两组指令按计划写进同一份源码，`parse` 抛。

   **换个位置给第二个挖空是办得到的，只是没有好落点。** 修复轮 1 之前这里写的
   是「三条约束把它挤没了」，那是**错的** —— 审查找到了反例，实测复现过。
   把话说准确（注释会被当成定论读，本项目在这上面反复交过学费）：

     ① 挖空只能落在 Warnsdorff **独有**的那两段（`degree()` 与排序那一段），
        否则 tour-dfs.js 与本文件「除了那一个主意逐字相同」的对照就多出噪声，
        而那份并排 diff 是这一课本身。**这一条是硬的。**
     ② 排序那一段**规格明令不挖**（换成插入排序是货真价实的等价改写，但并列
        时的打破方式不同，会走出另一条同样合法的巡游而被判错 —— §7.4「判定
        过严」的教科书案例）。**这一条也是硬的。**
     ③ 剩下的落点是量出路数那一行 `degs.push(degree(cand[i]));`。**它做得到**，
        条件是占位不能是常数：常数占位（`degs.push(0);`）会让候选全部并列、
        选择排序一次不交换，这一份退化成朴素回溯 —— 实测 3×4 1,304 · 3×5 51,012 ·
        **4×5 撞 200,000 上限**、`result` 是 `undefined`，而参考在那块盘上 7,283
        步就走完（Task 4 在 queens 的 `fill="return true;"` 上踩的同一条线）。
        但把静态出路数**内联**算一遍的占位就跑得完：实测 2,583 / 101,052 /
        5,848 / 撞墙，参考跑得完的三块它都跑得完。

        **不采用它，是因为那个占位很糟，不是因为办不到**：它比挖空体长十倍；
        它要把这道题正在问的那段八方向循环原样抄进占位里（等于把答案写在占位
        上）；教的还是跟 `degree-fn` 同一课；而且它落在规格叫人别动的那一段
        （排序）的正中间。

   所以这里交一个：`degree-fn`（3 级）。**留它而不是留 1 级那个是有理由的**：
   3 级在整个阶段 6 只出现这一次，丢了它「三个难度级都覆盖」就没了；而 1 级
   另有三个（queens/safe-return、knightPath 的两个）。填整个函数本来也要求她
   把那一句计数写出来，1 级那道题的内容并没有丢。

   控制者已裁定按这个走（修复轮 1）：五个挖空定案，阶段 6 的完成标准与规格
   §2.9 的挖空表各订正一行。 */
const twBlanks = parseZh(twSrc).blanks;
T.eq(twBlanks.length, 1, 'tour-warnsdorff 声明了一个挖空（两个会嵌套，parse 会抛）');
T.eq(twBlanks[0] ? twBlanks[0].id : null, 'degree-fn', 'tour-warnsdorff 那个挖空的 id');
T.eq(twBlanks[0] ? twBlanks[0].level : null, 3, 'tour-warnsdorff 的 degree-fn 是 3 级（整个函数）');

/* 嵌套确实抛 —— 上面那段话里最要紧的一句，钉住它，别让它退化成一段传说。 */
T.throws(function () {
  parseZh(twSrc.replace('      if (!visited[ny * W + nx]) { d = d + 1; }',
    [
      '      // >>> BLANK id=degree-count level=1 fill="d = d + 0;" hint="甲" hintEn="A"',
      '      if (!visited[ny * W + nx]) { d = d + 1; }',
      '      // <<< BLANK',
    ].join('\n')));
}, 'tourKnight：把 degree-count 再挖一道就嵌套了 —— parse 当场抛');

/* tour-dfs 是只读对照，一个挖空都不许有（§2.9 阶段 6 第 1 条）。
   四块盘各查一次：`source()` 是按盘拼字符串的，只查一块盘查不出「某块盘上
   多了一段」这种事。 */
for (let b = 0; b < TOUR_BOARDS.length; b++) {
  const W = TOUR_BOARDS[b][0], H = TOUR_BOARDS[b][1];
  T.eq(parseZh(TD.source({ W: W, H: H, start: 0, lang: 'zh' })).blanks.length, 0,
       'tour-dfs 在 ' + W + '×' + H + ' 上没有挖空 —— 它是只读对照');
}

/* ---- 占位版：四块盘逐块量，判据是「不比参考差」 ----

   tourKnight 的门槛跟 queens 不一样，因为**参考自己就在 3×7 上撞墙**
   （200,000 步、`result` 是 `undefined`，规格 §4⑤ 的第三段弧线就是这件事）。
   所以这里不能写死「占位版永不截断」—— 那条断言会因为一件跟挖空毫无关系的
   事而红。判据是：**参考跑得完的盘，占位版也要跑得完**。

   这一条把简报给的 `fill`（返回常数 0 的同签名函数）挡在门外。实测四块盘：

     盘     参考            占位 `return 0;`   占位「只差 !visited」  占位（现在这一版）
     3×4     3,092 ✓ true    1,393 ✓ true       2,672 ✓ true          9,115 ✓ true
     3×5   120,650 ✓ false  54,461 ✓ false    104,501 ✓ false        62,715 ✓ false
     4×5     7,283 ✓ true  200,000 ✗撞墙       6,059 ✓ true        131,559 ✓ true
     3×7   200,000 ✗撞墙   200,000 ✗撞墙     200,000 ✗撞墙        200,000 ✗撞墙

   返回常数的占位在 4×5 上撞墙，而参考在那块盘上 7,283 步就走完 —— 跟 Task 4
   在 queens 上遇到的是同一条线。原因值得写下来：degree 一返回常数，候选就全部
   并列，那段选择排序一次也不交换，**这一份就逐字退化成 tour-dfs**。实测钉过：
   `return 0;` 的占位版在 3×4 与 3×5 上的棋盘事件流与 tour-dfs 的**逐条相同**
   （40 条 / 3,223 条）。

   **但「撞墙」与「近乎完整的天真实现」不是仅有的两条路** —— 第三列那一版
   （只丢掉 `!visited` 一项）是修复轮 1 之前用的，它跑得最省，可是它与参考只差
   一个子句，而中文提示又把那个子句点了名，**等于把答案写了两遍**：这一阶段唯一
   的 3 级挖空实际上变成了 1 级，规格「三个难度级都覆盖」那句话就不成立了。

   现在的 `fill` 是第三条路：**按边界猜的角落偏好启发式**（从 8 开始，靠一条边
   减 2）。它不泄露八方向循环、不泄露 `onBoard` 调用、不泄露计数 —— 留下的是
   货真价实的 3 级工作量；它仍然是错的，错的正是这道题要教的那件事（出路数必须
   随着马走过的路变小，按边界猜出来的数从头到尾不变）；四块盘上都不比参考差。

   代价是 4×5 那 131,559 步：参考的 18 倍、占 200,000 上限的 66%。绝对量级上跟
   queens 的 N=8（156,772 步、78%，本来就是出厂默认体验）同一档。下面那条**余量
   断言**把它钉在 150,000 之下 —— 将来任何把它推过线的改动会大声失败，而不是
   变成一次神秘的截断。 */
const twRefTrunc = [];
for (let b = 0; b < TOUR_BOARDS.length; b++) {
  const W = TOUR_BOARDS[b][0], H = TOUR_BOARDS[b][1];
  const src = TW.source({ W: W, H: H, start: 0, lang: 'zh' });
  const ref = I.run(src, { host: {} });
  const p = I.run(parseZh(src).placeholder, { host: {} });
  const tag = W + '×' + H;
  const shown = tag + '：参考 ' + ref.trace.length + (ref.trace.truncated ? '✂' : '') +
                ' / 占位 ' + p.trace.length + (p.trace.truncated ? '✂' : '');
  if (ref.trace.truncated) twRefTrunc.push(tag);
  else {
    T.ok(!p.trace.truncated, 'tourKnight 占位版在 ' + tag + ' 上跑得完（参考在这块盘上跑得完）· ' + shown);
    T.ok(p.result !== undefined, 'tourKnight 占位版在 ' + tag + ' 上有返回值 · ' + shown);
  }
}
/* 相对判据的**前提**本身也要钉住，而且要在分支外面钉 —— 「哪几块盘上参考自己
   撞墙」是一句关于这个工具的事实，不是一个可以写在 else 里无条件绿掉的说法。
   （写在 `else { T.ok(ref.trace.truncated, …) }` 里就是同义反复：能进那个分支
   就已经说明它撞墙了。修复轮 1 的审查在别处指出过同一种写法，这里是同一个坑，
   自查时才发现也踩了一次。）
   哪天参考在 3×7 上跑得完、或者在别的盘上开始撞墙，这一条会红，上面那张表和
   整条相对判据就都该重想一遍。 */
T.eq(twRefTrunc.join(','), '3×7',
     'tourKnight：四块盘里只有 3×7 是参考自己撞墙的那一块 —— 相对判据的前提');

/* ---- 余量断言：4×5 的占位版离 200,000 上限还有多远 ----

   实测 131,559 步，占上限的 66%，**剩约 68,000 步**。钉在 150,000 之下留了
   约 18,000 步的缓冲：往生成源码里加语句、或者把角落偏好改得更钝，都会先撞
   这条断言而不是先撞 `Interp.STEP_LIMIT`。撞这条断言看到的是「expected true」
   加一个具体步数，撞上限看到的只是 `result === undefined`。 */
{
  const p45 = I.run(parseZh(TW.source({ W: 4, H: 5, start: 0, lang: 'zh' })).placeholder, { host: {} });
  T.ok(p45.trace.length < 150000,
       'tourKnight 占位版 4×5 的步数留着余量（< 150,000；实测 ' + p45.trace.length +
       '，离 200,000 上限还剩 ' + (200000 - p45.trace.length) + ' 步）');
}

/* 占位版必须是**错的**。tourKnight 这里不能像 knightPath 那样钉「一个都没答
   对」：它的返回值只是 true / false，3×4 上占位版照样找得到一条巡游、`result`
   照样是 true —— 巧合而已，两条路线并不一样。所以这里钉的是判定的结论：
   四块盘上占位版都不许被判成 `pass`（跑得完的三块是 fail，3×7 两边都撞墙，
   分歧若没出现在截断之前就是 unknown —— 那也不是「对」）。 */
for (let b = 0; b < TOUR_BOARDS.length; b++) {
  const W = TOUR_BOARDS[b][0], H = TOUR_BOARDS[b][1];
  const src = TW.source({ W: W, H: H, start: 0, lang: 'zh' });
  const v = E.judge(I.run(src, { host: {} }),
                    I.run(parseZh(src).placeholder, { host: {} }), CHECK_TOUR);
  T.ok(v.status !== 'pass',
       'tourKnight 占位版在 ' + W + '×' + H + ' 上不被判对（实测 ' + v.status + '）');
}

/* knightPath 同理，一档就够（它的占位恒返回 −1，答案本来就没得巧合）。 */
T.eq(E.judge(I.run(kpSrc, { host: {} }),
             I.run(parseZh(kpSrc).placeholder, { host: {} }), CHECK_KP).status,
     'fail', 'knightPath 占位版被判错');

threeGates('tourKnight/degree-fn', twSrc, CHECK_TOUR,
  /* `return d;` 写成 `return 8 - d;`：出路数被整个倒过来，Warnsdorff 从「先去
     最急的」变成「先去最闲的」。它仍然是回溯搜索，仍然会找到答案（实测 16,977
     步、true），只是路线完全不同 —— 正是这道题要她看见的那件事。 */
  function (s) { return s.replace('  return d;', '  return 8 - d;'); },
  /* 实测值：第 3 条棋盘事件上参考在试 sq=7、她的版本在试 sq=5，参考侧第 273 步
     （她那边第 274 步）。分歧来得这么早是对的 —— 排序反过来，第一格的候选顺序
     当场就不一样了。两边判词都是 try，不同的只是**先试哪一格**。 */
  { refStep: 273, herStep: 274, opIndex: 3,
    refSq: 7, herSq: 5, refTo: 'try', herTo: 'try' },
  /* 等价改写：**倒着遍历八个方向**，而且改成「先全数、再减掉踩过的」。
     两处都只改数法、不改数出来的值 —— 这是这道题最容易写坏的地方：degree 的
     返回值要参与排序，任何改变并列打破方式的「等价」改写都会走出另一条同样
     合法的巡游而被判错（规格里「Warnsdorff 那段排序故意不挖」是同一个坑的
     大号版本）。实测 3,202 步 vs 参考 3,092 步：形状不同、值相同，正是第 ③ 关
     要的那种改写。 */
  function (s) {
    return s.replace(
      [
        'function degree(sq) {',
        '  const x = sq % W;',
        '  const y = (sq - x) / W;',
        '  let d = 0;',
        '  for (let k = 0; k < 8; k = k + 1) {',
        '    const nx = x + DX[k];',
        '    const ny = y + DY[k];',
        '    if (onBoard(nx, ny)) {',
        '      if (!visited[ny * W + nx]) { d = d + 1; }',
        '    }',
        '  }',
        '  return d;',
        '}',
      ].join('\n'),
      [
        'function degree(sq) {',
        '  const x = sq % W;',
        '  const y = (sq - x) / W;',
        '  let total = 0;',
        '  let used = 0;',
        '  for (let k = 7; k >= 0; k = k - 1) {',
        '    const nx = x + DX[k];',
        '    const ny = y + DY[k];',
        '    if (onBoard(nx, ny)) {',
        '      total = total + 1;',
        '      if (visited[ny * W + nx]) { used = used + 1; }',
        '    }',
        '  }',
        '  return total - used;',
        '}',
      ].join('\n'));
  });

/* ---------- 占位注释那一行有多长：**扫真语料** ----------

   exercise.test.js 里也有一组同样的长度断言，但它钉的是那个文件自己那份合成
   fixture —— 三份**真**源码的注释行，一条断言都没有。而这条纪律钉的是一个在真
   语料上实测过的缺陷：注释行曾把整段 hint 原样写进去，英文那一行于是 292–428
   字符（编辑器可视宽 302 px、scrollWidth 3,229 px，横向要滚十屏），中文那几行
   只有 113–154 —— 两侧差近三倍，而**英文是默认语言**，光看中文界面永远发现不
   了。合成 fixture 的 hint 是测试自己写的两个字，它长不起来，也就永远拦不住这
   件事在真语料上复发。所以这里按 id 逐条扫，两种语言都扫。

   上限与 exercise.test.js 同为 96（含缩进）。今天的实测最大值是 60（knightPath
   的 seen-test 英文行），留出的余量够再加两个 id 长一点的空。 */
const NOTE_MAX = 96;
const NOTE_CORPUS = [['queens', qBlanks], ['knightPath', kpBlanks], ['tourKnight', twBlanks]];
let noteSeen = 0;
NOTE_CORPUS.forEach(function (pair) {
  pair[1].forEach(function (b) {
    const zh = E.noteLine(b, 'zh'), en = E.noteLine(b, 'en');
    noteSeen++;
    T.ok(zh.length <= NOTE_MAX,
         pair[0] + '/' + b.id + ' 的 zh 占位注释不超过 ' + NOTE_MAX + ' 字符（实测 ' + zh.length + '）');
    T.ok(en.length <= NOTE_MAX,
         pair[0] + '/' + b.id + ' 的 en 占位注释不超过 ' + NOTE_MAX + ' 字符（实测 ' + en.length + '）');
    /* 默认语言不该是最难读的那一种 —— 上面那个缺陷正是从这个比值上露头的。 */
    T.ok(en.length <= zh.length * 2,
         pair[0] + '/' + b.id + ' 的英文注释行没比中文长出一倍以上（' + en.length + ' vs ' + zh.length + '）');
    /* 点名是哪一个空：UI 拿这一行当锚点（切语言原地对换、第 4 级「填进去」定位
       她那段答案）。两个空的注释行长得一样，它们就会互相顶掉。 */
    T.ok(zh.indexOf(b.id) >= 0, pair[0] + '/' + b.id + ' 的 zh 注释里点名是哪一个空');
    T.ok(en.indexOf(b.id) >= 0, pair[0] + '/' + b.id + ' 的 en 注释里点名是哪一个空');
  });
});
/* ⚠ 扫过的条数也要钉住。少 require 一份源码、或者哪天 parse 悄悄少认出一个空，
   上面那个 forEach 会安安静静地一条断言都不跑，全绿。 */
T.eq(noteSeen, 5, '真语料里一共扫过 5 个挖空的占位注释行（queens 2 + knightPath 2 + tourKnight 1）');

/* ---------- 常驻门：插入指令行不改变步数（也不改变返回值） ----------

   阶段 6 最有分量的一条完成标准是「往 algos/*.js 里插入 // >>> BLANK 指令行
   没有改变任何一格步数」——注释不产生步，这是「参考答案就是那份正在跑的源码」
   这个支点的前提。但它从前只靠一次性测量确认过（各文件头部注释里那些实测表），
   没有回归门：任何一次「顺手把指令行挪进代码里」（比如给指令行前面不小心加一句
   真代码）都会悄悄改变步数，而没有任何门会响。

   `clean` 剥掉的只是两行 BLANK 指令注释，挖空体本身一字不动，所以
   `I.run(clean)` 与 `I.run(src)` 的步数、返回值理应逐一相同——这条门测的正是
   这件"理应"是不是真的成立。

   五个挖空落在三份源码里，各自的参数档位覆盖：
     · queens：N=4..8（滑杆全程，跟上面「占位版必须跑得完」那组用的是同一条滑杆）
     · knightPath：W 恒为 8，两组代表性的目标格——63（h8，最贵的一档，整块盘
       铺遍）与 27（d4，最便宜的一档之一，两层就碰上目标）。W/start/target
       三个参数只有 target 在变，"两组"指的是两个 target 档位，不是把 1..63
       全扫一遍（那是上面"占位版"那组测试在做的事，跟这里的关注点不同）。
     · tourWarnsdorff：四块盘，跟上面 TOUR_BOARDS 用的是同一份清单
       （3×4、3×5、4×5、3×7——3×7 那块参考自己会撞 200,000 步的上限，
       但撞墙前 clean 与 src 走的步数依旧该逐一相同）。 */
const REAL_SOURCES = [
  ['queens N=4', Q.source({ N: 4, lang: 'zh' })],
  ['queens N=5', Q.source({ N: 5, lang: 'zh' })],
  ['queens N=6', Q.source({ N: 6, lang: 'zh' })],
  ['queens N=7', Q.source({ N: 7, lang: 'zh' })],
  ['queens N=8', Q.source({ N: 8, lang: 'zh' })],
  ['knightPath target=63(h8)', KP.source({ W: 8, start: 0, target: 63, lang: 'zh' })],
  ['knightPath target=27(d4)', KP.source({ W: 8, start: 0, target: 27, lang: 'zh' })],
  ['tourWarnsdorff 3×4', TW.source({ W: 3, H: 4, start: 0, lang: 'zh' })],
  ['tourWarnsdorff 3×5', TW.source({ W: 3, H: 5, start: 0, lang: 'zh' })],
  ['tourWarnsdorff 4×5', TW.source({ W: 4, H: 5, start: 0, lang: 'zh' })],
  ['tourWarnsdorff 3×7', TW.source({ W: 3, H: 7, start: 0, lang: 'zh' })],
];
function stepsOf(src) { return I.run(src, { host: {} }).trace.length; }
for (const [label, src] of REAL_SOURCES) {
  const clean = E.parse(src, 'en').clean;
  T.eq(stepsOf(clean), stepsOf(src), label + '：剥掉指令行后步数不变');
  T.eq(I.run(clean, { host: {} }).result, I.run(src, { host: {} }).result,
       label + '：剥掉指令行后返回值不变');
}

T.report();
