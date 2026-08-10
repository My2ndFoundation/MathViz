/* 数路径（限一次一格、只往右或只往上）的**算法源码生成器**（规格 §2.1）。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   跟 `queens.js` / `rook-cover.js` / `knight-path.js` / `tour-*.js` /
   `minimax.js` 是同一个形状：这个模块本身不数任何路径 —— 它吐出一段
   **字符串**。那段字符串同时是喂给 `Interp.run` 去真跑的程序、和喂给
   `Editor.mount` 摆在使用者眼前的那份源码。一份字符串两个用途，所以
   「看到的」和「跑的」不可能漂移。

   **生成出来的那段源码里的注释和命名，是写给一个没学过棋、正在学算法的
   十六岁读者的**。本文件自己的注释（就是你正在读的这些）是给维护者的，
   两套读者，两种口吻。

   ---- 题面 ----

   车从 a1 走到 h8，每一步只能往右挪一格或往上挪一格（不许往回走、不许
   斜走、不许一次跳好几格），盘上有些格子是墙走不进去。问一共有多少条
   不同的路径。

   车本来是可以沿一整行/一整列任意距离滑动、还能来回踏的棋子 —— 那样
   路径数是**无限**的。这道题把它限成「一次一格、只往右或只往上」，路径
   数才有限；而**这个「只往一个方向走、不会兜回来」正是动态规划能成立的
   前提**（没有环，每个子问题只依赖比它「更早」的子问题，填表顺序才能
   存在）。这是这道题唯一的教学落点，HEAD 里专门用车本来会滑这件事作
   对照（她刚在 rookCover 里见过会滑的车）。

   ---- 几处必须写下来的约定 ----

   · **入口函数叫 `fillLayer`**（对应将来 `PROBLEMS.pathCount.entry`）。它是
     **递归**那一个：`fillLayer(d)` 把反对角线上 `r + c === d` 的整层格子一次
     填完，再递归调用 `fillLayer(d + 1)`。顶层是 `fillLayer(0);
     return ways[N * N - 1];`，`TreeModel.build(trace, 'fillLayer')` 认到的帧
     因此一层套一层，深度塔（§1.4「z 轴 = 入口函数的递归深度」）正好是
     「填到第几条反对角线」。**这一条测不出来**：把递归尾调用换成外层
     `for` 循环，四组对拍、四个写死的数、mark 通道、三道双语门全部照样
     全绿（Step 7 亲手验过）—— 结果正确性与调用栈深度是两件独立的事，
     第三根轴只能靠 Task 6 的浏览器验收去看深度塔立起来没有。

   · **为什么按反对角线分层**：`ways[r][c]` 只依赖 `ways[r-1][c]` 和
     `ways[r][c-1]` —— 也就是只依赖 `r + c` 更小的格子。同一条反对角线上
     `r + c` 是同一个数，彼此互不依赖，所以整条对角线可以在同一层里
     一起填；而算下一条对角线时，上一条已经算完了。**这就是「为什么这个
     顺序可以填」，不是「随便选了个顺序」**——顺着 r 从小到大逐行填也对，
     但那样看不出「同一层互不依赖」这件事，也铺不出深度=层号这根轴。

   · **格子编号 `sq = r * N + c`，r 是行、c 是列，r=0 是棋盘最下面一行、
     c=0 是最左列**，于是 0 号格就是 a1 —— 跟 `queens.js` /
     `rook-cover.js` 同向，宿主拿到 sq 之后 `c = sq % N; r = (sq - c) / N`
     就能直接喂给渲染层。

   · **宿主桥接只用两个**：`mark(sq, kind)` —— 这道题的 `mark` 发的不是
     `queens.js` 那四种状态字符串之一，是**两种 kind 混着发**：先
     `mark(sq, "try")`（正在算这一格），算完之后**再发一次 `mark(sq, ways[sq])`
     ——第二个参数是数字，不是字符串**。这是「每格带一个标量」这道题
     独有的账：她要能在棋盘上直接看见每一格的路径数，不是四色状态。
     `log` 报层号推进。**没有 `place` / `clear` / `attacked`**——这道题
     盘上不摆真正的棋子，宿主桥接只用 `mark` 和 `log` 两个（`place` /
     `clear` / `attacked` 三个都不调用，但仍算在「只有五个」的桥接总集
     里，不是加了第六个）。

   · **墙与起点被堵，答案都是 0，而 0 是一个真实的答案，不是「没算出来」**：
     `wall[sq]` 为真直接把 `ways[sq]` 记成 0；起点 `(0,0)` 若在墙上，同一条
     判断分支照样把它记成 0（不会被后面 `r===0&&c===0` 的分支覆盖，因为
     `wall[sq]` 判断在前）。整条反对角线堵死时，答案会一路传播成 0
     （档3 实测），跟「起点自己被堵」是同一件事的不同触发方式。

   · **`fillLayer` 递归深度上界是 `(N-1)+(N-1)`，不是 `N`**：最后一条反
     对角线是 `(r,c) = (N-1,N-1)`，层号 `d = r + c = 2N-2`。8×8 因此层号
     跑到 **14**，不是 8 ——这条容易凭直觉写错（想当然按「边长」封顶）。

   · 子集约束（规格 §2.6）：**没有模板字面量、没有正则字面量、没有
     `for…in`、没有 `try/catch`**，字符串用 `+` 拼；可用 `let`/`const`、
     数组与索引、对象字面量、`if/else`、`for`、`for…of`、`while`、函数与
     箭头函数、递归。生成出来的这份源码只用了 `for` 与递归，没有用到
     `for…of` / `while` / 箭头函数 / 对象字面量，子集用得比允许的更窄，
     不代表那几种不可用。

   ---- 实测（`Interp.STEP_LIMIT`）----

   4×4 空盘 = 20；8×8 空盘 = 3432（= C(14,7)）；8×8 三堵墙（sq 26/35/44）
   = 1287；8×8 整条反对角线（sq 7/14/21/28/35/42/49/56）= 0。四个数都在
   `path-count.test.js` 里跟宿主侧独立 DP 对拍过，也都单独写死钉住
   （两份实现同时错成同一个数，只有写死的那四条拦得住）。这一题离
   `Interp.STEP_LIMIT` 很远，不存在撞墙风险：8×8 满盘格子数只有 64，
   每格的工作量是常数，不像回溯题那样指数增长。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoPathCount = factory();
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

  /* 普通字符串拼，不用模板字面量：这段文本本身会被原样贴进 html，
     反引号在那个上下文里比在这里更容易出事（照抄 queens.js 的理由）。

     元素两种：字符串（代码 / 空行，两语逐字相同）与 `{ zh: [], en: [] }`
     （一段散文，两边行数必须相等）—— 见上面 render()。这一份**一个挖空
     都没有**，所以没有 BLANK 指令行那一类。
     英文不是逐句直译，是照中文那一版的意思与语气重写的，行数对齐落在
     「段」上：段内句子怎么重组都行，段的行数必须一样。 */
  const HEAD = [
    {
      zh: [
        '/* ============ 数路径 · 一次一格，只往右或只往上 ============',
        '   车从 a1 走到 h8，每一步只能往右挪一格，或者往上挪一格 —— 不许往回',
        '   走，也不许斜着走。问一共有多少条不同的路径。',
        '',
        '   车本来能沿一整行、一整列滑任意远，还能来回踏 —— 那样路径数是',
        '   **无限**的（一直踏来踏去，永远数不完）。这道题把它限成「一次一格、',
        '   只往一个方向」，路径数才有限。而这条限制还有第二层意思：走过的',
        '   路**不会兜回来**，每一步都严格往「右上方向」推进 —— 这正是下面这段',
        '   程序能用动态规划解决它的前提：算一个格子的路径数之前，通往它的',
        '   格子必须已经算完，而「不会兜回来」保证了这种顺序真的存在。',
        '',
        '   格子编号：sq = 行 * N + 列，下面写成 sq = r * N + c。',
        '   第 0 行是棋盘最下面那一行，第 0 列是最左边那一列 —— 于是 0 号格',
        '   就是国际象棋里的 a1，要反推回去：列 = sq % N，行 = (sq - 列) / N。 */',
      ],
      en: [
        '/* ============ Counting Paths · One Square at a Time, Right or Up ============',
        '   A rook travels from a1 to h8. Every move slides exactly one square right, or',
        '   one square up — never back, never diagonal. How many different paths are there?',
        '',
        '   A rook can normally glide any distance along a row or column, and even step back',
        '   and forth — which makes the number of paths **infinite** (it could shuffle forever).',
        '   Restricting it to one square at a time, one direction only, makes the count finite.',
        '   That restriction carries a second meaning: a path never loops back — every move',
        '   strictly advances up and to the right. That is exactly what lets the program below',
        '   use dynamic programming: a square\'s count needs every square leading into it done first.',
        '',
        '   Squares are numbered sq = row * N + column, written below as r * N + c.',
        '   Row 0 is the bottom row and column 0 is the leftmost column, so square 0 is a1;',
        '   to go the other way: column = sq % N, row = (sq - column) / N. */',
      ],
    },
    '',
    {
      zh: [
        '/* 棋盘边长，以及墙格的编号 —— 这道题的全部旋钮。',
        '   墙上的格子走不进去：不管有多少条路能通到它，它的路径数都记成 0。',
        '   起点自己要是被堵上了，答案照样是 0 —— 那是一个真实的答案，',
        '   不是「没算出来」，就跟终点被堵、或者半路被一整条反对角线拦死一样。 */',
      ],
      en: [
        '/* The side of the board, and the numbers of the walled squares — every knob here.',
        '   A walled square cannot be entered: no matter how many routes lead to it, its path',
        '   count is recorded as 0. A walled start square gives 0 too — a genuine answer, not',
        '   "failed to compute", same as a walled end square or a whole diagonal of walls. */',
      ],
    },
  ];

  const BODY = [
    '',
    {
      zh: [
        '/* ways[sq]：走到这一格一共有多少条不同的路径。先全部清零，',
        '   算到哪一格就把哪一格的真实值填进去 —— 从来不用「未知」这种状态，',
        '   因为按下面的顺序填，一个格子被读到的时候它一定已经填过了。 */',
      ],
      en: [
        '/* ways[sq]: how many distinct paths reach this square. Start every entry at zero,',
        '   then fill in the true value the moment it is reached — never an "unknown" state,',
        '   because the fill order below guarantees a square is always filled before it is read. */',
      ],
    },
    'const ways = [];',
    'for (let i = 0; i < N * N; i = i + 1) { ways.push(0); }',
    '',
    {
      zh: ['// wall[sq] 为真就是墙 —— 车一步都走不进去。'],
      en: ['// wall[sq] true means a wall — the rook cannot step onto it at all.'],
    },
    'const wall = [];',
    'for (let i = 0; i < N * N; i = i + 1) { wall.push(false); }',
    'for (const w of BLOCKED) { wall[w] = true; }',
    '',
    {
      zh: [
        '/* 一次填一整条反对角线：把棋盘上 r + c 相等的格子看成同一层，',
        '   层号 d 从 0（起点自己）一路加到 (N-1)+(N-1)（终点自己）。',
        '',
        '   为什么可以整层一起填：ways[r][c] 只看它左边 ways[r][c-1] 和下面',
        '   ways[r-1][c] 这两个格子，而这两个格子的 r+c 都比当前格子小 1 ——',
        '   都在**上一层**，早就填好了。同一层内部谁也不需要谁，顺序随便，',
        '   所以能一次把整条对角线扫完，再递归推进到下一层。 */',
      ],
      en: [
        '/* Fill one whole diagonal at a time: squares sharing r + c form one layer, with layer',
        '   number d running from 0 (the start square) up to (N-1)+(N-1) (the end square).',
        '',
        '   Why a whole layer can be filled at once: ways[r][c] only looks at the square to its',
        '   left, ways[r][c-1], and the one below, ways[r-1][c] — both have r + c one smaller,',
        '   so both sit in the **previous layer**, already done. Nothing in a layer needs anything',
        '   else in that layer, so the whole diagonal can be swept, then recursion moves on. */',
      ],
    },
    'function fillLayer(d) {',
    '  if (d > (N - 1) + (N - 1)) { return; }',
    '  for (let r = 0; r < N; r = r + 1) {',
    '    const c = d - r;',
    '    if (c < 0 || c >= N) { continue; }',
    '    const sq = r * N + c;',
    {
      zh: ['    mark(sq, "try");    // 正在算这一格'],
      en: ['    mark(sq, "try");    // computing this square right now'],
    },
    '    if (wall[sq]) {',
    {
      zh: ['      ways[sq] = 0;    // 墙：走不进来，路径数就是 0'],
      en: ['      ways[sq] = 0;    // a wall: nothing can step in, so the count is 0'],
    },
    '    } else if (r === 0 && c === 0) {',
    {
      zh: ['      ways[sq] = 1;    // 起点：站在这儿本身就算一条路径'],
      en: ['      ways[sq] = 1;    // the start square: standing here already counts as one path'],
    },
    '    } else {',
    {
      zh: [
        '      let n = 0;',
        '      if (r > 0) { n = n + ways[sq - N]; }    // 从下面这格走上来的路径',
        '      if (c > 0) { n = n + ways[sq - 1]; }    // 从左边这格走过来的路径',
      ],
      en: [
        '      let n = 0;',
        '      if (r > 0) { n = n + ways[sq - N]; }    // paths that stepped up from below',
        '      if (c > 0) { n = n + ways[sq - 1]; }    // paths that stepped in from the left',
      ],
    },
    '      ways[sq] = n;',
    '    }',
    {
      zh: ['    mark(sq, ways[sq]);    // 把算出来的数字直接标在这一格上'],
      en: ['    mark(sq, ways[sq]);    // stamp the computed number directly onto this square'],
    },
    '  }',
    {
      zh: ['  log("第 " + d + " 层填完了");'],
      en: ['  log("Layer " + d + " is filled in.");'],
    },
    '  fillLayer(d + 1);',
    '}',
    '',
    {
      zh: ['// 从第 0 层（起点自己）开始，一层层推到最后一个格子。'],
      en: ['// Start from layer 0 (the start square itself), and work outward one layer at a time.'],
    },
    'fillLayer(0);',
    'return ways[N * N - 1];',
  ];

  /* source({ N, blocked, lang }) → string

     N 与 lang 不给默认值，缺了直接抛（阶段 5 约束 6：公开导出的省略参数
     已经是本仓库抓到过多次的缺陷类）。一个默默变成某个数的 N 会让界面
     写着一个边长、跑的却是另一个，正是这个工具最不能出的错。

     blocked **可以省略，省略就是空数组**——空盘（无墙）是这道题合法、
     有意义的一档（档0 4×4、档1 8×8 都是空盘），不像 rookCover 那样是假题，
     所以给它一个默认值是安全的，不需要强制显式传 []。 */
  function source(opts) {
    const o = opts || {};
    if (o.N === undefined || o.N === null) {
      throw new Error('source({ N }) 少了 N —— 棋盘边长没有默认值，必须写明');
    }
    const N = o.N;
    if (typeof N !== 'number' || !isFinite(N) || Math.floor(N) !== N || N < 1) {
      throw new Error('N 必须是 >= 1 的整数，收到：' + N);
    }
    const blocked = o.blocked === undefined || o.blocked === null ? [] : o.blocked;
    if (!Array.isArray(blocked)) {
      throw new Error('blocked 必须是一个数组（没有墙就传 [] 或省略），收到：' + blocked);
    }
    for (let i = 0; i < blocked.length; i = i + 1) {
      const s = blocked[i];
      if (typeof s !== 'number' || !isFinite(s) || Math.floor(s) !== s ||
          s < 0 || s >= N * N) {
        throw new Error('blocked 里的格子必须是 0 到 ' + (N * N - 1) +
                        ' 之间的整数，收到：' + s);
      }
    }
    return render(HEAD, o.lang)
      .concat(['const N = ' + N + ';'])
      .concat(['const BLOCKED = [' + blocked.join(', ') + '];'])
      .concat(render(BODY, o.lang))
      .join('\n');
  }

  return { source: source };
});
