# 阶段 9e：`independent`（马的最大独立集）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给工具⑤ 加**第八道题** `independent`：在 `N×N` 盘上摆尽可能多的**互不攻击的马**。范式与 `queens` 逐字相同（回溯 + 剪枝）—— **这道题存在的理由就是那个「相同」**：同一把锤子，敲一颗形状完全不同的钉子。

**Architecture:** 入口 `pick(at, cnt)` 按格子递归（选 / 不选 → `pick(at + 1, …)`），调用深度 = 第几格，第三根轴照旧免费。⚠ **但塔比前面任何一道题都高（26 层），必须自己声明 `spanZ`。** 剪枝两条：上界剪枝 + 只查向后邻居。

**Tech Stack:** 零依赖 ES 子集 JavaScript（`node` 直跑 + 浏览器内联）；Python 3 的 `chess/scripts/check.py` 与 `inline_core.py`；无构建、无包管理器。

---

## Global Constraints

**每次派发子代理都必须带上这一句：**

> 如果计划里某段代码是错的、或某个测试断言了一件事实上错误的事，停下来报告，不许改代码或改测试去迁就它。计划是记录，不是权威。

⚠⚠ **这份计划的作者到 9d 为止已经写错过九处。** 九次全部是**实现者或审查者干活时撞见的**，**没有一次是机器门拦下来的**：

| # | 阶段 | 写的 | 实际 | 照抄的后果 |
|---|---|---|---|---|
| 1 | 9c | `Math.round(L.cell * 0.34)` 当字号 | `L.cell` 恒为 1（世界单位） | 恒等于 0，**数字一个都画不出来，静默** |
| 2 | 9c | `a.row(label, value)` 组读数行 | **全仓 0 次**，凭空写的 API | 每次渲染读数抛 `TypeError` |
| 3 | 9c | 「两处版本号」 | **三处**（漏了头部 changelog 块） | 版本号不一致 |
| 4 | 9c | `if (m.text)` / `m.color` | `text` 加在 **`onMark` 返回值**上 | 恒 false / 恒 undefined |
| 5 | 9d | 深度塔「恰好**八层**」 | **九层** | **把一份完全正确的实现判为不通过** |
| 6 | 9d | `fmtBB` 守卫 `typeof b !== 'bigint' → '—'` | 把要修的谎**换个地方复活** | 修的东西原样搬回来 |
| 7 | 9d | tips 删 `& NOT_A` / `& NOT_AB` | **删了什么都不会发生** | **这道题唯一的那一课当场蒸发，且不报错** |
| 8 | 9d | 注释「掩码移位前抹掉源格」 | 掩码在**移位之后**才 `&`，筛的是**落点** | 就是第 7 处的病根 |
| 9 | 9d | 订正 #5 时写「后三张掩码最高位都是 0」 | `NOT_AB`（`0xfc`）最高位是 **1** | **订正本身引入新的假话** |

**病因同一个：写下一个看着合理的数或 API，而没有去数它 / 查它。** 第 9 处尤其要记住 —— **连订正都可能是错的**。

规矩：

- **凡是本计划引用既有函数、字段、常量或项目规矩的地方，动手前自己 `grep` 一次再用。**
- ⚠ **光 grep 到名字存在还不够** —— 第 4 处 `grep` 抓不到（`m` 与 `info` 都真实存在），要抓它得**把示例代码放回它要插入的那段上下文里读一遍作用域**；第 5 处更狠，只能**自己去跑一遍数出来**。
- **下面每一条我标了「⚠ 量出来的」的，是我这次真的拿 `interp.js` / `TreeModel` 跑出来的**；标「⚠ 推的」的**没量过，你自己验**。没标的按「推的」处理。

### 工作目录

**`/private/tmp/claude-501/-Users-nickma-Develop-My2ndBrain-MathViz/76a3810e-c1e3-4111-aab6-1a281211fb48/scratchpad/wt-9e`**（worktree，分支 `claude/chess-phase9e`，从 `origin/main @ 7dd95b8` 切出）。

