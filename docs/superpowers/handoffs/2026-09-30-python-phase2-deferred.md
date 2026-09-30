# Python 子项目 · 第 2 期留给第 3 期的账

> 第 2 期（M3「数据结构」五页 + M4「算法分析」五页，两波并行）已完成：**10 页、111 个程序**（M3 57 + M4 54）。
> 全库现为 19 页、**217 个程序**（其中 136 个带 property 检查）、`lines` 合计 5,704，门数仍是 40。
> PR：#181（property 门深拷贝）· #183（property 门逐次时限）· #184（M3）· #185（M4）。同期的 #179 与 python/ 无关，#180 只动了 `python/index.html` 的画廊背景（+69 行，`git diff --stat 601d487^1 601d487 -- python/`），#182 是第 1 期收尾。
> 这份文件是**账本**，不是待办列表——每一条都记着**为什么当时没修**，以及**什么时候它会变成必须修**。
>
> **核对基线 `f82945d`**（#185 合并后的 main），收尾当天（2026-09-30）逐条实测；文中 file:line 都按它。
> 来源：两波控制方的台账（`.superpowers/python-phase2/m3-ledger/`、`m4-ledger/`，在主工作区、gitignored，**不在仓库里**——
> 所以凡是要留下来的，这里都抄全了）、复盘条目汇总 `retro-items.md`（同目录）、两份清单规格、四个 PR 的描述。
>
> 规格：`docs/superpowers/specs/2026-09-16-python-subproject-design.md`
> 两波清单：`docs/superpowers/specs/2026-09-30-python-phase2-m3-design.md`、`-m4-design.md`
> 裁决：`docs/superpowers/handoffs/2026-09-30-python-phase2-rulings.md`
> 第 1 期账本：`docs/superpowers/handoffs/2026-09-30-python-phase1-deferred.md`（§一 逐条继承，见下文 §一）

---

## 一、第 1 期账本 §一 的五件事：新内容避开了，存量没动

第 1 期账本把它们列为「第 2 期开工前该先想清楚的」。第 2 期的做法是**把规矩写进两波的简报与清单**（M3 规格 §7 的三条附加规矩、
M4 规格 §9 的三条补充规矩、M4 构建者共同简报），让十页新内容不再产生新的实例；**五件事的根都没修**，存量一处没改。

存量没动这一点有一个整体的证明：`git diff --stat 83e7a2d f82945d -- 'python/programs/ch0*' python/core` 为空
（对照：同一命令换成 `'python/programs/ch1*'` 报出 121 个文件变更；`git ls-files 'python/programs/ch0*'` 有 117 个文件，路径模式是有效的）。
`83e7a2d` 正是第 1 期账本逐条核对时的基线，所以第 1 期记下的、落在 `programs/ch0*` 与 `core/` 下的 file:line 在今天的 main 上**逐字仍成立**；`gates/` 下的因 #181 / #183 改过门而移了行（例如第 1 期记的 `library.py:145-147` 今天是 `:146-148`），以下各条给的都是今天重新看过的位置。

### 1. 讲解与提示指向「页面上看不到的输出」

- **存量**：第 1 期列的 27 处（25 个程序）全部仍在。抽看：`python/programs/ch01-basics/chapter.json:30`「注意输出的第一行」、
  `ch01-basics/chapter.json:71`「看 36.6C 那一行」、`ch02-strings/chapter.json:44`「输出的最后两行」、`ch03-functions/chapter.json:43`「输出的第四行和第六行」、
  `ch04-oop/chapter.json:72`「看输出第四行」、`ch08-comprehensions/chapter.json:614`「输出第三行」；提示里的
  `ch03-functions/local-and-global-scope.py:7`「输出第一行就是它」、`ch04-oop/composition-has-a.py:22`「和输出第二行对上」、`ch04-oop/point-plain-class.py:10`「和打印出来的那一行一模一样」。
