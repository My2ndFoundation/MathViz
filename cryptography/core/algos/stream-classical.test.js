'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const S = require('./stream-classical.js');
const vigenere = require('./vigenere.js');

const AB = C.ALPHABET;
function idxOf(s) { return C.letters(s); }
function strOf(a) { return C.fromIndices(a); }

/* ---- 教科书向量：引钥 QUEENLY，明文 ATTACK AT DAWN ----
   密钥流是 QUEENLY 接上明文本身（ATTAC…），所以第 8 个密钥字母起就是
   明文的第 1 个字母。这条向量在公开教材里到处都是，它同时钉住了三件事：
   规则是 c = p + k、密钥流的接法、以及"引钥用完之后接的是明文不是密文"。 */
T.eq(S.autokeyEncrypt('ATTACKATDAWN', 'QUEENLY'), 'QNXEPVYTWTWP', 'autokey 教科书向量');
T.eq(S.autokeyDecrypt('QNXEPVYTWTWP', 'QUEENLY'), 'ATTACKATDAWN', 'autokey 解密回原文');

/* 密钥流真的是 引钥 + 明文，一位不差。 */
T.eq(strOf(S.keyStreamOf('autokey', 'ATTACKATDAWN', 'QUEENLY').ks),
     'QUEENLY' + 'ATTAC', 'autokey 密钥流 = 引钥 + 明文');
T.eq(S.keyStreamOf('autokey', 'ATTACKATDAWN', 'QUEENLY').from.slice(0, 8).join(','),
     'primer,primer,primer,primer,primer,primer,primer,plain',
     'from 在第 L 位从 primer 切到 plain');
T.eq(S.keyStreamOf('autokey', 'ATTACKATDAWN', 'QUEENLY').at.slice(7, 12).join(','),
     '0,1,2,3,4', 'at 指回明文里的第 i−L 个字母');
T.eq(S.keyStreamOf('autokey', 'ATTACKATDAWN', 'QUEENLY').wrapped, false,
     'autokey 不存在密钥用完这回事');

/* ---- 引钥长度 1 是最极端的自动密钥：密钥流 = 一个字母 + 整篇明文 ---- */
T.eq(strOf(S.keyStreamOf('autokey', 'HELLO', 'D').ks), 'D' + 'HELL',
     '引钥长 1 时密钥流几乎就是明文自己');

/* ---- 滚动密钥：c = p + k，密钥是另一段英文 ---- */
T.eq(S.runningKeyEncrypt('ATTACKATDAWN', 'THEQUICKBROWN'), 'TAXQWSCDERKJ',
     'running key 向量');
T.eq(S.runningKeyDecrypt('TAXQWSCDERKJ', 'THEQUICKBROWN'), 'ATTACKATDAWN',
     'running key 解密回原文');
/* 密钥流够长时，滚动密钥**逐字节等于**以整段密钥文本为密钥的维吉尼亚——
   这不是巧合：两者的规则同为 c = p + k，密钥流也同为那段文本的前 n 个字母。
   钉住这条等式，是因为整个工具的论点建立在"这一族不是更强的多表代换，
   只是换了一份密钥流"上；哪天两份实现走岔了，这条断言会先响。 */
const RK_TEXT = 'The strength of a running key lies in the length of the key text';
T.eq(S.runningKeyEncrypt('ATTACKATDAWN', RK_TEXT),
     vigenere.encrypt('ATTACKATDAWN', RK_TEXT),
     '密钥够长时 running key 与维吉尼亚逐字节相同');

/* 密钥文本短于报文时**循环**，并且这件事必须被报出来——循环回去就是把周期
   请了回来，那是这一族真正的使用条件被违反的样子，不能静悄悄发生。 */
const shortKS = S.keyStreamOf('running', 'ATTACKATDAWN', 'KEY');
T.eq(shortKS.wrapped, true, '密钥文本比报文短时 wrapped 为 true');
T.eq(strOf(shortKS.ks), 'KEYKEYKEYKEY', '短密钥循环，周期回来了');
T.eq(S.runningKeyEncrypt('ATTACKATDAWN', 'KEY'),
     vigenere.encrypt('ATTACKATDAWN', 'KEY'),
     '循环之后它就**是**维吉尼亚');
T.eq(S.keyStreamOf('running', 'ATTACK', RK_TEXT).wrapped, false,
     '密钥够长时 wrapped 为 false');

/* ---- 大小写与非字母：与 vigenere.js 同一条约定 ---- */
T.eq(S.autokeyEncrypt('Attack at dawn!', 'QUEENLY'), 'Qnxepv yt wtwp!',
     'autokey 保留大小写与标点');
