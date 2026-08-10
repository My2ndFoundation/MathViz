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

/* ---- 大模数：旧的 ((a%n)+n)%n 在这里静静地差 1 ----
   它无条件加一次 n，中间值可以逼近 2n；n > 2⁵² 时 2n 越过 2⁵³−1，浮点开始
   按 2 取整。这个 bug 在第 1–3 章（全部在模 26 上）完全看不见，是 crypto-rsa
   把它逼出来的：错的形状是返回一个看着完全正常的 d，密钥画得出、加密也正常，
   只有解密回不来。
   期望值一律用 BigInt 现算，不抄常量——抄下来的常量正是这类 bug 的藏身处。 */
function refMod(a, n) {
  return Number(((BigInt(a) % BigInt(n)) + BigInt(n)) % BigInt(n));
}
const BIG_CASES = [
  [4400303820297978, 4785675681196153],   // 实测到的那条具体反例
  [4503599627370497, 4503599627370497],
  [9007199254740990, 4503599627370497],
  [-4400303820297978, 4785675681196153],
  [1, 9007199254740991],
  [-1, 9007199254740991]
];
BIG_CASES.forEach(function (c) {
  T.eq(C.mod(c[0], c[1]), refMod(c[0], c[1]),
       'mod 在 2⁵² 以上仍精确：mod(' + c[0] + ', ' + c[1] + ')');
});
/* 那条具体反例的旧值钉死在这里。有人若把实现改回无条件加 n，这条会红，
   而且错误信息里直接写着旧值是多少。 */
T.eq(C.mod(4400303820297978, 4785675681196153), 4400303820297978,
     'mod 的那条反例给出 …978（旧实现给 …979）');

/* −0 归一化：a 是 n 的负整数倍时 JS 的 % 保留被除数符号，得到 −0。
   −0 === 0 为真，所以 T.eq 抓不到它——必须用 Object.is。旧实现给的是 +0，
   这次修溢出不该顺手改掉这个语义。 */
T.ok(Object.is(C.mod(-26, 26), 0), 'mod(-26,26) 是 +0 而不是 -0');
T.ok(Object.is(C.mod(-52, 26), 0), 'mod(-52,26) 是 +0 而不是 -0');
T.ok(Object.is(C.mod(0, 26), 0), 'mod(0,26) 是 +0');

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

/* ================= 字节 · 比特 · 模幂（第 4 章） =================
   ⚠ 本节有 BigInt 出现，而 **T.eq 不能收 BigInt**：_test.js 的 serialize 走的是
   JSON.stringify，`JSON.stringify(24n)` 直接抛
   "TypeError: Do not know how to serialize a BigInt"（实测），replacer 也救不了
   ——它返回什么，JSON.stringify 就试着序列化什么。一条这样的断言不会变红，
   会把整个测试文件炸成一个跟被测代码毫无关系的异常。所以 BigInt 一律用
   `T.ok(x === 24n, …)` 或 `T.eq(String(x), '24')` 比较。 */

/* ---- UTF-8：三类字符各自的字节 ----
   参照值取自 node 的 Buffer.from(s, 'utf8')（一份与本实现完全独立的编码器），
   不是从本实现的输出抄回来的。抄回来的期望值只能证明"今天和今天一样"。 */
T.eq(C.toHex(C.toBytes('A')), '41', 'toBytes ASCII：A → 41');
T.eq(C.toHex(C.toBytes('Hello, World!')), '48656c6c6f2c20576f726c6421', 'toBytes ASCII 句子');
T.eq(C.toHex(C.toBytes('密码')), 'e5af86e7a081', 'toBytes 中文：密码 → e5af86 e7a081（每字 3 字节）');
T.eq(C.toHex(C.toBytes('é')), 'c3a9', 'toBytes 拉丁补充：é → c3a9（2 字节）');
T.eq(C.toHex(C.toBytes('😀')), 'f09f9880', 'toBytes 星际平面：😀 → f09f9880（4 字节）');
T.eq(C.toHex(C.toBytes('𝕏')), 'f09d958f', 'toBytes 星际平面：𝕏 → f09d958f');
T.eq(C.toHex(C.toBytes('a密😀')), '61e5af86f09f9880', 'toBytes 混合三类字符');
T.eq(C.toHex(C.toBytes('')), '', 'toBytes 空串 → 空字节串');

/* 字节数 ≠ 字符数 ≠ 码元数。第 4 章每一页都要在界面上说清这件事，
   所以它得是断言而不是注释：'😀'.length 是 2（一个代理对），字节是 4。 */
T.eq('😀'.length, 2, 'JS 里一个 emoji 占两个 UTF-16 码元');
T.eq(C.toBytes('😀').length, 4, '同一个 emoji 是 4 个 UTF-8 字节');
T.eq(C.toBytes('密码').length, 6, '两个汉字是 6 个字节，不是 2 个');

