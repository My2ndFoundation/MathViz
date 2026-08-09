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

  return { ALPHABET, N, isAlpha, normalize, letters, fromIndices,
           mod, gcd, egcd, modInverse };
});
