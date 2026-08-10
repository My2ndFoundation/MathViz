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

/* ================= ℤ/nℤ 上的矩阵（Hill） ================= */

const I2 = [[1, 0], [0, 1]];
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/* ---- 教科书向量：HELP → HIAT，M = [[3,3],[2,5]] ----
   这一条把 matMulVec 的下标约定钉死：M 行主序、v 是**列**向量、c = M·v。
   行列反过来写在对称矩阵上测不出来，而这个矩阵不对称，正好露馅。 */
const HILL2 = [[3, 3], [2, 5]];
const hp = C.letters('HELP');
T.eq(C.fromIndices(C.matMulVec(HILL2, [hp[0], hp[1]], 26)), 'HI', 'Hill 2×2：HE → HI');
T.eq(C.fromIndices(C.matMulVec(HILL2, [hp[2], hp[3]], 26)), 'AT', 'Hill 2×2：LP → AT');

T.eq(C.matDet(HILL2, 26), 9, 'det [[3,3],[2,5]] = 15−6 = 9');
T.eq(C.matInverse(HILL2, 26), [[15, 17], [20, 9]], '[[3,3],[2,5]] 模 26 的逆');
T.eq(C.matMul(HILL2, C.matInverse(HILL2, 26), 26), I2, 'M·M⁻¹ = I（2×2）');
T.eq(C.matMul(C.matInverse(HILL2, 26), HILL2, 26), I2, 'M⁻¹·M = I（2×2，左右都要验）');
T.ok(C.matIsInvertible(HILL2, 26), 'matIsInvertible 认可 [[3,3],[2,5]]');

/* 解密往返：密文向量乘回 M⁻¹ 必须还原明文。 */
T.eq(C.matMulVec(C.matInverse(HILL2, 26), C.matMulVec(HILL2, [hp[0], hp[1]], 26), 26),
     [hp[0], hp[1]], 'Hill 2×2 加解密往返');

/* ---- 3×3 教科书矩阵 ---- */
const HILL3 = [[6, 24, 1], [13, 16, 10], [20, 17, 15]];
T.eq(C.matDet(HILL3, 26), 25, 'det 的 441 规约到 25');
T.eq(C.matInverse(HILL3, 26), [[8, 5, 10], [21, 8, 21], [21, 12, 8]], '3×3 模 26 的逆');
T.eq(C.matMul(HILL3, C.matInverse(HILL3, 26), 26), I3, 'M·M⁻¹ = I（3×3）');
T.eq(C.matMul(C.matInverse(HILL3, 26), HILL3, 26), I3, 'M⁻¹·M = I（3×3）');

/* ---- 伴随矩阵那次转置：只有非对称矩阵才验得出来 ----
   把 adj[i][j] 写成 C_ij（漏掉转置）时，下面这个上三角矩阵的逆会变成
   [[1,0],[8,9]]，而它乘回去不是单位阵。对称矩阵上两种写法结果相同，
   所以这条断言必须用非对称的。 */
const ASYM = [[1, 2], [0, 3]];
T.eq(C.matInverse(ASYM, 26), [[1, 8], [0, 9]], '非对称矩阵的逆（钉住伴随矩阵的转置）');
T.eq(C.matMul(ASYM, C.matInverse(ASYM, 26), 26), I2, '非对称矩阵 M·M⁻¹ = I');

/* ---- 不可逆：实数上可逆 ≠ 模 26 可逆 ----
   det = 13 的矩阵在实数上完全可逆，模 26 却是死的（gcd(13,26) = 13）。
   Hill 那一页要讲的就是这句话，所以它得是一条断言而不是一句注释。 */
T.eq(C.matDet([[13, 0], [0, 1]], 26), 13, 'det = 13');
T.eq(C.matInverse([[13, 0], [0, 1]], 26), null, 'det = 13 时模 26 不可逆（实数上可逆）');
T.ok(!C.matIsInvertible([[13, 0], [0, 1]], 26), 'matIsInvertible 否决 det = 13');
T.eq(C.matInverse([[1, 2], [3, 4]], 26), null, 'det = −2 ≡ 24，gcd(24,26) = 2，不可逆');
T.eq(C.matInverse([[2, 4], [6, 8]], 26), null, 'det = −8 ≡ 18，gcd(18,26) = 2，不可逆');
T.eq(C.matInverse([[0, 0], [0, 0]], 26), null, '零矩阵不可逆');

