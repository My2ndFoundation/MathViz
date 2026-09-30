# Python 子项目 · 第 4 期留给第 5 期的账

> 第 4 期（M6「科学计算与数理统计」五页，两波并行：m6a = `py-numpy-basics` + `py-numpy-linalg` + `py-statistics`，m6b = `py-pandas` + `py-matplotlib`）已完成：
> **5 页、46 个程序**（m6a 28 + m6b 18），其中 30 个带 property 检查，`lines` 合计 1,518。
> 全库现为 28 页、**310 个程序**（其中 203 个带 property 检查）、`lines` 合计 9,012。第 4 期内门数没变（#191、#192 改了门的逻辑，没有加门）；
> 收尾期间合并的 #196（第 5 期开工前提，`8493a5f`）加了 `pygame_main_guard_check`，见 §五.8。
> PR：#191（scipy-stack 层开工前提）· #192（property 门逐层比类型）· #193（第 3 期收尾）· #194（m6a）· #195（m6b）。
> 这份文件是**账本**，不是待办列表——每一条都记着**为什么当时没修**，以及**什么时候它会变成必须修**。
>
> **核对基线 `2349e0f`**（#195 合并后的 main），收尾当天（2026-09-30）逐条实测；文中 file:line 都按它。
> 来源：期控制方的派发简报与台账（主工作区 `.superpowers/python-phase4/phase4-brief.md`、`controller-log.md`）、复盘条目 `retro-items.md`（1–22）、
> 两波控制方的台账（`m6a-ledger/`、`m6b-ledger/`）——都 gitignored，**不在仓库里**，要留下来的这里都抄全了；以及两份清单规格与五个 PR 的描述。
>
> 规格：`docs/superpowers/specs/2026-09-16-python-subproject-design.md`
> 两波清单：`docs/superpowers/specs/2026-09-30-python-phase4-m6a-design.md`、`-m6b-design.md`
> 裁决：`docs/superpowers/handoffs/2026-09-30-python-phase4-rulings.md`
> 前几期账本：`2026-09-30-python-phase{1,2,3}-deferred.md`

---

## 一、前几期账本 §一 的五件事：第 4 期之后

第 4 期派发简报 §1.5 要求「§一 列的存量问题新内容一个都别再加」。结论：**新内容一个都没加，存量一处没动**。

「存量没动」的整体证明：`git diff --stat 83e9eb9 2349e0f -- 'python/programs/ch0*' 'python/programs/ch1*' 'python/programs/ch20*' 'python/programs/ch21*' 'python/programs/ch22*' 'python/programs/ch23*' python/core` **为空**；
对照：同一命令换成 `'python/programs/ch2*'` 报出 52 个文件、+4939（全在 ch24–ch28），路径模式是有效的。`83e9eb9` 是第 3 期账本的核对基线，所以第 3 期账本里落在这些路径下的 file:line 今天**逐字仍成立**。

### 1. 讲解与提示指向「页面上看不到的输出」——仍开

- **存量**：第 1 期的 27 处与第 2 期的 1 处都在（路径没动，见上）。
- **新内容**：用第 3 期账本的短语扫描（「看输出」「输出的第」「打印的第」「屏幕上」「打印出来的」"in the output" "the output" 等）扫 ch24–ch28 的 notes / blurb / lineNotes / 提示：命中 6 处，逐条看过**全都说出了值、不指向输出**
  （如 ndarray-create「打印出来的数组元素之间只有空格、没有逗号」、series-and-dataframe「打印出来的两个类型名分别是 Series 和 DataFrame」、eigen-2x2 "so the output is always the same"）。真指向 0 处。对照：同一扫描在 ch01 报出 6 处。
  matplotlib 页按裁决把「图长什么样」用文字写进讲解（m6b 终审逐个核过）。
- **什么时候必须修**：同前——用户定下「读模式显示 `run.expect`」与否时。

### 2. 复制进 PyCharm 时没有 `_fixtures/`——手抄一致性已修（#187），复制仍只带 `.py`

- 本期新增 1 个 fixture：`ch26-pandas/_fixtures/pupils.csv`（7 行），`read-csv-inspect` 读它；门今天认出 9 处引用（`check.py` 原话「fixture 手抄：9 处引用」）。
  `git ls-files 'python/programs/*/_fixtures/*'` 与磁盘上 `find python/programs -path '*_fixtures*' -type f` 都是同样 7 个文件（`diff` 无输出）。
- **仍开着的**：复制按钮照旧只复制 `.py`（core 没改）——`read-csv-inspect` 粘进 PyCharm 要照讲解手工建 `_fixtures/pupils.csv`，这一步没人验过（#195 列为未勾选项）。

### 3. 判定器在行数不同时完全不比缩进——仍开

