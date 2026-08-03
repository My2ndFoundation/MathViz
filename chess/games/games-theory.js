/* 棋谱分组：理论转折。★ 编辑源之一。
   一组一个文件，因为 30 局的双语文案要在并行的 worktree 上写——写进同一个
   文件必然在合并时冲突，而冲突的是大段散文，最难 review。每一局仍然只有
   一处编辑源。数据契约见 docs/superpowers/plans/2026-08-02-chess-phase2-game-replay.md。
   零依赖；node 与浏览器双用。运行时被内联进 tools/chess-game-replay.html。

   这一组的共同点不是「下得好看」，而是「改变了人们对棋的理解方式」：
   雷蒂那局是超现代主义第一次在棋盘上（而不是论文里）打败一位在位世界冠军；
   卡帕布兰卡–马歇尔是「准备好的理论」第一次撞上「当场从零计算」。 */
(function (root, factory) {
  const list = factory();
  if (typeof module === 'object' && module.exports) module.exports = list;
  else {
    root.ChessGamesParts = root.ChessGamesParts || {};
    root.ChessGamesParts.theory = list;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    {
      id: 'reti-capablanca-1924',
      group: 'theory',
      tags: ['opening-theory', 'positional'],
      difficulty: 2,
      source: 'https://www.chessgames.com/perl/chessgame?gid=1102101',
      story: {
        en: 'By March 1924, José Raúl Capablanca had gone eight years without losing a single tournament game. He held the world championship and, to most players of the day, his style barely looked like a style at all — he simply occupied good squares and the position resolved itself. Richard Réti, an Austrian theorist who had spent recent years arguing that the center did not need to be occupied, only controlled from a distance, sat down across from him in round five of the New York 1924 tournament.\n\nRéti opened with the move that would later carry his name, 1.Nf3, sending pieces toward the edges of the board while Capablanca built exactly the kind of classical pawn center his generation had been taught to want. For the first fifteen moves nothing looked wrong for Black. Then the center that had looked so solid turned out to be a target: Réti\'s pieces, aimed at it from the flanks, picked it apart while Black\'s own pieces got in each other\'s way trying to defend it.\n\nCapablanca resigned on move 31 with his queen out of good squares. It was the first time hypermodernism — the school Réti had named and written a book about the year before — had beaten a reigning world champion at the board rather than in an essay. The result stunned the chess world, and the game is still the standard answer to the question of what "control the center" actually means as opposed to "occupy it".',
        zh: '1924 年 3 月，何塞·劳尔·卡帕布兰卡已经整整八年没有在比赛里输过一局棋。他是在位的世界冠军，而在当时多数棋手眼中，他的风格几乎不像一种风格——他只是占住好的格子，局面就自己解开了。里夏德·雷蒂，一位近年一直主张「中心不必占据、只需从远处控制」的奥地利理论家，在纽约 1924 赛事第五轮坐到了他对面。\n\n雷蒂用后来以他名字命名的开局 1.Nf3 开局，把子力调向棋盘两翼，而卡帕布兰卡按上一代棋手被教导要追求的方式，建起了一个典型的古典兵形中心。前十五步，黑方看起来毫无问题。可那个看起来无比坚固的中心后来变成了靶子：雷蒂从两翼瞄准它的子力把它拆解开，黑方自己的棋子反而在防守时相互挡道。\n\n卡帕布兰卡在第 31 步认输，此时他的后已无处可去。这是超现代主义 hypermodernism——雷蒂自己在前一年出版的著作里为这套理论起的名字——第一次不是在文章里、而是真的在棋盘上打败一位在位世界冠军。这个结果震动了整个棋界，直到今天，这盘棋仍是解释「控制中心」与「占据中心」两者区别的标准范例。',
      },
      why: {
        en: 'Réti ended Capablanca\'s eight-year unbeaten run — the first time hypermodern theory beat a world champion on the board, not on paper.',
        zh: '雷蒂终结卡帕布兰卡八年不败——超现代主义第一次真正在棋盘上、而非论文里，击败在位世界冠军。',
      },
      keyMoves: [
        { ply: 1, san: 'Nf3', note: {
          en: '1.Nf3 is Réti\'s own opening: develop toward the flanks and leave the center alone for now. It looks passive; it is the whole hypermodern proposition compressed into one move.',
          zh: '1.Nf3 就是雷蒂自己的开局：先把子力调向两翼，暂时不去碰中心。看上去很被动，其实超现代主义 hypermodernism 这套理论的全部主张都浓缩在这一步里。' } },
        { ply: 18, san: 'e5', note: {
          en: '9…e5 is Capablanca doing exactly what classical theory told a strong player to do: stake out the center with pawns. Hypermodern theory\'s whole bet was that this same center would later become something to attack, not something to fear.',
          zh: '9…e5 是卡帕布兰卡照古典理论该做的事：用兵占住中心。而超现代主义的整套赌注就是，这同一个中心日后会变成进攻目标，而不是让对手忌惮的资产。' } },
        { ply: 31, san: 'd4', note: {
          en: '16.d4 is Réti finally engaging the center he had spent fifteen moves not occupying — not to hold that square, but to prise the whole structure open from a distance.',
          zh: '16.d4 是雷蒂终于对那个他十五步都没去占据的中心动手——目的不是守住这一格，而是从远处把整个结构撬开。' } },
        { ply: 45, san: 'Rxd6', note: {
          en: '23.Rxd6 sends a rook deep into Black\'s camp for a pawn while Capablanca\'s queen and rook get tangled trying to hold together what is left of the center.',
          zh: '23.Rxd6 用一个车换掉一个兵，深入黑方阵地，而卡帕布兰卡的后与车却在为剩下的中心互相纠缠，疲于招架。' } },
        { ply: 57, san: 'Nc6', note: {
          en: '29.Nc6 attacks the rook on a7, forcing it to move again while the black queen still has nowhere good to go.',
          zh: '29.Nc6 直接威胁 a7 车，逼它再次挪动，而黑后此时依然无处可去。' } },
        { ply: 61, san: 'R1d5', note: {
          en: '31.R1d5 is the move commentators point to when they say the black queen was trapped: every square left for her loses more material than staying does, and Capablanca resigned rather than watch it play out.',
          zh: '31.R1d5 就是评论者说黑后「被困」时所指的那一步：留给她的每一格都比不动损失更多子力，卡帕布兰卡就此认输，没有再看下去。' } },
      ],
      /* 来源：chessgames.com gid=1102101，标签对里的比赛日期取自同一页面。
         棋谱本身经 node -e parsePGN 逐步重放验证，61 个半步，1-0，末局面 status 'ongoing'
         （黑方认输，不是被将死——故事文案里也没有写「将死」）。 */
      pgn: [
        '[Event "New York 1924"]',
        '[Site "New York, NY USA"]',
        '[Date "1924.03.22"]',
        '[Round "5"]',
        '[White "Richard Reti"]',
        '[Black "Jose Raul Capablanca"]',
        '[Result "1-0"]',
        '',
        '1. Nf3 Nf6 2. c4 g6 3. b4 Bg7 4. Bb2 O-O 5. g3 b6 6. Bg2 Bb7 7. O-O d6 8. d3 Nbd7 9. Nbd2 e5 10. Qc2 Re8 11. Rfd1 a5 12. a3 h6 13. Nf1 c5 14. b5 Nf8 15. e3 Qc7 16. d4 Be4 17. Qc3 exd4 18. exd4 N6d7 19. Qd2 cxd4 20. Bxd4 Qxc4 21. Bxg7 Kxg7 22. Qb2+ Kg8 23. Rxd6 Qc5 24. Rad1 Ra7 25. Ne3 Qh5 26. Nd4 Bxg2 27. Kxg2 Qe5 28. Nc4 Qc5 29. Nc6 Rc7 30. Ne3 Ne5 31. R1d5 1-0',
      ].join('\n'),
    },
    {
      id: 'botvinnik-capablanca-1938',
      group: 'theory',
      tags: ['sacrifice', 'attack'],
      difficulty: 3,
      source: 'https://www.chessgames.com/perl/chessgame?gid=1031957',
      story: {
        en: 'By the time Mikhail Botvinnik faced José Raúl Capablanca in the last round of the 1938 AVRO tournament in Rotterdam, Capablanca was fifty years old and past his best years as world champion, while Botvinnik was the leading edge of a new, Soviet school of chess that studied positions with the rigor of an engineering problem. AVRO was effectively a candidates\' tournament for the next world championship match, and this game mattered for both men\'s standing in it.\n\nBotvinnik spent the middlegame building a slow attack on Capablanca\'s king, prising open the kingside pawns and pushing a rook and knight into the assault. On move 30 he played a bishop to a3 — a square where Capablanca\'s queen could simply take it. Capablanca did take it, but the point of the move was never really the bishop: with the queen dragged away from e7, it could no longer come back to blockade White\'s advancing e-pawn, and that pawn became impossible to stop.\n\nBotvinnik then forced Capablanca\'s king into the open with a knight sacrifice, chased it across the board with checks, and queened the e-pawn while Capablanca\'s own counterattack arrived one tempo too late. Capablanca resigned rather than be mated. Botvinnik himself called it the best game he ever played, and it is still taught as one of the cleanest examples of a plan that looks like an attack on the king but is really an attack on a single defensive resource.',
        zh: '1938 年 AVRO 赛事末轮，米哈伊尔·博特维尼克在鹿特丹对阵何塞·劳尔·卡帕布兰卡时，卡帕布兰卡已经五十岁，早过了他作为世界冠军的巅峰期；而博特维尼克代表的是苏联棋派新一代——用做工程题的严谨态度去研究局面。AVRO 本身实质上是下一届世界冠军挑战赛的候选人赛，这局棋对两人各自的名次都有分量。\n\n博特维尼克在中局花了很长时间慢慢向卡帕布兰卡的王发起进攻，撬开王翼兵形，把车和马都送进攻势里。第 30 步他走了象到 a3——这一格卡帕布兰卡的后本可以直接吃掉。卡帕布兰卡确实吃了，但这步棋的用意从来不在这个象本身：一旦后被引离 e7，它就再也回不去挡住白方那颗正在推进的 e 兵，这颗兵从此再也拦不住了。\n\n接着博特维尼克用弃马 knight sacrifice 把卡帕布兰卡的王逼到开阔地带，一路将军把它赶过半个棋盘，同时把 e 兵推上底线成后，而卡帕布兰卡自己的反击慢了一步，没能赶上。卡帕布兰卡选择认输，而不是等着被将死。博特维尼克本人称这是他下过最好的一局棋，至今它仍被当作「表面在攻王、实际在拔掉对方唯一防守资源」这种计划最干净的教学范例。',
      },
      why: {
        en: '30.Ba3 offers a bishop, but its real target is the queen\'s ability to ever defend against the passed e-pawn.',
        zh: '30.Ba3 表面送出一象，真正目标是让黑后再也无法回防那颗步步推进的 e 兵。',
      },
      keyMoves: [
        { ply: 10, san: 'Bxc3+', note: {
          en: '5…Bxc3+ voluntarily doubles White\'s own pawns on the c-file. It looks like a minor concession from Black, and it is — the real weight of the game arrives forty-plus moves later.',
          zh: '5…Bxc3+ 主动把白方的兵在 c 线叠成双兵。这看起来只是黑方的一点小让步，事实也确实如此——这局棋真正的分量要在四十多步之后才显现。' } },
        { ply: 38, san: 'Qxa4', note: {
          en: '19…Qxa4 grabs a pawn far from both kings while Botvinnik is already building toward the kingside — a reminder that material and safety are not the same currency.',
          zh: '19…Qxa4 在双方王翼战事之外吃掉一个远方的兵，而博特维尼克此时已经在向王翼构筑进攻——提醒人们，多吃一个兵和局面安全从来不是同一回事。' } },
        { ply: 47, san: 'f5', note: {
          en: '24.f5 is Botvinnik giving up a second pawn to keep Black\'s kingside pried open — the attack, not the material count, is what the move is buying.',
          zh: '24.f5 是博特维尼克再送出一个兵，为的是把黑方王翼继续撬开——这一步买的是进攻，不是子力上的得失。' } },
        { ply: 59, san: 'Ba3', note: {
          en: '30.Ba3!! is the move Botvinnik is remembered for: it offers a bishop, but its real job is to cut the black queen off from e7, the one square she needs to come back and stop the e-pawn.',
          zh: '30.Ba3!! 弃象 bishop sacrifice 就是博特维尼克因这局棋被人记住的一步：它送出一个象，真正的作用是切断黑后回到 e7——那颗正在推进的 e 兵唯一能被挡住的格子。' } },
        { ply: 62, san: 'gxh5', note: {
          en: '31…gxh5 is forced open by Botvinnik\'s knight sacrifice — capturing tears open the black king\'s own pawn shield and lets the attack in.',
          zh: '31…gxh5 是被博特维尼克弃马 knight sacrifice 逼出来的一步——这一吃子亲手撕开了黑王自己的兵形屏障，把进攻放了进来。' } },
        { ply: 67, san: 'e7', note: {
          en: '34.e7 is the pawn Botvinnik prepared eight moves earlier at move 30 finally arriving on the seventh rank — it queens next move, and Black has nothing organised in time to stop it.',
          zh: '34.e7 是博特维尼克早在第 30 步就在准备的那颗兵，此刻终于推到第七线——下一步就能成后，而黑方此刻已经来不及组织任何阻拦。' } },
      ],
      /* 来源：chessgames.com gid=1031957。棋谱经 node -e parsePGN 逐步重放验证，
         81 个半步，1-0，末局面 status 'ongoing'（卡帕布兰卡认输，不是被将死）。 */
      pgn: [
        '[Event "AVRO"]',
        '[Site "Rotterdam NED"]',
        '[Date "1938.11.22"]',
        '[Round "11"]',
        '[White "Mikhail Botvinnik"]',
        '[Black "Jose Raul Capablanca"]',
        '[Result "1-0"]',
        '',
        '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 d5 5. a3 Bxc3+ 6. bxc3 c5 7. cxd5 exd5 8. Bd3 O-O 9. Ne2 b6 10. O-O Ba6 11. Bxa6 Nxa6 12. Bb2 Qd7 13. a4 Rfe8 14. Qd3 c4 15. Qc2 Nb8 16. Rae1 Nc6 17. Ng3 Na5 18. f3 Nb3 19. e4 Qxa4 20. e5 Nd7 21. Qf2 g6 22. f4 f5 23. exf6 Nxf6 24. f5 Rxe1 25. Rxe1 Re8 26. Re6 Rxe6 27. fxe6 Kg7 28. Qf4 Qe8 29. Qe5 Qe7 30. Ba3 Qxa3 31. Nh5+ gxh5 32. Qg5+ Kf8 33. Qxf6+ Kg8 34. e7 Qc1+ 35. Kf2 Qc2+ 36. Kg3 Qd3+ 37. Kh4 Qe4+ 38. Kxh5 Qe2+ 39. Kh4 Qe4+ 40. g4 Qe1+ 41. Kh5 1-0',
      ].join('\n'),
    },
    {
      id: 'steinitz-bardeleben-1895',
      group: 'theory',
      tags: ['attack', 'controversy'],
      difficulty: 2,
      source: 'https://www.chessgames.com/perl/chessgame?gid=1132699',
      /* 这局的记谱有两种通行版本：一种到冯·巴德勒本离场为止（本文件用的就是这版，
         49 个半步，25.Rxh7+ 之后黑方再未应手），另一种把斯坦尼茨赛后向观众演示的
         强制杀法接在后面。两种都可用；这里选了前者，因为它就是实际发生在棋盘上的
         对局本身——演示杀法在故事文案里作为叙述提到，但不进 PGN、不进 keyMoves。 */
      story: {
        en: 'Wilhelm Steinitz was fifty-eight years old and had lost the world championship to Emanuel Lasker the year before, but at Hastings 1895 — the strongest tournament yet held — he produced the game most players remember him by. His opponent, Curt von Bardeleben, was a German master and minor nobleman known for a difficult temperament, and the two men had a personal history of friction that made the game\'s ending especially pointed.\n\nFrom move 22, Steinitz threw his rook forward with a series of checks — Rxe7+, Rf7+, Rg7+ — that Bardeleben could not safely stop by capturing, each one driving the black king one square further from help. By move 25, Rxh7+, the black king was walking into a mating net and there was nothing left to try. Rather than sit through the finish, or resign in front of the room, von Bardeleben got up and left the tournament hall without a word, forfeiting on time.\n\nSteinitz never got to play the final move over the board. Once it was clear von Bardeleben was not coming back, he stood up at the demonstration board and walked the spectators through how the attack would have finished, move by move, to applause. It remains one of the few games remembered as much for how it ended off the board as for the combination itself.',
        zh: '威廉·斯坦尼茨此时五十八岁，前一年刚把世界冠军头衔输给了埃马努埃尔·拉斯克，但在黑斯廷斯 1895——当时史上阵容最强的一届赛事——他下出了后人记住他的那一局棋。对手库尔特·冯·巴德勒本是一位德国大师，也是小贵族出身，以脾气难处闻名，两人此前的私人恩怨让这局棋的收尾格外刺眼。\n\n从第 22 步起，斯坦尼茨把车一路推向前场连续将军——Rxe7+、Rf7+、Rg7+——冯·巴德勒本没有一步可以安全吃掉进攻的车，每一步都把黑王往孤立无援的方向再逼一格。到第 25 步 Rxh7+，黑王已经在走进一张杀网，再也没有别的办法可试。冯·巴德勒本没有坐下来看完结局，也没有当着满屋子人认输，而是一言不发地起身离开赛场，任由自己的钟走完时间判负。\n\n斯坦尼茨没能在棋盘上亲手走出最后一步。等确认冯·巴德勒本不会回来后，他站到演示棋盘前，把这套攻势原本会怎样收官，一步一步讲给在场观众听，赢得掌声。这局棋至今仍是少数因棋盘之外的收场而与棋局本身同样被人记住的对局之一。',
      },
      why: {
        en: 'Steinitz\'s king hunt was so clearly winning that von Bardeleben walked out rather than watch it finish, or resign.',
        zh: '斯坦尼茨的杀王攻势明显必胜，冯·巴德勒本选择直接离场，既不看完结局，也不认输。',
      },
      keyMoves: [
        { ply: 33, san: 'd5', note: {
          en: '17.d5 forces the position open just as Black\'s pieces are still tangled defending — the moment Steinitz\'s attack stops being theoretical and starts being forced.',
          zh: '17.d5 在黑方棋子仍纠缠于防守时强行打开局面——从这一步起，斯坦尼茨的进攻不再只是理论上的可能，而是变得势在必行。' } },
        { ply: 37, san: 'Ne6', note: {
          en: '19.Ne6 plants a knight in the middle of Black\'s camp. It can technically be captured, but every way of taking it opens Black\'s position further — so Bardeleben leaves it alone, and it becomes the anchor the rest of the attack builds on.',
          zh: '19.Ne6 把一个马钉进黑方阵地中心。理论上还能被吃掉，但任何一种吃法都会把黑方局面拆得更开——于是冯·巴德勒本没有去碰它，这个马就此成了后续整套攻势的支点。' } },
        { ply: 43, san: 'Rxe7+', note: {
          en: '22.Rxe7+ gives up a rook for a pawn, but it is not really a sacrifice: taking it walks straight into a mating attack, so Bardeleben has to move his king instead, and the rook keeps making the same threat move after move.',
          zh: '22.Rxe7+ 用车换了一个兵，但这算不上真正的弃子：吃掉这个车会直接走进杀局，所以冯·巴德勒本只能选择动王，而这个车接下来还会不断重复同样的威胁。' } },
        { ply: 45, san: 'Rf7+', note: {
          en: '23.Rf7+ still cannot be captured safely either — Steinitz keeps offering the same rook, and Black keeps being unable to accept.',
          zh: '23.Rf7+ 同样不能安全吃掉——斯坦尼茨反复送出同一个车，而黑方一次又一次地不敢应手。' } },
        { ply: 49, san: 'Rxh7+', note: {
          en: '25.Rxh7+ is where Bardeleben stopped. The queen can technically still take the rook and the king still has one square, but nothing saves the position — he got up and walked out instead of playing on.',
          zh: '25.Rxh7+ 就是冯·巴德勒本停下的地方。这时黑后理论上还能吃掉这个车，王也还有一格可走，但没有任何一步能挽救局面——他起身离场，没有再走下去。' } },
      ],
      /* 来源：chessgames.com gid=1132699，与 Edward Winter（chesshistory.com）对这局
         棋前 25 步记谱的复核一致。经 node -e parsePGN 逐步重放验证，49 个半步，1-0，
         末局面 status 'check'（黑方尚未应 25.Rxh7+ 就已离场判负）。 */
      pgn: [
        '[Event "Hastings"]',
        '[Site "Hastings ENG"]',
        '[Date "1895.08.15"]',
        '[Round "10"]',
        '[White "Wilhelm Steinitz"]',
        '[Black "Curt von Bardeleben"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 d5 8. exd5 Nxd5 9. O-O Be6 10. Bg5 Be7 11. Bxd5 Bxd5 12. Nxd5 Qxd5 13. Bxe7 Nxe7 14. Re1 f6 15. Qe2 Qd7 16. Rac1 c6 17. d5 cxd5 18. Nd4 Kf7 19. Ne6 Rhc8 20. Qg4 g6 21. Ng5+ Ke8 22. Rxe7+ Kf8 23. Rf7+ Kg8 24. Rg7+ Kh8 25. Rxh7+ 1-0',
      ].join('\n'),
    },
    {
      id: 'kasparov-topalov-1999',
      group: 'theory',
      tags: ['sacrifice', 'attack'],
      difficulty: 3,
      source: 'https://www.chessgames.com/perl/chessgame?gid=1011478',
      story: {
        en: 'By 1999 Garry Kasparov had been the world\'s top-rated player for over a decade and had a reputation for preparing enormous amounts of concrete calculation at home. Veselin Topalov, in his mid-twenties, was one of the strongest players of the next generation. Their game in round four of the Wijk aan Zee tournament that January is still regularly voted the greatest chess game ever played, not because of any prize at stake, but because of what Kasparov did over the following twenty moves.\n\nOn move 24 Kasparov gave up a rook for a pawn with Rxd4, and instead of consolidating, he marched his own king out from behind its pawns and into the open board, using it as an active piece in the middle of a mating attack while Topalov\'s king was hunted the other way. Both kings spent much of the next fifteen moves under fire at the same time, a situation strong players are trained their whole careers to avoid, not walk into on purpose.\n\nKasparov later said he had calculated deep into the position before committing to the sacrifice — this was not an improvisation under pressure but a plan carried out close to the end. Topalov resigned on move 44 facing an unstoppable attack. The game is taught less for the final mating pattern than for what it shows about how far modern calculation can be trusted over instinct once a player is sure of the arithmetic.',
        zh: '到 1999 年，加里·卡斯帕罗夫已经连续十多年占据世界等级分第一，以在家中做大量具体计算准备而闻名。维塞林·托帕洛夫当时二十多岁，是新一代最强棋手之一。他们在那年一月维克安泽赛事第四轮下出的这局棋，至今仍经常被评为「史上最伟大的一局棋」——不是因为奖金，而是因为卡斯帕罗夫在接下来二十步里做的事。\n\n第 24 步，卡斯帕罗夫用车换了一个兵，走出 Rxd4；接下来他没有巩固局面，反而把自己的王从兵形后面带出来，走进开阔的棋盘中央，把王当成一个进攻子力使用，同时托帕洛夫的王被追杀向另一个方向。接下来十五步左右，双方的王同时都暴露在火力之下——这正是强棋手一辈子训练要避免、而不是主动走进去的局面。\n\n卡斯帕罗夫后来说，他在下出这步弃子之前就已经把局面算得很深——这不是临场压力下的即兴发挥，而是一套几乎算到底的计划。托帕洛夫在第 44 步认输，面对的是一场无法阻止的攻势。这局棋被拿来当教材，与其说是因为最后的杀法，不如说是因为它示范了：一旦棋手确信自己的计算无误，现代国际象棋的具体计算可以在多大程度上压过直觉。',
      },
      why: {
        en: 'Kasparov sacrificed a rook on move 24 and marched his own king into the open, having calculated the attack before he played it.',
        zh: '卡斯帕罗夫第 24 步弃车，主动把自己的王带进开阔地带——整套攻势是他事先算好才走出的。',
      },
      keyMoves: [
        { ply: 47, san: 'Rxd4', note: {
          en: '24.Rxd4 is the exchange sacrifice everything else in the game follows from: a rook for a pawn, in exchange for keeping Black\'s king permanently under fire.',
          zh: '24.Rxd4 用车换一个兵，是全局后面每一步的起点：换来的是让黑王一直处在炮火之下。' } },
        { ply: 49, san: 'Re7+', note: {
          en: '25.Re7+ keeps the attack running the move right after the sacrifice — Kasparov never lets Topalov\'s king find a quiet square to hide on.',
          zh: '25.Re7+ 在弃子的下一步立刻延续攻势——卡斯帕罗夫从未给托帕洛夫的王留出一格安身之地。' } },
        { ply: 57, san: 'Ra7', note: {
          en: '29.Ra7 attacks the bishop tucked away on a8; Topalov moves it to b7, and Kasparov\'s rook takes it there anyway one move later — the pieces Black spent the whole game defending keep falling regardless.',
          zh: '29.Ra7 直接威胁躲在 a8 的黑象；托帕洛夫把它挪到 b7，但卡斯帕罗夫的车下一步照样在 b7 吃掉它——托帕洛夫整局都在守护的子力，还是一件件丢掉。' } },
        { ply: 61, san: 'Qxf6', note: {
          en: '31.Qxf6 wins another piece while both kings are still exposed in the center — material and king safety keep being won in the same move here, not traded against each other.',
          zh: '31.Qxf6 在双方王都还暴露在中心的情况下再吃掉一子——这局棋里，子力与王的安全常常是同一步棋一起赢来的，而不是互相牺牲的关系。' } },
        { ply: 71, san: 'Bf1', note: {
          en: '36.Bf1 is a quiet developing move in the middle of twenty forcing moves — Kasparov takes one tempo to bring his last idle piece into the attack instead of giving another check, because the position lets him.',
          zh: '36.Bf1 是二十多步连续强制着法中间难得的一步安静出子——卡斯帕罗夫用这一手把自己最后一个闲置的子力调进攻势，而不是继续将军，因为局面允许他这样做。' } },
        { ply: 77, san: 'Qxh8', note: {
          en: '39.Qxh8 finally collects the rook Kasparov had been leaving alone while other threats mattered more — by now Topalov\'s position cannot hold regardless of what he does with his last pieces.',
          zh: '39.Qxh8 终于吃掉了卡斯帕罗夫此前几步一直没空去拿的那个车——此时托帕洛夫的局面已经无论他怎么走剩下的子力都撑不住了。' } },
      ],
      /* 来源：chessgames.com gid=1011478（页面标题即「Kasparov's Immortal」）。
         棋谱经 node -e parsePGN 逐步重放验证，87 个半步，1-0，末局面 status 'ongoing'
         （托帕洛夫认输，不是被将死）。 */
      pgn: [
        '[Event "Hoogovens"]',
        '[Site "Wijk aan Zee NED"]',
        '[Date "1999.01.20"]',
        '[Round "4"]',
        '[White "Garry Kasparov"]',
        '[Black "Veselin Topalov"]',
        '[Result "1-0"]',
        '',
        '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0',
      ].join('\n'),
    },
    {
      id: 'capablanca-marshall-1918',
      group: 'theory',
      tags: ['opening-theory', 'defence'],
      difficulty: 2,
      source: 'https://www.chessgames.com/perl/chessgame?gid=1095025',
      story: {
        en: 'On 23 October 1918, Frank Marshall sat down against José Raúl Capablanca at the Manhattan Chess Club with a plan he had kept in reserve, by his own account, for years. Capablanca had beaten him decisively in a world championship challenge match back in 1909, and it is said — though the exact number of years is one of chess history\'s unverified legends — that Marshall had been saving a new idea in the Ruy Lopez specifically to spring on Capablanca whenever they next met.\n\nThe idea was 8…d5, a pawn sacrifice now known as the Marshall Attack: Black gives up a pawn to rip open the center and kingside for a fast attack on White\'s king, betting that the initiative is worth more than the material. Capablanca had never faced this exact position before, and there was no time to prepare for it — he had to work it out over the board, calculating his way through an attack designed specifically to beat him.\n\nHe found the defence. Capablanca gave back some of the material at the right moments, kept his king safe, and eventually turned the game around to win by move 38. The theoretical novelty Marshall had prepared for years lost on its very first outing, and yet the opening itself outlived that result completely: the Marshall Attack is still a main-line answer to the Ruy Lopez today, played by grandmasters who have never had to work it out live at the board the way Capablanca did.',
        zh: '1918 年 10 月 23 日，弗兰克·马歇尔在曼哈顿棋艺俱乐部对阵何塞·劳尔·卡帕布兰卡，手里握着一个据他自己说已经准备了多年的计划。卡帕布兰卡曾在 1909 年的世界冠军挑战赛上大比分击败过他；据说——具体准备了几年，是棋史上一个没有确凿证据的传闻——马歇尔一直把西班牙开局里的一个新变例留着，专等再遇上卡帕布兰卡时拿出来用。\n\n这个想法就是 8…d5，如今被称为「马歇尔攻击 Marshall Attack」：黑方弃一个兵，撬开中心与王翼，换取对白王的快速攻势，赌的是主动权比这一个兵更值钱。卡帕布兰卡此前从未在实战里面对过这个具体局面，也没有时间准备——他必须当场从零开始计算，一步步拆解这套专门为打败他而设计的攻势。\n\n他找到了防守办法。卡帕布兰卡在关键时刻把部分子力还回去，保住王的安全，最终在第 38 步逆转获胜。马歇尔准备了多年的理论新变，首次亮相就输了——但这个开局本身完全没有因为这一次失败而消失：马歇尔攻击至今仍是应对西班牙开局的一条主流变化，被无数从未像卡帕布兰卡那样当场现算过的大师们反复使用。',
      },
      why: {
        en: 'Marshall unveiled a prepared novelty designed to beat Capablanca; Capablanca calculated the refutation live and still won.',
        zh: '马歇尔亮出一手专门为打败卡帕布兰卡准备的新变，卡帕布兰卡当场现算出破解方法并最终获胜。',
      },
      keyMoves: [
        { ply: 16, san: 'd5', note: {
          en: '8…d5 is Marshall\'s prepared idea arriving on the board: a pawn sacrifice offered specifically to open lines toward the white king rather than to win anything back materially.',
          zh: '8…d5 就是马歇尔准备好的想法正式登场：这个弃兵不是为了换回什么，而是专门为了向白王方向打开线路。' } },
        { ply: 29, san: 'd4', note: {
          en: '15.d4 is Capablanca returning to a solid central structure rather than grabbing every pawn on offer — defence here means giving material back to stay safe, not refusing to give any up.',
          zh: '15.d4 是卡帕布兰卡选择巩固中心结构，而不是贪吃对方送出的每一个兵——这里的防守意味着为了安全适度让出子力，而不是一分不让。' } },
        { ply: 37, san: 'Rxf2', note: {
          en: '19.Rxf2 gives back the exchange at exactly the moment it defuses Black\'s strongest threat — Capablanca\'s calculation shows in what he chooses to give up, not just in what he keeps.',
          zh: '19.Rxf2 在恰好能化解黑方最大威胁的那一刻还回一个车——卡帕布兰卡的计算能力，体现在他选择放弃什么，而不只是守住什么。' } },
        { ply: 39, san: 'Ke2', note: {
          en: '20.Ke2 walks the white king out from behind its own pieces while still under attack, because Capablanca has calculated that the open squares are actually safer than staying put.',
          zh: '20.Ke2 让白王在仍受攻击的情况下走出己方棋子后方——因为卡帕布兰卡算清楚了，此刻走到开阔格子反而比原地不动更安全。' } },
        { ply: 51, san: 'Bd5', note: {
          en: '26.Bd5 centralises the bishop right where it blocks Black\'s checks along the back rank, while also eyeing squares near Black\'s own king — the position has flipped from Capablanca defending to Capablanca attacking.',
          zh: '26.Bd5 把象走到正好挡住黑方后翼将军路线的格子，同时也瞄向黑王附近——局面到此已经从卡帕布兰卡防守，翻转成卡帕布兰卡进攻。' } },
        { ply: 73, san: 'b8=Q+', note: {
          en: '37.b8=Q+ is where Capablanca\'s earlier accuracy pays off in full: an extra queen, arriving with check, from a pawn Marshall\'s attack never had time to stop.',
          zh: '37.b8=Q+ 是卡帕布兰卡之前每一步精确防守的回报兑现：多出一个后，还带将军——而这颗兵，正是马歇尔的进攻从头到尾都没能腾出手去阻止的。' } },
      ],
      /* 来源：chessgames.com gid=1095025。棋谱经 node -e parsePGN 逐步重放验证，
         75 个半步，1-0，末局面 status 'check'（黑方认输，不是被将死）。
         「马歇尔为此准备了多年」是流传的说法（各来源给出的年数不一致，
         多引 1909 年负于卡帕布兰卡到 1918 年这局，约九年），故事里写成
         「据说」，不写具体年数。 */
      pgn: [
        '[Event "Manhattan Chess Club Masters"]',
        '[Site "New York, NY USA"]',
        '[Date "1918.10.23"]',
        '[Round "1"]',
        '[White "Jose Raul Capablanca"]',
        '[Black "Frank James Marshall"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 Nf6 12. Re1 Bd6 13. h3 Ng4 14. Qf3 Qh4 15. d4 Nxf2 16. Re2 Bg4 17. hxg4 Bh2+ 18. Kf1 Bg3 19. Rxf2 Qh1+ 20. Ke2 Bxf2 21. Bd2 Bh4 22. Qh3 Rae8+ 23. Kd3 Qf1+ 24. Kc2 Bf2 25. Qf3 Qg1 26. Bd5 c5 27. dxc5 Bxc5 28. b4 Bd6 29. a4 a5 30. axb5 axb4 31. Ra6 bxc3 32. Nxc3 Bb4 33. b6 Bxc3 34. Bxc3 h6 35. b7 Re3 36. Bxf7+ Rxf7 37. b8=Q+ Kh7 38. Rxh6+ 1-0',
      ].join('\n'),
    },
  ];
});
