# Python 子项目 · 第 4 期的裁决

> 这些是控制方在**没有人类在场时**替你做的决定。每一条记着：
> **决定了什么 · 为什么 · 如果判错了代价是什么**。读它，把判错的地方推翻。
>
> 规格：`docs/superpowers/specs/2026-09-30-python-phase4-m6a-design.md`（§8）、`-m6b-design.md`（§10）
> 账本：`docs/superpowers/handoffs/2026-09-30-python-phase4-deferred.md`
> PR：#191（scipy-stack 层开工前提）· #192（property 门逐层比类型）· #193（第 3 期收尾）· #194（m6a）· #195（m6b）

**第 4 期有三个控制方。** 会话「Python编程」写派发简报、审两波清单、开 #191 与 #192、收第 3 期的尾（#193）、集中合并；MDev-01 做 m6a（`py-numpy-basics` / `py-numpy-linalg` / `py-statistics`），
MDev-02 做 m6b（`py-pandas` / `py-matplotlib`），两波并行。下面 §一 是 Python编程 的，§二、§三 是两个模块控制方各自的。

**来源与缺口。** 这一期三方都有台账，全部活着（主工作区 `.superpowers/python-phase4/`，gitignored，**不在仓库里**）：
Python编程 的派发简报 `phase4-brief.md` 与**期控制方台账** `controller-log.md`（第 3 期裁决 §四 要求的「期控制方的合并核验写进台账」这一期做到了）、复盘条目 `retro-items.md`（1–22）、
`m6a-ledger/`（20 项；裁决 V1–V8 有编号，理由多有原话，代价多数没写；**V9 只在 MDev-01 第 3 次回报的消息里，台账缺**，见 §二）、`m6b-ledger/`（33 项；`progress.md` 末尾 13 条裁决三栏齐全）。
所以 §一 的**判错代价大多仍没人写过，如实标「缺」**；但四个内容 / 门 PR 的合并前核验这次都有台账原文，照录在 P27。

用户在对话里拍板的决定不在这里：把清单审批、裁决与集中合并委托给 Python编程、「带『推荐』的选项直接选，只有影响整个系统方向的决策才停下问」（简报开头）。
仍等你裁决的见账本 §五.10：`boards` 语义、页面是否显示 `run.expect`、`core.hooksPath` 改相对、主工作区是否前进、`file://` 与 PyCharm 验收。
m6b 留下的集成 worktree 与本地分支（P26）**已由你在收尾当天亲手删除**。

---

## 一、Python编程（期控制方）

### 期初（派发简报 `phase4-brief.md` §2、§3，2026-09-30）

**P1 · scipy-stack 层的依赖：`requires` 按 import 顺序声明，只许 `numpy` / `pandas` / `matplotlib`；不许 `scipy`。**
检验入门用 numpy 手算统计量，p 值只用标准库 `statistics.NormalDist`（z 检验）；t 分布的 p 值不做，只算 t 统计量并与给定临界值比。
— 理由（简报原话）：`scipy` 在白名单里但不在 CI 的安装清单里，本机也没有——用了 CI 必红，也生成不了 `run.expect`。
— 代价：缺。可核的后果：46 个程序的 `requires` 只出现 numpy / pandas / matplotlib（3 个为空，见账本 §二.3）；`t-statistic-by-hand` 与给定临界值比；
m6a 控制方用 `math.gamma` 写 t 密度、辛普森积分加二分，独立核了清单里的临界值 2.262（df 9）/ 2.776（df 4）→ 2.2622 / 2.7764。

**P2 · 版本钉死 `numpy==2.3.1 pandas==2.3.0 matplotlib==3.10.3`，报告贴一行版本输出；两解释器比对对 scipy-stack 层不适用，钉版本代替它。**
— 理由（简报）：本机 `python3`（3.12.9）正好是这组；`/usr/bin/python3`（3.9.6）没有这些库。打印格式随版本变（主规格 §5.4 第 1 条）。
— 代价：缺。可核的后果：5 个 PR 的 CI 日志都打印 `scipy-stack 2.3.1 2.3.0 3.10.3`（run 36708785499 / 36710840809 / 36711775101 / 36718331335 / 36719234102）。

**P3 · 本地也用严格模式跑门（`PYTHON_GATES_REQUIRE_SCIPY=1`），并确认「程序真跑」那行是「0 段因缺库跳过」。** — 理由（原话）：跳过的程序等于没验。
— 代价：缺。可核的后果：两波台账每一次全量验收都记着「0 段因缺库跳过」；本收尾把它写进了 `python-content-wave` 的验收命令。

