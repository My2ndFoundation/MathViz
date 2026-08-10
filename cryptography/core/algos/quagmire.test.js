'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const CA = require('../cryptanalysis.js');
const quag = require('./quagmire.js');
const vig = require('./vigenere.js');
const sub = require('./substitution.js');

/* ================= 公开表格：逐字节复核 =================
   这是全文件唯一不依赖任何其它断言、可以拿眼睛对着抄的锚点，取自 CryptoCrack
   用户手册的 Quagmire I 例子（明文关键词 PAULBRANDT、指示词 BRANDT）。
   对齐规则就是从这张表反推出来的，所以它必须原样钉住：改坏了对齐，
   下面所有"往返成立""与维吉尼亚一致"的断言仍然会全绿，只有这一条会红。 */
const Q1 = quag.tableau({ variant: 1, ptKey: 'PAULBRANDT', indicator: 'BRANDT' });
T.eq(Q1.pt, 'PAULBRNDTCEFGHIJKMOQSVWXYZ', 'Quagmire I 的明文表');
T.eq(Q1.ct, C.ALPHABET, 'Quagmire I 的密文表是顺序表');
T.eq(Q1.aCol, 1, "pt 里 A 在第 1 列");
T.eq(Q1.rows.map(function (r) { return r.letters; }), [
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'QRSTUVWXYZABCDEFGHIJKLMNOP',
  'ZABCDEFGHIJKLMNOPQRSTUVWXY',
  'MNOPQRSTUVWXYZABCDEFGHIJKL',
  'CDEFGHIJKLMNOPQRSTUVWXYZAB',
  'STUVWXYZABCDEFGHIJKLMNOPQR'
], 'Quagmire I 的六行与公开示例逐字节相同');
T.eq(Q1.rows.map(function (r) { return r.key; }), ['B', 'R', 'A', 'N', 'D', 'T'], '行首就是指示词');

/* 对齐规则本身：每一行的指示字母必须落在 aCol 那一列。这条断言不看具体表，
   所以它对四个变体、任何关键词都成立——上面那张表只钉住了其中一个实例。 */
[1, 2, 3, 4].forEach(function (v) {
  const o = { variant: v, indicator: 'FLOWER' };
  if (quag.variants()[v - 1].ptKeyed) o.ptKey = 'SPRINGFEVER';
  if (quag.variants()[v - 1].ctKeyed && !quag.variants()[v - 1].shared) o.ctKey = 'AUTUMNLEAVES';
  const tab = quag.tableau(o);
  tab.rows.forEach(function (r, j) {
    T.eq(r.letters.charAt(tab.aCol), r.key,
         '变体 ' + tab.roman + ' 第 ' + j + ' 行的指示字母落在 A 列');
    T.eq(r.letters.length, 26, '变体 ' + tab.roman + ' 第 ' + j + ' 行是完整的 26 个字母');
  });
});

/* ================= 身份一：不编钥匙 → 逐字节就是维吉尼亚 =================
   这是整个工具页的支点，也是"Quagmire 是维吉尼亚的推广"这句话的全部内容。
   四个变体各钉一条：两张表都不编钥匙时 pt = ct = A–Z、aCol = 0、旋转量就是
   指示字母的下标，于是 row[col] = ALPHABET[(col + k) mod 26] 而 col 就是明文
   字母本身的下标。

   **省略参数**这条调用方式必须一起测：normalize() 走的是 String(word)，
   undefined 会变成字面的 'UNDEFINED'（九个货真价实的字母）。开发时实测过这一幕，
   密文看上去完全正常而四条等价断言全红。所以这里既测 ptKey 显式给空串，
   也测整个键不写。 */
const SAMPLE = 'The Quick Brown Fox Jumps Over 13 Lazy Dogs! —— 中文';
[1, 2, 3, 4].forEach(function (v) {
  T.eq(quag.encrypt(SAMPLE, { variant: v, indicator: 'LEMON' }),
       vig.encrypt(SAMPLE, 'LEMON'),
       '变体 ' + v + '：省略两把关键词 → 逐字节等于维吉尼亚');
  T.eq(quag.encrypt(SAMPLE, { variant: v, indicator: 'LEMON', ptKey: '', ctKey: '' }),
       vig.encrypt(SAMPLE, 'LEMON'),
       '变体 ' + v + '：显式空关键词 → 逐字节等于维吉尼亚');
  T.eq(quag.encrypt(SAMPLE, { variant: v, indicator: 'LEMON', ptKey: '123 !', ctKey: '!!' }),
       vig.encrypt(SAMPLE, 'LEMON'),
       '变体 ' + v + '：一个字母都没有的关键词同样是顺序表');
});
/* 反过来钉一条对照组：**编了**钥匙就不该再等于维吉尼亚。否则上面那些断言在一份
   "关键词根本没被用上"的错误实现里也是全绿的。 */
