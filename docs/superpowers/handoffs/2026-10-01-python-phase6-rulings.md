# Python 子项目 · 第 6 期的裁决

> 这些是控制方在**没有人类在场时**替你做的决定。每一条记着：
> **决定了什么 · 为什么 · 如果判错了代价是什么**。读它，把判错的地方推翻。
>
> 规格：`docs/superpowers/specs/2026-09-30-python-phase6-m8a-design.md`（§7）、`-m8b-design.md`（§8、§8.1）、`docs/superpowers/specs/2026-09-30-python-boards-syllabus-map.md`
> 账本：`docs/superpowers/handoffs/2026-10-01-python-phase6-deferred.md`
> PR：#201（MicroPython 层，开工前提）· #202（`python.md` 与 `python-handoff.md`）· #203（boards 按考纲）· #204（一致性清理）· #205（第 5 期收尾）· #206（`boards_map_check`）· #207（m8b）· #208（m8a）
> 核对基线 `b3d8546`（#208 合并后的 `main`），2026-10-01 逐条复核。

**第 6 期是主规格 §9 的最后一期，有三个控制方。** 会话「Python编程」写派发简报（`phase6-brief.md`）、开 #201 与 #206、审两波清单与文档大纲、裁决、集中合并；
MDev-01 做 m8a（`py-microbit` ch33、`py-pico` ch34）；MDev-02 做 m8b（`py-embedded-patterns` ch35）**外加**文档 PR #202。boards PR #203 与一致性清理 #204 由 Python编程 派给另外的实现者。
下面 §一 是 Python编程 的，§二 是 MDev-01 的，§三 是 MDev-02 的 m8b，§四 是文档 PR 与三个基建 PR，§五 是失误与「简报有错」。

**来源。** 期控制方的派发简报 `phase6-brief.md`、台账 `controller-log.md`（28 行）、复盘条目 `retro-items.md`（1–19）、`m8a-ledger/`（30 项）、`m8b-ledger/`（35 项）、`docs-ledger/`（3 项）——
都在主工作区 `.superpowers/python-phase6/`，gitignored，**不在仓库里**，要留下来的这里都抄全了。两份清单的裁决表三栏不全（多数只有决定），代价一栏照第 5 期的写法：缺的写「缺」。
#201 与 #205 的合并前核验记在**第 5 期**期控制方台账（`.superpowers/python-phase5/controller-log.md:28`、`:32`）——它们属于第 5 期（#205 是第 5 期的收尾 PR），合并落在第 6 期的时间里；第 5 期收尾的教训（按 PR 所属的期找台账）照做。

---

## 〇、你（用户）在第 6 期

第 6 期**没有新的用户裁决**。用到的都是第 5 期末的五条（第 5 期裁决 §〇）与一条委托：

- **委托（出处：用户，2026-09-30）**：Python编程 审批清单、裁决、集中合并；带「推荐」的选项直接选，只有影响整个系统方向的决策才停下问你。本期所有清单批准、跨波裁决、八个 PR 的合并都在这条委托下做。
- **U1 落地**：「不在考纲就不写、空列表合法」由 #203 落地（engine `py-1.3.0`），#206 加了防漂门；第 6 期 29 个新程序照它判：23 个 `[]`、2 个两家、4 个四家。
- **知会（不是待决）**：Edexcel 一列按 Pearson 现行的 International A Level（IAL YCP01）判——Pearson 已不提供英国本土 GCE A level Computer Science（#203 PR 描述「Edexcel 说明」）。你若指的是别的资格，这一列要整列重判。
- **仍等你的**：只剩 `core.hooksPath` 改相对路径（第 5 期 U5，见账本 §六）。

---

## 一、Python编程（期控制方）

### 期初（派发简报 `phase6-brief.md` §2）

**P1 · MicroPython 程序的结构：纯逻辑函数 + `main()` + 恰好一个 `if __name__ == "__main__":`；顶层只许 import / def / class / docstring / 常量赋值（调用只许 `const(...)` / `Image(...)`）。**
— 理由（简报）：property 要能在硬件桩下导入模块、调纯逻辑函数；引脚、显示、主循环放在顶层就会在导入时调用桩。— 代价：缺。
可核的后果：`micropython_main_guard_check`（#201）；29 个程序全过（CI「MicroPython 顶层：29 个程序导入时只定义、不执行」，run 36792426779）。

