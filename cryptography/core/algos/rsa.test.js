'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const rsa = require('./rsa.js');

/* 本文件里一个 Math.random 都没有。需要"随便挑几个数"的地方一律走下面这个
   注入式 LCG——同一条纪律见 crypto-core.randomBytes 与 substitution.randomKey：
   一个用了 Math.random 的测试今天绿明天红，最后必然被加上 retry 或者删掉。 */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    /* 乘数取小一点，让 s * A 始终留在 2⁵³ 内——一个自己就在丢精度的 rng
       会让"复现某次失败"变成一句空话。 */
    s = (s * 1103515 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/* BigInt 参考实现。这个文件里所有"d 真的是逆元吗"的断言都由它裁决，
   而不是由 crypto-core 自己的 Number 算术——被测对象不能同时是裁判。 */
function isInverse(d, e, phi) {
  const P = BigInt(phi);
  return ((BigInt(d) * BigInt(e)) % P) === 1n;
}
function bigModPow(b, e, m) {
  let base = BigInt(b) % BigInt(m), exp = BigInt(e), mod = BigInt(m), r = 1n % mod;
  while (exp > 0n) { if (exp & 1n) r = (r * base) % mod; base = (base * base) % mod; exp >>= 1n; }
  return Number(r);
}

/* ================= 1. 素数表与素性判定 ================= */
T.eq(rsa.KEY_PRIMES.length, 45, '教学素数梯子有 45 档');
(function () {
  let allPrime = true, ascending = true;
  for (let i = 0; i < rsa.KEY_PRIMES.length; i++) {
    if (!rsa.isPrime(rsa.KEY_PRIMES[i])) allPrime = false;
    if (i > 0 && rsa.KEY_PRIMES[i] <= rsa.KEY_PRIMES[i - 1]) ascending = false;
  }
  T.ok(allPrime, '梯子里每一项都是素数（手抄表里混进一个合数，页面会算出一把假密钥）');
  T.ok(ascending, '梯子严格递增');
})();
T.ok(rsa.KEY_PRIMES[rsa.KEY_PRIMES.length - 1] <= rsa.MAX_PRIME, '梯子末项不超过 MAX_PRIME');
T.ok(rsa.MAX_PRIME * rsa.MAX_PRIME <= rsa.MAX_N, 'MAX_PRIME² ≤ MAX_N —— 任意两档相乘都不越界');
T.eq(rsa.MAX_N, Math.pow(2, 52), 'MAX_N 就是 2⁵²');

/* isPrime 与一个独立的埃氏筛逐个对账，而不是抽查几个数。 */
(function () {
  const LIM = 5000;
  const sieve = new Array(LIM + 1).fill(true);
  sieve[0] = sieve[1] = false;
  for (let i = 2; i * i <= LIM; i++) if (sieve[i]) for (let j = i * i; j <= LIM; j += i) sieve[j] = false;
  let bad = -1;
  for (let i = 0; i <= LIM; i++) if (rsa.isPrime(i) !== sieve[i]) { bad = i; break; }
  T.eq(bad, -1, 'isPrime 在 0…5000 上与埃氏筛完全一致');
})();
T.eq(rsa.isPrime(67108859), true, '67108859（≤ 2²⁶ 的最大素数）是素数');
T.eq(rsa.isPrime(67108861), false, '67108861 不是素数');
T.eq(rsa.isPrime(1), false, '1 不是素数');

/* ================= 2. 教科书密钥 ================= */
(function () {
  const K = rsa.keygen(11, 13, 7);
  T.eq(K.n, 143, 'p=11 q=13 → n = 143');
  T.eq(K.phi, 120, 'φ(143) = 10 × 12 = 120');
  T.eq(K.d, 103, 'd = 7⁻¹ mod 120 = 103');
  T.ok(isInverse(K.d, K.e, K.phi), 'BigInt 复核：d·e ≡ 1 (mod φ)');
  T.eq(rsa.encrypt(42, 7, 143), 81, '42⁷ mod 143 = 81');
  T.eq(rsa.decrypt(81, 103, 143), 42, '81¹⁰³ mod 143 = 42');
})();

/* ================= 3. 往返：**穷举**，不是抽样 =================
   抽样能过而穷举过不了的边界是真实存在的（m = 0、m = 1、m = n−1，以及
   与 p 或 q 有公因子的那些 m —— 后者恰恰是 CRT 论证里要单独讨论的一支）。
   所以这里一个不落地扫完 [0, n)。 */
function exhaustiveRoundTrip(p, q, e, dOverride) {
  const K = rsa.keygen(p, q, e);
  if (!K.ok) return { ok: false, n: K.n, reason: K.reason, fails: -1 };
  const d = dOverride == null ? K.d : dOverride;
  let fails = 0, firstFail = null;
  for (let m = 0; m < K.n; m++) {
    const c = rsa.encrypt(m, K.e, K.n);
    const back = rsa.decrypt(c, d, K.n);
    if (back !== m) { fails++; if (firstFail === null) firstFail = m; }
  }
  return { ok: true, n: K.n, d: d, fails: fails, firstFail: firstFail, total: K.n };
}

const CASES = [[3, 5, 3], [11, 13, 7], [17, 19, 5], [31, 37, 7], [101, 211, 11]];
let exhaustiveTotal = 0;
CASES.forEach(function (cs) {
  const R = exhaustiveRoundTrip(cs[0], cs[1], cs[2]);
  T.ok(R.ok, 'keygen(' + cs.join(', ') + ') 应当成功');
  T.eq(R.fails, 0, '穷举往返 p=' + cs[0] + ' q=' + cs[1] + ' e=' + cs[2] +
       '：[0, ' + R.n + ') 全部 m 都还原');
  exhaustiveTotal += R.total;
});
/* 这个数字会印在报告里，所以让它由代码算出来，不由人抄。 */
T.eq(exhaustiveTotal, 15 + 143 + 323 + 1147 + 21311, '五组穷举合计 22939 个 m');

/* ---- 负对照：先证明上面那条断言**能红** ----
   "全部 m 都还原"只有在它有可能不成立时才是一条信息。把 d 换成 d+1，
   同一段循环必须报出失败；如果连这样都绿，说明验的根本不是往返。 */
(function () {
  const K = rsa.keygen(11, 13, 7);
  const R = exhaustiveRoundTrip(11, 13, 7, K.d + 1);
  T.ok(R.fails > 0, '负对照：d+1 时穷举往返必须失败（实测失败 ' + R.fails + ' / 143）');
  /* 139 而不是 143：e·(d+1) = 728 ≡ 8 (mod 120)，于是还原式变成 m ↦ m⁸，
     它在 ℤ/143ℤ 上仍有四个不动点 {0, 1, 66, 78}。这个数字必须写死——
     "只要有失败就算过"会让一个**几乎全对**的错误 d 照样过关，而那正是
     浮点差一位时会出现的形状。 */
  T.eq(R.fails, 139, '负对照：d+1 时 143 个 m 里有 139 个还原不回来（存活的四个是 0, 1, 66, 78）');
  const R2 = exhaustiveRoundTrip(11, 13, 7, 3);
  T.ok(R2.fails > 0, '负对照：把 d 换成一个无关的小数字同样必须失败');
})();

/* ---- 随机 (p, q, e) 上的往返抽查，覆盖到梯子的高位档 ---- */
(function () {
  const rng = makeRng(20260810);
  let checked = 0, fails = 0;
  for (let i = 0; i < 60; i++) {
    const ip = Math.floor(rng() * rsa.KEY_PRIMES.length);
    let iq = Math.floor(rng() * rsa.KEY_PRIMES.length);
    if (iq === ip) iq = (iq + 1) % rsa.KEY_PRIMES.length;
    const p = rsa.KEY_PRIMES[ip], q = rsa.KEY_PRIMES[iq];
    if (p * q > rsa.MAX_N) continue;
    const es = rsa.validEs(rsa.phiOf(p, q), 4);
    if (!es.length) continue;
    const K = rsa.keygen(p, q, es[es.length - 1]);
    if (!K.ok) { fails++; continue; }
    checked++;
    if (!isInverse(K.d, K.e, K.phi)) { fails++; continue; }
    for (let j = 0; j < 6; j++) {
      const m = Math.floor(rng() * Math.min(K.n, 1e6));
      if (rsa.decrypt(rsa.encrypt(m, K.e, K.n), K.d, K.n) !== m) fails++;
    }
  }
  T.ok(checked >= 40, '随机梯子抽查至少验到 40 组密钥（实际 ' + checked + '）');
  T.eq(fails, 0, '随机梯子抽查：d 都是真逆元，且往返全部还原');
})();

/* ================= 4. e 与 φ(n) 不互素时 d 不存在 ================= */
(function () {
  /* p=7, q=11 → φ = 60；e = 3 整除 60，所以 3 在 ℤ/60ℤ 上没有逆元。 */
  T.eq(C.gcd(3, 60), 3, 'gcd(3, 60) = 3');
  T.eq(C.modInverse(3, 60), null, 'modInverse 在不互素时返回 null（不是抛，也不是 0）');
  const K = rsa.keygen(7, 11, 3);
  T.eq(K.ok, false, 'e=3, φ=60 时 keygen 不成立');
  T.eq(K.d, null, 'd 是 null —— 不是"更难求"，是不存在');
  T.eq(K.reason, 'e-not-coprime', 'reason 指名道姓：e 与 φ(n) 不互素');
  T.eq(K.n, 77, 'n 仍然算得出来（n 不依赖 e）');
  T.eq(K.phi, 60, 'φ(n) 也仍然算得出来');
  /* 链条断在最后一环而不是一开始，这正是工具页第一个页签要画的形状。 */
  const ok = rsa.keygen(7, 11, 7);
  T.eq(ok.ok, true, '同一对素数换成 e=7 就成立');
  T.eq(ok.d, 43, 'd = 7⁻¹ mod 60 = 43');
  T.ok(isInverse(ok.d, 7, 60), 'BigInt 复核 7·43 ≡ 1 (mod 60)');
})();

T.eq(rsa.isValidE(3, 60), false, 'isValidE：3 对 φ=60 不合法');
T.eq(rsa.isValidE(7, 60), true, 'isValidE：7 对 φ=60 合法');
T.eq(rsa.isValidE(60, 60), false, 'isValidE：e = φ 不合法（必须 e < φ）');
T.eq(rsa.isValidE(1, 60), false, 'isValidE：e = 1 不合法（c 恒等于 m）');
T.eq(rsa.validEs(60, 5), [7, 11, 13, 17, 19], 'φ=60 时最小的五个合法 e');

/* 其它拒绝理由 */
T.eq(rsa.keygen(9, 11, 7).reason, 'p-not-prime', 'p 不是素数：拒绝');
T.eq(rsa.keygen(11, 15, 7).reason, 'q-not-prime', 'q 不是素数：拒绝');
T.eq(rsa.keygen(11, 11, 7).reason, 'p-equals-q', 'p = q：拒绝（n = p² 开一次方就分解了）');
T.eq(rsa.keygen(11, 13, 1).reason, 'e-out-of-range', 'e = 1：拒绝');
T.eq(rsa.keygen(11, 13, 120).reason, 'e-out-of-range', 'e = φ：拒绝');

/* ================= 5. m 必须小于 n ================= */
(function () {
  const n = 143, e = 7, d = 103;
  T.eq(rsa.messageFits(142, n), true, 'm = n−1 放得下');
  T.eq(rsa.messageFits(143, n), false, 'm = n 放不下');
  T.eq(rsa.messageFits(-1, n), false, '负数不是消息');
  T.throws(function () { rsa.encrypt(143, e, n); }, 'm = n 时 encrypt 必须抛', /\[0, n\)/);
  T.throws(function () { rsa.encrypt(200, e, n); }, 'm > n 时 encrypt 必须抛', /\[0, n\)/);
  /* 为什么必须抛：m 与 m mod n 加密成**同一个**密文，解密只能给回后者。
     不抛的话页面会显示一次成功的往返，而还原出来的是另一条消息。 */
  T.eq(rsa.encryptRaw(200, e, n), rsa.encrypt(200 % n, e, n),
       '200 与 200 mod 143 = 57 加密成同一个密文');
  T.eq(rsa.decrypt(rsa.encryptRaw(200, e, n), d, n), 57,
       '解密只能给回 57，原来的 200 拿不回来了');
  T.ok(rsa.decrypt(rsa.encryptRaw(200, e, n), d, n) !== 200,
       '负对照：这次往返确实是**失败**的，不是碰巧对上');
})();

/* ================= 6. 确定性 —— 教科书 RSA 不是语义安全的 ================= */
(function () {
  const K = rsa.keygen(11, 13, 7);
  T.eq(rsa.encrypt(42, K.e, K.n), rsa.encrypt(42, K.e, K.n), '同一个 m 两次加密结果相同');
  const dict = rsa.dictionary(K.e, K.n, 16);
  T.eq(dict.length, 16, '字典有 16 条');
  T.eq(dict[42 % 16].m, 42 % 16, '字典按 m 升序');
  /* 攻击本身：只用公钥造字典，然后查表读出明文——一次都没解密。 */
  const c = rsa.encrypt(9, K.e, K.n);
  const full = rsa.dictionary(K.e, K.n, K.n);
  let recovered = -1;
  for (let i = 0; i < full.length; i++) if (full[i].c === c) { recovered = full[i].m; break; }
  T.eq(recovered, 9, '只用公钥造字典就能查出明文 9（d 从头到尾没有参与）');
  /* 字典是一个双射（因为 RSA 在 [0,n) 上是置换）：143 个 m 给出 143 个不同的 c。 */
  const seen = {};
  let dup = 0;
  for (let i = 0; i < full.length; i++) { if (seen[full[i].c]) dup++; seen[full[i].c] = 1; }
  T.eq(dup, 0, '143 个明文给出 143 个互不相同的密文（是置换，所以字典无歧义）');
})();

/* ================= 7. 分解 n 就得到了一切 ================= */
(function () {
  const st = rsa.factor(143);
  T.eq([st.p, st.q], [11, 13], 'factor(143) = 11 × 13');
  T.eq(st.prime, false, '143 不是素数');
  T.eq(rsa.factor(97).prime, true, 'factor(97)：97 是素数');
  T.eq(rsa.factor(2).prime, true, 'factor(2)：2 是素数');
  T.eq(rsa.factor(4).p, 2, 'factor(4) = 2 × 2');

  /* Eve 的整条路径：n, e → p, q → φ → d → 明文。 */
  const K = rsa.keygen(101, 211, 11);
  const m = 12345;
  const c = rsa.encrypt(m, K.e, K.n);
  const R = rsa.recover(K.n, K.e);
  T.eq(R.ok, true, 'recover 成功');
  T.eq([R.p, R.q], [101, 211], 'Eve 分解出 p 与 q');
  T.eq(R.phi, K.phi, 'Eve 算出的 φ(n) 与真值相同');
  T.eq(R.d, K.d, 'Eve 算出的 d 与真值**逐位相同**');
  T.eq(rsa.decrypt(c, R.d, K.n), m, 'Eve 用自己算的 d 解开了密文');

  /* 试除次数就是这一页的量纲：它随 √n 走，不随 n 走。 */
  T.eq(rsa.worstCaseTrials(143), 6, '√143 / 2 + 1 = 6');
  T.ok(rsa.worstCaseTrials(1e14) > rsa.worstCaseTrials(1e12) * 9,
       'n 增大 100 倍，最坏试除次数增大 10 倍（√ 关系）');
  /* 分帧推进与一口气跑完必须给出同一个答案——页面走的是前一条路。 */
  const inc = rsa.factorStart(1000003 * 7);
  let guard = 0;
  while (!inc.done && guard++ < 100000) rsa.factorStep(inc, 3);
  T.eq([inc.p, inc.q], [7, 1000003], '分帧推进（每次 3 步）与一口气跑完结果一致');
  T.eq(inc.trials, rsa.factor(1000003 * 7).trials, '两条路走过的试除次数也一样');
})();

/* ================= 8. 上界：2⁵² 之内 modInverse 是精确的 =================
   crypto-core 的 mod(a, n) 算 ((a % n) + n) % n，中间量可以逼近 2n；
   n > 2⁵² 时它越过 2⁵³−1，浮点静默取整，返回的 d 差 1 而看不出任何异样。
   （实测的越界例子：mod(4400303820297978, 4785675681196153) 返回
   4400303820297979，正确值是 4400303820297978。）
   这里只钉住**安全的那一侧**——断言 core 的错误行为会把那个 bug 锁进测试里，
   将来谁修好了 core 反而变红。 */
(function () {
  const rng = makeRng(7654321);
  let checked = 0, wrong = 0;
  for (let i = 0; i < 4000; i++) {
    /* φ 落在 [2⁵¹, 2⁵²]，也就是这份实现允许的最高一档。 */
    const phi = Math.floor(rsa.MAX_N * 0.5 + rng() * rsa.MAX_N * 0.5);
    const e = 3 + 2 * Math.floor(rng() * 500);
    const d = C.modInverse(e, phi);
    if (d === null) continue;
    checked++;
    if (!isInverse(d, e, phi)) wrong++;
  }
  T.ok(checked > 3000, 'φ ∈ [2⁵¹, 2⁵²] 上验到了 ' + checked + ' 组 (e, φ)');
  T.eq(wrong, 0, 'MAX_N 之内 modInverse 逐条通过 BigInt 复核');

  /* 越过 MAX_N 由 keygen 当场拒绝，而不是"算出一把看着正常的假密钥"。 */
  const big = rsa.keygen(67108859, 67108863, 65537);   // 67108863 不是素数
  T.eq(big.reason, 'q-not-prime', '梯子外的合数照样被素性判定拦下');
  T.eq(rsa.keygen(94906249, 94906297, 65537).reason, 'n-too-large',
       'p·q 越过 2⁵² 时拒绝（这正是 modInverse 开始出错的地方）');
})();

/* ================= 9. modPow 的同类进同类出，以及它与 modInverse 的配合 ================= */
(function () {
  T.throws(function () { C.modPow(5, 3n, 7); }, 'modPow 混传类型必须抛', /同为 Number 或同为 BigInt/);
  T.eq(typeof C.modPow(5, 3, 7), 'number', '三个 Number 进 → Number 出');
  T.eq(typeof C.modPow(5n, 3n, 7n), 'bigint', '三个 BigInt 进 → BigInt 出');
  /* modInverse 只有 Number 一种口味：它内部走 Math.floor(old_r / r)，
     BigInt 传进去当场 TypeError。所以这一页全程停在 Number 侧——modPow
     的 BigInt 通道在这里用不上，因为 d 根本没有 BigInt 的来路。 */
  let threw = false;
  try { C.modInverse(3n, 26n); } catch (err) { threw = true; }
  T.ok(threw, 'modInverse 不吃 BigInt（Math.floor 不接受 BigInt）');

  /* 与 BigInt 参考实现逐条对账：Number 通道的 modPow 在 MAX_N 之内是精确的。 */
  const rng = makeRng(13579);
  let bad = 0;
  for (let i = 0; i < 500; i++) {
    const n = Math.floor(rng() * rsa.MAX_N) + 3;
    const b = Math.floor(rng() * n);
    const e = Math.floor(rng() * 100000) + 1;
    if (C.modPow(b, e, n) !== bigModPow(b, e, n)) bad++;
  }
  T.eq(bad, 0, 'modPow 的 Number 通道在 [0, 2⁵²) 上与 BigInt 参考一致');
})();

T.report('rsa');
