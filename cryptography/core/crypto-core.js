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

  /* ================= 字节 · 比特 · 模幂（第 4 章：现代密码学的地基） =================
     古典密码在 26 个字母上做算术；DES / AES / RSA / 哈希在**字节和比特**上做。
     所以第 4 章的每一页第一步都是同一件事：把"密码"这样一串文本变成字节。

     收录判据只有一句：换一个算法还用得上吗？用得上才进这里。
     DES 的 S 盒与 Feistel 轮、AES 的状态矩阵与 GF(2⁸) 乘法、MD5/SHA 的压缩
     函数一律答"否"，它们属于各自的 core/algos/*.js。这个文件被每一个工具页
     内联，多一个算法专属的函数，就多一份"改它会动到谁"的不确定。 */

  /* Uint8Array 的判定用 Object.prototype.toString，**不用 instanceof**。
     instanceof 比的是构造函数身份，跨 realm 一律为假——实测：把 node realm 的
     Uint8Array 传进 vm 沙箱，沙箱里 `x instanceof Uint8Array` 是 false，而
     Object.prototype.toString.call(x) 仍然是 '[object Uint8Array]'。
     本仓的浏览器分支测试与 check.py 的 ALGOS 求值门都跑在 vm 沙箱里，用
     instanceof 会让"最该被测的那条分支"在测试里走进"这不是字节数组"的错误
     路径，而浏览器里一切正常——又一次"门测的字节和用户跑的字节不是同一份"。 */
  function isU8(v) {
    return Object.prototype.toString.call(v) === '[object Uint8Array]';
  }

  function typeName(v) {
    if (v === null) return 'null';
    if (typeof v === 'object') return Object.prototype.toString.call(v);
    return typeof v;
  }

  /* 字节入参集中在这里检查，理由与 matShape 那一处相同：坏法就那么几种，
     散在各处迟早漏掉一处。Uint8Array 原样返回（元素天然就在 0–255），
     普通数组逐个验——一个 [0, 256, -1] 直接塞进 Uint8Array 会**静默取模**
     变成 [0, 0, 255]，不抛不报，只是数据从此不是调用方给的那份。 */
  function asBytes(v, name) {
    if (isU8(v)) return v;
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
    throw new Error(name + ' 需要 Uint8Array 或 0–255 的整数数组，收到 ' + typeName(v));
  }

  /* ---- UTF-8 ----
     手写编解码，**刻意不用 TextEncoder / TextDecoder**。理由是实测出来的：
     本仓的浏览器分支测试（examples.test.js 的写法）与 check.py 的 ALGOS 求值门
     都用 node 的 vm 建一个只有 self 的裸上下文，而那种上下文里
     `typeof TextEncoder === 'undefined'`（node v25 实测）——它是 node / 浏览器
     各自的 global，不是 ECMAScript 内建。于是：
       · 直接用 TextEncoder → 这两道门当场炸；
       · "有就用、没有就退回手写" → 更坏：浏览器跑 TextEncoder 那条、两道门跑
         手写那条，被覆盖的永远是**用户跑不到的那一条**。这正是本项目反复吃亏
         的形状（UMD 的 node 分支 vs 浏览器分支）。
     一份实现、两条分支跑同一批字节，是这里唯一诚实的选择。测试用一个把
     TextEncoder/TextDecoder 换成"一调用就抛"的沙箱把这条纪律钉住。 */

  /* 落单代理（unpaired surrogate）抛错，不学 TextEncoder 悄悄换成 U+FFFD。
     替换掉之后 fromBytes(toBytes(s)) 就不再等于 s，而这个恒等式是第 4 章
     一切演示的地基：一次一密的往返、哈希的"改一个字符看雪崩"，靠的都是
     "文本 → 字节 → 文本"不丢东西。 */
  function toBytes(str) {
    const s = String(str);
    const out = [];
    for (let i = 0; i < s.length; i++) {
      let cp = s.charCodeAt(i);
      if (cp >= 0xD800 && cp <= 0xDBFF) {
        const lo = s.charCodeAt(i + 1);
        if (!(lo >= 0xDC00 && lo <= 0xDFFF)) {
          throw new Error('toBytes：第 ' + i + ' 个码元是落单的高位代理 U+' +
                          cp.toString(16).toUpperCase() + '，这不是合法文本');
        }
        /* 代理对还原成码点：JS 字符串是 UTF-16，一个 emoji 占**两个**码元，
           按 charCodeAt 逐个编码会得到 CESU-8（两段 3 字节），那既不是 UTF-8
           也过不了本文件自己的解码器。 */
        cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
        i++;
      } else if (cp >= 0xDC00 && cp <= 0xDFFF) {
        throw new Error('toBytes：第 ' + i + ' 个码元是落单的低位代理 U+' +
                        cp.toString(16).toUpperCase() + '，这不是合法文本');
      }
      if (cp < 0x80) {
        out.push(cp);
      } else if (cp < 0x800) {
        out.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F));
      } else if (cp < 0x10000) {
        out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
      } else {
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F),
                 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
      }
    }
    return new Uint8Array(out);
  }

  /* 非法 UTF-8 一律抛，不产出 U+FFFD。
     第 4 章的工具会拿**解密结果**调它，而"用错密钥"得到的就是随机字节；
     那时该看到的是一声错误或者十六进制，不是一屏问号——更不是碰巧解码成功的
     一串乱码汉字，那种"看着像结果的结果"才是最难被发现的。
     要显示任意字节请用 toHex()。 */
  function fromBytes(bytes) {
    const b = asBytes(bytes, 'fromBytes');
    let s = '';
    let i = 0;
    while (i < b.length) {
      const b0 = b[i];
      let cp, len;
      if (b0 < 0x80) { cp = b0; len = 1; }
      /* 起始字节从 0xC2 起，不是 0xC0：0xC0 / 0xC1 开头的两字节序列编出来的
         码点必然 < 0x80，是"过长编码"，历史上是绕过安全过滤的经典手法。
         同理 0xF5–0xFF 编出来必然 > 0x10FFFF。 */
      else if (b0 >= 0xC2 && b0 <= 0xDF) { cp = b0 & 0x1F; len = 2; }
      else if (b0 >= 0xE0 && b0 <= 0xEF) { cp = b0 & 0x0F; len = 3; }
      else if (b0 >= 0xF0 && b0 <= 0xF4) { cp = b0 & 0x07; len = 4; }
      else {
        throw new Error('fromBytes：第 ' + i + ' 个字节 0x' +
                        b0.toString(16).toUpperCase() + ' 不能作为 UTF-8 起始字节');
      }
      if (i + len > b.length) {
        throw new Error('fromBytes：第 ' + i + ' 个字节声明了 ' + len +
                        ' 字节的序列，但只剩 ' + (b.length - i) + ' 字节（被截断了）');
      }
      for (let k = 1; k < len; k++) {
        const c = b[i + k];
        if ((c & 0xC0) !== 0x80) {
          throw new Error('fromBytes：第 ' + (i + k) + ' 个字节 0x' +
                          c.toString(16).toUpperCase() + ' 不是合法的续字节（应形如 10xxxxxx）');
        }
        cp = (cp << 6) | (c & 0x3F);
      }
      if ((len === 3 && cp < 0x800) || (len === 4 && cp < 0x10000)) {
        throw new Error('fromBytes：第 ' + i + ' 处是过长编码（U+' +
                        cp.toString(16).toUpperCase() + ' 用了 ' + len + ' 个字节）');
      }
      if (cp >= 0xD800 && cp <= 0xDFFF) {
        throw new Error('fromBytes：第 ' + i + ' 处编码了代理码点 U+' +
                        cp.toString(16).toUpperCase() + '（那是 CESU-8，不是 UTF-8）');
      }
      if (cp > 0x10FFFF) {
        throw new Error('fromBytes：第 ' + i + ' 处的码点 U+' +
                        cp.toString(16).toUpperCase() + ' 超出 Unicode 上界 U+10FFFF');
      }
      if (cp < 0x10000) {
        s += String.fromCharCode(cp);
      } else {
        const v = cp - 0x10000;
        s += String.fromCharCode(0xD800 + (v >> 10), 0xDC00 + (v & 0x3FF));
      }
      i += len;
    }
    return s;
  }

  const HEX = '0123456789abcdef';

  /* 小写、无分隔符。小写是因为它要能原样喂回 fromHex，也因为整个仓库的
     readout 字体里小写十六进制的字形宽度更齐；无分隔符是因为"哪里断"是显示
     层的决定，不该烧进数据层。 */
  function toHex(bytes) {
    const b = asBytes(bytes, 'toHex');
    let s = '';
    for (let i = 0; i < b.length; i++) s += HEX.charAt(b[i] >> 4) + HEX.charAt(b[i] & 15);
    return s;
  }

  function hexVal(c) {
    if (c >= 48 && c <= 57) return c - 48;        // 0-9
    if (c >= 97 && c <= 102) return c - 87;       // a-f
    if (c >= 65 && c <= 70) return c - 55;        // A-F
    return -1;
  }

  /* 大小写都收（十六进制没有大小写之分），但空白与分隔符**不收**：
     "de ad be ef" 该由输入框去清洗，不该由解析器猜。奇数长度同理——
     少打一位时"丢掉最后半个字节"和"前面补个 0"都能编出来，两种猜法都会
     悄悄改掉使用者的数据，而它们给出的字节还不一样。 */
  function fromHex(hex) {
    const s = String(hex);
    if (s.length % 2 !== 0) {
      throw new Error('fromHex：十六进制串长度必须是偶数，收到 ' + s.length +
                      ' 个字符（一个字节两位）');
    }
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) {
      const hi = hexVal(s.charCodeAt(2 * i));
      const lo = hexVal(s.charCodeAt(2 * i + 1));
      if (hi < 0 || lo < 0) {
        const bad = hi < 0 ? 2 * i : 2 * i + 1;
        throw new Error('fromHex：第 ' + bad + ' 个字符 ' + JSON.stringify(s.charAt(bad)) +
                        ' 不是十六进制数字（0-9 a-f A-F，不接受空白与分隔符）');
      }
      out[i] = (hi << 4) | lo;
    }
    return out;
  }

  /* 长度不等必须抛，不许截到短的那一串。
     一次一密那一页正是靠"密钥必须和明文一样长"讲安全性的：悄悄截断会让页面
     画出一个成功的加密，而后半段明文根本没被动过——一个**看上去完全正常**的
     假象，恰好把那一页要讲的唯一一件事讲反了。 */
  function xorBytes(a, b) {
    const x = asBytes(a, 'xorBytes 的第一个参数');
    const y = asBytes(b, 'xorBytes 的第二个参数');
    if (x.length !== y.length) {
      throw new Error('xorBytes：两串长度必须相同，收到 ' + x.length + ' 与 ' + y.length);
    }
    const out = new Uint8Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = x[i] ^ y[i];
    return out;
  }

  /* rng 由调用方注入，模块内不碰 Math.random——与 substitution.randomKey 同一条
     纪律：一个用了 Math.random 的测试今天绿明天红，最后必然被加上 retry
     或者干脆删掉。 */
  function randomBytes(rngFn, n) {
    if (typeof rngFn !== 'function') {
      throw new Error('randomBytes 需要一个返回 [0,1) 的函数；模块内不使用 Math.random');
    }
    if (!Number.isInteger(n) || n < 0) {
      throw new Error('randomBytes 的长度必须是非负整数，收到 ' + String(n));
    }
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      /* 夹一下。这里比 randomKey 那处更隐蔽：往 Uint8Array 里写 256 不会报错，
         它**自动对 256 取模变成 0**——不抛、不警告，只是把 0 的出现频率悄悄
         抬高了一点。一个只是分布偏了的随机数发生器，是最难被人眼发现的那种坏。 */
      let v = Math.floor(rngFn() * 256);
      if (!(v >= 0)) v = 0;        // NaN 或负数
      if (v > 255) v = 255;        // rng 返回了 1
      out[i] = v;
    }
    return out;
  }

  /* ---- 比特 ----
     MSB 在前，不是 LSB。DES 的每一张置换表（IP、PC-1、E、P）都按"最高位是
     第 1 位"编号，SHA 的长度填充也是大端；顺序反过来的话每一张教科书表格都要
     在使用处翻一次，而"翻了没翻"这种事只要漏一处就查一天。
     返回**普通数组**而不是 Uint8Array：比特要在页面上被逐个画成方块、被
     slice/concat 来回切，普通数组的这些操作调用方更熟，也不会有人误以为
     一个 Uint8Array 里装的是字节。 */
  function toBits(bytes) {
    const b = asBytes(bytes, 'toBits');
    const out = new Array(b.length * 8);
    for (let i = 0; i < b.length; i++) {
      for (let k = 0; k < 8; k++) out[i * 8 + k] = (b[i] >> (7 - k)) & 1;
    }
    return out;
  }

  /* 长度不是 8 的倍数必须抛。补零还是丢弃是**调用方的决定**——DES 补的是
     固定块长、SHA 补的是 0x80 加长度，两种补法完全不同，这里替谁选都是错。 */
  function fromBits(bits) {
    if (!Array.isArray(bits) && !isU8(bits)) {
      throw new Error('fromBits 需要一个 0/1 数组，收到 ' + typeName(bits));
    }
    if (bits.length % 8 !== 0) {
      throw new Error('fromBits：比特数必须是 8 的整数倍，收到 ' + bits.length);
    }
    const out = new Uint8Array(bits.length / 8);
    for (let i = 0; i < out.length; i++) {
      let v = 0;
      for (let k = 0; k < 8; k++) {
        const bit = bits[i * 8 + k];
        /* 只认数字 0 和 1，true/false 与 '1' 一律拒。`(v << 1) | true` 在 JS 里
           照样算得出来，于是一个装着布尔的数组会**悄悄**给出正确答案，直到
           某天有人写了 bits.reduce((a,b)=>a+b) 去数 1 的个数，得到 "0true1"。 */
        if (bit !== 0 && bit !== 1) {
          throw new Error('fromBits：第 ' + (i * 8 + k) + ' 位不是数字 0 或 1（收到 ' +
                          JSON.stringify(bit) + '）');
        }
        v = (v << 1) | bit;
      }
      out[i] = v;
    }
    return out;
  }

  /* x 收两种写法：无符号的 [0, 2³²) 与 JS 位运算天然产出的有符号负数
     （`(a + b) | 0` 就会给出负值），两者在 32 位上是同一个位型，统一 >>> 0。
     真正要拦的是**根本不在 32 位里的数**：2⁴⁰ 或 2.5 传给 `<<` 会被 ToInt32
     悄悄截断/取整，算出一个看着完全正常的错值——SHA 里出一个这样的数，
     结果就是一串"格式正确"的错哈希。 */
  function u32(x, name) {
    if (!Number.isInteger(x) || x < -2147483648 || x > 4294967295) {
      throw new Error(name + '：第一个参数必须是 32 位整数（[−2³¹, 2³²−1] 内），收到 ' + String(x));
    }
    return x >>> 0;
  }

  /* 位移量限死 [0, 32]，不在函数里偷偷 `n & 31`。
     取模会让 rotl32(x, 40) 被当成 rotl32(x, 8) 照常返回——一个抄错的常数
     （SHA-1 的 5 抄成 37、MD5 的表抄串行）从此永远测不出来，而哈希值全错。 */
  function rotAmount(n, name) {
    if (!Number.isInteger(n) || n < 0 || n > 32) {
      throw new Error(name + '：位移量必须是 [0, 32] 内的整数，收到 ' + String(n));
    }
    return n;
  }

  function rotl32(x, n) {
    const v = u32(x, 'rotl32');
    const k = rotAmount(n, 'rotl32');
    /* k 为 0 或 32 必须单独走：JS 的移位量是模 32 的，`v >>> (32 - 0)` 等于
       `v >>> 0`（不是 0），拼出来的结果碰巧还对，但 32 那一支不写就得靠"碰巧"，
       而下一个人读到时无从判断这是设计还是运气。 */
    if (k === 0 || k === 32) return v;
    return ((v << k) | (v >>> (32 - k))) >>> 0;
  }

  function rotr32(x, n) {
    const v = u32(x, 'rotr32');
    const k = rotAmount(n, 'rotr32');
    if (k === 0 || k === 32) return v;
    return ((v >>> k) | (v << (32 - k))) >>> 0;
  }

  /* ---- 模幂 ----
     RSA 与 Diffie–Hellman 唯一的算术原语，也是这个文件里最容易**静默出错**
     的一处。内部一律走 BigInt，理由是实测：朴素的 Number 平方乘法
     （r = (r * b) % m）在 m = 2147483647 上算 modPow(m − 3, 65537, m) 返回
     295847167，正确答案是 26756584。它不抛异常，只是给出一个长得很正常的错数。
     根源是中间量到得了 m²，而 m² 早就越过 2⁵³ —— Number 路径的安全上界是
     floor(√(2⁵³−1)) = 94906265。注意 m = 94906271 虽然超界却**碰巧算对**
     （实测两边都是 51890495），所以这个界必须由 m² < 2⁵³ 推出来，不能靠抽查
     试出来：抽查到一个相符的点，什么也没证明。

     签名是"同类进、同类出"：
       · 三个参数都是 Number → 返回 Number；
       · 三个参数都是 BigInt → 返回 BigInt；
       · 混着传 → 抛，不做隐式转换。
     混传抛错是为了让"传错类型"没有产出错答案的可能。JS 里 BigInt 与 Number
     的边界本来就半明半暗：`2n + 2` 抛 TypeError，`Number(2n ** 64n)` 却静静
     丢掉精度。与其在这里挑一条规则替调用方执行，不如让它自己说清楚。

     Number 路径**不设** 94906265 那个界：内部是 BigInt，中间量不会溢出，
     而结果恒小于 mod ≤ 2⁵³−1，一定能被 Number 精确表示。要拦的是参数本身就
     不是安全整数——那种误差在进函数之前就已经产生了，这里再算什么都无意义。 */
  function modPow(base, exp, mod_) {
    const kinds = [typeof base, typeof exp, typeof mod_];
    const big = kinds[0] === 'bigint';
    if (kinds[1] !== kinds[0] || kinds[2] !== kinds[0] || (!big && kinds[0] !== 'number')) {
      throw new Error('modPow 的三个参数必须同为 Number 或同为 BigInt，收到 ' + kinds.join(' / '));
    }
    if (!big) {
      const names = ['底数 base', '指数 exp', '模数 mod'];
      const vals = [base, exp, mod_];
      for (let i = 0; i < 3; i++) {
        if (!Number.isSafeInteger(vals[i])) {
          throw new Error('modPow 的' + names[i] + '必须是安全整数（|v| ≤ 2⁵³−1），收到 ' +
                          String(vals[i]) + '——超过 2⁵³ 的 Number 已经不是它自己了，请改传 BigInt');
        }
      }
    }
    let b = BigInt(base), e = BigInt(exp);
    const m = BigInt(mod_);
    /* 与 mod() 同一条门：模数必须为正。负模数下 ((a%m)+m)%m 会给出负结果，
       而这一节所有对外承诺的都是"结果落在 [0, mod)"。 */
    if (m <= 0n) throw new Error('modPow 的模数必须是正数，收到 ' + String(mod_));
    if (e < 0n) {
      throw new Error('modPow 的指数必须非负，收到 ' + String(exp) +
                      '（负指数意思是先求模逆再取幂，那是两步，请显式写出来）');
    }
    /* r 初值写 1n % m 而不是 1n：mod = 1 时任何数的任何次幂都 ≡ 0，
       写死 1n 会让 modPow(x, 0, 1) 返回 1——一个孤立、只在 m=1 时出现的错。 */
    let r = 1n % m;
    b = ((b % m) + m) % m;         // 负底数归一到 [0, m)，(−3)³ ≡ 4³ (mod 7)
    while (e > 0n) {
      if (e & 1n) r = (r * b) % m;
      b = (b * b) % m;
      e >>= 1n;
    }
    return big ? r : Number(r);
  }

  return { ALPHABET, N, isAlpha, normalize, letters, fromIndices,
           mod, gcd, egcd, modInverse,
           MAT_MAX_DIM, matMulVec, matMul, matDet, matInverse, matIsInvertible,
           toBytes, fromBytes, toHex, fromHex, xorBytes, randomBytes,
           toBits, fromBits, rotl32, rotr32, modPow };
});
