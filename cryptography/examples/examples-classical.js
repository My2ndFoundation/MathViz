(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else {
    root.CryptoExamplesParts = root.CryptoExamplesParts || {};
    root.CryptoExamplesParts.classical = data;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 教学明文。挑选标准：
     ① 无版权顾虑——要么是自造句，要么是早已进入公有领域的历史句子改写。
        规范 §15：本目录只放 CryptoViz 自己的教学数据，不抄任何比赛正文。
     ② 用于频率分析的那几条，长度要够让字母统计有统计意义（>= 60 个字母），
        否则第三页的 χ² 排序会因为样本太小而选错，使用者看到的就是一个
        "自动破解失败"的演示。
     ③ 至少有一条包含全部 26 个字母（pangram），好让字母轮上没有空位。

     ②"缺一不可"只约束长文本。'attack' 是**故意**违反 ② 的对照组，
     它的全部价值就在于短——见它自己的 note。

     text 的 zh 与 en 是同一句英文，这不是漏翻译：古典密码的字母表就是 A-Z，
     把明文换成中文会让整个工具无字母可加密。这里双语的是 note 与 label
     （解说），不是 text（被加密的对象）。 */
  const plaintexts = [
    {
      id: 'pangram',
      text: {
        en: 'The quick brown fox jumps over the lazy dog and then runs away into the deep forest where nobody ever finds him again',
        zh: 'The quick brown fox jumps over the lazy dog and then runs away into the deep forest where nobody ever finds him again'
      },
      note: {
        en: 'A pangram, extended so letter statistics mean something.',
        zh: '全字母句，特意加长到字母统计有意义的长度。'
      }
    },
    {
      id: 'attack',
      text: { en: 'ATTACK AT DAWN', zh: 'ATTACK AT DAWN' },
      /* 这条 note 与计划书原稿不同。原稿写的是"正好看 χ² 在这里选错"，
         而实测 χ² 在这里**选对了**：以计划书钉死的那张 ENGLISH_FREQ 为准，
         'ATTACK AT DAWN' 的 26 个候选里 k=3 得分最低（33.1），排第一。
         真正随长度崩掉的不是名次，是**差距**：
           attack（12 字母）     第二名 / 第一名 ≈ 1.31
           pangram（95 字母）    ≈ 4.27
           caesar-quote（91 字母）≈ 5.16
         所以这条对照组要讲的是"排名还在，但已经不构成证据"，
         而不是"排名错了"。复现：对每个 k 取 bruteForce 候选算 χ² 后升序排，
         比较前两名的比值。 */
      note: {
        en: 'Only twelve letters. Chi-square still lands on the right shift here, but its lead over the runner-up all but vanishes — at this length a ranking is not yet evidence.',
        zh: '只有 12 个字母。χ² 在这里仍然选中了正确的位移，但它对第二名的领先几乎抹平——在这个长度上，排名还不构成证据。'
      }
    },
    {
      id: 'caesar-quote',
      /* 两句凯撒的改写：veni vidi vici，与《高卢战记》开篇"高卢全境分为三部分"。
         都是两千年前的公有领域文本，且这里是本仓自己的英文措辞加一句玩笑收尾，
         不是任何现代译本的转录。 */
      text: {
        en: 'I came I saw I conquered and the whole of Gaul is now divided into three parts each of them quite unhappy about it',
        zh: 'I came I saw I conquered and the whole of Gaul is now divided into three parts each of them quite unhappy about it'
      },
      note: {
        en: 'Caesar would have used a shift of three.',
        zh: '凯撒本人用的位移是 3。'
      }
    },
    {
      id: 'cryptanalysis-note',
      /* 656 个字母，本仓自造的散文，无版权顾虑（标准 ①）。
         为什么要专门加一条这么长的：上面三条分别是 95、12、91 个字母，
         **全部**落在密码分析工具自己量出来的"结论不可信"区间里
         （见 cryptanalysis.js 的 MIN_SAMPLE = 200 与 icSweep）。一个讲
         "样本量决定判据可不可信"的页面，如果它自带的每一份样本都太短，
         那它只能演示自己的失败。标准 ② 要求 >= 60 个字母，这一条把门槛
         抬到 400 以上，是同一条标准在这个用途上的延伸。

         实测（656 个字母）：IoC 0.07247、χ²/n 0.0433、缺字母只有 Z。
         IoC 略高于英文常见的 0.0667——这段文字反复用同一批词
         （the / and / letters / average / experiment），这是真实散文的常态，
         不是缺陷；下面 SWEEP_IDS 把它与另外三条拼在一起正是为了把这个
         偏高拉回 0.0689，更贴近普通英文。 */
      text: {
        en: 'Before a single key is tried the ciphertext has already answered several questions and it answers them in numbers rather than in words. Count how often two letters drawn at random turn out to be the same and that number separates one alphabet from many. Compare the letter counts against ordinary English and the answer separates a renaming of the alphabet from a rearrangement of the message. Count the pairs of identical adjacent letters and a whole family of ciphers can be ruled out on the spot. None of this recovers a key. What it does is choose which weapon to reach for and on a short message it will cheerfully choose the wrong one because every one of these numbers is an average and an average over forty letters is mostly noise. Length is not a detail of the experiment. Length is the experiment.',
        zh: 'Before a single key is tried the ciphertext has already answered several questions and it answers them in numbers rather than in words. Count how often two letters drawn at random turn out to be the same and that number separates one alphabet from many. Compare the letter counts against ordinary English and the answer separates a renaming of the alphabet from a rearrangement of the message. Count the pairs of identical adjacent letters and a whole family of ciphers can be ruled out on the spot. None of this recovers a key. What it does is choose which weapon to reach for and on a short message it will cheerfully choose the wrong one because every one of these numbers is an average and an average over forty letters is mostly noise. Length is not a detail of the experiment. Length is the experiment.'
      },
      note: {
        en: '656 letters — long enough that the four discriminants mean something. Every other plaintext here is under 100 and sits inside the region where the verdict is untrustworthy.',
        zh: '656 个字母 —— 长到四条判别量说话算数。这里其余每一条明文都不到 100 个字母，全都落在结论不可信的那一段里。'
      }
    }
  ];

  /* ================= 判错率扫描用的语料 =================
     cryptanalysis.js 的 icSweep 拿这一段做循环切片，密码分析工具页与
     cryptanalysis.test.js 读的是**同一个**常量——扫描图上的数字与断言里的
     数字因此不可能各算各的。

     这份 id 清单是**冻结的**，不是"当前全部明文"。它决定了那张扫描图上
     每一个计数，所以往 plaintexts 里新加一条不该悄悄改掉已发布的实测结果；
     真要把新明文纳入语料，得连同测试里那张表一起重新量、重新写。
     顺序也是结果的一部分（循环切片的起点落在拼接后的坐标上）。

     实测：拼起来 854 个字母，IoC 0.06889 —— 比单用 cryptanalysis-note
     的 0.07247 更接近普通英文的 0.0667，这正是要拼的理由。 */
  const SWEEP_IDS = ['cryptanalysis-note', 'pangram', 'caesar-quote', 'attack'];
  const sweepSource = SWEEP_IDS.map(function (id) {
    for (let i = 0; i < plaintexts.length; i++) {
      if (plaintexts[i].id === id) return plaintexts[i].text.en;
    }
    throw new Error('examples-classical: SWEEP_IDS 里的 "' + id + '" 不在 plaintexts 里');
  }).join(' ');

  /* 预置密文：id 指向上面的明文，k 是用来加密它的位移。
     cipher 字段**故意留空**由工具页现算——把密文抄死在数据里，
     一旦 caesar.js 的行为改了（比如某天不再保留标点），
     这里就会静静地对不上，而没有任何东西会报警。
     examples.test.js 里那条 `c.cipher === undefined` 就是这条约定的执法者。 */
  const caesar = [
    { id: 'attack', k: 3, label: { en: 'The textbook shift', zh: '教科书上的那个位移' } },
    { id: 'pangram', k: 13, label: { en: 'ROT13 — its own inverse', zh: 'ROT13 —— 自己是自己的逆' } },
    { id: 'caesar-quote', k: 7, label: { en: 'Nothing special about 7', zh: '7 没有任何特别之处' } }
  ];

  return { plaintexts, caesar, SWEEP_IDS, sweepSource };
});
