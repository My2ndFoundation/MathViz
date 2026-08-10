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

  return { ENGLISH_FREQ, letterCounts, letterFrequency, chiSquare, bruteForceBest,
           indexOfCoincidence, ngramCounts, repeatedSequences, kasiskiPeriods,
           icByPeriod, columnsForPeriod };
});
