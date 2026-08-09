(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({ classical: require('./examples-classical.js') });
  } else {
    root.CryptoExamples = factory(root.CryptoExamplesParts || {});
  }
})(typeof self !== 'undefined' ? self : this, function (parts) {
  'use strict';

  /* 汇总器。浏览器里读的是 root.CryptoExamplesParts——那份对象由每个分组
     文件自己挂上去，所以**分组文件必须先于本文件加载**。
     inline_core.py 的 EXAMPLES_PARTS 显式写死了这个顺序，不靠文件名排序
     碰巧成立（chess 的 games.js 在同一处踩过这个点）。 */
  function get(name) {
    const d = parts[name];
    if (!d) throw new Error('CryptoExamples: 分组 "' + name + '" 未加载——检查内联顺序');
    return d;
  }

  /* 按 id 取一条明文，取不到当场抛：一个拼错的 id 应该立刻炸，
     而不是让工具页拿着 undefined 往下走、最后画出一片空白。 */
  function plaintext(id) {
    const list = get('classical').plaintexts;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    throw new Error('CryptoExamples: 找不到明文 id "' + id + '"');
  }

  return { classical: get('classical'), plaintext };
});
