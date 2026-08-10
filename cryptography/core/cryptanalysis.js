(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./crypto-core.js'));
  else root.Cryptanalysis = factory(root.CryptoCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const RAW = [.08167,.01492,.02782,.04253,.12702,.02228,.02015,.06094,.06966,
               .00153,.00772,.04025,.02406,.06749,.07507,.01929,.00095,.05987,
               .06327,.09056,.02758,.00978,.02360,.00150,.01974,.00074];
  /* 这张表来自公开的英文字母频率统计，26 个值之和是 0.99999 而不是 1。
     差的那 1e-5 对 χ² 排序毫无影响，但它比"频率表求和为 1"这条断言的容差
     （1e-6）大了整整一个数量级——不归一化那条断言直接过不了。归一化不是
     装饰：它同时把"频率表求和为 1"这条读代码的人会默认成立、也确实值得
     成立的性质做实。 */
  const TOTAL = RAW.reduce(function (s, x) { return s + x; }, 0);
  const ENGLISH_FREQ = RAW.map(function (x) { return x / TOTAL; });

  function letterCounts(text) {
    const counts = new Array(26).fill(0);
    const idx = C.letters(text);
    for (let i = 0; i < idx.length; i++) counts[idx[i]]++;
    return counts;
  }

  function letterFrequency(text) {
    const counts = letterCounts(text);
    const n = counts.reduce(function (s, x) { return s + x; }, 0);
    if (n === 0) return counts;            // 全 0，且不产生 NaN
    return counts.map(function (x) { return x / n; });
  }

  /* χ² = Σ (观测 − 期望)² / 期望。越小越像英文。
     没有字母时返回 Infinity 而不是 0——返回 0 会让一段空候选在排序里
     排到第一名，那正好是"最像英文"的位置，方向完全反了。
     也不能靠"没有守卫时自然算出 NaN"蒙混：NaN 参与的比较全为 false，
     bruteForceBest 的 `s < best.score` 会把它当成"不比现任好"而跳过，
     看起来像对的，实际是排序对这个候选完全失明。 */
  function chiSquare(text) {
    const counts = letterCounts(text);
    const n = counts.reduce(function (s, x) { return s + x; }, 0);
    if (n === 0) return Infinity;
    let x2 = 0;
    for (let i = 0; i < 26; i++) {
      const expected = ENGLISH_FREQ[i] * n;
      const d = counts[i] - expected;
      x2 += d * d / expected;
    }
    return x2;
  }

  /* 给一组 { k, text } 候选打分并挑出最像英文的那个。
     返回原候选对象上补一个 score 字段的浅拷贝，不改调用方的数组。 */
  function bruteForceBest(candidates) {
    let best = null;
    for (let i = 0; i < candidates.length; i++) {
      const s = chiSquare(candidates[i].text);
      if (best === null || s < best.score) {
        best = { k: candidates[i].k, text: candidates[i].text, score: s };
      }
    }
    return best;
  }

  /* ================= 重合指数 IoC =================
     定义：从文本里**不放回**地抽两个字母，它们相同的概率。
     字母 i 出现 f_i 次，能排出 f_i(f_i − 1) 个有序对；全部有序对是 N(N − 1)。

         IoC = Σ f_i(f_i − 1) / (N(N − 1))

     分母写 N(N−1) 而不是 N²：N² 对应**放回**抽样，会把一个字母跟它自己配成对，
     在短文本上系统性偏高（极端情形 N=1 时 Σf² / N² = 1，"一个字母的文本
     重合指数是 1"显然是胡说）。N(N−1) 这一版是无偏的。

     两个参考值是整个维吉尼亚分析的支点：
       · 英文 ≈ 0.0667
       · 26 个字母均匀随机 ≈ 1/26 ≈ 0.0385
     单表代换**保持** IoC（只是给字母换名字，f_i 的多重集合不变），
     多表代换把它压向 0.0385。所以 IoC 不告诉你密钥是什么，它告诉你
     "这是不是一张单表"——这正是第一步该问的问题。

     N < 2 时分母为 0，返回 0 而不是 NaN。NaN 一旦进了取最大值或排序，
     所有比较都是 false，那一项会被静默跳过：页面上少一根柱子，没人知道。 */
  function indexOfCoincidence(text) {
    const counts = letterCounts(text);
    let n = 0;
    for (let i = 0; i < 26; i++) n += counts[i];
    if (n < 2) return 0;
    let s = 0;
    for (let i = 0; i < 26; i++) s += counts[i] * (counts[i] - 1);
    return s / (n * (n - 1));
  }

  /* n 元组计数，键是 n 个字母的字符串。
     返回 Map 而不是普通对象：插入顺序稳定、size 直接可读，也不会有人对它
     误用 for...in 而扫到原型链上去。
     **测试注意**：JSON.stringify(Map) 恒为 "{}"，所以 T.eq 直接比两个 Map
     永远是绿的。测试文件里有一条专门的断言把这个坑钉在明处。 */
  function ngramCounts(text, n) {
    if (!Number.isInteger(n) || n < 1) {
      throw new Error('ngramCounts 的 n 必须是 >= 1 的整数，收到 ' + n);
    }
    const s = C.normalize(text);
    const out = new Map();
    for (let i = 0; i + n <= s.length; i++) {
      const g = s.slice(i, i + n);
      out.set(g, (out.get(g) || 0) + 1);
    }
    return out;
  }

  /* Kasiski 第一步：找出密文里重复出现的片段，记下它们的间距。
     为什么重复片段能泄露周期：维吉尼亚下，同一段明文只有在**密钥对齐**时才
     加成同一段密文，所以一段重复密文的间距十有八九是周期的整数倍。

     可以在"某个长度一条重复都没有"时收工：长度 L+1 的片段若重复，它的长度 L
     前缀必然也重复；于是"L 处无重复"蕴含"L+1 处无重复"，不需要拍脑袋定上限。

     但仍然留了一个 maxLen（默认 32），因为那条单调性在**周期性文本**上帮不了忙：
     把 'AAAA…' 用长度 7 的密钥加密，密文本身周期为 7，最长重复串是 N−7，
     循环会一路跑到 N，每层还要切 N 个长度近 N 的子串——O(N³) 字节，页面卡死。
     教学页恰恰最容易被喂这种退化输入。而对 Kasiski 来说，拿到一条长度 32 的
     重复串时证据早已压倒性，再长也不添新东西。

     gaps 取**相邻**位置之差，不是全部两两之差。任意两两之差都是相邻之差的和，
     把它们也算进来只是把同一份证据按出现次数重新加权一遍，不带来新信息。 */
  const REPEAT_MAX_LEN = 32;

  function repeatedSequences(text, minLen, maxLen) {
    const lo = (minLen === undefined) ? 3 : minLen;
    const hi = (maxLen === undefined) ? REPEAT_MAX_LEN : maxLen;
    if (!Number.isInteger(lo) || lo < 1) {
      throw new Error('repeatedSequences 的 minLen 必须是 >= 1 的整数，收到 ' + minLen);
    }
    if (!Number.isInteger(hi) || hi < lo) {
      throw new Error('repeatedSequences 的 maxLen 必须是 >= minLen 的整数，收到 ' + maxLen);
    }
    const s = C.normalize(text);
    const out = [];
    const top = Math.min(hi, s.length);
    for (let len = lo; len <= top; len++) {
      const pos = new Map();
      for (let i = 0; i + len <= s.length; i++) {
        const g = s.slice(i, i + len);
        const a = pos.get(g);
        if (a) a.push(i); else pos.set(g, [i]);
      }
      let found = 0;
      pos.forEach(function (positions, seq) {
        if (positions.length < 2) return;
        found++;
        const gaps = [];
        for (let i = 1; i < positions.length; i++) gaps.push(positions[i] - positions[i - 1]);
        out.push({ seq: seq, positions: positions, gaps: gaps });
      });
      if (found === 0) break;
    }
    /* 顺序必须是确定的：页面要把前几条列成表给人看，而一个"碰巧的"顺序会让
       同一份密文两次打开显示出不同的"最长重复串"。先长后短（长的证据最硬），
       同长按出现次数多在前，再按首次出现位置。 */
    out.sort(function (a, b) {
      return (b.seq.length - a.seq.length)
          || (b.positions.length - a.positions.length)
          || (a.positions[0] - b.positions[0]);
    });
    return out;
  }

  /* Kasiski 检验：把重复片段的间距拿去试除，最可能的密钥长度是能整除最多间距的那个。

     计分**不能**直接用"被整除的间距条数"：p=2 平白就能整除大约一半的随机间距，
     排序会稳稳地把 2 顶到第一名。所以计的是**超出偶然的部分**

         score(p) = 命中率 − 1/p

     1/p 正是一个与密钥无关的随机间距被 p 整除的概率。真实周期 7 的命中率接近 1，
     score ≈ 1 − 1/7 ≈ 0.86；而 p=2 的命中率也就在 1/2 附近，score ≈ 0。

     14、21 这些倍数仍会拿到正分（它们确实整除一部分间距），但低于 7。这不是缺陷
     而是事实：Kasiski 本来就只能定到"周期或其倍数"，把倍数强行压掉是在替数学
     撒谎。真正分开 7 与 14 的是 icByPeriod。

     长片段的权重是自动的：一个重复的 8 元组会让它内部的 3/4/5/6/7 元组各自也重复，
     同一个间距因此被计入很多次。方向正是想要的——长重复几乎不可能是巧合。

     没有任何重复片段时返回**空数组**，而不是一串并列 0 分。并列 0 分排序后第一名
     是 minPeriod，页面会把它当成"最可能的密钥长度"显示出来——那是凭空捏造。
     空数组让页面必须显式地说"没找到重复片段"。 */
  function kasiskiPeriods(text, opts) {
    const o = opts || {};
    const minPeriod = (o.minPeriod === undefined) ? 2 : o.minPeriod;
    const maxPeriod = (o.maxPeriod === undefined) ? 20 : o.maxPeriod;
    if (!Number.isInteger(minPeriod) || minPeriod < 1) {
      throw new Error('kasiskiPeriods 的 minPeriod 必须是 >= 1 的整数，收到 ' + o.minPeriod);
    }
    if (!Number.isInteger(maxPeriod) || maxPeriod < minPeriod) {
      throw new Error('kasiskiPeriods 的 maxPeriod 必须是 >= minPeriod 的整数，收到 ' + o.maxPeriod);
    }
    const seqs = repeatedSequences(text, o.minLen, o.maxLen);
    const gaps = [];
    for (let i = 0; i < seqs.length; i++) {
      for (let j = 0; j < seqs[i].gaps.length; j++) gaps.push(seqs[i].gaps[j]);
    }
    if (gaps.length === 0) return [];
    const out = [];
    for (let p = minPeriod; p <= maxPeriod; p++) {
      let hits = 0;
      for (let i = 0; i < gaps.length; i++) if (gaps[i] % p === 0) hits++;
      out.push({ period: p, score: hits / gaps.length - 1 / p, hits: hits, total: gaps.length });
    }
    out.sort(function (a, b) { return (b.score - a.score) || (a.period - b.period); });
    return out;
  }

  /* 把文本按周期 p 拆成 p 列（第 k 列是下标 ≡ k (mod p) 的那些字母）。
     恒返回 p 个元素，哪怕文本比 p 还短——调用方是按下标取"第 5 列"的，
     一个长度随文本变化的返回值会让那句取值时灵时不灵。 */
  function columnsForPeriod(text, p) {
    if (!Number.isInteger(p) || p < 1) {
      throw new Error('columnsForPeriod 的周期必须是 >= 1 的整数，收到 ' + p);
    }
    const s = C.normalize(text);
    const cols = [];
    for (let i = 0; i < p; i++) cols.push('');
    for (let i = 0; i < s.length; i++) cols[i % p] += s.charAt(i);
    return cols;
  }

  /* 逐周期的平均重合指数。
     周期猜对时，每一列都是同一个凯撒位移的产物；单表代换保持 IoC，于是每列的
     IoC 都回到英文的 0.066。猜错时列里混着若干个不同位移，IoC 塌向 0.0385。
     这比 Kasiski 稳：它不要求文本里恰好出现重复片段，任何一段够长的密文都能算。

     p 的倍数同样会出现高峰（周期 7 的密文按 14 分列，每列仍是同一个位移），
     所以读峰值时要取**最小**的那个高点。这条不写进代码里当"聪明的后处理"——
     哪个高点是真周期需要人看着曲线判断，替使用者判断掉就把这一页的顿悟点删了。
     从 p=1 开始：p=1 就是整段文本的 IoC，那根柱子是"多表代换把 IoC 压低了"
     这句话的直接证据，没有它，后面的高峰无从对比。 */
  function icByPeriod(text, maxPeriod) {
    const mp = (maxPeriod === undefined) ? 20 : maxPeriod;
    if (!Number.isInteger(mp) || mp < 1) {
      throw new Error('icByPeriod 的 maxPeriod 必须是 >= 1 的整数，收到 ' + maxPeriod);
    }
    const s = C.normalize(text);
    const out = [];
    for (let p = 1; p <= mp; p++) {
      const cols = columnsForPeriod(s, p);
      let sum = 0;
      for (let i = 0; i < cols.length; i++) sum += indexOfCoincidence(cols[i]);
      out.push({ period: p, ic: sum / cols.length });
    }
    return out;
  }

  /* ================= 密文分类：四条判别量 =================
     以下这一段服务的是"还不知道这是什么密码"那一步——它排在本文件已有的
     全部工具之前，因为 Kasiski、逐周期重合指数、χ² 穷举都已经预设了答案：
     你得先认定这是多表代换才会去找周期。分类只用密文本身，不试任何一把密钥。 */

  /* 相邻重复二元组。切法是**不重叠**的（0-1、2-3、4-5……），不是逐位置滑窗。

     这不是随手选的。Playfair 是二元组密码，它的密文天然以偶数位对齐；
     "永远不会输出一对相同字母"这条结构性事实只在**它自己的对齐**上成立。
     换成滑窗，Playfair 密文里照样能撞出重复对（那是跨两个密文对的边界），
     于是这条判据从"结构上不可能"退化成"统计上少见"，而这一页的整个 Playfair
     分支正是建立在前者上的。

     expected 用 pairs × IoC，**不是** pairs / 26。pairs/26 假设密文字母是均匀的，
     而它们不是——即便多表代换也只把 IoC 从 0.066 压到 0.043 左右，离 1/26 = 0.0385
     还差一截（本仓实测 656 字母：维吉尼亚 p=7 得 0.0439、p=3 得 0.0481）。
     IoC 的定义就是"随手抽两个字母相同的概率"，而一个二元组正是两个字母，
     所以 pairs × IoC 是这个计数的正确期望；pairs/26 系统性偏低。
     实测同一段 656 字母的文本：维吉尼亚 p=7 观测 14、pairs×IoC 预测 14.40、
     pairs/26 预测 12.62；p=3 观测 16、预测 15.76 与 12.62。 */
  function digraphDoubles(text) {
    const s = C.normalize(text);
    const pairs = Math.floor(s.length / 2);
    let doubles = 0;
    for (let i = 0; i < pairs; i++) {
      if (s.charAt(2 * i) === s.charAt(2 * i + 1)) doubles++;
    }
    return { pairs: pairs, doubles: doubles, expected: pairs * indexOfCoincidence(s) };
  }

  /* 一次都没出现过的字母，按字母序。Playfair 的 25 格方阵里没有 J，
     所以它的密文**必然**缺 J；仿射在 gcd(a,26) > 1 时也会留下大片空位。
     反过来不成立——一段普通英文短文缺几个字母是常事（本仓那条 656 字母的
     教学明文就缺 Z），所以"缺字母"只能当佐证，不能单独定案。 */
  function absentLetters(text) {
    const counts = letterCounts(text);
    const out = [];
    for (let i = 0; i < 26; i++) if (counts[i] === 0) out.push(C.ALPHABET.charAt(i));
    return out;
  }

  /* 分类需要的最小样本量。200 不是拍脑袋的整数，是量出来的——见下面 icSweep
     的注释与 cryptanalysis.test.js 里钉住的那张表：40 个字母时单表与多表两条
     重合指数分布重叠得看不出边界，判错率两侧合计能到 17/80；到 200 时同一条
     阈值几乎不再犯错。阈值一直没动，动的是证据。 */
  const MIN_SAMPLE = 200;

  /* 单表 / 多表的重合指数分界。0.055 落在英文的 0.0667 与均匀随机的 0.0385
     之间偏英文一侧——因为多表代换的**实测**值并不落在 1/26 上，而在 0.042–0.048
     （本仓 656 字母实测：p=7 → 0.0439、p=6 → 0.0453、p=3 → 0.0481）。
     把分界摆在两个理论值的正中间（0.0526）会让 p=3 那一档时不时越线。 */
  const IC_SINGLE = 0.055;

  /* 每字母 χ²。为什么要除以 n：模型对时 χ² 大致是自由度量级的常数（这里 25），
     模型错时它随 n 线性增长——所以固定阈值在长文本上必然失效，比值不会。
     阈值 1.0 的余量是量出来的：本仓 2000 次抽样，n=200 时英文切片的
     χ²/n 最大 0.413，随机单表代换最小 1.013；n≥500 时 2/2000 把近似恒等的
     代换密钥压到 1.0 以下（0.762、0.840）——那是"密钥几乎什么都没换"的真实
     退化情形，不是判据的毛病，但值得知道。 */
  const CHI2_PER_LETTER = 1.0;

  /* "一个重复对都没有"要能当证据，先得让偶然出现的期望值够大。
     期望 0.4 时观测到 0 毫无信息量；期望 8.7 时观测到 0 的概率约 e^−8.7 ≈ 1.7e−4。 */
  const DOUBLES_MIN_EXPECTED = 3;

  /* 互异字母数不超过这个值时，"这是 26 字母表上的密码"这条前提就不成立了。 */
  const ALPHABET_MIN_DISTINCT = 10;

  function reason(key, zh, en) { return { key: key, zh: zh, en: en }; }

  /* 只看密文的家族判定。返回的 family 只有五个取值，reasons 按**实际走过的
     判据顺序**排列——页面要把这条路径原样画出来，所以顺序是结果的一部分。

     判据顺序不是随意的：Playfair 那条排在最前，因为它是**结构性**的（方阵
     里两个相同字母永远换不出一对相同字母，本仓穷举 6 把密钥 × 600 对
     = 3600 次，行/列/矩形三条规则分别命中 600/600/2400，重复输出 0 次），
     而后面两条都是统计性的。统计判据会随样本抖，结构判据不会，所以先问
     不会抖的那个。实测也支持这个顺序：Playfair 密文的 IoC（本仓 0.0504）
     与维吉尼亚 p=3（0.0481）落在同一档，单靠 IoC 分不开它们。

     n < MIN_SAMPLE 时**不给家族**：family 是 'unknown'、confident 是 false。
     这不是保守，是这一页的主张——低于 200 个字母，同一条阈值的判错率高到
     说出口就是误导。 */
  function classify(text) {
    const s = C.normalize(text);
    const n = s.length;
    const ic = indexOfCoincidence(s);
    const chi2 = chiSquare(s);
    const dg = digraphDoubles(s);
    const absent = absentLetters(s);
    const measurements = {
      ic: ic, chi2: chi2,
      doubles: dg.doubles, expectedDoubles: dg.expected, pairs: dg.pairs,
      absent: absent, evenLength: n > 0 && n % 2 === 0,
      chi2PerLetter: n > 0 ? chi2 / n : Infinity
    };
    const reasons = [];

    if (n < MIN_SAMPLE) {
      reasons.push(reason('sample-too-small',
        '只有 ' + n + ' 个字母，低于 ' + MIN_SAMPLE + '。这四个量都是平均值，' +
        '在这个长度上它们的抖动比它们要区分的差别还大——本页不给结论。',
        'Only ' + n + ' letters, below ' + MIN_SAMPLE + '. All four numbers are averages, ' +
        'and at this length they wobble by more than the differences they are meant to ' +
        'resolve. This page will not name a family.'));
      return { n: n, confident: false, family: 'unknown',
               measurements: measurements, reasons: reasons };
    }

    /* ① 结构判据之前的那一步：这**是不是**一个 26 字母表上的密码。
       ADFGVX 只用 6 个字母、波利比乌斯只用 5 个、摩尔斯只有点和划。它们的
       IoC 天生就在 1/6 = 0.167 那一档，比英文还高——不拦住的话会被下面
       "IoC ≥ 0.055 ⇒ 单表"直接判成单表代换，而那是彻底错的。
       门槛放在 10：n ≥ 200 的英文与它的各种代换/换位密文，互异字母数实测
       都在 24 以上；分裂类密码则在 6 以下，中间那一大段空着。 */
    const distinct = 26 - absent.length;
    if (distinct <= ALPHABET_MIN_DISTINCT) {
      reasons.push(reason('alphabet-too-small',
        '整段密文只用了 ' + distinct + ' 个不同的字母。这不是 26 字母表上的代换，' +
        '而是一个分裂类密码或一套编码（ADFGVX、波利比乌斯方阵、摩尔斯）：' +
        '一个明文字母被拆成了两个或更多符号。往下的三条判据都假设字母表是 26 个，' +
        '在这里全都不成立。',
        'The whole ciphertext uses only ' + distinct + ' distinct letters. This is not a ' +
        'substitution on a 26-letter alphabet but a fractionating cipher or a code ' +
        '(ADFGVX, a Polybius square, Morse): one plaintext letter has been split into two ' +
        'or more symbols. Every test below assumes 26 letters and none of them applies here.'));
      return { n: n, confident: false, family: 'unknown',
               measurements: measurements, reasons: reasons };
    }

    /* ② 结构判据：Playfair */
    const noJ = absent.indexOf('J') >= 0;
    const usableDoubleTest = dg.expected >= DOUBLES_MIN_EXPECTED;
    if (measurements.evenLength && noJ && usableDoubleTest && dg.doubles === 0) {
      reasons.push(reason('even-length',
        '长度 ' + n + ' 是偶数——密文以二元组为单位产出。',
        'Length ' + n + ' is even — the ciphertext was emitted two letters at a time.'));
      reasons.push(reason('no-j',
        '整段密文里没有 J：25 格方阵把 J 并进了 I，它没有格子可站。',
        'Not one J in the whole ciphertext: a 25-cell square folds J into I, so J has no square to stand on.'));
      reasons.push(reason('no-doubles',
        '重复二元组 0 个，偶然出现的期望是 ' + dg.expected.toFixed(1) +
        '（' + dg.pairs + ' 对 × IoC ' + ic.toFixed(4) + '）。这不是"少见"，是规则上不可能：' +
        '同行、同列、矩形三条规则换出来的两个字母必然不同。',
        'Zero doubled digraphs against ' + dg.expected.toFixed(1) + ' expected by chance (' +
        dg.pairs + ' pairs x IoC ' + ic.toFixed(4) + '). Not "rare" — impossible by rule: ' +
        'row, column and rectangle all map a distinct pair to a distinct pair.'));
      return { n: n, confident: true, family: 'polygraphic-playfair',
               measurements: measurements, reasons: reasons };
    }

    /* ② 统计判据：一张表还是很多张表 */
    if (ic >= IC_SINGLE) {
      reasons.push(reason('ic-single',
        'IoC = ' + ic.toFixed(4) + ' ≥ ' + IC_SINGLE +
        '：随手抽两个字母相同的概率还停在英文那一档，说明整段密文自始至终只用了一张表。',
        'IoC = ' + ic.toFixed(4) + ' >= ' + IC_SINGLE +
        ': two letters drawn at random still match as often as in English, so one alphabet was used throughout.'));
      if (measurements.chi2PerLetter < CHI2_PER_LETTER) {
        reasons.push(reason('chi2-english',
          'χ²/n = ' + measurements.chi2PerLetter.toFixed(3) + ' < ' + CHI2_PER_LETTER.toFixed(1) +
          '：字母表本身还是英文的那张——E 还是最多的那个。字母没被改名，只有位置动了。',
          'chi2/n = ' + measurements.chi2PerLetter.toFixed(3) + ' < ' + CHI2_PER_LETTER.toFixed(1) +
          ': the letter counts are still English — E is still the commonest. Nothing was renamed; only the order moved.'));
        /* 这条旁证是量出来的，也**只**是旁证——它没有参与分支，理由写在文案里。 */
        const ratio = dg.expected > 0 ? dg.doubles / dg.expected : 0;
        reasons.push(reason('transposition-caveat',
          '注意：单字母统计分不开"换位"与"根本没加密"——两者的 IoC 与 χ² 逐位相同。' +
          '一条旁证：重复二元组 ' + dg.doubles + ' 个 / 期望 ' + dg.expected.toFixed(1) +
          ' = ' + ratio.toFixed(2) + '。英文压制相邻重复（本仓 300 次抽样均值 0.41），' +
          '彻底打散的列换位把它抬回偶然水平（1.14）。但栅栏换位只在局部打散，均值 0.83，' +
          '约三分之一会落在明文那一侧——所以这是旁证，不是分支。',
          'Caveat: single-letter statistics cannot separate a transposition from plain English — ' +
          'both have exactly the same IoC and the same chi-square. One side hint: ' +
          dg.doubles + ' doubled digraphs / ' + dg.expected.toFixed(1) + ' expected = ' +
          ratio.toFixed(2) + '. English suppresses adjacent repeats (0.41 mean over 300 draws here); ' +
          'a thorough columnar transposition restores them to the chance level (1.14). ' +
          'A rail fence only scrambles locally (0.83 mean) and lands on the plaintext side about a ' +
          'third of the time — so this is a hint, not a branch.'));
        return { n: n, confident: true, family: 'transposition',
                 measurements: measurements, reasons: reasons };
      }
      reasons.push(reason('chi2-scrambled',
        'χ²/n = ' + measurements.chi2PerLetter.toFixed(3) + ' ≥ ' + CHI2_PER_LETTER.toFixed(1) +
        '：字母被改了名。次数的多重集合没变（所以 IoC 没变），只是贴错了标签。',
        'chi2/n = ' + measurements.chi2PerLetter.toFixed(3) + ' >= ' + CHI2_PER_LETTER.toFixed(1) +
        ': the letters were renamed. The multiset of counts is untouched (hence the IoC), only the labels moved.'));
      return { n: n, confident: true, family: 'monoalphabetic',
               measurements: measurements, reasons: reasons };
    }

    reasons.push(reason('ic-flat',
      'IoC = ' + ic.toFixed(4) + ' < ' + IC_SINGLE +
      '：重合指数被压平了。几张不同的表被平均在了一起。',
      'IoC = ' + ic.toFixed(4) + ' < ' + IC_SINGLE +
      ': the coincidence rate has been flattened. Several different alphabets have been averaged together.'));
    if (usableDoubleTest && dg.doubles > 0) {
      reasons.push(reason('doubles-present',
        '重复二元组 ' + dg.doubles + ' 个（期望 ' + dg.expected.toFixed(1) + '）——' +
        'Playfair 一个都不会有，所以它出局了。',
        dg.doubles + ' doubled digraphs against ' + dg.expected.toFixed(1) +
        ' expected — Playfair would have none at all, so Playfair is out.'));
    } else if (!usableDoubleTest) {
      reasons.push(reason('doubles-untestable',
        '偶然重复对的期望只有 ' + dg.expected.toFixed(1) + '，太小——这段文本上' +
        '"零重复对"根本不构成证据，Playfair 既排除不了也确认不了。',
        'Only ' + dg.expected.toFixed(1) + ' doubled digraphs expected by chance — too few for ' +
        '"zero doubles" to mean anything here, so Playfair can be neither ruled in nor out.'));
    }
    reasons.push(reason('next-fork-period',
      '下一个岔路口是周期：逐周期重合指数若在某个 p 处见顶，就是重复密钥一族' +
      '（维吉尼亚 / 博福特 / 波尔塔 / Quagmire）；若没有峰，才轮到 Hill、转轮机与一次一密。',
      'The next fork is period: if the IoC-by-period curve peaks at some p, it is the repeating-key ' +
      'family (Vigenere / Beaufort / Porta / Quagmire); only if no peak shows do Hill, rotor machines and the one-time pad come up.'));
    return { n: n, confident: true, family: 'polyalphabetic',
             measurements: measurements, reasons: reasons };
  }

  /* ================= 可复现的随机数 =================
     mulberry32。本仓的门对 Math.random 零容忍：一个只在某些运行里变红的测试
     比没有测试更糟。页面每次载入必须画出**同一张**扫描图，测试也必须能钉住
     它的每一个数字，所以随机性只能来自一个显式的种子。 */
  function rng32(seed) {
    let a = seed | 0;
    return function () {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ================= 阈值 0.055 的判错率扫描 =================
     这道实验回答的是"MIN_SAMPLE 为什么是 200"。做法：对每个长度 n 各造
     40 段单表密文与 40 段多表密文，算各自的 IoC，数有多少段被 0.055 判反。

     三处刻意的设计，都是为了让这道实验只测一件事——样本量：

     ① 样本取自同一段英文的**循环切片**（随机起点、可绕回开头）。切片之间
        因此互相重叠，n=500 时尤其严重（源文只有几百个字母）。这不是被忽略的
        缺陷而是必须说出来的限制：n 大的那几行，40 次抽样的独立性比 n 小的那几行
        差，所以它们是**更弱**的证据，不是更强的。

     ② 多表那一侧的密钥**字母互不相同**。一把随手抽的密钥可能是 'XBX'——
        它长度 3 却只用了两张表，IoC 会抬到 0.06 上下，在**任何**长度上都被
        判成单表。那是密钥的毛病，不是样本量的毛病，混进来只会把两件事搅在
        一起。本仓量过这个混杂项：不限制密钥时，n ≥ 200 的 600 次抽样里有 7 段
        多表密文被判成单表，**七段的密钥全部有重复字母**。

     ③ 单表那一侧的 IoC 恒等于明文切片的 IoC（单表代换是字母上的双射，
        f_i 的多重集合不变）。所以这一侧量的其实是"一段 n 个字母的英文，
        它的重合指数有多不稳"——密钥在这里完全不起作用，这本身就是第二条判据。 */
  const SWEEP_LENGTHS = [40, 60, 80, 100, 150, 200, 300, 500];
  const SWEEP_TRIALS = 40;
  const SWEEP_SEED = 20260810;
  const SWEEP_KEY_MIN = 3, SWEEP_KEY_MAX = 9;

  function cyclicSlice(src, start, n) {
    let out = '';
    for (let i = 0; i < n; i++) out += src.charAt((start + i) % src.length);
    return out;
  }

  /* 抽一把字母互不相同的密钥：对字母表做部分 Fisher–Yates，取前 L 个。
     和 substitution.randomKey 一样自后向前洗，好让两处消耗 rng 的方式一致。 */
  function distinctKey(rngFn, len) {
    const pool = C.ALPHABET.split('');
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rngFn() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, len).join('');
  }

  /* 算法模块由调用方注入（opts.substitution / opts.vigenere），本文件不去
     require 也不去读 root.CryptoAlgos：cryptanalysis.js 必须能在只有
     crypto-core 的环境里装载，这是它现在的加载位置所要求的。注入还有一个
     好处——页面与测试跑的是**同一份**实验代码，扫描图上的数字和断言里的
     数字因此不可能各算各的。 */
  function icSweep(opts) {
    const o = opts || {};
    const source = C.normalize(o.source || '');
    const S = o.substitution, V = o.vigenere;
    if (!S || typeof S.encrypt !== 'function' || typeof S.randomKey !== 'function') {
      throw new Error('icSweep 需要注入 substitution 模块（encrypt / randomKey）');
    }
    if (!V || typeof V.encrypt !== 'function') {
      throw new Error('icSweep 需要注入 vigenere 模块（encrypt）');
    }
    const lengths = o.lengths || SWEEP_LENGTHS;
    const trials = o.trials === undefined ? SWEEP_TRIALS : o.trials;
    const threshold = o.threshold === undefined ? IC_SINGLE : o.threshold;
    const seed = o.seed === undefined ? SWEEP_SEED : o.seed;
    /* 源文比最长的样本还短时，循环切片会把同一段文字接上好几遍，重合指数
       因此虚高——那时候画出来的不是"英文的抖动"，是"复读机的抖动"。
       与其静静地画一张假图，不如当场拒绝。 */
    const maxLen = Math.max.apply(null, lengths);
    if (source.length < maxLen) {
      throw new Error('icSweep 的源文只有 ' + source.length + ' 个字母，短于最长样本 ' +
                      maxLen + '——循环切片会重复同一段文字，量出来的不是英文的抖动');
    }
    const rng = rng32(seed);
    const rows = [];
    let totalMono = 0, totalPoly = 0;
    for (let li = 0; li < lengths.length; li++) {
      const n = lengths[li];
      const monoIc = [], polyIc = [];
      let monoErr = 0, polyErr = 0;
      for (let i = 0; i < trials; i++) {
        const p = cyclicSlice(source, Math.floor(rng() * source.length), n);
        const ic = indexOfCoincidence(S.encrypt(p, S.randomKey(rng)));
        monoIc.push(ic);
        if (ic < threshold) monoErr++;
      }
      for (let i = 0; i < trials; i++) {
        const p = cyclicSlice(source, Math.floor(rng() * source.length), n);
        const len = SWEEP_KEY_MIN + Math.floor(rng() * (SWEEP_KEY_MAX - SWEEP_KEY_MIN + 1));
        const ic = indexOfCoincidence(V.encrypt(p, distinctKey(rng, len)));
        polyIc.push(ic);
        if (ic >= threshold) polyErr++;
      }
      totalMono += monoErr; totalPoly += polyErr;
      rows.push({
        n: n, monoIc: monoIc, polyIc: polyIc, monoErr: monoErr, polyErr: polyErr,
        monoMin: Math.min.apply(null, monoIc), monoMax: Math.max.apply(null, monoIc),
        polyMin: Math.min.apply(null, polyIc), polyMax: Math.max.apply(null, polyIc)
      });
    }
    return { seed: seed, threshold: threshold, trials: trials, lengths: lengths,
             keyMin: SWEEP_KEY_MIN, keyMax: SWEEP_KEY_MAX,
             sourceLength: source.length,
             rows: rows, totalMonoErr: totalMono, totalPolyErr: totalPoly };
  }

  return { ENGLISH_FREQ, letterCounts, letterFrequency, chiSquare, bruteForceBest,
           indexOfCoincidence, ngramCounts, repeatedSequences, kasiskiPeriods,
           icByPeriod, columnsForPeriod,
           digraphDoubles, absentLetters, classify,
           MIN_SAMPLE, IC_SINGLE, CHI2_PER_LETTER, DOUBLES_MIN_EXPECTED,
           ALPHABET_MIN_DISTINCT,
           rng32, icSweep, cyclicSlice, distinctKey,
           SWEEP_LENGTHS, SWEEP_TRIALS, SWEEP_SEED };
});
