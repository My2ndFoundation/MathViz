'use strict';
const T = require('./_test.js');
const A = require('./cryptanalysis.js');
const C = require('./crypto-core.js');
const caesar = require('./algos/caesar.js');

/* ---- 频率表本身 ---- */
T.eq(A.ENGLISH_FREQ.length, 26, 'ENGLISH_FREQ 有 26 项');
const sum = A.ENGLISH_FREQ.reduce(function (s, x) { return s + x; }, 0);
T.ok(Math.abs(sum - 1) < 1e-6, 'ENGLISH_FREQ 归一化到 1（实际 ' + sum + '）');
T.ok(A.ENGLISH_FREQ.every(function (x) { return x > 0; }), '每个字母频率都为正');
/* E 是英文里最常见的字母，T 次之——这条钉住表没有被抄错顺序。 */
const maxIdx = A.ENGLISH_FREQ.indexOf(Math.max.apply(null, A.ENGLISH_FREQ));
T.eq(maxIdx, 4, '最高频字母是 E（下标 4）');

/* ---- 计数与频率 ---- */
T.eq(A.letterCounts('aab')[0], 2, 'letterCounts 大小写不敏感：a 出现 2 次');
T.eq(A.letterCounts('aab')[1], 1, 'letterCounts：b 出现 1 次');
T.eq(A.letterCounts('!!!').reduce(function (s, x) { return s + x; }, 0), 0,
     'letterCounts 无字母时全 0');
T.eq(A.letterFrequency('aab')[0], 2 / 3, 'letterFrequency 归一化');
T.eq(A.letterFrequency('').reduce(function (s, x) { return s + x; }, 0), 0,
     'letterFrequency 空串全 0，不产生 NaN');

/* ---- χ² ----
   这两条**必须**用 T.ok + === 而不是 T.eq。T.eq 是 JSON.stringify 比对，
   而 JSON.stringify(Infinity)、JSON.stringify(NaN)、JSON.stringify(null)
   三者都是字符串 "null"——用 T.eq 写出来的 `eq(chiSquare(''), Infinity)`
   在实现返回 NaN 时**照样是绿的**，而返回 NaN 恰好会让 Array.sort 的比较
   全部为 false、把这个候选留在原地，第三页的高亮行就选错了。
   一条分不出 Infinity 与 NaN 的断言，守不住它唯一要守的那件事。

   （harness 后来给 serialize 加了 __nonfinite__ 前缀，T.eq 现在也能分辨
   这三者了；但这两条仍然写成 `=== Infinity`——它要钉的就是"恰好是
   Infinity"这一件事，不必绕道 serialize。） */
T.ok(A.chiSquare('') === Infinity, '无字母时 χ² 是 Infinity（永远排在最后）');
T.ok(A.chiSquare('!!! 123') === Infinity, '全非字母同上');
T.ok(!Number.isNaN(A.chiSquare('hello world')), '正常输入不产生 NaN');

/* 核心性质：一段真英文的 χ² 必须低于它自己的任何非零位移密文。
   这就是第三页"穷举"能自动挑出正确答案的全部依据；它若不成立，
   那一页的高亮行就是错的。 */
const PLAIN = 'The quick brown fox jumps over the lazy dog and then runs away ' +
              'into the deep forest where nobody ever finds him again';
const base = A.chiSquare(PLAIN);
for (let k = 1; k < 26; k++) {
  T.ok(base < A.chiSquare(caesar.encrypt(PLAIN, k)),
       '明文 χ²(' + base.toFixed(2) + ') 低于 k=' + k + ' 的密文');
}

/* 端到端：穷举 + χ² 排序必须把 k 选回来。 */
const CIPHER = caesar.encrypt(PLAIN, 7);
const best = A.bruteForceBest(caesar.bruteForce(CIPHER));
T.eq(best.k, 7, 'χ² 排序把 k=7 选了出来');
T.eq(best.text, PLAIN, '选出的候选就是原文');

/* ================= 重合指数 IoC =================
   先用手算得出的小例子钉公式本身，再用真实文本钉数量级。顺序不能反：
   一个公式写错的实现在"英文 ≈ 0.066"这条上照样可能碰巧落在带子里，
   而 IoC('AAB') = 1/3 是纸笔就能验的——三个字母排出 6 个有序对，
   其中 (A,A) 两个，2/6 = 1/3。 */
T.eq(A.indexOfCoincidence('AAB'), 1 / 3, "IoC('AAB') = 2/(3·2) = 1/3（手算）");
T.eq(A.indexOfCoincidence('AA'), 1, "IoC('AA') = 2/(2·1) = 1（两个字母必然相同）");
T.eq(A.indexOfCoincidence('AB'), 0, "IoC('AB') = 0（两个字母必然不同）");
T.eq(A.indexOfCoincidence(C.ALPHABET), 0, 'IoC(整张字母表) = 0（每个字母恰好一次）');
/* N < 2 的两条守的是分母：N(N−1) 在 N=1 时是 0，没有守卫就是 0/0 = NaN，
   而 NaN 进了 icByPeriod 的平均值会污染一整根柱子。 */
T.eq(A.indexOfCoincidence('A'), 0, 'IoC(单个字母) = 0，不是 NaN');
T.eq(A.indexOfCoincidence(''), 0, 'IoC(空串) = 0，不是 NaN');
T.eq(A.indexOfCoincidence('!!! 123'), 0, 'IoC(无字母) = 0，不是 NaN');
T.ok(!Number.isNaN(A.indexOfCoincidence('A')), 'IoC 在 N=1 时不产生 NaN');
/* 单表代换保持 IoC——这正是"IoC 能识别单表 / 多表"的全部依据。 */
const IOC_SRC = 'the quick brown fox jumps over the lazy dog again and again';
for (let k = 1; k < 26; k++) {
  T.ok(Math.abs(A.indexOfCoincidence(caesar.encrypt(IOC_SRC, k)) - A.indexOfCoincidence(IOC_SRC)) < 1e-12,
       '凯撒位移 k=' + k + ' 不改变 IoC（单表代换只是给字母换名字）');
}