**P4 · property 可以挂 scipy-stack 程序：入口返回 Python 内置类型（`.tolist()` / `int()` / `float()`），参照写纯 Python、机制不同；
浮点要么 cases 只用整数，要么入口与参照都 `round(v, 9)`，两边写法一致、写进 refs 文件头。**
— 理由（简报）：门比「值相等且类型相同」；`np.sum` 用成对求和，与逐项相加的末位可能不同。 — 代价：缺。
可核的后果：M6 46 个程序里 30 个带 P（m6a 22、m6b 8）；m6a 的 `markov-weather` 为此把转移矩阵改成 1/4 的倍数（V4）。

**P5 · numpy 随机数只许 `np.random.default_rng(<固定种子>)`**——即第 3 期裁决 P27，简报 §2.2 重申。可核的后果：本收尾扫 ch24–ch28，构造 `default_rng` 的恰好是清单标 🎲 的 4 个
（`rng-generator-basics`、`sampling-distribution-of-mean`、`normal-probabilities`、`histogram-bins`），模块级 `np.random.*` / `RandomState` / 标准库 `random.*` / 读时间 0 处（账本 §二.3 的扫描与对照）。

**P6 · 输出的确定性（简报 §2.2）**：numpy 2 的标量 repr 由一个程序专讲、其余打印前 `.tolist()` / `float()`；DataFrame ≤ 6 列、不设 `pd.set_option`；
matplotlib 建图 → `savefig` → 打印可核对的结构事实 → `plt.close(fig)`，`plt.show()` **可以**放在演示块末尾；讲解按「页面不显示输出」写图的样子；fixture ≤ 12 行。
— 理由：`run.expect` 逐字节比，宽度、repr、全局显示项都会让它漂。 — 代价：缺。可核的后果：`numpy-scalar-repr` 专讲；py-matplotlib 构建者**不放** `plt.show()`（见 P24）；`pupils.csv` 7 行。

**P7 · 沿用第 3 期的**：长度取向 40–60 行、不用 `chunks`；页面边界（用 M1–M5 的一切、只讲 §2.2 的 M6 内容；均值 / 方差的向量化写法归 numpy-basics，统计概念归 statistics，同一概念两页各写时成变体组）；
不需要交互程序；tag 先 grep；页名在起草清单时定。 — 理由：第 3 期裁决 P3、P4 与复盘。 — 代价：缺。可核的后果：M6 46 个程序 25–42 行，43 个短于 40（账本 §三.1）。

**P8 · 两个等用户的方向问题照现行规则、不停下**（`boards`「确知不含才去掉」；页面不显示 `run.expect`）。 — 理由：非方向性决策不停下。 — 代价：面板对某考纲显示它不考的内容（账本 §三.2 的表）。

**P9 · 起草清单时，对每个带 property 的程序用一个错误实现跑一下，证明 cases 真能触发它声称要测的分支**（简报 §3，第 3 期 2048 示例的复盘）。
— 代价：缺。可核的后果：两份原型都进了台账（`m6a-ledger/draft-proto.py`、`m6b-ledger/draft-proto.py`）；m6a 的原型报出两个低触发（`above-threshold` 36/200、`median` 61/200）；
**m6b 的原型在清单阶段就发现了门只比顶层类型**（→ P22 / #192）。本收尾把原型写成了 `python-content-wave` 第 1 步的骨架。

### 清单审批 · m6a（清单提交 `4939cf9`，裁决记在规格 §8 的 M6A-D1…D9，提交 `439c8fe`）

**P10 · 本期不开跨页变体组（M6A-D1）**；均值方差只在 ch24 成组（`mean-variance`），statistics 不再写。
— 理由（原话）：全库还没有，页面只列本页程序，跨页组的显示没人验过，不在内容波里首用。 — 代价：缺。

**P11 · `matrix-product-matmul` 单独成题、不并入 ch10 的 `matrix-multiply` 组（M6A-D3）**，讲解点一句「循环写法见「列表」页」。 — 理由：同 P10（会成为全库第一个跨页组）。 — 代价：缺。

**P12 · `normal-probabilities` 的 `requires` 按实际 import 写（M6A-D4）**：经验对照用 `rng.normal`，就是 `["numpy"]`，property 入口本身保持纯标准库。 — 理由：`requires` 决定底栏的 `pip install` 提示与所在的层。 — 代价：缺。

**P13 · cases 的两条附加约束（M6A-D5）**：`pearson-*` / `regression-*` 的 x、y 都不是常数列，`cosine` 排除零向量（否则出 nan，`nan != nan` 门红得与程序无关）；
6 位舍入的 `normal-between`、`z-test`：辛普森步数取到误差远小于 1e-7，报告写出步数与 200 组上的最大绝对误差，撞上舍入边界就改 cases、不放宽位数。
— 代价：缺。可核的后果：py-statistics 构建者报每单位宽 200 步，200 组最大绝对误差 3.8e-12。

