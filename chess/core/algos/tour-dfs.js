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

     `diff` 出来 42 行不同（本文件独有 5 行、另一份独有 37 行），
     其余 90 行逐字相同。42 行里 8 行是措辞（4 对：标题、讲「先试哪一个」
     的两行、常量注释里举例时提到的是哪一份），另外 34 行就是那个主意本身
     （本文件的 1 行注释 ↔ 另一份的 `degree()` 17 行 + 排序 16 行）。

   多出来的差异就是漂移。

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
     是常态（3×4 / 4×5 / 3×7 都要用到），所以编号里除的是 W 而不是某个
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

   · **`place` 只在找到答案之后才发生，搜索过程里一次都不 place** ——
     这跟 `queens.js` 不一样，是这道题被 tour.test.js 钉死的地方，写在这里
     免得下一个人「顺手改成跟皇后一致」：

       皇后那份是「摆上去 → 回溯时收回来」，place 次数 = 尝试过的节点数。
       巡游这份若照抄，3×4 上 place 会被调用十几二十次（回溯撤销的那些
       也算），而 tour.test.js 正是**从 place 事件里重建路线**再独立验证
       「每格恰好一次 + 每步都是合法马步」的 —— 一条掺了废弃分支的序列
       连长度都对不上。更要紧的是那条断言本身值得留着：一个「返回 true
       但路线是错的」实现能骗过所有只看返回值的断言，而路线正是她要学的
       东西。所以搜索过程全部交给 `mark`（'ok' 就是当前这条路线），
       `path` 数组记顺序，找到之后一格一格 `place` 出来。
       单步走那个收尾循环，看到的就是这条路线本身按顺序落到盘上 —— §2.8
       要的那个「看着结果跟着变」的时刻在这里，不在搜索途中。

   · **`'cut'` 标记不会被擦掉**（跟 queens.js 同一条裁定，不要重新决定）。
     回溯只还原 `visited` 和 `path`，标记层不随之收缩，于是别的分支里试过
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

   ---- 实测步数（`Interp.STEP_LIMIT` = 200,000，角起 start = 0）----

   拿两份源码各自生成的程序跑 `Interp.run(src, { host: {} })`，读
   `trace.length`（数字见任务报告，两边同一次运行量的）：

     棋盘     本文件（朴素）        tour-warnsdorff.js        这一格教什么
     3×4          925 步 ✓            3,119 步 ✓        小盘上启发式的开销收不回来
     4×5      200,000 步 ✗撞墙        7,326 步 ✓        大一点，启发式赢得压倒性
     3×7      200,000 步 ✗撞墙      200,000 步 ✗撞墙    启发式也会失败 —— 它不是保证

   三行都在 tour.test.js 里钉着。第一行和第三行是这一课诚实的那一半：
   启发式**有代价**，而且**不保证**。别为了让表好看去调棋盘。

   顺手量的、给 Task 4/5 挑滑杆范围用（本文件在这些盘上一律撞墙）：
     Warnsdorff  5×5 10,241 步 · 6×6 17,192 步 · 8×8 36,242 步，全部跑得完。
   也就是说「棋盘越大启发式越省」不是修辞：8×8 上朴素回溯连百分之一都跑不到，
   Warnsdorff 只用掉上限的 18%。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoTourDFS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 普通字符串拼，不用模板字面量：这段文本本身会被原样贴进 html，
     反引号在那个上下文里比在这里更容易出事（照抄 queens.js 的理由）。 */

  /* ==== 以下 HEAD 与 tour-warnsdorff.js 的 HEAD **行数相同**，
     只有第 1 行的标题和第 12–13 行讲「先试哪一个」的两行不同。 ==== */
  const HEAD = [
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
    '',
    '/* 棋盘的宽、高，以及马从哪一格出发。',
    '   能拧的旋钮是两个而不是一个，而工作量随格子数指数增长：',
    '   3×4 和 4×5 之间只差 8 格，这一份就从「一千步」变成「跑不完」。 */',
  ];

  const BODY = [
    '',
    '/* 马的八个方向。DX 与 DY 一一对应：第 k 个方向是「横走 DX[k]、竖走 DY[k]」。',
    '   横一竖二四个、横二竖一四个，绕着起点转一圈 —— 这就是「日」字。 */',
    'const DX = [1, 2, 2, 1, -1, -2, -2, -1];',
    'const DY = [2, 1, -1, -2, -2, -1, 1, 2];',
    '',
    '/* 备忘表：visited[sq] = 1 表示这一格已经踩过了。',
    '   一格只能踩一次 —— 这是整道题唯一的规则，别的都是围着它转的脚手架。 */',
    'const visited = [];',
    'for (let i = 0; i < W * H; i = i + 1) { visited.push(0); }',
    '',
    '/* 当前这条路线，按顺序记下踩过的每一格。找到答案之后照着它把马摆出来。 */',
    'const path = [];',
    '',
    '// (x, y) 还在棋盘上吗？出界的方向连试都不用试。',
    'function onBoard(x, y) {',
    '  return x >= 0 && x < W && y >= 0 && y < H;',
    '}',
    '',
    '/* 马站在 sq 上，这已经是路线上的第 n 格 —— 接着往下走。',
    '   走得通就返回 true，八个方向都走不通就返回 false 让上一层去换。',
    '   n 等于总格数时，每一格都踩过了，这一支就是答案。 */',
    'function tour(sq, n) {',
    '  const x = sq % W;',
    '  const y = (sq - x) / W;',
    '  visited[sq] = 1;',
    '  path.push(sq);',
    '  mark(sq, "ok");        // 已确认：这一格进了当前这条路线',
    '  if (n === W * H) {',
    '    return true;',
    '  }',
    '  /* 从这一格出发，八个方向里哪几个还落在棋盘上 —— 先收成一张候选表。 */',
    '  const cand = [];',
    '  for (let k = 0; k < 8; k = k + 1) {',
    '    const nx = x + DX[k];',
    '    const ny = y + DY[k];',
    '    if (onBoard(nx, ny)) {',
    '      cand.push(ny * W + nx);',
    '    }',
    '  }',
    /* ↓↓↓ 这一格就是两份源码唯一不同的地方（tour-warnsdorff.js 在这里
       多一段按 degree 排序的代码）。上下都必须逐字相同。 ↓↓↓ */
    '  // 就按 DX/DY 写下来的顺序挨个试 —— 这一份不挑，也不知道该挑谁。',
    /* ↑↑↑ 差异结束 ↑↑↑ */
    '  for (let i = 0; i < cand.length; i = i + 1) {',
    '    const nsq = cand[i];',
    '    mark(nsq, "try");    // 正在尝试：先点亮这一格，再看它能不能走',
    '    if (visited[nsq]) {',
    '      mark(nsq, "cut");  // 被剪枝：踩过的格子不能再踩',
    '    } else {',
    '      if (tour(nsq, n + 1)) {',
    '        return true;     // 下游走通了 —— 一路把 true 传回去，别的方向不用再试',
    '      }',
    '    }',
    '  }',
    '  /* 回溯撤销：八个方向都试遍了还是走不通，把这一格原样退还。',
    '     不退的话，接下来别的分支会看到一格根本没人站过的「踩过」，',
    '     从此每一条路线都是假的。 */',
    '  visited[sq] = 0;',
    '  path.pop();',
    '  mark(sq, "back");',
    '  clear(sq);',
    '  return false;',
    '}',
    '',
    '// 出发。第一格也要先亮一下，跟后面每一格的待遇一样。',
    'mark(START, "try");',
    'const found = tour(START, 1);',
    'if (found) {',
    '  log("找到了：一条踩遍 " + (W * H) + " 格的路线");',
    '  /* 摆出答案。搜索途中盘上只有颜色标记、没有棋子，到这里才把马沿着',
    '     path 一格一格摆上去 —— 单步走完这个循环，看到的就是这条路线本身。 */',
    '  for (let i = 0; i < path.length; i = i + 1) {',
    '    place(path[i], "wN");',
    '  }',
    '} else {',
    '  log("走不通：从这一格出发，没有能踩遍全盘的路线");',
    '}',
    'return found;',
  ];

  /* source({ W, H, start }) → string

     三个参数都不给默认值，缺了直接抛（阶段 5 约束 6：公开导出的省略参数
     已经是本仓库抓到过三次的缺陷类）。一个默默变成 8 的 W 会让界面写着
     5、跑的却是 8，正是这个工具最不能出的错。

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
    return HEAD.concat([
      'const W = ' + W + ';',
      'const H = ' + H + ';',
      'const START = ' + start + ';',
    ]).concat(BODY).join('\n');
  }

  return { source: source };
});
