/* 棋谱分组：浪漫时代。★ 编辑源之一。
   一组一个文件，因为 30 局的双语文案要在并行的 worktree 上写——写进同一个
   文件必然在合并时冲突，而冲突的是大段散文，最难 review。每一局仍然只有
   一处编辑源。数据契约见 docs/superpowers/plans/2026-08-02-chess-phase2-game-replay.md。
   零依赖；node 与浏览器双用。运行时被内联进 tools/chess-game-replay.html。 */
(function (root, factory) {
  const list = factory();
  if (typeof module === 'object' && module.exports) module.exports = list;
  else {
    root.ChessGamesParts = root.ChessGamesParts || {};
    root.ChessGamesParts.romantic = list;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    // Task 9 在此填 6 局：anderssen-kieseritzky-1851 / anderssen-dufresne-1852 /
    // morphy-opera-1858 / rotlewi-rubinstein-1907 / legal-saint-brie-1750 /
    // levitsky-marshall-1912
  ];
});
