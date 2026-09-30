# Python 子项目 · 第 3 期 · 波 m5b：py-simulation、py-games 程序清单

> 状态：**已批准**（2026-09-30，Python编程 受用户委托审定；裁决见 §8）。
> 日期：2026-09-30
>
> 上游：主规格 `2026-09-16-python-subproject-design.md` §2.1 / §2.2（M5：`py-simulation` — 蒙特卡洛、随机游走、排队模拟、生命游戏；
> `py-games` — 井字棋、猜数、Hangman、2048 核心、扫雷布雷）；第 3 期派发简报 `.superpowers/python-phase3/phase3-brief.md` §2 的裁决
> （随机数只用 `random.Random(<种子>)` 实例、交互用 `run.stdin`、长度取向约 60 行、不用 `chunks`）；格式照第 2 期 M4 清单。
> 同期并行：m5a（`py-text-data` ch20、`py-systems` ch23）。

---

## 0. 固定取值

| 页 | 章目录 | refs 文件 | 程序数 |
|---|---|---|---|
| `py-simulation` | `ch21-simulation` | `gates/refs/ch21_simulation.py` | 12 |
| `py-games` | `ch22-games` | `gates/refs/ch22_games.py` | 12 |

`module` = 5，`accent` = `orange`。合计 **24 个程序、5 个变体组、19 个带 P、10 个用随机、1 个用递归**（见 §7）。

**命名**：单个程序 `problem` = 程序 id。变体组名（本波新起，已对全库 ch01–ch19 的 `problem` 名查过无重名）：
`pi-estimate`、`game-of-life`、`shuffle`、`ttt-winner`、`merge-row-2048`——请与 m5a 的组名交叉核。

---

## 1. 查重（起草时核过的）

| 已有 | 在哪 | 本波怎么避开 |
|---|---|---|
| `guess-number-attempts`：**她**猜一个固定的秘密数，次数上限 + `while…else` | ch07 | py-games 的猜数反过来：**电脑**猜她心里的数（折半），读 stdin 的「高 / 低 / 对」 |
| `rps-winner`（石头剪刀布判胜负） | ch06 | 不做 |
| `hot-potato-*`（队列轮转）、`circular-queue-array` | ch12 | 排队模拟讲**模拟**（到达 / 服务 / 等待时间），`deque` 只当容器用 |
| `tuple-keys-sparse-grid`（以元组为键的稀疏网格） | ch11 | `game-of-life-set` 用活细胞集合，讲的是「按规则逐代更新」，不重讲元组键 |
| `bfs-order` / `bfs-shortest-path`（BFS） | ch17 | 扫雷的连片翻开用 BFS，只点出「这里用的是 BFS」 |
| ch19 讲过「用 `(i * 7) % n` 造确定的乱序、用不着 random」 | ch19 | 本期起 random 合法，但只用 `random.Random(种子)` 实例（§5） |

---

## 2. 程序清单

「组」空 = 单个程序（`problem` = id）。「P」= property 参照（空 = 只受 `program_run_check` 约束）。「⟳」= 用递归。「🎲」= 用 `random.Random`。「⌨」= 读 `run.stdin`。

### 2.1 py-simulation · `ch21-simulation` · M5 · 12

**写法约定（本页核心）**：随机只出现在**驱动**（演示块或一个 `simulate(seed, …)` 函数）里；被 property 检查的**核心函数是纯函数**，
随机数序列当实参传进去。这既是可测的前提，也是本页要讲的一件事——「把随机与逻辑分开，逻辑才能被检验」。

