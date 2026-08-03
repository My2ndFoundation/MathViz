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

/* ==================== 3b 复审新增：括号配对（规格 §2.8） ====================
   块作用域，理由同 debugger.test.js 里那一块：不跟上半部分的夹具抢名字。 */
{

/* at(src, ch, nth) —— 按「第 n 个某字符」取下标，省得在断言里手数偏移量；
   手数出来的下标错一位，测试会以一种极难看出的方式变成在测别的东西。 */
function at(src, ch, nth) {
  let idx = -1;
  for (let k = 0; k < (nth || 1); k++) idx = src.indexOf(ch, idx + 1);
  return idx;
}

const S1 = 'const a = (1 + 2) * 3;';
const o1 = at(S1, '('), c1 = at(S1, ')');

// 光标贴在开括号右边（即左邻是它）
T.eq(E.matchBracket(S1, o1 + 1), { open: o1, close: c1 }, 'matchBracket：光标左邻是开括号');
// 光标贴在开括号左边（右邻是它）
T.eq(E.matchBracket(S1, o1), { open: o1, close: c1 }, 'matchBracket：光标右邻是开括号');
// 光标贴在闭括号右边 —— 刚打完一个右括号时人期待它立刻和左括号一起亮
T.eq(E.matchBracket(S1, c1 + 1), { open: o1, close: c1 }, 'matchBracket：光标左邻是闭括号');
T.eq(E.matchBracket(S1, c1), { open: o1, close: c1 }, 'matchBracket：光标右邻是闭括号');
// 不挨着任何括号
T.eq(E.matchBracket(S1, 0), null, 'matchBracket：不挨着括号时返回 null');
T.eq(E.matchBracket(S1, S1.length), null, 'matchBracket：末尾（分号之后）返回 null');

/* 左邻优先：`)(` 这个位置两边都是括号，约定取左邻那一个。
   第一版只断言了 `.close`，还把 openOf2 算出来又没用上；而且写成
   `matchBracket(...).close` 时，一旦返回 null 就是抛 TypeError 而不是干净地
   报失败。这里改成整对比较，并把 openOf2 用在"绝不该是右邻那一对"上。 */
const S2 = 'f()(1);';
const openOfF = at(S2, '('), closeOfF = at(S2, ')');
const openOf2 = at(S2, '(', 2), closeOf2 = at(S2, ')', 2);
/* 先取一次、再断言两条：第二条原来又调了一遍 matchBracket 并直接取 `.open`，
   一旦回归成返回 null 就是抛 TypeError（整个文件剩下的三千多条断言当场夭折），
   而不是干净地报一条失败。 */
const mb2 = E.matchBracket(S2, closeOfF + 1);
T.eq(mb2, { open: openOfF, close: closeOfF },
     'matchBracket：两边都是括号时取左邻那一对（左邻优先）');
T.ok(!!mb2 && mb2.open !== openOf2,
     'matchBracket：左邻优先时绝不返回右邻那一对（' + openOf2 + '/' + closeOf2 + '）');

// 嵌套：外层与内层各配各的
const S3 = 'g((a + b) * (c - d));';
const outerO = at(S3, '('), outerC = S3.lastIndexOf(')');
T.eq(E.matchBracket(S3, outerO + 1), { open: outerO, close: outerC }, 'matchBracket：嵌套时外层配外层');
const innerO = at(S3, '(', 2), innerC = at(S3, ')');
T.eq(E.matchBracket(S3, innerO + 1), { open: innerO, close: innerC }, 'matchBracket：嵌套时内层配内层');

// 三种括号都要认，且互不串门
const S4 = 'const m = { a: [1, 2], b: (3) };';
T.eq(E.matchBracket(S4, at(S4, '{') + 1), { open: at(S4, '{'), close: S4.lastIndexOf('}') }, 'matchBracket：花括号');
T.eq(E.matchBracket(S4, at(S4, '[') + 1), { open: at(S4, '['), close: at(S4, ']') }, 'matchBracket：方括号');
T.eq(E.matchBracket(S4, at(S4, '(') + 1), { open: at(S4, '('), close: at(S4, ')') }, 'matchBracket：圆括号');

/* ---- 复用词法器换来的那件事：字符串 / 模板串 / 注释里的括号不参与配对 ----
   这几条是选「复用 Interp.tokenize 而不是裸扫字符」的全部理由。裸扫会让
   log("(") 里那个左括号去跟真代码里的右括号配对，高亮当场指错地方。 */
const S5 = 'log("(");';
T.eq(E.matchBracket(S5, at(S5, '(') + 1), { open: at(S5, '('), close: S5.lastIndexOf(')') },
     'matchBracket：字符串里的 "(" 不参与配对，真括号照常配上');
const S6 = 'log("(") ;';
T.ok(E.matchBracket(S6, S6.indexOf('"(') + 2) === null,
     'matchBracket：光标贴着字符串内部的括号时不配对（它根本不是 punct token）');

/* ---- 注释里的括号：必须是**不配对**的那种才有区分度 ----
   第一版写的是 '// )\nconst a = (1);'：注释里那个 ")" 排在真括号**前面**，
   朴素字符扫描器从 "(" 往后找根本碰不到它，于是朴素实现给出同一个答案 ——
   这个用例测不出任何东西（把它挪到真括号后面也一样，实测过）。
   有区分度的形状是：注释里塞一个**多余的**括号，逼着扫描器路过它。
   下面用一个朴素扫描器当对照，直接断言两者给出**不同**的答案，把"这个用例
   确实有牙齿"这件事本身也钉住 —— 免得哪天它悄悄退化成又一个测不出东西的用例。 */
function naiveMatch(src, caret) {
  const OP = { '(': ')', '[': ']', '{': '}' }, CL = { ')': '(', ']': '[', '}': '{' };
  let i = -1;
  if (OP[src[caret - 1]] || CL[src[caret - 1]]) i = caret - 1;
  else if (OP[src[caret]] || CL[src[caret]]) i = caret;
  else return null;
  if (OP[src[i]]) {
    let d = 0;
    for (let k = i; k < src.length; k++) {
      if (OP[src[k]]) d++;
      else if (CL[src[k]]) { d--; if (d === 0) return { open: i, close: k }; }
    }
    return null;
  }
  let d = 0;
  for (let k = i; k >= 0; k--) {
    if (CL[src[k]]) d++;
    else if (OP[src[k]]) { d--; if (d === 0) return { open: k, close: i }; }
  }
  return null;
}

// 块注释里多一个左括号：向前扫的路上会撞见它
const S7 = 'const a = ( /* ( */ 1);';
const s7o = S7.indexOf('('), s7c = S7.lastIndexOf(')');
T.eq(E.matchBracket(S7, s7o + 1), { open: s7o, close: s7c },
     'matchBracket：块注释里多余的 "(" 不参与配对');
T.ok(JSON.stringify(naiveMatch(S7, s7o + 1)) !== JSON.stringify(E.matchBracket(S7, s7o + 1)),
     'matchBracket：上一条确实有区分度（朴素字符扫描在这里会给出不同答案）');

// 行注释里多一个左括号
const S7b = 'const a = (   // (\n  1);';
const s7bo = S7b.indexOf('('), s7bc = S7b.lastIndexOf(')');
T.eq(E.matchBracket(S7b, s7bo + 1), { open: s7bo, close: s7bc },
     'matchBracket：行注释里多余的 "(" 不参与配对');
T.ok(JSON.stringify(naiveMatch(S7b, s7bo + 1)) !== JSON.stringify(E.matchBracket(S7b, s7bo + 1)),
     'matchBracket：行注释那条也有区分度');

// 注释里多一个右括号：向**后**扫的路上会撞见它
const S7c = 'const a = (1 /* ) */ );';
const s7co = S7c.indexOf('('), s7cc = S7c.lastIndexOf(')');
T.eq(E.matchBracket(S7c, s7cc + 1), { open: s7co, close: s7cc },
     'matchBracket：注释里多余的 ")" 不参与配对（从闭括号往回扫）');
T.ok(JSON.stringify(naiveMatch(S7c, s7cc + 1)) !== JSON.stringify(E.matchBracket(S7c, s7cc + 1)),
     'matchBracket：向后扫那条也有区分度');

// 字符串那两条（S5/S6）本来就有区分度，这里补一条同样形状的多余括号
const S7d = 'const a = ( "(" + 1);';
const s7do = S7d.indexOf('('), s7dc = S7d.lastIndexOf(')');
T.eq(E.matchBracket(S7d, s7do + 1), { open: s7do, close: s7dc },
     'matchBracket：字符串里多余的 "(" 不参与配对');
T.ok(JSON.stringify(naiveMatch(S7d, s7do + 1)) !== JSON.stringify(E.matchBracket(S7d, s7do + 1)),
     'matchBracket：字符串那条有区分度');

/* **已知边界：`${}` 内部的括号不参与配对。** 不是 bug，是"复用词法器"这个
   决定的直接后果 —— tokenize 把整条模板串切成**一个** tpl token
   （实测 `const s = \`a${ (1) }b\`;` 只产出 tpl[10,22] 一个 token），
   里面的括号压根不是 punct token，看不见。
   要让它可见就得在这里重新对模板串内部做一遍词法分析，那正是本模块开头
   写明不做的事（高亮与执行必须看同一份 token 流）。代价很小：模板串外面的
   括号照常配对，只有 `${ }` 里面的不亮。下面这条断言把这个边界钉住，
   免得它某天被"顺手修好"成一份与解释器分叉的第二套词法逻辑。 */
const S8 = 'const s = `a${ (1) }b`;';
T.eq(E.matchBracket(S8, at(S8, '(') + 1), null,
     'matchBracket：模板串内部的括号不参与配对（整条模板串是一个 token，已知边界）');
T.eq(E.matchBracket('f(`a${1}b`);', 1), { open: 1, close: 10 },
     'matchBracket：模板串**外面**的括号照常配对，模板串整体当一个 token 跳过');

// 配不上的：只有半边、或交叉
T.eq(E.matchBracket('const a = (1;', 10), null, 'matchBracket：没有闭括号时返回 null');
T.eq(E.matchBracket('a);', 1), null, 'matchBracket：没有开括号时返回 null');

/* 交叉必须报 null，不能"就近凑一个"：`(]` 亮在一起会教出错误的直觉。
   下标 0 的左括号在深度归零处遇到的是 `]`，不是 `)`。 */
T.eq(E.matchBracket('(]', 1), null, 'matchBracket：种类不匹配（交叉）返回 null，不就近凑合');

/* 词法器抛错（引号没闭合之类）时整体降级为 null —— 与 highlight() 的降级
   同一策略：打字打到一半源码几乎总是暂时不合法的，这时候不配对好过配错。 */
T.eq(E.matchBracket('const a = "unterminated (', 24), null, 'matchBracket：词法器抛错时降级为 null，不抛');
let mbThrew = false;
try { E.matchBracket('`unterminated ${ (', 17); } catch (e) { mbThrew = true; }
T.ok(!mbThrew, 'matchBracket：非法源码上不抛异常');

// 退化输入
T.eq(E.matchBracket('', 0), null, 'matchBracket：空源码返回 null');
T.eq(E.matchBracket('()', -5), null, 'matchBracket：负 caret 返回 null');
T.eq(E.matchBracket('()', 999), null, 'matchBracket：caret 远超长度返回 null');
T.eq(E.matchBracket('()', 1), { open: 0, close: 1 }, 'matchBracket：空括号对');

/* open 恒小于 close，与光标贴的是哪一头无关 —— 调用方画两个框，不关心
   是谁找到了谁。全语料扫一遍钉死这条。 */
const orderBad = [];
const CORPUS = ['f(g(h(1)));', 'const m = {a: [1, {b: (2)}]};', 'while ((a) && (b)) { c(); }'];
for (const src of CORPUS) {
  for (let k = 0; k <= src.length; k++) {
    const m = E.matchBracket(src, k);
    if (m && !(m.open < m.close)) orderBad.push([src, k, m]);
  }
}
T.eq(orderBad, [], 'matchBracket：open 恒小于 close（全语料全下标）');

/* 对称性：从开括号那一头查、和从它配对的闭括号那一头查，必须得到同一对。 */
const asymmetric = [];
for (const src of CORPUS) {
  for (let k = 0; k <= src.length; k++) {
    const m = E.matchBracket(src, k);
    if (!m) continue;
    const fromOpen = E.matchBracket(src, m.open + 1);
    const fromClose = E.matchBracket(src, m.close + 1);
    if (JSON.stringify(fromOpen) !== JSON.stringify(m) || JSON.stringify(fromClose) !== JSON.stringify(m)) {
      asymmetric.push([src, k, m, fromOpen, fromClose]);
    }
  }
}
T.eq(asymmetric, [], 'matchBracket：从两头查同一对括号得到同一个结果（对称）');

/* 配对结果指向的字符必须真的是括号 —— 这条挡的是「下标算偏了一位」，
   而偏一位正是这类实现最典型的坏法（高亮框套在旁边那个字符上）。 */
const PAIR = { '(': ')', '[': ']', '{': '}' };
const badChars = [];
for (const src of CORPUS) {
  for (let k = 0; k <= src.length; k++) {
    const m = E.matchBracket(src, k);
    if (!m) continue;
    if (PAIR[src[m.open]] !== src[m.close]) badChars.push([src, k, m, src[m.open], src[m.close]]);
  }
}
T.eq(badChars, [], 'matchBracket：返回的两个下标真的指向同种的一对括号（挡"偏一位"）');

/* PAD_X / LINE_H 是 CSS 与 JS 定位共用的两个常量，导出来是为了让"同一个数
   写两遍"变成不可能。它们必须是正数 —— 0 会让覆盖层整体贴死在左上角。 */
T.ok(E.PAD_X > 0, 'PAD_X 是正数（CSS padding 与覆盖层 left 共用的那一个）');
T.ok(E.LINE_H > 0, 'LINE_H 是正数');

/* 上面两条**只测得到"是正数"，测不到 CSS 字符串里写的是几**。CSS 里曾经躺着
   七个 18px 字面量：把它们改成 20px、常量留在 18，条纹/波浪线/括号框会顺着
   文件越往下偏得越多（第 40 行差 80px），而整套断言全绿。所以这里改成扫源码，
   直接钉住"跟行高有关的 CSS 值一个字面量都不留"这个结构事实。
   读 editor.js 自己的源码：测试跑在 node 里，读文件是允许的（interp.test.js
   的「4.5②(b)」同样这么做）；被读的 editor.js 本身仍然零依赖。 */
{
  const edSrc = fs.readFileSync(path.join(__dirname, 'editor.js'), 'utf8');
  const cssFrom = edSrc.indexOf('const CSS = [');
  const cssTo = edSrc.indexOf("].join('');", cssFrom);
  T.ok(cssFrom >= 0 && cssTo > cssFrom, 'LINE_H 单源：能定位到 editor.js 里的 CSS 数组');
  /* 先把块注释抹成等长空格再扫：注释里会成段谈论 18px / line-height，
     扫原文会把散文当成声明，变成一道"改注释就红"的假门。 */
  const cssText = edSrc.slice(cssFrom, cssTo).replace(/\/\*[\s\S]*?\*\//g, function (b) {
    return b.replace(/[^\n]/g, ' ');
  });
  T.eq(cssText.match(/line-height:\s*[\d.]/g), null,
       'LINE_H 单源：CSS 里没有任何写死数字的 line-height（必须从 LINE_H 插值）');
  T.eq(cssText.match(/font:\s*[\d.]+px\/\s*[\d.]/g), null,
       'LINE_H 单源：font 简写里的行高部分也没有写死数字（.ed-ln 的 11px/…）');
  /* 四条按行高定高的规则：height 必须是插值来的。（.ed-ta 的 height:100% 与
     滚动条的 height:8px 跟行高无关，不在这张名单上。） */
  const H_RULES = ['.ed-ln{', '.ed-stripe{', '.ed-squiggle{', '.ed-bracket{'];
  const hardHeights = [], missingInterp = [];
  for (let hr = 0; hr < H_RULES.length; hr++) {
    const at = cssText.indexOf(H_RULES[hr]);
    if (at < 0) { missingInterp.push(H_RULES[hr] + '（规则找不到了）'); continue; }
    const end = cssText.indexOf('}', at);
    const rule = cssText.slice(at, end < 0 ? cssText.length : end);
    if (/height:\s*[\d.]/.test(rule)) hardHeights.push(H_RULES[hr]);
    if (!/height:'\s*\+\s*LINE_H\s*\+\s*'px/.test(rule)) missingInterp.push(H_RULES[hr]);
  }
  T.eq(hardHeights, [], 'LINE_H 单源：按行高定高的四条规则里没有写死的 height');
  T.eq(missingInterp, [], 'LINE_H 单源：这四条规则的 height 确实是 LINE_H 插值出来的（有牙齿）');
}

