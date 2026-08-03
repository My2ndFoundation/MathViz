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

T.report();
