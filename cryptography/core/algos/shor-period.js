(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 rsa.js / diffie-hellman.js 同源——那个字符串会被
       inline_core.py 原样内联进工具页，而 check.py 的 outbound_ref_check()
       正在数整个子树里的父目录引用，用它守住「cryptography/ 可以整体搬走」。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')),
                             require(require('path').join(__dirname, 'rsa.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos['shor-period'] = factory(root.CryptoCore, root.CryptoAlgos.rsa);
  }
})(typeof self !== 'undefined' ? self : this, function (C, RS) {
  'use strict';

  /* ================= 周期查找 —— Shor 算法里**经典的那一大半** =================

     ⚠ 先把最要紧的一句写在最前面：**这个文件里没有任何量子计算，一行都没有。**

     它实现的是 Shor 因数分解算法的经典外壳：把「分解 N」归约成「求 a 在模 N
     乘法群里的阶 r」，然后从 r 把因子读出来。这一层是纯数论，它在你的浏览器
     里真的跑得起来，而且它确实是 Shor 算法的绝大部分。量子计算机替换掉的
     只有**中间那一步**：求 r。这个文件用朴素扫描去求 r（O(r) 次模乘），量子
     计算机用量子傅里叶变换在多项式时间里求 r——两者的**输入输出完全相同**，
     换掉的只是那一个子程序的代价。

     为什么这里不模拟真正的 Shor：core/quantum-sim.js 建模的是单量子比特与贝尔
     对，没有多比特寄存器、没有电路模拟器（那个文件开头的注释里写着「没有
     Grover / Shor……硬塞进来会让这个文件变成两个模块」）。仅仅分解 15 就需要
     8 个以上量子比特和一次寄存器上的 QFT。与其画一个其实由经典代码驱动的
     「量子电路」，不如老老实实把经典那一半跑出来，并**精确指出**哪一步被替换
     掉了、那一步经典要多少代价、量子要多少代价。这是本页的立场，也是这个
     文件的边界。

     ---- 归约本身 ----
     N 是奇合数且不是素数幂。取 a 与 N 互素，令 r = ord_N(a)。若
       · r 是偶数，且
       · a^(r/2) ≢ −1 (mod N)
     则 x = a^(r/2) 满足 x² ≡ 1、x ≢ ±1，于是 gcd(x−1, N) 是 N 的一个非平凡
     因子。两条前提**都可能不成立**，所以这个归约不是每次都成功——那两种失败
     不是 bug，是内容的一部分，attempt() 因此返回 reason 而不是抛异常。
     教科书定理：N 有 k ≥ 2 个相异素因子、a 在 (Z/NZ)* 上均匀取时，成功概率
       ≥ 1 − 1/2^(k−1)
     k = 2（也就是 RSA 那种 N = p·q）时下界是 1/2。survey() 把这个下界与实测
     值放在一起，theoryFloor() 就是那条下界。

     ---- 关于 survey() 的分母，一个会悄悄骗人的选择 ----
     a = 1 与 a = N−1 是两个**必然失败**的元素（前者 r = 1 是奇数，后者
     r = 2 而 a^1 ≡ −1）。把它们从分母里剔掉能让成功率好看不少：N = 15 时
     6/8 = 75% 会变成 6/6 = 100%。这里**不剔**——分母就是整个 (Z/NZ)*，
     与上面那条定理的取样空间逐字相同。一个"永远 100% 成功"的演示正是这一页
     最不该给出的印象。

     ---- 不重新实现任何已有的东西 ----
     modPow / gcd 走 crypto-core，素性判定与试除走 rsa.js。同一个量在两处
     各算一遍，早晚会给出两个答案，而那天没人知道该信哪个（crypto-core 的
     矩阵那段注释记的是同一件事）。 */

  /* 单次周期扫描是 O(r) 次模乘，r ≤ λ(N) < N。10⁶ 上最坏五十万次模乘，
     在浏览器里是几毫秒；再往上就不是"慢"而是"卡住一帧"。
     另一条更硬的界：扫描里的中间量是 cur * a < N²，N 超过
     floor(√(2⁵³−1)) = 94906265 时它静默丢精度，扫出来的"周期"看上去完全
     正常却是错的。10⁶ 离那条线还有两个数量级。 */
  const MAX_N = 1000000;
  const NUM_MUL_MAX = 94906265;

  /* 穷举普查要对 φ(N) 个 a 各跑一次 O(r) 扫描，代价约 φ(N)·λ(N)/2。
     N = 6000 时约 9×10⁶ 次模乘（实测十几毫秒），页面缓存一次即可；
     再大就该改成抽样（survey 的 samples 选项，需要注入 rng）。 */
  const SURVEY_MAX_N = 6000;

  /* 教学用的半素数梯子：N = p·q，p、q 是相异奇素数。
     两头相差两个半数量级，但每一档都在 SURVEY_MAX_N 之内——这一页的
     顿悟发生在小数上（N = 15 时整条链一眼看穿），代价那件事交给 speedup
     页签上的位长曲线去讲，那里 N 是符号，不需要真的跑。
     每一项都是「两个相异奇素数之积」这件事由 shor-period.test.js 现算一遍，
     不靠这里的注释担保。 */
  const SEMIPRIMES = [
    15, 21, 33, 35, 39, 51, 55, 65, 77, 91,
    115, 143, 187, 209, 247, 299, 323, 391, 437, 493,
    551, 589, 667, 713, 851, 899, 1189, 1517, 1763, 2021,
    2491, 3127, 3599, 4087, 5183
  ];

  function reqSafeInt(v, name) {
    if (!Number.isSafeInteger(v)) {
      throw new Error('shor-period：' + name + ' 必须是安全整数，收到 ' + String(v));
    }
    return v;
  }

  /* 模数的通用门。三条界各有各的理由，所以分开报，不合成一句
     "参数非法"——报错信息说不清哪条被踩，等于让下一个人再试一遍。 */
  function requireN(N) {
    reqSafeInt(N, '模数 N');
    if (N < 3) throw new Error('shor-period：N 必须 ≥ 3，收到 ' + N);
    if (N > MAX_N) {
      throw new Error('shor-period：N 不能超过 ' + MAX_N +
                      '（朴素周期扫描是 O(r) ≤ O(N) 次模乘，再大就会卡住一帧），收到 ' + N);
    }
    if (N > NUM_MUL_MAX) {
      throw new Error('shor-period：N 超过 ' + NUM_MUL_MAX + ' 时中间量 cur·a 会越过 2⁵³');
    }
    return N;
  }

  /* 整数幂，越界当场返回 Infinity 而不是一个静默取整过的数。
     只给 primePowerBase() 用，那里比较的是"等不等于 N"，一个丢了精度的
     幂会让某个合数被判成素数幂，于是 classify 把一个本该能分解的 N 拒之门外。 */
  function ipow(b, k) {
    let r = 1;
    for (let i = 0; i < k; i++) {
      r *= b;
      if (r > MAX_N) return Infinity;
    }
    return r;
  }

  /* N 是不是素数幂 p^k（含 k = 1，也就是 N 本身是素数）。

     用**完全幂判定**而不是"先分解再看"：真实的 Shor 在这一步做的正是
     多项式时间的素性判定 + 完全幂判定，而不是分解——如果这里靠分解 N 来
     决定"要不要去分解 N"，整页的逻辑就成了一个圈。这不是洁癖：这一页的
     全部主张是"分解很难"，它自己的前置检查就不能偷偷用一次分解。

     浮点开方在 10⁶ 量级上可能差一两，所以在 b 附近扫 ±2 再用整数幂核对。 */
  function primePowerBase(N) {
    const maxK = Math.max(1, Math.floor(Math.log(N) / Math.LN2));
    for (let k = 1; k <= maxK; k++) {
      const b0 = Math.round(Math.pow(N, 1 / k));
      for (let d = -2; d <= 2; d++) {
        const b = b0 + d;
        if (b >= 2 && ipow(b, k) === N && RS.isPrime(b)) return { base: b, exp: k };
      }
    }
    return null;
  }

  /* Shor 的归约对 N 有三条前置条件，每一条都对应一个**更便宜的经典办法**，
     所以它们不是"限制"，而是"这些情况根本用不着量子计算机"：
       偶数     → 除以 2 就完事
       素数     → 根本没有非平凡因子
       素数幂   → 完全幂判定当场给出底数
     返回 reason 码而不是抛：页面要走进每一种情形并把它画出来（与 rsa.keygen()
     同一条纪律——失败在这一页是内容，不是意外）。 */
  function classify(N) {
    requireN(N);
    if (N % 2 === 0) {
      return { ok: false, reason: 'n-even', base: 2, exp: null };
    }
    const pp = primePowerBase(N);
    if (pp && pp.exp === 1) return { ok: false, reason: 'n-prime', base: pp.base, exp: 1 };
    if (pp) return { ok: false, reason: 'n-prime-power', base: pp.base, exp: pp.exp };
    return { ok: true, reason: 'ok', base: null, exp: null };
  }

  /* ================= 周期（阶）本身 =================
     r = ord_N(a) = 使 a^r ≡ 1 的最小正 r。

     朴素扫描：cur ← cur·a mod N，数到 cur 回到 1。**故意**不用
     "先算 λ(N) 再对每个素因子降幂"那套快法（diffie-hellman.orderOf 用的
     就是那套）——那套要先知道 λ(N) 的因子分解，而 λ(N) = lcm(p−1, q−1) 要先
     知道 p 与 q，也就是先分解 N。这一页的前提正是分解不出来，所以 Eve 手里
     只有这条朴素扫描，而它的步数**就是**量子计算机替下来的那笔代价。
     返回值里的 steps 因此是真数出来的，不是估计。

     gcd(a, N) ≠ 1 时阶不存在（a 不在乘法群里），返回 null 而不是抛：
     那是一次"运气好"的抽样，Shor 的第一步本来就要先做这次 gcd。 */
  function periodOf(a, N) {
    requireN(N);
    reqSafeInt(a, '底数 a');
    const aa = C.mod(a, N);
    if (aa === 0 || C.gcd(aa, N) !== 1) return null;
    let cur = aa, r = 1;
    while (cur !== 1) {
      cur = (cur * aa) % N;
      r++;
      /* 群里任何元素的阶都整除 φ(N) < N，走过 N 步还没回到 1 只能是
         算术出了错（例如 N 越界后模乘丢精度）。让它当场炸，而不是
         返回一个"看着很大"的周期——后者会被页面照常画出来。 */
      if (r > N) {
        throw new Error('shor-period：a = ' + a + ' 在模 ' + N +
                        ' 下走了 ' + r + ' 步仍未回到 1，算术出错了');
      }
    }
    return { r: r, steps: r };
  }

  /* a^x mod N，x = 0 … count−1。增量乘法，一次一乘。
     页面拿它画那条"高度反复出现"的点列——周期在图上是肉眼可见的，
     而这正是这一页第一件要让人看见的事。 */
  function orbit(a, N, count) {
    requireN(N);
    reqSafeInt(a, '底数 a');
    if (!Number.isInteger(count) || count < 1 || count > 4096) {
      throw new Error('shor-period：orbit 的 count 必须是 1…4096 的整数，收到 ' + String(count));
    }
    const aa = C.mod(a, N);
    const out = new Array(count);
    let cur = 1 % N;
    for (let x = 0; x < count; x++) {
      out[x] = cur;
      cur = (cur * aa) % N;
    }
    return out;
  }

  /* ================= 一次完整的归约尝试 =================
     返回一条**记录**而不是抛异常。字段一次列全，让页面能一格一格点亮：

       ok         这次尝试有没有拿到非平凡因子
       reason     'ok' | 'lucky-gcd' | 'odd-order' | 'minus-one' | 'trivial-gcd'
                  | classify() 的 'n-even' / 'n-prime' / 'n-prime-power'
       usedPeriod 因子是不是靠周期查找拿到的（lucky-gcd 那一路没用上）
       r          周期；steps 是求它花掉的模乘次数（量子替换掉的正是这笔）
       half       a^(r/2) mod N
       gcdMinus / gcdPlus   gcd(half∓1, N)
       p, q       p ≤ q 且 p·q = N

     两种失败必须被看见，所以它们各有各的 reason：
       odd-order  r 是奇数，r/2 根本不是整数，这条路当场断掉
       minus-one  a^(r/2) ≡ −1，于是 gcd(half−1, N) 平凡（测试里有一条断言
                  逐个核实这件事——这个检查不是装饰） */
  function attempt(N, a) {
    const cls = classify(N);
    const rec = {
      N: N, a: a, ok: false, reason: cls.reason, usedPeriod: false,
      r: null, steps: 0, half: null, gcdMinus: null, gcdPlus: null, p: null, q: null
    };
    if (!cls.ok) {
      rec.p = cls.base;
      rec.q = cls.base == null ? null : N / cls.base;
      /* n-prime 时没有非平凡因子；n-even / n-prime-power 有，但拿到它的
         不是这个归约，所以 ok 一律留 false——ok 的含义是"周期查找这条路
         走通了"，把别的路的战果算进来会让成功率这个数字失去意义。 */
      if (cls.reason === 'n-prime') { rec.p = null; rec.q = null; }
      return rec;
    }
    reqSafeInt(a, '底数 a');
    const aa = C.mod(a, N);
    const g = C.gcd(aa, N);
    if (g !== 1) {
      /* 运气好：随手抽的 a 恰好与 N 有公因子，一次 gcd 就分解掉了，
         周期查找一步都不用跑。真实的 Shor 第一步就是这次 gcd；
         N = p·q 时它的概率是 (p+q−1)/N，小得可怜，但它确实存在。 */
      rec.ok = true; rec.reason = 'lucky-gcd';
      rec.p = Math.min(g, N / g); rec.q = Math.max(g, N / g);
      return rec;
    }
    const per = periodOf(aa, N);
    rec.r = per.r; rec.steps = per.steps;
    if (per.r % 2 === 1) { rec.reason = 'odd-order'; return rec; }
    const half = C.modPow(aa, per.r / 2, N);
    rec.half = half;
    if (half === N - 1) { rec.reason = 'minus-one'; return rec; }
    rec.gcdMinus = C.gcd(half - 1, N);
    rec.gcdPlus = C.gcd(half + 1, N);
    const f = rec.gcdMinus;
    if (f <= 1 || f >= N) {
      /* 理论上到不了这里：half² ≡ 1、half ≢ ±1 蕴含 gcd(half−1, N) 非平凡。
         留着这一支是把"不可能"写成"就算发生也说得出话"，并且让测试可以
         断言它的计数恒为 0——一条永远为 0 的计数器是这条推理还成立的证据。 */
      rec.reason = 'trivial-gcd';
      return rec;
    }
    rec.ok = true; rec.reason = 'ok'; rec.usedPeriod = true;
    rec.p = Math.min(f, N / f); rec.q = Math.max(f, N / f);
    return rec;
  }

  /* 定理下界：N 有 k ≥ 2 个相异素因子时，a 在 (Z/NZ)* 上均匀取，
     "r 为偶且 a^(r/2) ≢ −1" 的概率 ≥ 1 − 1/2^(k−1)。k = 2 时是 1/2。 */
  function theoryFloor(distinctPrimes) {
    if (!Number.isInteger(distinctPrimes) || distinctPrimes < 2) {
      throw new Error('shor-period：theoryFloor 的相异素因子个数必须是 ≥ 2 的整数，收到 ' +
                      String(distinctPrimes));
    }
    return 1 - Math.pow(2, 1 - distinctPrimes);
  }

  /* ================= 成功率普查 =================
     对 (Z/NZ)* 里的 a 逐个（或抽样）跑一次 attempt()，把结果按 reason 计数。

     分母是整个 (Z/NZ)*，**含 a = 1 与 a = N−1**——见文件开头那段。
     抽样路径必须注入 rng：本仓不允许测试里出现 Math.random（一个今天绿明天红
     的成功率比没有这个数字更糟）。

     ---- 为什么拆成 start/step 两半 ----
     穷举一档 N 要跑 φ(N) 次 O(r) 扫描。实测（node，本机）：
         N = 143   0.1 ms      N = 1189  3.7 ms
         N = 3599  58.3 ms     N = 5183  101.9 ms
     梯子顶端那 102 毫秒会**卡掉六帧**，而使用者拖的是一根滑杆——卡顿在那里
     读起来不是"在算"，而是"坏了"。rsa.js 的 factorStart / factorStep 为同一个
     理由拆过一次，这里照搬那个形状：页面每帧只花几毫秒，顺带还能把成功率
     一格一格收敛的过程画出来。
     survey() 保留为"一口气跑完"的包装，给 node 侧的测试与核实脚本用。 */
  function surveyStart(N, opts) {
    const o = opts || {};
    const cls = classify(N);
    const st = {
      ok: cls.ok, reason: cls.reason, N: N,
      tried: 0, factored: 0, rate: null, sampled: false,
      byReason: { 'ok': 0, 'lucky-gcd': 0, 'odd-order': 0, 'minus-one': 0, 'trivial-gcd': 0 },
      steps: 0, maxR: 0,
      list: [], cursor: 0, total: 0, done: !cls.ok
    };
    if (!cls.ok) return st;

    if (o.samples == null) {
      if (N > SURVEY_MAX_N) {
        throw new Error('shor-period：穷举普查要跑 φ(N) 次周期扫描，N 不能超过 ' +
                        SURVEY_MAX_N + '（更大的 N 请传 samples 与 rng 走抽样），收到 ' + N);
      }
      for (let a = 1; a < N; a++) if (C.gcd(a, N) === 1) st.list.push(a);
    } else {
      requireN(N);
      const m = o.samples;
      if (!Number.isInteger(m) || m < 1 || m > 20000) {
        throw new Error('shor-period：samples 必须是 1…20000 的整数，收到 ' + String(m));
      }
      const rng = o.rng;
      if (typeof rng !== 'function') {
        throw new Error('shor-period：抽样普查需要注入 rng（返回 [0,1) 的函数）；本模块内不使用 Math.random');
      }
      st.sampled = true;
      /* 抽的是 [1, N−1] 里的整数，抽到与 N 不互素的就重抽——不是跳过。
         跳过会让分母悄悄变小，而那正是"分母里放了什么"这件事上最容易
         出错的地方。重抽的期望次数是 N/φ(N)，半素数上不到 1.2。 */
      let guard = 0;
      while (st.list.length < m) {
        const u = rng();
        if (typeof u !== 'number' || !(u >= 0) || !(u < 1)) {
          throw new Error('shor-period：rng 返回了 ' + String(u) + '，必须落在 [0,1)');
        }
        const a = 1 + Math.floor(u * (N - 1));
        if (C.gcd(a, N) === 1) st.list.push(a);
        if (++guard > m * 64 + 1000) {
          throw new Error('shor-period：抽样重试次数过多，rng 可能不是均匀的');
        }
      }
    }
    st.total = st.list.length;
    st.done = st.total === 0;
    return st;
  }

  /* 最多再处理 budget 个 a，原地推进同一个状态对象。
     rate 每一步都重算，所以中途读到的就是"到目前为止"的真实比例——
     页面画的是一条收敛中的曲线，不是一个占位符。 */
  function surveyStep(st, budget) {
    let left = budget == null ? 1 : budget;
    while (!st.done && left > 0) {
      const rec = attempt(st.N, st.list[st.cursor++]);
      left--;
      st.tried++;
      st.byReason[rec.reason] = (st.byReason[rec.reason] || 0) + 1;
      st.steps += rec.steps;
      if (rec.r != null && rec.r > st.maxR) st.maxR = rec.r;
      if (rec.ok && rec.usedPeriod) st.factored++;
      st.rate = st.factored / st.tried;
      if (st.cursor >= st.total) st.done = true;
    }
    return st;
  }

  function survey(N, opts) {
    const st = surveyStart(N, opts);
    while (!st.done) surveyStep(st, 1 << 16);
    /* list 是内部游标用的，不该出现在返回值里：测试拿 JSON.stringify 比对
       两次抽样是否逐字节相同，把几千个 a 一起序列化只是让失败信息没法读。 */
    delete st.list; delete st.cursor;
    return st;
  }

  /* ================= 代价模型 =================
     这一页要把"经典 vs 量子"画成一条曲线，而那些数字大到没法直接画，
     所以画的**一律是以 2 为底的指数**（log₂ 运算次数），不是运算次数本身。
     "画指数"这件事本身就是内容：指数是线性增长还是次指数增长，一眼看得出来。

     四条曲线，各自的含义写清楚，免得被当成同一回事：

       naive-period    朴素周期扫描：O(r) ≤ O(N) 次模乘 → log₂ = n
                       （就是这个文件里 periodOf() 真在跑的那条）
       trial-division  试除到 √N → log₂ = n/2
                       （crypto-rsa 的 factor 页签真在跑的那条）
       rho             Pollard rho 一类的平方根攻击 → log₂ = n/2
                       数值与试除相同，含义不同：它打的是群阶为 2ⁿ 的
                       离散对数（椭圆曲线就吃这一招），不是整数分解。
       gnfs            数域筛，目前已知最好的经典分解算法：
                       L_N[1/3, (64/9)^(1/3)]，**次指数**
       shor            量子部分的规模模型，取 n³ 门数量级 → log₂ = 3·log₂ n

     两条必须说出口的诚实声明：
     · gnfs 这条是渐近式，L 记号里那个 o(1) 被丢掉了。它在 2048 比特上给出
       约 2¹¹⁷，而公开的估计通常是 2¹¹² 上下——曲线的**形状**是对的，绝对值
       偏高几个比特。页面必须把这句话印出来。
     · shor 的 n³ 是**算法规模**，不是硬件预测。它不回答"需要多少个物理量子
       比特"，也不回答"哪一年"。那两个数字会动，而一个自信的错数比没有数更坏。 */
  const MIN_BITS = 8;
  const MAX_BITS = 1 << 20;
  /* (64/9)^(1/3)。写成常量并在测试里核对，而不是每次现算——它是这条曲线
     的定义的一部分，值得有个名字。 */
  const GNFS_C = Math.pow(64 / 9, 1 / 3);
  const COST_MODELS = ['naive-period', 'trial-division', 'rho', 'gnfs', 'shor'];

  function requireBits(bits) {
    if (!Number.isFinite(bits) || bits < MIN_BITS || bits > MAX_BITS) {
      throw new Error('shor-period：位长必须落在 [' + MIN_BITS + ', ' + MAX_BITS +
                      ']，收到 ' + String(bits));
    }
    return bits;
  }

  function log2Cost(model, bits) {
    requireBits(bits);
    switch (model) {
      case 'naive-period':   return bits;
      case 'trial-division': return bits / 2;
      case 'rho':            return bits / 2;
      case 'gnfs': {
        const lnN = bits * Math.LN2;
        return GNFS_C * Math.pow(lnN, 1 / 3) * Math.pow(Math.log(lnN), 2 / 3) / Math.LN2;
      }
      case 'shor':           return 3 * Math.log(bits) / Math.LN2;
      default:
        throw new Error('shor-period：未知的代价模型 ' + JSON.stringify(model) +
                        '，可用的是 ' + COST_MODELS.join(' / '));
    }
  }

  /* ================= Grover =================
     无结构搜索：经典 2ⁿ 次，Grover 约 2^(n/2) 次。**指数减半，不是被打破。**

     AES-128 → 2⁶⁴，AES-256 → 2¹²⁸。这就是"量子计算机破解一切加密"这句话
     死掉的地方：对称密码丢掉一半密钥比特，而 256 比特丢一半还剩 128。

     返回值里带 sequential 这个字段，是因为这一页最容易被读错的正是它：
     Grover 的 2^(n/2) 是**串行**迭代次数。它并行得很差——用 S 台机器
     只能把时间除以 √S，而经典穷举用 S 台就是除以 S。所以"2⁶⁴ 次 Grover
     迭代"与"2⁶⁴ 次经典运算今天可行"完全不是一回事，页面必须说出这句。 */
  function groverCost(bits) {
    if (!Number.isInteger(bits) || bits < 1 || bits > MAX_BITS) {
      throw new Error('shor-period：groverCost 的密钥比特数必须是 1…' + MAX_BITS +
                      ' 的整数，收到 ' + String(bits));
    }
    return {
      bits: bits,
      classicalLog2: bits,
      quantumLog2: bits / 2,
      /* 并行加速比的指数：经典 S 台除以 S，Grover 只除以 √S。 */
      parallelExponent: 0.5,
      sequential: true
    };
  }

  function bitsOf(N) {
    reqSafeInt(N, 'bitsOf 的 N');
    if (N < 1) throw new Error('shor-period：bitsOf 的 N 必须 ≥ 1，收到 ' + N);
    return Math.ceil(Math.log(N + 1) / Math.LN2);
  }

  return {
    MAX_N: MAX_N, SURVEY_MAX_N: SURVEY_MAX_N, NUM_MUL_MAX: NUM_MUL_MAX,
    SEMIPRIMES: SEMIPRIMES,
    MIN_BITS: MIN_BITS, MAX_BITS: MAX_BITS, GNFS_C: GNFS_C, COST_MODELS: COST_MODELS,
    classify: classify, primePowerBase: primePowerBase,
    periodOf: periodOf, orbit: orbit, attempt: attempt,
    surveyStart: surveyStart, surveyStep: surveyStep, survey: survey,
    theoryFloor: theoryFloor,
    log2Cost: log2Cost, groverCost: groverCost, bitsOf: bitsOf
  };
});
