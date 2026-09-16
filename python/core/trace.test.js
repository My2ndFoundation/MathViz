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

/* 统计 */
(function () {
  const s = Trace.create(REF);
  NOW = 0;  s.update('a');
  NOW = 60000; const r = s.update('a = 1\nb = 2\n');
  T.eq(r.stats.accuracy, 1, '全对时正确率为 1');
  T.eq(r.stats.cpm, 12, '60 秒打完 12 个字符 = 12 cpm');
  T.eq(r.stats.errors, 0, '没有错字');
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

T.report('trace');
