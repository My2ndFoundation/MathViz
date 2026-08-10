'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const A = require('../cryptanalysis.js');
const S = require('./substitution.js');
const morse = require('./morse.js');

/* ================= 码表本身 ================= */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
T.eq(Object.keys(morse.MORSE_TABLE).length, 36, '码表恰好 26 个字母 + 10 个数字');
for (let i = 0; i < CHARS.length; i++) {
  T.ok(morse.MORSE_TABLE[CHARS.charAt(i)] !== undefined,
       '码表里有 ' + CHARS.charAt(i));
}
(function () {
  const seen = {};
  Object.keys(morse.MORSE_TABLE).forEach(function (ch) {
    const code = morse.MORSE_TABLE[ch];
    T.ok(/^[.-]{1,5}$/.test(code), ch + ' 的码只由点划组成且不超过 5 个符号：' + code);
    T.ok(seen[code] === undefined, '码 ' + code + ' 没有被两个字符共用');
    seen[code] = ch;
  });
})();

/* ---- 教科书向量 ---- */
T.eq(morse.toMorse('SOS'), '... --- ...', 'SOS');
T.eq(morse.toMorse('Hello, World!'), '.... . .-.. .-.. --- / .-- --- .-. .-.. -..',
     '词之间是斜杠，标点被丢弃');
T.eq(morse.toMorse('E'), '.', '最短的码是一个点');
T.eq(morse.toMorse('0'), '-----', '数字全是 5 个符号');
T.eq(morse.toMorse(''), '', '空输入给空码');
T.eq(morse.toMorse('   ,.!  '), '', '一个可编码字符都没有时也是空码');

/* ---- 规范化 ---- */
T.eq(morse.normalizeText('  Attack at 0500! '), 'ATTACK AT 0500',
     '大写、只留字母数字、折叠空白、去首尾');
T.eq(morse.normalizeText('a---b'), 'A B', '不可编码的字符折成一个词边界');
T.eq(morse.normalizeText('中文'), '', '非 ASCII 一律丢弃');
T.eq(morse.normalizeText(morse.normalizeText('  x  y ')), morse.normalizeText('  x  y '),
     'normalizeText 幂等');

/* ================= 往返：整张码表，一个字符不漏 ================= */
/* 这是本模块最要紧的一条断言，也是"编码"这个词的全部含义：
   fromMorse 不接受密钥，因为没有密钥可接——谁拿到它谁就能读回去。 */
for (let i = 0; i < CHARS.length; i++) {
  const ch = CHARS.charAt(i);
  T.eq(morse.fromMorse(morse.toMorse(ch)), ch, '单字符往返 ' + ch);
  T.eq(morse.charOf(morse.codeOf(ch)), ch, 'charOf(codeOf(' + ch + ')) 恒等');
}
T.eq(morse.fromMorse(morse.toMorse(CHARS.slice(0, 26) + ' ' + CHARS.slice(26))),
     CHARS.slice(0, 26) + ' ' + CHARS.slice(26),
     '全码表一次往返（26 字母 + 空格 + 10 数字）');

const SAMPLES = [
  'ATTACK AT DAWN',
  'The quick brown fox jumps over the lazy dog',
  'Meet me at 0500 by the old bridge, bring the maps!',
  'SOS SOS SOS',
  'E',
  'EEE EEE'
];
SAMPLES.forEach(function (s) {
  T.eq(morse.fromMorse(morse.toMorse(s)), morse.normalizeText(s),
       'fromMorse(toMorse(x)) === normalizeText(x)：' + JSON.stringify(s));
});

/* 抄本排版随便怎么乱都要能读回来——"任何人都能读"这句话不该附带排版条件。 */
T.eq(morse.fromMorse('...   ---\n...'), 'SOS', '多余空白与换行都认');
T.eq(morse.fromMorse('.- | -...'), 'A B', '竖线也当词边界');
T.throws(function () { morse.fromMorse('.-.-.-.-.-.-'); },
         '认不出来的码当场抛，而不是静静跳过', /合法的摩尔斯码/);

/* ================= 摩尔斯**不是**前缀码 ================= */
/* E ⊂ I ⊂ S ⊂ H：四个字母排在同一条全点的链上。前缀码要求所有码字都在叶子上，
   而这里它们全在内部节点上——所以字母之间那个停顿不是排版，是第三个符号。 */