- **新内容**：M3 终审（I2）抓到约 11 处、修复实现者另扫出 4 处，全部按裁决 V10 改写成不依赖输出（`b9ddd8b`）；M4 终审 M4 一处（`merge-vs-insertion-counts` 的「第一行」）已改（`e37fd15`）。
  今天 ch10–ch19 只剩一处：`ch15-searching/chapter.json:539`「最后一行写着没找到」（`binary-search-trace-table`，M4 范围复审 Minor 2，同一句已说出内容，裁决留账）。
- **为什么没修**：两波只管自己的十页；改存量要 bump 九页版本。「读模式显示 `run.expect`」那条路是 core 改动，要走设计，两波都没有这个范围。
- **什么时候必须修**：第 3 期起草清单之前定下两条路里的哪一条。V10 的判断是：逐条改写的句子在「以后显示输出」时仍成立，所以新内容先改写没有回滚成本；
  存量若也走改写，是 27 处、9 页 bump。

### 2. 复制进 PyCharm 时没有 `_fixtures/`

- **存量**：仍是 ch05 的 4 个程序（`missing-file-lbyl.py`、`missing-file-eafp.py`、`read-csv-split.py`、`read-csv-module.py`）；门把 fixture 拷进临时目录在
  `python/scripts/gates/library.py:146-148`，讲解末段的手抄内容仍没有门守一致。
- **新内容**：ch10–ch19 没有 `_fixtures/` 目录，也没有程序读它（对照：同一个 grep 在 ch0* 上找到那 4 个 `.py`）。
- **什么时候必须修**：照旧——M5 `py-text-data`（CSV / JSON 读写）落地前，也就是**第 3 期**。第 3 期是第一期躲不开它的内容。

### 3. 判定器在行数不同时完全不比缩进

- **存量**：`python/core/judge.js:162` 仍是 `if (na.rel.length === nr.rel.length)` 才比相对缩进。今天重跑第 1 期的反例：
  `compare('if a:\n    if b: c()\nd()', 'if a:\n    if b:\n        c()\n    d()')` → `{"ok":true,…,"kind":"equal"}`；
  对照：行数相同、`d()` 缩进错时 → `{"ok":false,"index":3,"expected":4,"got":0,"kind":"indent"}`。`judge_strictness_check` 仍没有这条反例。
- **新内容**：靠规矩避开——「不挖跨嵌套块的多行空，多行空只挖同一层两三行、第 1 级钉写法」。M3 终审核过 26 个多行空都同层，M4 终审核过 6 个都同层。
  这条规矩原先只在两波的简报与清单里，本收尾 PR 把它写进了 `python-drill-tool`「靠人」清单。
- **为什么没修**：改判定器是 core 改动，两波都不改 core。
- **什么时候必须修**：一个**必须**跨嵌套块挖的程序出现时（规矩就挡不住了），或第一次改 core 的时候顺手修——先给 `judge_strictness_check` 加这条反例、看它红。

### 4. `boards` 的语义等用户裁决

- **存量与新内容**：217 个程序**全部**写满四家（AQA / OCR / Edexcel / CIE），实测 217 / 217。两波都照「确知不含才去掉」的现行规则写全，拿不准的列在 §二.2。
- **什么时候必须修**：用户裁决之后。若裁定为「考纲点名」，受影响的已不止第 1 期说的 M1 / M2 八页——§二.2 的清单要一起过。

### 5. 程序打印内置 / 操作系统的异常消息

- **存量**：5 条都在——`ch02-strings/index-and-slice.py:33`、`ch02-strings/string-method-tour.py:27`、`ch02-strings/strings-are-immutable.py:17`、
  `ch05-files-errors/multiple-except-clauses.py:11`、`ch05-files-errors/missing-file-eafp.py:24`。
- **新内容**：ch10–ch19 共 6 个 `except` 处理块（`list-crud-methods.py:35`、`tuple-keys-sparse-grid.py:28`、`dict-crud.py:17`、`set-operations.py:28`、
  `stack-list-methods.py:35`、`priority-queue-heapq.py:48`），全部只打印 `type(e).__name__` 或自己的话。