- `python/core/judge.js:162` 仍是 `if (na.rel.length === nr.rel.length) {`（core 没改）。
- **新内容**：ch24–ch28 的 128 个空（26 + 25 + 20 + 27 + 30）里多行空 3 个，**全是「复合语句头 + 一行体」**：`eigen-2x2` 的 sign（`if`，答案 :24–25）、`merge-left-join` 的 nan-to-none（`if`，:18–19）、
  `broadcasting-table` 的 except（**`except` 头**，:35–36）。前两个在作者须知已有的例外里；第三个 m6a 终审 m8 实测与 `if` / `for` 头行为相同（体缩进错判 `indent`、写成一行判对），接受——本收尾把 `except` 写进了例外条款。
- **什么时候必须修**：同第 3 期账本。

### 4. `boards` 的语义等用户裁决——仍开

- 310 个程序**全部**写满四家（实测 310 / 310）。第 4 期是第一次整页依赖第三方库，拿不准的一次多了 46 个（§三.2）。

### 5. 程序打印内置 / 操作系统的异常消息——存量仍开，新内容 0

- 存量 5 条行号不变（路径没动）。新内容：ch24–ch28 共 6 个 `except` 块（`broadcasting-table`、`matrix-product-matmul`、`linear-system-solve`、`linear-system-inverse`、`determinant-and-identity`、`filter-mask`），**全部只打印 `type(e).__name__`**。
- **什么时候必须修**：照旧——CI 的 Python 版本升级（今天 3.12.14）、或任何一条在新版本上漂了。

---

## 二、第 3 期账本其余条目：本期处理了 / 仍开

| 第 3 期账本 | 状态 | 今天的实测 |
|---|---|---|
| §二.1 程序长度（`library-loans` 86 行被「不超过 80 行」筛掉） | 仍开 | ch23 没动；M6 反过来全都偏短，见 §三.1 |
| §二.2 `boards` 拿不准清单（m5a / m5b） | 仍开 | 与本账本 §三.2 一起交用户 |
| §二.3 钉法缺口（ch20–ch23） | 仍开 | 路径没动 |
| §二.4 只由 `run.expect` 守的部分 | 仍开 | 本期新增一批，见 §三.8 |
| §二.5 `shuffle-fisher-yates` 参照同算法 | 仍开 | 无变化 |
| §二.6 tag 词表分裂 | **存量仍开，本期 0 新增** | 全库 432 个不同 tag，折叠大小写 / 空格 / 连字符后仍只有存量两组撞（`nested-loops` 7 章 / `nested loops` ch10，`lookup-table` ch23 / `lookup table` ch11）；本期 m6a 新造的 `rounding` 由修复并回 `round`（今天 `rounding` 只剩 ch23）；两次终审都查了 tag |
| §二.7 讲解用程序 id 指代兄弟程序（ch01–ch07 26 个） | 存量仍开，本期 0 新增 | 扫 ch24–ch28 的 notes / blurb / lineNotes：0 处；对照 ch05 报出 3 个程序 |
| §二.8 `isdigit` 的存量（ch02 `is_pin`） | 仍开 | ch24–ch28 里 `isdigit` 0 处 |
| §三.1 等价变异；`refs/ch21_simulation.py:256-257` 注释待改 | 注释仍待改；本期新增三条，见 §四.1 | `:256-257` 原文未动 |
| §三.2 「fixture 必须被 git 跟踪」没有门 | 仍开（建议） | 本期两次合并前核验都手工核了 `pupils.csv` 被跟踪 |
| §三.3 门在被测抛错 / 超时时印「参照返回：None」 | 仍开 | #192 之后行号变了：`python/scripts/gates/library.py:407`（超时）、`:410`（抛错）填 `None`，`:432` 照样印「参照返回」 |
| §三.4 tag 规范化门（建议「第 4 期开工之前连同存量一起做」） | **仍开，过了它自己写的时机** | 没做；M6 新造 43 个只在 ch24–ch28 出现的 tag，没有新分裂——靠的是作者规矩与两次终审，不是门 |
| §三.5 `isdigit` → `int()` 扫描 | 仍开（建议） | 仍 0 处 |
| §三.6 只由一条 `cases` 分支守的规则 | 仍开 | 本期同类的新例：`refs/ch26_pandas.py` 的 `_missing_cases` 约一成造全缺，是「全缺返回 None」唯一的守门（m6b 修复者写明「别把生成器改回去」） |
| §三.7 主规格 §7.1 门表缺 `fixture_notes_check` | 第 3 期收尾已修 | #192 又把逐层比类型写进了 §7.1 那一行 |
| §四.1 Skill 工具读主工作区旧版 | **部分处理** | 第 4 期派发简报 §1 开头写明「用 Read 从 `$W/.claude/skills/` 读」，两波都照做（m6b 台账裁决 5）；主工作区今天仍停在 `533c813`，用 Skill 工具的读者照旧读到旧版 |
| §四.2 构建者写不进集成 worktree | **本期处理了** | #193 的新模板（报告写构建者自己 worktree、集成时拷）下 5 个构建者 0 个 BLOCKED（复盘 1） |
| §四.3 权限拒 `rm` → `review-tmp/` | **本期出了死结，已改方案**，见 §五.3 | |
| §四.4 台账整目录拷走 | 本期处理了 | 两波都连脚本拷走：`m6a-ledger/` 20 项、`m6b-ledger/` 33 项（`m6a-probe.js`、`m6b-probe.js`、两份 `draft-proto.py`、`negctl.py`、`copy-run.py` 都在） |
| §四.5 对齐探针量到换行符 | **又发生一次，本期根治** | m6b 探针又量到 `\n`（第 3 期修的是那一次测量）；本收尾把探针做成标准件 `probe.js`，见 §五.4 |
| §四.6 两解释器比对的口径 | 本期不适用 | M6 的 3 个 stdlib 层程序（`requires` 为空：`mean-variance-loop`、`mean-median-mode`、`z-test-one-sample`）都不用随机 |
| §四.7 遗留的 worktree 与分支 | 本期处理了 | 见 §五.7 |
| §四.8 设计 §9.2 的两份文档 | **仍开，过了期限** | 见 §五.8 |
| §四.9 用户验收 | 仍开 | 见 §五.9 |
| §四.10 等用户的决定 | 见 §五.10 | |
| §四.11 `git-size-before.txt` 没记测量时点 | **又发生一次** | 见 §五.11 |

