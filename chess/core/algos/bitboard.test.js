'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const B = require('./bitboard.js');

/* 宿主侧的独立参照 —— 不是写死期望值，是另写一份实现来对拍。
   规格 §7.3：判据是「跟另一份实现一致」。这一份**不用位运算**，
   走的是最朴素的「一格一格加偏移、判边界」——两份实现的思路完全
   不同，同时错成一样的可能性远低于我把某个数抄错。 */
const DF = [1, 2, 2, 1, -1, -2, -2, -1];   // 文件方向
const DR = [2, 1, -1, -2, -2, -1, 1, 2];   // 行方向
function hostAttacks(sq) {
  const f = sq % 8, r = (sq - f) / 8;
  const out = [];
  for (let k = 0; k < 8; k++) {
    const nf = f + DF[k], nr = r + DR[k];
    if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) out.push(nr * 8 + nf);
  }
  return out.sort(function (a, b) { return a - b; });
}
function hostBB(sq) {
  let b = 0n;
  const a = hostAttacks(sq);
  for (let i = 0; i < a.length; i++) b = b | (1n << BigInt(a[i]));
  return b;
}
function sqName(s) { const f = s % 8; return String.fromCharCode(97 + f) + ((s - f) / 8 + 1); }

/* 六十四格全跑一遍。位盘这道题的全部风险都在边线上，抽样会漏。 */
let n = 0;
for (let sq = 0; sq < 64; sq++) {
  const r = I.run(B.source({ sq: sq, lang: 'zh' }), { host: {} });
  T.ok(!r.trace.truncated, sqName(sq) + ' —— 没撞步数上限');
  T.eq(r.result, hostBB(sq), sqName(sq) + ' —— 攻击位盘与宿主侧参照一致');
  n++;
}
T.eq(n, 64, '六十四格全跑过');

/* 四个写死的锚点。上面那组比的是「两份实现一致」，这四条钉的是
   「那个一致的答案就是棋盘上真的那几格」—— 两份实现同时错成同一个
   数，只有这四条拦得住。a1 与 h8 是角（各 2 个），d4 是中心（8 个），
   a4 在 a 线上（4 个，正是掩码在干活的那一档）。 */
T.eq(hostAttacks(0).map(sqName).join(' '), 'c2 b3', 'a1 的马：两个走法');
T.eq(hostAttacks(63).length, 2, 'h8 的马：两个走法');
T.eq(hostAttacks(27).length, 8, 'd4 的马：八个走法');
T.eq(hostAttacks(24).length, 4, 'a4 的马：四个走法');

/* ---- 回绕的反证：把掩码拿掉，a 线上的马必然跑到 h 线 ----
   这一条不测被测源码，它测的是**这道题值不值得存在**：若不加掩码
   也碰巧对，那这道题就没有那一课了。所以它算的是「裸移位」的结果，
   与生成器无关。 */
function nakedShift(sq) {
  let b = 0n;
  const OFF = [6, 10, 15, 17, -6, -10, -15, -17];
  for (let i = 0; i < OFF.length; i++) {
    const t = sq + OFF[i];
    if (t >= 0 && t < 64) b = b | (1n << BigInt(t));
  }
  return b;
}
T.ok(nakedShift(24) !== hostBB(24),
     '裸移位与正确答案不同 —— a4 的马不加掩码会跑到别的线上（这道题的那一课）');

/* ---- mark 通道：这道题按方向逐个标出攻击格 ---- */
const marks = [];
I.run(B.source({ sq: 27, lang: 'zh' }), { host: {
  mark: function (s, kind) { marks.push([s, kind]); },
} });
T.ok(marks.length >= 8, 'd4 的八个攻击格都标了（' + marks.length + ' 次）');

/* ---- 三道双语门（规格 §7.5）---- */
const zh = B.source({ sq: 27, lang: 'zh' });
const en = B.source({ sq: 27, lang: 'en' });
T.ok(zh !== en, '两种语言真的不一样');
T.eq(zh.split('\n').length, en.split('\n').length, '① 行数同一（规格 §1.6 的逐行对齐）');
T.eq(I.run(zh, { host: {} }).trace.length, I.run(en, { host: {} }).trace.length,
     '② 步数同一（注释不产生步）');
T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(en.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
     '③ 英文变体抽掉注释后没有汉字');

T.throws(function () { B.source({ sq: 0 }); }, 'lang 缺席当场抛',
         'source({ lang }) 少了 lang');
T.throws(function () { B.source({ lang: 'zh' }); }, 'sq 缺席当场抛',
         'source({ sq }) 少了 sq');

T.report();
