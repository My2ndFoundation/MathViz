/* 最少步数场（多起点广度优先搜索）的**算法源码生成器**（规格 §2.1）。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   跟 `queens.js` / `knight-path.js` / `path-count.js` 是同一个形状：这个模块
   本身不搜索任何东西 —— 它吐出一段**字符串**。那段字符串同时是喂给
   `Interp.run` 去真跑的程序、和喂给 `Editor.mount` 摆在使用者眼前的那份源码。
   一份字符串两个用途，所以「看到的」和「跑的」不可能漂移。

   **生成出来的那段源码里的注释和命名，是写给一个没学过棋的 16 岁读者的**。
   本文件自己的注释（就是你正在读的这些）是给维护者的，两套读者，两种口吻。

   ---- 这道题存在的全部理由：它是 `knight-path.js` 的「差一行」版本 ----

   规格 §4⑤「四道题的裁定」**原话**是：「`fieldBFS` 与 `knightPath` 的差别只有
   一行（队列初始塞 N 个起点而不是 1 个），而那正是要教的：迁移的代价是一行」。
   ⚠ **那句话已于 2026-08-10 改判**（本阶段第十三处，正是这份文件的实测促成的）：
   **算法上的代价是一行，呈现上的代价不是。** `tips` 照改判后的写，不许说「只差一行」。

   所以这份文件是**照着 `knight-path.js` 抄的**，而那句话必须在代码上是真的。
   ⚠ **它不是逐字节的一行，实测是五处**，逐条记在这里，别让 `tips` 说过头：

     ① **种子那一步**（真正要教的那一处）。
        knightPath：`dist[START] = 0; mark(START, "ok");` 一格；
        fieldBFS：**同样这两句被一个 `for` 裹起来，轮着塞 SRC 里的每一个源**，
        然后 `expand(SRC, 0)` 而不是 `expand([START], 0)`。
        队列初始塞几个起点 —— 这一处就是整道题。
     ② **`mark` 发的是数字，不是 `"ok"`**：`mark(nb, d + 1)`。这道题每格要立一根
        柱子，柱高就是这个数（规格 §4⑤ 9c ②：`kind` 从 `string` 放宽成
        `string | number`，页面层以下零改动）。
     ③ **`"try"` / `"cut"` 两种 mark 整个去掉**。⚠ **这一处不是风格选择，是被
        渲染层逼出来的**：`debugger.js` 的 `boardState` 是 `marks[op.sq] = op.to`
        ——**后写的盖前写的**。一格在第 3 层被确认、拿到数字 3 之后，第 3 层
        别的格子扫邻居时还会再喊它一次 `"try"`/`"cut"`，那个字符串会把 3 盖掉。
        跑到最后，整张场只剩最后一层是数字，前面几层全成了 `"cut"` —— 柱子塌
        光，而且**不报任何错**。knightPath 不受影响（它的 mark 只用来画波纹，
        没有哪一格的值需要活到最后）。**这也正是「每格恰好被 mark 一次」那条
        测试在守的东西。**
     ④ **`prev` 表与末尾那段「顺着 prev 把路线倒串回来、摆一串马」整段删掉**：
        一张场里没有「一条路线」这回事。源格自己摆一匹马（`place(s, "wN")`，
        跟 `queens.js` / `knight-path.js` 同一个「数字格子 + 字符串棋子」约定），
        为的是让「起点有几个」在盘上看得见 —— 拖滑杆时角上的马跟着长出来，
        整张场同时矮下去，那一帧就是这道题的全部内容。
     ⑤ **返回值换了含义**（规格 §4⑤ 9f ⑤）：knightPath 的 `expand` 返回起点到
        target 的最短步数、到不了给 −1；这里返回**整张场的最大值** ——「最远的
        那一格要走几步」。铺不出新格子的那一层，层号就是最远距离，所以
        `return -1;` 变成 `return d;`，`TARGET` 那条提前返回随之消失。

   **一个字都没动的**：`DX` / `DY` 八个方向、`onBoard`、`dist` 那张表与它的
   初始化、`expand(frontier, d)` 逐层同步的整个骨架（两层循环 + `next` 表 +
   `return expand(next, d + 1);` 那一行递归）、格子编号约定、双语散文的语气。

   ⚠ **`knight-path.js` 里有两条 `// >>> BLANK` 挖空指令行，一条都没抄** ——
   规格里挖空是 opt-in，不在本阶段。`field-bfs.test.js` 有一条断言钉着这件事
   （指令行是注释，抄进来不会有任何症状，`exercise.js` 却会当场认出两个从没
   设计过的挖空）。

   ---- 为什么是**递归铺层**，不是一条队列 ----

   照抄 `knight-path.js` 的理由，一字不改地成立：`expand(frontier, d)` 拿着
   「正好 d 步能到的那一整层格子」，把它们的邻居收成下一层，再对下一层调用
   自己。**递归深度就是 BFS 层号**，于是这一页的第三根轴（深度塔，§1.4）不需要
   任何额外声明就正好是「第几层」；左边调用栈叠着的帧数，就是右边棋盘上波纹的
   圈数。教科书那种「一条队列 + 一个 while」的调用深度恒等于 1，那根轴会整个
   塌掉。`field-bfs.test.js` 的宿主侧参照**故意**写成队列式的那一种，两份逐格
   对拍 —— 形态不同才叫独立参照。

   ---- 几处必须写下来的约定 ----

   · **入口函数叫 `expand`**，对应 `PROBLEMS.fieldBFS.entry`。顶层是
     `… return expand(SRC, 0);`，所以 `run().result` 就是整张场的最远距离。

   · **格子编号 `sq = 行 * W + 列`**，行 0 在棋盘最下面、列 0 在最左边，
     于是 0 号格是 a1 —— 跟 `knight-path.js`、`queens.js`、`BoardRender.layout()`
     的 `squareCenter(file, rank)` 同向。反推是 `列 = sq % W; 行 = (sq - 列) / W`。

   · **盘固定 8×8**（规格 §4⑤ 9f ②）：这道题存在的全部理由是**与 `knightPath`
     的对照**（算法上只差种子那一行），**两块盘一样那个对照才是直的** —— 她可以来回
     切。所以 `W` 不是参数，`source()` 只收 `sources` 与 `lang`。

   · **源格自己的距离是 0，而且 0 要真的从 `mark` 通道以数值送出去**
     （规格 §4⑤「探针跑完的裁定②」）：**0 是真值，不是「没有值」**。渲染那一头
     0 画成贴地的一根零长柱 + 一个 `"0"` 标签，与「从没标过」的暗灰小点长得
     不一样 —— 两头合起来这条裁定才成立。算法这一头由种子那个 `mark(s, 0)`
     负责，`field-bfs.test.js` 用打桩 host 钉住它收到的是**数值 0**。

   · ⚠ **8×8 上没有到不了的格子**（规格 §4⑤ 9f ⑥，实测不可达格恒为 0）。
     渲染层那条 `d === undefined` 的分支是从工具① 继承来的防御性代码，
     **本题一次都走不到** —— 写在这里是因为「让一道门看起来在守什么，比它
     不存在更糟」。（真实反例：3×3 上正中那一格永远到不了，单源场是
     `0 3 2 3 −1 1 2 1 4`；本阶段盘固定 8×8，不做盘面滑杆。）

   · 子集约束（规格 §2.6）：**没有三元运算符**，`a ? b : c` 会抛 unsupported，
     一律展开成 if/else；数组只有 `push` / `pop` 和 `length` 与下标读写；
     字符串用 `+` 拼，没有模板字面量。

   · **宿主桥接只用两个**：`mark(sq, kind)` 与 `place(sq, piece)`。
     **没有 `log`** —— 顶层被钉成 `return expand(SRC, 0);`，答案走读数区。
     ⚠ 由此带来一个必须写明的后果：三道双语门里第③道（「英文变体抽掉注释后
     没有汉字」）**对这份文件是恒真的，它在这里没有牙** —— 双语片段全是注释，
     抽掉之后剩下的唯一字符串字面量是 `"wN"`，两语逐字相同。
     `knight-path.js` 有牙是因为它有 `log("到不了：…")`。这一条在测试文件里
     也原样写了一遍，别让它看起来在守什么。

   ---- 实测（`Interp.STEP_LIMIT` = 200,000；盘 8×8，源在四角 a1 → h8 → a8 → h1）----

     源数   最远距离   解释器步数   占上限   不可达格
      1        6         5,023       2.5%       0
      2        5         5,018       2.5%       0
      3        5         5,020       2.5%       0
      4        3         5,008       2.5%       0

   **「最远距离 6 → 5 → 3」就是这道题的全部教学信号**：多几个起点，整块盘都
   更近，整张场当场矮一半。步数几乎不动（多源 BFS 是 O(格子数)，源多了只是把
   同样 64 格更早铺完），余量充足 —— 这一段没有 9e 那种可行性风险。

   ⚠ **上面这四个步数跟实施计划表里的 5,157 / 5,149 / 5,133 对不上**，这不是
   缺陷：计划那三个数是对着另一份骨架量的（它还发着 `"try"` / `"cut"`，也没有
   源格那几个 `place`）。**最远距离 6 / 5 / 3 两边一致，那才是这道题的答案；
   步数是实现形态的后果，测出来是多少就报多少** —— 跟 `knight-path.js` 文件头
   记的那笔（简报 3,588 步 vs 实测 5,086 步）是同一件事，没有为了对齐那三个
   数字改过一行代码。

   ⚠ 另外两处「看着像 bug 其实不是」的：
     · **源数 3 → 最远仍是 5**，不是单调地 6/5/4/3。第三个源（a8）落在前两个
       已经覆盖得不错的区域里，滑杆拖过去时第三档看着「没变」是正确行为。
     · **源数 3 的步数（5,020）比源数 2（5,018）还多一点**，不是单调下降：
       多一个源要多跑一次种子循环（一次 `mark` + 一次 `place`），而它省下的
       expand 里的活比这点开销还少。

   `sources` 的校验只管「是不是合法的、互不重复的盘上格子」，不管场长什么样。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoFieldBFS = factory();
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
     反引号在那个上下文里比在这里更容易出事（照抄 knight-path.js 的理由）。

     元素两种：字符串（代码 / 空行，两语逐字相同）与 `{ zh: [], en: [] }`
     （一段散文，两边行数必须相等）—— 见上面 render()。英文不是逐句直译，
     是照中文那一版的意思与语气重写的，行数对齐落在「段」上。 */
  const HEAD = [
    {
      zh: [
        '/* ============ 最少步数场 · 多个起点一起铺 ============',
        '   上一题问的是「从这一格走到那一格，最少几步」，答出来是一条路线。',
        '   这一题把同一个问题铺满整块盘：**每一格离最近的那个起点有多远？**',
        '   答出来的不是路线，是一整张「场」—— 六十四个数字，一格一个。',
        '',
        '   格子编号：sq = 行 * W + 列。第 0 行是棋盘最下面那一行，第 0 列是最左边',
        '   那一列 —— 于是 0 号格就是国际象棋里的 a1。',
        '   要反推回去：列 = sq % W，行 = (sq - 列) / W。',
        '',
        '   办法跟上一题**一模一样**：先把一步能到的格子全找出来，再把两步能到的',
        '   全找出来，一层一层往外铺，像往水里丢一颗石子荡开的波纹。第一次碰到',
        '   一格的那一层，层号就是它的最少步数。',
        '',
        '   ⚠ 跟上一题的差别只在**最后那段「出发」**：波纹不是从一颗石子荡开的，',
        '   是同时从好几颗石子荡开的 —— 队列一开始塞进去的不是一个起点，是一整排。',
        '   两圈波纹撞上的地方，先到的那一圈说了算，所以每格记下的正好是',
        '   「离**最近**的那个起点几步」。这就是「场」的意思。',
        '',
        '   把「起点个数」从 1 拖到 4 看看：整张场会当场矮下去一半。',
        '   算法本身一个字都没改 —— 迁移的代价就是那一处。 */',
      ],
      en: [
        '/* ============ A Field of Fewest Moves · Many Starts at Once ============',
        '   The previous puzzle asked "from this square to that one, how few moves?" — one route.',
        '   This one spreads the same question over the whole board: **how far is every square',
        '   from its nearest start?** Not a route but a whole field — sixty-four numbers, one each.',
        '',
        '   Squares are numbered sq = row * W + column. Row 0 is the bottom row of the board',
        '   and column 0 is the leftmost one — so square 0 is a1 in chess.',
        '   To go the other way: column = sq % W, row = (sq - column) / W.',
        '',
        '   The method is **exactly the one from the previous puzzle**: find every square one move',
        '   away, then every square two moves away, spreading outward a layer at a time, like',
        '   ripples from a stone in water. The layer where a square first appears is its fewest.',
        '',
        '   ⚠ The only difference is down in **"off we go"**: the ripples do not start from one',
        '   stone but from several at once — the queue is seeded with a whole row of starts',
        '   instead of a single one. Where two ripples meet, the one that got there first wins,',
        '   so each square ends up holding "moves from the **nearest** start". That is a field.',
        '',
        '   Drag "number of starts" from 1 to 4 and watch: the whole field drops by half.',
        '   Not one line of the algorithm itself changed — that is the price of the move. */',
      ],
    },
    '',
    {
      zh: ['/* 棋盘边长，和几个出发格。真正的棋盘就是 W = 8，出发格摆在四个角上。 */'],
      en: ['/* The side of the board and the starting squares — a real board is W = 8, starts at the corners. */'],
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
        '   and DY[k] along" — four one-and-two, four two-and-one, a full ring around it. */',
      ],
    },
    'const DX = [1, 2, 2, 1, -1, -2, -2, -1];',
    'const DY = [2, 1, -1, -2, -2, -1, 1, 2];',
    '',
    {
      zh: [
        '/* 一张备忘表：',
        '     dist[sq]  离**最近的那个起点**最少几步；−1 表示还没碰到过它。',
        '   一格只会被确认一次 —— 这是整道题唯一的规则，别的都是围着它转的脚手架。',
        '   （上一题还有一张 prev 表，用来把一条路线倒着串回来。这里不需要：',
        '     一张场里没有「那一条路线」这回事，每格要的只是一个数字。） */',
      ],
      en: [
        '/* One lookup table:',
        '     dist[sq]  fewest moves from the **nearest** start; −1 means not yet touched.',
        '   A square is confirmed exactly once — the one rule here; the rest is scaffolding.',
        '   (The previous puzzle also kept a prev table to rebuild one route backwards. Not',
        '    needed here: a field has no "the route", only a number in every square.) */',
      ],
    },
    'const dist = [];',
    'for (let i = 0; i < W * W; i = i + 1) { dist.push(-1); }',
    '',
    {
      zh: ['// (x, y) 还在棋盘上吗？出界的方向连看都不用看。'],
      en: ['// Is (x, y) still on the board? A direction that leaves it is not worth a look.'],
    },
    'function onBoard(x, y) {',
    '  return x >= 0 && x < W && y >= 0 && y < W;',
    '}',
    '',
    {
      zh: [
        '/* frontier 是「正好 d 步能到的那一整层格子」。',
        '   这个函数把这一层每一格的八个方向都看一遍：凡是还没碰过的，都属于第 d+1',
        '   层 —— 收齐之后，再对下一层调用自己。递归的每一层，就是棋盘上的一圈波纹，',
        '   所以左边调用栈叠了几帧，右边的波纹就荡开了几圈。',
        '   返回整张场里最远那一格的步数：铺不出新格子的那一层，层号就是最远距离。 */',
      ],
      en: [
        '/* frontier is "the whole layer of squares reachable in exactly d moves".',
        '   This function checks all eight directions out of every square in that layer; any',
        '   square not yet touched belongs to layer d+1. Collect them, then call itself on that',
        '   layer — each level of recursion is one ripple, so the frames stacked on the left are',
        '   the rings on the right. Returns the farthest distance: the layer that adds nothing. */',
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
      zh: [
        '        /* dist[nb] 还是 −1 才算「第一次碰到它」。碰过的直接跳过：更早到达',
        '           它的那一层比现在这一层近，从这边再走过去只会更长。',
        '           这一格比这一层正好远一步，而这就是它的最少步数 —— 更近的每一层',
        '           刚才都铺过了，如果有更短的走法，早就碰上了。 */',
      ],
      en: [
        '        /* Only dist[nb] === −1 counts as "first time here". A touched square is',
        '           skipped: the layer that reached it was nearer, so coming from here is',
        '           only longer. This square is exactly one move past this layer, and that',
        '           is its fewest: nearer layers are done, a shorter way would have shown. */',
      ],
    },
    '        if (dist[nb] < 0) {',
    '          dist[nb] = d + 1;',
    {
      zh: ['          mark(nb, d + 1);   // 把它的距离直接写在格子上 —— 柱子的高度就是这个数'],
      en: ['          mark(nb, d + 1);   // stamp its distance onto the square — that number is the height'],
    },
    '          next.push(nb);',
    '        }',
    '      }',
    '    }',
    '  }',
    '  if (next.length === 0) {',
    {
      zh: [
        '    /* 这一层之后再没有新格子了：整张场铺满了，而这一层就是最远的那一层。',
        '       上一题这里返回的是 −1（到不了目标）；这一题没有目标，返回的是',
        '       「最远的格子要走几步」。 */',
      ],
      en: [
        '    /* Nothing new after this layer: the field is complete, and this layer is the',
        '       farthest one. The previous puzzle returned −1 here (target unreachable);',
        '       this one has no target, so it returns "how far the farthest square is". */',
      ],
    },
    '    return d;',
    '  }',
    {
      zh: ['  return expand(next, d + 1);   // 铺下一层 —— 递归就发生在这一行'],
      en: ['  return expand(next, d + 1);   // lay out the next layer — this line is the recursion'],
    },
    '}',
    '',
    {
      zh: [
        '/* 出发 —— **整道题跟上一题的差别就在这几行**。',
        '   上一题这里只塞一个出发格：dist[START] = 0; mark(START, "ok");',
        '   这一题把同样两句用一个循环裹起来，SRC 里有几个起点就塞几个：',
        '   第 0 层不是一格，是一整排。每个起点到自己都是 0 步 —— **0 是一个真的',
        '   答案**，不是「没有值」，所以它照样要标出去，画成贴地的一根零长柱。',
        '   顺手在每个起点上摆一匹马，好让「起点有几个」在盘上一眼看得见。',
        '   然后就把这一排交给和上一题一模一样的 expand。 */',
      ],
      en: [
        '/* Off we go — **this handful of lines is the whole difference from the last puzzle**.',
        '   There, one square was seeded: dist[START] = 0; mark(START, "ok");',
        '   Here the very same two statements sit inside a loop, seeding as many starts as SRC',
        '   holds: layer 0 is not one square but a whole row of them. Every start is 0 moves',
        '   from itself — and **0 is a real answer**, not "no value", so it is stamped too, drawn',
        '   as a flat zero-height column on the ground. A knight goes on each start as well, so',
        '   "how many starts" is visible at a glance. Then that row goes to the same expand. */',
      ],
    },
    'for (let i = 0; i < SRC.length; i = i + 1) {',
    '  const s = SRC[i];',
    '  dist[s] = 0;',
    '  mark(s, 0);',
    '  place(s, "wN");',
    '}',
    'return expand(SRC, 0);',
  ];

  /* 盘固定 8×8（规格 §4⑤ 9f ②）。**不做成参数**：这道题的对照对象
     `knightPath` 的盘也是固定 8×8（`KP_W`），两块盘一样那个对照才是直的。 */
  const BOARD_W = 8;

  /* source({ sources, lang }) → string

     两个参数都不给默认值，缺了直接抛（阶段 5 约束 6：公开导出的省略参数已经
     是本仓库抓到过五次的缺陷类）。一个默默变成 `[0]` 的 sources 会让界面写着
     4 个源、跑的却是 1 个 —— 正是这个工具最不能出的错。

     **`sources` 的校验在最前，`lang` 由 render() 在最后校验**，而这个顺序
     **是有门守着的**：`field-bfs.test.js` 的「缺参数当场抛」那一组**一个 lang
     都不传**，并且每条都带第三参 pattern。把 lang 的校验挪到前面来，那一组
     当场红 —— 撞上的会变成「少了 lang」，pattern 对不上。（这是
     `knight-path.js` 那段注释记的教训，原样搬过来。）

     ⚠ pattern 全写成**完整消息（固定文案 + 那一次的插值）**：三条越界消息只差
     一个插值，只含固定文案的 pattern 会同时匹中它们，被 check.py 第九道门判成
     「无判别力」。插值一律用**裸数字**回显，不包进「」或 ""（`_throws_msg_shape`
     只抹 ASCII 双引号里的内容与数字，包进中文引号会被当成固定文案的一部分）。

     校验只管「是不是合法的、互不重复的盘上格子」，**不管这张场长什么样** ——
     几个源铺出多远是要跑出来给她看的东西，不是参数校验的事。 */
  function source(opts) {
    const o = opts || {};
    if (o.sources === undefined || o.sources === null) {
      throw new Error('source({ sources }) 少了 sources —— 起点列表没有默认值，必须写明');
    }
    const sources = o.sources;
    if (!Array.isArray(sources)) {
      throw new Error('sources 必须是一个数组（多源 BFS 的起点列表），收到：' + sources);
    }
    if (sources.length === 0) {
      throw new Error('sources 至少要有一个起点，收到的是空数组');
    }
    const SQ = BOARD_W * BOARD_W;
    const seen = Object.create(null);
    for (let i = 0; i < sources.length; i = i + 1) {
      const s = sources[i];
      if (typeof s !== 'number' || !isFinite(s) || Math.floor(s) !== s || s < 0 || s >= SQ) {
        throw new Error('sources 里第 ' + i + ' 个起点必须是 0 到 ' + (SQ - 1) +
                        ' 之间的整数（' + BOARD_W + '×' + BOARD_W + ' 的格子编号），收到：' + s);
      }
      if (seen[s]) {
        throw new Error('sources 里有重复的起点：格子 ' + s + ' 出现了不止一次');
      }
      seen[s] = 1;
    }
    return render(HEAD, o.lang)
      .concat([
        'const W = ' + BOARD_W + ';',
        'const SRC = [' + sources.join(', ') + '];',
      ])
      .concat(render(BODY, o.lang))
      .join('\n');
  }

  return { source: source };
});
