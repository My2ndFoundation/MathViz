'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const S = require('./sha256.js');

/* node 内置的 crypto 当**独立参照**用。它不是依赖：这个文件只在 node 下跑
   （check.py 的第 3 道门），浏览器分支由第 7 道门在裸 vm 沙箱里另行验证。
   用它的理由是四条教科书向量覆盖不了填充：填充只在特定长度上出错，
   而"每个长度都跟一份独立实现逐字节相同"是唯一能把那一类错堵死的断言。 */
const nodeCrypto = require('crypto');
function ref(bytes) {
  return nodeCrypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

/* ================= FIPS 180-4 公开向量 =================
   这四条是这张 K 表唯一的检验：常数抄错时摘要照样是 64 个十六进制字符、
   照样雪崩、照样确定，任何结构性断言都抓不住它。 */
T.eq(S.hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
     '空串的摘要（FIPS 180-4）');
T.eq(S.hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
     '"abc" 的摘要（FIPS 180-4）');
/* 56 字节：加上 0x80 与 8 字节长度就是 65 > 64，**必须**再开一块。
   这一条是哈希实现最经典的分水岭，只测 "abc" 的实现能一路绿到上线。 */
T.eq(S.hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
     '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
     '56 字节（两块）的摘要（FIPS 180-4）');
T.eq(S.hex('abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmno' +
           'ijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu'),
     'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1',
     '112 字节（三块）的摘要（FIPS 180-4）');
/* 一百万个 a：唯一一条能验到长度字段高位的向量（8 000 000 比特仍在 32 位内，
   但它把 15625 个块的链式更新走了一遍）。 */
T.eq(S.hex(new Array(1000001).join('a')),
     'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
     '一百万个 "a" 的摘要（FIPS 180-4）');

/* ================= 逐长度与独立实现对表 =================
   0–200 字节全覆盖，55 / 56 / 63 / 64 / 119 / 120 这些边界都在里面。 */
let sweepBad = 0;
for (let n = 0; n <= 200; n++) {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * 7 + 3) & 0xff;
  if (S.hex(b) !== ref(b)) sweepBad++;
}
T.eq(sweepBad, 0, '0–200 字节逐长度与 node crypto 逐字节相同');

/* UTF-8 由 CryptoCore.toBytes 负责，这里只确认这条链没接反。 */
T.eq(S.hex('中文 abc'), ref(C.toBytes('中文 abc')), '字符串按 UTF-8 编码后再哈希');
T.eq(S.hex(C.toBytes('中文 abc')), S.hex('中文 abc'), '传字符串与传它的 UTF-8 字节等价');

/* ================= 填充结构 ================= */
T.eq(S.padInfo('').blocks, 1, '空消息也要填满一块');
T.eq(S.padInfo(new Uint8Array(55)).blocks, 1, '55 字节：长度字段刚好挤进本块');
T.eq(S.padInfo(new Uint8Array(55)).zeroBytes, 0, '55 字节时 0x80 与长度字段之间一个 0 都没有');
T.eq(S.padInfo(new Uint8Array(56)).blocks, 2, '56 字节：长度字段挤不进来，必须再开一块');
T.eq(S.padInfo(new Uint8Array(64)).blocks, 2, '整块消息同样要多一块放填充');
T.eq(S.padInfo(new Uint8Array(119)).blocks, 2, '119 字节仍是两块');
T.eq(S.padInfo(new Uint8Array(120)).blocks, 3, '120 字节要三块');
/* 填充后的总长恒是 64 的倍数，且至少比消息多 9 字节（0x80 + 8 字节长度）。 */
for (let n = 0; n <= 130; n++) {
  const p = S.padInfo(new Uint8Array(n));
  T.eq(p.paddedBytes % 64, 0, '填充后总长是 64 的倍数（n=' + n + '）');
  T.ok(p.paddedBytes >= n + 9, '填充至少多出 9 字节（n=' + n + '）');
  T.eq(p.zeroBytes >= 0, true, '补零字节数非负（n=' + n + '）');
}

