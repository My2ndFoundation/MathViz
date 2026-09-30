# Python 子项目 · 第 3 期的裁决

> 这些是控制方在**没有人类在场时**替你做的决定。每一条记着：
> **决定了什么 · 为什么 · 如果判错了代价是什么**。读它，把判错的地方推翻。
>
> 规格：`docs/superpowers/specs/2026-09-30-python-phase3-m5a-design.md`（§8）、`-m5b-design.md`（§8）
> 账本：`docs/superpowers/handoffs/2026-09-30-python-phase3-deferred.md`
> PR：#187（fixture 门）· #188（门 `compile` 加 `dont_inherit=True`）· #189（m5b）· #190（m5a）

**第 3 期有三个控制方。** 会话「Python编程」写派发简报、审两波的清单、修门（#188）、集中合并；MDev-01 做 m5a（先做 fixture 门 #187），MDev-02 做 m5b，两波并行。
下面 §一 是 Python编程 的，§二、§三 是两个模块控制方各自的。

**来源与缺口。** 两波台账都活下来了（主工作区 `.superpowers/python-phase3/m5a-ledger/`、`m5b-ledger/`，gitignored），§二、§三 从台账原文整理，编号照台账原样。
m5b 台账末尾有一张「决定 · 理由 · 判错的代价」三栏齐全的裁决清单；m5a 台账的裁决散在各步里（V1–V4 有编号，其余没有），理由多数有原话、代价多数没写。
**Python编程 这一期有了派发简报**（`.superpowers/python-phase3/phase3-brief.md`），期初的裁决带理由；审批与集成期的裁决只出现在两份清单规格的 §8、两个模块控制方台账里转录的「Python编程：…」
和 PR 描述里——所以 §一 的**判错代价大多没人写过，如实标「缺」**。第 2 期裁决文件说「下一期 Python编程 若继续做这个角色，裁决也要进台账」，这一期部分做到（期初有简报，期中没有台账）。
期中没有台账的代价，这一期就有一个实例：Python编程 合并 #189 之前做的核验与负控制（P26）只在它自己的会话里，收尾起草时从任何台账文件都找不到，差点被记成「缺记录」。

用户在对话里拍板的决定不在这里：把清单审批、裁决与集中合并委托给 Python编程、「带『推荐』的选项直接选，只有影响整个系统方向的决策才停下问」（简报开头）。
`boards` 语义、页面是否显示 `run.expect`、`core.hooksPath` 三件仍等你裁决；**新增第四件**：主工作区（停在 `533c813`）要不要 fast-forward 到 main，
或者在用户级记忆里给 `python-content-wave` / `python-drill-tool` 放一句「用 Read 读集成 worktree 里的版本」的指路——Skill 工具读的是主工作区，本收尾写回 skill 的修正在它前进之前到不了用 Skill 工具的读者（账本 §四.1、§四.10）。

---

## 一、Python编程（期控制方）

### 期初（派发简报 §2、§3，2026-09-30）

**P1 · 随机数：允许，但只有一种写法。** 只用 `rng = random.Random(<固定种子>)` 这个实例（或把 `rng` / `seed` 当实参传进函数）；不用模块级 `random.random()` / `random.choice()` 等，不读时间。
每个用到随机的程序，构建者在 CPython 3.9.6（`/usr/bin/python3`）与 3.12.x 上各跑一次、stdout 逐字节比对，写进报告。带 property 的随机程序：入口收 `seed` 或 `rng`，参照用同一种子的独立实现，或只比统计性质。
— 理由（简报原话）：蒙特卡洛、随机游走、排队模拟、扫雷布雷、猜数都离不开随机；控制方实测 `random.Random(20260930)` 的 `random / randint / randrange / choice / shuffle / sample / uniform / gauss / choices` 在 3.9.6 与 3.12.9 上逐项相同。
— 代价：缺。可核的后果：m5b 10 个程序用随机，控制方独立复跑 24 / 24 在两个解释器上 stdout 相同（带负控制：版本相关程序两边不同）；本收尾重扫模块级 `random.*` 调用 0、读时间 0。
它推翻了作者须知原来的「输出确定：不用 `random`」——本收尾已改 `python-drill-tool` 的内容标准，并把它限定到 stdlib 层（`runtime: cpython` 且 `requires` 为空）；scipy-stack 层另有裁决，见 P27。

