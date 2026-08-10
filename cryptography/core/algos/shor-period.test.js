'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const RS = require('./rsa.js');
const SP = require('./shor-period.js');

/* 本文件里一个 Math.random 都没有。需要"随便挑几个"的地方一律走这个注入式
   LCG——同一条纪律见 rsa.test.js 与 crypto-core.randomBytes：一个用了
   Math.random 的成功率统计今天绿明天红，最后必然被加上 retry 或者删掉，
   而这一页的全部价值就在于那个成功率是**可复现**的。 */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1103515 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/* BigInt 参考实现。凡是"这个周期真的是周期吗"的判定都由它裁决，
   而不是由被测模块自己的 Number 算术——被测对象不能同时是裁判。 */
function bigModPow(b, e, m) {
  let base = BigInt(b) % BigInt(m), exp = BigInt(e), mod = BigInt(m), r = 1n % mod;
  while (exp > 0n) { if (exp & 1n) r = (r * base) % mod; base = (base * base) % mod; exp >>= 1n; }
  return Number(r);
}

/* ================= 1. 半素数梯子 ================= */
(function () {
  let allSemiprime = true, ascending = true, allOdd = true, inBudget = true;
  let bad = null;
  for (let i = 0; i < SP.SEMIPRIMES.length; i++) {
    const N = SP.SEMIPRIMES[i];
    if (N % 2 === 0) allOdd = false;
    if (i > 0 && N <= SP.SEMIPRIMES[i - 1]) ascending = false;
    if (N > SP.SURVEY_MAX_N) inBudget = false;
    /* "是两个相异奇素数之积"当场验，不靠注释担保——一张手抄的常数表里
       混进一个素数幂（比如 9 或 49），classify 会把它拒掉，而页面上的
       表现是那一档 N 整页空白。rsa.test.js 对 KEY_PRIMES 做的是同一件事。 */
    const st = RS.factor(N);
    const p = st.p, q = st.q;
    if (st.prime || !RS.isPrime(p) || !RS.isPrime(q) || p === q || p * q !== N) {
      allSemiprime = false;
      if (bad === null) bad = N;
    }
  }
  T.ok(allSemiprime, '梯子每一项都是两个相异素数之积（第一个不合格的是 ' + bad + '）');
  T.ok(ascending, '梯子严格递增');
  T.ok(allOdd, '梯子每一项都是奇数（Shor 的归约要求 N 为奇）');
  T.ok(inBudget, '梯子每一项都在穷举普查预算 SURVEY_MAX_N 之内');
  T.eq(SP.SEMIPRIMES.length, 35, '梯子有 35 档');
})();

/* ================= 2. classify：三类"用不着量子计算机"的 N ================= */
T.eq(SP.classify(15).reason, 'ok', '15 = 3·5 是合法的归约目标');
T.eq(SP.classify(16).reason, 'n-even', '偶数走不到归约——除以 2 就完事');
T.eq(SP.classify(97).reason, 'n-prime', '素数没有非平凡因子');
T.eq(SP.classify(2187).reason, 'n-prime-power', '2187 = 3⁷ 是素数幂');
T.eq(SP.classify(2187).base, 3, '素数幂的底数是 3');
T.eq(SP.classify(2187).exp, 7, '素数幂的指数是 7');
T.eq(SP.classify(961).reason, 'n-prime-power', '961 = 31² 是素数幂');
T.eq(SP.classify(3599).reason, 'ok', '3599 = 59·61 合法');

/* primePowerBase 与一次独立的暴力搜索逐点对账。浮点开方在这个量级上
   可能差一两，这条断言就是那个 ±2 修正的证据。 */
(function () {
  function bruteforcePP(N) {
    for (let b = 2; b * b <= N; b++) {
      let v = b, k = 1;
      while (v < N) { v *= b; k++; }
      if (v === N && RS.isPrime(b)) return { base: b, exp: k };
    }
    return RS.isPrime(N) ? { base: N, exp: 1 } : null;
  }
  let bad = -1;
  for (let N = 2; N <= 20000; N++) {
    const a = SP.primePowerBase(N), b = bruteforcePP(N);
    const sa = a ? a.base + '^' + a.exp : 'null';
    const sb = b ? b.base + '^' + b.exp : 'null';
    if (sa !== sb) { bad = N; break; }
  }
  T.eq(bad, -1, 'primePowerBase 在 2…20000 上与暴力搜索完全一致');
})();

