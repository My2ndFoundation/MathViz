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

/* ---- 清理波：有效行条数不同时比块层级（kind 'block'） ---- */
(function () {
  const ref = 'if a:\n    if b:\n        c()\n    d()';
  const r = J.compare('if a:\n    if b: c()\nd()', ref);
  T.eq(r.ok, false, 'd() 被移出外层 if：判错（以前判同）');
  T.eq(r.kind, 'block', '分类是 block');
  T.eq(r.index, 2, 'index 是答案侧物理行号 2（d() 那一行）');
  T.eq(r.expected, 1, 'expected 是参考的块层级 1');
  T.eq(r.got, 0, 'got 是她写的块层级 0');
  ok('if a:\n    if b: c()\n    d()', ref, 'd() 仍在外层 if 里：判同');
})();
ok('if a: b', 'if a:\n    b', '一行写法对两行写法判同');
ok('if a:\n    b', 'if a: b', '两行写法对一行写法判同');
ok('for i in r: print(i)', 'for i in r:\n    print(i)', 'for 头一行写法判同');
ok('if x:\n    f(a,\nb)', 'if x:\n    f(a, b)', '括号内断行、续行顶格是合法 Python，判同');
ok('x = f(a,\n      b)', 'x = f(a, b)', '没有语句头的括号内断行判同');
ok('if a: x = 1 + \\\n2', 'if a:\n    x = 1 + \\\n        2', '反斜杠续行并入上一逻辑行（续行顶格也不当成退到外层的新行）');
(function () {
  const r = J.compare('if x:\nf(a,\n    b)', 'if x:\n    f(a, b)');
  T.eq(r.kind, 'block', '括号内断行、体的第一行写到外层：block（CPython 报 IndentationError）');
  T.eq(r.index, 1, 'index 指向 f 所在的第 1 行（0 起）');
})();
(function () {
  const r = J.compare('if a: b\n    c', 'if a:\n    b\n    c');
  T.eq(r.kind, 'block', '一行写法之后又多缩进一行：block（unexpected indent）');
  T.eq(r.got, 2, '多缩进的那一行比 b 还深一层');
})();
(function () {
  const r = J.compare('if a:\n    b\n  c\nd', 'if a:\n    b\nc');
  T.eq(r.kind, 'block', '退缩进退到栈里没有的宽度：block（即使 token 之后还多一个 d）');
})();
(function () {
  /* 层级碰巧与参考相同（c 都在第 1 层），但 2 格的退缩进对不上任何外层：CPython 报
     unindent does not match any outer indentation level。只有 bad 标记能抓住它。 */
  const r = J.compare('if a:\n    f(x,\ny)\n  c', 'if a:\n    f(x, y)\n    c');
  T.eq(r.kind, 'block', '退缩进到栈里没有的宽度、层级碰巧相同：仍是 block');
  T.eq(r.index, 3, 'index 指向 c 那一行');
})();
(function () {
  /* 语句头之后没有变深，层级碰巧相同：`if b:` 后面的 c 与参考同在第 1 层，
     但参考里 `if b:` 是一行写法（体是 d），作答把 d 断开写到了下一行同层。 */
  const r = J.compare('if a:\n    if b:\n    d\n    c', 'if a:\n    if b: d\n    c');
  T.eq(r.kind, 'block', '语句头之后没有缩进（expected an indented block）：block');
})();
(function () {
  const r = J.compare('def f(x: int) -> int: return x\ny = 1', 'def f(x: int) -> int:\n    return x\ny = 1');
  T.eq(r.ok, true, '括号里的 : 不是语句头的冒号');
})();
(function () {
  const r = J.compare('    return x\nprint(y)', '    return x\n\nprint(y)');
  T.eq(r.ok, true, '行数相同（空行不计）时照旧按宽度比——片段退到第一行之外也判同');
})();
(function () {
  const r = J.compare('if a: s = """\n""" + c', 'if a:\n    s = """\n""" + c');
  T.eq(r.ok, true, '跨行三引号字符串结束那一行上的 token 仍属同一逻辑行');
})();
(function () {
  const r = J.compare('s = """a\nb""" + c', 's = """a\nb""" +\\\n    c');
  T.eq(r.kind, 'different', '行数不同、token 不同时照旧报 token 差异（c 对 反斜杠）');
})();

/* ---- normalize 暴露出来供门复用 ---- */
(function () {
  const n = J.normalize('a = 1  # c\nb = 2');
  T.eq(n.toks.map(t => t.text), ['a', '=', '1', 'b', '=', '2'], 'normalize 只留有效 token 原文');
  T.eq(n.rel, [0, 0], '两行都没有相对缩进差');
})();

T.report('judge');