---

## 三、两波留账：内容

### 1. 程序长度：M6 全都偏短

按 `lines` 的算法（去掉 BLANK 指令行、不含末尾空尾巴；五页之和 1,518，与注册表 `lines` 之和相同，口径对）：M6 46 个程序 **25–42 行，43 个短于 40**，没有超过 60 的。
m6a 27–42（V1「宁少勿凑」），m6b 25–41（复盘 22 写的「24–41」里的 24 是修复前的 `missing-fill-mean`，修复加了全缺判断与一行演示，今天 27）。
- **为什么没修**：两波控制方与两次终审都逐个读过——每个程序只做清单那一格、没有凑数的演示，也没有缺教点。
- **什么时候必须修**：学生反馈「太短、练不出东西」时；或下一期（M7 pygame，结构性 compile-only）定取向时，先想清楚「40–60」是不是只对综合类页面有意义。

### 2. `boards` 拿不准的清单（交用户裁决 `boards` 语义时与第 2、3 期账本一起看）

m6a 清单 §7 的表、三个 m6a 构建者报告的补充、m6b 台账的 18 行合并如下。**没有一条逐条核对过考纲原文。**

| 内容 | 程序 | 为什么拿不准 |
|---|---|---|
| NumPy 本身 | m6a 全波 28 个（`mean-variance-loop`、`mean-median-mode`、`z-test-one-sample` 3 个不 import numpy） | 四家考纲都不点名第三方库；「数组」「二维数组」「矩阵」是概念，NumPy 是工具。全库第一次整页依赖第三方库 |
| 均值 / 方差 | `mean-variance-loop`、`mean-variance-vectorised` | 属数学统计多于 CS 考纲（py-numpy-basics 构建者） |
| 线性代数（特征值、逆矩阵、变换矩阵） | `eigen-2x2`、`linear-system-solve`、`linear-system-inverse`、`determinant-and-identity`、`transform-2d-points` | A-level Further Maths，不在 CS 考纲；OCR / AQA 的图形学或向量部分可能碰到变换 |
| 马尔可夫链 | `markov-weather` | 不在四家 CS 考纲 |
| 随机数生成器 | `rng-generator-basics` | 随机数的概念在考纲内，工具是 NumPy（py-numpy-linalg 构建者） |
| 统计与假设检验 | `py-statistics` 全页 10 个；最远离 CS 考纲的是 `z-test-one-sample`、`t-statistic-by-hand`、`normal-probabilities`、`sampling-distribution-of-mean` | 属 A-level Maths 统计 |
| pandas | `series-and-dataframe`、`read-csv-inspect`、`filter-mask`、`filter-query`、`group-mean-groupby`、`group-mean-pivot-table`、`missing-fill-mean`、`merge-left-join`、`sort-two-keys` | 四纲都不点名 pandas；表格数据、筛选、排序的概念在考纲里，库本身不在 |
| matplotlib | `line-plot-pyplot`、`line-plot-axes`、`scatter-sizes-colours`、`bar-chart-labels`、`histogram-bins`、`subplots-grid`、`annotate-and-style`、`savefig-size-dpi`、`plot-from-dataframe` | 考纲不点名 matplotlib；数据可视化只在部分考纲的「数据表示」里泛泛提及 |

也就是说：**M6 的 46 个程序全部拿不准**。`boards` 语义若定成「这个程序教的东西在某考纲里」，M6 大概率整模块四家都去掉；若定成「这个程序用到的编程技能在某考纲里」，大概率保持四家——这正是要你裁决的那一句。

### 3. 钉法缺口（范围复审之后留下的，都是少见写法）