**P2 · `runtime` 写 `micropython-microbit` / `micropython-pico`，`requires: []`，没有 `run` 字段；正确性靠 property，每页至少一半程序挂 P；入口收内置值、返回内置类型、不碰硬件。**
— 代价：缺。可核的后果：29 个程序 24 个带 P（ch33 8 / 9、ch34 6 / 9、ch35 10 / 11）；不带的 5 个：`scroll-and-show`、`pin-irq-counter`、`timer-periodic-callback`、`elapsed-naive-subtract`、`two-leds-blocking`（清单 §2 各表下注与 m8b D4）。

**P3 · 时间：逻辑函数里的时间是毫秒整数实参（简报原写 `now_ms`），`sleep` / `ticks_ms` 只在 `main()` 里；ticks 回绕专门一个程序讲（`ticks_diff` 语义在参照里用模运算独立实现）。**
— 代价：缺。**简报的 `now_ms` 被 m8b 起草者纠正为 `elapsed_ms`**（§三 D1）——按构造就不受回绕影响。`py-pico` 的 `blink_schedule` 交回 (时刻, 电平) 表，时刻从 0 算起、不跨回绕，与这条不矛盾。

**P4 · 不用 `_fixtures/`、不带外部文件；随机只许 `random.Random(<种子>)`。** — 代价：缺。可核的后果：本期 0 个 fixture、0 个程序用随机（两份清单 §5.1 / §1.4，终审逐文件 grep）。

**P5 · boards 照新规则：不在考纲就不写；核心概念若被某考纲点名（有限状态机、循环队列、位运算、中断……）按概念写那一家、清单写条目依据；以考纲对照文件为准，拿不准就不写。**
— 代价：缺。可核的后果：§一 P11、P12、§二 M8A-D11、§三 §8.1。

**P6 · 沿用：起草期原型四件套报命中数，舍入 / 回绕边界专门造 cases 并做「换一种舍入 / 忽略回绕 → 红」的负控制；清单写的「实测行为」标注测了多少组；长度取向 40–70 行、不用 chunks；英文跨页 `the <页名> page`、冠词开头的标题不加 the。**
— 代价：缺。可核的后果：m8a 6 个取整 / 回绕程序全定义域穷举（清单 §0 表）；m8b 10 个 P 原型（清单 §7）。**但原型的命中数是两处一起改出来的**，高估了每一处（§五）。

**P7 · 本波共有约定表：tag `micropython`、`microbit`、`pico`、`gpio`、`debounce`、`ring-buffer`、`state-machine`（简报原写 `fsm`，见 P10）；跨波「概念 → 页」对照批准清单时发。**
— 代价：**约定表没有导入写法（`utime` / `time`）与另一波的英文页名**——前者到 m8b 终审 I3 才统一（P15），后者两个 m8a 构建者都猜错了（集成时改 5 处）。

**P8 · 验收：严格模式全部门；MicroPython 没有无头跑帧，代之以 `copyrun.py` 的第二道测量（复制内容里的 entry 对门的参照）与硬件桩下导入一次。** — 代价：缺。
可核的后果：两波都跑了（m8a 6/6、负控制 property 3/4 → 修复后 4/4；m8b 11/11、负控制 10/10）。本收尾在 `b3d8546` 上重跑三章：9/9、负控制 property 7/7（账本 §四.5）。
**`main()` 在任何地方都没执行过**——这一层没有跑帧的对应物（账本 §四.1）。

### 清单与大纲审批

**P9 · 文档 PR 大纲批准（MDev-02，基线 `e342ba2`）。** 授权改主规格 §9.2 两句；写进撰写者简报 8 条修正（台账记「+6 条修正」，另两条是大纲自己「待你裁」两处推荐的采纳）：
契约 v2.1（九条，C9 = 画廊背景）；boards 新规则只写入口；「页面不显示输出」是定论；人工验收已关闭照实写、pygame 真玩 / MicroPython 上板写成「门在结构上做不到」；hooksPath 待用户；`文件:行` 标基线 SHA；期 5 入口按命名推断并标「由期 5 收尾 PR 引入」；数字只进一张快照表。
— 代价：缺。可核的后果：#202 评审 18 条、一轮修复全改（台账：150 多处引用里 1 处实质错误，复盘 1）。

**P10 · m8a 清单批准（`cc212b2`，18 程序 / 2 组 / 14 P；6 个取整 / 回绕程序全定义域穷举）。** 裁决：边沿检测归 m8a、去抖归 m8b；定时器回调 / 中断本身归 m8a、数据交接归 m8b；位运算归 `gpio-bitmask`（tag `bitwise`）；据文档未实测的行为标出处；boards 默认 `[]`、待对照文件核。
同时更正简报：**`fsm` 作废、只用全库已有的 `state-machine`**——简报约定表违反了「tag 先 grep」，是控制方的错（M8A-D10）。— 代价：缺。

