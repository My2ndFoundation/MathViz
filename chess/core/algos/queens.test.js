'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const E = require('../exercise.js');
const Q = require('./queens.js');

// ---- 源码必须在子集里合法 ----
for (const N of [4, 6, 8]) {
  let err = null;
  try { I.parse(Q.source({ N: N, lang: 'zh' })); } catch (e) { err = e; }
  T.ok(err === null, 'N=' + N + ' 的源码在子集里合法' + (err ? '：' + err.message : ''));
}

// ---- 解数对拍已知序列（不是写死期望值，是对拍数学事实）----
/* 2/10/4/40/92 是 N 皇后解数的公认值。拿它当独立参照，
   比自己算一遍再跟自己比有意义得多。 */
const KNOWN = { 4: 2, 5: 10, 6: 4, 7: 40, 8: 92 };
let checked = 0;
for (const N of [4, 5, 6, 7, 8]) {
  const r = I.run(Q.source({ N: N, lang: 'zh' }), { host: {} });
  T.ok(!r.trace.truncated, 'N=' + N + ' 未截断');
  T.eq(r.result, KNOWN[N], 'N=' + N + ' 的解数是 ' + KNOWN[N]);
  checked++;
}
T.eq(checked, 5, '五个 N 都对拍过');

// ---- N=9 撞墙：这是这一题的第二课 ----
const wall = I.run(Q.source({ N: 9, lang: 'zh' }), { host: {} });
T.eq(wall.trace.truncated, true, 'N=9 撞上 STEP_LIMIT —— 回溯是指数的');
T.ok(typeof wall.result === 'undefined', '截断时没有结果（不是 0，也不是编造的数）');

// ---- 棋盘事件：确认它真的在画棋盘，而不只是算数 ----
/* 这一题的全部意义是「算法一行一行跑、棋盘同时变」。
   只断言解数的话，一个不调 mark/place 的实现照样全绿。

   但「调了 50 次以上」「用了 2 种以上 kind」同样**没有牙齿**：随机乱标、
   把后摆在互相攻击的格子上、摆了不收，三种实现都能轻松凑够次数，而解数
   那几条断言靠纯算术照样全绿 —— 画面和数字于是可以各说各话，正好是这段
   注释自称要防的那件事。所以下面比的不是次数，是**不变量**，而且最后一组
   把棋盘事件跟解数用的**同一条公认序列**对上：棋盘上真的摆出过 KNOWN[N]
   个不同的满盘格局，且每一个都是合法的 N 皇后布局。 */
const BOARD_N = 6;
const ops = [];
I.run(Q.source({ N: BOARD_N, lang: 'zh' }), { host: {
  mark: function (sq, kind) { ops.push(['mark', sq, kind]); },
  place: function (sq, p) { ops.push(['place', sq, p]); },
  clear: function (sq) { ops.push(['clear', sq]); },
} });

/* 回放棋盘事件，重建「此刻盘上有哪几个后」。 */
let places = 0, clears = 0, strayClear = 0, doublePlace = 0, peak = 0, liveCount = 0;
const live = {};                 // sq → true
const configs = {};              // 满盘格局去重：'2,9,19,26,33,40' → 1
for (const o of ops) {
  if (o[0] === 'place') {
    places++;
    if (live[o[1]]) { doublePlace++; }
    live[o[1]] = true; liveCount++;
    if (liveCount > peak) { peak = liveCount; }
    if (liveCount === BOARD_N) { configs[Object.keys(live).sort().join(',')] = 1; }
  } else if (o[0] === 'clear') {
    clears++;
    if (live[o[1]]) { delete live[o[1]]; liveCount--; } else { strayClear++; }
  }
}
T.eq(places, clears, 'place 与 clear 一一对应（' + places + ' / ' + clears + '）');
T.eq(doublePlace, 0, '没有把后摆到一个已经有后的格子上');
T.eq(strayClear, 0, '没有 clear 过一个本来就没有后的格子');
T.eq(liveCount, 0, '跑完之后棋盘是空的 —— 每个后都被回溯收了回去');
T.eq(peak, BOARD_N, '同时在场的后最多 ' + BOARD_N + ' 个，不多不少');

/* 一个格局合法吗：N 个格子，两两不同行、不同列、不同对角线。
   这一段是独立于被测源码另写的裁判，不复用它的 cols/diagDown/diagUp。 */
function legalConfig(sqs, N) {
  if (sqs.length !== N) { return false; }
  for (let i = 0; i < N; i++) {
    const ci = sqs[i] % N, ri = (sqs[i] - ci) / N;
    if (ri < 0 || ri >= N) { return false; }
    for (let j = i + 1; j < N; j++) {
      const cj = sqs[j] % N, rj = (sqs[j] - cj) / N;
      if (ri === rj || ci === cj) { return false; }
      if (ri - ci === rj - cj || ri + ci === rj + cj) { return false; }
    }
  }
  return true;
}
const seen = Object.keys(configs);
T.eq(seen.length, KNOWN[BOARD_N],
     '棋盘上真的摆出过 ' + KNOWN[BOARD_N] + ' 个不同的满盘格局（棋盘事件对上了公认解数）');
