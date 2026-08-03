/* 棋谱分组：争议与人性。★ 编辑源之一。
   一组一个文件，因为 30 局的双语文案要在并行的 worktree 上写——写进同一个
   文件必然在合并时冲突，而冲突的是大段散文，最难 review。每一局仍然只有
   一处编辑源。数据契约见 docs/superpowers/plans/2026-08-02-chess-phase2-game-replay.md。
   零依赖；node 与浏览器双用。运行时被内联进 tools/chess-game-replay.html。

   这一组收的不是「下得最好的棋」，是「关于人的棋」：一次打破偏见的胜利、
   一步史上最著名的漏着、一场信任危机、一次五万人的集体决策、一个自嘲的
   俱乐部。carlsen-niemann-2022 只写公开事实，不复述未经证实的指控——不
   给一个在世的人扣帽子。 */
(function (root, factory) {
  const list = factory();
  if (typeof module === 'object' && module.exports) module.exports = list;
  else {
    root.ChessGamesParts = root.ChessGamesParts || {};
    root.ChessGamesParts.human = list;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    {
      id: 'kasparov-polgar-2002',
      group: 'human',
      tags: ['prodigy', 'endgame'],
      difficulty: 2,
      source: 'https://www.chessgames.com/perl/chessgame?gid=1254283',
      story: {
        en: 'In September 2002, at a rapid-chess team match in Moscow — Russia against a Rest-of-the-World select side — Judit Polgar faced Garry Kasparov, who had held the world\'s top rating for most of the previous two decades. She had White, opened with the Ruy Lopez, and by move 8 had steered the game into the Berlin Defence endgame: an early queen trade into a position considered so solid that grandmasters would later use it for years specifically to hold Kasparov to a draw.\n\nPolgar did not use it to draw. She kept probing with rook and bishop for another 34 moves, and Kasparov resigned on move 42, a pawn down in a rook ending he could no longer hold. It was the first time in recorded chess history that a woman had beaten a reigning world number one in a competitive game.\n\nPolgar was already the youngest grandmaster in history at the time she earned the title, and the only woman ever to reach the world\'s top ten. This single game did not change how anyone plays the Berlin; it changed what could truthfully be said about who beats whom.',
        zh: '2002年9月，莫斯科的一场快棋团体赛——俄罗斯队对阵世界联队——把犹迪特·波尔加（Judit Polgar）放到了加里·卡斯帕罗夫的对面。卡斯帕罗夫在此前近二十年里几乎一直占据世界等级分第一。波尔加执白，开局西班牙开局，第8步就把局面带进了柏林防御的残局——那种后来被顶尖棋手专门用来逼和卡斯帕罗夫的稳固结构。\n\n波尔加没有用它去逼和。她带着车和象又周旋了34步，卡斯帕罗夫在第42步认输，那是一个少一兵、守不住的车残局。这是有记录以来，第一次有女性棋手在正式比赛中击败在位的世界等级分第一。\n\n波尔加当时是历史上最年轻的特级大师，也是唯一一位闯入过世界前十的女性棋手。这一局棋没有改变任何人下柏林防御的方式；它改变的是此前一直能被说出口的一句话。',
      },
      why: {
        en: 'Judit Polgar beat the reigning world #1 in a rapid game — the first time a woman had ever done that.',
        zh: '犹迪特·波尔加击败在位世界第一，有记录以来女性棋手的第一次。',
      },
      keyMoves: [
        { ply: 15, san: 'Qxd8+', note: {
          en: '8.Qxd8+ trades queens into the Berlin Defence\'s signature endgame — the same structure Vladimir Kramnik would lean on for years to hold draws against Kasparov himself. Reaching it was normally the safe, holding choice.',
          zh: '8.Qxd8+ 把后交换掉，直接走进柏林防御标志性的残局——后来弗拉基米尔·克拉姆尼克多年来正是靠这个结构逼和卡斯帕罗夫本人。走到这里，通常意味着选择了安全求和的路线。' } },
        { ply: 31, san: 'g4', note: {
          en: '16.g4 starts White\'s kingside pawns forward, gaining space and eyeing Black\'s slightly loose structure — the first sign Polgar was not playing this endgame for a draw.',
          zh: '16.g4 推动白方王翼兵向前，争取空间并瞄准黑方略显松散的结构——这是波尔加不是在为和棋而下这个残局的第一个信号。' } },
        { ply: 59, san: 'Re6', note: {
          en: '30.Re6 puts a rook on the sixth rank behind Black\'s pawns, the classic infiltration point in a rook ending — from here White\'s technical advantage starts converting into real material.',
          zh: '30.Re6 把车放到第六线、插进黑方兵阵后方，是车残局里典型的渗透点——从这里开始，白方的技术优势开始真正兑换成实质的物质得分。' } },
        { ply: 83, san: 'Rxg7', note: {
          en: '42.Rxg7 wins a second pawn and leaves Black\'s king completely exposed with two rooks still on the board; Kasparov resigned immediately rather than play on a pawn down.',
          zh: '42.Rxg7 再吃一兵，此时黑王在两车尚存的局面下彻底暴露；卡斯帕罗夫没有再等一步，当场认输。' } },
      ],
      pgn: [
        '[Event "Russia vs Rest of the World"]',
        '[Site "Moscow, Russia"]',
        '[Date "2002.09.09"]',
        '[Round "5"]',
        '[White "Polgar, Judit"]',
        '[Black "Kasparov, Garry"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6 7. dxe5 Nf5',
        '8. Qxd8+ Kxd8 9. Nc3 h6 10. Rd1+ Ke8 11. h3 Be7 12. Ne2 Nh4 13. Nxh4 Bxh4',
        '14. Be3 Bf5 15. Nd4 Bh7 16. g4 Be7 17. Kg2 h5 18. Nf5 Bf8 19. Kf3 Bg6 20. Rd2',
        'hxg4+ 21. hxg4 Rh3+ 22. Kg2 Rh7 23. Kg3 f6 24. Bf4 Bxf5 25. gxf5 fxe5 26. Re1',
        'Bd6 27. Bxe5 Kd7 28. c4 c5 29. Bxd6 cxd6 30. Re6 Rah8 31. Rexd6+ Kc8 32. R2d5',
        'Rh3+ 33. Kg2 Rh2+ 34. Kf3 R2h3+ 35. Ke4 b6 36. Rc6+ Kb8 37. Rd7 Rh2 38. Ke3',
        'Rf8 39. Rcc7 Rxf5 40. Rb7+ Kc8 41. Rdc7+ Kd8 42. Rxg7 Kc8 1-0',
      ].join('\n'),
    },
    {
      id: 'deep-fritz-kramnik-2006-g2',
      group: 'human',
      tags: ['human-vs-machine', 'blunder', 'world-championship'],
      difficulty: 2,
      source: 'https://www.chessgames.com/perl/chessgame?gid=1440787',
      story: {
        en: 'By November 2006, Vladimir Kramnik was the undisputed World Chess Champion, and the software he faced in Bonn — Deep Fritz, running on ordinary PC hardware — had already proven strong enough that the match was treated as a genuine contest, not a foregone conclusion. Game 2 was heading nowhere dramatic: Deep Fritz had won a pawn and was pressing a technical advantage, and by move 34 it had just captured a rook with 34.Nxf8.\n\nKramnik had a route back into the game: 34...Kg8, walking the king to safety, led to forced complications that later computer analysis showed drew by force. Instead he played 34...Qe3??, and Deep Fritz answered instantly with 35.Qh7# — a mate in one that had been sitting on the board the entire time. A reigning world champion, in a position he had spent real time calculating, missed a one-move checkmate.\n\nIt became the most cited blunder in chess history, not because the mistake itself was exotic — missed mates happen at every level — but because of who missed it, and what it revealed: even the best human calculation has a blind spot that a machine checking every legal reply simply does not.',
        zh: '2006年11月，弗拉基米尔·克拉姆尼克是当时无可争议的国际象棋世界冠军，他在波恩对阵的软件——跑在普通PC上的国际象棋引擎 Deep Fritz——已经强到让人认为这是一场真正势均力敌的对局，而不是走个过场。第2局并没有走向什么戏剧性的场面：Deep Fritz 多兵占优，第34步刚用 34.Nxf8 吃掉黑方一车。\n\n克拉姆尼克本来还有退路：34...Kg8 把王撤向安全处，之后的强制变化经后来的电脑分析证实是和棋。他却走了 34...Qe3??，Deep Fritz 立刻回以 35.Qh7#——那步杀棋一直摆在棋盘上，谁都能看见。一位在位世界冠军，在一个自己花了不少时间计算的局面里，看漏了一步杀。\n\n这一步后来成了国际象棋史上被引用最多的漏着，原因不在于这个错误本身有多离奇——各种水平的棋手都会看漏杀棋——而在于是谁看漏了它，以及它说明了什么：再强的人类计算力也有盲区，而一台会检查每一种合法应着的机器，恰好没有这个盲区。',
      },
      why: {
        en: 'The world champion missed a mate in one — the most famous blunder in chess history, and a lesson in human attention.',
        zh: '世界冠军看漏一步杀——史上最著名的漏着 blunder，一堂关于人类注意力的课。',
      },
      keyMoves: [
        { ply: 47, san: 'Qxf7+', note: {
          en: '24.Qxf7+ grabs a second pawn with check while Black\'s pieces are tangled on the back rank — the computer is already converting a structural edge into a concrete material one.',
          zh: '24.Qxf7+ 借将军再吃一兵，此时黑方的子力还挤在底线上没理顺——引擎已经在把结构优势兑换成实实在在的多兵。' } },
        { ply: 63, san: 'Nxe6', note: {
          en: '32.Nxe6 forks Kramnik\'s bishop and rook — the position tips from "worse for Black" to "losing", several moves before the blunder that everyone remembers.',
          zh: '32.Nxe6 一步双叉 fork 同时叉住克拉姆尼克的象和车——局面从「黑方稍差」滑向「黑方已经输了」，比后来那步被所有人记住的漏着早了好几步。' } },
        { ply: 67, san: 'Nxf8', note: {
          en: '34.Nxf8 captures Black\'s rook. This is the exact position: Kramnik still had 34...Kg8, walking the king to safety, which analysis shows holds a draw by force.',
          zh: '34.Nxf8 吃掉黑方的车。就是这个局面：克拉姆尼克本来还有 34...Kg8 把王撤到安全处，事后分析证实这条路能强制守和。' } },
        { ply: 68, san: 'Qe3', note: {
          en: '34...Qe3?? is the blunder itself — chess history\'s most famous one. Instead of the safe king move, Kramnik pushed his queen to e3, apparently still hunting for winning chances, and simply did not see that it left no defence to a queen check on h7. He had, by his own account, calculated several moves ahead and stopped just short of the one square that mattered.',
          zh: '34...Qe3?? 就是这步漏着本身——国际象棋史上最著名的一个。克拉姆尼克没走安全的王步，反而把后推到e3，看起来还在找取胜机会，却完全没看到这一步对h7的后将军毫无防御。据他本人事后所说，他算了好几步深，却恰好在关键的那一格前停住了。' } },
        { ply: 69, san: 'Qh7#', note: {
          en: '35.Qh7# — checkmate. The queen was defended by nothing needing defence: no black piece could reach h7, block the check, or capture the queen. Deep Fritz found it instantly; Kramnik, calculating by hand under a clock, did not find it at all.',
          zh: '35.Qh7#——将死。这个后不需要保护也没人能碰它：没有一个黑子能到达h7、挡住将军或吃掉这个后。Deep Fritz 瞬间就算到了这一步；克拉姆尼克在钟表压力下靠人脑计算，却完全没算到。' } },
      ],
      pgn: [
        '[Event "Man vs Machine World Chess Championship"]',
        '[Site "Bonn, Germany"]',
        '[Date "2006.11.27"]',
        '[Round "2"]',
        '[White "Deep Fritz"]',
        '[Black "Kramnik, Vladimir"]',
        '[Result "1-0"]',
        '',
        '1. d4 d5 2. c4 dxc4 3. e4 b5 4. a4 c6 5. Nc3 b4 6. Na2 Nf6 7. e5 Nd5 8. Bxc4 e6',
        '9. Nf3 a5 10. Bg5 Qb6 11. Nc1 Ba6 12. Qe2 h6 13. Be3 Bxc4 14. Qxc4 Nd7 15. Nb3',
        'Be7 16. Rc1 O-O 17. O-O Rfc8 18. Qe2 c5 19. Nfd2 Qc6 20. Qh5 Qxa4 21. Nxc5',
        'Nxc5 22. dxc5 Nxe3 23. fxe3 Bxc5 24. Qxf7+ Kh8 25. Qf3 Rf8 26. Qe4 Qd7 27. Nb3',
        'Bb6 28. Rfd1 Qf7 29. Rf1 Qa7 30. Rxf8+ Rxf8 31. Nd4 a4 32. Nxe6 Bxe3+ 33. Kh1',
        'Bxc1 34. Nxf8 Qe3 35. Qh7# 1-0',
      ].join('\n'),
    },
    {
      id: 'carlsen-niemann-2022',
      group: 'human',
      tags: ['controversy'],
      difficulty: 2,
      source: 'https://lichess.org/broadcast/sinquefield-cup-grand-chess-tour-2022/round-3/jNzNS3br/89RoVoRC',
      story: {
        en: 'On 4 September 2022, at the Sinquefield Cup in Saint Louis, Magnus Carlsen — the reigning World Champion and heavy favourite — lost a classical game to 19-year-old Hans Niemann for the first time. The game itself was a fairly ordinary Nimzo-Indian: a level position drifted, Carlsen made a couple of imprecise moves in a rook-and-bishop ending, and on move 42 he played an outright blunder, 42.Rd7??, that let his position collapse into a technically lost ending. He resigned on move 57.\n\nThe next day, Carlsen withdrew from the tournament without explanation, posting a short public statement that quoted a José Mourinho line about preferring not to speak. Tournament organisers said the decision was personal and confirmed there was no indication any player had cheated during the event; FIDE\'s president publicly said there were better ways to have handled the situation and asked its Fair Play Commission to review any evidence that was submitted.\n\nChess.com later published an investigation concluding that Niemann had likely cheated in more than 100 past online games, but reported a lack of concrete statistical evidence of cheating in his over-the-board games against Carlsen. No official body has concluded that Niemann cheated in this particular game. What makes this game worth including is not what happened on the board — it is that this was the moment competitive chess had to publicly confront a question it had mostly avoided: how do you prove your opponent, sitting across the table, didn\'t cheat?',
        zh: '2022年9月4日，圣路易斯的辛克菲尔德杯（Sinquefield Cup）上，在位世界冠军、绝对夺冠热门马格努斯·卡尔森，第一次在正赛中负于19岁的汉斯·尼曼（Hans Niemann）。这盘棋本身相当普通：一个尼姆佐印度防御，局面在中局逐渐失去平衡，卡尔森在车象残局里走了几步不够精确的棋，第42步一步实实在在的漏着 blunder——42.Rd7??——让局面彻底崩溃成技术性输局，他在第57步认输。\n\n第二天，卡尔森未作说明地退出了赛事，只发了一条简短声明，引用了穆里尼奥的一句话——大意是「我宁愿不说话，说了我会有大麻烦」。赛事主办方表示这是他的个人决定，并确认没有任何迹象显示比赛期间有选手作弊；国际棋联（FIDE）主席公开表示本可以有更好的处理方式，并要求公平竞赛委员会审查任何被提交的证据。\n\nChess.com 后来发布调查报告，认为尼曼此前很可能在超过100盘线上对局中作弊，但表示在他与卡尔森的现场对局中，没有找到能站住脚的统计证据证明作弊。至今没有任何官方机构认定尼曼在这盘棋里作弊。这局棋值得收进来，理由不在棋盘上——而在于，这是竞技国际象棋第一次必须公开面对一个它此前大多回避的问题：你要怎么证明，坐在你对面的人没有作弊？',
      },
      why: {
        en: 'Chess had to face, in public, the question of how you prove an opponent across the board didn\'t cheat.',
        zh: '国际象棋第一次要公开面对：怎么证明对面的人没有作弊。',
      },
      keyMoves: [
        { ply: 1, san: 'd4', note: {
          en: '1.d4 opens an ordinary Nimzo-Indian. Nothing about the opening or the first twenty-odd moves is unusual — worth noting precisely because the controversy that followed had nothing to do with how this game began.',
          zh: '1.d4 走的是一个再普通不过的尼姆佐印度防御。开局与前二十来步都没有任何异常——这一点值得记一笔，正因为后来的风波跟这局棋怎么开始的毫无关系。' } },
        { ply: 55, san: 'g4', note: {
          en: '28.g4?! is the engine\'s first flagged inaccuracy for White — a small positional loosening, not yet a mistake.',
          zh: '28.g4?! 是引擎标记的白方第一个不精确 inaccuracy——只是松动了局面，还谈不上错误。' } },
        { ply: 61, san: 'Re7', note: {
          en: '31.Re7 is where the evaluation swings sharply toward Black — the position is turning without either side doing anything spectacular.',
          zh: '31.Re7 是评估分数明显转向黑方的一步——局面在悄悄倒向黑方，双方都没走出什么惊艳的棋。' } },
        { ply: 83, san: 'Rd7', note: {
          en: '42.Rd7?? is the game\'s one outright blunder — the point where a merely worse position for White became a lost one.',
          zh: '42.Rd7?? 是这局棋唯一一步实实在在的漏着 blunder——白方从只是差一点，变成了输定。' } },
        { ply: 114, san: 'Ke5', note: {
          en: '57...Ke5 is the position Carlsen resigned in: no rooks left on the board at all — just king and bishop for White against king, knight and two connected passed pawns for Black, two pawns down with no fortress left to build. What happened next had nothing to do with any of the fifty-odd moves before it.',
          zh: '57...Ke5 是卡尔森认输时的局面：棋盘上已经没有车了——只剩白方王 + 象，对黑方王 + 马 + 两个相连的通路兵，白方少两个兵，已经无险可守。接下来发生的事，跟前面这五十多步棋都没有关系。' } },
      ],
      pgn: [
        '[Event "Sinquefield Cup"]',
        '[Site "Saint Louis, MO USA"]',
        '[Date "2022.09.04"]',
        '[Round "3"]',
        '[White "Carlsen, Magnus"]',
        '[Black "Niemann, Hans Moke"]',
        '[Result "0-1"]',
        '',
        '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. g3 O-O 5. Bg2 d5 6. a3 Bxc3+ 7. bxc3 dxc4',
        '8. Nf3 c5 9. O-O cxd4 10. Qxd4 Nc6 11. Qxc4 e5 12. Bg5 h6 13. Rfd1 Be6 14. Rxd8',
        'Bxc4 15. Rxa8 Rxa8 16. Bxf6 gxf6 17. Kf1 Rd8 18. Ke1 Na5 19. Rd1 Rc8 20. Nd2',
        'Be6 21. c4 Bxc4 22. Nxc4 Rxc4 23. Rd8+ Kg7 24. Bd5 Rc7 25. Ra8 a6 26. Rb8 f5',
        '27. Re8 e4 28. g4 Rc5 29. Ba2 Nc4 30. a4 Nd6 31. Re7 fxg4 32. Rd7 e3 33. fxe3',
        'Ne4 34. Kf1 Rc1+ 35. Kg2 Rc2 36. Bxf7 Rxe2+ 37. Kg1 Re1+ 38. Kg2 Re2+ 39. Kg1',
        'Kf6 40. Bd5 Rd2 41. Rf7+ Kg6 42. Rd7 Ng5 43. Bf7+ Kf5 44. Rxd2 Nf3+ 45. Kg2',
        'Nxd2 46. a5 Ke5 47. Kg3 Nf1+ 48. Kf2 Nxh2 49. e4 Kxe4 50. Be6 Kf4 51. Bc8 Nf3',
        '52. Bxb7 Ne5 53. Bxa6 Nc6 54. Bb7 Nxa5 55. Bd5 h5 56. Bf7 h4 57. Bd5 Ke5 0-1',
      ].join('\n'),
    },
    {
      id: 'kasparov-world-1999',
      group: 'human',
      tags: ['controversy', 'opening-theory', 'prodigy'],
      difficulty: 3,
      source: 'https://www.chessgames.com/perl/chessgame?gid=1252350',
      story: {
        en: 'Between June and October 1999, Garry Kasparov played a single game of chess against more than 50,000 people from over 75 countries, hosted on MSN\'s Gaming Zone. Kasparov played White alone; for Black, anyone could log in and vote on the next move, and the plurality decided what got played. Four strong young players — including 15-year-old Irina Krush, freshly crowned US Women\'s Champion — were brought in as official advisors to help the crowd think through its choices, and their analysis dominated the voting for most of the game.\n\nThe game turned sharp fast: by move 10 the World Team had already left known theory with a Krush-suggested novelty, and by move 11 Black\'s queen was deep in White\'s position picking up a pawn with the king still stuck in the centre. Kasparov later said the outcome stayed uncertain until around move 51, when the World Team\'s queenside pawn push won its vote by a narrow margin over the alternatives.\n\nIt ended on move 62, four months after it began, when Kasparov\'s pawn on g7 made a forced mate unstoppable and the World Team resigned rather than play it out. It remains one of the largest single collective decision-making experiments chess — or perhaps any strategy game — has ever run: tens of thousands of people, one shared board, one vote at a time.',
        zh: '1999年6月到10月间，加里·卡斯帕罗夫在MSN Gaming Zone上，独自一人对阵来自75个以上国家、超过5万人组成的「世界队」下了一局棋。卡斯帕罗夫单独执白；黑方这边，任何人都可以登录投票选下一步该走什么，得票最多的走法就会被真正走出来。微软请来四位年轻的强手棋手——包括当时15岁、刚拿到美国女子冠军的伊琳娜·克鲁什（Irina Krush）——作为官方顾问，帮助这群业余投票者理清思路，她们的分析在整局棋的大部分时间里主导了投票结果。\n\n局面很快变得复杂起来：第10步世界队就在克鲁什建议下走出了一步跳出已知理论的新招，第11步黑后已经深入白方阵地吃掉一个兵，此时黑王仍困在中路。卡斯帕罗夫后来说，胜负走向一直悬而未决，直到第51步左右——世界队推后翼兵的那步棋，只以微弱优势险胜了更稳妥的选项。\n\n四个月后，这局棋在第62步结束：卡斯帕罗夫的兵推到g7，让升变再也无法阻止，世界队没有把棋走完，直接认输。这至今仍是国际象棋——或者说任何策略类游戏——做过的规模最大的集体决策实验之一：数万人共享一张棋盘，一步一投票。',
      },
      why: {
        en: 'Kasparov alone versus a plurality vote of 50,000+ people online — one of the largest collective-decision experiments chess has run.',
        zh: '卡斯帕罗夫一人对阵5万多人网络投票——国际象棋史上规模最大的集体决策实验之一。',
      },
      keyMoves: [
        { ply: 20, san: 'Qe6', note: {
          en: '10...Qe6 is the move that broke from known theory — a novelty proposed by 15-year-old Irina Krush, one of four young players Microsoft brought in to advise the World Team\'s votes, and the moment the crowd stopped just repeating known lines.',
          zh: '10...Qe6 是跳出已知理论的一步——由15岁的伊琳娜·克鲁什提出。她是微软请来协助世界队投票的四位青年棋手之一，这一步也是这群业余投票者第一次不再只是复述已知变着的时刻。' } },
        { ply: 22, san: 'Qxe4', note: {
          en: '11...Qxe4 sends the black queen deep into White\'s position to grab a pawn, with the black king still stuck in the centre. It is a principled but risky choice — exactly the kind of decision a plurality vote of thousands is bad at making carefully, and this time the vote was right.',
          zh: '11...Qxe4 让黑后深入白方阵地吃掉一个兵，此时黑王还困在中路没有王车易位。这是一步有依据但很冒险的棋——恰恰是几千人投票表决最不擅长做出的那种精细决定，但这次投票赌对了。' } },
        { ply: 102, san: 'b5', note: {
          en: '51...b5 won its vote by a narrow margin over safer alternatives — the closest the World Team came to choosing wrong, in a game that had stayed roughly balanced until this point.',
          zh: '51...b5 只以微弱优势胜过更稳妥的选项——这是整局棋里世界队投票最接近选错的一次，此前局面大致维持着均势。' } },
        { ply: 123, san: 'g7', note: {
          en: '62.g7 is not a capture or a check — it simply makes the pawn\'s promotion unstoppable. Kasparov had calculated a forced mate from here; the World Team saw the same thing and resigned rather than play it out.',
          zh: '62.g7 既不是吃子也不是将军——它只是让这个兵的升变再也无法阻止。卡斯帕罗夫算出了从这里开始的强制杀棋；世界队看出了同样的结论，选择认输而不是把它走完。' } },
      ],
      pgn: [
        '[Event "Kasparov versus the World"]',
        '[Site "Internet (MSN Gaming Zone)"]',
        '[Date "1999.10.22"]',
        '[Round "-"]',
        '[White "Kasparov, Garry"]',
        '[Black "The World"]',
        '[Result "1-0"]',
        '',
        '1. e4 c5 2. Nf3 d6 3. Bb5+ Bd7 4. Bxd7+ Qxd7 5. c4 Nc6 6. Nc3 Nf6 7. O-O g6',
        '8. d4 cxd4 9. Nxd4 Bg7 10. Nde2 Qe6 11. Nd5 Qxe4 12. Nc7+ Kd7 13. Nxa8 Qxc4',
        '14. Nb6+ axb6 15. Nc3 Ra8 16. a4 Ne4 17. Nxe4 Qxe4 18. Qb3 f5 19. Bg5 Qb4',
        '20. Qf7 Be5 21. h3 Rxa4 22. Rxa4 Qxa4 23. Qxh7 Bxb2 24. Qxg6 Qe4 25. Qf7 Bd4',
        '26. Qb3 f4 27. Qf7 Be5 28. h4 b5 29. h5 Qc4 30. Qf5+ Qe6 31. Qxe6+ Kxe6 32. g3',
        'fxg3 33. fxg3 b4 34. Bf4 Bd4+ 35. Kh1 b3 36. g4 Kd5 37. g5 e6 38. h6 Ne7',
        '39. Rd1 e5 40. Be3 Kc4 41. Bxd4 exd4 42. Kg2 b2 43. Kf3 Kc3 44. h7 Ng6',
        '45. Ke4 Kc2 46. Rh1 d3 47. Kf5 b1=Q 48. Rxb1 Kxb1 49. Kxg6 d2 50. h8=Q d1=Q',
        '51. Qh7 b5 52. Kf6+ Kb2 53. Qh2+ Ka1 54. Qf4 b4 55. Qxb4 Qf3+ 56. Kg7 d5',
        '57. Qd4+ Kb1 58. g6 Qe4 59. Qg1+ Kb2 60. Qf2+ Kc1 61. Kf6 d4 62. g7 1-0',
      ].join('\n'),
    },
    {
      id: 'menchik-euwe-1930',
      group: 'human',
      tags: ['endgame', 'positional'],
      difficulty: 2,
      source: 'https://www.saund.co.uk/britbase/pgn/193012hast-viewer.html',
      story: {
        en: 'At Hastings, over the New Year of 1930 into 1931, Vera Menchik — the reigning Women\'s World Champion, and the only woman playing in the men\'s Premier section — sat down against Max Euwe, the Dutch champion who would become World Chess Champion five years later by beating Alexander Alekhine. Euwe pushed his queenside pawns forward looking for an attack; Menchik defended it, traded queens on move 33, and by the adjournment the position — a bishop and five pawns each — was judged roughly level by the tournament\'s own report.\n\nEuwe kept pressing for a win anyway rather than settling for a draw in what should have been a safe position, and it cost him: Menchik\'s queenside pawn eventually outran his defence, promoted to a queen on move 59, and forced his resignation two moves later, on move 61.\n\nIt was Euwe\'s only loss of the tournament. He still won Hastings outright, and did go on to take the world title in 1935 — but this defeat followed him. The other grandmasters who lost to Menchik at Hastings over the years jokingly named themselves the "Menchik Club", membership open only to men who had lost a competitive game to her. It was self-deprecation dressed as a joke, and underneath it was a plain fact none of them could argue with: on that day, over that board, she was simply the better player.',
        zh: '1930年跨1931年新年前后的黑斯廷斯（Hastings）赛事上，时任女子世界冠军、也是那届甲组公开赛（Premier）里唯一女性选手的维拉·门契克（Vera Menchik），对阵荷兰棋手马克斯·尤伟（Max Euwe）——五年后，尤伟将击败亚历山大·阿廖欣（Alexander Alekhine），成为国际象棋世界冠军。尤伟推进后翼兵寻求攻势；门契克顶住了这波攻击，第33步兑掉后，双方封盘时的局面——各有一象与五个兵——按赛事自己的报道，是大致均势。\n\n尤伟本可以就此接受和棋，却选择继续争胜，代价随之而来：门契克的后翼兵最终跑过了他的防线，在第59步升变成后，两步之后、第61步，逼他认输。\n\n这是尤伟那届比赛唯一的一场失利。他仍然拿到了那届黑斯廷斯赛事的总冠军，五年后也确实登上了世界冠军的宝座——但这场败局一直跟着他。多年来，那些在黑斯廷斯输给门契克的大师们，半开玩笑地把自己组成了「门契克俱乐部」（Menchik Club），入会资格只有一条：输给过她一局正式比赛。这是包着玩笑外衣的自嘲，而玩笑底下是一个谁都没法反驳的事实：那一天，那张棋盘上，她就是更强的那个人。',
      },
      why: {
        en: 'Vera Menchik beat future World Champion Max Euwe at Hastings — the loss that gave the \'Menchik Club\' its name.',
        zh: '维拉·门契克在黑斯廷斯击败未来世界冠军尤伟——「门契克俱乐部」由此得名。',
      },
      keyMoves: [
        { ply: 27, san: 'b4', note: {
          en: '14.b4 starts Euwe\'s queenside pawns forward looking for a minority-attack breakthrough — the plan he would spend the rest of the game trying, and failing, to press home.',
          zh: '14.b4 推动尤伟的后翼兵向前，寻求少数兵种攻击 minority attack 式的突破——这也是他此后整局棋一直想推进、却始终没能兑现的计划。' } },
        { ply: 66, san: 'Bxc8', note: {
          en: '33...Bxc8 recaptures after the queens come off. This is the position both sides adjourned in: a bishop and five pawns each, judged roughly level at the time.',
          zh: '33...Bxc8 是兑后之后的回吃。这正是双方封盘时的局面：各有一象、五个兵，当时被判断为大致均势。' } },
        { ply: 77, san: 'g4', note: {
          en: '39.g4, after the resumption, is Euwe reopening the position rather than accepting the draw the adjournment analysis suggested — the start of the overreach that would cost him the game.',
          zh: '39.g4 是复赛后尤伟主动打开局面，而不是接受封盘分析所建议的和棋——这正是那步日后让他输掉整局棋的过度求胜的开端。' } },
        { ply: 108, san: 'b2', note: {
          en: '54...b2 puts Menchik\'s queenside pawn one square from promoting, with White\'s king and bishop unable to cover both it and the kingside at once.',
          zh: '54...b2 让门契克的后翼兵只差一格就能升变，此时白方的王与象已经顾不过来——既守不住这个兵，也守不住王翼。' } },
        { ply: 118, san: 'b1=Q', note: {
          en: '59...b1=Q — the pawn queens. What began as a level bishop ending has turned into a second black queen on the board and a lost position for White.',
          zh: '59...b1=Q——兵升变成后。原本大致均势的象残局，此刻变成了黑方多出一个后、白方已经输定的局面。' } },
        { ply: 122, san: 'Kxd5', note: {
          en: '61...Kxd5 is the final move of the game; White resigned rather than continue two queens down in material terms of initiative and safety.',
          zh: '61...Kxd5 是这局棋的最后一步；白方没有再走下去——无论主动权还是王的安全，都已经没有翻盘的余地。' } },
      ],
      pgn: [
        '[Event "Hastings Premier 1930/31 11th"]',
        '[Site "Hastings, Waverley Hotel, England"]',
        '[Date "1930.12.30"]',
        '[Round "2"]',
        '[White "Euwe, Max"]',
        '[Black "Menchik, Vera"]',
        '[Result "0-1"]',
        '',
        '1. d4 Nf6 2. c4 e6 3. Nc3 d5 4. Bg5 Nbd7 5. e3 Be7 6. Nf3 O-O 7. Rc1 a6 8. cxd5',
        'exd5 9. Bd3 c6 10. O-O Ne4 11. Bf4 Nxc3 12. Rxc3 Re8 13. Qb1 Nf8 14. b4 Ng6',
        '15. Bg3 Bd6 16. a4 Bxg3 17. hxg3 Bd7 18. Rfc1 Qf6 19. b5 axb5 20. axb5 Rec8',
        '21. Qc2 Qd8 22. bxc6 Rxc6 23. Rc5 Rxc5 24. dxc5 Ra5 25. Qb2 Qa8 26. Qb6 Nf8',
        '27. Ne5 Ra1 28. Rb1 Rxb1+ 29. Bxb1 Be6 30. Kh2 Nd7 31. Nxd7 Bxd7 32. Qc7 Qc8',
        '33. Qxc8+ Bxc8 34. Ba2 Be6 35. Kg1 Kf8 36. Kf1 Ke7 37. Ke2 Kf6 38. Kd3 Ke5',
        '39. g4 g5 40. g3 Bxg4 41. f4+ gxf4 42. gxf4+ Kf6 43. Bxd5 Bc8 44. Bf3 Ke7',
        '45. Kc4 Kd8 46. Kd5 b6 47. c6 Kc7 48. Ke5 Be6 49. f5 Bb3 50. Kf6 b5 51. Kg7',
        'b4 52. Kxh7 Bc2 53. Kg7 b3 54. Bd5 b2 55. Ba2 Kxc6 56. f6 Kd6 57. e4 Bxe4',
        '58. Kxf7 Bd5+ 59. Bxd5 b1=Q 60. Kg7 Qg1+ 61. Kf8 Kxd5 0-1',
      ].join('\n'),
    },
  ];
});
