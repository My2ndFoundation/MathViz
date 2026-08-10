(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由不是风格——那个字符串会被 inline_core.py 原样内联进每个
       工具页，而 check.py 的 outbound_ref_check() 正在数整个子树里的父目录
       引用，用它守住"cryptography/ 可以整体搬走"这条约束。浏览器分支根本走
       不到这一行，为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.affine = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* 仿射密码：E(x) = (a·x + b) mod 26，D(y) = a⁻¹·(y − b) mod 26。
     凯撒是它的一格特例（a = 1），所以这个文件在行为上必须与 caesar.js
     严格对齐：同样保留大小写、同样让标点与非 ASCII 原样穿过。
     affine.test.js 里那条 `affine.encrypt(t,1,k) === caesar.encrypt(t,k)`
     就是这条对齐的执法者——它不是"顺手也测一下"，它是这个文件存在的前提：
     如果 a=1 与凯撒不逐字节相同，"仿射是凯撒的推广"这句话在这个仓库里
     就只是文案，而不是可执行的事实。

     模逆元不在这里重写：crypto-core.js 已经有 gcd / egcd / modInverse，
     而"同一个量在两处各算一遍"是这个仓库反复记过的账。 */

  const N = C.N;

  /* a、b 先落回 [0,26)。a=27 与 a=1 是同一个密钥、a=−1 与 a=25 是同一个密钥。
     不先规约也能靠 gcd 碰巧判对可逆性，但 mapping() 会画出 27 倍角速度的
     弦图——与 a=1 那张图完全不同，而它们本该是同一张。可逆性判对了、图画错了
     是最难发现的那种错：没有任何东西会报警。 */
  function normA(a) { return C.mod(a, N); }
  function normB(b) { return C.mod(b, N); }

  /* a 可逆 ⟺ gcd(a,26) = 1。这不是约定俗成的"规矩"，是这个映射是不是双射的
     全部内容——见 collapse() 与工具页第二个页签。 */
  function isValidA(a) { return C.gcd(normA(a), N) === 1; }

  /* 与 26 互素的 a 恰好 12 个：26 = 2·13，φ(26) = φ(2)·φ(13) = 1·12。
     这里现算而不是写死 [1,3,5,…,25]：密钥空间 12×26 = 312 是这个工具第三页
     的结论，那个 12 必须由代码负责，不能由注释负责。 */
  function validAs() {
    const out = [];
    for (let a = 0; a < N; a++) if (C.gcd(a, N) === 1) out.push(a);
    return out;
  }

  /* ================= 裸映射：与 encrypt 分家的那一半 =================
     26 条对应关系本身：下标 x → (a·x + b) mod 26。**不检查 a 是否可逆。**

     分家不是洁癖。工具页的"塌陷"页签整页都在讲 gcd(a,26) ≠ 1 时会发生什么，
     而那件事只有把塌陷画出来才讲得清；encrypt 在那种 a 上是要抛的（它必须抛：
     一个不可逆的密钥做出来的"密文"没有人能解开，悄悄返回它等于撒谎）。
     两个需求都成立，所以它们是两个函数：encrypt = 守卫 + mapRaw。
     若只有 encrypt，工具页画塌陷就只剩两条路——包一层 try/catch 把异常
     当控制流用，或者干脆自己再写一遍模乘。两条都比多一个导出更坏。 */
  function mapping(a, b) {
    a = normA(a); b = normB(b);
    const out = new Array(N);
    for (let x = 0; x < N; x++) out[x] = C.mod(a * x + b, N);
    return out;
  }

  /* 把映射施加到一段文本上，同样不检查可逆性。
     大小写与非字母字符原样保留，逐字节对齐 caesar.js 的 shift()。 */
  function mapRaw(text, a, b) {
    const m = mapping(a, b);
    const s = String(text);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      const c = s.charCodeAt(i);
      if (c >= 65 && c <= 90) out += String.fromCharCode(65 + m[c - 65]);
      else if (c >= 97 && c <= 122) out += String.fromCharCode(97 + m[c - 97]);
      else out += ch;
    }
    return out;
  }

  /* 抛，而不是返回 null 或原样返回。不可逆的 a 不是"效果差一点的密钥"，
     它是根本不成其为密钥的东西：解密不是更难，是**不存在**。
     消息里带上实际的 gcd —— 使用者看到 "gcd = 13" 才知道自己撞的是 13
     那个因子，而不是笼统地"这个 a 不行"。 */
  function requireInvertible(a) {
    if (isValidA(a)) return;
    throw new Error('affine: a = ' + a + ' 与 26 不互素（gcd = ' +
                    C.gcd(normA(a), N) + '），逆元不存在，解密无从谈起');
  }

  function encrypt(text, a, b) { requireInvertible(a); return mapRaw(text, a, b); }

  function decrypt(text, a, b) {
    requireInvertible(a);
    const ai = C.modInverse(a, N);
    /* 解密本身也是一个仿射映射，系数是 (a⁻¹, −a⁻¹·b)：
       D(y) = a⁻¹·(y − b) = a⁻¹·y + (−a⁻¹·b)。
       所以这里复用 mapRaw 而不是再抄一遍循环——加密与解密走同一段字符
       处理代码，"保留大小写"这类行为就不可能只在一边成立。
       −ai·b 是个负数，mapping() 里的 C.mod 会把它接回 [0,26)。 */
    return mapRaw(text, ai, -ai * b);
  }

  /* 全部 12 个可逆 a × 全部 26 个 b = 312 个候选，一个不少、a 升序 b 升序。
     312 这个数字本身就是第三页的结论：仿射把凯撒的 26 扩大了 12 倍，
     而 312 仍然是一眼能扫完的数目——密钥空间的增长跟不上"能不能穷举"这条线。
     不可逆的 a 不进候选：它们连密钥都不是，摆进来只会把 312 稀释成一个
     看着更大、其实一半是空壳的数。 */
  function bruteForce(cipher) {
    const out = [];
    const as = validAs();
    for (let i = 0; i < as.length; i++) {
      for (let b = 0; b < N; b++) {
        out.push({ a: as[i], b: b, text: decrypt(cipher, as[i], b) });
      }
    }
    return out;
  }

  /* ================= 塌陷普查 =================
     gcd(a,26) = g 时，x ↦ a·x + b 是 g 对 1 的：像集只剩 26/g 个字母，
     另外 26 − 26/g 个字母**没有任何原像**——它们在密文里永远不会出现。
     每一个被合并掉的明文字母恰好换来一个这样的空位，所以
     lost（被合并掉的字母数）与 unreachable.length（够不着的字母数）恒等。
     两个都返回不是冗余：它们是同一件事的两面，工具页要在两边分别说出来
     （"26 个字母只剩 13 个像" 与 "13 个字母永远不会出现"），
     而由本函数保证这两句话说的是同一个数。 */
  function collapse(a, b) {
    const image = mapping(a, b);
    const preimages = [];
    for (let y = 0; y < N; y++) preimages.push([]);
    for (let x = 0; x < N; x++) preimages[image[x]].push(x);

    const unreachable = [];
    let distinct = 0;
    for (let y = 0; y < N; y++) {
      if (preimages[y].length === 0) unreachable.push(y);
      else distinct++;
    }
    return {
      g: C.gcd(normA(a), N),
      invertible: isValidA(a),
      image: image,
      preimages: preimages,
      distinct: distinct,
      lost: N - distinct,
      unreachable: unreachable
    };
  }

  return { encrypt, decrypt, validAs, isValidA, mapping, mapRaw, bruteForce, collapse };
});
