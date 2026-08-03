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

  const DEFAULT_POSITION = 'H';

  /* 生成出来的源码里，被吃掉的分值表与走向表 —— 顶层常量，每次递归都不重算。
     这里用普通字符串拼，不用模板字面量：这段文本本身会被原样贴进 html，
     而反引号在那个上下文里比在这里更容易出事。 */
  const HEADER = [
    '/* ============ 4×4 棋盘上的极小极大搜索 ============',
    '   棋盘只有 4×4 = 16 格，格子编号 sq = 行 * 4 + 列：0 在左下角，15 在右上角。',
    '   每格放一个数字：正数是白子，负数是黑子，0 是空格。',
    '   分数永远站在白方视角：越大白方越好，越小黑方越好。',
    '   于是白方在自己的回合挑最大的，黑方挑最小的 —— 这就是「极小极大」。 */',
    '',
    'const N = 4;',
    '',
    '/* 棋子编号。棋盘上写的就是这几个数字（带负号就是黑子）。 */',
    'const PAWN = 1;',
    'const KNIGHT = 2;',
    'const ROOK = 4;',
    'const KING = 5;',
    '',
    '/* 每种棋子值多少分 —— 这张表就是这个 AI 的全部价值观，',
    '   改一个数字它就会下出不一样的棋。',
    '   下标**一律用上面那几个名字**写，不写裸数字：分值表和棋子编号',
    '   要是各用各的编号，错开一格都不会有人发现。 */',
    'const VAL = [0, 0, 0, 0, 0, 0];',
    'VAL[PAWN] = 100;',
    'VAL[KNIGHT] = 300;',
    'VAL[ROOK] = 500;',
    'VAL[KING] = 10000;   // 王被吃就等于输了，所以给它一个大到压倒一切的分',
    '',
    '// 马 / 王 / 车 的走向表，每一项是 [列的增量, 行的增量]。',
    'const KNIGHT_DIRS = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];',
    'const KING_DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];',
    'const ROOK_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];',
    '',
    '// (列 f, 行 r) 这个格子还在盘上吗？',
    'function onBoard(f, r) { return f >= 0 && f < N && r >= 0 && r < N; }',
    '',
    '/* 把「轮到 white 走时所有能走的走法」列出来。',
    '   每个走法被压成一个整数：from * 16 + to。压成整数而不是 [from, to]，',
    '   是因为搜索会生成几万个走法，每个都分配一个数组太贵了。 */',
    'function genMoves(bd, white) {',
    '  const out = [];',
    '  for (let sq = 0; sq < 16; sq = sq + 1) {',
    '    const p = bd[sq];',
    '    if (p === 0) { continue; }              // 空格，跳过',
    '    if (white && p < 0) { continue; }       // 轮到白走，黑子不归你管',
    '    if (!white && p > 0) { continue; }',
    '    const f = sq % N;',
    '    const r = (sq - f) / N;',
    '    let ap = p;',
    '    if (ap < 0) { ap = -ap; }               // 去掉正负号，只看是哪种子',
    '    if (ap === PAWN) {',
    '      // 兵：白往上走（行 +1），黑往下走（行 −1）。',
    '      let dr = 1;',
    '      if (!white) { dr = -1; }',
    '      // 直走一格：只有前面是空的才行（兵不能直着吃子）。',
    '      if (onBoard(f, r + dr) && bd[(r + dr) * N + f] === 0) { out.push(sq * 16 + (r + dr) * N + f); }',
    '      // 斜吃一格：只有斜前方站着对方的子才行。',
    '      for (const df of [-1, 1]) {',
    '        if (onBoard(f + df, r + dr)) {',
    '          const t = (r + dr) * N + f + df;',
    '          if (bd[t] !== 0 && ((bd[t] > 0) !== white)) { out.push(sq * 16 + t); }',
    '        }',
    '      }',
    '    } else if (ap === KNIGHT || ap === KING) {',
    '      // 马和王都是「跳到固定的几个格子」，只是走向表不同。',
    '      let tbl = KNIGHT_DIRS;',
    '      if (ap === KING) { tbl = KING_DIRS; }',
    '      for (const d of tbl) {',
    '        const nf = f + d[0];',
    '        const nr = r + d[1];',
    '        if (onBoard(nf, nr)) {',
    '          const t = nr * N + nf;',
    '          // 落点空着可以走，站着对方的子可以吃，站着自己人不行。',
    '          if (bd[t] === 0 || ((bd[t] > 0) !== white)) { out.push(sq * 16 + t); }',
    '        }',
    '      }',
    '    } else if (ap === ROOK) {',
    '      // 车：沿一个方向一直滑，撞到子就停。',
    '      for (const d of ROOK_DIRS) {',
    '        let nf = f + d[0];',
    '        let nr = r + d[1];',
    '        while (onBoard(nf, nr)) {',
    '          const t = nr * N + nf;',
    '          if (bd[t] === 0) { out.push(sq * 16 + t); } else {',
    '            // 撞上子了：是对方的就吃掉，然后无论如何都停下。',
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
    '/* 给一个局面打分（正数对白方有利）。搜索到底之后就靠它说话，',
    '   所以它有多蠢，整个 AI 就有多蠢。这里只看两件事：',
    '   身上的子值多少分，以及有没有占住中间那四格。 */',
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
    '    // 中间那四格视野好，站上去白送 12 分。这个 12 是拍脑袋定的，改它。',
    '    if ((f === 1 || f === 2) && (r === 1 || r === 2)) { v = v + 12; }',
    '    if (p > 0) { s = s + v; } else { s = s - v; }',
    '  }',
    '  return s;',
    '}',
    '',
    '/* 搜索本体。返回「双方都走最好的一步时，这个局面最后值多少分」。',
    '   bd 是棋盘，white 说现在轮到谁走，depth 是还想往下看几步。',
    '',
    '   alpha 与 beta 是「白方已经保底拿到的下限」和「黑方已经保底压住的',
    '   上限」。纯 minimax 一路把这两个数字传下去却从来不看它们；α-β 就',
    '   靠它们判断哪些分支根本不必再看 —— 剪枝那个 tab 与纯 minimax 那个',
    '   tab，源码的差别只有下面循环里的那两行。 */',
    'function search(bd, depth, alpha, beta, white) {',
    '  // 到底了：不再往下想，直接给眼前这个局面打分。',
    '  if (depth === 0) { return evaluate(bd); }',
    '  // ms = moves，这一层轮到走的一方所有能走的走法。',
    '  let ms = genMoves(bd, white);',
    '  // 一步都走不了，那就拿当前局面的分数当结果。',
    '  if (ms.length === 0) { return evaluate(bd); }',
  ];

  /* 插入点一：走法排序。ordered 模式把吃子挪到最前面。
     为什么这么做有效：α-β 能砍掉多少分支，完全取决于**好棋有多早被试到** ——
     先试到好棋，alpha/beta 这个窗口就早早收窄，后面的分支一照面就出局。
     吃子是最容易一口气改变局势的走法，所以拿它当「先试哪一步」的猜测。
     这不改变答案（对拍测试钉着这一条），只改变要看多少个局面。 */
  const ORDERING = [
    '  /* 先试吃子。α-β 能砍掉多少，全看好棋被试到得有多早 —— 早点试到好棋，',
    '     alpha/beta 这个窗口就早早收窄，后面的分支一照面就被淘汰。',
    '     吃子最可能一口气改变局势，所以拿它当「先试哪一步」的猜测。',
    '     注意这只改变**要看多少个局面**，不改变最后算出来的那个分数。 */',
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
    '  // 白方要最大值，就从「要多小有多小」起步；黑方反过来。',
    '  let best = -99999;',
    '  if (!white) { best = 99999; }',
    '  for (const mv of ms) {',
    '    // 走法是压成整数的，拆回起点 from 和终点 to。',
    '    const from = (mv - mv % 16) / 16;',
    '    const to = mv % 16;',
    '    // make：记下被吃的子是什么，然后就地把棋子挪过去。',
    '    const cap = bd[to];',
    '    bd[to] = bd[from];',
    '    bd[from] = 0;',
    '    // 换对方走，还能看的深度减一 —— 递归就发生在这一行。',
    '    const v = search(bd, depth - 1, alpha, beta, !white);',
    '    // unmake：原样还回去。也可以整盘复制一份新的来走，那样更好懂，',
    '    // 但实测要多花两成步数 —— 省下的那两成就是多看几千个局面。',
    '    bd[from] = bd[to];',
    '    bd[to] = cap;',
    '    if (white) {',
    '      // 白方回合：谁大留谁。',
    '      if (v > best) { best = v; }',
  ];

  /* 插入点二：剪枝。**整个 α-β 就是这四行。**
     测试逐行 diff 时，这四行是唯一允许多出来的东西，而且每一行都必须
     提到 alpha 或 beta —— 尾注也写在同一行上，就不会额外占一行配额。
     `if (beta <= alpha) { break; }` 在两个分支里逐字相同，diff 会把它数
     两次，一共 4 行，仍在 6 行的预算内。 */
  const CUT_WHITE = [
    '      if (best > alpha) { alpha = best; }   // 白方的保底又抬高了一点',
    '      if (beta <= alpha) { break; }         // 剪枝：剩下的分支不用看了',
  ];

  const LOOP_MID = [
    '    } else {',
    '      // 黑方回合：谁小留谁。',
    '      if (v < best) { best = v; }',
  ];

  const CUT_BLACK = [
    '      if (best < beta) { beta = best; }     // 黑方压住的上限又低了一点',
    '      if (beta <= alpha) { break; }         // 剪枝：剩下的分支不用看了',
  ];

  const LOOP_TAIL = [
    '    }',
    '  }',
    '  return best;',
    '}',
    '',
  ];

  const MODES = { plain: true, ab: true, ordered: true };

  /* source({ mode, depth, position }) → string

     mode 写错不给默认值，直接抛：一个拼错的 mode 静默退化成 plain，
     界面上会显示「α-β」而实际跑的是纯 minimax，这正是本工具最不能出的错。
     position 可以给 POSITIONS 里的名字（缺省 'H'），也可以直接给 16 个数字
     —— 后者是给「让使用者自己摆一个局面」留的口子。
     读 POSITIONS 时切一份副本：生成的源码只是把数字打印出来，但别人若拿到
     POSITIONS.H 的引用改了它，下一次 source() 就悄悄换了局面。 */
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

    let lines = [];
    lines = lines.concat(HEADER);
    if (mode === 'ordered') { lines = lines.concat(ORDERING); }
    lines = lines.concat(LOOP_HEAD);
    if (prune) { lines = lines.concat(CUT_WHITE); }
    lines = lines.concat(LOOP_MID);
    if (prune) { lines = lines.concat(CUT_BLACK); }
    lines = lines.concat(LOOP_TAIL);
    lines = lines.concat([
      '// 这就是开局。想换个局面？直接改这 16 个数字。',
      'const board = [' + board.join(', ') + '];',
      '/* 从白方开始，往下看 ' + depth + ' 步。−99999 / 99999 是「还没有任何保底」',
      '   的意思，随便哪个真实分数都比它们好 —— 拿它们当正负无穷用。 */',
      'return search(board, ' + depth + ', -99999, 99999, true);',
    ]);
    return lines.join('\n');
  }

  return { source: source, POSITIONS: POSITIONS, DEFAULT_POSITION: DEFAULT_POSITION };
});