/* ================= 摘要的形状 ================= */
T.eq(S.digestBytes('abc').length, 32, '摘要恒 32 字节');
T.eq(S.hex('abc').length, 64, '十六进制恒 64 个字符');
T.eq(S.bits('abc').length, 256, '摘要恒 256 比特');
/* 无论输入多长，输出长度不变——"压缩"这个词在这一页是字面意思。 */
T.eq(S.hex(new Array(100001).join('x')).length, 64, '十万字节的输入，输出仍是 64 个字符');
T.eq(S.hex('').length, 64, '零字节的输入，输出也是 64 个字符');

/* bits 与 digestBytes 必须描述同一份字节，MSB 在前。 */
(function () {
  const d = S.digestBytes('abc');
  const b = S.bits('abc');
  let ok = true;
  for (let i = 0; i < 32; i++) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | b[i * 8 + k];
    if (v !== d[i]) ok = false;
  }
  T.ok(ok, 'bits() 与 digestBytes() 是同一份字节（MSB 在前）');
})();

/* ================= 入参校验 ================= */
T.throws(function () { S.digestBytes(42); }, '数字不是合法输入', /需要字符串/);
T.throws(function () { S.digestBytes(null); }, 'null 不是合法输入', /需要字符串/);
T.throws(function () { S.digestBytes([0, 256]); }, '256 不是字节', /不是 0–255 的整数/);
T.throws(function () { S.digestBytes([0, 1.5]); }, '小数不是字节', /不是 0–255 的整数/);
/* 落单代理必须抛，不能悄悄变成 U+FFFD——那会让"改一个字符"变成"改一个
   替换符"，而两条不同的输入会得到同一个摘要，雪崩页当场讲反。 */
T.throws(function () { S.digestBytes('\uD800'); }, '落单高位代理要抛', /落单的高位代理/);
T.throws(function () { S.truncate(S.digestBytes('abc'), 0); }, 'k=0 无意义', /\[1, 32\]/);
T.throws(function () { S.truncate(S.digestBytes('abc'), 33); }, 'k>32 超出精确位运算范围', /\[1, 32\]/);
T.throws(function () { S.flipBit('ab', 16); }, '比特下标越界要抛', /比特下标/);
T.throws(function () { S.flipBit('', 0); }, '空消息没有比特可翻', /比特下标/);
T.throws(function () { S.medianOf([]); }, '空数组没有中位数', /非空数组/);

/* ================= 截断 ================= */
(function () {
  const d = S.digestBytes('abc');          // ba7816bf…
  T.eq(S.truncate(d, 4), 0xb, '取最高 4 位');
  T.eq(S.truncate(d, 8), 0xba, '取最高 8 位');
  T.eq(S.truncate(d, 16), 0xba78, '取最高 16 位');
  T.eq(S.truncate(d, 32), 0xba7816bf, '取最高 32 位');
  /* 截断是**前缀**关系：k 位一定是 k+1 位的前缀。生日实验全靠这条成立。 */
  let ok = true;
  for (let k = 1; k < 32; k++) {
    if (Math.floor(S.truncate(d, k + 1) / 2) !== S.truncate(d, k)) ok = false;
  }
  T.ok(ok, '截断到 k 位是截断到 k+1 位的前缀');
})();

/* ================= 翻一个比特 ================= */
(function () {
  const m = 'abc';
  const f = S.flipBit(m, 0);
  T.eq(f.length, 3, '翻一位不改变消息长度');
  T.eq(C.toHex(f), '616263'.replace('61', 'e1'), '第 0 位是第一个字节的最高位');
  /* 翻两次回到原处——否则位序在两个方向上不一致。 */
  T.eq(C.toHex(S.flipBit(f, 0)), C.toHex(C.toBytes(m)), '翻同一位两次回到原消息');
  let idempotent = true;
  for (let i = 0; i < 24; i++) {
    if (C.toHex(S.flipBit(S.flipBit(m, i), i)) !== C.toHex(C.toBytes(m))) idempotent = false;
  }
  T.ok(idempotent, '每一位都满足翻两次复原');
  /* diffBits 与 countDiff 必须说同一件事。 */
  const a = S.digestBytes(m), b = S.digestBytes(f);
  T.eq(S.diffBits(a, b).length, S.countDiff(a, b), 'diffBits 的长度就是 countDiff');
})();

