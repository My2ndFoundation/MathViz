(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟文件：路径用 path.join 拼，不写字面的父目录相对路径。
       理由不是风格——那个字符串会被 inline_core.py 原样内联进每个工具页，
       而 check.py 的 outbound_ref_check() 正在数整个子树里的父目录引用，
       用它守住"cryptography/ 可以整体搬走"这条约束。浏览器分支根本走不到
       这一行，为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(
      require(require('path').join(__dirname, '..', 'crypto-core.js')),
      require(require('path').join(__dirname, 'transposition.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    /* ⚠ 浏览器分支从 root.CryptoAlgos.transposition 取列换位，所以工具页的
       `GENERATED:ALGOS` 清单里 **transposition.js 必须排在 polybius.js 之前**。
       顺序错了页面照样载入，直到用户第一次切到 ADFGX 那一页才会死在
       TR.columnarEncrypt 上——与 check.py 第 9 道门守的 CRYPTO-CORE 顺序
       同一种失败形状。 */
    root.CryptoAlgos.polybius = factory(root.CryptoCore, root.CryptoAlgos.transposition);
  }
})(typeof self !== 'undefined' ? self : this, function (C, TR) {
  'use strict';

  /* ================= 波利比乌斯方阵 与 ADFGX =================

     方阵把每个字母换成一对坐标：字母表从 26 个符号缩到 5 个（行号 1-5、
     列号 1-5），代价是每个字母要占两个符号。这一步单独用毫无强度——它是
     一次代换，频率剖面原封不动地跟着搬家。ADFGX 的真正贡献是**接着**做的
     那一步：把坐标序列再做一次列换位，于是一个字母的行坐标和列坐标被拉到
     密文的两个远处。此后密文里任何一个符号都不再是"某个字母"，它只是某个
     字母的一半——代换分析要的那个"符号 ↔ 字母"的对应关系被拆掉了。
     这就是 fractionation（分裂）这个词的全部意思，也是本模块存在的理由。

     ---- I/J 合并：5×5 方阵的那个古典妥协 ----
     26 个字母塞不进 25 个格子。历史上的做法是把 I 和 J 合并成一格（少数
     变体合并 C/K），本模块采用 I/J。后果是**明确的、不可逆的信息丢失**：

         decode(encode('JAM')) === 'IAM'

     J 在加密的第一步就消失了，解密时没有任何东西能把它找回来。这不是 bug，
     是 5×5 这个尺寸的定价；使用者一定会注意到 J 不见了，所以它必须写在这里、
     写在测试里、也写在工具页上，而不是让人自己去猜。
     不想付这个价就用 6×6（makeSquare(kw, { size: 6 })）：36 格装得下 26 个
     字母加 10 个数字，J 保留，代价是坐标变成 1-6、标记字母变成 6 个（ADFGVX，
     一战后期真正用的那一版）。

     ---- 为什么标记字母偏偏是 A D F G X ----
     密文要靠无线电摩尔斯发出去。A(·−) D(−··) F(··−·) G(−−·) X(−··−) 是摩尔斯
     码里彼此差别最大的一组，抄报员听错一个的概率最低。这是工程约束长在密码
     设计上的一处指纹，与数学无关，但它是这个密码之所以长成这样的原因。 */

  /* 5×5 的池子：26 个字母去掉 J（I/J 合并到 I 那一格）。 */
  const SQUARE5 = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
  /* 6×6 的池子：26 个字母一个不少，外加 0-9。 */
  const SQUARE6 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const LABELS5 = 'ADFGX';
  const LABELS6 = 'ADFGVX';

  /* 按方阵尺寸规范化输入。5 阶直接复用 core 的 normalize（只留 A-Z 并大写）
     再把 J 折进 I；6 阶**不能**复用它——C.normalize 会把数字一并丢掉，而
     6×6 的格子里正装着 0-9，丢了它们等于宣称 6 阶方阵有 10 个格子永远用不上。
     所以这里写第二条规则，并且把"为什么不能复用"留在这儿：下一个人看到两条
     规范化会先怀疑是重复代码。 */
  function normalizeFor(text, size) {
    const s = String(text).toUpperCase();
    if (size === 6) return s.replace(/[^A-Z0-9]/g, '');
    return C.normalize(s).replace(/J/g, 'I');
  }

  /* 关键词先填、去重，剩下的格子按池子顺序补齐。
     去重必须在**规范化之后**做：5 阶下 'JIM' 的 J 与 I 规范化后是同一个字母，
     先去重会留下两个 I 的格子。 */
  function makeSquare(keyword, opts) {
    opts = opts || {};
    const size = opts.size == null ? 5 : Math.round(opts.size);
    /* 只接受 5 与 6。悄悄退化成 5 是一句谎话（它宣称"按你说的做了"），
       与 crypto-core.js 的 mod() 拒绝非正模数是同一条纪律。 */
    if (size !== 5 && size !== 6) {
      throw new Error('makeSquare: 方阵只支持 5 阶或 6 阶，收到 ' + JSON.stringify(opts.size));
    }
    const pool = size === 5 ? SQUARE5 : SQUARE6;
    const kw = normalizeFor(keyword == null ? '' : keyword, size);
    const cells = [];
    /* Object.create(null) 而不是 {}：格子里的字符全是 A-Z0-9，撞不上
       'constructor' 这类原型键，但这个哈希的用途就是"见过没有"，
       让它带一份原型属于白送一个将来会咬人的假阳性。 */
    const seen = Object.create(null);
    function push(ch) {
      if (seen[ch]) return;
      seen[ch] = 1;
      cells.push(ch);
    }
    for (let i = 0; i < kw.length; i++) push(kw.charAt(i));
    for (let i = 0; i < pool.length; i++) push(pool.charAt(i));
    return {
      size: size,
      cells: cells,
      keyword: kw,
      /* merged 只对 5 阶为真——工具页要靠它决定该不该在画面上说"J 去哪儿了"。 */
      merged: size === 5,
      labels: size === 5 ? LABELS5 : LABELS6
    };
  }

  /* ---- 坐标的两套记法，以及它们之间那条缝 ----
     coordsOf / charAt 用**0 基**：它们是数组坐标，cells[row * size + col]
     是一次直接寻址，两个函数互为逆。
     encode / decode 用**1 基**：教科书上印的就是 "23 41 15"，第 2 行第 3 列。
     混用两套记法是这类代码最爱出的错，所以两处各自说清楚，并由测试钉住
     charAt(coordsOf(ch)) === ch 与 decode(encode(t)) === t 两条。 */
  function coordsOf(ch, square) {
    const s = normalizeFor(ch, square.size);
    if (s.length !== 1) return null;          // 空白、标点、多字符：本来就没有坐标
    const i = square.cells.indexOf(s);
    if (i < 0) return null;
    /* ch 传 'J' 而 size 为 5 时，返回的 ch 是 'I'——合并这件事在返回值里
       是**看得见的**，调用方不必再自己折一次。 */
    return { row: Math.floor(i / square.size), col: i % square.size, index: i, ch: s };
  }

  function charAt(row, col, square) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      /* 非整数下标会走成 cells[13.5] === undefined：不报错、密文里凭空少一个
         字母、中间没有任何一步出声。在入口拒绝比在输出端反查便宜得多
         （与 crypto-core.js 的 matShape 同一条理由）。 */
      throw new Error('charAt: 行列必须是整数，收到 (' + row + ', ' + col + ')');
    }
    const n = square.size;
    if (row < 0 || row >= n || col < 0 || col >= n) return null;   // 越界是正常的"没有这一格"
    return square.cells[row * n + col];
  }

  /* 明文 → 坐标对，形如 "23 41 15"（1 基）。 */
  function encode(text, square) {
    const s = normalizeFor(text, square.size);
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const p = coordsOf(s.charAt(i), square);
      if (!p) {
        /* normalizeFor 已经把不在池子里的字符筛掉了，所以走到这里只意味着
           square 不是 makeSquare 造的（格子缺了字母）。当场炸掉，不要产出
           一串少了几个字母、看起来完全正常的坐标。 */
        throw new Error('encode: 字符 ' + JSON.stringify(s.charAt(i)) + ' 不在方阵里');
      }
      out.push(String(p.row + 1) + String(p.col + 1));
    }
    return out.join(' ');
  }

  /* 坐标对 → 明文。空格随便加不加，只有数字被读进去。 */
  function decode(pairs, square) {
    const digits = String(pairs).replace(/[^0-9]/g, '');
    if (digits.length % 2 !== 0) {
      throw new Error('decode: 坐标必须成对，收到 ' + digits.length + ' 个数字');
    }
    let out = '';
    for (let i = 0; i < digits.length; i += 2) {
      const r = Number(digits.charAt(i)) - 1;
      const c = Number(digits.charAt(i + 1)) - 1;
      const ch = charAt(r, c, square);
      if (ch == null) {
        throw new Error('decode: 坐标 ' + digits.charAt(i) + digits.charAt(i + 1) +
                        ' 超出 ' + square.size + '×' + square.size + ' 方阵');
      }
      out += ch;
    }
    return out;
  }

  /* ---- 分裂：坐标换成标记字母，一个字母摊成两个符号 ----
     这一步**还不是**加密——它是一次一一对应的改写（A→AA、B→AD……），
     频率剖面只是换了张脸。真正让它变成密码的是紧接着的那次换位。
     单独暴露出来是给工具页用的：中间这个串必须能画出来，"每个字母裂成两半"
     这件事才是看见的，而不是读到的。 */
  function fractionate(text, square) {
    const L = square.labels;
    const s = normalizeFor(text, square.size);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const p = coordsOf(s.charAt(i), square);
      if (!p) throw new Error('fractionate: 字符 ' + JSON.stringify(s.charAt(i)) + ' 不在方阵里');
      out += L.charAt(p.row) + L.charAt(p.col);
    }
    return out;
  }

  function defractionate(frac, square) {
    const L = square.labels;
    const s = String(frac).toUpperCase().replace(/[^A-Z]/g, '');
    if (s.length % 2 !== 0) {
      throw new Error('defractionate: 标记字母必须成对，收到 ' + s.length + ' 个');
    }
    let out = '';
    for (let i = 0; i < s.length; i += 2) {
      const r = L.indexOf(s.charAt(i));
      const c = L.indexOf(s.charAt(i + 1));
      if (r < 0 || c < 0) {
        throw new Error('defractionate: ' + JSON.stringify(s.charAt(i) + s.charAt(i + 1)) +
                        ' 不是 ' + L + ' 里的一对');
      }
      out += charAt(r, c, square);
    }
    return out;
  }

  /* ---- 完整的 ADFGX ----
     换位那一步直接借 transposition.js 的不完整列换位（末行可以是短的、
     不做任何填充），不在这里重写一份：两份列换位实现总有一天会给出两个
     答案，而那天没人知道该信哪个。借用还带来一条免费的性质——密文长度
     恒等于明文字母数的两倍，一个填充字符都没有。 */
  function adfgxEncrypt(text, square, transKey) {
    return TR.columnarEncrypt(fractionate(text, square), transKey);
  }

  function adfgxDecrypt(cipher, square, transKey) {
    return defractionate(TR.columnarDecrypt(cipher, transKey), square);
  }

  /* ---- 逐位置的去向表：本模块唯一为"讲清楚"而存在的函数 ----
     dest[p] 是分裂串第 p 个符号在密文里的下标。工具页要靠它把"同一个字母的
     两半被拉到多远"画成两条线；测试要靠它把那句话变成一个数。

     去向表按列换位的定义走一遍位置（第 c 列装的是下标 ≡ c (mod cols) 的
     符号，各列按 columnOrder 给出的次序读出），**不重算密文**——密文仍然由
     TR.columnarEncrypt 给出，两者的一致性（cipher[dest[p]] === frac[p]）由
     测试逐字符钉住。这样"排列规则"在本仓仍然只有 transposition.js 一个真相，
     这里只是把同一条规则的下标形式再表述一次。

     gaps[i] 是第 i 个明文字母两个坐标在密文里的距离。它就是分裂的收益本身：
     gaps[i] === 1 意味着这个字母的两半仍然挨着，换位什么也没拆开。 */
  function adfgxTrace(text, square, transKey) {
    const plain = normalizeFor(text, square.size);
    const coords = [];
    for (let i = 0; i < plain.length; i++) coords.push(coordsOf(plain.charAt(i), square));
    const frac = fractionate(plain, square);
    const order = TR.columnOrder(transKey);   // 关键词为空时它会抛，调用方负责先拦住
    const cols = order.length;
    const m = frac.length;
    const dest = new Array(m);
    let q = 0;
    for (let j = 0; j < cols; j++) {
      const c = order[j];
      for (let i = c; i < m; i += cols) dest[i] = q++;
    }
    const gaps = [];
    let minGap = null;
    for (let i = 0; i < plain.length; i++) {
      const g = Math.abs(dest[2 * i + 1] - dest[2 * i]);
      gaps.push(g);
      if (minGap === null || g < minGap) minGap = g;
    }
    return {
      plain: plain,
      coords: coords,
      frac: frac,
      cipher: TR.columnarEncrypt(frac, transKey),
      dest: dest,
      order: order,
      cols: cols,
      rows: cols ? Math.ceil(m / cols) : 0,
      gaps: gaps,
      minGap: minGap
    };
  }

  return {
    SQUARE5, SQUARE6, LABELS5, LABELS6,
    normalizeFor, makeSquare, coordsOf, charAt,
    encode, decode,
    fractionate, defractionate,
    adfgxEncrypt, adfgxDecrypt, adfgxTrace
  };
});
