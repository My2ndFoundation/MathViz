'use strict';
const T = require('./_test.js');
const J = require('./judge.js');

function ok(a, b, label) { T.eq(J.compare(a, b).ok, true, label); }
function no(a, b, label) { T.eq(J.compare(a, b).ok, false, label); }

/* ---- 吞掉的：空白与注释 ---- */
ok('mid = (lo+hi)//2', 'mid = (lo + hi) // 2', '空白差异判同');
ok('mid = (lo + hi) // 2  # my note', 'mid = (lo + hi) // 2', '注释差异判同');
ok('  x = 1', 'x = 1', '整体前导缩进不参与（由占位块撑出）');

/* ---- 不吞的：三样 ---- */
no("s = 'a'", 's = "a"', '引号风格参与比对');
no('n = 10000000000', 'n = 1e10', '数字写法参与比对');
no('for i in r:\nprint(i)', 'for i in r:\n    print(i)', '空内部的相对缩进参与比对');

/* ---- 报错要报得有意义 ---- */
(function () {
  const r = J.compare('a / b', 'a // b');
  T.eq(r.ok, false, '把整除打成除法要判错');
  T.eq(r.index, 1, '定位到第 2 个 token');
  T.eq(r.expected, '//', '说出期待什么');
  T.eq(r.got, '/', '说出你写了什么');
  T.eq(r.kind, 'different', '分类是 different');
})();

(function () {
  const r = J.compare('a', 'a + b');
  T.eq(r.kind, 'missing', '少写了要分类成 missing');
  T.eq(r.expected, '+', 'missing 报出缺的那个 token');
  T.eq(r.got, null, 'missing 的 got 为 null');
})();

(function () {
  const r = J.compare('a + b + c', 'a + b');
  T.eq(r.kind, 'extra', '多写了要分类成 extra');
  T.eq(r.got, '+', 'extra 报出多出来的 token');
})();

(function () {
  const r = J.compare('for i in r:\nprint(i)', 'for i in r:\n    print(i)');
  T.eq(r.kind, 'indent', '缩进不同单独分类，不混进 different');
})();

/* ---- 裁决 R30/R31：indent 的 expected/got 是缩进数值，index 是物理行号 ---- */
(function () {
  const ans = 'a = 1\n\n  b = 2';        // 中间一个空行，第 2 行（物理行号 2）多缩进两格
  const ref = 'a = 1\n\nb = 2';
  const r = J.compare(ans, ref);
  T.eq(r.kind, 'indent', '缩进不同');
  T.eq(r.index, 2, 'index 是物理行号 2，不是 rel 下标 1');
  T.eq(r.expected, 0, 'expected 是参考的相对缩进');
  T.eq(r.got, 2, 'got 是她写的相对缩进');
})();

ok('x = 1', 'x = 1', '完全相同判同');
T.eq(J.compare('x = 1', 'x = 1').index, -1, '判同时 index 为 -1');

/* ---- 裁决 R35：注释行/空行不计入"有效行"；有效行条数不同不是 indent ---- */
(function () {
  const r = J.compare('x = 1\n# note\ny = 2', 'x = 1\ny = 2');
  T.eq(r.ok, true, '多写一行独立注释仍判同（Critical bug① 回归）');
})();

(function () {
  const r = J.compare('a = 1', 'a = 1\nb = 2');
  T.eq(r.kind, 'missing', '真的少写一行要分类成 missing，不是 indent（Critical bug② 回归）');
  T.eq(r.expected, 'b', 'missing 报出缺的那个 token');
  T.eq(r.got, null, 'missing 的 got 为 null');
})();

(function () {
  const r = J.compare('a = 1\nb = 2', 'a = 1');
  T.eq(r.kind, 'extra', '真的多写一行要分类成 extra，不是 indent');
  T.eq(r.got, 'b', 'extra 报出多出来的 token');
  T.eq(r.expected, null, 'extra 的 expected 为 null');
})();

(function () {
  const r = J.compare('x = 1\ny = 2', 'x = 1\n# note\ny = 2');
  T.eq(r.ok, true, '参考侧带独立注释、答案侧没有，仍判同');
})();

/* ---- 补充：单独钉住裁决 R35(a)——两侧各带一条缩进不同的独立注释。
   两侧的"有效行条数"凑巧相等（注释都被排除在外），所以只有 (a) 本身
   （空行判据要跟 significant() 走，不能看字面缩进）能救这一条；
   coordinator 给的上面两条"多写/少了一行注释"的用例，在这个模块的
   现有实现里其实要 (a)(b) 一起坏才会变红，单独回退 (a) 时会被 (b) 的
   等长门槛挡住而仍然判同——这条不受那个"门槛"影响，因为两侧行数从
   一开始就相等，是能单独钉住 (a) 的最小用例。 */
(function () {
  const r = J.compare('x = 1\n    # note\ny = 2', 'x = 1\n# note\ny = 2');
  T.eq(r.ok, true, '独立注释自己的缩进不参与比对，哪怕两侧有效行条数凑巧相等');
})();

/* ---- 评审点名的三个边界：手工推演过不会崩，这里补成可执行的断言 ---- */
(function () {
  const r = J.compare('', '');
  T.eq(r.ok, true, '空串对空串判同');
})();

(function () {
  const r = J.compare('# a', '# b');
  T.eq(r.ok, true, '纯注释源（内容不同）仍判同——注释整行不参与比对');
})();

(function () {
  const r = J.compare('\n\n', '\n\n\n\n');
  T.eq(r.ok, true, '全空行、且两侧空行条数不同，仍判同——空行不参与比对');
})();

/* ---- normalize 暴露出来供门复用 ---- */
(function () {
  const n = J.normalize('a = 1  # c\nb = 2');
  T.eq(n.toks.map(t => t.text), ['a', '=', '1', 'b', '=', '2'], 'normalize 只留有效 token 原文');
  T.eq(n.rel, [0, 0], '两行都没有相对缩进差');
})();

T.report('judge');
