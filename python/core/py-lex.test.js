'use strict';
const T = require('./_test.js');
const PyLex = require('./py-lex.js');

/* ---- 不变量：无缝、全覆盖、永不抛错 ---- */
function assertSeamless(src, label) {
  const toks = PyLex.tokenize(src);
  if (src === '') { T.eq(toks, [], label + ' · 空串返回空数组'); return; }
  /* 非空源码却切出 0 个 token，说明有分支「推进了 i 但没 push」。brief 给的
     原版在这里直接读 toks[0].start，于是这种情况下整个文件以 TypeError 崩掉：
     照样是红的，但报的是崩溃栈而不是哪条断言挂了。实测过——把 ws 分支的 push
     删掉（正是 lex_roundtrip_check 那道门的负控制动作），原版报的是
     "Cannot read properties of undefined"。守一下，红得能读。 */
  if (toks.length === 0) { T.ok(false, label + ' · 非空源码必须切出至少一个 token'); return; }
  T.eq(toks[0].start, 0, label + ' · 首 token 从 0 开始');
  T.eq(toks[toks.length - 1].end, src.length, label + ' · 末 token 覆盖到结尾');
  let seamless = true;
  for (let i = 0; i + 1 < toks.length; i++) {
    if (toks[i].end !== toks[i + 1].start) { seamless = false; break; }
  }
  T.ok(seamless, label + ' · token 区间无缝');
  const rebuilt = toks.map(t => src.slice(t.start, t.end)).join('');
  T.eq(rebuilt, src, label + ' · 切片拼回与原文逐字节相同');
}

const CORPUS = [
  '',
  'x = 1\n',
  'def f(a, b=2, *args, **kw):\n    return a // b\n',
  '# only a comment\n',
  's = "double" + \'single\'\n',
  'doc = """line one\nline two"""\n',
  'f1 = f"{name!r:>{width}} ok"\n',
  'r = rb"\\x00raw" + FR\'\\d+\'\n',
  'n = 0x1f + 0o17 + 0b1010 + 1_000_000 + 1e10 + 1.5j\n',
  'walrus = (y := 3)\n',
  'def g() -> int:\n    return 1\n',
  '@decorator\nclass C:\n    pass\n',
  'total = a \\\n    + b\n',
  'match cmd:\n    case "go":\n        pass\n',
  'x = 1 if a else 2  # trailing\n',
  'a @= b\nc **= 2\nd //= 3\n',
];

/* 畸形语料：这些都**不许抛**，且必须照样满足三条不变量 */
const MALFORMED = [
  '"unterminated',
  "'''never closed\nstill going",
  'x = \\',
  'f"{unclosed',
  '\ufeffx = 1\n',
  'y = "a" "b',
  '0x',
  '1e',
];

/* 本实现自加的畸形语料（brief 之外）。每一条对应实现里的一条兜底分支：
   不加的话那些分支没有任何语料走到，「永不抛错」就只在纸面上成立。 */
const EXTRA_MALFORMED = [
  'r"\\',            // raw 串以反斜杠收尾——反斜杠要吃掉「不存在的下一个字符」
  '@',               // 光杆 @：后面没有标识符首字符，落回 op
  '@ ',              // @ 后面是空格，同上
  '!',               // 单独的 ! 不在运算符表里，走「落单字符」兜底
  '\r\n',            // 全文只有一个 CRLF
  '\r',              // 裸 CR
  '0b',              // 残缺二进制
  '"""',             // 只有开引号的三引号
  '\\',              // 全文只有一个反斜杠
  '$',               // Python 里非法的字符
  '   ',             // 只有空白
  '0',               // 文件以裸 0 收尾（见下面「承重守卫」那条）
  '0.',              // 以点收尾的浮点
  '1e+',             // 指数只有符号没有数字
];

CORPUS.concat(MALFORMED).concat(EXTRA_MALFORMED).forEach(function (src, i) {
  let threw = null;
  try { PyLex.tokenize(src); } catch (e) { threw = e; }
  T.eq(threw, null, '语料 #' + i + ' 不抛错');
  assertSeamless(src, '语料 #' + i);
});

/* ---- 分类：拿几处关键切分点钉死 ---- */
function typesOf(src) {
  return PyLex.significant(PyLex.tokenize(src)).map(t => t.type + ':' + src.slice(t.start, t.end));
}