- **什么时候必须修**：照旧——CI 的 Python 版本升级、或任何一条在新版本上漂了。注意 CI 现在装的是 3.12.14（#185 的 CI 日志），本机是 3.12.9。

---

## 二、两波留账：内容

### 1. 程序长度超过 40 行的取向

今天实测（按 `lines` 的算法：去掉 BLANK 指令行、不含末尾空尾巴；全库合计 5,704，与注册表 `lines` 之和相同，所以口径对）：
**27 个程序超过 40 行，全在第 2 期**——ch12 2 个（`circular-queue-array` 48、`stack-array-top-pointer` 43）、
ch13 8 个（最长 `doubly-linked-list` 61）、ch14 10 个（最长 `traversals-iterative` 73、`bst-delete` 68）、
ch16 3 个（`merge-sort-top-down` 42、`sort-stability` 42、`merge-sort-bottom-up` 41）、ch17 1 个（`a-star-grid` 42）、
ch19 3 个（`search-comparison-counts` 46、`merge-vs-insertion-counts` 46、`doubling-experiment` 45）。

- **为什么没修**：40 行是取向不是门；M3 超长的根因是每个 P 入口要自带 `Node` / `TreeNode` 和建结构的代码（M3 裁决 V3 接受了双向链表的哨兵写法）。
- **什么时候必须修**：学生反馈临摹太长、或选择器「不超过 40 行」筛掉了一个模块的大半时。可能的修法是让结构类程序共用一段不临摹的前导——那是 core / 数据形状的改动。

### 2. `boards` 拿不准的清单（交用户裁决 `boards` 语义时一起看）

没有一条逐条核对过考纲原文：

- **M3**：链表（AQA 7517 是否点名）、双向链表、数组实现链表（Edexcel）、`linked-list-iter-len`（Python 特有的 `__iter__`）；
  堆 / 二叉堆、`bst-delete`、`expression-tree`、`tree-in-arrays`、`priority-queue-heapq`；调度场与逆波兰、`deque` / `maxlen`、两栈拼队列；
  集合运算（OCR / Edexcel / CIE）；矩阵乘法。
- **M4**：A*、最小生成树（Prim / Kruskal）、拓扑排序、Huffman、LCS、编辑距离、0/1 背包、活动选择、网格路径 DP、希尔排序、计数排序、
  Lomuto 分区、自底向上归并、线性探测的细节；Edexcel / CIE 是否含 BFS / DFS / Dijkstra。

### 3. 提示与讲解的残留 Minor（M4 范围复审，裁决不开第二轮修复）

- `ch19-complexity/growth-rate-table.py` 的 `exact-log` 空（指令在第 14 行，答案在第 15 行）：`-1 + n.bit_length()` 任何一级都没钉。
- `ch16-sorting/bubble-sort-early-exit.py` 的 `shrink` 空（指令第 8 行）：`len(items) - 1 - i`、`n - (1 + i)` 第 2 级才钉。
- 三处钉法按 skill 例外放在最后一级（钉法本身就是整行）：`search-comparison-counts` probe 的 `(hi + lo)` / `lo + (hi - lo) // 2`、
  `counting-sort` 的 `(1 + max_value)`、`knapsack-01-1d` 的 `(1 + capacity)`。
- `binary-search-trace-table` 讲解指向打印输出（§一.1）。

**为什么没修**：skill 规定一次修复 + 一次范围复审；三条都是罕见写法或已说出内容的措辞。**什么时候必须修**：下次升级这两页时顺手修；学生实际碰到被判错时立即修。

### 4. `bst-search` 与 `bst-insert-*` 内容重合

M3 构建者与终审都记了、没动。M3 规格 §3.1 的「拿不准」一条本来就给了删法（把查找并进 `bst-insert-*` 的演示块），审定时按草案保留（M3-D1）。
**什么时候必须修**：py-trees-heaps 下次升级、或程序数需要腾位置时。

### 5. 一个程序只有一个 `entry`

第 1 期账本 §二 的同一件事，第 2 期又添了实例：

