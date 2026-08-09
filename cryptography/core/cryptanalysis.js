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

  return { ENGLISH_FREQ, letterCounts, letterFrequency, chiSquare, bruteForceBest };
});
