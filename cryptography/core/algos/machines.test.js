'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const M = require('./machines.js');

/* ================================================================
   一、M-94 的 25 片圆盘：数据本身先立起来
   这些字母表是史料，不是本仓生成的（来源写在 machines.js 的注释里）。
   下面三条断言是它**内生的**自洽证据：每片是 A–Z 的一个排列、每片以 A 开头、
   而 A 后面那个字母依次是 B..Z —— 历史上圆盘就是按这个字母编号的（刻着
   "B 1" 到 "Z 25"）。抄错、少行、串行都会让第三条当场断掉。
   ================================================================ */
T.eq(M.M94_WHEELS.length, 25, 'M-94 有 25 片盘');
T.eq(M.M94_COUNT, 25, 'M94_COUNT 与数组长度一致');
T.eq(M.M94_ROWS, 26, '圆周上 26 个位置');

const SEEN_WHEELS = {};
M.M94_WHEELS.forEach(function (w, i) {
  T.eq(w.length, 26, '第 ' + (i + 1) + ' 片盘有 26 个字母');
  T.eq(w.split('').sort().join(''), C.ALPHABET, '第 ' + (i + 1) + ' 片盘是 A–Z 的一个排列');
  T.eq(w.charAt(0), 'A', '第 ' + (i + 1) + ' 片盘以 A 开头');
  T.eq(w.charAt(1), String.fromCharCode(66 + i),
       '第 ' + (i + 1) + ' 片盘 A 后面是 ' + String.fromCharCode(66 + i) + '（盘身编号即由此而来）');
  T.ok(!SEEN_WHEELS[w], '第 ' + (i + 1) + ' 片盘的字母表不与前面任何一片重复');
  SEEN_WHEELS[w] = 1;
});
T.eq(M.M94_WHEEL_IDS[0], 'B 1', '第 1 片盘刻的是 "B 1"');
T.eq(M.M94_WHEEL_IDS[16], 'R 17', '第 17 片盘刻的是 "R 17"');
T.eq(M.M94_WHEELS[16].slice(0, 11), 'ARMYOFTHEUS',
     '第 17 片盘以 ARMYOFTHEUS 开头（史料记载的那个彩蛋）');

/* ================================================================
   二、M-94 的加解密
   ================================================================ */
/* 手算得出来的最小向量：只用第 1 片盘（ABCEIGDJ…），明文 A 在位置 0，
   往下数 1 行是 B、2 行是 C、3 行是 E（这片盘第 3 位是 E，不是 D）。 */
T.eq(M.m94Encrypt('A', [1], 1), 'B', '第 1 片盘：A 往下 1 行是 B');
T.eq(M.m94Encrypt('A', [1], 2), 'C', '第 1 片盘：A 往下 2 行是 C');
T.eq(M.m94Encrypt('A', [1], 3), 'E', '第 1 片盘：A 往下 3 行是 E（这片盘没有把 D 排在这里）');
T.eq(M.m94Encrypt('A', [1], 0), 'A', 'offsetRow=0 就是明文那一行');
T.eq(M.m94Encrypt('A', [1], 26), 'A', '转满一圈回到原处');

/* 盘按 wheelOrder 逐位轮用：第 i 个字母落在第 (i mod 盘数) 片盘上。 */
T.eq(M.m94Encrypt('AA', [1, 2], 1), 'BC', '两片盘：A 在 1 号盘上得 B，A 在 2 号盘上得 C');
T.eq(M.m94Encrypt('AAA', [1, 2], 1), 'BCB', '第 3 个字母绕回第 1 片盘');

/* 非字母被丢掉而不是穿过去：字母在轴上的位置就是它落在哪片盘上，
   混进一个空格会把后面所有字母整体挪一格。 */
T.eq(M.m94Encrypt('a a', [1], 1), 'BB', '小写转大写、空格丢弃');
T.eq(M.m94Encrypt('ATTACK AT DAWN!', [1], 0), 'ATTACKATDAWN', 'offsetRow=0 给出归一化后的明文');

