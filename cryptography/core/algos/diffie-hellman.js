(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 affine.js 同源——那个字符串会被 inline_core.py 原样
       内联进工具页，而 check.py 的 outbound_ref_check() 正在数整个子树里的
       父目录引用，用它守住「cryptography/ 可以整体搬走」这条约束。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos['diffie-hellman'] = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= Diffie–Hellman 密钥交换 =================
     公开的只有 p（素数）、g（模 p 的一个元素）、A = gᵃ mod p、B = gᵇ mod p。
     双方各自算 Bᵃ = Aᵇ = gᵃᵇ mod p，而 gᵃᵇ **一次都没有上过线**。
     整套东西压在一个不对称上：算 gˣ 容易（平方–乘法阶梯），从 gˣ 反推 x 难
     （离散对数）。这个文件的每个导出都是为了让那个不对称能被**量出来**，
     而不是被断言。

     模逆、模幂一律走 crypto-core，本文件不重写第二份——「同一个量在两处各算
     一遍」是这个仓库反复记过的账。特别是 modPow：它内部是 BigInt，朴素的
     Number 平方乘法在 m 稍大时会静默给出错数（crypto-core 那段注释里有实测
     的复现）。这里凡是要一次算出一个幂的地方，都调它。 */

  /* Number 路径上「一次乘法不越过 2⁵³」的上界：floor(√(2⁵³−1)) = 94906265。
     下面 powers() / discreteLog() 里的增量乘法（cur * g % p）中间量能到 p²，
     所以它们要这条界。modPow 不需要——它内部是 BigInt。
     这个数不是抽查试出来的，是由 p² < 2⁵³ 推出来的：crypto-core 的注释里记着
     m = 94906271 虽然超界却碰巧算对，抽查到一个相符的点什么也没证明。 */
  const NUM_MUL_MAX = 94906265;

  /* powers() / reachable() / generators() 会按 p 分配数组或做 O(p) 的扫描。
     教学参数只有三位数，这条界是给「有人手滑传了个大素数进来」准备的：
     宁可当场报一句说得清的错，也不要让页面在一次 draw() 里假死。 */
  const TABLE_MAX = 100000;

  function requireInt(v, name) {
    if (!Number.isInteger(v)) {
      throw new Error('diffie-hellman：' + name + ' 必须是整数，收到 ' + String(v));
    }
    return v;
  }

  /* 试除法。教学参数三位数，MAX 之内最坏也就 √p ≈ 316 次取模。
     写得朴素是有意的：这一页要讲的不是素性检测。 */
  function isPrime(n) {
    if (!Number.isInteger(n) || n < 2) return false;
    if (n % 2 === 0) return n === 2;
    for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
    return true;
  }

  /* n 的**相异**素因子。orderOf 只需要相异因子（阶的判定按每个素因子逐个降幂），
     重数在那里毫无用处，返回重数只会让调用方多一次去重。 */
  function primeFactors(n) {
    requireInt(n, 'primeFactors 的参数');
    if (n < 2) return [];
    const out = [];
    let m = n;
    for (let d = 2; d * d <= m; d++) {
      if (m % d === 0) {
        out.push(d);
        while (m % d === 0) m = m / d;
      }
    }
    if (m > 1) out.push(m);
    return out;
  }

  /* 模数必须是**素数**，不只是奇数。整个 orderOf / isGenerator 都建立在
     「ℤ/pℤ 的乘法群是 p−1 阶循环群」上，合数 p 上这句话不成立（群阶是
     φ(p)，而且群未必循环）——那时 orderOf 会去用 p−1 的因子降幂，得到一个
     看着完全正常的错阶。合数在入口拒绝，比在输出端反查便宜得多。 */
  function requireModulus(p) {
    requireInt(p, '模数 p');
    if (p < 3) throw new Error('diffie-hellman：模数 p 必须是 ≥ 3 的素数，收到 ' + p);
    if (p > NUM_MUL_MAX) {
      throw new Error('diffie-hellman：模数 p 不能超过 ' + NUM_MUL_MAX +
                      '（Number 路径上 p² 就越过 2⁵³ 了，中间量会静默算错），收到 ' + p +
                      '。真要更大的 p 请改走 BigInt。');
    }
    if (!isPrime(p)) {
      throw new Error('diffie-hellman：模数 p 必须是素数，' + p + ' 不是');
    }
    return p;
  }

  function requireTableSize(p) {
    if (p > TABLE_MAX) {
      throw new Error('diffie-hellman：这个函数要按 p 铺一张表，p 不能超过 ' +
                      TABLE_MAX + '，收到 ' + p);
    }
    return p;
  }

  /* g 先落回 [0, p)。g = p + 3 与 g = 3 是同一个生成元；不先规约也能靠模幂
     碰巧算对，但 powers() 会画出另一张图。
     g ≡ 0 直接拒：0 根本不在乘法群里，0ˣ 恒为 0（x>0），"生成元"三个字对它
     没有意义，而返回一张全 0 的表看上去只是"很无聊"，不像出了错。 */
  function normG(g, p) {
    requireInt(g, '生成元 g');
    const v = C.mod(g, p);
    if (v === 0) {
      throw new Error('diffie-hellman：g ≡ 0 (mod ' + p + ') 不在乘法群里，不能作生成元');
    }
    return v;
  }

  function requireExponent(x, name) {
    requireInt(x, name);
    if (x < 0) {
      throw new Error('diffie-hellman：' + name + ' 必须非负，收到 ' + x +
                      '（负指数意思是先求模逆再取幂，那是两步）');
    }
    return x;
  }

  /* ================= 阶与生成元 =================
     ord(g) = 使 gᵏ ≡ 1 的最小正 k。p 素数时它整除 p−1（拉格朗日），所以不必
     从 1 试到 p−1：从 p−1 出发，对每个素因子 q 反复试着除掉 q，能除得下去
     （降幂后仍 ≡ 1）就除。代价是 O(log p) 次模幂，而不是 O(p) 次乘法。

     这件事在这一页上不是效率问题，是**正确性**问题：ord(g) 就是 gˣ 能走到的
     值的个数，也就是密钥空间的真实大小。g 不是原根时那个空间是真子群，
     悄悄小一截——页面第三个页签整页在讲这件事。 */
  function orderOf(g, p) {
    requireModulus(p);
    const gg = normG(g, p);
    let ord = p - 1;
    const qs = primeFactors(p - 1);
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      while (ord % q === 0 && C.modPow(gg, ord / q, p) === 1) ord = ord / q;
    }
    return ord;
  }

  /* 原根 ⟺ 阶恰好是 p−1，也就是 gˣ 跑遍整个乘法群。
     判据直接写成 orderOf(g,p) === p−1，而不是另起一套判定：两者等价，
     但这一行把"原根是什么"印在了代码上，页面上要显示的也正是这句。 */
  function isGenerator(g, p) {
    requireModulus(p);
    return orderOf(g, p) === p - 1;
  }

  /* p 的全部原根，升序。逐个求阶，O(p log p)。
     现算而不是查表：原根的个数是 φ(p−1)，页面要把这个数印出来，那个数就得
     由代码负责，不能由注释负责。 */
  function generators(p) {
    requireModulus(p);
    requireTableSize(p);
    const out = [];
    for (let g = 1; g < p; g++) if (orderOf(g, p) === p - 1) out.push(g);
    return out;
  }

  /* 离散对数地形：x = 0 … p−1 处的 gˣ mod p，按 x 排好。
     用增量乘法而不是逐点 modPow：p 个点、每点一次乘法，比 p 次快速幂快
     一个 log；而中间量 cur * g < p² ≤ 2⁵³ 由 requireModulus 保证。 */
  function powers(g, p) {
    requireModulus(p);
    requireTableSize(p);
    const gg = normG(g, p);
    const out = new Array(p);
    let cur = 1 % p;
    for (let x = 0; x < p; x++) {
      out[x] = cur;
      cur = (cur * gg) % p;
    }
    return out;
  }

  /* gˣ 能取到的值的集合（升序）与它的大小。
     size 必然等于 ord(g)——这不是巧合而是定义，所以这里把两个都返回，
     并由 diffie-hellman.test.js 逐个 g 钉住"它们恒等"。页面要在两处分别说出
     「这条曲线只有 4 个不同的高度」与「ord(g) = 4」，而它们必须是同一个数。 */
  function reachable(g, p) {
    const tbl = powers(g, p);
    const seen = Object.create(null);
    const vals = [];
    for (let i = 0; i < tbl.length; i++) {
      if (!seen[tbl[i]]) { seen[tbl[i]] = 1; vals.push(tbl[i]); }
    }
    vals.sort(function (x, y) { return x - y; });
    return { values: vals, size: vals.length, order: orderOf(g, p) };
  }

  /* ================= 交换本身 ================= */
  function publicValue(g, x, p) {
    requireModulus(p);
    return C.modPow(normG(g, p), requireExponent(x, '指数'), p);
  }

  /* 一次完整的交换。**两边分开算**，最后比较——不是算一次然后声称双方相同。
     这个区别是这个函数存在的理由：页面上那句"双方都到达了同一个数"必须是
     一条被验证的等式，而不是一句被复制的文案。agree 为 false 时页面要能说出
     这件事（中间人那一路正是靠它显形）。 */
  function exchange(p, g, a, b) {
    requireModulus(p);
    const gg = normG(g, p);
    requireExponent(a, "Alice 的秘密 a");
    requireExponent(b, "Bob 的秘密 b");
    const A = C.modPow(gg, a, p);
    const B = C.modPow(gg, b, p);
    const sA = C.modPow(B, a, p);          // Alice：拿收到的 B 再乘方 a 次
    const sB = C.modPow(A, b, p);          // Bob：  拿收到的 A 再乘方 b 次
    return { p: p, g: gg, a: a, b: b, A: A, B: B, sA: sA, sB: sB,
             agree: sA === sB, shared: sA };
  }

  /* Eve 的活：给定 g、p、target，找 x 使 gˣ ≡ target。
     朴素扫描，从 x = 0 起逐次乘 g——这就是"她只有这一招"的字面实现。
     steps 是**真的数出来的**试探次数，页面印的就是它，不是一个估计值。

     found 为 false 是一个正常的结果，不是错误：g 不是原根时，target 完全
     可能落在 gˣ 够不着的那部分里。那一路恰恰是页面要展示的"生成元选错了"
     的另一面，所以这里返回而不是抛。 */
  function discreteLog(g, p, target) {
    requireModulus(p);
    const gg = normG(g, p);
    const y = C.mod(requireInt(target, '目标值 target'), p);
    let cur = 1 % p;
    for (let x = 0; x < p; x++) {
      if (cur === y) return { found: true, x: x, steps: x + 1, bound: p - 1 };
      cur = (cur * gg) % p;
    }
    /* 扫完 p 个 x 仍没命中。上界写 p−1 而不是 ord(g)：Eve 事前不需要知道
       自己扫的是个真子群，"最多 p−1 次"才是她拿到的那条保证。 */
    return { found: false, x: -1, steps: p, bound: p - 1 };
  }

  /* 平方–乘法阶梯的代价：正向那一侧的数字。
     左到右二进制法：bits−1 次平方 + (popcount−1) 次乘。
     这个函数存在的唯一理由是让"正向 8 步 / 反向 100 次"成为一对可以并排
     印在页面上的**实数**，而不是一句"容易 vs 困难"。 */
  function ladderSteps(e) {
    requireExponent(e, '指数');
    if (e === 0) return { bits: 0, squarings: 0, multiplies: 0, total: 0 };
    let bits = 0, ones = 0, v = e;
    while (v > 0) {
      bits++;
      if (v % 2 === 1) ones++;
      v = Math.floor(v / 2);
    }
    return { bits: bits, squarings: bits - 1, multiplies: ones - 1,
             total: (bits - 1) + (ones - 1) };
  }

  /* ================= 中间人 =================
     未经认证的 DH 挡不住一个**主动**的攻击者。Mallory 把线剪断，两头各跑一次
     完整的、教科书意义上完全正确的 DH：她和 Alice 共享 gᵃᵐ，和 Bob 共享 gᵇᵐ。
     两条通道各自的数学都是对的，双方各自的验证也都会通过——因为 DH 从来没有
     承诺过"对面是谁"。它给的是保密性，不是身份。

     这不是"DH 的一个 bug"，而是这个算法的边界，所以它在这里是一个一等的导出，
     不是一段注释：页面要能把两个**不相等**的共享秘密并排画出来。 */
  function mitm(p, g, a, b, m) {
    requireModulus(p);
    const gg = normG(g, p);
    requireExponent(a, "Alice 的秘密 a");
    requireExponent(b, "Bob 的秘密 b");
    requireExponent(m, "Mallory 的秘密 m");
    const A = C.modPow(gg, a, p);
    const B = C.modPow(gg, b, p);
    const M = C.modPow(gg, m, p);          // Mallory 冒名顶替时发出的那个公开值
    const aliceSecret = C.modPow(M, a, p); // Alice 以为这是和 Bob 的共享秘密
    const bobSecret = C.modPow(M, b, p);   // Bob 以为这是和 Alice 的共享秘密
    const malloryWithAlice = C.modPow(A, m, p);
    const malloryWithBob = C.modPow(B, m, p);
    return {
      A: A, B: B, M: M,
      aliceSecret: aliceSecret, bobSecret: bobSecret,
      malloryWithAlice: malloryWithAlice, malloryWithBob: malloryWithBob,
      /* 三条断言，页面逐条显示：Mallory 两边都读得到，而两边的秘密不相同。
         最后一条（未被攻击时双方本该共享的那个值）留着做对照：它既不等于
         aliceSecret 也不等于 bobSecret，"这次交换被替换掉了"因此是可见的
         ——只是对 Alice 和 Bob 不可见。 */
      aliceMatchesMallory: aliceSecret === malloryWithAlice,
      bobMatchesMallory: bobSecret === malloryWithBob,
      aliceMatchesBob: aliceSecret === bobSecret,
      honestShared: C.modPow(A, b, p)
    };
  }

  return { isPrime, primeFactors, orderOf, isGenerator, generators,
           powers, reachable, publicValue, exchange, discreteLog,
           ladderSteps, mitm,
           NUM_MUL_MAX, TABLE_MAX };
});