**P14 · M6A-D2（边界 3.2 / 3.4 / 3.5 / 3.6）、D6（递归）同意；`boards` 照现行规则四家全写，§7 的表原样进台账、收尾时并入第 4 期账本（D7）；新 tag 统一单数 `array`，存量 `arrays` 不动（D8）；组名与 m6b 的交叉核由 Python编程 做（D9）。**
— 代价：缺。D7 的表见账本 §三.2；D8 的存量见账本 §三.7。

### 清单审批 · m6b（批准的清单 `294f810`，裁决记在规格 §10，提交 `d20981d`）

**P15 · 页名「pandas 数据表」/ pandas DataFrames、「matplotlib 画图」/ Plotting with matplotlib；B1、B3、B6 确认；B2 确认不与 m6a 重（`sampling-distribution-of-mean` 讲均值的抽样分布、不画图，`histogram-bins` 只讲分箱与边界规则）；
B5：numpy 标量 repr 由 m6a 的 `numpy-scalar-repr` 专讲，`series-and-dataframe` 那句写「详见「NumPy 基础」页」。** — 理由：一个知识点只在一页讲；页名第 3 期起在清单里就定。 — 代价：缺。

**P16 · B4：`grade-bands-cut` 不做**（清单推荐）。 — 理由（清单）：同一个「分等级」问题 ch06 已有两种写法，免得几页各写一遍。 — 代价（m6b 台账裁决 4）：少一个 `pd.cut` 例子。

**P17 · 入口返回值不许含 NaN，会产生缺失的入口转成 `None` 再返回，参照同样用 `None`，讲解点一句为什么。**
— 理由（原话）：`nan != nan`，门会红得与程序无关。 — 代价：缺。可核的后果：终审 I3 抓到 `missing-fill-mean` 全缺时仍返回 `[nan, nan]`——refs 的生成器避开了全缺，门看不见；修复照这条改了入口（m6b 裁决 9）。

**P18 · 组名交叉核**：m6b 的 `filter-rows` / `group-average` / `line-plot` 与 m6a 的 `mean-variance` / `linear-system` / `pearson-r` / `line-of-best-fit`、与全库都不撞。
— 代价：缺。可核的事实：今天全库 244 个 `problem`，58 个多变体组，7 个新组各自只在本章。

**P19 · 时序：两波的构建者等两件事进 main 再派——门 PR（#192）与第 3 期收尾 PR（#193）；合并后 merge origin/main、从 `$W` 用 Read 重读 skill 与模板。**
— 理由：新门逐层比类型、新模板改了报告路径。 — 代价：缺。可核的后果：m6a 合 `51c0832` → `c87acfe`、m6b 合 → `bbcb69d` 之后才派构建者；两波 5 个构建者 0 个 BLOCKED。

### 门

**P20 · #191：scipy-stack 层的开工前提**（CI 装钉版本的库、`PYTHON_GATES_REQUIRE_SCIPY=1` 缺库即红、`algorithm_property_check` 覆盖这一层；主规格 §5.4 三条补充）。
— 理由（#191 描述）：CI 若也缺库，这些程序在任何地方都没跑过，门照样全绿——跳过只打印一行，没人看。
— 负控制（#191 描述，临时章注入 `iter_programs`、不碰仓库文件，全部断言红、无崩溃）：`requires scipy`（本机缺）非严格两门绿各报 1 段跳过、严格两门具名红；numpy 程序 + property 两边都绿（计数 173 → 174）；
入口加 `+ (1 if len(xs) > 3 else 0)` property 红；`run.expect` 改一字 run 门红。 — 代价：缺。

**P21 · #191 的注释补一条非显然的事实**：CI 装完库先 `import matplotlib.pyplot` 一次——全新 runner 上第一次 import 要建字体缓存（可达数秒），否则第一个 matplotlib 程序会撞 `program_run_check` 的 5 秒超时（`registry-sync.yml:114-115`）。
这不是裁决，记在这里是因为它只写在 workflow 注释里。

**P22 · #192：property 门逐层比类型（`_deep_mismatch`：list / tuple 按位置、dict 按键含键类型、set 比元素类型，叶子比 type 与值）。**
— 起因：m6b 起草原型时实测 `library.py:379`（当时）只比顶层——`[np.int64(3), np.int64(4)]` 对 `[3, 4]` 判相同（清单 §7 上报）。M6 最常见的错正落在这里。
— 负控制（台账原文）：旧门（origin/main 的 scripts 与 programs 解包到 scratchpad）三种变异全绿；新门三种都断言红；正确实现两边绿；存量 173 个 P 新门下全绿。
**第一次跑旧门四种全红——只解包了 scripts、没有 programs，红得没有理由；补齐后重跑。**（账本 §五 与本文件 §四 把它记为一次被当场发现的无效测量。）
— 代价（m6b 台账裁决 2）：判错的话 numpy 标量漏进返回值无人报。可核的后果：#194 合并前的自选负控制 `round(float(p), 9)` → `round(p, 9)` 只被新门抓到（P27）。

### 集成期