const ORDER10 = [17, 3, 9, 25, 1, 14, 22, 7, 11, 5];
const ORDER25 = [];
for (let i = 1; i <= 25; i++) ORDER25.push(((i * 7) % 25) + 1);   // 25 片盘的一个排列
T.eq(ORDER25.slice().sort(function (a, b) { return a - b; }).join(','),
     Array.from({ length: 25 }, function (_, i) { return i + 1; }).join(','),
     'ORDER25 确实是 1..25 的一个排列');

const M94_TEXTS = ['ATTACKATDAWN', 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG',
                   'A', 'Hello, World! 中文'];
[[1], [1, 2], ORDER10, ORDER25].forEach(function (order) {
  M94_TEXTS.forEach(function (txt) {
    for (let r = 1; r <= 25; r++) {
      const ct = M.m94Encrypt(txt, order, r);
      T.eq(M.m94Decrypt(ct, order, r), C.normalize(txt),
           'M-94 往返：' + order.length + ' 片盘 / 第 ' + r + ' 行 / ' + txt.slice(0, 12));
      T.eq(ct.length, C.normalize(txt).length, '密文长度 = 明文字母数');
    }
  });
});

/* 26 行里第 0 行是明文，另外 25 行都是可用的密文，而且两两不同 ——
   "一次装配给出 25 种不同的密文、由操作员挑一行"这句话就是这条断言。
   互不相同不是巧合：每片盘是排列，所以第一个字母在 26 行里恰好取遍 26 个值。 */
[[1], ORDER10, ORDER25].forEach(function (order) {
  const rows = M.m94Rows('ATTACKATDAWN', order);
  T.eq(rows.length, 26, order.length + ' 片盘：m94Rows 给出 26 行');
  T.eq(rows[0], 'ATTACKATDAWN', '第 0 行是明文本身');
  T.eq(new Set(rows).size, 26, '26 行两两不同 —— 除去明文那行，正好 25 种密文');
  for (let r = 1; r <= 25; r++) {
    T.eq(rows[r], M.m94Encrypt('ATTACKATDAWN', order, r),
         '第 ' + r + ' 行与 m94Encrypt(…, ' + r + ') 一致');
  }
});

/* 装不出来的轴要当场拒绝，而不是画出一台不存在的机器。 */
T.throws(function () { M.m94Encrypt('A', [1, 1], 1); }, '同一片盘不能插两次', /出现了两次/);
T.throws(function () { M.m94Encrypt('A', [0], 1); }, '盘号 0 不存在', /应是 1\.\./);
T.throws(function () { M.m94Encrypt('A', [26], 1); }, '盘号 26 不存在', /应是 1\.\./);
T.throws(function () { M.m94Encrypt('A', [], 1); }, '空的 wheelOrder', /非空数组/);
T.throws(function () { M.m94Encrypt('A', ORDER25.concat([1]), 1); }, '超过 25 片', /只有 25 片盘/);

/* ================================================================
   三、C-38 / M-209 的六个互素周期
   ================================================================ */
T.eq(M.wheelPeriods(), [26, 25, 23, 21, 19, 17], '六个销轮的齿数（机器上从左到右）');
T.eq(M.C38_BARS, 27, '凸耳笼 27 根杆');
T.eq(M.C38_WHEEL_LETTERS.map(function (s) { return s.length; }), [26, 25, 23, 21, 19, 17],
     '轮上刻的字母数与销数一致');
T.eq(M.C38_WHEEL_LETTERS[1].indexOf('W'), -1, '第 2 轮的字母表去掉了 W');
T.eq(M.C38_WHEEL_LETTERS[2], 'ABCDEFGHIJKLMNOPQRSTUVX', '第 3 轮是 A–X 去掉 W');