**P2 · 交互程序用 `run.stdin`**：`input()` 的提示语进 stdout、不换行，讲解与提示照「页面不显示输出」写。 — 理由：井字棋、猜数、Hangman、输入校验要读输入。 — 代价：缺。

**P3 · 程序长度取向放宽到约 60 行，本期仍不用 `chunks`；超过 60 行的写进报告。**
— 理由（简报）：M5 是综合运用，程序会长；`chunks` 分支从未被真实数据走过，第一次用它值得单独一个 PR 带负控制。
— 代价：缺。可核的后果：5 个程序超过 60 行，`library-loans` 86 行会被选择器「不超过 80 行」筛掉（账本 §二.1）。

**P4 · 页面边界**：本模块**用**前四个模块讲过的一切、讲解只点出「这里用的是 X」；**讲**正则入门、`json`、文本清洗、简易解析器、模拟与状态机式的游戏循环、多个类协作的小系统；
CSV 的 `split` / `csv` 读法 ch05 已讲，`py-text-data` 不重复。 — 理由：一个知识点只在一页讲。 — 代价：缺。

**P5 · 两个等用户的方向问题照现行规则、不停下**：`boards`「确知不含才去掉」；页面不显示 `run.expect`。 — 理由：非方向性决策不停下（用户授权）。 — 代价：面板可能对某考纲显示它不考的内容（清单见账本 §二.2）；讲解里不能说「看输出」。

**P6 · fixture 门先行、单独一个 PR，合并后再派 m5a 的构建者**（选第 1 期账本 §一.2 的「推荐做法」：加一道门，不改 core；ch05 若过不了就改讲解、py-files-errors 升 1.0.1）。
— 理由（简报）：第 1 期账本写明「M5 `py-text-data` 落地前必须修」；这样 py-text-data 的构建者从第一天就在门下写。
— 代价：缺。可核的后果：m5a 的构建者在 #187 合并（`c6e1028`）之后才派出，m5a 比 m5b 晚开工。

**P7 · 单个程序的 `problem` 一律用程序 id；变体组名由 Python编程 交叉核对全库与另一波。** — 理由：`variant_check` 按全库分组，重名会静默并组。 — 代价：缺。
可核的后果：m5a 的 3 个组名与 m5b 的 5 个组名互不相同、与全库不重（M5A-D6；m5b 台账第 2 步「Python编程 核」）。

**P8 · `python/scripts/gates/` 只有 MDev-01 的 fixture 门可以改，`CLAUDE.md`、主规格、`handoffs/*`、`core/*`、`.claude/skills/*` 由 Python编程 管。**
— 理由：缺。 — 代价：三处文档因此滞后到本收尾——`python-drill-tool` 那句「手抄目前没有门守一致」（#187 的 PR 描述自己点出、不在它可改之列）、主规格 §7.1 门表缺 `fixture_notes_check`、作者须知的「不用 random」。

### 清单审批 · m5a（规格 §8 的 M5A-D1…D6）

**P9 · §3 边界 3.1–3.8 全部按草案（M5A-D1）**：正则与 JSON 只在 py-text-data 讲；CSV 不重复 ch05；词频与 ch11、银行与 ch04 各讲各的；查找排序只用；`tokenise-*` 只做词法、不求值；
3.8 测试数据放 py-systems，只用 `assert`、不引 `unittest`。 — 理由（M5A-D1 原话）：3.8 是「A-level 系统开发与测试同一章」；其余按草案（草案 §3 的理由是一个知识点只在一页讲）。 — 代价：缺。

**P10 · `test-data-normal-boundary-erroneous`（M5A-D2）**：最终交出的校验函数必须是对的；「故意留的边界 bug」用单独命名的 `buggy_…` 版本演示，测试表在它上面失败、在正确版本上全过；
失败用 try/except 捕获后打印自己的话；挖空不挖在 buggy 版本上；若带 P，只挂在正确版本上。
— 理由：缺（台账只记决定）。 — 代价：缺。可核的后果：`valid-age` 空的答案就是 buggy 版第 6 行把 `<` 改成 `<=`（终审 Minor 5「近似照抄」）；修复按「透明化」处理——第 1 级明说「这是修 bug 的练习」，
于是第 1 级等于定死答案、第 2 级不如第 1 级具体（复审 Minor 3，接受现状，账本 §二.3）。

