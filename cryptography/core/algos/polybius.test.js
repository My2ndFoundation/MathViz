'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const TR = require('./transposition.js');
const P = require('./polybius.js');

const SQ5 = P.makeSquare('', { size: 5 });
const SQ6 = P.makeSquare('', { size: 6 });

/* ================= 方阵的形状 ================= */
T.eq(SQ5.cells.length, 25, '5 阶方阵 25 格');
T.eq(SQ6.cells.length, 36, '6 阶方阵 36 格');
T.eq(SQ5.cells.join(''), 'ABCDEFGHIKLMNOPQRSTUVWXYZ', '空关键词的 5 阶就是池子本身');
T.eq(SQ6.cells.join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', '空关键词的 6 阶就是池子本身');
T.eq(SQ5.labels, 'ADFGX', '5 阶用 A D F G X');
T.eq(SQ6.labels, 'ADFGVX', '6 阶用 A D F G V X（ADFGVX）');
T.eq(SQ5.merged, true, '5 阶合并了 I/J');
T.eq(SQ6.merged, false, '6 阶不合并');

T.throws(function () { P.makeSquare('X', { size: 4 }); },
         '4 阶当场拒绝，不悄悄退化成 5', /只支持 5 阶或 6 阶/);
T.throws(function () { P.makeSquare('X', { size: 7 }); },
         '7 阶同理', /只支持 5 阶或 6 阶/);

/* ================= I/J 合并：把这个古典妥协逐条钉死 ================= */
T.eq(SQ5.cells.indexOf('J'), -1, '5 阶方阵里根本没有 J 这一格');
T.eq(SQ6.cells.indexOf('J'), 9, '6 阶方阵保留 J，它就在第 10 个格子');
T.eq(P.coordsOf('J', SQ5), P.coordsOf('I', SQ5), 'J 与 I 在 5 阶里是同一格');
T.eq(P.coordsOf('J', SQ5).ch, 'I', 'coordsOf 把折叠的结果放在返回值里，不用调用方自己猜');
T.eq(P.coordsOf('J', SQ6).ch, 'J', '6 阶里 J 就是 J');
T.eq(P.encode('JAM', SQ5), P.encode('IAM', SQ5), 'JAM 与 IAM 在 5 阶下编码完全相同');
/* 这条是"损失"本身，不是"往返"。写成一条正面断言，因为使用者一定会发现
   J 不见了，而代码必须先承认它。 */
T.eq(P.decode(P.encode('JAM', SQ5), SQ5), 'IAM', '5 阶下 J 在加密第一步就丢了，解密找不回来');
T.eq(P.decode(P.encode('JAM', SQ6), SQ6), 'JAM', '6 阶下 J 原样回来');
T.eq(P.normalizeFor('Major Jam', 5), 'MAIORIAM', '5 阶规范化：大写、去非字母、J→I');
T.eq(P.normalizeFor('Major Jam 42', 6), 'MAJORJAM42', '6 阶规范化保留 J 与数字');
T.eq(P.normalizeFor('Major Jam 42', 5), 'MAIORIAM', '5 阶规范化把数字一并丢掉');

/* ================= 关键词：先填、去重、按池子补齐 ================= */
(function () {
  const sq = P.makeSquare('BANANA', { size: 5 });
  T.eq(sq.cells.slice(0, 3).join(''), 'BAN', '重复字母只留第一次出现');
  T.eq(sq.cells.join(''), 'BANCDEFGHIKLMOPQRSTUVWXYZ', 'BANANA 的完整 5 阶排布');
  T.eq(sq.cells.length, 25, '去重之后格子数不变');
})();

(function () {
  /* 关键词里的 J 要在**规范化之后**才去重：先去重就会留下两个 I 的格子。 */
  const sq = P.makeSquare('JIMJAZZ', { size: 5 });
  T.eq(sq.keyword, 'IIMIAZZ', '关键词先按 5 阶规范化（J→I）');
  T.eq(sq.cells.slice(0, 4).join(''), 'IMAZ', 'IIMIAZZ 去重后是 I M A Z');
  T.eq(sq.cells.length, 25, '仍然是 25 格，没有重复');
})();

(function () {
  const sq = P.makeSquare('C1PHER', { size: 5 });
  T.eq(sq.keyword, 'CPHER', '5 阶下关键词里的数字被丢掉');
  const sq6 = P.makeSquare('C1PHER', { size: 6 });
  T.eq(sq6.keyword, 'C1PHER', '6 阶下数字是合法的格子内容');
  T.eq(sq6.cells.slice(0, 6).join(''), 'C1PHER', '6 阶关键词原样排在最前面');
})();

/* 一批关键词一起过一遍不变量：格子数对、无重复、集合等于池子。 */
['', 'A', 'Z', 'ZEBRAS', 'CIPHER', 'BANANA', 'MISSISSIPPI', 'JUDGE',
 'THEQUICKBROWNFOX', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '!!! ??? 123'].forEach(function (kw) {
  [5, 6].forEach(function (size) {
    const sq = P.makeSquare(kw, { size: size });
    const pool = size === 5 ? P.SQUARE5 : P.SQUARE6;
    T.eq(sq.cells.length, size * size, JSON.stringify(kw) + ' @' + size + ' 阶：格子数正确');
    T.eq(sq.cells.slice().sort().join(''), pool.split('').sort().join(''),
         JSON.stringify(kw) + ' @' + size + ' 阶：格子集合恰好是池子，无重无漏');
  });
});

/* ================= coordsOf / charAt 互为逆（0 基） ================= */
[SQ5, SQ6, P.makeSquare('ZEBRAS', { size: 5 }), P.makeSquare('CIPHER', { size: 6 })]
  .forEach(function (sq) {
    for (let i = 0; i < sq.cells.length; i++) {
      const ch = sq.cells[i];
      const p = P.coordsOf(ch, sq);
      T.eq(P.charAt(p.row, p.col, sq), ch,
           sq.size + ' 阶：charAt(coordsOf(' + ch + ')) 还是 ' + ch);
      T.eq(p.index, i, sq.size + ' 阶：' + ch + ' 的 index 与它在 cells 里的位置一致');
    }
  });

T.eq(P.coordsOf(' ', SQ5), null, '空白没有坐标');
T.eq(P.coordsOf('AB', SQ5), null, '两个字符没有坐标');
T.eq(P.coordsOf('7', SQ5), null, '5 阶方阵里没有数字');
T.eq(P.coordsOf('7', SQ6).ch, '7', '6 阶方阵里有数字');
T.eq(P.charAt(-1, 0, SQ5), null, '越界返回 null，不抛');
T.eq(P.charAt(5, 0, SQ5), null, '第 6 行在 5 阶里不存在');
T.eq(P.charAt(0, 5, SQ5), null, '第 6 列在 5 阶里不存在');
/* 第 6 行在 6 阶里是存在的：36 格里第 30 号（0 基）是 '4'。
   顺带记下数字并不整齐地占据最后一行——'0' 落在第 26 号，也就是第 5 行第 3 列，
   因为 26 个字母除以 6 不是整数。工具页画方阵时不能假设"末行都是数字"。 */
T.eq(P.charAt(5, 0, SQ6), '4', '第 6 行在 6 阶里存在');
T.eq(P.coordsOf('0', SQ6).row, 4, "'0' 在第 5 行——数字不是从整行开始的");
T.eq(P.coordsOf('0', SQ6).col, 2, "'0' 在第 3 列");
T.throws(function () { P.charAt(1.5, 0, SQ5); },
         '非整数下标当场拒绝，不悄悄变成 undefined', /必须是整数/);

/* ================= encode / decode（1 基，教科书记法） ================= */
T.eq(P.encode('A', SQ5), '11', 'A 在左上角，坐标 11');
T.eq(P.encode('Z', SQ5), '55', 'Z 在右下角，坐标 55');
T.eq(P.encode('ABC', SQ5), '11 12 13', '坐标对用空格分开');
T.eq(P.encode('Attack at dawn!', SQ5), P.encode('ATTACKATDAWN', SQ5),
     '大小写、空格、标点都不参与编码');
T.eq(P.decode('11 12 13', SQ5), 'ABC', 'decode 认空格');
T.eq(P.decode('111213', SQ5), 'ABC', 'decode 也认没有空格的写法');
T.throws(function () { P.decode('1112 1', SQ5); },
         '奇数个数字当场拒绝', /必须成对/);
T.throws(function () { P.decode('16', SQ5); },
         '5 阶下第 6 列越界', /超出 5×5/);

/* 往返：两种尺寸 × 一批关键词 × 一批文本。5 阶的期望值要先折 J。 */
const TEXTS = [
  'ATTACK AT DAWN',
  'The quick brown fox jumps over the lazy dog',
  'JUJITSU JUDGES JUGGLE JADED JAGUARS',
  'Meet me at the bridge at midnight, bring 3 lanterns',
  'A',
  'ZZZZZ'
];
['', 'ZEBRAS', 'CIPHER', 'BANANA', 'PHQGMEAY'].forEach(function (kw) {
  [5, 6].forEach(function (size) {
    const sq = P.makeSquare(kw, { size: size });
    TEXTS.forEach(function (txt) {
      T.eq(P.decode(P.encode(txt, sq), sq), P.normalizeFor(txt, size),
           'decode(encode) 往返 · ' + size + ' 阶 · 关键词 ' + JSON.stringify(kw) +
           ' · ' + JSON.stringify(txt.slice(0, 18)));
    });
  });
});

/* ================= 分裂：一个字母 → 两个标记字母 ================= */
T.eq(P.fractionate('A', SQ5), 'AA', 'A 在 (0,0)，两个坐标都是标记字母 A');
T.eq(P.fractionate('Z', SQ5), 'XX', 'Z 在 (4,4)，两个坐标都是 X');
T.eq(P.fractionate('ATTACK', SQ5).length, 12, '6 个字母裂成 12 个符号');
T.eq(P.defractionate(P.fractionate('ATTACK', SQ5), SQ5), 'ATTACK', '分裂可逆');
/* 分裂串只由标记字母组成——这正是"密文里的符号不再是字母"的字面证据。 */
(function () {
  const f = P.fractionate('The quick brown fox jumps over the lazy dog', SQ5);
  const bad = f.split('').filter(function (ch) { return SQ5.labels.indexOf(ch) < 0; });
  T.eq(bad.length, 0, '5 阶分裂串里只出现 A D F G X 五个符号');
  const f6 = P.fractionate('The quick brown fox 2026', SQ6);
  const bad6 = f6.split('').filter(function (ch) { return SQ6.labels.indexOf(ch) < 0; });
  T.eq(bad6.length, 0, '6 阶分裂串里只出现 A D F G V X 六个符号');
})();
T.throws(function () { P.defractionate('ADF', SQ5); },
         '奇数个标记字母当场拒绝', /必须成对/);
T.throws(function () { P.defractionate('AB', SQ5); },
         'B 不是 5 阶的标记字母', /不是 ADFGX 里的一对/);

/* ================= ADFGX 往返 ================= */
const KEYS = ['CARGO', 'ZEBRAS', 'BANANA', 'WERTZ', 'A', 'PRIVAT'];
['', 'CIPHER', 'ZEBRAS'].forEach(function (skw) {
  [5, 6].forEach(function (size) {
    const sq = P.makeSquare(skw, { size: size });
    KEYS.forEach(function (tk) {
      TEXTS.forEach(function (txt) {
        const ct = P.adfgxEncrypt(txt, sq, tk);
        T.eq(P.adfgxDecrypt(ct, sq, tk), P.normalizeFor(txt, size),
             'ADFGX 往返 · ' + size + ' 阶 · 方阵词 ' + JSON.stringify(skw) +
             ' · 换位词 ' + tk + ' · ' + JSON.stringify(txt.slice(0, 18)));
        T.eq(ct.length, P.normalizeFor(txt, size).length * 2,
             '密文恰好是明文字母数的两倍——一个填充字符都没有');
      });
    });
  });
});

/* 密文里出现的符号仍然只有那 5（或 6）个——换位不改变"哪些符号"，
   它改变的是"符号在哪儿"（换位密码那一页的中心论点，在这里再成立一次）。 */
(function () {
  const ct = P.adfgxEncrypt('The quick brown fox jumps over the lazy dog', SQ5, 'CARGO');
  const bad = ct.split('').filter(function (ch) { return SQ5.labels.indexOf(ch) < 0; });
  T.eq(bad.length, 0, 'ADFGX 密文里只有 A D F G X');
})();

/* ================= 去向表与密文必须是同一个排列 ================= */
(function () {
  const tr = P.adfgxTrace('The quick brown fox jumps over the lazy dog', SQ5, 'CARGO');
  T.eq(tr.cipher, P.adfgxEncrypt('The quick brown fox jumps over the lazy dog', SQ5, 'CARGO'),
       'trace 的密文与 adfgxEncrypt 一致');
  T.eq(tr.cipher, TR.columnarEncrypt(tr.frac, 'CARGO'),
       '换位那一步真的走的是 transposition.js，不是本模块自己又写了一份');
  let mismatch = 0;
  for (let p = 0; p < tr.frac.length; p++) {
    if (tr.cipher.charAt(tr.dest[p]) !== tr.frac.charAt(p)) mismatch++;
  }
  T.eq(mismatch, 0, 'dest[p] 逐字符对得上密文——去向表与密文是同一个排列');
  T.eq(tr.dest.slice().sort(function (a, b) { return a - b; }).join(','),
       tr.frac.split('').map(function (_, i) { return i; }).join(','),
       'dest 是 0..m−1 的一个双射，没有落点重合或空缺');
})();

/* ================= 分裂的收益：两半被拉开了多远 =================

   本工具的中心论点必须是一个**数**，不是一句话：
   代换单独用保留频率指纹，换位单独用也保留频率指纹；把每个字母劈成两半
   再换位，两半就落到密文的两个远处——此后密文里任何一个符号都不再对应
   某个字母，代换分析要的那条对应关系被拆掉了。

   可证明的判据：设分裂串长 m、列数 cols，若 **cols >= 2 且每一列都至少 3 格**
   （m >= 3·cols），则任意明文字母的两个坐标在密文里的距离 >= 2，即绝不相邻。
   证明梗概：两个坐标位于相邻的两个下标 2i、2i+1，cols >= 2 保证它们落在不同
   的两列，而不同列在读出序里至少隔着一整列，前缀长度之差 >= 3；跨行那一次
   最多再抵掉 1，仍 >= 2。

   ⚠ cols >= 2 这一半**必须写进守卫**，不能只写 m >= 3·cols。cols = 1 时
   m >= 3 轻易成立，而 1 列的列换位是恒等，minGap 恒为 1——判据的前提没了，
   断言却还会跑。这不是假设：把内联块拿去跑同一批断言时，换位词 'A' 当场
   把这条判成了失败（下面的边界断言 ① 记着这个退化本身）。 */
(function () {
  const text = 'The quick brown fox jumps over the lazy dog and then runs away into the deep forest';
  let checked = 0, worst = Infinity;
  /* 'A'（1 列）与 'BAC'（3 列）都留在名单里：守卫必须当场把它们排除掉，
     而不是靠"我们不会用这种关键词"。 */
  ['CARGO', 'ZEBRAS', 'BANANA', 'WERTZ', 'PRIVAT', 'BAC', 'DEUTSCH', 'A'].forEach(function (tk) {
    [5, 6].forEach(function (size) {
      const sq = P.makeSquare('CIPHER', { size: size });
      const tr = P.adfgxTrace(text, sq, tk);
      if (tr.cols < 2 || tr.frac.length < 3 * tr.cols) return;   // 判据不适用，见下面的边界断言
      T.ok(tr.minGap >= 2,
           '每列 >= 3 格时，两半绝不相邻（' + size + ' 阶 · 换位词 ' + tk +
           ' · minGap = ' + tr.minGap + '）');
      checked++;
      worst = Math.min(worst, tr.minGap);
    });
  });
  T.ok(checked >= 10, '判据确实跑到了足够多的组合上（' + checked + ' 组）');
  /* 拉开的幅度本身也要有个下界：不是"多 1 格"，而是一整列那么远。 */
  T.ok(worst >= 8, '最坏情况下两半也隔着 ' + worst + ' 个符号，量级是一列的高度');
})();

(function () {
  /* 一条真实的长报文，逐字母检查，并把"平均拉开多远"与列高对上号。 */
  const text = 'Munitionierung beschleunigen Punkt Soweit nicht eingesehen auch bei Tage zu bewegen';
  const sq = P.makeSquare('CIPHER', { size: 5 });
  const tr = P.adfgxTrace(text, sq, 'DEUTSCH');
  const colH = Math.floor(tr.frac.length / tr.cols);
  T.ok(tr.gaps.length === tr.plain.length, '每个明文字母都有一条 gap');
  T.ok(Math.min.apply(null, tr.gaps) >= colH - 1,
       '最小间距 ' + Math.min.apply(null, tr.gaps) + ' 不低于列高 ' + colH + ' 减一');
  T.ok(Math.max.apply(null, tr.gaps) > colH,
       '最大间距 ' + Math.max.apply(null, tr.gaps) + ' 超过一整列');
})();

(function () {
  /* 判据的两条边界，都是真的，都必须写下来——否则下一个人会把上面那条
     断言"加强"成无条件成立，然后被这两个反例打脸。

     ① cols === 1：列换位退化成恒等，两半原地不动，间距恒为 1。
        分裂在这里一分钱也没赚到——这恰好说明"分裂 + 换位"是一件事，
        不是两件可以拆开的事。 */
  const sq = P.makeSquare('', { size: 5 });
  const tr1 = P.adfgxTrace('ATTACK', sq, 'A');
  T.eq(tr1.cols, 1, '单字母换位词只有一列');
  T.eq(tr1.minGap, 1, 'cols = 1 时两半仍然相邻——换位是恒等，分裂白做');
  T.eq(tr1.cipher, tr1.frac, 'cols = 1 时密文就是分裂串本身');

  /* ② 报文短到装不满三行时，判据的前提不成立，两半确实可能仍然相邻。
        3 个字母 → 6 个符号 → 3 列各 2 格，换位词 BAC 给出读出序 [1,0,2]：
        第 1 个字母的两半落在密文的第 3、4 位。 */
  const tr2 = P.adfgxTrace('ABC', sq, 'BAC');
  T.eq(tr2.cols, 3, 'BAC 是 3 列');
  T.eq(tr2.frac.length, 6, '3 个字母裂成 6 个符号，每列 2 格');
  T.ok(tr2.frac.length < 3 * tr2.cols, '每列不足 3 格，判据前提不成立');
  T.eq(tr2.minGap, 1, '极短报文下两半可能仍然相邻——分裂的收益随长度才兑现');
})();

/* ================= 与 core 的既有承诺对齐 ================= */
T.eq(P.normalizeFor('Hello', 5), C.normalize('Hello'), '不含 J 时 5 阶规范化就是 core 的 normalize');
T.eq(TR.columnOrder('BAC').join(','), '1,0,2', '借来的 columnOrder 仍然是那条规则');
T.throws(function () { P.adfgxTrace('ABC', SQ5, ''); },
         '换位词为空时由 transposition.js 抛，本模块不替它编一个结果',
         /至少要有一个字母/);

T.report('polybius');
