'use strict';
const T = require('./_test.js');
const A = require('./cryptanalysis.js');
const caesar = require('./algos/caesar.js');

/* ---- 频率表本身 ---- */
T.eq(A.ENGLISH_FREQ.length, 26, 'ENGLISH_FREQ 有 26 项');
const sum = A.ENGLISH_FREQ.reduce(function (s, x) { return s + x; }, 0);
T.ok(Math.abs(sum - 1) < 1e-6, 'ENGLISH_FREQ 归一化到 1（实际 ' + sum + '）');
T.ok(A.ENGLISH_FREQ.every(function (x) { return x > 0; }), '每个字母频率都为正');
/* E 是英文里最常见的字母，T 次之——这条钉住表没有被抄错顺序。 */
const maxIdx = A.ENGLISH_FREQ.indexOf(Math.max.apply(null, A.ENGLISH_FREQ));
T.eq(maxIdx, 4, '最高频字母是 E（下标 4）');

/* ---- 计数与频率 ---- */
T.eq(A.letterCounts('aab')[0], 2, 'letterCounts 大小写不敏感：a 出现 2 次');
T.eq(A.letterCounts('aab')[1], 1, 'letterCounts：b 出现 1 次');
T.eq(A.letterCounts('!!!').reduce(function (s, x) { return s + x; }, 0), 0,
     'letterCounts 无字母时全 0');
T.eq(A.letterFrequency('aab')[0], 2 / 3, 'letterFrequency 归一化');
T.eq(A.letterFrequency('').reduce(function (s, x) { return s + x; }, 0), 0,
     'letterFrequency 空串全 0，不产生 NaN');

/* ---- χ² ----
   这两条**必须**用 T.ok + === 而不是 T.eq。T.eq 是 JSON.stringify 比对，
   而 JSON.stringify(Infinity)、JSON.stringify(NaN)、JSON.stringify(null)
   三者都是字符串 "null"——用 T.eq 写出来的 `eq(chiSquare(''), Infinity)`
   在实现返回 NaN 时**照样是绿的**，而返回 NaN 恰好会让 Array.sort 的比较
   全部为 false、把这个候选留在原地，第三页的高亮行就选错了。
   一条分不出 Infinity 与 NaN 的断言，守不住它唯一要守的那件事。

   （harness 后来给 serialize 加了 __nonfinite__ 前缀，T.eq 现在也能分辨
   这三者了；但这两条仍然写成 `=== Infinity`——它要钉的就是"恰好是
   Infinity"这一件事，不必绕道 serialize。） */
T.ok(A.chiSquare('') === Infinity, '无字母时 χ² 是 Infinity（永远排在最后）');
T.ok(A.chiSquare('!!! 123') === Infinity, '全非字母同上');
T.ok(!Number.isNaN(A.chiSquare('hello world')), '正常输入不产生 NaN');

/* 核心性质：一段真英文的 χ² 必须低于它自己的任何非零位移密文。
   这就是第三页"穷举"能自动挑出正确答案的全部依据；它若不成立，
   那一页的高亮行就是错的。 */
const PLAIN = 'The quick brown fox jumps over the lazy dog and then runs away ' +
              'into the deep forest where nobody ever finds him again';
const base = A.chiSquare(PLAIN);
for (let k = 1; k < 26; k++) {
  T.ok(base < A.chiSquare(caesar.encrypt(PLAIN, k)),
       '明文 χ²(' + base.toFixed(2) + ') 低于 k=' + k + ' 的密文');
}

/* 端到端：穷举 + χ² 排序必须把 k 选回来。 */
const CIPHER = caesar.encrypt(PLAIN, 7);
const best = A.bruteForceBest(caesar.bruteForce(CIPHER));
T.eq(best.k, 7, 'χ² 排序把 k=7 选了出来');
T.eq(best.text, PLAIN, '选出的候选就是原文');

T.report('cryptanalysis');