**P11 · §4 随机本波无（M5A-D3）；§6 fixture 批准（M5A-D4）**：四个 fixture ≤ 8 行、无空行；`students.json` 每行一个对象、不含 `true` / `false` / `null`；讲解照 `fixture_notes_check`「一段一行、连续、按序、写出文件名」抄。
— 理由（草案 §6）：门要求逐行抄，fixture 越长讲解越长，宁短；JSON 缩进在讲解段落里会被去掉首尾空白。 — 代价：缺。
可核的后果：构建者的 `students.json` 首尾两行是外框（`{"group": "12A", "students": [` 与 `]}`），不是「每行一个完整对象」——为了保留「按键与下标一路取到底」的嵌套；构建者申报、终审认可（拼回与文件逐字节相同、`json.loads` 能解析）。

**P12 · `boards` 四家全写，拿不准的汇总上报（M5A-D5）**。 — 理由：现行规则。 — 代价：同 P5。

### 清单审批 · m5b（规格 §8）

**P13 · 边界 B1–B6 全部确认**：B1 有限状态机的概念在 `traffic-light-fsm` 讲，M8 只用在硬件上；B2 概率分布归 M6；B3 猜数做「电脑折半猜」，折半只用不讲、讲解指「查找」一页；
B4 贪吃蛇 / Pong / 打砖块归 M7；B5 不讲积分法则；B6 多个类协作归 py-systems。 — 理由（草案 §1 查重表、§3）：一个知识点只在一页讲；B3 避开 ch07 的 `guess-number-attempts`（她猜固定的秘密数）。 — 代价：缺。

**P14 · §4 递归：`ttt-minimax`「用，不重讲」**（与第 2 期 M3 / M4 的裁决一致）。 — 理由：博弈树搜索即递归，不可换。 — 代价：缺。

**P15 · R2 批准：property 只挂纯核心，随机序列由驱动生成、当实参传进去，`cases` 自己造实参、不经过被测的 rng。**
— 理由（原话）：「随机序列当实参传入，这正是本页该讲的一件事」——把随机与逻辑分开，逻辑才能被检验；参照比的是确定值，不是「同种子的另一份实现」。
— 代价（m5b 台账裁决 2 记）：判错的话，随机程序要么没有 P，要么参照与被测同源。可核的后果：驱动里用 rng 的那一半只由 `run.expect` 守（账本 §二.4）。

**P16 · R3 接受：`shuffle-fisher-yates` 的参照用 `random.Random(同种子).shuffle`**；局限（同一算法：守下标范围与方向、守不住算法本身）写进 refs 注释，并进留账。
— 理由（m5b 台账裁决 3）：两个解释器 × 300 种子 0 处不同，`randrange(i)` 变异 2683 / 3000 不同；草案推荐——它守的正是学生会写错的两处。
— 代价（同上原话）：算法本身错时门看不见，「算法即标准，代价小」。另一个选项（不设 P）没选。

**P17 · R4 照做（两解释器比对）；`sir-epidemic-steps` 的浮点输出打印时 round 或格式化到固定位数；`ttt-minimax` 的 cases k ≥ 3（门每次调用限时 2 秒）。** — 理由：R4 缺；后两条草案里写了——SIR「照 R4 两解释器比对」（规格 §8），k ≥ 3 是为了「控制每组搜索量，满足门的每次调用 2 秒时限」（草案 §6）。 — 代价：缺。

**P18 · 页名一律用注册表里的实际 title（`minesweeper-flood-reveal` 指 BFS 那一页写「图算法」），不自拟；m5b 与 m5a 的组名由 Python编程 交叉核，撞了由 m5a 改。** — 理由：缺。 — 代价：缺。

### 门

**P19 · #187 采纳「一段一行」，偏离简报的「逐行包含」。**
— 决定：`fixture_notes_check` 要求 fixture 的每一行在讲解里**各自成为一段、连续、按原顺序**，并写出文件名（不是简报字面上的「逐行包含」子串）。
— 理由（#187 描述，作者按「我的做法更对」申报）：按子串理解，ch05 原来「行 / 行」的写法对它是绿的；可是 `.py-note` 渲染成 `<p>`、computed `white-space: normal`（浏览器实测），段内换行会塌成空格，学生看到的仍是一行。
— 代价：缺。可核的后果：fixture 必须短（m5a 清单 §1.4、§6 因此定「取向 ≤ 8 行、无空行」）；py-files-errors 升 1.0.1。

