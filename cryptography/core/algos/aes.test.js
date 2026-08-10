'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const aes = require('./aes.js');

/* 随机源一律注入，模块与测试都不碰 Math.random——一个用了 Math.random 的
   测试今天绿明天红，最后必然被加上 retry 或者干脆删掉。 */
function lcg(seed) {
  let s = seed >>> 0;
  /* 取高位（除以 2³²）而不是低位取模：LCG 的低位周期极短。 */
  return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const hex = C.toHex;
const un = C.fromHex;

/* ================= GF(2⁸) ================= */
T.eq(aes.GF_POLY, 0x11b, '约化多项式是 x⁸+x⁴+x³+x+1');
T.eq(aes.xtime(0x57), 0xae, 'xtime(57) = ae');
T.eq(aes.xtime(0xae), 0x47, 'xtime(ae) = 47（越过 0x80，异或 0x1b）');
T.eq(aes.gmul(0x57, 0x83), 0xc1, 'FIPS-197 §4.2 的例子：57 · 83 = c1');
T.eq(aes.gmul(0x57, 0x13), 0xfe, 'FIPS-197 §4.2.1 的例子：57 · 13 = fe');
T.eq(aes.gmul(0, 0xff), 0, '0 乘任何数是 0');
T.eq(aes.gmul(1, 0xa5), 0xa5, '1 是乘法单位元');

/* 乘法交换律与分配律——两条性质挡住"乘法写反了一半"这类错误，
   而单看几个教科书向量是挡不住的（它们都是对称的）。 */
(function () {
  let bad = 0;
  for (let a = 0; a < 256; a++) {
    for (let b = 0; b < 256; b++) if (aes.gmul(a, b) !== aes.gmul(b, a)) bad++;
  }
  T.eq(bad, 0, '65536 对乘法全部满足交换律');
})();
(function () {
  const rnd = lcg(11);
  let bad = 0;
  for (let i = 0; i < 3000; i++) {
    const a = Math.floor(rnd() * 256), b = Math.floor(rnd() * 256), c = Math.floor(rnd() * 256);
    if (aes.gmul(a, b ^ c) !== (aes.gmul(a, b) ^ aes.gmul(a, c))) bad++;
  }
  T.eq(bad, 0, '3000 组随机三元组满足分配律 a·(b⊕c) = a·b ⊕ a·c');
})();

/* 逆元：255 个非零元素每一个都满足 a · a⁻¹ = 1，且 0 映射到 0。 */
(function () {
  let bad = 0;
  for (let a = 1; a < 256; a++) if (aes.gmul(a, aes.gInv(a)) !== 1) bad++;
  T.eq(bad, 0, '255 个非零元素的乘法逆元全部正确');
  T.eq(aes.gInv(0), 0, '0 没有逆元，AES 约定映射到 0');
  T.eq(aes.gInv(1), 1, '1 的逆是自己');
})();

/* ================= S 盒 =================
   S 盒是**算出来的**（求逆 + 仿射变换），不是抄的表——所以这些断言在验的是
   那两步真的写对了，而不是"抄写没抄错"。 */
T.eq(aes.SBOX[0x00], 0x63, 'S(00) = 63（0 的像就是仿射常数本身）');
T.eq(aes.SBOX[0x01], 0x7c, 'S(01) = 7c');
T.eq(aes.SBOX[0x53], 0xed, 'FIPS-197 §5.1.1 的例子：S(53) = ed');
T.eq(aes.SBOX[0x7f], 0xd2, 'S(7f) = d2');
T.eq(aes.SBOX[0xff], 0x16, 'S(ff) = 16');
T.eq(hex(aes.SBOX.slice(0, 16)), '637c777bf26b6fc53001672bfed7ab76',
     'S 盒第一行与 FIPS-197 表 4 逐字节相同');
T.eq(hex(aes.SBOX.slice(240, 256)), '8ca1890dbfe6426841992d0fb054bb16',
     'S 盒最后一行与 FIPS-197 表 4 逐字节相同');

(function () {
  const seen = new Uint8Array(256);
  for (let a = 0; a < 256; a++) seen[aes.SBOX[a]]++;
  let bad = 0;
  for (let a = 0; a < 256; a++) if (seen[a] !== 1) bad++;
  T.eq(bad, 0, 'S 盒是 256 个值的置换（每个像恰好出现一次）');
  let rt = 0;
  for (let a = 0; a < 256; a++) if (aes.INV_SBOX[aes.SBOX[a]] !== a) rt++;
  T.eq(rt, 0, '逆 S 盒是 S 盒的逆');
})();

/* S 盒**没有不动点**、也没有反不动点（S(a) ≠ a 且 S(a) ≠ ~a）。
   这是 Rijndael 选那个仿射常数 0x63 的理由之一，算错常数时这条会先红。 */
(function () {
  let fix = 0, anti = 0;
  for (let a = 0; a < 256; a++) {
    if (aes.SBOX[a] === a) fix++;
    if (aes.SBOX[a] === (a ^ 0xff)) anti++;
  }
  T.eq(fix, 0, 'S 盒没有不动点');
  T.eq(anti, 0, 'S 盒没有反不动点');
})();

/* ================= 密钥扩展 =================
   FIPS-197 附录 A.1 的逐字展开，用它的密钥。 */
(function () {
  const ks = aes.keyExpansion(un('2b7e151628aed2a6abf7158809cf4f3c'));
  T.eq(ks.length, 11, 'AES-128 扩展出 11 把轮密钥');
  T.eq(hex(ks[0]), '2b7e151628aed2a6abf7158809cf4f3c', '第 0 把就是密钥本身');
  T.eq(hex(ks[1]), 'a0fafe1788542cb123a339392a6c7605', '附录 A.1：w[4..7]');
  T.eq(hex(ks[2]), 'f2c295f27a96b9435935807a7359f67f', '附录 A.1：w[8..11]');
  T.eq(hex(ks[9]), 'ac7766f319fadc2128d12941575c006e', '附录 A.1：w[36..39]');
  T.eq(hex(ks[10]), 'd014f9a8c9ee2589e13f0cc8b6630ca6', '附录 A.1：w[40..43]');
  let bad = 0;
  ks.forEach(function (k) { if (k.length !== 16) bad++; });
  T.eq(bad, 0, '每把轮密钥都是 16 字节');
})();
T.eq(hex(aes.keyExpansion(un('000102030405060708090a0b0c0d0e0f'))[1]),
     'd6aa74fdd2af72fadaa678f1d6ab76fe', '附录 C.1 的 round[1].k_sch');

/* ================= 四个步骤 ================= */
/* ShiftRows：第 r 行左移 r 格。用一个每格都不同的状态，位置写反会当场露馅。
   状态是列主序的 16 字节，所以 00…0f 摆成矩阵是
     00 04 08 0c
     01 05 09 0d
     02 06 0a 0e
     03 07 0b 0f
   左移之后第 1 行变成 05 09 0d 01、第 2 行 0a 0e 02 06、第 3 行 0f 03 07 0b。 */
T.eq(hex(aes.shiftRows(un('000102030405060708090a0b0c0d0e0f'))),
     '00050a0f04090e03080d02070c01060b', 'ShiftRows 把第 r 行左移 r 格');
T.eq(hex(aes.invShiftRows(aes.shiftRows(un('000102030405060708090a0b0c0d0e0f')))),
     '000102030405060708090a0b0c0d0e0f', 'invShiftRows 抵消 ShiftRows');
T.eq(aes.SHIFT_OFFSETS, [0, 1, 2, 3], '位移量按行号递增');
/* 第 0 行不动——这一条要单独钉：把偏移写成 r+1 时上面那条向量会红，
   但把"第 0 行也移一格"写成一个恰好对称的错误时未必。 */
(function () {
  const s = un('aa00000000000000000000000000bb00');
  const o = aes.shiftRows(s);
  T.eq(o[0], 0xaa, '第 0 行第 0 列原地不动');
})();

/* MixColumns：教科书的六组列向量。'01010101' 与 'c6c6c6c6' 是不动点，
   它们能抓住"矩阵每行系数和写成 1 了"这类错误。 */
(function () {
  function oneCol(h) {
    const b = un(h), s = new Uint8Array(16);
    for (let i = 0; i < 4; i++) s[i] = b[i];
    return hex(aes.mixColumns(s)).slice(0, 8);
  }
  T.eq(oneCol('db135345'), '8e4da1bc', 'MixColumns：db135345 → 8e4da1bc');
  T.eq(oneCol('f20a225c'), '9fdc589d', 'MixColumns：f20a225c → 9fdc589d');
  T.eq(oneCol('01010101'), '01010101', 'MixColumns：全 01 是不动点');
  T.eq(oneCol('c6c6c6c6'), 'c6c6c6c6', 'MixColumns：全 c6 是不动点');
  T.eq(oneCol('d4d4d4d5'), 'd5d5d7d6', 'MixColumns：d4d4d4d5 → d5d5d7d6');
  T.eq(oneCol('2d26314c'), '4d7ebdf8', 'MixColumns：2d26314c → 4d7ebdf8');
})();
(function () {
  const rnd = lcg(23);
  let bad = 0;
  for (let i = 0; i < 400; i++) {
    const s = C.randomBytes(rnd, 16);
    if (hex(aes.invMixColumns(aes.mixColumns(s))) !== hex(s)) bad++;
  }
  T.eq(bad, 0, '400 个随机状态上 invMixColumns 抵消 MixColumns');
})();

/* AddRoundKey 就是异或，长度不等必须抛（借的是 crypto-core 的 xorBytes）。 */
T.eq(hex(aes.addRoundKey(un('00112233445566778899aabbccddeeff'),
                         un('000102030405060708090a0b0c0d0e0f'))),
     '00102030405060708090a0b0c0d0e0f0', 'AddRoundKey 是逐字节异或');
T.throws(function () { aes.addRoundKey(un('0011'), un('000102030405060708090a0b0c0d0e0f')); },
         '状态不是 16 字节时抛', /必须是 16 字节/);

/* 步骤函数一律不改入参——工具页要同时画出一步的前后两态。 */
(function () {
  const src = un('00112233445566778899aabbccddeeff');
  const keep = hex(src);
  aes.subBytes(src); aes.shiftRows(src); aes.mixColumns(src);
  aes.addRoundKey(src, un('000102030405060708090a0b0c0d0e0f'));
  T.eq(hex(src), keep, '四个步骤都不改动入参');
})();

/* ================= FIPS-197 全向量 ================= */
(function () {
  const key = un('000102030405060708090a0b0c0d0e0f');
  const pt = un('00112233445566778899aabbccddeeff');
  T.eq(hex(aes.encryptBlock(pt, key)), '69c4e0d86a7b0430d8cdb78070b4c55a',
       'FIPS-197 附录 C.1：AES-128 的教科书向量');
  T.eq(hex(aes.decryptBlock(un('69c4e0d86a7b0430d8cdb78070b4c55a'), key)),
       '00112233445566778899aabbccddeeff', 'C.1 的解密方向');

  /* 中间量也钉住，不只是终点。终点对了而中间错了的组合是存在的（两处错误
     互相抵消），而工具页画的正是中间量——画错了就没有任何断言看得见。 */
  const fr = aes.trace(pt, key);
  function at(round, step) {
    const f = fr.filter(function (x) { return x.round === round && x.step === step; })[0];
    return hex(f.state);
  }
  T.eq(at(0, 'ark'), '00102030405060708090a0b0c0d0e0f0', 'C.1 round[1].start');
  T.eq(at(1, 'sub'), '63cab7040953d051cd60e0e7ba70e18c', 'C.1 round[1].s_box');
  T.eq(at(1, 'shift'), '6353e08c0960e104cd70b751bacad0e7', 'C.1 round[1].s_row');
  T.eq(at(1, 'mix'), '5f72641557f5bc92f7be3b291db9f91a', 'C.1 round[1].m_col');
  T.eq(at(1, 'ark'), '89d810e8855ace682d1843d8cb128fe4', 'C.1 round[2].start');
  T.eq(at(10, 'ark'), '69c4e0d86a7b0430d8cdb78070b4c55a', 'C.1 round[10].output');
})();

T.eq(hex(aes.encryptBlock(un('3243f6a8885a308d313198a2e0370734'),
                          un('2b7e151628aed2a6abf7158809cf4f3c'))),
     '3925841d02dc09fbdc118597196a0b32', 'FIPS-197 附录 B 的向量');
T.eq(hex(aes.encryptBlock(un('00000000000000000000000000000000'),
                          un('00000000000000000000000000000000'))),
     '66e94bd4ef8a2c3b884cfa59ca342b2e', '全零密钥、全零明文的公开向量');

/* 随机往返。教科书向量只钉住一条路径，往返钉住的是"加密与解密互为逆"。 */
(function () {
  const rnd = lcg(20260810);
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    const key = C.randomBytes(rnd, 16), pt = C.randomBytes(rnd, 16);
    if (hex(aes.decryptBlock(aes.encryptBlock(pt, key), key)) !== hex(pt)) bad++;
  }
  T.eq(bad, 0, '300 组随机密钥 / 明文往返成立');
})();

