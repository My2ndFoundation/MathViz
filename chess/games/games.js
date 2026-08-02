/* 棋谱汇总器：把六个分组文件合成一份总表，并声明学习路线与词表。
   ★ 编辑源。分组数据本身在 games-*.js 里，本文件只做汇总，加新局不必改它。
   零依赖；node 与浏览器双用。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({
      teaching: require('./games-teaching.js'),
      machine: require('./games-machine.js'),
      romantic: require('./games-romantic.js'),
      coldwar: require('./games-coldwar.js'),
      theory: require('./games-theory.js'),
      human: require('./games-human.js'),
    });
  } else {
    /* 浏览器里六个分组文件已经在本文件之前被内联执行过，各自往
       root.ChessGamesParts 上挂了自己那份数组（内联顺序由 inline_core.py
       的 GAMES_PARTS 显式写死，不靠文件名排序碰巧成立）。 */
    root.ChessGames = factory(root.ChessGamesParts || {});
  }
})(typeof self !== 'undefined' ? self : this, function (parts) {
  'use strict';

  const GROUP_ORDER = ['teaching', 'machine', 'romantic', 'coldwar', 'theory', 'human'];

  const GROUP_LABEL = {
    teaching: { en: 'Constructed for teaching', zh: '教学构造局' },
    machine:  { en: 'Human versus machine', zh: '人机对抗' },
    romantic: { en: 'The Romantic era', zh: '浪漫时代' },
    coldwar:  { en: 'Cold War and world championships', zh: '冷战与世界冠军战' },
    theory:   { en: 'Turning points in theory', zh: '理论转折' },
    human:    { en: 'Controversy and human nature', zh: '争议与人性' },
  };

  /* tags 的封闭词表。开放式自由标签会在 30 局 × 两位作者之间长出
     'human-vs-machine' 与 'human-machine' 两个同义词，筛选就此失效。 */
  const TAGS = [
    'human-vs-machine', 'controversy', 'romantic', 'teaching', 'constructed',
    'sacrifice', 'attack', 'endgame', 'opening-theory', 'blunder', 'trap',
    'world-championship', 'prodigy', 'defence', 'positional', 'longest',
  ];

  /* 本阶段的完整清单（计划 §Task 7–12 的分组表），按 GROUP_ORDER 分组排列。
     这是「有没有拼错 id / 悄悄溜进第 31 局」的判据来源，不是「填了几局」的
     判据——填没填齐是里程碑，见 games.test.js 里对 EXPECTED_IDS 的用法。 */
  const EXPECTED_IDS = [
    // teaching（2）
    'fools-mate', 'scholars-mate',
    // machine（5）
    'deep-blue-kasparov-1996-g1', 'deep-blue-kasparov-1997-g2',
    'deep-blue-kasparov-1997-g6', 'alphazero-stockfish-2017-g10', 'hydra-adams-2005',
    // romantic（6）
    'anderssen-kieseritzky-1851', 'anderssen-dufresne-1852', 'morphy-opera-1858',
    'rotlewi-rubinstein-1907', 'legal-saint-brie-1750', 'levitsky-marshall-1912',
    // coldwar（7）
    'byrne-fischer-1956', 'spassky-fischer-1972-g1', 'fischer-spassky-1972-g6',
    'tal-botvinnik-1960-g6', 'karpov-kasparov-1985-g16', 'karpov-kasparov-1985-g48',
    'carlsen-nepomniachtchi-2021-g6',
    // theory（5）
    'reti-capablanca-1924', 'botvinnik-capablanca-1938', 'steinitz-bardeleben-1895',
    'kasparov-topalov-1999', 'capablanca-marshall-1918',
    // human（5）
    'kasparov-polgar-2002', 'deep-fritz-kramnik-2006-g2', 'carlsen-niemann-2022',
    'kasparov-world-1999', 'menchik-euwe-1930',
  ];

  /* 给零基础的顺序（规格 §6.3）。UI 默认按它排列，而不是平铺 30 局。 */
  const LEARNING_ROUTE = [
    'fools-mate',
    'scholars-mate',
    'legal-saint-brie-1750',
    'morphy-opera-1858',
    'anderssen-kieseritzky-1851',
    'byrne-fischer-1956',
    'reti-capablanca-1924',
    'fischer-spassky-1972-g6',
    'kasparov-topalov-1999',
    'deep-blue-kasparov-1997-g2',
    'alphazero-stockfish-2017-g10',
  ];

  const GROUPS = {};
  const GAMES = [];
  for (let i = 0; i < GROUP_ORDER.length; i++) {
    const k = GROUP_ORDER[i];
    GROUPS[k] = (parts[k] || []).slice();
    for (let j = 0; j < GROUPS[k].length; j++) GAMES.push(GROUPS[k][j]);
  }

  const byId = {};
  for (let i = 0; i < GAMES.length; i++) byId[GAMES[i].id] = GAMES[i];

  /* 标签对：只正则扫，不重放走法。列表页要给 30 局各画一张卡，为了显示
     两个名字去把三十局棋全走一遍是没必要的（真要走法时用 Replay.load）。
     结果缓存在记录上——同一局的卡片会被重绘很多次。 */
  const TAG_RE = /\[\s*(\w+)\s*"((?:[^"\\]|\\.)*)"\s*\]/g;
  function headersOf(game) {
    if (game.__headers) return game.__headers;
    const h = {};
    let m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(game.pgn))) h[m[1]] = m[2].replace(/\\(.)/g, '$1');
    game.__headers = h;
    return h;
  }

  return { GAMES: GAMES, byId: byId, GROUPS: GROUPS, GROUP_ORDER: GROUP_ORDER,
           GROUP_LABEL: GROUP_LABEL, LEARNING_ROUTE: LEARNING_ROUTE, TAGS: TAGS,
           EXPECTED_IDS: EXPECTED_IDS, headersOf: headersOf };
});
