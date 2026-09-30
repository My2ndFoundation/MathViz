# Python 子项目 · 第 2 期 · M4「算法分析」程序清单

> 状态：**已批准**（2026-09-30，Python编程 受用户委托审定；裁决见 §9）。
> 日期：2026-09-30
>
> 上游：主规格 `2026-09-16-python-subproject-design.md` §2.1 / §2.2（M4 五页的内容清单）、§9；
> 第 1 期设计 `2026-09-16-python-phase1-design.md` §6（内容标准、页面边界 §6.5）与 §7（清单格式）。
> 同期并行：M3「数据结构」由另一会话（MDev-01）做，章目录 ch10–ch14；本模块用 ch15–ch19。

---

## 0. 本模块的固定取值

| 页 | 章目录 | refs 文件 | 程序数 |
|---|---|---|---|
| `py-searching` | `ch15-searching` | `gates/refs/ch15_searching.py` | 10 |
| `py-sorting` | `ch16-sorting` | `gates/refs/ch16_sorting.py` | 11 |
| `py-graphs` | `ch17-graphs` | `gates/refs/ch17_graphs.py` | 11 |
| `py-dp-greedy` | `ch18-dp-greedy` | `gates/refs/ch18_dp_greedy.py` | 10 |
| `py-complexity` | `ch19-complexity` | `gates/refs/ch19_complexity.py` | 12 |

`module` = 4，`accent` = `rose`（配色表是门）。合计 **54 个程序、13 个变体组、49 个带 P**（见 §7）。

**命名约定**：不在变体组里的程序，`problem` 就用程序 id（id 全库唯一有门守，与 M3 并行也不会静默撞成跨页变体组）。
变体组的组名见各表「组」列；它们是本模块新起的名字，查过全库 ch01–ch09 无重名。**M3 起组名时请避开**：
`linear-search` `binary-search` `bubble-sort` `merge-sort` `quicksort` `depth-first-search` `dijkstra`
`minimum-spanning-tree` `grid-paths` `knapsack-01` `coin-change` `has-duplicates` `max-subarray`。
集成时控制方再对一遍 main 上的全库组名。

---

## 1. 查重（起草时核过的）

全库 ch01–ch09 共 106 个程序。与本模块相邻、**不重复**的：

| 已有 | 在哪 | 本模块怎么避开 |
|---|---|---|
| `pair-sum-nested-loops` / `pair-sum-two-pointers`（O(n²) vs O(n)） | ch07 | py-complexity 的「同一问题两种复杂度」换成 has-duplicates 与 max-subarray |
| `fibonacci-memo-dict` / `fibonacci-lru-cache`（记忆化机制） | ch09 | py-dp-greedy 不再做斐波那契；记忆化以 grid-paths 出现，**用**不重讲 |
| `sorted-min-max-with-key`（`sorted` 的稳定性） | ch08 | py-sorting 讲的是**哪个算法**稳定、为什么；不重讲 `sorted(key=)` |
| `find-max-and-index`、`has-negative-*`（线性扫描的模式） | ch07 | py-searching 的线性查找讲「找不到返回 −1」与哨兵、有序提前停，不重讲标志位 |
| `power-by-squaring`、`fibonacci-naive` 打印调用次数 | ch09 | py-complexity 的插桩数的是比较 / 移位次数，不数递归调用 |
| `is-prime-trial-division`（只试到 √n） | ch03 | 不作复杂度例题 |

---

## 2. 程序清单

「组」= `problem` 变体组（空 = 单个程序，`problem` = 程序 id）。「P」= property 参照（空 = 无 property，只受 `program_run_check` 约束）。
「教什么」是这个程序存在的理由，构建者不得偏离；觉得有更经典的替换，**上报，不擅自换**。
「⟳」= 用到递归（见 §4）。

### 2.1 py-searching · `ch15-searching` · M4 · 10

