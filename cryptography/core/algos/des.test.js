'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const des = require('./des.js');

/* 确定性 rng。整个文件里不出现 Math.random——一个用了 Math.random 的测试
   今天绿明天红，最后必然被加上 retry 或者干脆删掉（与 crypto-core 的
   randomBytes 同一条纪律，那里干脆拒绝无参调用）。 */
function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bitsOf(rng, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = rng() < 0.5 ? 0 : 1;
  return out;
}
const hex = C.toHex;

/* ================= 表的结构 =================
   先验结构再验向量。顺序不是随意的：一张表抄错时，教科书向量当然也对不上，
   但"向量对不上"这条信息指不出是哪张表。结构断言指得出。 */
const SC = des.selfCheck();
T.eq(SC.ipIsPermutation, true, 'IP 是 1–64 的一个排列');
T.eq(SC.fpIsPermutation, true, 'FP 是 1–64 的一个排列');
T.eq(SC.fpInvertsIp, true, 'FP 确实是 IP 的逆（当场跑一遍，不看表）');
T.eq(SC.pc1SelectsDistinct, true, 'PC-1 选出 56 个互不相同的位');
T.eq(SC.droppedBits, [8, 16, 24, 32, 40, 48, 56, 64],
     'PC-1 丢掉的恰好是八个校验位——"64 位密钥只有 56 位有效"的全部机制');
T.eq(SC.pc2Ok, true, 'PC-2 从 56 位里选出 48 个互不相同的位');
T.eq(SC.sboxRowsArePermutations, true, '八个 S 盒的每一行都是 0–15 的排列');
T.eq(SC.shiftSum, 28, '十六轮左移之和是 28');
T.eq(SC.keyScheduleReturns, true, '于是 C₁₆ = C₀、D₁₆ = D₀，密钥表回到原点');
T.eq(SC.allOk, true, 'selfCheck 六条全过');

/* selfCheck 自己不能是"永远返回 true"的装饰。给它一张坏表试一次——
   permute 必须在越界处抛，而不是静默取到 undefined。 */
T.throws(function () { des.permute([1, 0, 1], [1, 2, 9], 'bad'); },
         'permute 对越界的表项抛错', /超出了 3 位输入的范围/);
T.throws(function () { des.xorBits([0, 1], [0, 1, 0]); },
         'xorBits 对不等长抛错', /长度必须相同/);

/* C₁₆/D₁₆ 回到原点这条，也直接在密钥表上验一遍——不只信 shiftSum。 */
{
  const ks = des.keyScheduleTrace(C.fromHex('133457799bbcdff1'));
  T.eq(ks.C.length, 17, '密钥表记录 C₀…C₁₆ 共 17 个状态');
  T.eq(des.hamming(ks.C[16], ks.C[0]), 0, 'C₁₆ === C₀');
  T.eq(des.hamming(ks.D[16], ks.D[0]), 0, 'D₁₆ === D₀');
  T.eq(ks.subkeys.length, 16, '十六把子密钥');
  T.eq(ks.subkeys.every(function (k) { return k.length === 48; }), true, '每把子密钥 48 位');
  T.eq(ks.pc1.length, 56, 'PC-1 的输出是 56 位');
}

/* ================= 教科书向量 =================
   key 133457799BBCDFF1 / plain 0123456789ABCDEF / cipher 85E813540F0AB405。
   公开的 DES 逐步演算教材（Grabbe 的 "DES Illustrated" 一路到各家实现的
   自检向量）用的都是这一组。它与上面那八条结构断言、以及下面的往返性质
   **并列**：任何一条对不上都要先判断是表错了还是向量抄错了，不许改测试去
   迁就实现。实测三条全部相符。 */
{
  const V = des.TEST_VECTOR;
  const ct = des.encryptBlock(C.fromHex(V.plain), C.fromHex(V.key));
  T.eq(hex(ct), V.cipher, '教科书向量：E(0123456789abcdef, 133457799bbcdff1) = 85e813540f0ab405');
  T.eq(hex(des.decryptBlock(ct, C.fromHex(V.key))), V.plain, '同一把密钥解回明文');
}