/* ================= 3. 周期本身 =================
   两条独立的裁决：a^r ≡ 1（BigInt 算），且没有更小的正 k 满足 a^k ≡ 1。 */
(function () {
  let bad = null, checked = 0;
  const Ns = [15, 21, 35, 77, 91, 143, 187, 209, 247, 323];
  for (let i = 0; i < Ns.length; i++) {
    const N = Ns[i];
    for (let a = 1; a < N; a++) {
      if (C.gcd(a, N) !== 1) continue;
      const per = SP.periodOf(a, N);
      checked++;
      if (bigModPow(a, per.r, N) !== 1) { bad = 'a=' + a + ' N=' + N + ' 不是周期'; break; }
      let minimal = true;
      for (let k = 1; k < per.r; k++) if (bigModPow(a, k, N) === 1) { minimal = false; break; }
      if (!minimal) { bad = 'a=' + a + ' N=' + N + ' 有更小的周期'; break; }
      if (per.steps !== per.r) { bad = 'a=' + a + ' N=' + N + ' 的 steps 不等于 r'; break; }
    }
    if (bad) break;
  }
  T.eq(bad, null, '周期在十个半素数的全部互素 a 上都最小且成立');
  T.ok(checked > 900, '这条断言真的转了很多圈（实测 ' + checked + ' 个 a）');
})();

T.eq(SP.periodOf(1, 15).r, 1, 'ord(1) = 1');
T.eq(SP.periodOf(14, 15).r, 2, 'ord(−1) = 2');
T.eq(SP.periodOf(2, 15).r, 4, 'ord_15(2) = 4');
T.eq(SP.periodOf(7, 15).r, 4, 'ord_15(7) = 4');
T.eq(SP.periodOf(3, 15), null, 'gcd(3,15) ≠ 1 时阶不存在，返回 null');
T.eq(SP.periodOf(5, 15), null, 'gcd(5,15) ≠ 1 时阶不存在，返回 null');
/* 阶必整除 λ(N) = lcm(p−1, q−1)（卡迈克尔函数）。独立于实现的一条性质。 */
(function () {
  function lcm(x, y) { return x / C.gcd(x, y) * y; }
  let bad = null;
  for (let i = 0; i < SP.SEMIPRIMES.length && !bad; i++) {
    const N = SP.SEMIPRIMES[i];
    const st = RS.factor(N);
    const lam = lcm(st.p - 1, st.q - 1);
    for (let a = 1; a < N; a += 7) {
      if (C.gcd(a, N) !== 1) continue;
      const per = SP.periodOf(a, N);
      if (lam % per.r !== 0) { bad = 'N=' + N + ' a=' + a + ' r=' + per.r + ' 不整除 λ=' + lam; break; }
    }
  }
  T.eq(bad, null, '每个阶都整除 λ(N) = lcm(p−1, q−1)');
})();

/* ================= 4. orbit：周期在数列上是可见的 ================= */
(function () {
  const N = 143, a = 7;
  const r = SP.periodOf(a, N).r;
  const seq = SP.orbit(a, N, 200);
  T.eq(seq[0], 1, 'a⁰ = 1');
  T.eq(seq[1], a % N, 'a¹ = a');
  let periodic = true, matchesBig = true;
  for (let x = 0; x < seq.length; x++) {
    if (seq[x] !== seq[x % r]) periodic = false;
    if (seq[x] !== bigModPow(a, x, N)) matchesBig = false;
  }
  T.ok(periodic, 'orbit 以 r 为周期重复（这是页面上那张图的全部内容）');
  T.ok(matchesBig, 'orbit 逐点等于 BigInt 参考的 a^x mod N');
})();

