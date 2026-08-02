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
    {
      id: 'anderssen-kieseritzky-1851',
      group: 'romantic',
      tags: ['romantic', 'sacrifice', 'attack'],
      difficulty: 2,
      source: 'https://en.wikipedia.org/wiki/Immortal_Game',
      story: {
        en: 'Adolf Anderssen played this game in London in 1851, during a break in the world\'s first international chess tournament. It counted for nothing on the scoreboard — no prize, no round number — which is likely part of why he let himself take the risks that made it famous, against a strong touring player and chess teacher, Lionel Kieseritzky.\n\nOver the course of the game White gives up both rooks and, on move 22, the queen itself, keeping only a bishop and two knights for the final attack. When the mate lands, Kieseritzky\'s own queen and both rooks are still sitting on the board, and a bishop that never left its starting square on c8 even blocks one of his own king\'s escape squares.\n\nAn Austrian chess magazine gave it the name "The Immortal Game" two decades later, and it became the calling card of what historians now call the Romantic era of chess — a style that prized a forcing, beautiful attack over material count. It remains the game most commonly used to make one specific point stick: checkmate ends the game, not the pieces still sitting on the board.',
        zh: '1851年，安德森在伦敦下出这一局——当时正值史上第一届国际象棋国际赛的间歇，这局棋不计入任何赛程，没有名次，也没有奖金。对手是巡回强手兼国际象棋教师凯泽利茨基（Lionel Kieseritzky）。也许正因为无关胜负，安德森才敢下出后来让这局棋出名的那些冒险。\n\n整局棋里，白方先后弃掉两个车，又在第22步弃掉后本身，收官时手上只剩一象二马。将死降临的那一刻，黑方的后和两个车竟然都还留在棋盘上；一个从未挪动过、还停在原始格 c8 的象，甚至正好挡住了自己王的一条逃跑路线。\n\n二十年后，一本奥地利棋刊给它取名「不朽局」，它从此成了后人所说的「浪漫时代」的招牌：那是一种把强攻的美感看得比子力得失更重的风格。直到今天，它仍是讲清楚一件事最常用的例子——终结棋局的是将死，不是桌上剩下多少子。',
      },
      why: {
        en: 'White sacrifices both rooks and the queen, then mates with just a bishop and two knights while most of Black\'s army sits untouched.',
        zh: '弃双车与后，最终仅靠一象二马将死，黑方大半子力仍原封未动。',
      },
      keyMoves: [
        { ply: 3, san: 'f4', note: {
          en: '2.f4 is the King\'s Gambit: on only his second move White offers a pawn to rip open the f-file for a fast attack — the whole game\'s logic compressed into one move.',
          zh: '2.f4 是王翼弃兵开局：白方只走了两步就主动送出一兵，撬开 f 线换取进攻速度——整局棋的逻辑都压缩在这一步里。' } },
        { ply: 35, san: 'Bd6', note: {
          en: '18.Bd6 develops with total calm even though Black could simply grab the rook on g1 next move. Anderssen lets the exchange happen — the bishop\'s real job is sealing off the squares around Black\'s king.',
          zh: '18.Bd6 走得异常沉着——尽管黑方下一步就能白吃 g1 的车。安德森由它去：这个象真正的任务是封死黑王周围的格子，不是保车。' } },
        { ply: 38, san: 'Qxa1+', note: {
          en: '19...Qxa1+ grabs the second rook with check. Black is now up a queen\'s worth of material and feels he is winning — he has no idea his own queen has wandered too far from the king to ever come back and defend it.',
          zh: '19...Qxa1+ 带将吃掉第二个车。黑方此刻子力上占了大便宜，感觉稳操胜券——却没意识到自己的后已经游离得太远，再也赶不回来保护自己的王。' } },
        { ply: 43, san: 'Qf6+', note: {
          en: '22.Qf6+!! is the point of the whole combination: White throws away the queen itself, since the only legal reply, ...Nxf6, plugs the one square that could otherwise let Black\'s king run.',
          zh: '22.Qf6+!! 是整套组合的核心：白方连后都舍得扔，因为黑方唯一的合法应着 ...Nxf6 恰好把王唯一能逃的那格给堵死了。' } },
        { ply: 45, san: 'Be7#', note: {
          en: '23.Be7# delivers mate with just a bishop and two knights. Kieseritzky\'s queen and both rooks are still on the board, and his own untouched bishop on c8 even blocks one of his king\'s escape squares.',
          zh: '23.Be7# 只靠一象二马完成将杀。此时凯泽利茨基的后和两个车都还留在棋盘上，而他那枚从未挪动过的 c8 象，甚至正好挡住了自己王的一条逃生路线。' } },
      ],
      pgn: [
        '[Event "London"]',
        '[Site "London ENG"]',
        '[Date "1851.06.21"]',
        '[Round "-"]',
        '[White "Adolf Anderssen"]',
        '[Black "Lionel Kieseritzky"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5',
        '8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8',
        '15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6',
        '21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0',
      ].join('\n'),
    },
    {
      id: 'anderssen-dufresne-1852',
      group: 'romantic',
      tags: ['romantic', 'sacrifice', 'attack'],
      difficulty: 2,
      source: 'https://en.wikipedia.org/wiki/Evergreen_Game',
      story: {
        en: 'Adolf Anderssen played this casual game a year after the Immortal Game, against Jean Dufresne, a popular chess author living in Berlin who was not in Anderssen\'s class as a player. Even the year is the only certain detail — the earliest record, from a chess magazine in late 1852, gives no further information about where or when it was played. It opens with the Evans Gambit: on move four White simply hands over a second pawn to rip open lines toward Black\'s king before Black has time to develop.\n\nThe finish is the reason the game is remembered. Starting on move 19, White gives up a rook and then the queen — Rxe7+, and two moves later Qxd7+ — to drag Black\'s king out into the open. The mating net that closes around it uses no queen and no rook at all: a bishop on e7 delivers check, a second bishop on d7 seals the only other escape square, and a pawn on f6 seals the last one, while Black\'s own rook and pawn block what would have been his king\'s remaining moves.\n\nThe name came decades later. After Anderssen\'s death, the first world champion, Wilhelm Steinitz, annotated the game and, writing about move 19, Rad1, called it "an evergreen in the laurel crown of the departed chess hero" — the tribute is where the nickname comes from.',
        zh: '安德森在「不朽局」的第二年下了这一局非正式对局，对手是住在柏林的棋书作家杜弗雷斯纳（Jean Dufresne）——论棋力，他远不及安德森。就连年份都是唯一能确定的细节：最早的记录出自1852年下半年的一本棋刊，对局地点和具体日期都没有交代。这局棋以伊文思弃兵开局：第四步白方直接再送一个兵，趁黑方还没来得及出子，就撬开通向黑王的线路。\n\n这局棋被记住，靠的是收官。从第19步起，白方先弃车（Rxe7+），两步之后又弃后（Qxd7+），把黑王硬生生逼到棋盘中央。收网的那一刻，用的既不是后也不是车：e7 的象将军，d7 的另一个象封死唯一的逃跑格，f6 的兵封死最后一格——而黑方自己的车和兵，恰好堵死了黑王本该还能走的那几步。\n\n这个名字是几十年后才有的。安德森去世后，第一位世界冠军斯坦尼茨为这局棋作注，写到第19步 Rad1 时，称它是「已故棋坛英雄桂冠上的一片常青叶」——这句致敬，就是这个绰号的由来。',
      },
      why: {
        en: 'White sacrifices a rook and the queen to force Black\'s king into the open, then mates with two bishops and a pawn.',
        zh: '弃车又弃后逼出黑王，最终仅靠双象一兵完成杀局。',
      },
      keyMoves: [
        { ply: 7, san: 'b4', note: {
          en: '4.b4 is the Evans Gambit: White gives up a second pawn, on top of the one already offered in the main line, purely to open lines and grab time before Black can consolidate.',
          zh: '4.b4 是伊文思弃兵：白方在已经让出一兵的基础上再送一个兵，纯粹为了抢开线、抢时间，不给黑方喘息的机会。' } },
        { ply: 37, san: 'Rad1', note: {
          en: '19.Rad1 is the move Wilhelm Steinitz singled out decades later, calling it "an evergreen in the laurel crown" of Anderssen\'s career — the last piece joins the attack before the sacrifices begin.',
          zh: '19.Rad1 就是后来第一位世界冠军斯坦尼茨特别点出的那步——他称之为「安德森桂冠上的一片常青叶」。这是最后一个子加入进攻，弃子的序幕由此拉开。' } },
        { ply: 39, san: 'Rxe7+', note: {
          en: '20.Rxe7+ is the first sacrifice: a rook for a knight, forcing Black\'s king into the open because the alternative — losing the knight for nothing — is even worse.',
          zh: '20.Rxe7+ 是第一次弃子：车换马，逼黑王被迫暴露在外——因为不吃的话，黑方那个马就白丢了。' } },
        { ply: 41, san: 'Qxd7+', note: {
          en: '21.Qxd7+ throws in the queen as well. Black must capture — any other reply loses the king outright — and the recapture drags his own king one square deeper into the mating net.',
          zh: '21.Qxd7+ 把后也搭了进去。黑方非吃不可——不吃就直接丢王——而这一步应将又把自己的王往这张杀网里再拖进一格。' } },
        { ply: 47, san: 'Bxe7#', note: {
          en: '24.Bxe7# mates with two bishops and a pawn, no queen or rook needed. The bishop on d7 seals e8, the pawn on f6 seals g7, and Black\'s own rook on g8 blocks the last square — his own pieces finish the job Anderssen started.',
          zh: '24.Bxe7# 靠两象一兵完成杀局，用不着后也用不着车。d7 的象封死 e8，f6 的兵封死 g7，黑方自己在 g8 的车又堵死最后一格——安德森起的头，黑方自己的子替他收了尾。' } },
      ],
      pgn: [
        '[Event "Casual game"]',
        '[Site "?"]',
        '[Date "1852.??.??"]',
        '[Round "-"]',
        '[White "Adolf Anderssen"]',
        '[Black "Jean Dufresne"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3',
        '8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6',
        '14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8',
        '19. Rad1 Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8',
        '24. Bxe7# 1-0',
      ].join('\n'),
    },
    {
      id: 'morphy-opera-1858',
      group: 'romantic',
      tags: ['romantic', 'opening-theory', 'sacrifice'],
      difficulty: 1,
      source: 'https://en.wikipedia.org/wiki/Opera_Game',
      story: {
        en: 'Paul Morphy played this game in Paris in late 1858, in a box at the Salle Le Peletier during a performance at the opera — which opera it was is not actually settled; sources suggest either Rossini\'s The Barber of Seville or Bellini\'s Norma, but nobody knows for certain. His opponents were two amateurs playing together as one side, jointly choosing every move: Duke Karl of Brunswick and Count Isouard, while Morphy played alone for White.\n\nIt is over in 17 moves, and nearly every one of them illustrates a rule beginners are taught in their first week: develop pieces toward the centre, don\'t move the same piece twice without a reason, and castle early. By move 12 Morphy has already castled and brought his queen, both bishops and both knights into the game; Black has moved three pieces off the back rank and never castles at all. That gap in development is the entire game.\n\nThat gap is what the sacrifices in the finish are paid for. Morphy trades a rook for a knight, then a bishop for a rook, then throws in the queen itself for nothing, to strip away every piece that could defend the black king until a lone rook delivers mate — with two of Black\'s own pieces, undeveloped since move one, blocking his own king\'s last escape squares. It is one of the most commonly used teaching games in chess precisely because the lesson needs no explanation beyond the moves themselves.',
        zh: '1858年末，摩菲在巴黎的勒佩雷蒂耶剧院一间包厢里下了这局棋，当时正上演着一出歌剧——具体是哪一出并没有定论，有说是罗西尼的《塞维利亚理发师》，也有说是贝里尼的《诺尔玛》，谁也说不准。对手是两位联手指挥黑方的业余棋手——布伦瑞克公爵与伊苏阿尔伯爵，每一步都由他们两人商量决定；白方则由摩菲一人独自执棋。\n\n这局棋只下了17回合，其中几乎每一步都在示范初学者第一周就会学到的规则：出子要奔中心，没有理由不要让同一个子动两次，尽早易位。到第12步，摩菲已经完成王车易位，后、两象、两马全部出动；黑方只把三个子挪出了底线，而且再也没能易位。这个出子速度的差距，就是这局棋的全部内容。\n\n收官的弃子，付的正是这个差距的代价。摩菲先以车换马，又以象换车，最后干脆把后也白白搭进去，一点一点拔掉所有能保护黑王的子，直到单凭一个车完成将杀——而黑方自己那两个从开局起就没动过的子，恰好堵死了自己王最后的逃生格。这局棋之所以被反复拿来当教材，正是因为这个道理不需要额外解释，走法本身就是全部说明。',
      },
      why: {
        en: 'Seventeen moves that show every opening principle at once — development, castling, and a mate delivered by Black\'s own undeveloped pieces.',
        zh: '十七回合演尽开局原则：快速出子、及早易位，最终连将死都由黑方自己未出动的子完成。',
      },
      keyMoves: [
        { ply: 6, san: 'Bg4', note: {
          en: '3...Bg4 pins White\'s knight to the queen — it looks like a strong developing move, but the piece it pins isn\'t really stuck: nothing stops the knight from moving if there\'s a good enough reason.',
          zh: '3...Bg4 把白方的马别在后上——看着是步有力的出子，但这个「别子 pin」并不牢靠：只要有足够好的理由，这个马照样能动。' } },
        { ply: 7, san: 'dxe5', note: {
          en: '4.dxe5 is that reason: White wins the e5 pawn, and if Black recaptures with the bishop, the queen is simply lost — the pin only worked while nobody tested it.',
          zh: '4.dxe5 就是那个理由：白方直接吃掉 e5 兵，黑方要是用象去吃回来，后就直接丢了——这个别子，一试探就破了。' } },
        { ply: 11, san: 'Bc4', note: {
          en: '6.Bc4 puts the bishop on its most active diagonal, eyeing f7, while the queen is already primed to swing to b3 next move — two pieces, two moves, already aiming at the weakest point in Black\'s camp.',
          zh: '6.Bc4 把象摆在最活跃的斜线上，直指 f7，而后下一步就能摆到 b3。两个子、两步棋，已经同时瞄准了黑方阵营里最薄弱的一点。' } },
        { ply: 23, san: 'O-O-O', note: {
          en: '12.O-O-O — by move 12 Morphy has castled and brought his queen, both bishops and both knights into the game. Black has moved three pieces off the back rank and will never castle at all; that gap in development is the entire game.',
          zh: '12.O-O-O——到第12步，摩菲已经完成王车易位，后、两象、两马全部出动。黑方只挪动了三个子离开底线，而且再也没能易位；这个出子速度的差距，就是这局棋的全部内容。' } },
        { ply: 25, san: 'Rxd7', note: {
          en: '13.Rxd7 gives up the exchange, a rook for a knight, to drag Black\'s last active piece off the board and rip open the d-file toward the king that never found safety.',
          zh: '13.Rxd7 主动弃还「车换马」的子力差，目的是拔掉黑方唯一活跃的子、彻底打开通向那个从未安全过的黑王的 d 线。' } },
        { ply: 33, san: 'Rd8#', note: {
          en: '17.Rd8# mates with a single rook. Two of Black\'s own pieces — the bishop still on f8, the pawn still on f7, both undeveloped since move one — block his own king\'s last two escape squares.',
          zh: '17.Rd8# 单凭一个车完成将杀。黑方自己的两个子——从没挪过窝的 f8 象和 f7 兵——正好堵死了自己王最后两条逃生路线。' } },
      ],
      pgn: [
        '[Event "Casual game"]',
        '[Site "Paris FRA"]',
        '[Date "1858.??.??"]',
        '[Round "-"]',
        '[White "Paul Morphy"]',
        '[Black "Duke Karl / Count Isouard"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7',
        '8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7',
        '14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0',
      ].join('\n'),
    },
    {
      id: 'rotlewi-rubinstein-1907',
      group: 'romantic',
      tags: ['romantic', 'sacrifice', 'attack'],
      difficulty: 3,
      source: 'https://en.wikipedia.org/wiki/Rotlewi_versus_Rubinstein',
      story: {
        en: 'Georg Rotlewi and Akiba Rubinstein met in Lodz in December 1907. Rubinstein had learned chess only at fourteen — his family had expected him to become a rabbi — and gave up that path for the game in 1903; by the time of this game he was in the middle of the run of results, roughly 1907 to 1912, that would establish him as one of the strongest players in the world.\n\nThe position looks balanced until move 20, when Rubinstein starts giving pieces away instead of taking them. Over the next five moves he offers his queen, then a rook, then a second rook — 21...Qh4, 22...Rxc3, 23...Rd2 — accepting whichever captures White makes, because every line leads to the same place: White\'s king running out of squares. After 25...Rh3, the threat of ...Rxh2# could not be met; Rotlewi resigned there, down a queen and a rook for two minor pieces on the scoreboard and still completely lost.\n\nHans Kmoch later named it "Rubinstein\'s Immortal," deliberately echoing Anderssen\'s game from half a century earlier. Both are remembered for the same idea carried to an extreme: giving up material not for one clean blow, but for a whole sequence of them, each one narrowing the opposing king\'s options until none are left.',
        zh: '罗特列维与鲁宾斯坦这局棋，下于1907年12月的罗兹。鲁宾斯坦十四岁才学会下棋——家里本来打算让他去当拉比——1903年他放弃了这条路，专攻棋艺；下这局棋时，他正处在大约1907到1912年那段让他跻身世界顶尖高手之列的连胜期中间。\n\n局面在第20回合之前看起来还算均势，直到鲁宾斯坦开始送子而不是吃子。接下来的五步里，他先后送出后、一个车、又一个车——21...Qh4、22...Rxc3、23...Rd2——白方吃哪个都行，因为每条路径最终都通向同一个结局：白王无路可走。25...Rh3 之后，白方已经防不住 ...Rxh2# 的杀棋，罗特列维当场认输——此时他子力上还多出一个后和一个车换两个轻子，却仍然必败无疑。\n\n后来，注解家康莫赫（Hans Kmoch）称它为「鲁宾斯坦不朽局」，故意呼应半个世纪前安德森那局最有名的棋。这两局被人们记住，正是因为同一个理念被推到了极致：弃子不是为了一记漂亮的重拳，而是一整串重拳，每一拳都让对方王的可退空间再少一格，直到无路可退。',
      },
      why: {
        en: 'Rubinstein sacrifices his queen and both rooks in a combination that leaves White\'s king with no squares at all.',
        zh: '鲁宾斯坦弃后又弃双车，一套组合逼得白王无路可走。',
      },
      keyMoves: [
        { ply: 40, san: 'Ng4', note: {
          en: '20...Ng4 is the move that, according to later analysis, already leaves White without a real defence — a single knight hop starts a combination that runs six moves deep.',
          zh: '20...Ng4 据后人分析，此时白方已经没有真正的防御——一步马跳，牵出了一套长达六个回合的组合。' } },
        { ply: 42, san: 'Qh4', note: {
          en: '21...Qh4 brings the queen into the attack with a direct threat against h2, forcing White to react immediately with 22.g3 — and that pawn move is exactly what the coming sacrifices are aimed at.',
          zh: '21...Qh4 把后带入进攻，直接威胁 h2，逼白方立刻应以 22.g3——而接下来的一连串弃子，目标恰恰就是这个刚推出来的兵。' } },
        { ply: 44, san: 'Rxc3', note: {
          en: '22...Rxc3!! sacrifices the rook, and soon the queen too, to pull White\'s queen away from defending the bishop on e4 — a deflection: White must recapture on h4, and by doing so loses control of squares that matter far more than the queen he is about to win.',
          zh: '22...Rxc3!! 弃车（很快连后也搭上）把白方的后从守卫 e4 象的位置上引开——这是典型的「引离」：白方只能在 h4 吃后，可这么一吃，反而丢掉了几个比这个后重要得多的控制点。' } },
        { ply: 46, san: 'Rd2', note: {
          en: '23...Rd2!! is the second rook offered up, landing on a square where it cannot safely be taken and pinning White\'s own queen against the back-rank threats building up behind it.',
          zh: '23...Rd2!! 是第二个被送出的车，落在一个白方吃不起的格子上，同时把白方的后钉死在正在酝酿的底线威胁前面。' } },
        { ply: 48, san: 'Bxe4+', note: {
          en: '24...Bxe4+ recaptures the bishop with check. Black is suddenly down a queen and a rook for only two minor pieces on the scoreboard — yet White\'s king still has nowhere safe to go.',
          zh: '24...Bxe4+ 带将吃回那个象。此刻记分牌上黑方倒亏一后一车换两个轻子——可白方的王依然无处可去。' } },
        { ply: 50, san: 'Rh3', note: {
          en: '25...Rh3 is the final piece joining the attack. The threat of ...Rxh2# cannot be parried, and Rotlewi resigned immediately rather than watch it land.',
          zh: '25...Rh3 是最后一个投入进攻的子。...Rxh2# 的杀棋已经无解，罗特列维当场认输，没有等它真正落下。' } },
      ],
      pgn: [
        '[Event "Lodz"]',
        '[Site "Lodz POL"]',
        '[Date "1907.12.26"]',
        '[Round "-"]',
        '[White "Georg Rotlewi"]',
        '[Black "Akiba Rubinstein"]',
        '[Result "0-1"]',
        '',
        '1. d4 d5 2. Nf3 e6 3. e3 c5 4. c4 Nc6 5. Nc3 Nf6 6. dxc5 Bxc5 7. a3 a6',
        '8. b4 Bd6 9. Bb2 O-O 10. Qd2 Qe7 11. Bd3 dxc4 12. Bxc4 b5 13. Bd3 Rd8',
        '14. Qe2 Bb7 15. O-O Ne5 16. Nxe5 Bxe5 17. f4 Bc7 18. e4 Rac8 19. e5 Bb6+',
        '20. Kh1 Ng4 21. Be4 Qh4 22. g3 Rxc3 23. gxh4 Rd2 24. Qxd2 Bxe4+ 25. Qg2 Rh3 0-1',
      ].join('\n'),
    },
    {
      id: 'legal-saint-brie-1750',
      group: 'romantic',
      tags: ['romantic', 'trap', 'sacrifice'],
      difficulty: 1,
      source: 'https://en.wikipedia.org/wiki/L%C3%A9gal_Trap',
      story: {
        en: 'This is one of the oldest recorded games still played through today, credited to Kermur, Sire de Legal, against an amateur named Saint Brie. It is usually dated to Paris in 1750, though chess historians have questioned that date — some evidence points to the 1780s instead — and even the exact order of moves has been argued over, since the earliest printed version may have been tidied up after the fact to remove a flaw. What has never been in doubt is the idea itself, because it is simple enough to survive centuries of retelling.\n\nBlack pins White\'s knight on f3 to the queen with 3...Bg4 — a natural-looking move that any player might reach for. But a piece pinned to the queen, not the king, is not actually stuck: nothing in the rules stops it from moving, it only risks losing the queen if it does and nothing comes of it. Legal ignores the pin entirely, jumps the knight into e5, and when Saint Brie grabs the "free" queen, a bishop and the same knight combine for checkmate two moves later, with the black king boxed in by its own untouched pieces.\n\nThe trap now carries Legal\'s name and is usually the first lesson a beginner gets in the difference between an absolute pin, against the king, which really cannot move, and a relative one, against anything else, which can — a distinction the rest of a chess education rests on.',
        zh: '这是至今仍被反复摆出的最古老的名局之一，记在勒加尔骑士（Kermur, Sire de Legal）名下，对手是一位业余棋手圣布里（Saint Brie）。它通常被定在1750年的巴黎，但棋史研究者对这个年代提出过质疑——有证据指向1780年代——就连具体的走法顺序也有争议，因为最早刊出的版本可能是事后被「修饰」过的，为了掩盖原局里的一个漏洞。唯一从未被质疑过的是这个构思本身，因为它足够简单，才能被反复讲了两百多年还立得住。\n\n黑方用 3...Bg4 把白方 f3 的马别在后上——这是任何棋手都会下意识走出的一步。但别在后（而不是王）身上的子，并不是真的动不了：规则里没有任何东西禁止它移动，唯一的风险是后可能因此丢掉，而这里根本什么都不会丢。勒加尔干脆无视这个「别子 pin」，把马跳上 e5，圣布里贪吃那个「白送」的后，两步之后，一象一马联手完成将杀——黑王被自己那些原地未动的子堵得无处可去。\n\n这个陷阱如今就以勒加尔的名字命名，通常是初学者接触到「绝对别子（钉在王身上，真的动不了）」与「相对别子（钉在别的子上，其实能动）」这组区别时的第一课——往后学到的很多东西，都建立在这组区别之上。',
      },
      why: {
        en: 'A relative pin, a knight that ignores it, and a queen sacrifice that leads to mate two moves later.',
        zh: '一个相对别子，一个无视它的马，两步之后弃后换来的将死。',
      },
      keyMoves: [
        { ply: 6, san: 'Bg4', note: {
          en: '3...Bg4 pins the knight on f3 to White\'s queen. It looks decisive, but it is only a relative pin — the knight is free to move if White is willing to risk the queen behind it.',
          zh: '3...Bg4 把 f3 的马别在白方的后上，看着很凶，但这只是「别子 pin」的相对版本——只要白方肯冒后被吃的风险，这个马其实能动。' } },
        { ply: 9, san: 'Nxe5', note: {
          en: '5.Nxe5! tests the pin directly: the knight moves anyway, grabbing a pawn and daring Black to take the queen.',
          zh: '5.Nxe5! 直接检验这个别子：马照样动了，顺手吃一个兵，还挑衅似的把后摆在那里让黑方来吃。' } },
        { ply: 10, san: 'Bxd1', note: {
          en: '5...Bxd1?? takes the bait. The queen looks free, but Black has missed what the knight on e5 is about to do to a king still stuck in the centre.',
          zh: '5...Bxd1?? 咬了钩。那个后看着是白送的，但黑方没算到 e5 上那个马接下来要对一个还困在中路的王做什么。' } },
        { ply: 11, san: 'Bxf7+', note: {
          en: '6.Bxf7+ forces the king out into the open — Black has no way to decline the check, since the king cannot stay on e8 with a bishop giving check from f7.',
          zh: '6.Bxf7+ 把王逼出巢穴——这个将军黑方躲不掉，王没法留在 e8 挨着 f7 的象将军。' } },
        { ply: 13, san: 'Nd5#', note: {
          en: '7.Nd5# delivers mate two moves after the "free" queen was taken. The king on e7 has nowhere to go — hemmed in by its own pawns and pieces that never got the chance to help.',
          zh: '7.Nd5# 在那个「白送」的后被吃掉仅仅两步之后完成将杀。e7 上的王无路可走——被自己那些根本还没来得及帮上忙的兵和子堵得死死的。' } },
      ],
      pgn: [
        '[Event "Casual game"]',
        '[Site "Paris FRA"]',
        '[Date "1750.??.??"]',
        '[Round "-"]',
        '[White "Kermur Sire de Legal"]',
        '[Black "Saint Brie"]',
        '[Result "1-0"]',
        '',
        '1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0',
      ].join('\n'),
    },
    {
      id: 'levitsky-marshall-1912',
      group: 'romantic',
      tags: ['romantic', 'sacrifice', 'controversy'],
      difficulty: 3,
      source: 'https://en.wikipedia.org/wiki/Levitsky_versus_Marshall',
      story: {
        en: 'Stepan Levitsky and Frank Marshall played this game at the DSB Congress in Breslau in July 1912, in a tournament of some of the strongest masters in the world. Marshall was one of the best attacking players of his generation, and this game is the one he is most remembered for.\n\nBy move 23 Black has already given up material to rip the position open — a bishop on move 17 — and has a rook and a knight bearing down on White\'s king. Then comes 23...Qg3!!, a move that lands the queen on a square where three different White pieces can capture it: a pawn on f2, a pawn on h2, or the queen on g5. It does not matter which one does; every single reply allows an immediate forced mate. Levitsky saw this and resigned on the spot rather than let any of them happen.\n\nLegend has it that spectators showered the board with gold coins on the spot, awed by the move. The story is older and messier than a clean retelling makes it sound: Marshall\'s own notes from the time say only that "a purse was presented" to him afterward, and other accounts suggest the coins — genuine gold, from Russian, German and Austrian visitors watching the tournament — were bets being paid off rather than a spontaneous ovation. Either way, no one at the board that day denied that coins actually landed on it.',
        zh: '1912年7月，列维茨基与马歇尔在布雷斯劳的德国国际象棋联合会大会上下了这局棋，参赛的是当时世界上最强的一批棋手。马歇尔是那个年代最出色的攻击型棋手之一，而这局棋正是他最为人记住的一局。\n\n到第23回合，黑方已经在第17回合弃象撕开了局面，此刻一车一马已经压向白王。接着是 23...Qg3!!，这一步把后摆到了一个白方三个子都能吃掉的格子上——f2 兵、h2 兵、g5 后。可是吃哪一个都不要紧：每一种应法都会立刻招致无法阻止的杀棋。列维茨基看懂了这一点，当场认输，没有等任何一种应法真的发生。\n\n据说当时观众席上有人往棋盘上撒金币，为这一步喝彩。但这个故事流传下来的版本比真相要复杂：马歇尔自己当时的记录只写着赛后「有人送了我一个钱包」，另一些说法认为棋盘上确实落下了金币——来自俄国、德国、奥地利观众的真金——但那是在兑现赌债，不是即兴的喝彩。不管哪个版本，那天在场的人都没有否认，棋盘上确实落过金币。',
      },
      why: {
        en: '23...Qg3!! lands the queen where three White pieces can take it, and every capture allows forced mate; legend says spectators threw gold coins onto the board.',
        zh: '23...Qg3!! 后送到白方三个子都能吃的格子，无论怎么吃都被将死；据说观众曾向棋盘上撒金币。',
      },
      keyMoves: [
        { ply: 34, san: 'Bxc3', note: {
          en: '17...Bxc3 sacrifices the bishop to wreck White\'s pawn structure in front of the king, trading a piece for the open lines the rest of the attack will run through.',
          zh: '17...Bxc3 弃象打烂白王面前的兵形，用一个子换来后面整套进攻都要用到的开放线路。' } },
        { ply: 36, san: 'Qxc3', note: {
          en: '18...Qxc3 recaptures with the queen, planting it deep in White\'s position with real threats already forming, not just material gained.',
          zh: '18...Qxc3 用后吃回来，把后直接摆进白方阵地深处——拿到的不只是子力，还有已经成形的威胁。' } },
        { ply: 38, san: 'Nd4', note: {
          en: '19...Nd4 adds a third attacker aimed at White\'s king with a single knight hop into the centre — the position now carries more attackers than White has defenders.',
          zh: '19...Nd4 一步马跳进中心，把攻击者的数量再加一个——此刻扑向白王的子，已经比白方能拿出来的防守者更多。' } },
        { ply: 44, san: 'Rxh3', note: {
          en: '22...Rxh3 captures the bishop guarding the h-file and opens it completely — the rook now sits one file away from White\'s king with nothing left in between.',
          zh: '22...Rxh3 吃掉守着 h 线的象，把这条线彻底打开——车此刻离白王只隔一条线，中间已经没有任何阻拦。' } },
        { ply: 46, san: 'Qg3', note: {
          en: '23...Qg3!! is the move. It can be taken by the pawn on f2, the pawn on h2, or the queen on g5 — three different captures — and every one of them allows a forced mate. Levitsky resigned without letting any of them happen.',
          zh: '23...Qg3!! 就是那一步。f2 兵、h2 兵、g5 后——三种不同的吃法都能吃掉这个后——可无论哪一种，白方都会被立刻杀死。列维茨基没等任何一种发生，直接认输。' } },
      ],
      pgn: [
        '[Event "DSB Congress"]',
        '[Site "Breslau GER"]',
        '[Date "1912.07.20"]',
        '[Round "-"]',
        '[White "Stepan Levitsky"]',
        '[Black "Frank Marshall"]',
        '[Result "0-1"]',
        '',
        '1. d4 e6 2. e4 d5 3. Nc3 c5 4. Nf3 Nc6 5. exd5 exd5 6. Be2 Nf6 7. O-O Be7',
        '8. Bg5 O-O 9. dxc5 Be6 10. Nd4 Bxc5 11. Nxe6 fxe6 12. Bg4 Qd6 13. Bh3 Rae8',
        '14. Qd2 Bb4 15. Bxf6 Rxf6 16. Rad1 Qc5 17. Qe2 Bxc3 18. bxc3 Qxc3',
        '19. Rxd5 Nd4 20. Qh5 Ref8 21. Re5 Rh6 22. Qg5 Rxh3 23. Rc5 Qg3 0-1',
      ].join('\n'),
    },
  ];
});