**P11 · m8b 清单批准（`5704977`，11 程序 / 3 组 / 10 P）。** 逐程序对 m8a 18 个：无同题（`two-leds-nonblocking` 是主循环 ticks 调度、m8a `timer-periodic-callback` 是定时器回调；`ring-buffer-isr-handoff` 是 ISR → 主循环交接、`pin-irq-counter` 是中断本身；`hysteresis-thermostat` 消费温度、`adc-temperature` 做换算）。
D1 `elapsed_ms` 采用（纠正简报）；D3 只用 `state-machine`；D2、D4、D5 采用（§三）。— 理由：第 5 期 `game-state-screens` 同题漏到终审，这次逐个程序对（第 5 期收尾写进 skill 的规矩）。— 代价：缺；两次终审都没报同题。

**P12 · m8a boards 核定（M8A-D11）：OCR 三条由期控制方读 H446 v3.0 全文核实——1.2.1(c) 中断 / ISR、1.4.1(c) 补码、1.4.1(i) 位运算与掩码（全文文本第 477、570、581 行）；`gpio-bitmask`、`radio-packet-bytes`、`pin-irq-counter` 四家，其余 15 个 `[]`。**
规则：谁加程序谁在对照文件附录表加行（m8a 18 行、m8b 11 行随各自 PR）。— 代价：缺。可核的后果：附录 375 行、`boards_map_check` 绿。

### 基建 PR（第 6 期内派出）

**P13 · boards PR（#203）的裁决。** 实现完成后：Edexcel 按 IAL YCP01 判（§〇 知会）；「写法考纲外、按概念保留」的 11 个程序按用户规则逐个重判。
评审 With fixes（C0，I8）后：I-1（184 个「未改」程序用了章级模板依据）→ 逐个判 + 判定脚本对无依据行报错；I-3 CIE 18.1 点名 regression → 加 CIE；I-4 NEA 规则 → 采用 R6（NEA 要求条目算点名、示例表不算）；其余照评审。
范围复审只差 N-1（`return-several-values` 应写 AQA 4.1.1.12）；控制方另裁 S-2 `strings-are-immutable` → `[]`（函数式语境，R5）、S-4 顺手改 `python.md` §4.5、S-1 防漂门记账 → 成了 #206。
— 代价：缺；**判定脚本与数据在草稿区、未入库**（附录表是数据，脚本没有留下）。可核的后果：194 个程序 boards 变了、29 页 patch 升版、engine `py-1.3.0`；改后 AQA 216 · OCR 183 · Edexcel 252 · CIE 179 · `[]` 70。

**P14 · 一致性清理（#204）：「清空本模块」按钮只清本页 → 改文案为「清空本页」，不做跨页清空；主规格 §4.5 / §6.2 / §7.1 variant / §1.2 出站 / §5.4 无网络照代码实写；三处 core 注释 / docstring；engine `py-1.3.1`，不升 tool-version。**
— 理由：MDev-02 在 #202 上报 14 处仓库内不一致，其中 1、12、13 由第 5 期收尾修、4 由 boards PR 修，余下的合成一个 PR。— 代价（PR 描述原话）：`?v=` 缓存键不变，已缓存旧页的浏览器要等缓存过期才看到新文案。
#205 合并之后的两件跟进（都在 #204 的最后一个提交 `69bb420` 里做了）：`python-drill-tool` 里 `judge.js:162` 的引用改成「按代码找」（至 `b3d8546` 那一行在 `:170`）；契约文档 C3「只有一处父目录引用」更正为每页 2 处。

**P15 · #206 `boards_map_check`（44 → 45）**：依据表附录与各 `chapter.json` 的 boards 逐行一致（id 双向、章、boards 集合、概念组与依据非空、无重复行）。— 理由：#203 复审 S-1。
— 代价：**它只守附录**，四家各节的条目与「计数」一节没有门（两波各节重复的「中断」行就是它看不见的，§五）。负控制（PR 描述，7 种，全部断言红、无 Traceback）。

### 集成与合并

**P16 · 构建者放行（main `bf8d1a0`，engine `py-1.3.1`）**：两波各自 `merge --no-commit` main、跑配方脚本、用 `fill-template.py` 填简报；跨波概念对照随放行发出。— 代价：缺；3 个构建者 0 个 BLOCKED。