**P23 · 第 3 期收尾（#193）**：评审（`dee5560`）With fixes，4 Important + 7 Minor，全是文档；修复 `7c3cb75` → 范围复审 No（R1：scipy-stack 随机规则写窄了）→
Python编程 自己改 R1 与 m-a / m-b / m-d、把 #192 写回 → `b03a8a4`。 — 理由：一次修复 + 一次复审之后的残项只改文字（与本收尾写进 skill 第 5 步的做法相同）。 — 代价：缺。

**P24 · 对 m6b 第 2 次回报（`5448b00`，282 程序 / 25 工具）的裁决**（台账原文）：
① 清单错：`sort_values` 多列不读 `kind`（`lexsort_indexer`）——构建者对（控制方核源码属实）；② 删多余的 `float()`——同意；
③ `histogram-bins` 的入口用 `np.histogram`——接受，条件：演示块真的调用 `ax.hist` 并用它返回的 counts / edges 打印，讲解点一句两者的关系与入口为何用后者；
④ 不放 `plt.show()`——接受（Agg 下警告进 stderr、PyCharm 里阻塞），讲解说明想在窗口看就在末尾加；演示数据补一个 100——好；
⑤ m6a 页名「NumPy 基础」/ NumPy Basics、「线性代数与随机数」/ Linear Algebra & Random Numbers、「统计入门」/ Statistics，**讲解用「」**（**英文部分已被收尾裁决 P28 推翻**：英文写 `the <英文页名> page`）；
⑥ tag 两波拼法一致、与全库无分裂，库名 tag 小写；⑦ `boards` 18 个全拿不准，留给用户。
— 代价：缺。可核的后果：条件 ③ 的「讲清入口为何用 np.histogram」到修复时才补上（修复者发现原本不成立）；⑤ 的「讲解用「」」使 m6b 的英文讲解用「」括页名，与 m6a 修复（V7）统一成的 `the X page` 相反——两波的英文跨页写法因此分叉（账本 §三.6）。

**P25 · 评审 / 复审 / 修复者的临时文件改用方案 ①：放 scratchpad（带波名前缀），只把报告写进台账。** 取代 #193 写回的「放台账下 `review-tmp/`，删不掉留给控制方统一删」。
— 理由（复盘 15）：m6b 的评审、复审、修复与控制方的 `rm -rf` 都被权限拒，`review-tmp/` 38 项（22 MB）留在集成 worktree 里；删 worktree 等于绕过那次拒绝，于是集成 worktree 与分支删不掉——一个死结。
方案 ② 是「skill 明写 review-tmp 由第 7 步 `git worktree remove` 一并清掉、事先取得用户认可」，没选。
— 代价：缺。**本收尾起草时核出一处前提不成立**：复盘 15 说 scratchpad「写得进也删得掉」，本收尾在 scratchpad 里 `rm -rf` 一个自建的目录同样被权限拒（没有换命令绕），scratchpad 里还躺着前两次收尾（`p2close-*` / `p3close-*`）的 77 个条目，其中 12 个目录是克隆与导出副本。
方案 ① 仍然解开了死结——临时文件在仓库目录树外，不挡 `git worktree remove`、不会被拷进台账——但它成立的理由是「不必删」，不是「删得掉」。skill 按这个理由写（账本 §五.3）。

**P26 · m6b 的集成 worktree 与本地分支控制方不代删**（`review-tmp/` 的 `rm -rf` 被拒之后）。
— 理由（原话）：删 worktree 等于绕过拒绝；控制方代删是跨会话的权限洗白。 — 代价（m6b 台账裁决 12）：留下一个目录（实测 22 MB）待用户处理。
**已处理：用户于收尾当天亲手删除了 `.claude/worktrees/python-wave-m6b` 与本地分支 `claude/python-wave-m6b`（`9a9101c`）**（控制方台账末条）。成因留作复盘事实，解法是 P25。

### 合并

**P27 · 五个 PR 的合并前核验（全部出自 `controller-log.md`；CI run、head、合并提交与时间本收尾用 `gh` 逐个复核过）。**
合并顺序：#191 → #192 → #193 → #194（m6a）→ #195（m6b）。门与收尾先于两波内容；#194 先开先合，#195 在合并前用配方脚本（`--take MERGE_HEAD --from HEAD`，rc = 0）合进了 `5bae885` → `9a9101c`。每个都用 `--match-head-commit` 合并。

