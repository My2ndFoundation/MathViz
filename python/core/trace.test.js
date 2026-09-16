'use strict';
const T = require('./_test.js');
const Trace = require('./trace.js');

/* 注入时钟：统计要可测，就不能读真实时间 */
let NOW = 0;
Trace._useClock(function () { return NOW; });

const REF = 'a = 1\nb = 2\n';

(function () {
  const s = Trace.create(REF);
  const r = s.update('a = 1\n');
  T.ok(r.marks.every(m => m.state === 'ok'), '全对时没有 bad');
  T.eq(r.stats.correct, 6, '已正确输入 6 个字符');
  T.eq(r.stats.total, REF.length, 'total 是参考全长');
})();

(function () {
  const s = Trace.create(REF);
  const r = s.update('a = 9\n');
  const bad = r.marks.filter(m => m.state === 'bad').map(m => m.index);
  T.eq(bad, [4], '只有第 5 个字符错');
})();

/* 不跨行传染：第一行少打一个字符，第二行仍然按自己的行首对齐 */
(function () {
  const s = Trace.create(REF);
  const r = s.update('a = \nb = 2\n');
  const badLines = r.marks.filter(m => m.state === 'bad')
                          .map(m => REF.slice(0, m.index).split('\n').length);
  T.ok(badLines.every(l => l === 1), '错误只落在第 1 行，第 2 行不受污染');
})();

T.eq(Trace.alignLines('a\nbb\n', 'a\nbb\n').length, 3, '按行对齐，含末尾空行');

/* 统计（逐键模拟——真实使用中 update() 是按键驱动的，一次一个字符）*/
(function () {
  const s = Trace.create(REF);          // REF 共 12 个字符
  NOW = 0;
  for (let i = 1; i <= REF.length; i++) { s.update(REF.slice(0, i)); NOW += 5000; }
  const r = s.update(REF);              // NOW = 60000，无新增字符
  T.eq(r.stats.accuracy, 1, '全对时正确率为 1');
  T.eq(r.stats.correct, 12, '12 个字符全部正确');
  T.eq(r.stats.cpm, 12, '每 5 秒一个键、总计 60 秒打完 12 个字符 = 12 cpm');
  T.eq(r.stats.errors, 0, '没有错字');
})();

/* 空闲剔除是定长规则：一次 update 里挟带很多新字符、且距上次隔了很久，
   也要按 IDLE_PAUSE_MS 封顶，不能因为字符多就豁免（裁决 R34）。这条断言
   专门守住"定长而非按新增字符数缩放"这一点——把规则改回按 n 缩放，
   它必须变红（因为缩放后 60000 的 delta 会被 n=11 的宽阈值放过，不会
   被砍到 10000）。 */
(function () {
  const s = Trace.create(REF);
  NOW = 0; s.update('a');
  NOW = 60000; const r = s.update(REF);   // 一次性从 1 个字符跳到全部 12 个
  T.eq(r.stats.elapsedMs, 10000, '一次性大跳跃仍按定长空闲处理，不因新增字符多而豁免');
})();

/* 正确率按「首次输入即正确」算：改对了也不还给你 */
(function () {
  const s = Trace.create(REF);
  NOW = 0; s.update('a = 9');
  s.noteBackspace();
  NOW = 1000; const r = s.update('a = 1\nb = 2\n');
  T.ok(r.stats.accuracy < 1, '改对之后正确率仍低于 1');
  T.eq(r.stats.backspaces, 1, '退格计数');
  T.eq(r.stats.errors, 1, '错字计数记的是首次输入错的位置数');
})();

/* 停手超过 IDLE_PAUSE_MS 不计入用时 */
(function () {
  const s = Trace.create(REF);
  NOW = 0; s.update('a');
  NOW = 60000; s.update('a ');                    // 中间停了 60 秒
  NOW = 61000; const r = s.update('a = 1\nb = 2\n');
  T.ok(r.stats.elapsedMs < 20000, '空闲段被剔除，用时不被一次走神污染');
})();

/* 逐行耗时 */
(function () {
  const s = Trace.create(REF);
  NOW = 0;    s.update('a = 1\n');
  NOW = 3000; const r = s.update('a = 1\nb = 2\n');
  T.eq(r.stats.lineTimes.length, 2, '两行各有一条耗时');
  T.ok(r.stats.lineTimes[1] > 0, '第二行的耗时为正');
})();

/* 裁决 R38：回车前多打一个字符，不能抢占下一行的下标。
   'x = 1!\ny = 2\n' 在第 1 行该按回车的地方多打了一个 '!'，第 2 行的下标 6
   本该记她把 'y' 打对了；如果溢出字符沿用 refStart+j 继续编号，6 会被
   溢出字符先占，永久记成一次错误。 */