**P17 · m8b 终审的跨波裁决：I3 → 整个 M8 统一 `utime`（m8b 改 5 个 Pico 程序）；I2 → CIE 中断是 4.1，四家各节两波重复的「中断」概念行由**后合并的一波删自己的**。**
— 理由：m8a 的 9 个 Pico 程序全是 `utime`、micro:bit 文档也是这个名字；改后合的那一波代价最小。
— 代价：**「后合并一波删自己那行」是按概念整体下的，到 Edexcel 那一节前提不成立**——m8b 那一行讲缓冲（理论层，不点名 ISR），删掉 m8a 那一行，`pin-irq-counter` 的 Edexcel 依据就没有点名行了；m8a 控制方偏离、保留，期控制方接受（P19）。

**P18 · 合并顺序：m8b 先、m8a 后**——m8a 有 4 个程序、中英各 5 处讲解指向「嵌入式编程模式」一页（m8a 终审 M6）。— 代价：m8a 合 main 时多一轮冲突（依据表、注册表、两导航页），由它的控制方解。

**P19 · #208 合并时接受的三处偏离**：Edexcel「中断」行保留 m8a 那一行（P17 的前提不成立）；注册表模块 8 按章序（配方脚本把 patterns 放在前面，控制方手工挪成 microbit、pico、patterns）；`py-embedded-patterns` 升 1.0.1，把 `two-leds-nonblocking` 讲解里的「硬件定时器」改成定时器回调（m8a 范围复审 N4）。
— 代价：第二条是手工步骤——本收尾把它做成了配方脚本「按 (module, 章号) 插入」，回放与 `99c0231` 逐字节相同（账本 §四.6）。

**P20 · 八个 PR 的合并前核验。** 出自期控制方台账（第 6 期 `controller-log.md`，#201、#205 在第 5 期台账）；CI run、head、开合时间、合并提交、范围本收尾用
`gh pr view <n> --json headRefOid,mergeCommit,createdAt,mergedAt,statusCheckRollup`、`gh run view <run> --json headSha,conclusion`、`gh run view <run> --log` 与 `git diff --shortstat <合并>^1 <合并>` 逐个复核。
合并顺序（UTC，2026-09-30）：#201 → #202 → #203 → #205 → #204 → #206 → #207 → #208。

| PR | head | CI run（全部 success） | 开 → 合（UTC） | 合并提交 | 范围 | 本地全量 / CI 读到的 | 控制方自选负控制 | 台账 |
|---|---|---|---|---|---|---|---|---|
| #201 MicroPython 层 | `c446492` | 36777551777 | 21:09 → 21:12 | `e342ba2` | 4 文件 +153 / −5 | CI：CPython 3.12.14、`scipy-stack 2.3.1 2.3.0 3.10.3`、`pygame 2.6.1 dummy`、310 真跑 + 36 compile、0 跳过、235 P、「MicroPython 顶层：今天 0 个」、44 门、导航 134 | PR 作者即控制方（第 5 期裁决 P18） | 第 5 期 `:28` |
| #202 两份文档 | `c904629` | 36781856667 | 21:49 → 21:53 | `2cc8f5e` | 3 文件 +1121 / −2 | 台账：3 文件、CI 44 门绿；快照表抽核 `e342ba2` 注册表 32 工具 / 346 程序 / `py-1.2.0` 一致；`python.md` 763 行、`python-handoff.md` 356 行（本收尾 `git show` 复核）。CI 日志与 #201 各行相同 | —（文档 PR；抽核快照表代替） | `:9` |
| #203 boards | `a77ebbe` | 36783355166 | 22:04 → 22:07 | `08d3935` | 76 文件 +2011 / −1954 | 台账只有 CI 事实：pygame dummy、310 + 36、0 跳过、235 P、44 门、导航 134；`--match-head-commit` | 台账未记 | `:13` |
| #205 第 5 期收尾 | `17d4a9a` | 36785010975 | 22:20 → 22:23 | `3444e5c` | 13 文件 +1372 / −61 | 第 5 期台账：pygame dummy、0 跳过、44 门；`--match-head-commit`。CI 日志另有 310 + 36、235 P、导航 134 | —（文档与标准件 PR） | 第 5 期 `:32` |
| #204 一致性清理 | `69bb420` | 36785519849 | 22:17 → 22:29 | `bf8d1a0` | 43 文件 +1468 / −748（核验时 `a52eee1` 一个提交 41 文件；另合了一次 main） | 台账：44 门、engine `py-1.3.1`；`--match-head-commit`。CI 日志同 #201 各行 | `clearScope('page')` 丢掉首个程序 → `interact.test` 两条 ✗；`'all'` 返回 `[]` → 一条 ✗；复原复绿（368 条） | `:16`–`:17` |
| #206 `boards_map_check` | `76bb751` | 36786115676 | 22:31 → 22:34 | `753199a` | 5 文件 +79 / −1 | 台账只有 CI：45 门、「boards 依据：346 个程序……逐行一致」；`--match-head-commit` | PR 作者即控制方（PR 描述 7 种负控制） | `:20` |
| #207 m8b | `2b830b8` | 36791002937 | 23:25 → 23:29 | `602e5cc` | 19 文件 +7053 / −2（−2 是依据表一致性自查 fsm / queue 两行随计数更新） | verify-207 严格 + 无头 SDL：45 门、310 + 47、0 跳过、245 P、MicroPython 顶层 11、boards 依据 357、导航 135、品牌 144；CI 一致 | ring-buffer 覆盖时不推进 head → 断言红（返回值[0][0]）；moving-average `//` → `int(/)` → 断言红（返回值[1]）；复原复绿 | `:23`–`:24` |
| #208 m8a | `99c0231` | 36792426779 | 23:41 → 23:45 | `b3d8546` | 31 文件 +12700 / −9 | verify-208 严格 + 无头 SDL：45 门、310 + 65、0 跳过、259 P、MicroPython 顶层 29、boards 依据 375、导航 137、品牌 146；CI 一致 | gpio-bitmask toggle 写成 set → 断言红；elapsed-ticks-diff 回绕边界 `>=` → `>` → 断言红；复原复绿 | `:25`–`:27` |