**每个任务第一件事**：

```bash
git -C $W rev-parse --abbrev-ref HEAD   # 必须是 claude/chess-phase9e
git -C $W status --short                # 必须是空的
```

对不上就停下来报告。⚠ **主工作树 `/Users/nickma/Develop/My2ndBrain/MathViz` 是别的 session 的活，一个字都不要动。** ⚠ **Bash 的 cwd 会悄悄回到主工作树** —— 每条命令都用 `git -C $W` 或绝对路径 `$W/...`。

### 规格

`docs/superpowers/specs/2026-08-02-chess-viz-suite-design.md`，本阶段相关的是 **§4⑤**（含「**9e 开工前定下的（2026-08-10）**」五条 —— **那是这一段的裁定书，先读它**）、「四道题的裁定」、可扩展性架构要求与**声明层三条硬约束**、**§2.4**、**§5.3**、**§7**。

### 硬约束

- **格子编号 `sq = r * N + c`**，`r=0` 是棋盘**最下面**一行、`c=0` 最左。**别在中间翻上下。**
- **`render(parts, lang)` 那一整段在所有 algos 里逐字节相同**，`check.py` 的 `bilingual_algos_check()` 逐字节核对。**原样抄，一个字节都不许改**（⚠ 现有 10 份；那段注释里写的「七份」是个陈旧数字，**不要跟着改它**，另有独立任务在处理）。
- **两种语言的行数必须逐段相等**（规格 §1.6）。写不成等行数**停下来报告**，不许塞废话或砍内容凑数。
- **`source(opts)` 的 `lang` 必填、无默认值。**
- **生成出来的教学源码，读者是一个没学过棋、正在学算法的十六岁学生。**
- **生成源码受 ES 子集约束**（不约束 `independent.js` 自身）：**没有模板字面量、没有正则字面量、没有 `for…in`、没有 `try/catch`、没有解构**，字符串用 `+` 拼。可用 `let`/`const`、数组与索引、对象字面量、`if/else`、`for`、`for…of`、`while`、函数与递归、箭头函数。
- **宿主桥接只有五个**（`mark` / `place` / `clear` / `log` / `attacked`），**不许加第六个**。
- **`T.throws(fn, label, pattern)` 的 pattern 必须含一段守卫自己的固定文案**（阶段 9a 第九道门）。⚠ **9d 实测的坑**：`_throws_msg_shape()` 只抹 ASCII 双引号里的内容和数字，所以 `收到：64` 归一化成 `收到：N`、而 `收到：a1` 原样保留 —— **两种不同形状，一条共享 pattern 同时匹中 ≥2 种就算钝**。写成「完整消息 + 那一次的插值」，各自只匹中一种。
- **`git status --short` 之后只暂存显式路径**；禁止 `git add -A` / `git commit -a`。**commit 跑完要再看一遍**（钩子会再暂存）。
- ⚠ **不要在 commit 之前手工跑 `inline_core.py`**：钩子跑的是 `--print-changed`，只在它自己真的改了文件时才补暂存。**但改了 `chess/core/**` 的任务有个两难**（9d 实测）：标记行加了名字而内联块还没生成时，`algos_roundtrip_check` **必然**报「标记清单里有、ALGOS 对象里没有」。**出路**：跑 `inline_core.py --print-changed`，然后在 `git add` 里**显式列上被它改过的那几份 HTML**。
- ⚠ **突变实验前把文件拷进 scratchpad（带任务前缀），备份拷在突变的前一刻**。**绝不要用 `git checkout --` 还原**，用 `cp`。
- ⚠ **只看 `check.py` 的退出码会误判** —— 要在输出里找到你想验的**那道门自己那一行**。⚠ **实现者在跑的时候不要跑门**（工作树不是静止的）。
- **scratchpad 是共享的**，临时文件一律带任务前缀（`9e-t1-` 等）。**不带前缀会被别的 agent 覆盖 —— 真发生过。**
- **浏览器**：⚠ Browser pane 里 `document.hidden` **恒为 true**、`requestAnimationFrame` **完全停摆**。9d 走通的路：**把 `chess/` 另拷一份到 scratchpad、在拷贝的 `<head>` 里插 rAF→`setTimeout` 垫片、起本地 http 服务**（仓库文件不动）。**每次调用带显式 `tabId`**，并**先断言端口/路径是自己那一份**。⚠ `computer` 的显式 `coordinate` 是**截图像素空间**，肉眼从图上读的是 CSS 空间 —— **要除以 2**；用 `ref` 点不受影响。
- ⚠ **本地绿 ≠ CI 绿**。开 PR 后 `gh pr checks <PR#>`。