let verified = 0;
for (const key of seen) {
  const sqs = key.split(',').map(Number);
  T.ok(legalConfig(sqs, BOARD_N), '格局 [' + key + '] 是合法的 ' + BOARD_N + ' 皇后布局');
  verified++;
}
T.eq(verified, KNOWN[BOARD_N], '每一个格局都真的查过（这条防的是上面那个循环空转）');

/* mark 的编舞：§2.7 的四种状态一个不少，而且每个 ok / cut 之前都有
   同一格上的 try —— 「先亮起来说我要试这一格，再判定」。 */
const KINDS = { try: 0, ok: 0, cut: 0, back: 0 };
let unknownKind = 0, orphan = 0, lastTry = null;
for (const o of ops) {
  if (o[0] !== 'mark') { continue; }
  const kind = o[2];
  if (Object.prototype.hasOwnProperty.call(KINDS, kind)) { KINDS[kind]++; } else { unknownKind++; }
  if (kind === 'try') { lastTry = o[1]; }
  else if (kind === 'ok' || kind === 'cut') { if (o[1] !== lastTry) { orphan++; } }
}
T.eq(unknownKind, 0, 'mark 只用了 §2.7 的四种 kind');
T.ok(KINDS.try > 0 && KINDS.ok > 0 && KINDS.cut > 0 && KINDS.back > 0,
     '四种状态都画到了：' + JSON.stringify(KINDS));
T.eq(orphan, 0, '每个 ok / cut 之前都有同一格上的 try —— 先亮起再判定');
T.eq(KINDS.ok + KINDS.cut, KINDS.try, 'try 过的每一格最后都有了结论');
T.eq(KINDS.ok, places, '每一次「已确认」都真的摆了一个后');
T.eq(KINDS.back, clears, '每一次「回溯撤销」都真的收回了一个后');

// ---- 子集约束：源码里不许出现三元运算符 ----
/* 不要写成 indexOf('?')：注释里一个中文问号就会让它无端变红。
   上面的 I.parse 已经证明了子集合法性（三元会抛 unsupported）。 */

/* ---- 缺参数当场抛（阶段 5 约束 6：省略参数已经是本仓库抓到过五次的缺陷类）----

   这一份是四个模块里最早写的，写下的时候约束 6 那一轮教训还没发生，于是
   `source()` 的校验**实现了却没有被任何一条断言钉住**：今天谁给 N 加一个
   默认值（哪怕只是 `const N = o.N === undefined ? 8 : o.N;`），上面所有对拍、
   撞墙、编舞的断言仍旧全绿——它们每一条都显式传了 N。那正是这道题最不能出的
   错：界面写着 6、跑的却是 8（见 queens.js `source()` 头上的注释）。
   形状与 tour.test.js / knight-path.test.js 同源。 */
T.throws(function () { Q.source(); }, '连 opts 都没有也当场抛');
T.throws(function () { Q.source({}); }, '缺 N 当场抛 —— N 没有默认值');
T.throws(function () { Q.source({ N: 0 }); }, 'N < 1 当场抛');
T.throws(function () { Q.source({ N: 4.5 }); }, 'N 不是整数当场抛');
T.throws(function () { Q.source({ N: '8' }); }, 'N 是字符串当场抛（不许悄悄当 8 用）');
/* 但**不**拿 N_MIN / N_MAX 当校验边界：N=9 撞墙那一条要靠 source(9) 真吐源码。
   （上面的 wall 那一段已经跑过它了，这里只把这个取舍写明。） */

/* ---- 双语三道门（规格 §7.5）----

   守的是「可执行代码没有偷偷分岔」，**不是**「英文翻得对不对」——后者
   机器判不了，是人工审查项。三道各有对方才拦得住的漏：
     ① 结构门漏掉字符串参与控制流（if (label === '皇后') 两语两条分支）
     ② 行为门漏掉等步改写（i < n → i <= n - 1，同一行、同样步数）
     ③ 行数门被①蕴含，但单独报 —— 最容易违反、也最容易一眼看懂的那条，
        混在①的「字节不同」里报等于没报。 */
for (const N of [4, 6, 8]) {
  const zh = Q.source({ N: N, lang: 'zh' });
  const en = Q.source({ N: N, lang: 'en' });

  T.eq(en.split('\n').length, zh.split('\n').length,
       'N=' + N + '：两种语言行数相同');
  T.eq(T.normalizeSource(en), T.normalizeSource(zh),
       'N=' + N + '：抽掉注释与字符串之后，两种语言逐字节相同');
  T.eq(I.run(en, { host: {} }).trace.length, I.run(zh, { host: {} }).trace.length,
       'N=' + N + '：两种语言的解释器步数相同');
}