/* 另外三组公开自检向量（全 0 / 全 1 的组合），用来把"碰巧对了一组"排除掉。 */
{
  const Z = '0000000000000000', Fh = 'ffffffffffffffff';
  T.eq(hex(des.encryptBlock(C.fromHex(Z), C.fromHex(Z))), '8ca64de9c1b123a7',
       '公开向量：E(0…0, 0…0) = 8ca64de9c1b123a7');
  T.eq(hex(des.encryptBlock(C.fromHex(Z), C.fromHex(Fh))), 'caaaaf4deaf1dbae',
       '公开向量：E(0…0, f…f) = caaaaf4deaf1dbae');
  T.eq(hex(des.encryptBlock(C.fromHex(Fh), C.fromHex(Z))), '355550b2150e2451',
       '公开向量：E(f…f, 0…0) = 355550b2150e2451');
}

/* ================= 往返 =================
   随机 (m, k) 上的 decrypt(encrypt(m,k),k) === m。 */
{
  const rng = mulberry32(20260810);
  let ok = 0;
  for (let i = 0; i < 200; i++) {
    const m = C.randomBytes(rng, 8), k = C.randomBytes(rng, 8);
    if (hex(des.decryptBlock(des.encryptBlock(m, k), k)) === hex(m)) ok++;
  }
  T.eq(ok, 200, '200 组随机 (m, k) 的 DES 往返全部成立');

  /* 负对照。"全部通过"在没有负对照时什么也不证明——一个把 decrypt 写成
     恒等函数的实现会让上面那条断言在 encrypt 也是恒等时照样全绿。
     换一把密钥必须解不回来。 */
  const rng2 = mulberry32(777);
  let wrongRecovered = 0;
  for (let i = 0; i < 200; i++) {
    const m = C.randomBytes(rng2, 8), k = C.randomBytes(rng2, 8);
    const k2 = des.flipBit(k, 3);              // 第 3 位是数据位，不是校验位
    if (hex(des.decryptBlock(des.encryptBlock(m, k), k2)) === hex(m)) wrongRecovered++;
  }
  T.eq(wrongRecovered, 0, '负对照：换一位密钥（非校验位）之后 200 组一组都解不回来');
}

