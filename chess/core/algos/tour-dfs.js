/* 骑士巡游（朴素回溯）的**算法源码生成器**（规格 §2.1）。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   跟 `queens.js` / `minimax.js` 是同一个形状：这个模块本身不搜索任何
   东西 —— 它吐出一段**字符串**。那段字符串同时是喂给 `Interp.run` 去真跑
   的程序、和喂给 `Editor.mount` 摆在使用者眼前的那份源码。一份字符串两个
   用途，所以「看到的」和「跑的」不可能漂移。

   **生成出来的那段源码里的注释和命名，是写给一个没学过棋的 16 岁读者的**。
   本文件自己的注释（就是你正在读的这些）是给维护者的，两套读者，两种口吻。

   ---- 这一份和 `tour-warnsdorff.js` 是一对，不是两个工具 ----

   规格 §4⑤ 的落点是「同一个问题、同一块盘、两份可以逐行对比的源码」：
   它们是**一个** `PROBLEMS` 键、**并排**显示，不是两个 tab。于是有一条
   硬约束：**除了「下一步先试哪一个」那一段，两份生成源码逐字相同** ——
   棋盘常量、`DX/DY`、`onBoard`、`mark`/`place` 的编舞、连注释都一样。
   她把两边一 diff，diff 出来的就该正好是那个主意本身。

   连文件头的行数都是对齐的（两边 HEAD 都是同样多行，只有讲「先试哪一个」
   的那两三行措辞不同），这样并排看的时候上半截是逐行对得上的。
   **改动这份里的任何共用文本，必须同步改另一份。** 两边的差异行数是
   tour.test.js 之外的一道人肉门，今天量到（3×4 / start 0）是：

     `diff` 出来 44 行不同（本文件独有 5 行、另一份独有 39 行），
     其余 86 行逐字相同。44 行里 8 行是措辞（4 对：标题、讲「先试哪一个」
     的两行、常量注释里举例时提到的是哪一份），另外 36 行就是那个主意本身
     （本文件的 1 行注释 ↔ 另一份的 `degree()` 17 行 + 包着它的两行 BLANK
     指令 + 排序 16 行）。

   多出来的差异就是漂移。

   （这三个数在阶段 8 之前腐坏过一轮：这里写着 42 / 5 / 37、
   `tour-warnsdorff.js` 写着 44 / 5 / 39，而对的是后者 —— 阶段 6 加进去的
   那两行 BLANK 指令这一侧没跟上。**同一个数字抄在两个文件头里，就是两处
   会各自腐坏的地方。** 阶段 8 两侧各重量了一次，中文与英文**都是 44 / 5 /
   39**：这个形状在两种语言下是构造性相同的，所以下面不再为英文另记一份。）

   ---- 几处必须写下来的约定 ----

   · **入口函数叫 `tour`**，两份签名相同：`tour(sq, n)` = 「马现在站在 sq
     上，这已经是路线上的第 n 格」。它是**递归**那一个，不是外壳 ——
     `TreeModel.build(trace, 'tour')` 认到的帧要一层套一层，z 轴才是递归
     深度。顶层是 `const found = tour(START, 1); ... return found;`，
     所以 `run().result` 是 true / false。

   · **格子编号 `sq = 行 * W + 列`**，行 0 在棋盘最下面、列 0 在最左边，
     于是 0 号格是 a1 —— 跟 `queens.js`、`BoardRender.layout()` 的
     `squareCenter(file, rank)`、`chess-core.js` 的 `SQ(file, rank)` 同向。
     反推是 `列 = sq % W; 行 = (sq - 列) / W`。
     **棋盘不是正方形**：这一题的 W（宽）跟 H（高）分开，`files !== ranks`
     是常态（3×4 / 3×5 / 4×5 / 3×7 四块盘都要用到），所以编号里除的是 W 而不是某个
     「边长」—— 别照 queens.js 的 `sq = r * N + c` 想当然。

   · **宿主桥接**：`mark(sq, kind)` 画规格 §2.7 的四种状态，四个 kind 逐字是
       'try'（正在尝试）· 'ok'（已确认）· 'cut'（被剪枝）· 'back'（回溯撤销），
     `place(sq, 'wN')` 摆马，`clear(sq)` 收回去。

     **`place` 的两个参数是「数字 sq + 字符串 piece」**，跟 `queens.js`
     的 `place(sq, "wQ")` 同一个约定。仓库里另有一个**反例**：
     `tools/_debugger-preview.html` 内嵌的那份 N 皇后示例（约 165 行）写的是
     `place(sq(col, row), 5)` —— 代数记法字符串的格子 + 数字 code 的棋子，
     两个参数**正好相反**。本阶段一律跟 `queens.js` 走，'wN' → code 的换算
     归页面（Task 4/5）做一次，别照那份旧的抄。

   · **`place` / `clear` 就发生在搜索途中，跟 `queens.js` 完全一样** ——
     走进一格就 `place(sq, "wN")`，回溯时 `mark(sq,'back')` 紧跟 `clear(sq)`。
     马是一步一步走的，盘上任何一刻显示的都是**当前这条路线**。
     跑通了，最后那 W*H 匹马留在盘上不收 —— 那一盘马就是答案本身；
     走不通，全部退回去，盘上跟出发前一模一样。

     这条写下来是因为它一度被写反过。tour.test.js 早先的判分方式是「把所有
     `place` 事件按顺序收起来当路线」，那就逼着算法**攒到找到答案之后再一次性
     落子**（否则被放弃的分支会被当成重复格）—— 实测的后果是：4×5 / 3×7 / 3×5
     三块盘上 `place` 一次都不发生（盘全程空着），3×4 上则是 898 步什么都没有、
     然后 12 匹马同时出现。一个主题是「马在走」的工具，马一步都不走。
     **判分方式不该反过来规定算法长什么样。** 现在测试改成回放 `place`/`clear`
     维护占位表（跟棋盘自己做的一样），被放弃的分支自己消失，那条最强的断言
     （每格恰好一次 + 每步都是合法马步）原样保住，马也走回来了。
     测试里另有一条断言专门钉这件事：**落子必须铺满整段搜索，不许挤在结尾**。

   · **`'cut'` 标记不会被擦掉**（跟 queens.js 同一条裁定，不要重新决定）。
     回溯只还原 `visited` 和这一格的马，标记层不随之收缩，于是别的分支里试过
     的 'cut' 会留在盘上。**显示层的做法（零步数成本）**：`interp.js` 的
     `stepBoundary` 给每条 Step 记了 `depth`，按 `Debugger.boardState` 累积
     棋盘状态时顺手记下每个 mark 是在哪个 depth 写下的，再把 depth 大于
     当前 Step.depth 的标记压暗或不画。通用，三道题共用。

   · 子集约束（规格 §2.6）：**没有三元运算符**，`a ? b : c` 会抛 unsupported，
     一律展开成 if/else；数组只有 `push` / `pop` 和 `length` 与下标读写。

   · **不导出滑杆上下限**（queens.js 有 `N_MIN`/`N_MAX`，这里故意没有）。
     理由见下面的实测表：两份算法能跑的棋盘范围差着数量级 —— 朴素这份
     4×5 就撞墙，Warnsdorff 那份 4×5 从容、3×7 又撞墙。一个对两边都
     「安全」的边界会小到把这一课本身删掉（这一课就是「它撞墙」）。
     滑杆边界因此是页面（Task 4/5）的展示决定，不是本模块的校验边界：
     `source()` 对任何 W ≥ 1、H ≥ 1 都照常吐源码，撞墙要生成出来跑给她看。

   ---- 实测步数与棋盘事件（`Interp.STEP_LIMIT` = 200,000，角起 start = 0）----

   拿两份源码各自生成的程序跑 `Interp.run(src, { host: {} })`，读 `trace.length`
   与 mark/place/clear 的次数。**四块盘都是 tour.test.js 里钉着的滑杆位置**，
   每一块演的是不同的东西：

     棋盘   本文件（朴素）        tour-warnsdorff.js      这一块盘演什么
     3×4      898 步 ✓ true       3,092 步 ✓ true    小盘上启发式的开销收不回来
     3×5   34,988 步 ✓ false    120,650 步 ✓ false   查遍了，这块盘上没有巡游
     4×5  200,000 步 ✗撞墙        7,283 步 ✓ true    大一点，启发式赢得压倒性
     3×7  200,000 步 ✗撞墙      200,000 步 ✗撞墙     启发式也会失败 —— 它不是保证

   棋盘事件（try / ok / cut / back，以及 place / clear —— place 恒等于 ok、
   clear 恒等于 back，因为进一格就落子、退一格就收子）：

     棋盘  算法        try    ok   cut   back=clear   注意
     3×4  朴素         14    12     2       **0**   一次都不回溯，'back' 演不出来
     3×4  Warnsdorff   19    12     7       **0**   同上
     3×5  朴素       1,019   395   624       395    ← 'back' 唯一演得完的一块盘
     3×5  Warnsdorff 1,019   395   624       395    ← 两份在这块盘上事件数完全相同
     4×5  朴素       6,934 2,171 4,763     2,158    撞墙前已经退了两千多次
     4×5  Warnsdorff    49    20    29       **0**  一条道走到底，一次没退过
     3×7  朴素       6,370 2,218 4,152     2,201
     3×7  Warnsdorff 1,723   591 1,132       577

   **三件 Task 4/5 必须知道的事**：
     ① 3×4 上两份算法都不回溯，所以 §2.7 的 'back' 状态和「按 `Step.depth`
        压暗旧 'cut'」那套显示逻辑在默认盘上一次都不触发 —— 要演它得换盘。
     ② **3×5 是唯一一块「两边都回溯得很凶、而且都诚实地跑到结论」的盘**
        （各退 395 次，都返回 false，都不撞墙）。它是第四个滑杆位置的全部理由。
     ③ **4×5 是并排对比最锋利的一块**：朴素退了 2,158 次还是撞墙，Warnsdorff
        一次没退、20 步走完。这一对数字比步数本身更能说明「启发式在做什么」。

   四行都在 tour.test.js 里钉着。3×4 和 3×7 是这一课诚实的那一半：
   启发式**有代价**，而且**不保证**。别为了让表好看去调棋盘。

   顺手量的、给 Task 4/5 挑滑杆上限用（本文件在这些盘上一律撞墙，
   Warnsdorff 一次不退地走完）：
     Warnsdorff  5×5 10,188 步 · 6×6 17,117 步 · 8×8 36,111 步。
   也就是说「棋盘越大启发式越省」不是修辞：8×8 上朴素回溯连百分之一都跑不到，
   Warnsdorff 只用掉上限的 18%。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoTourDFS = factory();
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
     「段」上：段内句子怎么重组都行，段的行数必须一样。

     ⚠ **两份共用的每一段英文也必须逐字相同**（跟中文那一侧同一条纪律）：
     并排 diff 这件教学事在英文界面下同样要成立，而这个工具默认英文。

     ⚠ **但这条纪律只有一半有机器门守着，另一半是人肉门** —— 别把它读成
     全都有人管。tour.test.js 的子序列门阶段 8 起两种语言各跑一次，可它的
     codeLines() 只留代码行，**整行 `//` 注释与整段块注释都被丢掉**。于是：

       · 行尾 `//` 注释里的共用英文（`mark(sq, "ok");  // …` 那一族）
         —— **机器门**。实测：只改 warnsdorff 一侧那一句，`[en]` 当场红。
       · HEAD 里的散文（常量块之上、并排读的第一屏）
         —— **机器门，阶段 8 最后一轮才补上的**（在那之前 tour.test.js 里
         `HEAD` 一次都没出现，而姊妹对 king-greedy / king-exact 一直有）。
         tour.test.js 的 headGate 两种语言各钉一次「行数相同 + diff 恰好在
         第 1/12/13/17 行」。实测：只改一侧 HEAD 的任意一行，那一侧当场红
         （zh 与 en 分别验过）。
       · HEAD 之外、独占整行的散文段（各处块注释）
         —— **人肉门**。只改一侧，两种语言照样 94 passed / 0 failed
         （补了 headGate 之后重量的；那之前是 84）。
         改这类共用散文，必须自己记得两份一起改。 */

  /* ==== 以下 HEAD 与 tour-warnsdorff.js 的 HEAD **行数相同**（各 17 行），
     逐行 diff 恰好**四处**：第 1 行的标题、第 12–13 行讲「先试哪一个」的
     两行、以及第 17 行末尾提到的是哪一份 —— **两种语言下都是这四行**。
     阶段 8 之前这里写的是「只有第 1、12–13 行不同」，同盘实测漏数了第 17 行。
     tour.test.js 的 headGate 两种语言各钉这件事一次。 ==== */
  const HEAD = [
    {
      zh: [
        '/* ============ 骑士巡游 · 朴素回溯 ============',
        '   马走「日」字：横一竖二，或者横二竖一 —— 绕着它站的那一格一共八个方向。',
        '   题目是：让马从某一格出发，把整块棋盘每一格都恰好踩一次。',
        '',
        '   格子编号：sq = 行 * W + 列。W 是棋盘的宽（每行几格），H 是高。',
        '   第 0 行是棋盘最下面那一行，第 0 列是最左边那一列 —— 于是 0 号格',
        '   就是国际象棋里的 a1。要反推回去：列 = sq % W，行 = (sq - 列) / W。',
        '   棋盘不必是正方形，3×4 和 4×5 都是正常的棋盘。',
        '',
        '   办法是「试错 + 反悔」：挑一个方向走过去，走不通就退回来换一个。',
        '   旁边那份源码跟这份只差一件事 —— 下一步先试哪一个。',
        '   这一份：按固定的方向顺序挨个试，谁也不比谁优先。',
        '   最朴素，也最诚实 —— 它不知道哪条路更有希望，只能一条条走。 */',
      ],
      en: [
        '/* ============ Knight\'s Tour · plain backtracking ============',
        '   A knight moves in an L: one across and two along, or two across and one — eight',
        '   directions in all. The task: from one square, step on every square exactly once.',
        '',
        '   Squares are numbered sq = row * W + column, where W is the width (squares per',
        '   row) and H the height. Row 0 is the bottom row and column 0 the leftmost, so',
        '   square 0 is a1 in chess. To reverse: column = sq % W, row = (sq - column) / W.',
        '   The board need not be square — 3×4 and 4×5 are perfectly normal boards.',
        '',
        '   The method is "try, then take it back": walk one way, and when it leads nowhere,',
        '   back up and take another. The source beside this differs in one thing only —',
        '   which square to try first. This one: the fixed direction order, one after',
        '   another, no favourites — plainest, honest, and blind to which road is best. */',
      ],
    },
    '',
    {
      zh: [
        '/* 棋盘的宽、高，以及马从哪一格出发。',
        '   能拧的旋钮是两个而不是一个，而工作量随格子数指数增长：',
        '   3×4 和 4×5 之间只差 8 格，这一份就从「一千步」变成「跑不完」。 */',
      ],
      en: [
        '/* The board\'s width and height, and which square the knight starts from.',
        '   Two knobs to turn here, not one, and the work grows exponentially with squares:',
        '   3×4 takes a thousand steps; 8 more for 4×5 and this one never finishes. */',
      ],
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
        '/* 备忘表：visited[sq] = 1 表示这一格已经踩过了。',
        '   一格只能踩一次 —— 这是整道题唯一的规则，别的都是围着它转的脚手架。 */',
      ],
      en: [
        '/* Lookup table: visited[sq] = 1 means this square has been stepped on already.',
        '   A square is stepped on once only — the one rule here; the rest is scaffolding. */',
      ],
    },
    'const visited = [];',
    'for (let i = 0; i < W * H; i = i + 1) { visited.push(0); }',
    '',
    {
      zh: ['// (x, y) 还在棋盘上吗？出界的方向连试都不用试。'],
      en: ['// Is (x, y) still on the board? A direction that leaves it is not worth trying.'],
    },
    'function onBoard(x, y) {',
    '  return x >= 0 && x < W && y >= 0 && y < H;',
    '}',
    '',
    {
      zh: [
        '/* 马站在 sq 上，这已经是路线上的第 n 格 —— 接着往下走。',
        '   走得通就返回 true，八个方向都走不通就返回 false 让上一层去换。',
        '   n 等于总格数时，每一格都踩过了，这一支就是答案。 */',
      ],
      en: [
        '/* The knight stands on sq, and this is already square n of the route — carry on. Return true',
        '   if a way through is found, false when all eight directions fail, so the caller switches.',
        '   When n equals the square count, every square is stepped on — this branch is the answer. */',
      ],
    },
    'function tour(sq, n) {',
    '  const x = sq % W;',
    '  const y = (sq - x) / W;',
    '  visited[sq] = 1;',
    {
      zh: ['  mark(sq, "ok");        // 已确认：这一格进了当前这条路线'],
      en: ['  mark(sq, "ok");        // Confirmed: this square joins the route being built'],
    },
    {
      zh: ['  place(sq, "wN");       // 马真的走到这一格 —— 盘上立刻看得见'],
      en: ['  place(sq, "wN");       // The knight really steps here — the board shows it at once'],
    },
    '  if (n === W * H) {',
    '    return true;',
    '  }',
    {
      zh: ['  /* 从这一格出发，八个方向里哪几个还落在棋盘上 —— 先收成一张候选表。 */'],
      en: ['  /* Which of the eight directions out of here stay on the board: a candidate list. */'],
    },
    '  const cand = [];',
    '  for (let k = 0; k < 8; k = k + 1) {',
    '    const nx = x + DX[k];',
    '    const ny = y + DY[k];',
    '    if (onBoard(nx, ny)) {',
    '      cand.push(ny * W + nx);',
    '    }',
    '  }',
    /* ↓↓↓ 这一格就是两份源码唯一不同的地方（tour-warnsdorff.js 在这里
       多一段按 degree 排序的代码）。上下都必须逐字相同，**两种语言各自
       逐字相同**。⚠ 上下那些**独占整行的**注释段是**人肉门**：子序列门的
       codeLines() 把它们整段丢掉，只改一侧两语照样全绿（见文件头）。 ↓↓↓ */
    {
      zh: ['  // 就按 DX/DY 写下来的顺序挨个试 —— 这一份不挑，也不知道该挑谁。'],
      en: ['  // Tried in the order DX/DY were written in — no picking, and no idea whom to pick.'],
    },
    /* ↑↑↑ 差异结束 ↑↑↑ */
    '  for (let i = 0; i < cand.length; i = i + 1) {',
    '    const nsq = cand[i];',
    {
      zh: ['    mark(nsq, "try");    // 正在尝试：先点亮这一格，再看它能不能走'],
      en: ['    mark(nsq, "try");    // Trying: light the square up first, then see if it works'],
    },
    '    if (visited[nsq]) {',
    {
      zh: ['      mark(nsq, "cut");  // 被剪枝：踩过的格子不能再踩'],
      en: ['      mark(nsq, "cut");  // Pruned: a square stepped on cannot be stepped on again'],
    },
    '    } else {',
    '      if (tour(nsq, n + 1)) {',
    {
      zh: ['        return true;     // 下游走通了 —— 一路把 true 传回去，别的方向不用再试'],
      en: ['        return true;     // Downstream worked — pass true all the way up, no more tries'],
    },
    '      }',
    '    }',
    '  }',
    {
      zh: [
        '  /* 回溯撤销：八个方向都试遍了还是走不通，把这一格原样退还 ——',
        '     备忘表擦掉，马也从这一格撤走。不退的话，接下来别的分支会看到一格',
        '     根本没人站过的「踩过」，从此每一条路线都是假的。',
        '     mark 与 clear 是分开的两步：先看到这一格被判「撤销」，下一步马才消失。 */',
      ],
      en: [
        '  /* Taking it back: all eight tried and none worked, so hand this square back the',
        '     way it came — wipe the table, walk the knight off. Skip that and a later branch',
        '     meets a "stepped on" square nobody stood on, making every route after it a lie.',
        '     mark and clear are two steps: marked "taken back" first, knight gone next. */',
      ],
    },
    '  visited[sq] = 0;',
    '  mark(sq, "back");',
    '  clear(sq);',
    '  return false;',
    '}',
    '',
    {
      zh: ['// 出发。第一格也要先亮一下，跟后面每一格的待遇一样。'],
      en: ['// Off we go. The first square lights up too, treated like every square after it.'],
    },
    'mark(START, "try");',
    'const found = tour(START, 1);',
    'if (found) {',
    {
      zh: [
        '  /* 盘上留着的那一整盘马就是答案本身。它们不收 —— 收了就没有答案可看了。',
        '     想看清顺序：把单步倒着回放一遍，马是按什么次序落上去的一目了然。 */',
      ],
      en: [
        '  /* The knights left standing are the answer itself. They stay — take them off and',
        '     there is nothing left to look at. For the order, step backwards through the run. */',
      ],
    },
    {
      zh: ['  log("找到了：一条踩遍 " + (W * H) + " 格的路线");'],
      en: ['  log("Found it: a route stepping on every square, " + (W * H) + " in all");'],
    },
    '} else {',
    {
      zh: ['  /* 所有分支都退过了，盘上一匹马都不剩，跟出发前一模一样。 */'],
      en: ['  /* Every branch was taken back: no knight left, exactly as before the start. */'],
    },
    {
      zh: ['  log("走不通：从这一格出发，没有能踩遍全盘的路线");'],
      en: ['  log("No way through: from this square, no route covers the whole board");'],
    },
    '}',
    'return found;',
  ];

  /* source({ W, H, start, lang }) → string

     四个参数都不给默认值，缺了直接抛（阶段 5 约束 6：公开导出的省略参数
     已经是本仓库抓到过三次的缺陷类）。一个默默变成 8 的 W 会让界面写着
     5、跑的却是 8，正是这个工具最不能出的错；`lang` 默认成任何一种，都是
     让同一个缺陷换个地方复活（它由 render() 校验，见上面）。

     ⚠ **W / H / start 的校验留在最前，`lang` 的校验在最后**（render() 里）。
     tour.test.js 那一组「缺参数当场抛」故意一个 lang 都不传、每条都带
     pattern，钉的正是这个顺序：只给了 H / start 的调用撞上的必须仍旧是
     「少了 W」。

     校验只管「是不是合法的棋盘和格子」，**不管好不好跑** —— 见文件头：
     4×5 撞墙恰恰是要生成出来跑给她看的。 */
  function source(opts) {
    const o = opts || {};
    if (o.W === undefined || o.W === null) {
      throw new Error('source({ W, H, start }) 少了 W —— 棋盘宽度没有默认值，必须写明');
    }
    if (o.H === undefined || o.H === null) {
      throw new Error('source({ W, H, start }) 少了 H —— 棋盘高度没有默认值，必须写明');
    }
    if (o.start === undefined || o.start === null) {
      throw new Error('source({ W, H, start }) 少了 start —— 出发格没有默认值，必须写明');
    }
    const W = o.W, H = o.H, start = o.start;
    if (typeof W !== 'number' || !isFinite(W) || Math.floor(W) !== W || W < 1) {
      throw new Error('W 必须是 >= 1 的整数，收到：' + W);
    }
    if (typeof H !== 'number' || !isFinite(H) || Math.floor(H) !== H || H < 1) {
      throw new Error('H 必须是 >= 1 的整数，收到：' + H);
    }
    if (typeof start !== 'number' || !isFinite(start) || Math.floor(start) !== start ||
        start < 0 || start >= W * H) {
      throw new Error('start 必须是 0 到 ' + (W * H - 1) + ' 之间的整数，收到：' + start);
    }
    return render(HEAD, o.lang)
      .concat([
        'const W = ' + W + ';',
        'const H = ' + H + ';',
        'const START = ' + start + ';',
      ])
      .concat(render(BODY, o.lang))
      .join('\n');
  }

  return { source: source };
});