| id | 组 | 教什么 | P |
|---|---|---|---|
| `linear-search-for` | linear-search | 逐个比较，找到返回下标、找不到返回 −1；为什么不能在循环里 `else: return -1` | `xs.index(t) if t in xs else -1` |
| `linear-search-sentinel` | linear-search | 在**副本**末尾放哨兵，循环体里少一次越界判断；最后判「是不是撞上了哨兵」 | 同上 |
| `linear-search-sorted-early-exit` | linear-search | 有序表里遇到比目标大的就停——找不到时平均少比一半 | 同上（cases 只产有序表） |
| `binary-search-iterative` | binary-search | `lo` / `hi` / `mid`、闭区间 `while lo <= hi`、`mid ± 1`；前提是有序 | `xs.index(t) if t in xs else -1`（cases 只产**无重复**有序表，见注 1） |
| `binary-search-recursive` ⟳ | binary-search | 同一算法，区间当参数往下传；基例是空区间 | 同上 |
| `binary-search-bisect` | binary-search | `bisect_left` 给插入点，再判那一格是不是目标 | 同上（参照是线性扫描，不用 `bisect`，见注 2） |
| `binary-search-leftmost` | | 有重复时找**第一个**：命中后不停，继续往左收（`hi = mid`，半开区间） | `xs.index(t) if t in xs else -1`（cases 含重复） |
| `count-occurrences-sorted` | | `bisect_right − bisect_left` 两次 O(log n) 数出现次数 | `xs.count(t)` |
| `binary-search-trace-table` | | 逐步打印 `lo mid hi` 与比较结果——A-level 考卷的追踪表 | |
| `hash-search-linear-probing` | | 自己建的定长表：`key % size` 定位、冲突往后探、遇空位即判不在；与内置 `in` 的对照 | `t in keys`（cases 保证装载率 < 1，覆盖命中 / 探到空位 / 绕回表头三支） |

注 1：经典二分「命中即返回 `mid`」在有重复元素时返回的下标不唯一，参照给不出唯一答案；所以这三个变体的 cases 只产无重复有序表，
「有重复时要第一个」专门交给 `binary-search-leftmost`。

注 2：**`bisect` 不能当二分查找的参照**——CPython 3.12 `Lib/bisect.py` 的纯 Python 版 `bisect_left` 就是
`while lo < hi: mid = (lo + hi) // 2; if a[mid] < x: lo = mid + 1 else: hi = mid`，与 `binary-search-leftmost`
要教的写法逐行同构（第 1 期 `calendar.isleap` 那次同类）。本页全部查找程序的参照统一用线性的 `list.index` / `list.count` / `in`。

### 2.2 py-sorting · `ch16-sorting` · M4 · 11

所有排序程序的 `entry` 统一是**不改实参、返回新列表**的函数（见 §5「门的盲区」，这是本页最要紧的一条）。

| id | 组 | 教什么 | P |
|---|---|---|---|
| `bubble-sort-basic` | bubble-sort | 两重循环、相邻比较、元组交换；每趟把最大的「冒」到末尾 | `sorted(xs)` |
| `bubble-sort-early-exit` | bubble-sort | 一趟没交换就停（已有序时 O(n)）+ 每趟少比一个 | `sorted(xs)` |
| `selection-sort` | | 每趟找最小值的**下标**、只交换一次 | `sorted(xs)` |
| `insertion-sort` | | 先存下 `key`，把比它大的逐个右移，再落位（不是反复交换） | `sorted(xs)` |
| `shell-sort` | | 间隔 `n // 2` 逐次减半的插入排序；间隔为 1 时就是插入排序 | `sorted(xs)` |
| `merge-sort-top-down` ⟳ | merge-sort | 对半分、各自排好、`merge` 两个有序表；`<=` 保稳定 | `sorted(xs)` |
| `merge-sort-bottom-up` | merge-sort | 同一个 `merge`，宽度 1、2、4… 两两合并，不递归 | `sorted(xs)` |
| `quicksort-lomuto` ⟳ | quicksort | 原地分区（末元素作枢轴）、递归两段；已有序输入退化成 O(n²) | `sorted(xs)` |
| `quicksort-comprehension` ⟳ | quicksort | 用三个推导式分出 `< = >` 三段再拼接——好读、但每层建新表 | `sorted(xs)` |
| `counting-sort` | | 值域小的非负整数：计数表 + 按序展开；不做比较 | `sorted(xs)`（cases 值域 0..20） |
| `sort-stability` | | 同一组 (成绩, 姓名) 分别用插入排序与选择排序按成绩排，打印出来看等值项的先后；`is_stable` 判定 | |

性质族：前十个 `check.property` = `"sort"`。`sorted` 是 C 实现的 Timsort（小表走二分插入），与上面每一个手写算法机制都不同。