— 理由：`python-content-wave` 第 7 步。— 代价：缺。
本收尾复核：八个 run 的 `headSha` 都等于上表 head、conclusion 都是 success；日志里的门数、段数、P 数、MicroPython 顶层数、boards 依据数与导航项数与上表逐一相同。
**台账没写的**：#207 的 CI run 号（台账只写「CI success」，run 号由本收尾从 `gh pr view` 取得）；#202 是否用 `--match-head-commit`；#203、#206 的本地全量与自选负控制。

---

## 二、m8a 控制方（MDev-01，#208）

清单裁决（规格 §7，Python编程 审；三栏里只有「决定」，理由多在清单正文，代价全缺）：

| # | 决定 | 理由（清单正文） | 判错的代价 |
|---|---|---|---|
| M8A-D1 | 页名「micro:bit」/ micro:bit、「树莓派 Pico」/ Raspberry Pi Pico | 页名在清单里定 | 缺 |
| M8A-D2 | 组名 `radio-packet`、`elapsed-time`，全库无撞；与 m8b 的逐程序对照由 Python编程 做 | `variant_check` 按全库分组 | 缺 |
| M8A-D3 | 边沿检测归本波（`button-press-edges` 不去抖）；`timer-periodic-callback` 只讲定时器回调、`pin-irq-counter` 只讲中断本身，数据交接归 m8b | 一个知识点只在一页讲 | 缺 |
| M8A-D4 | `gpio-bitmask` 讲位运算（全库首次），tag `bitwise` | 位运算 M1 没覆盖 | 缺 |
| M8A-D5 | 十二平均律只作背景；Pico / Pico W 板载 LED 引脚不同，讲解写明 | — | 缺 |
| M8A-D6 | `ticks_diff`、`duty_u16`、milli-g、航向范围等**据官方文档、本机无法实测**的行为，refs 头与讲解标「据文档、未实测」并给出处 | 本机没有 MicroPython | 缺；航向范围清单就写错了（§五） |
| M8A-D7 | `round(h / 45)` 在整数航向上与正确写法等价，写进 refs 头、不得当负控制 | 原型第一版用它当错误实现，命中 0 / 200 | 缺 |
| M8A-D8 | boards 默认 `[]`，五个候选等对照文件逐条核 | 当时对照文件还没进 main | 缺 |
| M8A-D9 | 无递归 | — | 缺 |
| M8A-D10 | 共有 tag 的 `fsm` 作废，只用 `state-machine`；m8b 组名 `blink-two-rates`、`debounce`、`sensor-smoothing` 与本波 18 个逐个对过无同题 | tag 先 grep | 缺 |
| M8A-D11 | `gpio-bitmask`、`radio-packet-bytes`、`pin-irq-counter` 四家；其余 15 个 `[]`；附录 18 行与位运算 / 补码 / 中断三个概念的四家条目由控制方加 | P12 | 缺 |

集成与评审期（`m8a-ledger/progress.md`）：

