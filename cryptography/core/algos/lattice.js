(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录：路径用 path.join 拼，不写字面的父目录相对路径。
       理由与 hill.js / diffie-hellman.js 完全同源——那个字符串会被
       inline_core.py 原样内联进工具页，而 check.py 的 outbound_ref_check()
       正在数整个子树里的父目录引用，用它守住「cryptography/ 可以整体搬走」
       这条约束。浏览器分支根本走不到这一行。 */
    module.exports = factory(
      require(require('path').join(__dirname, '..', 'crypto-core.js')),
      require(require('path').join(__dirname, 'diffie-hellman.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.lattice = factory(root.CryptoCore, root.CryptoAlgos['diffie-hellman']);
  }
})(typeof self !== 'undefined' ? self : this, function (C, DH) {
  'use strict';

  /* ================= 格 · LWE · 以及「周期」这个对照面 =================

     这个文件服务于一句话：**后量子密码不是「更强的」密码，而是建立在
     另一种形状的困难问题上的密码。** 它要把这句话拆成三件能被算出来的事。

     ① 同一个格，两种描述。
        基 B 与 B′ = B·U（U 是整数矩阵、|det U| = 1）生成**同一个点集**。
        用一组短而近正交的基，最近格点一眼可见；换一组长而歪斜的基，
        同样的问题连看都看不见。差的不是格，是你手里对它的描述——
        这个落差就是陷门本身。
     ② LWE 的全部安全性压在一个加上去的噪声项上。
        b = A·s (mod q) 是一年级线性代数，高斯消元当场还原 s；
        b = A·s + e (mod q) 里 e 只有 ±1，同一个求解器立刻失效。
        本文件把两侧都实现出来，让它们互为对照实验：**没有噪声那一侧
        必须成功**，否则失败的是求解器而不是 LWE 难。
     ③ 周期这个对照面。
        RSA / DH 的困难点藏着一个**周期**：f(x) = aˣ mod N 在 x 上以 r 重复，
        而 Shor 的量子傅立叶变换正是找周期的机器。找到 r，gcd 一步交出因子。
        本文件的 periodOf / shorPayload 把这条链路真的算出来（N 很小，
        这里用最笨的办法找 r —— 量子那一步在这一页里没有被模拟，被模拟的是
        「找到 r 之后会发生什么」）。

     ⚠ 玩具参数。这里的格是二维的、LWE 的 n 只有个位数、q 是两位数的素数。
     真实方案的 n 在几百、q 在几千以上，还带环结构与精心选择的误差分布。
     这个文件不实现任何可部署的 KEM，也不该被当成一个。

     ⚠ 一句不能说的话：这里没有任何东西**证明**格问题难，也没有任何东西
     证明后量子方案在量子计算机面前安全。诚实的表述只有一句——目前没有
     已知的高效量子算法能解它们。这比 RSA 失去的那样东西弱得多：
     RSA 不是「暂时没人会」，是 Shor 明确地会。

     ---- 为什么整数矩阵运算不走 crypto-core ----
     core 的 matMul / matDet / matInverse 全部是**模 n** 的（签名里那个 n 是
     模数，不是阶数）。格活在 ℤ 上：det = 27 与 det = 1 在模 26 下是同一个数，
     而「|det U| = 1」正是幺模性的全部内容——把它模掉，这一页要讲的东西就没了。
     所以下面另写了 2×2 的整数版本，并且**只写 2×2**：多写一维就是多一份
     没有调用方的实现。模 q 的那一半（LWE）照常走 core 的 mod / modInverse。 */

  /* ================= 二维整数矩阵 =================
     约定：矩阵按行主序写，**列是基向量**。
       B = [[b1x, b2x],
            [b1y, b2y]]
     格点 = B·c，c 是整数列向量。选列而不是行，是为了让 B′ = B·U 这条
     幺模变换写成右乘——列变换（换列、某列减另一列的整数倍）正好对应
     右乘一个幺模矩阵，与 gaussReduce 里做的操作一一对应。 */

  function require2x2(M, name) {
    if (!Array.isArray(M) || M.length !== 2 ||
        !Array.isArray(M[0]) || M[0].length !== 2 ||
        !Array.isArray(M[1]) || M[1].length !== 2) {
      throw new Error('lattice：' + name + ' 必须是 2×2 的数组');
    }
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        if (!Number.isInteger(M[i][j])) {
          throw new Error('lattice：' + name + ' 的元素 [' + i + '][' + j + '] 不是整数：' + M[i][j]);
        }
      }
    }
    return M;
  }

  /* 整数行列式。**不是** core 的 matDet —— 那个返回 det mod n。 */
  function detInt(B) {
    require2x2(B, 'detInt 的矩阵');
    return B[0][0] * B[1][1] - B[0][1] * B[1][0];
  }

  /* 幺模 ⟺ |det| = 1 ⟺ 逆矩阵也是整数矩阵。这正是「换一组基，格不变」的
     判据：B 与 B·U 生成同一个点集，当且仅当 U 幺模。 */
  function isUnimodular(U) { return Math.abs(detInt(U)) === 1; }

  function matMulInt(A, B) {
    require2x2(A, 'matMulInt 的左矩阵');
    require2x2(B, 'matMulInt 的右矩阵');
    return [
      [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
      [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]
    ];
  }

  const IDENT = [[1, 0], [0, 1]];

  function matPowInt(U, k) {
    require2x2(U, 'matPowInt 的矩阵');
    if (!Number.isInteger(k) || k < 0) {
      throw new Error('lattice：matPowInt 的指数必须是非负整数，收到 ' + k);
    }
    let r = [[1, 0], [0, 1]];
    for (let i = 0; i < k; i++) r = matMulInt(r, U);
    return r;
  }

  /* 剪切矩阵 [[1,k],[0,1]]，det 恒为 1。工具页用它做一条「同一个格、
     描述越来越糟」的连续滑杆：k 每加一，第二个基向量就沿第一个滑出去一步，
     格点集一个都没动。选剪切而不是 Fibonacci 那种 [[1,1],[1,2]]，是因为
     后者的基向量按指数长大，三步就长出画布；剪切是线性增长，肉眼能一路跟。 */
  function shearU(k) {
    if (!Number.isInteger(k)) throw new Error('lattice：shearU 的参数必须是整数，收到 ' + k);
    return [[1, k], [0, 1]];
  }

  /* ================= 格点与坐标 ================= */

  function apply(B, c) {
    require2x2(B, 'apply 的基');
    if (!Array.isArray(c) || c.length !== 2 ||
        !Number.isInteger(c[0]) || !Number.isInteger(c[1])) {
      throw new Error('lattice：apply 的系数必须是两个整数');
    }
    return [B[0][0] * c[0] + B[0][1] * c[1], B[1][0] * c[0] + B[1][1] * c[1]];
  }

  /* 解 B·c = t 得到**实数**系数。这是 Babai 取整法的第一步，也是「用哪组基
     去看这个目标」这句话的字面意思：同一个 t，在不同的基下坐标完全不同。 */
  function coordsOf(B, t) {
    require2x2(B, 'coordsOf 的基');
    const d = detInt(B);
    if (d === 0) throw new Error('lattice：基退化（det = 0），它张不出一个二维格');
    return [
      (B[1][1] * t[0] - B[0][1] * t[1]) / d,
      (-B[1][0] * t[0] + B[0][0] * t[1]) / d
    ];
  }

  /* Babai 取整（round-off）：把实数坐标就近取整，回代得到一个格点。
     它就是「用你手里这组基去猜最近点」这件事的全部——好基下几乎总对，
     坏基下经常离谱。工具页第一个页签量的正是这个成功率。

     Math.round 在 .5 上向 +∞ 取整，这在这里无所谓（目标点由滑杆或随机数
     给出，恰好落在半整数坐标上是零测集），但写下来免得日后被当成 bug。 */
  function babai(B, t) {
    const c = coordsOf(B, t);
    const ci = [Math.round(c[0]), Math.round(c[1])];
    return { coords: c, c: ci, point: apply(B, ci) };
  }

  function norm2(v) { return v[0] * v[0] + v[1] * v[1]; }
  function dist2(a, b) { const dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; }
  function dist(a, b) { return Math.sqrt(dist2(a, b)); }

  /* ================= Lagrange–Gauss 约化 =================
     二维格的「好基」有一个干净的定义，也有一个五行的算法：
       重复 { 若 |b2| < |b1| 则交换；μ = round(⟨b1,b2⟩/⟨b1,b1⟩)；
              若 μ = 0 则停；b2 ← b2 − μ·b1 }
     停下来时 b1 是格里最短的非零向量，b2 是与它无关的次短——这在二维是
     **定理**，不是启发式（高维的 LLL 才只能给出近似）。

     两种操作各自对应一个幺模的右乘矩阵，所以顺手把 U 也累起来：
       换列       U = [[0,1],[1,0]]，det = −1
       b2 −= μ·b1 U = [[1,−μ],[0,1]]，det = 1
     返回的 U 满足 reduced = B·U，于是「约化前后是同一个格」不是一句口号，
     而是一个可以当场验的等式（见 lattice.test.js 里对 isUnimodular(U) 与
     sameLattice 的断言）。

     迭代上限：二维 Gauss 约化的步数是 O(log(最长基向量))，128 步对任何
     能被本页画出来的基都是天文数字的余量。留这个上限不是怕它不收敛，
     是怕将来有人传进一个退化基让 draw() 里的一帧变成死循环。 */
  const REDUCE_MAX_STEPS = 128;

  function gaussReduce(B) {
    require2x2(B, 'gaussReduce 的基');
    if (detInt(B) === 0) throw new Error('lattice：基退化（det = 0），无法约化');
    let R = [[B[0][0], B[0][1]], [B[1][0], B[1][1]]];
    let U = [[1, 0], [0, 1]];
    let steps = 0;
    for (;;) {
      if (steps++ > REDUCE_MAX_STEPS) {
        throw new Error('lattice：gaussReduce 超过 ' + REDUCE_MAX_STEPS + ' 步仍未收敛');
      }
      const b1 = [R[0][0], R[1][0]], b2 = [R[0][1], R[1][1]];
      if (norm2(b2) < norm2(b1)) {
        R = [[R[0][1], R[0][0]], [R[1][1], R[1][0]]];
        U = matMulInt(U, [[0, 1], [1, 0]]);
        continue;
      }
      const n1 = norm2(b1);
      if (n1 === 0) throw new Error('lattice：基里出现了零向量');
      const mu = Math.round((b1[0] * b2[0] + b1[1] * b2[1]) / n1);
      if (mu === 0) break;
      R = [[R[0][0], R[0][1] - mu * R[0][0]], [R[1][0], R[1][1] - mu * R[1][0]]];
      U = matMulInt(U, [[1, -mu], [0, 1]]);
    }
    return { B: R, U: U, steps: steps - 1 };
  }

  /* ================= 精确最近向量（CVP） =================
     先约化到 R = B·U，在 R 下做一次 Babai，再在它周围 ±WINDOW 的整数格里
     全枚举取最小。二维约化基下 Babai 的偏差被基的正交缺陷卡死，±3 是
     极其宽松的窗口（lattice.test.js 里拿 ±30 的暴力枚举把它钉过一遍）。

     关键性质：**最近点与你用哪组基无关**。closest(B, t) 与
     closest(B·U, t) 必须给出同一个点——它是格的性质，不是描述的性质。
     整个第一个页签讲的就是这件事：难的从来不是问题，是描述。 */
  const CVP_WINDOW = 3;

  function closest(B, t) {
    const red = gaussReduce(B);
    const R = red.B;
    const base = babai(R, t).c;
    let best = null, bestD = Infinity, bestC = null;
    for (let i = -CVP_WINDOW; i <= CVP_WINDOW; i++) {
      for (let j = -CVP_WINDOW; j <= CVP_WINDOW; j++) {
        const c = [base[0] + i, base[1] + j];
        const p = apply(R, c);
        const d = dist2(p, t);
        if (d < bestD) { bestD = d; best = p; bestC = c; }
      }
    }
    /* 系数换回原基：R = B·U ⟹ B·(U·c) = R·c，所以原基下的系数是 U·c。 */
    return { point: best, dist: Math.sqrt(bestD), coords: apply(red.U, bestC), reduced: R };
  }

  /* ================= 同一个格的两种描述 =================
     不是断言，是普查：把 [−half, half]² 里 B 生成的全部格点列出来，
     再把 B′ 的列出来，逐个比。相等 ⟺ 在这个有界区域内两组基生成同一个点集。

     系数范围由 B⁻¹ 作用在盒子四角上界定：|c_i| ≤ half·(|Binv[i][0]| + |Binv[i][1]|)，
     再加一格余量。盒子是有界的，所以这是一次**完全**枚举，不是抽样。 */
  function pointsInBox(B, half) {
    require2x2(B, 'pointsInBox 的基');
    if (!Number.isInteger(half) || half < 1) {
      throw new Error('lattice：pointsInBox 的 half 必须是正整数，收到 ' + half);
    }
    const d = detInt(B);
    if (d === 0) throw new Error('lattice：基退化（det = 0）');
    const inv = [[B[1][1] / d, -B[0][1] / d], [-B[1][0] / d, B[0][0] / d]];
    const lim = [
      Math.ceil(half * (Math.abs(inv[0][0]) + Math.abs(inv[0][1]))) + 1,
      Math.ceil(half * (Math.abs(inv[1][0]) + Math.abs(inv[1][1]))) + 1
    ];
    const out = [];
    for (let i = -lim[0]; i <= lim[0]; i++) {
      for (let j = -lim[1]; j <= lim[1]; j++) {
        const x = B[0][0] * i + B[0][1] * j;
        const y = B[1][0] * i + B[1][1] * j;
        if (x >= -half && x <= half && y >= -half && y <= half) out.push(x + ',' + y);
      }
    }
    out.sort();
    return out;
  }

  function sameLattice(B1, B2, half) {
    const a = pointsInBox(B1, half), b = pointsInBox(B2, half);
    const sa = new Set(a), sb = new Set(b);
    const onlyA = a.filter(function (p) { return !sb.has(p); });
    const onlyB = b.filter(function (p) { return !sa.has(p); });
    return {
      equal: onlyA.length === 0 && onlyB.length === 0 && a.length === b.length,
      half: half, countA: a.length, countB: b.length,
      onlyA: onlyA, onlyB: onlyB
    };
  }

  /* Babai 取整在随机目标上的命中率。**注入 rng**，一次 Math.random 都不碰：
     这个数字是要被写进报告的，不可复现的测量等于没测。 */
  function cvpTrials(o) {
    o = o || {};
    const B = require2x2(o.B, 'cvpTrials 的基');
    const rng = requireRng(o.rng, 'cvpTrials');
    const count = intOpt(o.count, 500, 'cvpTrials 的 count');
    const span = o.span == null ? 12 : o.span;
    let hits = 0;
    let worst = 0;
    for (let i = 0; i < count; i++) {
      const t = [(rng() * 2 - 1) * span, (rng() * 2 - 1) * span];
      const g = babai(B, t).point;
      const best = closest(B, t);
      if (g[0] === best.point[0] && g[1] === best.point[1]) hits++;
      else worst = Math.max(worst, dist(g, t) - best.dist);
    }
    return { count: count, hits: hits, rate: hits / count, span: span, worstExcess: worst };
  }

  /* ================= LWE =================
     b = A·s + e (mod q)。A 是 m×n 的公开随机矩阵，s 是长度 n 的秘密，
     e 是每个分量都很小的误差。去掉 e，这就是一个线性方程组，高斯消元当场解出 s；
     加上 e，同一个求解器立刻没用——**全部的安全性就是这一项**。

     q 取素数，理由必须写下来：ℤ_q 只有在 q 是素数时才是域，高斯消元里
     「拿主元去除」这一步才总是做得到。q 合数时消元会撞上不可逆主元，
     那时失败的是求解器而不是 LWE ——而本文件的两侧互为对照实验，
     一侧因为工具坏了而失败，整个对照就废了。 */

  function requireRng(rng, who) {
    if (typeof rng !== 'function') {
      throw new Error('lattice：' + who + ' 需要注入一个 rng 函数（返回 [0,1) 的数）。' +
                      '本模块一次都不碰 Math.random —— 测量必须可复现。');
    }
    return rng;
  }

  function intOpt(v, dflt, name) {
    if (v == null) return dflt;
    if (!Number.isInteger(v) || v < 1) throw new Error('lattice：' + name + ' 必须是正整数，收到 ' + v);
    return v;
  }

  function requirePrimeModulus(q) {
    if (!Number.isInteger(q) || q < 2) {
      throw new Error('lattice：模数 q 必须是 ≥ 2 的整数，收到 ' + q);
    }
    /* 素性判定借 diffie-hellman 的 isPrime，不新写第二份：同一个仓库里
       两份素性判定早晚会给出两个答案，而那天没人知道该信哪个。
       这条依赖也是本模块在 GENERATED:ALGOS 清单里必须排在
       diffie-hellman.js 之后的原因（check.py 的依赖顺序门静态地看得见它）。 */
    if (!DH.isPrime(q)) {
      throw new Error('lattice：模数 q 必须是素数（ℤ_q 得是域，高斯消元才总能除得动），' +
                      q + ' 不是');
    }
    /* 中间量是 q²，Number 路径的安全上界是 floor(√(2⁵³−1))。玩具参数离它
       十万八千里，这条界是给「有人手滑传了个大 q」准备的。 */
    if (q > 94906265) {
      throw new Error('lattice：模数 q 不能超过 94906265（q² 会越过 2⁵³，中间量静默算错），收到 ' + q);
    }
    return q;
  }

  function randomInt(rng, q) {
    const v = Math.floor(rng() * q);
    return v < 0 ? 0 : (v >= q ? q - 1 : v);
  }

  function randomMatrix(m, n, q, rng) {
    requirePrimeModulus(q);
    requireRng(rng, 'randomMatrix');
    const out = [];
    for (let i = 0; i < m; i++) {
      const row = [];
      for (let j = 0; j < n; j++) row.push(randomInt(rng, q));
      out.push(row);
    }
    return out;
  }

  function randomVector(n, q, rng) {
    requirePrimeModulus(q);
    requireRng(rng, 'randomVector');
    const out = [];
    for (let i = 0; i < n; i++) out.push(randomInt(rng, q));
    return out;
  }

  /* 误差：每个分量独立均匀取自 {−bound, …, +bound}。
     均匀而不是离散高斯，是一个刻意的教学简化——真实方案用离散高斯或
     中心二项分布，因为安全归约要求误差分布有特定的形状。均匀分布足以
     让这一页要演示的那件事（消元当场失效）成立，而且它在画面上是可以
     一个数一个数读出来的。这个简化必须说出来，不能装作没有。 */
  function errorVector(m, bound, rng) {
    requireRng(rng, 'errorVector');
    if (!Number.isInteger(bound) || bound < 0) {
      throw new Error('lattice：误差界 bound 必须是非负整数，收到 ' + bound);
    }
    const out = [];
    const span = 2 * bound + 1;
    for (let i = 0; i < m; i++) out.push(Math.floor(rng() * span) - bound);
    return out;
  }

  /* A·s (mod q)。走 core 的 matMul（它不限方阵），把 s 立成列向量。
     不自己写一层循环：模 q 的矩阵乘法在 core 里已经被测过，
     这里再写一遍就是第二份实现。 */
  function mulModQ(A, s, q) {
    const col = s.map(function (v) { return [v]; });
    const prod = C.matMul(A, col, q);
    return prod.map(function (r) { return r[0]; });
  }

  function instance(o) {
    o = o || {};
    const q = requirePrimeModulus(o.q);
    const n = intOpt(o.n, 4, 'instance 的 n');
    const m = intOpt(o.m, n + 2, 'instance 的 m');
    const rng = requireRng(o.rng, 'instance');
    const bound = o.bound == null ? 1 : o.bound;
    const noise = o.noise !== false;
    const A = o.A || randomMatrix(m, n, q, rng);
    const s = o.s || randomVector(n, q, rng);
    if (s.length !== n) throw new Error('lattice：给定的 s 长度应为 ' + n + '，收到 ' + s.length);
    const e = noise ? errorVector(m, bound, rng) : new Array(m).fill(0);
    const as = mulModQ(A, s, q);
    const b = as.map(function (v, i) { return C.mod(v + e[i], q); });
    return { A: A, s: s, e: e, b: b, as: as, n: n, m: m, q: q, bound: bound, noise: noise };
  }

  /* ================= 高斯消元 mod q =================
     对增广矩阵 [A | b] 做完整的行化简（RREF），然后分三种结局报告：
       inconsistent    出现了 0 = c (c ≠ 0) 这样的一行 —— 方程组无解。
                       **超定方程组遇上误差时的正常结局**，不是求解器坏了。
       underdetermined 秩不足 n，解不唯一。
       ok              秩为 n 且相容 —— 唯一解，直接读出来。
     把三者分开报，是因为这一页要用它们讲不同的话：无噪声时必须永远是 ok，
     加了噪声之后绝大多数是 inconsistent，而**这两句话互为对照**。 */
  function solve(A, b, q) {
    requirePrimeModulus(q);
    if (!Array.isArray(A) || A.length === 0) throw new Error('lattice：solve 的 A 必须是非空矩阵');
    const m = A.length, n = A[0].length;
    if (!Array.isArray(b) || b.length !== m) {
      throw new Error('lattice：solve 的 b 长度应为 ' + m + '，收到 ' + (Array.isArray(b) ? b.length : typeof b));
    }
    const M = [];
    for (let i = 0; i < m; i++) {
      if (!Array.isArray(A[i]) || A[i].length !== n) {
        throw new Error('lattice：solve 的 A 第 ' + i + ' 行长度与第 0 行不齐');
      }
      const row = [];
      for (let j = 0; j < n; j++) row.push(C.mod(A[i][j], q));
      row.push(C.mod(b[i], q));
      M.push(row);
    }
    const pivotOf = [];               // 每个主元列对应的行号
    let r = 0;
    for (let col = 0; col < n && r < m; col++) {
      let sel = -1;
      for (let i = r; i < m; i++) if (M[i][col] !== 0) { sel = i; break; }
      if (sel < 0) continue;          // 这一列没有主元 —— 自由变量
      const tmp = M[r]; M[r] = M[sel]; M[sel] = tmp;
      const inv = C.modInverse(M[r][col], q);
      if (inv === null) {
        /* q 是素数、M[r][col] ≠ 0 时这一支不可达；留着是因为「不可达」
           是一个推论而不是一条断言，而静默走错比抛出来贵得多。 */
        throw new Error('lattice：主元 ' + M[r][col] + ' 在模 ' + q + ' 下不可逆——q 不是素数？');
      }
      for (let j = col; j <= n; j++) M[r][j] = C.mod(M[r][j] * inv, q);
      for (let i = 0; i < m; i++) {
        if (i === r || M[i][col] === 0) continue;
        const f = M[i][col];
        for (let j = col; j <= n; j++) M[i][j] = C.mod(M[i][j] - f * M[r][j], q);
      }
      pivotOf.push(col);
      r++;
    }
    for (let i = r; i < m; i++) {
      if (M[i][n] !== 0) {
        return { s: null, reason: 'inconsistent', rank: r, rows: M, pivots: pivotOf };
      }
    }
    if (pivotOf.length < n) {
      return { s: null, reason: 'underdetermined', rank: r, rows: M, pivots: pivotOf };
    }
    const s = new Array(n).fill(0);
    for (let i = 0; i < pivotOf.length; i++) s[pivotOf[i]] = M[i][n];
    return { s: s, reason: 'ok', rank: r, rows: M, pivots: pivotOf };
  }

  /* 「只取最早的 n 行独立方程、不检查相容」的那种攻击。
     它存在的理由是诚实：超定方程组在有误差时几乎必然不相容，于是 solve()
     的成功率会是一个漂亮的 0——但那个 0 有一部分是「我们主动检查了相容性」
     换来的，不全是 LWE 的功劳。这个变体不检查，它的成功率有一个可以事先
     算出来的预言值：**当且仅当被用到的那 n 行恰好误差为零时它才对**，
     所以成功率 ≈ P(e = 0)ⁿ。测出来的数字与这个预言对得上，才说明失败的
     机理被理解了，而不只是被观察到了。 */
  function solveFirstRows(A, b, q, n) {
    requirePrimeModulus(q);
    const m = A.length;
    const cols = A[0].length;
    if (n == null) n = cols;
    const M = [];
    const used = [];
    let rank = 0;
    for (let i = 0; i < m && rank < cols; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) row.push(C.mod(A[i][j], q));
      row.push(C.mod(b[i], q));
      /* 用已有的主元行把这一行打薄，看它还剩不剩下非零系数。 */
      for (let k = 0; k < M.length; k++) {
        const pc = used[k].col;
        const f = row[pc];
        if (f === 0) continue;
        for (let j = 0; j <= cols; j++) row[j] = C.mod(row[j] - f * M[k][j], q);
      }
      let pc = -1;
      for (let j = 0; j < cols; j++) if (row[j] !== 0) { pc = j; break; }
      if (pc < 0) continue;           // 与前面的行线性相关，丢掉
      const inv = C.modInverse(row[pc], q);
      for (let j = pc; j <= cols; j++) row[j] = C.mod(row[j] * inv, q);
      for (let k = 0; k < M.length; k++) {
        const f = M[k][pc];
        if (f === 0) continue;
        for (let j = 0; j <= cols; j++) M[k][j] = C.mod(M[k][j] - f * row[j], q);
      }
      M.push(row);
      used.push({ row: i, col: pc });
      rank++;
    }
    if (rank < cols) return { s: null, reason: 'underdetermined', rank: rank, used: used };
    const s = new Array(cols).fill(0);
    for (let k = 0; k < M.length; k++) s[used[k].col] = M[k][cols];
    return { s: s, reason: 'ok', rank: rank, used: used };
  }

  function sameVec(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /* 对一个实例跑两种攻击，并如实报告「有没有精确还原 s」。
     不报「差得远不远」：LWE 攻击成功的定义是**一个比特都不差**，
     「差一点」和「完全不知道」在密码学上是同一件事。 */
  function attack(inst) {
    const full = solve(inst.A, inst.b, inst.q);
    const first = solveFirstRows(inst.A, inst.b, inst.q, inst.n);
    return {
      full: full, first: first,
      fullExact: sameVec(full.s, inst.s),
      firstExact: sameVec(first.s, inst.s)
    };
  }

  function trials(o) {
    o = o || {};
    const q = requirePrimeModulus(o.q);
    const n = intOpt(o.n, 4, 'trials 的 n');
    const m = intOpt(o.m, n + 2, 'trials 的 m');
    const rng = requireRng(o.rng, 'trials');
    const count = intOpt(o.count, 200, 'trials 的 count');
    const bound = o.bound == null ? 1 : o.bound;
    const noise = o.noise !== false;
    const acc = {
      count: count, n: n, m: m, q: q, bound: bound, noise: noise,
      fullExact: 0, firstExact: 0,
      inconsistent: 0, underdetermined: 0, solvedWrong: 0,
      cleanRows: 0,                 // firstRows 用到的那几行恰好全无误差的次数
      zeroError: 0,                 // 整条 e 恰好全是 0 的次数（(2·bound+1)^(−m) 的实测值）
      /* 「误差非零却仍然精确还原了 s」的次数。这是一条**定理级**的计数器：
         解出 s 说明 A·s ≡ b，而 b = A·s + e，于是 e ≡ 0 (mod q)；|e| ≤ bound < q/2
         时这只能意味着 e = 0。所以它必须恒为 0，非 0 就是求解器或实例构造坏了。 */
      exactWithNonzeroError: 0,
      /* 秩不足的次数。无误差侧唯一的失败来源：随机 A 偶尔秩 < n，那时**有多个 s
         同样满足所有方程**，求解器如实报 underdetermined。这不是攻击失败，是
         方程组本身没有唯一解，所以它必须与 fullExact 分开记，不能混进成功率里。 */
      rankDeficient: 0
    };
    for (let i = 0; i < count; i++) {
      const inst = instance({ n: n, m: m, q: q, rng: rng, bound: bound, noise: noise });
      const a = attack(inst);
      const zeroE = inst.e.every(function (v) { return v === 0; });
      if (zeroE) acc.zeroError++;
      if (a.fullExact) {
        acc.fullExact++;
        if (!zeroE) acc.exactWithNonzeroError++;
      }
      if (a.firstExact) acc.firstExact++;
      if (a.full.reason === 'inconsistent') acc.inconsistent++;
      if (a.full.reason === 'underdetermined') { acc.underdetermined++; acc.rankDeficient++; }
      if (a.full.reason === 'ok' && !a.fullExact) acc.solvedWrong++;
      if (a.first.used && a.first.used.length === n &&
          a.first.used.every(function (u) { return inst.e[u.row] === 0; })) {
        acc.cleanRows++;
      }
    }
    acc.fullRate = acc.fullExact / count;
    acc.firstRate = acc.firstExact / count;
    acc.cleanRate = acc.cleanRows / count;
    return acc;
  }

  /* ================= 周期：对照面 =================
     这一节不是格。它在这里，是因为这一页的论点是一个**比较**，而比较需要
     两边都能被算出来。放进同一个模块，两侧的断言才能写在同一个测试文件里、
     互相盯着。

     f(x) = aˣ mod N 在 x 上以 r = ord_N(a) 重复。Shor 的量子傅立叶变换
     找的正是这个 r；找到之后，因子由一次 gcd 交出来：
       r 是偶数、且 a^(r/2) ≢ −1 (mod N)  ⟹  gcd(a^(r/2) ∓ 1, N) 是真因子。
     本页**没有模拟量子那一步**。被模拟的是「找到 r 之后会发生什么」，
     以及一件更要紧的事：这个 r 是**藏起来的**——藏起来的东西才有得找。

     ---- 为什么不用 diffie-hellman 的 orderOf ----
     那一个要求模数是素数（它靠分解 p−1 与 Lagrange 定理走捷径）。这一页的
     N 必须是**合数**——群阶事先不知道，正是「周期藏着」的全部内容。所以这里
     用最笨的定义：一直乘，直到回到 1。N 很小，代价可以忽略。
     两份实现之间的漂移由 lattice.test.js 的一条断言拴住：在素数模上
     periodOf 必须与 DH.orderOf 逐个相等。 */
  const PERIOD_MODULUS_MAX = 94906265;

  function periodOf(a, N) {
    if (!Number.isInteger(a) || !Number.isInteger(N)) {
      throw new Error('lattice：periodOf 的两个参数必须是整数');
    }
    if (N < 2) throw new Error('lattice：periodOf 的模数 N 必须 ≥ 2，收到 ' + N);
    if (N > PERIOD_MODULUS_MAX) {
      throw new Error('lattice：periodOf 的模数不能超过 ' + PERIOD_MODULUS_MAX +
                      '（N² 会越过 2⁵³），收到 ' + N);
    }
    const g = C.mod(a, N);
    if (C.gcd(g, N) !== 1) return null;      // 不在乘法群里，没有周期可言
    let cur = g, r = 1;
    while (cur !== 1) {
      cur = (cur * g) % N;
      r++;
      if (r > N) throw new Error('lattice：periodOf 没有收敛——这不该发生');
    }
    return r;
  }

  /* aˣ mod N，x = 0 … len−1。画面上那一串点就是它。 */
  function orbit(a, N, len) {
    if (!Number.isInteger(len) || len < 1) {
      throw new Error('lattice：orbit 的长度必须是正整数，收到 ' + len);
    }
    if (N < 2 || N > PERIOD_MODULUS_MAX || !Number.isInteger(N)) {
      throw new Error('lattice：orbit 的模数不合法：' + N);
    }
    const g = C.mod(a, N);
    const out = new Array(len);
    let cur = 1 % N;
    for (let x = 0; x < len; x++) { out[x] = cur; cur = (cur * g) % N; }
    return out;
  }

  /* 找到 r 之后的那一步经典计算。三种失败是 Shor 算法真实的失败模式，
     不是本实现的缺陷，所以各自带一个名字报出来。 */
  function shorPayload(a, N) {
    const g = C.mod(a, N);
    const common = C.gcd(g, N);
    if (common !== 1) {
      return { ok: false, reason: 'not-coprime', gcd: common, factors: [common, N / common] };
    }
    const r = periodOf(g, N);
    if (r % 2 !== 0) return { ok: false, reason: 'odd-period', r: r };
    const x = C.modPow(g, r / 2, N);
    if (x === C.mod(-1, N)) return { ok: false, reason: 'minus-one', r: r, x: x };
    const f1 = C.gcd(x - 1, N), f2 = C.gcd(x + 1, N);
    const ok = f1 > 1 && f1 < N && f2 > 1 && f2 < N;
    return { ok: ok, reason: ok ? 'ok' : 'trivial', r: r, x: x, factors: [f1, f2] };
  }

  return {
    /* 整数二维矩阵 */
    detInt: detInt, isUnimodular: isUnimodular, matMulInt: matMulInt,
    matPowInt: matPowInt, shearU: shearU, IDENT: IDENT,
    /* 格 */
    apply: apply, coordsOf: coordsOf, babai: babai, closest: closest,
    gaussReduce: gaussReduce, pointsInBox: pointsInBox, sameLattice: sameLattice,
    cvpTrials: cvpTrials, norm2: norm2, dist2: dist2, dist: dist,
    CVP_WINDOW: CVP_WINDOW,
    /* LWE */
    randomMatrix: randomMatrix, randomVector: randomVector, errorVector: errorVector,
    mulModQ: mulModQ, instance: instance, solve: solve, solveFirstRows: solveFirstRows,
    attack: attack, trials: trials, sameVec: sameVec,
    /* 周期（对照面） */
    periodOf: periodOf, orbit: orbit, shorPayload: shorPayload
  };
});