/* ---- 确定性伪随机：不许出现 Math.random() ----
   一个随机的门今天绿明天红，最后必然被人加上 retry 或者干脆删掉。种子写死，
   这一段每次跑的都是同一批字母，失败可以原样复现。
   取高位（除以 2³²）而不是低位取模：LCG 的低位周期极短，`s % 26` 会给出
   肉眼可见的规律，那样"均匀随机"这个前提本身就是假的。 */
function lcg(seed) {
  let s = seed >>> 0;
  return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function randomLetters(n, seed) {
  const rnd = lcg(seed);
  let out = '';
  for (let i = 0; i < n; i++) out += C.ALPHABET.charAt(Math.floor(rnd() * 26));
  return out;
}

/* ---- 一段真英文 ----
   自己写的原创散文，约 2060 个字母。它同时是下面 Kasiski / icByPeriod 的明文，
   所以词汇必须够杂：第一版写得太"the … the …"，IoC 冲到 0.0767，
   离教科书的 0.0667 差了 0.01——不是实现错，是那段文字本身比英文更重复。
   把它换成词汇更散的一段之后才落回 0.065。这件事本身值得记下来：
   IoC 量的是**这段文本**的重复程度，不是"英文"这个抽象概念的。 */
const ENGLISH =
  'Astronomers working through the previous decade gradually convinced themselves that the ' +
  'faint smudges catalogued as spiral nebulae were not clouds of gas inside our own galaxy ' +
  'but separate systems of enormous distance. The argument turned on a single measurable ' +
  'quantity, namely the brightness of variable stars whose pulsation period betrays their ' +
  'true luminosity. Once a photographic plate revealed such a star, its apparent dimness ' +
  'became a ruler. Estimates jumped from thousands of light years to millions, and the ' +
  'universe acquired a scale nobody had seriously proposed before. Critics complained that ' +
  'the calibration rested on very few objects, which was fair, yet subsequent measurements ' +
  'confirmed the general picture while revising particular numbers upward again. Meanwhile ' +
  'spectroscopy contributed an unexpected second result: almost every distant system showed ' +
  'its absorption lines displaced toward longer wavelengths, and the displacement grew larger ' +
  'with distance. Interpreting that shift as recession implied an expanding cosmos, a ' +
  'conclusion many physicists resisted because it seemed to require a beginning. Theoretical ' +
  'work had already produced equations admitting such behaviour, but their authors had ' +
  'regarded the solutions as mathematical curiosities rather than descriptions of anything ' +
  'real. Observation forced the reversal. Within twenty years an entire discipline reorganised ' +
  'itself around questions about origin, age, composition and eventual fate, questions that ' +
  'earlier generations would have dismissed as belonging to philosophy or religion instead of ' +
  'physics. Instruments improved, radio telescopes joined optical ones, and background ' +
  'radiation discovered by accident settled the remaining doubt. What began as an argument ' +
  'about blurry photographs finished as a quantitative history of everything. ' +
  'Similar reversals recur throughout science. A measurement nobody trusts becomes routine, ' +
  'a curiosity becomes a field, and the textbooks quietly drop the controversy. Students ' +
  'inherit conclusions without the arguments, which makes the conclusions feel obvious and ' +
  'therefore fragile. Teaching the dispute alongside the result costs time but produces ' +
  'judgement, because judgement is exactly the ability to imagine how a confident statement ' +
  'might fail. Historians of the subject insist on this point and are routinely ignored by ' +
  'curriculum committees, whose incentives reward coverage rather than understanding. The prize ' +
  'for that neglect is a generation of graduates who can recite the size of the observable ' +
  'universe and yet freeze when somebody asks how anyone came to know it.';

const EN_TEXT = C.normalize(ENGLISH);
T.ok(EN_TEXT.length > 1500, '英文样本至少 1500 个字母（实际 ' + EN_TEXT.length + '）—— 太短的样本 IoC 方差大到没有参考价值');

const IOC_EN = A.indexOfCoincidence(EN_TEXT);
const IOC_RAND = A.indexOfCoincidence(randomLetters(5000, 20260810));
/* 理论值：一段按 ENGLISH_FREQ 独立同分布抽样的长文本，IoC → Σ p_i²。
   把断言挂在**本模块自己那张频率表**上，而不是挂在一个抄来的 0.0667：
   这样"频率表"和"IoC"两件事被同一条断言绑在一起，改坏任何一个都会响。 */
const IOC_THEORY = A.ENGLISH_FREQ.reduce(function (s, p) { return s + p * p; }, 0);
T.ok(Math.abs(IOC_THEORY - 0.0655) < 0.002,
     'Σ p_i² ≈ 0.0655，与教科书常引的 0.0667 同一量级（实际 ' + IOC_THEORY.toFixed(5) + '）');
T.ok(IOC_EN > 0.060 && IOC_EN < 0.072,
     '英文样本的 IoC 落在 0.066 附近（实际 ' + IOC_EN.toFixed(5) + '）');
T.ok(Math.abs(IOC_EN - IOC_THEORY) < 0.006,
     '英文样本的 IoC 贴合本模块频率表的 Σ p_i²（实际 ' + IOC_EN.toFixed(5) +
     ' vs ' + IOC_THEORY.toFixed(5) + '）');
T.ok(Math.abs(IOC_RAND - 1 / 26) < 0.003,
     '均匀随机字母的 IoC 落在 1/26 ≈ 0.0385 附近（实际 ' + IOC_RAND.toFixed(5) + '）');
/* 这条才是工具页真正依赖的那件事：两者必须**拉得开**。
   数值各自对但差距不够，判据在屏幕上就是两根差不多高的柱子。 */
T.ok(IOC_EN > 1.5 * IOC_RAND,
     '英文的 IoC 明显高于随机（' + IOC_EN.toFixed(5) + ' vs ' + IOC_RAND.toFixed(5) + '）');

/* ================= n 元组计数 ================= */
/* JSON.stringify(Map) 恒为 "{}"，于是 T.eq 直接比两个 Map **永远是绿的**。
   这一条不是在测 ngramCounts，是把 harness 的这处失明钉在明处——下面所有
   Map 断言都必须先转成数组，谁改回直接比 Map，这条注释就在旁边。
   用 wouldPass 而不是 eq：eq 会把这条"故意的相等"记成一次通过，读起来像
   在主张两个 Map 真的相等。 */
T.ok(T.wouldPass(new Map([['AB', 2]]), new Map()),
     'T.eq 分不清两个不同的 Map（JSON.stringify(Map) 恒为 "{}"）——所以下面一律转数组再比');

function pairs(m) {
  const out = [];
  m.forEach(function (v, k) { out.push([k, v]); });
  out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  return out;
}
T.eq(pairs(A.ngramCounts('ABAB', 2)), [['AB', 2], ['BA', 1]], "ngramCounts('ABAB',2)");
T.eq(pairs(A.ngramCounts('AAA', 1)), [['A', 3]], 'ngramCounts n=1 退化成字母计数');
T.eq(A.ngramCounts('Hello, World!', 3).get('HEL'), 1, 'ngramCounts 先做 normalize');
T.eq(A.ngramCounts('ABC', 4).size, 0, 'n 大于文本长度时为空');
T.eq(A.ngramCounts('', 3).size, 0, '空文本为空');
/* n 元组总数守恒：长度 L 的文本有 L−n+1 个 n 元组，计数之和必须等于它。
   这一条能抓住"少算最后一个窗口"这类差一错误，而逐个键的断言抓不住。 */
let ngramTotal = 0;
A.ngramCounts(EN_TEXT, 3).forEach(function (v) { ngramTotal += v; });
T.eq(ngramTotal, EN_TEXT.length - 2, '三元组计数之和 = L − 2（窗口不多不少）');
T.eq(A.ngramCounts(EN_TEXT, 1).size, 26, '英文样本里 26 个字母全都出现过');
T.throws(function () { A.ngramCounts('ABC', 0); }, 'ngramCounts 拒绝 n = 0', /必须是/);
T.throws(function () { A.ngramCounts('ABC', 2.5); }, 'ngramCounts 拒绝非整数 n', /必须是/);

/* ================= 重复片段（Kasiski 第一步）=================
   手算例：ABCXABCYABC —— 'ABC' 出现在 0、4、8，相邻间距 [4,4]；
   长度 4 时一条重复都没有，循环就此收工，所以结果**只有一条**。 */
T.eq(A.repeatedSequences('ABCXABCYABC', 3),
     [{ seq: 'ABC', positions: [0, 4, 8], gaps: [4, 4] }],
     "repeatedSequences('ABCXABCYABC',3) 手算结果");
T.eq(A.repeatedSequences('ABCDEFG', 3), [], '没有重复片段时返回空数组');
T.eq(A.repeatedSequences('AB', 3), [], '文本比 minLen 还短');
/* gaps 是相邻之差，不是两两之差：三次出现给 2 条间距，不是 3 条。 */
T.eq(A.repeatedSequences('ABCXABCYABC', 3)[0].gaps.length, 2,
     '三次出现给出 2 条相邻间距（不是 C(3,2)=3 条两两间距）');
T.throws(function () { A.repeatedSequences('ABC', 0); }, 'minLen 必须 >= 1', /minLen/);
T.throws(function () { A.repeatedSequences('ABC', 3, 2); }, 'maxLen 不能小于 minLen', /maxLen/);

/* 退化输入的性能护栏。周期性密文（把 'AAAA…' 用长度 7 的密钥加密）的最长重复串
   是 N−7；没有 maxLen 上限时循环会一路跑到 N、每层切 N 个近 N 长的子串，
   O(N³) 字节，页面当场卡死。教学页恰恰最容易被喂这种输入。
   这条断言同时钉住"确实截在 32"和"确实还跑得完"。 */
const DEGENERATE = (function () {
  const p = C.letters('A'.repeat(4000)), k = C.letters('CRYPTID'), out = [];
  for (let i = 0; i < p.length; i++) out.push(C.mod(p[i] + k[i % k.length], 26));
  return C.fromIndices(out);
})();
const degT0 = Date.now();
const degSeq = A.repeatedSequences(DEGENERATE, 3);
const degMs = Date.now() - degT0;
T.eq(degSeq[0].seq.length, 32, '周期性密文的最长重复串被截在 maxLen = 32');
T.ok(degMs < 2000, '4000 字母的周期性密文在 2 秒内跑完（实际 ' + degMs + ' ms）');

/* ================= Kasiski 与 icByPeriod：端到端 =================
   用已知密钥加密真英文，再要求两个判据把周期指回来。这不是单元测试，
   是这两个函数的**存在理由**：它们在屏幕上要回答"这把密钥有多长"。 */
function vigenere(text, key) {
  const p = C.letters(text), k = C.letters(key), out = [];
  for (let i = 0; i < p.length; i++) out.push(C.mod(p[i] + k[i % k.length], 26));
  return C.fromIndices(out);
}
/* 本地实现而不是 require('./algos/vigenere.js')：这一批只动 core 的两个模块，
   algos/vigenere.js 还不存在。四行的加密器不值得为它拖一个依赖，
   而且测试自己造夹具，也就不会出现"算法和分析共用同一处错误"的合谋。 */
T.eq(vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR', '本地 Vigenère 夹具对教科书向量正确');

/* 三把长度 7 的密钥，避免结论依赖某一把密钥的巧合。 */
['CRYPTID', 'MERCURY', 'HEXAGON'].forEach(function (KEY) {
  const CT = vigenere(EN_TEXT, KEY);
  T.eq(CT.length, EN_TEXT.length, KEY + '：密文与明文等长');
  /* 多表代换把 IoC 压向 0.0385——这是"该上 Kasiski 了"的信号。 */
  const icCipher = A.indexOfCoincidence(CT);
  T.ok(icCipher < 0.05, KEY + '：整段密文的 IoC 被压向随机（实际 ' + icCipher.toFixed(5) + '）');

  const ranked = A.kasiskiPeriods(CT, { maxPeriod: 20 });
  T.ok(ranked.length > 0, KEY + '：Kasiski 找得到重复片段');
  T.eq(ranked[0].period, 7, KEY + '：Kasiski 排第一的周期是 7（score ' +
       ranked[0].score.toFixed(4) + '，命中 ' + ranked[0].hits + '/' + ranked[0].total + '）');
  T.ok(ranked[0].score > 0.5, KEY + '：第一名的 score 高于 0.5（实际 ' + ranked[0].score.toFixed(4) + '）');
  /* 差距要拉得开，否则页面上第一名和第二名是两根差不多高的柱子，
     "Kasiski 指出了周期"这句话就没有说服力。第二名总是 14 —— 7 的倍数，
     这恰恰是 Kasiski 只能定到"周期或其倍数"的写照。 */
  T.eq(ranked[1].period, 14, KEY + '：第二名是 14（7 的倍数，Kasiski 定不到唯一值）');
  T.ok(ranked[0].score > 2 * ranked[1].score,
       KEY + '：第一名的 score 是第二名的 2 倍以上（' + ranked[0].score.toFixed(4) +
       ' vs ' + ranked[1].score.toFixed(4) + '）');

  /* icByPeriod：只看 1..13，把 14 排除在外——7 和 14 会给出几乎一样高的峰，
     "谁是真周期"要靠人取最小的那个高点，不该由断言假装能分辨。 */
  const ic = A.icByPeriod(CT, 13);
  T.eq(ic.length, 13, KEY + '：icByPeriod(…, 13) 给出 13 个周期');
  T.eq(ic[0].period, 1, KEY + '：从 p=1 开始（整段文本的 IoC，作为对比基线）');
  const peak = ic.slice().sort(function (a, b) { return b.ic - a.ic; })[0];
  T.eq(peak.period, 7, KEY + '：icByPeriod 在 1..13 上的峰值恰好在 7（ic ' + peak.ic.toFixed(4) + '）');
  T.ok(peak.ic > 0.06, KEY + '：真周期那一列的 IoC 回到英文水平（实际 ' + peak.ic.toFixed(4) + '）');
  const worst = Math.max.apply(null, ic.filter(function (r) { return r.period % 7 !== 0; })
                                       .map(function (r) { return r.ic; }));
  T.ok(worst < 0.05, KEY + '：非 7 倍数的周期全都塌在 0.05 以下（最高 ' + worst.toFixed(4) + '）');
  T.ok(peak.ic > 1.4 * worst, KEY + '：峰值明显高出其余（' + peak.ic.toFixed(4) +
       ' vs ' + worst.toFixed(4) + '）');
});

/* 换两个别的密钥长度，确认结论不是"7"这个数的巧合。 */
[['LEMON', 5], ['THUNDERBOLT', 11]].forEach(function (pair) {
  const KEY = pair[0], L = pair[1];
  const CT = vigenere(EN_TEXT, KEY);
  const ranked = A.kasiskiPeriods(CT, { maxPeriod: 20 });
  T.eq(ranked[0].period, L, KEY + '（长度 ' + L + '）：Kasiski 排第一的仍是真周期（score ' +
       ranked[0].score.toFixed(4) + '）');
  const ic = A.icByPeriod(CT, 2 * L - 1);
  const peak = ic.slice().sort(function (a, b) { return b.ic - a.ic; })[0];
  T.eq(peak.period, L, KEY + '：icByPeriod 在 1..' + (2 * L - 1) + ' 上的峰值在 ' + L +
       '（ic ' + peak.ic.toFixed(4) + '）');
});

/* Kasiski 的计分方式：手算例 gaps = [4,4]。
   若按"被整除的间距条数"排序，p=2 和 p=4 都是 2 条、并列，排序只好看运气；
   减掉 1/p 之后 p=4 得 1 − 0.25 = 0.75、p=2 得 1 − 0.5 = 0.5，4 干净地赢。
   这条断言就是那个减法的存在理由。 */
const smallRank = A.kasiskiPeriods('ABCXABCYABC', { maxPeriod: 8 });
T.eq(smallRank[0].period, 4, '手算例：p=4 排第一（间距 4 只被 4 整除得最"不像巧合"）');
T.eq(smallRank[0].score, 0.75, '手算例：score(4) = 1 − 1/4 = 0.75');
T.eq(smallRank[1].period, 2, '手算例：p=2 第二');
T.eq(smallRank[1].score, 0.5, '手算例：score(2) = 1 − 1/2 = 0.5（命中率相同，但 2 更容易碰巧命中）');
T.eq(A.kasiskiPeriods('ABCDEFG', {}), [],
     '没有重复片段时返回空数组，而不是一串并列 0 分（并列 0 分排序后第一名是 minPeriod，页面会当成结论显示出来）');
T.throws(function () { A.kasiskiPeriods('ABC', { minPeriod: 0 }); }, 'minPeriod 必须 >= 1', /minPeriod/);
T.throws(function () { A.kasiskiPeriods('ABC', { maxPeriod: 1 }); }, 'maxPeriod 不能小于 minPeriod', /maxPeriod/);

/* ================= 分列 ================= */
T.eq(A.columnsForPeriod('ABCDEFG', 3), ['ADG', 'BE', 'CF'], 'columnsForPeriod 按 i mod p 分列');
T.eq(A.columnsForPeriod('ABCDEFG', 1), ['ABCDEFG'], 'p=1 就是整段文本');
T.eq(A.columnsForPeriod('Hello, World!', 2), ['HLOOL', 'ELWRD'], 'columnsForPeriod 先 normalize');
/* 恒返回 p 个元素：调用方是按下标取"第 4 列"的，长度随文本变化会让那句取值
   时灵时不灵。文本比 p 短时后面的列是空串，不是缺失。 */
T.eq(A.columnsForPeriod('AB', 5), ['A', 'B', '', '', ''], '文本比 p 短时仍返回 p 个元素（空串补齐）');
T.eq(A.columnsForPeriod('', 3), ['', '', ''], '空文本返回 p 个空串');
/* 分列不丢字母：各列长度之和必须等于文本长度。 */
const cols7 = A.columnsForPeriod(EN_TEXT, 7);
T.eq(cols7.reduce(function (s, c) { return s + c.length; }, 0), EN_TEXT.length,
     '分列不丢字母：各列长度之和 = 文本长度');
T.throws(function () { A.columnsForPeriod('ABC', 0); }, 'columnsForPeriod 拒绝周期 0', /周期/);
T.throws(function () { A.columnsForPeriod('ABC', 1.5); }, 'columnsForPeriod 拒绝非整数周期', /周期/);
T.throws(function () { A.icByPeriod('ABC', 0); }, 'icByPeriod 拒绝 maxPeriod = 0', /maxPeriod/);

/* ================================================================
   密文分类（"还不知道这是什么密码"那一步）
   ================================================================ */
const sub  = require('./algos/substitution.js');
const vig  = require('./algos/vigenere.js');
const tra  = require('./algos/transposition.js');
const pf   = require('./algos/playfair.js');
const hill = require('./algos/hill.js');
const affine = require('./algos/affine.js');
const EX   = require('../examples/examples.js');

const LONG = EX.plaintext('cryptanalysis-note').text.en;
const LONG_N = C.normalize(LONG).length;
T.ok(LONG_N >= 400, '教学长文至少 400 个字母（实际 ' + LONG_N + '）');
T.eq(LONG_N, 656, '教学长文是 656 个字母——下面每一个实测数字都绑在这个长度上');

/* ---- digraphDoubles ----
   切法是**不重叠**的。这不是实现细节：Playfair 的"永不输出重复对"只在它
   自己的偶数对齐上成立，换成滑窗就退化成一条统计断言。 */
T.eq(A.digraphDoubles('AABB').pairs, 2, 'digraphDoubles：4 个字母 = 2 对（不重叠）');
T.eq(A.digraphDoubles('AABB').doubles, 2, 'AA|BB 是两个重复对');
T.eq(A.digraphDoubles('ABAB').doubles, 0, 'AB|AB 一个重复对都没有');
/* 滑窗切法会把 'ABBA' 数成 1（中间那个 BB），不重叠切法数成 0（AB|BA）。
   这条断言就是两种切法的分界线，改错了它会立刻变红。 */
T.eq(A.digraphDoubles('ABBA').doubles, 0,
     'ABBA 的重复对是 0——滑窗切法会数成 1，这条钉住的正是"不重叠"');
T.eq(A.digraphDoubles('ABCDE').pairs, 2, '奇数长度时末尾那个落单字母不成对');
T.eq(A.digraphDoubles('Hello, World!').pairs, 5, 'digraphDoubles 先 normalize（10 个字母 = 5 对）');
{
  const d = A.digraphDoubles(LONG);
  T.eq(d.pairs, 328, '656 个字母 = 328 对');
  T.ok(Math.abs(d.expected - d.pairs * A.indexOfCoincidence(LONG)) < 1e-12,
       'expected 就是 pairs × IoC');
  /* 期望**不是** pairs/26。这条断言把两个公式的差值钉住：pairs/26 = 12.62，
     pairs×IoC = 23.77，差了将近一倍。 */
  T.ok(Math.abs(d.expected - 23.77) < 0.01,
       '长文的期望重复对 ≈ 23.77（实测）');
  T.ok(Math.abs(d.pairs / 26 - 12.62) < 0.01,
       '同一段文本用 pairs/26 只给 12.62——这就是为什么不能用它');
}
T.eq(A.digraphDoubles('').pairs, 0, '空串 0 对');
T.eq(A.digraphDoubles('').expected, 0, '空串期望 0，不是 NaN');

/* ---- 事实 4：pairs × IoC 是对的基准，pairs / 26 不是 ----
   对三段真实的多表密文比较两个公式与实测值。判据：IoC 版本必须更接近。 */
[['HORIZON', 14], ['CRYPTO', 14], ['KEY', 16]].forEach(function (spec) {
  const d = A.digraphDoubles(vig.encrypt(LONG, spec[0]));
  T.eq(d.doubles, spec[1], '维吉尼亚 ' + spec[0] + '（p=' + spec[0].length + '）观测到 ' +
       spec[1] + ' 个重复对');
  T.ok(Math.abs(d.doubles - d.expected) < Math.abs(d.doubles - d.pairs / 26),
       '维吉尼亚 ' + spec[0] + '：pairs×IoC（' + d.expected.toFixed(2) +
       '）比 pairs/26（' + (d.pairs / 26).toFixed(2) + '）更接近实测 ' + d.doubles);
});

/* ---- absentLetters ---- */
T.eq(A.absentLetters(C.ALPHABET), [], '全字母表：没有缺席的字母');
T.eq(A.absentLetters('ABC').length, 23, 'ABC 缺 23 个字母');
T.eq(A.absentLetters('ABC')[0], 'D', '按字母序返回');
T.eq(A.absentLetters(LONG), ['Z'], '教学长文只缺 Z');
T.eq(A.absentLetters(pf.encrypt(LONG, 'MONARCHY')), ['J'],
     'Playfair 密文缺且只缺 J —— 25 格方阵里没有 J 的位置');

/* ================= 事实 3：Playfair 结构上不可能输出重复对 =================
   这一版测试是**带负对照**的。原始探针把 mapPair() 的返回**对象**当字符串比，
   即 String(out)[0] === String(out)[1] 恒为 '[' === '['? 不——是
   '[object Object]' 的第 0 与第 1 个字符 '[' 与 'o'，永远不等，于是"0 次违规"
   是在什么都没量的情况下报出来的。下面三条防线让这条测试无法靠"量了个空"通过：
     (a) 读的是 .out；
     (b) 断言取到的确实是 2 个字符的字符串；
     (c) 断言行/列/矩形三条规则都被走到了（分布非退化）。 */
{
  const KEYS = ['MONARCHY', 'PLAYFAIR', 'CRYPTANALYSIS', 'ZEBRA', 'QWERTY', ''];
  const SQ_AL = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';      // 25 个字母，J 已并进 I
  T.eq(SQ_AL.length, 25, '方阵字母表是 25 个字母');
  const rules = { row: 0, col: 0, rect: 0 };
  let tested = 0, doubled = 0, notTwoChars = 0;
  KEYS.forEach(function (kw) {
    const sq = pf.makeSquare(kw);
    for (let i = 0; i < 25; i++) for (let j = 0; j < 25; j++) {
      if (i === j) continue;                       // 相同字母的对 pairAt 会抛，不属于本实验
      const r = pf.mapPair(sq, SQ_AL.charAt(i), SQ_AL.charAt(j), 1);
      const out = r.out;
      if (typeof out !== 'string' || out.length !== 2) { notTwoChars++; continue; }
      rules[r.rule] = (rules[r.rule] || 0) + 1;
      tested++;
      if (out.charAt(0) === out.charAt(1)) doubled++;
    }
  });
  T.eq(tested, 3600, '穷举 6 把密钥 × 600 对互异字母 = 3600 对');
  T.eq(notTwoChars, 0, '(a)(b) 每一次 mapPair().out 都是一个 2 字符的字符串');
  T.eq(rules, { row: 600, col: 600, rect: 2400 },
       '(c) 三条规则都被走到：行 600 / 列 600 / 矩形 2400，分布非退化');
  T.eq(doubled, 0, '3600 对里 0 次输出重复对 —— 结构上不可能，不是统计上少见');
  /* 负对照：把同一段代码故意读成对象再比，证明原来那条探针确实量了个空。 */
  let vacuous = 0;
  const sq = pf.makeSquare('MONARCHY');
  for (let i = 0; i < 25; i++) for (let j = 0; j < 25; j++) {
    if (i === j) continue;
    const r = pf.mapPair(sq, SQ_AL.charAt(i), SQ_AL.charAt(j), 1);
    if (String(r)[0] === String(r)[1]) vacuous++;
  }
  T.eq(vacuous, 0, '负对照：把返回对象当字符串比时也是 0 —— 所以"0 次"本身不构成证据，' +
       '上面 (a)(b)(c) 三条才是');
  T.ok(String(pf.mapPair(sq, 'A', 'B', 1)) === '[object Object]',
       '负对照的成因：mapPair 返回的是对象，String() 得到 [object Object]');
}

/* ================= 事实 1：换位逐位保住单字母统计 ================= */
{
  const ct = tra.columnarEncrypt(LONG, 'ANALYST');
  T.eq(A.letterCounts(ct), A.letterCounts(LONG),
       '列换位后 letterCounts 逐项相同 —— 换位只动位置');
  T.ok(A.chiSquare(ct) === A.chiSquare(LONG), 'χ² 逐位相同（不是约等于）');
  T.ok(Math.abs(A.chiSquare(LONG) - 28.3949) < 0.001,
       '这段文本的 χ² 实测 28.3949（明文与密文同一个值）');
  T.ok(A.indexOfCoincidence(ct) === A.indexOfCoincidence(LONG), 'IoC 也逐位相同');
}

/* ================= 事实 2：单表代换保住 IoC，摧毁 χ² ================= */
{
  const key = sub.randomKey(A.rng32(20260810));
  T.ok(sub.isValidKey(key), '种子化的随机密钥是合法排列');
  const ct = sub.encrypt(LONG, key);
  T.ok(A.indexOfCoincidence(ct) === A.indexOfCoincidence(LONG),
       '单表代换是字母上的双射，IoC 逐位不变');
  T.ok(Math.abs(A.indexOfCoincidence(LONG) - 0.072473) < 1e-6,
       '这段文本的 IoC 实测 0.072473');
  T.ok(A.chiSquare(ct) > 30 * A.chiSquare(LONG),
       'χ² 却涨了 30 倍以上（实测 28.39 → ' + A.chiSquare(ct).toFixed(1) + '）');
}

/* ================= MIN_SAMPLE 与 classify ================= */
T.eq(A.MIN_SAMPLE, 200, 'MIN_SAMPLE = 200');
T.eq(A.IC_SINGLE, 0.055, '单表 / 多表的 IoC 分界是 0.055');
T.eq(A.CHI2_PER_LETTER, 1, '每字母 χ² 的分界是 1.0');

/* 低于 MIN_SAMPLE 一律不给家族。用真实的短样本，不是造出来的边角料。 */
[['pangram', 95], ['caesar-quote', 91], ['attack', 12]].forEach(function (spec) {
  const r = A.classify(caesar.encrypt(EX.plaintext(spec[0]).text.en, 7));
  T.eq(r.n, spec[1], spec[0] + ' 的密文有 ' + spec[1] + ' 个字母');
  T.eq(r.confident, false, spec[0] + '：n < 200，confident 为 false');
  T.eq(r.family, 'unknown', spec[0] + '：不给家族名');
  T.eq(r.reasons.map(function (x) { return x.key; }), ['sample-too-small'],
       spec[0] + '：唯一的理由是样本太小');
  T.ok(r.measurements.ic > 0, spec[0] + '：测量值照样给出（拒绝的是结论，不是数据）');
});
/* 恰好落在门槛两侧。199 拒绝、200 接受——这条把 "<" 与 "<=" 的差别钉死。 */
{
  const s = C.normalize(LONG);
  T.eq(A.classify(s.slice(0, 199)).confident, false, 'n = 199 拒绝');
  T.eq(A.classify(s.slice(0, 200)).confident, true, 'n = 200 接受');
  T.eq(A.classify(s.slice(0, 199)).family, 'unknown', 'n = 199 家族是 unknown');
}

/* 每一类都用真算法造样本，逐条对家族。 */
const CASES = [
  ['plain',        LONG,                                          'transposition'],
  ['caesar',       caesar.encrypt(LONG, 7),                       'monoalphabetic'],
  ['affine',       affine.encrypt(LONG, 5, 8),                    'monoalphabetic'],
  ['substitution', sub.encrypt(LONG, sub.randomKey(A.rng32(7))),  'monoalphabetic'],
  ['columnar',     tra.columnarEncrypt(LONG, 'ANALYST'),          'transposition'],
  ['railfence',    tra.railFenceEncrypt(LONG, 4),                 'transposition'],
  ['vigenere',     vig.encrypt(LONG, 'HORIZON'),                  'polyalphabetic'],
  ['beaufort',     vig.beaufortEncrypt(LONG, 'SIGNAL'),           'polyalphabetic'],
  ['playfair',     pf.encrypt(LONG, 'MONARCHY'),                  'polygraphic-playfair'],
  ['hill2',        hill.encrypt(LONG, [[3, 3], [2, 5]]),          'polyalphabetic'],
  ['hill3',        hill.encrypt(LONG, [[6, 24, 1], [13, 16, 10], [20, 17, 15]]), 'polyalphabetic']
];
CASES.forEach(function (c) {
  const r = A.classify(c[1]);
  T.eq(r.family, c[2], 'classify(' + c[0] + ') = ' + c[2]);
  T.eq(r.confident, true, c[0] + ' 的样本够长');
  T.ok(r.reasons.length > 0, c[0] + ' 至少给出一条理由');
  r.reasons.forEach(function (x) {
    T.ok(!!x.key && !!x.zh && !!x.en, c[0] + ' 的理由 ' + x.key + ' 有 key / zh / en 三样');
  });
});
/* 路由路径本身是结果的一部分——页面要把它原样画出来，所以顺序也钉住。 */
T.eq(A.classify(pf.encrypt(LONG, 'MONARCHY')).reasons.map(function (x) { return x.key; }),
     ['even-length', 'no-j', 'no-doubles'],
     'Playfair 走的是三条结构判据，顺序固定');
T.eq(A.classify(caesar.encrypt(LONG, 7)).reasons.map(function (x) { return x.key; }),
     ['ic-single', 'chi2-scrambled'],
     '单表：先 IoC 后 χ²');
T.eq(A.classify(LONG).reasons.map(function (x) { return x.key; }),
     ['ic-single', 'chi2-english', 'transposition-caveat'],
     '换位分支必须带上"分不开明文"那条告诫');
T.eq(A.classify(vig.encrypt(LONG, 'HORIZON')).reasons.map(function (x) { return x.key; }),
     ['ic-flat', 'doubles-present', 'next-fork-period'],
     '多表：IoC 压平 → 有重复对（排除 Playfair）→ 下一步去测周期');

/* 事实 7：单靠 IoC 分不开 Playfair 与短周期维吉尼亚——两者落在同一档，
   把它们分开的是结构判据。 */
{
  const icPf = A.indexOfCoincidence(pf.encrypt(LONG, 'MONARCHY'));
  const icV3 = A.indexOfCoincidence(vig.encrypt(LONG, 'KEY'));
  T.ok(icPf < A.IC_SINGLE && icV3 < A.IC_SINGLE,
       'Playfair 与 p=3 维吉尼亚的 IoC 都在 0.055 以下（' + icPf.toFixed(4) +
       ' / ' + icV3.toFixed(4) + '）');
  T.ok(Math.abs(icPf - icV3) < 0.01,
       '两者相差不到 0.01 —— IoC 这一条判据在它们之间是瞎的');
  T.eq(A.digraphDoubles(pf.encrypt(LONG, 'MONARCHY')).doubles, 0, '分开它们的是重复对：Playfair 0 个');
  T.eq(A.digraphDoubles(vig.encrypt(LONG, 'KEY')).doubles, 16, '维吉尼亚 p=3 有 16 个');
}

/* 结构判据只看结构，不看内容荒不荒谬——这既是它的力量也是它的边界。
   一段 24 字母循环：偶数长度、没有 J、偶数对齐上一个重复对都没有，
   于是它照样被判成 Playfair。把这条写成断言，是为了让"结构判据能被
   构造出的输入骗到"这件事有人看着，而不是等着谁在页面上撞见。 */
{
  const cycle = 'ABCDEFGHIKLMNOPQRSTUVWXY';        // 24 个字母，J 已剔除
  T.eq(cycle.length, 24, '循环节 24 个字母（偶数，所以偶数对齐上永不成对）');
  const forced = cycle.repeat(10);                 // 240 个字母
  T.eq(A.digraphDoubles(forced).doubles, 0, '构造样本确实没有重复对');
  T.ok(A.digraphDoubles(forced).expected > A.DOUBLES_MIN_EXPECTED,
       '而它的期望值够大（' + A.digraphDoubles(forced).expected.toFixed(1) + '），判据在这里有效');
  T.eq(A.classify(forced).family, 'polygraphic-playfair',
       '于是它被判成 Playfair —— 结构判据只问结构');
}

/* ---- 26 字母表这条前提本身 ----
   ADFGVX / 波利比乌斯 / 摩尔斯把一个字母拆成两个以上符号，密文的 IoC 天生
   在 1/6 那一档，比英文还高。不先拦一道，"IoC ≥ 0.055 ⇒ 单表"会把它们
   一律判成单表代换。 */
T.eq(A.ALPHABET_MIN_DISTINCT, 10, '互异字母数不超过 10 时不当作 26 字母表上的密码');
{
  const six = 'ADFGVX';
  let s = '';
  const rng = A.rng32(11);
  for (let i = 0; i < 400; i++) s += six.charAt(Math.floor(rng() * 6));
  const r = A.classify(s);
  T.eq(r.n, 400, 'ADFGVX 样本 400 个字母，长度不是问题');
  T.ok(r.measurements.ic > A.IC_SINGLE,
       '它的 IoC 是 ' + r.measurements.ic.toFixed(3) + '，比英文还高 —— 不拦就会被判成单表');
  T.eq(r.family, 'unknown', 'ADFGVX 不给家族');
  T.eq(r.confident, false, 'ADFGVX 的 confident 是 false');
  T.eq(r.reasons[0].key, 'alphabet-too-small', '第一条理由指出字母表根本不是 26 个');
}
{
  /* 门槛的另一侧：正常密文的互异字母数远在 10 以上，不会被这道门误伤。 */
  const worst = CASES.reduce(function (w, c) {
    const d = 26 - A.absentLetters(c[1]).length;
    return Math.min(w, d);
  }, 26);
  T.ok(worst > A.ALPHABET_MIN_DISTINCT + 10,
       '上面十一个真样本里互异字母最少的也有 ' + worst + ' 个，离门槛远得很');
}

/* ================= 种子化随机数 ================= */
{
  const a = A.rng32(42), b = A.rng32(42), c = A.rng32(43);
  const va = [a(), a(), a()], vb = [b(), b(), b()], vc = [c(), c(), c()];
  T.eq(va, vb, '同一个种子给出同一串数');
  T.ok(JSON.stringify(va) !== JSON.stringify(vc), '不同种子给出不同的串');
  T.ok(va.every(function (x) { return x >= 0 && x < 1; }), '取值落在 [0,1)');
  T.eq(va[0], 0.6011037519201636, 'rng32(42) 的第一个值钉死（换实现要连同下面整张表一起重量）');
}
{
  const k = A.distinctKey(A.rng32(9), 7);
  T.eq(k.length, 7, 'distinctKey 给出指定长度');
  T.eq(new Set(k.split('')).size, 7, 'distinctKey 的字母互不相同');
  T.eq(A.distinctKey(A.rng32(9), 7), k, 'distinctKey 对同种子确定');
}
T.eq(A.cyclicSlice('ABCDE', 3, 4), 'DEAB', 'cyclicSlice 绕回开头');

/* ================= 判错率扫描 —— MIN_SAMPLE = 200 的证据 =================
   这张表就是工具页 evidence 页签上画的那张。断言与页面读的是同一个函数、
   同一个种子、同一份语料，所以两边不可能各算各的。
   数字全部是本仓实测；换语料、换种子、换密钥生成方式都会改变它们，
   那时候要重新量，而不是把断言改成"差不多就行"。 */
{
  const SW = A.icSweep({ source: EX.classical.sweepSource, substitution: sub, vigenere: vig });
  T.eq(SW.seed, 20260810, '扫描的种子');
  T.eq(SW.trials, 40, '每个长度每一侧 40 个样本');
  T.eq(SW.threshold, 0.055, '阈值就是 IC_SINGLE');
  T.eq(SW.lengths, [40, 60, 80, 100, 150, 200, 300, 500], '八个长度');
  T.eq(SW.sourceLength, 854, '语料 854 个字母');
  T.eq(SW.rows.map(function (r) { return r.monoErr; }), [12, 3, 2, 1, 0, 0, 0, 0],
       '单表被判成多表：12 3 2 1 0 0 0 0');
  T.eq(SW.rows.map(function (r) { return r.polyErr; }), [5, 0, 3, 1, 1, 1, 0, 0],
       '多表被判成单表：5 0 3 1 1 1 0 0');
  T.eq(SW.totalMonoErr, 18, '单表侧合计 18 次判错');
  T.eq(SW.totalPolyErr, 11, '多表侧合计 11 次判错');
  /* 两次调用必须逐位相同——页面每次载入都要画出同一张图。 */
  const SW2 = A.icSweep({ source: EX.classical.sweepSource, substitution: sub, vigenere: vig });
  T.eq(SW2.rows.map(function (r) { return r.monoIc; }),
       SW.rows.map(function (r) { return r.monoIc; }), '两次扫描逐个 IoC 相同');
  /* 真正的论点不是"判错数变小"，是**两条分布带在短样本上重叠**。
     n=40 时它们重叠，n=300 起完全分开。 */
  function overlaps(r) { return Math.min(r.monoMax, r.polyMax) > Math.max(r.monoMin, r.polyMin); }
  T.eq(SW.rows.map(overlaps), [true, true, true, true, false, false, false, false],
       '两条带在 n ≤ 100 时重叠，n ≥ 150 起分开');
  T.ok(SW.rows[0].monoMin < SW.rows[0].polyMax,
       'n=40：最"平"的单表样本比最"尖"的多表样本还平（' +
       SW.rows[0].monoMin.toFixed(4) + ' < ' + SW.rows[0].polyMax.toFixed(4) + '）');
  /* 单表侧的 IoC 与密钥无关（单表代换是双射），所以那一侧量的其实是
     "n 个字母的英文，重合指数有多不稳"。这条把它变成断言而不是注释。 */
  const p40 = A.cyclicSlice(C.normalize(EX.classical.sweepSource), 17, 40);
  T.ok(A.indexOfCoincidence(sub.encrypt(p40, sub.randomKey(A.rng32(3)))) ===
       A.indexOfCoincidence(p40),
       '单表侧的 IoC 完全由明文切片决定，密钥不起作用');
}
/* 源文比最长样本还短时必须当场拒绝：循环切片会把同一段文字接好几遍，
   画出来的不是英文的抖动而是复读机的抖动。 */
T.throws(function () {
  A.icSweep({ source: 'SHORT', substitution: sub, vigenere: vig });
}, '源文太短要抛', /源文/);
T.throws(function () {
  A.icSweep({ source: EX.classical.sweepSource, vigenere: vig });
}, '缺 substitution 模块要抛', /substitution/);
T.throws(function () {
  A.icSweep({ source: EX.classical.sweepSource, substitution: sub });
}, '缺 vigenere 模块要抛', /vigenere/);

/* ================= 语料本身 ================= */
T.eq(EX.classical.SWEEP_IDS, ['cryptanalysis-note', 'pangram', 'caesar-quote', 'attack'],
     '扫描语料的 id 清单是冻结的 —— 改动它就要重量上面那张表');
T.eq(C.normalize(EX.classical.sweepSource).length, 854, '语料 854 个字母');
T.ok(Math.abs(A.indexOfCoincidence(EX.classical.sweepSource) - 0.06889) < 1e-5,
     '语料的 IoC 是 0.06889，比单用长文的 0.07247 更接近普通英文的 0.0667');

T.report('cryptanalysis');
