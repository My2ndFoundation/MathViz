'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const DH = require('./diffie-hellman.js');

/* ---- 注入式伪随机 ----
   模块内与测试内都不碰 Math.random（与 crypto-core.randomBytes、
   substitution.randomKey 同一条纪律）：一个用了 Math.random 的测试今天绿
   明天红，最后必然被加上 retry 或者干脆删掉。这里用一个写死种子的
   LCG（数值来自 Numerical Recipes），于是"跑了 1200 组随机参数"这句话
   每次跑的是**同一** 1200 组。 */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function pick(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

/* ================= 教科书向量 =================
   p = 23, g = 5, a = 6, b = 15 → A = 8, B = 19，共享秘密 2。 */
const TB = DH.exchange(23, 5, 6, 15);
T.eq(TB.A, 8, '教科书向量 A = 5⁶ mod 23 = 8');
T.eq(TB.B, 19, '教科书向量 B = 5¹⁵ mod 23 = 19');
T.eq(TB.sA, 2, '教科书向量 Alice 算出 2');
T.eq(TB.sB, 2, '教科书向量 Bob 算出 2');
T.eq(TB.agree, true, '教科书向量双方一致');
/* 共享秘密就是 gᵃᵇ —— 这一条把"双方算出同一个数"与"那个数是什么"分开钉住。
   只验前者的话，两边都错成同一个值时测试照样绿。 */
T.eq(TB.shared, C.modPow(5, 6 * 15, 23), '共享秘密等于 g^(ab) mod p');

/* 工具页的默认参数（p=101, g=2, a=17, b=29）——页面上印的每个数字都在这里。
   改默认值而忘了改文案时，这几条会先红。 */
const D = DH.exchange(101, 2, 17, 29);
T.eq([D.A, D.B, D.shared], [75, 59, 15], '工具页默认参数 A/B/共享秘密');
T.eq(DH.discreteLog(2, 101, D.A).steps, 18, '默认参数下 Eve 要试 18 次才撞到 A');
T.eq(DH.ladderSteps(17).total, 5, '默认参数下正向只要 5 次运算（4 平方 + 1 乘）');

/* ================= 素性与因子 ================= */
T.eq([2, 3, 23, 31, 47, 101, 227, 1013].filter(function (n) { return !DH.isPrime(n); }),
     [], '本文件用到的模数全部是素数');
T.eq([1, 4, 9, 25, 26, 91, 100, 121].filter(DH.isPrime), [], '合数一个都不许被判成素数');
T.eq(DH.isPrime(0), false, '0 不是素数');
T.eq(DH.isPrime(1), false, '1 不是素数');
T.eq(DH.isPrime(-7), false, '负数不是素数');
T.eq(DH.isPrime(2.5), false, '非整数不是素数');
T.eq(DH.primeFactors(100), [2, 5], 'primeFactors 返回相异素因子（100 = 2²·5²）');
T.eq(DH.primeFactors(226), [2, 113], '226 = 2·113');
T.eq(DH.primeFactors(30), [2, 3, 5], '30 = 2·3·5');

/* ================= 阶、原根、可达集 =================
   三个量必须是同一个事实的三种问法：
     ord(g) = |{gˣ}| = reachable(g,p).size
   分开写就会分开漂，所以这里逐个 g 把它们钉在一起。 */
[31, 47, 101, 227].forEach(function (p) {
  let checked = 0;
  for (let g = 1; g < p; g++) {
    const ord = DH.orderOf(g, p);
    T.eq((p - 1) % ord, 0, 'p=' + p + ' g=' + g + '：ord 整除 p−1（拉格朗日）');
    T.eq(C.modPow(g, ord, p), 1, 'p=' + p + ' g=' + g + '：g^ord ≡ 1');
    T.eq(DH.isGenerator(g, p), ord === p - 1,
         'p=' + p + ' g=' + g + '：isGenerator 就是 ord === p−1');
    checked++;
  }
  T.eq(checked, p - 1, 'p=' + p + '：全部 p−1 个 g 都验过');
});

/* 可达集大小恒等于阶。p=101 全扫（100 个 g），另外三个素数抽首 30 个
   ——这一条 O(p) 铺表，全扫四个素数没有额外信息，只是更慢。 */
for (let g = 1; g < 101; g++) {
  const r = DH.reachable(g, 101);
  T.eq(r.size, r.order, 'p=101 g=' + g + '：|{gˣ}| === ord(g)');
}
T.eq(DH.reachable(1, 101).values, [1], 'g=1 的可达集只有 {1}');

/* ---- 结论 2 的实测：生成元选错，密钥空间当场塌陷 ----
   p = 101，p−1 = 100 = 2²·5²，所以阶只能取 100 的因子。
     g = 2  是原根 → 100 个可达值（整个乘法群）
     g = 10 阶为 4 → 4 个可达值 {1, 10, 91, 100}
   25 倍的差距，而两者在页面上"看起来"是同一种参数。 */
const GEN = DH.reachable(2, 101);
const BAD = DH.reachable(10, 101);
T.eq(GEN.size, 100, 'p=101, g=2（原根）：可达 100 个值');
T.eq(BAD.size, 4, 'p=101, g=10（非生成元）：只可达 4 个值');
T.eq(BAD.values, [1, 10, 91, 100], 'g=10 的可达集就是这四个数');
T.eq(GEN.size / BAD.size, 25, '密钥空间塌陷了 25 倍');
T.eq(DH.isGenerator(2, 101), true, 'g=2 是 p=101 的原根');
T.eq(DH.isGenerator(10, 101), false, 'g=10 不是原根');
T.eq(DH.generators(101).length, 40, 'p=101 的原根恰好 40 个（φ(100) = 40）');
T.eq(DH.generators(101).slice(0, 5), [2, 3, 7, 8, 11], 'p=101 最小的五个原根');
/* p=31 上更极端的一格：g = 30 = p−1，阶 2，整个"密钥空间"只有两个值。 */
T.eq(DH.reachable(30, 31).values, [1, 30], 'p=31, g=30：可达集只有 {1, 30}');

/* ================= 结论 1：双方恒一致 =================
   ⚠ 先立负对照，再报"全都一致"。
   一条恒真的断言与一条永远不会失败的断言在绿色输出里长得一模一样，而本仓
   反复吃的亏正是这个形状。sidesAgree(..., bump) 把 Alice 那一侧的指数加上
   bump：bump = 0 必须成立，bump = 1 必须**不**成立。后者不成立的话，
   下面那一千多条"一致"什么也没证明。 */
function sidesAgree(p, g, a, b, bump) {
  const A = C.modPow(g, a, p);
  const B = C.modPow(g, b, p);
  return C.modPow(B, a + bump, p) === C.modPow(A, b, p);
}
T.eq(sidesAgree(101, 2, 17, 29, 0), true, '负对照的正向：指数正确时等式成立');
T.eq(sidesAgree(101, 2, 17, 29, 1), false, '负对照：指数错 1 时等式必须不成立');

/* g 是原根、且 1 ≤ b < p−1 时，g^b ≢ 1，所以 a 改成 a+1 一定会改变结果。
   限定在原根上不是回避——非生成元上 ord(g) | b 会让 g^b ≡ 1，那时"错一位
   也算对"是**真的**，把它算进负对照才是撒谎。 */
const NEG_PRIMES = [23, 31, 47, 101, 227];
let negChecked = 0, negFailedToDiffer = 0;
(function () {
  const rng = makeRng(20260810);
  NEG_PRIMES.forEach(function (p) {
    const gens = DH.generators(p);
    for (let i = 0; i < 40; i++) {
      const g = gens[pick(rng, 0, gens.length - 1)];
      const a = pick(rng, 1, p - 2);
      const b = pick(rng, 1, p - 2);
      if (sidesAgree(p, g, a, b, 1)) negFailedToDiffer++;
      negChecked++;
    }
  });
})();
T.eq(negChecked, 200, '负对照跑了 200 组');
T.eq(negFailedToDiffer, 0, '200 组负对照里没有一组"指数错了还照样相等"');

/* 正题：随机 (g, a, b) 上双方必须一致。素数横跨三个量级，最大的
   1000003 让 modPow 的 BigInt 内核也被真正用到（Number 的朴素平方乘法
   在这个模数上会静默出错，见 crypto-core 里那段实测）。 */
const SWEEP_PRIMES = [23, 31, 47, 101, 227, 1013, 104729, 1000003];
let sweepChecked = 0, sweepDisagreed = 0, sweepValueWrong = 0;
(function () {
  const rng = makeRng(31415926);
  SWEEP_PRIMES.forEach(function (p) {
    T.eq(DH.isPrime(p), true, 'sweep 用的模数 ' + p + ' 是素数');
    for (let i = 0; i < 150; i++) {
      const g = pick(rng, 2, p - 1);
      const a = pick(rng, 1, p - 2);
      const b = pick(rng, 1, p - 2);
      const ex = DH.exchange(p, g, a, b);
      if (!ex.agree) sweepDisagreed++;
      /* 再独立验一次"那个数是 gᵃᵇ"：两边算错成同一个值时 agree 照样为真。
         指数 a*b 最大约 (10⁶)² = 10¹²，仍是安全整数，modPow 的 Number 路径
         收得下。 */
      if (ex.shared !== C.modPow(g, a * b, p)) sweepValueWrong++;
      sweepChecked++;
    }
  });
})();
T.eq(sweepChecked, 1200, '一致性扫了 1200 组 (p, g, a, b)');
T.eq(sweepDisagreed, 0, '1200 组里双方全部算出同一个共享秘密');
T.eq(sweepValueWrong, 0, '1200 组的共享秘密全部等于 g^(ab) mod p');

/* 交换是对称的：把 a 与 b 互换，共享秘密不变。gᵃᵇ = gᵇᵃ 是这个协议成立的
   全部理由，所以它值一条独立断言而不是被上面那条顺带覆盖。 */
(function () {
  const rng = makeRng(2718281);
  let n = 0, bad = 0;
  for (let i = 0; i < 120; i++) {
    const p = SWEEP_PRIMES[pick(rng, 0, 5)];
    const g = pick(rng, 2, p - 1);
    const a = pick(rng, 1, p - 2);
    const b = pick(rng, 1, p - 2);
    if (DH.exchange(p, g, a, b).shared !== DH.exchange(p, g, b, a).shared) bad++;
    n++;
  }
  T.eq([n, bad], [120, 0], '交换 a 与 b 不改变共享秘密（120 组）');
})();

/* ================= 结论 3：离散对数只能硬扫 ================= */
(function () {
  const rng = makeRng(161803398);
  let n = 0, wrong = 0, stepsWrong = 0;
  [31, 47, 101, 227].forEach(function (p) {
    for (let i = 0; i < 30; i++) {
      const g = pick(rng, 2, p - 1);
      const x = pick(rng, 0, p - 2);
      const target = C.modPow(g, x, p);
      const r = DH.discreteLog(g, p, target);
      if (!r.found || C.modPow(g, r.x, p) !== target) wrong++;
      /* 找到的是**最小**的那个 x，所以 steps 恒等于 x+1，且不超过 ord(g)。
         r.x 未必等于原来的 x：g 不是原根时 x 与 x + ord(g) 给出同一个值，
         扫描当然会先撞上小的那个。断言只能对"它确实是一个解"下手，
         对"它就是我出的那个 x"下手是错的。 */
      if (r.steps !== r.x + 1 || r.steps > DH.orderOf(g, p)) stepsWrong++;
      n++;
    }
  });
  T.eq([n, wrong, stepsWrong], [120, 0, 0], '120 组离散对数：全部找到且步数自洽');
})();

/* 上界是 p−1 次试探，一次不多。这就是页面上"教学尺寸下 Eve 一瞬间就赢"
   的那个数。 */
T.eq(DH.discreteLog(2, 101, 1).steps, 1, 'target = 1 时第一次试探就命中（g⁰）');
T.eq(DH.discreteLog(2, 101, DH.powers(2, 101)[99]).steps, 100,
     '最坏情况正好是 p−1 = 100 次试探');
T.eq(DH.discreteLog(2, 101, 5).bound, 100, 'bound 恒为 p−1');

/* 找不到是正常结果，不是异常：g 不是原根时，够不着的值占绝大多数。
   p=101, g=10 只可达 4 个值，另外 96 个值任何 x 都到不了。 */
(function () {
  const reach = DH.reachable(10, 101).values;
  let missing = 0, foundWrongly = 0;
  for (let y = 1; y < 101; y++) {
    const r = DH.discreteLog(10, 101, y);
    if (reach.indexOf(y) < 0) {
      if (r.found) foundWrongly++; else missing++;
      if (!r.found && r.steps !== 101) foundWrongly++;   // 扫满全程才敢说没有
    } else if (!r.found) foundWrongly++;
  }
  T.eq([missing, foundWrongly], [96, 0],
       'p=101 g=10：96 个值没有离散对数，且都是扫满全程之后才这么说的');
})();

/* ================= 正向那一侧的代价 ================= */
T.eq(DH.ladderSteps(0), { bits: 0, squarings: 0, multiplies: 0, total: 0 }, 'g⁰ 不需要运算');
T.eq(DH.ladderSteps(1), { bits: 1, squarings: 0, multiplies: 0, total: 0 }, 'g¹ 不需要运算');
T.eq(DH.ladderSteps(2), { bits: 2, squarings: 1, multiplies: 0, total: 1 }, 'g² 一次平方');
T.eq(DH.ladderSteps(255), { bits: 8, squarings: 7, multiplies: 7, total: 14 },
     '全 1 的指数最贵：8 位 → 7 平方 + 7 乘');
T.eq(DH.ladderSteps(256), { bits: 9, squarings: 8, multiplies: 0, total: 8 },
     '2 的幂最便宜：只平方');
/* 页面上那句"2048 位的指数正向也不过几千次运算"的出处。 */
T.eq(DH.ladderSteps(Number.MAX_SAFE_INTEGER).bits, 53, '2⁵³−1 是 53 位');
(function () {
  let worst = 0;
  for (let e = 1; e <= 4096; e++) {
    const s = DH.ladderSteps(e);
    if (s.total > worst) worst = s.total;
    if (s.squarings !== s.bits - 1) throw new Error('平方次数应恒为 bits−1');
  }
  T.eq(worst, 22, '12 位以内最贵的指数（4095，全 1）也只要 22 次运算');
})();

/* ================= 中间人 ================= */
(function () {
  const m = DH.mitm(101, 2, 17, 29, 9);
  T.eq(m.aliceMatchesMallory, true, 'Mallory 与 Alice 共享同一个秘密');
  T.eq(m.bobMatchesMallory, true, 'Mallory 与 Bob 共享同一个秘密');
  T.eq(m.aliceMatchesBob, false, 'Alice 与 Bob 却**不**共享同一个秘密');
  T.eq(m.honestShared, DH.exchange(101, 2, 17, 29).shared,
       'honestShared 就是没被攻击时双方本该得到的那个值');
  T.ok(m.aliceSecret !== m.honestShared && m.bobSecret !== m.honestShared,
       '两侧拿到的都不是本该共享的那个值');
  /* 每一条通道自身的数学完全正确：Alice 那条就是一次以 (a, m) 为指数的
     标准 DH。攻击成立不是因为算错了，而是因为 DH 从没承诺过"对面是谁"。 */
  T.eq(m.aliceSecret, C.modPow(2, 17 * 9, 101), 'Alice 那条通道是一次正确的 DH：g^(am)');
  T.eq(m.bobSecret, C.modPow(2, 29 * 9, 101), 'Bob 那条通道是一次正确的 DH：g^(bm)');
})();

(function () {
  const rng = makeRng(577215664);
  let n = 0, aliceEqBob = 0, malloryBlind = 0, predicateWrong = 0;
  [31, 47, 101, 227].forEach(function (p) {
    const gens = DH.generators(p);
    for (let i = 0; i < 25; i++) {
      const g = gens[pick(rng, 0, gens.length - 1)];
      const a = pick(rng, 1, p - 2), b = pick(rng, 1, p - 2), mm = pick(rng, 1, p - 2);
      const r = DH.mitm(p, g, a, b, mm);
      if (r.aliceMatchesBob) aliceEqBob++;
      if (!r.aliceMatchesMallory || !r.bobMatchesMallory) malloryBlind++;
      /* ⚠ 「Alice 与 Bob 从不一致」是错的，实测出来的。
         gᵃᵐ ≡ gᵇᵐ ⟺ ord(g) | (a−b)·m ——**不**要求 a = b。
         p=31（ord = 30）上 a−b = 15、m = 2 就撞上了：两条被 Mallory 分开的
         通道碰巧算出同一个数。第一版这里写死 aliceEqBob = 0，100 组里红了 6 组。
         把巧合写成不变量，就是把一条断言变成一枚随机的地雷。
         所以断言改成那个**充要条件**本身：一致当且仅当 ord | (a−b)m。 */
      if (r.aliceMatchesBob !== (C.mod((a - b) * mm, DH.orderOf(g, p)) === 0)) predicateWrong++;
      n++;
    }
  });
  T.eq([n, malloryBlind, predicateWrong], [100, 0, 0],
       '100 组中间人：Mallory 两边都读得到，且"两侧是否巧合相等"完全由 ord | (a−b)m 决定');
  T.eq(aliceEqBob, 6, '这 100 组固定样本里恰有 6 组巧合相等（换种子会变，它不是不变量）');
})();

/* ================= 入口守卫 ================= */
T.throws(function () { DH.exchange(100, 2, 3, 4); }, '合数模数必须拒绝', /必须是素数/);
T.throws(function () { DH.exchange(2, 1, 1, 1); }, 'p < 3 必须拒绝', /必须是 ≥ 3 的素数/);
T.throws(function () { DH.exchange(101.5, 2, 3, 4); }, '非整数模数必须拒绝', /必须是整数/);
T.throws(function () { DH.exchange(101, 101, 3, 4); },
         'g ≡ 0 不在乘法群里', /不在乘法群里/);
T.throws(function () { DH.exchange(101, 2, -1, 4); }, '负指数必须拒绝', /必须非负/);
T.throws(function () { DH.exchange(101, 2, 3, 1.5); }, '非整数指数必须拒绝', /必须是整数/);
T.throws(function () { DH.powers(2, 1000003); },
         'powers 要铺 p 个格子，超界必须拒绝', /不能超过 100000/);
T.throws(function () { DH.orderOf(2, 4); }, 'orderOf 也走同一道模数门', /必须是素数/);
T.throws(function () { DH.mitm(101, 2, 3, 4, -2); }, '中间人的指数同样非负', /必须非负/);
/* 超过 Number 乘法安全上界的模数：这里报错的理由与"太大跑不动"无关，
   是 p² 会越过 2⁵³ 让增量乘法静默算错。 */
T.throws(function () { DH.exchange(2147483647, 2, 3, 4); },
         '模数超过 Number 乘法安全界必须拒绝', /不能超过 94906265/);

/* g 的规约：同余的 g 是同一个生成元。 */
T.eq(DH.exchange(101, 103, 5, 7).A, DH.exchange(101, 2, 5, 7).A, 'g=103 等于 g=2');
T.eq(DH.orderOf(103, 101), DH.orderOf(2, 101), 'g=103 与 g=2 同阶');
T.eq(DH.powers(103, 101), DH.powers(2, 101), 'g=103 与 g=2 的地形逐点相同');

/* publicValue 与 exchange 必须是同一份算术，不是两份。 */
(function () {
  const rng = makeRng(141421356);
  let bad = 0;
  for (let i = 0; i < 60; i++) {
    const p = [31, 47, 101, 227][pick(rng, 0, 3)];
    const g = pick(rng, 2, p - 1), a = pick(rng, 1, p - 2), b = pick(rng, 1, p - 2);
    const ex = DH.exchange(p, g, a, b);
    if (DH.publicValue(g, a, p) !== ex.A || DH.publicValue(g, b, p) !== ex.B) bad++;
  }
  T.eq(bad, 0, 'publicValue 与 exchange 给出同一个公开值（60 组）');
})();

T.report('diffie-hellman');