- **V1 · 接受 pico 构建者给 `gpio-bitmask` 加第四种操作 `invert`（`~mask & 0xFF`）。** 理由（构建者）：只有 set / clear / toggle 且位号 0..7 时 `& 0xFF` 永远是空操作——教一个没用的运算不对；去掉它的负控制 51 / 200 红。代价：缺。
- **V2 · 接受 `elapsed-ticks-diff` 的 `main()` 用 `utime.ticks_add(0, -1) + 1` 求 period（照官方 time 文档例子）、逻辑里取余用 `%` 不用 `&`（位运算留给 `gpio-bitmask`）。** 代价：缺。
- **V3 · 接受 microbit 构建者更正：`compass.heading()` 是 0..360（文档原文 "from 0 to 360"），不是清单的 0..359**；清单 §0 与 §2.1 改。代价：清单原样会让 cases 漏掉 360（`% 8` 把它当北）。
- **V4 · 加速度计正负方向文档没写：程序自定 right / left / back / forward 并在讲解如实说「文档没说、本机未试」——接受，留账「需实机核」。** 代价：方向若反了，讲解与板子行为相反（账本 §三.1）。
- **V5 · A0 27.5 Hz 恰为平局：CPython `round` 与参照都得 28，MicroPython 的平局规则本机测不了；`main()` 只放第 4 八度不受影响——接受，写进 refs 头。** 代价：账本 §三.2。
- **V6 · tag：`overflow` 复用于计数器回绕（ch12 里是栈上溢）交终审；终审 M3 → 改成新 tag `wrap-around`。** 代价：缺。
- **V7 · 修复轮裁决 F1–F6（照「推荐」）**：F1 讲解泄漏全修；F2 encode 空 → entry 改**往返包装**、参照恒等；F3 讲解对检查器的说法照实（或 cases 真覆盖，实现者判）；F4 L1 钉法；F5 `overflow` → `wrap-around`；F6 标题「硬件定时器」→「定时器」、讲解说明 rp2 上是软件定时器；M6 不改代码、交期控制方排合并顺序。
  修复者 6 条偏离全部接受（「同一程序两个 P」门不支持 → 走往返包装；pwm / music 改措辞不穷举——门是单种子 200 组，无状态生成器保证不了「每个」；music steps 三级重排；多钉 2 处；pairs 改钉「两份都不切片」；elapsed-naive 改挖 report 行）。
  这是「我的做法与简报不一致、而我的做法更对」的一例：F2 简报写「同一程序两个 P」，修复者读了门（`entry` 是单个字符串、参照按程序 id 一条）判定做不到。
- **V8 · 范围复审 N1 / N2 / N3 / N5 只动提示与讲解文字，控制方直接落地 + 判定器实测（裸 vm，标准答案判对、复审列出的写法判错并由 L1 钉住，std 12 / 12、去缩进 12 / 12）→ `3545597`。N4（m8b 页讲解的「硬件定时器」）合 main 时改、patterns 升 1.0.1。** 代价：缺。
- **V9 · 合 main（#207）时：依据表手解（AQA / OCR / CIE 中断行留 m8b、删 m8a；Edexcel 偏离保留 m8a 那行；开头 346 → 375；计数改增量）；配方脚本 rc = 0；模块 8 手工挪成章序。** 见 §一 P19。

---

## 三、m8b 控制方（MDev-02，#207）

清单裁决（规格 §6、§8，Python编程 审定 `5704977`）：

| # | 问题 | 决定 | 理由 | 判错的代价 |
|---|---|---|---|---|
| D1 | 逻辑函数收什么时间 | **`elapsed_ms`**（本拍与上一拍的间隔，`main()` 用 `ticks_diff` 算好传入），不是简报的 `now_ms` | 按构造不受回绕影响，本页不必重讲回绕 | 缺；记为「简报被纠正」 |
| D2 | 页名 | 「嵌入式编程模式」/ Embedded Patterns | 与模块名「嵌入式 Python」不同形 | 缺；两个 m8a 构建者不知道，都猜成 Embedded Programming Patterns |
| D3 | `fsm` 与 `state-machine` 并挂 | **不并挂**，只用 `state-machine`（MDev-02 原推荐并挂，期控制方否） | 简报的 `fsm` 违反 tag 先 grep | 缺 |
| D4 | `two-leds-blocking` 不挂 P | 采用（11 个里 10 个挂） | 整段就是 `sleep_ms` | 缺 |
| D5 | boards 由构建者照对照文件定 | 采用；核不实留 `[]` | 当时对照文件未进 main | 缺 |