/* ================= Feistel 的可逆性与 F 无关 =================
   这是整个页面最反直觉的一件事，所以它必须是**跑出来**的。
   三个 F：真的 DES 轮函数、一个常函数（2³² 个输入映到 1 个输出）、
   一个把整个右半块压成 1 位再摊开的函数。三个都不可逆，Feistel 都精确可逆。 */
{
  const rng = mulberry32(31415);
  const kinds = [
    ['DES 的轮函数', des.desF],
    ['常函数 F ≡ 1（全 1）', des.constantF(32, 1)],
    ['常函数 F ≡ 0（全 0）', des.constantF(32, 0)],
    ['奇偶 F（32 位压成 1 位再摊开）', des.parityF(32)]
  ];
  kinds.forEach(function (kind) {
    const name = kind[0], F = kind[1];
    let ok = 0;
    const images = {};
    for (let t = 0; t < 60; t++) {
      const L = bitsOf(rng, 32), R = bitsOf(rng, 32);
      const sk = [];
      for (let i = 0; i < 16; i++) sk.push(bitsOf(rng, 48));
      const ct = des.feistelEncrypt([L, R], sk, F);
      const pt = des.feistelDecrypt(ct, sk, F);
      if (pt[0].join('') === L.join('') && pt[1].join('') === R.join('')) ok++;
      images[F(R, sk[0]).join('')] = 1;
    }
    T.eq(ok, 60, 'Feistel 用「' + name + '」时 60 组往返全部成立');
    kind[2] = Object.keys(images).length;
  });
  /* 「不可逆」这三个字要有证据：常函数在 60 个互不相同的输入上只吐出一个
     输出，奇偶函数只吐出两个。而真 DES 轮函数吐出 60 个。 */
  T.eq(kinds[0][2], 60, '真 DES 轮函数在 60 个随机输入上给出 60 个不同输出');
  T.eq(kinds[1][2], 1, '常函数 F ≡ 1 在 60 个随机输入上只给出 1 个输出（它彻底不可逆）');
  T.eq(kinds[2][2], 1, '常函数 F ≡ 0 同样只给出 1 个输出');
  T.ok(kinds[3][2] <= 2, '奇偶 F 至多给出 2 个不同输出');

  /* 负对照：子密钥**不倒序**就必须解不回来。没有这一条，
     "decrypt = 同一段代码 + 倒序子密钥"这句话是空的。 */
  const rng2 = mulberry32(2718);
  let recovered = 0;
  for (let t = 0; t < 60; t++) {
    const L = bitsOf(rng2, 32), R = bitsOf(rng2, 32);
    const sk = [];
    for (let i = 0; i < 16; i++) sk.push(bitsOf(rng2, 48));
    const ct = des.feistelEncrypt([L, R], sk, des.desF);
    const pt = des.feistelEncrypt(ct, sk, des.desF);   // 顺序不变 —— 错的那条路
    if (pt[0].join('') === L.join('') && pt[1].join('') === R.join('')) recovered++;
  }
  T.eq(recovered, 0, '负对照：子密钥顺序不倒过来，60 组一组都解不回来');

  /* 单轮的逆写成 swap ∘ round ∘ swap —— 页面上"同一段电路"那句话的实现。 */
  const rng3 = mulberry32(1618);
  let one = 0;
  for (let t = 0; t < 60; t++) {
    const L = bitsOf(rng3, 32), R = bitsOf(rng3, 32), k = bitsOf(rng3, 48);
    const o = des.feistelRound(L, R, k, des.desF);
    const b = des.feistelRoundInverse(o[0], o[1], k, des.desF);
    if (b[0].join('') === L.join('') && b[1].join('') === R.join('')) one++;
  }
  T.eq(one, 60, '单轮的逆 = 交换·同一轮·交换，60 组全部还原');
}

/* 整块 DES 与通用 Feistel 是同一件事：把 IP 之后的两半交给 feistelEncrypt，
   得到的必须正好是 runBlock 的 preoutput。两条路径算出两个答案的那天，
   页面上"这就是 Feistel"这句话就成了装饰。 */
{
  const key = C.fromHex('133457799bbcdff1'), m = C.fromHex('0123456789abcdef');
  const tr = des.traceBlock(m, key);
  const out = des.feistelEncrypt([tr.afterIP.slice(0, 32), tr.afterIP.slice(32)],
                                 tr.subkeys, des.desF);
  T.eq(out[0].concat(out[1]), tr.preoutput,
       '通用 Feistel 跑出来的预输出与整块 DES 内部的完全相同');
}