| PR | head | CI run（全部 success） | 开 → 合（UTC） | 合并提交 | 范围 | 本地全量 / CI 读到的 | 控制方自选负控制 |
|---|---|---|---|---|---|---|---|
| #191 | `4fda1c5` | 36708785499 | 11:28 → 11:40 | `4b13c49` | 3 文件 +65 / −6 | 日志 `scipy-stack 2.3.1 2.3.0 3.10.3`；gates 步骤 env 含 `PYTHON_GATES_REQUIRE_SCIPY: 1`、`MPLBACKEND: Agg`；264 段 0 跳过；41 道门 | 见 P20（PR 作者即控制方，负控制在 PR 描述里） |
| #192 | `9675ede` | 36710840809 | 11:48 → 11:55 | `6070c38` | 2 文件 +51 / −6 | 钉版本行、严格 env、264 段 0 跳过、173 property、41 道门 | 见 P22 |
| #193 | `b03a8a4` | 36711775101 | 11:57 → 12:01 | `51c0832` | 9 文件 +672 / −25 | 钉版本行、264 段 0 跳过、41 道门、导航契约 125 | —（文档） |
| #194 m6a | `2687413`（= origin 分支头） | 36718331335 | 12:58 → 13:01 | `5bae885` | 41 文件 +18114 / −0：只有 m6a 三章、三页、三 refs、注册表与两导航页、清单 | 在 `2687413` 的 detached worktree（verify-194）上严格全量：41 道门、292 段 0 跳过、195 property、导航 128、品牌 137、根注册表、画廊背景 4；CI：CPython 3.12.14、同上 | `markov-weather`（串行、内存复原、字节断言、复原后复绿）：`matrix_power(P, n)` → `(P.T, n)` 断言红（`[0.5, 0.5]` 对 `[0.666656494, 0.333343506]`）；`round(float(p), 9)` → `round(p, 9)` 断言红「返回值[0]：类型 numpy.float64 ≠ builtins.float」——**#192 之前的门会放行这一条** |
| #195 m6b | `9a9101c`（含 main `5bae885`） | 36719234102 | 13:06 → 13:09 | `2349e0f` | 29 文件 +11872 / −0，注册表与导航页 0 行删除 | verify-195 严格全量：41 道门、310 段 0 跳过、203 property、fixture 9 处、导航 130、品牌 139、根注册表、画廊背景 4；`pupils.csv` 被 git 跟踪；CI 同上 | `merge-left-join` `int(score)` → `score` 断言红「返回值[2][2]：float ≠ int」（#192 前放行）；`filter-query` `>=` → `>` 断言红（长度 1 ≠ 2）；复原后 property 复绿 |

— 理由：第 3 期裁决 §四「期控制方的合并核验写进台账」；skill 第 7 步「在 PR head 上自己跑一遍、外加一个不是作者做过的负控制」。 — 代价：缺。
本收尾复核：五个 run 的 `headSha` 与上表 head 相同、conclusion 都是 success；#194 / #195 的日志里 `程序真跑：292 / 310 段 … 0 段因缺库跳过`、`性质比对：195 / 203 个程序`、`41 道门全绿`、导航契约 128 / 130 项。

### 收尾

**P28 · 英文讲解里指别的页，写 `the <注册表英文页名> page`，不加引号、不夹「」；中文照旧写「页名」。存量留账。**
— 出处：控制方 Python编程，收尾当天（`controller-log.md` 末几条：裁决收尾起草者的偏离）。推翻 P24 ⑤ 里「讲解用「」」的英文部分；与 m6a V7 / V9 的做法一致。
— 理由：「中文里用「」括页名是中文标点；英文正文里夹「」读者会当成乱码或引号错误，英文的惯例是 the X page。第 4 期结束时两种写法 37 对 36 几乎对半，不定下来每一波都会各写各的；取 V9 量到的存量多数与英文惯例一致的那种。」（决定见 controller-log；原话见控制方给收尾范围复审的派发。）
（注意：m6b 终审 M3 报的是另一件事——英文引用**程序变体标题**时没有「」、读起来像一句断掉的英文；程序标题的写法不在这条裁决里。）
— 代价：存量 ch20 11 段、ch23 10 段、ch26 9 段、ch27 6 段英文用「」（其中也有程序标题），ch02 三处写成 `the Files and Errors page`（注册表是 Files & Exceptions）——改要给这几页升版，留账（账本 §三.6）。
英文里指别的**程序**（变体标题）怎么写不在这条里，由每波的共有约定表定。已写进 `python-drill-tool`、`final-review-brief.md`、`builder-brief.md` 与 `python-content-wave` 第 2 步；第 5 期两个会话已按这条接到通知。

---

## 二、m6a 控制方（MDev-01，#194）

台账（`m6a-ledger/progress.md`）里有编号的裁决是 V1–V8；**V9 确有其事，只在 MDev-01 第 3 次回报给 Python编程 的消息里，没有进台账**（`grep -rn V9 m6a-ledger/` 只命中第 7 步「V1–V9 全部接受」那一句）。
本收尾起草时据此把 V9 写成了「误记」，是错的——是**台账不全**（控制方收尾当天确认；第 3 期裁决 §四「裁决要进台账」这一条这次在模块控制方那里漏了一条）。

