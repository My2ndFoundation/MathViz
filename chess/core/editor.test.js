'use strict';
const fs = require('fs');
const path = require('path');
const T = require('./_test.js');
const I = require('./interp.js');
const E = require('./editor.js');

function classesOf(src) { return E.highlight(src).map(p => p.cls); }
function textOf(src) { return E.highlight(src).map(p => p.text).join(''); }

// ---- 最重要的一条：片段拼回去必须与原文逐字节相同 ----
/* 高亮层与透明 textarea 是逐字符对齐的两层，只要有一个字符错位，
   光标就会与它下面的文字对不上 —— 这是这类编辑器最典型的坏法。 */
for (const src of [
  'let x = 1;',
  '// 注释\nlet y = 2;',
  'const s = "hi";',
  'const t = `a${b}c`;',
  'function f(a, b) { return a + b; }',
  '  let indented = 1;\n\n\nlet after = 2;',
  'let 中文 = 1; // 中文注释',
]) {
  T.eq(textOf(src), src, '片段拼回原文（逐字节）：' + JSON.stringify(src.slice(0, 24)));
}

// ---- 类别 ----
T.ok(classesOf('let x = 1;').indexOf('kw') >= 0, 'let 是关键字');
T.ok(classesOf('let x = 1;').indexOf('num') >= 0, '1 是数字');
T.ok(classesOf('const s = "hi";').indexOf('str') >= 0, '字符串');
T.ok(classesOf('// hi\nlet a=1;').indexOf('comment') >= 0, '注释有自己的类别');
T.ok(classesOf('const t = `a${b}c`;').indexOf('tpl') >= 0, '模板串');

// 空白也要有片段（否则拼不回原文），类别是 plain
T.ok(classesOf('let  x').indexOf('plain') >= 0, '空白是 plain 片段');

// ---- 高亮不能因为语法错误就整个罢工 ----
/* 使用者打字打到一半，源码几乎总是暂时不合法的。高亮是词法层的事，
   与语法是否合法无关 —— 这一条错了，编辑器会在每次敲键时闪烁。 */
T.eq(textOf('let x = ;'), 'let x = ;', '语法错误的源码仍然能高亮');
T.eq(textOf('function f( {'), 'function f( {', '括号不配对仍然能高亮');

// ---- 词法层报错的源码：降级但不抛 ----
/* `'abc`（未闭合字符串）会让 tokenize 抛错。高亮层必须兜住，
   把剩余部分当纯文本，而不是让整个编辑器炸掉。 */
const broken = E.highlight("let s = 'abc");
T.ok(broken.map(p => p.text).join('') === "let s = 'abc", '词法错误时也要拼回原文');

// ---- 空输入 ----
T.eq(E.highlight(''), [], '空源码给空数组');

// =====================================================================
// 以下是任务简报之外、要求补充的测试。
// =====================================================================

// ---- 补充 2/3：片段必须逐字节铺满原文，且不能出现空片段 ----
/* 单纯的拼接测试（textOf(src) === src）在两个相邻片段被交换、但内容碰巧
   拼接后仍然等于原文的情况下会漏检；逐段核对「这一段的文本是否恰好出现
   在累计偏移量那个位置」比纯拼接更强 —— 它同时验证了顺序、连续、不重叠。
   零长度片段在拼接测试里是隐形的（贡献空字符串），但在 DOM 层会变成一个
   什么都不渲染的多余 <span>，尤其容易从零宽的 eof token 上漏出来 —— 这里
   单独断言每个片段 text.length > 0 来堵住这个口子。 */
const VALID_CLASSES = ['kw', 'num', 'str', 'tpl', 'comment', 'name', 'punct', 'plain'];
function assertTiling(src, segs, label) {
  let offset = 0;
  for (const seg of segs) {
    T.ok(seg.text.length > 0, label + '：片段非空 @' + offset);
    T.eq(src.slice(offset, offset + seg.text.length), seg.text,
         label + '：片段与原文在偏移 ' + offset + ' 处逐字对齐');
    T.ok(VALID_CLASSES.indexOf(seg.cls) >= 0, label + '：cls 属于八个已知值之一（实际 ' + seg.cls + '）');
    offset += seg.text.length;
  }
  T.eq(offset, src.length, label + '：片段总长度覆盖整个原文，没有缺口也没有多余');
}