### 2.3 py-graphs · `ch17-graphs` · M4 · 11

图一律用 `dict`（结点 → 邻居列表 / (邻居, 权) 列表）或邻接矩阵表示；`dict` / `list` / `collections.deque` / `heapq` 只当容器用。
随机 cases 的结点取 `0..n-1`（n ≤ 7），演示块里用字母结点。

| id | 组 | 教什么 | P |
|---|---|---|---|
| `adjacency-list-and-matrix` | | 同一张无向图的两种表示互转；度数、判边的代价对比 | 矩阵→邻接表：refs 里按边集合 `{(i, j)}` 重建 |
| `bfs-order` | | 队列 + `visited`，**入队时**标记；按层扩展的访问顺序 | refs 里逐层 frontier 扩展（不用队列） |
| `bfs-shortest-path` | | 无权图最短路：记 `parent`，倒推出路径；不可达返回 `None` | 返回距离表：refs 里 Bellman-Ford 式反复松弛 |
| `dfs-recursive` ⟳ | depth-first-search | 递归 DFS 的访问顺序 | refs 里的显式栈版 |
| `dfs-iterative-stack` | depth-first-search | 显式栈；邻居**倒序**压栈、**出栈时**标记，才与递归版顺序一致 | refs 里的递归版 |
| `dijkstra-array-scan` | dijkstra | 表格版：每轮线性扫出未定结点里距离最小的——考卷上的那张表 | refs 里 Bellman-Ford |
| `dijkstra-heapq` | dijkstra | 优先队列版：`heapq` + 「弹出的是旧记录就跳过」 | refs 里 Bellman-Ford |
| `topological-sort-kahn` | | 入度表；可选结点里总取编号最小的，使顺序唯一；有环返回 `None` | refs 里 O(n²) 反复挑「剩余图中无入边的最小结点」 |
| `mst-prim` | minimum-spanning-tree | 从一个结点长出去，`heapq` 取最轻的跨边；返回总权，不连通返回 `None` | refs 里枚举全部 n−1 条边的子集（n ≤ 6） |
| `mst-kruskal` | minimum-spanning-tree | 边按权排序 + 并查集判环（并查集只写 `find` 与合并两行，本程序讲） | 同上 |
| `a-star-grid` | | 网格 A*：`f = g + h`、曼哈顿启发；返回最短步数，不可达返回 `-1` | refs 里网格 BFS |

### 2.4 py-dp-greedy · `ch18-dp-greedy` · M4 · 10

| id | 组 | 教什么 | P |
|---|---|---|---|
| `grid-paths-memo` ⟳ | grid-paths | 带障碍网格从左上到右下（只向右 / 下）的路径数：自顶向下 + `lru_cache` | refs 里枚举「向下」落在哪几步（`itertools.combinations`）再逐条走一遍验障碍；网格 ≤ 5×5 |
| `grid-paths-table` | grid-paths | 同一递推式自底向上填表；第一行 / 第一列与障碍的边界 | 同上 |
| `knapsack-01-table` | knapsack-01 | 0/1 背包二维表 `best[i][w]`；每件「拿或不拿」 | refs 里枚举全部子集（n ≤ 10） |
| `knapsack-01-1d` | knapsack-01 | 一维滚动数组，容量**从大到小**遍历（正序就变成可重复拿） | 同上 |
| `lcs-length` | | 最长公共子序列长度的表；再倒推出一条 LCS 打印（不唯一，只比长度） | refs 里枚举较短串的全部子序列（长度 ≤ 8）逐个判是否为另一串的子序列 |
| `edit-distance` | | 插入 / 删除 / 替换三种操作的最小次数表 | refs 里自顶向下递归 + `lru_cache`（同一递推、不同求值顺序与下标约定；构建者须实测它能抓住下标错位变异，抓不住就上报） |
| `coin-change-greedy` | coin-change | 每次拿不超过余额的最大面值；英镑硬币体系下是最优 | refs 里按金额 BFS 求最少枚数（cases 只用英镑面值 1 2 5 10 20 50 100 200） |
| `coin-change-dp` | coin-change | `best[a] = min(best[a − c] + 1)`；演示块打印 {1, 3, 4} 凑 6 时贪心给 3 枚、DP 给 2 枚 | 同上（cases 面值任意，含凑不出返回 `-1`） |
| `activity-selection` | | 按**结束时间**排序后贪心；为什么按开始时间或按时长都会错（演示块各举一个反例） | refs 里枚举全部子集求最大互不重叠数（n ≤ 10） |
| `huffman-code-lengths` | | `heapq` 反复合并最轻两组，每合并一次该组里每个字符码长加一；返回总编码位数；不建树 | refs 里用有序列表 + `bisect.insort` 做同样的合并（机制不同：无堆），比总位数 |

