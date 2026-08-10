(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径——那个字符串会被 inline_core.py 原样内联进工具页，而 check.py 的
       outbound_ref_check() 正在数整个子树里的父目录引用（可搬迁性）。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.rsa = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= RSA —— 一个**教学模型**，不是可用实现 =================
     这个文件实现的是教科书 RSA：
       n = p·q，φ(n) = (p−1)(q−1)，选 e 与 φ(n) 互素，d = e⁻¹ mod φ(n)，
       c = mᵉ mod n，m = cᵈ mod n。
     它刻意缺三样东西，缺席本身就是要讲的内容之一：
       · 没有填充（OAEP）。教科书 RSA 是确定性的：同一个 m 永远给出同一个 c，
         于是任何人都能拿公钥自己造一张 m → c 的字典，不必解密就能读出消息。
         dictionary() 就是把这张字典造出来的函数——它存在的理由不是"顺手提供"，
         而是这一页必须能把"确定性 = 不安全"画出来。
       · 没有常数时间算术。modPow 走 BigInt，分支与耗时都随指数比特走。
       · 素数是玩具尺寸（最大 2²⁶ 量级）。真实 RSA 的 p、q 各 1024 比特。
     所以：任何地方都不许把它当作"能用的 RSA"。

     ---- 为什么整份实现停在 2⁵² ----
     crypto-core 的 modPow 内部是 BigInt，本可以一路开到 2⁵³−1。真正的天花板
     在另一处，是实测出来的：**CryptoCore.mod(a, n) 在 n > 2⁵² 时会给出错值**。
     它算的是 ((a % n) + n) % n，中间量 (a%n)+n 可以逼近 2n；n > 2⁵² 时这一步
     越过 2⁵³−1，浮点静默取整，结果差 1。实测：
         mod(4400303820297978, 4785675681196153)
           → 4400303820297979（正确值是 4400303820297978；中间量 9185979501494132）
     modInverse 一头一尾各调一次 mod()，于是它继承了同一个上界。随机抽样
     （逐条用 BigInt 验 d·e ≡ 1 mod φ）：
         φ ∈ [0.9·2⁵², 2⁵²]      错 0 / 77771
         φ ∈ [2⁵², 1.1·2⁵²]      错 2211 / 69686
         φ ∈ [1.1·2⁵², 1.3·2⁵²]  错 7198 / 60961
     错的形状是**返回一个看着完全正常的 d**，页面照常画出密钥、照常加密，
     只有解密回不来。所以这个上界不是"保守起见"，是这份代码正确性的边界，
     写死在 MAX_N 上并由 keygen() 当场拒绝。上界是 2⁵² 而不是 2⁵³−1 这件事，
     属于 crypto-core 的 mod()，不属于这里；这个文件不去绕过它，只是不越过它。

     ---- 上面那个 core bug 已经修了（改成只在需要时加 n），但 MAX_N 不动 ----
     修完之后 mod() 在整个安全整数范围内都精确，所以「正确性天花板」这条理由
     不再成立。**MAX_N 留在 2⁵² 是因为它另有一条独立的、更硬的理由**：
     `factor` 那一页的顿悟是"当场把 n 分解掉"，而它用的是试除。浏览器实测
     约 2.13 亿次试除/秒，16 位数（≈2⁵²）要跑约 100 毫秒——这已经是"看得见
     它在算、但不至于卡住"的上限。再往上每多两位数代价涨十倍，2⁵³ 附近那一页
     就不是慢，是挂住。所以这个常数从"绕开 core 的 bug"变成了"这一页的演示
     还能跑完的边界"，数值不变，理由换了。要抬高它得先把试除换成更快的分解
     算法，那是另一件事。 */

  const MAX_N = 4503599627370496;        // 2⁵²
  /* 两个素数各自的上界：p·q ≤ 2⁵² 的最省事的充分条件是 p、q ≤ 2²⁶。
     67108859 是 ≤ 2²⁶ 的最大素数，67108859² = 4503598956281881 ≤ MAX_N。 */
  const MAX_PRIME = 67108859;

  /* 试除法的上界。isPrime 与 factor 都靠它，代价是 √n 次取余：
     n = 4.5×10¹⁵ 时 √n ≈ 6.7×10⁷，node 里约一秒、浏览器里要靠 factorStep()
     分帧走完。再往上就不是"慢"而是"挂住"，而 MAX_N 已经把门关在这之前。 */

  function reqSafeInt(v, name) {
    if (!Number.isSafeInteger(v)) {
      throw new Error('rsa：' + name + ' 必须是安全整数（|v| ≤ 2⁵³−1），收到 ' + String(v));
    }
    return v;
  }

  /* ---- 素性 ----
     试除到 √n，先筛 2 与 3 再走 6k±1。确定性，不用 Miller–Rabin：
     这一页的全部主张就是"分解 n 很难"，而一个概率素性判定会在页面上引入
     第二种"可能错"的东西，把注意力从唯一那件难事上引开。玩具尺寸下试除
     本来就够快。 */
  function isPrime(n) {
    reqSafeInt(n, 'isPrime 的参数');
    if (n < 2) return false;
    if (n < 4) return true;                 // 2, 3
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let d = 5; d * d <= n; d += 6) {
      if (n % d === 0 || n % (d + 2) === 0) return false;
    }
    return true;
  }

  /* ---- 教学用素数梯子 ----
     滑杆要的是**下标**，所以这里给一张定长表，而不是"某区间内的全部素数"：
     3…97 的 24 个小素数逐个列出（教学发生在这一头：n = 15 时连 'P' 都发不出去），
     再往上大致每档翻一倍，一直到 2²⁶ 附近。45 档一根滑杆拖得动，而两头相差
     七个数量级——"8 位数毫秒级、16 位数要等几秒"这句话因此是拖出来的，
     不是读出来的。
     表里每一项都是素数、严格递增、末项 ≤ MAX_PRIME，这三条由 rsa.test.js
     现算一遍：一张手抄的常数表里混进一个合数，页面会算出一把"密钥"，
     而 d 根本不是逆元。 */
  const KEY_PRIMES = [
    3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73,
    79, 83, 89, 97, 101, 211, 409, 809, 1619, 3251, 6469, 12941, 25867, 51713,
    103451, 206879, 413711, 827417, 1654787, 3309571, 6619139, 13238273,
    26476553, 52953097, 67108859
  ];

  function phiOf(p, q) {
    reqSafeInt(p, 'phiOf 的 p'); reqSafeInt(q, 'phiOf 的 q');
    return (p - 1) * (q - 1);
  }

  /* e 合法 ⟺ 1 < e < φ(n) 且 gcd(e, φ(n)) = 1。
     后一条不是记账规矩：gcd ≠ 1 时 e 在 ℤ/φℤ 上没有逆元，**d 不存在**——
     不是更难求，是不存在。这正是 keygen() 要把 d 报成 null 的原因。 */
  function isValidE(e, phi) {
    if (!Number.isSafeInteger(e) || !Number.isSafeInteger(phi)) return false;
    if (e <= 1 || e >= phi) return false;
    return C.gcd(e, phi) === 1;
  }

  /* φ 之下所有合法 e 的前 limit 个。工具页拿它数"有多少个 e 能用"，
     也拿它在 e 非法时给出最近的可用值。 */
  function validEs(phi, limit) {
    const out = [];
    const cap = limit == null ? 32 : limit;
    for (let e = 3; e < phi && out.length < cap; e += 2) {
      if (C.gcd(e, phi) === 1) out.push(e);
    }
    return out;
  }

  /* ================= 密钥生成 =================
     返回一个**结构**而不是抛异常：这一页要走进每一种失败（e 与 φ 不互素、
     p = q、素数不是素数），并把失败画出来。失败在这里是内容，不是意外。
     reason 是一个稳定的英文小写码，双语文案由页面负责——算法模块不写 UI 文案。 */
  function keygen(p, q, e) {
    reqSafeInt(p, 'keygen 的 p'); reqSafeInt(q, 'keygen 的 q'); reqSafeInt(e, 'keygen 的 e');
    const base = { p: p, q: q, e: e, n: null, phi: null, d: null, ok: false, reason: 'ok' };
    if (!isPrime(p)) { base.reason = 'p-not-prime'; return base; }
    if (!isPrime(q)) { base.reason = 'q-not-prime'; return base; }
    /* p = q 时 n = p²，而 φ(p²) = p(p−1) ≠ (p−1)²——按 (p−1)(q−1) 算出来的 d
       根本不是逆元。更要命的是 n 是完全平方数，开一次方就分解掉了。
       两条都是"这不成其为密钥"，所以在算 n 之前就拦住。 */
    if (p === q) { base.reason = 'p-equals-q'; return base; }
    const n = p * q;
    if (n > MAX_N) { base.reason = 'n-too-large'; return base; }
    base.n = n;
    const phi = phiOf(p, q);
    base.phi = phi;
    if (e <= 1 || e >= phi) { base.reason = 'e-out-of-range'; return base; }
    /* 这里是全页唯一一次求 d。modInverse 不互素时返回 **null**（不是抛），
       而 null 一路传到页面上，被画成一个断掉的箭头。 */
    const d = C.modInverse(e, phi);
    if (d === null) { base.reason = 'e-not-coprime'; return base; }
    base.d = d;
    base.ok = true;
    return base;
  }

  /* ================= 加解密 =================
     m < n 是硬条件，不是建议：mᵉ mod n 里的 mod n 会把 m 与 m mod n 送到
     **同一个** c 上，于是收信人解出来的是 m mod n，而不是 m。它不报错、
     不乱码，只是悄悄给出另一条消息——最难被发现的那种错。
     所以拆成两个导出，与 affine.js 的 mapRaw / encrypt 同一条纪律：
       encryptRaw()  不检查，用来把"塌陷"画出来；
       encrypt()     检查，越界当场抛。
     页面用 messageFits() 事前判定，不用 try/catch 当控制流。 */
  function messageFits(m, n) {
    return Number.isSafeInteger(m) && Number.isSafeInteger(n) && m >= 0 && m < n;
  }

  function encryptRaw(m, e, n) {
    reqSafeInt(m, 'encryptRaw 的 m');
    return C.modPow(C.mod(m, n), e, n);
  }

  function encrypt(m, e, n) {
    reqSafeInt(m, 'encrypt 的 m'); reqSafeInt(e, 'encrypt 的 e'); reqSafeInt(n, 'encrypt 的 n');
    if (!messageFits(m, n)) {
      throw new Error('rsa: 明文 m = ' + m + ' 必须落在 [0, n) 内（n = ' + n +
                      '）——m ≥ n 时 m 与 m mod n 加密成同一个密文，收信人拿不回原来那一个');
    }
    return C.modPow(m, e, n);
  }

  function decrypt(c, d, n) {
    reqSafeInt(c, 'decrypt 的 c'); reqSafeInt(d, 'decrypt 的 d'); reqSafeInt(n, 'decrypt 的 n');
    if (!messageFits(c, n)) {
      throw new Error('rsa: 密文 c = ' + c + ' 必须落在 [0, n) 内（n = ' + n + '）');
    }
    return C.modPow(c, d, n);
  }

  /* ================= 确定性 = 一张字典 =================
     教科书 RSA 没有随机化：加密是一个函数，同一个 m 恒给出同一个 c。
     公钥是公开的，所以任何人都能对全部候选明文跑一遍加密，做出这张表，
     然后**不解密**、只查表就读出消息。消息空间小的时候（一个字节、一个
     "是/否"、一个六位验证码）这不是理论攻击，是一次 for 循环。
     真实部署用 OAEP 填充，把随机性掺进 m，于是同一条消息每次加密都不同。
     这个函数返回 count 个 (m, c) 对，工具页把它排成一条可视的字典。 */
  function dictionary(e, n, count) {
    reqSafeInt(e, 'dictionary 的 e'); reqSafeInt(n, 'dictionary 的 n');
    const k = Math.max(0, Math.min(count == null ? 16 : count, n));
    const out = [];
    for (let m = 0; m < k; m++) out.push({ m: m, c: C.modPow(m, e, n) });
    return out;
  }

  /* ================= 分解 n —— 整个 RSA 站着的那一件事 =================
     试除法：2，然后 3、5、7… 一直到 √n。不是最快的算法（Pollard rho、
     二次筛都更快），但它是**最诚实的那一个**：试除的次数就是 √n，
     所以"位数每加两位、代价乘十"这条增长在屏幕上是直接读得出来的，
     不需要相信任何渐进记号。教学页要的是这条曲线，不是最好的常数。

     分成 start/step 两半，因为浏览器要分帧走：n 取到 4.5×10¹⁵ 时
     √n ≈ 6.7×10⁷ 次取余，一口气跑完会把页面冻住好几秒——而"页面卡住"
     和"计算很久"在使用者眼里是两件事，前者看起来像坏了。 */
  function factorStart(n) {
    reqSafeInt(n, 'factorStart 的 n');
    if (n < 2) throw new Error('rsa: factorStart 的 n 必须 ≥ 2，收到 ' + n);
    /* limit 用 sqrt 起头再校正：Math.sqrt 在 10¹⁵ 量级上可能差一，
       而少走一步就会把一个合数报成素数。校正后 limit² ≤ n < (limit+1)²，
       两个平方数都 < 2⁵³，比较是精确的。 */
    let limit = Math.floor(Math.sqrt(n));
    while (limit > 1 && limit * limit > n) limit--;
    while ((limit + 1) * (limit + 1) <= n) limit++;
    return { n: n, d: 2, limit: limit, trials: 0, done: false, p: null, q: null, prime: false };
  }

  /* 最多走 budget 次试除，返回同一个状态对象（原地推进）。
     done 为真时：找到因子则 p·q = n（p ≤ q），否则 prime 为真、n 本身是素数。 */
  function factorStep(st, budget) {
    let left = budget == null ? 1 : budget;
    while (!st.done && left > 0) {
      if (st.d > st.limit) {
        st.done = true; st.prime = true; st.p = st.n; st.q = 1;
        return st;
      }
      st.trials++;
      left--;
      if (st.n % st.d === 0) {
        st.p = st.d; st.q = st.n / st.d; st.done = true;
        return st;
      }
      st.d = (st.d === 2) ? 3 : st.d + 2;
    }
    return st;
  }

  /* 一口气跑完。测试与 node 侧计时用它；页面不要调它。 */
  function factor(n) {
    const st = factorStart(n);
    while (!st.done) factorStep(st, 1 << 20);
    return st;
  }

  /* 最坏情况的试除次数：√n 的一半（只试奇数）加一。
     这是"RSA 的安全性有多少"这句话在这一页上的**唯一**量纲。
     2048 比特的 n 对应 √n ≈ 2¹⁰²⁴ ≈ 10³⁰⁸——同一个公式，只是数变大了。 */
  function worstCaseTrials(n) {
    reqSafeInt(n, 'worstCaseTrials 的 n');
    return Math.floor(Math.sqrt(n) / 2) + 1;
  }

  /* ================= Eve 的整条路径 =================
     她手里只有公钥 (n, e)。要 d 就要 φ(n)，要 φ(n) 就要 p 和 q，
     要 p 和 q 就得分解 n。这个函数把那条链一次走完，返回沿途每一环——
     页面要把它们一格一格点亮，而不是只报一个"破解成功"。 */
  function recover(n, e) {
    reqSafeInt(n, 'recover 的 n'); reqSafeInt(e, 'recover 的 e');
    const st = factor(n);
    if (st.prime) return { ok: false, reason: 'n-is-prime', trials: st.trials, p: null, q: null, phi: null, d: null };
    const phi = phiOf(st.p, st.q);
    const d = C.modInverse(e, phi);
    return {
      ok: d !== null,
      reason: d === null ? 'e-not-coprime' : 'ok',
      p: st.p, q: st.q, phi: phi, d: d, trials: st.trials
    };
  }

  return {
    MAX_N: MAX_N, MAX_PRIME: MAX_PRIME, KEY_PRIMES: KEY_PRIMES,
    isPrime: isPrime, phiOf: phiOf, isValidE: isValidE, validEs: validEs,
    keygen: keygen,
    messageFits: messageFits, encrypt: encrypt, encryptRaw: encryptRaw, decrypt: decrypt,
    dictionary: dictionary,
    factorStart: factorStart, factorStep: factorStep, factor: factor,
    worstCaseTrials: worstCaseTrials, recover: recover
  };
});
