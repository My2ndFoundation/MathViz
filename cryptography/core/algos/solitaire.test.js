'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const S = require('./solitaire.js');

/* ---- 牌堆的形状 ---- */
const D0 = S.newDeck();
T.eq(D0.length, 54, '一副牌 54 张');
T.eq(D0[0], 1, '第一张是梅花 A');
T.eq(D0[51], 52, '第 52 张是黑桃 K');
T.eq(D0[52], S.JOKER_A, '倒数第二张是 A 王');
T.eq(D0[53], S.JOKER_B, '最后一张是 B 王');
T.eq(S.cardName(1) + ' ' + S.cardName(13) + ' ' + S.cardName(14) + ' ' +
     S.cardName(27) + ' ' + S.cardName(52) + ' ' + S.cardName(53) + ' ' + S.cardName(54),
     'AC KC AD AH KS A* B*', '牌名按梅花→方块→红心→黑桃，两张王另计');
T.eq(S.cardValue(S.JOKER_A), 53, 'A 王计数时值 53');
T.eq(S.cardValue(S.JOKER_B), 53, 'B 王计数时值 53（与 A 王同值，但身份不同）');
T.eq([S.JOKER_A, S.JOKER_B].map(S.isJoker), [true, true], '两张王都认得出来');
T.eq(S.isJoker(52), false, '黑桃 K 不是王');

/* ---- 纯函数：绝不改调用方那一副 ----
   时间轴的 ⏮ 靠"把之前那一副拿出来重画"实现，一个就地洗牌的版本会让历史里
   每一副都变成同一副。冻结输入是最硬的判据：严格模式下改它当场抛。 */
(function () {
  const frozen = Object.freeze(S.newDeck());
  S.moveJokerA(frozen); S.moveJokerB(frozen); S.tripleCut(frozen);
  S.countCut(frozen); S.step(frozen); S.stepStages(frozen); S.keyStreamValue(frozen);
  T.eq(frozen, S.newDeck(), '六个操作都没动被冻结的输入');
  const d = S.newDeck();
  const after = S.step(d);
  T.eq(d, S.newDeck(), 'step 之后调用方的牌一张没动');
  T.ok(after !== d, 'step 返回的是新数组，不是同一个引用');
})();

/* ---- A 王下移一格 ---- */
T.eq(S.moveJokerA(S.newDeck()).indexOf(S.JOKER_A), 53,
     'A 王从倒数第二挪到最后一张');
(function () {
  /* 已经在底了：按环走，落到"第一张的下面"，也就是下标 1 —— 不是下标 0。
     落到 0 会让王变成顶牌，而顶牌的值决定输出位置，整条流当场走岔。 */
  const d = S.moveJokerA(S.newDeck());       // A 王此刻在底
  T.eq(S.moveJokerA(d).indexOf(S.JOKER_A), 1, 'A 王在底时绕到第一张下面（下标 1）');
  T.eq(S.moveJokerA(d)[0], 1, '绕回来之后顶牌仍是原来那张，王不占下标 0');
})();

/* ---- B 王下移两格，三条边界各一次 ---- */
(function () {
  const base = S.newDeck();                   // B 王在下标 53（底）
  T.eq(S.moveJokerB(base).indexOf(S.JOKER_B), 2, 'B 王在底时落到第二张下面（下标 2）');
  const one = S.moveJokerA(base);             // A 王挪到 53，B 王被推到 52
  T.eq(one.indexOf(S.JOKER_B), 52, '前提：此刻 B 王在倒数第二');
  T.eq(S.moveJokerB(one).indexOf(S.JOKER_B), 1, 'B 王在倒数第二时落到第一张下面（下标 1）');
  const mid = S.moveJokerB(S.moveJokerB(base));  // B 王到了 4
  T.eq(mid.indexOf(S.JOKER_B), 4, '普通位置就是往下两格');
})();

/* ---- 三重切牌 ----
   两张王之间那一段（含王）不动，上下两段整体对调。用手算的一副小牌验不了
   （这个实现钉死 54 张），所以直接验新牌上的那一次：A 王在 53、B 王在 1 时，
   中段是下标 1..53，上段只有下标 0 的梅花 A，下段是空——所以梅花 A 应当
   跑到最底下，其余整体上移一位。 */