- m6b（范围复审 m2，m6b 裁决 11）：`ch27-matplotlib/histogram-bins.py:10` 的 np-histogram 与 `scatter-sizes-colours.py:18` 的 colorbar，第 1 级只写「第一个实参是 values / points」、没写「按位置给」——`np.histogram(a=values, …)`、`fig.colorbar(mappable=points, …)` 判错且无提示。
- m6a（范围复审 m-B，存量于修复之前）：`ch24-numpy-basics/ndarray-create.py:39` 的 isclose，`print(bool(np.isclose(total, 0.3)))` 与 `np.isclose(a=total, b=0.3)` 判错，第 1 级没钉（前者要到第 2 级）。
- m6a（修复报告）：`ch25-numpy-linalg/markov-weather.py:22` 的 step，`state = (state @ P)`（冗余括号）判错、没钉——不值得钉。
- 另一类（不是缺口，是判定器与 numpy 语义的差）：`determinant-and-identity` 的 round-int 空，`return round(d)` 在 numpy ≥ 1.19 下与标准答案完全等价（值与类型都同，property 门绿是对的），判定器判错，**靠第 1 级提示钉住**（「再在外面套一层 int()」）。讲解如实写了「外面的 int() 只是保险」。本收尾把「numpy 标量与内置函数交互造成的等价写法第 1 级必须钉」写进了作者须知。

**为什么没修**：一次修复 + 一次范围复审。**什么时候必须修**：下次升级这几页时顺手修；学生实际碰到被判错时立即修。

### 4. 「只差实参名」的空（近照抄的边界）

m6a 终审 m7 列了 7 处：挖空行与同程序里一行没挖的只差实参名——`pearson-corrcoef.py:7` 对 `:17`（连左边的名字都相同）、`regression-polyfit.py:7` 对 `:15`、`rng-generator-basics.py:8` 对 `:26`、`:14` 对 `:24`、
`sampling-distribution-of-mean.py:11` 对 `:24`（第 3 级提示还明说「和演示块里那一行同一个写法」）、`broadcasting-table.py:8` 对 `:10`、`normal-probabilities.py:24` 对 `:27`。
按作者须知的定义（删掉的是实参 / 名字就不算）**不是照抄空**；它们考的是「认调用形状 + 实参顺序」。m6a 的 PR 描述写成「5 处」，是只数了控制方交来的两处以外的那 5 处。
- **为什么没修**：终审裁定按定义不算、不要求改（V7）。**什么时候必须修**：想给 py-statistics 加难度时，先动 `pearson-corrcoef` 的 `corrcoef` 空（改挖 `:17`，或只留 `table` 与 `pick` 两个空）。

### 5. 讲解 / blurb 点名要用的 API（设计取舍）

m6b 终审 M4：`line-plot-pyplot` 的 blurb 逐一点名了两个空的函数（`plt.xlabel`、`plt.legend`），notes 又给出 Day——合起来 `plt.xlabel("Day")` / `plt.legend()` 三种模式都能直接读到。不算逐字写出整行；变体对照正是要讲这些名字。
（同一条里的 `plot-from-dataframe`「to_string 配 index=False」修复者已改。）**什么时候必须修**：若定下「blurb 不点名被挖的函数」这条规矩。

### 6. 英文跨页写法：两波裁决相反，全库对半

作者须知写「指别的页写注册表里的页名，用「」括起来」，没说英文怎么写。今天全库英文讲解（notes / blurb / lineNotes 按段数）：

- `the X page`（不带引号）**37 段**：ch02 3、ch13 1、ch14 9、ch15 1、ch16 3、ch17 1、ch18 1、ch19 6、ch21 1、ch22 3、**ch24 4、ch25 2、ch28 2**；
- 「」括英文名（页名与程序标题都有）**36 段**：ch20 11、ch23 10、**ch26 9、ch27 6**。

第 4 期两波各往一边加：m6a 的修复（V7）按「全库存量多数」统一成 `the X page`、删掉英文里的「」；m6b 按 Python编程 的「讲解用「」」写，终审 M3 还要求英文变体标题加「」。
另有存量：`ch02-strings` 三个程序（`index-and-slice`、`strings-are-immutable`、`string-method-tour`）英文写 `the Files and Errors page`，注册表页名是 `Files & Exceptions`。
- **为什么没修**：改讲解要给 7 页升版；收尾 PR 只改文档。**哪一种对，是 Python编程 的裁决**（不是系统方向）；本收尾没替它选，只在 `python-content-wave` 第 2 步加了「本波共有约定表」，让下一波派发前定下来、各构建者同一口径。
- **什么时候必须修**：Python编程 定下一种之后，下一个动这几页的内容 PR 顺手统一并升版。

### 7. tag

- M6 本期新造 43 个只出现在 ch24–ch28 的 tag，两次终审都比过全库，没有新分裂。库名 tag 小写（`numpy`、`pandas`、`matplotlib`）；`numpy` 只放在真 import numpy 的程序上（m6a 修复后 `import numpy` ⇔ `requires` 含 numpy ⇔ tag 含 `numpy`，0 处不一致，范围复审核）。
- 存量：`array`（ch12、ch24、ch25、ch28）/ `arrays`（ch13）——M6A-D8 定新内容用单数、存量不动；`round` / `rounding`（ch23）同类。改要升版。
- 作者须知原来写「选择器按 tag 筛，分裂了就筛不全」——**不对**：`python/core/interact.js:278-296` 的 `filterPrograms` 只按 level / kind / boards / lines 筛，tag 只在面板上显示（m6a 终审 m10）。本收尾改了那句的理由（显示给她看、自相矛盾的元数据）；
  要不要做 tag 筛选是产品决定，不在本账本。