/* 往返恒等式：这一条比任何单向向量都值钱，它钉住编解码用的是同一套规则。
   不可见的码点一律写成 \u 转义，不贴字面字符：U+0000 是 NUL、U+007F 是 DEL、
   U+0080 是 C1 控制字符。check.py 的门 11 记着一次真实的擦肩而过——一个 NUL
   混进字符串字面量，node --check 报绿，awk 抽取配方却在那里截断。 */
['', 'A', 'Hello, World!', '密码学', 'é', '😀', '𝕏', 'a密😀b',
 'ATTACK AT DAWN', '一次一密 one-time pad 🔐',
 '\u0000\u007f\u0080\u07ff\u0800\uffff\u{10000}\u{10ffff}'].forEach(function (s) {
  T.eq(C.fromBytes(C.toBytes(s)), s, 'fromBytes∘toBytes 是恒等：' + JSON.stringify(s));
});

/* 边界码点：每一段 UTF-8 长度分界线的两侧各取一个。 */
T.eq(C.toHex(C.toBytes('\u0000')), '00', 'U+0000 也是一个正常的 1 字节码点');
T.eq(C.toHex(C.toBytes('\u007f')), '7f', 'U+007F 是 1 字节的上界');
T.eq(C.toHex(C.toBytes('\u0080')), 'c280', 'U+0080 是 2 字节的下界');
T.eq(C.toHex(C.toBytes('\u07ff')), 'dfbf', 'U+07FF 是 2 字节的上界');
T.eq(C.toHex(C.toBytes('\u0800')), 'e0a080', 'U+0800 是 3 字节的下界');
T.eq(C.toHex(C.toBytes('\uffff')), 'efbfbf', 'U+FFFF 是 3 字节的上界');
T.eq(C.toHex(C.toBytes('\u{10000}')), 'f0908080', 'U+10000 是 4 字节的下界');
T.eq(C.toHex(C.toBytes('\u{10ffff}')), 'f48fbfbf', 'U+10FFFF 是 Unicode 上界');

/* 落单代理：TextEncoder 会悄悄替换成 U+FFFD（实测 Buffer 给出 efbfbd），
   本实现抛——替换掉之后 fromBytes∘toBytes 就不再是恒等式了。 */
T.throws(function () { C.toBytes('\ud83d'); }, 'toBytes 拒绝落单的高位代理', /代理/);
T.throws(function () { C.toBytes('\udc00'); }, 'toBytes 拒绝落单的低位代理', /代理/);
T.throws(function () { C.toBytes('a\ud83dz'); }, 'toBytes 拒绝高位代理后面跟着普通字符', /代理/);
T.eq(C.toHex(C.toBytes('😀')), 'f09f9880', '成对的代理正常编码（就是 😀）');

/* 非法 UTF-8 一律抛，不产出 U+FFFD。 */
T.throws(function () { C.fromBytes([0x80]); }, 'fromBytes 拒绝以续字节开头', /起始字节/);
T.throws(function () { C.fromBytes([0xc0, 0x80]); }, 'fromBytes 拒绝 0xC0（必然过长编码）', /起始字节/);
T.throws(function () { C.fromBytes([0xf5, 0x80, 0x80, 0x80]); }, 'fromBytes 拒绝 0xF5（必然越界）', /起始字节/);
T.throws(function () { C.fromBytes([0xe5, 0xaf]); }, 'fromBytes 拒绝被截断的序列', /截断/);
T.throws(function () { C.fromBytes([0xe5, 0x41, 0x86]); }, 'fromBytes 拒绝非法续字节', /续字节/);
T.throws(function () { C.fromBytes([0xe0, 0x80, 0x80]); }, 'fromBytes 拒绝 3 字节的过长编码', /过长/);
T.throws(function () { C.fromBytes([0xf0, 0x80, 0x80, 0x80]); }, 'fromBytes 拒绝 4 字节的过长编码', /过长/);
T.throws(function () { C.fromBytes([0xed, 0xa0, 0x80]); }, 'fromBytes 拒绝 CESU-8（把代理码点编成 3 字节）', /代理码点/);
T.throws(function () { C.fromBytes([0xf4, 0x90, 0x80, 0x80]); }, 'fromBytes 拒绝 U+110000（越过 Unicode 上界）', /上界/);
T.eq(C.fromBytes([0xf4, 0x8f, 0xbf, 0xbf]), '\u{10ffff}', 'U+10FFFF 本身仍然收（上界是闭的）');

