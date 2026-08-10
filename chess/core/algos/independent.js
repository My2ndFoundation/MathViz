/* 马的最大独立集（回溯 + 两条剪枝）的**算法源码生成器**（规格 §2.1）。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   跟 `queens.js` / `path-count.js` / `knight-path.js` / `tour-*.js` /
   `minimax.js` / `king-*.js` / `rook-cover.js` / `bitboard.js` 是同一个
   形状：这个模块本身不搜索任何东西 —— 它吐出一段**字符串**。那段字符串
   同时是喂给 `Interp.run` 去真跑的程序、和喂给 `Editor.mount` 摆在使用者
   眼前的那份源码。一份字符串两个用途，所以「看到的」和「跑的」不可能漂移。

   **生成出来的那段源码里的注释和命名，是写给一个没学过棋、正在学算法的
   十六岁读者的**。本文件自己的注释（就是你正在读的这些）是给维护者的，
   两套读者，两种口吻。

   ---- 题面 ----

   在 `N×N` 的盘上摆尽可能多的马，让它们谁也攻击不到谁，返回**最多能摆
   几匹**。规格 §4⑤ 给这道题的存在理由只有一句：**它和 N 皇后是同一把
   锤子**（逐格「选 / 不选」→ 冲突就跳过 → 回溯），敲的却是一颗形状完全
   不同的钉子。教的是**迁移**，不是又一道回溯题。

   ⚠ 别把这道题的返回值和 `queens.js` 的混为一谈：`queens` 返回的是**解的
   个数**（N=6 时是 4），这里返回的是**最大独立集的大小**（4×4 时是 8）。
   可比的是「摆了几枚子」（N 枚后 vs ⌈n²/2⌉ 匹马），不是两个返回值。

   ---- 四处「自己验」的结论（阶段 9e task 1 brief 明确要求）----

   ① **`DR` / `DC` 那四个「向后」方向**：判据是「按 0..SQ-1 顺序扫，考虑第
      `at` 格时，下标更小的邻居」，也就是 `dr * N + dc < 0` 的那四个。八个
      马步逐个算过（`scratchpad/9e-t1-fourvseight.js` 打印了 N=2/3/4/5 四档
      的全表）：

        (-1,-2) → -N-2    (-2,-1) → -2N-1    (-2,+1) → -2N+1    (-1,+2) → -N+2
        (+1,+2) →  N+2    (+2,+1) →  2N+1    (+2,-1) →  2N-1    (+1,-2) →  N-2

      上面一行恒负（N ≥ 3 时 `-N+2` 也是负的），下面一行恒正，**brief 给的
      四个方向完全正确**。

      「查八个 vs 查四个」的对拍分两个口径做过，因为**解释器这个口径覆盖不了
      三档**：把生成源码改成查八个方向，N=3 → 5（步数 2,593 → 3,278）、
      N=4 → 8（18,285 → 22,597）结果不变，**N=5 直接撞上限被截断**，那一档
      在解释器里根本比不出来。所以另拿一份纯 JS 的同构实现（不受 STEP_LIMIT
      约束，`scratchpad/9e-t1-fourvseight.js`）跑了 N=1…7 七档，**结果与 pick
      节点数逐个相同**（1 / 4 / 5 / 8 / 13 / 18 / 25），再用「枚举所有子集」
      这第三份思路完全不同的实现复核了 N ≤ 5 那五档。

   ② ⚠ **这里撞到了计划 / 规格写错的一处**（记在这里，不许照抄）。
      规格 §4⑤⑤ 与计划都写着：「`N ≥ 3` 是这条优化的正确性前提……在 N=2 上
      这段代码会**真的漏查**」。**实测不成立。** N=2 时 `-N+2 = 0` 的确让
      `(-1,+2)` 不再是「向后」，但 **2×2 的盘上八种马步一步都落不进盘内**
      （`|dc| = 2 > N-1`、`|dr| = 2 > N-1`），四个方向全部不可达，漏查的是
      一个空集。实测 N=2 查四个与查八个都给出 **4**，且都是正确答案。
      真正非要 `N ≥ 3` 不可的是**另一件事**：同色论证 `⌈n²/2⌉`。n=2 时盘上
      任意两格互不攻击，答案是 **4**，而 `⌈4/2⌉ = 2` —— 那个公式在 n=2 上
      是错的。**下限 3 的理由挂错了地方**，生成源码的注释里按实测写。

   ③ **上界剪枝 `cnt + (SQ - at) <= best` 是紧的、不会剪掉最优解**：进入
      `pick(at, cnt)` 时，`0..at-1` 已经定完、手上 `cnt` 匹马，还剩 `SQ - at`
      个格子没问。这一支的**上限**是「剩下的全摆得上」，即 `cnt + (SQ - at)`。
      上限都超不过 `best`，实际值更超不过。而 `best` 只在 `cnt > best`（严格
      大于）时更新，所以连「刚好打平」的分支剪掉也不损失任何东西。
      突变实测（把这一支整个删掉）：N=3 / N=4 的结果**一个都没变**（5 / 8），
      步数 2,593 → 6,774（+161%）、18,285 → 96,914（+430%），节点数
      108 → 297、758 → 4,214；而 **N=5 当场撞上限被截断**（200,000 步，
      `result` 变成 `undefined`）。所以这一行不是「快一点」——**它是 N=5
      能进滑杆的前提**。

   ④ **`cut` 这种 mark 计划的骨架根本没发**。规格 §4⑤⑤ 明写「上界剪枝这一条
      给 `cut` 那种 mark，是图例里『剪枝』那一行的来源」，所以按规格在剪枝
      那一支补了 `mark(at, "cut")`，并复测了三档步数（见下面的实测表）：
      每次剪枝恰好 +1 步，N=5 从 191,021 涨到 193,196。
      ⚠ **`place` / `clear` 与 `mark` 的顺序**：源码是 `clear(at)` 在前、
      `mark(at, "back")` 在后。读过 `debugger.js` 的 `boardState()`（约 443 行）：
      它按 `boardOps` 的先后逐条应用，`clear` 会**同时**删掉 `marks[sq]` 与
      `pieces[sq]`，`mark` 只写 `marks[sq]`。所以这个顺序的净效果是「马收走、
      格子上留下一个『撤销』标记」，正是想要的画面；反过来（照 `queens.js`
      那样先 `mark` 后 `clear`）标记会被 `clear` 一起抹掉，只在单步时闪一下。
      两种都不会把页面层绊住，这里选前者。

   ---- 这道题发哪几种 mark：`ok` / `cut` / `back`，**没有 `try`** ----

   `queens.js` 每试一格发一次 `try`，这道题不能这么干：`pick` 的节点数是
   108 / 758 / **7,894**，N=5 补一条 `try` 就是每个节点多一步 —— **实测**
   （真的加上去跑过一次）：N=5 当场 `truncated: true`、`result` 变成
   `undefined`，撞穿 200,000。所以 `kinds` 是三行不是四行。
   **这不是省略，是 N=5 那 3.4% 的余量买不起。**（Task 2 声明 `kinds` 时按
   `ok` / `cut` / `back` 三行写。）

   ---- 几处必须写下来的约定 ----

   · **入口函数叫 `pick`**（对应 `PROBLEMS.independent.entry`）。它是**递归**
     那一个：`pick(at, cnt)` 决定第 `at` 格选不选，两支都以 `pick(at + 1, …)`
     收尾，顶层是 `pick(0, 0); return best;`。于是
     `TreeModel.build(trace, 'pick')` 认到的帧一层套一层，**深度塔 = SQ + 1 层**
     —— 实测 N=3 → 10 层、N=4 → 17 层、N=5 → **26 层**，比前面任何一道题都高。
     ⚠ 默认 `SPAN_Z = 0.55` 是照 `queens` 最深 10 层定的，26 层不声明
     `spanZ` 会长到 26 × 0.55 ≈ 14.3 个世界单位。**Task 2 必须自己声明
     `spanZ ≈ 0.20`**（26 × 0.20 = 5.2，与 queens 的 5.5 同量级）。
     `independent.test.js` 里有一条断言钉着 `深度 === SQ + 1`。

   · **格子编号 `sq = r * N + c`**，r 是行、c 是列，r=0 是棋盘最下面一行、
     c=0 是最左列，0 号格就是 a1 —— 跟 `queens.js` / `bitboard.js` 同向。
     **这道题对这个约定的依赖比别的题都深**：「只查向后四个邻居」整条优化
     就架在「编号顺序 = 扫描顺序」上面，翻一次上下这段代码当场静默出错。

   · **本任务调四个桥接**：`place(at, "wN")` / `clear(at)` 摆和收真的马、
     `mark(at, kind)` 画三种状态、`log(...)` 在破纪录时喊一声。第五个
     `attacked` 这道题用不上（冲突判定走 `chosen` 表，不问宿主）。
     ⚠ **桥接缺席是静默 no-op**（9d 实测，`bitboard.js` 文件头也记着）：
     宿主没给 `place` 时解释器落到 `NOOP_HOST`，把 `place(at, "wN")` 整行
     删掉不抛、不改 `result`、也不动 `mark` 通道。所以 `independent.test.js`
     里有一组打桩 host 的配对断言（次数相同 / 收尾归零 / 不重复摆 / 不清空
     格子 / 峰值 == 返回值），**并且亲手验过它真的能红**：把 `place` 那一行
     删掉再跑，`result` 仍是 5 / 8 / 13、`mark` 通道一个数都没变、一个错都
     没抛，而那组断言**当场 18 条变红**（三档各 6 条）。

   · **`log` 那一行不是可有可无的装饰**，它是第③道双语门在这份文件上唯一的
     牙齿。9d 实测：对「双语片段全部是注释」的文件（`bitboard.js` 就是），
     「英文变体抽掉注释后没有汉字」这道门**恒真** —— 正则先把注释抽光了，
     剩下的代码行两语逐字相同。这份文件因为有一行 `log("新纪录：…")`
     （**字符串字面量在注释外面**）才让那道门真的守得住东西，突变实测过
     （en 那一支的文案换成中文，当场红）。

   · 子集约束（规格 §2.6）：**没有模板字面量、没有正则字面量、没有
     `for…in`、没有 `try/catch`、没有解构、没有三元运算符**，字符串用 `+`
     拼。生成出来的这份源码只用到 `const`/`let`、数组字面量与索引、`if`、
     `while`、函数与递归 —— 连 `for` 都没用到，子集用得比允许的更窄。

   ---- 实测（`Interp.STEP_LIMIT` = 200,000，**拿本文件生成的源码**跑）----

     N   结果   步数      占上限    深度塔   pick 节点   place/clear   cut
     3    5      2,593     1.3%      10       108         33 / 33       29
     4    8     18,285     9.1%      17       758        201 / 201     199
     5   13    193,200    96.6%      26     7,894      2,183 / 2,183  2,175
     6    —   撞上限（`trace.truncated`）—— **滑杆与 source() 的上限就是 5**

   同色下界 `⌈N²/2⌉` 三档全部吻合（5 / 8 / 13），这是与「另一份实现」并列
   的第二条独立判据 —— 它是数学事实，不是又一份代码。

   ⚠ **N=5 用掉 96.6%，只剩 6,800 步。** 这不是一个可以随手挥霍的余量：往
   `pick` 里每加一条会在每个节点执行的语句，N=5 就要多约 7,900 步，加一条
   就撞墙。改完这里请重跑 `independent.test.js`——「三档都没撞上限」那三条
   就是这道守卫。**不许为了塞东西进去而调 `STEP_LIMIT`**（规格 §7 立的门，
   也是这套工具「朴素回溯真的会爆」那一课的一部分）。

   ---- 8×8 那个 32 不在这里 ----

   最大独立集是 NP 难的，朴素回溯要在 2^(n²) 的空间里搜，这台解释器到 5×5
   就到头了。8×8 的答案（32）由 `tips` 的同色论证交付，**不靠搜索** ——
   ⚠ **不许为了让大盘出数字而在源码里塞一条「大盘走同色公式」的分支**
   （规格 §4⑤②；和 9d 拒绝 `if (USE_MASK)` 是同一条规矩：源码必须是
   「真引擎就这么写的」那一份）。这道题的结构就是：小盘上回溯把「最优」
   证明给你看，到了大盘搜索彻底不 scale，答案只能靠一个想法拿到。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoIndependent = factory();
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

  /* 滑杆的上下限（规格 §4⑤ 9e ①）。**与 `queens.js` 不同**：那边的
     N_MIN / N_MAX 只约束界面、不约束 source()（N=9 撞墙正是要生成出来跑给
     她看的一课）；这边 source() 自己就把 3–5 钉死了，因为 N=6 连跑都跑不完，
     生成一份注定被截断的源码只会让页面拿到一个 undefined 的结果 —— 那不是
     一课，那是一个空白。「回溯会爆」这一课这里由 tips 讲，不由一次截断讲。

     N_MIN = 3：2×2 上马一步都走不出去（八种走法一种都落不进盘内），答案是
     「四格全摆」而不是 ⌈2²/2⌉ = 2 —— 同色论证在 n=2 上不成立，而那条论证
     正是这道题的落点。N_MAX = 5：见文件头的实测表。 */
  const N_MIN = 3;
  const N_MAX = 5;

  /* 这里用普通字符串拼，不用模板字面量：这段文本本身会被原样贴进 html，
     反引号在那个上下文里比在这里更容易出事（照抄 queens.js 的理由）。

     元素两种：字符串（代码 / 空行，两语逐字相同）与 `{ zh: [], en: [] }`
     （一段散文，两边行数必须相等）—— 见上面 render()。这一份**一个挖空
     都没有**，所以没有 BLANK 指令行那一类。
     英文不是逐句直译，是照中文那一版的意思与语气重写的，行数对齐落在
     「段」上：段内句子怎么重组都行，段的行数必须一样。 */
  const HEAD = [
    {
      zh: [
        '/* ============ 马的最大独立集 ============',
        '   在 N×N 的棋盘上摆尽可能多的马，让它们谁也攻击不到谁。',
        '   马走「日」字：一个方向走一格、另一个方向走两格，一共八种走法。',
        '',
        '   格子编号：sq = 行 * N + 列，下面写成 sq = r * N + c。',
        '   第 0 行是棋盘最下面那一行，第 0 列是最左边那一列 —— 于是 0 号格就是',
        '   国际象棋里的 a1。要反推回去：列 = sq % N，行 = (sq - 列) / N。',
        '',
        '   ⚠ 这道题和 N 皇后是同一把锤子。一格一格往下走，每一格问一句「选还是',
        '   不选」；选了就先检查冲突，冲突就整支跳过；走到最后一格，把手上的战果',
        '   跟纪录比一比；然后退回来，换另一条路再走一遍。皇后那题挑的是「这一行',
        '   的后摆哪一列」，这道题挑的是「这一格摆不摆马」—— 题面差得很远，解法',
        '   一模一样。这就是这道题值得单独存在的理由：换一颗钉子，锤子不用换。 */',
      ],
      en: [
        '/* ============ Knights: the Largest Non-Attacking Set ============',
        '   Place as many knights as possible on an N x N board, none attacking another.',
        '   A knight moves in an L: one step one way, two the other — eight moves in all.',
        '',
        '   Squares are numbered sq = row * N + column, written below as r * N + c.',
        '   Row 0 is the bottom row and column 0 is the leftmost column, so square 0 is',
        '   a1 in chess. To go back the other way: column = sq % N, row = (sq - column) / N.',
        '',
        '   Warning, and it is the whole point of this problem: this is the same hammer',
        '   as N Queens. Walk the squares one at a time; ask "take it or leave it" at each;',
        '   check for a conflict before taking; at the last square compare what you have',
        '   against the record; then back out and walk the other road. Queens picks a',
        '   column per row, this picks yes-or-no per square. Different nail, same hammer. */',
      ],
    },
    '',
    {
      zh: [
        '/* 棋盘边长 —— 这道题唯一的旋钮，只能取 3、4、5。',
        '   比 N 皇后的上限 8 小得多，而这个差本身就是要看的东西：N 皇后规定每行',
        '   只摆一个后，一路上要挑的是「这一行摆哪一列」；这道题连「一行摆几个」',
        '   都没规定，每一格都得单独问一次选不选。前者的搜索空间是 N 的 N 次方，',
        '   后者是 2 的 N² 次方 —— 5×5 已经是 2 的 25 次方，要跑十九万多步；6×6 是',
        '   2 的 36 次方，这台解释器根本跑不完，滑杆就到这儿为止。',
        '   下限是 3：2×2 的盘上马一步都走不出去，那不成其为一道题。 */',
      ],
      en: [
        '/* The side of the board — the only dial here, and it only goes 3, 4, 5.',
        '   N Queens goes all the way to 8, and the gap is worth staring at. Queens fixes',
        '   one queen per row, so every decision is "which column"; here nothing fixes how',
        '   many knights a row may hold, so every single square needs its own yes-or-no.',
        '   That is N-to-the-N against 2-to-the-N-squared: a 5x5 board is 2^25 and needs',
        '   just over 190,000 steps, while 6x6 is 2^36 and never finishes here.',
        '   The floor is 3 because on a 2x2 board a knight cannot move at all. */',
      ],
    },
  ];

  const BODY = [
    '',
    {
      zh: ['// SQ 是格子总数。这道题要把每一格都问一遍，所以先算出来备用。'],
      en: ['// SQ is how many squares there are. Every one gets asked, so name it once.'],
    },
    'const SQ = N * N;',
    '',
    {
      zh: [
        '/* ⚠ 这里是全篇唯一一处「看起来像 bug 的正确代码」，值得慢下来读一遍。',
        '',
        '   马有八种走法，可下面这两张表只列了四种。不是漏了 —— 是另外四种不必查。',
        '   理由在扫描顺序里：pick 是按 0、1、2 … 一格一格往上走的，轮到第 at 格',
        '   的时候，只有编号比 at 小的格子可能已经摆上了马；编号更大的格子连问都',
        '   还没问到，那里必然是空的 —— 查它等于白查。',
        '',
        '   那么，八种走法里哪四种会落到「编号更小」的格子上？',
        '   一种走法 (dr, dc) 把格子编号改变了多少？新编号 - 旧编号 = dr * N + dc。',
        '   八种逐个算出来（上下对齐的两个是一对相反方向）：',
        '     (-1,-2) → -N-2    (-2,-1) → -2N-1    (-2,+1) → -2N+1    (-1,+2) → -N+2',
        '     (+1,+2) →  N+2    (+2,+1) →  2N+1    (+2,-1) →  2N-1    (+1,-2) →  N-2',
        '   上面那一行四个恒为负数（N ≥ 3 时 -N+2 也是负的），下面那一行恒为正。',
        '   于是要查的正好是上面那四个，不多不少 —— 冲突检查的开销当场砍掉一半，',
        '   而这一半正是 5×5 跑得完的原因：查八个方向的版本在 5×5 上会撞上限。',
        '',
        '   ⚠ 这段推理用到了 N ≥ 3。N = 2 时 -N+2 = 0，上面那一行就不再全是负数；',
        '   不过 2×2 的盘上马一步也走不出去，八种走法一种都落不进盘内，四个方向',
        '   查的是一个空集，答案照样是对的。真正非要 N ≥ 3 不可的是文件最后那个',
        '   同色的结论 —— 别把这两件事记成一件。 */',
      ],
      en: [
        '/* Warning: this is the one place in this file where correct code looks like a',
        '   bug. Slow down and read it once more than you think you need to.',
        '',
        '   A knight has eight moves, yet the two tables below list only four. Nothing is',
        '   missing — the other four never need checking. The reason is the scan order:',
        '   pick walks the squares 0, 1, 2, … in turn, so when square at comes up, only',
        '   squares numbered below at can already hold a knight. Anything numbered above',
        '   at has not even been asked yet, so it is empty for certain.',
        '',
        '   By how much does a move (dr, dc) change the square number? By dr * N + dc.',
        '   All eight, worked out (each column is a pair of opposite directions):',
        '     (-1,-2) → -N-2    (-2,-1) → -2N-1    (-2,+1) → -2N+1    (-1,+2) → -N+2',
        '     (+1,+2) →  N+2    (+2,+1) →  2N+1    (+2,-1) →  2N-1    (+1,-2) →  N-2',
        '   Every entry on the top row is negative (with N >= 3, so is -N+2); every entry',
        '   on the bottom row is positive. Check the top four, skip the rest: half the work.',
        '',
        '   That argument leans on N >= 3. At N = 2, -N+2 becomes 0 and the top row is no',
        '   longer all negative — but on a 2x2 board no knight move lands on the board at',
        '   all, so those four directions scan an empty set and the answer is still right.',
        '   The N >= 3 that really matters is the colour argument at the end of this file. */',
      ],
    },
    'const DR = [-1, -2, -2, -1];',
    'const DC = [-2, -1, 1, 2];',
    '',
    {
      zh: [
        '// chosen 是一张跟棋盘一样大的表：chosen[sq] = 1 表示这一格站着一匹马。',
        '// 先整张铺满 0 —— 没铺过的位置读出来是 undefined，不是 0。',
        '// best 记到目前为止见过的最好成绩，一开始是 0。',
      ],
      en: [
        '// chosen is a table the size of the board: chosen[sq] = 1 means a knight is',
        '// standing there. Fill it with zeros first — an untouched slot reads undefined.',
        '// best holds the largest count seen so far; it starts at 0.',
      ],
    },
    'let chosen = [];',
    'let i = 0;',
    'while (i < SQ) { chosen[i] = 0; i = i + 1; }',
    'let best = 0;',
    '',
    {
      zh: [
        '/* underAttack(sq)：第 sq 格会不会被某一匹已经摆好的马攻击到？',
        '   先把编号拆回行和列：r = (sq - sq % N) / N 是行，c = sq % N 是列。',
        '   然后拿上面那四个方向各挪一步：落点得先在盘内（那四个不等式），再看',
        '   那一格是不是已经站着马。四个方向里只要撞上一个，这一格就不能要了。',
        '   四个都查完还没撞上，返回 false —— 这一格是干净的。 */',
      ],
      en: [
        '/* underAttack(sq): can any knight already on the board reach square sq?',
        '   First split the number back into row and column: r = (sq - sq % N) / N is the',
        '   row, c = sq % N is the column. Then step once along each of the four directions',
        '   above: the landing square has to be on the board (those four inequalities), and',
        '   then it has to be empty. One hit anywhere and this square is out. */',
      ],
    },
    'function underAttack(sq) {',
    '  const r = (sq - (sq % N)) / N;',
    '  const c = sq % N;',
    '  let k = 0;',
    '  while (k < 4) {',
    '    const nr = r + DR[k];',
    '    const nc = c + DC[k];',
    '    if (nr >= 0 && nr < N && nc >= 0 && nc < N) {',
    '      if (chosen[nr * N + nc] === 1) { return true; }',
    '    }',
    '    k = k + 1;',
    '  }',
    '  return false;',
    '}',
    '',
    {
      zh: [
        '/* pick(at, cnt)：第 0 格到第 at-1 格都已经定完了，手上摆了 cnt 匹马，',
        '   现在轮到第 at 格。一个格子只有两种前途，所以这个函数最后会分两支走：',
        '   一支是「这一格摆上马」再往下走，一支是「这一格空着」再往下走。',
        '   at 走到 SQ 就说明整块盘都问完了 —— 手上的 cnt 就是这一条路的成绩。',
        '   递归的深度正好就是「问到第几格」，所以塔有 SQ + 1 层那么高。 */',
      ],
      en: [
        '/* pick(at, cnt): squares 0 through at-1 are already decided and cnt knights are',
        '   on the board; square at is up next. A square has exactly two futures, so this',
        '   function ends by branching twice: once with a knight placed here, once with',
        '   the square left empty. When at reaches SQ the whole board is decided and cnt',
        '   is what this road achieved. Depth = squares decided, so the tower is SQ + 1. */',
      ],
    },
    'function pick(at, cnt) {',
    '  if (at === SQ) {',
    {
      zh: [
        '    /* 整块盘问完了。cnt 就是这一条路走出来的成绩 —— 比纪录高就换纪录。',
        '       这是整段搜索里唯一值得停下来看一眼的时刻，所以喊一声。 */',
      ],
      en: [
        '    /* The whole board is decided. cnt is what this road achieved; if it beats',
        '       the record it becomes the record. The one moment worth a shout. */',
      ],
    },
    '    if (cnt > best) {',
    '      best = cnt;',
    {
      zh: ['      log("新纪录：这样能摆下 " + best + " 匹马");'],
      en: ['      log("New record: " + best + " knights fit like this");'],
    },
    '    }',
    '    return;',
    '  }',
    {
      zh: [
        '  /* 上界剪枝。还剩 SQ - at 个格子没问，就算它们**全都**摆得上马，这一支',
        '     最多也只能到 cnt + (SQ - at) 匹。这个上限要是超不过手上的纪录，那么',
        '     这一整棵子树里不可能藏着更好的答案 —— 一格都不用再问，直接掉头。',
        '     ⚠ 它不会把最优解剪掉：剪的是「上限都够不着纪录」的分支，上限够不着，',
        '     实际值只会更够不着；而 best 只在严格变大时才更新，所以连「刚好打平」',
        '     的分支剪掉也不损失什么。',
        '     这一行就是图例里「剪枝」那一格的来源。 */',
      ],
      en: [
        '  /* Upper-bound pruning. SQ - at squares are still unasked. Even if **every**',
        '     one of them could take a knight, this branch tops out at cnt + (SQ - at).',
        '     If that ceiling cannot beat the record, nothing inside this whole subtree',
        '     can either — so turn back without asking a single one of them.',
        '     It never throws the best answer away: it only cuts branches whose ceiling',
        '     already falls short, and best moves only on a strict improvement, so cutting',
        '     a branch that could merely tie costs nothing. Legend row: "pruned". */',
      ],
    },
    '  if (cnt + (SQ - at) <= best) {',
    '    mark(at, "cut");',
    '    return;',
    '  }',
    {
      zh: [
        '  /* 第一支：这一格摆上马。先问 underAttack —— 冲突就整支跳过，连试都不必',
        '     试。不冲突就在表里登记、把一匹真的马摆到盘上、标成「已确认」，然后',
        '     带着 cnt + 1 去问下一格。 */',
      ],
      en: [
        '  /* Branch one: put a knight here. Ask underAttack first — a conflict skips the',
        '     branch entirely, there is nothing worth trying. Otherwise record it in the',
        '     table, put a real knight on the board, mark it, and go on with cnt + 1. */',
      ],
    },
    '  if (!underAttack(at)) {',
    '    chosen[at] = 1;',
    '    place(at, "wN");',
    '    mark(at, "ok");',
    '    pick(at + 1, cnt + 1);',
    {
      zh: [
        '    /* 回溯撤销：不管下面那些格子找到了什么，这一格都要原样还回去 ——',
        '       表里的 1 抹掉、盘上的马收走、格子标成「撤销」。少还一样，接下来',
        '       走「空着」那一支时就会看到一匹早就不该在那儿的马。',
        '       ⚠ 顺序是先 clear 再 mark：clear 会把棋子和标记一起清掉，所以',
        '       「撤销」这个标记要留到最后写，才留得住。 */',
      ],
      en: [
        '    /* Backtracking undo: whatever the squares above found, this one goes back',
        '       exactly as it was — clear the 1 from the table, take the knight off the',
        '       board, mark the square as undone. Miss any of the three and the other',
        '       branch below will see a knight that should have been gone long ago.',
        '       clear comes before mark on purpose: clear wipes piece and mark together. */',
      ],
    },
    '    chosen[at] = 0;',
    '    clear(at);',
    '    mark(at, "back");',
    '  }',
    {
      zh: [
        '  /* 第二支：这一格空着。注意它在 if 的**外面** —— 不管上面那一支走没走成，',
        '     「空着」这条路都要再走一遍。回溯就是这么回事：两条路，都要走。 */',
      ],
      en: [
        '  /* Branch two: leave this square empty. Note that it sits **outside** the if —',
        '     the empty road is walked either way. That is backtracking: both roads, always. */',
      ],
    },
    '  pick(at + 1, cnt);',
    '}',
    '',
    {
      zh: [
        '/* 从第 0 格开始问。跑完之后 best 就是答案。',
        '',
        '   ⚠ 最后一件事，也是这道题真正的收获：上面这段回溯到 5×5 就跑不动了，',
        '   可 8×8 的答案是知道的 —— 32。它不是搜出来的，是想出来的：',
        '   马从一格跳出去，落点的颜色永远和出发点相反。所以把所有浅色格全摆上马，',
        '   它们谁也攻击不到谁 —— 一块 n×n 的盘上同色格有 ⌈n²/2⌉ 个，8×8 就是 32。',
        '   而 n ≥ 3 时这个数同时也是上界，所以它就是答案，一步都不用搜。',
        '   小盘上，回溯把「最优」证明给你看；到了大盘，搜索彻底不管用，答案只能',
        '   靠一个想法拿到。这两件事都值得亲眼见过一次。 */',
      ],
      en: [
        '/* Start asking at square 0. When this finishes, best holds the answer.',
        '',
        '   One last thing, and it is the real prize: the backtracking above gives out at',
        '   5x5 — and yet the answer for 8x8 is known. It is 32, and nobody searched for',
        '   it. A knight always lands on a square of the opposite colour, so every light',
        '   square can hold a knight at once and not one of them attacks another. An n x n',
        '   board has ceil(n^2/2) squares of a single colour, which is 32 on an 8x8, and',
        '   for n >= 3 that count is also the ceiling — so it is exactly the answer.',
        '   Small boards: search proves it. Large boards: only an idea ever gets there. */',
      ],
    },
    'pick(0, 0);',
    'return best;',
  ];

  /* source({ N, lang }) → string

     N 与 lang 都不给默认值，缺了直接抛（阶段 5 约束 6：公开导出的省略参数
     已经是本仓库抓到过多次的缺陷类）。盘面多大、注释用哪种语言，默默变成
     某个默认值都会让界面看到的和实际跑的对不上。

     ⚠ 校验**连 N_MIN / N_MAX 一起管**，这一点跟 queens.js 相反，理由写在
     上面 N_MIN / N_MAX 的声明处：N=6 生成出来也只会被截断成 undefined。 */
  function source(opts) {
    const o = opts || {};
    if (o.N === undefined || o.N === null) {
      throw new Error('source({ N }) 少了 N —— 棋盘边长没有默认值，必须写明');
    }
    const N = o.N;
    if (typeof N !== 'number' || !isFinite(N) || Math.floor(N) !== N ||
        N < N_MIN || N > N_MAX) {
      throw new Error('N 必须是 ' + N_MIN + ' 到 ' + N_MAX +
                      ' 之间的整数（这道题的盘面边长），收到：' + N);
    }
    return render(HEAD, o.lang)
      .concat(['const N = ' + N + ';'])
      .concat(render(BODY, o.lang))
      .join('\n');
  }

  return { source: source, N_MIN: N_MIN, N_MAX: N_MAX };
});