### 2.5 py-complexity · `ch19-complexity` · M4 · 12

**输出一律是计数，不计时**（门在全新临时目录里跑，时间不确定）。输入不用 `random`：用倒序表、
`[(i * 7) % n for i in range(n)]` 这类确定构造（n 与乘数互素时是一个置换）。

| id | 组 | 教什么 | P |
|---|---|---|---|
| `loop-shape-counts` | | 四种循环形状数基本操作：单层 n、两重 n²、内层依赖外层 n(n−1)/2、折半 ⌊log₂n⌋+1 | 入口 `count_dependent_pairs(n)` 对 `n * (n - 1) // 2` |
| `growth-rate-table` | | n 取 1…1024 的 2 的幂，整数算出 log n / n / n log n / n² / 2ⁿ（大的用位数表示）并排成表 | |
| `search-comparison-counts` | | 插桩的线性与二分查找，在找不到的最坏情况下数比较次数：n 对 ⌊log₂n⌋+1 | 入口 `binary_worst_comparisons(n)` 对 `n.bit_length()` |
| `insertion-shift-counts` | | 插桩插入排序数「右移」次数 = 逆序对数；倒序输入 n(n−1)/2、已有序 0 | 入口 `count_shifts(xs)` 对 refs 里两重循环数逆序对 |
| `merge-vs-insertion-counts` | | 同一批输入上两种排序的比较次数并排：n = 8…512，比值随 n 变大 | |
| `doubling-experiment` | | 规模翻倍、看计数翻几倍：×2 → O(n)，×4 → O(n²)，≈×2 多一点 → O(n log n)；「大 O 实证」 | |
| `has-duplicates-nested` | has-duplicates | 两两比较 O(n²) | `len(set(xs)) != len(xs)` |
| `has-duplicates-sorted` | has-duplicates | 先排序再比相邻 O(n log n)；**不改实参** | `len(set(xs)) != len(xs)` |
| `has-duplicates-set` | has-duplicates | 边走边放进集合 O(n)——拿空间换时间 | refs 里排序后比相邻（被测用了集合，参照不用） |
| `max-subarray-quadratic` | max-subarray | 固定起点、向右累加，O(n²) | refs 里 Kadane |
| `max-subarray-divide-conquer` ⟳ | max-subarray | 分成两半 + 跨中点的最大和，O(n log n) | refs 里三重循环暴力（n ≤ 12） |
| `max-subarray-kadane` | max-subarray | 一遍扫描、「以这里结尾的最大和」，O(n) | refs 里三重循环暴力（n ≤ 12） |

（`growth-rate-table` 是纯公式、`doubling-experiment` 是实测，二者互为对照；若嫌多，可合并成一个——交审定。）

---

## 3. 边界（交裁决）

一个知识点只在一页**讲**（第 1 期 §6.5）。M4 用得到、但本属 M3「数据结构」或 M2 的：