/* ---- 字节入参的门 ---- */
T.eq(C.toHex([0, 15, 16, 255]), '000f10ff', 'toHex 收普通整数数组，输出小写无分隔');
T.eq(C.toHex(new Uint8Array([0xde, 0xad])), 'dead', 'toHex 收 Uint8Array');
T.eq(C.toHex([]), '', 'toHex 空数组');
T.throws(function () { C.toHex([256]); }, 'toHex 拒绝 256', /0–255/);
T.throws(function () { C.toHex([-1]); }, 'toHex 拒绝负数', /0–255/);
T.throws(function () { C.toHex([1.5]); }, 'toHex 拒绝非整数', /0–255/);
T.throws(function () { C.toHex([NaN]); }, 'toHex 拒绝 NaN', /0–255/);
T.throws(function () { C.toHex('dead'); }, 'toHex 拒绝字符串（那是 fromHex 的活）', /需要 Uint8Array/);
T.throws(function () { C.toHex(null); }, 'toHex 拒绝 null', /需要 Uint8Array/);
/* 直接塞进 Uint8Array 会静默取模：这三行说明"为什么要在入口验"。 */
T.eq(new Uint8Array([256, -1, 1.5])[0], 0, 'Uint8Array 把 256 静默变成 0（所以 asBytes 要拦）');
T.eq(new Uint8Array([256, -1, 1.5])[1], 255, 'Uint8Array 把 −1 静默变成 255');
T.eq(new Uint8Array([256, -1, 1.5])[2], 1, 'Uint8Array 把 1.5 静默截成 1');

/* ---- 十六进制 ---- */
T.eq(C.toHex(C.fromHex('00ff10')), '00ff10', 'fromHex∘toHex 往返');
T.eq(C.toHex(C.fromHex('DEADBEEF')), 'deadbeef', 'fromHex 收大写，toHex 出小写');
T.eq(C.fromHex('').length, 0, 'fromHex 空串 → 空字节串');
T.eq(C.toHex(C.toBytes('密码')), C.toHex(C.fromHex('e5af86e7a081')), '两条路得到同一串字节');
T.throws(function () { C.fromHex('abc'); }, 'fromHex 拒绝奇数长度', /偶数/);
T.throws(function () { C.fromHex('zz'); }, 'fromHex 拒绝非十六进制字符', /十六进制数字/);
/* 这两条要用**偶数长度**的串，否则先撞上长度门、验到的是另一条规则。
   'de ad' 是 5 个字符——第一版就写成了它，两条断言都在报"长度必须是偶数"，
   看着是绿灯该有的形状，验的却不是分隔符。 */
T.throws(function () { C.fromHex('de ad be'); }, 'fromHex 拒绝空格（清洗是输入框的活）', /十六进制数字/);
T.throws(function () { C.fromHex('de:ad:be'); }, 'fromHex 拒绝分隔符', /十六进制数字/);

/* ---- 异或 ---- */
T.eq(C.toHex(C.xorBytes([0x0f, 0xf0], [0xff, 0x0f])), 'f0ff', 'xorBytes 教科书向量');
T.eq(C.toHex(C.xorBytes([1, 2, 3], [1, 2, 3])), '000000', 'a ⊕ a = 0');
/* 一次一密的全部内容就是这一行：(a ⊕ k) ⊕ k = a。密钥恰好 6 字节，
   与 '密码' 的 UTF-8 长度相同——长度不等时 xorBytes 会抛，那正是它该做的。 */
const OTP_KEY = C.fromHex('0102030405f6');
T.eq(C.toHex(C.xorBytes(C.xorBytes(C.toBytes('密码'), OTP_KEY), OTP_KEY)),
     C.toHex(C.toBytes('密码')), '(a ⊕ k) ⊕ k = a —— 一次一密的全部内容');
T.eq(C.fromBytes(C.xorBytes(C.xorBytes(C.toBytes('密码'), OTP_KEY), OTP_KEY)), '密码',
     '一次一密往返后文本原样回来');
T.ok(C.toHex(C.xorBytes(C.toBytes('密码'), OTP_KEY)) !== C.toHex(C.toBytes('密码')),
     '密文与明文不同（密钥不是全 0）');
T.eq(C.xorBytes([], []).length, 0, 'xorBytes 空串');
T.throws(function () { C.xorBytes([1, 2, 3], [1, 2]); },
         'xorBytes 长度不等要抛，绝不截到短的那一串', /长度必须相同/);
T.throws(function () { C.xorBytes([1], []); }, 'xorBytes 一边为空也要抛', /长度必须相同/);