### 8. 只由 `run.expect` 守的部分

M6 46 个程序里 16 个不带 property：ch24 `ndarray-create`、`slice-is-a-view`、`numpy-scalar-repr`；ch25 `rng-generator-basics`；ch26 `series-and-dataframe`、`read-csv-inspect`；
ch27 除 `histogram-bins` 外的 8 个；ch28 `sampling-distribution-of-mean`、`t-statistic-by-hand`。带 P 的程序里，演示块用 rng 的那一半（`histogram-bins` 的数据、`normal-probabilities` 的经验对照）也只由 `run.expect` 守。
matplotlib 页的特别之处见 §四.3。

---

## 四、门与测量看不见的

### 1. 等价变异：门看不见，也不该看见（本期新增三条）

记下来是为了**下一个做负控制的人别把它们当成「cases 的盲区」**：

- `determinant-and-identity` 的 `det_int`：`int(round(d))` 改成 `round(d)`——numpy ≥ 1.19 里单参数 `round(np.float64)` 已返回 `int`（m6a 终审 M4 实测 `<class 'int'>`；版本按 NumPy 1.19.0 release notes gh-15840）。
- `merge-left-join`：`int(score)` 改成 `round(score)`——Python 3 的 `round(float)` 返回 `int`（m6b 终审）。注意：改成**裸** `score` 不等价，门断言红（#195 合并前 Python编程 的自选负控制）。
- `sort-two-keys`：多列 `sort_values` 加 `kind="stable"`——多列走 `lexsort_indexer`、不读 `kind`（m6b 终审；这也印证了清单那处错误）。

### 2. #192 之后 property 门仍然看不见的

- **生成器走不到的分支**：`missing-fill-mean` 的全缺情形，原生成器「保证至少一个在场」，门对「全缺时返回 NaN」是瞎的（m6b 终审 I3）。修复后生成器约一成造全缺（种子 20260916 下 200 组里 28 组），删掉全缺判断断言红；
  对照旧生成器门不报——证明新生成器是这一支唯一的守门（§二 表 §三.6 一行）。这是作者须知「`cases` 必须走到每个返回分支」的又一例，不是新盲区。
- 「返回值不许含 NaN」（P17）没有专门的门：只有 cases 真的造出会产生 NaN 的输入时，`nan != nan` 才会让门红。

### 3. matplotlib 画出来的图没人看过

`program_run_check` 只比 stdout；`savefig` 写进门的临时 cwd，跑完即删。py-matplotlib 的 9 个程序打印的是结构事实（线条数、轴标签、柱高、tick、文件是否存在），**图本身在任何地方都没有被看过**——
讲解里「图长什么样」的文字只由评审对着代码读。页面也不显示图。
- **什么时候必须修**：用户做 PyCharm 验收时（§五.9）顺带看一眼；或学生反馈讲解描述与她看到的图不符时。

### 4. scipy-stack 层在本地非严格模式下会静默跳过

`PYTHON_GATES_REQUIRE_SCIPY` 不设时缺库只打印一行「N 段因缺库跳过」、门仍绿（#196 起这个变量也管 pygame，名字是历史原因）。本期派发简报要求本地也用严格模式，两波照做；本收尾把严格模式写进了 `python-content-wave` 的验收命令，并在根 `CLAUDE.md` 的 python/ specifics 记了一条。
`scipy` 仍在 `requires` 白名单里、不在 CI 安装清单里——用它就得在同一个 PR 里把它加进钉版本的安装步骤（主规格 §5.4 第 2 条）。

### 5. 第 3 期账本 §三 的四条建议仍开

「fixture 必须被 git 跟踪」的门、「参照返回：None」的措辞（今天 `library.py:407` / `:410` / `:432`）、tag 规范化门、`isdigit` → `int()` 扫描——见 §二 的表。

---

## 五、流程上的账

