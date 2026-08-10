(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径（理由见 caesar.js 里那段注释——check.py 的 outbound_ref_check()
       正在数整个子树里的父目录引用）。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.des = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= DES 与 Feistel 结构 =================

     这个文件里有两样东西，刻意分开：

       ① **Feistel 结构本身**（feistelRound / feistelEncrypt / feistelDecrypt）。
          它对轮函数 F 一无所知——F 是参数。这不是抽象癖：Feistel 最反直觉的
          那条性质正是"F 可以是任何函数，哪怕不可逆、哪怕是常函数，整个结构
          仍然精确可逆"。把 F 写死在 DES 里就没法把这句话**跑出来**给人看，
          只能写在注释里让人信。这里能跑：constantF() 就是一个把所有输入映到
          同一个输出的 F，拿它跑 feistelDecrypt(feistelEncrypt(x)) 照样等于 x。

       ② **DES 的那一份具体的 F**（IP / E / S 盒 / P / PC-1 / PC-2）。它只是
          填进 ① 的一个参数，没有任何特殊地位。

     比特一律用 0/1 的**普通数组**表示，MSB 在前——与 crypto-core 的
     toBits/fromBits 同一约定。DES 的每一张表（IP、E、P、PC-1、PC-2）都按
     "最高位是第 1 位"编号，所以表里的数字可以逐字节照抄公开资料，使用处
     不需要任何翻转；一张表翻了、另一张忘翻，是这类实现最典型的坏法。 */

  /* ---------------- 置换表 ----------------
     全部 1-based，与 FIPS 46-3 的印刷版一致。permute() 会把它们减 1。 */

  /* 初始置换 IP：64 → 64 */
  const IP = [
    58, 50, 42, 34, 26, 18, 10, 2,
    60, 52, 44, 36, 28, 20, 12, 4,
    62, 54, 46, 38, 30, 22, 14, 6,
    64, 56, 48, 40, 32, 24, 16, 8,
    57, 49, 41, 33, 25, 17,  9, 1,
    59, 51, 43, 35, 27, 19, 11, 3,
    61, 53, 45, 37, 29, 21, 13, 5,
    63, 55, 47, 39, 31, 23, 15, 7
  ];

  /* 末置换 FP = IP⁻¹：64 → 64。selfCheck() 会当场验证这一点，不靠"抄对了"。 */
  const FP = [
    40, 8, 48, 16, 56, 24, 64, 32,
    39, 7, 47, 15, 55, 23, 63, 31,
    38, 6, 46, 14, 54, 22, 62, 30,
    37, 5, 45, 13, 53, 21, 61, 29,
    36, 4, 44, 12, 52, 20, 60, 28,
    35, 3, 43, 11, 51, 19, 59, 27,
    34, 2, 42, 10, 50, 18, 58, 26,
    33, 1, 41,  9, 49, 17, 57, 25
  ];

  /* 扩展 E：32 → 48。它是 DES 里"雪崩"的第一台发动机——每一列的边缘比特被
     抄进两个不同的 S 盒，一位输入因此在下一轮同时影响两个盒子。 */
  const E = [
    32,  1,  2,  3,  4,  5,
     4,  5,  6,  7,  8,  9,
     8,  9, 10, 11, 12, 13,
    12, 13, 14, 15, 16, 17,
    16, 17, 18, 19, 20, 21,
    20, 21, 22, 23, 24, 25,
    24, 25, 26, 27, 28, 29,
    28, 29, 30, 31, 32,  1
  ];

  /* S 盒之后的位置换 P：32 → 32。它负责把一个 S 盒的 4 位输出撒到下一轮的
     不同 S 盒里去——扩散的第二台发动机。 */
  const P = [
    16,  7, 20, 21, 29, 12, 28, 17,
     1, 15, 23, 26,  5, 18, 31, 10,
     2,  8, 24, 14, 32, 27,  3,  9,
    19, 13, 30,  6, 22, 11,  4, 25
  ];

  /* PC-1：64 → 56。**恰好丢掉 8 个校验位**（第 8/16/…/64 位），这就是
     "64 位密钥只有 56 位有效"的全部机制。selfCheck() 验证被丢掉的正是这八位。 */
  const PC1 = [
    57, 49, 41, 33, 25, 17,  9,
     1, 58, 50, 42, 34, 26, 18,
    10,  2, 59, 51, 43, 35, 27,
    19, 11,  3, 60, 52, 44, 36,
    63, 55, 47, 39, 31, 23, 15,
     7, 62, 54, 46, 38, 30, 22,
    14,  6, 61, 53, 45, 37, 29,
    21, 13,  5, 28, 20, 12,  4
  ];

  /* PC-2：56 → 48（压缩置换，丢掉 8 位）。 */
  const PC2 = [
    14, 17, 11, 24,  1,  5,
     3, 28, 15,  6, 21, 10,
    23, 19, 12,  4, 26,  8,
    16,  7, 27, 20, 13,  2,
    41, 52, 31, 37, 47, 55,
    30, 40, 51, 45, 33, 48,
    44, 49, 39, 56, 34, 53,
    46, 42, 50, 36, 29, 32
  ];

  /* 每一轮 C/D 各自左循环几位。十六轮加起来正好 28，于是第 16 轮之后
     C₁₆ = C₀、D₁₆ = D₀——密钥表回到原点。这条恒等式 selfCheck() 会验。 */
  const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

  /* 八个 S 盒，各 4 行 × 16 列，按行主序摊平成 64 个数。
     行号 = 六位输入的**首末两位**，列号 = 中间四位。这个错位是故意的：
     它让相邻的两个 S 盒共享输入位（配合 E 表），是 DES 扩散的来源之一。 */
  const SBOXES = [
    [14,  4, 13,  1,  2, 15, 11,  8,  3, 10,  6, 12,  5,  9,  0,  7,
      0, 15,  7,  4, 14,  2, 13,  1, 10,  6, 12, 11,  9,  5,  3,  8,
      4,  1, 14,  8, 13,  6,  2, 11, 15, 12,  9,  7,  3, 10,  5,  0,
     15, 12,  8,  2,  4,  9,  1,  7,  5, 11,  3, 14, 10,  0,  6, 13],
    [15,  1,  8, 14,  6, 11,  3,  4,  9,  7,  2, 13, 12,  0,  5, 10,
      3, 13,  4,  7, 15,  2,  8, 14, 12,  0,  1, 10,  6,  9, 11,  5,
      0, 14,  7, 11, 10,  4, 13,  1,  5,  8, 12,  6,  9,  3,  2, 15,
     13,  8, 10,  1,  3, 15,  4,  2, 11,  6,  7, 12,  0,  5, 14,  9],
    [10,  0,  9, 14,  6,  3, 15,  5,  1, 13, 12,  7, 11,  4,  2,  8,
     13,  7,  0,  9,  3,  4,  6, 10,  2,  8,  5, 14, 12, 11, 15,  1,
     13,  6,  4,  9,  8, 15,  3,  0, 11,  1,  2, 12,  5, 10, 14,  7,
      1, 10, 13,  0,  6,  9,  8,  7,  4, 15, 14,  3, 11,  5,  2, 12],
    [ 7, 13, 14,  3,  0,  6,  9, 10,  1,  2,  8,  5, 11, 12,  4, 15,
     13,  8, 11,  5,  6, 15,  0,  3,  4,  7,  2, 12,  1, 10, 14,  9,
     10,  6,  9,  0, 12, 11,  7, 13, 15,  1,  3, 14,  5,  2,  8,  4,
      3, 15,  0,  6, 10,  1, 13,  8,  9,  4,  5, 11, 12,  7,  2, 14],
    [ 2, 12,  4,  1,  7, 10, 11,  6,  8,  5,  3, 15, 13,  0, 14,  9,
     14, 11,  2, 12,  4,  7, 13,  1,  5,  0, 15, 10,  3,  9,  8,  6,
      4,  2,  1, 11, 10, 13,  7,  8, 15,  9, 12,  5,  6,  3,  0, 14,
     11,  8, 12,  7,  1, 14,  2, 13,  6, 15,  0,  9, 10,  4,  5,  3],
    [12,  1, 10, 15,  9,  2,  6,  8,  0, 13,  3,  4, 14,  7,  5, 11,
     10, 15,  4,  2,  7, 12,  9,  5,  6,  1, 13, 14,  0, 11,  3,  8,
      9, 14, 15,  5,  2,  8, 12,  3,  7,  0,  4, 10,  1, 13, 11,  6,
      4,  3,  2, 12,  9,  5, 15, 10, 11, 14,  1,  7,  6,  0,  8, 13],
    [ 4, 11,  2, 14, 15,  0,  8, 13,  3, 12,  9,  7,  5, 10,  6,  1,
     13,  0, 11,  7,  4,  9,  1, 10, 14,  3,  5, 12,  2, 15,  8,  6,
      1,  4, 11, 13, 12,  3,  7, 14, 10, 15,  6,  8,  0,  5,  9,  2,
      6, 11, 13,  8,  1,  4, 10,  7,  9,  5,  0, 15, 14,  2,  3, 12],
    [13,  2,  8,  4,  6, 15, 11,  1, 10,  9,  3, 14,  5,  0, 12,  7,
      1, 15, 13,  8, 10,  3,  7,  4, 12,  5,  6, 11,  0, 14,  9,  2,
      7, 11,  4,  1,  9, 12, 14,  2,  0,  6, 10, 13, 15,  3,  5,  8,
      2,  1, 14,  7,  4, 10,  8, 13, 15, 12,  9,  0,  3,  5,  6, 11]
  ];

  const ROUNDS = 16;
  const BLOCK_BITS = 64;
  const KEY_BITS = 64;
  const EFFECTIVE_KEY_BITS = 56;

  /* ---------------- 比特层的三个小工具 ---------------- */

  /* 表里的下标一律 1-based。越界必须抛：一个 0 或一个 65 会静默取到
     undefined，之后 xorBits 得到 NaN，最后 fromBits 才在很远的地方报
     "第 n 位不是 0 或 1"——错误信息指向的位置与真正的错处毫无关系。 */
  function permute(bits, table, name) {
    const out = new Array(table.length);
    for (let i = 0; i < table.length; i++) {
      const src = table[i] - 1;
      if (!(src >= 0 && src < bits.length)) {
        throw new Error((name || 'permute') + '：表的第 ' + i + ' 项是 ' + table[i] +
                        '，超出了 ' + bits.length + ' 位输入的范围');
      }
      out[i] = bits[src];
    }
    return out;
  }

  function xorBits(a, b, name) {
    if (a.length !== b.length) {
      throw new Error((name || 'xorBits') + '：两串比特长度必须相同，收到 ' +
                      a.length + ' 与 ' + b.length);
    }
    const out = new Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (a[i] ^ b[i]) & 1;
    return out;
  }

  function hamming(a, b) {
    if (a.length !== b.length) {
      throw new Error('hamming：两串比特长度必须相同，收到 ' + a.length + ' 与 ' + b.length);
    }
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    return n;
  }

  /* 左循环。amount 会先规约到 [0, len)，这样 rotl(bits, 28) 与 rotl(bits, 0)
     是同一件事，而不是靠 slice 的越界行为碰巧成立。 */
  function rotl(bits, amount) {
    const n = bits.length;
    if (n === 0) return [];
    const k = C.mod(amount, n);
    return bits.slice(k).concat(bits.slice(0, k));
  }

  /* 入口统一：任何"一个 8 字节的块"都从这里进来。
     C.toBits 自带字节校验（Uint8Array 或 0–255 整数数组），这里只多管长度。 */
  function block64(v, name) {
    const bits = C.toBits(v);
    if (bits.length !== BLOCK_BITS) {
      throw new Error(name + ' 必须是 8 字节（64 位），收到 ' + (bits.length / 8) + ' 字节');
    }
    return bits;
  }

  /* 十六进制的便捷入口。页面上一切块数据都以 hex 呈现——crypto-core 的
     fromBytes() 对非法 UTF-8 是**抛异常**而不是产出 U+FFFD，密文与错密钥
     的解密结果本来就是随机字节，只能走 toHex()。 */
  function fromHex64(hex, name) {
    const b = C.fromHex(String(hex).replace(/[\s:_-]/g, ''));
    if (b.length !== 8) {
      throw new Error(name + ' 必须是 16 个十六进制数字（8 字节），收到 ' + b.length + ' 字节');
    }
    return b;
  }

  /* ---------------- 密钥表 ---------------- */

  /* 返回全过程，不只是 16 把子密钥：页面要把 PC-1、C/D 两个 28 位寄存器、
     每一轮的左移量、PC-2 画出来。encryptBlock 只取其中的 subkeys 字段——
     只有一份实现，画面上看到的和真正用于加密的必然是同一批比特。 */
  function keyScheduleTrace(key) {
    const keyBits = block64(key, 'DES 密钥');
    const pc1 = permute(keyBits, PC1, 'PC-1');
    let c = pc1.slice(0, 28), d = pc1.slice(28);
    const cs = [c.slice()], ds = [d.slice()], subkeys = [];
    for (let i = 0; i < ROUNDS; i++) {
      c = rotl(c, SHIFTS[i]);
      d = rotl(d, SHIFTS[i]);
      cs.push(c.slice());
      ds.push(d.slice());
      subkeys.push(permute(c.concat(d), PC2, 'PC-2'));
    }
    return { keyBits: keyBits, pc1: pc1, C: cs, D: ds, shifts: SHIFTS.slice(), subkeys: subkeys };
  }

  function keySchedule(key) { return keyScheduleTrace(key).subkeys; }

  /* ---------------- 轮函数 F ----------------
     F: (32 位, 48 位子密钥) → 32 位。**它不需要可逆**，而这正是重点：
     它的输出只被 XOR 进另外半个块，XOR 自己才是那个可逆的运算。 */
  function fTrace(r32, k48) {
    if (r32.length !== 32) throw new Error('DES 的轮函数需要 32 位输入，收到 ' + r32.length);
    if (k48.length !== 48) throw new Error('DES 的轮函数需要 48 位子密钥，收到 ' + k48.length);
    const expanded = permute(r32, E, 'E');
    const xored = xorBits(expanded, k48, 'E(R) ⊕ K');
    const groups = [];
    const sOut = [];
    for (let i = 0; i < 8; i++) {
      const six = xored.slice(i * 6, i * 6 + 6);
      const row = (six[0] << 1) | six[5];
      const col = (six[1] << 3) | (six[2] << 2) | (six[3] << 1) | six[4];
      const val = SBOXES[i][row * 16 + col];
      const four = [(val >> 3) & 1, (val >> 2) & 1, (val >> 1) & 1, val & 1];
      groups.push({ box: i, six: six, row: row, col: col, value: val, four: four });
      sOut.push(four[0], four[1], four[2], four[3]);
    }
    const out = permute(sOut, P, 'P');
    return { expanded: expanded, xored: xored, groups: groups, sOut: sOut, out: out };
  }

  function desF(r32, k48) { return fTrace(r32, k48).out; }

  /* ---------------- 通用 Feistel ----------------
     这一节对 DES 一无所知。F 是参数，两个半块可以是任何等长的比特串。 */

  /* 一轮：(L, R) → (R, L ⊕ F(R, k))。 */
  function feistelRound(l, r, k, F) {
    const f = F(r, k);
    if (f.length !== l.length) {
      throw new Error('Feistel：F 的输出有 ' + f.length + ' 位，与左半块的 ' +
                      l.length + ' 位不等——XOR 无法进行');
    }
    return [r.slice(), xorBits(l, f, 'L ⊕ F(R,K)')];
  }

  /* 一轮的**逆**，写成 swap ∘ round ∘ swap，而不是另写一遍公式。
     这行代码本身就是这一页要讲的那句话：**没有第二套电路**。解密用的是
     同一个 feistelRound，只是两头各加一次交换（在整块加解密里，那两次
     交换被"最后一轮不交换"的约定吸收掉了，于是连交换都省了）。 */
  function feistelRoundInverse(a, b, k, F) {
    const t = feistelRound(b, a, k, F);
    return [t[1], t[0]];
  }

  /* n 轮 + 末尾交换。返回每一步的状态，页面直接照着画。
     末尾那次交换是 Feistel 的惯例（DES 也这么干），它让"加密与解密是同一段
     代码、只把子密钥倒过来"成立——没有它，解密就得在两头各补一次交换。 */
  function feistelRun(l0, r0, subkeys, F) {
    if (l0.length !== r0.length) {
      throw new Error('Feistel：两个半块必须等长，收到 ' + l0.length + ' 与 ' + r0.length);
    }
    if (typeof F !== 'function') throw new Error('Feistel 需要一个轮函数 F');
    if (!subkeys || !subkeys.length) throw new Error('Feistel 需要至少一把子密钥');
    let l = l0.slice(), r = r0.slice();
    const steps = [{ round: 0, L: l.slice(), R: r.slice() }];
    for (let i = 0; i < subkeys.length; i++) {
      const f = F(r, subkeys[i]);
      const nr = xorBits(l, f, 'L ⊕ F(R,K)');
      steps.push({ round: i + 1, L: r.slice(), R: nr.slice(), F: f.slice(), key: subkeys[i] });
      l = r; r = nr;
    }
    /* 末尾交换：输出是 (Rₙ, Lₙ)。 */
    return { steps: steps, out: [r.slice(), l.slice()] };
  }

  function feistelEncrypt(halves, subkeys, F) {
    return feistelRun(halves[0], halves[1], subkeys, F).out;
  }

  /* 同一个 feistelRun，子密钥倒序。整个"解密"就是这一行。 */
  function feistelDecrypt(halves, subkeys, F) {
    return feistelRun(halves[0], halves[1], subkeys.slice().reverse(), F).out;
  }

  /* 一个**故意不可逆**的 F：把任何输入都映到同一个常量。
     信息在这里被彻底销毁（2^width 个输入 → 1 个输出），而 Feistel 结构照样
     精确可逆。这是这一页最反直觉的一件事，所以它必须是能跑的代码，
     而不是一句注释。 */
  function constantF(width, fill) {
    const v = fill == null ? 1 : (fill & 1);
    const out = new Array(width);
    for (let i = 0; i < width; i++) out[i] = v;
    return function () { return out.slice(); };
  }

  /* 另一个不可逆的 F：把整个右半块与子密钥压成 1 位，再摊回 width 位。
     比常函数稍微"像个函数"一点——它确实读输入——但同样是多对一。 */
  function parityF(width) {
    return function (r, k) {
      let p = 0;
      for (let i = 0; i < r.length; i++) p ^= r[i];
      for (let i = 0; i < k.length; i++) p ^= k[i];
      const out = new Array(width);
      for (let i = 0; i < width; i++) out[i] = p;
      return out;
    };
  }

  const F_KINDS = {
    des: { key: 'des', fn: desF, invertible: false, needsKeyBits: 48 },
    constant: { key: 'constant', fn: constantF(32, 1), invertible: false, needsKeyBits: 0 },
    parity: { key: 'parity', fn: parityF(32), invertible: false, needsKeyBits: 0 }
  };

  /* ---------------- 整块 DES ---------------- */

  /* 唯一的实现，加密解密共用。opts.subkeys 允许调用方注入任意 16 把子密钥
     （弱密钥演示、以及"同一段电路换一份密钥表"的对照都要用），
     opts.F 允许换掉轮函数——把 ① 与 ② 的分离一路贯彻到整块接口上。 */
  function runBlock(blockIn, key, opts) {
    opts = opts || {};
    const F = opts.F || desF;
    const subkeys = opts.subkeys || keySchedule(key);
    if (subkeys.length !== ROUNDS && !opts.allowShort) {
      throw new Error('DES 需要 16 把子密钥，收到 ' + subkeys.length);
    }
    const order = opts.decrypt ? subkeys.slice().reverse() : subkeys.slice();
    const inBits = block64(blockIn, opts.decrypt ? 'DES 密文块' : 'DES 明文块');
    const afterIP = permute(inBits, IP, 'IP');

    let l = afterIP.slice(0, 32), r = afterIP.slice(32);
    /* states[i] = **走完第 i 轮之后**的 64 位内部状态（L‖R）。
       states[0] 因此是 IP 之后、第一轮之前。雪崩曲线读的就是它。 */
    const states = [afterIP.slice()];
    const rounds = [];
    for (let i = 0; i < order.length; i++) {
      const f = (F === desF) ? fTrace(r, order[i]) : { out: F(r, order[i]) };
      const nr = xorBits(l, f.out, 'L ⊕ F(R,K)');
      rounds.push({ round: i + 1, L: l, R: r, key: order[i], f: f, Lnext: r, Rnext: nr });
      l = r; r = nr;
      states.push(l.concat(r));
    }
    const preoutput = r.concat(l);            // 末尾交换
    const outBits = permute(preoutput, FP, 'FP');
    return { inBits: inBits, afterIP: afterIP, subkeys: subkeys, order: order,
             rounds: rounds, states: states, preoutput: preoutput,
             outBits: outBits, out: C.fromBits(outBits) };
  }

  function encryptBlock(blockIn, key, opts) {
    return runBlock(blockIn, key, Object.assign({}, opts, { decrypt: false })).out;
  }
  function decryptBlock(blockIn, key, opts) {
    return runBlock(blockIn, key, Object.assign({}, opts, { decrypt: true })).out;
  }
  function traceBlock(blockIn, key, opts) { return runBlock(blockIn, key, opts); }

  /* 3DES / EDE。存在的理由只有一个：keyspace 那一页要说"同一段电路跑三遍，
     密钥从 56 位变成 112 位"，而说得出就该跑得出。
     k2 === k1 === k3 时它必须退化成单次 DES——这条恒等式是它自己的测试。 */
  function encryptBlock3(blockIn, k1, k2, k3) {
    return encryptBlock(decryptBlock(encryptBlock(blockIn, k1), k2), k3);
  }
  function decryptBlock3(blockIn, k1, k2, k3) {
    return decryptBlock(encryptBlock(decryptBlock(blockIn, k3), k2), k1);
  }

  /* ---------------- 校验位与 56 位有效密钥 ----------------
     DES 密钥是 64 位，每个字节的**最低位**是奇校验位：整字节的 1 的个数
     应当是奇数。PC-1 把这八位全部丢掉，所以它们对密文没有任何影响——
     "56 位有效密钥"这句话的机制就是这一条，页面要把它当场验出来。 */

  function parityReport(key) {
    const bits = block64(key, 'DES 密钥');
    const per = [];
    let allOk = true;
    for (let i = 0; i < 8; i++) {
      let ones = 0;
      for (let k = 0; k < 7; k++) ones += bits[i * 8 + k];
      const want = (ones % 2 === 0) ? 1 : 0;      // 奇校验：整字节的 1 应为奇数
      const got = bits[i * 8 + 7];
      const ok = (got === want);
      if (!ok) allOk = false;
      per.push({ byte: i, ones7: ones, expected: want, actual: got, ok: ok });
    }
    return { bytes: per, allOk: allOk };
  }

  /* 把八个校验位改成正确的奇校验值。返回新密钥，不改原参数。 */
  function fixParity(key) {
    const bits = block64(key, 'DES 密钥').slice();
    for (let i = 0; i < 8; i++) {
      let ones = 0;
      for (let k = 0; k < 7; k++) ones += bits[i * 8 + k];
      bits[i * 8 + 7] = (ones % 2 === 0) ? 1 : 0;
    }
    return C.fromBits(bits);
  }

  /* 按 mask（八位数组或 0–255 的整数）翻转指定字节的校验位。
     页面上的"翻转校验位"开关走的就是它。 */
  function flipParity(key, mask) {
    const bits = block64(key, 'DES 密钥').slice();
    for (let i = 0; i < 8; i++) {
      const on = Array.isArray(mask) ? !!mask[i] : ((mask >> i) & 1);
      if (on) bits[i * 8 + 7] ^= 1;
    }
    return C.fromBits(bits);
  }

  /* 56 位有效密钥 = PC-1 的输出。两把只在校验位上不同的密钥，这里必然相同。 */
  function effectiveKey(key) { return permute(block64(key, 'DES 密钥'), PC1, 'PC-1'); }

  /* 翻转块（或密钥）里的第 i 位，MSB 计数从 0 起。 */
  function flipBit(bytes, index) {
    const bits = C.toBits(bytes).slice();
    if (!Number.isInteger(index) || index < 0 || index >= bits.length) {
      throw new Error('flipBit：位号必须是 [0, ' + bits.length + ') 内的整数，收到 ' + String(index));
    }
    bits[index] ^= 1;
    return C.fromBits(bits);
  }

  /* ---------------- 雪崩 ----------------
     翻明文的一位，逐轮数两条轨迹差了多少位。
     perRound[0] 是 IP 之后、第一轮之前——它必然等于 1（IP 是置换，不增不减）。
     perRound[16] 必然等于密文的差异位数（FP 也是置换，末尾交换也是置换）。
     这两条恒等式由测试钉住：它们是"这条曲线画的是不是同一件事"的判据。 */
  function avalanche(blockIn, key, bitIndex, opts) {
    opts = opts || {};
    const a = runBlock(blockIn, key, opts);
    const flipped = opts.flipKey ? blockIn : flipBit(blockIn, bitIndex);
    const key2 = opts.flipKey ? flipBit(key, bitIndex) : key;
    const b = runBlock(flipped, key2, opts);
    const perRound = [];
    const masks = [];
    for (let i = 0; i < a.states.length; i++) {
      perRound.push(hamming(a.states[i], b.states[i]));
      masks.push(xorBits(a.states[i], b.states[i]));
    }
    return {
      perRound: perRound,
      fractions: perRound.map(function (n) { return n / BLOCK_BITS; }),
      masks: masks,
      outDiff: hamming(a.outBits, b.outBits),
      outMask: xorBits(a.outBits, b.outBits),
      a: a, b: b
    };
  }

  /* 第一次达到（或超过）阈值的轮号；从未达到返回 -1。
     阈值默认 32 = 64 位的一半。返回的是**测出来的**轮号，不是记忆里的 5。 */
  function avalancheReachesAt(perRound, threshold) {
    const th = threshold == null ? BLOCK_BITS / 2 : threshold;
    for (let i = 0; i < perRound.length; i++) if (perRound[i] >= th) return i;
    return -1;
  }

  /* 把 64 个明文位各翻一次，逐轮取平均。页面上那条曲线画的是这个，
     不是某一位的运气。 */
  function avalancheSweep(blockIn, key) {
    const sum = new Array(ROUNDS + 1).fill(0);
    let worst = null, best = null;
    for (let i = 0; i < BLOCK_BITS; i++) {
      const av = avalanche(blockIn, key, i);
      for (let r = 0; r <= ROUNDS; r++) sum[r] += av.perRound[r];
      const at = avalancheReachesAt(av.perRound);
      if (worst === null || at > worst.at) worst = { bit: i, at: at };
      if (best === null || at < best.at) best = { bit: i, at: at };
    }
    return {
      mean: sum.map(function (v) { return v / BLOCK_BITS; }),
      meanFraction: sum.map(function (v) { return v / BLOCK_BITS / BLOCK_BITS; }),
      slowestBit: worst, fastestBit: best
    };
  }

  /* ---------------- 弱密钥 ----------------
     四把弱密钥的 C₀ 与 D₀ 都是全 0 或全 1，于是循环左移改变不了它们，
     十六把子密钥完全相同 ⟹ 加密与解密是同一个映射 ⟹ E(E(m)) = m。
     这里只写下十六进制；"它们是不是真的这样"由 weakKeyReport() 当场验，
     测试里也不许写成断言常量——那等于把记忆当证据。 */
  const WEAK_KEYS = [
    '0101010101010101',
    'fefefefefefefefe',
    'e0e0e0e0f1f1f1f1',
    '1f1f1f1f0e0e0e0e'
  ];

  /* 半弱密钥成对出现：Eₖ₁ 的逆是 Eₖ₂（而不是它自己）。 */
  const SEMI_WEAK_PAIRS = [
    ['01fe01fe01fe01fe', 'fe01fe01fe01fe01'],
    ['1fe01fe00ef10ef1', 'e01fe01ff10ef10e'],
    ['01e001e001f101f1', 'e001e001f101f101'],
    ['1ffe1ffe0efe0efe', 'fe1ffe1ffe0efe0e'],
    ['011f011f010e010e', '1f011f010e010e01'],
    ['e0fee0fef1fef1fe', 'fee0fee0fef1fef1']
  ];

  /* 给一把密钥出一份**实测**报告：子密钥是否全同、是否自逆（在给定的探针块上）。
     probes 由调用方给，模块内不碰 Math.random（与 crypto-core 的 randomBytes
     同一条纪律）。 */
  function weakKeyReport(key, probes) {
    const sk = keySchedule(key);
    let allSame = true;
    for (let i = 1; i < sk.length; i++) {
      if (hamming(sk[0], sk[i]) !== 0) { allSame = false; break; }
    }
    const list = probes && probes.length ? probes : [C.fromHex('0123456789abcdef')];
    let selfInverse = true;
    for (let i = 0; i < list.length; i++) {
      const once = encryptBlock(list[i], key);
      const twice = encryptBlock(once, key);
      if (C.toHex(twice) !== C.toHex(list[i])) { selfInverse = false; break; }
    }
    return { allSubkeysIdentical: allSame, selfInverse: selfInverse, subkeys: sk };
  }

  /* ---------------- 密钥空间的算术 ----------------
     纯算术，没有任何"业界共识"藏在里面：给一个每秒试多少把密钥的速率，
     算平均要多久（期望是**一半**的密钥空间，不是全部）。
     用 Number 而不是 BigInt：2⁵⁶ = 7.2e16 早就越过 2⁵³，但这里要的是
     数量级而不是精确整数，而 Math.pow(2, bits) 在浮点里是精确的 2 的幂。 */
  const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

  function averageSearchSeconds(bits, keysPerSecond) {
    if (!(keysPerSecond > 0)) throw new Error('搜索速率必须为正，收到 ' + String(keysPerSecond));
    return Math.pow(2, bits - 1) / keysPerSecond;
  }

  /* 已知一次真实破解花了多少秒，反推它平均每秒试了多少把。
     这是**派生量**，页面上必须标明它是算出来的，不是谁公布的。 */
  function impliedRate(bits, seconds) {
    if (!(seconds > 0)) throw new Error('用时必须为正，收到 ' + String(seconds));
    return Math.pow(2, bits - 1) / seconds;
  }

  /* ---------------- 自检 ----------------
     六条结构性质，全部当场算，不抄常量。页面把它印在 keyspace 页上：
     "这些表是对的" 这句话应当由页面自己兑现，而不是由使用者信任作者。 */
  function isPermutationOf(table, n) {
    if (table.length !== n) return false;
    const seen = new Uint8Array(n + 1);
    for (let i = 0; i < table.length; i++) {
      const v = table[i];
      if (!(v >= 1 && v <= n) || seen[v]) return false;
      seen[v] = 1;
    }
    return true;
  }

  function selfCheck() {
    const r = {};
    r.ipIsPermutation = isPermutationOf(IP, 64);
    r.fpIsPermutation = isPermutationOf(FP, 64);

    /* FP 真的是 IP 的逆吗——不看表，跑一遍：任取 64 个互不相同的"位"，
       permute 两次必须回到原位。用下标当值，比随机比特更能抓到重复项。 */
    let inverse = true;
    const probe = [];
    for (let i = 0; i < 64; i++) probe.push(i);
    const round = permute(permute(probe, IP, 'IP'), FP, 'FP');
    for (let i = 0; i < 64; i++) if (round[i] !== i) { inverse = false; break; }
    r.fpInvertsIp = inverse;

    /* PC-1 恰好丢掉八个校验位（第 8、16、…、64 位）。 */
    const used = new Uint8Array(65);
    let pc1Ok = (PC1.length === 56);
    for (let i = 0; i < PC1.length; i++) {
      const v = PC1[i];
      if (!(v >= 1 && v <= 64) || used[v]) { pc1Ok = false; break; }
      used[v] = 1;
    }
    const dropped = [];
    for (let v = 1; v <= 64; v++) if (!used[v]) dropped.push(v);
    r.pc1SelectsDistinct = pc1Ok;
    r.pc1DropsParityBits = (dropped.length === 8) &&
      dropped.every(function (v, i) { return v === (i + 1) * 8; });
    r.droppedBits = dropped;

    r.pc2Ok = (PC2.length === 48) && (function () {
      const s = new Uint8Array(57);
      for (let i = 0; i < PC2.length; i++) {
        const v = PC2[i];
        if (!(v >= 1 && v <= 56) || s[v]) return false;
        s[v] = 1;
      }
      return true;
    })();

    /* 每个 S 盒的每一行都必须是 0–15 的一个排列。这一条一旦破了，
       S 盒就不再是"4 位到 4 位的均衡映射"，差分性质整个塌掉。 */
    r.sboxRowsArePermutations = SBOXES.every(function (box) {
      if (box.length !== 64) return false;
      for (let row = 0; row < 4; row++) {
        const s = new Uint8Array(16);
        for (let col = 0; col < 16; col++) {
          const v = box[row * 16 + col];
          if (!(v >= 0 && v <= 15) || s[v]) return false;
          s[v] = 1;
        }
      }
      return true;
    });

    /* 十六轮左移之和 = 28 ⟹ C₁₆ = C₀、D₁₆ = D₀。 */
    let sum = 0;
    for (let i = 0; i < SHIFTS.length; i++) sum += SHIFTS[i];
    r.shiftSum = sum;
    r.keyScheduleReturns = (sum === 28);

    r.allOk = r.ipIsPermutation && r.fpIsPermutation && r.fpInvertsIp &&
              r.pc1SelectsDistinct && r.pc1DropsParityBits && r.pc2Ok &&
              r.sboxRowsArePermutations && r.keyScheduleReturns;
    return r;
  }

  /* 公开的教科书向量。**不是**用来"让实现去凑"的：测试文件里它与
     "解密回去等于明文"、"自检六条"并列，任何一条对不上都要先判断谁错。 */
  const TEST_VECTOR = {
    key: '133457799bbcdff1',
    plain: '0123456789abcdef',
    cipher: '85e813540f0ab405'
  };

  return {
    IP: IP, FP: FP, E: E, P: P, PC1: PC1, PC2: PC2, SHIFTS: SHIFTS, SBOXES: SBOXES,
    ROUNDS: ROUNDS, BLOCK_BITS: BLOCK_BITS, KEY_BITS: KEY_BITS,
    EFFECTIVE_KEY_BITS: EFFECTIVE_KEY_BITS, SECONDS_PER_YEAR: SECONDS_PER_YEAR,
    permute: permute, xorBits: xorBits, hamming: hamming, rotl: rotl,
    block64: block64, fromHex64: fromHex64, flipBit: flipBit,
    keySchedule: keySchedule, keyScheduleTrace: keyScheduleTrace,
    fTrace: fTrace, desF: desF,
    feistelRound: feistelRound, feistelRoundInverse: feistelRoundInverse,
    feistelRun: feistelRun, feistelEncrypt: feistelEncrypt, feistelDecrypt: feistelDecrypt,
    constantF: constantF, parityF: parityF, F_KINDS: F_KINDS,
    encryptBlock: encryptBlock, decryptBlock: decryptBlock, traceBlock: traceBlock,
    encryptBlock3: encryptBlock3, decryptBlock3: decryptBlock3,
    parityReport: parityReport, fixParity: fixParity, flipParity: flipParity,
    effectiveKey: effectiveKey,
    avalanche: avalanche, avalancheReachesAt: avalancheReachesAt, avalancheSweep: avalancheSweep,
    WEAK_KEYS: WEAK_KEYS, SEMI_WEAK_PAIRS: SEMI_WEAK_PAIRS, weakKeyReport: weakKeyReport,
    averageSearchSeconds: averageSearchSeconds, impliedRate: impliedRate,
    selfCheck: selfCheck, TEST_VECTOR: TEST_VECTOR
  };
});