/* ---- randomBytes：注入 rng，零 Math.random ---- */
function lcgBytes(seed) {
  let s = seed >>> 0;
  return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const rb1 = C.toHex(C.randomBytes(lcgBytes(20260810), 16));
const rb2 = C.toHex(C.randomBytes(lcgBytes(20260810), 16));
T.eq(rb1, rb2, 'randomBytes 对同一个种子完全可复现（门不许今天绿明天红）');
T.eq(C.randomBytes(lcgBytes(1), 32).length, 32, 'randomBytes 长度正确');
T.eq(C.randomBytes(lcgBytes(1), 0).length, 0, 'randomBytes 长度 0');
T.ok(!/^(00)+$/.test(rb1), 'randomBytes 不是一串 0（rng 真的被用上了）');
/* 夹取：rng 返回恰好 1 时 Math.floor(1*256) = 256，写进 Uint8Array 会**静默**
   变成 0——不抛不警告，只是把 0 的频率抬高了。这两条钉住夹取而不是取模。 */
T.eq(C.toHex(C.randomBytes(function () { return 1; }, 4)), 'ffffffff',
     'rng 返回 1 时得到 0xFF，不是被 Uint8Array 静默模成 0x00');
T.eq(C.toHex(C.randomBytes(function () { return NaN; }, 4)), '00000000', 'rng 返回 NaN 时夹到 0');
T.eq(C.toHex(C.randomBytes(function () { return -0.5; }, 4)), '00000000', 'rng 返回负数时夹到 0');
T.eq(C.toHex(C.randomBytes(function () { return 0.9999999; }, 2)), 'ffff', 'rng 逼近 1 时是 0xFF');
T.throws(function () { C.randomBytes(null, 4); }, 'randomBytes 必须注入 rng', /Math.random/);
T.throws(function () { C.randomBytes(0.5, 4); }, 'randomBytes 的 rng 必须是函数', /Math.random/);
T.throws(function () { C.randomBytes(lcgBytes(1), -1); }, 'randomBytes 拒绝负长度', /非负整数/);
T.throws(function () { C.randomBytes(lcgBytes(1), 2.5); }, 'randomBytes 拒绝非整数长度', /非负整数/);

/* ---- 比特 ---- */
T.eq(C.toBits([0xa5]), [1, 0, 1, 0, 0, 1, 0, 1], 'toBits 0xA5 → 10100101');
T.eq(C.toBits([0x80])[0], 1, 'MSB 在前：0x80 的第 0 位是 1');
T.eq(C.toBits([0x01])[7], 1, 'MSB 在前：0x01 的第 7 位才是 1');
T.eq(C.toBits([0x00, 0xff]).length, 16, 'toBits 每字节 8 位');
T.eq(C.toBits([]), [], 'toBits 空');
T.eq(C.toHex(C.fromBits([1, 0, 1, 0, 0, 1, 0, 1])), 'a5', 'fromBits 10100101 → 0xA5');
/* 全 256 个字节的往返，一个不漏。 */
let bitRound = 0;
for (let v = 0; v < 256; v++) {
  if (C.fromBits(C.toBits([v]))[0] !== v) bitRound++;
}
T.eq(bitRound, 0, 'toBits/fromBits 对全部 256 个字节往返成立');
T.eq(C.toHex(C.fromBits(C.toBits(C.toBytes('密码')))), C.toHex(C.toBytes('密码')),
     '比特往返对多字节文本也成立');
T.eq(C.fromBits(new Uint8Array([1, 1, 1, 1, 0, 0, 0, 0]))[0], 0xf0, 'fromBits 也收 Uint8Array 形式的比特');
T.eq(C.fromBits([]).length, 0, 'fromBits 空');
T.throws(function () { C.fromBits([1, 0, 1]); }, 'fromBits 拒绝非 8 倍数的长度', /8 的整数倍/);
T.throws(function () { C.fromBits([1, 0, 1, 0, 0, 1, 0, 2]); }, 'fromBits 拒绝 2', /不是数字 0 或 1/);
T.throws(function () { C.fromBits([true, false, 0, 0, 0, 0, 0, 0]); },
         'fromBits 拒绝布尔（`(v<<1)|true` 会算得出来，于是错得无声无息）', /不是数字 0 或 1/);
T.throws(function () { C.fromBits(['1', 0, 0, 0, 0, 0, 0, 0]); }, 'fromBits 拒绝字符串位', /不是数字 0 或 1/);
T.throws(function () { C.fromBits('10101010'); }, 'fromBits 拒绝字符串', /0\/1 数组/);

/* ---- 32 位轮转 ----
   4 的倍数的位移量在十六进制下是肉眼可验的（就是把 nibble 转圈），
   所以这几条是"人能独立算出来"的期望值，不是抄回来的。 */
T.eq(C.rotl32(0x12345678, 4), 0x23456781, 'rotl32 4 位 = 十六进制左转一位');
T.eq(C.rotl32(0x12345678, 8), 0x34567812, 'rotl32 8 位');
T.eq(C.rotr32(0x12345678, 4), 0x81234567, 'rotr32 4 位');
T.eq(C.rotr32(0x12345678, 8), 0x78123456, 'rotr32 8 位');
T.eq(C.rotl32(0x80000000, 1), 1, 'rotl32 把最高位转到最低位');
T.eq(C.rotr32(1, 1), 0x80000000, 'rotr32 把最低位转到最高位');
T.eq(C.rotl32(0x12345678, 0), 0x12345678, 'rotl32 0 位是恒等');
T.eq(C.rotl32(0x12345678, 32), 0x12345678, 'rotl32 32 位是恒等（这一支必须单独写，不能靠 >>> 的模 32 碰巧）');
T.eq(C.rotr32(0x12345678, 32), 0x12345678, 'rotr32 32 位是恒等');
/* 无符号：0x80000000 以上的结果不许变成负数。 */
T.eq(C.rotl32(0xffffffff, 5), 0xffffffff, 'rotl32 全 1 还是全 1');
T.ok(C.rotl32(0x00000001, 31) === 0x80000000, 'rotl32 结果是无符号 2147483648，不是 −2147483648');
T.ok(C.rotl32(0x40000000, 1) > 0, '越过符号位的结果仍然为正');
/* `(a + b) | 0` 产出的负数与它的无符号写法是同一个位型。 */
T.eq(C.rotl32(-1, 5), 0xffffffff, 'rotl32 收 −1（JS 位运算的 0xFFFFFFFF）');
T.eq(C.rotl32(-2147483648, 1), 1, 'rotl32 收 −2³¹（就是 0x80000000）');
/* 往返：所有位移量、若干个典型值。 */
let rotBad = 0;
[0x00000000, 0x00000001, 0x12345678, 0x80000000, 0xffffffff, 0xdeadbeef, 0x6a09e667].forEach(function (x) {
  for (let n = 0; n <= 32; n++) {
    if (C.rotr32(C.rotl32(x, n), n) !== x) rotBad++;
    if (C.rotl32(C.rotr32(x, n), n) !== x) rotBad++;
    if (n > 0 && n < 32 && C.rotl32(x, n) !== C.rotr32(x, 32 - n)) rotBad++;
  }
});
T.eq(rotBad, 0, 'rotl32/rotr32 互逆，且 rotl32(x,n) === rotr32(x,32−n)（7 个值 × 33 个位移量）');
T.throws(function () { C.rotl32(2 ** 40, 1); }, 'rotl32 拒绝超出 32 位的数（`<<` 会静默截断它）', /32 位整数/);
T.throws(function () { C.rotl32(2.5, 1); }, 'rotl32 拒绝非整数', /32 位整数/);
T.throws(function () { C.rotl32(NaN, 1); }, 'rotl32 拒绝 NaN', /32 位整数/);
T.throws(function () { C.rotr32(-2147483649, 1); }, 'rotr32 拒绝小于 −2³¹ 的数', /32 位整数/);
T.throws(function () { C.rotl32(1, 33); }, 'rotl32 拒绝 33 位（不偷偷 n & 31）', /位移量/);
T.throws(function () { C.rotl32(1, -1); }, 'rotl32 拒绝负位移量', /位移量/);
T.throws(function () { C.rotr32(1, 1.5); }, 'rotr32 拒绝非整数位移量', /位移量/);

/* ---- 模幂：静默溢出是这里唯一真正要防的事 ----
   下面这个朴素实现就是"看上去没问题"的那一版。它不抛异常、结果也是个整数，
   只是错的。把它和 modPow 并排放在测试里，是为了让下一个想"BigInt 太重了，
   改回 Number 吧"的人先看到这三行。 */
function naiveModPow(b, e, m) {
  let r = 1; b = b % m;
  while (e > 0) {
    if (e & 1) r = (r * b) % m;
    b = (b * b) % m;
    e = Math.floor(e / 2);
  }
  return r;
}
const M31 = 2147483647;                    // 2³¹ − 1，梅森素数
T.eq(naiveModPow(M31 - 3, 65537, M31), 295847167,
     '朴素 Number 实现给出 295847167（错的，而且不抛异常）');
T.eq(C.modPow(M31 - 3, 65537, M31), 26756584,
     'modPow(2147483644, 65537, 2147483647) === 26756584（正确答案）');
T.ok(naiveModPow(M31 - 3, 65537, M31) !== C.modPow(M31 - 3, 65537, M31),
     '两者不相等——这就是那个 Number 路径必须被禁掉的理由');
/* 安全上界由 m² < 2⁵³ 推出，不是抽出来的：m = 94906271 已经越界，却碰巧算对。
   一条"抽查相符"的证据什么也没证明，这条断言就是它的反例。 */
T.eq(Math.floor(Math.sqrt(Number.MAX_SAFE_INTEGER)), 94906265, 'Number 路径的安全上界是 floor(√(2⁵³−1))');
T.eq(naiveModPow(94906268, 65537, 94906271), C.modPow(94906268, 65537, 94906271),
     'm = 94906271 超界却碰巧与正确答案相符——所以界不能靠抽查定');

/* 小向量与退化情形。 */
T.eq(C.modPow(2, 10, 1000), 24, 'modPow(2,10,1000) = 1024 mod 1000 = 24');
T.eq(C.modPow(3, 0, 7), 1, '任何数的 0 次幂是 1');
T.eq(C.modPow(0, 0, 7), 1, '0⁰ 取 1（与 Math.pow 一致）');
T.eq(C.modPow(5, 0, 1), 0, 'mod = 1 时结果恒为 0（r 初值写死 1n 会在这里错）');
T.eq(C.modPow(7, 1, 26), 7, 'modPow(x,1,m) = x mod m');
T.eq(C.modPow(30, 1, 26), 4, 'modPow 会把底数先规约');
T.eq(C.modPow(-3, 3, 7), 1, '负底数归一到 [0,m)：(−3)³ ≡ 4³ ≡ 1 (mod 7)');
T.eq(C.modPow(0, 5, 7), 0, '0 的正次幂是 0');
T.ok(C.modPow(2, 10, 1000) >= 0, '结果恒非负');

/* 费马小定理：p 素数、gcd(a,p)=1 时 a^(p−1) ≡ 1 (mod p)。
   期望值由定理定死，不是跑一遍抄回来的——实现整体偏移时回归基线会跟着偏移，
   这个 1 不会。而且模数正落在朴素 Number 实现必定出错的量级上：
   把 modPow 换成上面的 naiveModPow，这一段当场全红。 */
let fermatBad = 0, fermatN = 0;
const fRnd = lcg(20260810);
for (let i = 0; i < 300; i++) {
  const a = 1 + Math.floor(fRnd() * (M31 - 1));
  fermatN++;
  if (C.modPow(a, M31 - 1, M31) !== 1) fermatBad++;
}
T.eq(fermatBad, 0, '费马小定理在 p = 2³¹−1 上对 ' + fermatN + ' 个底数全部成立');
T.ok(naiveModPow(3, M31 - 1, M31) !== 1, '同一条定理在朴素 Number 实现下不成立（对照组）');

/* Diffie–Hellman 的交换律：g^a^b ≡ g^b^a。DH 那一页画的就是这一条。 */
const dhP = M31, dhG = 7, dhA = 123456789, dhB = 987654321;
T.eq(C.modPow(C.modPow(dhG, dhA, dhP), dhB, dhP),
     C.modPow(C.modPow(dhG, dhB, dhP), dhA, dhP),
     'Diffie–Hellman：(g^a)^b ≡ (g^b)^a (mod p)');

/* ---- 同类进、同类出 ---- */
T.eq(typeof C.modPow(2, 10, 1000), 'number', '三个 Number 进 → Number 出');
T.eq(typeof C.modPow(2n, 10n, 1000n), 'bigint', '三个 BigInt 进 → BigInt 出');
T.ok(C.modPow(2n, 10n, 1000n) === 24n, 'BigInt 路径的值也对（用 === 比，不能交给 T.eq）');
T.throws(function () { C.modPow(2n, 10, 1000n); }, 'modPow 拒绝混着传（BigInt + Number）', /同为/);
T.throws(function () { C.modPow(2, 10n, 1000); }, 'modPow 拒绝只有指数是 BigInt', /同为/);
T.throws(function () { C.modPow('2', '10', '1000'); }, 'modPow 拒绝字符串', /同为/);

/* BigInt 路径要能扛住真实规模。2⁶¹−1 也是梅森素数，它已经越过 2⁵³，
   Number 路径必须当场拒绝而不是"尽力而为"。 */
const P61 = 2305843009213693951n;
T.ok(C.modPow(2n, P61 - 1n, P61) === 1n, '费马小定理在 p = 2⁶¹−1 上成立（BigInt 路径）');
T.ok(C.modPow(1234567890123n, P61 - 1n, P61) === 1n, '2⁶¹−1 上换一个底数仍然成立');
T.throws(function () { C.modPow(2, 2305843009213693950, 2305843009213693951); },
         '同一个模数用 Number 传要抛（它已经不是安全整数）', /安全整数/);
T.throws(function () { C.modPow(2, 3, 2 ** 53); }, 'modPow 拒绝 2⁵³ 这个模数', /安全整数/);
T.throws(function () { C.modPow(2.5, 3, 7); }, 'modPow 拒绝非整数底数', /安全整数/);
T.throws(function () { C.modPow(2, 3.5, 7); }, 'modPow 拒绝非整数指数', /安全整数/);
T.throws(function () { C.modPow(2, Infinity, 7); }, 'modPow 拒绝 Infinity', /安全整数/);
T.throws(function () { C.modPow(2, NaN, 7); }, 'modPow 拒绝 NaN', /安全整数/);

/* RSA 的往返：e·d ≡ 1 (mod λ(n)) 时 (m^e)^d ≡ m。参数取自教科书大小的素数，
   d 由 modInverse 现算——把 crypto-core 已有的模逆和新加的模幂接在一起，
   正是 RSA 那一页要画的整条链。 */
const rsaP = 61, rsaQ = 53, rsaN = rsaP * rsaQ;          // 3233
const rsaPhi = (rsaP - 1) * (rsaQ - 1);                  // 3120
const rsaE = 17;
const rsaD = C.modInverse(rsaE, rsaPhi);
T.eq(rsaD, 2753, 'RSA 教科书参数：d = 17⁻¹ mod 3120 = 2753');
T.eq(C.modPow(65, rsaE, rsaN), 2790, 'RSA 加密 65 → 2790（教科书向量）');
T.eq(C.modPow(2790, rsaD, rsaN), 65, 'RSA 解密 2790 → 65');
let rsaBad = 0;
for (let m = 0; m < rsaN; m++) {
  if (C.modPow(C.modPow(m, rsaE, rsaN), rsaD, rsaN) !== m) rsaBad++;
}
T.eq(rsaBad, 0, 'RSA 往返对全部 ' + rsaN + ' 个明文成立（n = pq 无平方因子，对所有 m 都成立）');

T.throws(function () { C.modPow(2, 3, 0); }, 'modPow 的模数为 0 要抛', /模数必须是正数/);
T.throws(function () { C.modPow(2, 3, -7); }, 'modPow 的模数为负要抛', /模数必须是正数/);
T.throws(function () { C.modPow(2n, 3n, 0n); }, 'BigInt 路径的模数为 0 也要抛', /模数必须是正数/);
T.throws(function () { C.modPow(2, -1, 7); }, 'modPow 的指数为负要抛', /指数必须非负/);
T.throws(function () { C.modPow(2n, -1n, 7n); }, 'BigInt 路径的指数为负也要抛', /指数必须非负/);

/* ================= 浏览器加载路径 =================
   上面每一条走的都是 node 分支（module.exports + require）。页面里跑的是
   **另一条**：没有 module、没有 require，模块把自己挂到 root.CryptoCore。
   两条分支只有一条被覆盖过，而本仓出事的一直是没被覆盖的那条——
   examples.test.js 与 check.py 的 ALGOS 求值门都为同一个理由立过门。
   零依赖：vm 是 node 标准库。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const CORE_SRC = fs.readFileSync(path.join(__dirname, 'crypto-core.js'), 'utf8');

function browserContext(extra) {
  const sandbox = {};
  sandbox.self = sandbox;                // 页面里 self === window
  if (extra) Object.keys(extra).forEach(function (k) { sandbox[k] = extra[k]; });
  return vm.createContext(sandbox);
}

const ctx = browserContext();
vm.runInContext(CORE_SRC, ctx);
T.ok(!!ctx.CryptoCore, '浏览器分支下模块挂到了 root.CryptoCore');
T.eq(vm.runInContext('typeof module', ctx), 'undefined', '沙箱里没有 module（否则测的还是 node 分支）');
T.eq(vm.runInContext('typeof require', ctx), 'undefined', '沙箱里没有 require');
const B = ctx.CryptoCore;

/* ---- TextEncoder / TextDecoder 独立性 ----
   裸 vm 上下文里这两个 global 根本不存在（node v25 实测
   `typeof TextEncoder === 'undefined'`），check.py 的 ALGOS 求值门用的正是这种
   上下文。所以本实现手写 UTF-8。这里不去断言"它不存在"（哪天 node 把它加进
   裸上下文，那条断言就会无辜变红），而是**把它换成一调用就抛的桩**。
   为什么必须是炸弹而不是"沙箱里没有它"：真正会犯的错法是
   `typeof TextEncoder !== 'undefined' ? 用它 : 手写`——那种写法在裸沙箱里
   走的正是手写那条，裸沙箱一个字都察觉不到，而浏览器里跑的是另一条。
   实测：把 toBytes 改成那个混合写法，只有这一段变红。 */
function boom() { throw new Error('本模块不许依赖 TextEncoder/TextDecoder'); }
const poisoned = browserContext({ TextEncoder: boom, TextDecoder: boom });
vm.runInContext(CORE_SRC, poisoned);
const PB = poisoned.CryptoCore;
/* 包一层 try：不包的话实现真去碰 TextEncoder 时抛的是**未捕获异常**，
   整个文件炸成一段与被测代码无关的堆栈，而不是一条读得懂的失败。 */
function noTextEncoder(label, fn, expected) {
  let got;
  try { got = fn(); } catch (err) {
    T.ok(false, label + '\n    实现碰了 TextEncoder/TextDecoder：' + String(err && err.message));
    return;
  }
  T.eq(got, expected, label);
}
noTextEncoder('TextEncoder 被换成炸弹后 toBytes 照常工作（证明没有依赖它）',
              function () { return PB.toHex(PB.toBytes('密码 a😀')); },
              C.toHex(C.toBytes('密码 a😀')));
noTextEncoder('TextDecoder 被换成炸弹后 fromBytes 照常工作',
              function () { return PB.fromBytes(PB.fromHex('e5af86e7a081')); }, '密码');

/* ---- 跨 realm 的 Uint8Array ----
   isU8 用 Object.prototype.toString 而不是 instanceof，就是为了这一段。 */
const crossBytes = B.toBytes('密码');            // 沙箱 realm 造出来的 Uint8Array
T.ok(!(crossBytes instanceof Uint8Array),
     '跨 realm 时 instanceof Uint8Array 是 false —— 这正是 isU8 不能用 instanceof 的原因');
T.eq(C.toHex(crossBytes), 'e5af86e7a081', 'node 分支的 toHex 收得下浏览器分支产出的 Uint8Array');
T.eq(B.toHex(C.toBytes('密码')), 'e5af86e7a081', '浏览器分支的 toHex 收得下 node 分支产出的 Uint8Array');

/* ---- 两条分支逐个函数对齐 ----
   每个新函数都取一个样本，两边结果必须逐字节相同。 */
const SAMPLE = '密码 crypto 😀';
T.eq(B.toHex(B.toBytes(SAMPLE)), C.toHex(C.toBytes(SAMPLE)), '两条分支的 toBytes 一致');
T.eq(B.fromBytes(B.toBytes(SAMPLE)), C.fromBytes(C.toBytes(SAMPLE)), '两条分支的 fromBytes 一致');
T.eq(B.toHex([0, 15, 255]), C.toHex([0, 15, 255]), '两条分支的 toHex 一致');
T.eq(B.toHex(B.fromHex('DEADbeef')), C.toHex(C.fromHex('DEADbeef')), '两条分支的 fromHex 一致');
T.eq(B.toHex(B.xorBytes([0x0f, 0xf0], [0xff, 0x0f])),
     C.toHex(C.xorBytes([0x0f, 0xf0], [0xff, 0x0f])), '两条分支的 xorBytes 一致');
T.eq(B.toHex(B.randomBytes(lcgBytes(7), 12)), C.toHex(C.randomBytes(lcgBytes(7), 12)),
     '两条分支的 randomBytes 在同一个 rng 下一致');
T.eq(B.toBits([0xa5]), C.toBits([0xa5]), '两条分支的 toBits 一致');
T.eq(B.toHex(B.fromBits([1, 0, 1, 0, 0, 1, 0, 1])), C.toHex(C.fromBits([1, 0, 1, 0, 0, 1, 0, 1])),
     '两条分支的 fromBits 一致');
T.eq(B.rotl32(0x12345678, 7), C.rotl32(0x12345678, 7), '两条分支的 rotl32 一致');
T.eq(B.rotr32(0x12345678, 7), C.rotr32(0x12345678, 7), '两条分支的 rotr32 一致');
T.eq(B.modPow(M31 - 3, 65537, M31), C.modPow(M31 - 3, 65537, M31), '两条分支的 modPow 一致');
T.ok(B.modPow(2n, P61 - 1n, P61) === 1n, '浏览器分支的 BigInt 模幂也对');
/* 门也要在浏览器分支上关着——只在 node 分支验错误路径，等于没验。 */
T.throws(function () { B.xorBytes([1, 2], [1]); }, '浏览器分支的 xorBytes 长度门同样有效', /长度必须相同/);
T.throws(function () { B.fromHex('abc'); }, '浏览器分支的 fromHex 奇数长度门同样有效', /偶数/);
T.throws(function () { B.fromBits([1, 0, 1]); }, '浏览器分支的 fromBits 长度门同样有效', /8 的整数倍/);
T.throws(function () { B.modPow(2, 3, 0); }, '浏览器分支的 modPow 模数门同样有效', /模数必须是正数/);

T.report('crypto-core');
