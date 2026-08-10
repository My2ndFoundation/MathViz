'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const CA = require('../cryptanalysis.js');
const TR = require('./transposition.js');

/* ---- columnOrder：关键词诱导出的读出次序 ---- */
/* ZEBRAS：Z E B R A S → A(4) B(2) E(1) R(3) S(5) Z(0) */
T.eq(TR.columnOrder('ZEBRAS'), [4, 2, 1, 3, 5, 0], 'ZEBRAS 的读出次序');
T.eq(TR.columnOrder('zebras'), [4, 2, 1, 3, 5, 0], '关键词大小写不敏感');
T.eq(TR.columnOrder('Z E B-R A S'), [4, 2, 1, 3, 5, 0], '关键词里的非字母先被丢掉');
T.eq(TR.columnOrder('ABCDE'), [0, 1, 2, 3, 4], '已排序的关键词给出恒等排列');
T.eq(TR.columnOrder('A'), [0], '单字母关键词只有一列');

/* 重复字母：并列的按左到右分先后。朴素实现（比如用 indexOf 去查名次）
   会让三个 A 全拿到同一个名次，于是排列不再是双射，解密静静地错位。 */
T.eq(TR.columnOrder('BANANA'), [1, 3, 5, 0, 2, 4], 'BANANA：三个 A 按出现次序排在最前');
T.eq(TR.columnOrder('AAAA'), [0, 1, 2, 3], '全同字母 → 完全按出现次序，即恒等排列');
T.eq(TR.columnOrder('CACAO'), [1, 3, 0, 2, 4], 'CACAO：两个 A 在前、两个 C 次之、O 最后');
/* 排列必须是双射：把它排序回去应当正好得到 0..n−1，一个不多一个不少。
   这条对上面每一个具体值都是冗余的，但它是**性质**，以后换实现仍然成立。 */
['BANANA', 'AAAA', 'ZEBRAS', 'CACAO', 'MEGABUCK', 'TOMATO'].forEach(function (kw) {
  const o = TR.columnOrder(kw);
  const sorted = o.slice().sort(function (a, b) { return a - b; });
  const ident = [];
  for (let i = 0; i < o.length; i++) ident.push(i);
  T.eq(sorted, ident, 'columnOrder("' + kw + '") 是 0..n−1 的一个排列');
});

T.throws(function () { TR.columnOrder(''); }, '空关键词当场抛', /至少要有一个字母/);
T.throws(function () { TR.columnOrder('123 !'); }, '规范化后为空的关键词也抛', /至少要有一个字母/);

/* ---- 教科书向量（不完整列换位，无填充）---- */
const WE = 'WEAREDISCOVEREDFLEEATONCE';        // 25 个字母，6 列时最后一行只有 1 格
T.eq(TR.columnarEncrypt(WE, 'ZEBRAS'), 'EVLNACDTESEAROFODEECWIREE',
     'ZEBRAS 的教科书向量（列长 5,4,4,4,4,4）');
T.eq(TR.columnarDecrypt('EVLNACDTESEAROFODEECWIREE', 'ZEBRAS'), WE, '同一向量解回原文');
T.eq(TR.columnarEncrypt(WE, 'ZEBRAS').length, WE.length, '不填充：密文与明文等长');

/* 一列 = 恒等：整段原文就是唯一那一列，竖着读回来还是它自己。 */
T.eq(TR.columnarEncrypt(WE, 'A'), WE, '一列的列换位是恒等');

/* 关键词已排序时排列是恒等，但换位**不是**恒等——列仍然要竖着读。
   这条断言把"恒等排列"与"恒等换位"这两件常被混为一谈的事分开。 */
T.eq(TR.columnarEncrypt('ABCDEFGH', 'ABCD'), 'AEBFCGDH',
     '恒等排列 ≠ 恒等换位：4 列仍然是竖着读出来的');

/* ---- 栅栏的教科书向量 ---- */
T.eq(TR.railFenceEncrypt(WE, 3), 'WECRLTEERDSOEEFEAOCAIVDEN', '3 条栅栏的教科书向量');
T.eq(TR.railFenceDecrypt('WECRLTEERDSOEEFEAOCAIVDEN', 3), WE, '同一向量解回原文');
T.eq(TR.railPattern(11, 3), [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2], '3 条栅栏的锯齿周期是 4');
T.eq(TR.railPattern(9, 4), [0, 1, 2, 3, 2, 1, 0, 1, 2], '4 条栅栏的锯齿周期是 6');
T.eq(TR.railPattern(0, 5), [], '空文本的锯齿是空数组');

/* ---- 非字母与填充政策 ---- */
/* 与 caesar.js 相反：这里先规范化成纯字母。列宽与锯齿都定义在位置上，
   留着空格等于宣称空格也占一格、也参与换位。 */
T.eq(TR.columnarEncrypt('Attack at dawn!', 'KEY'),
     TR.columnarEncrypt('ATTACKATDAWN', 'KEY'), '列换位：标点与空格在加密前就被丢掉');
T.eq(TR.railFenceEncrypt('Attack at dawn!', 3),
     TR.railFenceEncrypt('ATTACKATDAWN', 3), '栅栏：同一条政策');
T.eq(TR.columnarEncrypt('中文 abc 123', 'KEY'), TR.columnarEncrypt('ABC', 'KEY'),
     '非 ASCII 与数字同样被丢掉');
T.eq(TR.columnarDecrypt(TR.columnarEncrypt('Attack at dawn!', 'KEY'), 'KEY'), 'ATTACKATDAWN',
     '往返承诺是 decrypt(encrypt(p)) === normalize(p)，不是 === p');