/* 长度：AES-128 不做任何填充或截断。 */
T.throws(function () { aes.encryptBlock(un('0011223344556677'), un('000102030405060708090a0b0c0d0e0f')); },
         '8 字节的明文分组抛', /必须是 16 字节/);
T.throws(function () { aes.keyExpansion(un('00010203')); }, '4 字节的密钥抛', /必须是 16 字节/);
T.throws(function () { aes.keyExpansion('000102030405060708090a0b0c0d0e0f'); },
         '字符串不是字节数组', /Uint8Array/);
T.throws(function () { aes.flipBit(un('000102030405060708090a0b0c0d0e0f'), 128); },
         '第 128 位不存在（0–127）', /0–127/);
T.throws(function () { aes.applyStep('mixrows', un('000102030405060708090a0b0c0d0e0f')); },
         '未知步骤名抛', /未知的步骤/);

/* ================= 轨迹 ================= */
(function () {
  const key = un('000102030405060708090a0b0c0d0e0f');
  const pt = un('00112233445566778899aabbccddeeff');
  const fr = aes.trace(pt, key);
  T.eq(fr.length, 42, '轨迹是 1 帧输入 + 1 帧初始 AddRoundKey + 10 轮 × 4 步 = 42 帧');
  T.eq(fr[0].step, 'in', '第 0 帧是输入');
  T.eq(hex(fr[0].state), hex(pt), '第 0 帧的状态就是明文');
  const mix10 = fr.filter(function (f) { return f.round === 10 && f.step === 'mix'; })[0];
  T.eq(mix10.absent, true, '第 10 轮的 MixColumns 标为 absent（规范如此，不是被关掉）');
  T.eq(mix10.skipped, false, 'absent 与 skipped 是两件事，不许混为一谈');
  const off = aes.trace(pt, key, { steps: { mix: false } });
  T.eq(off.length, 42, '关掉一步之后帧数不变——那一帧还在，只是什么也没做');
  const m1 = off.filter(function (f) { return f.round === 1 && f.step === 'mix'; })[0];
  T.eq(m1.skipped, true, '被关掉的步骤标 skipped');
  const s1 = off.filter(function (f) { return f.round === 1 && f.step === 'shift'; })[0];
  T.eq(hex(m1.state), hex(s1.state), '被关掉的步骤把状态原样传下去');
})();