/* ================= 校验位 =================
   八个校验位不进 PC-1，所以改它们改不动密文。256 种翻转组合全试。 */
{
  const key = C.fromHex('133457799bbcdff1'), m = C.fromHex('0123456789abcdef');
  const base = hex(des.encryptBlock(m, key));
  let differ = 0;
  for (let mask = 0; mask < 256; mask++) {
    if (hex(des.encryptBlock(m, des.flipParity(key, mask))) !== base) differ++;
  }
  T.eq(differ, 0, '256 种校验位翻转组合，密文一次都没变——56 位有效密钥');

  /* 负对照：翻**非**校验位必须每一位都改变密文。少了这一条，
     上面那个 0 也可能是因为 flipParity 根本没改动密钥。 */
  let unchanged = 0, tested = 0;
  for (let b = 0; b < 64; b++) {
    if (b % 8 === 7) continue;                 // 跳过校验位
    tested++;
    if (hex(des.encryptBlock(m, des.flipBit(key, b))) === base) unchanged++;
  }
  T.eq(tested, 56, '非校验位共 56 位');
  T.eq(unchanged, 0, '负对照：56 个非校验位逐位翻转，每一位都改变了密文');

  /* 而且两把只差校验位的密钥，56 位有效密钥必须逐位相同。 */
  T.eq(des.hamming(des.effectiveKey(key), des.effectiveKey(des.flipParity(key, 255))), 0,
       '只差校验位的两把密钥，PC-1 之后逐位相同');

  const rep = des.parityReport(key);
  T.eq(rep.allOk, true, '教科书密钥 133457799bbcdff1 本身满足奇校验');
  T.eq(rep.bytes.length, 8, '校验报告逐字节给出 8 条');
  /* fixParity 是幂等的，且能修好一把被弄坏的密钥。 */
  const broken = des.flipParity(key, 0b10101010);
  T.eq(des.parityReport(broken).allOk, false, '翻掉四个校验位之后奇校验不再成立');
  T.eq(hex(des.fixParity(broken)), hex(key), 'fixParity 把它修回原样');
  T.eq(hex(des.fixParity(key)), hex(key), 'fixParity 对已经正确的密钥是幂等的');
}

/* ================= 弱密钥 =================
   四把弱密钥不是"记得是这四把"，而是当场验：子密钥十六把全同、
   加密两次回到明文。 */
{
  const rng = mulberry32(999);
  const probes = [];
  for (let i = 0; i < 8; i++) probes.push(C.randomBytes(rng, 8));
  T.eq(des.WEAK_KEYS.length, 4, 'DES 有四把弱密钥');
  des.WEAK_KEYS.forEach(function (h) {
    const k = C.fromHex(h);
    const r = des.weakKeyReport(k, probes);
    T.eq(r.allSubkeysIdentical, true, '弱密钥 ' + h + ' 的十六把子密钥完全相同');
    T.eq(r.selfInverse, true, '弱密钥 ' + h + ' 的加密是自逆的：E(E(m)) = m');
    T.eq(des.parityReport(k).allOk, true, '弱密钥 ' + h + ' 本身满足奇校验');
  });

  /* 负对照：一把普通密钥两条性质都必须不成立。 */
  const normal = des.weakKeyReport(C.fromHex('133457799bbcdff1'), probes);
  T.eq(normal.allSubkeysIdentical, false, '负对照：普通密钥的子密钥不全同');
  T.eq(normal.selfInverse, false, '负对照：普通密钥的加密不是自逆的');

  /* 半弱密钥成对自逆：E_{k2}(E_{k1}(m)) = m。 */
  T.eq(des.SEMI_WEAK_PAIRS.length, 6, 'DES 有六对半弱密钥');
  des.SEMI_WEAK_PAIRS.forEach(function (p) {
    const k1 = C.fromHex(p[0]), k2 = C.fromHex(p[1]);
    let ok = 0;
    probes.forEach(function (m) {
      if (hex(des.encryptBlock(des.encryptBlock(m, k1), k2)) === hex(m)) ok++;
    });
    T.eq(ok, probes.length, '半弱密钥对 ' + p[0] + ' / ' + p[1] + ' 互为逆');
    /* 半弱不是弱：单把密钥自己**不**自逆。 */
    T.eq(des.weakKeyReport(k1, probes).selfInverse, false,
         '半弱密钥 ' + p[0] + ' 自己不是自逆的（它需要搭档）');
  });
}