/* 两两互素 —— 这是"乘积 = 最小公倍数"的全部依据，不能只当常识写在注释里。 */
const PER = M.wheelPeriods();
for (let i = 0; i < PER.length; i++) {
  for (let j = i + 1; j < PER.length; j++) {
    T.eq(C.gcd(PER[i], PER[j]), 1, PER[i] + ' 与 ' + PER[j] + ' 互素');
  }
}
T.eq(17 * 19 * 21 * 23 * 25 * 26, 101405850, '17·19·21·23·25·26 = 101 405 850');
T.eq(M.c38StatePeriod(), 101405850, 'c38StatePeriod() 由 C38_PINS 乘出来，正是那个数');
T.eq(PER.reduce(function (a, b) { return a * b; }, 1), 101405850, '乘积复核');

/* ================================================================
   四、C-38 的加解密与密钥流
   ================================================================ */
const PINS = M.PIN_PRESETS.balanced;
const LUGS = M.LUG_DEMO;
T.eq(LUGS.length, 27, '演示凸耳笼有 27 根杆');

const KS = M.c38KeyStream(PINS, LUGS, 200);
T.eq(KS.length, 200, 'c38KeyStream 给出要多少个就多少个');
T.ok(KS.every(function (k) { return Number.isInteger(k) && k >= 0 && k <= 27; }),
     '齿数恒在 0..27 之间（笼子只有 27 根杆）');
T.ok(new Set(KS).size > 8, '演示密钥下的齿数有足够的分布，不是在两个值之间跳');
for (let n = 0; n < 50; n++) {
  T.eq(M.c38KickAt(PINS, LUGS, n), KS[n], 'c38KickAt(' + n + ') 与密钥流第 ' + n + ' 项一致');
}

/* 自反：加密与解密是同一次操作。不是"跑两次碰巧回来"，而是
   C = 25 − P + K 代进自己就化回 P。 */
const C38_TEXTS = ['ATTACKATDAWN', 'A', 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG',
                   'Hello, World! 123'];
C38_TEXTS.forEach(function (p) {
  const ct = M.c38Encrypt(p, PINS, LUGS);
  T.eq(M.c38Decrypt(ct, PINS, LUGS), C.normalize(p), 'C-38 往返：' + p.slice(0, 16));
  T.eq(M.c38Encrypt(ct, PINS, LUGS), C.normalize(p), 'C-38 自反：再加密一次就回到明文');
  T.eq(ct.length, C.normalize(p).length, '密文长度 = 明文字母数');
});
/* 逐字符复核公式本身：C ≡ 25 − P + K (mod 26)。 */
(function () {
  const p = C.normalize('THEQUICKBROWNFOX');
  const ct = M.c38Encrypt(p, PINS, LUGS);
  const ks = M.c38KeyStream(PINS, LUGS, p.length);
  let ok = true;
  for (let i = 0; i < p.length; i++) {
    if (ct.charCodeAt(i) - 65 !== C.mod(25 - (p.charCodeAt(i) - 65) + ks[i], 26)) ok = false;
  }
  T.ok(ok, '每个字符都满足 C ≡ 25 − P + K (mod 26)');
})();

/* 轮位（报头指示的起始位置）也是密钥的一部分：换一组起始位置，密文就变。 */
T.ok(M.c38Encrypt('ATTACKATDAWN', PINS, LUGS, [1, 0, 0, 0, 0, 0]) !==
     M.c38Encrypt('ATTACKATDAWN', PINS, LUGS, [0, 0, 0, 0, 0, 0]),
     '起始轮位不同则密文不同');
T.eq(M.c38Decrypt(M.c38Encrypt('ATTACKATDAWN', PINS, LUGS, [3, 5, 7, 11, 13, 2]),
                  PINS, LUGS, [3, 5, 7, 11, 13, 2]),
     'ATTACKATDAWN', '带起始轮位的往返');
T.eq(M.c38KickAt(PINS, LUGS, 5, [1, 1, 1, 1, 1, 1]), M.c38KickAt(PINS, LUGS, 6),
     '起始轮位整体 +1 等于把时间轴整体挪一格');

