(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径——那个字符串会被 inline_core.py 原样内联进工具页，而
       check.py 的 outbound_ref_check() 正在数整个子树里的父目录引用。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.sha256 = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= SHA-256 =================
     FIPS 180-4。这个模块只做三件事：算摘要、把摘要拆成比特、以及两件**只有
     哈希才问得出来**的实验——雪崩与生日碰撞。

     它不是加密。没有密钥，也没有 decrypt()：这个文件里根本不存在那个函数，
     不是"暂时没写"。工具页要讲的第一句话就是这个，而代码里一个不存在的
     函数比页面上一行文案更有说服力。

     旋转一律走 CryptoCore.rotr32，不在这里重写一份。它比裸 `>>>` 拼接慢
     （每次调用多两次整数与区间检查），但那两次检查正是它存在的理由：位移量
     写错时 `x >>> 40` 会被 JS 悄悄当成 `x >>> 8` 照常算出一个"格式正确"的
     错哈希，而 rotr32 会当场抛。实测代价见 sha256.test.js 末尾的注释。 */

  /* 前 64 个素数立方根小数部分的前 32 位。抄错一个常数不会让任何结构性断言
     变红——摘要照样是 64 个十六进制字符、照样雪崩——只有教科书向量抓得住它。
     所以测试里那四条向量不是仪式，是这张表唯一的检验。 */
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  /* 前 8 个素数平方根小数部分的前 32 位。 */
  const IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
              0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const BLOCK_BYTES = 64;
  const DIGEST_BYTES = 32;
  const DIGEST_BITS = 256;

  function typeName(v) {
    if (v === null) return 'null';
    if (typeof v === 'object') return Object.prototype.toString.call(v);
    return typeof v;
  }

  /* 入参收三种：字符串（按 UTF-8 编码）、Uint8Array、0–255 的整数数组。
     字符串这一支走 CryptoCore.toBytes，于是"落单代理会抛"这条纪律在这里也
     成立——半个 emoji 该在编码时炸，不该悄悄变成 U+FFFD 之后算出一个
     "看着正常"的摘要。 */
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

  /* ---- 填充 ----
     追加一个 0x80，补 0 到离块尾还剩 8 字节，最后 8 字节写**比特长度**的大端。
     这一段是哈希实现最经典的出错处，而它的错法是**有条件的**：消息长度
     ≤ 55 字节时一切正常，56 字节起长度字段挤不进本块、必须再开一块，
     那一支才会露馅。所以测试里必须有一条 56 字节以上的向量——只测 "abc"
     的实现能一路绿到上线。

     返回填充后的完整缓冲区，工具页也用它来画"消息 → 块"这一步。 */
  function padded(msg) {
    const len = msg.length;
    const total = (Math.floor((len + 8) / BLOCK_BYTES) + 1) * BLOCK_BYTES;
    const buf = new Uint8Array(total);
    buf.set(msg, 0);
    buf[len] = 0x80;
    /* 比特长度 = len * 8，可能超过 2^32，所以拆成高低两个 32 位字。
       hi = floor(len*8 / 2^32) = floor(len / 2^29)，两边都是精确整数运算。 */
    const hi = Math.floor(len / 536870912);
    const lo = len * 8 - hi * 4294967296;
    for (let j = 0; j < 4; j++) {
      buf[total - 8 + j] = (hi >>> (24 - 8 * j)) & 0xff;
      buf[total - 4 + j] = (lo >>> (24 - 8 * j)) & 0xff;
    }
    return buf;
  }

  /* 填充结构的可读版本，专供工具页画那一格。 */
  function padInfo(input) {
    const msg = inputBytes(input, 'sha256.padInfo');
    const buf = padded(msg);
    return {
      messageBytes: msg.length,
      paddedBytes: buf.length,
      blocks: buf.length / BLOCK_BYTES,
      /* 0x80 与长度字段之间那一串 0 的个数。它是 0 时说明"刚好卡满"，
         是这一页里唯一能让人看出填充有边界效应的数字。 */
      zeroBytes: buf.length - msg.length - 9
    };
  }

  const W = new Array(64);

  function digestBytes(input) {
    const msg = inputBytes(input, 'sha256');
    const buf = padded(msg);
    const H = IV.slice();

    for (let off = 0; off < buf.length; off += BLOCK_BYTES) {
      for (let i = 0; i < 16; i++) {
        const j = off + i * 4;
        W[i] = ((buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3]) >>> 0;
      }
      for (let i = 16; i < 64; i++) {
        const x = W[i - 15], y = W[i - 2];
        const s0 = (C.rotr32(x, 7) ^ C.rotr32(x, 18) ^ (x >>> 3)) >>> 0;
        const s1 = (C.rotr32(y, 17) ^ C.rotr32(y, 19) ^ (y >>> 10)) >>> 0;
        /* 四个 uint32 相加最多到 4·(2^32−1) < 2^53，double 精确；
           `>>> 0` 的 ToUint32 对这个范围内的数就是精确取模。 */
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
      }

      let a = H[0], b = H[1], c = H[2], d = H[3],
          e = H[4], f = H[5], g = H[6], h = H[7];

      for (let i = 0; i < 64; i++) {
        const S1 = (C.rotr32(e, 6) ^ C.rotr32(e, 11) ^ C.rotr32(e, 25)) >>> 0;
        /* ch / maj 都要 `>>> 0`：`~e` 与 `&` 返回的是**有符号** int32，
           负数混进上面那串加法会让"和小于 2^53"这条前提失效。 */
        const ch = ((e & f) ^ (~e & g)) >>> 0;
        const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
        const S0 = (C.rotr32(a, 2) ^ C.rotr32(a, 13) ^ C.rotr32(a, 22)) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e;
        e = (d + t1) >>> 0;
        d = c; c = b; b = a;
        a = (t1 + t2) >>> 0;
      }

      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }

    const out = new Uint8Array(DIGEST_BYTES);
    for (let i = 0; i < 8; i++) {
      out[i * 4]     = (H[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
      out[i * 4 + 3] = H[i] & 0xff;
    }
    return out;
  }

  /* 摘要是随机字节，**永远**用十六进制显示，不要试图 fromBytes 回文本——
     那个函数遇到非法 UTF-8 会抛（这是它的设计），而摘要几乎必然非法。 */
  function hex(input) { return C.toHex(digestBytes(input)); }

  function bits(input) { return C.toBits(digestBytes(input)); }

  /* ---- 比特翻转 ----
     位序与 CryptoCore.toBits 一致：MSB 在前，第 i 位在第 (i>>3) 个字节的
     第 (7 − i&7) 位。两处若不一致，雪崩页会画出一张"翻的位和亮的位对不上"
     的图，而那种错看上去只是有点怪，不像是错。 */
  function flipBit(input, i) {
    const src = inputBytes(input, 'sha256.flipBit');
    const n = src.length * 8;
    if (!Number.isInteger(i) || i < 0 || i >= n) {
      throw new Error('sha256.flipBit：比特下标要在 [0, ' + n + ') 内，收到 ' + String(i));
    }
    const out = new Uint8Array(src);
    out[i >> 3] ^= 1 << (7 - (i & 7));
    return out;
  }

  function countDiff(a, b) {
    let n = 0;
    for (let i = 0; i < a.length; i++) {
      let x = a[i] ^ b[i];
      while (x) { n += x & 1; x >>= 1; }
    }
    return n;
  }

  /* 摘要里发生变化的比特下标（给画面用）。 */
  function diffBits(a, b) {
    const out = [];
    for (let i = 0; i < a.length; i++) {
      const x = a[i] ^ b[i];
      for (let k = 0; k < 8; k++) if ((x >> (7 - k)) & 1) out.push(i * 8 + k);
    }
    return out;
  }

  /* ---- 雪崩 ----
     把消息的**每一个**比特轮流翻一次，数每次有多少摘要比特跟着变。

     返回的是逐次计数，不是一个平均值：平均值会把"有没有出现过特别小的
     那一次"这件事藏起来，而"从第一个不同的比特起就是一半"正是这一页要
     证明的东西——它是由 min 而不是由 mean 撑住的。

     代价是 8n + 1 次哈希，n 是消息字节数。工具页必须缓存它（每帧重算
     一段 40 字节的明文就是 321 次哈希）。 */
  function avalanche(input) {
    const msg = inputBytes(input, 'sha256.avalanche');
    const n = msg.length * 8;
    const base = digestBytes(msg);
    const counts = new Array(n);
    let total = 0, min = DIGEST_BITS, max = 0;
    for (let i = 0; i < n; i++) {
      const c = countDiff(base, digestBytes(flipBit(msg, i)));
      counts[i] = c;
      total += c;
      if (c < min) min = c;
      if (c > max) max = c;
    }
    return {
      bitsFlipped: n,
      counts: counts,
      total: total,
      min: n ? min : 0,
      max: n ? max : 0,
      /* 除法留给调用方之外的地方是不行的：n=0（空消息）时 total/n 是 NaN，
         而 NaN 在画面上表现为"柱子不见了"，不是一句错误。 */
      mean: n ? total / n : null
    };
  }

  /* ---- 截断 ----
     取摘要**最高** k 位当成一个整数。k ≤ 32：再宽就超出 Number 能精确表示
     位运算的范围，而生日实验本来就只能搜到 20 多位。
     用乘除而不是 `>>>`：`>>>` 只在 32 位上工作，v 的最高位为 1 时
     `v >>> (32-k)` 仍然对，但把 v 本身当有符号数打印出来会是负的，
     调试时误导人。 */
  function truncate(digest, k) {
    if (!Number.isInteger(k) || k < 1 || k > 32) {
      throw new Error('sha256.truncate：k 必须是 [1, 32] 内的整数，收到 ' + String(k));
    }
    const d = inputBytes(digest, 'sha256.truncate');
    if (d.length < 4) throw new Error('sha256.truncate 需要至少 4 个字节，收到 ' + d.length);
    const top = ((d[0] * 256 + d[1]) * 256 + d[2]) * 256 + d[3];
    return Math.floor(top / Math.pow(2, 32 - k));
  }

  /* ---- 生日实验 ----
     取样一律是 `seed + ':' + i`，**不用随机数发生器**。理由有两条，第二条
     才是关键：
       ① 模块内不碰 Math.random 是本仓的既有纪律（randomBytes 要求注入 rng）；
       ② 页面上显示的数字和测试里钉住的数字必须是同一个。注入 rng 也能做到，
          但那要求页面和测试各自记得用同一个种子生成器；用计数器则是**结构上**
          做不到不同——同一个 seed 一定给出同一串消息。
     SHA-256 的输出对这串输入而言与均匀独立无异（这正是它被称为哈希的原因），
     所以这不是"伪装成随机"，而是这场实验唯一诚实的取样方式。

     搜索是可恢复的：run(n) 只吃 n 个样本就返回，工具页因此可以把一次搜索
     摊到很多帧上，而不是在某一帧里卡住半秒。

     cap 是必须的。碰撞在理论上"几乎必然"发生，但工具页跑的是一条 while
     循环——"几乎必然"在浏览器主线程上不是可接受的终止条件。
     cap = 64·2^(k/2)+1024 时不碰撞的概率约 exp(−2048)，比机器出错还小；
     真撞上 cap 就把 exhausted 立起来让画面明说，而不是继续转。 */
  function birthdaySearcher(k, seed) {
    if (!Number.isInteger(k) || k < 1 || k > 32) {
      throw new Error('sha256.birthdaySearcher：k 必须是 [1, 32] 内的整数，收到 ' + String(k));
    }
    const prefix = String(seed == null ? '' : seed) + ':';
    const seen = new Map();
    const S = {
      k: k,
      seed: String(seed == null ? '' : seed),
      samples: 0,
      done: false,
      exhausted: false,
      value: null,
      a: null,
      b: null,
      cap: Math.ceil(64 * Math.pow(2, k / 2)) + 1024
    };
    /* 省略预算时抽一个；显式传 0 就**真的抽 0 个**，不悄悄改成 1。
       "0 被当成没传"是这类接口的经典坑：调用方按剩余时间算出 0 的那一帧，
       会以为自己什么都没做，实际上多走了一步，于是分块跑与一次跑的样本数
       悄悄错开——而两者必须逐字段相同，否则屏幕上的数字就不是测试钉住的那个。 */
    S.run = function (budget) {
      let left;
      if (budget === undefined || budget === null) left = 1;
      else if (Number.isInteger(budget) && budget >= 0) left = budget;
      else throw new Error('sha256.birthdaySearcher.run：预算必须是非负整数，收到 ' + String(budget));
      while (left-- > 0 && !S.done && !S.exhausted) {
        const msg = prefix + S.samples;
        const v = truncate(digestBytes(msg), k);
        S.samples++;
        const prev = seen.get(v);
        if (prev !== undefined) {
          S.done = true;
          S.value = v;
          S.a = prev;
          S.b = msg;
        } else {
          seen.set(v, msg);
          if (S.samples >= S.cap) S.exhausted = true;
        }
      }
      return S;
    };
    return S;
  }

  /* 一次完整试验。samples 是"抽到碰撞为止一共抽了几个"（含碰上的那一个）。 */
  function birthdayTrial(k, seed) {
    const S = birthdaySearcher(k, seed);
    S.run(S.cap + 1);
    return S;
  }

  /* 中位数导出来，是为了让**工具页与测试算的是同一个函数**。工具页要把一次
     搜索摊到很多帧上，所以它不能调 birthdayStats（那个函数一口气跑完），
     只能自己收集 samples；如果它再自己写一遍取中位数，两处对偶数长度的
     处理稍有出入，屏幕上的数字和测试钉住的数字就会不一样，而那种不一样
     没有任何东西会报。 */
  function medianOf(list) {
    if (!Array.isArray(list) || !list.length) {
      throw new Error('sha256.medianOf 需要非空数组，收到 ' + typeName(list));
    }
    const s = list.slice().sort(function (a, b) { return a - b; });
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /* 多次试验的中位数。中位数而不是均值：生日分布右尾很长，均值被少数几次
     特别长的搜索拽着走，而这一页要跟 1.25·2^(k/2) 这条**理论均值**对表时，
     用中位数反而更容易看出"两条曲线是否平行"——它们的比值恒定
     （median ≈ 1.177·2^(k/2)，mean ≈ 1.253·2^(k/2)），两个都报出来才诚实。 */
  function birthdayStats(k, trials, seedBase) {
    if (!Number.isInteger(trials) || trials < 1) {
      throw new Error('sha256.birthdayStats：trials 必须是正整数，收到 ' + String(trials));
    }
    const base = String(seedBase == null ? 'b' : seedBase);
    const samples = [];
    let sum = 0, exhausted = 0;
    for (let i = 0; i < trials; i++) {
      const S = birthdayTrial(k, base + '-' + i);
      if (S.exhausted) exhausted++;
      samples.push(S.samples);
      sum += S.samples;
    }
    return {
      k: k, trials: trials, samples: samples,
      median: medianOf(samples), mean: sum / trials, exhausted: exhausted,
      /* 理论值一并返回，省得每个调用方各写一遍系数、各写错一遍。
         meanTheory = sqrt(π/2)·2^(k/2)，medianTheory = sqrt(2·ln2)·2^(k/2)。 */
      meanTheory: Math.sqrt(Math.PI / 2) * Math.pow(2, k / 2),
      medianTheory: Math.sqrt(2 * Math.LN2) * Math.pow(2, k / 2)
    };
  }

  return {
    BLOCK_BYTES: BLOCK_BYTES,
    DIGEST_BYTES: DIGEST_BYTES,
    DIGEST_BITS: DIGEST_BITS,
    digestBytes: digestBytes,
    hex: hex,
    bits: bits,
    padInfo: padInfo,
    flipBit: flipBit,
    countDiff: countDiff,
    diffBits: diffBits,
    avalanche: avalanche,
    truncate: truncate,
    medianOf: medianOf,
    birthdaySearcher: birthdaySearcher,
    birthdayTrial: birthdayTrial,
    birthdayStats: birthdayStats
  };
});