T.eq(morse.MORSE_TABLE.E, '.', 'E 是一个点');
T.eq(morse.MORSE_TABLE.I, '..', 'I 是两个点');
T.eq(morse.MORSE_TABLE.S, '...', 'S 是三个点');
T.eq(morse.MORSE_TABLE.H, '....', 'H 是四个点');
['I', 'S', 'H'].forEach(function (ch) {
  T.ok(morse.MORSE_TABLE[ch].indexOf(morse.MORSE_TABLE.E) === 0,
       'E 的码是 ' + ch + ' 的码的前缀 —— 摩尔斯不是前缀码');
});

T.eq(morse.countReadings('...'), 4, '裸的 ... 有四种读法');
T.eq(morse.ambiguousReadings('...', 10).sort().join(','), 'EEE,EI,IE,S',
     '那四种读法分别是 EEE / EI / IE / S');
T.eq(morse.countReadings('....'), 8, '裸的 .... 有八种读法');
T.eq(morse.ambiguousReadings('....', 99).length, 8, '枚举与计数对得上');
T.eq(morse.countReadings(''), 1, '空串恰有一种读法：什么都不读');
T.eq(morse.countReadings('.'), 1, '单个点只能读成 E');
T.eq(morse.countReadings('...---...'), 216, '裸的 SOS 有 216 种读法');
T.throws(function () { morse.countReadings('...x'); },
         'countReadings 只吃点划裸串', /裸串/);
/* 加上分隔符之后读法恰好一种——这就是"分隔符是承重结构"的可计算版本。 */
T.eq(morse.fromMorse('... --- ...'), 'SOS', '同一串符号，带分隔符时只有一种读法');

/* ================= 三符号流 ================= */
(function () {
  const st = morse.symbolStream('AB CD');
  T.eq(st.stream, '.-x-...xx-.-.x-..', '字母间一个 x、词间两个 x');
  T.eq(st.stream.length, 17, '符号流长度');
  T.eq(st.owner, [0, 0, -1, 1, 1, 1, 1, -1, -1, 3, 3, 3, 3, -1, 4, 4, 4],
       'owner 指出每个符号属于明文第几个字符（分隔符是 −1）');
  T.eq(st.first, [0, 3, -1, 9, 14], 'first[j] 是第 j 个字符的第一个符号位置');
  T.eq(st.last, [1, 6, -1, 12, 16], 'last[j] 是它的最后一个符号位置');
  T.eq(st.codes, ['.-', '-...', '', '-.-.', '-..'], 'codes 与 plain 逐字符对齐');
})();

/* 'x' 的连续段永远是 1 或 2，从不是 3 —— 这正是 27 个三元组里恰好有一个
   不可能出现、于是剩下 26 个恰好配一个字母表的原因。它不是巧合，是设计。 */
SAMPLES.concat(['A B C D E', 'X  Y   Z', '0 1 2']).forEach(function (s) {
  const st = morse.symbolStream(s);
  T.ok(st.stream.indexOf('xxx') < 0, 'xxx 不会出现在符号流里：' + JSON.stringify(s));
  T.ok(/^[.\-x]*$/.test(st.stream), '符号流只由点、划、x 三种符号组成');
  T.eq(st.owner.length, st.stream.length, 'owner 与符号流等长');
});

/* ================= 26 个有效三元组 ================= */
(function () {
  const tt = morse.tripleTable();
  T.eq(tt.length, 26, '恰好 26 个有效三元组（27 减去不可能的 xxx）');
  T.eq(tt[0], '...', '第一个是三个点');
  T.eq(tt[25], 'xx-', '最后一个是 xx-（xxx 被去掉了）');
  T.ok(tt.indexOf('xxx') < 0, 'xxx 不在表里');
  const seen = {};
  tt.forEach(function (g) {
    T.eq(g.length, 3, g + ' 是三个符号');
    T.ok(/^[.\-x]{3}$/.test(g), g + ' 只由三种符号组成');
    T.ok(seen[g] === undefined, g + ' 没有重复');
    seen[g] = 1;
  });
  T.eq(morse.tripleTable() === morse.tripleTable(), false,
       'tripleTable() 每次返回新数组，调用方改它不会污染模块内部');
})();