/* 坏密钥当场拒绝。 */
T.throws(function () { M.c38Encrypt('A', PINS.slice(0, 5), LUGS); }, '销轮少了一个', /需要 6 个销轮/);
T.throws(function () { M.c38Encrypt('A', ['x'.repeat(25)].concat(PINS.slice(1)), LUGS); },
         '第 1 轮销数写错', /长度应为 26/);
T.throws(function () { M.c38Encrypt('A', ['?'.repeat(26)].concat(PINS.slice(1)), LUGS); },
         '销图案里有看不懂的字符', /无法解读的字符/);
T.throws(function () { M.c38Encrypt('A', PINS, LUGS.slice(0, 26)); }, '杆数不是 27', /需要 27 根杆/);
T.throws(function () { M.c38Encrypt('A', PINS, LUGS.slice(0, 26).concat([[0, 7]])); },
         '凸耳指向了不存在的第 7 轮', /应是 0（中立）或 1\.\.6/);
T.throws(function () { M.c38Encrypt('A', PINS, LUGS.slice(0, 26).concat([[0]])); },
         '一根杆必须写两个凸耳', /两个数/);

/* ================================================================
   五、周期：三条互相独立的证据
   ================================================================ */
T.eq(M.minimalPinPeriod([1, 0, 1, 0, 1, 0]), 2, '最小周期：010101 是 2');
T.eq(M.minimalPinPeriod([1, 1, 1, 1]), 1, '常数图案的最小周期是 1');
T.eq(M.minimalPinPeriod([1, 0, 0, 0, 0]), 5, '只有一个 1 的图案没有更短的周期');
T.eq(M.minimalPinPeriod([1, 1, 0, 1, 1, 0]), 3, '110110 是 3');

/* 演示销图案的两条判据（machines.js 里选种子 30 就是按这两条选的）。 */
PINS.forEach(function (row, i) {
  const bits = row.split('').map(function (c) { return c === 'x' ? 1 : 0; });
  T.eq(M.minimalPinPeriod(bits), PER[i], '第 ' + (i + 1) + ' 轮的销图案有满周期 ' + PER[i]);
  const up = bits.reduce(function (a, b) { return a + b; }, 0) / bits.length;
  T.ok(up >= 0.40 && up <= 0.60, '第 ' + (i + 1) + ' 轮的销推出比例在 40%–60%：' + up.toFixed(3));
});

/* --- 证据 1：小规模配置下逐位移暴力测量 ---
   把凸耳全部挪到 5、6 号轮上，其余四个轮的销全部缩回。理论周期是
   lcm(19,17)=323，而这个规模小到可以把 323 的每个因数都试一遍。 */
function lugsOn(wheels) {
  const bars = [];
  for (let i = 0; i < 27; i++) {
    const w = wheels[i % wheels.length];
    bars.push(i % 3 === 2 ? [w, wheels[(i + 1) % wheels.length]] : [w, 0]);
  }
  return bars;
}
/* 两种销图案，故意不同：
     thirds  —— 「每三个缩回一个」。看着无害，但在销数能被 3 整除的轮上
                （21 销那个）图案**自己**的周期只有 3，整机周期跟着缩水。
     full    —— 只推出相邻的两个销。两个相邻的 1 在长度 L 的环上不可能有
                更短的周期（否则 1 会每 m 格出现一次，个数对不上），所以
                这一种恒为满周期。
   两种都要测：第二种验"理论值达得到"，第一种验"达不到时两套算法仍然一致"。 */
function pinsFor(active, kind) {
  return M.C38_PINS.map(function (len, w) {
    const on = active.indexOf(w + 1) >= 0;
    let s = '';
    for (let i = 0; i < len; i++) {
      const up = on && (kind === 'full' ? (i === 0 || i === 1) : (i % 3 !== 0));
      s += up ? 'x' : '.';
    }
    return s;
  });
}
/* 暴力：直接找最小的 d>0 使 s(n) === s(n+d) 对 n = 0..limit−1 全部成立。
   周期必然整除状态周期，所以只试因数。 */