T.ok(quag.encrypt(SAMPLE, { variant: 3, ptKey: 'SPRINGFEVER', indicator: 'LEMON' }) !==
     vig.encrypt(SAMPLE, 'LEMON'),
     '编了钥匙之后不再等于维吉尼亚（对照组）');

/* ================= 身份二：四个变体的往返 ================= */
const KEYWORDS = [['', ''], ['ZEBRA', 'HORIZON'], ['SPRINGFEVER', 'AUTUMNLEAVES'],
                  ['A', 'Z'], ['THEQUICKBROWNFOX', 'JUMPSOVERTHELAZYDOG']];
const INDS = ['A', 'D', 'LEMON', 'FORTIFICATION', 'ZZZ', 'ab cd'];
[1, 2, 3, 4].forEach(function (v) {
  const m = quag.variants()[v - 1];
  KEYWORDS.forEach(function (kw) {
    INDS.forEach(function (ind) {
      const o = { variant: v, indicator: ind };
      if (m.ptKeyed) o.ptKey = kw[0];
      if (m.ctKeyed && !m.shared) o.ctKey = kw[1];
      T.eq(quag.decrypt(quag.encrypt(SAMPLE, o), o), SAMPLE,
           '变体 ' + v + ' 往返 pt=' + JSON.stringify(kw[0]) + ' ind=' + ind);
    });
  });
});

/* ================= 变体之间必须真的不同 =================
   同一把关键词、同一个指示词下，I / II / III / IV 应当给出四份不同的密文。
   少了这一条，一份"variant 参数收下就扔"的实现照样能通过上面全部往返断言。 */
const four = [1, 2, 3, 4].map(function (v) {
  const m = quag.variants()[v - 1];
  const o = { variant: v, indicator: 'FLOWER' };
  if (m.ptKeyed) o.ptKey = 'SPRINGFEVER';
  if (m.ctKeyed && !m.shared) o.ctKey = 'AUTUMNLEAVES';
  return quag.encrypt('ATTACKATDAWNANDBRINGTHELADDER', o);
});
for (let a = 0; a < 4; a++) {
  for (let b = a + 1; b < 4; b++) {
    T.ok(four[a] !== four[b], '变体 ' + (a + 1) + ' 与 ' + (b + 1) + ' 的密文不同');
  }
}
/* III 是"IV 的两把关键词相同"这个特例——不是一句说法，是可以对拢的两份密文。
   注意 IV 收两把关键词、III 只收一把，所以这里必须分别构造。 */
T.eq(quag.encrypt(SAMPLE, { variant: 3, ptKey: 'SPRINGFEVER', indicator: 'FLOWER' }),
     quag.encrypt(SAMPLE, { variant: 4, ptKey: 'SPRINGFEVER', ctKey: 'SPRINGFEVER', indicator: 'FLOWER' }),
     'III === IV 的两把关键词相同');
/* I 是"IV 的密文关键词为空"、II 是"IV 的明文关键词为空"。 */
T.eq(quag.encrypt(SAMPLE, { variant: 1, ptKey: 'ZEBRA', indicator: 'FLOWER' }),
     quag.encrypt(SAMPLE, { variant: 4, ptKey: 'ZEBRA', ctKey: '', indicator: 'FLOWER' }),
     'I === IV 的 ctKey 为空');
T.eq(quag.encrypt(SAMPLE, { variant: 2, ctKey: 'ZEBRA', indicator: 'FLOWER' }),
     quag.encrypt(SAMPLE, { variant: 4, ptKey: '', ctKey: 'ZEBRA', indicator: 'FLOWER' }),
     'II === IV 的 ptKey 为空');