boards（§8.1）：`press-classifier-fsm`、`hysteresis-thermostat` AQA CIE（fsm 组）；`ring-buffer-isr-handoff` 四家（queue 组，中断只是用）；其余 8 个 `[]`；`uart-line-assembler` 列进对照文件「拿不准」。

台账里的其余决定（`m8b-ledger/progress.md`）：

- **构建者的 cases 加强全部接受**：清单给的命中数是两处一起改的（§五），单改更弱；构建者加强后 fsm 间隔 17 → 54、滞回上阈 28 → 52、stable-time 24 → 69、uart 51 → 70（同种子 200 组）。refs 头写明。代价：缺。
- **构建者用 `import time`（照 rp2 quickref）、讲解说 utime 是旧名——记为偏离，交终审；终审 I3 → 期控制方裁决统一 `utime`**（§一 P17）。修复者没写简报给的「新固件上也可以写 import time」，改成中性说法（固件也认 `import time`，它的快速参考就这样写；本模块统一用 utime）——
  理由：查不到「老固件不认 `time`」的依据；复审认可。这是「我的做法与简报不一致、而我的做法更对」的又一例。
- **终审 I1 / I2、M1–M6 一次修复全修；修复者没给 `py-embedded-patterns` 升版**（新页、1.0.0 从未发布）——接受。代价：缺。
- **范围复审 N1（中值「上限」说法数学错，修复前就有）、N2（计数口径与 m8a 不一致）只动文字，控制方直接落地**：中值行注与 notes[2] 改成「把 c 夹在 a、b 之间」——穷举 −3..3 共 343 组：公式 ≠ 中值 0、夹逼 ≠ 中值 0、旧「上限」说法被违反 91 组（负控制）；计数改增量句（AQA +3、OCR +1、Edexcel +1、CIE +3、`[]` +8）。依据表开头「346」留给后合并的一波。
- **集成**：合 #206 时附录 11 行、四家新概念行、「拿不准」第 16 条一起补，配方 rc = 0。控制方负控制 4 种（hysteresis 上阈 `>=` → `>` 断言红；ema `>>` → `int(/)` 断言红；顶层 `display_probe = Pin(25)` → 结构门断言红 + property 门具名红；依据表去一家 → `boards_map_check` 断言红）。

---

## 四、文档 PR（MDev-02，#202）与三个基建 PR

**文档 PR 的做法**（`docs-ledger/`）：大纲两节表逐节写「事实来源」→ 期控制方批准并给 8 条修正（§一 P9）→ 两位撰写者并行（`python.md` 794 行、`python-handoff.md` 330 行，初稿）→ 一次评审 18 条、一轮修复全改（#18 措辞按源码修正）→ `c904629`（763 / 356 行）。
撰写者上报 12 处「规格 / skill / 代码与事实不一致」、评审另报 2 处，**都没在文档 PR 里改**（禁改单），交期控制方分派（§一 P14）。去向：

| 上报 | 去向 |
|---|---|
| 主规格 §7.1 门表缺 `chunks_check`；`python-drill-tool`「本期不用 chunks」与门表；`python-content-wave` 坑表三行前提已变 | 第 5 期收尾（#205） |
| 主规格 §2.3 boards 非空 vs 门 | boards PR（#203） |
| §6.2 契约条数、§4.5 三级清空（按钮只清本页）、§7.1 variant 判据、§1.2 / §7.1 出站引用 2 处、§5.4 无网络、`interact.js` 行注注释、`build_programs.py` docstring 两处、`judge.js` 文件头 | 一致性清理（#204） |

#203、#204、#206 的裁决在 §一 P13–P15。三个 PR 的实现者没有上报「简报有错」；#203 的评审 I-1 是实现者的错（章级模板），I-5 的 OCR v3.0 全文由评审员读到、期控制方采纳。

---

## 五、失误与「简报有错」

### 控制方的失误（三个控制方合计；没有一条造成合进 main 的错误）