---

## 这道题的数（**全部实测**，不是估的）

拿真的 `interp.js` 跑 ES 子集源码，**含 `place`/`mark`/`clear` 可视化调用**：

| N | 最大独立集 | 步数 | 占 `STEP_LIMIT`(200000) | 塔层数 | `pick` 节点数 |
|---|---|---|---|---|---|
| 3 | **5** | 2,562 | 1% | **10** | 108 |
| 4 | **8** | 18,085 | 9% | **17** | 758 |
| 5 | **13** | 191,021 | **96%** | **26** | 7,894 |
| 6 | — | 撞上限 | — | — | — |

**同色下界 `⌈n²/2⌉` 六档全部吻合**：n=3→5、4→8、5→13、6→18、7→25、**8→32**。

**「只查向后四个邻居」这条优化**（⚠ 量出来的，同口径 —— 两边都**不含**可视化调用）：

| N | 查八个邻居 | 查四个邻居 | 砍掉 |
|---|---|---|---|
| 3 | 3,951 | 2,431 | 38.5% |
| 4 | 29,110 | 17,282 | **40.6%** |
| 5 | **撞上限** | 182,290 | **算不出来**（分子被截断了） |

**没有它，N=5 根本进不来。** ⚠ 别把「40.6%」说成是 N=5 那一档量的 —— 那一档量不出来。

⚠⚠ **本计划初稿在这里写错过一次（Task 1 实测订正，本阶段第十处）。** 初稿说「`N ≥ 3` 是这条优化的正确性前提，N=2 上会真的漏查」—— **前半句对，结论错**：2×2 上马的八种走法**一步都落不进盘内**，那四个方向扫的是空集。实测查四个 vs 查八个在 **N = 1…7 七档结果完全相同**（1/4/5/8/13/18/25）。**这条优化对每个 N 都是对的，没有前提。**

**⚠ 真正非要 `N ≥ 3` 不可的是同色论证本身**：n=2 时任意两格互不攻击，答案是 **4**，而 `⌈n²/2⌉ = 2` —— **公式在 n=2 上是错的**，而它正是这道题的落点。**下限 3 是为它定的。**

⚠ **N=5 占 96%，余量极薄。** Task 1 **必须拿最终源码复测**，超了就把滑杆上限砍到 4，**不许调 `STEP_LIMIT`**。

---

## 文件结构

| 文件 | 责任 | 本阶段动作 |
|---|---|---|
| `chess/core/algos/independent.js` | 第八道题的**算法源码生成器**（吐字符串，不算答案） | **新建**（双语） |
| `chess/core/algos/independent.test.js` | 它的测试（宿主侧参照对拍 + 三道双语门 + 剪枝反证） | **新建** |
| `chess/tools/chess-board-algorithms.html` | 工具⑤ | 声明 `PROBLEMS.independent`、标记行加名字、**`spanZ`**、双语文案、定版 1.6.0 |
| `chess/chess-tools.json` | 工具注册表 | 1.5.0 → 1.6.0，`version` / `changelog` / `desc` / `tag` |

