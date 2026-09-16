'use strict';
/* editor —— 片段化高亮与编辑行为。三层影子临摹（标准程序垫底、使用者输入
   在上、光标在最上）是逐字符对齐的三层，错一个字符光标就与文字对不上。

   ── 全部价值在一条不变量上 ──────────────────────────────────────────
     highlight(src).map(f => f.text).join('') === src
   所以片段文本一律用 src.slice(start, end) 现切，绝不拿 token 的 value 去
   stringify——PyLex 的 Token 本来就不带 value 字段，正是为了让「1e10 被
   stringify 成 10000000000，三层临摹从那个字符起全部错位」这类错误无从
   写起。又因为 PyLex.tokenize 对**任何**输入都产出一列无缝覆盖
   [0, src.length) 的 token（构造性保证，见 py-lex.js 文件头），这里
   **不需要**补空白片段——往返不变量自动成立。

   ── 依赖惰性取 ──────────────────────────────────────────────────────
   同 chess/core/editor.js 取 Interp 的理由：inline_core.py 按标记块就地
   替换，不保证 PY-LEX 一定排在 EDITOR 前面。工厂里直接 `factory(root.PyLex)`
   会在装载时就把 undefined 抓死；把取值推迟到调用时，装载顺序就不再要紧。
   取到后当场校验存在，且这次校验**必须留在任何 try 之外**——highlight 里
   的 try 是「源码打到一半暂时不合法就降级」用的，把「依赖压根没装载」也
   吞进那条降级路径，结果是整篇编辑器永远没有颜色，一种安静的坏。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(function () { return require('./py-lex.js'); });
  } else {
    root.Editor = factory(function () { return root.PyLex; });
  }
})(typeof self !== 'undefined' ? self : this, function (getPyLex) {
  'use strict';

  /* 取 PyLex 并当场校验。调用点必须在各自 try 之外，见文件头。 */
  function pyLex() {
    const L = getPyLex();
    if (!L || typeof L.tokenize !== 'function' || typeof L.significant !== 'function') {
      throw new Error('Editor needs PyLex (python/core/py-lex.js) loaded first.');
    }
    return L;
  }

  /* 把源码切成一串 { text, cls } 片段。cls 一律 'tok-' + token.type，
     供 CSS 按类型上色（tok-keyword / tok-string / tok-number / …）。
     PyLex 保证无缝全覆盖，这里不用像 chess 那边补 'plain' 空白片段。 */
  function highlight(src) {
    const L = pyLex();               // ← 故意在 try 之外，见 pyLex() 的注释
    try {
      const tokens = L.tokenize(src);
      return tokens.map(function (t) {
        return { text: src.slice(t.start, t.end), cls: 'tok-' + t.type };
      });
    } catch (e) {
      /* 防御性降级：PyLex.tokenize 按设计永不抛错（file 头「永不抛错」的
         构造性保证），这里的 try 只是以防万一，不让编辑器因为一个未预见
         的异常而整篇崩溃——降级成单个 tok-plain 片段。 */
      return src.length ? [{ text: src, cls: 'tok-plain' }] : [];
    }
  }

  /* 每一行第一个字符在 src 里的字符下标，下标从 0 开始，行号从 1 开始
     （starts[line - 1] 就是第 line 行的起点）。只按 '\n' 断行，跟
     PyLex.tokenize 数行一致（PyLex 把 '\r\n' 算一个 nl token，但换行边界
     仍落在 '\n' 上）。空串也有第 0 行，起点是 0。 */
  function lineStarts(src) {
    const starts = [0];
    for (let i = 0; i < src.length; i++) {
      if (src.charAt(i) === '\n') { starts.push(i + 1); }
    }
    return starts;
  }

  /* 一行文本的前导空格数。只数半角空格——Tab 永远只插空格（见 applyTab），
     所以缩进里不会出现制表符；真遇到也不在这个函数的职责范围内。 */
  function indentOf(line) {
    let i = 0;
    while (i < line.length && line.charAt(i) === ' ') { i++; }
    return i;
  }

  /* Tab 键：把 [selStart, selEnd) 这段选区（无选区时 selStart === selEnd）
     替换成 4 个空格，绝不插入制表符——影子临摹要求缩进宽度可预测，制表符
     的显示宽度因编辑器而异，会让「描红」的视觉对齐失真。 */
  function applyTab(value, selStart, selEnd) {
    const s = Math.min(selStart, selEnd);
    const e = Math.max(selStart, selEnd);
    const INDENT = '    ';
    const newValue = value.slice(0, s) + INDENT + value.slice(e);
    const pos = s + INDENT.length;
    return { value: newValue, selStart: pos, selEnd: pos };
  }

  /* Enter 键：换行并沿用当前行缩进，若当前行（光标之前的部分）以冒号结尾
     则再加 4 格。「冒号结尾」的判定必须走 PyLex 的最后一个有效 token，
     不能用 /:\s*$/ 这样的正则——x = "a:" 里的冒号藏在字符串内容里，
     正则分不出这两种情况，而 PyLex 切出的最后一个有效 token 是整个
     字符串字面量（涵盖引号内的冒号），其原文是 '"a:"' 而不是裸的 ':'，
     所以不会误触发。同理，注释里的冒号（# like: this）也不会误触发——
     PyLex.significant 本身就滤掉了 comment 类型的 token。 */
  function applyEnter(value, pos) {
    const nlBefore = value.lastIndexOf('\n', pos - 1);
    const lineStart = nlBefore === -1 ? 0 : nlBefore + 1;
    const lineBeforeCursor = value.slice(lineStart, pos);
    const indent = indentOf(lineBeforeCursor);

    const L = pyLex();
    const sig = L.significant(L.tokenize(lineBeforeCursor));
    let extra = 0;
    if (sig.length > 0) {
      const last = sig[sig.length - 1];
      if (lineBeforeCursor.slice(last.start, last.end) === ':') { extra = 4; }
    }

    const newIndent = ' '.repeat(indent + extra);
    const newValue = value.slice(0, pos) + '\n' + newIndent + value.slice(pos);
    const newPos = pos + 1 + newIndent.length;
    return { value: newValue, selStart: newPos, selEnd: newPos };
  }

  return {
    highlight: highlight,
    lineStarts: lineStarts,
    indentOf: indentOf,
    applyTab: applyTab,
    applyEnter: applyEnter
  };
});
