/* N 皇后（回溯 + 剪枝）的**算法源码生成器**（规格 §2.1）。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   跟 `minimax.js` 是同一个形状：这个模块本身不搜索任何东西 —— 它吐出一段
   **字符串**。那段字符串同时是：
     · 喂给 `Interp.run` 去真跑的程序，
     · 喂给 `Editor.mount` 摆在使用者眼前的那份源码。
   一份字符串两个用途，所以「看到的」和「跑的」不可能漂移。工具⑤ 比工具④
   更靠这一条：§2.8 的整个落点就是她动手改这段源码、看着结果跟着变，
   §2.9 还要从这份源码里挖空 —— 参考答案就是这份正在跑的源码本身。

   **生成出来的那段源码里的注释和命名，是写给一个没学过棋的 16 岁读者的**。
   本文件自己的注释（就是你正在读的这些）是给维护者的，两套读者，两种口吻。

   ---- 几处必须写下来的约定 ----

   · **入口函数叫 `solve`**，对应 `PROBLEMS.queens.entry`。它是**递归**那一
     个（`solve(r)` 摆第 r 行），不是一个只调用一次的外壳 —— 计划里
     「queens 的 z 是递归深度」要成立，`TreeModel.build(trace, 'solve')`
     认到的帧就必须一层套一层。顶层是 `solve(0); return solutions;`，
     所以 `run().result` 就是解数。

   · **格子编号 `sq = r * N + c`，r 是行、c 是列，r=0 是棋盘最下面一行、
     c=0 是最左列**。于是 0 号格就是 a1 —— 跟 `BoardRender.layout()` 的
     `squareCenter(file, rank)`（rank 0 在下）和 `chess-core.js` 的
     `SQ(file, rank)` 同向，宿主拿到 sq 之后 `c = sq % N; r = (sq - c) / N`
     就能直接喂给渲染层，不用在中间翻一次上下。这个约定在生成的源码开头
     也用她的话写了一遍 —— 她要能自己反推格子。

   · **宿主桥接这一阶段是真用的**（工具④ 一个都不用）：`mark(sq, kind)`
     画规格 §2.7 的四种状态，四个 kind 逐字是
       'try'（正在尝试）· 'ok'（已确认）· 'cut'（被剪枝）· 'back'（回溯撤销），
     `place(sq, 'wQ')` 摆真正的后，`clear(sq)` 收回去。

     **`place` 的第二个参数是字符串 'wQ'（裁定：保持字符串）**，而
     `BoardRender.drawPiece` 吃的是**数字** code（白后 = 5）：
     `CODE_KEY[Math.abs(o.code)]` 认不出 'wQ' 就 `return`，**一个后都不画，
     也不报任何错** —— 最难查的那一类。这次 'wQ' → 5 的换算归页面
     （Task 4/5）做，不在这里。

     而且仓库里**已经有一个反例**：`tools/_debugger-preview.html` 里内嵌的
     那份 N 皇后示例（约 155–172 行）写的是 `place(sq(col, row), 5)` ——
     数字 code，而且它的 `sq(f, r)` 返回的是 `"a1"` 这样的**代数记法字符串**，
     不是整数。也就是说这两份算法源码的 `sq` 与 piece 两个参数**类型正好相反**，
     而恰好是旧的那一份能直接喂给 `drawPiece`。Task 4/5 别照着那一份抄映射。

     `mark(sq,'back')` 紧跟着 `clear(sq)`，而 `clear` 会把棋子层和标记层
     一起清掉（见 interp.js 的 wrapHostForTrace）—— 这是故意的：两条语句
     是两步，她单步时先看到这一格被判「撤销」，下一步它整个消失。

   · **`'cut'` 标记不会被擦掉（裁定：留在显示层解决）**。回溯只还原三张表和
     那一格的棋子，标记层不随之收缩，于是更上面那些行在别的分支下试过的
     `'cut'` 会留在棋盘上。实测 N=6：同一时刻峰值有 29/36 格带标记
     （cut 24 · ok 4 · try 1）。源码侧的两种修法都量过、都不划算：
     每个节点擦一整行 +18.7%（N=8 会到约 186,000 步，只剩 7% 余量），
     `mark(sq,'cut')` 之后立刻 `clear(sq)` +8.7%（而且 cut 只闪一步就没了，
     「这一整行都被攻击」的画面也就没了）。
     **显示层的做法（零步数成本）**：`interp.js` 的 `stepBoundary` 给每一条
     Step 都记了 `depth`（= 当时的调用栈深度，见 interp.js 约 1861 行）。
     所以按 `Debugger.boardState` 那样累积棋盘状态时，顺手把每个 mark 记成
     「它是在哪个 depth 写下的」，再把 depth 大于当前 Step.depth 的标记压暗
     或不画即可 —— 通用、不需要知道算法在做什么，别的两道题也照用。

   · **`safe(r, c)` 单独成一个函数，函数体只有一行**。§2.9 挖的就是那一行
     （`id=safe-return`、level=1「填一个表达式」），参考答案就是它自己。
     这道缝验过：把那一行换成一个恒假的表达式，程序**照常跑完**，
     `result` 变成 0 —— 不抛、不截断，正是挖空练习要的那种「跑得完但答错」，
     判定靠比结果而不是靠比文本（§2.9）。占位的 `fill` 用的正是这个恒假式
     （`return false;`）：恒**真**的那一版反过来会把剪枝整个拿掉，搜索树
     退化成满的 N^N 棵树，实测 N>=6 就撞上 200,000 步上限被截断、`result`
     是 `undefined` —— 占位版连「跑得完」都做不到。

     **两组 `// >>> BLANK` 指令现在就写在下面的 `BODY` 里**（`safe-return`
     与 `undo`），由 `core/exercise.js` 的 `parse()` 消费。它们是注释，
     **一步都不产生**：插入前后 N=4..8 的步数与解数逐格相同（770 / 2,621 /
     9,500 / 37,049 / 156,772，解 2 / 10 / 4 / 40 / 92），把四行指令剥回去
     再跑也逐字节一致 —— 「参考答案就是这份正在跑的源码本身」这个支点没有
     被动过。三关六条断言在 `core/exercise-blanks.test.js`。

   · 子集约束（规格 §2.6）：**没有三元运算符**，`a ? b : c` 会抛
     unsupported，一律展开成 if/else；数组只有 `push` 和 `length`。

   ---- 实测步数（`Interp.STEP_LIMIT` = 200,000）----

   拿本文件生成的源码跑 `Interp.run(src, { host: {}, limit: 5e7 })`，
   读 `trace.length`：

     N=4    770 步 / 2 解        N=7   37,049 步 / 40 解
     N=5  2,621 步 / 10 解       N=8  156,772 步 / 92 解   ← 滑杆上限
     N=6  9,500 步 / 4 解        N=9  705,359 步（跑不完，实测会截断）

   （每个 N 比不喊 `log` 的版本多整整「解数」那么多步 —— 一个解一句话。
   N=8 是 +92 步、+0.06%。）

   计划与规格 §4⑤ 原先写的那张表（557 / 1,838 / 6,509 / 25,118 / 105,319）
   是另一份**把 `safe` 内联了**的实现量出来的，比这份便宜约三分之一 ——
   差价的去处已经逐行量过（按 line 统计 trace）：`safe(r, c)` 每次调用要
   4 步（if 语句 1 + 进帧 1 + 那行 return 1 + 出帧 1），N=8 光这一项就是
   62,880 步，占 40%；`const sq = r * N + c;` 再要 15,720 步（10%）。
   两处都是**故意**留的：前者是 §2.9 的挖空缝（简报明文要求 safe 单独成
   函数），后者让下面五处 `mark/place/clear` 都能写 `sq` 而不是重复五遍
   `r * N + c`。**不要为了对齐一个更小的旧数字把这个函数内联回去** ——
   那等于把 §2.9 的练习拆掉。规格 §4⑤ 的表已按本文件的实测值更新。

   N=8 用掉上限的 78%，余下约 43,000 步。**这不是一个可以随手挥霍的余量**
   —— 往生成源码的最内层循环里每加一条语句，N=8 就要多约 15,700 步，
   加三条就撞墙。改完这里请重跑 queens.test.js：「N=8 未截断」那一条就是
   这道守卫。

   N=9 撞墙是这道题的第二课，也是滑杆上限只到 8 的理由：回溯是指数的，
   不是「慢一点」，是「做不到」。所以 `N_MAX` 是给滑杆用的，**不是**
   `source()` 的校验边界 —— 测试要拿 N=9 去撞那堵墙，`source(9)` 必须
   照常吐出源码。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoQueens = factory();
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

  /* 滑杆的上下限（规格 §4⑤ / 计划 Task 4 的 params）。
     N_MIN = 4 是因为 N=2、N=3 无解 —— 一个永远数出 0 的演示教不了任何东西。
     N_MAX = 8 是因为 N=9 跑不完（见文件头的实测）。
     再说一遍：这两个数字**只约束界面**，不约束 source()。 */
  const N_MIN = 4;
  const N_MAX = 8;

  /* 这里用普通字符串拼，不用模板字面量：这段文本本身会被原样贴进 html，
     而反引号在那个上下文里比在这里更容易出事（照抄 minimax.js 的理由）。

     元素两种：字符串（代码 / 空行 / BLANK 指令行，两语逐字相同）与
     `{ zh: [], en: [] }`（一段散文，两边行数必须相等）—— 见上面 render()。
     英文不是逐句直译，是照中文那一版的意思与语气重写的，行数对齐落在
     「段」上：段内句子怎么重组都行，段的行数必须一样。 */
  const HEAD = [
    {
      zh: [
        '/* ============ N 皇后 ============',
        '   在 N×N 的棋盘上摆 N 个后，让它们谁也吃不到谁。',
        '   后能沿横线、竖线、两条斜线走任意远，所以「谁也吃不到谁」就是：',
        '   任意两个后不同行、不同列、也不在同一条斜线上。',
        '',
        '   格子编号：sq = 行 * N + 列，下面写成 sq = r * N + c。',
        '   第 0 行是棋盘最下面那一行，第 0 列是最左边那一列 —— 于是 0 号格',
        '   就是国际象棋里的 a1，右边棋盘上每一格都能这样对上号。',
        '   要反推回去：列 = sq % N，行 = (sq - 列) / N。',
        '',
        '   整个解法只靠一个约定：每一行只放一个后。',
        '   这样「同行」根本不可能发生，要查的就只剩列和两条斜线了。 */',
      ],
      en: [
        '/* ============ N Queens ============',
        '   Place N queens on an N×N board so that none can capture another.',
        '   A queen slides any distance along a row, a column or either diagonal, so',
        '   "none can capture another" means no two share a row, column or diagonal.',
        '',
        '   Squares are numbered sq = row * N + column, written below as r * N + c.',
        '   Row 0 is the bottom row and column 0 is the leftmost column, so square 0',
        '   is a1 in chess — every square on the board to the right maps the same way.',
        '   To go the other way: column = sq % N, row = (sq - column) / N.',
        '',
        '   The whole solution rests on one convention: only one queen per row.',
        '   That makes "same row" impossible, leaving columns and diagonals to check. */',
      ],
    },
    '',
    {
      zh: [
        '/* 棋盘边长。8 皇后就是 N = 8 —— 这是这道题唯一的旋钮。',
        '   往上加一，工作量大约要乘以 4.5：N=8 十五万步跑得完，N=9 七十万步',
        '   会直接撞上执行上限。回溯就是这样，不是「慢一点」，是「做不到」。 */',
      ],
      en: [
        '/* The side of the board. Eight queens means N = 8 — the only dial here.',
        '   Add one and the work multiplies by about 4.5: 150,000 steps at N=8, 700,000 at N=9,',
        '   which blows the execution limit. That is backtracking: not slower, but impossible. */',
      ],
    },
  ];

  const BODY = [
    '',
    {
      zh: [
        '/* 三张备忘表，记「这条线上已经有后了」。1 = 占了，0 = 还空着。',
        '     cols[c]              第 c 列',
        '     diagDown[r + c]      「左上—右下」这族斜线：同一条上，行 + 列 是同一个数',
        '     diagUp[r - c + N]    「左下—右上」这族斜线：同一条上，行 - 列 是同一个数',
        '                          （行 - 列 会是负数，而下标不能是负的，所以整体加 N）',
        '   不用表也行：每摆一个后，就跟已经摆好的后逐个比一遍。但那样每次要比',
        '   最多 N 次，查表只要三次下标运算 —— 「剪枝要便宜」说的就是这个。',
        '   列只有 N 条、斜线有 2N-1 条，三张表干脆都开到 2N 格，省得记三个长度。 */',
      ],
      en: [
        '/* Three lookup tables recording "this line already has a queen". 1 = taken, 0 = free.',
        '     cols[c]              column c',
        '     diagDown[r + c]      diagonals running down-right: row + column is constant',
        '     diagUp[r - c + N]    diagonals running up-right: row - column is constant',
        '                          (row - column can go negative and indices cannot, so add N)',
        '   You could do without them: compare each new queen with every queen already',
        '   placed. But that is up to N checks against three lookups: pruning must be cheap.',
        '   N columns and 2N-1 diagonals — give all three 2N slots and track just one length. */',
      ],
    },
    'const cols = [];',
    'const diagDown = [];',
    'const diagUp = [];',
    'for (let i = 0; i < N + N; i = i + 1) { cols.push(0); diagDown.push(0); diagUp.push(0); }',
    '',
    {
      zh: ['// 到现在为止数出来的完整解个数 —— 这就是最后要回答的那个数。'],
      en: ['// How many complete solutions we have counted so far — the final answer.'],
    },
    'let solutions = 0;',
    '',
    {
      zh: [
        '/* 第 r 行第 c 列这一格，安全吗？三条线上都没有后才算安全。',
        '   这一行就是整道题的全部规则，别的都是围着它转的脚手架。',
        '   想确认它真的在起作用：把 diagUp 那一段删掉再跑，解数立刻就不对了。 */',
      ],
      en: [
        '/* Is the square in row r, column c safe? Only if all three lines are clear.',
        '   This one line is the entire rule of the puzzle; everything else is scaffolding.',
        '   To see it working, delete the diagUp test and rerun: the count goes wrong. */',
      ],
    },
    'function safe(r, c) {',
    '  // >>> BLANK id=safe-return level=1 fill="return false;" hint="三条线都空着才算安全：cols[c] 是这一列，diagDown[r + c] 和 diagUp[r - c + N] 是那两条斜线。表里是 1 就说明那条线上已经有后了 —— 三张表一张都不能少查。" hintEn="A square is safe only when all three lines are clear: cols[c] for the column, diagDown[r + c] and diagUp[r - c + N] for the two diagonals. A 1 in any of the three tables means that line already has a queen on it."',
    '  return !cols[c] && !diagDown[r + c] && !diagUp[r - c + N];',
    '  // <<< BLANK',
    '}',
    '',
    {
      zh: [
        '/* 把第 r 行到最上面一行全部摆好。',
        '   r 一路往上走，走到 N 就说明每一行都摆上了一个后 —— 那就是一个完整解，',
        '   数它一个，这一支到此为止。 */',
      ],
      en: [
        '/* Fill in every row from row r up to the top of the board.',
        '   r climbs upward, and reaching N means every row has a queen on it — that is',
        '   a complete solution: count it, and this branch ends here. */',
      ],
    },
    'function solve(r) {',
    '  if (r === N) {',
    {
      zh: [
        '    /* 走到这里：N 行都摆满了，而且一路上每一步都通过了 safe ——',
        '       此刻棋盘上就是一个完整解，N 个后谁也吃不到谁。',
        '       这是这道题唯一值得停下来看一眼的时刻，所以喊一声。 */',
      ],
      en: [
        '    /* We got here: all N rows are filled and every step along the way passed',
        '       safe. What is on the board right now is a complete solution — N queens,',
        '       none able to capture another. The one moment in this puzzle worth a shout. */',
      ],
    },
    '    solutions = solutions + 1;',
    {
      zh: ['    log("第 " + solutions + " 个解：" + N + " 个后都站稳了");'],
      en: ['    log("Solution " + solutions + ": all " + N + " queens are safe");'],
    },
    '    return;',
    '  }',
    '  for (let c = 0; c < N; c = c + 1) {',
    '    const sq = r * N + c;',
    {
      zh: ['    mark(sq, "try");      // 正在尝试：先点亮这一格，再问它安不安全'],
      en: ['    mark(sq, "try");      // Trying: light the square up first, then ask if it is safe'],
    },
    '    if (safe(r, c)) {',
    {
      zh: ['      // 已确认：三条线一起登记成「占了」，再把真正的后摆上去。'],
      en: ['      // Confirmed: register all three lines as taken, then place the real queen.'],
    },
    '      cols[c] = 1; diagDown[r + c] = 1; diagUp[r - c + N] = 1;',
    '      mark(sq, "ok");',
    '      place(sq, "wQ");',
    {
      zh: ['      solve(r + 1);       // 接着摆上面那一行 —— 递归就发生在这一行'],
      en: ['      solve(r + 1);       // now fill the row above — this line is the recursion'],
    },
    {
      zh: [
        '      /* 回溯撤销：不管上面那一行找没找到解，都要把这一格原样还回去。',
        '         不还的话，接下来试第 c+1 列时会看到一个早就不该存在的后，',
        '         再往后数出来的每一个「解」都是假的。 */',
      ],
      en: [
        '      /* Backtracking undo: no matter what the row above found, this square',
        '         has to go back exactly as it was. Otherwise the next column, c+1,',
        '         sees a queen that should be long gone, and every "solution" after is fake. */',
      ],
    },
    '      // >>> BLANK id=undo level=2 fill="cols[c] = 0;" hint="摆上去的时候三张表一起登记成了 1，撤销就要把这三张表一起还回 0。少还一张，那条线在这一支之后就一直被占着 —— 后面每一步读到的都是一张早就不该是这样的表。" hintEn="Placing the queen set all three tables to 1, so undoing has to clear all three back to 0. Miss one and that line stays blocked for the rest of the search, and every later step reads a table that should have been cleared long ago."',
    '      cols[c] = 0; diagDown[r + c] = 0; diagUp[r - c + N] = 0;',
    '      // <<< BLANK',
    '      mark(sq, "back");',
    '      clear(sq);',
    '    } else {',
    {
      zh: ['      mark(sq, "cut");    // 被剪枝：这一格已经被某个已放好的后攻击了'],
      en: ['      mark(sq, "cut");    // Pruned: a queen already on the board attacks this square'],
    },
    '    }',
    '  }',
    '}',
    '',
    {
      zh: ['// 从最下面一行开始摆。跑完之后 solutions 里就是答案。'],
      en: ['// Start from the bottom row. When it finishes, solutions holds the answer.'],
    },
    'solve(0);',
    'return solutions;',
  ];

  /* source({ N, lang }) → string

     N 不给默认值，缺了直接抛（阶段 5 约束 6：公开导出的省略参数已经是
     本仓库抓到过三次的缺陷类）。一个默默变成 8 的 N 会让界面写着 6、
     跑的却是 8，正是这个工具最不能出的错。

     校验只管「是不是一个 ≥ 1 的整数」，**不管 N_MIN / N_MAX** —— 见文件
     头：那两个是滑杆边界，而 N=9 撞墙恰恰是要生成出来跑给她看的。 */
  function source(opts) {
    const o = opts || {};
    if (o.N === undefined || o.N === null) {
      throw new Error('source({ N }) 少了 N —— 棋盘边长没有默认值，必须写明');
    }
    const N = o.N;
    if (typeof N !== 'number' || !isFinite(N) || Math.floor(N) !== N || N < 1) {
      throw new Error('N 必须是 >= 1 的整数，收到：' + N);
    }
    return render(HEAD, o.lang)
      .concat(['const N = ' + N + ';'])
      .concat(render(BODY, o.lang))
      .join('\n');
  }

  return { source: source, N_MIN: N_MIN, N_MAX: N_MAX };
});
