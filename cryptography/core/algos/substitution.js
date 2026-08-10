(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js 那一行完全相同——那个字符串会被 inline_core.py
       原样内联进每个工具页，而 check.py 的 outbound_ref_check() 正在数整个子树
       里的父目录引用，用它守住"cryptography/ 可以整体搬走"这条约束。浏览器
       分支根本走不到这一行，为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.substitution = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* 单表代换：密钥就是"把 A–Z 重新排一遍"的那个排列，key[i] 是明文第 i 个
     字母的密文。凯撒是它的一个特例——密钥恰好是字母表整体转 k 位——所以
     26 个凯撒密钥全都躺在这 26! 个密钥里面，占的比例是 26/26! ≈ 6e-26。
     这条包含关系是本模块与 caesar.js 的关系，也是这个工具要讲的第一件事。

     "单表"是与维吉尼亚那类多表密码的分界：整段报文自始至终只用这一张表，
     所以每个字母的出现次数原样搬到了它的像上——频率分析因此成立。 */

  /* 合法密钥 = 恰好 26 个字符，且是 A–Z 的一个真排列。
     刻意只认大写：小写、空格、重复字母都判 false，由调用方先 normalize。
     "长度对 + 全是字母"不够——'AAAAAAAAAAAAAAAAAAAAAAAAAA' 满足那个较弱的
     条件却没有逆，用它加密的报文谁也解不开。排列这件事必须逐字母数。 */
  function isValidKey(key) {
    if (typeof key !== 'string' || key.length !== C.N) return false;
    const seen = new Array(C.N).fill(false);
    for (let i = 0; i < C.N; i++) {
      const v = key.charCodeAt(i) - 65;
      if (!(v >= 0 && v < C.N)) return false;   // 非大写 A–Z（含小写、标点、非 ASCII）
      if (seen[v]) return false;                // 重复：不是排列，也就没有逆
      seen[v] = true;
    }
    return true;
  }

  /* 密钥非法时**当场抛**，不悄悄退回恒等、也不跳过那个字母。
     悄悄兜底的代价是页面照常吐出一段"看着像密文"的文本，而它既解不开也不是
     任何人的密文——这种错误要很久以后才会被人撞见。crypto-core 的 mod() 对
     负模数用的是同一条策略，理由写在那里。 */
  function requireKey(key) {
    if (!isValidKey(key)) {
      throw new Error('substitution: 密钥必须是 A–Z 的一个 26 字母排列，收到 ' +
                      JSON.stringify(key));
    }
  }

  /* 与 caesar.js 同一条约定：保留大小写与非字母字符，而不是先 normalize 再加密。
     'Hello, World!' 加密后仍然是 'X..., X.....!' 这个形状，让人一眼看出只有字母
     参与代换、标点和空格是旁观者。代价同样是密文泄露了词长——那正是频率分析
     之外另一条能咬进来的缝。 */
  function encrypt(text, key) {
    requireKey(key);
    const s = String(text);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 65 && c <= 90) out += key.charAt(c - 65);
      else if (c >= 97 && c <= 122) out += key.charAt(c - 97).toLowerCase();
      else out += s.charAt(i);
    }
    return out;
  }

  /* 解密不是"反着查一遍表"，而是拿逆排列再加密一次：只有一条代码路径在处理
     大小写与标点，不会出现两份实现慢慢走偏的情况。 */
  function decrypt(text, key) { return encrypt(text, invertKey(key)); }

  /* 逆排列：明文 i 加密成 key[i]，所以密文字母 key[i] 解密回明文字母 i。 */
  function invertKey(key) {
    requireKey(key);
    const out = new Array(C.N);
    for (let i = 0; i < C.N; i++) out[key.charCodeAt(i) - 65] = C.ALPHABET.charAt(i);
    return out.join('');
  }

  /* 关键词密钥：关键词去重后按出现顺序排在前面，剩下的字母按字母序补齐。
     'ZEBRA' 得到 'ZEBRACDFGHIJKLMNOPQSTUVWXY'。

     这是历史上真正被用过的密钥编码方式——人记不住 26 个乱序字母，记得住一个
     词。代价是密钥空间从 26! 塌成"能想起来的词的个数"，而这恰恰是这个工具
     第三页要讲的那句话的另一面：把 26! 当成强度，等于假设密钥真的是均匀取的。

     输入先过 normalize：非字母一律丢弃，所以任何字符串（含空串、中文、标点）
     都能得到一个合法密钥。空串给出恒等密钥——它同样是 26! 个密钥中的一个，
     一点也不特殊，只是刚好什么都不加密。 */
  function keyFromKeyword(word) {
    const s = C.normalize(word);
    const seen = new Array(C.N).fill(false);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const v = s.charCodeAt(i) - 65;
      if (seen[v]) continue;
      seen[v] = true;
      out += C.ALPHABET.charAt(v);
    }
    for (let v = 0; v < C.N; v++) if (!seen[v]) out += C.ALPHABET.charAt(v);
    return out;
  }

  /* 随机密钥（Fisher–Yates，自后向前）。rng 由调用方注入，**模块内绝不碰
     Math.random**：不然测试只能"多跑几次看看像不像随机"，而不能钉住任何一个
     具体结果——洗牌算法最容易错的地方（下标范围、消费 rng 的顺序）恰好只有
     确定性向量能钉住。 */
  function randomKey(rngFn) {
    if (typeof rngFn !== 'function') {
      throw new Error('substitution.randomKey 需要一个返回 [0,1) 的函数；' +
                      '模块内不使用 Math.random');
    }
    const a = C.ALPHABET.split('');
    for (let i = a.length - 1; i > 0; i--) {
      /* 夹一下下标。一个返回 1（或 NaN）的 rng 会算出 i+1 或 NaN，交换到数组
         外面去，产出的"密钥"里带着 undefined——它不抛错、长度还可能看着对，
         但已经不是排列了。这个函数对外承诺的是"返回值恒为合法密钥"，
         守住它的成本是两行。 */
      let j = Math.floor(rngFn() * (i + 1));
      if (!(j >= 0)) j = 0;          // NaN 或负数
      if (j > i) j = i;              // rng 返回了 1
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a.join('');
  }

  return { encrypt, decrypt, invertKey, keyFromKeyword, randomKey, isValidKey };
});
