(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js 那一行完全相同——这个字符串会被
       inline_core.py 原样内联进每个工具页，而 check.py 的 outbound_ref_check()
       正在数整个子树里的父目录引用，用它守住"cryptography/ 可以整体搬走"。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.solitaire = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= Solitaire（Schneier 的手牌流密码） =================
     一副 54 张的牌**就是**密钥状态：牌序是内部状态，四步固定的洗牌过程是
     状态转移函数，取一张牌读出字母是输出函数。这三件东西正是任何一个流密码
     的全部零件——只不过这一台不用电。

     牌的表示：1..52 是 52 张普通牌（梅花 A..K = 1..13，方块 = 14..26，
     红心 = 27..39，黑桃 = 40..52），53 是 A 王、54 是 B 王。
     两张王在**计数**时的值都是 53（cardValue），但它们的**身份**必须分得开：
     三重切牌要认"哪张王在上"，移动规则也是 A 王走一格、B 王走两格。
     把两张王都写成 53 会让 indexOf 永远找到同一张，整个算法静静地跑歪。 */

  const DECK_SIZE = 54;
  const JOKER_A = 53;
  const JOKER_B = 54;
  const JOKER_VALUE = 53;

  function isJoker(card) { return card === JOKER_A || card === JOKER_B; }
  function cardValue(card) { return isJoker(card) ? JOKER_VALUE : card; }

  /* 未加密的"新牌"顺序：梅花 A→K、方块 A→K、红心 A→K、黑桃 A→K，最后两张王。
     公开的标准测试向量（AAAAAAAAAA → EXKYIZSGEH）就是从这副牌出发的，所以
     这个顺序不是随手定的约定，是那条向量的一半前提。 */
  function newDeck() {
    const d = [];
    for (let i = 1; i <= DECK_SIZE; i++) d.push(i);
    return d;
  }

  const SUITS = ['C', 'D', 'H', 'S'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* 花色下标 0..3（梅花/方块/红心/黑桃），王返回 −1。工具页要靠它给红黑上色，
     而"哪张牌是什么"是这个密码自己的词汇表，不是页面的装饰。 */
  function cardSuit(card) { return isJoker(card) ? -1 : Math.floor((card - 1) / 13); }
  function cardRank(card) { return isJoker(card) ? -1 : (card - 1) % 13; }
  function cardName(card) {
    if (card === JOKER_A) return 'A*';
    if (card === JOKER_B) return 'B*';
    return RANKS[cardRank(card)] + SUITS[cardSuit(card)];
  }

  /* 每个公开入口都先验一次牌。一副坏牌（缺牌、重牌、越界）不会让任何一步抛错，
     它只会让密钥流悄悄变成另一条——而那正是"解不出来但也说不清为什么"的
     那种故障。54 次循环换一个当场可见的错误，便宜。 */
  function checkDeck(deck, name) {
    if (!Array.isArray(deck) || deck.length !== DECK_SIZE) {
      throw new Error(name + ' 需要一副 ' + DECK_SIZE + ' 张的牌，收到 ' +
                      (Array.isArray(deck) ? deck.length + ' 张' : typeof deck));
    }
    const seen = [];
    for (let i = 0; i < DECK_SIZE; i++) {
      const c = deck[i];
      if (!Number.isInteger(c) || c < 1 || c > DECK_SIZE) {
        throw new Error(name + ' 的第 ' + i + ' 张不是 1..' + DECK_SIZE + ' 的整数：' + c);
      }
      if (seen[c]) throw new Error(name + ' 里有重复的牌：' + c);
      seen[c] = 1;
    }
    return deck;
  }

  /* ---- 四步操作。全部**纯函数**：返回新数组，绝不改调用方的那一副。 ----
     这不是洁癖。工具页的时间轴要能一步一步往回退，而"往回退"的实现是
     "把之前那一副拿出来重画"——一个就地洗牌的实现会把历史里的每一副
     都改成同一副，⏮ 于是变成一个什么也不做的按钮。 */

  /* 把某张王往下移 n 格。牌堆在这一步上被当成**环**看：滑到底之后从
     "第一张的下面"接着数，也就是说下标 0（最上面那一张）永远不会被王占住。
     54 张的牌抽掉那张王之后剩 53 张，可插入的下标是 0..53；越过 53 就减去 53，
     正好把 0 跳过去。三条边界因此不必各写一遍：
       A 王在底（下标 53）走 1 → 54 → 1，落在第一张下面；
       B 王在倒数第二（52）走 2 → 54 → 1，落在第一张下面；
       B 王在底（53）走 2 → 55 → 2，落在第二张下面。 */
  function moveDown(deck, card, n) {
    const out = deck.slice();
    const i = out.indexOf(card);
    out.splice(i, 1);
    let j = i + n;
    if (j > DECK_SIZE - 1) j -= (DECK_SIZE - 1);
    out.splice(j, 0, card);
    return out;
  }

  function moveJokerA(deck) { checkDeck(deck, 'moveJokerA'); return moveDown(deck, JOKER_A, 1); }
  function moveJokerB(deck) { checkDeck(deck, 'moveJokerB'); return moveDown(deck, JOKER_B, 2); }

  /* 三重切牌：两张王之间的那一段（含两张王）原地不动，它上面的一整段与
     它下面的一整段**整体对调**。注意判据是"位置上谁在前"，不是"A 王还是
     B 王"——上一步刚把两张王各自挪过，谁在上面每一轮都可能换。 */
  function tripleCut(deck) {
    checkDeck(deck, 'tripleCut');
    const a = deck.indexOf(JOKER_A);
    const b = deck.indexOf(JOKER_B);
    const p = Math.min(a, b);
    const q = Math.max(a, b);
    return deck.slice(q + 1).concat(deck.slice(p, q + 1), deck.slice(0, p));
  }

  /* 计数切牌：看**最底下**那张牌的值 k，把最上面 k 张整体搬到底牌的正上方，
     底牌自己留在原位。n 省略时用底牌的值（正常的第四步）；显式传 n 是
     deckFromPassphrase 用的那次"额外切牌"。
     底牌是王时 k = 53，slice(53, 53) 是空段，结果与原牌逐张相同——
     这不是需要特判的边界，是这条规则自带的恒等情形。 */
  function countCut(deck, n) {
    checkDeck(deck, 'countCut');
    const bottom = deck[DECK_SIZE - 1];
    const k = (n == null) ? cardValue(bottom) : n;
    if (!Number.isInteger(k) || k < 1 || k > JOKER_VALUE) {
      throw new Error('countCut 的计数必须是 1..' + JOKER_VALUE + ' 的整数，收到 ' + k);
    }
    return deck.slice(k, DECK_SIZE - 1).concat(deck.slice(0, k), [bottom]);
  }

  /* 一轮 = 四步，顺序固定。顺序本身就是密钥调度，换一换就是另一个密码。 */
  function step(deck) {
    checkDeck(deck, 'step');
    return countCut(tripleCut(moveJokerB(moveJokerA(deck))));
  }

  /* 一轮拆成四帧，给动画用：每一项是"做完这一步之后"的牌。
     op 是稳定的英文键（jokerA / jokerB / tripleCut / countCut），不是给人看的
     文案——双语文案属于工具页，算法模块不该长出一个 zh 字段。 */
  const OPS = ['jokerA', 'jokerB', 'tripleCut', 'countCut'];
  function stepStages(deck) {
    checkDeck(deck, 'stepStages');
    const out = [];
    let d = moveJokerA(deck); out.push({ op: OPS[0], deck: d });
    d = moveJokerB(d);        out.push({ op: OPS[1], deck: d });
    d = tripleCut(d);         out.push({ op: OPS[2], deck: d });
    d = countCut(d);          out.push({ op: OPS[3], deck: d });
    return out;
  }

  /* 输出步：看最上面那张牌的值 n，数下去 n 张，取**再下一张**。
     顶牌是王时 n = 53，取的正好是最底下那张，下标合法，不必特判。 */
  function outputCard(deck) { return deck[cardValue(deck[0])]; }

  /* 取一个密钥流字母。**取到王就不输出**，接着再洗一轮——这一条是规范的
     正文，不是边界情况：它是这台机器唯一的不定时输出，也是"每 54 张里有
     2 张会让这一轮白跑"这件事在密钥流上留下的痕迹。漏掉它，前几个字母
     还对，撞上第一张王之后整条流就整体错位，而错位之后每一个字母都是错的。

     返回 { value, card, deck, skips }：value 是 1..26 的字母值，card 是那张
     牌的原始值（1..52，27..52 与 1..26 折到同一个字母——公开向量里印的
     49、51、44、33 就是这些没折过的原始值），deck 是取完之后的新牌，
     skips 是这一次为了跳过王而多洗的轮数。 */
  const MAX_SKIP = 1000;
  function keyStreamValue(deck) {
    checkDeck(deck, 'keyStreamValue');
    let d = deck;
    let skips = 0;
    for (;;) {
      d = step(d);
      const card = outputCard(d);
      if (!isJoker(card)) {
        return { value: C.mod(card - 1, 26) + 1, card: card, deck: d, skips: skips };
      }
      skips++;
      /* 这个上限只为把"死循环"变成"报错"。牌堆的演化没有已知的不动点，
         真撞上它说明输入或实现坏了，而一个转不停的页面比一条异常难查得多。 */
      if (skips > MAX_SKIP) {
        throw new Error('keyStreamValue 连续 ' + MAX_SKIP + ' 轮都取到王——牌堆或实现有问题');
      }
    }
  }

  /* n 个密钥流字母值（1..26）。要看每一步的牌，逐次调 keyStreamValue。 */
  function keyStream(deck, n) {
    checkDeck(deck, 'keyStream');
    if (!Number.isInteger(n) || n < 0) {
      throw new Error('keyStream 的个数必须是非负整数，收到 ' + n);
    }
    const out = [];
    let d = deck;
    for (let i = 0; i < n; i++) {
      const r = keyStreamValue(d);
      out.push(r.value);
      d = r.deck;
    }
    return out;
  }

  /* 明文先规约成纯 A–Z（手牌密码本来就只处理字母；空格与标点在纸笔上不存在）。
     **不**自动补 X 到 5 的倍数：分组补位是发报的习惯，不是密码的一部分，而
     自动补位会让 decrypt(encrypt(p)) 多出几个字母，工具页上那条"往返回到原文"
     的演示就不再成立。公开向量里 SOLITAIRE → KIRAKSFJAN 的第 10 个字母正是
     补上去的那个 X，所以测试里显式写成 SOLITAIREX。 */
  function encrypt(text, deck) {
    const idx = C.letters(text);
    const ks = keyStream(deck, idx.length);
    let out = '';
    for (let i = 0; i < idx.length; i++) out += C.ALPHABET.charAt(C.mod(idx[i] + ks[i], C.N));
    return out;
  }

  function decrypt(text, deck) {
    const idx = C.letters(text);
    const ks = keyStream(deck, idx.length);
    let out = '';
    for (let i = 0; i < idx.length; i++) out += C.ALPHABET.charAt(C.mod(idx[i] - ks[i], C.N));
    return out;
  }

  /* 用口令给牌排序：每个口令字母做一轮**四步**，再用这个字母的值（A=1..Z=26）
     多做一次计数切牌。口令因此不是密钥本身——密钥永远是那副牌，口令只是把
     新牌洗到某个位置的一串指令。这也是这个密码最脆的地方：口令的熵远小于
     54! ≈ 2^226，而使用者会以为自己拿到了后者。 */
  function deckFromPassphrase(phrase) {
    const idx = C.letters(phrase);
    let d = newDeck();
    for (let i = 0; i < idx.length; i++) {
      d = step(d);
      d = countCut(d, idx[i] + 1);
    }
    return d;
  }

  return {
    DECK_SIZE, JOKER_A, JOKER_B, JOKER_VALUE, OPS,
    newDeck, isJoker, cardValue, cardSuit, cardRank, cardName,
    moveJokerA, moveJokerB, tripleCut, countCut, step, stepStages,
    outputCard, keyStreamValue, keyStream,
    encrypt, decrypt, deckFromPassphrase
  };
});