/* ================= 5. 归约：拿到的因子必须是真因子 ================= */
(function () {
  let bad = null, ok = 0, lucky = 0;
  for (let i = 0; i < SP.SEMIPRIMES.length && !bad; i++) {
    const N = SP.SEMIPRIMES[i];
    for (let a = 1; a < N; a++) {
      const rec = SP.attempt(N, a);
      if (!rec.ok) continue;
      if (rec.usedPeriod) ok++; else lucky++;
      if (rec.p * rec.q !== N) { bad = 'N=' + N + ' a=' + a + ' p·q ≠ N'; break; }
      if (rec.p <= 1 || rec.p >= N) { bad = 'N=' + N + ' a=' + a + ' 因子是平凡的'; break; }
      if (rec.p > rec.q) { bad = 'N=' + N + ' a=' + a + ' 没有按 p ≤ q 排序'; break; }
    }
  }
  T.eq(bad, null, '所有 ok 的尝试给出的都是真的非平凡因子');
  T.ok(ok > 10000, '靠周期查找成功的次数是 ' + ok + ' 次（这条断言真的转起来了）');
  T.ok(lucky > 0, 'gcd 就撞上因子的"运气好"分支也真的发生过（' + lucky + ' 次）');
})();

/* ================= 6. ⚠ 这个归约**不是**每次都成功 =================
   本仓的纪律：一句"零失败"在拿出负控之前不算数。这一节就是那个负控。
   两种失败必须都真的出现过，而且必须能说清它们为什么是失败。 */
(function () {
  let odd = 0, minus = 0, trivial = 0, total = 0;
  let oddSample = null, minusSample = null;
  let minusCheckOk = true, oddCheckOk = true;
  for (let i = 0; i < SP.SEMIPRIMES.length; i++) {
    const N = SP.SEMIPRIMES[i];
    for (let a = 1; a < N; a++) {
      if (C.gcd(a, N) !== 1) continue;
      total++;
      const rec = SP.attempt(N, a);
      if (rec.reason === 'odd-order') {
        odd++;
        if (!oddSample) oddSample = [N, a, rec.r];
        /* 奇数阶为什么走不下去：r/2 不是整数，a^(r/2) 根本没有定义。 */
        if (rec.r % 2 !== 1) oddCheckOk = false;
      } else if (rec.reason === 'minus-one') {
        minus++;
        if (!minusSample) minusSample = [N, a, rec.r];
        /* a^(r/2) ≡ −1 为什么走不下去：gcd(a^(r/2)−1, N) = gcd(N−2, N)，
           而那个数**是平凡的**。这一条把"这个检查不是装饰"钉死：
           少了它，页面会报告一个 1 或 N 当作因子。 */
        const half = C.modPow(a, rec.r / 2, N);
        const g = C.gcd(half - 1, N);
        if (half !== N - 1 || !(g === 1 || g === N)) minusCheckOk = false;
      } else if (rec.reason === 'trivial-gcd') {
        trivial++;
      }
    }
  }
  T.ok(odd > 0, '"r 是奇数"这种失败真的发生了 ' + odd + ' 次');
  T.ok(minus > 0, '"a^(r/2) ≡ −1"这种失败真的发生了 ' + minus + ' 次');
  T.ok(oddCheckOk, '每一个 odd-order 的 r 都确实是奇数');
  T.ok(minusCheckOk, '每一个 minus-one 上 gcd(a^(r/2)−1, N) 确实是平凡的（检查不是装饰）');
  T.eq(trivial, 0, 'trivial-gcd 一次都没发生（half² ≡ 1 且 half ≢ ±1 蕴含非平凡因子）');
  T.ok(odd + minus < total * 0.5, '失败的那一半没有反过来吃掉一半以上（定理下界）');
  T.ok(oddSample !== null && minusSample !== null,
       '两种失败各有一个具体样例：odd-order ' + JSON.stringify(oddSample) +
       '、minus-one ' + JSON.stringify(minusSample));
})();