(function () {
  const d = S.moveJokerB(S.moveJokerA(S.newDeck()));
  T.eq([d.indexOf(S.JOKER_B), d.indexOf(S.JOKER_A)], [1, 53], '前提：B 王在 1、A 王在 53');
  const t = S.tripleCut(d);
  T.eq(t.map(S.cardName).slice(0, 3), ['B*', '2C', '3C'], '三重切牌后顶上是 B 王');
  T.eq(t.map(S.cardName).slice(51), ['KS', 'A*', 'AC'], '原来的顶牌梅花 A 落到最底');
  T.eq(t.length, 54, '三重切牌不增不减');
  /* 判据是"位置上谁在前"，不是"A 王还是 B 王"。把两张王的身份对调，切出来的
     结果必须与只换这两张牌的位置一致——写成 indexOf(JOKER_A) 当上界的实现
     在这里会露馅。 */
  const swapped = d.map(function (c) {
    return c === S.JOKER_A ? S.JOKER_B : (c === S.JOKER_B ? S.JOKER_A : c);
  });
  const tw = S.tripleCut(swapped);
  T.eq(tw, t.map(function (c) {
    return c === S.JOKER_A ? S.JOKER_B : (c === S.JOKER_B ? S.JOKER_A : c);
  }), '两张王互换身份后，三重切牌的分段完全一样');
})();

/* ---- 计数切牌 ---- */
(function () {
  const d = S.newDeck();                      // 底牌是 B 王，值 53
  T.eq(S.countCut(d), d, '底牌是王（值 53）时计数切牌是恒等变换');
  const t = S.tripleCut(S.moveJokerB(S.moveJokerA(d)));   // 底牌成了梅花 A，值 1
  T.eq(S.cardValue(t[53]), 1, '前提：底牌是梅花 A');
  const c = S.countCut(t);
  T.eq(c[0], t[1], '切 1 张：新顶牌是原来的第二张');
  T.eq(c[52], t[0], '被切走的那 1 张落在底牌正上方');
  T.eq(c[53], t[53], '底牌永远留在底');
  /* 显式计数是 deckFromPassphrase 用的那一次额外切牌。 */
  const e = S.countCut(t, 5);
  T.eq(e[0], t[5], '显式计数 5：新顶牌是原来的第 6 张');
  T.eq(e[53], t[53], '显式计数同样把底牌留在底');
  T.throws(function () { S.countCut(t, 0); }, '计数 0 不合法', /计数必须是 1\.\./);
  T.throws(function () { S.countCut(t, 54); }, '计数超过 53 不合法', /计数必须是 1\.\./);
})();

/* ---- stepStages 与 step 必须是同一件事 ---- */
(function () {
  const d = S.newDeck();
  const st = S.stepStages(d);
  T.eq(st.map(function (s) { return s.op; }), ['jokerA', 'jokerB', 'tripleCut', 'countCut'],
       '四步的顺序与名字固定');
  T.eq(st[3].deck, S.step(d), 'stepStages 的最后一帧就是 step 的结果');
  T.eq(st[0].deck, S.moveJokerA(d), '第一帧是 A 王');
  T.eq(st[1].deck, S.moveJokerB(st[0].deck), '第二帧是 B 王');
  T.eq(st[2].deck, S.tripleCut(st[1].deck), '第三帧是三重切牌');
})();

/* ---- 坏牌当场报错 ---- */
T.throws(function () { S.step([1, 2, 3]); }, '牌数不对', /需要一副 54 张的牌/);
T.throws(function () { S.step('not a deck'); }, '根本不是数组', /需要一副 54 张的牌/);
T.throws(function () {
  const d = S.newDeck(); d[0] = d[1]; S.step(d);
}, '有重牌', /有重复的牌/);
T.throws(function () {
  const d = S.newDeck(); d[0] = 99; S.step(d);
}, '有越界的牌', /不是 1\.\.54 的整数/);

/* ================= 公开测试向量 =================
   这四条是 Schneier 自己公布的样例，不是本仓算出来再抄回去的期望值。
   实现与它们不一致时，错的是实现。 */
T.eq(S.encrypt('AAAAAAAAAA', S.newDeck()), 'EXKYIZSGEH',
     '标准向量：未加密的新牌 + 十个 A → EXKYIZSGEH');
T.eq(S.keyStream(S.newDeck(), 10), [4, 23, 10, 24, 8, 25, 18, 6, 4, 7],
     '同一条向量的密钥流（折成 1..26 之后）');
T.eq(S.encrypt('AAAAAAAAAAAAAAA', S.newDeck()), 'EXKYIZSGEHUNTIQ',
     '同一副牌接着往下走 15 个 A');
T.eq(S.encrypt('AAAAAAAAAAAAAAA', S.deckFromPassphrase('FOO')), 'ITHZUJIWGRFARMW',
     '口令 FOO 排序后的牌 + 十五个 A → ITHZUJIWGRFARMW');