/* check()：**解释器自己的 bug 不许被说成是学习者的语法错误。** 这个 try 罩着
   Interp.parse 的整个调用，parse 内部抛的 TypeError 也会落进来，而它没有
   line/col/category —— 照原样往下走会得到 index: NaN、category: undefined，
   以及 V8 自己的措辞被摆进编辑器的「语法错误」槽里。对一个正在学递归的人来说，
   一条她既看不懂也修不了的错误被说成是她写错了，她只会得出"我没看懂"的结论。
   猴子补丁的手法与上面 category 那一块相同（同一个 require 缓存出来的对象）。 */
{
  const realParseI = I.parse;
  let internalErr, thrownStrErr;
  try {
    I.parse = function () { throw new TypeError("Cannot read properties of undefined (reading 'type')"); };
    internalErr = E.check('let x = 1;');
    I.parse = function () { throw 'boom'; };          // 连 Error 都不是的抛出物
    thrownStrErr = E.check('let x = 1;');
  } finally {
    I.parse = realParseI;
  }
  T.ok(internalErr, 'check：解释器内部的 TypeError 仍然返回一个真值（Run 照旧被禁用，不假装能跑）');
  T.eq(internalErr.category, 'internal', 'check：内部错误的 category 是 internal，不是 undefined 冒充语法错');
  T.eq(internalErr.line, null, 'check：内部错误不指向任何一行（line 是 null）');
  T.eq(internalErr.col, null, 'check：内部错误的 col 是 null');
  T.eq(internalErr.index, null, 'check：内部错误的 index 是 null，不是 NaN（原来 starts[NaN] + NaN 就是 NaN）');
  T.eq(internalErr.message, "Cannot read properties of undefined (reading 'type')",
       'check：原始 message 原样透传，调用方才有话可说');
  T.eq(thrownStrErr.category, 'internal', 'check：抛的不是 Error 对象时也归 internal');
  T.eq(thrownStrErr.message, 'boom', 'check：抛的不是 Error 对象时，message 取 String(e)');
  /* 有牙齿：真正的解析错**没有**被这道门顺手改掉分类。 */
  const stillSyntax = E.check('let x = ;');
  T.eq(stillSyntax.category, 'syntax', '有牙齿：真正的语法错依旧是 syntax，没被新门改分类');
  T.eq(typeof stillSyntax.line, 'number', '有牙齿：真正的语法错依旧带数字行号');
  T.eq(typeof stillSyntax.index, 'number', '有牙齿：真正的语法错依旧带数字 index');
}