// ---- 补充 1：在生成的语料库上做差分式回归测试，而不是只测简报里手挑的 7 条 ----
/* interp.test.js 里已经出现过的每一条源码字符串都是免费的、真实被解释器
   验证过语义（或验证过会报错）的语料——从那个文件里把传给 I.tokenize /
   I.parse / I.run 的第一个参数（字面量字符串）抽出来，覆盖面远大于手写。
   这里用一个只匹配单/双引号字符串字面量的正则去抽，抽到的字符串包含大量
   会让 tokenize 抛错的畸形源码（未闭合字符串、非法转义……）—— 这正好是
   我们想覆盖的降级路径，不是要排除的噪声。 */
function extractLiteralArgs(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const re = /I\.(?:tokenize|parse|run)\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    try { out.push(eval(m[1])); } catch (e) { /* 不是简单字符串字面量，跳过 */ }
  }
  return out;
}

const baseFragments = [
  'let x = 1;',
  '// 注释\nlet y = 2;',
  'const s = "hi";',
  'const t = `a${b}c`;',
  'function f(a, b) { return a + b; }',
  '  let indented = 1;\n\n\nlet after = 2;',
];

const whitespaceVariants = [];
for (const frag of baseFragments) {
  whitespaceVariants.push(frag + '\n');           // 尾随换行
  whitespaceVariants.push('\n' + frag);           // 前导空行
  whitespaceVariants.push(frag.replace(/\n/g, '\r\n')); // CRLF
  whitespaceVariants.push(frag.replace(/ {2}/g, '\t')); // 两空格换成 tab
  whitespaceVariants.push('  \n' + frag + '  \n'); // 首尾空白行
}
// 纯空白文件（不同种类）——高亮必须整篇产出 plain 片段，不能因为「看起来
// 像没内容」就特殊处理成空数组（tokenize('   ') 仍会先给出真实的 eof）。
const whitespaceOnly = ['   ', '\n\n\n', '\t\t', '   \n\t  \n  '];

const corpus = Array.from(new Set([
  ...baseFragments,
  'let 中文 = 1; // 中文注释', // 简报里唯一一条会走降级路径的（词法层不认识“中”）
  "let s = 'abc",              // 未闭合字符串，同样走降级路径
  ...whitespaceVariants,
  ...whitespaceOnly,
  ...extractLiteralArgs(path.join(__dirname, 'interp.test.js')),
]));

T.ok(corpus.length >= 50, '语料库规模高于地板值（实际 ' + corpus.length + '），防止语料生成本身被悄悄改坏');

let corpusOk = 0;
for (const src of corpus) {
  const segs = E.highlight(src);
  T.eq(segs.map(p => p.text).join(''), src, '语料回归 · 拼接等于原文：' + JSON.stringify(src.slice(0, 40)));
  assertTiling(src, segs, '语料回归 · 铺满 ' + JSON.stringify(src.slice(0, 40)));
  corpusOk++;
}
console.log('语料库回归覆盖 ' + corpusOk + ' / ' + corpus.length + ' 条源码');

// ---- 补充 5：kw 必须恰好是 Interp.KEYWORDS，既不多也不少 ----
/* 从 Interp.KEYWORDS 派生列表，而不是在这里重新抄一遍——子集以后新增
   关键字时，这份测试要跟着解释器的表走，不能停留在写测试那一刻的快照。 */
for (const kw of I.KEYWORDS) {
  const segs = E.highlight(kw);
  T.eq(segs.length, 1, '关键字单独成词：' + kw);
  T.eq(segs[0].cls, 'kw', '『' + kw + '』必须高亮为 kw');
  T.eq(segs[0].text, kw, '『' + kw + '』片段文本与原文相同');
}
// 仅仅「包含」某个关键字的标识符，不能被误判成关键字。
for (const notKw of ['lets', 'constant', 'iffy', 'returned']) {
  const segs = E.highlight(notKw);
  T.eq(segs.length, 1, '疑似关键字的普通标识符单独成词：' + notKw);
  T.eq(segs[0].cls, 'name', '『' + notKw + '』只是包含关键字的标识符，必须是 name 而不是 kw');
}

// =====================================================================
// Task 4：波浪线位置与实时语法检查（纯函数）
// =====================================================================

// ---- 简报里手挑的用例 ----
T.eq(E.check('let x = 1;'), null, '合法代码没有错误');
T.eq(E.check(''), null, '空源码没有错误');