/* ================= 大小写、非字母、以及"非字母不消耗指示词" ================= */
const OPT3 = { variant: 3, ptKey: 'SPRINGFEVER', indicator: 'LEMON' };
T.eq(quag.encrypt('Attack at dawn!', OPT3).length, 'Attack at dawn!'.length, '长度不变');
T.ok(/^[A-Z][a-z]{5} [a-z]{2} [a-z]{4}!$/.test(quag.encrypt('Attack at dawn!', OPT3)),
     '大小写与标点原样保留');
/* 关键的一条：空格没有吃掉指示字母。'ABCDE' 与 'AB CDE' 的字母序列相同，密文的
   字母序列就必须相同——否则密文周期不再等于指示词长度，工具页第二页整页建立在
   那件事上的分析会全部失效，而画面上不会有任何提示。 */
T.eq(C.normalize(quag.encrypt('AB CDE', OPT3)), C.normalize(quag.encrypt('ABCDE', OPT3)),
     '非字母不消耗指示词');
T.eq(quag.encrypt('中文 123', OPT3), '中文 123', '一个字母都没有时原样穿过');
T.eq(quag.encrypt(SAMPLE, { variant: 3, ptKey: 'spring fever!', indicator: 'le mon' }),
     quag.encrypt(SAMPLE, OPT3), '关键词与指示词都归一化（大小写与空格）');

/* ================= 每一列就是一张单表代换 =================
   cosetKeys() 返回的每一条都必须是 substitution.js 认的合法密钥，而且拿它把
   第 j 列明文加密一遍，得到的就是第 j 列密文。工具页第三页整页建立在这件事上，
   而且它在页面上也是当场跑的（见那一页的 subCheck）。 */
const COS_OPT = { variant: 4, ptKey: 'SPRINGFEVER', ctKey: 'AUTUMNLEAVES', indicator: 'FLOWER' };
const keys = quag.cosetKeys(COS_OPT);
T.eq(keys.length, 6, 'cosetKeys 的条数 = 指示词长度');
keys.forEach(function (k, j) {
  T.ok(sub.isValidKey(k), '第 ' + j + ' 列的密钥是 A–Z 的一个排列');
});
const PT_LONG = 'ATTACKATDAWNANDBRINGTHELADDERBECAUSETHEWALLISHIGHERTHANITLOOKS';
const CT_LONG = quag.encrypt(PT_LONG, COS_OPT);
const pcols = CA.columnsForPeriod(PT_LONG, 6);
const ccols = CA.columnsForPeriod(CT_LONG, 6);
for (let j = 0; j < 6; j++) {
  T.eq(sub.encrypt(pcols[j], keys[j]), ccols[j],
       '第 ' + j + ' 列：substitution.encrypt(明文列, cosetKeys[j]) === 密文列');
}
/* 反方向也走一遍：单表代换的逆密钥解得开这一列。 */
for (let j = 0; j < 6; j++) {
  T.eq(sub.decrypt(ccols[j], keys[j]), pcols[j], '第 ' + j + ' 列可用同一张表解回去');
}
/* 维吉尼亚是它的特例：不编钥匙时每一张列密钥恰好是字母表整体转 k 位，
   也就是凯撒。26! 里只剩 26 个——这正是工具页第三页说"被打掉的是最后一步"
   的量化版本。 */
quag.cosetKeys({ variant: 3, indicator: 'LEMON' }).forEach(function (k, j) {
  const shift = C.letters('LEMON')[j];
  T.eq(k, C.ALPHABET.slice(shift) + C.ALPHABET.slice(0, shift),
       '不编钥匙时第 ' + j + ' 列密钥就是位移 ' + shift + ' 的字母表');
});

/* ================= 逐周期重合指数：周期这一步没被动过 =================
   工具页第二页的全部内容。在**真周期以及它的每一个倍数**上，Quagmire 密文与
   同明文同指示词的维吉尼亚密文的逐周期重合指数**逐位相同**——不是接近，是差 0。
   理由：那些周期上每一列装的是同一批明文字母，两边各给它们套了一个双射
   （维吉尼亚是位移、Quagmire 是一张单表），而重合指数只看"每个字母出现几次"
   这个多重集合，换名字不影响它。

   建这一页时的普查：896 段密文 × 20 个候选周期，凡是真周期的倍数，差恒为 0，
   3472 个取值一个例外都没有；不是倍数的那 14448 个取值上最大差 0.43。
   下面这几条是那次普查的可复现切片。 */