| # | 知识点 | 本清单的做法 | 需要裁决的 |
|---|---|---|---|
| B1 | 堆排序 vs 堆 | **不做堆排序**（主规格 §2.2 的 py-sorting 清单里本来就没有它）；`heapq` 在 Dijkstra / Prim / Huffman 里只当优先队列**用**，讲解一句话带过 | 堆排序归 M3 `py-trees-heaps` 还是不做？ |
| B2 | BST 查找 vs 二分查找 | 本页只讲有序**数组**上的二分；BST 查找归 M3 `py-trees-heaps` | 确认 |
| B3 | 哈希查找 vs 字典 | `hash-search-linear-probing` 自己实现定长表 + 线性探测（A-level 的哈希查找算法）；「字典当查找表」归 M3 `py-dicts-sets` | M3 若也打算讲「自己实现哈希表」，二者只留一个 |
| B4 | 队列 / 栈 | BFS 用 `collections.deque`、DFS 用 list 当栈，都只**用**；「队列 / 栈是什么」归 M3 `py-stack-queue` | 确认 |
| B5 | 并查集 | `mst-kruskal` 里写最小的 `find` + 合并两三行，在本程序里讲（M3 五页的清单里没有并查集） | 确认归 M4 |
| B6 | Huffman 的树 | 不建树（按组合并、码长加一）——避开「二叉树」这个 M3 结构 | 若希望打印出码字（要建树），归属怎么定 |
| B7 | 排序稳定性 | ch08 `sorted-min-max-with-key` 讲过「`sorted` 是稳定的」；本页 `sort-stability` 讲「哪个手写算法稳定、为什么」，讲解指回那道题的标题 | 确认不算重复 |
| B8 | 记忆化 | ch09 讲过字典记忆化与 `lru_cache` 的机制；`grid-paths-memo` 只**用** `lru_cache`，重点是「自顶向下 vs 自底向上」 | 确认 |
| B9 | 复杂度讲在哪 | 各算法页的讲解里只写一句「时间 O(…)」；推导、插桩、增长率、倍增实验只在 `py-complexity` | 确认 |
| B10 | 标志位 | `bubble-sort-early-exit` 的 `swapped` 是标志位（本属 py-loops），这里只用 | 确认 |

## 4. 递归（交裁决）

第 1 期规定「递归只在 py-recursion 讲」。本清单里用到递归的 7 个程序（表中 ⟳）：

| 页 | 程序 | 可否换成非递归 |
|---|---|---|
| py-searching | `binary-search-recursive` | 不可——它存在的理由就是与迭代版并排 |
| py-sorting | `merge-sort-top-down` | 已配一个非递归的 `merge-sort-bottom-up` |
| py-sorting | `quicksort-lomuto`、`quicksort-comprehension` | 快排的标准形式就是递归 |
| py-graphs | `dfs-recursive` | 已配一个显式栈的 `dfs-iterative-stack` |
| py-dp-greedy | `grid-paths-memo` | 不可——「自顶向下」即递归 |
| py-complexity | `max-subarray-divide-conquer` | 不可——分治即递归 |

**建议：用、不重讲递归本身。** 讲解只说这个算法**为什么**自然地分成子问题、基例是什么，不讲调用栈 / 基例与递归步的一般机制；
需要时写「递归的机制见 py-recursion 页」。递归深度：门在 `check.py` 自己的栈里跑（上限 1000），cases 的规模留在几十以内，
快排的有序输入退化（深度 = n）也不会碰上限。

---

## 5. 门的盲区：`algorithm_property_check` 看不见「改了实参」

起草时实测到的（CPython 3.12.9）：门的循环是 `args = cases(rng); got = fn(*args); want = ref(*args)`——
**参照拿到的是被测函数已经改过的同一个对象**。一个原地排序若写坏成「移位时丢了 key」
（`items[j] = items[j - 1]` 而没有先存 key），元素多重集已经变了，但 `sorted(被改过的表)` 恰好等于它：
协议——种子 1、200 组、长 0..8、值 −9..9 的随机表：**134 组答案是错的，门比对不出任何一组**。

全库现有 48 个带 property 的程序逐一跑过（每组先 `deepcopy` 实参、跑完比对）：**没有一个改实参**，所以这个盲区目前是潜伏的；
M4 的原地排序会是第一批踩上它的。

本清单的做法（不依赖改门）：**排序的 `entry` 一律是不改实参的函数。** 两种写法交裁决：

- **(a) 推荐**：算法本身写成原地、返回 `None`（与 `list.sort()` 一致），另配一个 3 行的 `sorted_copy(items)`
  （`result = list(items)` → 调原地函数 → `return result`）当 `entry`。顺带讲清 `list.sort()` 与 `sorted()` 的约定。
- (b) 函数开头 `items = list(items)`、排完 `return items`——改动小，但不再是「原地」算法。

`has-duplicates-sorted`、`linear-search-sentinel` 同理：先复制再排序 / 放哨兵。

门那一侧的根治（参照前先 `copy.deepcopy(args)`）属于 `python/scripts/gates/` 的门逻辑，**本清单不改**，已报给 Python编程。

---

## 6. boards（按现行规则：确知不含才去掉；以下是拿不准的）