function bruteForcePeriod(pins, lugs, limit) {
  const s = M.c38KeyStream(pins, lugs, limit * 2);
  for (let d = 1; d <= limit; d++) {
    if (limit % d !== 0) continue;
    let ok = true;
    for (let n = 0; n < limit && ok; n++) if (s[n] !== s[n + d]) ok = false;
    if (ok) return d;
  }
  return limit;
}
(function () {
  const pins = pinsFor([5, 6], 'thirds');
  const lugs = lugsOn([5, 6]);
  const measured = bruteForcePeriod(pins, lugs, 19 * 17);
  T.eq(measured, 323, '只挂 5、6 号轮时，逐位移暴力测出的周期是 lcm(19,17)=323');
  T.eq(M.c38Period(pins, lugs), 323, 'c38Period() 给出同一个数');
})();
(function () {
  const pins = pinsFor([4, 5, 6], 'full');
  const lugs = lugsOn([4, 5, 6]);
  const measured = bruteForcePeriod(pins, lugs, 21 * 19 * 17);
  T.eq(measured, 6783, '挂 4、5、6 号轮、销图案满周期时，暴力测得 21·19·17 = 6783');
  T.eq(M.c38Period(pins, lugs), 6783, 'c38Period() 给出同一个数');
})();
/* 同样挂 4、5、6 号轮，只把销图案换成"每三个缩回一个"：21 销那个轮的图案
   自己就三格一循环，于是它对整机只贡献 3，总周期 3·19·17 = 969 而不是 6783。
   这条断言写的是**实测值**，不是理论上限 —— 齿数互素只保证了周期的上限，
   销拨得对不对决定实际拿到多少。（写这个测试时我先把它写成 6783，暴力测量
   与 c38Period() 一起给出 969，两套互相独立的算法同时纠正了我。） */
(function () {
  const pins = pinsFor([4, 5, 6], 'thirds');
  const lugs = lugsOn([4, 5, 6]);
  const measured = bruteForcePeriod(pins, lugs, 21 * 19 * 17);
  T.eq(measured, 969, '销图案自己三格一循环时，暴力测得 3·19·17 = 969');
  T.eq(M.c38Period(pins, lugs), 969, 'c38Period() 给出同一个数 —— 两套算法一致');
  T.eq(M.minimalPinPeriod(pins[3].split('').map(function (c) { return c === 'x' ? 1 : 0; })), 3,
       '原因就在这里：21 销那个轮的销图案最小周期是 3');
})();

/* --- 证据 2：满规模下的直接反证 ---
   密钥流的周期 T 必然整除状态周期 L = 101 405 850（六个轮位构成 Z_L）。
   若 T < L，则存在素因子 q 使 T | L/q，那时密钥流在位移 L/q 下不变。
   所以：对 L 的**每一个**素因子都举出一个 s(n) ≠ s(n + L/q) 的反例，
   就等于证明了 T = L。反例只需要一个，靠 c38KickAt 的 O(1) 单点求值找 ——
   下标大到一亿，绝无可能先把整条流生成出来。 */
function noShorterPeriod(pins, lugs, label) {
  const L = M.c38StatePeriod();
  const primes = [2, 3, 5, 7, 13, 17, 19, 23];
  primes.forEach(function (q) {
    T.eq(L % q, 0, 'q=' + q + ' 确实整除 ' + L);
    const d = L / q;
    let at = -1;
    for (let n = 0; n < 4000 && at < 0; n++) {
      if (M.c38KickAt(pins, lugs, n) !== M.c38KickAt(pins, lugs, n + d)) at = n;
    }
    T.ok(at >= 0, label + '：位移 ' + d + '（= L/' + q + '）下密钥流会变 —— ' +
         '反例在 n = ' + at + '，故周期不整除 L/' + q);
  });
}
noShorterPeriod(PINS, LUGS, 'balanced');
T.eq(M.c38Period(PINS, LUGS), 101405850,
     'balanced 的密钥流周期精确等于 17·19·21·23·25·26 = 101 405 850');