1. **Skill 工具读主工作区旧版——仍开。** 主工作区今天仍停在 `533c813`。第 4 期靠派发简报 §1 的明文要求绕过去了（两波都用 Read 读 `$W`）；本收尾写回 skill 的一切，对用 Skill 工具的读者照旧无效，直到主工作区前进（第 10 条）。
2. **构建者报告写自己 worktree——生效。** 5 个构建者 0 个 BLOCKED，报告全部按回复里给的实际路径拷进了台账（复盘 1）。**不改**。
3. **`review-tmp/` 成了死结，改用方案 ①（P25）。** #193 写回的规则是「评审 / 复审 / 修复的临时文件放台账下 `review-tmp/`，删不掉就留给控制方统一删」。第 4 期：
   - m6a：终审员删被拒，**控制方删掉了**（台账第 5 步）；拷走的 `m6a-ledger/review-tmp/` 是空目录（复审员列出的 3 个文件也已不在）。
   - m6b：评审、复审、修复者与控制方的 `rm -rf` **全部被拒**，`review-tmp/` 38 项（约 22 MB：导出副本、注入副本与脚本）留在集成 worktree 里；删 worktree 等于绕过那次拒绝，控制方不代删（P26）。
     **已处理：用户于收尾当天亲手删除了 `.claude/worktrees/python-wave-m6b` 与本地分支 `claude/python-wave-m6b`（`9a9101c`）。**
   - 同一个动作两波结果不同——权限的结果不能当流程的前提。方案 ①：临时文件与导出副本一律放 scratchpad（文件名带波名与角色前缀），只把报告（和报告引用、值得留下的脚本）写进台账。
     **本收尾核出复盘 15 的一处前提不成立**：它说 scratchpad「写得进也删得掉」，而本收尾在本会话的 scratchpad 里 `rm -rf` 一个自建目录**同样被权限拒**（没有换命令绕）；scratchpad 里还躺着 `p2close-*` / `p3close-*` 的十来个克隆与导出副本，前两次收尾都没删。
     方案 ① 仍然成立，但理由是「**不必删**」——临时文件在仓库目录树外，不挡 `git worktree remove`、不会被 `cp -R` 拷进台账——不是「删得掉」。skill 按这个理由写，并明写「不要试着删、更不要换命令绕」。
4. **浏览器探针做成了标准件。** `.claude/skills/python-content-wave/probe.js` 由 `m6a-probe.js`（含全空改字符替代测量 `m6aAllBlanks`）与 `m6b-probe.js` 合成：先断言 marker 与 `TOOL.id`（不成立返回 `VOID`）；
   字面量检查报次数，0 次时 `literalMode = 'fallback'`，全空改字符与合成对照就是结论；对齐从末尾往前找可见字符、每档报字宽并要求随缩放严格变大；负控制 `padding-left`；localStorage 按排序后的键复原。
   本收尾在 http 预览上实测过（`2349e0f` 的页面，marker 用 probe.js 自身的路径证明读的是本 worktree）：py-numpy-basics 字面量 0 次 → fallback 52 次 0 判对 0 泄漏 0 空消息，字宽 7.063 / 7.844 / 9.797，dx = dy = 0，负控制 dx = −13；
   py-pandas 字面量 40 次、页面层真点一次「检查」不印原文；错页 id、错 marker 都返回 `VOID`；把 `blankFeedback` 包成「消息里拼上标准答案」之后探针报出 42 条问题——与两波台账的数一致，测量看得见它要排除的东西。
5. **期控制方的合并核验进了台账**（第 3 期裁决 §四的要求）：`controller-log.md` 记了 #191 / #192 / #193 / #194 / #195 的 CI run、head、范围、本地全量与自选负控制，全部照录进裁决文件 P27。
6. **起草期原型进了 skill。** 两波都做了（复盘 3、17）；m6b 的原型在清单阶段发现了门盲区（#192），m6a 的原型报出两个低触发变异，#192 之后几分钟内改成逐层比重验。本收尾把骨架写进 `python-content-wave` 第 1 步。
7. **遗留的 worktree 与分支。** 两波台账记下的构建者 worktree 与分支都删了（m6a：集成 + 3 个构建者 worktree、7 个分支、origin 集成分支；m6b：2 个构建者 worktree、4 个分支、origin 集成分支）；m6b 的集成 worktree 与分支由用户删（第 3 条）。
   今天主仓库仍是 46 个 `worktree-agent-*` 分支、16 个 `.claude/worktrees/agent-*` 目录——与第 2、3 期账本记的数相同；本地 `claude/python-wave-*` 0 条；origin 共 20 个 head、没有 python 分支。
   另有本地分支 `claude/python-subproject-design`（`77a4f35`，2026-09-16「第 0 期（地基）实施计划」，是 origin/main 的祖先），归属不明，本收尾不删。
8. **设计 §9.2 的两份文档仍未写，过了期限**：`docs/superpowers/python.md` 与 `docs/superpowers/prompts/python-handoff.md`（今天 `ls` 都不存在）。第 3 期账本说「第 4 期开工前」必须写，没写；
   第 4 期是靠派发简报 §2 与主规格 §5.4 走过来的，两波构建者读得到规则。第 5 期（M7 pygame）的**工具链**已由 #196（`8493a5f`，收尾期间合并）落地：
   CI 装钉版本 `pygame==2.6.1`、无头 SDL，property 可挂 pygame 逻辑函数、导入限时，新门 `pygame_main_guard_check` 守「模块顶层不开窗、主循环在 `main()` 里」（主规格 §5.4 末段、§7.1）。
   但那一层的写法与坑仍只在规格和门里（`python-drill-tool` 今天只有门表里 #196 加的一行），没有进这两份文档。**什么时候必须修**：第 5 期派构建者之前——至少把 #196 定下的写法（`main()` 与 `__main__`、property 入口把 `Rect` / `Vector2` 转成 `tuple`）写进 `python-drill-tool` 的正文，架构文档随后。