(function () {
  const s = Trace.create('x = 1\ny = 2\n');
  const r = s.update('x = 1!\ny = 2\n');
  const at6 = r.marks.filter(m => m.index === 6);
  T.eq(at6.length, 1, '下一行的下标只应出现一次，不能被溢出字符重复占用');
  T.ok(at6.length === 1 && at6[0].state === 'ok', '她把下一行第一个字符打对了，必须是 ok');
  T.eq(r.stats.errors, 1, '溢出的那个感叹号不该额外算一次错（只有它自己算，不能连累下一行）');
})();

/* 裁决 R38：退化到极端的溢出——参考只有 2 个字符，却打了 6 个。
   errors <= total、accuracy ∈ [0,1]、marks 的 index 全部 < total，
   这三条不变量都要守住，不能出现负的正确率或越界下标。 */
(function () {
  const s = Trace.create('ab\n');
  const r = s.update('abcdef\n');
  T.ok(r.stats.errors <= r.stats.total, '不变量：errors 不能超过 total');
  T.ok(r.stats.accuracy >= 0 && r.stats.accuracy <= 1, '不变量：accuracy 必须落在 [0,1]');
  T.ok(r.marks.every(m => m.index < r.stats.total), '不变量：marks 的 index 全部要小于 total');
})();

/* 裁决 R39：多打一行——lineDelta 要能说清楚"不是每个字都打错了，
   是整体多了一行"。这里刻意不做 LCS 对齐，只加一个行数差信号。 */
(function () {
  const s = Trace.create('a\nb\nc\n');
  const r = s.update('a\nX\nb\nc\n');
  T.eq(r.stats.lineDelta, 1, '多插了一行，lineDelta 应该是 +1');
})();

/* 裁决 R39：少一个换行（把两行误合并成一行）——lineDelta 应该是负的。 */
(function () {
  const s = Trace.create('a\nb\nc\n');
  const r = s.update('a\nbc\n');
  T.eq(r.stats.lineDelta, -1, '两行被合并成一行，lineDelta 应该是 -1');
})();

/* reset()：清空所有计数器和历史判定，之前的错误不再计分 */
(function () {
  const s = Trace.create(REF);
  NOW = 0; s.update('a = 9');   // 第 5 个字符先打错，进 firstWrong
  s.noteBackspace();
  s.reset();
  NOW = 100; const r = s.update('a');
  T.eq(r.stats.backspaces, 0, 'reset 后退格计数清零');
  T.eq(r.stats.errors, 0, 'reset 后 firstWrong 清空，之前的错误不再计分');
  T.ok(r.marks.every(m => m.state === 'ok'), 'reset 后重新输入正确字符应为 ok');
})();

/* 裁决 R40：把 R38（行内溢出）和 R39（行间多/少行）合起来看，能提炼出一条
   更上位的不变量——每一个打出来的字符都要么落进 marks、要么落进
   overflow，一个不能少。只测 ±1 测不出这条：R38 之前的 alignLines 只按
   参考行数迭代，"多 1 行"恰好能被参考最后一行（结尾换行切出的空行）当成
   唯一一次机会吸收进 overflow，"多 2 行"起第二行开始就没有 row 可装，
   直接被 alignLines 吞掉——marks/overflow 都不知道它存在过。这里同时覆盖
   +1/+2/+3（多行）与 -1/-2/-3（合并 2/3/4 行少行）六档，并顺带验证
   lineDelta 在每一档都仍然正确（同一失败家族此前两次都只验证过 ±1）。 */
function checkCoverage(reference, typed, label) {
  const s = Trace.create(reference);
  const r = s.update(typed);
  T.eq(r.marks.length + r.overflow.length, typed.length,
    label + '：marks.length + overflow.length 必须等于 typed.length（一个字符都不能凭空消失）');
  return r;
}

(function () {
  let r = checkCoverage('a\nb\nc\n', 'a\nX\nb\nc\n', '多 1 行');
  T.eq(r.stats.lineDelta, 1, '多 1 行：lineDelta 应该是 +1');

  r = checkCoverage('a\nb\nc\n', 'a\nX\nY\nb\nc\n', '多 2 行');
  T.eq(r.stats.lineDelta, 2, '多 2 行：lineDelta 应该是 +2');

  r = checkCoverage('a\nb\nc\n', 'a\nX\nY\nZ\nb\nc\n', '多 3 行');
  T.eq(r.stats.lineDelta, 3, '多 3 行：lineDelta 应该是 +3');
})();

(function () {
  let r = checkCoverage('a\nb\nc\n', 'a\nbc\n', '少 1 行（合并 2 行）');
  T.eq(r.stats.lineDelta, -1, '少 1 行：lineDelta 应该是 -1');

  r = checkCoverage('a\nb\nc\n', 'abc\n', '少 2 行（合并 3 行）');
  T.eq(r.stats.lineDelta, -2, '少 2 行：lineDelta 应该是 -2');

  r = checkCoverage('a\nb\nc\nd\n', 'abcd\n', '少 3 行（合并 4 行）');
  T.eq(r.stats.lineDelta, -3, '少 3 行：lineDelta 应该是 -3');
})();

T.report('trace');
