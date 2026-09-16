'use strict';
/* py-lex —— Python 词法器。整个 python 子项目的地基：语法高亮（editor）与
   答案判定（judge）读的是同一份 token 流。

   ── 为什么这个词法器永不抛错 ──────────────────────────────────────────
   三层影子临摹是逐字符对齐的三层（标准程序垫底、用户输入在上、光标在最上），
   错一个字符光标就与文字对不上。所以「把 token 切片拼回去逐字节等于原文」
   必须**构造性**成立，不能靠测试去抽查。

   另一条路是 chess 的 core/editor.js 走的：tokenize 允许抛，抛了就整篇降级成
   纯文本。代价写在它自己的注释里——「一个引号没有闭合期间，整份文档都会短暂
   失去颜色」。而使用者打字打到一半，源码几乎总是暂时不合法，那个代价会一直付。

   这里从设计上绕开：tokenize 对**任何**输入都产出一列无缝覆盖 [0, src.length)
   的 token，永不抛错。主循环每一轮都必须推进 i 且必须 push 一个 token——这两条
   一起保证了无缝与终止。未闭合的三引号一直吃到文件尾；孤立反斜杠、以及任何
   落单的非法字符，各算一个 op。于是往返不变量不需要任何降级路径。

   不变量（构造性）：
     tokenize('')                        === []
     tokens[0].start                     === 0
     tokens[i].end                       === tokens[i+1].start
     tokens[tokens.length-1].end         === src.length

   ── 与 brief 的两处偏离（都是为了与 CPython tokenize 对齐）──────────────
   下游有一道门（T14 lex_vs_cpython_check）拿 CPython 的 tokenize 模块切同一段
   源码来对区间，所以凡是能和标准对齐的地方都对齐了。两处与 brief 字面不同：

   1. 反斜杠在 **raw 串里也**转义下一个字符。brief 第 5 条写的是「转义只在非 raw
      串里跳过下一个字符」，但 Python 不是这样：raw 串里反斜杠仍然为**切词**目的
      转义引号（反斜杠本身留在值里）。实测 CPython 3.12：
        tokenize('r"\\""')  ->  STRING 'r"\\""'  (1,0)-(1,5)     ← 一个 token
      按 brief 的字面实现，r"\"" 会在第二个引号处收尾，剩下的引号再开一个到
      文件尾的串——正是本模块存在的理由所要消灭的那种「一个引号毁掉后面整篇」。

   2. 未闭合的**单**引号串只吃到行尾，不吃到文件尾（三引号仍吃到文件尾）。
      brief 第 5 条的「未闭合时吃到文件尾」对三引号是对的（Python 语义如此，
      brief 的说理段也只举三引号），对单引号串则会把损害放大到整篇。CPython 在
      这里报的是「未终止的字符串字面量」并把 token 断在行尾，同样只影响一行。

   还有一处**不是**偏离、但会让人以为是 bug 的地方：'type' 同时在
   keyword.softkwlist 和 dir(builtins) 里，查表顺序是 keyword → softkw → builtin，
   所以 type(x) 的 type 归 softkw。软关键字一律不看上下文（brief 的简化），
   所以 m = match 里的 match 也归 softkw。

   另一处已知的粗糙：'@' 后紧跟标识符首字符就整体算 decorator（brief 第 4 条），
   于是矩阵乘法写成不带空格的 a@b 时，'@b' 会被当成装饰器。CPython 给的是
   OP '@' + NAME 'b'。教学程序里不出现无空格矩阵乘法，先按 brief 来；真要修，
   改成「只有 '@' 是本行第一个非空白字符时才算 decorator」即可。

   ── 三张表怎么来的 ────────────────────────────────────────────────────
   KEYWORDS / SOFTKW / BUILTINS 是 CPython 3.12 的实测输出，一次生成写成字面量：

     python3 -c "import keyword,builtins,json; print(json.dumps({'kw':keyword.kwlist,'soft':keyword.softkwlist,'bi':[n for n in dir(builtins) if not n.startswith('_')]}))"

   查表对象一律 Object.create(null)：用 {} 的话 'constructor' / 'toString' /
   'valueOf' 这些名字会命中 Object.prototype 上的继承属性，被误判成 builtin。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PyLex = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function toSet(names) {
    var o = Object.create(null);
    names.split(' ').forEach(function (n) { if (n) { o[n] = 1; } });
    return o;
  }

  /* keyword.kwlist */
  var KEYWORDS = toSet(
    'False None True and as assert async await break class continue def del ' +
    'elif else except finally for from global if import in is lambda nonlocal ' +
    'not or pass raise return try while with yield');

  /* keyword.softkwlist */
  var SOFTKW = toSet('_ case match type');

  /* [n for n in dir(builtins) if not n.startswith('_')] */
  var BUILTINS = toSet(
    'ArithmeticError AssertionError AttributeError BaseException ' +
    'BaseExceptionGroup BlockingIOError BrokenPipeError BufferError ' +
    'BytesWarning ChildProcessError ConnectionAbortedError ConnectionError ' +
    'ConnectionRefusedError ConnectionResetError DeprecationWarning EOFError ' +
    'Ellipsis EncodingWarning EnvironmentError Exception ExceptionGroup False ' +
    'FileExistsError FileNotFoundError FloatingPointError FutureWarning ' +
    'GeneratorExit IOError ImportError ImportWarning IndentationError ' +
    'IndexError InterruptedError IsADirectoryError KeyError KeyboardInterrupt ' +
    'LookupError MemoryError ModuleNotFoundError NameError None ' +
    'NotADirectoryError NotImplemented NotImplementedError OSError ' +
    'OverflowError PendingDeprecationWarning PermissionError ' +
    'ProcessLookupError RecursionError ReferenceError ResourceWarning ' +
    'RuntimeError RuntimeWarning StopAsyncIteration StopIteration SyntaxError ' +
    'SyntaxWarning SystemError SystemExit TabError TimeoutError True TypeError ' +
    'UnboundLocalError UnicodeDecodeError UnicodeEncodeError UnicodeError ' +
    'UnicodeTranslateError UnicodeWarning UserWarning ValueError Warning ' +
    'ZeroDivisionError abs aiter all anext any ascii bin bool breakpoint ' +
    'bytearray bytes callable chr classmethod compile complex copyright ' +
    'credits delattr dict dir divmod enumerate eval exec exit filter float ' +
    'format frozenset getattr globals hasattr hash help hex id input int ' +
    'isinstance issubclass iter len license list locals map max memoryview ' +
    'min next object oct open ord pow print property quit range repr reversed ' +
    'round set setattr slice sorted staticmethod str sum super tuple type ' +
    'vars zip');

  /* 运算符表。**顺序就是语义**：主循环从头往后取第一个前缀匹配，所以表必须
     按长度从长到短排。'//' 排到 '/' 后面，整除就会被切成两个 '/'——那正是
     T14 lex_vs_cpython_check 的负控制动作，也是本任务 Step 5 实际做过的破坏。
     绝不要在运行时 sort 这张表：那会让上面那个负控制永远变不红，
     一道弄不红的门等于没有门。 */
  var OPS = ['//=', '**=', '>>=', '<<=', '...', '!=', '==', '>=', '<=', '//', '**', '->', ':=',
             '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '@=', '>>', '<<',
             '+', '-', '*', '/', '%', '&', '|', '^', '~', '<', '>', '=', '@'];

  var PUNCT = '()[]{},:;.';

  /* 字符串前缀里可能出现的字母，以及它们的合法组合（小写归一后比对）。
     u 不与任何字母组合，所以 ru / ub 之流不是前缀，'ru"x"' 是标识符 ru 接一个串。 */
  var PREFIX_CHARS = 'rRbBuUfF';
  var PREFIXES = toSet('r u f b fr rf br rb');

  var HEX = '0123456789abcdefABCDEF';
  var OCT = '01234567';
  var BIN = '01';

  function isDigit(c) { return c >= '0' && c <= '9'; }
  function isIdStart(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }
  function isIdPart(c) { return isIdStart(c) || isDigit(c); }
  /* 行内空白。U+FEFF（BOM）算在里面：它可能出现在文件开头，归 ws 是隐形的，
     落到「落单字符」兜底里会挂上 op 的颜色。 */
  function isSpace(c) {
    return c === ' ' || c === '\t' || c === '\f' || c === '\v' || c === '\ufeff';
  }
  function at(src, k, lit) { return src.slice(k, k + lit.length) === lit; }

  /* 从 i 开始尝试切一个字符串字面量（含前缀）。切不出来返回 null，
     由主循环继续往下试标识符。返回 { type, end }，end 恒在 (i, src.length]。 */
  function scanString(src, i) {
    var n = src.length;
    var p = i;
    while (p < n && p - i < 3 && PREFIX_CHARS.indexOf(src.charAt(p)) >= 0) { p++; }
    var q = src.charAt(p);
    if (q !== '"' && q !== "'") { return null; }
    var prefix = src.slice(i, p);
    if (prefix !== '' && !PREFIXES[prefix.toLowerCase()]) { return null; }
    var type = prefix.toLowerCase().indexOf('f') >= 0 ? 'fstring' : 'string';

    var triple = at(src, p, q + q + q);
    var close = triple ? q + q + q : q;
    var j = p + close.length;
    while (j < n) {
      var ch = src.charAt(j);
      /* 反斜杠转义下一个字符——raw 串里也一样（文件头偏离 1）。
         顺带把「串里的续行反斜杠」处理对了：被转义的换行不终止单引号串。 */
      if (ch === '\\') { j += 2; continue; }
      /* 单引号串不跨行（文件头偏离 2）：断在换行之前，把换行留给 nl。 */
      if (!triple && (ch === '\n' || ch === '\r')) { break; }
      if (at(src, j, close)) { return { type: type, end: j + close.length }; }
      j++;
    }
    /* 没闭合：三引号吃到文件尾；单引号串吃到行尾。j 可能因为末尾的反斜杠
       跨过了 n，夹回去，end 才不会超出源码长度。 */
    return { type: type, end: j > n ? n : j };
  }

  /* 从 i 开始切一个数字，返回结束下标。残缺写法（'0x'、'0b'）照样吃掉已有
     字符并算 number，绝不抛。 */
  function scanNumber(src, i) {
    var n = src.length;
    var j = i;
    var second = src.charAt(i + 1);
    if (src.charAt(i) === '0' && 'xXoObB'.indexOf(second) >= 0 && second !== '') {
      var kind = second.toLowerCase();
      var digits = kind === 'x' ? HEX : (kind === 'o' ? OCT : BIN);
      j = i + 2;
      while (j < n && (digits.indexOf(src.charAt(j)) >= 0 || src.charAt(j) === '_')) { j++; }
      return j;
    }
    while (j < n && (isDigit(src.charAt(j)) || src.charAt(j) === '_')) { j++; }
    if (src.charAt(j) === '.') {
      j++;
      while (j < n && (isDigit(src.charAt(j)) || src.charAt(j) === '_')) { j++; }
    }
    /* 指数只有真的跟着数字才吃。残缺的 '1e' 按 CPython 切成 NUMBER '1' + NAME 'e'，
       而不是把 e 吞进数字里。 */
    var e = src.charAt(j);
    if (e === 'e' || e === 'E') {
      var k = j + 1;
      if (src.charAt(k) === '+' || src.charAt(k) === '-') { k++; }
      if (isDigit(src.charAt(k))) {
        j = k;
        while (j < n && (isDigit(src.charAt(j)) || src.charAt(j) === '_')) { j++; }
      }
    }
    if (src.charAt(j) === 'j' || src.charAt(j) === 'J') { j++; }
    return j;
  }

  function tokenize(src) {
    var out = [];
    if (typeof src !== 'string' || src === '') { return out; }
    var n = src.length;
    var i = 0;

    /* 每一轮：读出一个 token 的 [start, i)，push，继续。i 必须严格增长。 */
    while (i < n) {
      var start = i;
      var c = src.charAt(i);
      var type;

      /* 1. 换行：\r\n 算一个 token */
      if (c === '\n') {
        i += 1;
        out.push({ type: 'nl', start: start, end: i });
        continue;
      }
      if (c === '\r') {
        i += src.charAt(i + 1) === '\n' ? 2 : 1;
        out.push({ type: 'nl', start: start, end: i });
        continue;
      }

      /* 2. 行内空白 */
      if (isSpace(c)) {
        while (i < n && isSpace(src.charAt(i))) { i++; }
        out.push({ type: 'ws', start: start, end: i });
        continue;
      }

      /* 3. 注释：吃到行尾，不含换行 */
      if (c === '#') {
        while (i < n && src.charAt(i) !== '\n' && src.charAt(i) !== '\r') { i++; }
        out.push({ type: 'comment', start: start, end: i });
        continue;
      }

      /* 4. 装饰器：@ 紧跟标识符首字符，整体（含点分名字）一个 token */
      if (c === '@' && isIdStart(src.charAt(i + 1))) {
        i++;
        while (i < n && isIdPart(src.charAt(i))) { i++; }
        while (src.charAt(i) === '.' && isIdStart(src.charAt(i + 1))) {
          i++;
          while (i < n && isIdPart(src.charAt(i))) { i++; }
        }
        out.push({ type: 'decorator', start: start, end: i });
        continue;
      }

      /* 5. 字符串（前缀属于 token；带 f 的归 fstring）。
            必须排在标识符之前——rb"x" 的第一个字符也是标识符首字符。 */
      var str = scanString(src, i);
      if (str) {
        i = str.end;
        out.push({ type: str.type, start: start, end: i });
        continue;
      }

      /* 6. 数字。'.5' 也是数字（CPython: NUMBER '.5'），所以点后跟数字时进这里。 */
      if (isDigit(c) || (c === '.' && isDigit(src.charAt(i + 1)))) {
        i = scanNumber(src, i);
        out.push({ type: 'number', start: start, end: i });
        continue;
      }

      /* 7. 标识符 → 查表 */
      if (isIdStart(c)) {
        while (i < n && isIdPart(src.charAt(i))) { i++; }
        var word = src.slice(start, i);
        type = KEYWORDS[word] ? 'keyword'
             : SOFTKW[word] ? 'softkw'
             : BUILTINS[word] ? 'builtin'
             : 'name';
        out.push({ type: type, start: start, end: i });
        continue;
      }

      /* 8. 运算符：表是长到短排的，取第一个前缀匹配 */
      var op = null;
      for (var k = 0; k < OPS.length; k++) {
        if (at(src, i, OPS[k])) { op = OPS[k]; break; }
      }
      if (op !== null) {
        i += op.length;
        out.push({ type: 'op', start: start, end: i });
        continue;
      }

      /* 9. 标点 */
      if (PUNCT.indexOf(c) >= 0) {
        i++;
        out.push({ type: 'punct', start: start, end: i });
        continue;
      }

      /* 10. 续行反斜杠，以及任何落单字符（Python 里非法的 $ ! ? 之流）：
             吃一个字符，归 op。绝不抛错、绝不跳过——跳过会在 token 之间留洞，
             拼回去就不等于原文了。 */
      i++;
      out.push({ type: 'op', start: start, end: i });
    }

    return out;
  }

  /* 滤掉 ws / nl / comment。判定器与「第几个 token」的定位都只看这一层。 */
  function significant(tokens) {
    var out = [];
    var list = tokens || [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.type !== 'ws' && t.type !== 'nl' && t.type !== 'comment') { out.push(t); }
    }
    return out;
  }

  return {
    tokenize: tokenize,
    significant: significant,
    KEYWORDS: KEYWORDS,
    SOFTKW: SOFTKW,
    BUILTINS: BUILTINS
  };
});