T.eq(typesOf('x = 1\n'), ['name:x', 'op:=', 'number:1'], '最简赋值');
T.eq(typesOf('a // b\n'), ['name:a', 'op://', 'name:b'], '整除是一个 token，不是两个 /');
T.eq(typesOf('a ** b\n'), ['name:a', 'op:**', 'name:b'], '幂是一个 token');
T.eq(typesOf('(y := 3)\n'), ['punct:(', 'name:y', 'op::=', 'number:3', 'punct:)'], '海象是一个 token');
T.eq(typesOf('def f() -> int:\n'),
     ['keyword:def', 'name:f', 'punct:(', 'punct:)', 'op:->', 'builtin:int', 'punct::'],
     '箭头是一个 token；int 是 builtin 不是 name');
T.eq(typesOf('print(len(s))\n'),
     ['builtin:print', 'punct:(', 'builtin:len', 'punct:(', 'name:s', 'punct:)', 'punct:)'],
     'print / len 归类为 builtin');
T.eq(typesOf('match x:\n'), ['softkw:match', 'name:x', 'punct::'], 'match 是软关键字');
T.eq(typesOf('m = match\n'), ['name:m', 'op:=', 'softkw:match'], '软关键字在任何位置都归 softkw（简化：不看上下文）');
T.eq(typesOf('n = 1_000_000\n'), ['name:n', 'op:=', 'number:1_000_000'], '下划线数字是一个 token');
T.eq(typesOf('z = 1.5j\n'), ['name:z', 'op:=', 'number:1.5j'], '虚数后缀属于数字');
T.eq(typesOf('s = rb"\\x00"\n'), ['name:s', 'op:=', 'string:rb"\\x00"'], '前缀属于字符串 token');
T.eq(typesOf('s = f"{a}"\n'), ['name:s', 'op:=', 'fstring:f"{a}"'], 'f 串单独归类 fstring');
T.eq(typesOf('@dec\n'), ['decorator:@dec'], '装饰器整体一个 token');
T.eq(typesOf('x = 1  # tail\n'), ['name:x', 'op:=', 'number:1'], 'significant 滤掉注释');

/* 三引号跨行 */
(function () {
  const src = 'doc = """a\nb"""\nx = 1\n';
  const t = typesOf(src);
  T.eq(t[2], 'string:"""a\nb"""', '三引号跨行是一个 token');
  T.eq(t[3], 'name:x', '三引号之后继续正常切词');
})();

/* 未闭合三引号：吃到文件尾，且仍然无缝 */
(function () {
  const src = 'doc = """a\nb\n';
  const toks = PyLex.tokenize(src);
  T.eq(toks[toks.length - 1].end, src.length, '未闭合三引号吃到文件尾');
})();

/* ================================================================
   以下是 brief 之外自加的断言。头几条钉死的正是下游那道「与 CPython
   tokenize 对表」的门（T14 lex_vs_cpython_check）会真比对到的切分点；
   每条后面写的是实测 CPython 3.12 的输出。
   ================================================================ */

/* CPython: NUMBER '.5' (1,4)-(1,6)。不支持就会切成 punct '.' + number '5'，
   区间数对不上，对表门直接红。 */
T.eq(typesOf('x = .5\n'), ['name:x', 'op:=', 'number:.5'], '点开头的浮点数是一个 number');
T.eq(typesOf('x = 1.\n'), ['name:x', 'op:=', 'number:1.'], '点结尾的浮点数是一个 number');

/* CPython: STRING 'r"\\""' 一个 token —— raw 串里反斜杠**仍然**为切词目的转义引号
   （反斜杠本身留在值里）。brief 第 5 条写的「转义只在非 raw 串里跳过下一个字符」
   与此不符，见 py-lex.js 文件头「与 brief 的两处偏离」第 1 条。 */
T.eq(typesOf('r"\\""\n'), ['string:r"\\""'], 'raw 串里反斜杠照样转义引号（与 CPython 一致）');

/* CPython: OP '...' 一个 token，不是三个 '.'。靠的是运算符表的长度顺序。 */
T.eq(typesOf('x = ...\n'), ['name:x', 'op:=', 'op:...'], '省略号是一个 token');

/* CPython: OP '@=' 一个 token。@ 后不是标识符首字符，所以不走 decorator 分支。 */
T.eq(typesOf('a @= b\n'), ['name:a', 'op:@=', 'name:b'], '@= 是运算符不是装饰器');
T.eq(typesOf('@a.b.c\n'), ['decorator:@a.b.c'], '点分装饰器整体一个 token');