9. **用户验收仍未做**：5 个新页面的 `file://` 双击打开；复制程序粘进 PyCharm 真跑——**要先 `pip install numpy==2.3.1 pandas==2.3.0 matplotlib==3.10.3`**（版本不同，打印格式可能与 `run.expect` 不同），`read-csv-inspect` 要照讲解手工建 `_fixtures/pupils.csv`；
   matplotlib 的图顺带看一眼（§四.3）。#194、#195 都列为未勾选项；前 23 页同样未做。
10. **等用户的决定**：
    - 照旧四件：`boards` 语义（M6 全部 46 个拿不准，§三.2）；页面是否显示 `run.expect`；`core.hooksPath` 是否改成相对路径；主工作区（停在 `533c813`）要不要 fast-forward 到 main，或在用户级记忆里给两个 skill 放一句「用 Read 读集成 worktree 里的版本」的指路。
    - `file://` 与 PyCharm 验收（第 9 条）。
    - ~~m6b 集成 worktree 与本地分支~~——**已处理：用户于收尾当天亲手删除**。成因（`review-tmp/` 的 `rm -rf` 被权限拒；控制方不代删，因为删 worktree 等于绕过那次拒绝、是跨会话的权限洗白）留作复盘事实，解法是第 3 条的方案 ①。
11. **m6a 的 `git-size-before.txt` 又没记测量时点**（第 3 期账本 §四.11 同一件事）：m6a 台账第 0 步没有这一行，文件时间戳是拷贝时间。它与 m6b 在 `4b13c49` 上测的值逐字段相同（count 1918），应是同一时点前后测的。§六 照录。
    `python-content-wave` 第 0 步已要求「存进台账目录」，本收尾补一句「`progress.md` 记下测的时点与基线 SHA」。

---

## 六、体积

**页面**（今天实测 `2349e0f`）：28 页合计 **8,054,600 B**（逐页 gzip -9 之和 2,690,580 B），平均约 288 KB/页。
新 5 页合计 1,430,221 B：`py-statistics` 306,188、`py-pandas` 288,196、`py-matplotlib` 284,598、`py-numpy-basics` 277,122、`py-numpy-linalg` 274,117。最大的一页仍是 `py-text-data`（327,800）。
前 23 页合计 6,624,379 B，与第 3 期账本记的**逐字节相同**（core 没改）。

**仓库**（`git count-objects -vH`，字段 `count` · `size` · `in-pack` · `size-pack`；整个仓库共用一个 `.git`）：

| 时点 | count | size | in-pack | size-pack | 出处 |
|---|---|---|---|---|---|
| 第 3 期收尾 | 1874 | 21.06 MiB | 6776 | 26.47 MiB | 第 3 期账本 §五 |
| m6b 开工前（`4b13c49`） | 1918 | 21.40 MiB | 6776 | 26.47 MiB | `m6b-ledger/git-size-before.txt` |
| m6a 开工前（时点未记，见 §五.11） | 1918 | 21.40 MiB | 6776 | 26.47 MiB | `m6a-ledger/git-size-before.txt` |
| m6a 波后（#194 合并后） | 2226 | 25.15 MiB | 6776 | 26.47 MiB | `m6a-ledger/git-size-after.txt` |
| m6b 波后（#195 合并后） | 2255 | 25.55 MiB | 6776 | 26.47 MiB | `m6b-ledger/git-size-after.txt` |
| 收尾当天 | 2255 | 25.55 MiB | 6776 | 26.47 MiB | 本收尾在主工作区实测，2026-09-30 14:17 |

第 4 期增量全是松散对象（第 3 期收尾以来 +381 个、+4.49 MiB），pack 没变（`prune-packable` 801，与前两期相同）。
第 1–3 期账本的担心照旧：**第一次改 core 会重写全部 28 页**；到时量一次。

---

## 七、原描述错在哪（收尾核对发现）

照前几期的惯例。**起草 / 清单错误**一栏在前：

1. **m6b 清单把 `kind="stable"` 写在多列 `sort_values` 上**：多列走 `lexsort_indexer`、不读 `kind`（pandas 2.3.0 源码；文档「only applied when sorting on a single column」）。py-pandas 构建者纠正，改成单列上讲 `kind="stable"`、讲解说多列排序本就稳定（m6b 裁决 6）。
2. **m6b 清单「`.mean()` 返回 numpy 标量、打印前 `float()`」措辞过宽**：只对单个值成立；迭代 Series / `itertuples()` 交回的已是 Python 数，删掉 `float()` 门全绿——是等价程序。构建者删掉多余转换、改正一条行注（m6b 裁决 7）。
3. **「NumPy 2 起单参数 round 返回 int」实为 NumPy 1.19 起**（1.19.0 release notes，gh-15840）：源头是 m6a 终审 m6 的**建议原文**，修复者照写（ch25 一句、ch24「在 NumPy 2 里」一句），范围复审 I-A 查 release notes 指出；控制方去掉版本限定（V8）。

其余：