| id | 组 | 教什么 | P |
|---|---|---|---|
| `monte-carlo-pi-random` 🎲 | pi-estimate | 在正方形里撒随机点、数落进四分之一圆的比例 × 4；样本加倍时误差大约只降到 1/√2 | 核心 `count_inside(points, r)`（整点）：refs 用 `math.isqrt` 逐列数格点，不做平方比较 |
| `monte-carlo-pi-grid` | pi-estimate | 同一个比例换成**规则网格**上数点：没有随机也能估 π；与随机撒点并排看「系统抽样 vs 随机抽样」 | 核心 `grid_count(n)`：refs 同上 |
| `dice-sum-frequencies` 🎲 | | 两颗骰子掷 N 次，计数表 vs 枚举 36 种得到的精确分布；频率随 N 变大逼近概率 | 核心 `tally(rolls)`（rolls 是 (a, b) 列表）：refs 用 `collections.Counter` |
| `random-walk-1d` 🎲 | | ±1 步的随机游走：终点、离原点最远、回到原点的次数 | 核心 `walk_stats(steps)`：refs 用 `itertools.accumulate` |
| `gamblers-ruin` 🎲 | | 有吸收壁的随机游走：从 k 出发、到 0 或 N 停；模拟比例 vs 公平硬币的理论值 k / N | 核心 `play(start, target, flips)` 返回 (结局, 步数)：refs 另写的前缀和找首次越界 |
| `queue-single-server` 🎲 | | 单服务台排队：到达间隔与服务时长由 rng 生成（整数分钟），算每人等待、平均等待、最长队列 | 核心 `simulate(arrivals, services)`：refs 逐分钟推进的时钟模拟（被测按事件推进，机制不同） |
| `game-of-life-grid` | game-of-life | 有边界的二维表：每格数 8 邻居、**先算完整一代再替换**（不能边算边改） | refs 用活细胞集合 + `Counter` 数邻居 |
| `game-of-life-set` | game-of-life | 只存活细胞的坐标集合：从活细胞向外数邻居，天然无边界 | refs 用二维表逐格数（被测与参照互为对方的写法） |
| `sir-epidemic-steps` | | 离散时间的 S / I / R 差分方程：同时更新（用旧值算全部新值），总人数守恒 | |
| `traffic-light-fsm` | | 有限状态机：状态 + 转移表（字典）驱动逐拍模拟；与 if 链写法对照在讲解里 | 核心 `run(start, ticks)`：refs 另写的 if 链实现 |
| `shuffle-fisher-yates` 🎲 | shuffle | 从末尾往前、每位与 `rng.randrange(i + 1)` 处交换；打乱 3 张牌 6000 次，6 种排列各约 1000 次 | 与 `random.Random(同种子).shuffle` 逐项相同（见注 1） |
| `shuffle-naive-biased` 🎲 | shuffle | 「每位与**任意**位交换」的错误写法：同样 6000 次，6 种排列明显不均——为什么 3³ = 27 分不成 6 等份 | |

注 1（已实测）：手写 `for i in range(len(items) - 1, 0, -1): j = rng.randrange(i + 1)` 与 `random.Random(种子).shuffle` 在 CPython 3.9.6 与 3.12.9 上
300 个种子 × 长度 0–11 **逐项相同**（0 处不同）；负控制：把 `randrange(i + 1)` 写成 `randrange(i)`，3000 组里 2683 组不同。
**但 `Random.shuffle` 的源码（`inspect.getsource`）就是同一个 Fisher–Yates**（`for i in reversed(range(1, len(x))): j = randbelow(i + 1)`）——
这是「参照与被测同一算法」的情形，只是实现者不同、一个走 `randrange` 一个走 `_randbelow`。它守得住的是「下标范围 / 方向写错」，
守不住「算法本身错」（算法本身就是标准）。交裁决：接受这个参照，还是不设 P（§5 R3）。

### 2.2 py-games · `ch22-games` · M5 · 12

交互程序照「页面不显示输出」写：`input()` 的提示语进 stdout、不换行，讲解不说「看屏幕上那一行」。游戏逻辑与输入输出分开：被检查的是纯函数，循环只负责读、调、打印。

