/* 棋谱分组：教学构造局。★ 编辑源之一。
   这两局明确标注为构造局面而非史料（规格 §6.2 末节）：它们没有对局者、
   没有赛事，是为了说明「将死」这个定义本身而摆出来的最短序列。
   零依赖；node 与浏览器双用。 */
(function (root, factory) {
  const list = factory();
  if (typeof module === 'object' && module.exports) module.exports = list;
  else {
    root.ChessGamesParts = root.ChessGamesParts || {};
    root.ChessGamesParts.teaching = list;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    {
      id: 'fools-mate',
      group: 'teaching',
      tags: ['teaching', 'constructed'],
      difficulty: 1,
      source: 'https://en.wikipedia.org/wiki/Fool%27s_mate',
      story: {
        en: 'This is not a game anyone played. It is the shortest possible checkmate, four half-moves long, and it exists in this collection for one reason: it is the smallest object that shows what checkmate actually is.\n\nWhite opens two pawns in front of the king — f3 and g4 — and by the second of them the diagonal h4–e1 is a clear road. The black queen walks down it and the game is over. Nothing was captured. No piece was even threatened until the last move.\n\nThat is the point. Checkmate is not a special kind of capture, and the king is never taken off the board. It is a purely logical condition: the king is attacked, and every legal move still leaves it attacked. Here White has one attacked king and zero legal moves, and the game ends mid-development with almost every piece still at home.',
        zh: '这不是任何人下过的一局棋。它是可能存在的最短将死，只有四个半步，收进这套工具里只为一个理由：它是能说明「将死到底是什么」的最小对象。\n\n白方在自己王的门前推开两个兵——f3 与 g4——第二个兵一动，h4–e1 这条斜线就成了一条通途。黑后沿着它走下来，棋局就结束了。全程没有任何子被吃，直到最后一步之前也没有任何子被威胁。\n\n这正是重点。将死不是某种特殊的吃子，王自始至终没有被拿下棋盘。它是一个纯逻辑的条件：王正被攻击，而所有合法走法都无法让它脱离攻击。这里白方有一个被攻击的王和零个合法走法，棋局在几乎全部棋子还没出动的时候就结束了。',
      },
      why: {
        en: 'The shortest checkmate there is, which makes it the cleanest definition of checkmate you will ever see.',
        zh: '现存最短的将死，因此也是你能见到的对「将死」最干净的定义。',
      },
      keyMoves: [
        { ply: 1, san: 'f3', note: {
          en: '1.f3 opens the h4–e1 diagonal towards White\'s own king. On its own it is merely careless.',
          zh: '1.f3 打开了通向白方自家王的 h4–e1 斜线。单看这一步只是随手。' } },
        { ply: 3, san: 'g4', note: {
          en: '2.g4 is the fatal one: it blocks the only square (g4) from which a piece could later interpose on that diagonal, and it does so voluntarily.',
          zh: '2.g4 才是致命的一步：它自己堵死了 g4——那是日后唯一还能垫在这条斜线上的格子——而且是主动堵死的。' } },
        { ply: 4, san: 'Qh4#', note: {
          en: 'Qh4#. Count White\'s legal moves: zero. Count the attackers on the king: one, and nothing can capture it, block it, or run. That triple is the whole definition.',
          zh: 'Qh4#。数一数白方的合法走法：零。数一数攻击王的子：一个，而白方吃不掉它、挡不住它、也躲不开。这三件事同时成立，就是将死的全部定义。' } },
      ],
      /* 构造局面同样走 PGN 原文这条路 —— 让「一局棋 = 一份 PGN」在数据里
         没有例外，工具就不必为教学局另开一条分支。 */
      pgn: [
        '[Event "Constructed position"]',
        '[Site "—"]',
        '[Date "????.??.??"]',
        '[Round "-"]',
        '[White "White"]',
        '[Black "Black"]',
        '[Result "0-1"]',
        '',
        '1. f3 e5 2. g4 Qh4# 0-1',
      ].join('\n'),
    },
    {
      id: 'scholars-mate',
      group: 'teaching',
      tags: ['teaching', 'constructed', 'trap'],
      difficulty: 1,
      source: 'https://en.wikipedia.org/wiki/Scholar%27s_mate',
      story: {
        en: 'The four-move mate is the first complete game most beginners see, and the first trap most beginners lose to. White aims two pieces — the bishop on c4 and the queen on h5 — at a single square, f7, and Black does not notice that the square is defended only by the king.\n\nf7 (and f2 for White) is the weakest square in the starting position, and the reason is structural rather than tactical: it is the only square in each camp that no piece defends. Every other pawn has a knight, a rook or a queen behind it. That one hole is enough for two attackers to be one more than the defence.\n\nIt is worth learning from both sides. As the attacker it works exactly once against any given opponent. As the defender the answer is unglamorous and permanent: develop a piece that covers f7, and the whole idea evaporates.',
        zh: '四步杀是多数初学者看到的第一局完整的棋，也是多数初学者第一次栽的跟头。白方把两个子——c4 的象与 h5 的后——同时对准一个格子 f7，而黑方没有注意到那一格只有王在守。\n\nf7（对白方来说是 f2）是初始局面里最弱的一格，原因是结构性的而非战术性的：它是各自阵营里唯一没有任何棋子保护的格。其余每个兵背后都站着马、车或后。就这一个洞，足以让两个攻击者比防守方多出一个。\n\n这局棋值得从两边各学一遍。当攻方，它对同一个对手只灵一次；当守方，答案朴素但一劳永逸：出一个能罩住 f7 的子，整个构想立刻蒸发。',
      },
      why: {
        en: 'Two attackers against one defender on f7 — the structural weak point every starting position has.',
        zh: '两个攻击者对一个防守者，落在 f7——每个初始局面都自带的那处结构弱点。',
      },
      keyMoves: [
        { ply: 3, san: 'Bc4', note: {
          en: '2.Bc4 puts the first attacker on f7. Nothing is threatened yet: f7 is defended once, by the king.',
          zh: '2.Bc4 把第一个攻击者对准 f7。此刻还没有威胁：f7 有一个防守者，就是黑王。' } },
        { ply: 5, san: 'Qh5', note: {
          en: '3.Qh5 makes it two attackers against one defender. Black must add a defender or remove an attacker — …g6 does both jobs at once.',
          zh: '3.Qh5 让攻击者变成两个、防守者仍是一个。黑方必须加一个防守者或赶走一个攻击者——…g6 一步同时做到两件事。' } },
        { ply: 6, san: 'Nf6', note: {
          en: '3…Nf6?? develops a piece and ignores the count. It is the most natural-looking losing move in chess.',
          zh: '3…Nf6?? 出了一个子，却没去数攻防的人数。这是国际象棋里看上去最自然的一步败着。' } },
        { ply: 7, san: 'Qxf7#', note: {
          en: 'Qxf7#. The queen is protected by the bishop on c4, so the king cannot take it — and no other piece can reach f7.',
          zh: 'Qxf7#。这个后有 c4 的象保护，所以黑王吃不掉它——而黑方再没有别的子够得到 f7。' } },
      ],
      pgn: [
        '[Event "Constructed position"]',
        '[Site "—"]',
        '[Date "????.??.??"]',
        '[Round "-"]',
        '[White "White"]',
        '[Black "Black"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0',
      ].join('\n'),
    },
  ];
});
