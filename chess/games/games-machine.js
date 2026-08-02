/* 棋谱分组：人机对抗。★ 编辑源之一。
   一组一个文件，因为 30 局的双语文案要在并行的 worktree 上写——写进同一个
   文件必然在合并时冲突，而冲突的是大段散文，最难 review。每一局仍然只有
   一处编辑源。数据契约见 docs/superpowers/plans/2026-08-02-chess-phase2-game-replay.md。
   零依赖；node 与浏览器双用。运行时被内联进 tools/chess-game-replay.html。 */
(function (root, factory) {
  const list = factory();
  if (typeof module === 'object' && module.exports) module.exports = list;
  else {
    root.ChessGamesParts = root.ChessGamesParts || {};
    root.ChessGamesParts.machine = list;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    // Task 8 在此填 5 局：deep-blue-kasparov-1996-g1 / deep-blue-kasparov-1997-g2 /
    // deep-blue-kasparov-1997-g6 / alphazero-stockfish-2017-g10 / hydra-adams-2005
  ];
});