/* ================= ablation ① ShiftRows =================
   **这一页的中心论点：关掉 ShiftRows，AES 散成四路互不相干的 32 位密码。**
   MixColumns 只在列内混合，AddRoundKey 与 SubBytes 都是逐字节的，于是没有
   任何字节能影响到别的列。密钥扩展照常跑（ablation 不碰它），所以四路各自
   仍然用着自己那一列的轮密钥。

   断言写成"逐字节相同"，不是"差别很小"。 */
(function () {
  const key = un('000102030405060708090a0b0c0d0e0f');
  const pt = un('00112233445566778899aabbccddeeff');
  const off = { steps: { shift: false } };

  /* 翻遍 0 号列的全部 32 个比特，看**每一个轮次**上其余三列的字节差。 */
  let leak = 0, ownMax = 0;
  for (let b = 0; b < 32; b++) {
    const sp = aes.columnSpread(pt, key, b, off);
    T.eq(sp.length, 11, '列差表覆盖 11 个轮次（含初始 AddRoundKey 之后）');
    for (let r = 0; r < sp.length; r++) {
      if (sp[r][1] || sp[r][2] || sp[r][3]) leak++;
      if (sp[r][0] > ownMax) ownMax = sp[r][0];
    }
  }
  T.eq(leak, 0, '关掉 ShiftRows：0 号列翻任何一位，1–3 号列在所有 11 个轮次上一个字节都不变');
  T.eq(ownMax, 4, '同时 0 号列自己确实被搅动了（最多 4 个字节，即整列）');

  /* ⚠ 负对照一：同一支探针，ShiftRows **开着**时必须看得见泄漏。
     没有这一条，上面那个 0 只证明探针没在读它以为在读的东西。 */
  let seen = 0;
  for (let b = 0; b < 32; b++) {
    const sp = aes.columnSpread(pt, key, b, {});
    for (let r = 0; r < sp.length; r++) if (sp[r][1] || sp[r][2] || sp[r][3]) seen++;
  }
  T.ok(seen > 0, '负对照：ShiftRows 开着时同一支探针看得见跨列扩散');
  (function () {
    let bad = 0;
    for (let b = 0; b < 32; b++) {
      const d = aes.columnDiff(aes.encryptBlock(pt, key),
                               aes.encryptBlock(aes.flipBit(pt, b), key));
      if (!(d[0] && d[1] && d[2] && d[3])) bad++;
    }
    T.eq(bad, 0, '负对照：完整 AES 下，0 号列翻任何一位都会改动全部四列');
  })();

  /* 负对照二：关掉 ShiftRows 时翻别的列，动的必须是**那一列**。
     只测 0 号列的话，一支恒返回 [x,0,0,0] 的坏探针也能全绿。 */
  for (let c = 1; c < 4; c++) {
    const d = aes.columnDiff(aes.encryptBlock(pt, key, off),
                             aes.encryptBlock(aes.flipBit(pt, c * 32 + 3), key, off));
    const moved = d.map(function (v) { return v > 0 ? 1 : 0; });
    const want = [0, 0, 0, 0];
    want[c] = 1;
    T.eq(moved, want, '负对照：关掉 ShiftRows 时翻第 ' + c + ' 列，动的正好是第 ' + c + ' 列');
  }

  /* 负对照三：探针对"没有差别"与"有差别"必须给出不同的读数。 */
  const rs = aes.roundStates(pt, key, off);
  T.eq(aes.columnDiff(rs[10], rs[10]), [0, 0, 0, 0], '负对照：同一份状态自比是全零');
  T.ok(aes.columnDiff(rs[10], rs[9]).some(function (v) { return v > 0; }),
       '负对照：不同状态相比读得出非零');

  /* 四路独立的正面说法：把 0 号列换成别的内容，其余三列的密文一字不改。 */
  const alt = new Uint8Array(pt);
  alt[0] ^= 0xff; alt[1] ^= 0x5a; alt[2] ^= 0x0f; alt[3] ^= 0xa5;
  T.eq(hex(aes.encryptBlock(pt, key, off)).slice(8),
       hex(aes.encryptBlock(alt, key, off)).slice(8),
       '关掉 ShiftRows：整列换掉，后三列的密文逐字节相同 —— 这就是"四个独立的 32 位密码"');
  T.ok(hex(aes.encryptBlock(pt, key, off)).slice(0, 8) !==
       hex(aes.encryptBlock(alt, key, off)).slice(0, 8),
       '负对照：被换掉的那一列自己是变了的');
})();