**V1 · 程序短于 40 行接受（basics 9 个，29–42 行，合计 307，其中 8 个短于 40；linalg、statistics 全部短于 40，「同 V1」）。** — 理由：宁少勿凑——每个程序只做清单那一格。 — 代价：缺。终审 m9 同意。

**V2 · `broadcasting-table` 挖 `except` 头 + 一行体的两行空：暂接受、交终审核。** — 理由：判定器行为与 `if` / `for` 例外相同。 — 代价：缺。
终审 m8 实测后接受（体缩进错判 `indent`、写成一行判对、`as err` 与写死字符串被第 1 级钉住），建议把 `except` 列进作者须知的例外条款——本收尾已写进。

**V3 · `eigen-2x2` 入口用 `eigvalsh`、演示用 `eigh`。** — 理由：避免换名照抄空。 — 代价：缺。

**V4 · `markov-weather` 的转移矩阵改成 `[[0.75, 0.25], [0.5, 0.5]]`。** — 理由：1/4 的倍数在二进制里精确，避免第 9 位两边各舍一边；是对清单 §2.2「晴 / 雨」的数值调整，教的不变。 — 代价：缺。

**V5 · `median` 两边不 `round`。** — 理由：整数 cases、中位数在 float 上精确；写在 refs 文件头。 — 代价：缺。

**V6 · 标准差 / 相关系数 / 回归的参照改用整数 / `Fraction` 的精确一遍式。** — 理由：同一公式的浮点逐项求和等于共享机制；比清单更对。 — 代价：缺。终审同意（「比清单写的更远」）。

**V7 · 终审后的修复范围 = I1、I2、m1–m6；m7–m9 接受现状；m10 上报 Python编程；m5 的英文跨页写法照全库存量惯例（`the Lists page` 式，不带引号、不夹中文「」）统一。**
— 理由：台账只记决定；英文跨页写法那一半的理由见 V9（全库多数惯例）。 — 代价：缺。可核的后果：m6a 三页英文里 0 处「」；当时与 m6b 的做法相反（P24 ⑤），收尾裁决 P28 定为这一边。

**V8 · 范围复审的 I-A（「NumPy 2 起单参数 round 返回 int」实为 1.19 起，gh-15840）与 m-A 由控制方直接改（去掉版本限定，四句），不再复审** → `2687413`；ch24 那句「`np.float64(1.5)` 这种显示是 NumPy 2 起的样子」是对的、保留。
— 理由：只改提示与讲解文字。 — 代价：缺。可核的事实：`2687413` 之后严格模式 41 道门、292 段 0 跳过；#194 合并前 Python编程 在它上面另做了全量与自选负控制（P27）。

**V9 · m5 英文跨页写法取全库多数惯例（`the X page`，不带引号、不夹「」）· 存量 35 处 · ch20 / ch23 存量的「」写法留账。**（原文照录；出处：MDev-01 第 3 次回报的消息，**m6a-ledger 里没有这一条**）
— 理由（原文）：全库多数惯例。 — 代价：缺。
**数字对不上，照录两边的口径、不抹平**：V9 写「存量 35 处」，口径不详。本收尾在 `2349e0f` 上用 `the [A-Z][\w &]+ page` 扫英文 notes / blurb / lineNotes：全库 37 段，减去 m6a 新增的 8 段（ch24 4、ch25 2、ch28 2）是**存量 29 段**；
同一模式扫 ch01–ch23 的 `hintEn` 是 0 处。收尾评审数的是**出现次数**得 **30 处**：多出的那 1 处在 `ch19-complexity/merge-vs-insertion-counts` 的 `notes.en[0]`，同一段里有 `the Sorting page` 与 `the Recursion page` 两处（本收尾按段数得 29；评审的扫描里 `hintEn` 也是 0）。三个数都是「`the X page` 写法的存量」，差别只在数段还是数次。

**未编号、但台账里写着的决定**：
- 三个构建者都是 `DONE_WITH_CONCERNS`，原分支与 worktree 逐个记进台账，第 7 步按台账清理（worktree remove 集成 + 3 个构建者 worktree，删 7 个分支前逐个 `is-ancestor`，删 origin 的集成分支，`worktree prune`）。
- `pearson-corrcoef` / `regression-polyfit` 的空与演示块一行只差实参名、`round(np.float64)` 在 numpy 2 返回 `int` 而判定器只认 `int(round(d))`（第 1 级已钉）、全波 tag 统一——都交终审定；终审把前者定为「按定义不算照抄空」（m7，另扫出同类 5 处，共 7 处）、后者定为挖法接受（m6）、tag 分裂定为 I2。
- 亲验负控制三个都是断言红：`mean-variance-vectorised` `** 2` → `** 1`、`transform-2d-points` `pts @ R.T` → `pts @ R`、`population-vs-sample-sd` `ddof=1` → `ddof=0`。
- 浏览器字面量检查三页都是 0 次（没有 ≥ 3 字符的字符串空）→ 照 skill 改做全空各改一字符（basics 52 / linalg 50 / statistics 60 次，0 判对、0 印出答案、0 空消息）加合成对照。这一步的探针 `m6aAllBlanks` 已并进本收尾的 `probe.js`。