/* 残缺指数：CPython 给 NUMBER '1' + NAME 'e'，这里照此切，不把 e 吞进数字。 */
T.eq(typesOf('x = 1e\n'), ['name:x', 'op:=', 'number:1', 'name:e'], '残缺指数不把 e 吞进数字');
T.eq(typesOf('x = 1e-5\n'), ['name:x', 'op:=', 'number:1e-5'], '带符号指数属于数字');

/* 查表用 Object.create(null)：否则 'constructor' / 'toString' 会命中
   Object.prototype 上的继承属性，被误判成 builtin。 */
T.eq(typesOf('constructor = toString\n'),
     ['name:constructor', 'op:=', 'name:toString'],
     '原型链上的名字不会被误判成 builtin');

/* softkw 的 '_' 来自 keyword.softkwlist，for 循环里的丢弃变量因此归 softkw。 */
T.eq(typesOf('for _ in range(3):\n'),
     ['keyword:for', 'softkw:_', 'keyword:in', 'builtin:range', 'punct:(', 'number:3', 'punct:)', 'punct::'],
     'for / in 是关键字，_ 是软关键字，range 是 builtin');

/* 'type' 同时在 softkwlist 和 dir(builtins) 里。查表顺序是
   keyword → softkw → builtin → name，所以它归 softkw。写下来是因为这条
   会让人以为是 bug：type(x) 的 type 不着 builtin 的色。 */
T.eq(typesOf('type(x)\n'), ['softkw:type', 'punct:(', 'name:x', 'punct:)'], 'type 归 softkw 而不是 builtin');

/* 未闭合的**单**引号串只吃到行尾——不是吃到文件尾。见 py-lex.js 文件头
   「与 brief 的两处偏离」第 2 条：这正是本模块存在的理由所指的那种代价，
   一个引号没闭合不该让后面整篇变色。三引号仍然吃到文件尾（Python 语义如此）。 */
(function () {
  const src = 'x = "oops\ny = 1\n';
  const sig = PyLex.significant(PyLex.tokenize(src));
  T.eq(sig[2].type + ':' + src.slice(sig[2].start, sig[2].end), 'string:"oops', '未闭合单引号串只到行尾');
  T.eq(sig[3].type + ':' + src.slice(sig[3].start, sig[3].end), 'name:y', '下一行照常切词，不被整片吞掉');
})();

/* 串里的续行反斜杠（合法 Python）：转义掉换行，串继续到下一行。 */
(function () {
  const src = 'x = "a\\\nb"\n';
  const sig = PyLex.significant(PyLex.tokenize(src));
  T.eq(sig.length, 3, '被反斜杠转义的换行不终止字符串');
  T.eq(src.slice(sig[2].start, sig[2].end), '"a\\\nb"', '跨行串是一个 token');
})();

/* 空白与换行的分类（significant 滤掉它们，所以只能看全量流）。 */
(function () {
  const toks = PyLex.tokenize('a\r\nb\n');
  T.eq(toks.map(t => t.type), ['name', 'nl', 'name', 'nl'], 'CRLF 是一个 nl token');
  T.eq(toks[1].end - toks[1].start, 2, 'CRLF 的 nl token 长度是 2');
})();
T.eq(PyLex.tokenize('a\tb').map(t => t.type), ['name', 'ws', 'name'], '制表符归 ws');
T.eq(PyLex.tokenize('# c').map(t => t.type), ['comment'], '注释吃到行尾');
T.eq(PyLex.tokenize('# c\nx').map(t => t.type), ['comment', 'nl', 'name'], '注释不吞掉换行');

/* 续行反斜杠：一个 op，换行照常是 nl。 */
T.eq(PyLex.tokenize('a\\\nb').map(t => t.type), ['name', 'op', 'nl', 'name'], '续行反斜杠是一个 op');

/* significant 只滤 ws / nl / comment，别的都留下。 */
(function () {
  const toks = PyLex.tokenize('x = 1  # t\n');
  T.eq(PyLex.significant(toks).length, 3, 'significant 滤掉 ws / nl / comment');
  T.ok(toks.length > 3, '全量流里这些 token 还在');
  T.eq(PyLex.significant([]), [], 'significant 对空数组返回空数组');
})();

/* 三张表是对外契约（editor 的类名、judge 的分类都读它）。 */
T.eq(PyLex.KEYWORDS['def'], 1, 'KEYWORDS 含 def');
T.eq(PyLex.KEYWORDS['True'], 1, 'True 是关键字（不是 builtin）');
T.eq(typesOf('True\n'), ['keyword:True'], 'True 归 keyword，keyword 查表在 builtin 之前');
T.eq(PyLex.SOFTKW['match'], 1, 'SOFTKW 含 match');
T.eq(PyLex.BUILTINS['print'], 1, 'BUILTINS 含 print');
T.eq(PyLex.KEYWORDS['print'], undefined, 'print 不在 KEYWORDS 里');

