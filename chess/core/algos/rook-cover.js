/* 带障碍盘上的**二分图最大匹配**（行段 × 列段）的算法源码生成器（规格 §2.1）。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   跟 `queens.js` / `knight-path.js` / `tour-*.js` / `minimax.js` 是同一个形状：
   这个模块本身不算任何东西 —— 它吐出一段**字符串**。那段字符串同时是喂给
   `Interp.run` 去真跑的程序、和喂给 `Editor.mount` 摆在使用者眼前的那份源码。
   一份字符串两个用途，所以「看到的」和「跑的」不可能漂移。

   **生成出来的那段源码里的注释和命名，是写给一个没学过棋的 16 岁读者的**。
   本文件自己的注释（就是你正在读的这些）是给维护者的，两套读者，两种口吻。

   ---- ⚠ 题面订正：这一段是本文件最重要的一条 ----

   任务简报（`.superpowers/sdd/2026-08-05-chess-phase7-cover-dominate/task-2-brief.md`）
   给的题面是「**用最少的车覆盖所有空格**，最大匹配 = 最少的车数」。
   **后半句不成立**，而且不是边角情形 —— 四档盘里有三档都是反例：

     5×5 `[3,14,17,18,21]`   最大匹配 7，**4 辆车就盖满了**（0, 9, 11, 24）
     6×6 `[0,6,8,9,14,...]`  最大匹配 7，**5 辆车就盖满了**（1, 4, 12, 15, 35）
     6×7 `[4,6,7,8,26,...]`  最大匹配 9，**5 辆车就盖满了**（3, 17, 22, 24, 38）

   （四组落子都用「沿行/列走射线、撞障碍就停」独立验过，一个空格都不漏。
   审查另写了一份与匹配无关的求解器复核过，并在 60 块随机小盘上量到
   **49 块的最少车数严格更小、反向一次都没有** —— 不是边角失误，是几乎
   每块有障碍的盘上都对不上。）

   漏在哪里：一辆车站的是一个**格子**，而格子是二分图里的一条**边** —— 它一次
   占住两个点（一个行段 + 一个列段）。所以 k 辆车能点亮的点数最多是 2k，
   「最少的车数」是 min over 点覆盖 V 的 (|V| − V 内部的最大匹配)，不是 |V| 本身。
   最小的反例只有 2×2：障碍放在 (0,1)，最大匹配 2，而 1 号格上摆一辆车就盖满了
   剩下三格。（König 给的是「最少的**线**」，不是「最少的**车**」；带障碍的车支配
   问题本身是另一路难题，不是匹配能解的。）

   **本文件按「最大匹配」实现**，因为简报的四档盘、判据 `k < min(行段数, 列段数)`、
   增广路的画法、四个 `mark` 种类，全都是围着最大匹配设计的，而且四档的
   **5 / 6 / 7 / 9 与简报表逐格对上**（rook-cover.test.js 拿一份独立的匈牙利实现对拍）。
   改掉的只有**说法**。生成源码的 HEAD 里只写两句站得住的话，两句都恰好等于最大匹配：

     ① 最多能摆几辆**互相吃不到**的车？（这是它在棋盘上的原生说法）
     ② 要盖住每一个空格，最少要点亮几条**线**（行段或列段）？（König 的另一半）

   算完之后盘上那些车**顺手也盖住了每一个空格**（最大匹配一定是极大匹配，
   于是任一空格的行段或列段上必有一辆车），这一条是真的、也验了 ——
   只是「顺手盖住」不等于「最少」。Task 3 的页面文案与规格 §4 的题面都要照这个改，
   否则工具会在**它自己的第二档盘上**教一件错事。

   ---- 几处必须写下来的约定 ----

   · **入口函数叫 `walk`**（对应将来 `PROBLEMS.rookCover.entry`）。它是**递归**
     那一个：`walk(r)` = 给第 r 个行段找一个列段坐下，找不到就去请占着位子的
     行段挪窝 —— 那一串「请人挪窝」就是增广路，**递归深度 = 增广路的长度**。
     顶层是 `for (r) { if (walk(r)) rooks++ } return rooks;`，
     所以 `run().result` 就是最大匹配数。`TreeModel.build(trace, 'walk')`
     认到的帧因此一层套一层，深度塔（§1.4「z 轴 = 入口函数的递归深度」）
     正好是「这条增广路走了几个来回」。

   · **`walk` 是两趟扫描，不是一趟**（先贪心找空位，再递归请人挪窝）。这不是
     优化，是**第一档盘的整个教学点**：空盘上每个行段第一趟就找到空列段，
     `back` 一次都不出现、增广路最深只有 1 层 —— 「匹配根本没上场，这就是
     为什么这道题必须有障碍」看一眼就知道。一趟版的 Kuhn 算法在 5×5 空盘上
     会让车互相挪窝（实测第一档就出现 back），那个对照就没了。
     两趟版仍是精确的匈牙利算法：第一趟找长度 1 的增广路，第二趟找其余的，
     `asked` 访问集照旧。（第二趟里 `takenBy[c] < 0` 的分支不必再写：
     第一趟没返回就说明这一段上每个列段都被占着，而列段一旦被占就再没空过。）

   · **格子编号 `sq = 行 * W + 列`**，行 0 在棋盘最下面、列 0 在最左边，
     于是 0 号格是 a1 —— 跟 `queens.js` / `knight-path.js` / `tour-*.js`、
     `BoardRender.layout()` 的 `squareCenter(file, rank)`、`chess-core.js` 的
     `SQ(file, rank)` 同向。反推是 `列 = sq % W; 行 = (sq - 列) / W`。
     **这一题的盘可以不是正方形**（`W` 与 `H` 分开给），因为四档里有一档是 6×7。

   · **宿主桥接**：`mark(sq, kind)` 四种全用上，而且四种在这一题里各有各的实义：
       'try'  正在试这一格
       'ok'   这一格进了匹配 —— 紧跟着 `place(sq, "wR")`，盘上真站一辆车
       'cut'  这条路走不通（列段这一趟问过了，或者占着它的那位挪不动）
       'back' 一辆车被请下来挪窝 —— 紧跟着 `clear(sq)`，跟 `queens.js` 同一个
              两步节奏：先看到「它退下来了」，下一步它整个消失。
     **`'back'` 在这一题里的意思跟 N 皇后不一样**：N 皇后是「这条支路错了，
     撤销」；这里是「这辆车没错，只是把位子让给别人，它自己已经在别处站好了」。
     `back` 的那一格在**上一步**才刚刚被 `ok` 过 —— 增广路推进的样子就是这个。
     实测 `ok − back = 最后站住的车数`（测试里有这条断言）。

   · **`place(sq, "wR")` 是「数字格子 + 字符串棋子」**，跟 `queens.js` 的 `"wQ"`、
     `knight-path.js` 的 `"wN"` 同一个约定。`BoardRender.drawPiece` 吃的是**数字**
     code，'wR' → 4 的换算归页面做（见 `queens.js` 文件头那一整段，含仓库里
     `tools/_debugger-preview.html` 那个两个参数正好相反的反例）。

   · **最小点覆盖（König 的那些条带）由显示层从轨迹里推**，源码只负责 `mark` ——
     算法里一句显示层的话都没有，**而且不需要为它加一句**。

     怎么推（这条是实测结论，写在这里免得下一个人再去推一遍）：
     **一次失败的顶层 `walk(r)` 本身就是 König 要的那趟交替搜索**。它问过的
     列段（源码里的 `asked`）正是可达集 Z_col；一旦某个行段失败，它的可达集
     就冻结了（标准引理）。于是：
       Z_col = 所有**失败的**顶层 `walk` 问过的列段之并
       Z_row = 那些帧里碰过的行段之并（含失败的根自己）
       最小点覆盖 = （不在 Z_row 里的行段）∪（在 Z_col 里的列段），大小恰好 = k
     从解释器轨迹这一侧读也一样：扫 `depth === 1` 的 `walk` 进出帧，**帧内没有
     `place` 的就是失败帧**，取它 `mark` 过的每一格的 `rowSeg` / `colSeg` 即可
     （帧内的每一格必然在 `asked` 里：失败的根下面不可能有成功的子调用，
     所以两趟都走满了）。205 块盘（4 块夹具 + 推荐档 + 200 块随机）上，
     这两种推法与「拿最终匹配另算一遍 König」三者结果全同，
     且 `(nr − |Z_row|) + |Z_col| = k` 一块都没差。

     **所以不要为了显示层往这段源码里加可达性标记** —— 那等于让学生读的程序
     变长，去重新导出程序已经产出的信息。

   · 子集约束（规格 §2.6）：**没有三元运算符**，`a ? b : c` 会抛 unsupported，
     一律展开成 if/else；数组只有 `push` / `pop` 与下标读写和 `length`
     （`rowCells` 是数组的数组，`rowCells[r].push(s)` 走的是同一条路，合法）。

   ---- 实测（`Interp.STEP_LIMIT` = 200,000）----

   拿本文件生成的源码跑 `Interp.run(src, { host: {} })`，读 `trace.length`
   与 `result`；`mark` 次数与最深调用栈由 rook-cover.test.js 的 `probe()` 量：

     档                            最大匹配  解释器步数  增广路最深  mark 次数(try/ok/cut/back)
     5×5 空盘                          5        722         1        20  (15/5/0/0)
     5×5 [3,14,17,18,21]               7      1,156         6        81  (53/9/17/2)
     6×6 [0,6,8,9,14,20,24,26,27]      7      1,411         4        72  (46/8/17/1)
     6×7 [4,6,7,8,26,31,33,35,37]      9      2,149         7       184 (121/10/52/1)
     8×8 空盘（对照）                  8      1,628         1        44  (36/8/0/0)

   一、三、四档的最大匹配与简报表逐格相同（5 / 7 / 9），那才是答案。
   深度与访问数是实现形态的后果，测出来是多少就报多少（照 `knight-path.js`
   文件头同一条规矩）：简报的「增广路最深 1 / 5 / 4 / 7」本文件量出来是
   1 / 6 / 4 / 7。

   **第二档换过一次**（修复轮 1，控制器裁定）：简报原本给的 `[3,10,13,17,18]`
   在这份实现下**退化了** —— k=6，但 `back = 0`、六辆车全是第一趟贪心直接
   坐下的，一次成功的增广都没发生（它的深度 2 是一次**失败**的尝试），而这
   一档要教的正是「匹配第一次真的做事」。换成 `[3, 14, 17, 18, 21]`：行段/列段
   仍是 8/8、k = 7 < 8、`back = 2`、最深 6 层。（审查另指出：简报给这一档标的
   「增广路最深 5」在**任何贪心优先取空列的实现**里都达不到，那个数本身也是
   错的。）备选还有 `[2, 5, 6, 13, 22]`（8/8、k=7、back=2、最深 7 层、1,178 步）。
   `rook-cover.test.js` 里有一条守卫钉住这件事：三档有障碍的盘都必须 `back > 0`，
   谁再把某一档换回「贪心就能解完」的盘，当场红。

   离上限差两个数量级：这一题**不存在撞墙风险**。四十块 3..6 边长的随机盘
   （固定种子，见测试）里最贵的一块是 **1,460 步**。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoRookCover = factory();
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

     元素两种：字符串（代码 / 空行，两语逐字相同）与 `{ zh: [], en: [] }`
     （一段散文，两边行数必须相等）—— 见上面 render()。这一份**一个挖空
     都没有**，所以没有 BLANK 指令行那一类。
     英文不是逐句直译，是照中文那一版的意思与语气重写的，行数对齐落在
     「段」上：段内句子怎么重组都行，段的行数必须一样。

     ⚠ **题面那两句在英文里也得站住**（见文件头那一整段订正）：只许说
     ①「最多能摆几辆互相吃不到的车」与 ②「盖住每个空格最少要点亮几条线」，
     两句都恰好等于最大匹配。**不许说 "fewest rooks" / "smallest number of
     rooks" / "minimum number of rooks"** 这一族 —— 一辆车是二分图的一条
     **边**，一次占两截，最少车数在四档里有三档严格小于最大匹配。

     ⚠ **这件事只有一半是自动的，另一半是人肉门。**
     `rook-cover.test.js` 那一组断言是**词表门**：它查「英文里没出现列在表里
     的那几种说法」和「英文里出现了 line segment」，仅此而已。修复轮 1 之前
     表里只有两条，审查把 Question two 换成 `the smallest number of rooks`
     （同一个数学错误、换一组词）就**全绿**了；表补长了，但换法列不完，而且
     「line segment 出现在哪句话里」它根本不问。**「题面讲的是不是那两件事」
     要人逐句读**，别看见那几条绿的就以为它证明了题面是对的。

     ⚠ 另一件跟这个工具的读者有关的事：英文里**不要用 `piece` 指「段」**。
     在一个国际象棋工具里 `piece` 就是棋子（`knight-path.js` 的英文版正是
     这么用的），而它会直接撞在「一辆车只管得住它站的那一截」这句上。
     统一用 `segment`（散文里偶尔用 `stretch`），修复轮 1 清掉了八处。 */
  const HEAD = [
    {
      zh: [
        '/* ============ 车、行段与列段 · 最大匹配 ============',
        '   盘上有些格子被障碍占着，车走不过去。于是一行被障碍切成了几截，',
        '   一列也被切成了几截。**一辆车只管得住它站的那一截**：它沿这一行往两边',
        '   看，撞上障碍就停；沿这一列上下看，也是撞上障碍就停。',
        '',
        '   给每一截取个号：',
        '     行段 —— 同一行里被障碍隔开的两截，是两个不同的段，各有各的号。',
        '     列段 —— 同一列里也一样。',
        '   于是每个空格都同时属于一个行段和一个列段，它就是一对号码（行段, 列段）。',
        '   一辆车站上去，等于**同时占住**了这两截。',
        '',
        '   同一件事有两个问法，答案是同一个数 —— 这正是这道题好玩的地方：',
        '',
        '     问法一：最多能摆几辆**互相吃不到**的车？',
        '       两辆车互相吃不到，就是它们不在同一个行段、也不在同一个列段 ——',
        '       写成号码就是：行段号互不相同，列段号也互不相同。',
        '     问法二：要盖住每一个空格，最少要点亮几**截**（行段或列段）？',
        '       盖住一个空格，要么点亮它的行段，要么点亮它的列段。',
        '',
        '   这两个数永远相等，这件事有个名字，叫 König 定理。下面这段程序算的',
        '   就是它 —— 算法上它叫「二分图的最大匹配」。',
        '',
        '   算完之后，盘上站着的那些车还顺手盖住了每一个空格。为什么？随便挑一个',
        '   空格：如果它的行段和列段上都没有车，那这一格自己就还能再摆一辆 ——',
        '   与「最多」矛盾。所以它的行段或列段上一定站着一辆车，也就一定被看到。',
        '   （**注意**：「顺手盖住」不等于「用最少的车盖住」—— 一辆车一次占两截，',
        '   有时候用更少的车也能盖满。这段程序回答的是上面那两个问法。）',
        '',
        '   格子编号：sq = 行 * W + 列。第 0 行是棋盘最下面那一行，第 0 列是最左边',
        '   那一列 —— 于是 0 号格就是国际象棋里的 a1。',
        '   要反推回去：列 = sq % W，行 = (sq - 列) / W。 */',
      ],
      en: [
        '/* ============ Rooks, Row Segments and Column Segments · Maximum Matching ============',
        '   Some squares are taken by walls a rook cannot pass through. So a wall cuts a row into',
        '   segments, and a column too. **A rook rules only the segment it stands on**: it looks',
        '   both ways down that row and that column, stopping the moment it meets a wall.',
        '',
        '   Give every segment a number: a row segment is a stretch of one row cut off by walls,',
        '   with a number of its own; a column segment is the same inside a column. Every empty',
        '   square then belongs to a row segment and a column segment at the same time — it is a',
        '   pair of numbers (row segment, column segment), and a rook there takes **both at once**.',
        '',
        '   The same thing can be asked two ways, and the answer is the same number — the fun bit:',
        '',
        '     Question one: at most how many rooks fit with **no two able to capture each other**?',
        '       Two rooks cannot capture each other exactly when they share no row segment and',
        '       no column segment — in numbers: all row numbers differ, all column numbers differ.',
        '     Question two: to cover every empty square, how few **line segments** (row or column)',
        '       must be lit up? To cover a square, light up its row segment or its column segment.',
        '',
        '   These two numbers are always equal, and that fact has a name: König’s theorem. The',
        '   program below computes it — in algorithm terms, maximum matching in a bipartite graph.',
        '',
        '   Once done, the rooks left standing also happen to cover every empty square. Why? Take',
        '   an empty square: if neither of its two segments held a rook, one more rook could stand',
        '   right there — contradicting "at most". So one of the two does hold one, and it is seen.',
        '   (**Note**: happening to cover is not the same as covering with as few rooks as',
        '   possible — one rook takes two segments at once, so fewer rooks sometimes cover',
        '   everything too. What this program answers is the two questions above.)',
        '',
        '   Squares are numbered sq = row * W + column. Row 0 is the bottom row of the board and',
        '   column 0 is the leftmost one — so square 0 is a1 in chess.',
        '   To go the other way: column = sq % W, row = (sq - column) / W. */',
      ],
    },
    '',
    {
      zh: [
        '/* 棋盘的宽和高，以及障碍格的编号 —— 这道题的全部旋钮。',
        '   把 BLOCKED 清空试试：空盘上答案恒等于 min(W, H)，每行摆一个、摆哪都行，',
        '   匹配根本没上场。**这道题必须有障碍**，障碍把行和列切开，才有得可算。 */',
      ],
      en: [
        '/* The width and height of the board, and the numbers of the walled squares — every knob.',
        '   Try emptying BLOCKED: a bare board answers min(W, H) — one rook per row, anywhere,',
        '   matching unused. **Walls are needed**: they cut rows and columns, so there is work. */',
      ],
    },
  ];

  const BODY = [
    '',
    {
      zh: [
        '/* 哪些格子走不过去。wall[sq] = 1 就是障碍。 */',
      ],
      en: [
        '/* Which squares cannot be walked through. wall[sq] = 1 means a wall. */',
      ],
    },
    'const wall = [];',
    'for (let i = 0; i < W * H; i = i + 1) { wall.push(0); }',
    'for (let i = 0; i < BLOCKED.length; i = i + 1) { wall[BLOCKED[i]] = 1; }',
    '',
    {
      zh: [
        '/* 给每一截编号 —— 这是整道题唯一的抽象跳跃，慢一点看。',
        '   一行从左往右扫，手里攥着「当前这一截的号」：',
        '     碰到障碍，就把它扔掉（写成 −1），下一个空格要开一段**新的**；',
        '     碰到空格，手里没号就领一个新号，然后把这一格记在这个号下面。',
        '   所以**同一行里被障碍隔开的两截，是两个不同的段** —— 它们的号不一样，',
        '   因为一辆车管不到障碍那一边去。列也照这个法子，从下往上扫一遍。 */',
      ],
      en: [
        '/* Numbering the segments — the one abstract jump in this puzzle, so take it slowly.',
        '   Scan a row left to right, holding the number of the segment you are in right now:',
        '     hit a wall, throw it away (write −1); the next empty square opens a **new** one.',
        '     On an empty square, take a number if you have none, and log the square under it.',
        '   So **two stretches of one row split by a wall are two different segments**, with',
        '   different numbers: a rook cannot reach past a wall. Columns: the same, bottom up. */',
      ],
    },
    {
      zh: [
        'const rowSeg = [];    // rowSeg[sq]：这一格属于第几个行段',
        'const colSeg = [];    // colSeg[sq]：这一格属于第几个列段',
      ],
      en: [
        'const rowSeg = [];    // rowSeg[sq]: which row segment this square belongs to',
        'const colSeg = [];    // colSeg[sq]: which column segment this square belongs to',
      ],
    },
    'for (let i = 0; i < W * H; i = i + 1) { rowSeg.push(-1); colSeg.push(-1); }',
    '',
    {
      zh: [
        'const rowCells = [];  // rowCells[r]：第 r 个行段里的所有空格，从左到右',
        'let nr = 0;           // 一共切出了几个行段',
      ],
      en: [
        'const rowCells = [];  // rowCells[r]: every empty square of row segment r, left to right',
        'let nr = 0;           // how many row segments the board was cut into',
      ],
    },
    'for (let y = 0; y < H; y = y + 1) {',
    {
      zh: [
        '  let cur = -1;       // −1 = 手里没号（刚起头，或者刚撞上障碍）',
      ],
      en: [
        '  let cur = -1;       // −1 = no number in hand (just started, or just hit a wall)',
      ],
    },
    '  for (let x = 0; x < W; x = x + 1) {',
    '    const s = y * W + x;',
    '    if (wall[s] === 1) {',
    {
      zh: [
        '      cur = -1;       // 障碍把这一行截断了：下一个空格要开一段新的',
      ],
      en: [
        '      cur = -1;       // a wall cuts the row here: the next empty square starts a new one',
      ],
    },
    '    } else {',
    '      if (cur < 0) { cur = nr; nr = nr + 1; rowCells.push([]); }',
    '      rowSeg[s] = cur;',
    '      rowCells[cur].push(s);',
    '    }',
    '  }',
    '}',
    '',
    {
      zh: [
        'let nc = 0;           // 一共切出了几个列段',
      ],
      en: [
        'let nc = 0;           // how many column segments the board was cut into',
      ],
    },
    'for (let x = 0; x < W; x = x + 1) {',
    '  let cur = -1;',
    '  for (let y = 0; y < H; y = y + 1) {',
    '    const s = y * W + x;',
    '    if (wall[s] === 1) {',
    '      cur = -1;',
    '    } else {',
    '      if (cur < 0) { cur = nc; nc = nc + 1; }',
    '      colSeg[s] = cur;',
    '    }',
    '  }',
    '}',
    {
      zh: [
        'log("这块盘被切成了 " + nr + " 个行段、" + nc + " 个列段");',
      ],
      en: [
        'log("This board is cut up — row segments: " + nr + ", column segments: " + nc + ".");',
      ],
    },
    '',
    {
      zh: [
        '/* 两张记录表，记「每个列段现在被哪个行段占着」。',
        '     takenBy[c]  占着第 c 个列段的行段号；−1 = 还空着',
        '     rookAt[c]   那一对占住之后，车具体站在哪一格',
        '   只按列段记就够了：一辆车占的是「一个行段 + 一个列段」这么一对，',
        '   按列段记完，行段那一头也就跟着记住了。 */',
      ],
      en: [
        '/* Two lookup tables recording which row segment currently holds each column segment.',
        '     takenBy[c]  the row segment holding column segment c; −1 = still free',
        '     rookAt[c]   once that pair is taken, the exact square the rook stands on',
        '   Keeping it by column segment alone is enough: a rook takes a pair, one row segment',
        '   plus one column segment, so recording the column end records the row end as well. */',
      ],
    },
    'const takenBy = [];',
    'const rookAt = [];',
    'for (let i = 0; i < nc; i = i + 1) { takenBy.push(-1); rookAt.push(-1); }',
    '',
    {
      zh: [
        '/* 这一趟里已经问过的列段。给每个新的行段找位子之前都要清零 ——',
        '   不清零，上一趟问过的列段这一趟就再也不会被问；',
        '   而在同一趟里问过的绝不能再问第二次，否则会绕圈子绕不出来。 */',
      ],
      en: [
        '/* Column segments already asked on this pass. Cleared before each new row segment goes',
        '   looking for a seat — without clearing, a column asked last pass would never be asked',
        '   again; and asking one twice on the same pass sends the search round in circles. */',
      ],
    },
    'const asked = [];',
    'for (let i = 0; i < nc; i = i + 1) { asked.push(0); }',
    '',
    {
      zh: [
        '/* 给第 r 个行段找一个列段坐下。坐下了返回 true。',
        '',
        '   分两趟看这一段上的每个空格：',
        '     第一趟 —— 有没有哪一格，它的列段**还空着**？有就直接坐下，谁也不惊动。',
        '     第二趟 —— 都被占了。那就挑一个，去请占着它的那个行段挪窝：那个行段',
        '                自己再去找别的列段（这就是递归）。它要是挪成了，这个列段',
        '                就腾出来了 —— 原来站在这儿的车退下来，我这一辆站上去。',
        '',
        '   第二趟这一串「我要这个列段 → 占它的那位挪去别处 → 别处又腾出来……」，',
        '   在棋盘上看就是一条**横一段、竖一段交替走**的路。它有个名字叫增广路：',
        '   走通一次，站住的车就正好多一辆（中间那些车只是换了格子，没有多也没有少）。',
        '   左边调用栈叠了几帧，右边这条路就交替走了几个来回。 */',
      ],
      en: [
        '/* Find a column segment for row segment r to sit on. Returns true once it has sat down.',
        '',
        '   Every empty square of this segment gets looked at twice, in two passes:',
        '     Pass one — any square whose column segment is **still free**? Sit down; nobody moves.',
        '     Pass two — all taken. Pick one and ask the row segment holding it to move house: it',
        '                goes off to find a column segment of its own (that is the recursion). If',
        '                it moves, this column frees up — that rook steps down and mine steps up.',
        '',
        '   That pass-two chain (I want this column → its holder moves away → that frees a seat →',
        '   ...) is, on the board, a path alternating **one row segment, one column segment**. Its',
        '   name is an augmenting path: walk one and exactly one more rook stands (the ones in',
        '   between only changed squares). Frames on the left = round trips on the right. */',
      ],
    },
    'function walk(r) {',
    '  const cells = rowCells[r];',
    '  for (let i = 0; i < cells.length; i = i + 1) {',
    '    const s = cells[i];',
    '    const c = colSeg[s];',
    {
      zh: [
        '    mark(s, "try");         // 正在试这一格',
      ],
      en: [
        '    mark(s, "try");         // trying this square right now',
      ],
    },
    '    if (takenBy[c] < 0) {',
    {
      zh: [
        '      // 这个列段还空着 —— 一步到位，车就摆在这儿。',
      ],
      en: [
        '      // This column segment is still free — one step and the rook goes right here.',
      ],
    },
    '      takenBy[c] = r;',
    '      rookAt[c] = s;',
    '      mark(s, "ok");',
    '      place(s, "wR");',
    '      return true;',
    '    }',
    '  }',
    '  for (let i = 0; i < cells.length; i = i + 1) {',
    '    const s = cells[i];',
    '    const c = colSeg[s];',
    '    mark(s, "try");',
    '    if (asked[c] === 1) {',
    {
      zh: [
        '      mark(s, "cut");       // 这个列段这一趟已经问过了，再问只会绕圈',
      ],
      en: [
        '      mark(s, "cut");       // this column was already asked this pass; asking again loops',
      ],
    },
    '    } else {',
    {
      zh: [
        '      asked[c] = 1;         // 先记下「问过了」，再去问 —— 顺序反了就会绕圈',
      ],
      en: [
        '      asked[c] = 1;         // mark it asked before asking — the other order loops',
      ],
    },
    '      if (walk(takenBy[c])) {',
    {
      zh: [
        '        /* 占着这个列段的那位挪走了，而且它已经在别处站好了自己那辆车。',
        '           把原来站在这儿的车请下来，换我这一辆站上去。',
        '           注意这里**没有谁被撤销**：退下来的那辆车只是换了个格子。 */',
      ],
      en: [
        '        /* The row segment holding this column moved away, and already has its own rook',
        '           standing somewhere else. So the rook that was here steps down, mine steps up.',
        '           Note that **nothing is being undone**: that rook only changed squares. */',
      ],
    },
    '        const old = rookAt[c];',
    '        mark(old, "back");',
    '        clear(old);',
    '        takenBy[c] = r;',
    '        rookAt[c] = s;',
    '        mark(s, "ok");',
    '        place(s, "wR");',
    '        return true;',
    '      } else {',
    {
      zh: [
        '        mark(s, "cut");     // 这条路走不通：那位挪不动。换下一个列段试',
      ],
      en: [
        '        mark(s, "cut");     // dead end: that one cannot move. Try the next column segment',
      ],
    },
    '      }',
    '    }',
    '  }',
    {
      zh: [
        '  return false;             // 每个列段都试过了 —— 这个行段这一趟没位子',
      ],
      en: [
        '  return false;             // every column tried — no seat for this row segment this pass',
      ],
    },
    '}',
    '',
    {
      zh: [
        '/* 一个行段一个行段地来，每一趟都从「把问过的记号清零」开始。',
        '   跑完之后 rooks 里就是答案：既是「最多能摆几辆互相吃不到的车」，',
        '   也是「盖住所有空格最少要点亮几截」。 */',
      ],
      en: [
        '/* One row segment at a time, each pass starting by clearing the asked marks.',
        '   When it finishes, rooks holds the answer: it is both "at most how many rooks can stand',
        '   without capturing" and "how few line segments it takes to cover every empty square". */',
      ],
    },
    'let rooks = 0;',
    'for (let r = 0; r < nr; r = r + 1) {',
    '  for (let i = 0; i < nc; i = i + 1) { asked[i] = 0; }',
    '  if (walk(r)) {',
    '    rooks = rooks + 1;',
    {
      zh: [
        '    log("第 " + rooks + " 辆车站住了（第 " + r + " 个行段找到了自己的列段）");',
      ],
      en: [
        '    log("Rook no. " + rooks + " stands (row segment " + r + " found its column segment)");',
      ],
    },
    '  }',
    '}',
    'return rooks;',
  ];

  /* source({ W, H, blocked, lang }) → string

     四个参数都不给默认值，缺了直接抛（阶段 5 约束 6：公开导出的省略参数已经
     是本仓库抓到过八次的缺陷类）。一个默默变成 8 的 W 会让界面写着 6、跑的却是
     8，正是这个工具最不能出的错；而一个默默变成 `[]` 的 blocked 更糟 ——
     空盘是这道题的**假题**（答案恒等于 min(W, H)，匹配根本没上场），
     悄悄退化成假题的演示教不了任何东西。`lang` 同理：这个工具**默认英文界面**，
     一个默默变成 'zh' 的 lang 就是让英文使用者读一份中文源码。

     **自身那三个参数的校验仍在最前，`lang` 由 render() 在最后校验**，而这个
     顺序**是有门守着的**：`rook-cover.test.js` 的「缺参数当场抛」那一组
     **一个 lang 都不传**，并且每条都带第三参 pattern（`/少了 W/`、
     `/少了 blocked/` …）。把 lang 的校验挪到 W 前面来，那一组当场红 ——
     撞上的会变成「少了 lang」，pattern 对不上。

     校验只管「是不是一块合法的盘、障碍是不是都落在盘上」，**不管盘上还剩不剩
     空格**：整块盘都是障碍要照常吐出源码（答案 0），那是一条要跑给她看的边界。 */
  function source(opts) {
    const o = opts || {};
    if (o.W === undefined || o.W === null) {
      throw new Error('source({ W, H, blocked }) 少了 W —— 棋盘宽度没有默认值，必须写明');
    }
    if (o.H === undefined || o.H === null) {
      throw new Error('source({ W, H, blocked }) 少了 H —— 棋盘高度没有默认值，必须写明');
    }
    if (o.blocked === undefined || o.blocked === null) {
      throw new Error('source({ W, H, blocked }) 少了 blocked —— 障碍格没有默认值，必须写明；' +
                      '空盘请显式传 []（那是这道题的假题，要写出来才算数）');
    }
    const W = o.W, H = o.H, blocked = o.blocked;
    if (typeof W !== 'number' || !isFinite(W) || Math.floor(W) !== W || W < 1) {
      throw new Error('W 必须是 >= 1 的整数，收到：' + W);
    }
    if (typeof H !== 'number' || !isFinite(H) || Math.floor(H) !== H || H < 1) {
      throw new Error('H 必须是 >= 1 的整数，收到：' + H);
    }
    if (!Array.isArray(blocked)) {
      throw new Error('blocked 必须是一个数组（障碍格编号），收到：' + typeof blocked);
    }
    for (let i = 0; i < blocked.length; i++) {
      const s = blocked[i];
      if (typeof s !== 'number' || !isFinite(s) || Math.floor(s) !== s || s < 0 || s >= W * H) {
        throw new Error('blocked 里的格子必须是 0 到 ' + (W * H - 1) + ' 之间的整数，收到：' + s);
      }
    }
    return render(HEAD, o.lang)
      .concat([
        'const W = ' + W + ';',
        'const H = ' + H + ';',
        'const BLOCKED = [' + blocked.join(', ') + '];',
      ])
      .concat(render(BODY, o.lang))
      .join('\n');
  }

  return { source: source };
});