---

## 三、m6b 控制方（MDev-02，#195）

m6b 台账末尾的裁决清单共 **13 条**，三栏原文照录：

1. **起草时对 8 个 P 核心 + 1 个候选做原型（正确 / 纯 Python 参照 / 错误实现 / cases，逐层比类型）** — 理由：期级简报要求，且能提前看出类型坑。 — 代价：清单里的 P 触不到声称要测的分支。
2. **发现并上报门只比顶层类型（`[np.int64]` 对 `[int]` 判相同）** — 理由：M6 最常见的错正落在这里。 — 代价：numpy 标量漏进返回值无人报（已由 #192 修）。
3. **页名在清单里就定：「pandas 数据表」/ pandas DataFrames、「matplotlib 画图」/ Plotting with matplotlib** — 理由：第 3 期改名只能另开提交。 — 代价：与别的页混名。
4. **B4 推荐不做 `grade-bands-cut`（获批）** — 理由：同一题已在两页各写过。 — 代价：少一个 `pd.cut` 例子。
5. **派构建者前合 main（#192、#193）、从 `$W` 用 Read 重读 skill 与模板** — 理由：Skill 工具读主工作区旧版。 — 代价：照旧模板派发、报告路径被拒。
6. **接受 pandas 构建者对 `sort_values` 多列不读 `kind` 的纠正（控制方核源码）** — 理由：构建者对、清单错。 — 代价：教一个无效参数。
7. **接受删多余 `float()`（构建者发现是等价程序）** — 理由：讲一个不需要的转换会误导。 — 代价：无。
8. **浏览器探针改为向前找可见字符并报字宽（上一波只修了一次性测量）** — 理由：换行符矩形退化会给假阴。 — 代价：对齐没量却报通过。
9. **I3 接受修复者走 §10 方案 (b)（全缺返回 `None`、生成器造全缺）而非评审推荐的 (a)** — 理由：(a) 只改讲解、入口仍违反 §10 且门看不见。 — 代价：多改一行程序与 `run.expect`。
10. **范围复审的 I-a（cell 空第 1 级等于整行）由控制方照复审给的文字落地、判定器实测，不开第二轮修复** — 理由：只是两句提示文字。 — 代价：新提示仍有漏钉——判定器表已核。
11. **m2（两种冷门关键字写法未钉）留账** — 理由：一次修复 + 一次复审。 — 代价：学生写出 `np.histogram(a=…)` 被判错时无提示。
12. **`review-tmp/` 删不掉就不绕（包括不删集成 worktree）** — 理由：两次 `rm -rf` 都被权限拒。 — 代价：留下一个 ~几 MB 的目录待用户处理。（实测 22 MB、38 项；用户已于收尾当天删除，见 P26。）
13. **`boards` 18 个四纲全写（Python编程 裁决）** — 理由：现行规则确知不含才去掉。 — 代价：面板对某考纲显示它不考的内容。

**未编号、但台账里写着的决定**：
- 构建者的 5 条偏离全部接受（终审逐条判定）：`histogram-bins` 入口用 `np.histogram`（门调用 200 次）、不放 `plt.show()`、多列排序不带 `kind`（改在单列上讲 `kind="stable"`）、删多余 `float()`、演示数据用 `rng.integers` 并补一个 100。
- **更正（终审 M6）**：py-pandas 报告与台账原写「稳定性只靠参照 `sorted` 与演示 `ranked(ROWS[::-1])` 守」——不成立，排序前 `df = df.iloc[::-1]` 是只破坏稳定性、保证终止的变异，property 门在 narrow 分支上断言红。
- 修复者两处超范围修改接受：`plot-from-dataframe` 讲解「to_string 配 index=False」等于泄漏最后一级提示 → 改；`histogram-bins` 讲解补「入口为何用 np.histogram」（P24 条件 ③ 原本不成立）。
- 范围复审 m1（`name-index` 同结构）与 I-a 同批改；m3（`histogram-bins` 讲解补 `plt.show()` 一句）改。
- 集成顺序 py-pandas → py-matplotlib（后者走配方脚本 rc = 0）；合 origin/main（m6a #194）用配方脚本 `--take MERGE_HEAD --from HEAD` rc = 0 → `9a9101c`，注册表顺序 m6a 三页之后接 m6b 两页；页名交叉引用对 m6a 注册表逐一对上。
- 台账拷贝排除 `review-tmp/`（`rsync` 排除、`diff -rq -x review-tmp` 一致）；两个构建者 worktree 与四个构建者 / 原分支删前都核了 ancestor。

---