T.eq(S.runningKeyEncrypt('Attack at dawn!', 'THEQUICKBROWN'), 'Taxqws cd erkj!',
     'running key 保留大小写与标点');
/* 非字母**不消耗密钥**：去掉标点后的密文必须与直接加密无标点文本完全相同。
   这一条比"保留标点"要紧得多——页面上那条从明文格连到密钥格的丝带正是按
   "第 j 个字母配第 j 个密钥字母"画的，若空格也吃掉一个密钥字母，画面与
   密文就会在标点处静静地错开。 */
T.eq(C.normalize(S.autokeyEncrypt('Attack at dawn!', 'QUEENLY')),
     S.autokeyEncrypt('ATTACKATDAWN', 'QUEENLY'), 'autokey 非字母不消耗密钥');
T.eq(C.normalize(S.runningKeyEncrypt('Attack at dawn!', 'THEQUICKBROWN')),
     S.runningKeyEncrypt('ATTACKATDAWN', 'THEQUICKBROWN'), 'running key 非字母不消耗密钥');
T.eq(S.autokeyEncrypt('中文 123', 'KEY'), '中文 123', '非 ASCII 与数字原样穿过');

/* ---- 性质：往返 ----
   引钥长度扫 1..8，明文里带标点、大小写与非 ASCII。自动密钥的解密是自举的
   （密钥流一边解一边长出来），所以往返比维吉尼亚那边更值得逐个长度地钉。 */
const SAMPLE = 'The Quick Brown Fox Jumps Over 13 Lazy Dogs! —— 中文';
for (let L = 1; L <= 8; L++) {
  const primer = AB.slice(0, L);
  T.eq(S.autokeyDecrypt(S.autokeyEncrypt(SAMPLE, primer), primer), SAMPLE,
       'autokey 往返，引钥长 ' + L);
}
for (let n = 1; n <= 8; n++) {
  const key = AB.slice(0, n) + RK_TEXT;
  T.eq(S.runningKeyDecrypt(S.runningKeyEncrypt(SAMPLE, key), key), SAMPLE,
       'running key 往返，密钥前缀长 ' + n);
}

/* ---- 统一入口与专用函数是同一份行为 ---- */
T.eq(S.encryptWith('autokey', SAMPLE, 'QUEENLY'), S.autokeyEncrypt(SAMPLE, 'QUEENLY'),
     'encryptWith(autokey) 就是 autokeyEncrypt');
T.eq(S.decryptWith('running', SAMPLE, RK_TEXT), S.runningKeyDecrypt(SAMPLE, RK_TEXT),
     'decryptWith(running) 就是 runningKeyDecrypt');

/* ---- 空密钥：抛，不退化 ---- */
T.throws(function () { S.autokeyEncrypt('ABC', '!!!'); },
         'autokey 空引钥当场抛', /引钥至少要含一个字母/);
T.throws(function () { S.runningKeyEncrypt('ABC', ''); },
         'running key 空密钥文本当场抛', /密钥文本至少要含一个字母/);
T.throws(function () { S.keyStreamOf('autokey', 'ABC', ' '); },
         'keyStreamOf 也走同一道守卫', /引钥至少要含一个字母/);
T.throws(function () { S.cribDrag('ABCDEF', '  '); },
         'cribDrag 的 crib 不能没有字母', /至少要含一个字母/);
T.throws(function () { S.autokeyPropagate('ABCDEF', 0, 0, [0]); },
         '引钥长度 0 没有意义', /引钥长度必须是 >= 1 的整数/);

/* ================= 拖词 ================= */
{
  const plain = 'ATTACKATDAWNANDBRINGTHELADDERS';
  const primer = 'QUEENLY';
  const cipher = S.autokeyEncrypt(plain, primer);
  const drags = S.cribDrag(cipher, 'ATTACK');
  T.eq(drags.length, C.letters(cipher).length - 6 + 1, 'cribDrag 的位置数 = n − m + 1');
  T.eq(drags[0].offset, 0, '第一个位置是 0');
  /* 真正的 offset 上，derived 必须**正好等于**那一段密钥流。这是拖词攻击
     成立的全部理由：猜对了明文，密钥就当场露出来。 */
  const ks = S.keyStreamOf('autokey', plain, primer).ks;
  T.eq(drags[0].derived, strOf(ks.slice(0, 6)), '猜对的位置 derived = 那一段密钥流');
  /* 自动密钥下那一段密钥流又正好是引钥（offset 0 < L）——所以拖对了一次，
     引钥就直接掉出来了。 */
  T.eq(drags[0].derived, primer.slice(0, 6), 'offset 0 处 derived 就是引钥前 6 位');

  /* 滚动密钥下 derived 是**另一段英文**：同一条代数，泄漏的东西不同。 */
  const rkCipher = S.runningKeyEncrypt(plain, RK_TEXT);
  const rkDrags = S.cribDrag(rkCipher, 'ATTACK');
  T.eq(rkDrags[0].derived, C.normalize(RK_TEXT).slice(0, 6),
       'running key 猜对的位置 derived 是密钥文本的片段');
  /* idx 与 derived 是同一份内容的两种形状，页面两边都要用。 */
  T.eq(strOf(rkDrags[3].idx), rkDrags[3].derived, 'idx 与 derived 一致');
}