/* ================= 7. 普查：分母、定理下界、可复现性 ================= */
(function () {
  const s15 = SP.survey(15);
  /* N = 15 的手算：(Z/15Z)* = {1,2,4,7,8,11,13,14}，8 个元素。
     a = 1（r = 1 是奇数）与 a = 14（a¹ ≡ −1）必然失败，其余六个都成功。
     这两个必然失败的元素**留在分母里**——剔掉它们能把 75% 说成 100%，
     而那正是这一页最不该给出的印象。 */
  T.eq(s15.tried, 8, 'N = 15 的分母是整个 (Z/15Z)*，8 个元素');
  T.eq(s15.factored, 6, 'N = 15 上 6 个 a 靠周期查找拿到了因子');
  T.eq(s15.byReason['odd-order'], 1, 'N = 15 上恰有一个 a（就是 a = 1）阶为奇');
  T.eq(s15.byReason['minus-one'], 1, 'N = 15 上恰有一个 a（就是 a = 14）落在 −1 上');
  T.eq(s15.rate, 0.75, 'N = 15 的成功率是 6/8 = 0.75，不是 1');
  T.eq(SP.theoryFloor(2), 0.5, 'k = 2 时定理下界是 1/2');

  let belowFloor = null, ratesAllOne = true, worst = 1, best = 0;
  for (let i = 0; i < SP.SEMIPRIMES.length; i++) {
    const N = SP.SEMIPRIMES[i];
    const s = SP.survey(N);
    if (s.rate < SP.theoryFloor(2)) belowFloor = N + '→' + s.rate;
    if (s.rate < 1) ratesAllOne = false;
    if (s.rate < worst) worst = s.rate;
    if (s.rate > best) best = s.rate;
  }
  T.eq(belowFloor, null, '每一档 N 的实测成功率都不低于定理下界 1/2');
  T.ok(!ratesAllOne, '不是每一档都 100%（最低 ' + worst.toFixed(4) +
       '、最高 ' + best.toFixed(4) + '）——"永远成功"会是一个红旗');
})();

/* 分帧推进必须与一口气跑完给出**同一个**结果。页面走的是 start/step 那条路，
   测试与核实脚本走的是 survey() 那条；两条路给出两个成功率的话，报告里的
   那个数字就不是页面上显示的那个。 */
(function () {
  let bad = null;
  for (const N of [15, 143, 1189, 3599]) {
    const whole = SP.survey(N);
    const st = SP.surveyStart(N);
    let frames = 0;
    while (!st.done) { SP.surveyStep(st, 37); frames++; }   // 37：故意不整除 φ(N)
    delete st.list; delete st.cursor;
    if (JSON.stringify(st) !== JSON.stringify(whole)) bad = 'N=' + N;
    if (N === 3599 && frames < 10) bad = 'N=3599 只用了 ' + frames + ' 帧，预算没起作用';
  }
  T.eq(bad, null, '分帧普查与一口气跑完逐字节相同（且预算真的把它切成了很多帧）');
  /* 中途读到的 rate 必须是"到目前为止"的真比例，不是占位符。 */
  const st = SP.surveyStart(3599);
  SP.surveyStep(st, 100);
  T.eq(st.tried, 100, '推进 100 步后分母就是 100');
  T.eq(st.rate, st.factored / 100, '中途的 rate 是到目前为止的真实比例');
  T.ok(!st.done, '3599 的普查不可能在 100 步内跑完');
})();

/* 抽样路径：同种子逐字节可复现；换种子结果会变（否则说明 rng 根本没被用上）。 */
(function () {
  const a1 = SP.survey(3599, { samples: 400, rng: makeRng(20260810) });
  const a2 = SP.survey(3599, { samples: 400, rng: makeRng(20260810) });
  const b = SP.survey(3599, { samples: 400, rng: makeRng(7) });
  T.eq(JSON.stringify(a1), JSON.stringify(a2), '同种子的抽样普查逐字节相同');
  T.ok(a1.sampled === true, '抽样普查自报 sampled');
  T.ok(JSON.stringify(a1) !== JSON.stringify(b), '换种子结果会变（rng 真的被用上了）');
  T.eq(a1.tried, 400, '抽样普查的分母就是 samples');
  /* 抽样值应当围着穷举值转。3599 = 59·61 上穷举值是确定的，
     400 个样本的偏差在几个百分点内。 */
  const full = SP.survey(3599);
  T.ok(Math.abs(a1.rate - full.rate) < 0.08,
       '400 个样本的成功率贴近穷举值（抽样 ' + a1.rate.toFixed(4) +
       ' vs 穷举 ' + full.rate.toFixed(4) + '）');
})();