/* ================= ablation ② MixColumns / AddRoundKey ================= */
(function () {
  const key = un('000102030405060708090a0b0c0d0e0f');
  const k2 = un('ffeeddccbbaa99887766554433221100');
  const pt = un('00112233445566778899aabbccddeeff');

  /* 关掉 MixColumns：剩下的全是逐字节映射与一次置换，于是每个输出字节
     只依赖一个输入字节——翻一位，**恰好一个**字节变。 */
  let bad = 0;
  for (let b = 0; b < 128; b++) {
    const n = aes.byteDiff(aes.encryptBlock(pt, key, { steps: { mix: false } }),
                           aes.encryptBlock(aes.flipBit(pt, b), key, { steps: { mix: false } }));
    if (n !== 1) bad++;
  }
  T.eq(bad, 0, '关掉 MixColumns：翻任何一位，密文恰好一个字节变（没有任何扩散）');

  /* 关掉 AddRoundKey：密钥再也进不来，密文与密钥无关。 */
  T.eq(hex(aes.encryptBlock(pt, key, { steps: { ark: false } })),
       hex(aes.encryptBlock(pt, k2, { steps: { ark: false } })),
       '关掉 AddRoundKey：换一把完全不同的密钥，密文一字不变');
  T.ok(hex(aes.encryptBlock(pt, key)) !== hex(aes.encryptBlock(pt, k2)),
       '负对照：完整 AES 下换密钥当然会改密文');

  /* 关掉 SubBytes：整条密码退化成 GF(2) 上的仿射映射，
     于是 E(a) ⊕ E(b) ⊕ E(c) ⊕ E(a⊕b⊕c) 恒为零。 */
  const rnd = lcg(7);
  const off = { steps: { sub: false } };
  let vio = 0, vioFull = 0;
  for (let i = 0; i < 200; i++) {
    const x = C.randomBytes(rnd, 16), y = C.randomBytes(rnd, 16), z = C.randomBytes(rnd, 16);
    const w = C.xorBytes(C.xorBytes(x, y), z);
    const s = C.xorBytes(C.xorBytes(aes.encryptBlock(x, key, off), aes.encryptBlock(y, key, off)),
                         C.xorBytes(aes.encryptBlock(z, key, off), aes.encryptBlock(w, key, off)));
    if (!aes.isZero(s)) vio++;
    const f = C.xorBytes(C.xorBytes(aes.encryptBlock(x, key), aes.encryptBlock(y, key)),
                         C.xorBytes(aes.encryptBlock(z, key), aes.encryptBlock(w, key)));
    if (!aes.isZero(f)) vioFull++;
  }
  T.eq(vio, 0, '关掉 SubBytes：整条密码是仿射的，200 组四元组的异或和全为零');
  T.eq(vioFull, 200, '负对照：完整 AES 下同样的 200 组一次都不为零');
})();