/* ================= 负对照：比较函数真的会说"不等" =================
   下面所有"相等"断言都建立在这几条之上。没有负对照的相等断言什么都不证明：
   一个恒返回 true 的比较、两个指向同一对象的引用，都能让它变绿。 */
T.eq(S.hex('abc') === S.hex('abc'), true, '同一输入两次调用给出相同摘要（确定性）');
T.eq(S.hex('abc') === S.hex('abd'), false, '**负对照**：一个字符之差，摘要必须不同');
T.eq(S.countDiff(S.digestBytes('abc'), S.digestBytes('abc')), 0, '自己跟自己零位不同');
T.ok(S.countDiff(S.digestBytes('abc'), S.digestBytes('abd')) > 0, '**负对照**：不同输入至少有一位不同');
T.eq(S.hex('abc') === S.hex(''), false, '**负对照**：空串与 "abc" 的摘要不同');

/* ================= 雪崩 =================
   这些是钉住的实测值，不是理论值。改了实现就会红，而那正是要的：
   一个"看着还是随机"的错实现，只有具体数字抓得住。 */
(function () {
  const a = S.avalanche('attack at dawn');
  T.eq(a.bitsFlipped, 112, '14 字节 = 112 个可翻的比特');
  T.eq(a.total, 14498, '112 次单比特翻转，摘要共变了 14498 位（实测钉死）');
  T.eq(a.min, 107, '最少的一次变了 107 位');
  T.eq(a.max, 147, '最多的一次变了 147 位');

  const b = S.avalanche('abc');
  T.eq(b.total, 3078, '"abc" 的 24 次翻转共变 3078 位（实测钉死）');
  T.eq(b.min, 112, '"abc" 最少 112 位');
  T.eq(b.max, 148, '"abc" 最多 148 位');

  const c = S.avalanche('The quick brown fox jumps over the lazy dog');
  T.eq(c.bitsFlipped, 344, '43 字节 = 344 个比特');
  T.eq(c.total, 43899, '344 次翻转共变 43899 位（实测钉死）');

  const d = S.avalanche('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq');
  T.eq(d.total, 57235, '跨块消息的 448 次翻转共变 57235 位（实测钉死）');

  /* 性质断言：均值落在 50% 附近，且**每一次**都远离 0 与 256。
     后半条比前半条值钱——均值 128 也可能来自"一半时候全变、一半时候不变"，
     那是一个坏得多的哈希，而它的均值一样好看。 */
  const all = [a, b, c, d];
  let total = 0, n = 0, min = 256, max = 0;
  all.forEach(function (x) {
    total += x.total; n += x.bitsFlipped;
    if (x.min < min) min = x.min;
    if (x.max > max) max = x.max;
  });
  T.eq(n, 928, '四条消息合计 928 次单比特翻转');
  T.eq(total, 118710, '合计变了 118710 位（实测钉死）');
  const frac = total / n / 256;
  T.ok(frac > 0.49 && frac < 0.51, '合计比例落在 49%–51%（实测 ' + frac.toFixed(5) + '）');
  T.ok(min >= 90, '最坏的一次也变了至少 90 位（实测 ' + min + '）');
  T.ok(max <= 170, '最好的一次也没超过 170 位（实测 ' + max + '）');

  /* "从第一个不同的比特起就是一半"——翻最低位（消息的最后一位）同样如此。 */
  const last = S.avalanche('attack at dawn').counts;
  T.ok(last[111] > 90 && last[111] < 170, '翻最后一个比特，摘要照样变了一半左右');
  T.eq(a.mean, 14498 / 112, 'mean 就是 total / bitsFlipped');
  T.eq(S.avalanche('').mean, null, '空消息没有可翻的比特，mean 是 null 不是 NaN');
})();

/* ================= 生日界 =================
   这一节钉的是**工具页屏幕上显示的那些数字**：同样的 k 列表、同样的
   试验次数、同样的种子。取样不用随机数发生器（消息就是 seed + ':' + i），
   所以每次加载页面看到的和这里断言的必然是同一个数。 */
const KS = [8, 10, 12, 14, 16, 18, 20, 22, 24];
const TRIALS = 64;