| id | 组 | 教什么 | P |
|---|---|---|---|
| `ttt-winner-lines` | ttt-winner | 把 8 条赢线写成下标三元组表，逐条看三格是否同一方 | refs 按 行 / 列 / 两条对角 用下标算术生成 |
| `ttt-winner-loops` | ttt-winner | 同一判定写成「行循环 + 列循环 + 两条对角」 | refs 用显式的 8 条线表（两者互为参照的写法） |
| `ttt-game-loop` ⌨ | | 完整一局：读落子 → 校验（越界 / 已占）→ 落子 → 判胜 / 平 → 换人；游戏循环当状态机写 | |
| `ttt-minimax` ⟳ | | 极小化极大：对当前局面算出「双方都完美时」的结果，电脑永不输 | refs 另写的 negamax + `lru_cache`（同一博弈值、不同写法）；cases 用随机合法局面（n ≤ 空格数时收紧，见 §6） |
| `guess-computer-halving` ⌨ | | **电脑**猜她心里的 1–100：折半、读「h / l / c」、至多 7 次；她撒谎（区间变空）时说出来 | |
| `hangman-state` 🎲⌨ | | 用 `rng.choice` 从词表取词；纯函数 `mask(word, guessed)`、剩余次数；读 stdin 逐个字母 | 核心 `mask`：refs 用 `re.sub` 把未猜字母换成 `_` |
| `merge-row-2048-compress` | merge-row-2048 | 一行向左：先挤掉 0、再从左往右合并相邻相等（**每块每步只合并一次**）、补 0；返回 (新行, 得分) | refs 另写的「输出栈 + 刚合并标志」实现 |
| `merge-row-2048-stack` | merge-row-2048 | 同一规则写成「逐块压进输出栈，栈顶相等且没合并过就合并」 | refs 另写的「先挤 0 再合并」实现 |
| `board-move-2048` | | 四个方向都复用「向左合并一行」：向右 = 反转、向上 / 下 = 转置（`zip(*board)`） | refs 按方向直接用下标逐列 / 逐行搬，不转置不反转 |
| `minesweeper-place-count` 🎲 | | `rng.sample` 布雷（避开首次点击的格子与它的邻格）；每格数周围地雷 | 核心 `counts(w, h, mines)`：refs 从每颗雷向外给 8 邻格加一（被测从每格向内数） |
| `minesweeper-flood-reveal` | | 点到 0 就连片翻开：BFS 用的是「图算法」一页的写法，这里只点出来 | refs 另写的递归 DFS（只在 refs 里递归） |
| `pig-dice-two-players` 🎲 | | 两个电脑玩家按不同策略（到 20 就停 / 每轮掷满 3 次）玩 Pig 骰子；回合循环、得分状态、谁先到 100 | |

---

## 3. 边界（交裁决）

| # | 知识点 | 本清单的做法 | 需要裁决的 |
|---|---|---|---|
| B1 | 有限状态机 | 在 `traffic-light-fsm` **讲**（转移表）；`ttt-game-loop` 把游戏循环写成状态机、只点出 | 主规格 M8 `py-embedded-patterns` 也列了「有限状态机」——确认概念归 M5 讲、M8 只用到硬件上 |
| B2 | 概率分布 / 抽样 | `dice-sum-frequencies` 只讲「频率逼近概率」与计数；不讲分布族、均值方差、检验 | 归 M6 `py-statistics`，确认 |
| B3 | 猜数 | 电脑猜（折半），不做「她猜秘密数」（ch07 已有） | 确认；折半本身在「查找」一页讲过，这里只用 |
| B4 | 贪吃蛇 / Pong / 打砖块 | 不做——主规格归 M7 pygame | 确认 |
| B5 | 蒙特卡洛 vs 数值积分 | `monte-carlo-pi-grid` 是「规则网格数点」，不讲积分法则 | 确认不越到 M6 |
| B6 | 类 | 两页都可以用小类，但清单里没有必须用类的程序；多个类协作的系统归 m5a `py-systems` | 确认 |

## 4. 递归（交裁决）

只有 `ttt-minimax` ⟳（博弈树搜索即递归，不可换）。**建议：用，不重讲**（第 2 期 M3 / M4 两次裁决一致）；`tags` 带 `recursion`，讲解写「递归的机制见「递归」一页」。
`minesweeper-flood-reveal` 的**被测**用 BFS、不递归（递归版只在 refs 里当参照）。其余程序逐个问过：都不用递归。

## 5. 随机（交裁决）

用到 `random.Random` 的 10 个程序（表中 🎲）：`monte-carlo-pi-random`、`dice-sum-frequencies`、`random-walk-1d`、`gamblers-ruin`、`queue-single-server`、
`shuffle-fisher-yates`、`shuffle-naive-biased`、`hangman-state`、`minesweeper-place-count`、`pig-dice-two-players`（`hangman-state` 只用 `choice` 取词）。

