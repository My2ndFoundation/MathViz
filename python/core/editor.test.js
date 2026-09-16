'use strict';
const T = require('./_test.js');
const Editor = require('./editor.js');

/* ---- 往返不变量（本模块存在的理由）---- */
const SAMPLES = [
  '', 'x = 1\n',
  'def f():\n    return "a" + \'b\'  # tail\n',
  'doc = """multi\nline"""\nn = 1e10\n',
  's = f"{v:>8.2f}"\n',
  '"unterminated\n',
  'x = \\\n',
];
SAMPLES.forEach(function (src, i) {
  const frs = Editor.highlight(src);
  T.eq(frs.map(f => f.text).join(''), src, '片段 #' + i + ' 拼回逐字节相同');
  T.ok(frs.every(f => typeof f.cls === 'string' && f.cls.indexOf('tok-') === 0),
       '片段 #' + i + ' 每片都有 tok- 前缀的类名');
});

/* 1e10 这个具体的陷阱：value 化会变成 10000000000，切片不会 */
(function () {
  const src = 'n = 1e10\n';
  const frs = Editor.highlight(src);
  T.ok(frs.some(f => f.text === '1e10'), '数字片段保留原文写法 1e10');
  T.ok(!frs.some(f => f.text === '10000000000'), '绝不出现 stringify 过的数字');
})();

/* ---- 行工具 ---- */
T.eq(Editor.lineStarts('a\nbb\n\nc'), [0, 2, 5, 6], '行起始偏移');
T.eq(Editor.lineStarts(''), [0], '空串也有第 0 行');
T.eq(Editor.indentOf('        mid = 1'), 8, '前导空格数');
T.eq(Editor.indentOf(''), 0, '空行缩进为 0');

/* ---- Tab 永远插 4 个空格，绝不插制表符 ---- */
(function () {
  const r = Editor.applyTab('ab', 2, 2);
  T.eq(r.value, 'ab    ', 'Tab 插四个空格');
  T.eq(r.selStart, 6, '光标落在插入之后');
  T.ok(r.value.indexOf('\t') === -1, '结果里没有制表符');
  const sel = Editor.applyTab('abcd', 1, 3);
  T.eq(sel.value, 'a    d', '有选区时替换选区');
})();

/* ---- Enter 自动缩进 ---- */
(function () {
  const a = Editor.applyEnter('    x = 1', 9);
  T.eq(a.value, '    x = 1\n    ', '沿用上一行缩进');
  T.eq(a.selStart, 14, '光标落在新缩进之后');
  const b = Editor.applyEnter('    if x:', 9);
  T.eq(b.value, '    if x:\n        ', '冒号结尾再加四格');
  const c = Editor.applyEnter('    if x:  # note', 17);
  T.eq(c.value, '    if x:  # note\n        ',
       '注释在后也算冒号结尾（判断前先剥掉注释再 rstrip）');
  const d = Editor.applyEnter('x = "a:"', 8);
  T.eq(d.value, 'x = "a:"\n', '字符串里的冒号不算——用 PyLex 判最后一个有效 token');
})();

T.report('editor');