/* 密文里不许出现填充字母：长度必须逐字节等于明文的字母数。
   补一个 'X' 不会让任何往返断言变红（解密时可以把它切掉），但会让第三页
   "两条频率剖面逐项相等"这句话当场失效——所以这条断言守的是那一页。 */
['KEY', 'ZEBRAS', 'BANANA', 'CRYPTO'].forEach(function (kw) {
  T.eq(TR.columnarEncrypt(WE, kw).length, WE.length, '列换位不填充（' + kw + '）');
});

/* ---- 往返：一批关键词，含重复字母、含比明文还长的 ---- */
const SAMPLE = C.normalize('The quick brown fox jumps over the lazy dog, 13 times!');
const KEYWORDS = ['A', 'KEY', 'ZEBRAS', 'BANANA', 'AAAA', 'CACAO', 'MEGABUCK',
                  'TOMATO', 'CRYPTOGRAPHY', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
KEYWORDS.forEach(function (kw) {
  T.eq(TR.columnarDecrypt(TR.columnarEncrypt(SAMPLE, kw), kw), SAMPLE,
       'columnar 往返（' + kw + '）');
  T.eq(TR.columnarDecrypt(TR.columnarEncrypt(WE, kw), kw), WE,
       'columnar 往返，25 字母的不完整网格（' + kw + '）');
  /* 长度不是列数整数倍时列长不等；按等长切会从第二列起整体错位，而错位的
     结果仍然是一串合法字母，不会抛错。所以这条要对**每种余数**都试一遍。 */
  for (let cut = 1; cut <= 12; cut++) {
    const p = SAMPLE.slice(0, cut);
    T.eq(TR.columnarDecrypt(TR.columnarEncrypt(p, kw), kw), p,
         'columnar 往返，长度 ' + cut + '（' + kw + '）');
  }
});

/* ---- 往返：栅栏 2..8 ---- */
for (let r = 2; r <= 8; r++) {
  T.eq(TR.railFenceDecrypt(TR.railFenceEncrypt(SAMPLE, r), r), SAMPLE,
       'rail 往返（rails=' + r + '）');
  T.eq(TR.railFenceEncrypt(SAMPLE, r).length, SAMPLE.length,
       'rail 不填充（rails=' + r + '）');
  for (let cut = 1; cut <= 12; cut++) {
    const p = SAMPLE.slice(0, cut);
    T.eq(TR.railFenceDecrypt(TR.railFenceEncrypt(p, r), r), p,
         'rail 往返，长度 ' + cut + '（rails=' + r + '）');
  }
}

/* ---- 两处退化：rails = 1，以及 rails >= 文本长度 ---- */
T.eq(TR.railPattern(6, 1), [0, 0, 0, 0, 0, 0], 'rails=1：所有字母都在第 0 行');
T.eq(TR.railFenceEncrypt(SAMPLE, 1), SAMPLE, 'rails=1 是恒等（一条栅栏无处可折）');
T.eq(TR.railFenceDecrypt(SAMPLE, 1), SAMPLE, 'rails=1 解密同样是恒等');
/* rails >= len：锯齿一路往下走，还没折返就没字母了，于是第 i 个字母在第 i 行，
   一行一行读出来正好是原序。len 与 len+1 两个边界都要钉——恰好等于长度时
   最后一个位置就在折返点上，是最容易差一格的地方。 */
T.eq(TR.railPattern(5, 5), [0, 1, 2, 3, 4], 'rails 恰等于长度：锯齿还没折返');
T.eq(TR.railFenceEncrypt('ABCDE', 5), 'ABCDE', 'rails 恰等于长度是恒等');
T.eq(TR.railFenceEncrypt('ABCDE', 9), 'ABCDE', 'rails 大于长度同样是恒等');
T.eq(TR.railFenceEncrypt('', 4), '', '空文本进空文本出');
T.throws(function () { TR.railPattern(5, 0); }, 'rails=0 当场抛', /栅栏数至少是 1/);
T.throws(function () { TR.railFenceEncrypt('ABC', 0); }, '加密也走同一道守卫', /栅栏数至少是 1/);

/* ================= 本工具的中心论点 =================
   换位改变的是**位置**，不是**字母**。所以明文与密文的字母计数必须
   **逐项相等**——不是相近，是同一个 26 元组。第三页整页画的就是这件事；
   这条断言一旦红了，说明工具讲的道理是错的，不是测试写错了。 */
function assertSameCounts(plain, cipher, label) {
  T.eq(CA.letterCounts(cipher), CA.letterCounts(plain), label);
}
const THESIS_TEXTS = [SAMPLE, WE, C.normalize('ATTACK AT DAWN'),
                      C.normalize('the quick brown fox jumps over the lazy dog')];
THESIS_TEXTS.forEach(function (p, ti) {
  KEYWORDS.forEach(function (kw) {
    assertSameCounts(p, TR.columnarEncrypt(p, kw),
                     '列换位保持字母计数（文本 ' + ti + ' / ' + kw + '）');
  });
  for (let r = 1; r <= 8; r++) {
    assertSameCounts(p, TR.railFenceEncrypt(p, r),
                     '栅栏保持字母计数（文本 ' + ti + ' / rails=' + r + '）');
  }
});
/* 反证：一次代换（Caesar 那种 +1）**会**改变字母计数。没有这一条，
   上面那一批断言只证明了"我们的函数没把字母弄丢"，证不出"这是换位独有的性质"。 */
const shifted = C.fromIndices(C.letters(WE).map(function (x) { return C.mod(x + 1, C.N); }));
T.eq(shifted.length, WE.length, '对照组：代换同样不改变长度');
T.ok(JSON.stringify(CA.letterCounts(shifted)) !== JSON.stringify(CA.letterCounts(WE)),
     '对照组：代换**改变**了字母计数——这正是频率分析能打穿代换的原因');

T.report('transposition');
