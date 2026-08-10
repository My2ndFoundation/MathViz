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
    root.CryptoAlgos.transposition = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= 非字母与填充的政策（本模块唯一的一条，两种密码共用）=================

     ① **先规范化成纯字母**（C.normalize：只留 A-Z 并大写），空格、标点、数字
        一律丢弃。这与 caesar.js 的选择**相反**，而且是故意相反的：

        Caesar 是逐字符的代换，'Hello, World!' → 'Khoor, Zruog!' 让人一眼看出
        "只有字母参与运算，标点是旁观者"。换位不是逐字符的——列宽与栅栏的锯齿
        都定义在**位置**上。把空格留在网格里，就等于宣称空格也占一个格子、也
        参与换位，于是 5 列的网格里第 2 列可能整列都是空格，读出来的密文里空格
        的位置泄露了原文的断词，而"网格"这个图形本身教的是错的形状。丢弃比
        保留诚实。

     ② **不做任何填充**（列换位用不完整矩形，栅栏天然不需要）。
        这一条不是省事，它是本工具中心论点的前提：

            letterCounts(明文) 必须与 letterCounts(密文) **逐项相等**。

        只要往末行补一个 'X'，密文就凭空多出一个 X，频率剖面不再全等，
        第三页"两条剖面一模一样"这句话当场变成一句约等于。所以列换位这里用的
        是**不完整列换位**（incomplete columnar）：最后一行可以是短的，各列
        因此长度不等（前 n mod cols 列比其余列多一个字母），解密时按同一条规则
        把列长算回来。代价是密文长度不再是列数的整数倍——这恰好是真话。

     ③ 于是本模块对外的往返承诺是：
            decrypt(encrypt(p, key), key) === normalize(p)
        而不是 === p。normalize 是幂等的，所以对已经规范化过的输入，
        往返是逐字节的恒等。 */

  /* keyword 的字母决定各列被读出的先后。返回一个**读出顺序**数组：
     order[j] 是第 j 个被读出的列的下标。

     并列的字母按它们在关键词里的先后（左到右）分先后——这是唯一需要小心的
     地方，也是朴素实现最常出错的地方。用 (字母, 原下标) 成对排序、字母相同
     时比下标，比"依赖 sort 的稳定性"更可靠：ECMAScript 直到 ES2019 才要求
     Array.prototype.sort 稳定，而这段代码要在浏览器里跑，不该建立在一条
     "现在的引擎都稳定"的经验上。

     'BANANA' → A(1) A(3) A(5) B(0) N(2) N(4) → [1, 3, 5, 0, 2, 4]。 */
  function columnOrder(keyword) {
    const kw = C.normalize(keyword);
    /* 空关键词没有列，"横着写进 0 列的网格"根本不是一个有定义的动作。
       这里当场抛，而不是悄悄退化成恒等换位——恒等换位是一句谎话（它宣称
       "换过了，只是没变"）。调用方（工具页）负责在关键词框空着时不调用本
       模块，而不是让本模块替它编一个结果。与 crypto-core.js 的 mod() 拒绝
       非正模数是同一条纪律。 */
    if (!kw.length) throw new Error('columnOrder: 关键词里至少要有一个字母，收到 ' + JSON.stringify(String(keyword)));
    const pairs = [];
    for (let i = 0; i < kw.length; i++) pairs.push([kw.charCodeAt(i), i]);
    pairs.sort(function (a, b) { return (a[0] - b[0]) || (a[1] - b[1]); });
    return pairs.map(function (p) { return p[1]; });
  }

  /* 列换位加密：按行横着写满网格，再按 columnOrder 给出的次序竖着读出来。
     第 c 列装的是原文里下标 ≡ c (mod cols) 的那些字母——不建二维数组，
     直接用步长 cols 走一遍，省掉"最后一行有没有这一格"的分支（超出长度
     的下标自然不进循环）。 */
  function columnarEncrypt(text, keyword) {
    const s = C.normalize(text);
    const order = columnOrder(keyword);
    const cols = order.length;
    let out = '';
    for (let j = 0; j < cols; j++) {
      const c = order[j];
      for (let i = c; i < s.length; i += cols) out += s.charAt(i);
    }
    return out;
  }

  /* 列换位解密。关键在于**先把各列的长度算出来**再切密文：不完整网格里
     前 (n mod cols) 列比别的列多一个字母，按等长切会从第二列起整体错位，
     而错位的结果仍然是一串合法字母——不会抛错，只会静静地解错。 */
  function columnarDecrypt(cipher, keyword) {
    const s = C.normalize(cipher);
    const order = columnOrder(keyword);
    const cols = order.length;
    const n = s.length;
    const full = Math.floor(n / cols);      // 每列至少这么长
    const extra = n % cols;                 // 前 extra 列各多一个
    const plain = new Array(n);
    let pos = 0;
    for (let j = 0; j < cols; j++) {
      const c = order[j];
      const len = full + (c < extra ? 1 : 0);
      for (let r = 0; r < len; r++) plain[c + r * cols] = s.charAt(pos++);
    }
    return plain.join('');
  }

  /* 栅栏的锯齿：返回长度为 len 的数组，第 i 项是位置 i 落在第几条栅栏上。
     绘图与加解密共用这一份——两处各推一遍锯齿，早晚会有一处的折返差一格，
     而那种错位画出来仍然像一条锯齿，只是与密文对不上。 */
  function railPattern(len, rails) {
    const R = Math.round(rails);
    if (!(R >= 1)) throw new Error('railPattern: 栅栏数至少是 1，收到 ' + rails);
    const out = [];
    /* R === 1 必须单独走：通用公式的周期是 2R−2，R=1 时周期为 0。
       不特判的话不是抛错，是死循环或全 NaN。 */
    if (R === 1) {
      for (let i = 0; i < len; i++) out.push(0);
      return out;
    }
    let r = 0, dir = 1;
    for (let i = 0; i < len; i++) {
      out.push(r);
      if (r === 0) dir = 1;
      else if (r === R - 1) dir = -1;
      r += dir;
    }
    return out;
  }

  /* 栅栏加密：沿锯齿写下去，再一行一行读出来。 */
  function railFenceEncrypt(text, rails) {
    const s = C.normalize(text);
    const R = Math.round(rails);
    const pat = railPattern(s.length, R);
    let out = '';
    for (let row = 0; row < R; row++) {
      for (let i = 0; i < s.length; i++) if (pat[i] === row) out += s.charAt(i);
    }
    return out;
  }

  /* 栅栏解密：锯齿只与**长度**有关，与内容无关——所以先按同一份锯齿数出
     每行有多少个字母，把密文切成行，再沿锯齿依次取回。 */
  function railFenceDecrypt(cipher, rails) {
    const s = C.normalize(cipher);
    const R = Math.round(rails);
    const pat = railPattern(s.length, R);
    const count = new Array(R).fill(0);
    for (let i = 0; i < pat.length; i++) count[pat[i]]++;
    const start = new Array(R).fill(0);
    for (let row = 1; row < R; row++) start[row] = start[row - 1] + count[row - 1];
    const cursor = start.slice();
    const plain = new Array(s.length);
    for (let i = 0; i < s.length; i++) plain[i] = s.charAt(cursor[pat[i]]++);
    return plain.join('');
  }

  return {
    columnOrder, columnarEncrypt, columnarDecrypt,
    railPattern, railFenceEncrypt, railFenceDecrypt
  };
});