/* ---- k = 1：退化但合法，就是乘法密码 ---- */
T.eq(C.matDet([[7]], 26), 7, '1×1 的行列式就是它自己');
T.eq(C.matInverse([[7]], 26), [[15]], '1×1 的逆就是模逆（7·15 = 105 ≡ 1）');
T.eq(C.matMul([[7]], [[15]], 26), [[1]], '1×1 往返');
T.eq(C.matInverse([[13]], 26), null, '1×1 不互素时同样返回 null');

/* ---- 大元素不许溢出 ----
   先规约再相乘，中间量恒小于 n²。不规约的话 1e10 级别的元素相乘就越过 2^53，
   得到的是一个"看起来是整数"的错值，而且不报错。 */
T.eq(C.matDet([[10000000003, 3], [2, 5]], 26), C.matDet([[C.mod(10000000003, 26), 3], [2, 5]], 26),
     '大元素先规约，结果与手工规约一致');

/* ---- 矩阵乘法：非方阵也要收 ---- */
T.eq(C.matMul([[1, 2, 3], [4, 5, 6]], [[1, 0], [0, 1], [1, 1]], 26),
     [[4, 5], [10, 11]], 'matMul 支持 2×3 乘 3×2');
T.eq(C.matMul([[25, 25]], [[25], [25]], 26), [[2]], 'matMul 逐步取模：625+625 = 1250 ≡ 2');

/* ---- 穷举 2×2 mod 26 ----
   这一段是整节的支点。三件事一次钉住：
     · matInverse 返回 null **当且仅当** gcd(det, 26) ≠ 1；
     · 非 null 时左乘右乘都得到单位阵；
     · 可逆矩阵的个数恰好是 |GL₂(ℤ/26ℤ)|。
   最后那个数不是实测出来再抄回去的，是先由群论算出来的：26 = 2·13，由中国剩余
   定理 GL₂(ℤ/26) ≅ GL₂(F₂) × GL₂(F₁₃)，
     |GL₂(F₂)|  = (4−1)(4−2)     = 6
     |GL₂(F₁₃)| = (169−1)(169−13) = 168·156 = 26208
     6 × 26208 = 157248
   一个由独立理论定死的期望值，比任何"跑一遍看看输出多少"的回归基线都值钱：
   实现整体偏移时，回归基线会跟着偏移，这个数不会。 */
let inv2 = 0, nullMismatch2 = 0, roundTrip2 = 0;
for (let a = 0; a < 26; a++) {
  for (let b = 0; b < 26; b++) {
    for (let c = 0; c < 26; c++) {
      for (let d = 0; d < 26; d++) {
        const M = [[a, b], [c, d]];
        const coprime = C.gcd(C.matDet(M, 26), 26) === 1;
        const Mi = C.matInverse(M, 26);
        if ((Mi !== null) !== coprime) nullMismatch2++;
        if (Mi === null) continue;
        inv2++;
        if (JSON.stringify(C.matMul(M, Mi, 26)) !== JSON.stringify(I2) ||
            JSON.stringify(C.matMul(Mi, M, 26)) !== JSON.stringify(I2)) roundTrip2++;
      }
    }
  }
}
T.eq(nullMismatch2, 0, 'matInverse 返回 null 当且仅当 gcd(det,26) ≠ 1（穷举 26⁴ 个 2×2）');
T.eq(roundTrip2, 0, '每个可逆 2×2 都满足 M·M⁻¹ = M⁻¹·M = I');
T.eq(inv2, 157248, '模 26 可逆的 2×2 恰有 |GL₂(ℤ/26ℤ)| = 6 × 26208 = 157248 个');

/* ---- 3×3 与 4×4：确定性抽样 ----
   26⁹ 穷举不可能，改用固定种子的 LCG 抽样——**不用 Math.random()**：
   一个随机的门今天绿明天红，最后必然被人加上 retry 或者干脆删掉。
   种子写死，这一段每次跑的是同一批矩阵，失败可以原样复现。 */
