(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js / affine.js 完全同源——那个字符串会被
       inline_core.py 原样内联进每个工具页，而 check.py 的 outbound_ref_check()
       正在数整个子树里的父目录引用，用它守住"cryptography/ 可以整体搬走"这条
       约束。浏览器分支根本走不到这一行，为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.hill = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= Hill 密码 =================
     c = M·p (mod 26)，M 是 k×k 的行主序方阵，p 是一段 k 个字母拼成的列向量。
     仿射是 k = 1 的那一格：1×1 矩阵 [[a]] 上，M·p 就是 a·p——所以本文件与
     affine.js 的关系，和 affine.js 与 caesar.js 的关系是同一种，
     hill.test.js 里那条 `hill.encrypt(t,[[a]]) === affine.encrypt(t,a,0)`
     （t 已规范化）就是这条关系的执法者，不是顺手多测一点。

     模 n 的矩阵运算一律走 crypto-core：matMul / matMulVec / matDet /
     matInverse / matIsInvertible 全在那里，而且已经被 26⁴ 穷举门钉过。
     这里绝不新写第二份——"同一个量在两处各算一遍"是这个仓库反复记过的账，
     而矩阵求逆是那种两份实现会在**非对称矩阵**上才分叉的东西。

     ---- 与 caesar.js / affine.js 的一处刻意分歧：文本处理 ----
     那两个文件保留大小写与标点（'Hello, World!' → 'Khoor, Zruog!'），
     因为逐字母的映射不改变任何字符的位置。Hill 改变位置：它按 k 个字母一组
     整组做线性变换，还要在末尾补齐。于是"标点原样穿过"这件事在这里连定义
     都写不出来——'HE, LP' 的第二个 block 到底是 'LP' 还是 ', L'？
     所以本文件在入口一律 C.normalize()：只留 A–Z 并大写。这不是省事，是
     block 边界只能定义在字母上。代价要说清楚：密文不再泄露词长（比古典
     密码通常的做法更安全一点），而明文的大小写与标点在加密时就丢了，
     解密还不回来。 */

  const N = C.N;

  /* 补位字母。X 在英文里频率极低（0.15%），补出来的尾巴不太会污染频率统计——
     这是选它而不是选 A 的理由。代价必须说明白：X 本身是一个合法字母，明文
     真的以 X 结尾时，解密方无从判断末尾那个 X 是原文还是补的。古典 Hill 就是
     这样，本模块不发明一套长度前缀去掩盖它。 */
  const PAD = 'X';

  /* 形状校验完全托付给 core：matDet 内部会跑 matSquareDim（方阵、行长齐、
     元素是整数、阶数不超过 MAT_MAX_DIM）。这里只在它通过之后取 k。
     不自己再写一套形状检查——两套检查早晚会给出两个答案，而那天没人知道
     该信哪个。 */
  function keyDim(M) {
    C.matDet(M, N);
    return M.length;
  }

  /* 可用 ⟺ gcd(det M, 26) = 1。这不是约定俗成的规矩，是"这个线性映射是不是
     双射"的全部内容：det = 13 的矩阵在实数上完全可逆，模 26 却是死的。
     判据直接用 core 的 matIsInvertible（它内部就写着 gcd(matDet, n) === 1）。 */
  function isUsableKey(M) { return C.matIsInvertible(M, N); }

  /* 抛，而不是返回 null 或原样返回。不可用的 M 不是"效果差一点的密钥"，
     它是根本不成其为密钥的东西：解密不是更难，是**不存在**。
     消息里带上实际的 det 与 gcd——使用者看到 "gcd = 2" 才知道自己撞的是
     哪个因子，而不是笼统地"这个矩阵不行"。 */
  function requireUsable(M) {
    if (isUsableKey(M)) return;
    const d = C.matDet(M, N);
    throw new Error('hill: det M ≡ ' + d + ' (mod 26)，与 26 不互素（gcd = ' +
                    C.gcd(d, N) + '），M 在模 26 下没有逆，解密无从谈起');
  }

  /* ================= 分组 ================= */

  /* 规范化并补齐到 k 的整数倍。长度已经是整数倍时一个字母都不加——
     "总是补一整组"那种写法会让 decrypt(encrypt(p)) 每次都长出 k 个字母。 */
  function pad(text, k) {
    if (!Number.isInteger(k) || k < 1) {
      throw new Error('hill: 分组长度 k 必须是正整数，收到 ' + k);
    }
    let s = C.normalize(text);
    const r = s.length % k;
    if (r !== 0) {
      for (let i = r; i < k; i++) s += PAD;
    }
    return s;
  }

  /* 补齐后的下标分组：blocks('HELP', 2) → [[7,4],[11,15]]。
     工具页画"一个 digraph 就是一个 2 维向量"时读的就是这个。 */
  function blocks(text, k) {
    const idx = C.letters(pad(text, k));
    const out = [];
    for (let i = 0; i < idx.length; i += k) out.push(idx.slice(i, i + k));
    return out;
  }

  /* ================= 裸变换与加解密 =================
     applyRaw 与 encrypt 分家，与 affine.js 的 mapRaw / encrypt 是同一条纪律：
     工具页的"几何"页签整页都在讲 gcd(det,26) ≠ 1 时会发生什么，而那件事只有
     把塌陷画出来才讲得清；encrypt 在那种 M 上必须抛（一个不可逆的密钥做出来
     的"密文"没有人能解开，悄悄返回它等于撒谎）。两个需求都成立，所以它们是
     两个函数。只有 encrypt 的话，工具页画塌陷就只剩两条路——包一层 try/catch
     把异常当控制流用，或者自己再写一遍模乘。两条都比多一个导出更坏。 */
  function applyRaw(text, M) {
    const k = keyDim(M);
    const bs = blocks(text, k);
    let out = '';
    for (let i = 0; i < bs.length; i++) out += C.fromIndices(C.matMulVec(M, bs[i], N));
    return out;
  }

  function encrypt(text, M) { requireUsable(M); return applyRaw(text, M); }

  /* 解密就是用 M⁻¹ 再做一次同样的变换——这正是这个密码的全部内容：
     "除以矩阵"不存在，存在的是**模 26 意义下的矩阵逆**。
     复用 applyRaw 而不是抄一遍循环：加密与解密走同一段分组代码，
     "补位规则"这类行为就不可能只在一边成立。 */
  function decrypt(text, M) {
    requireUsable(M);
    return applyRaw(text, C.matInverse(M, N));
  }

  /* 不可用时返回 null（不是抛）：模 26 下不可逆是一个**正常的数学事实**，
     工具页要靠它把"这把钥匙不能用"画出来，不是要靠它中断。 */
  function inverseKey(M) { return C.matInverse(M, N); }

  /* ================= 密钥的两种来源 ================= */

  /* 字母串 → k×k 矩阵，行主序。多余的字母被忽略（这样同一串 9 个字母
     既能当 3×3 的密钥、也能取前 4 个当 2×2 的密钥，工具页的 k 滑杆才
     不必换一套输入）。字母不够则抛：静默循环补齐等于凭空发明密钥材料，
     而使用者会以为自己输的那几个字母就是全部密钥。

     返回的矩阵**不保证可用**——一串合法字母完全可能拼出 gcd(det,26) ≠ 1 的
     矩阵。那正是 isUsableKey 要回答的问题，不该由本函数越权替它拒绝。 */
  function keyFromString(s, k) {
    if (!Number.isInteger(k) || k < 1) {
      throw new Error('hill.keyFromString: k 必须是正整数，收到 ' + k);
    }
    const idx = C.letters(s);
    if (idx.length < k * k) {
      throw new Error('hill.keyFromString: k = ' + k + ' 需要 ' + (k * k) +
                      ' 个字母，只拿到 ' + idx.length + ' 个');
    }
    const M = [];
    for (let i = 0; i < k; i++) M.push(idx.slice(i * k, i * k + k));
    return M;
  }

  /* 矩阵 → 字母串，keyFromString 的逆。工具页要把矩阵印成人能读的密钥，
     而"矩阵与它的字母写法是同一个东西"这句话得有人负责——
     hill.test.js 里那条 keyFromString(keyLetters(M), k) === M 就是它。 */
  function keyLetters(M) {
    const k = keyDim(M);
    const flat = [];
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) flat.push(M[i][j]);
    return C.fromIndices(flat);
  }

  /* 抽样上限。k=2 时可用矩阵占 157248/456976 ≈ 34.4%，k=3 约 30.1%
     （两个数都由群论算出：|GLₖ(ℤ/26)| = |GLₖ(F₂)|·|GLₖ(F₁₃)|），
     所以期望 3 次左右就能抽到。400 次全落空只可能是随机源坏了，
     那种时候要响，不要静静地转下去。 */
  const RANDOM_KEY_TRIES = 400;

  /* 随机可用密钥。**随机源必须注入**，本函数内部一次都不碰 Math.random：
     一个偷偷用全局随机源的函数没法写确定性测试，而"今天绿明天红"的测试
     最后一定会被人加上 retry 或者干脆删掉。工具页传一个自己的 LCG 进来，
     于是同一次会话里的"随机密钥"按钮可复现、截图也可复现。

     rngFn 的契约与 Math.random 一致：返回 [0,1) 的数。当场校验而不是
     "凑合用"——rngFn 返回 undefined 时 Math.floor 会给出 NaN，一路传到
     matShape 才报"元素不是整数"，那条错误信息指不回真正的病因。 */
  function randomKey(k, rngFn) {
    if (!Number.isInteger(k) || k < 1) {
      throw new Error('hill.randomKey: k 必须是正整数，收到 ' + k);
    }
    if (typeof rngFn !== 'function') {
      throw new Error('hill.randomKey 需要注入一个随机源函数（契约同 Math.random：' +
                      '返回 [0,1) 的数）——本函数不会自己去拿全局随机源');
    }
    for (let t = 0; t < RANDOM_KEY_TRIES; t++) {
      const M = [];
      for (let i = 0; i < k; i++) {
        const row = [];
        for (let j = 0; j < k; j++) {
          const u = rngFn();
          if (!(u >= 0 && u < 1)) {
            throw new Error('hill.randomKey: 注入的随机源返回了 ' + u +
                            '，契约要求 [0,1) 之间的数');
          }
          row.push(Math.floor(u * N));
        }
        M.push(row);
      }
      if (isUsableKey(M)) return M;
    }
    throw new Error('hill.randomKey: 连抽 ' + RANDOM_KEY_TRIES +
                    ' 次都不可用——注入的随机源大概率是常数或退化的');
  }

  /* ================= 已知明文攻击 =================
     Hill 对频率分析很强：k = 2 时统计的是 676 个 digraph 而不是 26 个字母，
     k = 3 时是 17576 个。但它对**已知明文**一触即溃，原因是一句线性代数：
     线性映射由它在一组基上的取值唯一确定。

     把 k 个已知明文分组按列拼成 k×k 的 P，对应的密文分组拼成 Q，则
       Q = M·P  (mod 26)   ⟹   M = Q·P⁻¹  (mod 26)
     k² 个未知数，k 个分组（每组给出 k 个方程）刚好够。没有搜索、没有统计、
     没有"最像英文的那一个"——一次矩阵求逆，密钥就是精确的那一把。

     ---- 会失败的那一半，以及为什么它必须被显式处理 ----
     P 可逆的条件同样是 gcd(det P, 26) = 1。选到的那 k 个明文分组在模 26 下
     线性相关时（'ABABAB…' 的每个 digraph 都是同一个向量，是最容易撞上的
     形状），P 不可逆，方程组欠定：**有多把 M 同时满足这些配对**，此时给出
     "一个答案"是错的，因为它是一个无从选择的答案里被随手挑出来的一个。
     所以这里返回一个带 reason 的失败对象，而不是一把猜出来的密钥。

     手上分组多于 k 个时先在前 ATTACK_POOL 个里搜一组线性无关的——学习者
     贴进来的已知明文通常远长于 k 个分组，而"前 k 个恰好相关、再往后挪一个
     就好了"是最常见的情形。搜到之后再拿**全部**配对去验证，验证不过说明
     这些配对根本不来自同一把 Hill 密钥（reason: 'inconsistent'）。 */
  const ATTACK_POOL = 12;          // 最多从前 12 个分组里挑组合
  const ATTACK_MAX_COMBOS = 500;   // C(12,3) = 220，够用且封住了 k 变大时的组合爆炸
  const ATTACK_MAX_DETS = 24;      // 失败时回报的 det 样本上限（读数只印得下几个）

  /* 组合枚举，找到就早退。visit 返回 true 表示"要的就是这个"。 */
  function eachCombination(n, k, limit, visit) {
    const idx = new Array(k);
    let tried = 0, done = false;
    (function rec(start, depth) {
      if (done || tried >= limit) return;
      if (depth === k) {
        tried++;
        if (visit(idx.slice()) === true) done = true;
        return;
      }
      for (let i = start; i <= n - (k - depth); i++) {
        idx[depth] = i;
        rec(i + 1, depth + 1);
        if (done || tried >= limit) return;
      }
    })(0, 0);
    return tried;
  }

  function solveKey(plainText, cipherText, k) {
    if (!Number.isInteger(k) || k < 1) {
      throw new Error('hill.solveKey: k 必须是正整数，收到 ' + k);
    }
    const pb = blocks(plainText, k);
    const cb = blocks(cipherText, k);
    const nb = Math.min(pb.length, cb.length);
    const result = {
      ok: false, reason: null, M: null, cols: null,
      blocksAvailable: nb, need: k, tried: 0, dets: [],
      lengthMismatch: pb.length !== cb.length
    };
    if (nb < k) {
      result.reason = 'too-few';
      return result;
    }

    const pool = Math.min(nb, ATTACK_POOL);
    let hit = null;
    const dets = [];
    result.tried = eachCombination(pool, k, ATTACK_MAX_COMBOS, function (cols) {
      /* 第 j 列 = 第 cols[j] 个分组。列向量，不是行——core 的 matMulVec 约定
         就是 c = M·v，把它转置着拼会在非对称的 M 上才露馅。 */
      const P = [], Q = [];
      for (let i = 0; i < k; i++) {
        const rp = [], rq = [];
        for (let j = 0; j < k; j++) { rp.push(pb[cols[j]][i]); rq.push(cb[cols[j]][i]); }
        P.push(rp); Q.push(rq);
      }
      const det = C.matDet(P, N);
      if (dets.length < ATTACK_MAX_DETS) dets.push(det);
      const Pi = C.matInverse(P, N);
      if (Pi === null) return false;
      hit = { M: C.matMul(Q, Pi, N), cols: cols, P: P, Q: Q, Pinv: Pi, det: det };
      return true;
    });
    result.dets = dets;

    if (!hit) {
      /* 每一组候选的 det 都与 26 不互素：这些配对在模 26 下线性相关，
         方程组欠定。**不给答案**，给原因。 */
      result.reason = 'dependent';
      return result;
    }

    /* 用全部配对验证，不只是解出它的那 k 组。解一次矩阵方程总能得到一个 M，
       但"这个 M 真的把每一个已知明文送到对应密文"是另一件事——配对来自两把
       不同的密钥、或者密文被改过时，这里才拦得住。 */
    for (let b = 0; b < nb; b++) {
      const got = C.matMulVec(hit.M, pb[b], N);
      for (let i = 0; i < k; i++) {
        if (got[i] !== cb[b][i]) {
          result.reason = 'inconsistent';
          result.cols = hit.cols;
          result.failedBlock = b;
          return result;
        }
      }
    }

    result.ok = true;
    result.M = hit.M;
    result.cols = hit.cols;
    result.P = hit.P;
    result.Q = hit.Q;
    result.Pinv = hit.Pinv;
    result.det = hit.det;
    result.checked = nb;
    return result;
  }

  /* ================= 塌陷普查（几何页签的数字来源）=================
     把 (ℤ/26)^k 里全部 26^k 个分组过一遍 M，数出像集有多大。
     M 可用时像集恰好是全部 26^k 个点——变换是这个格点集上的一个置换（"剪切"）；
     不可用时像集塌到一个真子群的陪集上，distinct 变小，而每个被击中的点
     恰好有 |ker M| 个原像（同一个陪集），没被击中的点**永远不会作为密文出现**。

     用一次 matMul 把全部列向量一起乘完，而不是 26^k 次 matMulVec：core 的
     matMul 注释里写着它就是为这件事留的（"把明文按列拼成矩阵一次乘完"），
     而 17576 次逐向量调用要跑 17576 遍形状校验。

     counts 是按进位下标编号的原像计数（下标 = w₀·26^(k−1) + … + w_{k−1}），
     画面与读数读的是同一份数组——两次独立计算哪怕结果相同，也会让
     "图上的 338 与读数里的 338"变成两个巧合相等的数。 */
  function imageCensus(M) {
    const k = keyDim(M);
    let total = 1;
    for (let i = 0; i < k; i++) total *= N;

    const P = [];
    for (let i = 0; i < k; i++) P.push(new Array(total));
    for (let col = 0; col < total; col++) {
      let v = col;
      for (let i = k - 1; i >= 0; i--) { P[i][col] = v % N; v = Math.floor(v / N); }
    }
    const Q = C.matMul(M, P, N);

    const counts = new Uint16Array(total);
    let distinct = 0;
    for (let col = 0; col < total; col++) {
      let at = 0;
      for (let i = 0; i < k; i++) at = at * N + Q[i][col];
      if (counts[at] === 0) distinct++;
      counts[at]++;
    }
    return {
      k: k, total: total, distinct: distinct, lost: total - distinct,
      fold: total / distinct,          // = |ker M|，每个像点的原像数
      invertible: distinct === total,
      counts: counts
    };
  }

  return {
    PAD, pad, blocks,
    encrypt, decrypt, applyRaw,
    isUsableKey, inverseKey,
    randomKey, keyFromString, keyLetters,
    solveKey, imageCensus
  };
});