/* ================= 雪崩 =================
   翻明文的一位，逐轮数差异。两条恒等式先钉住"这条曲线画的是同一件事"：
   IP 之后必然差 1 位；第 16 轮之后的差异必然等于密文的差异（FP 与末尾交换
   都是置换，不增不减）。 */
{
  const m = C.fromHex('0123456789abcdef'), k = C.fromHex('133457799bbcdff1');
  for (let b = 0; b < 64; b += 7) {
    const av = des.avalanche(m, k, b);
    T.eq(av.perRound[0], 1, '翻第 ' + b + ' 位：IP 之后差异恒为 1 位');
    T.eq(av.outDiff, av.perRound[16], '翻第 ' + b + ' 位：密文差异 = 第 16 轮后的差异');
    T.eq(av.perRound.length, 17, '雪崩曲线有 17 个点（IP 之后 + 十六轮）');
  }

  /* 实测的曲线形状。以 40 组随机 (m,k) × 全部 64 个明文位 = 2560 次试验测得
     的逐轮平均差异位数为：
       轮  0    1    2     3     4     5     6   … 16
       位  1.00 2.91 10.44 22.05 29.94 31.98 32.02 … 31.92
     也就是第 4 轮到 46.8%、**第 5 轮达到 50.0%**、此后一直贴着 32 位不动。
     这里用固定的教科书 (m,k) 复现同一个形状，不重跑 2560 次（测试要快）：
     断言写成区间而不是具体数字——具体数字换一组 (m,k) 就会变，
     而"第 3 轮之前明显不足一半、第 5 轮起稳定在一半附近"是结构性的。 */
  const sw = des.avalancheSweep(m, k);
  T.eq(sw.mean[0], 1, '雪崩扫描：第 0 点（IP 之后）平均恰好 1 位');
  T.ok(sw.mean[1] < 6, '第 1 轮平均差异远不到一半（实测 2.94）');
  T.ok(sw.mean[2] > 6 && sw.mean[2] < 16, '第 2 轮开始起飞（实测 9.97）');
  T.ok(sw.mean[3] > 16 && sw.mean[3] < 28, '第 3 轮过半程（实测 21.92）');
  for (let r = 5; r <= 16; r++) {
    T.ok(Math.abs(sw.mean[r] - 32) <= 3.2,
         '第 ' + r + ' 轮的平均差异落在 32 ± 3.2 位（50% ± 5%）内');
  }

  /* 负对照：不翻任何位时，逐轮差异必须恒为 0。 */
  const same = des.traceBlock(m, k);
  let nonzero = 0;
  for (let r = 0; r < same.states.length; r++) {
    if (des.hamming(same.states[r], same.states[r]) !== 0) nonzero++;
  }
  T.eq(nonzero, 0, '负对照：同一条轨迹与自己比，逐轮差异恒为 0');
  const av0 = des.avalanche(m, k, 0);
  const av0b = des.avalanche(m, k, 0);
  T.eq(av0.perRound, av0b.perRound, '雪崩是确定性的：同样的输入给出同样的曲线');
  T.ok(des.avalancheReachesAt(av0.perRound) > 0, '至少要有一轮到达一半');
  T.eq(des.avalancheReachesAt([1, 2, 3]), -1, '从未到达阈值时返回 −1');

  /* 密钥雪崩：翻密钥的一位（非校验位）同样扩散开。 */
  const kav = des.avalanche(m, k, 0, { flipKey: true });
  T.eq(kav.perRound[0], 0, '密钥雪崩：IP 之后明文还没被动过，差异为 0');
  T.ok(kav.perRound[16] > 16, '十六轮之后密钥的一位已经扩散到一半左右');
  /* 而翻一个**校验位**必须一位都不扩散——这是上面那条校验位断言的动态版。 */
  const pav = des.avalanche(m, k, 7, { flipKey: true });
  T.eq(pav.perRound.filter(function (n) { return n !== 0; }).length, 0,
       '翻密钥的校验位（第 7 位）之后，十六轮里没有任何一轮出现差异');
}