function lcg(seed) {
  let s = seed >>> 0;
  /* 取高位（除以 2³²）而不是低位取模：LCG 的低位周期极短，
     `s % 26` 会给出肉眼可见的规律。 */
  return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

[[3, 20000], [4, 4000]].forEach(function (cfg) {
  const k = cfg[0], iterations = cfg[1];
  const Ik = [];
  for (let i = 0; i < k; i++) {
    const row = [];
    for (let j = 0; j < k; j++) row.push(i === j ? 1 : 0);
    Ik.push(row);
  }
  const rnd = lcg(20260810 + k);
  let inv = 0, mism = 0, bad = 0;
  for (let it = 0; it < iterations; it++) {
    const M = [];
    for (let i = 0; i < k; i++) {
      const row = [];
      for (let j = 0; j < k; j++) row.push(Math.floor(rnd() * 26));
      M.push(row);
    }
    const coprime = C.gcd(C.matDet(M, 26), 26) === 1;
    const Mi = C.matInverse(M, 26);
    if ((Mi !== null) !== coprime) mism++;
    if (Mi === null) continue;
    inv++;
    if (JSON.stringify(C.matMul(M, Mi, 26)) !== JSON.stringify(Ik) ||
        JSON.stringify(C.matMul(Mi, M, 26)) !== JSON.stringify(Ik)) bad++;
  }
  T.eq(mism, 0, k + '×' + k + ' 抽样：null 与 gcd(det,26) ≠ 1 完全一致（' + iterations + ' 个）');
  T.eq(bad, 0, k + '×' + k + ' 抽样：每个可逆矩阵都满足 M·M⁻¹ = M⁻¹·M = I（' + inv + ' 个可逆）');
  T.ok(inv > iterations * 0.1, k + '×' + k + ' 抽样里可逆的占 ' +
       (100 * inv / iterations).toFixed(1) + '%（k=3 的理论值 30.1%，不该接近 0）');
});

/* ---- 形状与参数的门 ---- */
T.throws(function () { C.matDet([[1, 2, 3], [4, 5, 6]], 26); }, 'matDet 拒绝非方阵', /方阵/);
T.throws(function () { C.matDet([[1, 2], [3]], 26); }, 'matDet 拒绝行长不齐', /不齐/);
T.throws(function () { C.matDet([], 26); }, 'matDet 拒绝空矩阵', /非空/);
T.throws(function () { C.matDet([[]], 26); }, 'matDet 拒绝空行', /非空/);
T.throws(function () { C.matDet([[1, 2], [3, 2.5]], 26); }, 'matDet 拒绝非整数元素', /不是整数/);
T.throws(function () { C.matDet([[1, 2], [3, NaN]], 26); }, 'matDet 拒绝 NaN 元素', /不是整数/);
T.throws(function () { C.matMulVec(HILL2, [1, 2, 3], 26); }, 'matMulVec 拒绝长度不匹配的向量', /向量长度/);
T.throws(function () { C.matMulVec(HILL2, [1, 0.5], 26); }, 'matMulVec 拒绝非整数向量元素', /不是整数/);
T.throws(function () { C.matMul([[1, 2]], [[1, 2]], 26); }, 'matMul 拒绝维度不匹配', /维度不匹配/);
T.throws(function () { C.matDet(HILL2, 0); }, 'matDet 的模数为 0 要抛（复用 mod 的门）', /模数/);
T.throws(function () { C.matMulVec(HILL2, [1, 2], -3); }, 'matMulVec 的模数为负要抛', /模数/);

/* 阶数上限：Laplace 展开是 k!，k=12 会让页面假死。宁可在入口抛一个能读的错。 */
T.eq(C.MAT_MAX_DIM, 8, 'MAT_MAX_DIM 是 8');
const BIG = [];
for (let i = 0; i <= C.MAT_MAX_DIM; i++) {
  const row = [];
  for (let j = 0; j <= C.MAT_MAX_DIM; j++) row.push(1);
  BIG.push(row);
}
T.throws(function () { C.matDet(BIG, 26); }, '超过 MAT_MAX_DIM 阶要抛', /阶以内/);

T.report('crypto-core');
