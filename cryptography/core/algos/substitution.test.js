'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const CA = require('../cryptanalysis.js');
const caesar = require('./caesar.js');
const sub = require('./substitution.js');

const ZEBRA = 'ZEBRACDFGHIJKLMNOPQSTUVWXY';

/* 确定性 LCG。randomKey 不许碰 Math.random，所以这里注入一个自己的——
   洗牌最容易错的两处（下标范围、消费 rng 的顺序）只有确定性向量能钉住，
   "多跑几次看着挺随机"钉不住任何东西。
   Math.imul 不是装饰：换成普通乘法会得到另一条序列，下面那两条向量就对不上了。 */
function lcg(seed) {
  let s = seed >>> 0;
  return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/* ---- keyFromKeyword ---- */
T.eq(sub.keyFromKeyword('ZEBRA'), ZEBRA, '关键词去重在前、余下字母按序补齐');
T.eq(sub.keyFromKeyword(''), C.ALPHABET, '空关键词给出恒等密钥');
T.eq(sub.keyFromKeyword('Hello, World!'), 'HELOWRDABCFGIJKMNPQSTUVXYZ',
     '大小写与标点先被 normalize 掉，重复字母只留第一次');
T.eq(sub.keyFromKeyword('中文 123'), C.ALPHABET, '一个字母都没有时退回恒等密钥');
T.eq(sub.keyFromKeyword('aabbcc'), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '重复关键词不会挤掉后面的字母');
/* 这条等式是工具页那个"关键词框也能直接粘一整把密钥"的输入框成立的全部依据：
   对一个已经合法的密钥，keyFromKeyword 是恒等，两种解释永远不会打架。 */
T.eq(sub.keyFromKeyword(ZEBRA), ZEBRA, 'keyFromKeyword 对一个合法密钥是恒等');
for (const w of ['', 'ZEBRA', 'the quick brown fox', '中文', 'AAAA', 'QWERTYUIOPASDFGHJKLZXCVBNM']) {
  T.ok(sub.isValidKey(sub.keyFromKeyword(w)), 'keyFromKeyword(' + JSON.stringify(w) + ') 是合法密钥');
}

/* ---- isValidKey ---- */
T.eq(sub.isValidKey(C.ALPHABET), true, '恒等排列合法');
T.eq(sub.isValidKey(ZEBRA), true, '关键词密钥合法');
T.eq(sub.isValidKey('AAAAAAAAAAAAAAAAAAAAAAAAAA'), false,
     '26 个全 A：长度对、全是字母，但不是排列——它没有逆');
T.eq(sub.isValidKey('ABCDEFGHIJKLMNOPQRSTUVWXY'), false, '25 个字母太短');
T.eq(sub.isValidKey(C.ALPHABET + 'A'), false, '27 个字母太长');
T.eq(sub.isValidKey('zebracdfghijklmnopqstuvwxy'), false, '小写不认——调用方先 normalize');
T.eq(sub.isValidKey('ABCDEFGHIJKLMNOPQRSTUVWXY '), false, '空格不是字母');
T.eq(sub.isValidKey('ABCDEFGHIJKLMNOPQRSTUVWXY中'), false, '非 ASCII 不是字母');
T.eq(sub.isValidKey(null), false, 'null 不是字符串');
T.eq(sub.isValidKey(undefined), false, 'undefined 不是字符串');
T.eq(sub.isValidKey(123), false, '数字不是字符串');

/* ---- encrypt / decrypt ---- */
T.eq(sub.encrypt('ATTACK AT DAWN', ZEBRA), 'ZSSZBI ZS RZVL', 'ZEBRA 密钥的教科书向量');
T.eq(sub.decrypt('ZSSZBI ZS RZVL', ZEBRA), 'ATTACK AT DAWN', '同一密钥解密回原文');
T.eq(sub.encrypt('Hello, World!', ZEBRA), 'Fajjm, Vmpjr!', '保留大小写与标点');
T.eq(sub.encrypt('中文 123', ZEBRA), '中文 123', '非 ASCII 与数字原样穿过');
T.eq(sub.encrypt('', ZEBRA), '', '空串加密还是空串');
T.eq(sub.encrypt('ABC', C.ALPHABET), 'ABC', '恒等密钥什么也不改');
T.eq(sub.decrypt('ABC', C.ALPHABET), 'ABC', '恒等密钥的逆还是恒等');

/* ---- 凯撒是单表代换的一个特例 ----
   26 个凯撒密钥全都躺在这 26! 个密钥里。工具页第一页"把密钥换成凯撒 3，
   26 条连线一起变成平行线"讲的就是这件事，这里把它钉成断言。 */
const SAMPLE = 'The Quick Brown Fox Jumps Over 13 Lazy Dogs! —— 中文';
for (let k = 0; k < 26; k++) {
  const kk = caesar.encrypt(C.ALPHABET, k);
  T.ok(sub.isValidKey(kk), '凯撒 k=' + k + ' 的字母表是一个合法代换密钥');
  T.eq(sub.encrypt(SAMPLE, kk), caesar.encrypt(SAMPLE, k),
       '代换(密钥=转 ' + k + ' 位的字母表) 与 凯撒(' + k + ') 逐字节相同');
}

/* ---- invertKey ---- */
T.eq(sub.invertKey(C.ALPHABET), C.ALPHABET, '恒等密钥自己是自己的逆');
T.eq(sub.invertKey(ZEBRA), 'ECFGBHIJKLMNOPQRSDTUVWXYZA', 'ZEBRA 的逆');
T.eq(sub.invertKey(sub.invertKey(ZEBRA)), ZEBRA, '逆的逆是自己');
T.eq(sub.decrypt(SAMPLE, ZEBRA), sub.encrypt(SAMPLE, sub.invertKey(ZEBRA)),
     'decrypt(x,k) 就是 encrypt(x, invertKey(k))');

/* ---- 性质：任取密钥往返 ---- */
for (let seed = 1; seed <= 40; seed++) {
  const key = sub.randomKey(lcg(seed));
  T.eq(sub.decrypt(sub.encrypt(SAMPLE, key), key), SAMPLE,
       'seed=' + seed + '：decrypt(encrypt(p,key),key) === p');
  T.eq(sub.invertKey(sub.invertKey(key)), key, 'seed=' + seed + '：逆的逆是自己');
}

/* ---- randomKey ---- */
T.eq(sub.randomKey(lcg(1)), 'UYOTRVDFLNXCWIZESAKPHBQMJG',
     '同一个 rng 序列给出同一把密钥（钉住下标范围与消费顺序）');
T.eq(sub.randomKey(lcg(1)), sub.randomKey(lcg(1)), '同种子两次调用结果相同');
T.eq(sub.randomKey(lcg(7)), 'JUEANCFKDLIMXZTPQSYHRBVOWG', '另一个种子给出另一把密钥');
T.ok(sub.randomKey(lcg(1)) !== sub.randomKey(lcg(7)), '不同种子不该给出同一把密钥');
/* 三个病态 rng。它们要么本来就不该出现（NaN），要么正好踩在半开区间的
   右端点（1）——两者都会让未夹下标的 Fisher–Yates 交换到数组外面去，
   产出一把带 undefined 的"密钥"：不抛错、看着像字符串、已经不是排列。 */
T.eq(sub.randomKey(function () { return 0; }), 'BCDEFGHIJKLMNOPQRSTUVWXYZA',
     'rng 恒为 0：每次都与首位交换，结果仍是排列');
T.eq(sub.randomKey(function () { return 1; }), C.ALPHABET,
     'rng 恒为 1（半开区间的右端点，本不该出现）被夹回 j=i，退化成恒等');
T.ok(sub.isValidKey(sub.randomKey(function () { return NaN; })),
     'rng 返回 NaN 也必须给出合法密钥，而不是一把带 undefined 的字符串');
for (let seed = 1; seed <= 200; seed++) {
  T.ok(sub.isValidKey(sub.randomKey(lcg(seed))), 'seed=' + seed + '：randomKey 恒为合法密钥');
}

/* ---- 非法密钥当场抛 ---- */
T.throws(function () { sub.encrypt('ABC', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'); },
         'encrypt 拒绝非排列密钥', /26 字母排列/);
T.throws(function () { sub.encrypt('ABC', 'ABC'); },
         'encrypt 拒绝长度不对的密钥', /26 字母排列/);
T.throws(function () { sub.decrypt('ABC', 'abcdefghijklmnopqrstuvwxyz'); },
         'decrypt 拒绝小写密钥', /26 字母排列/);
T.throws(function () { sub.invertKey('nope'); },
         'invertKey 拒绝非法密钥', /26 字母排列/);
T.throws(function () { sub.randomKey(); },
         'randomKey 必须注入 rng，不许退回 Math.random', /randomKey 需要一个返回/);
T.throws(function () { sub.randomKey(0.5); },
         'randomKey 的参数必须是函数而不是一个数', /randomKey 需要一个返回/);

/* ---- 工具页第二页那句话的执法者 ----
   "代换只换标签，不换次数"：明文与密文的字母计数按大小排序之后必须逐项相同。
   这不是画面上的比喻，是这一页整块顿悟视角的前提；它一旦不成立，那两排柱子
   排完序也不会重合，而没有任何别的东西会报警。 */
function sortedCounts(text) {
  return CA.letterCounts(text).slice().sort(function (a, b) { return b - a; });
}
for (let seed = 1; seed <= 20; seed++) {
  const key = sub.randomKey(lcg(seed));
  const cipher = sub.encrypt(SAMPLE, key);
  T.eq(sortedCounts(cipher), sortedCounts(SAMPLE),
       'seed=' + seed + '：密文与明文的字母计数是同一个多重集，只是换了标签');
  T.eq(CA.letterCounts(cipher).reduce(function (s, x) { return s + x; }, 0),
       CA.letterCounts(SAMPLE).reduce(function (s, x) { return s + x; }, 0),
       'seed=' + seed + '：字母总数不变');
}
/* 反过来钉一句：密文的**未排序**分布一般与明文不同——否则上面那条断言可以
   靠"代换根本没起作用"蒙混过关。 */
T.ok(String(CA.letterCounts(sub.encrypt(SAMPLE, ZEBRA))) !== String(CA.letterCounts(SAMPLE)),
     '未排序的分布确实被打乱了（否则上一条断言可以被恒等密钥蒙混）');

T.report('substitution');
