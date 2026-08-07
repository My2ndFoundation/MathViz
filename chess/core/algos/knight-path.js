/* 骑士最短路（广度优先搜索）的**算法源码生成器**（规格 §2.1）。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   跟 `queens.js` / `tour-dfs.js` / `tour-warnsdorff.js` / `minimax.js` 是同一个
   形状：这个模块本身不搜索任何东西 —— 它吐出一段**字符串**。那段字符串同时是
   喂给 `Interp.run` 去真跑的程序、和喂给 `Editor.mount` 摆在使用者眼前的那份
   源码。一份字符串两个用途，所以「看到的」和「跑的」不可能漂移。

   **生成出来的那段源码里的注释和命名，是写给一个没学过棋的 16 岁读者的**。
   本文件自己的注释（就是你正在读的这些）是给维护者的，两套读者，两种口吻。

   ---- 为什么是**递归铺层**，不是一条队列 ----

   教科书上的 BFS 是「一条队列 + 一个 while」。这里写成了另一种同样标准的
   形态：**逐层同步（level-synchronous）BFS** —— `expand(frontier, d)` 拿着
   「正好 d 步能到的那一整层格子」，把它们的邻居收成下一层，再对下一层调用
   自己。两种写法访问顺序完全一样、距离完全一样（knight-path.test.js 拿一份
   队列式的宿主侧 BFS 逐组对拍），但这一种多给了两件工具⑤ 非要不可的东西：

     ① **递归深度就是 BFS 层号**，而层号就是最短距离。于是这一页的第三根轴
        （深度塔，§1.4「z 轴 = 入口函数的递归深度」）不需要任何额外声明就正好
        是「第几层」；左边调用栈面板里叠着的帧数，就是右边棋盘上波纹的圈数。
        队列式写法的调用深度恒等于 1，那根轴会整个塌掉，得靠页面自己再算一遍
        距离才能立起来 —— 而页面一旦自己算距离，§2.8 请她改这份源码之后，
        塔就不再跟着她的改动变了。**这正是本仓库最忌讳的那种漂移**：
        看到的和跑的分了家。
     ② 「一层铺完再铺下一层」在源码结构上是**看得见**的，而不是藏在一条队列的
        先进先出里。BFS 唯一的秘密就是这个顺序。

   代价写清楚：`frontier` / `next` 两张表比一条队列多占内存，而且这一段递归
   最深只到「最短距离」那么深（8×8 上最多 6 层），不是每格一层 —— 不会像
   骑士巡游那样把栈叠到 20 层。

   ---- 几处必须写下来的约定 ----

   · **入口函数叫 `expand`**，对应 `PROBLEMS.knightPath.entry`。它是**递归**
     那一个（`expand(frontier, d)` 铺第 d 层），不是只调用一次的外壳 ——
     `TreeModel.build(trace, 'expand')` 认到的帧必须一层套一层。顶层是
     `steps = expand([START], 0); … return steps;`，所以 `run().result`
     就是最短步数。

   · **格子编号 `sq = 行 * W + 列`**，行 0 在棋盘最下面、列 0 在最左边，
     于是 0 号格是 a1 —— 跟 `queens.js`、`tour-*.js`、`BoardRender.layout()`
     的 `squareCenter(file, rank)`、`chess-core.js` 的 `SQ(file, rank)` 同向。
     反推是 `列 = sq % W; 行 = (sq - 列) / W`。**这一题的棋盘是正方形**
     （W×W），因为它演的是真正那一副 8×8 的棋盘上「马从这里到那里几步」。

   · **返回值：最短步数；到不了是 −1。**「到不了」绝不能变成 0 —— 0 的意思是
     「已经站在目标格上了」，把这两件事混成同一个数字是这一题最不能出的错
     （工具⑤ 全页的规矩：`null`/未知不许变成数字，这里是它在算法侧的对应物）。
     宿主侧那份对拍用的队列式 BFS 也是 −1，两边同源。

   · **宿主桥接**：`mark(sq, kind)` 画规格 §2.7 的状态，**这一题只用三种**：
       'try'（正在看这个邻居）· 'ok'（第一次到达，这就是它的最短步数）·
       'cut'（早就到过了，从这边过去只会更长）。
     **`'back'` 一次都不会出现，而这正是这一题的一半内容**：BFS 从不反悔。
     N 皇后和骑士巡游都要回溯，它不要 —— 因为它是按距离从近到远铺开的，
     第一次碰到一格时那就已经是最短的了，没有什么可反悔的。
     `PROBLEMS.knightPath.kinds` 因此只有三行图例，少的那一行本身就是一句话。

   · **`place` 发生在最后，而且这是对的**（跟 `tour-*.js` 的「边搜边走」相反，
     不要照抄那条裁定）。骑士巡游里马真的在一步步走，所以落子必须铺满整段
     搜索；BFS 里**没有任何一匹马在走** —— 它是一圈一圈的水波，同时向所有
     方向铺开。搜索途中盘上该有的是波纹（`mark`），不是棋子。等到碰着目标，
     顺着 `prev` 把路线倒着串回来，一次摆出那 d+1 匹马 —— 那串马就是答案。
     搜索途中盘面并不空：波纹一直在长，只是长的不是棋子。

   · **`place(sq, "wN")` 是「数字格子 + 字符串棋子」**，跟 `queens.js` 的
     `place(sq, "wQ")` 同一个约定。仓库里另有一个反例
     （`tools/_debugger-preview.html` 内嵌的那份 N 皇后示例写的是
     `place(sq(col, row), 5)`，两个参数正好相反），别照那份抄。

   · 子集约束（规格 §2.6）：**没有三元运算符**，`a ? b : c` 会抛 unsupported，
     一律展开成 if/else；数组只有 `push` / `pop` 和 `length` 与下标读写。

   · **两组 `// >>> BLANK` 指令现在就写在下面的 `BODY` 里**（§2.9），由
     `core/exercise.js` 的 `parse()` 消费。两个都是 level=1「填一个表达式」：
       ① `id=on-board` —— `onBoard(x, y)` 那一行返回式，跟 `queens.js` 的
          `safe(r, c)` 同一道缝。
       ② `id=seen-test` —— `expand()` 里那一句 `if (dist[nb] >= 0) {`：
          「这一格碰过没有」。它就是整个 BFS 的开关，写错了程序照常跑完、
          照常返回一个数，只是那个数不对 —— 正是挖空练习要的那种「跑得完
          但答错」，判定靠比行为而不是比文本。

     指令是注释，**一步都不产生**：插入前后 a1→h8 是 5,086 步 / 距离 6、
     a1→d4 是 347 步 / 距离 2，与上面那张实测表逐格相同；把四行指令剥回去
     再跑，步数、结果与整条棋盘事件流逐条一致。

     **两个 `fill` 都跟计划给的相反，各挡一种事故**（实测，滑杆全程 1..63）：
     恒真的 `onBoard`（计划给的 `fill="return true;"`）会让 `nb` 算出 −15、
     68 这种**棋盘上不存在的格子号**，滑杆全程 10,561 条棋盘事件落在盘外，
     而且 63 个目标格里有 38 个答案照样对；`fill="if (false) {"` 更甚 ——
     它 63 个目标格**全部答对**（逐层同步的 BFS 即使把「碰过没有」整个关掉，
     第一次生成目标格的那一层仍然正好是最短距离）。一个按 Run 就给出正确
     读数的占位版会让 Check 看起来像在刁难人。现在用的是 `return false;`
     与 `if (true) {`：一律往**过紧**的方向倒，结果恒为 −1，滑杆全程最多
     288 步、盘外事件 0 条。三关六条断言在 `core/exercise-blanks.test.js`。

   ---- 实测步数与结果（`Interp.STEP_LIMIT` = 200,000）----

   拿本文件生成的源码跑 `Interp.run(src, { host: {} })`，读 `trace.length`
   与 `result`（全部 start = 0 = a1，与 knight-path.test.js 同源）：

     目标（start = a1）      步数     距离   确认的格子（ok）
     h8 (63)               5,086      6      64   ← 整块盘全铺遍了，最贵的一档
     h1 ( 7)               4,121      5      63
     a8 (56)               3,575      5      61
     g8 (62)               3,298      5      56
     b2 ( 9)               1,791      4      47   ← **这一题的顿悟**：紧挨着的斜角要 4 步
     a2 ( 8)                 934      3      28
     b1 ( 1)                 837      3      26
     d4 (27)                 347      2       5   ← 两层就碰上了，波纹只铺了一小圈
     6×6 → (35)            1,360      4      30
     5×5 → (24)            1,247      4      24
     2×2 → ( 3)              100     −1       1   ← 到不了：马在 2×2 上一步都走不出去

   `back` 一栏不列，因为它恒等于 0 —— 见上面「BFS 从不反悔」那一条。

   简报给的两个数（8×8 a1→h8 **3,588** 步、a1→d4 **469** 步）是对着另一份实现
   量的：本文件量出来是 **5,086** 与 **347**，而距离 6 与 2 两边一致。注意这不是
   一个常数倍数 —— 一头比它高、另一头比它低，所以那份实现不是「多写/少写了一行」，
   而是结构不同（多半是教科书那种一条队列的写法：没有 frontier/next 两张表的
   开销，但也没有早停在层内的那一下）。**没有为了对齐那两个数字改代码** ——
   距离才是这道题的答案，步数是实现形态的后果。测出来是多少就报多少。

   离 200,000 的上限还差两个数量级：这一题**永远不会撞墙**，而这本身就是
   跟前两题的对照 —— 回溯是指数的，BFS 是线性的（每格最多被确认一次）。
   规格 §4⑤ 的三段弧线里，它是「做得到」的那一段。

   滑杆边界（W 与 target 的范围）是页面的展示决定，不是本模块的校验边界：
   `source()` 对任何 W ≥ 1、以及任何落在盘上的 start / target 都照常吐源码，
   包括到不了的那些 —— 「到不了」要生成出来跑给她看。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoKnightPath = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= 双语渲染（规格 §1.6 / §7.5）=================

     ⚠ **这一整段在七份 algos/*.js 里逐字节相同**，check.py 的
     bilingual_algos_check() 会核对。改这里就得七份一起改。
     不抽成共用模块，是因为这些文件是被 inline_core.py 当**字符串**逐份
     内联、再各自求值成 AlgoXxx 全局的 —— 抽出去就凭空多一条求值顺序
     依赖，而那类缺陷要到浏览器里 ALGOS['queens.js'] 是 undefined 才发作
     （阶段 5 建页当天撞过一次）。七份重复 + 一道字节级门，是阶段 7
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

  /* 普通字符串拼，不用模板字面量：这段文本本身会被原样贴进 html，
     反引号在那个上下文里比在这里更容易出事（照抄 queens.js 的理由）。

     元素两种：字符串（代码 / 空行 / BLANK 指令行，两语逐字相同）与
     `{ zh: [], en: [] }`（一段散文，两边行数必须相等）—— 见上面 render()。
     英文不是逐句直译，是照中文那一版的意思与语气重写的，行数对齐落在
     「段」上：段内句子怎么重组都行，段的行数必须一样。 */
  const HEAD = [
    {
      zh: [
        '/* ============ 骑士的最短路 · 广度优先搜索 ============',
        '   马走「日」字：横一竖二，或者横二竖一 —— 绕着它站的那一格一共八个方向。',
        '   题目是：从一格走到另一格，最少要几步？',
        '',
        '   格子编号：sq = 行 * W + 列。第 0 行是棋盘最下面那一行，第 0 列是最左边',
        '   那一列 —— 于是 0 号格就是国际象棋里的 a1。',
        '   要反推回去：列 = sq % W，行 = (sq - 列) / W。',
        '',
        '   办法叫「广度优先」：先把一步能到的格子全找出来，再把两步能到的全找出来，',
        '   一层一层往外铺，像往水里丢一颗石子荡开的波纹。',
        '   第一次碰到目标的那一层，层号就是最短步数 —— 因为更近的每一层都已经',
        '   找遍了，目标不在那里面。',
        '',
        '   跟前两道题最大的不同：**它一次也不反悔**。回溯搜索要退回来重走，是因为',
        '   它可能先冲进一条错路；而这一份是按远近铺开的，第一次碰到一格时，那就',
        '   已经是最短的走法了，没有什么可反悔的。 */',
      ],
      en: [
        '/* ============ The Knight’s Shortest Path · Breadth-First Search ============',
        '   A knight moves in an L: one square across and two along, or two and one — eight',
        '   directions around the square it stands on. From one square to another, how few moves?',
        '',
        '   Squares are numbered sq = row * W + column. Row 0 is the bottom row of the board',
        '   and column 0 is the leftmost one — so square 0 is a1 in chess.',
        '   To go the other way: column = sq % W, row = (sq - column) / W.',
        '',
        '   The method is called breadth-first: find every square one move away, then every',
        '   square two moves away, spreading outward a layer at a time, like ripples from a',
        '   stone dropped in water. The layer where the target first appears is the fewest',
        '   moves — every nearer layer was already searched, and the target was not there.',
        '',
        '   The big difference from the previous two puzzles: **it never takes a move back**.',
        '   Backtracking retreats and retries because it can charge into a wrong path; this one',
        '   spreads by distance, so the first arrival at a square is already the shortest way. */',
      ],
    },
    '',
    {
      zh: ['/* 棋盘边长、出发格、目标格。真正的棋盘就是 W = 8。 */'],
      en: ['/* The side of the board, the starting square, the target. A real board is W = 8. */'],
    },
  ];

  const BODY = [
    '',
    {
      zh: [
        '/* 马的八个方向。DX 与 DY 一一对应：第 k 个方向是「横走 DX[k]、竖走 DY[k]」。',
        '   横一竖二四个、横二竖一四个，绕着起点转一圈 —— 这就是「日」字。 */',
      ],
      en: [
        '/* The eight knight directions. DX and DY pair up: direction k is "go DX[k] across',
        '   and DY[k] along" — four are one-across-two-along, four are two-across-one. */',
      ],
    },
    'const DX = [1, 2, 2, 1, -1, -2, -2, -1];',
    'const DY = [2, 1, -1, -2, -2, -1, 1, 2];',
    '',
    {
      zh: [
        '/* 两张备忘表：',
        '     dist[sq]  从出发格走到这一格最少几步；−1 表示还没碰到过它。',
        '     prev[sq]  第一次到达它时，是从哪一格过来的 —— 最后要靠它把路线串回来。',
        '   一格只会被确认一次 —— 这是整道题唯一的规则，别的都是围着它转的脚手架。 */',
      ],
      en: [
        '/* Two lookup tables:',
        '     dist[sq]  fewest moves from the start to this square; −1 means not yet touched.',
        '     prev[sq]  which square we came from the first time — it rebuilds the route later.',
        '   A square is confirmed exactly once — the one rule here; the rest is scaffolding. */',
      ],
    },
    'const dist = [];',
    'const prev = [];',
    'for (let i = 0; i < W * W; i = i + 1) { dist.push(-1); prev.push(-1); }',
    '',
    {
      zh: ['// (x, y) 还在棋盘上吗？出界的方向连看都不用看。'],
      en: ['// Is (x, y) still on the board? A direction that leaves it is not worth a look.'],
    },
    'function onBoard(x, y) {',
    '  // >>> BLANK id=on-board level=1 fill="return false;" hint="四条边都要查：x 要落在 0 到 W−1 之间，y 也一样。少查一条边，波纹就会漫到棋盘外面去 —— 那外面的格子号码根本不存在。" hintEn="All four edges have to be checked: x must land between 0 and W−1, and so must y. Miss one edge and the wave spills off the board, into square numbers that do not exist."',
    '  return x >= 0 && x < W && y >= 0 && y < W;',
    '  // <<< BLANK',
    '}',
    '',
    {
      zh: [
        '/* frontier 是「正好 d 步能到的那一整层格子」。',
        '   这个函数把这一层每一格的八个方向都看一遍：凡是还没碰过的，都属于第 d+1',
        '   层 —— 收齐之后，再对下一层调用自己。递归的每一层，就是棋盘上的一圈波纹，',
        '   所以左边调用栈叠了几帧，右边的波纹就荡开了几圈。',
        '   返回最短步数；这一层之后再也铺不出新格子，就返回 −1（到不了）。 */',
      ],
      en: [
        '/* frontier is "the whole layer of squares reachable in exactly d moves".',
        '   This function checks all eight directions out of every square in that layer; any',
        '   square not yet touched belongs to layer d+1. Collect them, then call itself on that',
        '   layer — each level of recursion is one ripple, so the frames stacked on the left are',
        '   the rings on the right. Returns the fewest moves; −1 if no new square, so no route. */',
      ],
    },
    'function expand(frontier, d) {',
    '  const next = [];',
    '  for (let i = 0; i < frontier.length; i = i + 1) {',
    '    const cur = frontier[i];',
    '    const x = cur % W;',
    '    const y = (cur - x) / W;',
    '    for (let k = 0; k < 8; k = k + 1) {',
    '      const nx = x + DX[k];',
    '      const ny = y + DY[k];',
    '      if (onBoard(nx, ny)) {',
    '        const nb = ny * W + nx;',
    {
      zh: ['        mark(nb, "try");     // 正在看这个邻居：先点亮，再问它是不是第一次碰到'],
      en: ['        mark(nb, "try");     // This neighbour: light it up first, then ask if it is new'],
    },
    '        // >>> BLANK id=seen-test level=1 fill="if (true) {" hint="dist[nb] 记的是「走到这一格最少几步」，−1 的意思是还没碰过它。碰过的就不必再看了。留神出发格记的是 0 —— 它也是碰过的。" hintEn="dist[nb] holds the fewest moves needed to reach that square, and −1 means it has not been touched yet. A square that has been touched needs no second look. Watch out for the starting square: it holds 0, and 0 counts as touched."',
    '        if (dist[nb] >= 0) {',
    '        // <<< BLANK',
    {
      zh: [
        '          /* 早就到过它了。而且更早到达它的那一层比现在这一层近，',
        '             所以从这边再走过去只会更长 —— 看都不用再看。 */',
      ],
      en: [
        '          /* Reached long ago, and the layer that reached it was nearer than',
        '             this one, so going there from here is only longer. Skip it. */',
      ],
    },
    '          mark(nb, "cut");',
    '        } else {',
    {
      zh: [
        '          /* 第一次碰到它。它比这一层正好远一步，而这就是它的最短步数：',
        '             更近的每一层刚才都铺过了，如果有更短的走法，早就碰上了。 */',
      ],
      en: [
        '          /* First time here. It is exactly one move further than this layer,',
        '             and that is its shortest: every nearer layer has been laid out. */',
      ],
    },
    '          dist[nb] = d + 1;',
    '          prev[nb] = cur;',
    '          mark(nb, "ok");',
    '          if (nb === TARGET) {',
    {
      zh: ['            return d + 1;    // 碰上目标了 —— 当场就是答案，剩下的层不用再铺'],
      en: ['            return d + 1;    // Target found — that is the answer; no more layers needed'],
    },
    '          }',
    '          next.push(nb);',
    '        }',
    '      }',
    '    }',
    '  }',
    '  if (next.length === 0) {',
    {
      zh: ['    /* 这一层之后再没有新格子了：能到的都到过了，目标不在其中。 */'],
      en: ['    /* Nothing new after this layer: everything reachable is done, none is the target. */'],
    },
    '    return -1;',
    '  }',
    {
      zh: ['  return expand(next, d + 1);   // 铺下一层 —— 递归就发生在这一行'],
      en: ['  return expand(next, d + 1);   // lay out the next layer — this line is the recursion'],
    },
    '}',
    '',
    {
      zh: ['/* 出发。第 0 层只有出发格自己，它到自己是 0 步。 */'],
      en: ['/* Off we go. Layer 0 holds only the starting square: 0 moves to reach itself. */'],
    },
    'dist[START] = 0;',
    'mark(START, "ok");',
    'let steps = 0;',
    'if (START !== TARGET) {',
    '  steps = expand([START], 0);',
    '}',
    'if (steps < 0) {',
    {
      zh: [
        '  /* 盘上一匹马都不摆：没有路线可摆。−1 不是 0 —— 0 的意思是「已经站在',
        '     目标格上了」，那是完全不同的一件事。 */',
      ],
      en: [
        '  /* Not one knight goes on the board: there is no route to lay out. And −1 is',
        '     not 0 — 0 would mean "already on the target", a completely different thing. */',
      ],
    },
    {
      zh: ['  log("到不了：马从这一格出发，永远走不到目标格");'],
      en: ['  log("Cannot be reached: from this square the knight can never get to the target");'],
    },
    '} else {',
    {
      zh: [
        '  /* 把路线倒着串回来：从目标格顺着 prev 一路退回出发格，每退一格就摆一匹马。',
        '     摆完，盘上那一串马就是一条最短路线本身。',
        '     整趟搜索里盘上一直有东西在长 —— 长的是波纹（mark），不是棋子：',
        '     BFS 里没有任何一匹马在走路，它是同时向所有方向铺开的。 */',
      ],
      en: [
        '  /* Rebuild the route backwards: follow prev from the target square back to the',
        '     start, dropping a knight on every square passed. That string of knights is one',
        '     shortest route. Something grew on the board all through the search — ripples',
        '     (mark), not pieces: no knight walks in BFS, it spreads every way at once. */',
      ],
    },
    '  let at = TARGET;',
    '  for (let i = 0; i <= steps; i = i + 1) {',
    '    place(at, "wN");',
    '    at = prev[at];',
    '  }',
    {
      zh: ['  log("最短 " + steps + " 步（盘上那串马就是其中一条走法）");'],
      en: ['  log("Shortest is " + steps + " moves (the knights on the board are one such route)");'],
    },
    '}',
    'return steps;',
  ];

  /* source({ W, start, target, lang }) → string

     四个参数都不给默认值，缺了直接抛（阶段 5 约束 6：公开导出的省略参数已经
     是本仓库抓到过五次的缺陷类）。一个默默变成 8 的 W 会让界面写着 6、跑的却是
     8，正是这个工具最不能出的错。

     **自身那三个参数的校验仍在最前，`lang` 由 render() 在最后校验**：既有的
     `T.throws(…, /少了 W/)` 一类调用点因此一行都不用动 —— 一个只给了 start /
     target 的调用撞上的仍旧是「少了 W」，不是「少了 lang」。

     校验只管「是不是合法的棋盘和格子」，**不管到不到得了** —— 见文件头：
     2×2 上到不了恰恰是要生成出来跑给她看的。 */
  function source(opts) {
    const o = opts || {};
    if (o.W === undefined || o.W === null) {
      throw new Error('source({ W, start, target }) 少了 W —— 棋盘边长没有默认值，必须写明');
    }
    if (o.start === undefined || o.start === null) {
      throw new Error('source({ W, start, target }) 少了 start —— 出发格没有默认值，必须写明');
    }
    if (o.target === undefined || o.target === null) {
      throw new Error('source({ W, start, target }) 少了 target —— 目标格没有默认值，必须写明');
    }
    const W = o.W, start = o.start, target = o.target;
    if (typeof W !== 'number' || !isFinite(W) || Math.floor(W) !== W || W < 1) {
      throw new Error('W 必须是 >= 1 的整数，收到：' + W);
    }
    if (typeof start !== 'number' || !isFinite(start) || Math.floor(start) !== start ||
        start < 0 || start >= W * W) {
      throw new Error('start 必须是 0 到 ' + (W * W - 1) + ' 之间的整数，收到：' + start);
    }
    if (typeof target !== 'number' || !isFinite(target) || Math.floor(target) !== target ||
        target < 0 || target >= W * W) {
      throw new Error('target 必须是 0 到 ' + (W * W - 1) + ' 之间的整数，收到：' + target);
    }
    return render(HEAD, o.lang)
      .concat([
        'const W = ' + W + ';',
        'const START = ' + start + ';',
        'const TARGET = ' + target + ';',
      ])
      .concat(render(BODY, o.lang))
      .join('\n');
  }

  return { source: source };
});
