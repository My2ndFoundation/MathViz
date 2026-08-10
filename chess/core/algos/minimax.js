/* 极小极大 / α-β 的**算法源码生成器**（规格 §2.1）。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   这个模块本身不搜索任何棋 —— 它吐出一段**字符串**。那段字符串同时是：
     · 喂给 `Interp.run` 去真跑的程序，
     · 喂给 `Editor.mount` 摆在使用者眼前的那份源码。
   一份字符串两个用途，所以「看到的」和「跑的」不可能漂移 —— 这是本阶段
   最重要的一条纪律，也是这个模块存在的全部理由（否则直接写个 JS 函数
   搜索就行了，何必绕一圈）。

   三个 mode（plain / ab / ordered）共用同一份模板：模板里只有两处
   插入点（走法排序、剪枝那四行），其余逐字相同。使用者切 tab 时看到的
   必须是**同一份算法**多了或少了剪枝，而不是两份各写各的代码 ——
   两份独立维护的源码迟早分岔，分岔之后「对比」就不再是对比了。
   `minimax.test.js` 用逐行 diff 把这条钉死（多出来的行不超过 6 行、
   且每一行都与 alpha/beta 有关）。

   **生成出来的那段源码里的注释和命名，是写给一个没学过棋的 16 岁读者的**
   —— 她要在编辑器里一边单步一边读它，还要敢动手改（规格 §2.8）。
   本文件自己的注释（就是你正在读的这些）是给维护者的，两套读者，两种口吻。

   子集约束（规格 §2.6 的解释器只认这么多语法），踩过的坑记在这里：
     · **没有三元运算符** —— `a ? b : c` 会抛 unsupported，一律展开成 if/else。
     · 数组只有 `push` 和 `length`（`indexOf`/`filter`/`sort` 都读不到）。
     · 宿主桥接只有 log/mark/place/clear/attacked 五个名字，本工具一个都不用
       —— 走法生成和局面评估必须自己在子集里写出来。
     · `applyMove` 用 **make/unmake**（就地改再改回），不是整盘拷贝 ——
       隔离实测：α-β 深度 4 拷贝要 149,178 步、make/unmake 要 123,499 步，
       **贵约 21%，但两者都没越过 STEP_LIMIT=200000**。规格早期写的
       「差一整层深度、拷贝要 245,847 步」是错的：那个数字来自一份同时
       还缺走法编码和预计算偏移表的旧实现，把三处改动的收益全算到了
       make/unmake 头上。保留 make/unmake 是因为它确实更便宜，不是因为
       没它就跑不完。（正因为只有 20% 且不跨阈值，**不要**为它写步数
       回归断言——这份源码本来就是拿来给人改的，那种断言只会误伤。）
     · 走法压成一个整数 `from * 16 + to`，避免每个走法分配一个数组。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoMinimax = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= 双语渲染（规格 §1.6 / §7.5）=================

     ⚠ **这一整段在每一份 algos/*.js 里逐字节相同**，check.py 的
     bilingual_algos_check() 会核对。改这里就得每一份一起改。
     ⚠ 这里**故意不写「共几份」**：这行原本写的是「七份」，而实际份数先涨到
     十份、又涨到十二份，**两次都没人跟着改**。一个没有门在核的数字必然会漂
     （CLAUDE.md 的「A mirrored field that nothing verifies will drift」已经
     记着同一条病的另外几个现场）。**份数由 bilingual_algos_check() 每次现数，
     不由这行注释记。**
     不抽成共用模块，是因为这些文件是被 inline_core.py 当**字符串**逐份
     内联、再各自求值成 AlgoXxx 全局的 —— 抽出去就凭空多一条求值顺序
     依赖，而那类缺陷要到浏览器里 ALGOS['queens.js'] 是 undefined 才发作
     （阶段 5 建页当天撞过一次）。逐份重复 + 一道字节级门，是阶段 7
     king-greedy / king-exact 共用段用过的同一个套路。

     `parts` 的元素只有两种：
       字符串                 —— 一行，两种语言下逐字相同
                                 （代码、空行、// >>> BLANK 指令行）
       { zh: [], en: [] }     —— 一段散文，两边都是**行数组**

     **两边行数必须相等**，不是洁癖：生成的源码是按行索引的 —— 解释器
     每一步记 line，第 4 级提示靠 pristine 与编辑器逐行对齐划出 answerRange，
     判定靠 judge.herSrc 比对。行数一差，切一次语言这四样同时指错地方。
     行数一对齐，轨迹在两种语言下逐字节相同，切语言就只是换掉编辑器里的
     文本，不重跑解释器。

     BLANK 指令行**不翻译**：它本来就同时带着 hint 与 hintEn，两种语言
     变体里那一行逐字相同，parse() 一点不用改。所以它是**字符串**片段。 */
  function render(parts, lang) {
    if (lang === undefined || lang === null) {
      throw new Error(
        'source({ lang }) 少了 lang —— 源码的注释与日志要用哪种语言没有' +
        '默认值，必须写明 "zh" 或 "en"（默认成任何一种，都是让同一个缺陷' +
        '换个地方复活）'
      );
    }
    if (lang !== 'zh' && lang !== 'en') {
      throw new Error('source({ lang }) 的 lang 只认 "zh" 或 "en"，收到：' +
                      JSON.stringify(lang));
    }
    const out = [];
    for (let i = 0; i < parts.length; i = i + 1) {
      const p = parts[i];
      if (typeof p === 'string') { out.push(p); continue; }
      if (!p || !Array.isArray(p.zh) || !Array.isArray(p.en)) {
        throw new Error('第 ' + i + ' 个片段既不是字符串、也不是 ' +
                        '{ zh: [], en: [] }');
      }
      if (p.zh.length !== p.en.length) {
        throw new Error(
          '第 ' + i + ' 个片段两种语言行数不等：zh ' + p.zh.length + ' 行 / en ' +
          p.en.length + ' 行 —— 生成的源码按行索引，行数一差，切一次语言 ' +
          'Step.line / pristine / answerRange / judge.herSrc 同时指错地方' +
          '（规格 §1.6）'
        );
      }
      const lines = p[lang];
      for (let j = 0; j < lines.length; j = j + 1) out.push(lines[j]);
    }
    return out;
  }

  /* 起始局面登记处。`sq = rank * 4 + file`，正=白 负=黑，`1=P 2=N 4=R 5=K`。

     H 是**测着挑出来的**，不是随手摆的：它必须同时满足三件事，缺一个
     这个工具的课就上不成 ——
       1. 深度 2/3/4 三个 tab 的答案彼此不同（0 / 136 / −12），否则「多想
          一层会改主意」这句话没有证据；
       2. 深度 3 三种模式都跑得完（62,143 / 37,791 / 28,790 步），能完整
          展示剪枝；
       3. 深度 4 纯 minimax 撞上 STEP_LIMIT 而 α-β 跑得完（392,679 vs
          123,499）—— 规格 §4④ 的那一课不是「慢一点」，是「做不到」。
     换局面就等于把这三条重测一遍，别凭感觉改。

     这几个数字与规格 §4④ 是同一组，改动生成的源码（哪怕只是多一条
     顶层声明）就会整体平移，两边要一起更新。 */
  const POSITIONS = {
    H: [5, 0, 2, 0, 0, 1, 1, 0, 0, 0, -1, -1, 0, -2, 0, -5],
  };

  /* 冻起来。POSITIONS 是**导出出去**的（见文件末尾那个 return），而 source()
     每次都从它身上取开局：`AM.POSITIONS.H[0] = 99` 会静默换掉此后每一次
     source() 的局面 —— 界面上写着「同一个开局」，跑的却不是，正是这个工具
     最不能出的错。
     逐个冻数组，不只冻外层：冻外层只挡得住「换掉整张表」，挡不住「改表里
     那 16 个数字」。阶段 5 往 POSITIONS 里加局面时也自动罩得住。
     （非严格模式的调用方写它是静默失败、严格模式下抛 —— 两种情形下表都
     没变，这就够了；本模块管不着调用方用哪种模式。） */
  for (const k of Object.keys(POSITIONS)) { Object.freeze(POSITIONS[k]); }
  Object.freeze(POSITIONS);

  const DEFAULT_POSITION = 'H';

  /* 生成出来的源码里，被吃掉的分值表与走向表 —— 顶层常量，每次递归都不重算。
     这里用普通字符串拼，不用模板字面量：这段文本本身会被原样贴进 html，
     而反引号在那个上下文里比在这里更容易出事。

     下面七个数组装的是**片段**，不是行：字符串（代码 / 空行，两语逐字相同）
     与 `{ zh: [], en: [] }`（一段散文，两边行数必须相等）—— 见上面 render()。
     英文不是逐句直译，是照中文那一版的意思与语气重写的，行数对齐落在
     「段」上：段内句子怎么重组都行，段的行数必须一样。
     带行尾注释的**代码行**也是片段（那一行有中文），代码部分两边逐字相同，
     只有 `//` 后面那半句换语言 —— 归一化时行尾空白被抽掉，所以两语的注释
     对齐留多少空格都不影响「代码同一」那道门。 */
  const HEADER = [
    {
      zh: [
        '/* ============ 4×4 棋盘上的极小极大搜索 ============',
        '   棋盘只有 4×4 = 16 格，格子编号 sq = 行 * 4 + 列：0 在左下角，15 在右上角。',
        '   每格放一个数字：正数是白子，负数是黑子，0 是空格。',
        '   分数永远站在白方视角：越大白方越好，越小黑方越好。',
        '   于是白方在自己的回合挑最大的，黑方挑最小的 —— 这就是「极小极大」。 */',
      ],
      en: [
        '/* ============ Minimax search on a 4×4 board ============',
        '   Only 4×4 = 16 squares, numbered sq = row * 4 + column: 0 bottom-left, 15 top-right.',
        '   Each square holds one number: positive is a white piece, negative black, 0 empty.',
        '   A score is always from White\'s side: bigger is better for White, smaller for Black.',
        '   So White picks the largest on his turn and Black the smallest — that is "minimax". */',
      ],
    },
    '',
    'const N = 4;',
    '',
    {
      zh: [
        '/* 棋子编号。棋盘上写的就是这几个数字（带负号就是黑子）。 */',
      ],
      en: [
        '/* Piece codes. These are the numbers actually written on the board (negative = black). */',
      ],
    },
    'const PAWN = 1;',
    'const KNIGHT = 2;',
    'const ROOK = 4;',
    'const KING = 5;',
    '',
    {
      zh: [
        '/* 每种棋子值多少分 —— 这张表就是这个 AI 的全部价值观，',
        '   改一个数字它就会下出不一样的棋。',
        '   下标**一律用上面那几个名字**写，不写裸数字：分值表和棋子编号',
        '   要是各用各的编号，错开一格都不会有人发现。 */',
      ],
      en: [
        '/* What each piece is worth — this table is the whole of this AI\'s values,',
        '   and changing one number makes it play differently.',
        '   Index it **with the names above**, never with bare numbers: if the value table and',
        '   the piece codes ever used different numbering, a one-slot slip would go unnoticed. */',
      ],
    },
    'const VAL = [0, 0, 0, 0, 0, 0];',
    'VAL[PAWN] = 100;',
    'VAL[KNIGHT] = 300;',
    'VAL[ROOK] = 500;',
    {
      zh: [
        'VAL[KING] = 10000;   // 王被吃就等于输了，所以给它一个大到压倒一切的分',
      ],
      en: [
        'VAL[KING] = 10000;   // losing the king loses the game, so give it an overwhelming score',
      ],
    },
    '',
    {
      zh: [
        '// 马 / 王 / 车 的走向表，每一项是 [列的增量, 行的增量]。',
      ],
      en: [
        '// Direction tables for knight / king / rook; each entry is [column step, row step].',
      ],
    },
    'const KNIGHT_DIRS = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];',
    'const KING_DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];',
    'const ROOK_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];',
    '',
    {
      zh: [
        '// (列 f, 行 r) 这个格子还在盘上吗？',
      ],
      en: [
        '// Is the square at (column f, row r) still on the board?',
      ],
    },
    'function onBoard(f, r) { return f >= 0 && f < N && r >= 0 && r < N; }',
    '',
    {
      zh: [
        '/* 把「轮到 white 走时所有能走的走法」列出来。',
        '   每个走法被压成一个整数：from * 16 + to。压成整数而不是 [from, to]，',
        '   是因为搜索会生成几万个走法，每个都分配一个数组太贵了。 */',
      ],
      en: [
        '/* List every move available when it is white\'s turn to play.',
        '   Each move is packed into one integer: from * 16 + to. Packed rather than [from, to]',
        '   because the search makes tens of thousands of moves; one array each is too costly. */',
      ],
    },
    'function genMoves(bd, white) {',
    '  const out = [];',
    '  for (let sq = 0; sq < 16; sq = sq + 1) {',
    '    const p = bd[sq];',
    {
      zh: [
        '    if (p === 0) { continue; }              // 空格，跳过',
        '    if (white && p < 0) { continue; }       // 轮到白走，黑子不归你管',
      ],
      en: [
        '    if (p === 0) { continue; }              // empty square, skip it',
        '    if (white && p < 0) { continue; }       // white to move: black pieces are not yours',
      ],
    },
    '    if (!white && p > 0) { continue; }',
    '    const f = sq % N;',
    '    const r = (sq - f) / N;',
    '    let ap = p;',
    {
      zh: [
        '    if (ap < 0) { ap = -ap; }               // 去掉正负号，只看是哪种子',
      ],
      en: [
        '    if (ap < 0) { ap = -ap; }               // drop the sign, keep just the piece kind',
      ],
    },
    '    if (ap === PAWN) {',
    {
      zh: [
        '      // 兵：白往上走（行 +1），黑往下走（行 −1）。',
      ],
      en: [
        '      // Pawns: white moves up (row +1), black moves down (row −1).',
      ],
    },
    '      let dr = 1;',
    '      if (!white) { dr = -1; }',
    {
      zh: [
        '      // 直走一格：只有前面是空的才行（兵不能直着吃子）。',
      ],
      en: [
        '      // One step forward: only onto an empty square (a pawn cannot capture ahead).',
      ],
    },
    '      if (onBoard(f, r + dr) && bd[(r + dr) * N + f] === 0) { out.push(sq * 16 + (r + dr) * N + f); }',
    {
      zh: [
        '      // 斜吃一格：只有斜前方站着对方的子才行。',
      ],
      en: [
        '      // Capture one step diagonally: only if an enemy piece is standing there.',
      ],
    },
    '      for (const df of [-1, 1]) {',
    '        if (onBoard(f + df, r + dr)) {',
    '          const t = (r + dr) * N + f + df;',
    '          if (bd[t] !== 0 && ((bd[t] > 0) !== white)) { out.push(sq * 16 + t); }',
    '        }',
    '      }',
    '    } else if (ap === KNIGHT || ap === KING) {',
    {
      zh: [
        '      // 马和王都是「跳到固定的几个格子」，只是走向表不同。',
      ],
      en: [
        '      // Knight and king both jump to a fixed set of squares; only the table differs.',
      ],
    },
    '      let tbl = KNIGHT_DIRS;',
    '      if (ap === KING) { tbl = KING_DIRS; }',
    '      for (const d of tbl) {',
    '        const nf = f + d[0];',
    '        const nr = r + d[1];',
    '        if (onBoard(nf, nr)) {',
    '          const t = nr * N + nf;',
    {
      zh: [
        '          // 落点空着可以走，站着对方的子可以吃，站着自己人不行。',
      ],
      en: [
        '          // Land on an empty square, capture an enemy one, never onto your own piece.',
      ],
    },
    '          if (bd[t] === 0 || ((bd[t] > 0) !== white)) { out.push(sq * 16 + t); }',
    '        }',
    '      }',
    '    } else if (ap === ROOK) {',
    {
      zh: [
        '      // 车：沿一个方向一直滑，撞到子就停。',
      ],
      en: [
        '      // Rooks slide along one direction until they run into a piece.',
      ],
    },
    '      for (const d of ROOK_DIRS) {',
    '        let nf = f + d[0];',
    '        let nr = r + d[1];',
    '        while (onBoard(nf, nr)) {',
    '          const t = nr * N + nf;',
    '          if (bd[t] === 0) { out.push(sq * 16 + t); } else {',
    {
      zh: [
        '            // 撞上子了：是对方的就吃掉，然后无论如何都停下。',
      ],
      en: [
        '            // Ran into a piece: capture it if it is the enemy, then stop either way.',
      ],
    },
    '            if ((bd[t] > 0) !== white) { out.push(sq * 16 + t); }',
    '            break;',
    '          }',
    '          nf = nf + d[0];',
    '          nr = nr + d[1];',
    '        }',
    '      }',
    '    }',
    '  }',
    '  return out;',
    '}',
    '',
    {
      zh: [
        '/* 给一个局面打分（正数对白方有利）。搜索到底之后就靠它说话，',
        '   所以它有多蠢，整个 AI 就有多蠢。这里只看两件事：',
        '   身上的子值多少分，以及有没有占住中间那四格。 */',
      ],
      en: [
        '/* Score a position (positive favours White). Once the search bottoms out this is what',
        '   speaks, so the whole AI is exactly as dim as this function is. It looks at two things:',
        '   what the pieces are worth, and whether the four centre squares are held. */',
      ],
    },
    'function evaluate(bd) {',
    '  let s = 0;',
    '  for (let sq = 0; sq < 16; sq = sq + 1) {',
    '    const p = bd[sq];',
    '    if (p === 0) { continue; }',
    '    let ap = p;',
    '    if (ap < 0) { ap = -ap; }',
    '    let v = VAL[ap];',
    '    const f = sq % N;',
    '    const r = (sq - f) / N;',
    {
      zh: [
        '    // 中间那四格视野好，站上去白送 12 分。这个 12 是拍脑袋定的，改它。',
      ],
      en: [
        '    // The four centre squares see more, so being there is worth 12. Made up; change it.',
      ],
    },
    '    if ((f === 1 || f === 2) && (r === 1 || r === 2)) { v = v + 12; }',
    '    if (p > 0) { s = s + v; } else { s = s - v; }',
    '  }',
    '  return s;',
    '}',
    '',
    {
      zh: [
        '/* 搜索本体。返回「双方都走最好的一步时，这个局面最后值多少分」。',
        '   bd 是棋盘，white 说现在轮到谁走，depth 是还想往下看几步。',
      ],
      en: [
        '/* The search itself. It returns what this position is finally worth when both sides',
        '   play their best. bd is the board, white says whose turn it is, depth how far to look.',
      ],
    },
    '',
    {
      zh: [
        '   alpha 与 beta 是「白方已经保底拿到的下限」和「黑方已经保底压住的',
        '   上限」。纯 minimax 一路把这两个数字传下去却从来不看它们；α-β 就',
        '   靠它们判断哪些分支根本不必再看。',
      ],
      en: [
        '   alpha and beta are the floor White has already secured and the ceiling Black has',
        '   already forced. Plain minimax passes both numbers all the way down and never once',
        '   reads them; alpha-beta uses them to decide which branches need not be looked at.',
      ],
    },
    '',
    {
      zh: [
        '   剪枝那个 tab 与纯 minimax 那个 tab，源码的差别就是下面循环里同一个',
        '   两行套路 ——「抬高自己的保底」加「保底已经追上对方的上限就收工」——',
        '   在白方分支写一遍、在黑方分支再写一遍，一共 4 行。 */',
      ],
      en: [
        '   Between the pruning tab and the plain minimax tab, the source differs by one',
        '   two-line trick below — "raise your own floor", then "stop once it meets',
        '   the other side\'s ceiling" — once for White, once for Black: 4 lines. */',
      ],
    },
    'function search(bd, depth, alpha, beta, white) {',
    {
      zh: [
        '  // 到底了：不再往下想，直接给眼前这个局面打分。',
      ],
      en: [
        '  // Bottom reached: stop looking further and just score the position in front of us.',
      ],
    },
    '  if (depth === 0) { return evaluate(bd); }',
    {
      zh: [
        '  // ms = moves，这一层轮到走的一方所有能走的走法。',
      ],
      en: [
        '  // ms = moves: every move available to whoever is on the move at this level.',
      ],
    },
    '  let ms = genMoves(bd, white);',
    {
      zh: [
        '  // 一步都走不了，那就拿当前局面的分数当结果。',
      ],
      en: [
        '  // No move at all: take the score of the current position as the answer.',
      ],
    },
    '  if (ms.length === 0) { return evaluate(bd); }',
  ];

  /* 插入点一：走法排序。ordered 模式把吃子挪到最前面。
     为什么这么做有效：α-β 能砍掉多少分支，完全取决于**好棋有多早被试到** ——
     先试到好棋，alpha/beta 这个窗口就早早收窄，后面的分支一照面就出局。
     吃子是最容易一口气改变局势的走法，所以拿它当「先试哪一步」的猜测。
     这不改变答案（对拍测试钉着这一条），只改变要看多少个局面。 */
  const ORDERING = [
    {
      zh: [
        '  /* 先试吃子。α-β 能砍掉多少，全看好棋被试到得有多早 —— 早点试到好棋，',
        '     alpha/beta 这个窗口就早早收窄，后面的分支一照面就被淘汰。',
        '     吃子最可能一口气改变局势，所以拿它当「先试哪一步」的猜测。',
        '     注意这只改变**要看多少个局面**，不改变最后算出来的那个分数。 */',
      ],
      en: [
        '  /* Try captures first. What alpha-beta cuts depends on how early a good move is tried:',
        '     try one early, the alpha/beta window narrows at once and later branches are thrown',
        '     out on sight. Captures change things fastest, so they are the guess at what to try',
        '     first. This changes **how many positions get looked at**, never the final score. */',
      ],
    },
    '  const caps = [];',
    '  const quiet = [];',
    '  for (const q of ms) {',
    '    const qt = q % 16;',
    '    if (bd[qt] !== 0) { caps.push(q); } else { quiet.push(q); }',
    '  }',
    '  ms = [];',
    '  for (const q of caps) { ms.push(q); }',
    '  for (const q of quiet) { ms.push(q); }',
  ];

  const LOOP_HEAD = [
    {
      zh: [
        '  // 白方要最大值，就从「要多小有多小」起步；黑方反过来。',
      ],
      en: [
        '  // White wants the maximum, so start as low as possible; Black starts the other way.',
      ],
    },
    '  let best = -99999;',
    '  if (!white) { best = 99999; }',
    '  for (const mv of ms) {',
    {
      zh: [
        '    // 走法是压成整数的，拆回起点 from 和终点 to。',
      ],
      en: [
        '    // The move is packed into an integer; unpack it into from and to.',
      ],
    },
    '    const from = (mv - mv % 16) / 16;',
    '    const to = mv % 16;',
    {
      zh: [
        '    // make：记下被吃的子是什么，然后就地把棋子挪过去。',
      ],
      en: [
        '    // make: note what gets captured, then move the piece in place.',
      ],
    },
    '    const cap = bd[to];',
    '    bd[to] = bd[from];',
    '    bd[from] = 0;',
    {
      zh: [
        '    // 换对方走，还能看的深度减一 —— 递归就发生在这一行。',
      ],
      en: [
        '    // Hand over to the other side with one less depth — the recursion is this line.',
      ],
    },
    '    const v = search(bd, depth - 1, alpha, beta, !white);',
    {
      zh: [
        '    // unmake：原样还回去。也可以整盘复制一份新的来走，那样更好懂，',
        '    // 但实测要多花两成步数 —— 省下的那两成就是多看几千个局面。',
      ],
      en: [
        '    // unmake: put it all back. Copying the whole board instead would be easier to read,',
        '    // but measured about 20% more steps — that 20% is a few thousand more positions.',
      ],
    },
    '    bd[from] = bd[to];',
    '    bd[to] = cap;',
    '    if (white) {',
    {
      zh: [
        '      // 白方回合：谁大留谁。',
      ],
      en: [
        '      // White to move: keep the larger.',
      ],
    },
    '      if (v > best) { best = v; }',
  ];

  /* 插入点二：剪枝。**整个 α-β 就是这四行。**
     测试逐行 diff 时，这四行是唯一允许多出来的东西，而且每一行都必须
     提到 alpha 或 beta —— 尾注也写在同一行上，就不会额外占一行配额。
     `if (beta <= alpha) { break; }` 在两个分支里逐字相同，diff 会把它数
     两次，一共 4 行，仍在 6 行的预算内。 */
  const CUT_WHITE = [
    {
      zh: [
        '      if (best > alpha) { alpha = best; }   // 白方的保底又抬高了一点',
        '      if (beta <= alpha) { break; }         // 剪枝：剩下的分支不用看了',
      ],
      en: [
        '      if (best > alpha) { alpha = best; }   // White\'s floor just went up a little',
        '      if (beta <= alpha) { break; }         // prune: no need to look at the rest',
      ],
    },
  ];

  const LOOP_MID = [
    '    } else {',
    {
      zh: [
        '      // 黑方回合：谁小留谁。',
      ],
      en: [
        '      // Black to move: keep the smaller.',
      ],
    },
    '      if (v < best) { best = v; }',
  ];

  const CUT_BLACK = [
    {
      zh: [
        '      if (best < beta) { beta = best; }     // 黑方压住的上限又低了一点',
        '      if (beta <= alpha) { break; }         // 剪枝：剩下的分支不用看了',
      ],
      en: [
        '      if (best < beta) { beta = best; }     // Black\'s ceiling just came down a little',
        '      if (beta <= alpha) { break; }         // prune: no need to look at the rest',
      ],
    },
  ];

  const LOOP_TAIL = [
    '    }',
    '  }',
    '  return best;',
    '}',
    '',
  ];

  const MODES = { plain: true, ab: true, ordered: true };

  /* source({ mode, depth, position, lang }) → string

     `lang`（'zh' | 'en'）**没有默认值**，漏传当场抛 —— 理由写在 render()
     里那一段：默认成任何一种，都是让同一个缺陷换个地方复活。

     mode 写错不给默认值，直接抛：一个拼错的 mode 静默退化成 plain，
     界面上会显示「α-β」而实际跑的是纯 minimax，这正是本工具最不能出的错。
     position 可以给 POSITIONS 里的名字（缺省 'H'），也可以直接给 16 个数字
     —— 后者是给「让使用者自己摆一个局面」留的口子。
     读 POSITIONS 时切一份副本：这一刀护的是**下面这个 board**，让它与那张表
     不共享引用 —— 它挡不住外面改表（那件事由上面的 Object.freeze 挡，两处
     防的是相反的方向，别把它们记混）。board 在本函数里眼下只被 length / join
     读一次，所以这份副本今天防的是将来：谁在这里改 board、或把它返回出去，
     都不会顺手改到登记处。`o.position` 那一支的 `[].slice.call` 还多做一件事
     —— 把类数组规整成真数组，好让下面的 length / join 有确定的行为。 */
  function source(opts) {
    const o = opts || {};
    const mode = o.mode === undefined ? 'plain' : o.mode;
    if (!MODES.hasOwnProperty(mode)) {
      throw new Error('未知的 mode："' + mode + '"，只认 plain / ab / ordered');
    }
    const depth = o.depth === undefined ? 3 : o.depth;
    if (typeof depth !== 'number' || !isFinite(depth) || depth < 0 || Math.floor(depth) !== depth) {
      throw new Error('depth 必须是非负整数，收到：' + depth);
    }

    let board;
    if (o.position === undefined || o.position === null) {
      board = POSITIONS[DEFAULT_POSITION].slice();
    } else if (typeof o.position === 'string') {
      if (!POSITIONS.hasOwnProperty(o.position)) {
        throw new Error('未知的局面名："' + o.position + '"');
      }
      board = POSITIONS[o.position].slice();
    } else {
      board = [].slice.call(o.position);
    }
    if (board.length !== 16) {
      throw new Error('局面必须是 16 个数字，收到 ' + board.length + ' 个');
    }

    const prune = (mode === 'ab' || mode === 'ordered');

    /* 拼的是**片段**数组，不是行数组 —— 元素两种，见上面 render()。
       `lang` 故意不在这里校验：自身参数（mode / depth / position）的校验
       全在上面，lang 由 render() 在最后一刻校验，七份 algos 一个形状。 */
    let parts = [];
    parts = parts.concat(HEADER);
    if (mode === 'ordered') { parts = parts.concat(ORDERING); }
    parts = parts.concat(LOOP_HEAD);
    if (prune) { parts = parts.concat(CUT_WHITE); }
    parts = parts.concat(LOOP_MID);
    if (prune) { parts = parts.concat(CUT_BLACK); }
    parts = parts.concat(LOOP_TAIL);
    parts = parts.concat([
      {
        zh: [
          '// 这就是开局。想换个局面？直接改这 16 个数字。',
        ],
        en: [
          '// This is the opening position. Want a different one? Change these 16 numbers.',
        ],
      },
      'const board = [' + board.join(', ') + '];',
      {
        zh: [
          '/* 从白方开始，往下看 ' + depth + ' 步。−99999 / 99999 是「还没有任何保底」',
          '   的意思，随便哪个真实分数都比它们好 —— 拿它们当正负无穷用。 */',
        ],
        en: [
          '/* Start from White and look ' + depth + ' half-moves ahead. −99999 / 99999 mean "nothing',
          '   secured yet" — any real score beats them; use them as plus and minus infinity. */',
        ],
      },
      'return search(board, ' + depth + ', -99999, 99999, true);',
    ]);
    return render(parts, o.lang).join('\n');
  }

  return { source: source, POSITIONS: POSITIONS, DEFAULT_POSITION: DEFAULT_POSITION };
});
