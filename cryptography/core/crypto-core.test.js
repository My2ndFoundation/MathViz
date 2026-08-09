'use strict';
const T = require('./_test.js');
const C = require('./crypto-core.js');

/* ---- 字母表与归一化 ---- */
T.eq(C.ALPHABET.length, 26, 'ALPHABET 有 26 个字母');
T.eq(C.N, 26, 'N === 26');
T.eq(C.normalize('Hello, World!'), 'HELLOWORLD', 'normalize 去掉标点与空格并大写');
T.eq(C.normalize(''), '', 'normalize 空串');
T.eq(C.normalize('123 —— ！'), '', 'normalize 全非字母 -> 空串');
T.eq(C.normalize('Héllo'), 'HLLO', 'normalize 丢弃非 ASCII 字母（é 不在 A-Z）');
T.ok(C.isAlpha('a') && C.isAlpha('Z'), 'isAlpha 认大小写字母');
T.ok(!C.isAlpha('1') && !C.isAlpha(' ') && !C.isAlpha('é'), 'isAlpha 拒非字母');

T.eq(C.letters('abc'), [0, 1, 2], 'letters 小写映射到 0..2');
T.eq(C.letters('XYZ'), [23, 24, 25], 'letters 大写映射到 23..25');
T.eq(C.letters('a b!c'), [0, 1, 2], 'letters 跳过非字母');
T.eq(C.fromIndices([0, 1, 25]), 'ABZ', 'fromIndices 还原');
T.eq(C.fromIndices([]), '', 'fromIndices 空数组');
/* 往返：这条比单向映射更值钱——它钉住 letters 与 fromIndices 用的是同一张表。 */
T.eq(C.fromIndices(C.letters('The Quick Brown Fox')), 'THEQUICKBROWNFOX',
     'letters/fromIndices 往返');

/* ---- 模运算 ---- */
T.eq(C.mod(5, 26), 5, 'mod 正数');
T.eq(C.mod(-1, 26), 25, 'mod 负数回到正区间（JS 的 % 在这里是 -1）');
T.eq(C.mod(-27, 26), 25, 'mod 负数跨多圈');
T.eq(C.mod(26, 26), 0, 'mod 整周为 0');
T.eq(C.mod(0, 26), 0, 'mod 零');

T.eq(C.gcd(12, 18), 6, 'gcd(12,18)');
T.eq(C.gcd(7, 26), 1, 'gcd(7,26) 互素');
T.eq(C.gcd(0, 5), 5, 'gcd(0,5)');
T.eq(C.gcd(-12, 18), 6, 'gcd 对负数取非负结果');

/* egcd 的贝祖等式对每一对都必须成立，比抽查一两个具体值更有力。 */
[[7, 26], [12, 18], [1, 1], [0, 5], [26, 7]].forEach(function (p) {
  const r = C.egcd(p[0], p[1]);
  T.eq(r[0], C.gcd(p[0], p[1]), 'egcd 首项等于 gcd：' + p);
  T.eq(p[0] * r[1] + p[1] * r[2], r[0], '贝祖等式 a*x+b*y=g：' + p);
});

/* modInverse：对 26 而言恰好有 12 个可逆元（与 26 互素的数）。 */
let invertible = 0;
for (let a = 0; a < 26; a++) {
  const inv = C.modInverse(a, 26);
  if (inv === null) { T.ok(C.gcd(a, 26) !== 1, 'modInverse 返回 null 时必不互素：a=' + a); continue; }
  invertible++;
  T.eq(C.mod(a * inv, 26), 1, 'a * a⁻¹ ≡ 1 (mod 26)：a=' + a);
  T.ok(inv >= 0 && inv < 26, 'modInverse 结果落在 [0,26)：a=' + a);
}
T.eq(invertible, 12, '模 26 恰有 12 个可逆元');

T.throws(function () { C.mod(5, 0); }, 'mod 的模数为 0 要抛', /模数/);
/* 负模数：((a%n)+n)%n 在 n<0 时给出负结果（mod(5,-3) 是 -1），与 mod 对外
   承诺的"结果恒 >= 0"直接矛盾。今天没有调用方传负模数——正因为如此，现在
   钉住这条才是免费的；等到有人传了再发现，代价是一路负下标查到 charAt(-1)。 */
T.throws(function () { C.mod(5, -3); }, 'mod 的模数为负要抛', /模数/);
T.throws(function () { C.mod(-5, -3); }, 'mod 负被除数配负模数也要抛', /模数/);

/* ---- harness 自身：eq 必须分得清非有限数 ----
   这三条守的不是 crypto-core，是 _test.js 的 serialize。JSON.stringify 把
   Infinity / -Infinity / NaN / null 一律写成 "null"，裸用会让
   eq(NaN, Infinity) 变成绿的——而 cryptanalysis 的 chiSquare 正是靠
   "空输入返回 Infinity、且永远不是 NaN" 来保证穷举排序的方向。
   harness 的失明没有别的文件会替它体检，所以体检写在这里。 */
T.eq([Infinity, -Infinity, NaN], [Infinity, -Infinity, NaN],
     'eq 判定三个非有限数相等（嵌套在数组里，顶层写法会漏掉这种）');
/* 用 wouldPass 而不是 eq 来验"eq 判不等"——直接调 eq 会把一条真失败推进
   failures，整个文件当场变红。裸 JSON.stringify 时下面三条全是 true。 */
T.ok(!T.wouldPass(NaN, Infinity), 'eq 区分 NaN 与 Infinity');
T.ok(!T.wouldPass(Infinity, -Infinity), 'eq 区分 Infinity 与 -Infinity');
T.ok(!T.wouldPass(Infinity, null), 'eq 区分 Infinity 与 null');
T.ok(!T.wouldPass([Infinity], [NaN]), 'eq 区分嵌套的 Infinity 与 NaN');
T.ok(T.wouldPass(0.5, 0.5) && !T.wouldPass(0.5, 0.6), 'wouldPass 对有限数仍然正常');

T.report('crypto-core');