const IC_TEXT = ('A repeating key does not invent a new cipher. It interleaves several old ones, ' +
  'and every column of the message still belongs to a single shifted alphabet. Counting letters ' +
  'over the whole message averages those alphabets together, which is exactly why the count stops ' +
  'looking like English. Find the period and the average comes apart again, one column at a time.');
['HORIZON', 'LEMON', 'AB'].forEach(function (ind) {
  const L = ind.length;
  const icV = CA.icByPeriod(vig.encrypt(IC_TEXT, ind), 20);
  [1, 2, 3, 4].forEach(function (v) {
    const m = quag.variants()[v - 1];
    const o = { variant: v, indicator: ind };
    if (m.ptKeyed) o.ptKey = 'SPRINGFEVER';
    if (m.ctKeyed && !m.shared) o.ctKey = 'AUTUMNLEAVES';
    const icQ = CA.icByPeriod(quag.encrypt(IC_TEXT, o), 20);
    for (let p = L; p <= 20; p += L) {
      T.eq(icQ[p - 1].ic, icV[p - 1].ic,
           '变体 ' + v + ' ind=' + ind + '：p=' + p + '（真周期的倍数）处重合指数与维吉尼亚**相同**');
    }
  });
});
/* 对照组：不是倍数的那些 p 上两条曲线**不该**恒等。少了这一条，一份
   "Quagmire 其实没加密、直接返回维吉尼亚密文"的实现会让上面全部断言变绿。 */
(function () {
  const icV = CA.icByPeriod(vig.encrypt(IC_TEXT, 'HORIZON'), 20);
  const icQ = CA.icByPeriod(quag.encrypt(IC_TEXT,
    { variant: 3, ptKey: 'SPRINGFEVER', indicator: 'HORIZON' }), 20);
  let diff = 0;
  for (let p = 1; p <= 20; p++) if (p % 7 !== 0) diff = Math.max(diff, Math.abs(icQ[p - 1].ic - icV[p - 1].ic));
  T.ok(diff > 1e-6, '非倍数的 p 上两条曲线确实不同（差 ' + diff.toFixed(5) + '，对照组）');
})();
/* 每一列仍然是单表：真周期处的逐列重合指数回到英文档位，而整段密文被压向随机。 */
(function () {
  const ct = quag.encrypt(IC_TEXT, { variant: 4, ptKey: 'ZEBRA', ctKey: 'HORIZON', indicator: 'HORIZON' });
  const ic = CA.icByPeriod(ct, 20);
  T.ok(ic[0].ic < 0.05, '整段 Quagmire 密文的重合指数被压向随机（' + ic[0].ic.toFixed(4) + '）');
  T.ok(ic[6].ic > 0.06, '按真周期 7 分列后每列回到英文档位（' + ic[6].ic.toFixed(4) + '）');
  T.ok(ic[6].ic > ic[5].ic && ic[6].ic > ic[7].ic, '真周期处高于两侧邻居');
})();

/* ================= variants() ================= */
T.eq(quag.variants().map(function (v) { return v.roman; }), ['I', 'II', 'III', 'IV'], '四个变体');
T.eq(quag.variants().map(function (v) { return [v.ptKeyed, v.ctKeyed, v.shared]; }),
     [[true, false, false], [false, true, false], [true, true, true], [true, true, false]],
     '四个变体的结构事实');
/* 返回的是浅拷贝：调用方改坏一份不会把这个模块变成另一个密码。 */
(function () {
  const a = quag.variants();
  a[0].shared = true;
  T.eq(quag.variants()[0].shared, false, 'variants() 返回浅拷贝，改不动内部表');
})();

/* ================= 变体号的写法 ================= */
const ROMAN_OPT = { ptKey: 'ZEBRA', indicator: 'LEMON' };
['I', 'i', ' I ', 1, '1'].forEach(function (v) {
  T.eq(quag.encrypt(SAMPLE, Object.assign({ variant: v }, ROMAN_OPT)),
       quag.encrypt(SAMPLE, Object.assign({ variant: 1 }, ROMAN_OPT)),
       'variant 写成 ' + JSON.stringify(v) + ' 与写成 1 等价');
});
T.eq(quag.tableau({ variant: 'IV', ptKey: 'A', ctKey: 'B', indicator: 'X' }).variant, 4, "'IV' → 4");

/* ================= 错误入口 =================
   每一条守的都是一种**静默**的错法：悄悄退回 variant 1、悄悄把指示词当成 'A'、
   悄悄丢掉一个变体用不上的关键词。三者的共同后果都是页面吐出一段"看着像密文"
   的文本，而它既解不开也不是任何人的密文。 */