/* 反向：英文必须真的是英文。上面三道门在「en 原样返回中文」时全绿 ——
   把 lang 接进来却没接上，长得跟接上了一模一样。 */
const zh6 = Q.source({ N: 6, lang: 'zh' });
const en6 = Q.source({ N: 6, lang: 'en' });
T.ok(zh6 !== en6, '两种语言的源码不是同一份');
T.ok(/[一-鿿]/.test(zh6), '中文那一份里有汉字');

/* ⚠ 「英文那一份里一个汉字都没有」这一条要**扣掉 BLANK 指令行**才成立，
   而这不是放水，是简报自己两段之间打了架：Step 4 明写「BLANK 指令行不翻译，
   它本来就同时带着 hint 与 hintEn」，那 `hint="三条线都空着才算安全…"` 就
   必然把汉字留在英文变体里 —— 实测正是第 39、68 两行、且只有这两行。
   而那两行根本不是读者读的东西：`exercise.js` 的 parse() 把 >>> / <<< 两行
   从 `clean` 里剥掉（见该文件约 85 行），提示由 hintAt 按语言各取一支。
   所以这里断言的是**送到编辑器里的那一份**。

   ⚠ 剥指令行这件事**只许问 parse()，不许自己写一个**。这里原先有一个本地
   `readerFacing()`，实测就已经跟 parse() 分岔了：它出 79 行、`parse().clean`
   出 77 行 —— 差的正是两行 `// <<< BLANK`。今天没后果（`<<<` 行里恰好没汉字），
   但那是运气。而且本地版只抄了 parse() 谓词的一半：开指令行在 exercise.js:343
   是**前缀匹配**、闭指令行在 :355 是**全等匹配**。BLANK 语法哪天长出第二种
   形态，parse() 会跟着改、本地那份不会，于是汉字漏进英文变体而这道门保持绿色。 */
T.ok(!/[一-鿿]/.test(E.parse(en6, 'en').clean),
     '送进编辑器的那一份英文源码（parse().clean）里一个汉字都没有');

/* 下面这两行是**挑出**指令行，不是剥掉 —— parse() 没有对应 API（它只吐
   blanks / clean / placeholder，不吐原始指令行），所以本地选择器保留。
   别照着这两行再写一个「剥」的：剥要用 parse().clean，理由见上一段。 */
const blanksZh = zh6.split('\n').filter(function (l) { return l.trim().indexOf('// >>> BLANK') === 0; });
const blanksEn = en6.split('\n').filter(function (l) { return l.trim().indexOf('// >>> BLANK') === 0; });
T.eq(blanksEn.length, 2, '英文变体里有两条 BLANK 指令（safe-return 与 undo）');
T.eq(blanksEn, blanksZh, 'BLANK 指令行在两种语言下逐字节相同 —— parse() 一点不用改');

/* ---- hintEn 真的是英文（这道门此前不存在）----

   两条 BLANK 的 hintEn 是她在提示面板第 1 级读到的原文，而这个工具**默认
   英文界面**。上面所有门对 hintEn 的内容一句话都没说：把 hintEn 整段换成
   中文，改动前的测试全绿放行 —— 指令行在两语间逐字节相同（那条还是绿的），
   normalizeSource 把整行当注释抽掉，parse().clean 又把整行剥掉。
   拿 parse().blanks 的结构去断言，不自己解析指令行（同上一段的理由）。 */
const blanksParsed = E.parse(en6, 'en').blanks;
T.eq(blanksParsed.length, 2, 'parse() 认出两个挖空');
let hintEnChecked = 0;
for (const b of blanksParsed) {
  T.ok(!/[一-鿿]/.test(b.hint.en), b.id + ' 的 hintEn 里一个汉字都没有');
  T.ok(/[一-鿿]/.test(b.hint.zh), b.id + ' 的 hint（中文那一支）里有汉字');
  hintEnChecked++;
}
T.eq(hintEnChecked, 2, '两个挖空的 hintEn 都真的查过（这条防上面那个循环空转）');

/* ---- lang 必填，且只认两个值 ----

   ⚠ 第三个参数才是 pattern：`T.throws(fn, label, pattern)`（见 _test.js）。
   简报 Step 1 把正则写在第二个位置上，那样 pattern 是 undefined，
   「抛了就算过」—— 这三条要钉的恰恰是**抛的是哪一条**（少了 lang vs 只认
   两个值），位置放错就等于没钉。 */
T.throws(function () { Q.source({ N: 6 }); },
         'lang 缺了当场抛', /少了 lang/);
T.throws(function () { Q.source({ N: 6, lang: 'fr' }); },
         'lang 不是 zh/en 当场抛', /只认/);
T.throws(function () { Q.source({ N: 6, lang: '' }); },
         'lang 是空串当场抛（空串不当默认值用）', /只认/);

T.report();
