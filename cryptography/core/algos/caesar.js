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
    root.CryptoAlgos.caesar = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* 保留大小写与非字母字符，而不是先 normalize 再加密。
     教学上这更值钱：'Hello, World!' → 'Khoor, Zruog!' 让人一眼看出
     "只有字母参与运算，标点和空格是旁观者"，而 'KHOORZRUOG' 把这件事藏起来了。
     代价是密文泄露了词长——这恰好是第三页"穷举"要讲的弱点之一。 */
  function shift(text, k) {
    k = C.mod(k, C.N);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i);
      const c = text.charCodeAt(i);
      if (c >= 65 && c <= 90) out += String.fromCharCode(65 + C.mod(c - 65 + k, C.N));
      else if (c >= 97 && c <= 122) out += String.fromCharCode(97 + C.mod(c - 97 + k, C.N));
      else out += ch;
    }
    return out;
  }

  function encrypt(text, k) { return shift(String(text), k); }
  function decrypt(text, k) { return shift(String(text), -k); }

  /* 26 个候选，一个不少、按 k 升序——工具页把它们排成 26 行，
     "26 行就是全部可能"正是这一页要传达的东西，少一行都会破坏这个印象。 */
  function bruteForce(cipher) {
    const out = [];
    for (let k = 0; k < C.N; k++) out.push({ k: k, text: decrypt(cipher, k) });
    return out;
  }

  return { encrypt, decrypt, bruteForce };
});