- `ch19-complexity/search-comparison-counts`：`entry` 修成 `binary_found_total`（`.py:36`）之后，property 只守「找到」那一支；
  「找不到」那一支（`binary_comparisons` 的末行 `return count`，`.py:27`）只由 `run.expect` 的最坏情况表守（修复报告 §5.2，范围复审接受）。
- `ch18-dp-greedy` 的 `count_coins`（`coin-change-greedy.py:19`）与 `count_activities`（`activity-selection.py:22`）是 1 行 `len(...)` 包装：
  参照只给得出个数（最优解不唯一），所以 property 只比「几枚 / 几个」，不比选中了哪些。

**什么时候必须修**：想让一个程序的两个函数、或一个函数的两类返回值都进 property 时——那要改门（一个程序多个 entry），属 `gates/`。

---

## 三、门与测量看不见的

### 1. 等价变异：门看不见，也不该看见

这些改动不改变程序在 `cases` 上的行为，门保持绿是对的；记下来是为了**下一个做负控制的人别把它们当成「cases 的盲区」**：

- `counting-sort`：表长写死 21（值域 ≤ 20 内等价；构建者原先的注释错称门能抓，已改）。
- `linear-search-sorted-early-exit`：`if items[i] > target:`（`.py:11`）改成 `>=`、或删掉提前停。
- `binary-search-leftmost`：`hi = len(items)`（`.py:7`）改成 `len(items) - 1`——第 1 级提示已钉住写法。
- `a-star-grid`：去掉 `or g + 1 < best[nxt]`（`.py:27`）。M4 终审在 1..8×1..8 随机网格上对 BFS 比 20 万组，0 组不同：四连通网格按奇偶染色，加上堆按 (f, g) 打破平局，这一支在本程序里改不了答案。
- `rpn-evaluate`：`return stack[0]` 的那个变异（M3 构建者报告为等价、绿，合理）；`matrix-multiply-zip` 的 `dot(col, row)`（值同、判定器判错，已由第 1 级钉住）。

### 2. A* 启发函数的轻度高估测不出

`a-star-grid` 的 `manhattan`（`.py:6-8`）若被改成轻度高估，随机网格上门 0/200 检出；构建者加了两张陷阱网格之后，×3 高估能红，轻度高估仍基本测不出。
**为什么没修**：要测出轻度高估得专门构造「高估恰好改变路径」的网格，收益小。**什么时候必须修**：再写一个启发式搜索、或有人改这个启发函数时。

### 3. BLANK 指令对空格宽容

解析器与门都接受 `#`、`>>>`、`BLANK` 之间任意空白：`python/scripts/gates/library.py:56`、`python/scripts/build_programs.py:95`、`python/core/exercise.js:121`
（三处都是 `\s*`）。今天全库 0 处 `>>>BLANK`（对照：`# >>> BLANK` 有 523 处；M3 修复前 `word-count-counter.py:3` 那一处已补空格）。
它只坑过一次**门以外的**工具：M3 控制方复制真跑的正则只认带空格的写法，报成页面与本地不一致（裁决：本波不收紧）。
**什么时候必须修**：再有门以外的东西解析指令时——更好的修法是那些工具改用 `Exercise.clean`（已写进 `python-content-wave` 第 4 步）；若要收紧，三处正则与 `js_parser_parity_check` 一起改。

### 4. 「照抄空」没有门（建议作第 41 道门）

挖空答案去掉缩进后原样出现在同一程序没挖的行上，空就成了抄上下文。M4 终审抓到 3 处（`hash-search-linear-probing` ×2、`lcs-length` ×1），
修复实现者写扫描脚本又找出 2 处（`linear-search-sorted-early-exit`、`search-comparison-counts`），全部改挖；范围复审在 ch15–ch19 的 134 个空上扫到 0 处，负控制（修复前的提交报 5 处、注入一行孪生被报出）两道都红。