## 四、失误与「简报有错」

### 控制方的失误（三个控制方合计；没有一条造成合进 main 的错误）

- **清单写错第三方库的参数语义**：m6b 清单把 `kind="stable"` 写在多列 `sort_values` 上——多列走 `lexsort_indexer`、根本不读 `kind`（pandas 2.3.0 源码与文档「only applied when sorting on a single column」）；清单「`.mean()` 返回 numpy 标量、打印前 `float()`」只对单个值成立。
  两处都是构建者发现的。复盘 16：清单涉及第三方库参数语义的，起草时用 `inspect.getsource` / `__doc__` / 官方文档核一句——本收尾写进了 `python-content-wave` 第 1 步。
- **一句错的版本说法走了三手**：m6a 终审 m6 **建议**讲解补「numpy 2 起 round(np.float64) 已经是 int」，修复者照写进 ch25（并在 ch24 写「在 NumPy 2 里」），范围复审查 NumPy 1.19.0 release notes（gh-15840）才指出是 1.19 起。
  评审建议的原文也要核（复盘 6）——本收尾把「写『从某版本起』要查过 release notes，否则不写版本」写进了 `python-drill-tool`。
- **无效的测量**：Python编程 给 #192 做旧门负控制，第一次只解包了 scripts、没解包 programs，四种全红、红得没有理由——当场发现、补齐重跑；m6b 控制方的对齐探针**又**量到了换行符（第 3 期修的是那一次测量、没修探针）——当场改成向前找可见字符。
  后者的根治是本收尾的标准件 `probe.js`。
- **#193 写回的 `review-tmp/` 方案在第一次使用时就成了死结**（P25、P26）：它假设「删不掉就留给控制方统一删」，而 m6b 的控制方同样删不掉；m6a 那一波控制方却删掉了——权限结果不稳定，不能写进流程当前提。
- **两波对英文跨页写法的裁决相反**：m6a V7 统一成 `the X page`、去掉英文里的「」；Python编程 告诉 m6b「讲解用「」」，m6b 终审 M3 又要求英文变体标题加「」。全库英文一度 `the X page` 37 段、「」括英文页名或标题 36 段（账本 §三.6）。没有人在两波之间核这一条——收尾当天控制方裁决 P28 定为 `the <英文页名> page`，本收尾把它写进了 skill；「本波共有约定表」（`python-content-wave` 第 2 步）只管 tag 与程序标题的写法。
- **文书**：m6a 的 V9 只在回报消息里、没进台账——台账不全（§二开头；本收尾初稿把它写成了「误记」，也是一处文书错误）；m6a PR 描述写「5 处近照抄」，终审 m7 列的是 7 处；m6b 复盘条目 22 与台账写「m6b 程序 24–41 行」，24 是修复前的 `missing-fill-mean`（修复加了 3 行，今天 25–41）；
  m6a 的 `git-size-before.txt` 又没记测量时点（第 3 期账本 §四.11 同一件事）。

### 子代理上报「简报 / 清单有错」

两波共 5 个构建者、2 次终审、2 轮修复、2 次范围复审，另有 m6b 起草者（MDev-02 自己）。经复核**成立**的：

- 门只比顶层类型（m6b 起草原型）——#192（P22）。
- `sort_values` 多列不读 `kind`、多余的 `float()`（py-pandas 构建者）——m6b 裁决 6、7。
- 不放 `plt.show()`（py-matplotlib 构建者：Agg 下警告进 stderr、PyCharm 里阻塞）——偏离简报的「可以放」，接受（P24 ④）。
- `markov-weather` 的矩阵改成 1/4 的倍数（py-numpy-linalg 构建者）——V4；参照改用 `Fraction` 一遍式（py-statistics 构建者）——V6。
- 作者须知「选择器按 tag 筛」与代码不符（m6a 终审 m10）：`python/core/interact.js:278-296` 的 `filterPrograms` 只按 level / kind / boards / lines 筛，tag 只在面板上显示——本收尾改了作者须知的措辞。
- 「NumPy 2 起」应为 1.19 起（m6a 范围复审 I-A）——V8。
- 台账「稳定性只靠参照与演示守」不对（m6b 终审 M6）——已更正。
- I3 走 (b) 而不是评审推荐的 (a)（m6b 修复者）——m6b 裁决 9。
- `subplots-grid` 的 cell 空第 1 级等于整行、Python编程 的条件 ③ 只在页面层面成立（m6b 范围复审 I-a、m3）——控制方落地（m6b 裁决 10）。

报成疑点、复核为**等价程序**的：`det_int` 的 `int(round(d))` → `round(d)`（m6a 终审 M4）、`merge-left-join` 的 `int(score)` → `round(score)` 与 `sort-two-keys` 多列加 `kind="stable"`（m6b 终审），见账本 §四.1。
没有一条被判为「上报者错了」而驳回。