**只有两个新文件。** 规格 §4⑤ 的可扩展性要求是「新增一道题 = 加一个键 + 一个 `algos/*.js` + 标记行一个名字」。

⚠ **本阶段额外要动的只有一处：`spanZ` 的声明**（规格 §4⑤ 9e 那条 ④）。**报告里要把这一处与「这道题的开销」分开讲** —— 它不是新机制，是既有声明字段第一次被第二道题用到。

⚠ **9d 的实测提醒**：`PROBLEMS` 一道题实际还带一个文案对象、一个参数表、可能一个格名助手 —— **既有七道都是这个形状**，「三处」那句话早就是简写。**不要因为多了这几样就以为架构破了**；要报的是「除此之外还改了渲染/tab/滑杆/图例/相机吗」。

---

## 并行编排

| 轮 | 任务 | 依据 |
|---|---|---|
| 1 | **Task 1 单独** | 生成器是后面所有任务的输入 |
| 2 | **Task 2 → 3 串行** | 两个都改 `chess-board-algorithms.html` |
| 3 | **Task 4 单独** | 浏览器验收，要前面全部落地 |
| 4 | **Task 5 单独** | 定版收尾 |

**没有可并的两个任务**（与 9d 同）。

---

## Task 1：`independent.js` 双语生成器 + 它的测试

