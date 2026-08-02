/* 棋谱分组：冷战与世界冠军战。★ 编辑源之一。
   一组一个文件，因为 30 局的双语文案要在并行的 worktree 上写——写进同一个
   文件必然在合并时冲突，而冲突的是大段散文，最难 review。每一局仍然只有
   一处编辑源。数据契约见 docs/superpowers/plans/2026-08-02-chess-phase2-game-replay.md。
   零依赖；node 与浏览器双用。运行时被内联进 tools/chess-game-replay.html。 */
(function (root, factory) {
  const list = factory();
  if (typeof module === 'object' && module.exports) module.exports = list;
  else {
    root.ChessGamesParts = root.ChessGamesParts || {};
    root.ChessGamesParts.coldwar = list;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    {
      id: 'byrne-fischer-1956',
      group: 'coldwar',
      tags: ['sacrifice', 'attack', 'prodigy'],
      difficulty: 2,
      source: 'https://en.wikipedia.org/wiki/The_Game_of_the_Century_(chess)',
      story: {
        en: 'Bobby Fischer was thirteen years old, an unrated junior invited to the Rosenwald Memorial in New York mostly as a courtesy, when he sat down across from Donald Byrne — an International Master, older brother of future grandmaster Robert Byrne, and one of the strongest players in the country. Nobody expected the game to be remembered.\n\nOn move 11 Byrne moved the same knight twice, losing a tempo that looks trivial on the scoresheet. Fischer answered with 11...Na4, a move the annotator Hans Kmoch later called one of the most powerful in chess history, and from there the position tightened around White\'s king. On move 17, with his own queen attacked by a bishop, Fischer played 17...Be6 instead of retreating it — he let Byrne capture his queen the very next move, calculating that the knight forks and discovered checks that followed were worth more than the piece he was giving up.\n\nKmoch dubbed it "The Game of the Century" and it won the tournament\'s brilliancy prize. It remains the standard reference for what a queen sacrifice actually is: not a desperate throw, but a trade of the most powerful piece on the board for a forced sequence that wins back more material than the queen was worth.',
        zh: '鲍比·费舍尔当年十三岁，还是个没有正式等级分的少年棋手，被主要出于礼节性地邀请参加纽约罗森瓦尔德纪念赛，对面坐着的唐纳德·伯恩是一位国际大师，也是日后特级大师罗伯特·伯恩的兄长，全美最强的棋手之一。当时没有人指望这局棋会被记住。\n\n第 11 回合，伯恩把同一只马又动了一次，看棋谱只是丢了一步先手，算不上大事。费舍尔用 11...Na4 回应——评注者汉斯·克莫赫后来称这是国际象棋史上最有力的几步棋之一——白方王翼从此被一点点收紧。第 17 回合，费舍尔的后正被一只象攻击，他没有把后撤走，而是走了 17...Be6，主动放伯恩在下一步吃掉自己的后：他算准了随后的马叉与闪击将赢回比后更多的子力。\n\n克莫赫称之为「世纪之局」，这局棋拿下了那届比赛的最佳对局奖。它至今仍是理解「弃后 queen sacrifice」真正含义的标准范本：不是孤注一掷，而是用棋盘上最重的子换一串强制的连续着法，换回比后本身更多的东西。',
      },
      why: {
        en: 'A 13-year-old sacrifices his queen on move 17 against an International Master, and the forced sequence wins back more than she was worth.',
        zh: '13 岁的少年在第 17 回合弃后，面对的是一位国际大师——随后的强制序列赢回的比后本身更多。',
      },
      keyMoves: [
        { ply: 22, san: 'Na4', note: {
          en: '11...Na4 punishes Byrne\'s lost tempo. Kmoch called it one of the most powerful moves ever played; it starts pulling White\'s pieces out of position.',
          zh: '11...Na4 惩罚了伯恩刚刚丢掉的那步先手。克莫赫称它是史上最有力的几步棋之一，白方的子力从这一步开始被一点点带偏位置。' } },
        { ply: 34, san: 'Be6', note: {
          en: '17...Be6 — the queen sacrifice. Fischer\'s queen is under attack and he does not move her. He is trading her for what comes next.',
          zh: '17...Be6——弃后的那一步。费舍尔的后正被攻击，他没有挪开她，而是用她去换接下来发生的一切。' } },
        { ply: 36, san: 'Bxc4+', note: {
          en: '18...Bxc4+, one move after the queen is gone: a discovered check that opens the knight-fork sequence which pays the sacrifice back with interest.',
          zh: '18...Bxc4+，就在后被吃掉的下一步：一记闪击将军，打开了随后一连串马叉的序幕——弃后的代价开始连本带利地收回来。' } },
        { ply: 50, san: 'Nxd1', note: {
          en: '25...Nxd1 — the knight, which has been forking its way across the board since the queen fell, now grabs a rook. By this point Black already has more material than the queen he gave up.',
          zh: '25...Nxd1——那只马自后被吃后就在棋盘上一路叉子吃，这里终于吃到一只车。到这一步，黑方手里的子力已经超过了当初弃掉的那个后。' } },
        { ply: 82, san: 'Rc2#', note: {
          en: '41...Rc2# — checkmate. The king that has been chased since move 17 finally has nowhere left to go.',
          zh: '41...Rc2#——将死。从第 17 回合起就被追着跑的白王，终于无路可走。' } },
      ],
      pgn: [
        '[Event "New York Rosenwald"]',
        '[Site "New York, NY USA"]',
        '[Date "1956.10.17"]',
        '[Round "8"]',
        '[White "Byrne, Donald"]',
        '[Black "Fischer, Robert James"]',
        '[Result "0-1"]',
        '',
        '1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O 5.Bf4 d5 6.Qb3 dxc4 7.Qxc4 c6 8.e4 Nbd7',
        '9.Rd1 Nb6 10.Qc5 Bg4 11.Bg5 Na4 12.Qa3 Nxc3 13.bxc3 Nxe4 14.Bxe7 Qb6 15.Bc4 Nxc3',
        '16.Bc5 Rfe8+ 17.Kf1 Be6 18.Bxb6 Bxc4+ 19.Kg1 Ne2+ 20.Kf1 Nxd4+ 21.Kg1 Ne2+',
        '22.Kf1 Nc3+ 23.Kg1 axb6 24.Qb4 Ra4 25.Qxb6 Nxd1 26.h3 Rxa2 27.Kh2 Nxf2 28.Re1 Rxe1',
        '29.Qd8+ Bf8 30.Nxe1 Bd5 31.Nf3 Ne4 32.Qb8 b5 33.h4 h5 34.Ne5 Kg7 35.Kg1 Bc5+',
        '36.Kf1 Ng3+ 37.Ke1 Bb4+ 38.Kd1 Bb3+ 39.Kc1 Ne2+ 40.Kb1 Nc3+ 41.Kc1 Rc2# 0-1',
      ].join('\n'),
    },
    {
      id: 'spassky-fischer-1972-g1',
      group: 'coldwar',
      tags: ['world-championship', 'blunder'],
      difficulty: 2,
      source: 'https://en.wikipedia.org/wiki/World_Chess_Championship_1972',
      story: {
        en: 'Reykjavik, July 1972. The World Championship match between the Soviet defending champion Boris Spassky and the American challenger Bobby Fischer was already the most politically loaded chess event of the Cold War before a piece had moved: an American had never held the title, and Fischer had spent the run-up threatening not to show up at all over prize money and playing conditions.\n\nGame 1 itself was heading nowhere dramatic. The queens came off the board on move 11, and by move 29 the position was a bishop-and-pawn endgame that most strong players would simply draw. Then Fischer played 29...Bxh2, grabbing a pawn that Spassky\'s next move, 30.g3, immediately fenced in — the bishop had no way home. Fischer had gone hunting for a pawn in a position that did not need one, and it cost him the whole point.\n\nFischer lost the game, then forfeited Game 2 by not appearing at all, and briefly seemed ready to quit the match altogether over the arguments that followed. He came back and won it 12½–8½. But Game 1 is the one where the match\'s reputation for psychological brinkmanship started — not with a walkout, but with an ordinary-looking pawn that turned out to be exactly the trap its nickname promised.',
        zh: '1972 年 7 月，雷克雅未克。苏联卫冕冠军斯帕斯基与美国挑战者费舍尔的这场世界冠军赛，在棋子落地之前就已经是冷战期间政治色彩最浓的一场棋赛：此前从未有美国人拿过这个头衔，而费舍尔在赛前一直在为奖金与比赛条件威胁干脆不来。\n\n第 1 局本身开局并不激烈。第 11 回合双方就把后换掉了，到第 29 回合，局面已经简化成一个多数强手都会直接握手言和的象兵残局。然后费舍尔走了 29...Bxh2，吃掉一个本不必去吃的兵，斯帕斯基紧接着 30.g3 立刻把这只象圈死在了原地——它已经无路回家。费舍尔在一个根本不需要额外吃兵的局面里去猎兵，代价是丢掉了整整一分。\n\n费舍尔输掉了这一局，紧接着又因为没有到场而被判负第 2 局，围绕比赛条件的争执一度让他看起来真的要退赛。他后来还是回来了，并以 12½–8½ 拿下整场比赛。但这场比赛「心理博弈」的名声，正是从第 1 局开始的——不是从退赛开始，而是从一个看起来毫无问题、后来却名副其实地印证了「毒兵」这个绰号的兵开始。',
      },
      why: {
        en: 'Fischer grabs a pawn in a position that should just be drawn, and the trapped bishop costs him the whole game.',
        zh: '费舍尔在一个本该和棋的局面里去吃一个兵，结果这只象被困死，赔上了整整一局。',
      },
      keyMoves: [
        { ply: 21, san: 'dxc5', note: {
          en: '11.dxc5 leads straight into a queen trade — by move 12 this looks like the kind of position both players could shake hands on.',
          zh: '11.dxc5 直接引向换后——到第 12 回合，这看起来正是双方随时可以握手言和的那种局面。' } },
        { ply: 58, san: 'Bxh2', note: {
          en: '29...Bxh2 — the "poisoned pawn." Nothing forces Fischer to take it; the position was heading for a draw without it.',
          zh: '29...Bxh2——「毒兵」。没有任何东西逼着费舍尔去吃这个兵；不吃它，这盘棋原本正走向和棋。' } },
        { ply: 59, san: 'g3', note: {
          en: '30.g3 shuts the door. The bishop on h2 has no square to retreat through — it is simply lost.',
          zh: '30.g3 把门关死。h2 上的象没有任何格子能退回去——它就这样被丢掉了。' } },
        { ply: 111, san: 'Kd6', note: {
          en: '56.Kd6, the final move: White\'s king walks in and the black king cannot stop it and defend the last pawn at the same time. Fischer resigned here.',
          zh: '56.Kd6，末尾一步：白王直接走了进来，黑王没法一边挡它一边守住最后那个兵。费舍尔在此认输。' } },
      ],
      pgn: [
        '[Event "World Championship 28th"]',
        '[Site "Reykjavik ISL"]',
        '[Date "1972.07.11"]',
        '[Round "1"]',
        '[White "Spassky, Boris V"]',
        '[Black "Fischer, Robert James"]',
        '[Result "1-0"]',
        '',
        '1.d4 Nf6 2.c4 e6 3.Nf3 d5 4.Nc3 Bb4 5.e3 O-O 6.Bd3 c5 7.O-O Nc6 8.a3 Ba5',
        '9.Ne2 dxc4 10.Bxc4 Bb6 11.dxc5 Qxd1 12.Rxd1 Bxc5 13.b4 Be7 14.Bb2 Bd7 15.Rac1 Rfd8',
        '16.Ned4 Nxd4 17.Nxd4 Ba4 18.Bb3 Bxb3 19.Nxb3 Rxd1+ 20.Rxd1 Rc8 21.Kf1 Kf8',
        '22.Ke2 Ne4 23.Rc1 Rxc1 24.Bxc1 f6 25.Na5 Nd6 26.Kd3 Bd8 27.Nc4 Bc7 28.Nxd6 Bxd6',
        '29.b5 Bxh2 30.g3 h5 31.Ke2 h4 32.Kf3 Ke7 33.Kg2 hxg3 34.fxg3 Bxg3 35.Kxg3 Kd6',
        '36.a4 Kd5 37.Ba3 Ke4 38.Bc5 a6 39.b6 f5 40.Kh4 f4 41.exf4 Kxf4 42.Kh5 Kf5',
        '43.Be3 Ke4 44.Bf2 Kf5 45.Bh4 e5 46.Bg5 e4 47.Be3 Kf6 48.Kg4 Ke5 49.Kg5 Kd5',
        '50.Kf5 a5 51.Bf2 g5 52.Kxg5 Kc4 53.Kf5 Kb4 54.Kxe4 Kxa4 55.Kd5 Kb5 56.Kd6 1-0',
      ].join('\n'),
    },
    {
      id: 'fischer-spassky-1972-g6',
      group: 'coldwar',
      tags: ['world-championship', 'positional'],
      difficulty: 3,
      source: 'https://en.wikipedia.org/wiki/World_Chess_Championship_1972',
      story: {
        en: 'By Game 6, Fischer had already lost Game 1 and forfeited Game 2, and was down in the match. He then did something almost nobody expected: instead of his usual 1.e4, he opened 1.c4 — the first time in a serious tournament game he had ever taken the white side of the Queen\'s Gambit family. Spassky, a lifelong 1.e4 player himself, had prepared for the Fischer everyone knew and got a completely different opponent.\n\nThe game itself is remembered less for any single blow than for its accumulating pressure. Fischer built up a small positional edge move by move, and it never let go; by move 38 he was sacrificing an exchange (38.Rxf6) to tear open the position around Spassky\'s king, and two moves later offered the rook again with 39.Rxf6 rather than cash in material for safety. Spassky resigned facing an unstoppable mating attack.\n\nWhat happened after the final move is what the game is remembered for beyond the moves themselves: Spassky rose from the board and joined the audience in applauding Fischer\'s win. Fischer later called him "a true sportsman." It is the single most-told moment of humanity in a match otherwise defined by walkouts, lawsuits over the playing conditions, and Cold War tension on both benches.',
        zh: '打到第 6 局时，费舍尔已经输掉第 1 局、又因缺席被判负第 2 局，整场比赛落后。他这时做了一件几乎没人料到的事：没有像往常一样开 1.e4，而是走了 1.c4——这是他第一次在正式比赛里执白进入后翼弃兵一系的开局。斯帕斯基自己也是终身的 1.e4 棋手，他为大家熟悉的那个费舍尔做了准备，遇到的却是一个完全不同的对手。\n\n这局棋被记住，靠的不是哪一步孤立的妙手，而是从头到尾不断累积的压力。费舍尔一步一步攒起一个不大的位置优势，而且始终没有放松；到第 38 回合他弃还了一个交换（38.Rxf6）去撕开斯帕斯基王翼周围的防线，两回合之后又用 39.Rxf6 再度送出车，而不是见好就收换回安全。斯帕斯基面对无法阻挡的杀棋认了输。\n\n真正让这局棋被反复讲述的，是最后一步之后发生的事：斯帕斯基从棋盘前站起身，和观众一起为费舍尔的胜利鼓掌。费舍尔后来称他是「一位真正的体育精神代表」。在一场充斥着退赛、关于比赛条件的争执与双方席位上冷战张力的比赛里，这是被讲述最多的一个人性瞬间。',
      },
      why: {
        en: 'Fischer opens 1.c4 for the first time in a serious game, grinds Spassky down, and Spassky stands to applaud the win.',
        zh: '费舍尔第一次在正式比赛里开 1.c4，一步步磨垮斯帕斯基，后者起立为这盘棋鼓掌。',
      },
      keyMoves: [
        { ply: 1, san: 'c4', note: {
          en: '1.c4 — Fischer, an almost exclusive 1.e4 player, opens with the English/Queen\'s Gambit family for the first time in a serious game. Spassky\'s preparation is aimed at the wrong opponent.',
          zh: '1.c4——几乎只下 1.e4 的费舍尔，第一次在正式比赛里选择了英国式/后翼弃兵一系的开局。斯帕斯基的赛前准备，瞄准的是另一个费舍尔。' } },
        { ply: 75, san: 'Rxf6', note: {
          en: '38.Rxf6 — Fischer gives up the exchange to rip open the pawns in front of Spassky\'s king. The point is not material, it is the attack that follows.',
          zh: '38.Rxf6——费舍尔弃还交换，撕开斯帕斯基王前的兵形。重点不是子力得失，是随之而来的攻势。' } },
        { ply: 76, san: 'gxf6', note: {
          en: '38...gxf6 is forced — declining leaves the position even worse. Spassky\'s king is now permanently exposed.',
          zh: '38...gxf6 是被迫的——不吃局面只会更糟。斯帕斯基的王从此再也遮不住了。' } },
        { ply: 77, san: 'Rxf6', note: {
          en: '39.Rxf6 — Fischer offers the rook again rather than bank the material he already has. This is the move that turns a good position into a winning attack.',
          zh: '39.Rxf6——费舍尔没有见好就收，而是把车再度送出去。正是这一步，把一个不错的局面变成了必胜的攻势。' } },
        { ply: 81, san: 'Qf4', note: {
          en: '41.Qf4, the final move: mate cannot be stopped. Spassky resigned, then stood to applaud.',
          zh: '41.Qf4，最后一步：杀棋已经无法阻挡。斯帕斯基认输，随即起立鼓掌。' } },
      ],
      pgn: [
        '[Event "World Championship 28th"]',
        '[Site "Reykjavik ISL"]',
        '[Date "1972.07.23"]',
        '[Round "6"]',
        '[White "Fischer, Robert James"]',
        '[Black "Spassky, Boris V"]',
        '[Result "1-0"]',
        '',
        '1.c4 e6 2.Nf3 d5 3.d4 Nf6 4.Nc3 Be7 5.Bg5 O-O 6.e3 h6 7.Bh4 b6 8.cxd5 Nxd5',
        '9.Bxe7 Qxe7 10.Nxd5 exd5 11.Rc1 Be6 12.Qa4 c5 13.Qa3 Rc8 14.Bb5 a6 15.dxc5 bxc5',
        '16.O-O Ra7 17.Be2 Nd7 18.Nd4 Qf8 19.Nxe6 fxe6 20.e4 d4 21.f4 Qe7 22.e5 Rb8',
        '23.Bc4 Kh8 24.Qh3 Nf8 25.b3 a5 26.f5 exf5 27.Rxf5 Nh7 28.Rcf1 Qd8 29.Qg3 Re7',
        '30.h4 Rbb7 31.e6 Rbc7 32.Qe5 Qe8 33.a4 Qd8 34.R1f2 Qe8 35.R2f3 Qd8 36.Bd3 Qe8',
        '37.Qe4 Nf6 38.Rxf6 gxf6 39.Rxf6 Kg8 40.Bc4 Kh8 41.Qf4 1-0',
      ].join('\n'),
    },
    {
      id: 'tal-botvinnik-1960-g6',
      group: 'coldwar',
      tags: ['world-championship', 'sacrifice', 'attack'],
      difficulty: 3,
      source: 'https://en.wikipedia.org/wiki/World_Chess_Championship_1960',
      story: {
        en: 'Mikhail Tal was twenty-three, nicknamed "the Magician from Riga," and playing for the World Championship against Mikhail Botvinnik, the reigning champion and the most rigorously scientific player of his generation. Their styles could not have been more opposed: Botvinnik prepared with the discipline of the engineer he had trained as; Tal calculated forests of complications and then, when the calculation ran out, played on instinct.\n\nGame 6 is the game most often used to show what that meant over the board. On move 21 Tal played 21...Nf4!!, offering a knight for no calculable, forced win — contemporary annotators and Tal himself were explicit that he could not see all the way to the end of the resulting complications. He judged that the attack it opened against Botvinnik\'s king was worth more than the piece, without being able to prove it the way a modern engine could check in an instant. It worked: Botvinnik never found a safe path through the resulting storm and resigned by move 47.\n\nContemporary reports say the audience became so loud and excited during the game that it had to be moved to a quieter room. Tal went on to win the match and become the youngest world champion to that point, at twenty-three. The game endures specifically as a counterexample to the idea that every sound sacrifice can be calculated in advance — sometimes the strongest players commit to a piece on judgment alone.',
        zh: '米哈伊尔·塔尔当年二十三岁，绰号「里加的魔术师」，正与卫冕冠军、他那一代最讲究科学方法的棋手米哈伊尔·博特维尼克争夺世界冠军。两人的风格几乎是两极：博特维尼克带着他工程师训练出身的那种纪律去准备每一局；塔尔则会算出一整片错综复杂的变化，一旦算不到底，就凭直觉继续走下去。\n\n第 6 局最常被用来说明这意味着什么。第 21 回合，塔尔走了 21...Nf4!!，送出一只马，却算不出一条能被证明必胜的强制路线——同时代的评注者和塔尔本人都明确说过，他并没有把随后的乱战算到底。他判断由此打开的对博特维尼克王翼的攻势值得这个子，却没法像今天的引擎那样瞬间验证这个判断。结果奏效了：博特维尼克始终没能在随后的风暴里找到一条安全的路，第 47 回合前就认了输。\n\n据当时的报道，观众席一度喧闹到不得不把比赛挪到更安静的房间继续。塔尔后来赢下整场比赛，以二十三岁成为当时最年轻的世界冠军。这局棋之所以流传至今，恰恰是因为它是一个反例：不是每一次可靠的弃子都能提前算清楚——有时最强的棋手靠的只是判断，不是穷举。',
      },
      why: {
        en: 'Tal sacrifices a knight he could not calculate to the end, trusting judgment over proof — and it wins.',
        zh: '塔尔弃出一只马，却没能把后续算到底——他信的是判断，不是穷举，而这一次赌对了。',
      },
      keyMoves: [
        { ply: 42, san: 'Nf4', note: {
          en: '21...Nf4!! — the knight sacrifice. Tal himself said afterwards he could not see the whole line; he judged the attack was worth it.',
          zh: '21...Nf4!!——弃马的那一步。塔尔本人事后说他并没有把整条变化算到底；他判断这份攻势值得这个子。' } },
        { ply: 43, san: 'gxf4', note: {
          en: '22.gxf4 accepts the sacrifice. Declining it was also difficult — Botvinnik chose to take the material and defend.',
          zh: '22.gxf4 接受了弃子。不接同样很难应付——博特维尼克选择先拿到子力，再想办法防守。' } },
        { ply: 46, san: 'Qxb2', note: {
          en: '23...Qxb2 — Tal keeps piling on rather than stopping to consolidate. The attack, not the missing knight, is now the story of the game.',
          zh: '23...Qxb2——塔尔没有停下来巩固局面，而是继续加码。此刻这局棋的主线是攻势，不是那只丢掉的马。' } },
        { ply: 92, san: 'Kd4', note: {
          en: '46...Kd4, the final move. Botvinnik resigned here, unable to stop Tal\'s connected passed pawns and advancing king.',
          zh: '46...Kd4，最后一步。博特维尼克在此认输，他挡不住塔尔的联合通路兵和不断推进的王。' } },
      ],
      pgn: [
        '[Event "World Championship 23th"]',
        '[Site "Moscow URS"]',
        '[Date "1960.03.26"]',
        '[Round "6"]',
        '[White "Botvinnik, Mikhail"]',
        '[Black "Tal, Mihail"]',
        '[Result "0-1"]',
        '',
        '1.c4 Nf6 2.Nf3 g6 3.g3 Bg7 4.Bg2 O-O 5.d4 d6 6.Nc3 Nbd7 7.O-O e5 8.e4 c6',
        '9.h3 Qb6 10.d5 cxd5 11.cxd5 Nc5 12.Ne1 Bd7 13.Nd3 Nxd3 14.Qxd3 Rfc8 15.Rb1 Nh5',
        '16.Be3 Qb4 17.Qe2 Rc4 18.Rfc1 Rac8 19.Kh2 f5 20.exf5 Bxf5 21.Ra1 Nf4 22.gxf4 exf4',
        '23.Bd2 Qxb2 24.Rab1 f3 25.Rxb2 fxe2 26.Rb3 Rd4 27.Be1 Be5+ 28.Kg1 Bf4 29.Nxe2 Rxc1',
        '30.Nxd4 Rxe1+ 31.Bf1 Be4 32.Ne2 Be5 33.f4 Bf6 34.Rxb7 Bxd5 35.Rc7 Bxa2 36.Rxa7 Bc4',
        '37.Ra8+ Kf7 38.Ra7+ Ke6 39.Ra3 d5 40.Kf2 Bh4+ 41.Kg2 Kd6 42.Ng3 Bxg3 43.Bxc4 dxc4',
        '44.Kxg3 Kd5 45.Ra7 c3 46.Rc7 Kd4 0-1',
      ].join('\n'),
    },
    {
      id: 'karpov-kasparov-1985-g16',
      group: 'coldwar',
      tags: ['world-championship', 'sacrifice', 'positional'],
      difficulty: 3,
      source: 'https://en.wikipedia.org/wiki/World_Chess_Championship_1985',
      story: {
        en: 'This is the second Karpov–Kasparov match of the mid-1980s, a best-of-24 rematch that began fresh at 0–0 after their first encounter had been controversially stopped without a result (see the game from that earlier match in this collection). Kasparov, twenty-two, was the challenger; Karpov, the reigning champion since 1975, had never lost a world championship match.\n\nGame 16 is remembered for a single piece: on move 16 Kasparov played 16...Nd3, planting his knight deep in White\'s position on a square it could not be dislodged from by a pawn. Commentators call this kind of outpost an "octopus" — a piece so entangled with the opponent\'s position that removing it costs more than leaving it alone. The knight sat on d3 for eighteen moves, cramping Karpov\'s pieces the entire time, until move 34 when Karpov finally had to capture it with his queen, 34.Qxd3 — trading his most powerful piece just to be rid of one knight. Kasparov\'s attack didn\'t stop there; by move 40 Karpov was facing an unstoppable mate and resigned.\n\nThe win brought the score to 8½–7½ in Kasparov\'s favor — his first lead in the match. He went on to win the match 13–11 on 9 November 1985, becoming, at twenty-two, the youngest world champion in history.',
        zh: '这是 1980 年代中期卡尔波夫与卡斯帕罗夫的第二次交锋，一场从 0–0 重新开始的 24 局制对局——他们的第一次交锋在无结果的情况下被中止（本套棋谱里收有那场比赛的一局）。二十二岁的卡斯帕罗夫是挑战者；自 1975 年起卫冕的卡尔波夫，此前从未在世界冠军赛里输过。\n\n第 16 局因为一个子被记住：第 16 回合，卡斯帕罗夫走了 16...Nd3，把马深深楔进白方阵地里的一个格子——那里没有兵能把它赶走。评论者把这种扎根很深的子称为「章鱼骑士 octopus knight」：它和对方阵型纠缠得太深，赶走它的代价比放着它不管还大。这只马在 d3 上一坐就是十八个回合，整段时间里始终束缚着卡尔波夫的棋子，直到第 34 回合，卡尔波夫终于不得不用后去吃它——34.Qxd3，用自己最重的子去换掉一只马。卡斯帕罗夫的攻势并未就此停下；到第 40 回合，卡尔波夫已经面对无法阻挡的杀棋，只能认输。\n\n这一胜把比分改写成 8½–7½，卡斯帕罗夫领先——这是他在整场比赛里第一次占先。他最终在 1985 年 11 月 9 日以 13–11 拿下整场比赛，二十二岁成为历史上最年轻的世界冠军。',
      },
      why: {
        en: 'A knight lands on d3 in move 16 and stays there until Karpov has to give up his queen to remove it.',
        zh: '一只马在第 16 回合落在 d3，一直坐到卡尔波夫不得不搭上后才能把它请走。',
      },
      keyMoves: [
        { ply: 32, san: 'Nd3', note: {
          en: '16...Nd3 — the "octopus knight" lands. It cannot be captured by a pawn and will sit here strangling White\'s position for the next eighteen moves.',
          zh: '16...Nd3——「章鱼骑士」落地。它没法被兵吃掉，接下来十八个回合里会一直卡在这里束缚白方的局面。' } },
        { ply: 67, san: 'Qxd3', note: {
          en: '34.Qxd3 — Karpov finally removes the knight, but only by trading in his queen. This is the moment the octopus\'s cost gets paid in full.',
          zh: '34.Qxd3——卡尔波夫终于赶走了这只马，代价却是搭上自己的后。这一步，才是「章鱼」真正的账单。' } },
        { ply: 74, san: 'Rc1', note: {
          en: '37...Rc1 — with the queens off, Kasparov\'s rook infiltrates White\'s back rank while Karpov is still untangling his pieces.',
          zh: '37...Rc1——后已经不在棋盘上，卡斯帕罗夫的车趁卡尔波夫还在解开自己的子力时，直接杀进了白方底线。' } },
        { ply: 80, san: 'Re1+', note: {
          en: '40...Re1+, the final move. White cannot stop the mating attack and resigns.',
          zh: '40...Re1+，最后一步。白方挡不住杀棋，认输。' } },
      ],
      pgn: [
        '[Event "World Championship 32th-KK2"]',
        '[Site "Moscow URS"]',
        '[Date "1985.10.15"]',
        '[Round "16"]',
        '[White "Karpov, Anatoly"]',
        '[Black "Kasparov, Garry"]',
        '[Result "0-1"]',
        '',
        '1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nb5 d6 6.c4 Nf6 7.N1c3 a6 8.Na3 d5',
        '9.cxd5 exd5 10.exd5 Nb4 11.Be2 Bc5 12.O-O O-O 13.Bf3 Bf5 14.Bg5 Re8 15.Qd2 b5',
        '16.Rad1 Nd3 17.Nab1 h6 18.Bh4 b4 19.Na4 Bd6 20.Bg3 Rc8 21.b3 g5 22.Bxd6 Qxd6',
        '23.g3 Nd7 24.Bg2 Qf6 25.a3 a5 26.axb4 axb4 27.Qa2 Bg6 28.d6 g4 29.Qd2 Kg7',
        '30.f3 Qxd6 31.fxg4 Qd4+ 32.Kh1 Nf6 33.Rf4 Ne4 34.Qxd3 Nf2+ 35.Rxf2 Bxd3 36.Rfd2 Qe3',
        '37.Rxd3 Rc1 38.Nb2 Qf2 39.Nd2 Rxd1+ 40.Nxd1 Re1+ 0-1',
      ].join('\n'),
    },
    {
      id: 'karpov-kasparov-1985-g48',
      group: 'coldwar',
      tags: ['world-championship', 'controversy', 'endgame'],
      difficulty: 2,
      source: 'https://en.wikipedia.org/wiki/World_Chess_Championship_1984%E2%80%931985',
      story: {
        en: 'This game belongs to the earlier, first Karpov–Kasparov match — a different contest from the one in this collection\'s Game 16, played the previous year and never finished. It began on 10 September 1984 with no game limit, the title going to whoever first won six games. Karpov, the champion, raced to a 4–0 lead after nine games. Then came a stretch of seventeen consecutive draws before Karpov broke it in Game 27 to lead 5–0 — a score from which, historically, no challenger had ever come back.\n\nKasparov did not fold. He won Game 32, and after more draws, closed with back-to-back wins in Games 47 and 48 — this game, a Petroff Defense in which Kasparov, with White, ground down Karpov\'s position into a long rook-and-knight endgame and converted it move by move. The score stood at 5–3.\n\nOn 15 February 1985, five months and 48 games in, FIDE president Florencio Campomanes terminated the match without a result, citing the health of both players. Both Karpov and Kasparov said in public that they wanted to continue; there has been speculation, never proven, of political pressure behind the decision. Kasparov later said his own estimate of his winning chances at that point was around 25–30 percent — a useful corrective to any telling of this game as the moment he was already about to win. A fresh match, best-of-24 starting at 0–0, began that September; Kasparov won it and became champion at twenty-two.',
        zh: '这局棋属于卡尔波夫与卡斯帕罗夫更早的第一次交锋——与本套棋谱里第 16 局所在的那场比赛不是同一场，发生在前一年，而且从未打出结果。它从 1984 年 9 月 10 日开始，不设局数上限，谁先赢满六局谁夺冠。卫冕冠军卡尔波夫在头九局里就打出 4–0 的领先。随后是长达十七局的连续和棋，直到第 27 局才被卡尔波夫打破，把比分拉到 5–0——历史上从没有挑战者从这样的比分下翻过盘。\n\n卡斯帕罗夫没有认输。他先赢下第 32 局，又是一连串和棋之后，在第 47、48 两局连胜收尾——这局棋正是第 48 局，一盘俄罗斯防御（彼得罗夫防御），执白的卡斯帕罗夫把局面磨成一个漫长的车马残局，一步一步地把它兑现成胜局。比分变成了 5–3。\n\n1985 年 2 月 15 日，比赛打了五个月、48 局之后，国际棋联主席坎波马内斯以双方健康为由，宣布这场比赛无结果中止。卡尔波夫与卡斯帕罗夫都在公开场合表示希望继续比赛；坊间一直有关于这一决定背后存在政治施压的猜测，但从未被证实。卡斯帕罗夫本人后来说，他当时对自己胜算的估计大约是 25% 到 30%——这提醒我们，不该把这局棋讲成「他已经稳操胜券」的时刻。当年 9 月，一场从 0–0 重新开始、24 局制的新赛事随即展开；卡斯帕罗夫赢下了它，二十二岁登顶世界冠军。',
      },
      why: {
        en: 'Kasparov wins his second straight game to reach 5-3, and a week later the match is stopped without a result.',
        zh: '卡斯帕罗夫连胜两局把比分追到 5–3，一周后这场比赛就被无结果中止。',
      },
      keyMoves: [
        { ply: 63, san: 'Rxg7+', note: {
          en: '32.Rxg7+ trades off a pair of rooks and steers the game towards the kind of simplified rook ending where a small, accumulated edge tends to decide.',
          zh: '32.Rxg7+ 兑掉一对车，把棋局引向那种一旦简化、微小的累积优势就足以决定胜负的车类残局。' } },
        { ply: 69, san: 'Rxe6', note: {
          en: '35.Rxe6 wins back material and leaves Kasparov with a pure, extra-pawn rook endgame to convert — the technical grind that decides the rest of the game.',
          zh: '35.Rxe6 赢回了子力，留给卡斯帕罗夫一个纯粹、多兵的车残局去兑现——决定这局棋后半段走向的，就是这样的技术性磨棋。' } },
        { ply: 127, san: 'Rg7', note: {
          en: '64.Rg7! cuts off Karpov\'s king at the critical moment, right before the final sequence of checks runs out.',
          zh: '64.Rg7! 在关键时刻把卡尔波夫的王隔断在外，紧接着他手里的将军就要用完了。' } },
        { ply: 133, san: 'Kc3', note: {
          en: '67.Kc3, the final move: Karpov is out of checks and cannot stop the position from being lost. He resigned here.',
          zh: '67.Kc3，最后一步：卡尔波夫的将军已经用完，也没法再阻止局面告负。他在此认输。' } },
      ],
      pgn: [
        '[Event "World Championship 31th-KK1"]',
        '[Site "Moscow URS"]',
        '[Date "1985.02.08"]',
        '[Round "48"]',
        '[White "Kasparov, Garry"]',
        '[Black "Karpov, Anatoly"]',
        '[Result "1-0"]',
        '',
        '1.e4 e5 2.Nf3 Nf6 3.Nxe5 d6 4.Nf3 Nxe4 5.d4 d5 6.Bd3 Nc6 7.O-O Be7 8.c4 Nf6',
        '9.Nc3 O-O 10.h3 dxc4 11.Bxc4 Na5 12.Bd3 Be6 13.Re1 Nc6 14.a3 a6 15.Bf4 Qd7',
        '16.Ne5 Nxe5 17.dxe5 Nd5 18.Nxd5 Bxd5 19.Qc2 g6 20.Rad1 c6 21.Bh6 Rfd8 22.e6 fxe6',
        '23.Bxg6 Bf8 24.Bxf8 Rxf8 25.Be4 Rf7 26.Re3 Rg7 27.Rdd3 Rf8 28.Rg3 Kh8 29.Qc3 Rf7',
        '30.Rde3 Kg8 31.Qe5 Qc7 32.Rxg7+ Rxg7 33.Bxd5 Qxe5 34.Bxe6+ Qxe6 35.Rxe6 Rd7',
        '36.b4 Kf7 37.Re3 Rd1+ 38.Kh2 Rc1 39.g4 b5 40.f4 c5 41.bxc5 Rxc5 42.Rd3 Ke7',
        '43.Kg3 a5 44.Kf3 b4 45.axb4 axb4 46.Ke4 Rb5 47.Rb3 Rb8 48.Kd5 Kf6 49.Kc5 Re8',
        '50.Rxb4 Re3 51.h4 Rh3 52.h5 Rh4 53.f5 Rh1 54.Kd5 Rd1+ 55.Rd4 Re1 56.Kd6 Re8',
        '57.Kd7 Rg8 58.h6 Kf7 59.Rc4 Kf6 60.Re4 Kf7 61.Kd6 Kf6 62.Re6+ Kf7 63.Re7+ Kf6',
        '64.Rg7 Rd8+ 65.Kc5 Rd5+ 66.Kc4 Rd4+ 67.Kc3 1-0',
      ].join('\n'),
    },
    {
      id: 'carlsen-nepomniachtchi-2021-g6',
      group: 'coldwar',
      tags: ['world-championship', 'longest', 'endgame'],
      difficulty: 2,
      source: 'https://en.wikipedia.org/wiki/Carlsen_versus_Nepomniachtchi,_World_Chess_Championship_2021,_Game_6',
      story: {
        en: 'This game is not a Cold War story — it was played in Dubai in December 2021, between the Norwegian champion Magnus Carlsen and the Russian challenger Ian Nepomniachtchi — but it belongs in this group anyway, as the modern extreme of what a single world championship game can demand from both players. The first five games of the match had all been drawn.\n\nBy move 20 the position had simplified into a queen-and-rook ending that looked drawn to most strong players watching, and by move 40 it still looked drawn. It did not resolve. Both sides maneuvered, offered checks, avoided repetition, and pushed pawns for game after game of moves, the position slowly tightening without either side finding a clean way to force a result. On move 129 Carlsen finally pushed his last passed pawn home with 129.e5, and from there Nepomniachtchi\'s defence gave way; White\'s king and knight combined for an unstoppable mating net, and Black resigned after 136.Ng7.\n\nThe game lasted seven hours and forty-five minutes and 136 moves, finishing after midnight local time — the longest game in the history of the World Chess Championship. It gave Carlsen a 3½–2½ lead in the match, and by most accounts the sheer weight of the defeat weighed on Nepomniachtchi for the remaining games, which Carlsen went on to win convincingly.',
        zh: '这局棋和冷战没有关系——它是 2021 年 12 月在迪拜下的，对局双方是挪威棋手卡尔森与俄罗斯挑战者涅波姆尼亚奇，但它仍然被收进这一组，作为一局世界冠军赛的棋能把双方逼到什么极限的当代样本。这场比赛的头五局全部战和。\n\n到第 20 回合，局面已经简化成一个后车残局，在场的多数强手看来这局棋已经和定了；到第 40 回合它看起来仍然是和棋。但它没有就此收场。双方一直在腾挪、送将军、避免重复局面、推兵，一步接一步地走下去，局面在没有任何一方能找到干净的取胜路线的情况下慢慢收紧。第 129 回合，卡尔森终于把最后一个通路兵推到底——129.e5，涅波姆尼亚奇的防守从这里开始松动；白方的王与马联手织出一张无法逃脱的杀网，黑方在 136.Ng7 之后认输。\n\n这局棋一共下了七小时四十五分钟、136 个回合，结束时当地时间已过午夜——是世界冠军赛历史上最长的一局。它让卡尔森在比赛中取得 3½–2½ 的领先；据多方说法，这次失利的分量此后一直压在涅波姆尼亚奇身上，接下来的几局卡尔森都赢得颇为轻松。',
      },
      why: {
        en: 'Both queens and rooks stay on for 136 moves and nearly eight hours before Carlsen finally forces resignation — the longest game in World Championship history.',
        zh: '双方的后与车在棋盘上僵持了 136 个回合、近八小时，卡尔森才终于逼出认输——世界冠军赛史上最长的一局。',
      },
      keyMoves: [
        { ply: 40, san: 'Bxg2', note: {
          en: '20...Bxg2 trades off the bishops and steers the game into the long queen-and-rook ending that most watching grandmasters expected to be drawn.',
          zh: '20...Bxg2 兑掉了象，把棋局引向那个漫长的后车残局——当时在场的多数特级大师都以为这会是和棋。' } },
        { ply: 79, san: 'Nxe4', note: {
          en: '40.Nxe4 restores rough material balance. The position still looks holdable for Black — and stays that way for nearly a hundred more moves.',
          zh: '40.Nxe4 大致恢复了子力平衡。这个局面看起来黑方仍然守得住——而且接下来近百个回合里始终如此。' } },
        { ply: 257, san: 'e5', note: {
          en: '129.e5, after over 250 half-moves of maneuvering: Carlsen finally pushes his last passed pawn home, and Black\'s defence starts to give way for the first time in the whole game.',
          zh: '129.e5，在两百五十多个半步的腾挪之后：卡尔森终于把最后一个通路兵推到底，黑方的防线在整局棋里第一次开始松动。' } },
        { ply: 271, san: 'Ng7', note: {
          en: '136.Ng7, the final move — the longest game in World Championship history ends with an unstoppable mating net.',
          zh: '136.Ng7，最后一步——这局世界冠军赛史上最长的棋，以一张无法逃脱的杀网收尾。' } },
      ],
      pgn: [
        '[Event "World Championship 2021"]',
        '[Site "Dubai UAE"]',
        '[Date "2021.12.03"]',
        '[Round "6"]',
        '[White "Carlsen, Magnus"]',
        '[Black "Nepomniachtchi, Ian"]',
        '[Result "1-0"]',
        '',
        '1.d4 Nf6 2.Nf3 d5 3.g3 e6 4.Bg2 Be7 5.O-O O-O 6.b3 c5 7.dxc5 Bxc5 8.c4 dxc4',
        '9.Qc2 Qe7 10.Nbd2 Nc6 11.Nxc4 b5 12.Nce5 Nb4 13.Qb2 Bb7 14.a3 Nc6 15.Nd3 Bb6',
        '16.Bg5 Rfd8 17.Bxf6 gxf6 18.Rac1 Nd4 19.Nxd4 Bxd4 20.Qa2 Bxg2 21.Kxg2 Qb7+',
        '22.Kg1 Qe4 23.Qc2 a5 24.Rfd1 Kg7 25.Rd2 Rac8 26.Qxc8 Rxc8 27.Rxc8 Qd5 28.b4 a4',
        '29.e3 Be5 30.h4 h5 31.Kh2 Bb2 32.Rc5 Qd6 33.Rd1 Bxa3 34.Rxb5 Qd7 35.Rc5 e5',
        '36.Rc2 Qd5 37.Rdd2 Qb3 38.Ra2 e4 39.Nc5 Qxb4 40.Nxe4 Qb3 41.Rac2 Bf8 42.Nc5 Qb5',
        '43.Nd3 a3 44.Nf4 Qa5 45.Ra2 Bb4 46.Rd3 Kh6 47.Rd1 Qa4 48.Rda1 Bd6 49.Kg1 Qb3',
        '50.Ne2 Qd3 51.Nd4 Kh7 52.Kh2 Qe4 53.Rxa3 Qxh4+ 54.Kg1 Qe4 55.Ra4 Be5 56.Ne2 Qc2',
        '57.R1a2 Qb3 58.Kg2 Qd5+ 59.f3 Qd1 60.f4 Bc7 61.Kf2 Bb6 62.Ra1 Qb3 63.Re4 Kg7',
        '64.Re8 f5 65.Raa8 Qb4 66.Rac8 Ba5 67.Rc1 Bb6 68.Re5 Qb3 69.Re8 Qd5 70.Rcc8 Qh1',
        '71.Rc1 Qd5 72.Rb1 Ba7 73.Re7 Bc5 74.Re5 Qd3 75.Rb7 Qc2 76.Rb5 Ba7 77.Ra5 Bb6',
        '78.Rab5 Ba7 79.Rxf5 Qd3 80.Rxf7+ Kxf7 81.Rb7+ Kg6 82.Rxa7 Qd5 83.Ra6+ Kh7',
        '84.Ra1 Kg6 85.Nd4 Qb7 86.Ra2 Qh1 87.Ra6+ Kf7 88.Nf3 Qb1 89.Rd6 Kg7 90.Rd5 Qa2+',
        '91.Rd2 Qb1 92.Re2 Qb6 93.Rc2 Qb1 94.Nd4 Qh1 95.Rc7+ Kf6 96.Rc6+ Kf7 97.Nf3 Qb1',
        '98.Ng5+ Kg7 99.Ne6+ Kf7 100.Nd4 Qh1 101.Rc7+ Kf6 102.Nf3 Qb1 103.Rd7 Qb2+',
        '104.Rd2 Qb1 105.Ng1 Qb4 106.Rd1 Qb3 107.Rd6+ Kg7 108.Rd4 Qb2+ 109.Ne2 Qb1',
        '110.e4 Qh1 111.Rd7+ Kg8 112.Rd4 Qh2+ 113.Ke3 h4 114.gxh4 Qh3+ 115.Kd2 Qxh4',
        '116.Rd3 Kf8 117.Rf3 Qd8+ 118.Ke3 Qa5 119.Kf2 Qa7+ 120.Re3 Qd7 121.Ng3 Qd2+',
        '122.Kf3 Qd1+ 123.Re2 Qb3+ 124.Kg2 Qb7 125.Rd2 Qb3 126.Rd5 Ke7 127.Re5+ Kf7',
        '128.Rf5+ Ke8 129.e5 Qa2+ 130.Kh3 Qe6 131.Kh4 Qh6+ 132.Nh5 Qh7 133.e6 Qg6',
        '134.Rf7 Kd8 135.f5 Qg1 136.Ng7 1-0',
      ].join('\n'),
    },
  ];
});
