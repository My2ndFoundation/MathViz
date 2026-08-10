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
   a4 在 a 线上（4 个，正是掩码在干活的那一档）。

   ⚠ **四条全部钉格名，不许只钉个数**。原先只有 a1 钉了真格名，另外三条
   钉的是 `.length`——复审实测把两侧的走法同时换成「骆驼」(±1,±3)/(±3,±1)，
   那三条个数锚点**全部照样通过**，只有 a1 那条响：个数守的是「有几个」，
   守不住「是哪几个」，而这道题错起来的样子恰恰是「个数对、格子错」
   （掩码挡错线，马从 a 线绕到 h 线，数目一个不少）。 */
T.eq(hostAttacks(0).map(sqName).join(' '), 'c2 b3', 'a1 的马：c2 b3');
T.eq(hostAttacks(63).map(sqName).join(' '), 'g6 f7', 'h8 的马：g6 f7');
T.eq(hostAttacks(27).map(sqName).join(' '), 'c2 e2 b3 f3 b5 f5 c6 e6',
     'd4 的马：八个走法，逐格钉死');
T.eq(hostAttacks(24).map(sqName).join(' '), 'b2 c3 c5 b6',
     'a4 的马：四个走法，逐格钉死（a 线，掩码在干活的那一档）');

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

/* ---- mark 通道：这道题按方向逐个标出攻击格 ----
   ⚠ 数量用 `T.eq(…, 8)` 不用 `T.ok(… >= 8)`：`>=` 对「多标了」完全无感，
   而 mark 通道是画面上**唯一**的数据来源——多标一格，盘上就多亮一格，
   而断言一声不吭。数量之外还得钉「标了哪几格」，理由同上面四个锚点。 */
const marks = [];
I.run(B.source({ sq: 27, lang: 'zh' }), { host: {
  mark: function (s, kind) { marks.push([s, kind]); },
} });
T.eq(marks.length, 8, 'd4：mark 恰好八次，不多不少');
T.eq(marks.map(function (m) { return m[0]; })
          .sort(function (a, b) { return a - b; })
          .map(sqName).join(' '),
     'c2 e2 b3 f3 b5 f5 c6 e6', 'd4：标出来的正是那八格');
T.eq(marks.map(function (m) { return m[1]; }).join(' '),
     'ok ok ok ok ok ok ok ok', 'd4：八次都是 "ok" 这一种 kind');

/* ---- place 通道：马本人得真的站在 SQ 上 ----
   ⚠ **这一条不是锦上添花，是补一个静默缺口**。宿主没给 `place` 时解释器
   落到 NOOP_HOST（`chess-board-algorithms.html` 的 `resolvedHost`），实测
   把生成器里 `place(SQ, "wN")` 整行删掉：`result` 不变、`mark` 通道不变、
   一个错都不抛，上面那一百多条断言**一条都不会红**——跟「递归改循环」是
   同一类沉默缺口。所以这里打桩收集调用，钉三件事：恰好一次（`place` 在
   `addDir` 外面，不该被八个方向放大）、格子号就是 SQ、棋子代号是字符串
   `"wN"`（既有 algos 的约定：数字格子 + 两位字符串代号，见 `tour-dfs.js`
   的 `place(sq, "wN")`；页面层 `PIECE_CODE` 把 "wN" 换算成数字 2，传数字
   也认，但仓库里的算法源码一律传字符串）。
   两格都测：d4 在盘心，a1 在角上——角上那格 SQ === 0，`1n << 0n` 的边界。 */
function placesAt(sq) {
  const out = [];
  I.run(B.source({ sq: sq, lang: 'zh' }), { host: {
    place: function (s, piece) { out.push([s, piece]); },
  } });
  return out;
}
T.eq(placesAt(27), [[27, 'wN']], 'd4：place 恰好一次，摆在 27，代号 "wN"');
T.eq(placesAt(0), [[0, 'wN']], 'a1：place 恰好一次，摆在 0，代号 "wN"');

/* ---- 三道双语门（规格 §7.5）---- */
const zh = B.source({ sq: 27, lang: 'zh' });
const en = B.source({ sq: 27, lang: 'en' });
T.ok(zh !== en, '两种语言真的不一样');
T.eq(zh.split('\n').length, en.split('\n').length, '① 行数同一（规格 §1.6 的逐行对齐）');
T.eq(I.run(zh, { host: {} }).trace.length, I.run(en, { host: {} }).trace.length,
     '② 步数同一（注释不产生步）');
/* ⚠ 第③道门**对这份文件是恒真的，它在这里没有牙** —— 实测：往 en 散文里塞汉字，
   150 条照样全绿。原因是这道题的双语片段**全部是注释**，正则先把它们抽光了，
   剩下 1011 个字符全是两语逐字相同的代码行，本来就不可能有汉字。

   留着它不是摆设，是**形状统一**：对那些教学源码里带 `log("…")` 的题目（字符串
   字面量在注释外面），这道门是真有牙的。写下这段是因为「一道你从不查看的门
   等于没有保护」—— 让它看起来在守什么，比它不存在更糟。真正在守本文件双语
   正确性的是 ① 与 ②，那两条都做过突变实测（en 多一行 / 代码行塞汉字，都当场红）。 */
T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(en.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
     '③ 英文变体抽掉注释后没有汉字');

T.throws(function () { B.source({ sq: 0 }); }, 'lang 缺席当场抛',
         'source({ lang }) 少了 lang');
T.throws(function () { B.source({ lang: 'zh' }); }, 'sq 缺席当场抛',
         'source({ sq }) 少了 sq');

/* ---- sq 的越界 / 类型守卫 ----
   `source()` 里那条 `sq 必须是 0 到 63 之间的整数` 的守卫此前**零覆盖**：
   上面两条 T.throws 只管「缺 lang」「缺 sq」，把整条守卫删掉一条都不会红，
   而删掉之后 `1n << BigInt(64)` 会安安静静算出一个不在棋盘上的位。
   守卫有四个分支（非 number / 非有限 / 非整数 / 越界），逐个钉。

   ⚠ pattern 都写成**完整消息**（固定文案 + 那一次的插值），不写成只有
   固定文案的一段：固定文案对这五条是共享的，一条 pattern 会同时匹中五条
   消息；而这五条消息里 `收到：64` 与 `收到：a1` 归一化之后是**两种不同的
   结构形状**（`_throws_msg_shape` 只抹 ASCII 双引号里的内容和数字，不抹
   裸字符串），共享 pattern 会被第九道门判成「无判别力」。带上插值之后，
   每条 pattern 各自只匹中它自己那一条，覆盖恰好 1 种形状。 */
const G = 'sq 必须是 0 到 63 之间的整数（8×8 的格子编号），收到：';
T.throws(function () { B.source({ sq: 64, lang: 'zh' }); }, 'sq 越上界当场抛',
         G + '64');
T.throws(function () { B.source({ sq: -1, lang: 'zh' }); }, 'sq 越下界当场抛',
         G + '-1');
T.throws(function () { B.source({ sq: 5.5, lang: 'zh' }); }, 'sq 不是整数当场抛',
         G + '5.5');
T.throws(function () { B.source({ sq: NaN, lang: 'zh' }); }, 'sq 不是有限数当场抛',
         G + 'NaN');
T.throws(function () { B.source({ sq: 'a1', lang: 'zh' }); },
         'sq 是字符串当场抛（代数记法不认，只认 0–63 的编号）', G + 'a1');

T.report();