**Files:**
- Create: `chess/core/algos/independent.js`
- Create: `chess/core/algos/independent.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `require('./independent.js').source({ N, lang })` → 一段源码字符串。`N`（盘面边长，3–5）与 `lang` 均必填。入口函数名 **`pick`**，顶层 `pick(0, 0); return best;`。

- [ ] **Step 1: 抄那段逐字节相同的双语渲染助手**

```bash
sed -n '/^  \/\* ================= 双语渲染/,/^  }$/p' chess/core/algos/bitboard.js > <scratchpad>/9e-t1-render.txt
wc -l <scratchpad>/9e-t1-render.txt
```

**逐字节**抄进新文件。**一个字节都不许改**（⚠ 包括那句陈旧的「七份」）。抄完自己切出来 `diff` 一次确认。

- [ ] **Step 2: 写会失败的测试**

判据照规格 §7.3：**跟另一份思路完全不同的实现一致**。宿主侧参照**不用递归回溯**，用「枚举所有子集」（N=3 时 2^9 = 512 个子集，够小）或别的独立写法 —— **你自己选一种，但必须与被测源码的思路不同**，并在注释里写明为什么这样才叫独立。

必须有的断言：

1. **N = 3 / 4 / 5 三档结果**与宿主侧参照一致（⚠ **别抄我表里的 5 / 8 / 13，自己算出来**）。
2. **⚠ 与同色下界 `⌈N²/2⌉` 一致** —— 这是第二条独立判据（数学事实，不是另一份实现），三档都要。
3. **`place` / `clear` 配对**：⚠ **9d 实测宿主桥接缺席是静默 no-op**，删掉 `place` 那一行**不抛、不改 result**。所以用打桩 host 断言：每次 `place` 都有配对的 `clear`，**跑完盘上一枚子都不剩**。
4. **`mark` 通道**：`cut` 那一种**必须真的出现过**（否则剪枝那一行图例是假的）。
5. **三道双语门**（规格 §7.5）：行数同一 / 步数同一 / 英文变体抽掉注释后没有汉字。
   ⚠ **9d 实测**：第三道门对「双语片段全是注释」的文件**恒真**（正则先把注释抽光了）。**先判断这份文件是哪种情况**，是恒真就在注释里写明它在这里没有牙、以及为什么仍然留着 —— **不许让一道门看起来在守什么而其实没有**。
6. **`N` 的守卫**：缺席、越界（2 / 6）、非整数、非数字各一条 `T.throws`。⚠ pattern 见 Global Constraints 那条「钝」的坑。
7. **`lang` 缺席当场抛。**

- [ ] **Step 3: 跑一遍，确认它失败**

```bash
node chess/core/algos/independent.test.js
```

期望：`Cannot find module './independent.js'`。

- [ ] **Step 4: 写生成器**

UMD 包装与 `render()` 照抄（Step 1 已抄）。⚠ **下面这份可执行骨架是我实测跑通过的**（⚠ 量出来的：三档结果 5/8/13、步数 2562/18085/191021），但**命名与注释由你写**，且**每一行你都要自己再验一次**：

```js
'const SQ = N * N;',
'',
'const DR = [-1, -2, -2, -1];',
'const DC = [-2, -1, 1, 2];',
'',
'let chosen = [];',
'let i = 0;',
'while (i < SQ) { chosen[i] = 0; i = i + 1; }',
'let best = 0;',
'',
'function conflicts(sq) {',
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
'function pick(at, cnt) {',
'  if (at === SQ) {',
'    if (cnt > best) { best = cnt; }',
'    return;',
'  }',
'  if (cnt + (SQ - at) <= best) { return; }',
'  if (!conflicts(at)) {',
'    chosen[at] = 1;',
'    place(at, "wN");',
'    mark(at, "ok");',
'    pick(at + 1, cnt + 1);',
'    chosen[at] = 0;',
'    clear(at);',
'    mark(at, "back");',
'  }',
'  pick(at + 1, cnt);',
'}',
'',
'pick(0, 0);',
'return best;',
```

⚠ **`const N = …` 由 `source()` 插在 `render(HEAD)` 与 `render(BODY)` 之间**（照 `bitboard.js` 的形状），所以 `const SQ = N * N;` 必须在 `BODY` 里。**自己确认这个切分点。**

⚠ **四处必须自己验、不许照抄我的**：

1. **`DR` / `DC` 那四个「向后」方向对不对。** 判据是「按 `0..SQ-1` 顺序扫，考虑第 `at` 格时下标更小的邻居」，也就是 `nr*N+nc < at` 的那四个。**自己把八个马步全列出来，算一遍哪四个的 `nr*N+nc` 恒小于 `at`**，再用「查八个 vs 查四个」对拍三档确认结果完全相同。**配错一档会静默给出错误答案。**
   ⚠ **顺带验那个 `N ≥ 3` 的前提**（`(-1,+2)` 的偏移是 `-N+2`）—— 并把它写进注释。
2. **上界剪枝 `cnt + (SQ - at) <= best` 是不是紧的、会不会剪掉最优解。** 自己论证一遍并写进注释。
3. **`cut` 那种 mark 在哪儿发。** 我上面的骨架**根本没发 `cut`** —— 而 `kinds` 要有「剪枝」那一行。**你要么在剪枝那一支加 `mark`，要么把 `cut` 从 `kinds` 里去掉。** ⚠ 加了 `mark` 会**增加步数**，而 N=5 只剩 4% 余量 —— **加完必须复测三档步数**。
4. **`place`/`clear` 与 `mark` 的顺序**：`clear(at)` 之后再 `mark(at, "back")`，确认页面层不会被「先清子再标记」绊住（去读 `boardState` 怎么处理 `clear` 与 `mark` 的先后）。

`source(opts)` 照 `bitboard.js` 的形状写，**`N` 与 `lang` 都必填、无默认值**，`N` 限 3–5（⚠ 上限由 Step 6 的实测定，**先写 5，量完再定**）。

- [ ] **Step 5: 写双语散文**

`{ zh: [], en: [] }`，**两边行数必须相等**。要讲到的四件事：

1. **题面**：摆尽可能多的马，谁也攻击不到谁。
2. **⚠ 这是和 N 皇后一模一样的锤子** —— 逐格「选 / 不选」、冲突就跳过、回溯。**这一点要明写**，它是这道题存在的理由。
3. **⚠ 只查四个邻居为什么是对的** —— 这是这道题里**唯一一处「看起来像 bug 的正确代码」**，不讲清楚读者会以为漏查了一半。
4. **上界剪枝在剪什么** —— 「剩下的格子全选也超不过手上最好的，那就别看了」。

**英文以中文为底本重写，不是逐句对译。** 写不成等行数**停下来报告**。

- [ ] **Step 6: 跑一遍 + ⚠ 复测三档步数（这一步决定滑杆上限）**

```bash
node chess/core/algos/independent.test.js
```

然后**拿最终源码**量三档步数：

```
N=3 期望 ≈ 2,562    N=4 期望 ≈ 18,085    N=5 期望 ≈ 191,021（96% 上限）
```

⚠ **我的基准里没有 `cut` 的 mark。** 你加了就会更高。**N=5 只要撞上限（`trace.truncated`），就把滑杆上限砍到 4 并在报告里写明实测数**，**不许调 `STEP_LIMIT`**。

- [ ] **Step 7: 突变验证 —— 剪枝真的在承重吗**

把上界剪枝那一行删掉，跑测试与步数。**期望：结果不变（剪枝不该改答案），但步数明显上升。** 若步数没变化，说明那一行从没生效 —— **停下来报告**。验完从 scratchpad 备份 `cp` 还原。

- [ ] **Step 8: 突变验证 —— 只查四个邻居真的够吗**

把 `while (k < 4)` 改成查全部八个方向（`DR`/`DC` 换成八个），跑测试。**期望：三档结果完全相同、步数明显上升。** 若结果变了，说明「只查向后」是错的 —— **停下来报告**。验完还原。

- [ ] **Step 9: Commit**

```bash
git -C $W status --short
git -C $W add chess/core/algos/independent.js chess/core/algos/independent.test.js
git -C $W commit -m "feat(chess): independent.js —— 第八道题的双语算法源码生成器"
git -C $W status --short
```

---

## Task 2：声明 `PROBLEMS.independent`

**Files:** Modify `chess/tools/chess-board-algorithms.html`

- [ ] **Step 1: `GENERATED:ALGOS` 标记行加名字**

```bash
grep -n "GENERATED:ALGOS " chess/tools/chess-board-algorithms.html
```

末尾加 `,independent.js`。**不要手改下面那个块**（由 `inline_core.py` 生成）。

- [ ] **Step 2: 写声明**

照 `queens` 的形状（同一个范式，**最近的可比对象**）。⚠ **自己去读 `queens` 的声明**，别照我下面的记忆写：

```js
    independent: {
      label: IND.tab, brand: IND.brand, tips: IND.tips,
      params: [{ key: 'N', label: IND.paramN, min: 3, max: 5, step: 1, value: 4, ... }],
      sources: ['independent.js'],
      entry: 'pick',
      source: function (st, M, file, lang) {
        return M[file].source({ N: Math.round(st.N), lang: lang });
      },
      check: { result: true, boardOps: true, counters: [...] },
      board: function (st) { return { files: ..., ranks: ... }; },
      /* ⚠ 塔最深 26 层（N=5：SQ+1）。26 × 0.20 = 5.2 世界单位，与 queens 的
         10 × 0.55 = 5.5、tourKnight 的 21 × 0.24 ≈ 5.0 同量级。不声明会长到
         26 × 0.55 ≈ 14.3，三倍于该有的高度，而 spanZOf 只会安静回落到默认值。 */
      spanZ: 0.20,
      zLabel: { zh: ..., en: ... },
      kinds: [...],
      onMark: function (kind) { ... },
      exportName: function (st) { ... },
      readout: function (a, st) { ... },
    },
