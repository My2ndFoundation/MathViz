'use strict';
/* 「挖空填空」模式的判定器：拿使用者填的答案跟参考答案（挖空体原文）逐 token 比对。
   零依赖；node 与浏览器双用。

   ---- 严格是有意的，不是偷懒 ----

   这套东西练的是肌肉记忆。Python 允许同一件事写出好几种等价写法，但这里不靠
   「放宽判定」去容纳它们——多写法由「同一问题给多个变体程序」在题库层面容纳。
   判定器只吞两样东西：token 之间的空白、注释。除此之外一律参与比对，包括：

     · 引号风格   'a'  ≠  "a"
     · 数字写法   10000000000  ≠  1e10
     · 空内部各行的相对缩进（左侧整体缩进由占位块的前缀撑出，不算她打的；
       但空内部多行之间谁比谁多缩进、少缩进，是她打的，而缩进正是 Python
       最该练的东西——所以单独参与比对，见 normalize() 的 rel）

   这三样能被判定器"顺手"保留，是因为 normalize() 从不重写 token 的文字——
   每个 token 的 text 都是从原始源码里 slice 出来的原文切片，不经过任何
   语义层面的归一化（不把数字算出数值、不把字符串统一成一种引号）。
   正因为这样，负控制①（故意在 normalize 里把字符串引号改写成双引号）
   才会真的让"引号风格参与比对"变红——这条判定不是靠一段额外的比对逻辑
   撑住的，是靠"从不改写原文"这条设计本身撑住的，改写一下就会看见它塌。

   ---- token 化不是为了放宽，是为了报错报得有意义 ----

   直接比对源码字符串，报错只能说"第 37 个字符不对"；token 化之后，
   compare() 能定位到"第几个 token"，说出"期待 // 你写了 /"。

   ---- 依赖惰性取 ----

   `factory(function () { return root.PyLex; })`，不是 `factory(root.PyLex)`：
   python/scripts/inline_core.py 按标记块就地替换，不保证 PY-LEX 一定排在
   JUDGE 前面。取值推迟到真正调用的那一刻，块的先后顺序就不再重要
   （spec §4.6，与 chess/core/editor.js 对 Interp 的处理同一条纪律）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(function () { return require('./py-lex.js'); });
  } else {
    root.Judge = factory(function () { return root.PyLex; });
  }
})(typeof self !== 'undefined' ? self : this, function (getPyLex) {
  'use strict';

  /* 取 PyLex 并当场校验，未装载时响亮地抛——不要安静地退化成"永远判同/永远判异"。 */
  function pyLex() {
    var L = getPyLex();
    if (!L || typeof L.tokenize !== 'function' || typeof L.significant !== 'function') {
      throw new Error('Judge needs PyLex (python/core/py-lex.js) loaded first: ' +
                      'the PY-LEX inline block must come before the JUDGE one.');
    }
    return L;
  }

  /* 每一行的前导空白（空格、制表符）字符数，不管制表宽度——判定器只关心
     "谁比谁多缩进"，不关心缩进真实占几列。 */
  function leadingWidth(line) {
    var m = /^[ \t]*/.exec(line);
    return m[0].length;
  }

  /* 每一行相对第一条**非空行**的缩进差，空行整条跳过（不占数组里的一格）。
     这样整体缩进（由占位块的前缀撑出）被吞掉，行间的相对缩进保留。 */
  function relativeIndent(src) {
    var lines = src.split('\n');
    var leads = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^[ \t]*$/.test(line)) { continue; } /* 空行：跳过，不计入 */
      leads.push(leadingWidth(line));
    }
    if (leads.length === 0) { return []; }
    var base = leads[0];
    return leads.map(function (w) { return w - base; });
  }

  /* src 里每一个字符偏移量所在的行起始偏移量表：starts[k] 是第 k 行（0 起）
     第一个字符的偏移量。token 的 start 递增地落进这张表，用一个不回退的
     指针线性扫描即可，不需要为每个 token 各扫一遍全表。 */
  function lineStarts(src) {
    var starts = [0];
    for (var i = 0; i < src.length; i++) {
      if (src.charAt(i) === '\n') { starts.push(i + 1); }
    }
    return starts;
  }

  /* normalize(src) -> { toks: [{text, line, col}], rel: number[] }
     toks：滤掉 ws/nl/comment 之后，每个 token 的原文切片 + 行列号（1 起行号，
           0 起列号，对齐 CPython tokenize 的记号习惯）。
     rel ：见 relativeIndent。 */
  function normalize(src) {
    var L = pyLex();
    var tokens = L.significant(L.tokenize(src));
    var starts = lineStarts(src);
    var lineIdx = 0;
    var toks = tokens.map(function (t) {
      /* tokens 按 start 递增排列（py-lex 的构造性保证之一），指针只前进不回退 */
      while (lineIdx + 1 < starts.length && starts[lineIdx + 1] <= t.start) { lineIdx++; }
      return {
        text: src.slice(t.start, t.end),
        line: lineIdx + 1,
        col: t.start - starts[lineIdx]
      };
    });
    return { toks: toks, rel: relativeIndent(src) };
  }

  /* 两个数组第一处不同的下标；一个是另一个的前缀时，下标取较短那个的长度；
     完全相同返回 -1。 */
  function firstDiffIndex(a, b) {
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) {
      if (a[i] !== b[i]) { return i; }
    }
    if (a.length !== b.length) { return n; }
    return -1;
  }

  /* compare(answer, reference) -> { ok, index, expected, got, kind }
     kind ∈ 'equal' | 'different' | 'missing' | 'extra' | 'indent'

     顺序：先比 rel（不同 -> 'indent'，index 取 rel 数组里第一处不同的
     行序号，跳过空行之后的序号——见 relativeIndent 的"空行跳过"）；
     rel 相同再逐 token 比原文，短的一方先到头分类成 missing / extra。 */
  function compare(answer, reference) {
    var na = normalize(answer);
    var nr = normalize(reference);

    var relIdx = firstDiffIndex(na.rel, nr.rel);
    if (relIdx !== -1) {
      return { ok: false, index: relIdx, expected: null, got: null, kind: 'indent' };
    }

    var at = na.toks, rt = nr.toks;
    var n = Math.min(at.length, rt.length);
    for (var i = 0; i < n; i++) {
      if (at[i].text !== rt[i].text) {
        return { ok: false, index: i, expected: rt[i].text, got: at[i].text, kind: 'different' };
      }
    }
    if (at.length < rt.length) {
      return { ok: false, index: at.length, expected: rt[at.length].text, got: null, kind: 'missing' };
    }
    if (at.length > rt.length) {
      return { ok: false, index: rt.length, expected: null, got: at[rt.length].text, kind: 'extra' };
    }
    return { ok: true, index: -1, expected: null, got: null, kind: 'equal' };
  }

  return { normalize: normalize, compare: compare };
});