/* ================= 8. 代价模型 ================= */
T.ok(Math.abs(SP.GNFS_C - 1.9229994270765444) < 1e-12, 'GNFS 的常数是 (64/9)^(1/3)');
T.eq(SP.log2Cost('trial-division', 2048), 1024, '试除的指数是 n/2');
T.eq(SP.log2Cost('rho', 256), 128, 'Pollard rho 打 256 比特群是 2¹²⁸');
T.eq(SP.log2Cost('naive-period', 2048), 2048, '朴素周期扫描的指数是 n');
T.eq(SP.log2Cost('shor', 2048), 33, 'n³ 模型在 2048 比特上是 2³³（3·log₂2048 = 33）');
(function () {
  const g2048 = SP.log2Cost('gnfs', 2048);
  const g4096 = SP.log2Cost('gnfs', 4096);
  const g1024 = SP.log2Cost('gnfs', 1024);
  T.ok(g2048 > 110 && g2048 < 125,
       'GNFS 在 2048 比特上给出 2^' + g2048.toFixed(1) + '（渐近式，公开估计约 2¹¹²）');
  /* 次指数的判定性质：位长翻倍，指数**不到**翻倍。试除那条正好翻倍，
     两者放在一起，"次指数"就不是一个形容词而是一个可判定的比值。 */
  T.ok(g4096 / g2048 < 1.6, 'GNFS 是次指数的：位长翻倍，指数只涨 ' +
       (g4096 / g2048).toFixed(3) + ' 倍');
  T.eq(SP.log2Cost('trial-division', 4096) / SP.log2Cost('trial-division', 2048), 2,
       '而试除是指数的：位长翻倍，指数正好翻倍');
  T.ok(g1024 < g2048 && g2048 < g4096, 'GNFS 随位长单调增');
  /* Shor 的曲线在任何有意义的位长上都远低于最好的经典算法。 */
  T.ok(SP.log2Cost('shor', 2048) < g2048 - 80,
       'Shor 的 n³ 模型（2³³）比 GNFS（2^' + g2048.toFixed(0) + '）低八十个数量级以上');
})();
(function () {
  let mono = true;
  for (let i = 0; i < SP.COST_MODELS.length; i++) {
    const m = SP.COST_MODELS[i];
    for (let b = 16; b < 8192; b *= 2) {
      if (!(SP.log2Cost(m, b) < SP.log2Cost(m, b * 2))) mono = false;
    }
  }
  T.ok(mono, '五条代价曲线全部随位长单调增');
})();

/* ================= 9. Grover：指数减半，不是被打破 ================= */
(function () {
  const g128 = SP.groverCost(128), g256 = SP.groverCost(256);
  T.eq(g128.classicalLog2, 128, 'AES-128 经典穷举 2¹²⁸');
  T.eq(g128.quantumLog2, 64, 'AES-128 的 Grover 是 2⁶⁴ —— 少一半密钥比特');
  T.eq(g256.quantumLog2, 128, 'AES-256 的 Grover 是 2¹²⁸ —— 仍在够不着的地方');
  /* √(2¹²⁸) = 2⁶⁴ 在双精度里是**精确**成立的，两边都是 2 的整数次幂。
     这条断言把页面上那句话钉在算术上，而不是钉在文案上。 */
  T.eq(Math.sqrt(Math.pow(2, 128)), Math.pow(2, 64), '√(2¹²⁸) 精确等于 2⁶⁴');
  T.eq(g128.parallelExponent, 0.5,
       'Grover 并行得很差：S 台机器只把时间除以 √S（经典是除以 S）');
  T.eq(SP.groverCost(3).quantumLog2, 1.5, '奇数比特数不取整——1.5 是真值，取整会撒谎');
})();