/* SOLITAIRE 是 9 个字母，公开答案 KIRAKSFJAN 是 10 个——第 10 个字母对应的是
   发报时补到 5 的倍数的那个 X。本模块不自动补位（见 encrypt 的注释），
   所以这里显式把 X 写出来，而不是偷偷让实现去补。 */
T.eq(S.encrypt('SOLITAIREX', S.deckFromPassphrase('CRYPTONOMICON')), 'KIRAKSFJAN',
     '口令 CRYPTONOMICON + SOLITAIREX → KIRAKSFJAN');

/* ---- 未折叠的原始牌值 ----
   公开的密钥流印的是牌值本身（1..52），49 / 51 / 44 / 33 这些大于 26 的数
   正是它。value 折到 1..26 之后这条信息就没了，而工具页要把两者都画出来。 */
(function () {
  let d = S.newDeck();
  const cards = [];
  for (let i = 0; i < 15; i++) { const r = S.keyStreamValue(d); cards.push(r.card); d = r.deck; }
  T.eq(cards, [4, 49, 10, 24, 8, 51, 44, 6, 4, 33, 20, 39, 19, 34, 42],
       '公开的原始牌值序列（含 49 / 51 / 44 / 33 这些 > 26 的值）');
})();

/* ================= 取到王就不输出 =================
   这是规范正文，不是边界情况。未加密的新牌上，**第 4 个输出**之前正好会撞上
   一次：多洗一轮才拿到那个 24。漏掉这条跳过，前三个字母还对，从第四个开始
   整条流错位，而错位之后每一个字母都是错的。 */