全部程序暂按四个考纲都保留。下列内容我**不确知**是否在某考纲里，列出待裁（boards 语义本身也还待用户裁决）：
A*（`a-star-grid`）、最小生成树（`mst-prim` / `mst-kruskal`）、拓扑排序、Huffman、LCS / 编辑距离 / 背包 / 活动选择、
希尔排序、计数排序、`hash-search-linear-probing`（线性探测的细节）。

---

## 7. 合计

| 页 | 程序 | 变体组 | 带 P | 用递归 |
|---|---|---|---|---|
| py-searching | 10 | 2（linear-search 3、binary-search 3） | 9 | 1 |
| py-sorting | 11 | 3（bubble-sort、merge-sort、quicksort） | 10 | 3 |
| py-graphs | 11 | 3（depth-first-search、dijkstra、minimum-spanning-tree） | 11 | 1 |
| py-dp-greedy | 10 | 3（grid-paths、knapsack-01、coin-change） | 10 | 1 |
| py-complexity | 12 | 2（has-duplicates 3、max-subarray 3） | 9 | 1 |
| **M4** | **54** | **13** | **49** | **7** |

## 8. 给构建者的额外约束（写进简报）

- property 的 `cases` 必须走到被测函数的**每一个返回分支**：空表、单元素、重复元素、找不到 / 不可达 / 有环 / 凑不出。
  每个 `return` 各做一次变异、确认门红，或统计一次种子下各分支命中数，写进报告。
- 参照与被测**机制不同**，写之前用 `inspect.getsource` 看一眼标准库参照的源码（注 2 的 `bisect` 就是反例）。
- 排序页每个程序都做一次「丢 key / 覆盖而非交换」一类会改变元素多重集的变异，确认门红——这正是 §5 的盲区。
- py-complexity：计数确定、不计时；演示块的输入不用 `random`。

---

## 9. 裁决（2026-09-30，Python编程 审定）

| # | 问题 | 决定 |
|---|---|---|
| R1 | §5 排序 entry 写法 | **(a)**：算法原地、返回 `None`，另配 3 行 `sorted_copy` 当 entry；讲解顺带讲 `list.sort()` 与 `sorted()` 的约定。`has-duplicates-sorted`、`linear-search-sentinel` 先复制 |
| R2 | §5 门的根治 | 由 Python编程 单独一个 PR 修（参照前 `copy.deepcopy(args)`，带负控制）；合并前本波照 R1 绕开 |
| R3 | 注 2 `bisect` 同构 | 核实成立；查找页参照一律线性的 `list.index` / `count` / `in` |
| B1 | 堆排序 | 本期不做（M3 只讲堆结构，M4 也不加） |
| B2 | BST 查找 | 归 M3 `bst-search`；py-searching 不拿 BST 当例子 |
| B3 | 哈希 | M3 只讲怎么用 dict / set；哈希表的实现（哈希函数、冲突、探测）归 `hash-search-linear-probing` |
| B4 B5 B8 B9 B10 | | 确认。B9 与 M3 一致：M3 只点出「pop(0) 要挪动」「每次扫一遍」，插桩、倍增归 py-complexity |
| B6 | Huffman | 不建树、不打印码字 |
| B7 | 稳定性 | 不算重复；讲解写那道题的**标题**指回去 |
| §4 | 递归 | 用，不重讲；讲解写「递归的机制见 「递归」 一页」这类页名指代；`tags` 带 `recursion` |
| §6 | boards | 照现行规则写全四个；拿不准的汇总进第 3 次回报；本波不去掉任何一家 |
| — | `growth-rate-table` / `doubling-experiment` | 两个都留（公式 vs 实测） |
| — | 组名 | 与 M3 的 11 个组名、全库现有 problem 名都不重（Python编程 实测） |

写进简报的补充规矩：
1. 判定器已知宽松：**行数不同时完全不比缩进**（`judge.js` 161–172 行），连改变语义的缩进也判对。有嵌套块的程序**不挖跨嵌套块的多行空**；多行空只挖同一层的两三行，并用第 1 级提示钉住写法。
2. 页面不显示程序输出：讲解与提示不写「看输出第 N 行」「和打印出来的一样」；py-complexity 的计数结果要在讲解里用文字说出来。
3. 讲解里指别的程序写**标题**，不写「下一个 / 上一个 / 配对的程序」。