```

⚠ **五条要自己确认的**：

1. **`spanZ: 0.20` 是算出来的不是量出来的。** 浏览器里核一眼取景框（Task 4 会正式验，但你这里先看一眼）。
2. **`kinds` 要哪几种。** 取决于 Task 1 最后发不发 `cut`。**`kinds` 是声明驱动的图例行与顺序，不要求每一行都对应一个真被发出来的 mark 值** —— 但**一行都不真发的种类是在撒谎**，别放。
3. **`counters` 要不要**（`queens` 有 `solutions`）。这道题数什么？**你判**。
4. **`board()` 的 `files`/`ranks` 从哪个 state 字段来** —— 自己 grep `queens` 的 `board()` 怎么写。
5. **`readout` 显示什么。** 结果是**最大独立集的大小**（普通数字，`fmtInt` 就够，⚠ 不是 BigInt，**别把 9d 的 `fmtBB` 拿来用**）。⚠ 规格 §4⑤ 9e ③：**别把它和 `queens` 的返回值（解的个数）混为一谈**，措辞要说准「摆了几枚马」。

- [ ] **Step 3: 跑门**

```bash
python3 chess/scripts/check.py 2>&1 | tail -12
```

期望：exit 0；`ALGOS 往返校验` 从 **10 变 11**、`双语 algos 普查` 从 `10 份双语` 变 **`11 份双语`**。
⚠ 内联镜像那个两难见 Global Constraints，出路是显式 `git add` 那份 HTML。

- [ ] **Step 4: 数一遍「动了几处」**

```bash
git -C $W diff --stat
```

**期望**：只有 `chess/tools/chess-board-algorithms.html`。改动应当是：标记行、`IND` 文案常量、`PROBLEMS.independent`（含 `spanZ`）。

**如果为了让这道题跑起来还得改渲染、tab、滑杆、图例、相机里的任何一处 —— 停下来报告。**

- [ ] **Step 5: Commit**（显式路径）

---

## Task 3：双语文案与 `tips`

**Files:** Modify `chess/tools/chess-board-algorithms.html`

- [ ] **Step 1: 写文案常量**

`IND` 对象，每条 `{zh, en}`：`tab` / `brand` / `paramN` / 各 `kind` 的标签 / 读数标签 / `tips`。

⚠ **显示宽度门**（`validateDecl`，写错整页停住）：**`onMark().label` ≤ 72、`trackLabel()` ≤ 26**（CJK 算 2）。**自己把每条量一遍，别目测。**

- [ ] **Step 2: `tips` —— 这道题的顿悟**

**`tips` 只讲一个顿悟并指向一个具体的开关**（全仓规矩）。这道题的顿悟**不是「怎么回溯」**（她在 `queens` 里见过了），而是：

> **同一把锤子，敲出来的钉子形状完全不同。**

必须写到的三样：

1. **⚠ 和 N 皇后对照，而且要说准**（规格 §4⑤ 9e ③）：`queens` 摆 **N** 枚后（4×4 摆 4 枚），`independent` 摆 **⌈N²/2⌉** 枚马（4×4 摆 **8** 枚）。**一个是线性的，一个是面积的一半。** ⚠ **不许拿两个 `return` 值比** —— `queens` 返回的是**解的个数**（N=6 时返回 4），不是 N。
2. **⚠ 那个 8×8 = 32，以及为什么工具算不了它**（规格 §4⑤ 9e ②）：**马永远落到异色格**，所以同色的一半格子天然互不攻击 —— 8×8 上就是 **32**。而**滑杆最大只到 5**，因为穷举在 6×6 就撞上步数上限了。
   **这一句是这道题最好的一课，要写得让她记住**：*小盘上，回溯能把「最优」证明给你看；到了 8×8，搜索彻底不 scale，答案只能靠一个想法拿到。*
   ⚠ **指向一个具体的开关**：把滑杆从 3 拖到 5，看步数怎么涨（读数区有步数）—— 三档实测 2,562 → 18,085 → 191,021，**几乎每一档乘十**。
3. **按 `3` 切侧视** —— 塔一层一格，回溯的形状看得见。⚠ **别写死层数**（9d 第 5 处就栽在这个数上）；要写就写「一层一格，N=5 时二十几层」。

- [ ] **Step 3: 跑门 + Commit**（显式路径）

---

## Task 4：浏览器验收

**不改任何代码。** 逐条勾，每条截图或读数存证。

- [ ] **Step 1: 起预览**（见 Global Constraints 的 rAF 垫片那条，**带显式 `tabId`**，先断言端口/路径是自己那一份）

- [ ] **Step 2: 逐条勾**

1. **N=4 Run 完**：盘上摆着 **8** 枚马，读数写 8，状态牌绿色。**自己数一遍盘上的马**。
2. **⚠ 深度塔立起来了，而且没有长过头** —— 按 `3` 切侧视。塔**一层一格**（N=4 是十几层）。⚠ **重点看取景框有没有把棋盘缩没** —— 这是 `spanZ: 0.20` 唯一的验收点，**若塔顶出画或棋盘缩成一点，报出来并给出你量到的合适值**。
3. **N=3 → 5 三档都跑得完**（状态牌不出现 `truncated`），**读数分别是 5 / 8 / 13**。⚠ **N=5 是 96% 上限，特别看它有没有撞**。
4. **滑杆拖到 5 时步数≈191,021** —— 与 `tips` 里写的数对得上。
5. **剪枝看得见** —— 图例里「剪枝」那一行对应的颜色在盘上真的出现过（若 Task 1 决定发 `cut`）。
6. **切语言** —— 中英各看一次，图例、`tips`、读数都通顺，无溢出。
7. **既有七道题没被误伤** —— **八个 tab 逐个 Run 一次**，没有一处抛红色状态牌。

- [ ] **Step 3: 报告** —— 七条逐条「过 / 不过 / **未验 + 原因**」。**不许写「应该没问题」。**

---

## Task 5：工具⑤ 定版 1.6.0 + 注册表

**Files:** `chess/tools/chess-board-algorithms.html`（**三处**）、`chess/chess-tools.json`

- [ ] **Step 1: 三处版本号**（⚠ **是三处**：`tool-version` meta / `const VERSION` / 头部 changelog 块。**自己数一遍**，9c 的计划漏过一次）
- [ ] **Step 2: `chess-tools.json`** —— `version` / `changelog` / `desc` / `tag`。
  ⚠ **`tag` 在两份 FALLBACK 镜像里也有**（`chess/app.html`、`chess/index.html`），而 `check.py` 的 FALLBACK 门**只抓 `id`** —— **`tag` 无人看守，9c 那次就漂了**。三处一起改，**自己 `diff` 一次确认逐字对齐**（⚠ 求值后比对，别比原文文本：JSON 用双引号、镜像用单引号）。
  ⚠ **`desc` 不在镜像里**（9d 实测 `app=false index=false`），只有 `tag` 是三处。
- [ ] **Step 3: 根注册表要不要动** —— ⚠ **不许沿用结论，自己再核一次**并在报告里写明。
- [ ] **Step 4: 跑全量门 + 角标实测**（`v1.6.0`）
- [ ] **Step 5: Commit**（显式路径，含两份镜像）

**changelog 要照既有条目的深度写**：不只说「加了什么」，还说「为什么值得记」与「代价/边界在哪」。⚠ **这一段必须写进 changelog 的两件事**：

1. **盘面上限是 5×5，8×8 的穷举证明做不到** —— 以及那不是缺陷，是这道题要教的东西。
2. **`independent` 与 `queens` 是同一个范式** —— 它存在的理由是「教迁移」，不是「多一道题」。

---

## 收尾（每次派发都要核）

在**干净树**上跑：

```bash
git -C $W status --short          # 先确认是空的，下面的读数才作数
node chess/core/algos/independent.test.js
python3 chess/scripts/check.py
python3 scripts/sync_registry.py --check
```

期望：测试无 FAIL；`check.py` exit 0，其中 **`双语 algos 普查：11 份双语`**、**`ALGOS 往返校验：… 11 份算法源码`**。

开 PR 之后 `gh pr checks <PR#>`。**本地绿 ≠ CI 绿。** **不要自己合并，用户在对话里确认。**