**P20 · #188：门的两处 `compile(…)` 加 `dont_inherit=True`。**
— 理由（#188 描述）：`library.py` 顶部的 `from __future__ import annotations` 被继承给被测程序，注解变成字符串，加上 `ns` 的 `__name__` 不在 `sys.modules`，`@dataclass` 在导入时崩——m5a py-systems 构建者发现，`inventory-stock` 因此挂不上 property。
控制方在 3.9.6 与 3.12.9 上复现；负控制：临时给 `point-dataclass` 挂 property，修前导入崩、修后绿、把返回值写错断言红。 — 代价：缺。
**时序**：#188 在两波构建者都交付之后才合并（`732e651`），`inventory-stock` 的参照先注释掉，m5a 合入 #188 后由修复实现者恢复（6 个变异全部断言红）。

### 集成期

**P21 · `.gitignore` 的 fixture 反向规则改成 `!python/programs/*/_fixtures/**` 并继续忽略 `_fixtures` 下的 `.DS_Store` 与 `._*`：批准，并要求负控制。**
— 理由：原规则 `*.log` 静默挡住 `_fixtures/access.log`（门读磁盘、本地全绿、CI 缺文件）；m5a 终审 Minor 10 指出 `*` 只覆盖一层。 — 代价：缺。
负控制由 m5a 控制方在临时仓库里做（旧规则 `git add` 跳过 `probe.log`，新规则暂存它、别处的 `stray.log` 仍忽略）。

**P22 · m5b 终审 I1（`board-move-2048` 的两个空可从未挖的一行删几个记号得到）属「照抄空」一类，要修。**
— 理由：缺（台账只记决定）。 — 代价：缺。本收尾把「近照抄（剥掉一两层括号外壳可得）也算」写进了 `python-drill-tool` 与终审简报。

**P23 · 恢复 `inventory-stock` 的 property**（#188 合入 m5a 之后，由 m5a 修复实现者做）。 — 理由：清单要求它带 P，缺的原因是门缺陷、不是程序。 — 代价：缺。

**P24 · py-games 页名改为「控制台游戏」/ Console Games（m5b 终审 M8）；页 id `py-games` 与章目录 `ch22-games` 不变。**
— 理由（m5b 规格 §8）：本页全是文本界面的游戏，与 M7 pygame 的「图形与游戏」区分。 — 代价：缺。页名改到终审才提，只能另开提交（`7e00d3c`）——本收尾把「页名在起草清单时就定」写进了 `python-content-wave` 第 1 步。

**P25 · 两波的复盘建议（报告路径的退路、第 7 步整目录拷走、isdecimal、`.gitignore` 与 fixture、`dont_inherit`）由 Python编程 收拢成 `retro-items.md`、期末一次写回（即本收尾）。** — 理由：缺。 — 代价：缺。可核的事实：第 3 期内 `.claude/skills/` 没有提交（`git log b0e0a80..83e9eb9 -- .claude/skills` 为空），两波用的一直是 #186 的模板。

### 合并

**P26 · 合并顺序：#187（09:49Z，`c6e1028`）→ #188（10:21Z，`732e651`）→ #189 m5b（10:44Z，`b343d6b`）→ #190 m5a（10:58Z，`83e9eb9`）。**
两道门修复先于两波内容；#189 先于 #190——#189 先开（10:39Z，#190 是 10:55Z），m5a 在开 PR 前用配方脚本（`--take MERGE_HEAD --from HEAD`）合进了 #189，rc = 0。
— 理由：缺。可核的事实：#189 先开先合；m5a 是在 #189 合并之后、开 PR 之前合的 main（台账第 5 步末「Python编程：m5b 已合……开 PR 前合 main 用配方脚本」），所以后合的一方只合了一轮 main。
— 代价：缺。合并前核验：**#190** 独立核了 CI（CPython 3.12.14、41 道门、导航契约 125 项）并做了一个自选负控制（`money-in-pence` 的 `+ 50` → `+ 49`，断言红，m5a 台账第 7 步）；
**#189**：Python编程 独立核了 CI（run 36703782958，CPython 3.12.14、41 道门、导航契约 123）、PR head = origin 分支头 = 6f0452c 且含 #188、diff 范围（python/ 与 m5b 设计，scripts 只新增两个 refs）、页名 控制台游戏 / Console Games；在 6f0452c 上全量验收全绿（21 个工具）；自选负控制 `dice-sum-frequencies` `+= 1`→`= 1`，断言红、无 Traceback、复原复绿；等 m5b 第 3 次回报的范围复审 Yes 后合并。这些只在 Python编程 的会话里，不在任何台账文件。
四个 PR 的 CI 都是 success（run 36698145663 / 36701677382 / 36703782958 / 36705372955）。

