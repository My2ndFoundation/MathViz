/* 带障碍盘上「最少的王支配所有空格」的**贪心**算法源码生成器（规格 §2.1）。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   跟 `queens.js` / `knight-path.js` / `tour-*.js` / `rook-cover.js` 是同一个形状：
   这个模块本身不算任何东西 —— 它吐出一段**字符串**。那段字符串同时是喂给
   `Interp.run` 去真跑的程序、和喂给 `Editor.mount` 摆在使用者眼前的那份源码。
   一份字符串两个用途，所以「看到的」和「跑的」不可能漂移。

   **生成出来的那段源码里的注释和命名，是写给一个没学过棋的 16 岁读者的**。
   本文件自己的注释（就是你正在读的这些）是给维护者的，两套读者，两种口吻。

   ---- 这一份和 `king-exact.js` 是一对，不是两个工具 ----

   规格 §4⑤ 的落点是「同一个问题、同一块盘、两份可以逐行对比的源码」并排显示：
   一个 `PROBLEMS` 键、两条轨道，不是两个 tab。两份共用的那一整段
   （建墙表、列空格、建覆盖表、`seen`/`left`、`put()`）**逐字节相同**，
   两条横线之间的东西一个字都不许差：

     '/* ===== 从这里到下面那条分水岭为止，两份源码逐字相同 ===== *' + '/'
     '/* ===== 分水岭：从这里往下两份不一样了 —— 差的就是「挑哪个王」 ===== *' + '/'

   横线本身也是生成源码的一部分，摆在她眼前 —— 并排看的时候，上半截逐行
   对得上，横线以下才开始分岔。`king.test.js` 有一道门逐字节比这一段。

   **改动共用文本必须同步改 `king-exact.js`。**

   ---- 阶段 5 那道「逐行子序列」的门在这里**不适用**（这一条要写下来）----

   `tour-dfs` / `tour-warnsdorff` 那一对有一道机器门：剥掉注释与空行之后，
   朴素那份的每一行必须**按原顺序**出现在 Warnsdorff 那份里。那道门成立的
   前提是两份是**包含关系** —— Warnsdorff 就是朴素回溯多插了一个 `degree()`
   和一段排序，别的一个字没动。

   这一对不是包含关系，而且**两个方向都不是**：
     · 贪心有 `bestGain` 那段擂台（谁新照顾到的格子多谁上），精确没有；
     · 精确有 `take()`（把王收回去）、有 `limit`、有外面那圈迭代加深的
       while 循环，贪心一个都没有。
   硬套那道门只会得到一条恒红的断言；要让它绿就得把两份写成一份，
   那就没有两个算法了。所以这里换成一道**方向正确的**门：共用段逐字节相同，
   横线以下必须真的分岔（`king.test.js` 里那一节两头都钉着）。
   两道门守的是同一件事 —— 她把两边一 diff，diff 出来的正好是那个主意本身。

   ---- 这道题的落点：**为什么现实里要用贪心** ----

   前面五个工具都在讲「算法怎么跑」。这一题的第四档讲的是另一件事：
   7×7 上精确解**跑不完**，而贪心一眨眼给出 8。于是我们并不知道 8 是不是最优 ——
   **`null` 是「不知道」，绝不许在任何一处变成数字**（工具⑤ 全页的规矩，
   阶段 6 为这类情形建了整套 `unknown` 通道，照它的既有呈现）。

   顺带一条实测，它订正了规格原写的「差距可见」：**矩形空盘上两份完全相同**
   （4×4 / 5×5 / 5×6 / 6×6 / 6×7 / 7×7 / 7×8 / 8×8 八种全同，8×8 都是 9）。
   空盘上王的结构太规整，贪心自然挑中 3×3 块的中心，那恰好最优。
   **差距只在有墙的时候才出现** —— 所以四档盘里没有一块空盘。

   **但「墙越多贪心越吃亏」是错的**（这一条写下来，因为生成源码里一度就是
   这么写给读者的，被自己的四档数据证伪：7 堵墙那档差距 2，3 堵墙的
   `[1,4,24]` 差距 4）。6×6 上按墙数各随机采 40 块，实测平均差距：

     墙数    0     2     3     5     7     9    12
     平均  0.00  0.78  0.72  0.88  1.05  0.68  0.55
     最大    0     2     3     2     3     3     2

   差距在「没有墙 → 有墙」之间跳一次，之后**基本持平，墙很多时反而回落**
   （墙一多，空格连成的块本身就小了，贪心不容易挑错）。
   决定吃多大亏的是**墙摆在哪儿**，不是摆了几堵。

   顺带一条给下一个挑档的人：`[1,4,24]` 的差距 **4** 比上面 280 块随机盘里
   的最大值（3）还大 —— 它是**特意挑出来的极端档**，不是典型盘。
   四档要的是把现象演清楚，不是给出平均值；但别把它当成「6×6 上常见如此」。

   ---- 几处必须写下来的约定 ----

   · **入口函数叫 `cover`，两份同名同义**（对应将来 `PROBLEMS.kingDominate.entry`，
     一个名字两条轨道共用）：`cover(n)` = 「已经摆了 n 个王，接着往下摆」。
     它是**递归**那一个，不是外壳 —— `TreeModel.build(trace, 'cover')` 认到的
     帧要一层套一层，§1.4 的「z 轴 = 入口函数的递归深度」才立得起来。
     两条轨道上那根轴因此是同一个意思：**已经摆了几个王**。
     顶层是 `const kings = cover(0); … return kings;`，所以 `run().result`
     就是贪心用掉的王数。

   · **王的九宫不管墙**：王是跨格照顾的，中间隔着什么都一样 —— 挨着就是挨着。
     这跟 `rook-cover.js` 里「车撞上障碍就停」正好相反，别把那条搬过来。
     墙本身**不需要被照顾**（照顾的是空格），王也**站不上**墙。

   · **覆盖表是对称的**：s 照顾得到 t，t 也照顾得到 s（「挨着」是相互的）。
     精确那一份整个搜索都架在这条上面 —— 能照顾到某一格的王，只可能站在
     那一格的九宫里，于是候选最多九个。共用段里那句注释就是为它写的。

   · **格子编号 `sq = 行 * W + 列`**，行 0 在棋盘最下面、列 0 在最左边，
     于是 0 号格是 a1 —— 跟 `queens.js` / `knight-path.js` / `tour-*.js` /
     `rook-cover.js`、`BoardRender.layout()` 的 `squareCenter(file, rank)`、
     `chess-core.js` 的 `SQ(file, rank)` 同向。
     反推是 `列 = sq % W; 行 = (sq - 列) / W`。**盘可以不是正方形**
     （`W` 与 `H` 分开给），照 `rook-cover.js` 的先例。

   · **宿主桥接**：这一份只用三种 mark，**没有 'back'，而这正是它的性格**：
       'try'  正在掂量这一格能新照顾到几格
       'cut'  比不过擂主，出局（老擂主被顶下去时也吃这一记）
       'ok'   这一格上真的摆一个王 —— 紧跟着 `place(sq, "wK")`
     **贪心从不反悔**，所以一次 `clear` 都不会发生，'back' 一次都不出现。
     精确那一份反过来：它没有 'cut'（不淘汰任何候选，每一个都真的摆上去试），
     只有 try / ok / back。少的那一种 mark 本身就是一句话 —— 同一条先例见
     `knight-path.js` 的文件头（BFS 从不反悔）。`king.test.js` 两头都钉着。

   · **`place(sq, "wK")` 是「数字格子 + 字符串棋子」**，跟 `queens.js` 的
     `"wQ"`、`rook-cover.js` 的 `"wR"` 同一个约定。`BoardRender.drawPiece`
     吃的是**数字** code，'wK' → code 的换算归页面做（见 `queens.js` 文件头
     那一整段，含仓库里 `tools/_debugger-preview.html` 那个两个参数正好相反
     的反例）。

   · **并列时取编号小的那一格，这是算法的一部分，不是实现细节。**
     写下来是因为它被验过一次：把扫描序倒过来（同样是「挑最划算的」），
     6×6 `[6,24,35]` 上贪心从 **6** 变成 **5**，6×6 `[1,4,24]` 上从 **8** 变成
     **5** —— 换了序就是另一个算法，两档的教学内容（差距 2 与差距 4）也就没了。
     `king.test.js` 的宿主侧参照因此**不换扫描序**，它的独立性靠
     「按几何现算 vs 查覆盖表」拿到。
     （这是对简报「贪心用不同的扫描序」那句话的一处订正。精确那一份反过来：
     换序不影响答案，所以它的参照**换了**目标格与候选的顺序。）

   · 子集约束（规格 §2.6）：**没有三元运算符**，`a ? b : c` 会抛 unsupported，
     一律展开成 if/else；数组只有 `push` / `pop` 与下标读写和 `length`
     （`covers` 是数组的数组，`covers[s].push(t)` 走的是同一条路，合法）。

   ---- 实测（`Interp.STEP_LIMIT` = 200,000）----

   见 `king-exact.js` 文件头那张表 —— 四档的两边数字放在一起才读得懂，
   所以只在那一份里写一次（**第三档换过一次**，理由也在那里）。
   这一份要记住的只有一句：**贪心四档全部跑得完**，四档分别 3,983 / 8,154 /
   9,625 / 13,578 步，最贵的一档只占 200,000 上限的 6.8%。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoKingGreedy = factory();
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

     ⚠ **英文里也不许说「贪心那个数是最优的」**（这道题的落点见文件头）：
     第四档 7×7 上精确解撞上限，贪心给出 8，工具**没有证明**它最优。
     这一份英文自己那句是 `it does not promise the fewest`，否定式。 */

  /* ==== 以下 HEAD 与 king-exact.js 的 HEAD **行数相同**，
     只有第 1 行的标题和第 9–10 行讲「这一份 / 另一份」的两行不同 ——
     **两种语言下都得如此**：`king.test.js` 那道 headDiff 门（只许第 1/9/10
     行不同）阶段 8 起两种语言各跑一次，英文漏改一份会当场红。 ==== */
  const HEAD = [
    {
      zh: [
        '/* ============ 王的支配集 · 贪心 ============',
        '   王走一步能到旁边八个格子里的任何一个。所以一个王站在某一格上，连同它',
        '   自己站的这一格，一共「照顾」到九格 —— 围着它的一个九宫。',
        '   （靠边、靠角的时候九宫会缺一块，出界的那几格不算。）',
        '',
        '   盘上有些格子是墙：墙上站不了王，也不用照顾墙 —— 要照顾的是所有空格。',
        '   题目是：**最少要几个王，才能让每一个空格都被照顾到？**',
        '',
        '   这一份：**每一步都挑当下最划算的那一格**，挑完就定，绝不反悔（这叫贪心）。',
        '   另一份：把所有摆法都试一遍，一个不漏，所以它说得出「最少」（那叫精确解）。',
        '',
        '   格子编号：sq = 行 * W + 列。第 0 行是棋盘最下面那一行，第 0 列是最左边',
        '   那一列 —— 于是 0 号格就是国际象棋里的 a1。',
        '   要反推回去：列 = sq % W，行 = (sq - 列) / W。 */',
      ],
      en: [
        '/* ============ King Domination · Greedy ============',
        '   A king steps one square to any of the eight around it. So a king standing somewhere',
        '   "looks after" nine squares, its own included — a 3×3 block centred on where it stands.',
        '   (Along an edge or in a corner that block is clipped: squares off the board do not count.)',
        '',
        '   Some squares are walls: no king stands on a wall, and no wall needs looking after —',
        '   the empty squares do. **How few kings can look after all of them at once?**',
        '',
        '   This one: **take the square that pays off most right now**, and never take it back (greed).',
        '   The other one: try every arrangement, missing none, so it can say "fewest" (exact search).',
        '',
        '   Squares are numbered sq = row * W + column. Row 0 is the bottom row of the board and',
        '   column 0 is the leftmost one — so square 0 is a1 in chess.',
        '   To go the other way: column = sq % W, row = (sq - column) / W. */',
      ],
    },
    '',
    {
      zh: [
        '/* 棋盘的宽和高，以及墙在哪儿 —— 这道题的全部旋钮。',
        '   把 BLOCKED 清空试试：**空盘上两份给出的数一模一样**（4×4 到 8×8 八种',
        '   尺寸实测全同）。空盘上王的位置太规整，贪心随手就挑中最优的那几格。',
        '   差距只在有墙的时候才出现，而且看的是**墙摆在哪儿**，不是摆了几堵 ——',
        '   同样是 6×6、同样三堵墙，只把墙挪个位置，贪心就从 6 个变成 8 个。 */',
      ],
      en: [
        '/* The width and height of the board, and where the walls are — every knob this puzzle has.',
        '   Try emptying BLOCKED: **on a bare board the two give exactly the same number** (measured',
        '   on all eight sizes from 4×4 to 8×8). Kings sit so regularly there that greed cannot help',
        '   landing on the best squares. A gap shows up only with walls, and what counts is not how',
        '   many there are but **where they sit**: same 6×6, three walls moved — greed goes 6 to 8. */',
      ],
    },
  ];

  /* ==== 以下 COMMON 与 king-exact.js 的 COMMON **逐字节相同** ====
     king.test.js 有一道门比这一段（两条横线之间，含横线本身），
     阶段 8 起**两种语言各比一次** —— 只改一份的英文，那道门当场红。
     改这里必须同步改那一份，中英两边都是。

     ⚠ 两条横线本身是注释，所以它们跟着语言换文本；`king.test.js` 里的
     MARKS 表存着两语各自的那两条，对不上就是「找不到横线」当场红。 */
  const COMMON = [
    '',
    {
      zh: [
        '/* ===== 从这里到下面那条分水岭为止，两份源码逐字相同 ===== */',
      ],
      en: [
        '/* ===== From here down to the divide below, the two sources read word for word alike ===== */',
      ],
    },
    '',
    {
      zh: [
        '/* 哪些格子是墙。wall[sq] = 1 就是墙 —— 王站不上去，也不用照顾它。 */',
      ],
      en: [
        '/* Which squares are walls. wall[sq] = 1 is a wall: no king on it, and none looks after it. */',
      ],
    },
    'const wall = [];',
    'for (let i = 0; i < W * H; i = i + 1) { wall.push(0); }',
    'for (let i = 0; i < BLOCKED.length; i = i + 1) { wall[BLOCKED[i]] = 1; }',
    '',
    {
      zh: [
        '/* 盘上所有的空格。要照顾到的就是这些格子，一个都不能漏。 */',
      ],
      en: [
        '/* Every empty square on the board. These are the ones to look after; none may be missed. */',
      ],
    },
    'const empty = [];',
    'for (let s = 0; s < W * H; s = s + 1) {',
    '  if (wall[s] === 0) { empty.push(s); }',
    '}',
    {
      zh: [
        'log("这块盘上有 " + empty.length + " 个空格要照顾");',
      ],
      en: [
        'log("Empty squares on this board to look after: " + empty.length + ".");',
      ],
    },
    '',
    {
      zh: [
        '/* 覆盖表：covers[s] 就是「一个王站在 s 上，能照顾到哪些空格」。',
        '   王往八个方向各走一格，再加上它自己站的这一格 —— 一共九格，围成一个九宫。',
        '   出界的不算，墙也不算（墙不用照顾）。所以边上、角上的九宫会缺一块。',
      ],
      en: [
        '/* The cover table: covers[s] is "which empty squares a king standing on s looks after".',
        '   Eight steps out plus its own square: nine in all, a 3×3 block. Squares off the board',
        '   do not count, nor do walls (none needs looking after), so edges and corners are clipped.',
      ],
    },
    '',
    {
      zh: [
        '   **王的九宫不管墙挡不挡**：挨着就是挨着，中间隔着什么都一样。',
        '   （车不是这样的：车沿直线看出去，撞上墙就停。两道题别搞混。）',
      ],
      en: [
        '   **A king\'s 3×3 block ignores walls**: next to is next to, whatever lies between.',
        '   (A rook is not like this: it looks along a line and stops at a wall. Do not mix them up.)',
      ],
    },
    '',
    {
      zh: [
        '   这张表是**对称的**：s 照顾得到 t，t 就一定照顾得到 s —— 因为「挨着」',
        '   是相互的。这条待会儿有大用：**能照顾到某一格的王，就站在那一格的九宫里**，',
        '   所以想管住某一格，候选最多只有九个。 */',
      ],
      en: [
        '   This table is **symmetric**: s looks after t exactly when t looks after s — "next to"',
        '   goes both ways. That pays off soon: **a king looking after a square stands inside that',
        '   square’s own block**, so any one square has at most nine candidates to look after it. */',
      ],
    },
    'const covers = [];',
    'for (let s = 0; s < W * H; s = s + 1) { covers.push([]); }',
    'for (let i = 0; i < empty.length; i = i + 1) {',
    '  const s = empty[i];',
    '  const x = s % W;',
    '  const y = (s - x) / W;',
    '  for (let dy = -1; dy <= 1; dy = dy + 1) {',
    '    for (let dx = -1; dx <= 1; dx = dx + 1) {',
    '      const nx = x + dx;',
    '      const ny = y + dy;',
    '      if (nx >= 0 && nx < W && ny >= 0 && ny < H) {',
    '        const t = ny * W + nx;',
    '        if (wall[t] === 0) { covers[s].push(t); }',
    '      }',
    '    }',
    '  }',
    '}',
    '',
    {
      zh: [
        '/* 两个记录：',
        '     seen[sq]  现在有几个王照顾着这一格',
        '     left      还有几个空格一个王都没照顾到',
        '   记「几个」而不是「有没有」，是因为王有可能被收回去（精确那一份会收）——',
        '   收回去之后这一格还剩几个王照顾着，只有计数说得清。 */',
      ],
      en: [
        '/* Two records:',
        '     seen[sq]  how many kings are looking after this square right now',
        '     left      how many empty squares still have nobody looking after them',
        '   Counting "how many" and not "any at all" matters because a king can be taken back',
        '   (the exact one does that) — only a count says how many are still looking after it. */',
      ],
    },
    'const seen = [];',
    'for (let i = 0; i < W * H; i = i + 1) { seen.push(0); }',
    'let left = empty.length;',
    '',
    {
      zh: [
        '/* 在 s 上摆一个王：它九宫里每一格的计数加一，本来没人管的那几格就有人管了。 */',
      ],
      en: [
        '/* Put a king on s: every square of its block gains one, so those with nobody now have one. */',
      ],
    },
    'function put(s) {',
    '  const c = covers[s];',
    '  for (let i = 0; i < c.length; i = i + 1) {',
    '    if (seen[c[i]] === 0) { left = left - 1; }',
    '    seen[c[i]] = seen[c[i]] + 1;',
    '  }',
    '  mark(s, "ok");',
    '  place(s, "wK");',
    '}',
    '',
    {
      zh: [
        '/* ===== 分水岭：从这里往下两份不一样了 —— 差的就是「挑哪个王」 ===== */',
      ],
      en: [
        '/* ===== The divide: below here the two differ — what differs is which king to pick ===== */',
      ],
    },
  ];

  const TAIL = [
    '',
    {
      zh: [
        '/* 已经摆了 n 个王了，接着往下摆；摆到每个空格都有人照顾为止，',
        '   返回一共摆了几个。',
      ],
      en: [
        '/* n kings are already down; keep going until every empty square is looked after, then',
        '   return how many were put down in all.',
      ],
    },
    '',
    {
      zh: [
        '   这一份的主意只有一句话：**挑当下最划算的那一格** —— 谁能一口气新照顾到',
        '   最多还没人管的空格，就把王摆在谁那儿。并列的话取编号小的那一格。',
        '   挑完就定了：这一份从头到尾没有一次 "back"，没有哪个王被收回去过。',
      ],
      en: [
        '   The idea here is one sentence: **take the square that pays off most right now** — the',
        '   one that newly looks after the most unattended squares gets the king; on a tie, the',
        '   lower number. And once taken it is settled: not one "back" here, start to finish.',
      ],
    },
    '',
    {
      zh: [
        '   它快得离谱，但它**不保证最少**。旁边那一份会告诉你差多少 ——',
        '   有墙的盘上，这两个数经常不一样。 */',
      ],
      en: [
        '   It is absurdly fast, but it **does not promise the fewest**. The one beside it tells',
        '   you by how much — on a board with walls the two numbers often differ. */',
      ],
    },
    'function cover(n) {',
    '  if (left === 0) {',
    {
      zh: [
        '    return n;              // 每个空格都有人照顾了 —— 一共摆了 n 个王',
      ],
      en: [
        '    return n;              // every empty square is looked after — n kings in all',
      ],
    },
    '  }',
    {
      zh: [
        '  /* 摆擂台：一格一格地问「你能新照顾到几格」，把最多的那一个留到最后。 */',
        '  let best = -1;           // 目前的擂主站在哪一格；−1 = 还没有擂主',
        '  let bestGain = 0;        // 擂主能新照顾到几格',
      ],
      en: [
        '  /* A contest: ask each square "how many new ones can you look after"; the biggest stays. */',
        '  let best = -1;           // where the current champion stands; −1 = no champion yet',
        '  let bestGain = 0;        // how many new squares the champion looks after',
      ],
    },
    '  for (let i = 0; i < empty.length; i = i + 1) {',
    '    const s = empty[i];',
    {
      zh: [
        '    mark(s, "try");        // 正在掂量这一格',
      ],
      en: [
        '    mark(s, "try");        // weighing up this square right now',
      ],
    },
    '    let gain = 0;',
    '    const c = covers[s];',
    '    for (let j = 0; j < c.length; j = j + 1) {',
    '      if (seen[c[j]] === 0) { gain = gain + 1; }',
    '    }',
    '    if (gain > bestGain) {',
    {
      zh: [
        '      /* 新擂主。老擂主这时候才出局 —— 它一直亮着，直到被顶下去。',
        '         这里写的是 `>` 不是 `>=`：并列的时候擂主不换，也就是取编号小的',
        '         那一格。**这一句是算法的一部分**，不是随手写的：把它改成 `>=`，',
        '         或者把上面这个循环倒过来扫，答案会变（有一档从 6 变成 5）。 */',
      ],
      en: [
        '      /* A new champion. Only now is the old one out — it stayed lit until unseated.',
        '         This says `>` and not `>=`: on a tie the champion keeps its place, which is',
        '         the same as taking the lower number. **That sign is part of the algorithm**,',
        '         not a detail: make it `>=`, or scan backwards, and an answer changes (6 to 5). */',
      ],
    },
    '      if (best >= 0) { mark(best, "cut"); }',
    '      bestGain = gain;',
    '      best = s;',
    '    } else {',
    {
      zh: [
        '      mark(s, "cut");      // 比不过擂主，出局',
      ],
      en: [
        '      mark(s, "cut");      // no match for the champion; out',
      ],
    },
    '    }',
    '  }',
    '  put(best);',
    {
      zh: [
        '  log("第 " + (n + 1) + " 个王站在 " + best + " 号格，新照顾到 " + bestGain +',
        '      " 格，还剩 " + left + " 格没人管");',
      ],
      en: [
        '  log("King " + (n + 1) + " stands on square " + best + "; newly looked after: " + bestGain +',
        '      ", still with nobody: " + left + ".");',
      ],
    },
    '  return cover(n + 1);',
    '}',
    '',
    'const kings = cover(0);',
    {
      zh: [
        'log("贪心用了 " + kings + " 个王");',
      ],
      en: [
        'log("Kings used by greed: " + kings + ".");',
      ],
    },
    'return kings;',
  ];

  /* source({ W, H, blocked, lang }) → string

     四个参数都不给默认值，缺了直接抛（阶段 5 约束 6：公开导出的省略参数已经
     是本仓库抓到过八次的缺陷类）。一个默默变成 8 的 W 会让界面写着 6、跑的却是
     8，正是这个工具最不能出的错；而一个默默变成 `[]` 的 blocked 更糟 ——
     **空盘是这道题的假题**（两份给出的数一模一样，四档盘因此没有一块空盘），
     悄悄退化成假题的演示教不了任何东西。

     校验只管「是不是一块合法的盘、墙是不是都落在盘上」，**不管盘上还剩不剩
     空格、也不管跑不跑得完**：整块盘都是墙要照常吐出源码（答案 0），
     7×7 那一档明知精确解会撞墙也要照常吐出来 —— 撞墙那一屏正是这道题的落点。

     `lang` 同理，而且它是这个工具最容易悄悄坏掉的那一个：工具**默认英文
     界面**，一个默默变成 'zh' 的 lang 就是让英文使用者读一份中文源码 ——
     没人会报这个 bug，她只会以为这工具不是给她做的。

     **自身那三个参数的校验仍在最前，`lang` 由 render() 在最后校验**，而这个
     顺序**是有门守着的**：`king.test.js` 的「缺参数当场抛」那一组**一个 lang
     都不传**，并且每条都带第三参 pattern（`/少了 W/`、`/少了 blocked/` …）。
     把 lang 的校验挪到 W 前面来，那一组当场红 —— 撞上的会变成「少了 lang」，
     pattern 对不上。

     这个函数与 king-exact.js 的同名函数逐字相同，两边一起改。 */
  function source(opts) {
    const o = opts || {};
    if (o.W === undefined || o.W === null) {
      throw new Error('source({ W, H, blocked }) 少了 W —— 棋盘宽度没有默认值，必须写明');
    }
    if (o.H === undefined || o.H === null) {
      throw new Error('source({ W, H, blocked }) 少了 H —— 棋盘高度没有默认值，必须写明');
    }
    if (o.blocked === undefined || o.blocked === null) {
      throw new Error('source({ W, H, blocked }) 少了 blocked —— 墙没有默认值，必须写明；' +
                      '空盘请显式传 []（那是这道题的假题：空盘上贪心与精确给出同一个数）');
    }
    const W = o.W, H = o.H, blocked = o.blocked;
    if (typeof W !== 'number' || !isFinite(W) || Math.floor(W) !== W || W < 1) {
      throw new Error('W 必须是 >= 1 的整数，收到：' + W);
    }
    if (typeof H !== 'number' || !isFinite(H) || Math.floor(H) !== H || H < 1) {
      throw new Error('H 必须是 >= 1 的整数，收到：' + H);
    }
    if (!Array.isArray(blocked)) {
      throw new Error('blocked 必须是一个数组（墙的格子编号），收到：' + typeof blocked);
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
      .concat(render(COMMON, o.lang))
      .concat(render(TAIL, o.lang))
      .join('\n');
  }

  return { source: source };
});
