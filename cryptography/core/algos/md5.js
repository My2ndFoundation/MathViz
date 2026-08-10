(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.md5 = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= MD5 =================
     RFC 1321。这个文件存在的唯一理由是**它坏了**，而且要把"坏在哪儿"说准。

     MD5 有三条互不相同的性质，中文里常被一句"MD5 被破解了"糊在一起：
       · 抗碰撞（collision resistance）—— 找任意两条消息 m₁ ≠ m₂ 使
         MD5(m₁) = MD5(m₂)。**这一条彻底垮了**：Wang 等人 2004 年的差分攻击
         把它从生日界的 2⁶⁴ 降到今天普通笔记本上的几秒钟。本文件带的
         COLLISION 就是那篇论文给出的一对 128 字节消息，它们只差 6 个字节。
       · 抗第二原像（second preimage）与抗原像（preimage）—— 给定 h，找出
         一条 m 使 MD5(m) = h。**这一条没有垮**：目前最好的原像攻击约 2¹²³，
         比暴力的 2¹²⁸ 只快了一点点，工程上等于没有。
     把两者混为一谈是这一章最常见的错误，所以这个模块把 COLLISION 摆出来的
     同时，什么"逆算"函数都不提供——因为没有人知道怎么写。

     ⚠ 这份实现只用于教学演示与那一对碰撞的**验证**，不要拿去做任何安全用途。 */

  /* K[i] = floor(2³² · |sin(i+1)|)（i 以弧度计）。
     写死而不是在加载时用 Math.sin 现算：现算看着更"自我说明"，但它把这张表
     的正确性绑在了各平台 libm 的最后一个 ulp 上——某台机器上 sin 差一个 ulp、
     floor 就可能差 1，于是一台机器算出的哈希和另一台不同，而两边的测试各自
     都是绿的。本仓最怕的正是这种"门测的字节和用户跑的字节不是同一份"。 */
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ];

  const SH = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];

  const IV = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

  const BLOCK_BYTES = 64;
  const DIGEST_BYTES = 16;
  const DIGEST_BITS = 128;

  function typeName(v) {
    if (v === null) return 'null';
    if (typeof v === 'object') return Object.prototype.toString.call(v);
    return typeof v;
  }

  function inputBytes(v, name) {
    if (typeof v === 'string') return C.toBytes(v);
    if (Object.prototype.toString.call(v) === '[object Uint8Array]') return v;
    if (Array.isArray(v)) {
      const out = new Uint8Array(v.length);
      for (let i = 0; i < v.length; i++) {
        const b = v[i];
        if (!Number.isInteger(b) || b < 0 || b > 255) {
          throw new Error(name + '：第 ' + i + ' 个元素不是 0–255 的整数（收到 ' + String(b) + '）');
        }
        out[i] = b;
      }
      return out;
    }
    throw new Error(name + ' 需要字符串、Uint8Array 或 0–255 的整数数组，收到 ' + typeName(v));
  }

  /* 填充与 SHA-256 同构，只有一处不同：长度字段是**小端**。
     MD5 从头到尾按小端读写 32 位字，SHA 系列按大端——两者唯一的字节序差别
     就在这里和取字的地方，抄错的表现是"短消息全对、某些长度全错"。 */
  function padded(msg) {
    const len = msg.length;
    const total = (Math.floor((len + 8) / BLOCK_BYTES) + 1) * BLOCK_BYTES;
    const buf = new Uint8Array(total);
    buf.set(msg, 0);
    buf[len] = 0x80;
    const hi = Math.floor(len / 536870912);
    const lo = len * 8 - hi * 4294967296;
    for (let j = 0; j < 4; j++) {
      buf[total - 8 + j] = (lo >>> (8 * j)) & 0xff;
      buf[total - 4 + j] = (hi >>> (8 * j)) & 0xff;
    }
    return buf;
  }

  const M = new Array(16);

  function digestBytes(input) {
    const msg = inputBytes(input, 'md5');
    const buf = padded(msg);
    let h0 = IV[0], h1 = IV[1], h2 = IV[2], h3 = IV[3];

    for (let off = 0; off < buf.length; off += BLOCK_BYTES) {
      for (let i = 0; i < 16; i++) {
        const j = off + i * 4;
        M[i] = (buf[j] | (buf[j + 1] << 8) | (buf[j + 2] << 16) | (buf[j + 3] << 24)) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16)      { f = ((b & c) | (~b & d)) >>> 0; g = i; }
        else if (i < 32) { f = ((d & b) | (~d & c)) >>> 0; g = (5 * i + 1) & 15; }
        else if (i < 48) { f = (b ^ c ^ d) >>> 0;          g = (3 * i + 5) & 15; }
        else             { f = (c ^ (b | (~d >>> 0))) >>> 0; g = (7 * i) & 15; }
        /* 四个 uint32 相加 < 2³²·4 < 2⁵³，double 精确；rotl32 自己会再夹一次
           32 位范围，所以这里先 `>>> 0`。 */
        const tmp = d;
        d = c; c = b;
        b = (b + C.rotl32((a + f + K[i] + M[g]) >>> 0, SH[i])) >>> 0;
        a = tmp;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    }

    const out = new Uint8Array(DIGEST_BYTES);
    const H = [h0, h1, h2, h3];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) out[i * 4 + j] = (H[i] >>> (8 * j)) & 0xff;
    }
    return out;
  }

  function hex(input) { return C.toHex(digestBytes(input)); }

  function bits(input) { return C.toBits(digestBytes(input)); }

  /* ---- 一对真实的碰撞 ----
     Wang / Yu 的差分攻击（EUROCRYPT 2005，构造发表于 2004）给出的经典样例：
     两条各 128 字节的消息，**只差 6 个字节**，MD5 完全相同。

     这两串十六进制不是拿来当装饰的：md5.test.js 用本文件自己的实现算出它们的
     摘要并断言相等，同时断言 SHA-256 下两者**不同**——后者是那条相等断言的
     负对照。没有负对照的"相等"什么都证明不了：两个指向同一个对象的引用、
     一个恒返回常量的比较函数，都能让相等断言变绿。

     差异位置（字节下标）由测试当场算出来并断言个数，不写死在注释里——
     注释里的数字没有任何东西看着它。 */
  const COLLISION = {
    a: 'd131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f89' +
       '55ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5b' +
       'd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0' +
       'e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70',
    b: 'd131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f89' +
       '55ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5b' +
       'd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0' +
       'e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70'
  };

  function collisionPair() {
    return { a: C.fromHex(COLLISION.a), b: C.fromHex(COLLISION.b) };
  }

  /* 两串字节里不相同的字节下标。给测试断言、也给工具页画那 6 个红格子。 */
  function diffByteIndices(x, y) {
    const a = inputBytes(x, 'md5.diffByteIndices 的第一个参数');
    const b = inputBytes(y, 'md5.diffByteIndices 的第二个参数');
    if (a.length !== b.length) {
      throw new Error('md5.diffByteIndices：两串长度必须相同，收到 ' + a.length + ' 与 ' + b.length);
    }
    const out = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
    return out;
  }

  return {
    BLOCK_BYTES: BLOCK_BYTES,
    DIGEST_BYTES: DIGEST_BYTES,
    DIGEST_BITS: DIGEST_BITS,
    digestBytes: digestBytes,
    hex: hex,
    bits: bits,
    COLLISION: COLLISION,
    collisionPair: collisionPair,
    diffByteIndices: diffByteIndices
  };
});