### 收尾当天

**P27 · scipy-stack 层（M6）的随机数：numpy 的只许 `rng = np.random.default_rng(<固定种子>)` 实例或把 `rng` 当实参传入；不许 `np.random.seed`、模块级 `np.random.*`、`RandomState`；标准库 `random` 若用，照 P1 只许 `random.Random(<固定种子>)`。**
— 出处：控制方 Python编程 的第 4 期派发简报（主工作区 `.superpowers/python-phase4/phase4-brief.md` §2.2，gitignored），已批准的 m6a 清单 §4 同口径。
— 理由：流不变靠钉住的库版本保证（#191，`4b13c49`：CI 装 `numpy==2.3.1 pandas==2.3.0 matplotlib==3.10.3`，主规格 §5.4 第 1 条「升版本 = 单独 PR、全层 `run.expect` 重生成」）；
P1 的两解释器比对对这一层跑不起来（`/usr/bin/python3` 3.9.6 没有 numpy），所以不适用。主规格的 M6 页清单点名要讲「随机数生成器」（`py-numpy-linalg`）与「分布抽样」（`py-statistics`），照 P1 字面执行就与清单矛盾。
— 代价：缺。本收尾已把 P1 限定到 stdlib 层、把这条写进 `python-drill-tool` 与 `python-content-wave` 的模板。

---

## 二、m5a 控制方（MDev-01，#187、#190）

**V1 · 终审 I1：`date-format-manual` 的 `isdigit()` 改 `isdecimal()`——对清单 §2.1 写法的纠正。**
— 理由：`'²²/12/2024'` 在手工版抛 `ValueError`、正则版返回 `'wrong format'`，两版不一致；与 py-systems 教的「用 isdecimal」正好相反（清单没点名 isdigit 以外的写法，但构建者的第 1 级提示明令「不用 isdecimal」）。
— 代价：缺。修后两版在全部 0x110000 个码位上分歧 0（3.9.6 与 3.12.9）。规格 §2.1 与 §8（M5A-D7）已补记（`b323b1e`）。

**V2 · 修复范围 = I1–I3 + Minor 1–5、7、9 + 恢复 `inventory-stock` 的 P；Minor 6（CIE 术语）顺手加一句；Minor 8（`library-loans` 86 行）保持、留账；Minor 10（`.gitignore` 一层）控制方已修；Minor 11 boards 汇总上报。**
— 理由：缺。 — 代价：缺。

**V3 · 接受修复实现者超范围的一处：`tokenise-loop` 的 `isdigit` → `isdecimal`。**
— 理由：与 I1 同因（`'1+²'` 两版不一致），变体组两版一致是清单要求；refs 的 cases 混入上标数字，门分得清二者（M5A-D8）。 — 代价：缺。

**V4 · 范围复审 Minor 1、2、5 由控制方直接改；CIE 对照改成只列四个术语、不作逐项映射；Minor 3 接受现状；Minor 4 留账交 Python编程。**
— 理由：两方（评审与复审）对 abnormal 的范围说法不一、都未核考纲原文，不教可能错的映射；Minor 2（refs 文件头过时）不改的话，后来的人会删掉唯一的守门分支。
— 代价：缺。可核的后果：CIE 考生从讲解得不到四个术语与本页三类的对应（账本 §二.2）；「参照返回：None」见账本 §三.3。

**未编号、但台账里写着的决定**：