/* 疏密与周期无关：每个轮只推出一个销，周期照样是满的。 */
noShorterPeriod(M.PIN_PRESETS.sparse, LUGS, 'sparse');
T.eq(M.c38Period(M.PIN_PRESETS.sparse, LUGS), 101405850,
     '每轮只有一个销推出时，周期仍是 101 405 850 —— 长周期来自齿数互素，不是来自销的疏密');

/* --- 证据 3：拨坏了会塌，而且塌到可以逐字符验的程度 ---
   3–6 号轮全缩回、1 号轮两格一循环、2 号轮五格一循环 → lcm(2,5) = 10。
   同一台机器、同一个凸耳笼：机械没变，周期从一亿掉到 10。 */
(function () {
  const bad = M.PIN_PRESETS.collapsed;
  T.eq(M.c38Period(bad, LUGS), 10, '销拨成退化图案时周期塌到 10');
  const s = M.c38KeyStream(bad, LUGS, 100);
  let ok = true;
  for (let n = 0; n + 10 < s.length; n++) if (s[n] !== s[n + 10]) ok = false;
  T.ok(ok, '逐字符复核：塌掉之后密钥流真的每 10 个字符重复一次');
  [1, 2, 5].forEach(function (d) {
    let same = true;
    for (let n = 0; n + d < s.length && same; n++) if (s[n] !== s[n + d]) same = false;
    T.ok(!same, '而位移 ' + d + ' 下并不重复 —— 10 是最小周期，不是随手取的一个倍数');
  });
})();

/* ================================================================
   六、密钥空间：第三页印在屏幕上的每个数
   ================================================================ */
const KSP = M.keyspace();
/* 25! 用 BigInt 独立算一遍，不信模块里那个十进制串。 */
(function () {
  let f = 1n;
  for (let i = 2n; i <= 25n; i++) f *= i;
  T.eq(KSP.m94OrderCountText, f.toString(), '25! 的十进制串与 BigInt 复算一致');
})();
T.ok(Math.abs(KSP.m94Bits - 83.6815136) < 1e-6, 'log2(25!) ≈ 83.68 比特');
T.eq(KSP.m94Discs, 25, 'keyspace() 报的盘数是 25');
T.eq(KSP.c38PinCount, 131, '销总数 26+25+23+21+19+17 = 131');
T.eq(KSP.c38BarTypes, 22, '一根杆有 22 种有效形态：两耳中立 1 + 单轮 6 + 双轮 15');
/* C(48,21) 也用 BigInt 复算：模块里那一版是浮点连乘再取整，必须有人盯着。 */
(function () {
  function binomBig(n, k) {
    let r = 1n;
    for (let i = 1n; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }
  T.eq(String(KSP.c38LugCages), binomBig(48n, 21n).toString(),
       '凸耳笼的有效配置数 C(48,21) 与 BigInt 复算一致');
})();
T.eq(KSP.c38LugCages, 22314239266528, 'C(48,21) = 22 314 239 266 528');
T.ok(Math.abs(KSP.c38Bits - (131 + Math.log2(22314239266528))) < 1e-9,
     'C-38 的总比特数 = 销 131 比特 + 凸耳笼 log2(C(48,21))');
T.ok(KSP.c38Bits > 175 && KSP.c38Bits < 176, 'C-38 的配置空间约 175 比特');
T.eq(KSP.statePeriod, 101405850, 'keyspace() 里的状态周期也是同一个数');

/* 与第一章的对照 —— 第三页画的那几根柱子。 */
T.ok(KSP.m94Bits > Math.log2(Math.pow(26, 7)),
     'M-94 的 25! 种装配远大于 7 字母维吉尼亚的 26⁷');
T.ok(Math.log2(26) < 5, '凯撒只有 26 把钥匙，不到 5 比特');

T.report('machines');