- **派发简报约定表写 `fsm`**（Python编程，自承）：违反「tag 先 grep」，全库已有 `state-machine`（ch21、ch22、ch29 共 3 处）。两波清单审批时更正。
- **派发简报写 `now_ms`**（Python编程）：m8b 起草者提出 `elapsed_ms`，D1 采用。
- **约定表没有导入写法与另一波的英文页名**（Python编程）：`utime` / `time` 拖到 m8b 终审 I3；m8a 两个构建者猜错 m8b 页名，集成改 5 处。→ `python-content-wave` 第 1 步（跨波写法约定进同一张约定表）、`builder-brief.md` 约定表槽的提示。
- **跨波「中断」行的裁决按概念整体下**（Python编程）：Edexcel 那一节前提不成立，m8a 偏离保留。→ `python-content-wave` 第 7 步「逐节逐行」。
- **m8b 清单的原型命中数是两处一起改的**（MDev-02）：`press-classifier-fsm` 清单报 68，单改间隔 17；`hysteresis-thermostat` 清单报 75，单改上阈 28；构建者发现并加强 cases。→ `python-content-wave` 第 1 步「错误实现一次只改一处」。
- **m8b 清单的 CIE 中断条目写成「3.1 后」，原文在 4.1**（MDev-02，台账「我的错」）：CIE 9618 全文文本第 909 行在 4.1（第 873 行）之下；3.1 在第 792 行。终审 I2 抓到（本收尾在期控制方给的全文文本上复核行号）。→ `python-content-wave` 第 1 步「条目编号 + 原文所在处」。
- **m8a 清单的罗盘范围写 0..359**（MDev-01；构建者 B1 按文档更正为 0..360）。
- **m8a 控制方第一个负控制变异是等价变异**：罗盘 `+45 → +44`——`2h + 45` 恒为奇数，在 0..360 上差异 0 个；换 `+46`（差异 8 个：22、67、112……）才断言红。门绿是对的。→ `python-content-wave` 第 4 步「先量差异数」、`final-review-brief.md`。
- **m8b 构建者报空数 25，页面实为 26**（构建者手数；控制方靠浏览器探针对出，终审也是 26）。→ `copyrun.py` 逐章印空数，构建报告与 PR 模板照它写。
- **m8b 控制方合 #206、补依据表时撞上配方脚本 rc = 2**（未暂存改动）。→ `python-content-wave` 第 6 步写明顺序。
- **`fill-template.py --list` 把「REQUIRED 」印在键前面**，照抄进 JSON 成了拼错的键（m8b 控制方，复盘 9）。→ `--list` 改印可用的键（本收尾，账本 §四.5）。
- **文书**：两波的 `git-size-before.txt` 都没在 `progress.md` 记测量时点（第四次）；`git-size-after.txt` 两波都记了（m8b `602e5cc` 上 00:30:08、m8a `b3d8546` 上 00:46:08，BST）。#207 的 CI run 号没进台账。

### 子代理上报「简报 / 清单有错」

两波共 3 个构建者、2 次终审、2 轮修复、2 次范围复审；文档 PR 2 位撰写者与 1 次评审；#203 1 个实现者、1 次评审、1 次范围复审。经复核**成立**的：

- `compass.heading()` 是 0..360（microbit 构建者，B1）。
- m8b 英文页名不知道、只能猜（两个 m8a 构建者都报了）。
- `gpio-bitmask` 只有三种操作时 `& 0xFF` 永远空操作（pico 构建者，V1）。
- 清单的原型命中数对单一边界不成立（m8b 构建者：fsm 17、hysteresis 28、stable-time 照简报构造反而 24）。
- m8b 清单 CIE 中断 3.1 应为 4.1（m8b 终审 I2）。
- F2「同一程序两个 P」门不支持（m8a 修复者，V7）。
- I3 修复简报的「新固件上也可以写 import time」没有依据（m8b 修复者）。
- m8b 中值「上限」说法数学上错（m8b 范围复审 N1：a = 5、b = 7、c = 1 时中值 5 > 1；修复前就有、终审漏了）。
- 两份内部文档与 m8b 页讲解仍写「硬件定时器」（m8a 修复者偏离 6、范围复审 N4）：前者控制方 `76f6fb2` 改；m8b 页讲解随 #208 改、升 1.0.1；**m8b 规格里还有 3 行没改**（账本 §三.5）。
- radio-packet-bytes 的 encode 空除 compile 外无门守（m8a 控制方 copyrun 负控制先报、终审 I2 实测证实）。
- 文档 PR：14 处仓库内不一致（§四）。

报成疑点、复核为**等价程序**的：罗盘 `round(h / 45)`（M8A-D7）；`pwm-servo-angle` 的 `round` 在 0..180 上（唯一的半数 135 两边都得 6554）；m8a 终审三条绿变异（spirit 下界夹到 `LOW + 1`、duty `+50 → +51`、`_apply` 拆位改 `mask // 2 ** i % 2`）。
没有一条被判为「上报者错了」而驳回。m8b 构建者坚持的 `import time` 是**被裁决推翻**、不是被判错：它有官方依据，推翻的理由是跨页一致（P17）。