**ch01–ch14 本收尾扫过了**（去缩进逐字比对同一程序内没挖的行；负控制：往副本的 ch16 注入一行孪生，被报出）：报出 7 行。
其中 2 行只由关键字和标点组成——ch05 `try-except-else-finally` 的 `finally:`（:18 挖、:28 未挖）、ch07 `guess-number-attempts` 的 `else:`（:21 挖、:18 未挖）——
按本 PR 写进 `python-drill-tool` 的口径**不算**照抄空（这种行在哪都长一个样，挖它考的是结构位置）。**实际 5 处**：

- **M3（第 2 期）4 处**：ch12 `infix-to-rpn` 的 `ops.append(token)`（:14 挖、:17 未挖）、ch12 `queue-from-two-stacks` 的 `if not self.outbox:`（:14 挖、:20 未挖）、
  ch13 `delete-by-value` 的 `current = current.next`（:41 挖、:22 未挖）、ch13 `node-and-traverse` 的 `while current is not None:`（:16 挖、:26 未挖）。
  这条规矩是 M4 终审提出、本收尾 PR 才写进 skill 的，M3 构建与终审时都还没有。
- **第 1 期 1 处**：ch07 `sentinel-running-total` 的 `text = input("Number (or done): ")`（:16 挖、:7 未挖）。

本收尾 PR 第一版写的是「ch01–ch14 没有扫过」，这 7 行是评审扫出来的，上面的数是修正后重扫的。
- **为什么没修**：改挖法就是改内容，要给 py-stack-queue、py-linked-list、py-loops 三页升版；收尾 PR 只改文档，不夹带内容改动。
  终审简报因此改成「只扫本波新增的程序，存量见本节」——否则下一波终审会撞上这 5 处，没有上下文。
- **什么时候必须修**：下一个动这三页的内容 PR 顺手改挖法并升版。要加门（第 41 道）的话，第 3 期开工前最划算——门上线前先把这 5 处改掉，
  或让门带一张显式的豁免清单，否则门一上线就红；两种做法都要做负控制（注入孪生看它红）。

### 5. property 门的一类假设没写在门文件里

两个结构性盲区（被测改实参 → #181；被测不终止 → #183）都是「门在自己的进程里调用被测代码」带来的，且都是**起草清单时**才发现的，不是门自己暴露的。
`library.py` 里两处注释（`:224-227` 讲时限、`:326-330` 讲深拷贝）各自写了自己那个洞，没有一句把这一类假设写明。
本 PR 不改代码，把它写进了 `python-drill-tool` 的 property 一节。**什么时候必须修**：下次改 `library.py` 时，在 `algorithm_property_check` 的文件头补一段威胁模型
（还有哪些副作用会影响门的进程：全局状态、递归深度上限、打印）。

### 6. `<title>` 没有门

工具页 `<title>` 元素里的裸 `&`（应为 `&amp;`）没有任何门看——`python/scripts/gates/*.py`、`scripts/check_nav_contract.py` 里搜 `title>` 0 处命中
（对照：`registry.py:40-41`、`:524` 能搜到 `'title'` 字段）。M3 修复时抓到一处，已改；今天 8 个带 `&` 的页全部是 `&amp;`。本 PR 写进了作者须知与终审简报。
**什么时候必须修**：再出现一次，或给 `page_mirror_check` 加字段时顺手加。

---

## 四、流程上的账

1. **（D1）台账活下来了，草稿区没有。** 第 2 期三次会话重启（其中两次因磁盘满），子代理与草稿区全丢：M3 丢了终审报告、五份构建者报告、集成 / 复制真跑 / 负控制脚本，
   终审要点只能从回传转录（`m3-ledger/review-findings.md` 就是这样来的）。台账因为放在集成 worktree 的 `.superpowers/` 里才活下来。
   已写回：报告、脚本、patch 一律放 `$W/.superpowers/python-waves/<波>/`，收尾整体拷到主工作区 `.superpowers/python-phase<期>/<波>-ledger/`（`python-content-wave` 第 0、7 步与简报模板）。
   **仍没解决**：主工作区的 `.superpowers/` 也是 gitignored——这份账本与裁决是它们唯一进仓库的形式。第 1 期账本 §五.1 要的「每波结束时把台账的裁决与留账两节提交进仓库」，第 2 期是在期末一次做的。