T.throws(function () { quag.encrypt('ABC', { variant: 0, indicator: 'K' }); },
         '变体号 0 当场抛', /variant 必须是 1–4 或 I–IV/);
T.throws(function () { quag.encrypt('ABC', { variant: 5, indicator: 'K' }); },
         '变体号 5 当场抛', /variant 必须是 1–4 或 I–IV/);
T.throws(function () { quag.encrypt('ABC', { variant: 'V', indicator: 'K' }); },
         "变体号 'V' 当场抛", /variant 必须是 1–4 或 I–IV/);
T.throws(function () { quag.encrypt('ABC', { indicator: 'K' }); },
         '不写变体号当场抛', /variant 必须是 1–4 或 I–IV/);
T.throws(function () { quag.encrypt('ABC', { variant: 3, indicator: '' }); },
         '空指示词当场抛', /指示词至少要含一个字母/);
T.throws(function () { quag.encrypt('ABC', { variant: 3, indicator: '123 !' }); },
         '一个字母都没有的指示词当场抛', /指示词至少要含一个字母/);
/* tableau 与 cosetKeys 走的是同一道守卫，不是 encrypt 私有的——工具页每帧调的
   是 tableau()，守卫只挂在 encrypt 上等于没挂。 */
T.throws(function () { quag.tableau({ variant: 1 }); },
         'tableau 缺指示词当场抛', /指示词至少要含一个字母/);
T.throws(function () { quag.cosetKeys({ variant: 1, indicator: '!!' }); },
         'cosetKeys 缺指示词当场抛', /指示词至少要含一个字母/);
T.throws(function () { quag.tableau({ variant: 9, indicator: 'K' }); },
         'tableau 也拦非法变体号', /variant 必须是 1–4 或 I–IV/);

/* 变体用不上的关键词必须当场抛，不许悄悄丢掉。使用者填了一个毫无反应的输入框时，
   最会归因于自己而不是工具。 */
T.throws(function () { quag.encrypt('ABC', { variant: 1, ptKey: 'A', ctKey: 'ZEBRA', indicator: 'K' }); },
         'I 不接受 ctKey', /变体 I 的密文表是顺序表/);
T.throws(function () { quag.encrypt('ABC', { variant: 2, ptKey: 'ZEBRA', ctKey: 'A', indicator: 'K' }); },
         'II 不接受 ptKey', /变体 II 的明文表是顺序表/);
T.throws(function () { quag.encrypt('ABC', { variant: 3, ptKey: 'A', ctKey: 'ZEBRA', indicator: 'K' }); },
         'III 两侧共用一张表，不接受 ctKey', /变体 III 两侧共用同一张表/);
/* 但**空的**那把关键词随便传：省略与显式空串是同一件事，不该因为写法不同而报错。 */
T.eq(quag.encrypt(SAMPLE, { variant: 1, ptKey: 'ZEBRA', ctKey: '', indicator: 'K' }),
     quag.encrypt(SAMPLE, { variant: 1, ptKey: 'ZEBRA', indicator: 'K' }),
     'I 收得下一个空的 ctKey');
T.eq(quag.encrypt(SAMPLE, { variant: 3, ptKey: 'ZEBRA', ctKey: '  !! ', indicator: 'K' }),
     quag.encrypt(SAMPLE, { variant: 3, ptKey: 'ZEBRA', indicator: 'K' }),
     'III 收得下一个没有字母的 ctKey');

/* keyedAlphabet 只是 substitution.keyFromKeyword 的转发，不是第二份实现。
   钉住这一点，免得哪天有人在这里"顺手优化"出一张不一样的字母表。 */
T.eq(quag.keyedAlphabet('SPRINGFEVER'), sub.keyFromKeyword('SPRINGFEVER'),
     'keyedAlphabet 转发到 substitution.keyFromKeyword');
T.eq(quag.keyedAlphabet(''), C.ALPHABET, '空关键词给出顺序表');
T.eq(quag.keyedAlphabet(null), C.ALPHABET, 'null 折成空串，不是字面的 "NULL"');
T.eq(quag.keyedAlphabet(undefined), C.ALPHABET, 'undefined 折成空串，不是字面的 "UNDEFINED"');

T.report('quagmire');