/* ================= 线性性：只有 SubBytes 是非线性的 =================
   测的是 f(a ⊕ b) 与 f(a) ⊕ f(b) 的差（linearityDefect 返回这个差本身）：
     · ShiftRows / MixColumns —— 差恒为零，它们是 GF(2) 上的线性映射；
     · AddRoundKey（固定轮密钥 k）—— 差恒等于 **k 自己**。它是仿射不是线性：
       f(x) = x ⊕ k 时 f(a⊕b) ⊕ f(a) ⊕ f(b) = k。等价的说法是"它在差分上是
       恒等映射"，这正是差分分析里密钥加被无视的原因。
     · SubBytes —— 差不为零，且没有规律。 */
(function () {
  const rk = un('d6aa74fdd2af72fadaa678f1d6ab76fe');
  const rnd = lcg(31);
  let shiftBad = 0, mixBad = 0, arkBad = 0, subLinear = 0;
  for (let i = 0; i < 1000; i++) {
    const a = C.randomBytes(rnd, 16), b = C.randomBytes(rnd, 16);
    if (!aes.isZero(aes.linearityDefect('shift', a, b, rk))) shiftBad++;
    if (!aes.isZero(aes.linearityDefect('mix', a, b, rk))) mixBad++;
    if (hex(aes.linearityDefect('ark', a, b, rk)) !== hex(rk)) arkBad++;
    if (aes.isZero(aes.linearityDefect('sub', a, b, rk))) subLinear++;
  }
  T.eq(shiftBad, 0, 'ShiftRows 线性：1000 对上 f(a⊕b) = f(a) ⊕ f(b)');
  T.eq(mixBad, 0, 'MixColumns 线性：1000 对上 f(a⊕b) = f(a) ⊕ f(b)');
  T.eq(arkBad, 0, 'AddRoundKey 仿射：1000 对上 f(a⊕b) ⊕ f(a) ⊕ f(b) 恒等于轮密钥本身');
  T.eq(subLinear, 0, 'SubBytes 非线性：1000 对随机输入没有一对满足线性');
})();