4. **复盘 15「scratchpad 写得进也删得掉」**：本收尾在 scratchpad 里 `rm -rf` 被权限拒（§五.3）。方案 ① 的成立理由是「不必删」。
5. **作者须知与第 3 期账本 §三.4 的「选择器按 tag 筛」**：`filterPrograms` 不按 tag 筛（§三.7）。
6. **m6a 台账与控制方台账的「V1–V9 全部接受」**：台账只有 V1–V8（裁决文件 §二开头）。
7. **m6a PR 描述「5 处近照抄」**：终审 m7 列的是 7 处（§三.4）。
8. **复盘 22 与 m6b 台账「m6b 程序 24–41 行」**：24 是修复前的 `missing-fill-mean`，今天 25–41（§三.1）。
9. **py-pandas 构建报告「稳定性只靠参照 `sorted` 与演示守」**：property 门守得住（`df.iloc[::-1]` 变异断言红，m6b 终审 M6，台账已更正）。
10. **m6b 台账裁决 12 的「~几 MB」**：实测 22 MB、38 项。
11. **主规格 §5.4 的分层表写「stdlib = M1–M5、scipy-stack = M6」**：层按 `requires` 分（`library.py` 的 `_tier`），M6 页上有 3 个只用标准库的程序在 stdlib 层——今天 stdlib 267 段、scipy-stack 43 段。本收尾改了表。

---

## 八、复盘条目（`retro-items.md` 1–22）的去向

写回 skill 的写在「落到哪」；不改的写明理由。`CW` = `python-content-wave/SKILL.md`，`DT` = `python-drill-tool/SKILL.md`。

| # | 条目 | 落到哪 / 不改的理由 |
|---|---|---|
| 1 | 新模板（`checkout -B`、报告写构建者自己 worktree）零 BLOCKED | **不改**：规则生效了，照旧（§五.2） |
| 2 | `review-tmp/` 的删除注定落在控制方 | 与 15 合并：CW 第 5 步「临时文件一律放草稿区…不必删，也不要试着删」；`final-review-brief.md`「只读」一节；已知的坑一行；红旗一条 |
| 3 | 起草期原型写成 skill 第 1 步的骨架 | CW 第 1 步「起草期原型」一条（含可运行的骨架、命中数门槛约 50/200、骨架自己的负控制） |
| 4 | 字面量 0 次时的替代测量收进浏览器验收 | `probe.js` 第 2、3 项（`literalMode = 'fallback'`）；CW「浏览器验收」 |
| 5 | 临摹探针直接输出字宽 | `probe.js` 第 4 项（每档报字宽、要求随缩放严格变大）；CW「浏览器验收」 |
| 6 | 「从某版本起」要查过 release notes | DT 内容标准「讲解里对库行为的断言要有出处」 |
| 7 | numpy 标量与内置函数交互的等价写法第 1 级必须钉 | DT「只挖写法唯一的行」下新增一段 |
| 8 | 同波构建者互相看不见 tag | CW 第 2 步「本波共有约定表」、第 3 步「送终审前先扫 tag」；`builder-brief.md` 新 REQUIRED 槽 |
| 9 | 例外条款补 `except` | DT 例外条款（`if` / `for` / `while` / `except`）与第 4 期实例 |
| 10 | 选择器不按 tag 筛 | DT tag 一条改了理由并写明 `filterPrograms` 的实情；要不要做 tag 筛选是产品决定（§三.7） |
| 11 | 存量英文跨页写法三种 | **留账** §三.6（改讲解要升版）；并补了本期两波裁决相反这一事实，CW 约定表要求下一波先定一种 |
| 12 | boards 拿不准表并入 | **留账** §三.2 |
| 13 | 清单错：`sort_values` 多列不读 `kind`；`.mean()` 措辞过宽 | §七.1、§七.2；规则见 16 |
| 14 | 对齐探针又量到换行符 | `probe.js` 标准件（§五.4）；CW「浏览器验收」要求用它、不从台账复制 |
| 15 | `review-tmp/` 死结（方案 ①） | 同 2；另核出「删得掉」这一前提不成立（§五.3、§七.4） |
| 16 | 第三方库参数语义起草时核 | CW 第 1 步「清单里写到第三方库参数的语义，起草时核一句出处」；DT 同一条的后半 |
| 17 | 起草原型写进第 1 步 | 同 3 |
| 18 | 浏览器探针当标准件 | 同 14：`.claude/skills/python-content-wave/probe.js` |
| 19 | 范围复审只改提示文字的 Important 控制方直接落地 | CW 第 5 步新增一条（附判定器实测表、再跑 `check.py`） |
| 20 | 讲解泄漏扫描与照抄扫描（括号里的内容也算核心） | `final-review-brief.md`「讲解泄漏」一条 |
| 21 | m6b 裁决 9：修复者走 (b) 而非评审推荐的 (a) | **不改 skill**：「我的做法与简报不一致、而我的做法更对」本身就是上报项，模板已有；记进裁决文件（m6b 裁决 9） |
| 22 | 留账：冷门关键字未钉、讲解点名 API、程序偏短 | **留账** §三.3、§三.5、§三.1 |