const bad = E.check('let x = ;');
T.ok(bad, '语法错误被报出来');
T.eq(bad.category, 'syntax', '类别是 syntax');
T.eq(bad.line, 1, '行号');
/* check 必须返回一个纯对象，不能把 Interp.parse 抛出的 Error 实例原样透出
   去——那样会带上 .stack 这类实现细节，且形状不受控（Error 的 message 是
   不可枚举属性，逐个属性读虽然还能读到，但对象整体已经不是「这五个字段」
   这个约定形状了）。用 JSON.stringify 比较整个对象的键集合，比逐个属性
   断言更能堵住「返回了错误对象本身」这类退化实现。 */
T.eq(Object.keys(bad).sort(), ['category', 'col', 'index', 'line', 'message'],
     'check 的返回值恰好是这五个字段，不多不少');
T.ok(!(bad instanceof Error), 'check 返回的是纯对象而不是 Error 实例');

const unsup = E.check('class Foo {}');
T.eq(unsup.category, 'unsupported', 'class 报 unsupported 而不是 syntax');
T.ok(/class/.test(unsup.message), '消息点名了 class：' + unsup.message);

/* 两个类别对使用者的意义完全不同，编辑器要用不同的措辞：
   unsupported = 「这是合法的 JS，但不在这个解释器的子集里」
   syntax      = 「这根本不是合法的 JS」 */
const unsup2 = E.check('const r = a ?? b;');
T.eq(unsup2.category, 'unsupported', '?? 是 unsupported');
T.ok(!/三元|ternary/i.test(unsup2.message), '?? 的消息不该说成三元运算符：' + unsup2.message);

// ---- index：波浪线定位 ----
const multi = E.check('let a = 1;\nlet b = 2;\nclass Foo {}');
T.eq(multi.line, 3, '第 3 行');
T.ok(typeof multi.index === 'number', 'index 是数字');
T.eq('let a = 1;\nlet b = 2;\nclass Foo {}'.slice(multi.index, multi.index + 5), 'class',
     'index 切出来正好是出错的那个词');

// ---- lineStarts：DOM 层把 index 换算成行/列要用 ----
T.eq(E.lineStarts('abc'), [0], '单行');
T.eq(E.lineStarts('a\nbb\nccc'), [0, 2, 5], '每行起点的字符下标');
T.eq(E.lineStarts(''), [0], '空源码也有一行');

// ---- 词法层的错误也要被 check 接住 ----
const lex = E.check("let s = 'abc");
T.ok(lex, '未闭合字符串被 check 报出来');
T.eq(lex.line, 1, '行号正确');

// =====================================================================
// 以下是任务简报之外、要求补充的测试。
// =====================================================================

// ---- 补充 1：check 与 Interp.parse 是否抛错，在整个语料库上必须一致 ----
/* Run 按钮是否可点由 check 的返回值决定：check 与 parse 一旦分歧，要么是
   一个会半路炸掉的程序被放行执行（§2.8 承诺不会发生的事），要么是一段
   合法代码被误锁住 Run 按钮。check 复用上面 Task 3 已经建好的语料库
   （见本文件前半部分的 corpus），不重新造一份。 */
let agreeCount = 0, errCount = 0;
for (const src of corpus) {
  let threw = false;
  try { I.parse(src); } catch (e) { threw = true; }

  let result;
  try {
    result = E.check(src);
  } catch (e) {
    T.ok(false, 'check 不应该抛出：' + JSON.stringify(src.slice(0, 40)) + ' -> ' + e.message);
    continue;
  }

  T.eq(result === null, !threw,
       'check 与 Interp.parse 是否抛错必须一致：' + JSON.stringify(src.slice(0, 40)));
  agreeCount++;
  if (result !== null) errCount++;
}
console.log('check/parse 一致性覆盖 ' + agreeCount + ' / ' + corpus.length + ' 条语料，其中 ' + errCount + ' 条报错');
T.ok(errCount >= 10, '报错的语料条数高于地板值，防止上面的一致性循环空转就通过（实际 ' + errCount + '）');

// ---- 补充 2：index 必须落在 [0, src.length] 内，且能通过 lineStarts 还原出同一个 (line, col) ----
function locateFromIndex(starts, index) {
  let line = 1;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= index) line = i + 1; else break;
  }
  return { line: line, col: index - starts[line - 1] + 1 };
}
let indexCheckedCount = 0;
for (const src of corpus) {
  const result = E.check(src);
  if (result === null) continue;
  indexCheckedCount++;
  T.ok(result.index >= 0 && result.index <= src.length,
       'index 落在 [0, src.length] 内：' + JSON.stringify(src.slice(0, 40)) + ' index=' + result.index);
  const starts = E.lineStarts(src);
  const located = locateFromIndex(starts, result.index);
  T.eq(located.line, result.line, 'index 还原出的行号与 error.line 一致：' + JSON.stringify(src.slice(0, 40)));
  T.eq(located.col, result.col, 'index 还原出的列号与 error.col 一致：' + JSON.stringify(src.slice(0, 40)));
}
T.ok(indexCheckedCount >= 10, 'index 断言覆盖的报错语料条数高于地板值（实际 ' + indexCheckedCount + '）');