/* 单次试验先钉几个，出错时能立刻分清是取样变了还是统计变了。 */
T.eq(S.birthdayTrial(8, 'bd-8-0').samples, 10, 'k=8 第 0 次试验抽 10 个样本撞上');
T.eq(S.birthdayTrial(12, 'bd-12-0').samples, 128, 'k=12 第 0 次试验抽 128 个');
T.eq(S.birthdayTrial(16, 'bd-16-0').samples, 521, 'k=16 第 0 次试验抽 521 个');
T.eq(S.birthdayTrial(20, 'bd-20-0').samples, 1256, 'k=20 第 0 次试验抽 1256 个');
T.eq(S.birthdayTrial(24, 'bd-24-0').samples, 4536, 'k=24 第 0 次试验抽 4536 个');

/* 一次碰撞必须是**真的**碰撞，且只是截断意义上的碰撞。 */
(function () {
  const t = S.birthdayTrial(16, 'bd-16-0');
  T.eq(t.done, true, '搜索确实结束了');
  T.eq(t.exhausted, false, '没有撞上安全上限');
  T.eq(t.a === t.b, false, '**负对照**：碰撞的两条消息不是同一条');
  T.eq(t.a, 'bd-16-0:405', '碰撞消息 a');
  T.eq(t.b, 'bd-16-0:520', '碰撞消息 b');
  const da = S.digestBytes(t.a), db = S.digestBytes(t.b);
  T.eq(S.truncate(da, 16), S.truncate(db, 16), '截到 16 位后两者相等');
  T.eq(S.truncate(da, 16), t.value, '报出来的 value 就是那个相等的值');
  /* 关键的负对照：截断意义上的碰撞**不是** SHA-256 的碰撞。
     少了这一条，"找到碰撞了"这句话会被读成"SHA-256 被我攻破了"。 */
  T.eq(S.hex(t.a) === S.hex(t.b), false, '**负对照**：完整的 256 位摘要并不相等');
  T.ok(S.countDiff(da, db) > 90, '完整摘要有一百来位不同（实测 ' + S.countDiff(da, db) + '）');
  /* 相等在哪一位断掉，是这条碰撞"只到 k 位为止"的直接证据。
     注意它不是恰好 17：截到 16 位相等的一对，再往下每多一位还有一半的机会
     继续相等，这一对实际撑到了 18 位。原先这里断言"17 位就不等了"是错的，
     而它错在**运气**上而不是逻辑上——换个种子有一半概率照样绿。所以钉的是
     实测的那个位数，另外单独断言最高 32 位必不相等。 */
  let firstDiff = 33;
  for (let k = 16; k <= 32; k++) {
    if (S.truncate(da, k) !== S.truncate(db, k)) { firstDiff = k; break; }
  }
  T.eq(firstDiff, 19, '这一对撑到 18 位仍相等，第 19 位上分开（实测钉死）');
  T.eq(S.truncate(da, 32) === S.truncate(db, 32), false, '最高 32 位就已经不相等了');
})();

/* 整条扫描：与工具页逐个数字对齐。 */
const MEASURED = { median: [], mean: [] };
KS.forEach(function (k) {
  const st = S.birthdayStats(k, TRIALS, 'bd-' + k);
  MEASURED.median.push(st.median);
  MEASURED.mean.push(st.mean);
  T.eq(st.exhausted, 0, 'k=' + k + ' 的 64 次试验没有一次撞上安全上限');
  T.eq(st.samples.length, TRIALS, 'k=' + k + ' 收齐了 64 个样本数');
});
T.eq(MEASURED.median, [22.5, 36, 66.5, 152.5, 282.5, 588.5, 1163, 2287.5, 4957],
     'k = 8…24 的样本中位数（64 次试验，实测钉死，与工具页显示的一致）');

/* 与理论对表。诚实的说法是 **≈1.25·2^(k/2)**（均值）与 **≈1.18·2^(k/2)**
   （中位数），不是 2^(k/2) 本身。下面断的是比值落在 0.7–1.4 之间：64 次试验
   的中位数标准误大约是 ±10%，留到 ±30% 是给抽样噪声的余量，而**不是**给
   "理论其实不对"的余量——真跑出 2 倍偏差时这条断言必须红。 */
