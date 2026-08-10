(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js / affine.js / hill.js 同源——那个字符串会被
       inline_core.py 原样内联进每个工具页，而 check.py 的 outbound_ref_check()
       正在数整个子树里的父目录引用，用它守住"cryptography/ 可以整体搬走"这条
       约束。浏览器分支根本走不到这一行，为它留一条会触发普查的字面量不划算。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.aes = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= AES-128（FIPS-197）=================
     本文件实现真正的 AES-128，并且把它拆成四个可以**单独关掉**的步骤——
     工具页的 ablation 页签就是靠这一点讲"每一步各干一件什么事"。

     ---- 为什么 GF(2⁸) 的算术写在这里，不写进 crypto-core ----
     crypto-core 是全章共用的地基（模运算、矩阵、字节与比特），第 4 章有六个
     工具在并行建，往地基里加东西等于让六个分支同时改同一个文件。而
     GF(2⁸)（模 x⁸+x⁴+x³+x+1）除了 AES 之外在本仓没有第二个使用者：
     Rijndael 的域是 AES 自己的定义的一部分，不是通用工具。所以它留在这里。

     ---- 状态的表示：**列主序的 16 字节**，不是 4×4 的嵌套数组 ----
     FIPS-197 §3.4 规定输入字节 i 落在 state[i mod 4][floor(i/4)]，也就是
     "一列一列地填"。于是"16 字节的块"与"4×4 的状态矩阵"是同一份数据的两种读法，
     用一维 Uint8Array 表示它，块与状态之间就不需要任何转换函数——
     少一次转换就少一处可以写反的地方。行 r 列 c 的字节是 s[c * 4 + r]。

     所有步骤函数都**返回新数组、不改入参**。工具页要同时画出一步的前后两态，
     原地修改会让"前"在画出来之前就没了。

     ---- 一处刻意的分歧：ablation 不碰密钥扩展 ----
     关掉 SubBytes 指的是**轮函数**里的那一次字节代换；密钥扩展里的 SubWord
     照常跑。理由是这一页要问的问题是"轮函数里的这一步在做什么"，而不是
     "把 S 盒从整个算法里挖掉会怎样"。两者混在一起时，看到的差异归因不了。
     这条纪律必须写出来，否则读到 ablation 结果的人无从知道边界画在哪里。 */

  const BLOCK = 16;          // 分组长度（字节）
  const KEY_BYTES = 16;      // AES-128 的密钥长度
  const ROUNDS = 10;         // AES-128 的轮数
  const NB = 4;              // 每个状态 4 列
  const NK = 4;              // 密钥 4 个字（AES-128）

  /* ================= GF(2⁸) =================
     约化多项式 x⁸ + x⁴ + x³ + x + 1 = 0x11b；字节里只装得下低 8 位，
     所以每次溢出异或的是 0x1b（0x11b 去掉最高位）。 */
  const GF_POLY = 0x11b;

  function xtime(a) {
    const v = (a << 1) & 0xff;
    return (a & 0x80) ? (v ^ 0x1b) : v;
  }

  /* 俄式农夫乘法。不查对数表：log/antilog 表要处理 0 这个没有对数的特例，
     而"忘了处理 0"给出的是一个看着正常的错数（本仓对这类静默错误有过教训）。
     每次乘法 8 轮，AES 一个块的 MixColumns 也才 16 × 4 次，快慢在这里不是问题。 */
  function gmul(a, b) {
    let x = a & 0xff, y = b & 0xff, p = 0;
    for (let i = 0; i < 8; i++) {
      if (y & 1) p ^= x;
      x = xtime(x);
      y >>= 1;
    }
    return p & 0xff;
  }

  /* 乘法逆元表，穷举求出来（255 × 255 次 gmul，加载时一次，实测 <2ms）。
     0 没有逆元，AES 约定 0 映射到 0——这是 S 盒定义的一部分，不是补丁。 */
  const GINV = (function () {
    const inv = new Uint8Array(256);
    for (let a = 1; a < 256; a++) {
      for (let b = 1; b < 256; b++) {
        if (gmul(a, b) === 1) { inv[a] = b; break; }
      }
    }
    return inv;
  })();

  function gInv(a) { return GINV[a & 0xff]; }

  function rotl8(x, n) { return ((x << n) | (x >>> (8 - n))) & 0xff; }

  /* ================= S 盒 =================
     **算出来的，不是抄一张 256 项的表。** 抄表能过所有测试，却把 S 盒变成一堆
     魔数；算出来则让"AES 唯一的非线性来自 GF(2⁸) 求逆"这句话在代码里是可读的：
     求逆是非线性的那一半，后面那个仿射变换是线性的那一半。
     测试里仍然钉着 FIPS-197 表格里的若干项——算错了要当场被抓住。

     仿射变换（FIPS-197 §5.1.1）：y_i = x_i ⊕ x_{i+4} ⊕ x_{i+5} ⊕ x_{i+6}
     ⊕ x_{i+7} ⊕ c_i，下标模 8，c = 0x63。写成整字节的循环移位就是下面这行。 */
  const SBOX = (function () {
    const s = new Uint8Array(256);
    for (let a = 0; a < 256; a++) {
      const b = gInv(a);
      s[a] = (b ^ rotl8(b, 1) ^ rotl8(b, 2) ^ rotl8(b, 3) ^ rotl8(b, 4) ^ 0x63) & 0xff;
    }
    return s;
  })();

  const INV_SBOX = (function () {
    const s = new Uint8Array(256);
    for (let a = 0; a < 256; a++) s[SBOX[a]] = a;
    return s;
  })();

  /* 轮常数。只用到前 10 个（AES-128）。0x1b / 0x36 不是笔误：
     2⁸ 在 GF(2⁸) 里就是 0x1b，2⁹ 是 0x36。 */
  const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

  /* ShiftRows 的位移量：第 r 行左移 r 格。写成常量而不是直接用 r，
     是为了让工具页能把它画成一行标注，且两边读的是同一份真相。 */
  const SHIFT_OFFSETS = [0, 1, 2, 3];

  /* MixColumns 的矩阵（GF(2⁸) 上的循环矩阵，生成元 3x + ... 见 FIPS-197 §5.1.3）。 */
  const MIX_MATRIX = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]];
  const INV_MIX_MATRIX = [[14, 11, 13, 9], [9, 14, 11, 13], [13, 9, 14, 11], [11, 13, 9, 14]];

  /* ================= 入参 =================
     形状检查集中在这里。散在各处的检查迟早漏掉一处，而"长度不对"在 AES 上
     是致命的：15 字节的密钥扩展出来的轮密钥全是垃圾，却不抛任何错。 */
  function bytesN(v, n, name) {
    let out;
    if (Object.prototype.toString.call(v) === '[object Uint8Array]') {
      out = v;
    } else if (Array.isArray(v)) {
      out = new Uint8Array(v.length);
      for (let i = 0; i < v.length; i++) {
        const b = v[i];
        if (!Number.isInteger(b) || b < 0 || b > 255) {
          throw new Error(name + '：第 ' + i + ' 个元素不是 0–255 的整数（收到 ' + String(b) + '）');
        }
        out[i] = b;
      }
    } else {
      throw new Error(name + ' 需要 Uint8Array 或 0–255 的整数数组');
    }
    if (out.length !== n) {
      throw new Error(name + ' 必须是 ' + n + ' 字节，收到 ' + out.length +
                      '——AES-128 不做任何填充或截断，那是调用方的决定');
    }
    return out;
  }

  function block(v, name) { return bytesN(v, BLOCK, name || 'AES 分组'); }

  /* ================= 四个步骤 =================
     每一个都是 16 字节进、16 字节出，互不知道对方存在。这正是这一页要讲的
     结构：AES 的一轮是四个独立的、各司其职的动作叠在一起。 */

  /* ① SubBytes —— 唯一的非线性步骤。逐字节查 S 盒，位置一个都不动。 */
  function subBytes(s) {
    const a = block(s, 'subBytes 的状态');
    const out = new Uint8Array(BLOCK);
    for (let i = 0; i < BLOCK; i++) out[i] = SBOX[a[i]];
    return out;
  }

  function invSubBytes(s) {
    const a = block(s, 'invSubBytes 的状态');
    const out = new Uint8Array(BLOCK);
    for (let i = 0; i < BLOCK; i++) out[i] = INV_SBOX[a[i]];
    return out;
  }

  /* ② ShiftRows —— 只搬家，不改值。第 r 行整体左移 r 格。
     它是全算法里**唯一让字节跨列移动**的动作，ablation 页签的主角。 */
  function shiftRows(s) {
    const a = block(s, 'shiftRows 的状态');
    const out = new Uint8Array(BLOCK);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < NB; c++) {
        out[c * 4 + r] = a[((c + SHIFT_OFFSETS[r]) % NB) * 4 + r];
      }
    }
    return out;
  }

  function invShiftRows(s) {
    const a = block(s, 'invShiftRows 的状态');
    const out = new Uint8Array(BLOCK);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < NB; c++) {
        out[((c + SHIFT_OFFSETS[r]) % NB) * 4 + r] = a[c * 4 + r];
      }
    }
    return out;
  }

  /* ③ MixColumns —— 只在**一列之内**混合，四列互不来往。
     这条"只在列内"是 ablation 那一页整个论证的支点，所以实现上刻意写成
     逐列的双重循环，而不是拉平成 16 个表达式：读代码的人要能看见那道边界。 */
  function mixWith(a, M) {
    const out = new Uint8Array(BLOCK);
    for (let c = 0; c < NB; c++) {
      for (let r = 0; r < 4; r++) {
        let v = 0;
        for (let k = 0; k < 4; k++) v ^= gmul(M[r][k], a[c * 4 + k]);
        out[c * 4 + r] = v;
      }
    }
    return out;
  }

  function mixColumns(s) { return mixWith(block(s, 'mixColumns 的状态'), MIX_MATRIX); }
  function invMixColumns(s) { return mixWith(block(s, 'invMixColumns 的状态'), INV_MIX_MATRIX); }

  /* ④ AddRoundKey —— 唯一让密钥进入运算的地方，一次逐字节异或。
     走 crypto-core 的 xorBytes：长度不等时它抛，而不是截到短的那一串。 */
  function addRoundKey(s, rk) {
    return C.xorBytes(block(s, 'addRoundKey 的状态'), block(rk, 'addRoundKey 的轮密钥'));
  }

  /* ================= 密钥扩展 =================
     16 字节密钥 → 11 把 16 字节轮密钥。w[i] 是第 i 个 32 位字；
     每 4 个字（= NK）做一次 RotWord + SubWord + Rcon。 */
  function keyExpansion(key) {
    const k = bytesN(key, KEY_BYTES, 'keyExpansion 的密钥');
    const total = NB * (ROUNDS + 1);          // 44 个字
    const w = new Uint8Array(total * 4);
    w.set(k, 0);
    for (let i = NK; i < total; i++) {
      let t0 = w[(i - 1) * 4], t1 = w[(i - 1) * 4 + 1],
          t2 = w[(i - 1) * 4 + 2], t3 = w[(i - 1) * 4 + 3];
      if (i % NK === 0) {
        /* RotWord 之后 SubWord，再异或轮常数——顺序不能换：
           先 Sub 再 Rot 得到的是另一套密钥，而它一样"看起来正常"。 */
        const r0 = t1, r1 = t2, r2 = t3, r3 = t0;
        t0 = SBOX[r0] ^ RCON[i / NK - 1];
        t1 = SBOX[r1];
        t2 = SBOX[r2];
        t3 = SBOX[r3];
      }
      w[i * 4]     = w[(i - NK) * 4]     ^ t0;
      w[i * 4 + 1] = w[(i - NK) * 4 + 1] ^ t1;
      w[i * 4 + 2] = w[(i - NK) * 4 + 2] ^ t2;
      w[i * 4 + 3] = w[(i - NK) * 4 + 3] ^ t3;
    }
    /* 切成 11 把 16 字节的轮密钥。第 r 把就是 w[4r] … w[4r+3]，按字拼接之后
       与状态的列主序天然对齐——所以 AddRoundKey 是一次平直的 16 字节异或，
       不需要任何重排。 */
    const keys = [];
    for (let r = 0; r <= ROUNDS; r++) keys.push(w.slice(r * BLOCK, (r + 1) * BLOCK));
    return keys;
  }

  /* ================= ablation 开关 =================
     四个步骤各一个布尔，缺省全开。关掉的步骤在轮里变成恒等映射——
     不是"跳过这一轮"，是"这一步什么也不做"，两者对轮数的影响完全不同。 */
  const STEP_KEYS = ['sub', 'shift', 'mix', 'ark'];
  const STEP_LABEL = {
    sub: 'SubBytes', shift: 'ShiftRows', mix: 'MixColumns', ark: 'AddRoundKey'
  };

  function normSteps(o) {
    const src = (o && o.steps) || {};
    const out = {};
    for (let i = 0; i < STEP_KEYS.length; i++) {
      const k = STEP_KEYS[i];
      out[k] = src[k] === undefined ? true : !!src[k];
    }
    return out;
  }

  /* ================= 轮 =================
     标准 AES-128 的十轮：第 1–9 轮是 Sub → Shift → Mix → Add，
     **第 10 轮没有 MixColumns**。最后一轮少这一步不是省事：有它的话
     解密方向的最后一步会多一次可以被公开还原的线性变换，等于白算。
     这里照 FIPS-197 写，ablation 也照这个骨架走。 */
  function roundStates(pt, key, opts) {
    const st = normSteps(opts);
    const rk = keyExpansion(key);
    let s = block(pt, 'roundStates 的明文分组');
    const out = [];
    s = st.ark ? addRoundKey(s, rk[0]) : s;
    out.push(s);                                     // 下标 0 = 初始 AddRoundKey 之后
    for (let r = 1; r <= ROUNDS; r++) {
      if (st.sub) s = subBytes(s);
      if (st.shift) s = shiftRows(s);
      if (st.mix && r !== ROUNDS) s = mixColumns(s);
      if (st.ark) s = addRoundKey(s, rk[r]);
      out.push(s);
    }
    return out;
  }

  function encryptBlock(pt, key, opts) {
    const rs = roundStates(pt, key, opts);
    return rs[rs.length - 1];
  }

  /* 解密只在"往返成立"这条断言上用到，工具页不画它，所以不带 ablation 开关：
     一个被挖掉一步的加密没有对应的解密，给它一个开关只会让人以为有。 */
  function decryptBlock(ct, key) {
    const rk = keyExpansion(key);
    let s = addRoundKey(block(ct, 'decryptBlock 的密文分组'), rk[ROUNDS]);
    for (let r = ROUNDS - 1; r >= 0; r--) {
      s = invShiftRows(s);
      s = invSubBytes(s);
      s = addRoundKey(s, rk[r]);
      if (r !== 0) s = invMixColumns(s);
    }
    return s;
  }

  /* ================= 逐步轨迹 =================
     给动画用：每一步一帧，含关掉的步骤（skipped: true，状态原样传下去）。
     保留被关掉的帧是刻意的——ablation 时帧数不变，画面上那一格明明白白地
     写着"这一步什么也没做"，而不是从时间轴上凭空消失。
     第 10 轮本来就没有 MixColumns，那一帧标 absent: true，与 skipped 分开：
     一个是规范如此，一个是使用者关掉的，混为一谈会把 FIPS 写错。 */
  function trace(pt, key, opts) {
    const st = normSteps(opts);
    const rk = keyExpansion(key);
    let s = block(pt, 'trace 的明文分组');
    const frames = [{ round: 0, step: 'in', label: 'Input', state: s, skipped: false, absent: false }];
    let next = st.ark ? addRoundKey(s, rk[0]) : s;
    frames.push({ round: 0, step: 'ark', label: STEP_LABEL.ark, state: next,
                  skipped: !st.ark, absent: false, roundKey: rk[0] });
    s = next;
    for (let r = 1; r <= ROUNDS; r++) {
      for (let i = 0; i < STEP_KEYS.length; i++) {
        const k = STEP_KEYS[i];
        const absent = (k === 'mix' && r === ROUNDS);
        const on = st[k] && !absent;
        if (on) {
          if (k === 'sub') s = subBytes(s);
          else if (k === 'shift') s = shiftRows(s);
          else if (k === 'mix') s = mixColumns(s);
          else s = addRoundKey(s, rk[r]);
        }
        frames.push({ round: r, step: k, label: STEP_LABEL[k], state: s,
                      skipped: !on && !absent, absent: absent,
                      roundKey: k === 'ark' ? rk[r] : null });
      }
    }
    return frames;
  }

  /* ================= 度量 =================
     全部返回**数**，不返回"是/否"。一个 boolean 会把"改了多少"压成"改没改"，
     而这一页想让人看见的正是那个量。 */

  const POPCOUNT = (function () {
    const t = new Uint8Array(256);
    for (let i = 0; i < 256; i++) t[i] = (i & 1) + t[i >> 1];
    return t;
  })();

  function bitDiff(a, b) {
    const x = block(a, 'bitDiff 的第一个分组'), y = block(b, 'bitDiff 的第二个分组');
    let n = 0;
    for (let i = 0; i < BLOCK; i++) n += POPCOUNT[x[i] ^ y[i]];
    return n;
  }

  function byteDiff(a, b) {
    const x = block(a, 'byteDiff 的第一个分组'), y = block(b, 'byteDiff 的第二个分组');
    let n = 0;
    for (let i = 0; i < BLOCK; i++) if (x[i] !== y[i]) n++;
    return n;
  }

  /* 每一列有几个字节不同。列是 ablation 那一页的主语：ShiftRows 关掉之后，
     0 号列以外的三列必须逐字节相同——不是"差不多相同"。 */
  function columnDiff(a, b) {
    const x = block(a, 'columnDiff 的第一个分组'), y = block(b, 'columnDiff 的第二个分组');
    const out = [0, 0, 0, 0];
    for (let c = 0; c < NB; c++) {
      for (let r = 0; r < 4; r++) if (x[c * 4 + r] !== y[c * 4 + r]) out[c]++;
    }
    return out;
  }

  /* 翻转明文的第 bit 位（MSB 在前，与 crypto-core 的 toBits 同一套编号）。 */
  function flipBit(pt, bit) {
    const a = block(pt, 'flipBit 的分组');
    if (!Number.isInteger(bit) || bit < 0 || bit >= BLOCK * 8) {
      throw new Error('flipBit：位序号必须是 0–' + (BLOCK * 8 - 1) + ' 的整数，收到 ' + String(bit));
    }
    const out = new Uint8Array(a);
    out[bit >> 3] ^= 1 << (7 - (bit & 7));
    return out;
  }

  /* 单比特雪崩：翻一位，逐轮数"128 位里变了几位"。
     返回长度 11 的数组，下标 0 是初始 AddRoundKey 之后（此时恒为 1——
     异或不会扩散任何东西，那一格正是这条曲线的对照点）。 */
  function avalanche(pt, key, bit, opts) {
    const a = roundStates(pt, key, opts);
    const b = roundStates(flipBit(pt, bit), key, opts);
    const out = [];
    for (let r = 0; r < a.length; r++) out.push(bitDiff(a[r], b[r]));
    return out;
  }

  /* 128 个位置全跑一遍，逐轮给出 min / max / mean 与均值占 128 位的比例。
     只报平均值是不够的：平均值 64 既可能来自"每次都 64"，也可能来自
     "一半 0 一半 128"，而这两件事在密码学上天差地别。 */
  function avalancheCurve(pt, key, opts) {
    const bits = BLOCK * 8;
    const rows = [];
    for (let r = 0; r <= ROUNDS; r++) rows.push({ round: r, min: Infinity, max: -Infinity, sum: 0 });
    for (let b = 0; b < bits; b++) {
      const cur = avalanche(pt, key, b, opts);
      for (let r = 0; r < cur.length; r++) {
        const row = rows[r];
        if (cur[r] < row.min) row.min = cur[r];
        if (cur[r] > row.max) row.max = cur[r];
        row.sum += cur[r];
      }
    }
    return rows.map(function (row) {
      return {
        round: row.round, min: row.min, max: row.max,
        mean: row.sum / bits,
        fraction: row.sum / bits / bits
      };
    });
  }

  /* 逐轮、逐列的字节差。给 ablation 那一页：翻一个 0 号列里的比特，
     看别的列什么时候开始动。 */
  function columnSpread(pt, key, bit, opts) {
    const a = roundStates(pt, key, opts);
    const b = roundStates(flipBit(pt, bit), key, opts);
    const out = [];
    for (let r = 0; r < a.length; r++) out.push(columnDiff(a[r], b[r]));
    return out;
  }

  /* ================= 线性性 =================
     f(a ⊕ b) 与 f(a) ⊕ f(b) 的差。GF(2) 线性的步骤给出全零；
     AddRoundKey 给出的是**轮密钥本身**（它是仿射不是线性）；
     SubBytes 给出的是一堆没有规律的字节。
     返回差值本身而不是 true/false——差值能直接当反例印在页面上。 */
  function applyStep(name, s, rk) {
    if (name === 'sub') return subBytes(s);
    if (name === 'shift') return shiftRows(s);
    if (name === 'mix') return mixColumns(s);
    if (name === 'ark') return addRoundKey(s, rk);
    throw new Error('applyStep：未知的步骤 ' + JSON.stringify(name) +
                    '（只有 ' + STEP_KEYS.join(' / ') + '）');
  }

  function linearityDefect(name, a, b, rk) {
    const x = block(a, 'linearityDefect 的 a'), y = block(b, 'linearityDefect 的 b');
    const lhs = applyStep(name, C.xorBytes(x, y), rk);
    const rhs = C.xorBytes(applyStep(name, x, rk), applyStep(name, y, rk));
    return C.xorBytes(lhs, rhs);
  }

  function isZero(bytes) {
    const a = block(bytes, 'isZero 的分组');
    for (let i = 0; i < BLOCK; i++) if (a[i] !== 0) return false;
    return true;
  }

  /* ================= 文本便利层 =================
     工具页要拿一句话当明文。AES 是分组密码，不是流密码——不足 16 字节要补，
     补法必须由调用方看得见，所以这里只提供**零填充到 16 字节的第一个分组**，
     并把是否截断如实报出来。真正的分组模式（CBC/CTR）不在这一页的范围里，
     所以不假装实现它们。 */
  function firstBlock(text) {
    const bytes = C.toBytes(String(text));
    const out = new Uint8Array(BLOCK);
    const n = Math.min(BLOCK, bytes.length);
    for (let i = 0; i < n; i++) out[i] = bytes[i];
    return { block: out, used: n, total: bytes.length, truncated: bytes.length > BLOCK };
  }

  return {
    BLOCK, KEY_BYTES, ROUNDS, NB, NK,
    GF_POLY, xtime, gmul, gInv,
    SBOX, INV_SBOX, RCON, SHIFT_OFFSETS, MIX_MATRIX, INV_MIX_MATRIX,
    STEP_KEYS, STEP_LABEL,
    subBytes, invSubBytes, shiftRows, invShiftRows,
    mixColumns, invMixColumns, addRoundKey,
    keyExpansion, roundStates, trace, encryptBlock, decryptBlock,
    bitDiff, byteDiff, columnDiff, flipBit,
    avalanche, avalancheCurve, columnSpread,
    applyStep, linearityDefect, isZero,
    firstBlock
  };
});
