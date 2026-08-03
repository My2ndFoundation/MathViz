/* 编辑器高亮：纯函数，零 DOM —— 把源码切成一串带类别的文本片段。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   高亮直接复用 Interp.tokenize，不自己写正则高亮器（规格 §2.8）——
   这样高亮看到的 token 流与执行看到的是同一份，不会出现「高亮说这是
   关键字、解释器说不是」的分歧。tokenize 专门产出 comment token 就是
   为了这里（解析器自己会把它们过滤掉）。

   两条不变量：
   1. 片段拼回去必须与原文逐字节相同（高亮层与透明 textarea 是逐字符
      对齐的两层，错一个字符光标就与文字对不上）。所以片段文本一律用
      src.slice(start, end) 现切，绝不拿 token.value 去 stringify——
      value 对 num 是数字（1e10 这种写法 stringify 会变成
      '10000000000'，与原文不同）、对 tpl 是 {quasis, exprs} 这样的
      对象（反引号、${}、转义序列全部丢失，压根拼不回原文），只有
      从原文切片才能保证逐字节相同。token 之间的空白（还有文件开头/
      结尾的空白）也要单独产出 plain 片段，否则拼接会漏字符。
   2. tokenize 抛错时（未闭合字符串之类）必须降级为纯文本，不能让整个
      编辑器炸掉——使用者打字打到一半，源码几乎总是暂时不合法的。这里
      选择整篇降级（把整个 src 当一个 plain 片段），而不是「高亮到出错
      位置为止、剩余部分纯文本」这种更细的降级：tokenize 是「全有全无」
      的——它出错时不会把已经切出来的 token 一并交还，想做更细的降级
      得自己在 tokenize 内部埋一份「已产出 token」的钩子，这已经超出
      本任务「只用 tokenize，不重写词法逻辑」的范围。代价很直白：一个
      引号没有闭合期间，整份文档都会短暂失去颜色，直到使用者把它闭合。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./interp.js'));
  else root.Editor = factory(root.Interp);
})(typeof self !== 'undefined' ? self : this, function (Interp) {
  'use strict';

  // token.type -> 片段的 cls。跟规格里列的八个值一一对应，plain 不是
  // token 类型，是「两个 token 之间的空白」专用的类别。
  const TYPE_TO_CLS = {
    kw: 'kw', num: 'num', str: 'str', tpl: 'tpl',
    comment: 'comment', name: 'name', punct: 'punct',
  };

  function highlight(src) {
    let tokens;
    try {
      tokens = Interp.tokenize(src);
    } catch (e) {
      // 降级路径，见文件头注释。空源码不会走到这里（tokenize('') 不抛），
      // 但非空源码抛错时，整篇当纯文本，只要非空就产出一个 plain 片段。
      return src.length ? [{ text: src, cls: 'plain' }] : [];
    }

    const segs = [];
    let pos = 0;
    for (const tok of tokens) {
      // eof 是零宽 token（start === end），tokenize('') 只产出这一个——
      // 跳过它，既不给它自己产出片段，也不用它去切空白（它切不出东西）。
      if (tok.type === 'eof') continue;
      if (tok.start > pos) segs.push({ text: src.slice(pos, tok.start), cls: 'plain' });
      segs.push({ text: src.slice(tok.start, tok.end), cls: TYPE_TO_CLS[tok.type] });
      pos = tok.end;
    }
    // 最后一个真 token 之后、到 eof 之前的尾随空白（比如源码末尾的换行）。
    if (pos < src.length) segs.push({ text: src.slice(pos, src.length), cls: 'plain' });
    return segs;
  }

  /* 每一行第一个字符在 src 里的字符下标，下标从 0 开始，行号从 1 开始
     （starts[line - 1] 就是第 line 行的起点）。只按 '\n' 断行——'\r' 被
     当成上一行末尾的一个普通字符，不产生额外的行边界。这不是随便选的
     约定：Interp.tokenize 数行号时也只在遇到 '\n' 时 line++/col=1，
     '\r' 和其它字符一样只让 col++。check() 用 lineStarts 把 (line, col)
     换算成 index，这两处「什么算换行」必须完全一致，否则 CRLF 源码里
     算出来的 index 会偏掉，波浪线画到错的字符上。 */
  function lineStarts(src) {
    const starts = [0];
    for (let i = 0; i < src.length; i++) {
      if (src[i] === '\n') starts.push(i + 1);
    }
    return starts;
  }

  /* 实时语法检查：包一层 Interp.parse，把抛出的 Error 转成 DOM 层能直接
     画波浪线、在行号槽点红点、悬停显示 message 的纯对象（规格 §2.8）。
     空源码不会走到 catch 分支（Interp.parse('') 本身就不抛），这里仍然
     显式写清楚：合法代码返回 null。

     category 原样取自 Interp 抛出的 e.category，不在这里重新按 message
     文本猜——interp.js 才是权威：它决定一段代码是「压根不是合法 JS」
     （syntax）还是「是合法 JS、只是不在这个教学子集里」（unsupported），
     这两类对使用者的意义完全不同，编辑器要用不同的措辞去讲给学习者听，
     但测哪一类是解释器的事，不是这里靠字符串匹配去猜的事。

     message 原样透传，不包一层 {zh, en}、也不做任何翻译——它是从
     interp.js 产生的，编辑器要逐字显示这句话，在这里发明一层双语会让
     措辞跟解释器本身的表述分叉。 */
  function check(src) {
    try {
      Interp.parse(src);
      return null;
    } catch (e) {
      const starts = lineStarts(src);
      const index = starts[e.line - 1] + e.col - 1;
      return { line: e.line, col: e.col, category: e.category, message: e.message, index: index };
    }
  }

  return { highlight: highlight, check: check, lineStarts: lineStarts };
});