2. **（D2）** 见 §三.5。
3. **（D3）** 见 §一。
4. **构建者简报的基线步骤是错的**：「`merge --ff-only <集成分支>`，不是就停下」——构建者 worktree 从 origin/main 切出，而 worktree 基线不是集成分支的祖先时 ff-only 会失败：
   #179 / #180 落在集成分支切出（`83e7a2d`）之后、派发之前，十个构建者的 worktree 都建在 `601d487`，两波十个构建者全部失败；
   M3 控制方让五人 `reset --hard` 到集成分支，M4 五人自行 `checkout -B` / `reset --hard` 落到正确基线（报告里都申报了；台账记的「四人」见 §六.5）。
   派发前先把 origin/main 合进集成分支的话 ff-only 会成功，但 `checkout -B` 两种情况都对；模板已改成 `checkout -B <构建者分支> <集成分支>`。
5. **遗留的 worktree 与分支**：今天主仓库有 46 个 `worktree-agent-*` 分支、16 个 `.claude/worktrees/agent-*` 目录（`git branch --list 'worktree-agent-*'`、`git worktree list` 实测）。
   **哪些属于第 2 期，材料里没有记录**，本收尾不删。根因：`worktree-agent-*` 是**每个**构建者的 isolation worktree 留下的（`checkout -B` 之后原分支还在），
   而简报没让构建者报原分支名。已写回：简报第一步先报原分支名与 worktree 路径，控制方记进台账，第 7 步按台账清理、再 `worktree prune`；续做前先 `worktree prune`（`python-content-wave` 第 2、7 步与构建者简报）。
   **什么时候必须修**：磁盘紧的时候——第 2 期两次磁盘满都靠删已合并的构建者 worktree 腾空间。
6. **设计 §9.2 的两份文档仍未写**：`docs/superpowers/python.md`（架构）与 `docs/superpowers/prompts/python-handoff.md`（交接）。第 1 期账本 §五.2 建议在第 2 期收尾时写，这次仍没写（本 PR 范围只含账本、裁决、skill 与分期表）。
   **什么时候必须修**：第 3 期派出第一个构建者之前——第 3 期（M5 综合运用）会碰到 §一.2 的 fixture 问题，构建者读得到 skill、读不到「为什么」。
7. **用户验收仍未做**：新 10 页的 `file://` 双击打开、复制程序粘进 PyCharm 真跑——#184、#185 都列为未勾选项；第 1 期的 8 页同样未做。
8. **`core.hooksPath` 是否改成相对路径——仍等用户决定**（第 1 期账本 §四「钩子与仓级」）。第 2 期构建者简报继续写「钩子脚本来自主工作区、可能是旧的，提交前自己跑生成脚本」。
9. **验收命令漏了 `scripts/apply_gallery_bg.py --check`**：CI（`registry-sync.yml:48`）跑它，#180 又给 `python/index.html` 加了画廊背景。两个控制方都自己补跑了
   （M4 台账 §2「验收命令追加 scripts/apply_gallery_bg.py --check」、M3 台账第 4 步「gallery-bg 4 页」），但复盘条目汇总漏收了这一条，本收尾 PR 第一版也没写回；
   评审指出后已加进 `python-content-wave` 的验收命令，PR 模板改为「五道根级门」。
10. **M3 清单规格里还留着一处星号**：`docs/superpowers/specs/2026-09-30-python-phase2-m3-design.md:209`「递归本身见 *递归* 一页」。M4 规格同样的写法已由 `3f34e20` 改掉，
   M3 这句没改（M3 各页实际写的都是「递归」，内容 0 处星号）。下次改这份规格时顺手改。

---

## 五、体积

