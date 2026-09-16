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

/* ---- normalize 暴露出来供门复用 ---- */
(function () {
  const n = J.normalize('a = 1  # c\nb = 2');
  T.eq(n.toks.map(t => t.text), ['a', '=', '1', 'b', '=', '2'], 'normalize 只留有效 token 原文');
  T.eq(n.rel, [0, 0], '两行都没有相对缩进差');
})();

T.report('judge');