/* ================= 分裂式摩尔斯 ================= */
const KEY = S.keyFromKeyword('ROUNDTABLE');
T.eq(KEY, 'ROUNDTABLECFGHIJKMPQSVWXYZ', '关键词密钥字母表');

(function () {
  const tr = morse.fractionatedTrace('ATTACK AT DAWN', KEY);
  T.eq(tr.plain, 'ATTACK AT DAWN', '明文规范化后不变');
  T.eq(tr.stream, '.-x-x-x.-x-.-.x-.-xx.-x-xx-..x.-x.--x-.', '符号流');
  T.eq(tr.stream.length, 39, '39 个符号');
  T.eq(tr.pad, 0, '39 是 3 的倍数，无需补位');
  T.eq(tr.groups.join(' '), '.-x -x- x.- x-. -.x -.- xx. -x- xx- ..x .-x .-- x-.', '三个一组');
  T.eq(tr.groups.length, 13, '13 组 = 13 个密文字母');
  T.eq(tr.cipher, 'TKQVFCYKZUTDV', '密文');
  T.eq(morse.fractionatedEncrypt('ATTACK AT DAWN', KEY), tr.cipher,
       'fractionatedEncrypt 与 trace 给出同一份密文');
})();

/* 补位：符号流长度不是 3 的倍数时补 'x'，且补完仍然造不出 xxx
   （符号流总以点或划收尾，所以最多两个补位 x 前面一定有一个非 x）。 */
['E', 'EE', 'EEE', 'A', 'AB', 'SOS', 'HELLO WORLD'].forEach(function (s) {
  const tr = morse.fractionatedTrace(s, KEY);
  T.eq(tr.padded.length % 3, 0, JSON.stringify(s) + '：补位后长度是 3 的倍数');
  T.eq(tr.pad, (3 - tr.stream.length % 3) % 3, JSON.stringify(s) + '：补了正确的位数');
  T.ok(tr.padded.indexOf('xxx') < 0, JSON.stringify(s) + '：补位也造不出 xxx');
  T.eq(tr.cipher.length, tr.padded.length / 3, JSON.stringify(s) + '：一组一个密文字母');
  T.eq(tr.owner.length, tr.padded.length, JSON.stringify(s) + '：owner 覆盖补位');
});

/* ---- 往返 ---- */
const KEYS = [undefined, C.ALPHABET, KEY, S.keyFromKeyword('ZEBRA'),
              S.keyFromKeyword('CIPHER')];
SAMPLES.concat(['HELLO WORLD', 'MEET ME AT 0500', 'X']).forEach(function (s) {
  KEYS.forEach(function (k) {
    T.eq(morse.fractionatedDecrypt(morse.fractionatedEncrypt(s, k), k),
         morse.normalizeText(s),
         '往返：' + JSON.stringify(s) + ' / key=' + (k === undefined ? '(默认 A–Z)' : k));
  });
});
T.eq(morse.fractionatedEncrypt('', KEY), '', '空明文给空密文');
T.eq(morse.fractionatedDecrypt('', KEY), '', '空密文给空明文');
T.eq(morse.fractionatedEncrypt('!!!', KEY), '', '一个可编码字符都没有时也是空密文');

/* 换一把钥匙就换一段密文——不然它就不是密码。 */
T.ok(morse.fractionatedEncrypt('ATTACK AT DAWN', KEY) !==
     morse.fractionatedEncrypt('ATTACK AT DAWN', S.keyFromKeyword('ZEBRA')),
     '不同的密钥字母表给出不同的密文');
/* 密文长度只跟明文的**摩尔斯长度**有关，与密钥无关：密钥只是给三元组改名。 */
T.eq(morse.fractionatedEncrypt('ATTACK AT DAWN', KEY).length,
     morse.fractionatedEncrypt('ATTACK AT DAWN', S.keyFromKeyword('ZEBRA')).length,
     '密钥不影响密文长度');

/* ---- 密钥校验 ---- */
T.throws(function () { morse.fractionatedEncrypt('A', 'ABC'); },
         '长度不对的密钥字母表当场抛', /26 字母排列/);
