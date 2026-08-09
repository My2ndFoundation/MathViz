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
    }
  ];

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

  return { plaintexts, caesar };
});