(function () {
  let worstLo = 9, worstHi = 0;
  KS.forEach(function (k, i) {
    const theory = Math.sqrt(2 * Math.LN2) * Math.pow(2, k / 2);
    const r = MEASURED.median[i] / theory;
    if (r < worstLo) worstLo = r;
    if (r > worstHi) worstHi = r;
    T.ok(r > 0.7 && r < 1.4,
         'k=' + k + ' 的中位数 ' + MEASURED.median[i] + ' 与 1.177·2^(k/2)=' +
         theory.toFixed(1) + ' 的比值 ' + r.toFixed(3) + ' 落在 [0.7, 1.4]');
  });
  T.ok(worstLo > 0.8, '九个 k 里最低的比值也在 0.8 以上（实测 ' + worstLo.toFixed(3) + '）');
  T.ok(worstHi < 1.3, '九个 k 里最高的比值也在 1.3 以下（实测 ' + worstHi.toFixed(3) + '）');
})();

/* 而与 2^k（穷举）对表则差着好几个数量级——这才是这一页要讲的那件事。 */
(function () {
  const i = KS.indexOf(24);
  const speedup = Math.pow(2, 24) / MEASURED.median[i];
  T.ok(speedup > 3000, 'k=24 时生日搜索比穷举 2²⁴ 少抽三千倍以上（实测 ' +
       Math.round(speedup) + '×）');
  /* 而 2^(k/2) 那条线上，比值是**常数**：这才是"指数减半"的意思。 */
  const rLow = MEASURED.median[KS.indexOf(12)] / Math.pow(2, 6);
  const rHigh = MEASURED.median[KS.indexOf(24)] / Math.pow(2, 12);
  T.ok(Math.abs(rLow - rHigh) < 0.6,
       'k=12 与 k=24 的 median/2^(k/2) 相差不到 0.6（' +
       rLow.toFixed(3) + ' vs ' + rHigh.toFixed(3) + '）——两点落在同一条直线上');
})();

/* medianOf 自己的行为（工具页与 birthdayStats 共用它）。 */
T.eq(S.medianOf([3, 1, 2]), 2, '奇数个取中间');
T.eq(S.medianOf([4, 1, 3, 2]), 2.5, '偶数个取中间两个的平均');
T.eq(S.medianOf([10, 2]), 6, '两个元素');
T.eq(S.medianOf([7]), 7, '一个元素');
/* 排序必须是数值排序。默认的字典序会把 [9, 10, 100] 排成 [10, 100, 9]，
   中位数从 10 变成 100——一个只在跨数量级时出现的错，而生日实验的样本
   正好跨好几个数量级。 */
T.eq(S.medianOf([9, 10, 100]), 10, '数值排序，不是字典序');

/* 可恢复搜索必须与一口气跑完的结果逐字段相同——工具页把一次搜索摊到几十帧上，
   两条路径给出不同答案的话，屏幕上的数字就不再是这里钉住的那个。 */
(function () {
  const one = S.birthdayTrial(16, 'bd-16-3');
  const chunked = S.birthdaySearcher(16, 'bd-16-3');
  let guard = 0;
  while (!chunked.done && !chunked.exhausted && guard++ < 100000) chunked.run(7);
  T.eq(chunked.samples, one.samples, '分块跑与一次跑抽到的样本数相同');
  T.eq(chunked.value, one.value, '分块跑与一次跑撞上的值相同');
  T.eq(chunked.a, one.a, '分块跑与一次跑的碰撞消息 a 相同');
  T.eq(chunked.b, one.b, '分块跑与一次跑的碰撞消息 b 相同');
})();

/* 安全上限确实存在且够宽：k=8 的 cap 远大于任何一次实际用量。 */
(function () {
  const s = S.birthdaySearcher(8, 'cap-probe');
  T.ok(s.cap > 64 * 16, 'k=8 的 cap 至少是 64·2⁴');
  T.eq(s.run(0).samples, 0, '显式传 0 就真的一个样本都不抽');
  T.eq(s.run().samples, 1, '省略预算时抽一个');
  T.throws(function () { s.run(-1); }, '负预算要抛', /非负整数/);
  T.throws(function () { s.run(2.5); }, '小数预算要抛', /非负整数/);
})();

T.report('sha256');
