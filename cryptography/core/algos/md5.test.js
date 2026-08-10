'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const MD5 = require('./md5.js');
const SHA = require('./sha256.js');

/* 与 sha256.test.js 同一个理由：node 内置 crypto 只作独立参照，用来把
   "每个长度的填充都对"这件事钉死。它只在 node 下跑，浏览器分支由
   check.py 的第 7 道门在裸 vm 里另验。 */
const nodeCrypto = require('crypto');
function ref(bytes) {
  return nodeCrypto.createHash('md5').update(Buffer.from(bytes)).digest('hex');
}

/* ================= RFC 1321 附录 A.5 的七条向量 ================= */
T.eq(MD5.hex(''), 'd41d8cd98f00b204e9800998ecf8427e', '空串');
T.eq(MD5.hex('a'), '0cc175b9c0f1b6a831c399e269772661', '"a"');
T.eq(MD5.hex('abc'), '900150983cd24fb0d6963f7d28e17f72', '"abc"');
T.eq(MD5.hex('message digest'), 'f96b697d7cb7938d525a2f31aaf161d0', '"message digest"');
T.eq(MD5.hex('abcdefghijklmnopqrstuvwxyz'), 'c3fcd3d76192e4007dfb496cca67e13b', '26 个小写字母');
T.eq(MD5.hex('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
     'd174ab98d277d9f5a5611c2c9f419d9f', '62 字节（跨块）');
T.eq(MD5.hex('1234567890123456789012345678901234567890' +
             '1234567890123456789012345678901234567890'),
     '57edf4a22be3c955ac49da2e2107b67a', '80 字节（两块）');

/* ================= 逐长度与独立实现对表 ================= */
let sweepBad = 0;
for (let n = 0; n <= 200; n++) {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * 7 + 3) & 0xff;
  if (MD5.hex(b) !== ref(b)) sweepBad++;
}
T.eq(sweepBad, 0, '0–200 字节逐长度与 node crypto 逐字节相同（含小端长度字段的每一个边界）');

T.eq(MD5.digestBytes('abc').length, 16, '摘要恒 16 字节');
T.eq(MD5.hex('abc').length, 32, '十六进制恒 32 个字符');
T.eq(MD5.bits('abc').length, 128, '摘要恒 128 比特');

T.throws(function () { MD5.digestBytes(42); }, '数字不是合法输入', /需要字符串/);
T.throws(function () { MD5.digestBytes([0, 256]); }, '256 不是字节', /不是 0–255 的整数/);
T.throws(function () { MD5.diffByteIndices([1], [1, 2]); }, '长度不同要抛', /长度必须相同/);

/* ================= 那一对真实的碰撞 =================
   Wang / Yu 的构造。下面每一句都由**本文件自己的实现**当场算出来，
   不是抄论文里的结论。 */
const P = MD5.collisionPair();

T.eq(P.a.length, 128, '碰撞消息 a 是 128 字节');
T.eq(P.b.length, 128, '碰撞消息 b 是 128 字节');

/* ---- 负对照放在相等断言之前 ----
   "两个摘要相等"这句话，只有在确认了比较**能够**报不等之后才有内容。
   三条：两条消息不是同一个对象；两条消息的字节确实不同；同一个比较函数
   在改动一个比特后立刻报不等。 */
T.eq(P.a === P.b, false, '**负对照**：a 与 b 不是同一个对象');
T.eq(C.toHex(P.a) === C.toHex(P.b), false, '**负对照**：a 与 b 的字节确实不同');
(function () {
  const tweak = new Uint8Array(P.a);
  tweak[0] ^= 1;                       // 只改最低一位
  T.eq(MD5.hex(P.a) === MD5.hex(tweak), false,
       '**负对照**：同一个比较，在 a 改一个比特后立刻报不等');
})();

/* ---- 差异有多小 ---- */
const diffs = MD5.diffByteIndices(P.a, P.b);
T.eq(diffs, [19, 45, 59, 83, 109, 123], '两条消息只有 6 个字节不同（实测钉死）');
T.eq(diffs.length, 6, '差 6 个字节');
(function () {
  let bits = 0;
  for (let i = 0; i < P.a.length; i++) {
    let x = P.a[i] ^ P.b[i];
    while (x) { bits += x & 1; x >>= 1; }
  }
  T.eq(bits, 6, '128 字节里只差 6 个比特');
})();

/* ---- 相等 ---- */
T.eq(MD5.hex(P.a), '79054025255fb1a26e4bc422aef54eb4', 'md5(a) 是这个值');
T.eq(MD5.hex(P.b), '79054025255fb1a26e4bc422aef54eb4', 'md5(b) 是同一个值');
T.eq(MD5.hex(P.a) === MD5.hex(P.b), true, '两条不同的消息，MD5 完全相同');
T.eq(MD5.hex(P.a), ref(P.a), 'md5(a) 与 node crypto 一致');
T.eq(MD5.hex(P.b), ref(P.b), 'md5(b) 与 node crypto 一致');

/* ---- 垮的是抗碰撞，不是别的 ----
   同一对消息在 SHA-256 下必须给出两个不同的摘要。没有这一条，页面上
   "找到碰撞了"会被读成"哈希都靠不住"；有了它，那句话的范围就被钉死在
   MD5 这一个函数上。 */
T.eq(SHA.hex(P.a) === SHA.hex(P.b), false, '**负对照**：同一对消息的 SHA-256 摘要不同');
T.eq(SHA.hex(P.a), '8d12236e5c4ed9f4e790db4d868fd5c399df267e18ff65c1107c328228cffc98',
     'sha256(a)（实测钉死）');
T.eq(SHA.hex(P.b), 'b9fef2a8fc93b05e7701e97196fda6c4fbeea25ff8e64fdfee7015eca8fa617d',
     'sha256(b)（实测钉死）');
T.eq(SHA.countDiff(SHA.digestBytes(P.a), SHA.digestBytes(P.b)), 113,
     'SHA-256 下这一对差了 113 位（6 个比特的输入差 → 一半的输出差）');

/* 十六进制常量本身没被改动过——COLLISION 是页面直接读的那份数据。 */
T.eq(MD5.COLLISION.a.length, 256, 'COLLISION.a 是 256 个十六进制字符（128 字节）');
T.eq(MD5.COLLISION.b.length, 256, 'COLLISION.b 是 256 个十六进制字符（128 字节）');
T.eq(C.toHex(P.a), MD5.COLLISION.a, 'collisionPair() 解出来的就是 COLLISION.a');
T.eq(C.toHex(P.b), MD5.COLLISION.b, 'collisionPair() 解出来的就是 COLLISION.b');

T.report('md5');