- **构建者的实现选择一并接受、交终审**：`log-line-parser` 的参照 `split(' ')`（不是清单写的 `split()`）；`check_date` 交回三种字符串；`top_words` 交回 `(词, 次数)`；
  `config-parser` 首节之前的键算错误、入口 `parse_or_error`；`students.json` 首尾两行是外框。 — 理由：每个 return 分支的变异都看得见、与被测同一语义。 — 代价：缺。终审认可。
- **`kind: "project"` 首用（py-systems 7 个）；页名「文本与数据 / Text & Data」「小型系统 / Small Systems」**：构建者起草、终审认可、控制方定稿。 — 理由（终审）：`project` 在主规格闭集里，M5 正是为它准备的。 — 代价：缺。
- **三个钉法放在后几级的空交终审**（money 的「加 50」、menu 的连写比较、`.get` 一个实参）：终审把后两个与 bank 的 payer 列为 I2、money 列为 Minor 1，全部挪到第 1 级。
- **第一次亲验负控制选了等价变异**（`competition-ranking` 的 `len(rows) + 1`）——台账记为「是我选错，不是门瞎」，改选密集排名后断言红。
- **fixture-gate 的 worktree 与分支在 #187 合并后删**（先确认 is-ancestor），负控制脚本与 PR 文案拷进 m5a 台账 `fixture-gate/`。
- **集成顺序 py-text-data → py-systems**（后者走配方脚本 rc = 0）；**合 #188 进集成分支**（`2b047db`）；**开 PR 前合 origin/main（#189）用配方脚本**（`--take MERGE_HEAD --from HEAD` rc = 0）。

---

## 三、m5b 控制方（MDev-02，#189）

m5b 台账末尾的裁决清单共 **14 条**，三栏原文照录：

1. **Skill 工具读到主工作区旧版 skill，改从集成 worktree 读 #186 后的版本** — 理由：主工作区不 pull，旧版缺 `checkout -B` 等修正。 — 代价：照旧版派发，构建者第一步全部失败。
2. **property 只挂纯核心、随机序列当实参（R2，已获批）** — 理由：让参照比确定值，而非「同种子另一份实现」。 — 代价：随机程序无 P，或参照与被测同源。
3. **shuffle 参照用 `Random.shuffle`（R3，已获批）** — 理由：实测两个解释器 × 300 种子 0 处不同、`randrange(i)` 变异 2683 / 3000 不同。 — 代价：算法本身错时门看不见（算法即标准，代价小）。
4. **派发前实测 HEAD / merge-base 填进简报（`1b2f3e0` / `b0e0a80`）** — 理由：skill 第 2 步。 — 代价：构建者第一步停下。
5. **py-simulation 构建者报告写不进台账目录，接受它落在 scratchpad、由控制方拷入** — 理由：隔离拒写不是它的错，它没绕过。 — 代价：无（报告内容完整）。
6. **集成顺序 simulation → games；games 走 `resolve-registry-conflict.py`** — 理由：skill 页序与配方。 — 代价：只耗时。
7. **负控制选 life-grid 生存规则与 ttt 反对角线** — 理由：都保证终止、都只动一处可执行代码。 — 代价：无。
8. **浏览器对齐首次量到换行符，改量可见字符复测** — 理由：换行符矩形退化，dx = 0 可能是假阴。 — 代价：把没量当量了。
9. **M4 台账探针没保住 → 本波重写探针，并把整个台账目录（含脚本）拷走** — 理由：草稿区会清空。 — 代价：下一波再重写。
10. **修复实现者的 `halving` → `binary-search` 保留** — 理由：程序确是二分、讲解自己说了；tag 只供筛选，不等于「讲」。 — 代价：「查找」页之外多一个 `binary-search` 标签，筛选时混入。
11. **M5 英文用平实同义句，不用评审的双关** — 理由：中文无双关，中英等义优先。 — 代价：无。
12. **页名改名（M8，Python编程 裁决）由控制方在修复后落地** — 理由：修复实现者已回报、改动机械。 — 代价：漏改某处——`page_mirror_check` / `sync_fallback --check` 已由复审做负控制证明会红。
13. **范围复审 M1（规格 §8 未记页名裁决）当场补记；M2（修复前就有的钉法缺口）留账** — 理由：一次修复 + 一次复审，不开第二轮。 — 代价：学生碰到两处未钉的罕见写法被判错。
14. **boards 四纲全写** — 理由：Python编程 裁决。 — 代价：面板对某考纲显示它不考的内容。