/* ================= 10. 入口守卫 ================= */
T.throws(function () { SP.periodOf(1, 2); }, 'N 必须 ≥ 3', /N 必须 ≥ 3/);
/* N = 4 是合法模数（periodOf 不要求 N 为奇——奇合数那条只是**归约**的前提，
   由 classify 把关）。gcd(2,4) ≠ 1，所以这里返回 null 而不是抛。 */
T.eq(SP.periodOf(2, 4), null, 'periodOf 本身不挑奇偶，只挑互素');
T.eq(SP.periodOf(3, 4).r, 2, 'ord_4(3) = 2');
T.throws(function () { SP.periodOf(2, SP.MAX_N + 1); }, 'N 超上界必须抛', /不能超过/);
T.throws(function () { SP.orbit(2, 15, 0); }, 'orbit 的 count 必须 ≥ 1', /count 必须是/);
T.throws(function () { SP.orbit(2, 15, 99999); }, 'orbit 的 count 有上界', /count 必须是/);
T.throws(function () { SP.log2Cost('quantum-magic', 2048); }, '未知代价模型必须抛', /未知的代价模型/);
T.throws(function () { SP.log2Cost('gnfs', 4); }, '位长下界', /位长必须落在/);
T.throws(function () { SP.groverCost(1.5); }, 'groverCost 只吃整数比特数', /必须是 1…/);
T.throws(function () { SP.theoryFloor(1); }, '定理下界至少要两个相异素因子', /必须是 ≥ 2 的整数/);
T.throws(function () { SP.survey(SP.SURVEY_MAX_N + 1); }, '穷举普查有 N 上界', /不能超过/);
T.throws(function () { SP.survey(3599, { samples: 10 }); }, '抽样普查必须注入 rng',
         /需要注入 rng/);
T.throws(function () { SP.survey(3599, { samples: 10, rng: function () { return 1; } }); },
         'rng 返回 1 必须当场拒（[0,1) 是半开区间）', /必须落在 \[0,1\)/);
T.throws(function () { SP.classify(1.5); }, '非整数 N 必须抛', /必须是安全整数/);

/* ================= 11. bitsOf ================= */
T.eq(SP.bitsOf(15), 4, '15 是 4 比特');
T.eq(SP.bitsOf(16), 5, '16 是 5 比特');
T.eq(SP.bitsOf(255), 8, '255 是 8 比特');
T.eq(SP.bitsOf(256), 9, '256 是 9 比特');

/* ================= 12. 浏览器分支：CryptoAlgos 上挂得对 =================
   UMD 的两条分支只有 node 那条被上面的断言覆盖。页面跑的是另一条，而
   check.py 的 algos_gate 只检查"挂上了且有函数"——挂错了键名它一样报绿。
   这里在裸 vm 里把浏览器分支跑一遍，并核对键名与依赖捕获。 */
(function () {
  const vm = require('vm');
  const fs = require('fs');
  const path = require('path');
  const sandbox = {}; sandbox.self = sandbox; sandbox.console = console;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'crypto-core.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'rsa.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'shor-period.js'), 'utf8'), sandbox);
  T.eq(typeof sandbox.module, 'undefined', '沙箱是裸的：没有 module（否则测的还是 node 分支）');
  const mod = sandbox.CryptoAlgos && sandbox.CryptoAlgos['shor-period'];
  T.ok(!!mod, '浏览器分支把模块挂到了 CryptoAlgos["shor-period"]');
  T.eq(mod.attempt(15, 2).p, 3, '浏览器分支上 attempt(15, 2) 给出因子 3');
  T.eq(mod.survey(15).rate, 0.75, '浏览器分支上的普查与 node 分支一致');
  /* rsa 依赖是**加载时**捕获的。顺序写反时 RS 会是 undefined，模块照样挂得上，
     要到第一次调用 classify 才炸——check.py 的 algos_dep_order_check 守的就是
     这条边，这里在模块自己的测试里也留一个证据。 */
  T.eq(mod.classify(97).reason, 'n-prime', '浏览器分支上 rsa 依赖真的被捕获到了');
})();

T.report('shor-period');