/* 三引号的几种收尾 */
T.eq(typesOf("s = '''a'''\n"), ['name:s', 'op:=', "string:'''a'''"], '单引号三引号');
T.eq(typesOf('s = """a""" + "b"\n'),
     ['name:s', 'op:=', 'string:"""a"""', 'op:+', 'string:"b"'],
     '三引号闭合后继续切词');
T.eq(typesOf('s = f"""a{b}"""\n'), ['name:s', 'op:=', 'fstring:f"""a{b}"""'], 'f 三引号归 fstring');

/* 前缀的全部合法组合（大小写、顺序）都要认；非法组合不能吞掉引号。 */
['r', 'R', 'u', 'U', 'f', 'F', 'b', 'B', 'fr', 'rf', 'FR', 'Rb', 'bR', 'rb', 'br', 'BR'].forEach(function (p) {
  const src = p + '"x"';
  const want = (p.toLowerCase().indexOf('f') >= 0 ? 'fstring:' : 'string:') + src;
  T.eq(typesOf(src), [want], '前缀 ' + p + ' 整体是一个字符串 token');
});
/* 'ru' 不是合法前缀（u 不与任何字母组合）：必须切成 name + string。 */
T.eq(typesOf('ru"x"'), ['name:ru', 'string:"x"'], 'ru 不是合法前缀');
T.eq(typesOf('rrr"x"'), ['name:rrr', 'string:"x"'], 'rrr 不是合法前缀');
/* 标识符恰好以前缀字母开头但后面不是引号：是标识符。 */
T.eq(typesOf('f1 = 2\n'), ['name:f1', 'op:=', 'number:2'], 'f1 是标识符不是字符串前缀');

/* 承重守卫：'xXoObB'.indexOf('') 返回的是 0（>= 0！），所以进制分支里那句
   `second !== ''` 不是多余的防御——去掉它，文件以裸 '0' 收尾时会走进制分支、
   返回 end = i + 2 > src.length，全覆盖不变量当场破（而且 slice 不会报错，
   悄悄多出两个字符的空区间）。负控制做过：删掉守卫，下面这条与
   「语料 · 末 token 覆盖到结尾」一起变红。 */
T.eq(typesOf('0'), ['number:0'], '文件以裸 0 收尾');
(function () {
  const toks = PyLex.tokenize('0');
  T.eq(toks[0].end, 1, '裸 0 的 token 不越过源码长度');
})();
T.eq(typesOf('1e+'), ['number:1', 'name:e', 'op:+'], '指数只有符号没有数字时不吞');

/* 进制前缀 */
T.eq(typesOf('0x1f 0o17 0b1010 0XFF\n'),
     ['number:0x1f', 'number:0o17', 'number:0b1010', 'number:0XFF'],
     '三种进制前缀各是一个 number');

/* ---- UMD 的**浏览器**分支 ----
   require() 进来的永远走 node 分支（module.exports）。node -e 与 node 读 stdin
   同样会定义 module，所以那两种写法也测不到浏览器分支——本仓 CLAUDE.md 专门
   记过这个坑：「一道测错分支的门比没有门更糟，它宣称了自己没有的覆盖」。
   用 vm 起一个裸上下文（没有 module / require / self）才能真的走到
   `root.PyLex = factory()` 那一支。这个 UMD 外壳是后面 store / exercise /
   editor / judge / trace 都要照抄的形状，错了是六个模块一起错。 */
(function () {
  const vm = require('vm');
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'py-lex.js'), 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'py-lex.js' });
  T.eq(typeof sandbox.module, 'undefined', '裸上下文里没有 module，确实走的是浏览器分支');
  const bound = sandbox.PyLex;
  const ok = !!bound && typeof bound.tokenize === 'function';
  T.ok(ok, '浏览器分支把 PyLex 挂到了 root 上');
  /* 守一下再往下用：挂错名字（负控制做过：root.PyLex 改成 root.PyLexTypo）时
     原版会以 TypeError 崩掉，红是红的，但报的是崩溃栈不是哪条断言挂了。 */
  T.eq(ok ? bound.significant(bound.tokenize('a // b')).map(t => t.type) : null,
       ['name', 'op', 'name'], '浏览器分支拿到的是同一个词法器');
})();

T.report('py-lex');