**未编号、但台账里写着的决定**：py-games 构建者把 `merge-row-2048-stack` 讲解的示例从清单的 `[2, 2, 2, 2]` 换成 `[4, 0, 4, 8]`（前者触不到「刚合并」标志）——接受；
py-simulation 构建者的实现选择（pi-random 参照逐点 `isqrt`、pi-grid 用格子中心、`gamblers-ruin` 第三种结局 `unfinished`、排队「最长队」的定义、骰子计数表 13 格列表、SIR 加 `step_one_at_a_time` 对照）——接受；
origin/main 的 #187、#188 各自干净合入集成分支（`43adef6`、`02647a0`）。

---

## 四、失误与「简报有错」

### 控制方的失误（三个控制方合计；没有一条造成合进 main 的错误）

- **无效的测量**：m5a 控制方第一次负控制选了等价变异（`competition-ranking`，门绿）；m5b 控制方第一次对齐测量量到换行符（dx = 0 可能是假阴）。两处都当场发现、重做。
- **文书与推理错误**：#186 写回的构建者模板让报告写进集成 worktree，对 isolation worktree 不成立（4 个构建者里 3 个被拒）；m5a 清单 §2.1 写 `isdigit`、m5b 清单 §6 的 2048 示例触不到它声称要测的标志、
  m5b 清单说 pi-random 的参照「逐列数格点」、m5a 清单说 log 的参照用 `split()`；主规格 §7.1 门表、作者须知两处在门改动后没跟上（到本收尾才改）；
  台账计数与行号几处不准（`two-interp.txt` 的「11」、钉法缺口记在指令行上，见账本 §六）。
- **期控制方的合并核验不进台账**：Python编程 合并 #189 前做了完整的核验与自选负控制（P26），却只留在它自己的会话里；收尾起草者从台账里找不到，据此写成了「缺记录」，是收尾评审从控制方那里取证才改正的。
  **今后期控制方的合并核验（CI run、head SHA、diff 范围、自选负控制及其结果）写进台账文件**，与模块控制方第 7 步的做法相同。

### 子代理上报「简报 / 清单有错」

两波共 4 个构建者、2 次终审、2 轮修复、2 次范围复审，另有 #187 的作者（MDev-01 自己）。经复核**成立**的：

- 报告路径写不进集成 worktree（m5a 两个构建者、m5b py-simulation）——模板已改（本收尾）。
- 简报「逐行包含」按子串理解守不住页面上的「一行一行」（#187 作者）——采纳（P19）。
- 门 `compile` 继承 `__future__`，`@dataclass` 程序挂不上 property（m5a py-systems 构建者）——#188（P20）。
- 根 `.gitignore` 的 `*.log` 挡住 fixture，门看不见（m5a py-text-data 构建者）——反向规则（P21）；门的建议记账（账本 §三.2）。
- m5b 清单的 2048 示例 `[2, 2, 2, 2]` 触不到标志（py-games 构建者）——换示例，复盘写进 skill 第 1 步。
- pi-random 的参照「逐列数格点」对随机点不可能（py-simulation 构建者）——改逐点 `isqrt`。
- log 的参照 `split()` 与被测语义不一致（py-text-data 构建者）——改 `split(' ')`。
- `date-format-manual` 的 `isdigit`（m5a 终审 I1）、`tokenise-loop` 同类（m5a 修复实现者，超范围）——V1、V3。
- 自己 refs 注释里一个没跑过的变异例子（「range 终点写 -1 能守住」，py-simulation 构建者自查）——property 门确实看不见，但 `program_run_check` 看得见（`randrange(1)` 也消耗随机状态，演示块输出变了，断言红），
  所以注释改成的「门是绿的，但那是等价程序」仍不准；原句对整个 `check.py` 其实成立。留账：下次动 ch21 时改 refs 注释（账本 §三.1）。
- `.gitignore` 反向规则只覆盖一层（m5a 终审 Minor 10）——改 `**`（P21）。
- refs 文件头过时，会让人删掉唯一的守门分支（m5a 复审 Minor 2）——V4。

报成「门盲点」、复核为**等价程序**的一条：`minesweeper-place-count` 的 `neighbours` 放宽边界 / 去掉跳过自己（py-games 构建者报，m5b 终审判等价）。没有一条被判为「上报者错了」而驳回。