/* 单字节的最小反例，可以直接印在页面上：
   S(01 ⊕ 02) = S(03) = 7b，而 S(01) ⊕ S(02) = 7c ⊕ 77 = 0b。 */
T.eq(aes.SBOX[0x01 ^ 0x02], 0x7b, 'S(03) = 7b');
T.eq(aes.SBOX[0x01] ^ aes.SBOX[0x02], 0x0b, 'S(01) ⊕ S(02) = 0b');
T.ok(aes.SBOX[0x01 ^ 0x02] !== (aes.SBOX[0x01] ^ aes.SBOX[0x02]),
     '7b ≠ 0b —— 一个字节就够推翻 SubBytes 的线性');
(function () {
  const a = new Uint8Array(16), b = new Uint8Array(16);
  a[0] = 0x01; b[0] = 0x02;
  const d = aes.linearityDefect('sub', a, b, un('00000000000000000000000000000000'));
  T.eq(d[0], 0x70, '第 0 字节的差是 7b ⊕ 0b = 70');
  T.eq(hex(d).slice(2), '636363636363636363636363636363',
       '其余 15 个字节的差都是 63 —— S(0⊕0) ⊕ S(0) ⊕ S(0) = S(0) = 63，仿射常数露了出来');
})();

/* ================= 雪崩 ================= */
(function () {
  const key = un('000102030405060708090a0b0c0d0e0f');
  const pt = un('00112233445566778899aabbccddeeff');

  T.eq(aes.avalanche(pt, key, 0)[0], 1,
       '初始 AddRoundKey 之后只有 1 位不同 —— 异或不扩散任何东西');

  /* 逐轮的**字节**扩散是精确值，不是统计量，所以断言写成等号：
     第 1 轮恰好 4 个字节（一列），第 2 轮恰好 16 个（全满）。
     这两条正是"ShiftRows 与 MixColumns 合作"的量化形式。 */
  let r1bad = 0, r2bad = 0;
  for (let b = 0; b < 128; b++) {
    const x = aes.roundStates(pt, key), y = aes.roundStates(aes.flipBit(pt, b), key);
    if (aes.byteDiff(x[1], y[1]) !== 4) r1bad++;
    if (aes.byteDiff(x[2], y[2]) !== 16) r2bad++;
  }
  T.eq(r1bad, 0, '第 1 轮之后恰好 4 个字节变 —— MixColumns 把差分铺满一列，仅此一列');
  T.eq(r2bad, 0, '第 2 轮之后 16 个字节全变 —— 两轮达成完全扩散，128 个比特位置无一例外');

  const cur = aes.avalancheCurve(pt, key);
  T.eq(cur.length, 11, '雪崩曲线覆盖 11 个轮次');
  T.eq(cur[0].mean, 1, '第 0 格的均值恒为 1');
  T.eq(cur[0].min, 1, '第 0 格的最小值也是 1');
  T.eq(cur[0].max, 1, '第 0 格的最大值也是 1');
  T.ok(cur[1].mean > 12 && cur[1].mean < 20,
       '第 1 轮的均值落在 12–20（实测 15.81 = 4 个字节 × 半数比特）');
  /* 第 2 轮就到 ~50%，而且此后再不离开。用区间断言而不是等号：
     它是统计量，写等号等于把一次实测钉死成规范。 */
  let outside = 0;
  for (let r = 2; r <= 10; r++) if (Math.abs(cur[r].fraction - 0.5) > 0.03) outside++;
  T.eq(outside, 0, '从第 2 轮起，每一轮的均值都落在 50% ± 3%');
  T.ok(cur[1].fraction < 0.2, '第 1 轮还远不到 50%（实测 12.35%）');
  /* 只报均值是不够的：均值 64 也可以来自"一半 0、一半 128"。 */
  let narrow = 0;
  for (let r = 2; r <= 10; r++) if (cur[r].min < 30 || cur[r].max > 100) narrow++;
  T.eq(narrow, 0, '从第 2 轮起，min/max 也收在 30–100 之间，不是均值把两个极端平均出来的');
})();

/* ================= 文本便利层 ================= */
(function () {
  const r = aes.firstBlock('AES');
  T.eq(r.used, 3, 'firstBlock 报告用掉了几个字节');
  T.eq(r.total, 3, 'firstBlock 报告原文一共几个字节');
  T.eq(r.truncated, false, '不足一块时不算截断');
  T.eq(hex(r.block), '41455300000000000000000000000000', '不足 16 字节的部分补零');
  const long = aes.firstBlock('0123456789abcdefGHIJ');
  T.eq(long.used, 16, '超过一块时只用前 16 字节');
  T.eq(long.total, 20, '原文长度如实报出');
  T.eq(long.truncated, true, '超出的部分标为截断，不悄悄丢掉');
  const cn = aes.firstBlock('密码');
  T.eq(cn.total, 6, '中文按 UTF-8 计字节：两个字 6 个字节');
})();

T.report('aes');