(function () {
  let d = S.newDeck();
  const skips = [];
  for (let i = 0; i < 15; i++) { const r = S.keyStreamValue(d); skips.push(r.skips); d = r.deck; }
  T.eq(skips, [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
       '新牌的前 15 个输出里，第 4 个之前跳过了一次');
  T.eq(skips.reduce(function (a, b) { return a + b; }, 0), 1, '一共只跳了一次');
})();
(function () {
  /* 直接把那一轮拎出来：连洗三次取到三个字母之后，再洗一轮，取到的**是**王。 */
  let d = S.newDeck();
  for (let i = 0; i < 3; i++) d = S.keyStreamValue(d).deck;
  const once = S.step(d);
  const drawn = S.outputCard(once);
  T.ok(S.isJoker(drawn), '第 4 轮取到的确实是一张王（' + S.cardName(drawn) + '）');
  /* 跳过之后拿到的那个值，必须等于"再洗一轮再取"的结果——也就是说跳过
     不是丢掉一个字母，是这一轮**没有输出**。 */
  const twice = S.step(once);
  T.eq(S.keyStreamValue(d).value, C.mod(S.outputCard(twice) - 1, 26) + 1,
       '跳过王之后的输出等于再洗一轮取到的那张牌');
  T.eq(S.keyStreamValue(d).skips, 1, 'skips 如实记下这一次跳过');
})();

/* ---- 往返 ---- */
(function () {
  const MSG = 'Attack at dawn, and bring the 3 maps!';
  const PLAIN = C.normalize(MSG);
  [S.newDeck(), S.deckFromPassphrase('CRYPTONOMICON'), S.deckFromPassphrase('A')].forEach(function (d, i) {
    T.eq(S.decrypt(S.encrypt(MSG, d), d), PLAIN, '第 ' + i + ' 副牌：解密回到规约后的明文');
  });
  /* 解密要的是**一模一样的起始牌**。差一张就全错——这正是这个密码的全部
     安全性所在，也是工具页第三页要演示的那件事。这里用"把顶上两张对调"
     造出一副只差一步的牌。 */
  const d = S.newDeck();
  const off = d.slice(); const tmp = off[0]; off[0] = off[1]; off[1] = tmp;
  const ct = S.encrypt(PLAIN, d);
  T.ok(S.decrypt(ct, off) !== PLAIN, '起始牌差一张，解密就不是明文');
})();

/* ---- keyStream 的参数 ---- */
T.eq(S.keyStream(S.newDeck(), 0), [], '要 0 个就给空数组');
T.throws(function () { S.keyStream(S.newDeck(), -1); }, '个数不能为负', /非负整数/);
T.throws(function () { S.keyStream(S.newDeck(), 2.5); }, '个数必须是整数', /非负整数/);
T.eq(S.encrypt('', S.newDeck()), '', '空明文给空密文');
T.eq(S.encrypt('123 !!', S.newDeck()), '', '一个字母都没有时也给空密文');

/* ---- deckFromPassphrase ---- */
T.eq(S.deckFromPassphrase(''), S.newDeck(), '空口令不洗牌，就是那副新牌');
T.eq(S.deckFromPassphrase('foo'), S.deckFromPassphrase('FOO'), '口令大小写无关');
T.eq(S.deckFromPassphrase('f o, o!'), S.deckFromPassphrase('FOO'), '口令里的非字母被忽略');
T.ok(S.deckFromPassphrase('FOO').join() !== S.deckFromPassphrase('FOP').join(),
     '差一个字母的口令给出不同的牌');
(function () {
  const d = S.deckFromPassphrase('CRYPTONOMICON');
  T.eq(d.length, 54, '口令排序后仍是 54 张');
  T.eq(d.slice().sort(function (a, b) { return a - b; }), S.newDeck(), '仍是同一副牌的一个排列');
})();

/* ================= 两种"只改一张牌"的对照 =================
   建工具页时把"挪一张牌就雪崩"当成通则写进了文案，实测发现它只对其中一种
   改动成立。下面这组断言把那次实测钉住，免得以后有人凭直觉把两者当成一回事：

     move  把第 i 张抽出来放到最底下 —— 它把下面所有牌的下标整体挪一位，
           **并且换掉了底牌**，而底牌正是计数切牌每轮要读的那一张。
     swap  把第 i 张与第 i+1 张对调 —— 既不动底牌，也不动任何块边界。
           三重切牌与计数切牌搬的是整块、块内顺序不变，所以这个"缺陷"只是
           跟着块走，直到偶然落到要紧的位置上才第一次影响输出。

   断言写成区间而不是精确值：精确值（16 与 0）会把这条测试变成"实现的照片"，
   任何无害的重构都要来改它一次。区间钉住的是那个**量级差**，也就是工具页
   真正依赖的那件事。 */
function census(start, perturb, N) {
  const base = S.keyStream(start, N);
  let none = 0, strong = 0;
  for (let i = 0; i < 53; i++) {
    const b = S.keyStream(perturb(start, i), N);
    let d = 0;
    for (let k = 0; k < N; k++) if (base[k] !== b[k]) d++;
    if (d === 0) none++;
    if (d >= N * 0.7) strong++;
  }
  return { none: none, strong: strong };
}
const moveToBottom = function (d, i) { const x = d.slice(); x.push(x.splice(i, 1)[0]); return x; };
const swapNext = function (d, i) { const x = d.slice(); const t = x[i]; x[i] = x[i + 1]; x[i + 1] = t; return x; };

(function () {
  const N = 12;
  const mv = census(S.newDeck(), moveToBottom, N);
  const sw = census(S.newDeck(), swapNext, N);
  T.eq(mv.none, 0, '抽一张放到底：53 个位置没有一个让密钥流保持不变');
  T.ok(mv.strong >= 45,
       '抽一张放到底：至少 45/53 个位置改掉了 ' + N + ' 个输出中的大半（实测 ' + mv.strong + '）');
  T.ok(sw.none >= 8,
       '与邻牌对调：至少 8/53 个位置一个输出都没改（实测 ' + sw.none + '）—— ' +
       '"挪一张牌就雪崩"对这种改动**不**成立');
  T.ok(mv.strong > sw.strong * 3,
       '两种改动的影响差一个量级（move ' + mv.strong + ' vs swap ' + sw.strong + '）');
})();

/* 工具页第三页用的正是 move：它必须真的把报文毁掉，否则那一页在自拆台。
   swap 在这条预置上会把明文原样解出来（10/10 全中），下面把这件事也钉住——
   它不是缺陷，是"哪一张牌要紧"这句话的证据。 */
(function () {
  const start = S.deckFromPassphrase('CRYPTONOMICON');
  const plain = 'SOLITAIREX';
  const ct = S.encrypt(plain, start);
  function hits(deck) {
    const w = S.decrypt(ct, deck);
    let h = 0;
    for (let i = 0; i < plain.length; i++) if (w.charAt(i) === plain.charAt(i)) h++;
    return h;
  }
  T.eq(hits(start), 10, '同一副牌：10/10 全对');
  T.ok(hits(moveToBottom(start, 0)) <= 3,
       '顶牌抽到最底下：至多 3/10 碰巧对上（实测 ' + hits(moveToBottom(start, 0)) + '）');
  T.eq(hits(swapNext(start, 0)), 10,
       '顶上两张对调：这条预置上明文原样解出 —— 所以工具页第三页不能用它');
})();

T.report('solitaire');