**页面**（今天实测 `f82945d`）：19 页合计 **5,394,371 B**（gzip -9 后 1,800,746 B），平均约 284 KB/页。
第 1 期的 9 页合计仍是 **2,545,092 B**，与第 1 期账本记的逐字节相同（本期没改 core、没改存量内容）；新 10 页合计 2,849,279 B
（M3 五页 1,413,650 B、M4 五页 1,435,629 B）。最大的仍是 py-files-errors 301,502 B。七个 core 模块合计 180,939 B，每页一份、与第 1 期相同。

**仓库**（`git count-objects -vH`，字段 `count` · `size` · `in-pack` · `size-pack`；整个仓库共用一个 `.git`）：

| 时点 | count | size | in-pack | size-pack | 出处 |
|---|---|---|---|---|---|
| M3 开工前 | 855 | 9.76 MiB | （未记） | 26.47 MiB | M3 台账 `progress.md` 第 0 步（原始输出 `m3-git-size-before.txt` 在草稿区，已随重启丢失） |
| M4 开工前 | 856 | 9.77 MiB | 6776 | 26.47 MiB | M4 台账 `progress.md` §0（原始输出 `m4-git-size-before.txt` 同上丢失） |
| M3 波后 | 1504 | 17.07 MiB | （未记） | 26.47 MiB | MDev-01 第 4 次回报（没进台账文件） |
| M4 波后 | 1505 | 17.07 MiB | （未记） | 26.47 MiB | MDev-02 第 4 次回报（没进台账文件） |
| 收尾当天（#185 合并后） | 1505 | 17.07 MiB | 6776 | 26.47 MiB | 本收尾在主工作区实测，2026-09-30 09:35 |

两波期间增量全是松散对象（+649 个、+7.3 MiB），pack 没变（`prune-packable` 801，下次 gc 会并进 pack）。
**两波的波后量只在第 4 次回报里、没进台账文件**（`m3-ledger/progress.md`、`m4-ledger/progress.md` 里都没有），上面两行是从回报转抄的。
根因是 skill 第 7 步只说「与开工前的记录对比」，没让控制方把波后量写进台账目录；本 PR 已让第 7 步把它存成台账目录的 `git-size-after.txt`，与第 0 步的 `git-size-before.txt` 对称。
第 1 期账本 §六 的担心照旧：**第一次改 core 会重写全部 19 页**；到时量一次。

---

## 六、原描述错在哪（收尾核对发现）

照前两期的惯例：

1. **程序长度的计数**：M3 台账、终审与 PR #184 都记「ch14 9 个超 40 行」，按 `lines` 的口径实测是 10 个——在构建者提交 `43b42a7` 上就已是 10 个，
   不是修复改出来的；差的那一个很可能是正好 41 行的 `priority-queue-scan-min`（原计法没记，无法确认）。ch12 有 2 个超 40 行，台账与 PR #184 都没提。
   M4 台账的超长清单里没有 `search-comparison-counts`：它在修复前（`f0ecdc2`）是 37 行，终审修复加进 `binary_found_total` 后变成 46 行。§二.1 是实测版本。
2. **M4 规格 §4 说用递归的程序有 7 个**，实际 8 个：`merge-vs-insertion-counts` 用了递归而清单没标（构建者加了 tag，终审确认 8 个都带 `recursion`）。
   今天 ch15–ch19 带 `recursion` tag 的是 1 + 3 + 1 + 1 + 2 = 8 个。
3. **「`growth-rate-table:14`」**：第 14 行是 BLANK 指令行，挖空的那一行是第 15 行（§二.3 已按此写）。
4. **两波「开工前」的 count-objects 原始输出都存在草稿区**，都已丢失；数字只能从台账转抄（§五）。
5. **M4 台账记「五人全踩、四人未按简报停下而自行落到正确基线」**：五份构建者报告里是**五人**都自行落到了正确基线——
   py-complexity 与 py-graphs、py-sorting 用 `checkout -B` / `checkout -b` 从集成分支起分支，py-dp-greedy 与 py-searching 用 `reset --hard`，每份报告都申报了这是对「停下」的偏离。
