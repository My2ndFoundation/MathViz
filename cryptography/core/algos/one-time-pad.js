(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js / stream-classical.js 那两行完全相同，不是风格——
       这个字符串会被 inline_core.py 原样内联进工具页，而 check.py 的
       outbound_ref_check() 正在数整个子树里的父目录引用，用它守住
       "cryptography/ 可以整体搬走"这条约束。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    const mod = factory(root.CryptoCore);
    /* 两个键指向同一个对象，不是两份实现：工具页读驼峰名，check.py 的
       algos_gate 拿**文件名**（one-time-pad）去 root 上找。与
       stream-classical.js 同一处理，理由见那里的长注释。 */
    root.CryptoAlgos.oneTimePad = mod;
    root.CryptoAlgos['one-time-pad'] = mod;
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= 一次一密 One-Time Pad =================
     整本合集里最简单的密码，也是唯一一个不可破的：

         c = p XOR k        k 与 p 一样长、均匀随机、只用一次

     强度全部来自那三个条件，一点也不来自那个运算。XOR 自己什么都不做——
     它甚至是自己的逆，加密与解密是同一个函数。所以这个模块里**没有**
     "算法"可写：encrypt / decrypt / keyFor / combine 四个名字底下是同一次
     C.xorBytes。刻意保留四个名字，是因为这一页要讲的正是"同一个运算在四种
     角色里出现"：
       encrypt(p, k) = c      加密
       decrypt(c, k) = p      解密（同一次异或）
       keyFor(p, c)  = k      **构造性完美保密**：任给一段候选明文，
                              倒推出"要得到这段密文，密钥必须是什么"
       combine(c1,c2)= p1^p2  密钥重用时密钥自己消掉，只剩两段明文的异或

     三个条件里任何一个被违反，这个密码就退化成别的东西：
       · 密钥比报文短 → 密钥必然重复 → 见 stretchKey，它把重复**报出来**；
       · 密钥不是随机的（比如另一段英文）→ 退回第 1 章的滚动密钥，
         结构留在密文里（见 stats().high 那条实测量）；
       · 密钥用了两次 → 见 combine + cribDrag，两段明文一起被剥开。

     ⚠ 长度不等一律由 C.xorBytes 抛出，本模块不截断、不补齐。截到短的那一串
     会画出一次"成功的加密"，而后半段明文根本没被动过——一个看上去完全正常的
     假象，恰好把这一页要讲的唯一一件事讲反了。 */

  /* ---- 可复现的伪随机源 ----
     ⚠ **这不是密码学随机数发生器。** mulberry32 是一个 32 位状态的
     PRNG：给同一个种子就给同一串字节，这正是教学页面要的（截图、实测数字、
     测试断言都得可复现），也正是真一次一密**不能**用的东西——32 位状态意味着
     整条密钥流只有 2³² 种可能，穷举一遍在现代机器上是分钟级的事。真做一次一密
     要的是物理熵源，不是任何确定性函数。工具页必须把这句话印在页面上。

     放在这里而不是让调用方各自造一个：测试与页面必须用**同一个**发生器，
     否则页面上印的实测数字与测试里断言的数字各算各的。 */
  function seededRng(seed) {
    if (!Number.isInteger(seed)) {
      throw new Error('seededRng 的种子必须是整数，收到 ' + String(seed));
    }
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 密钥长度**必须**由报文长度决定，所以这个函数的第二参就是报文长度，
     没有默认值也没有"密钥长度"这个独立概念。C.randomBytes 会把 rng 的越界
     返回值夹住（见那里关于 Uint8Array 静默取模的注释）。 */
  function makeKey(rng, n) { return C.randomBytes(rng, n); }

  function encrypt(plain, key) { return C.xorBytes(plain, key); }
  function decrypt(cipher, key) { return C.xorBytes(cipher, key); }
  function keyFor(plain, cipher) { return C.xorBytes(plain, cipher); }
  function combine(c1, c2) { return C.xorBytes(c1, c2); }

  /* crypto-core 的 asBytes 是它的内部守卫，没有导出（那个文件的收录判据是
     "换一个算法还用得上吗"，一个入参检查器答的是"否"）。本模块下面几个函数
     同样需要一道入口门，所以在这里立一道**更严**的：只收 Uint8Array。
     不收普通数组不是偷懒——本页所有字节都来自 toBytes / xorBytes /
     randomBytes，它们全都返回 Uint8Array；放宽到普通数组就得把 0–255 那套
     逐元素检查在这里再写一遍，而那正是"两份实现总有一天给出两个答案"。 */
  function asU8(v, name) {
    if (Object.prototype.toString.call(v) !== '[object Uint8Array]') {
      throw new Error(name + ' 需要 Uint8Array，收到 ' +
                      (v === null ? 'null' : (typeof v === 'object'
                        ? Object.prototype.toString.call(v) : typeof v)));
    }
    return v;
  }

  /* 把一串字节裁到/补到 n 字节，并**说明做了什么**。
     "顿悟视角"那一页让使用者随便打一段候选明文，而候选与密文一样长是完美
     保密这条命题的前提；长度不齐时既不能拒绝（那就没法自由地试）也不能悄悄
     处理（那就把前提抹掉了）。补的字节是 0x20 空格：它在文本里是可见的、
     不改变已有字节，而且解出来仍然是一段能读的文本。 */
  function fitBytes(bytes, n) {
    const src = asU8(bytes, 'fitBytes 的字节串');
    if (!Number.isInteger(n) || n < 0) {
      throw new Error('fitBytes 的长度必须是非负整数，收到 ' + String(n));
    }
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = i < src.length ? src[i] : 0x20;
    return {
      bytes: out,
      origLen: src.length,
      action: src.length === n ? 'exact' : (src.length > n ? 'truncated' : 'padded')
    };
  }

  /* 密钥比报文短时会发生什么：它**重复**。这个函数照做，但把重复次数一起
     返回，让调用方没有办法假装它没发生。工具页据此打一条橙色警告——
     一个悄悄重复短密钥的一次一密演示，教的正好是这一页的反面。 */
  function stretchKey(key, n) {
    const k = asU8(key, 'stretchKey 的密钥');
    if (!k.length) {
      throw new Error('stretchKey 的密钥至少要有一个字节');
    }
    if (!Number.isInteger(n) || n < 0) {
      throw new Error('stretchKey 的长度必须是非负整数，收到 ' + String(n));
    }
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = k[i % k.length];
    return {
      bytes: out,
      sourceLen: k.length,
      repeated: n > k.length,
      cycles: k.length ? n / k.length : 0
    };
  }

  /* 翻掉第 bitIndex 个比特（MSB 在前，与 C.toBits 同一编号），返回新数组。
     这是"完美保密"那一页的**反证控制**：候选明文倒推出的密钥解出来必然
     逐字节等于候选——那个"必然"太顺了，顺到测试里一个空循环也能报成功。
     所以页面与测试都要有一个"把密钥改坏一个比特，匹配立刻断掉"的对照。 */
  function flipBit(bytes, bitIndex) {
    const src = asU8(bytes, 'flipBit 的字节串');
    const n = src.length;
    if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex >= n * 8) {
      throw new Error('flipBit 的比特下标必须落在 [0, ' + (n * 8) + ') 内，收到 ' + String(bitIndex));
    }
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = src[i];
    const byteAt = bitIndex >> 3;
    out[byteAt] = out[byteAt] ^ (1 << (7 - (bitIndex & 7)));
    return out;
  }

  /* 逐字节比较，返回相同的字节数与第一处不同的下标（全同为 −1）。
     页面上的"117/117 字节吻合"与测试里的断言读的是同一个函数。 */
  function compare(a, b) {
    asU8(a, 'compare 的第一个参数');
    asU8(b, 'compare 的第二个参数');
    if (a.length !== b.length) {
      throw new Error('compare：两串长度必须相同，收到 ' + a.length + ' 与 ' + b.length);
    }
    let same = 0, first = -1;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) same++;
      else if (first < 0) first = i;
    }
    return { n: a.length, same: same, firstDiff: first, equal: same === a.length };
  }

  /* ---- 字节层的结构信号 ----
     ASCII 文本全部落在 0x00–0x7F，最高位恒为 0。于是：
       · 密钥均匀随机 → 密文的最高位一半是 1（实测见测试）；
       · 密钥是另一段 ASCII 英文 → 密文的最高位**恒为 0**，一个都没有。
     这一条不需要任何统计学就能看见，也正是第 1 章滚动密钥输在哪里的字节层
     版本：它输的不是"密钥太短"，是"密钥有结构"。 */
  function stats(bytes) {
    let high = 0, printable = 0;
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b >= 0x80) high++;
      if (b === 0x20 || (b >= 0x21 && b <= 0x7E)) printable++;
    }
    return { n: bytes.length, high: high, printable: printable };
  }

  /* ---- 一段字节有多像英文 ----
     只用字节的类别，不用频率表：这里要判的是"这一小段是不是文本"，样本往往
     只有几个字节，任何频率统计在那个长度上都是噪声。

     权重分三档，是**被数据逼出来的**，不是审美：两段英文异或之后，
       字母 ^ 字母  落在 0x00–0x3F，多半是控制字符（得 0 分），
                    但大小写不同的同一个字母恰好给出 0x20 空格；
       字母 ^ 空格  给出大小写翻转的同一个字母（可读）；
     所以若把 0x20–0x3F 那一段（空格、数字、标点）与字母同等对待，一大批
     错误位置会被抬到与正确位置同分。字母给满分、空格给满分、标点数字给
     0.35、其余给 0，正确位置才稳定排在第一（测试里有实测断言钉住这件事）。 */
  const PUNCT = ',.\'"!?;:-()';
  function byteWeight(b) {
    if ((b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A)) return 1;
    if (b === 0x20) return 1;
    if (b >= 0x30 && b <= 0x39) return 0.35;
    if (PUNCT.indexOf(String.fromCharCode(b)) >= 0) return 0.35;
    return 0;
  }
  function textScore(bytes) {
    if (!bytes.length) return 0;
    let s = 0;
    for (let i = 0; i < bytes.length; i++) s += byteWeight(bytes[i]);
    return s / bytes.length;
  }

  /* ---- 拖词（crib dragging）——密钥重用时的那把撬棍 ----
     已知 x = c1 ^ c2 = p1 ^ p2（密钥已经消掉了，见 combine）。若猜到 p1 在
     offset 处是 crib，那么

         p2[offset + i] = x[offset + i] ^ crib[i]

     也就是说：**猜中一段，另一段自己掉出来**。两段都是英文，所以掉出来的
     东西读不读得通，就是这次猜测对不对的判据（textScore）。

     与第 1 章那次拖词的差别只有一处，而那一处是全部：那里拖的是**密钥**
     （另一段英文），这里拖的是**另一段明文**。密钥重用把一次一密变回了
     "两段英文加在一起"，也就是第 1 章那个已经倒过的东西。

     只返回代数结果与分数，不替调用方选答案：页面要把前几名一起列出来，
     让"第一名不一定是真位置"这件事可见。 */
  function cribDrag(xored, crib) {
    asU8(xored, 'cribDrag 的异或串');
    asU8(crib, 'cribDrag 的 crib');
    if (!crib.length) {
      throw new Error('cribDrag 的 crib 至少要有一个字节');
    }
    const out = [];
    for (let j = 0; j + crib.length <= xored.length; j++) {
      const d = new Uint8Array(crib.length);
      for (let i = 0; i < crib.length; i++) d[i] = xored[j + i] ^ crib[i];
      out.push({ offset: j, bytes: d, score: textScore(d) });
    }
    return out;
  }

  /* crib 真正出现在哪儿。页面拿它给柱子上色——"第一名不是真位置"必须是
     一眼可见的事实，而不是使用者事后才发现的。 */
  function occurrences(hay, needle) {
    asU8(hay, 'occurrences 的被搜串');
    asU8(needle, 'occurrences 的搜索串');
    const out = [];
    if (!needle.length || needle.length > hay.length) return out;
    for (let j = 0; j + needle.length <= hay.length; j++) {
      let ok = true;
      for (let i = 0; i < needle.length; i++) {
        if (hay[j + i] !== needle[i]) { ok = false; break; }
      }
      if (ok) out.push(j);
    }
    return out;
  }

  /* 按分数降序取前 k 个的**下标**（不是 offset）。分数相同按 offset 升序，
     让排名对同一份输入恒定——一个随实现细节抖动的排名，截图第二天就对不上。 */
  function rankByScore(drags, k) {
    const order = drags.map(function (d, i) { return i; });
    order.sort(function (a, b) {
      return (drags[b].score - drags[a].score) || (drags[a].offset - drags[b].offset);
    });
    return order.slice(0, k == null ? order.length : k);
  }

  return { seededRng, makeKey,
           encrypt, decrypt, keyFor, combine,
           fitBytes, stretchKey, flipBit, compare,
           stats, textScore, cribDrag, occurrences, rankByScore };
});