/* ================= 传播 ================= */
{
  const plain = 'ATTACKATDAWNANDBRINGTHELADDERSTOTHEEASTWALLBEFOREITGETSLIGHT';
  const primer = 'QUEENLY';           // L = 7
  const cipher = S.autokeyEncrypt(plain, primer);
  const pIdx = idxOf(plain);
  const n = pIdx.length;

  /* crib 长度 m 恰好命中 m 条同余类：恢复的下标正是 mod L 落在
     {offset … offset+m−1} 里的那些。这条不是近似，是可以逐位数出来的。 */
  for (let m = 1; m <= 7; m++) {
    const offset = 10;
    const r = S.autokeyPropagate(cipher, primer.length, offset, pIdx.slice(offset, offset + m));
    let want = 0;
    const classes = {};
    for (let i = 0; i < m; i++) classes[(offset + i) % primer.length] = 1;
    for (let i = 0; i < n; i++) if (classes[i % primer.length]) want++;
    T.eq(r.count, want, 'crib 长 ' + m + ' 恢复 ' + m + ' 条同余类');
    /* 恢复出来的每一位都必须**真的对**——数量对而内容错是最坏的一种绿。 */
    let allRight = true;
    for (let i = 0; i < n; i++) {
      if (r.known[i] >= 0 && r.known[i] !== pIdx[i]) allRight = false;
      if (r.known[i] < 0 && classes[i % primer.length]) allRight = false;
    }
    T.ok(allRight, 'crib 长 ' + m + ' 恢复出的位置逐位正确');
  }

  /* m >= L：整篇明文连同引钥一起掉出来。这就是这一页的落点——
     自动密钥省下了"另外传一份密钥"，代价是猜对 L 个字母就全丢。 */
  const full = S.autokeyPropagate(cipher, primer.length, 10, pIdx.slice(10, 10 + primer.length));
  T.eq(full.count, n, 'crib 长度 = 引钥长度时整篇明文恢复');
  T.eq(strOf(full.known), C.normalize(plain), '恢复出的明文与原文逐字相同');
  T.eq(strOf(full.primer), primer, '引钥本身也一起掉出来');

  /* 猜错的 crib 不会报错，只会给出一串错的明文——攻击者靠"读起来像不像
     英文"来判断，不靠工具替他判断。这条断言钉住"错了也不抛"这件事，
     因为页面每一帧都在调它。 */
  const wrong = S.autokeyPropagate(cipher, primer.length, 10, idxOf('ZZZZZZZ'));
  T.eq(wrong.count, n, '猜错时同样"恢复"满篇');
  T.ok(strOf(wrong.known) !== C.normalize(plain), '但内容是错的');

  /* 越界的 crib 位置被忽略，不越界的那部分照常传播。 */
  const edge = S.autokeyPropagate(cipher, primer.length, n - 2, [0, 1, 2, 3]);
  T.ok(edge.count > 0 && edge.count <= n, '越界的 crib 位置被忽略而不是崩掉');
}

/* ================= 与维吉尼亚的关系 =================
   这两族的全部区别就是密钥流：把密钥流换成重复的密钥，autokey 的规则原样
   变回维吉尼亚。所以拿"引钥 = 全篇"这种退化情形去比是没有意义的，真正该钉的
   是上面那条 running key 等式，以及下面这条：自动密钥的密文**不等于**同一把
   引钥当维吉尼亚密钥时的密文（除非明文恰好等于密钥的循环延拓）。 */
{
  const plain = 'ATTACKATDAWNANDBRINGTHELADDERS';
  T.ok(S.autokeyEncrypt(plain, 'QUEENLY') !== vigenere.encrypt(plain, 'QUEENLY'),
       'autokey 与同引钥的维吉尼亚不是同一串密文');
  /* 但前 L 位必然相同——那一段的密钥流就是引钥本身。这条把"差别从第 L+1 位
     才开始"这件事钉在明处。 */
  T.eq(S.autokeyEncrypt(plain, 'QUEENLY').slice(0, 7),
       vigenere.encrypt(plain, 'QUEENLY').slice(0, 7),
       '前 L 位相同：那一段密钥流就是引钥');
}

T.report('stream-classical');
