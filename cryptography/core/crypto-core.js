(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CryptoCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const N = 26;

  function isAlpha(ch) {
    if (typeof ch !== 'string' || ch.length !== 1) return false;
    const c = ch.charCodeAt(0);
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
  }

  /* 只留 A-Z 并大写。刻意**不**做 Unicode 折叠（é → E）：这是古典密码，
     字母表就是 26 个，把 é 悄悄折进 E 会让"密文长度 = 明文字母数"这条
     使用者肉眼在数的关系对不上。丢弃比折叠诚实。 */
  function normalize(text) {
    return String(text).toUpperCase().replace(/[^A-Z]/g, '');
  }

  function letters(text) {
    const s = normalize(text);
    const out = [];
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) - 65);
    return out;
  }

  function fromIndices(idx) {
    let s = '';
    for (let i = 0; i < idx.length; i++) s += ALPHABET.charAt(mod(idx[i], N));
    return s;
  }

  /* JS 的 % 是取余不是取模：(-1) % 26 === -1。整个古典密码部分都建立在
     "落回 [0,n)" 上，所以这一个函数是地基，不许有人图省事直接写 %。 */
  function mod(a, n) {
    /* 模数必须为正，不只是非零。n < 0 时 ((a%n)+n)%n 会给出**负**结果
       （实测 mod(5,-3) === -1），而这个函数对外承诺的是"结果恒 >= 0"，
       整个古典密码部分都建立在那句承诺上。与其让一个负模数悄悄产出负下标、
       在 fromIndices 里变成 charAt(-1) 那种空字符串，不如在入口就拒绝：
       今天没有调用方传负模数，正因为如此，现在把门关上是免费的。 */
    if (!(n > 0)) throw new Error('mod 的模数必须是正数，收到 ' + n);
    return ((a % n) + n) % n;
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }

  /* 扩展欧几里得：返回 [g, x, y] 满足 a*x + b*y === g === gcd(a,b)。
     modInverse 靠它，Affine 的解密也靠它。 */
  function egcd(a, b) {
    let old_r = a, r = b;
    let old_s = 1, s = 0;
    let old_t = 0, t = 1;
    while (r !== 0) {
      const q = Math.floor(old_r / r);
      let tmp = old_r - q * r; old_r = r; r = tmp;
      tmp = old_s - q * s; old_s = s; s = tmp;
      tmp = old_t - q * t; old_t = t; t = tmp;
    }
    /* gcd 约定非负；a<0 或 b<0 时上面会得到负的 old_r，连同系数一起翻号，
       贝祖等式仍成立。 */
    if (old_r < 0) return [-old_r, -old_s, -old_t];
    return [old_r, old_s, old_t];
  }

  function modInverse(a, n) {
    const r = egcd(mod(a, n), n);
    if (r[0] !== 1) return null;      // 不互素，逆元不存在
    return mod(r[1], n);
  }

  /* ================= ℤ/nℤ 上的矩阵（Hill 密码） =================
     Hill 把每 k 个字母看成 ℤ/nℤ 上的一个列向量，密钥是 k×k 矩阵：c = M·p (mod n)。
     解密要的不是"除以 M"，而是 M 在**模 n 意义下**的逆，它存在的充要条件是
     gcd(det M, n) = 1 —— 不是实数意义上的 det ≠ 0。这一条差别正是 Hill 那一页
     要讲的东西：行列式为 13 的矩阵在实数上完全可逆，模 26 却是死的（13 与 26
     不互素）。所以下面的逆元一律走 modInverse，绝不新写第二份模逆实现——
     两份模逆实现总有一天会给出两个答案，而那天没人知道该信哪个。 */

  /* 行列式按 Laplace 展开，代价是 k!：k=8 是 4 万次乘法、还在一帧之内；
     k=12 是 4.8 亿次，页面当场假死。Hill 页面只用 2×2 / 3×3，把门开在 8
     是免费的，而"用户手滑贴进一个 12 阶方阵就整页无响应"不是。 */
  const MAT_MAX_DIM = 8;

  /* 形状检查集中在一处。矩阵参数只有三种坏法：不是数组、行长不齐、元素不是整数。
     整数这一条不是洁癖——M[i][j] = 2.5 时 mod(2.5, 26) 老老实实返回 2.5，
     一路传到 fromIndices 就成了 charAt(2.5) === ''，密文凭空少一个字母，
     而中间没有任何一步报错。在入口拒绝，比在输出端反查便宜得多。 */
  function matShape(M, name) {
    if (!Array.isArray(M) || M.length === 0) throw new Error(name + ' 需要非空的二维数组');
    const rows = M.length;
    if (!Array.isArray(M[0]) || M[0].length === 0) throw new Error(name + ' 的行必须是非空数组');
    const cols = M[0].length;
    for (let i = 0; i < rows; i++) {
      const r = M[i];
      if (!Array.isArray(r) || r.length !== cols) {
        throw new Error(name + ' 第 ' + i + ' 行的长度与第 0 行不齐（应为 ' + cols + '）');
      }
      for (let j = 0; j < cols; j++) {
        if (!Number.isInteger(r[j])) {
          throw new Error(name + ' 的元素 [' + i + '][' + j + '] 不是整数：' + r[j]);
        }
      }
    }
    return [rows, cols];
  }

  function matSquareDim(M, name) {
    const s = matShape(M, name);
    if (s[0] !== s[1]) throw new Error(name + ' 需要方阵，收到 ' + s[0] + '×' + s[1]);
    if (s[0] > MAT_MAX_DIM) {
      throw new Error(name + ' 只支持 ' + MAT_MAX_DIM + ' 阶以内的方阵（行列式按 Laplace 展开，代价是 k!），收到 ' + s[0]);
    }
    return s[0];
  }

  /* 划去第 r 行第 c 列，返回 (k−1)×(k−1) 的子阵。k=1 时会得到空数组，
     所以调用方必须自己拦住 k=1（matInverse 里那一支）。 */
  function matMinor(M, r, c) {
    const k = M.length;
    const out = [];
    for (let i = 0; i < k; i++) {
      if (i === r) continue;
      const row = [];
      for (let j = 0; j < k; j++) if (j !== c) row.push(M[i][j]);
      out.push(row);
    }
    return out;
  }

  /* 沿第 0 行的 Laplace 展开。每个因子进乘法前先规约到 [0,n)，于是任何中间量
     都小于 n²——传进来一个 1e10 的元素也不会让乘积溜出 2^53 变成错的整数。 */
  function detRec(M, n) {
    const k = M.length;
    if (k === 1) return mod(M[0][0], n);
    if (k === 2) return mod(mod(M[0][0], n) * mod(M[1][1], n) - mod(M[0][1], n) * mod(M[1][0], n), n);
    let d = 0;
    for (let j = 0; j < k; j++) {
      const term = mod(M[0][j], n) * detRec(matMinor(M, 0, j), n);
      d = mod(j % 2 === 0 ? d + term : d - term, n);
    }
    return d;
  }

  function matDet(M, n) {
    matSquareDim(M, 'matDet');
    return detRec(M, n);
  }

  /* c = M·v (mod n)。M 行主序 k×k，v 长度 k，返回长度 k 的新数组。 */
  function matMulVec(M, v, n) {
    const k = matSquareDim(M, 'matMulVec');
    if (!Array.isArray(v) || v.length !== k) {
      throw new Error('matMulVec 的向量长度应为 ' + k + '，收到 ' + (Array.isArray(v) ? v.length : typeof v));
    }
    for (let j = 0; j < k; j++) {
      if (!Number.isInteger(v[j])) throw new Error('matMulVec 的向量元素 [' + j + '] 不是整数：' + v[j]);
    }
    const out = [];
    for (let i = 0; i < k; i++) {
      let s = 0;
      for (let j = 0; j < k; j++) s = mod(s + mod(M[i][j], n) * mod(v[j], n), n);
      out.push(s);
    }
    return out;
  }

  /* A·B (mod n)。不限方阵：r×m 乘 m×c 都收，因为 Hill 页面要用它验证
     M·M⁻¹ = I，也要用它把明文按列拼成矩阵一次乘完。 */
  function matMul(A, B, n) {
    const sa = matShape(A, 'matMul 的左矩阵');
    const sb = matShape(B, 'matMul 的右矩阵');
    if (sa[1] !== sb[0]) {
      throw new Error('matMul 维度不匹配：' + sa[0] + '×' + sa[1] + ' 乘 ' + sb[0] + '×' + sb[1]);
    }
    const out = [];
    for (let i = 0; i < sa[0]; i++) {
      const row = [];
      for (let j = 0; j < sb[1]; j++) {
        let s = 0;
        for (let t = 0; t < sa[1]; t++) s = mod(s + mod(A[i][t], n) * mod(B[t][j], n), n);
        row.push(s);
      }
      out.push(row);
    }
    return out;
  }

  /* M⁻¹ = (det M)⁻¹ · adj M (mod n)；adj 是代数余子式矩阵的**转置**。
     用伴随矩阵而不是高斯消元：ℤ/26ℤ 不是域（2·13 ≡ 0），消元里"用主元去除"
     这一步随时会撞上一个不可逆的主元，得再写一套换行换列的启发式，而且那套
     启发式失败时给不出干净的"不可逆"结论。伴随法只需要一次模逆，
     而那一次模逆恰好就是可逆性判据本身。
     不可逆时返回 null（不是抛异常）：模 n 下不可逆是一个**正常的数学事实**，
     Hill 页面要靠它把"这个密钥不能用"画出来，不是要靠它中断。 */
  function matInverse(M, n) {
    const k = matSquareDim(M, 'matInverse');
    const dInv = modInverse(matDet(M, n), n);
    if (dInv === null) return null;          // gcd(det, n) ≠ 1
    const out = [];
    for (let i = 0; i < k; i++) {
      const row = [];
      for (let j = 0; j < k; j++) {
        /* adj[i][j] = C_ji = (−1)^(i+j) · （划去第 j 行第 i 列的余子式）。
           下标是 (j, i) 而不是 (i, j)——伴随矩阵是代数余子式矩阵的转置。
           漏掉这次转置，在对称矩阵上照样测得过，非对称矩阵才露馅，
           所以测试里必须有非对称的用例。
           k=1 时 matMinor 会给出空数组，1×1 的伴随矩阵按定义就是 [[1]]。 */
        const c = (k === 1) ? 1 : detRec(matMinor(M, j, i), n);
        row.push(mod(dInv * ((i + j) % 2 === 0 ? c : -c), n));
      }
      out.push(row);
    }
    return out;
  }

  /* 判据直接写成 gcd(det, n) === 1，而不是 matInverse(...) !== null：
     两者等价，但这一行把"为什么可逆"印在了代码上，页面上要显示的也正是这句。 */
  function matIsInvertible(M, n) {
    return gcd(matDet(M, n), n) === 1;
  }

  return { ALPHABET, N, isAlpha, normalize, letters, fromIndices,
           mod, gcd, egcd, modInverse,
           MAT_MAX_DIM, matMulVec, matMul, matDet, matInverse, matIsInvertible };
});