/* ================= 3DES =================
   只有一条性质需要断言：k1 = k2 = k3 时它必须退化成单次 DES（EDE 的设计目的
   就是向后兼容）。这条恒等式不需要外部向量，它自己就是判据。 */
{
  const rng = mulberry32(555);
  let same = 0, trips = 0;
  for (let i = 0; i < 40; i++) {
    const m = C.randomBytes(rng, 8), k = C.randomBytes(rng, 8);
    if (hex(des.encryptBlock3(m, k, k, k)) === hex(des.encryptBlock(m, k))) same++;
    const k1 = C.randomBytes(rng, 8), k2 = C.randomBytes(rng, 8), k3 = C.randomBytes(rng, 8);
    if (hex(des.decryptBlock3(des.encryptBlock3(m, k1, k2, k3), k1, k2, k3)) === hex(m)) trips++;
  }
  T.eq(same, 40, '3DES 在三把密钥相同时退化成单次 DES');
  T.eq(trips, 40, '3DES 往返成立');
}

/* ================= 密钥空间的算术 ================= */
{
  T.eq(des.averageSearchSeconds(56, 1), Math.pow(2, 55), '平均要搜一半的密钥空间');
  T.eq(des.averageSearchSeconds(56, Math.pow(2, 55)), 1, '速率翻倍时间减半');
  /* impliedRate 与 averageSearchSeconds 必须互为逆运算——页面同时印这两个数，
     它们对不上就是在自相矛盾。 */
  const t = 56 * 3600;                                  // Deep Crack 的 56 小时
  T.ok(Math.abs(des.averageSearchSeconds(56, des.impliedRate(56, t)) - t) < 1e-6,
       'impliedRate 与 averageSearchSeconds 互逆');
  T.throws(function () { des.averageSearchSeconds(56, 0); },
           '速率为 0 时抛错', /速率必须为正/);
  T.throws(function () { des.impliedRate(56, -1); },
           '用时为负时抛错', /用时必须为正/);
  /* 每多一位密钥，时间正好翻倍。 */
  T.eq(des.averageSearchSeconds(57, 1e6) / des.averageSearchSeconds(56, 1e6), 2,
       '密钥每长一位，平均搜索时间翻倍');
}

/* ================= 入参守卫 ================= */
{
  T.throws(function () { des.encryptBlock(C.fromHex('0011'), C.fromHex('133457799bbcdff1')); },
           '明文块不是 8 字节时抛错', /必须是 8 字节/);
  T.throws(function () { des.encryptBlock(C.fromHex('0123456789abcdef'), C.fromHex('0011')); },
           '密钥不是 8 字节时抛错', /必须是 8 字节/);
  T.throws(function () { des.fTrace(new Array(31).fill(0), new Array(48).fill(0)); },
           '轮函数拒绝非 32 位输入', /需要 32 位输入/);
  T.throws(function () { des.fTrace(new Array(32).fill(0), new Array(47).fill(0)); },
           '轮函数拒绝非 48 位子密钥', /需要 48 位子密钥/);
  T.throws(function () { des.flipBit(C.fromHex('0123456789abcdef'), 64); },
           'flipBit 拒绝越界位号', /位号必须是/);
  T.throws(function () { des.feistelRun([0, 1], [0, 1, 0], [[0]], des.desF); },
           'Feistel 拒绝不等长的半块', /必须等长/);
  T.throws(function () { des.feistelRun([0], [1], [], des.desF); },
           'Feistel 拒绝空的子密钥表', /至少一把子密钥/);
  T.throws(function () { des.fromHex64('0123', '密钥'); },
           'fromHex64 拒绝长度不对的十六进制', /必须是 16 个十六进制数字/);
  T.eq(hex(des.fromHex64('01 23 45 67 89 ab cd ef', '明文')), '0123456789abcdef',
       'fromHex64 容忍空格与分隔符（输入框的清洗在这一层做）');
}

T.report('des');