/* Interp 必须是**惰性**取的：内联脚本按标记块就地替换，不保证 INTERP 排在
   EDITOR 前面。工厂时就抓住 root.Interp 的写法会在那种页面上捕获 undefined，
   而症状要等使用者敲第一个键才出现。这里扫源码钉住这个结构事实：工厂参数
   不是 root.Interp 本身，而是一个取值函数。 */
{
  const edSrc2 = fs.readFileSync(path.join(__dirname, 'editor.js'), 'utf8');
  const umdEnd = edSrc2.indexOf("'use strict'");
  const umd = edSrc2.slice(0, umdEnd).replace(/\/\*[\s\S]*?\*\//g, function (b) {
    return b.replace(/[^\n]/g, ' ');
  });
  T.eq(umd.match(/factory\(\s*root\.Interp\s*\)/g), null,
       'Interp 惰性：工厂不能直接吃 root.Interp（内联块的先后顺序不受保证）');
  T.ok(/return\s+root\.Interp/.test(umd),
       'Interp 惰性：浏览器分支传进去的是一个「用到时才取 root.Interp」的函数');
}

/* DOM 层的导出在 node 下必须存在但**不执行**：整个文件是在没有 document 的
   环境里被 require 进来的，mount 只要在模块顶层碰一下 document 就会在这里炸。 */
T.eq(typeof E.mount, 'function', 'mount 被导出');
T.eq(typeof E.matchBracket, 'function', 'matchBracket 被导出');
T.ok(typeof document === 'undefined', '本套件确实跑在无 DOM 环境里（上面那条导出检查才有意义）');

}

T.report();