T.throws(function () { morse.fractionatedEncrypt('A', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'); },
         '不是排列的密钥当场抛（26 个 A 没有逆）', /26 字母排列/);
T.throws(function () { morse.fractionatedEncrypt('A', 'roundtablecfghijkmpqsvwxyz'); },
         '小写密钥不被静默接受', /26 字母排列/);
T.throws(function () { morse.codeOf('!'); }, 'codeOf 对表外字符抛', /码表里没有/);
T.throws(function () { morse.charOf('.-.-.-.-'); }, 'charOf 对非法码抛', /合法的摩尔斯码/);

/* ================= 中心论点：频率分析在这里失效 =================
   单表代换**逐项保持**字母计数——密文的字母计数向量只是明文那一份的一次
   重排。所以排序之后两者逐字节相等，频率攻击原样转移过去。
   分裂式摩尔斯把字母边界拆掉了，这条等式当场不成立，重合指数也跟着塌向
   均匀随机的 1/26 ≈ 0.0385。

   用一段够长的英文：短文本上任何频率统计都只是噪声（examples-classical.js
   里 'attack' 那条 note 记着同一件事）。 */
(function () {
  const LONG = [
    'The value of a cipher is not measured by how strange the output looks to a casual reader',
    'but by how much work an informed adversary must do to recover the message without the key.',
    'A code changes the way a message is written down and nothing else. Anyone who owns a copy',
    'of the codebook reads the message immediately, and the codebook is a public document because',
    'it must be shared with every operator on the network. A cipher keeps a single small secret',
    'and lets everything else be published. That difference is the whole subject in one sentence.',
    'When a message is rewritten as dots and dashes the letters lose their boundaries, and a',
    'regrouping into fixed blocks of three symbols destroys the correspondence between a symbol',
    'in the ciphertext and a letter in the plaintext, which is exactly what frequency analysis',
    'depends upon to work at all.'
  ].join(' ');
  const plain = morse.normalizeText(LONG);
  const sub = S.encrypt(LONG, KEY);
  const frac = morse.fractionatedEncrypt(LONG, KEY);

  function sortedCounts(t) {
    return A.letterCounts(t).slice().sort(function (a, b) { return b - a; });
  }
  T.eq(sortedCounts(sub), sortedCounts(plain),
       '单表代换：排序后的字母计数向量与明文**逐项相等**');
  T.ok(sortedCounts(frac).join(',') !== sortedCounts(plain).join(','),
       '分裂式摩尔斯：这条等式不再成立');

  const iocPlain = A.indexOfCoincidence(plain);
  const iocSub = A.indexOfCoincidence(sub);
  const iocFrac = A.indexOfCoincidence(frac);
  T.eq(iocSub, iocPlain, '单表代换保持重合指数（同一个计数多重集）');
  T.ok(iocPlain > 0.06, '这段英文的 IoC 在英文的量级上（实测 ' + iocPlain.toFixed(4) + '）');
  T.ok(iocFrac < 0.05, '分裂式摩尔斯的 IoC 掉到 0.05 以下（实测 ' + iocFrac.toFixed(4) + '）');
  /* 离均匀随机（1/26）还剩多少英文信号：单表代换 100%，分裂式只剩三成不到。 */
  const RANDOM = 1 / 26;
  const keptSub = (iocSub - RANDOM) / (iocPlain - RANDOM);
  const keptFrac = (iocFrac - RANDOM) / (iocPlain - RANDOM);
  T.eq(keptSub, 1, '单表代换保留了全部英文信号');
  T.ok(keptFrac < 0.35,
       '分裂式摩尔斯只剩下 ' + (keptFrac * 100).toFixed(0) + '% 的英文信号');

  /* 最高频字母的占比：英文里 E 一枝独秀，代换之后仍然一枝独秀（换了个名字），
     分裂之后被抹平——频率表最上面那一格正是频率分析的入口。 */
  function topShare(t) {
    const c = A.letterCounts(t);
    const n = c.reduce(function (s, x) { return s + x; }, 0);
    return Math.max.apply(null, c) / n;
  }
  T.eq(topShare(sub), topShare(plain), '代换后最高频字母的占比不变');
  T.ok(topShare(frac) < topShare(plain) * 0.7,
       '分裂后最高频字母的占比掉到明文的七成以下（' +
       (topShare(plain) * 100).toFixed(1) + '% → ' + (topShare(frac) * 100).toFixed(1) + '%）');

  T.eq(morse.fractionatedDecrypt(frac, KEY), plain, '长文本也往返');
  T.eq(morse.fromMorse(morse.toMorse(LONG)), plain, '长文本的摩尔斯也往返');
})();

T.report('morse');
