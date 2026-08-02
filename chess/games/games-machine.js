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
    {
      id: 'deep-blue-kasparov-1996-g1',
      group: 'machine',
      tags: ['human-vs-machine', 'attack'],
      difficulty: 3,
      source: 'https://en.wikipedia.org/wiki/Deep_Blue_versus_Kasparov,_1996,_Game_1',
      story: {
        en: 'On 10 February 1996 in Philadelphia, the reigning world champion sat down to play the first game of a six-game match against a machine for the first time in a serious, classical-time-control event. The machine was IBM’s Deep Blue. Kasparov, playing Black, met 1.e4 with the Sicilian, and Deep Blue answered with the quiet Alapin (2.c3) rather than the sharpest theoretical lines — a way to keep the position inside its own calculation rather than inside a human’s opening preparation.\n\nThe middlegame turned into a long positional grind that Deep Blue slowly won: it traded off Kasparov’s active pieces, picked up a pawn, and by move 33 (17.Bg5, aiming at the f6-knight) had set up a structural weakening of Black’s kingside. The finish was a rook sortie down the h-file, 37.Rxh7+, that left Kasparov’s king with nowhere safe to go. He resigned there, still in check — not because the king had actually been mated on the board, but because the attack could not be stopped.\n\nThat evening the news was global: a computer had beaten a reigning world champion under normal tournament conditions for the first time. It was not, however, the end of the story. Kasparov spent the night studying Deep Blue’s games, adjusted his play, and won three of the next five games and drew two, closing out the match 4–2 in his favour. The headline the world remembered was the loss; the actual result of the match was a human win.',
        zh: '1996年2月10日，在费城，在位世界冠军第一次在正规比赛时限下与一台机器对弈六局中的第一局。这台机器是IBM的深蓝。执黑的卡斯帕罗夫以西西里防御应对1.e4，深蓝没有选最锋利的主流变着，而是走了偏平稳的阿拉平变例（2.c3）——这样一来局面更多取决于自己的计算，而不是人类事先准备好的开局功课。\n\n中局变成了一场深蓝逐渐占优的长期缠斗：它把卡斯帕罗夫活跃的棋子一件件兑掉，多得一个兵，到第33个半步（17.Bg5，瞄准f6的马）时已经开始瓦解黑方王翼的兵形结构。终局是车沿h线杀入的37.Rxh7+，黑王无处可逃。卡斯帕罗夫在这里认输，此刻他仍处于被将军的状态——不是棋盘上真的被将死了，而是这次进攻已经挡不住了。\n\n当晚这条新闻传遍全球：计算机第一次在正规比赛条件下击败了在位世界冠军。但故事并未就此结束。卡斯帕罗夫连夜研究深蓝的对局，调整了下法，在剩下五局里赢了三局、和了两局，最终以4–2拿下整场比赛。世人记住的标题是那一局失利，而整场比赛真正的结果，是人类赢了。',
      },
      why: {
        en: 'The first computer win over a reigning world champion at normal time controls — though Kasparov still won the match 4–2.',
        zh: '计算机首次在正规时限下击败在位世界冠军——尽管卡斯帕罗夫最终仍以4–2赢下整场比赛。',
      },
      keyMoves: [
        { ply: 3, san: 'c3', note: {
          en: '2.c3 (the Alapin) is a quiet choice against the Sicilian. Deep Blue steers away from the sharpest book lines, keeping the game inside its own calculation.',
          zh: '2.c3（阿拉平变例）是西西里防御里偏平稳的一路。深蓝没有选最锋利的书本变着，把局面留在自己计算能覆盖的范围内。' } },
        { ply: 33, san: 'Bg5', note: {
          en: '17.Bg5 attacks the f6-knight and prepares to trade it off; the follow-up 18.Bxf6 gxf6 permanently weakens Black’s kingside pawns.',
          zh: '17.Bg5 瞄准f6的马，准备把它兑掉；紧接着的18.Bxf6 gxf6 会永久性削弱黑方王翼的兵形。' } },
        { ply: 45, san: 'd5', note: {
          en: '23.d5 gives up a pawn to open the centre and the d-file for White’s rooks — material for activity, a trade Deep Blue judged correctly.',
          zh: '23.d5 弃兵打开中心与d线，把线路让给白方的车——用一个兵换活动空间，深蓝算准了这笔账。' } },
        { ply: 73, san: 'Rxh7+', note: {
          en: '37.Rxh7+ is the last move played. Kasparov resigned in check, not checkmate: no legal move saved him from an attack that only got worse from there.',
          zh: '37.Rxh7+ 是这局棋走出的最后一手。卡斯帕罗夫在被将军而非被将死的局面下认输：他没有任何一步棋能让这场进攻停下来。' } },
      ],
      pgn: [
        '[Event "Kasparov vs Deep Blue Match"]',
        '[Site "Philadelphia, PA USA"]',
        '[Date "1996.02.10"]',
        '[Round "1"]',
        '[White "Deep Blue"]',
        '[Black "Kasparov, Garry"]',
        '[Result "1-0"]',
        '',
        '1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3 Bg4 6. Be2 e6 7. h3 Bh5 8. O-O Nc6 9. Be3 cxd4 10. cxd4 Bb4 11. a3 Ba5 12. Nc3 Qd6 13. Nb5 Qe7 14. Ne5 Bxe2 15. Qxe2 O-O 16. Rac1 Rac8 17. Bg5 Bb6 18. Bxf6 gxf6 19. Nc4 Rfd8 20. Nxb6 axb6 21. Rfd1 f5 22. Qe3 Qf6 23. d5 Rxd5 24. Rxd5 exd5 25. b3 Kh8 26. Qxb6 Rg8 27. Qc5 d4 28. Nd6 f4 29. Nxb7 Ne5 30. Qd5 f3 31. g3 Nd3 32. Rc7 Re8 33. Nd6 Re1+ 34. Kh2 Nxf2 35. Nxf7+ Kg7 36. Ng5+ Kh6 37. Rxh7+ 1-0',
      ].join('\n'),
    },
    {
      id: 'deep-blue-kasparov-1997-g2',
      group: 'machine',
      tags: ['human-vs-machine', 'controversy'],
      difficulty: 3,
      source: 'https://en.wikipedia.org/wiki/Deep_Blue_versus_Garry_Kasparov',
      story: {
        en: 'Game 2 of the 1997 rematch, played on 4 May 1997 in New York, is the game the whole match is remembered for — and not mainly for the chess. Deep Blue, playing White, out-manoeuvred Kasparov in a Ruy Lopez, slowly improving its position move after move without ever grabbing at loose material.\n\nAt move 36 and 37 (36.axb5 axb5 37.Be4!), Deep Blue chose a quiet, consolidating continuation instead of the more obviously tactical option most computers of that era were expected to find. Kasparov said afterwards that these were the moves that convinced him a human grandmaster had to be helping the machine — the play felt too patient, too understanding of long-term compensation. He asked IBM to let him see Deep Blue’s internal logs; IBM did not hand them over during the match. Kasparov, visibly rattled, resigned on move 45 (45.Ra6).\n\nWhat happened next made the story stranger still. In the days after the match, chess programs and analysts around the world went over the final position and found that Kasparov had resigned a position that could actually be held with a draw by perpetual check — a defence that both he and Deep Blue had missed at the board. IBM declined Kasparov’s request for a rematch and retired Deep Blue soon after, so the question of what really happened at move 37 was never independently settled.',
        zh: '1997年重赛的第2局，1997年5月4日下于纽约，是整场比赛里被记住最多的一局——而且主要不是因为棋本身。执白的深蓝在西班牙开局里把卡斯帕罗夫一步步压制住，局面一点点改善，却始终没有贪吃任何松动的子力。\n\n第36、37步（36.axb5 axb5 37.Be4!），深蓝选择了一步平稳的巩固型走法，而不是那个年代人们以为计算机会去抓的、更明显的战术选项。卡斯帕罗夫赛后表示，正是这几步让他确信一定有人类特级大师在幕后协助——那种走法太有耐心，太懂得长期的补偿是什么。他要求IBM给他看深蓝的内部日志；IBM在比赛期间没有交出来。明显被扰乱了心态的卡斯帕罗夫，在第45步（45.Ra6）认输。\n\n接下来的事让这个故事更加离奇。比赛结束后的几天里，全世界的棋类程序与分析者复盘了这个终局局面，发现卡斯帕罗夫认输的那个局面其实能靠一次将军的循环把和棋守住——这是他和深蓝在棋盘前都没能看到的一条防线。IBM拒绝了卡斯帕罗夫要求重赛的请求，不久后退役了深蓝，所以第37步到底发生了什么，始终没有得到独立的证实。',
      },
      why: {
        en: 'The game where Kasparov accused IBM of cheating — and, it turned out later, resigned a position that was actually drawn.',
        zh: '卡斯帕罗夫指控IBM作弊的那一局——后来才发现，他认输的局面其实能守和。',
      },
      keyMoves: [
        { ply: 71, san: 'axb5', note: {
          en: '36.axb5 opens the a-file. On its own this looks routine — the surprise is what follows.',
          zh: '36.axb5 打开a线。单看这一步很平常——令人意外的是接下来那一手。' } },
        { ply: 73, san: 'Be4', note: {
          en: '37.Be4 is the move Kasparov called “too human”: quiet, prophylactic, giving up an immediate tactical grab in favour of long-term pressure.',
          zh: '37.Be4 就是卡斯帕罗夫说「太像人」的那一步：平稳、预防性，放弃立刻可拿的战术便宜，换取长期的压制。' } },
        { ply: 89, san: 'Ra6', note: {
          en: '45.Ra6 is the last move played. Kasparov resigned here; analysis published after the match found this exact position was drawn with correct defence.',
          zh: '45.Ra6 是这局棋走出的最后一手。卡斯帕罗夫在这里认输；赛后公开的分析发现，这个局面只要防守得当其实是和棋。' } },
      ],
      pgn: [
        '[Event "Kasparov vs Deep Blue Rematch"]',
        '[Site "New York, NY USA"]',
        '[Date "1997.05.04"]',
        '[Round "2"]',
        '[White "Deep Blue"]',
        '[Black "Kasparov, Garry"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 h6 10. d4 Re8 11. Nbd2 Bf8 12. Nf1 Bd7 13. Ng3 Na5 14. Bc2 c5 15. b3 Nc6 16. d5 Ne7 17. Be3 Ng6 18. Qd2 Nh7 19. a4 Nh4 20. Nxh4 Qxh4 21. Qe2 Qd8 22. b4 Qc7 23. Rec1 c4 24. Ra3 Rec8 25. Rca1 Qd8 26. f4 Nf6 27. fxe5 dxe5 28. Qf1 Ne8 29. Qf2 Nd6 30. Bb6 Qe8 31. R3a2 Be7 32. Bc5 Bf8 33. Nf5 Bxf5 34. exf5 f6 35. Bxd6 Bxd6 36. axb5 axb5 37. Be4 Rxa2 38. Qxa2 Qd7 39. Qa7 Rc7 40. Qb6 Rb7 41. Ra8+ Kf7 42. Qa6 Qc7 43. Qc6 Qb6+ 44. Kf1 Rb8 45. Ra6 1-0',
      ].join('\n'),
    },
    {
      id: 'deep-blue-kasparov-1997-g6',
      group: 'machine',
      tags: ['human-vs-machine', 'sacrifice'],
      difficulty: 2,
      source: 'https://en.wikipedia.org/wiki/Deep_Blue_versus_Kasparov,_1997,_Game_6',
      story: {
        en: 'Game 6, played on 11 May 1997 in New York, was the last game of the rematch, with the score tied 2.5–2.5 — whoever won this game won the match. Kasparov, playing Black, chose the solid Caro-Kann instead of one of his usual sharp openings: a defensive decision made under real pressure.\n\nOn move 8, Deep Blue played 8.Nxe6!?, a knight sacrifice (弃马 knight sacrifice) straight out of its opening preparation, ripping open the position around Black’s king before it could reach safety by castling. Kasparov’s reply, 8...Qe7, let Deep Blue keep the full value of the sacrifice; by move 10 the bishop check 10.Bg6+ forced his king out into the open, and from there the position fell apart quickly.\n\nKasparov resigned after 19.c4, having played only nineteen moves in under an hour — the shortest, most one-sided loss of his career against a machine. Deep Blue won the match 3.5–2.5. Afterwards Kasparov publicly accused the IBM team of cheating and demanded a rematch; IBM declined and retired Deep Blue, so a contest that began as a piece of open scientific curiosity ended in accusation and silence.',
        zh: '第6局下于1997年5月11日的纽约，是重赛的最后一局，比分2.5–2.5打平——这局棋谁赢，谁就拿下整场比赛。执黑的卡斯帕罗夫没有选自己惯常的锋利开局，而是走了偏稳健的卡罗-康防御——这是真实压力下做出的防守型选择。\n\n第8步，深蓝走出8.Nxe6!?，这是一步来自其开局准备库的弃马（弃马 knight sacrifice），在黑王还没来得及易位到安全位置前就撕开了王前的局面。卡斯帕罗夫的应着8...Qe7让深蓝完整保住了这步弃子的价值；到第10步，象的将军10.Bg6+把黑王逼到了开阔地带，局面从此迅速崩溃。\n\n卡斯帕罗夫在深蓝走出19.c4后认输，全程只走了19步、不到一小时——这是他对阵机器时输得最快、最一边倒的一局。深蓝以3.5–2.5拿下整场比赛。之后卡斯帕罗夫公开指控IBM团队作弊并要求重赛；IBM拒绝了，并很快让深蓝退役——一场以公开的科学好奇心开始的对局，最终以指控与沉默收场。',
      },
      why: {
        en: "Deep Blue's prepared knight sacrifice on move 8 ended the match — and the whole Kasparov-versus-computer story — in nineteen moves.",
        zh: '深蓝预先准备好的第8步弃马，让卡斯帕罗夫19步内认输，也终结了这整场持续多年的人机较量。',
      },
      keyMoves: [
        { ply: 15, san: 'Nxe6', note: {
          en: '8.Nxe6!? is a knight sacrifice straight from Deep Blue’s opening preparation — the whole game turns on whether Black finds the best response.',
          zh: '8.Nxe6!? 是一步来自深蓝开局准备库的弃马——这盘棋的走向，就取决于黑方能不能找到最佳应对。' } },
        { ply: 16, san: 'Qe7', note: {
          en: '8...Qe7 keeps the queen active but is not the critical try; strict analysis prefers the immediate 8...fxe6, giving back less compensation.',
          zh: '8...Qe7 保持了后的活动性，但不是最紧要的应法；严格分析更推荐直接8...fxe6，让白方的补偿更少一些。' } },
        { ply: 19, san: 'Bg6+', note: {
          en: '10.Bg6+ forces Black’s king out into the open before it can find shelter — the sacrifice has now converted into a full-blown king hunt.',
          zh: '10.Bg6+ 在黑王找到栖身之处前把它逼到了开阔地带——这步弃子至此已经转化成一场彻底的抓王行动。' } },
        { ply: 37, san: 'c4', note: {
          en: '19.c4 is the last move played. Kasparov resigned here, having lost in nineteen moves — the fastest defeat of the entire rematch.',
          zh: '19.c4 是这局棋走出的最后一手。卡斯帕罗夫在这里认输，19步告负——整场重赛里最快的一次落败。' } },
      ],
      pgn: [
        '[Event "Kasparov vs Deep Blue Rematch"]',
        '[Site "New York, NY USA"]',
        '[Date "1997.05.11"]',
        '[Round "6"]',
        '[White "Deep Blue"]',
        '[Black "Kasparov, Garry"]',
        '[Result "1-0"]',
        '',
        '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Ng5 Ngf6 6. Bd3 e6 7. N1f3 h6 8. Nxe6 Qe7 9. O-O fxe6 10. Bg6+ Kd8 11. Bf4 b5 12. a4 Bb7 13. Re1 Nd5 14. Bg3 Kc8 15. axb5 cxb5 16. Qd3 Bc6 17. Bf5 exf5 18. Rxe7 Bxe7 19. c4 1-0',
      ].join('\n'),
    },
    {
      id: 'alphazero-stockfish-2017-g10',
      group: 'machine',
      tags: ['human-vs-machine', 'positional'],
      difficulty: 3,
      source: 'https://arxiv.org/abs/1712.01815',
      story: {
        en: 'In December 2017, DeepMind’s AlphaZero played a 100-game match against Stockfish 8, then the strongest conventional chess engine, at one minute per move each. AlphaZero had not been given any chess knowledge beyond the rules; it learned entirely by playing itself, in a training run the published paper reports as taking about nine hours. Stockfish, by contrast, searched positions the traditional way — brute-force calculation guided by an evaluation function hand-tuned by generations of programmers.\n\nThis particular game, published by DeepMind as “Game 10” in its own selection of ten example games, shows AlphaZero’s style at its clearest. Through the middle third of the game AlphaZero (White) let its material count fall well behind — at one point down the equivalent of a rook and more — in exchange for piece activity and pressure on Black’s king, rather than fighting to win material back move by move. Only in the endgame did the balance swing decisively the other way.\n\nStockfish resigned in a lost king-and-knight-versus-king-and-rook ending with no saving try left. Across the full hundred-game match AlphaZero won 28 games, drew 72, and lost none. What made it notable was not only the final score, but that a system given nothing but the rules of chess had, in hours rather than decades, arrived on its own at judgements about long-term compensation that traditional engines still needed human programmers to encode by hand.',
        zh: '2017年12月，DeepMind的AlphaZero与当时最强的传统国际象棋引擎Stockfish 8下了一场100局的比赛，每步限时一分钟。AlphaZero除了规则之外没有被灌输任何国际象棋知识，它完全靠自我对弈学会下棋——论文公布的训练时长约为九小时。相比之下，Stockfish走的是传统路线：靠暴力搜索计算，由几代程序员手工调校出来的评估函数来指引方向。\n\n这一局是DeepMind自己从这场比赛里挑出的十局范例棋之一，编号「第10局」，很典型地展示了AlphaZero的风格。在中局的相当一段时间里，执白的AlphaZero让自己的子力落后了不少——一度落后相当于一个车还多一点——用来换取棋子的活动性与对黑方王的压力，而不是每一步都急着把材料吃回来。局面的天平直到残局才明显倒向白方。\n\nStockfish在一个后已易先、只剩单马对车的残局里认输，没有任何解救的机会。整场100局的比赛，AlphaZero赢28局、和72局、一局未输。真正引人注意的不只是这个比分，而是一套除了规则什么都没被告知的系统，只用了几个小时而不是几十年，就自己得出了关于长期补偿的判断——而传统引擎在这一点上，仍然需要人类程序员手工写进代码里。',
      },
      why: {
        en: 'A network trained from nothing but the rules of chess for about nine hours gave up material for long-term pressure, then converted it in the endgame.',
        zh: '一套除了规则什么都不懂、只训练了约九小时的神经网络，用长期弃子换取压制，最终把优势兑现在了残局里。',
      },
      keyMoves: [
        { ply: 13, san: 'd5', note: {
          en: '7.d5 pushes in the centre early, opening the position rather than settling into a slow build-up — the first sign of an active plan.',
          zh: '7.d5 及早在中心推兵，主动打开局面而不是慢慢经营——这是主动型计划的第一个信号。' } },
        { ply: 15, san: 'Nh4', note: {
          en: '8.Nh4 does not rush to recapture or simplify; White repositions a piece for activity first, material accounting second.',
          zh: '8.Nh4 不急着吃回兵或简化局面；白方先为棋子找活动的位置，材料上的算账放在其后。' } },
        { ply: 71, san: 'Qe6', note: {
          en: '36.Qe6 offers a queen trade that leads straight into a technical endgame — White’s activity and king safety now outweigh what had been a material deficit.',
          zh: '36.Qe6 主动提出换后，直接把局面带入一个技术性残局——此刻白方的子力活跃度与王的安全，已经超过了之前的物质劣势。' } },
        { ply: 111, san: 'Kd4', note: {
          en: '56.Kd4 is the last move played. Black resigns here, down to a lone knight against king and rook with no defensive resource left.',
          zh: '56.Kd4 是这局棋走出的最后一手。黑方在这里认输，只剩孤马对抗白方的王和车，再无防守资源。' } },
      ],
      pgn: [
        '[Event "AlphaZero vs Stockfish, 100-game match"]',
        '[Site "?"]',
        '[Date "2017.12.05"]',
        '[Round "10"]',
        '[White "AlphaZero"]',
        '[Black "Stockfish"]',
        '[Result "1-0"]',
        '',
        '1. Nf3 Nf6 2. d4 e6 3. c4 b6 4. g3 Bb7 5. Bg2 Be7 6. O-O O-O 7. d5 exd5 8. Nh4 c6 9. cxd5 Nxd5 10. Nf5 Nc7 11. e4 d5 12. exd5 Nxd5 13. Nc3 Nxc3 14. Qg4 g6 15. Nh6+ Kg7 16. bxc3 Bc8 17. Qf4 Qd6 18. Qa4 g5 19. Re1 Kxh6 20. h4 f6 21. Be3 Bf5 22. Rad1 Qa3 23. Qc4 b5 24. hxg5+ fxg5 25. Qh4+ Kg6 26. Qh1 Kg7 27. Be4 Bg6 28. Bxg6 hxg6 29. Qh3 Bf6 30. Kg2 Qxa2 31. Rh1 Qg8 32. c4 Re8 33. Bd4 Bxd4 34. Rxd4 Rd8 35. Rxd8 Qxd8 36. Qe6 Nd7 37. Rd1 Nc5 38. Rxd8 Nxe6 39. Rxa8 Kf6 40. cxb5 cxb5 41. Kf3 Nd4+ 42. Ke4 Nc6 43. Rc8 Ne7 44. Rb8 Nf5 45. g4 Nh6 46. f3 Nf7 47. Ra8 Nd6+ 48. Kd5 Nc4 49. Rxa7 Ne3+ 50. Ke4 Nc4 51. Ra6+ Kg7 52. Rc6 Kf7 53. Rc5 Ke6 54. Rxg5 Kf6 55. Rc5 g5 56. Kd4 1-0',
      ].join('\n'),
    },
    {
      id: 'hydra-adams-2005',
      group: 'machine',
      tags: ['human-vs-machine', 'attack'],
      difficulty: 2,
      source: 'https://en.chessbase.com/post/adams-vs-hydra-in-london',
      story: {
        en: 'In June 2005 in London, eight years after Deep Blue beat Kasparov, a different kind of chess computer sat down across from a human grandmaster. Hydra was not a general-purpose machine like Deep Blue; it was purpose-built chess hardware, a cluster running dedicated chess chips. Its opponent was Michael Adams, at the time Britain’s top-ranked grandmaster and a member of the world top ten. Unlike Kasparov in 1997, Adams prepared no special anti-computer strategy; he played his normal repertoire.\n\nThe result was one-sided. Hydra won five of the six games and Adams salvaged only a single draw, for a final score of 5.5–0.5. This game, the third of the match, shows the pattern: a standard Ruy Lopez opening, a slow queenside build-up, and then, on move 28, a bishop sacrifice on h6 that tore open Black’s king position with no adequate reply available.\n\nTen years earlier, a reigning world champion had needed all six games to lose just one to a computer, and still won the match overall. By 2005, a specialised machine could beat a world top-ten grandmaster without him winning a single game. The question that had opened as a live scientific curiosity in 1996 — can a computer really out-play the best human? — had, by this point, become a settled fact rather than an open one.',
        zh: '2005年6月的伦敦，深蓝击败卡斯帕罗夫的八年之后，一台不同类型的国际象棋计算机坐到了一位人类特级大师对面。Hydra不像深蓝那样是通用机器，而是专为国际象棋打造的硬件——一个跑着专用棋类芯片的计算机集群。它的对手是迈克尔·亚当斯，当时英国排名第一的特级大师、世界前十棋手之一。与1997年的卡斯帕罗夫不同，亚当斯没有做任何针对计算机的特别准备，他下的就是自己惯常的那套棋路。\n\n结果毫无悬念地一边倒。Hydra在六局里赢了五局，亚当斯只逼和了一局，最终比分5.5–0.5。这一局是整场比赛的第三局，很典型地体现了这种模式：一个标准的西班牙开局，后翼一段缓慢的经营，然后在第28步，一记落在h6的弃象撕开了黑方的王翼，黑方没有足够的应对办法。\n\n十年前，一位在位世界冠军六局里输掉一局给计算机，整场比赛却依然是他赢下来的。到了2005年，一台专用机器已经能在人类世界前十的特级大师身上做到让对方一局不胜。1996年那个还悬而未决的科学问题——计算机真的能下赢最强的人类吗——到这时已经不再是问题，而成了既成事实。',
      },
      why: {
        en: 'Ten years after Deep Blue, a specialised chess machine beat a world top-ten grandmaster 5.5–0.5, and he never won a single game.',
        zh: '深蓝之后十年，一台专用国际象棋计算机以5.5–0.5击败一位世界前十的特级大师，对方全程一局未胜。',
      },
      keyMoves: [
        { ply: 17, san: 'd4', note: {
          en: '9.d4 opens the centre, breaking from the slow manoeuvring typical of the closed Ruy Lopez and starting the fight for space early.',
          zh: '9.d4 打开中心，跳出西班牙开局慢慢经营的常规套路，早早开始争夺空间。' } },
        { ply: 43, san: 'Nxc4', note: {
          en: '22.Nxc4 is the payoff of a long knight journey (from b1, through d2, f1, g5, e3 and f3, to h4): the knight finally captures on c4 — a reminder that knights need many short hops to cross the board, unlike a bishop or rook.',
          zh: '22.Nxc4 是这只马长途跋涉（从b1出发，经d2、f1、g5、e3、f3，最终到h4）后的回报：它终于在c4吃到了子——提醒人一句，马要靠好几次短跳才能穿过棋盘，不像象或车那样一步到位。' } },
        { ply: 55, san: 'Bxh6', note: {
          en: '28.Bxh6 is the last move played: a bishop sacrifice on h6 that tears open Black’s king position. Adams resigned rather than face what came next.',
          zh: '28.Bxh6 是这局棋走出的最后一手：一记落在h6的弃象，撕开了黑方王翼的防线。亚当斯没有等接下来的进攻展开，直接认了输。' } },
      ],
      pgn: [
        '[Event "Man-Machine"]',
        '[Site "London, ENG"]',
        '[Date "2005.06.23"]',
        '[Round "3"]',
        '[White "Hydra"]',
        '[Black "Adams, Michael"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. d4 Bg4 10. d5 Na5 11. Bc2 c6 12. h3 Bc8 13. dxc6 Qc7 14. Nbd2 Qxc6 15. Nf1 Be6 16. Ng5 Bd8 17. Ne3 Bd7 18. a4 h6 19. Nf3 Rc8 20. axb5 axb5 21. Nh4 Nc4 22. Nxc4 bxc4 23. Ba4 Qc7 24. Bxd7 Qxd7 25. Nf5 d5 26. Ra6 Qb7 27. Rd6 Be7 28. Bxh6 1-0',
      ].join('\n'),
    },
  ];
});