// ---- 补充 3：lineStarts 要与源码本身核对，而不是核对一份手写清单 ----
for (const src of corpus) {
  const starts = E.lineStarts(src);
  T.eq(starts.length, src.split('\n').length,
       'lineStarts 长度等于换行符数量 + 1：' + JSON.stringify(src.slice(0, 40)));
  for (let n = 0; n < starts.length; n++) {
    T.ok(starts[n] === 0 || src[starts[n] - 1] === '\n',
         'starts[' + n + '] 紧跟在一个 \\n 之后（或是开头）：' + JSON.stringify(src.slice(0, 40)));
  }
}

/* lineStarts 对 \r\n 的约定：只按 \n 断行，\r 被当成上一行末尾的一个普通
   字符，不产生额外的行边界。这不是随便选的约定——interp.js 的词法器就是
   这样数行号的：tokenize 里的 adv() 只在遇到 '\n' 时 line++/col=1，'\r'
   和其它普通字符一样只让 col++（chess/core/interp.js 的 tokenize 开头
   附近）。check() 的 index 是用 lineStarts[line-1] + col-1 算出来的，这
   里「什么算换行」必须和词法器完全对齐，否则 CRLF 源码里报出的 index 会
   偏掉，波浪线画到错的字符上。*/
T.eq(E.lineStarts('a\n'), [0, 2], '结尾换行会多出一个（空）行的起点');
T.eq(E.lineStarts('a\n\nb'), [0, 2, 3], '连续空行：中间空行也有自己的起点');
T.eq(E.lineStarts('a\r\nb'), [0, 3], 'CRLF：\\r 算作上一行末尾的普通字符，不单独断行');
T.eq(E.lineStarts('a\r\n\r\nb'), [0, 3, 5], 'CRLF 连续空行同理');

// 用一条真实会报错的 CRLF 源码验证 index 换算确实对齐了词法器的行号/列号。
const crlfBad = E.check('let a = 1;\r\nlet x = ;');
T.ok(crlfBad, 'CRLF 源码里的语法错误也能被 check 到');
T.eq(crlfBad.line, 2, 'CRLF 源码里错误落在第 2 行');
T.eq('let a = 1;\r\nlet x = ;'.slice(crlfBad.index, crlfBad.index + 1), ';',
     'CRLF 源码里 index 依然精确定位到出错字符');

// ---- 补充 4：category 必须来自 .category 字段本身，不能靠嗅探 message 文本判断 ----
T.eq(E.check('class Foo {}').category, 'unsupported', 'class 是 unsupported');
T.eq(E.check('let x = ;').category, 'syntax', '缺表达式是 syntax');

/* 构造一个「category 是 syntax，但 message 里恰好出现 "Unsupported" 字样」的
   反例：真实解释器里目前没有这种组合（凡是消息里带 Unsupported 字样的分支，
   在 chess/core/interp.js 里都显式传了 category:'unsupported'），所以这里
   对 Interp.parse 本身做一次性猴子补丁来构造它——E 闭包里拿到的 Interp 和
   这里的 I 是同一个 require 缓存出来的对象，check() 是在调用时才读
   Interp.parse 这个属性，补丁在 E.check 内部同样生效。这验证的是 check 的
   分类逻辑读的是不是 e.category 字段本身，不是在赌 message 文本里没有
   "unsupported" 这个词——不是伪造断言结果。 */
const realParse = I.parse;
I.parse = function () {
  const e = new Error('Unsupported-looking wording, but this is really a syntax error');
  e.line = 1; e.col = 1; e.category = 'syntax';
  throw e;
};
try {
  const sniffTest = E.check('irrelevant source, Interp.parse is patched above');
  T.ok(sniffTest, '补丁后的错误被 check 接住');
  T.eq(sniffTest.category, 'syntax',
       'message 里出现 "Unsupported" 字样，但 category 字段是 syntax，check 必须照 category 字段来，' +
       '不能嗅探 message：' + sniffTest.category);
} finally {
  I.parse = realParse;
}

T.report();