- R1 **只用实例**：驱动里 `rng = random.Random(<固定种子>)`，或 `rng` / `seed` 当实参传进函数；不用模块级 `random.*`、不读时间（派发简报 §2 的裁决）。
- R2 **property 只挂在纯核心上**：随机序列由驱动生成、当实参传进核心函数；cases 生成器自己造这些实参（例如任意的 (a, b) 列表、任意的 ±1 序列），
  不经过被测程序的 rng。这样参照比的是确定值，不是「同种子的另一份实现」。
- R3 **`shuffle-fisher-yates` 的参照**是 `random.Random(同种子).shuffle`——算法相同、实现不同（注 1）。推荐接受（它守下标范围与遍历方向，这两处正是学生会写错的）；
  另一个选项是不设 P、只受 `program_run_check` 约束。
- R4 每个 🎲 程序，构建者在 `/usr/bin/python3`（3.9.6）与 3.12.x 上各跑一次，stdout 逐字节比对，写进报告。
- R5 讲解里说出演示的关键数字（π 的估计值、频率、平均等待）时，说的是**这个种子**下的值，并说明换种子会变；不写「大约等于」的空话，也不写「看输出」。

## 6. 给构建者的额外约束（写进简报）

- `cases` 走到被测函数的每一个返回分支：扫雷点到雷 / 点到 0 / 点到数字；井字棋 X 胜 / O 胜 / 平 / 未完；2048 一行全 0 / 无可合并 / 连续三块或四块相等
  （`[2, 2, 2, 2]` → `[4, 4, 0, 0]`、`[2, 2, 2, 0]` → `[4, 2, 0, 0]`）；赌徒破产两种结局。
- `ttt-minimax` 的 cases：从空盘随机落 k 步（k ≥ 3）得到的合法、未结束局面，控制每组搜索量，满足门的每次调用 2 秒时限；写明 k 的范围与为什么。
- `entry` 不改实参（2048、生命游戏、扫雷都要先复制）。
- 负控制只做保证终止的变异；子进程用 Python `subprocess.Popen(start_new_session=True)` + `communicate(timeout=…)`，超时杀进程组（本机没有 `timeout` 命令）。
- 长度取向约 60 行，超过的写进报告；不用 `chunks`。

---

## 7. 合计

| 页 | 程序 | 变体组 | 带 P | 🎲 | ⌨ | ⟳ |
|---|---|---|---|---|---|---|
| py-simulation | 12 | 3（pi-estimate、game-of-life、shuffle） | 10 | 7 | 0 | 0 |
| py-games | 12 | 2（ttt-winner、merge-row-2048） | 9 | 3 | 3 | 1 |
| **m5b** | **24** | **5** | **19** | **10** | **3** | **1** |

---

## 8. 裁决（2026-09-30，Python编程 审定）

| # | 问题 | 决定 |
|---|---|---|
| B1–B6 | 边界 | 全部确认。B1：FSM 概念在 `traffic-light-fsm` 讲，M8 只用在硬件上。B3：折半只用不讲，讲解指「查找」一页（注册表页名，「」括起来） |
| §4 | 递归 | `ttt-minimax`「用，不重讲」 |
| R2 | property 只挂纯核心 | 批准——随机序列当实参传入，这正是本页该讲的一件事 |
| R3 | `shuffle-fisher-yates` 的参照 | **接受** `random.Random(同种子).shuffle`；局限（同一算法：守下标范围与方向、守不住算法本身）写进 refs 注释，并进第 3 次回报留账 |
| R4 | 两解释器比对 | 照做：每个 🎲 程序在 3.9.6 与 3.12.x 上各跑一次、stdout 逐字节比对 |
| — | 页名 | `minesweeper-flood-reveal` 指 BFS 那一页用 `py-graphs` 在注册表里的实际 title（`python/python-tools.json`），不自拟 |
| — | `sir-epidemic-steps` | 浮点输出打印时 round 或格式化到固定位数，照 R4 两解释器比对 |
| — | `ttt-minimax` cases | k ≥ 3 照做；门每次调用限时 2 秒 |
| — | 组名 | 5 个组名与全库无重名；m5a 的清单到了由 Python编程 交叉核对，撞了由 m5a 改名 |
