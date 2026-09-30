# Python 子项目 · 第 5 期留给第 6 期的账

> 第 5 期（M7「图形与游戏」pygame 四页，两波并行：m7a = `py-pygame-basics` + `py-pygame-sprites`，m7b = `py-pygame-motion` + `py-pygame-games`）已完成：
> **4 页、36 个程序**（m7a 18 + m7b 18），其中 32 个带 property 检查，`lines` 合计 2,087（467 + 476 + 437 + 707）。
> 全库现为 32 页、**346 个程序**（其中 235 个带 property 检查）、`lines` 合计 11,099；engine `py-1.2.0`；门 41 → **44**
> （#196 `pygame_main_guard_check`、#198 `chunks_check`、#201 `micropython_main_guard_check`——最后一道是第 6 期的开工前提，收尾期间合并）。
> 另有 chunks 分段临摹第一次在 core 里接通（#198），`library-loans` 与四个完整游戏共 5 个程序 15 段。
> PR：#196 · #197（第 4 期收尾）· #198（chunks）· #199（m7a）· #200（m7b）· #201。
> 这份文件是**账本**，不是待办列表——每一条都记着**为什么当时没修**，以及**什么时候它会变成必须修**。
>
> **核对基线 `e342ba2`**（#201 合并后的 main），收尾当天（2026-09-30）逐条实测；文中 file:line 都按它。
> 收尾评审期间 main 又合了两个 PR，本 PR 已把它们合进来：**#202**（`2cc8f5e`，python.md 与 python-handoff.md，§五.5）、**#203**（`08d3935`，boards 按考纲重判、engine py-1.3.0、29 页 patch 升版）。
> 合完之后复核过：`judge.js:162`、`library.py:538 / :541 / :562` 行号不变；D 项扫描结果不变；页面体积与 boards 分布按基线记，#203 之后的不在本账本里。
> 来源：期控制方的派发简报与台账（主工作区 `.superpowers/python-phase5/phase5-brief.md`、`controller-log.md`）、复盘条目 `retro-items.md`（1–27）、
> 三份台账（`m7a-ledger/`、`m7b-ledger/`、`chunks-ledger/`）——都 gitignored，**不在仓库里**，要留下来的这里都抄全了；以及三份清单 / 设计规格与六个 PR 的描述。
>
> 规格：`docs/superpowers/specs/2026-09-16-python-subproject-design.md`
> 清单与设计：`docs/superpowers/specs/2026-09-30-python-phase5-m7a-design.md`、`-m7b-design.md`、`-chunks-design.md`
> 裁决：`docs/superpowers/handoffs/2026-09-30-python-phase5-rulings.md`（§〇 是你在第 5 期末的五条裁决）
> 前几期账本：`2026-09-30-python-phase{1,2,3,4}-deferred.md`

---

## 一、前几期账本 §一 的五件事：第 5 期之后

派发简报 §1.4 要求「§一 的存量问题新内容一个都别再加」。结论：**新内容一个都没加，存量一处没动**；其中两件被你的裁决改了性质（U1、U2）。

「存量没动」的整体证明：`git diff --stat 2349e0f e342ba2 -- 'python/programs/ch0*' 'python/programs/ch1*' 'python/programs/ch20*' 'python/programs/ch21*' 'python/programs/ch22*' 'python/programs/ch24*' … 'python/programs/ch28*'` **为空**；
ch23 只有 `chapter.json` +26 行（#198 给 `library-loans` 加的 `chunks`，讲解没动）；对照：同一命令换成 `'python/programs/ch2*'` 报出 11 个文件、+1116（ch23 的那 1 个 + ch29 的 10 个），路径模式有效。
`2349e0f` 是第 4 期账本的核对基线，所以第 4 期账本里落在这些路径下的 file:line 今天**逐字仍成立**。`python/core/` 只动了 `interact.js` 与它的测试（#198，+760 / −7）。

### 1. 讲解与提示指向「页面上看不到的输出」——**U2 之后是定论，存量成了缺陷清单**
- 存量：第 1 期 27 处、第 2 期 1 处，都在（路径没动）。
- 新内容：用前几期的短语扫 ch29–ch32（「看输出」「输出的第」「打印的第」「屏幕上」「打印出来的」"printed" "the output"…）命中 7 处，逐条看过**全都在描述窗口**（「屏幕上写着 Game over」「blit 把它贴到屏幕上」"a window opens instead of any printed output"），真指向输出 0 处。
- **什么时候必须修**：U2 把「页面不显示输出」定成永久规矩，这 28 处不再是「等裁决」——下一个动 ch01 等那几页的内容 PR 顺手改掉并升版。

### 2. 复制进 PyCharm 时没有 `_fixtures/`——复制仍只带 `.py`
- 本期 0 个新 fixture（全库仍 7 个文件，`git ls-files` 与磁盘相同）。U4 之后人工验收由你在线上做；`copyrun.py` 与门一样拷了 fixture，看不见这一项。

### 3. 判定器在行数不同时完全不比缩进——仍开
- `python/core/judge.js:162` 仍是 `if (na.rel.length === nr.rel.length) {`。
- 新内容：ch29–ch32 的 95 个空里两行空 23 个——16 个「复合语句头 + 一行体」（13 个 `if`、1 个 `for`、**2 个 `elif`**：`keyboard-move-clamped` 的 keydown、`screen-states` 的 keymap），7 个同一层两行，没有跨嵌套块的。
  `elif` 头是例外条款里没列过的一种；本收尾实测（裸 vm、页面内联 core、`b.indent + 写法`，负控制「不拼缩进」判 `lead-indent`）：标准答案判对，体少 / 多缩进一层判 `indent`，写成一行判对——与 `if` 头相同，已写进作者须知的例外条款。

### 4. `boards` 的语义——**用户已裁决：不在考纲就不写；由 boards PR 落地**
- 基线 `e342ba2` 上全库 346 / 346 是四家，本期 36 个照当时的规则写。#203（`08d3935`）已落地：合进来之后全库 boards 分布是 4 家 152、3 家 33、2 家 32、1 家 59、`[]` 70。这里不再列拿不准的表。

### 5. 程序打印内置 / 操作系统的异常消息——存量仍开，新内容 0
- ch29–ch32 没有一个 `except` 块。存量 5 条路径没动。

---

## 二、第 4 期账本逐条的去向

| 第 4 期账本 | 去向 | 今天的实测 / 依据 |
|---|---|---|
| §一.1 讲解指向看不到的输出 | 性质改变（U2） | 见本账本 §一.1 |
| §一.2 复制不带 fixture | 仍开 | §一.2；人工验收关闭为流程项（U4） |
| §一.3 `judge.js:162` | 仍开 | 行号不变；`elif` 头补进例外条款（§一.3） |
| §一.4 boards | **用户已裁决：不在考纲就不写；由 boards PR 落地** | — |
| §一.5 异常消息 | 仍开，新内容 0 | §一.5 |
| §二 第 3 期表（程序长度、钉法缺口、只由 `run.expect` 守、`shuffle-fisher-yates`、isdigit 存量、等价变异注释 `refs/ch21_simulation.py:256-257`、fixture 跟踪门、tag 规范化门） | 全部仍开 | 路径没动（§一 的 diff 为空）；`refs/ch21_simulation.py` 本期未改 |
| §二「参照返回：None」措辞（`library.py`） | 仍开，行号又移了 | `e342ba2` 上 `library.py:538`（超时填 `None`）、`:541`（抛错填 `None`）、`:562` 照样印「参照返回」——#198 / #201 加了代码 |
| §二 tag 词表分裂 / 规范化门 | 存量仍开，本期 0 新增 | 全库 448 个不同 tag；折叠大小写 / 空格 / 连字符后仍只有存量两组（`nested-loops` / `nested loops`、`lookup-table` / `lookup table`）；本期用的是连字符写法（ch29–ch31 `nested-loops`、ch29 `lookup-table`） |
| §三.1 M6 程序偏短 | 仍开（观察项） | 本期反过来偏长：见 §三.5 |
| §三.2 boards 拿不准表 | 用户已裁决：不在考纲就不写；由 boards PR 落地 | — |
| §三.3 钉法缺口（m6a / m6b） | 仍开 | 路径没动 |
| §三.4 「只差实参名」的空 | 仍开 | 路径没动 |
| §三.5 blurb 点名 API | 仍开（设计取舍） | — |
| §三.6 英文跨页写法 | 裁决 P28 生效；存量留账 | 全库英文 `the X page` 37 → **55 段**（本期 +18：ch29 1、ch30 2、ch31 5、ch32 10），「」括英文仍是存量 36 段（ch20 11、ch23 10、ch26 9、ch27 6）、本期 0；ch02 三处 `the Files and Errors page` 仍在 |
| §三.7 tag | 同上 tag 一行 | — |
| §三.8 只由 `run.expect` 守 | 仍开；本期同类见 §四.1 | pygame 程序没有 `run.expect`，不带 P 的 4 个只由 compile 与活体跑帧守 |
| §四.1 等价变异 | 本期新增两条 | §四.4 |
| §四.2 property 门的盲区 | 仍开 | 本期同类：`colour-lerp` 的「恰为 .5」只由一支 cases 守（§四.2） |
| §四.3 matplotlib 的图没人看过 | 仍开；本期同类 | pygame 的窗口同样没人看过（§四.1） |
| §四.4 严格模式 | 生效 | 本期全部验收都用严格模式 + 无头 SDL；CI 每次「0 段因缺库跳过」 |
| §四.5 第 3 期四条建议 | 仍开 | — |
| §五.1 Skill 工具读旧版 | **关闭（U3）** | skill 改写：本波改过 skill 时才需要从 `$W` 读 |
| §五.2 构建者报告写自己 worktree | 生效 | 4 个构建者 0 个 BLOCKED |
| §五.3 临时文件放草稿区 | 生效 | 三份台账里只有报告与脚本；评审 / 复审 / 修复者的导出副本都在草稿区 |
| §五.4 `probe.js` 标准件 | 生效；本期**又出一次自写探针事故** | chunks PR 的一次性探针丢了 3 个 localStorage 键（§三.3）；标准件加了逐键选项（§四.5） |
| §五.5 期控制方合并核验进台账 | 6 / 6（其中 #197 记在第 4 期台账） | #197 的在 `.superpowers/python-phase4/controller-log.md:26`，只有 CI 事实、本地全量没记（裁决 P20） |
| §五.6 起草期原型 | 生效，本期在清单阶段抓到 6 处低命中（m7a keyboard 14、mouse 21；m7b invaders 0、snake 2、pong 1、lives 27，/200） | 但没抓到 lerp 公式错（§七.1）——t 取值不在舍入边界上 |
| §五.7 遗留 worktree / 分支 | 本期清理干净；存量不变 | §五.4 |
| §五.8 设计 §9.2 两份文档 | **#202 已补齐**（`2cc8f5e`，2026-09-30 21:53 UTC，第 6 期文档 PR） | §五.5 |
| §五.9 用户验收 | **关闭（U4）** | — |
| §五.10 等用户的决定 | 五件里四件已裁（U1–U4） | 剩 `core.hooksPath`（§六） |
| §五.11 `git-size-before.txt` 时点 | **又发生一次** | m7a 第三次没记；§七 |
| §六 体积 | 更新 | §八 |

---

## 三、第 5 期留账：内容

### 1. 逐键临摹的首次正确率到不了 100%（存量，不分段也一样）
Enter 的自动缩进在块内空行留下空格，算作首次错误。本收尾的逐键驱动（照人打、缩进差用退格补）在 pong-full 段 1 上是 98%、段 3 97%、`snake-move-list` 整题 98%、`colour-lerp` 98%。
- **为什么没修**：是 `applyEnter` 的设计（带上一行缩进），与 chunks 无关（#198 评审与修复者都记为存量）。**什么时候必须修**：她反馈「空行老是算我错」时；改法是 Enter 在空行上不带缩进，或空行上的空格不计首次错误——改 core、要评审。

### 2. `lives-and-invulnerability` 与 `bullet-cooldown` 是同一类倒计时器，讲解没有互相指回（m7b 范围复审 n4）
- **为什么没修**：一次修复 + 一次复审。**什么时候必须修**：下次升级 py-pygame-games 时加一句中英。

### 3. 8777 上丢了 3 个 localStorage 键（chunks PR 控制方的探针事故）
`restore()` 先 `clear()` 再从页面内存里的快照写回，刷新后快照没了。键名与内容都不知道（推测是语言、偏好或同意横幅）。无法恢复。
- 本收尾把「一次性探针也只按本页键差分复原」写进了坑表。**你如果在 localhost:8777 上看到某个偏好被重置了，原因在这里。**

### 4. 英文「the + 冠词开头的标题」扫描（本收尾 D 项）
扫 `python/programs/*/chapter.json` 的英文字段（中文跳过）与 `.py` 的 `hintEn`：句中 `the A` / `the An` / `the The` 后接大写，外加 22 个冠词开头的程序标题逐个查 `the <标题>`。
- `e342ba2`：**真命中 0**。报出 4 处都是成绩等级 A（`ch06` `grade-boundaries-descending` 两处 "the A test" / "the A question"、`grade-boundaries-ranges` "The A range"、`ch23` `gradebook-classes` "the A line"），逐条看过，不是标题。
- 正对照：同一扫描在修复前的 `8a97b28` 上报出 2 处真命中（`pong-full` 的 "the An AI Paddle with a Speed Limit program"、已删的 `game-state-screens` 的 "the A Traffic Light as a State Machine program"），外加那 4 处等级 A。
- 所以不需要改内容、不升版本。扫描脚本在本收尾的草稿区（`p5close-the-article-scan.py`），逻辑已写进 `python-drill-tool` 的一句规矩。

### 5. 程序长度：本期偏长，四个完整游戏超过选择器的 80 行档
前三页 39–70 行（取向 40–70）；games 页 60–97 行，四个完整游戏 94–97 行（各 3 段），两个 main 段 44 / 45 行（取向 20–40，拆开会把一个函数切成两段）。
- 选择器「不超过 80 行」会把四个游戏连同 `library-loans`（86）一起筛掉——这正是分段的用意（长程序分段练），不是 bug。**什么时候必须修**：若决定「分段程序按最长段算 lines」时。

### 6. `gates/properties.py` 文件头 R6 的字面与 m7a V2 不一致
R6 写「同一个族名下的两个程序……参照也就必须不同，不能共用一份」；m7a 的两个 `rect-overlap` 程序共用一份参照（格点求交），V2 与终审都接受——参照与两种写法机制都不同，R6 的意图满足、字面没满足。
- **为什么没修**：改门文件的注释不在内容波里；**什么时候必须修**：下次动 `properties.py` 时把 R6 改成「参照不能与任何一个被测同源」。

### 7. `library-loans` 段 1 的标题
#198 评审 M5 已改（「常量、异常与两个小类」）；列在这里只为说明 ch23 本期唯一的改动是 `chunks`（§一）。

---

## 四、门与测量看不见的

### 1. pygame 的 `main()` 只被「跑帧」测过，而跑帧只喂一个 QUIT
`live-frames.py` 把 `pygame.event.get` 打桩成第 N 次调用时追加 QUIT——除此之外没有任何输入事件，**`main()` 里处理按键、鼠标、碰撞后果的分支一次都没走到**。
所以跑帧对错答案的判别力弱：m7a 控制方实测首空填 `pass` 只抓到 1/6；本收尾 `copyrun.py --repo $W --chapters ch29-pygame-basics ch30-pygame-sprites ch31-pygame-motion ch32-pygame-games ch26-pandas ch05-files-errors ch21-simulation --seed 20260930 --k 3`，12 个 pygame 程序上 4/12，同一批的 property 那一道 16/16（含 stdlib / scipy）；只抽 ch31 时跑帧 0/3（`copyrun.py` 现在对这种层打 WARN）。
跑帧能测到的是「抛错」「挂住」与（收尾评审 I3 之后）「不到 N 帧就退出」；初版连最后这一种也看不见——一个第一帧就退出的程序报 `OK FRAMES 1` 还印「跑满 30 帧」。修复后 36 个 pygame 程序重跑，全部 `FRAMES 30`。
窗口画出来的样子在任何地方都没有人看过（dummy 驱动不出图），讲解里「窗口里看到什么」只由评审对着代码读。
- **什么时候必须修**：若要测 `main()` 里的分支，驱动要按脚本注入 KEYDOWN / MOUSEBUTTONDOWN 事件——那是另一个测量，写之前先定它要排除什么。

### 2. 取整 / 舍入的边界只在 `colour-lerp` 上专门造过
`refs/ch29_pygame_basics.py` 的 `_colour_pair_t` 一半造「真实值恰为 .5」（t = k/100、k 取 75 个可达值、b 枚举同余候选），它是「lerp 公式写对了没有」的**唯一**守门：去掉这一支、放回旧式，门绿（m7a 修复负控制 B）。
`Rect` 属性赋值的四舍五入（半数远离零，本收尾复测 8001 个值 0 处不符）只写在 refs 头与 `sprite-subclass-group` 的讲解里，没有哪个 P 的 cases 专门造在半数上。
- **什么时候必须修**：再有程序的 P 经过 `Rect` 属性赋值时，照 `python-content-wave` 第 1 步造边界 cases。

### 3. `chunks_check` 不看段的长短（C8，设计如此）；`anchor_check` 与它一起只保证锚唯一、首尾相接

### 4. 等价变异（本期新增两条，下一个做负控制的人别把它们当盲区）
- `lives-and-invulnerability`：被撞后 `invuln = INVULN` 改成 `invuln += INVULN`——算数的撞击发生时 invuln 必为 0.0（m7b 范围复审）。
- m7b 终审的 9 个变异里 3 个「判错写法」证实为等价程序（终审报告 `m7b-ledger/review-report.md`）。

### 5. 标准件自己的测量边界（本收尾新写的，照「一个测量要先见过红」做过负控制）
- **`probe.js` 的 `keys`**：只模拟「照影子打、打完最后一个可见行按一下 Enter」这一种人；自动缩进留在空行里的空格被它退格删掉了（真人可能不删），所以它报的正确率偏高。
  **第一版照参考逐行打、连段尾空行也按了 Enter，在拿掉 `chunkTailFill` 的页面副本上照样「完成」——测不到 #198 I1**；改成只打看得见的部分之后，副本上段 1 停在「你比参考少了 2 行」、探针报红，真页面上 984 个事件完成（与 m7b 控制方手工驱动的 984 相同）。
  副本放在本 worktree 的 `.superpowers/p5close-negctl/`（gitignored、浏览器取得到；草稿区不在 8777 的根下）。
  修复轮合进 #203 之后（页面 engine py-1.3.0）重跑：真页面同一段 984 个事件完成、`doneBeforeLast` 为假、localStorage 前后相同；负控制页从新页面重新生成，照样停在「你比参考少了 2 行」、探针报红。
  同一轮还修了一个探针旧 bug：第一个程序声明了 `chunks`、页面停在别的段时，对齐项量到的是别的段（「different chars」）——现在先切回第 1 段。
- **`copyrun.py`**：收尾的样本是 `copyrun.py --repo $W --chapters ch29-pygame-basics ch30-pygame-sprites ch31-pygame-motion ch32-pygame-games ch26-pandas ch05-files-errors ch21-simulation --seed 20260930 --k 3`（21/21；负控制 run 9/9、跑帧 4/12、property 16/16）。各层分别报，某层 0/n 打 WARN（实测只抽 ch31：「frames 0/3」WARN）；node 取内容失败时抛异常、`finally` 删掉临时的 Exercise 文件（实测把页面的 EXERCISE 区段改坏：rc 1、系统临时目录里没有新留下的 `copyrun-exercise-*.js`）。
  MicroPython 分支只在合成章节上跑过（本机没有 `microbit` 模块、导入靠门的硬件桩；参照左右对调 → 66/200、rc=1）；第一次负控制选了 `x > 300` → `x >= 300`，
  在 randint(−1000, 1000) 的 200 组上一次都没取到 300——**等价于 cases 的定义域**、门照绿，换成左右对调才红。第 6 期第一次真用时再做一次负控制。
- **`live-frames.py`**：`--self-test` 四道对照（OK / SHORT / HANG / ERROR）如期——SHORT 与对照 `exits-early` 是收尾评审 I3 之后加的：初版只看 rc 与末行是否以 FRAMES 开头，评审的负控制（第一帧就 `running = False`）报成 `OK FRAMES 1`；现在报 `SHORT FRAMES 1（应跑满 10 帧）`。路径先 resolve——旧版传相对路径实测报 ERROR（`FileNotFoundError`，子进程 cwd 是临时目录）。
- **`fill-template.py`**：漏键、拼错的键、值里带着没填的槽、REQUIRED 给空串、**REQUIRED 给 null**（收尾评审 m1 之后；初版 rc 0 并静默删掉整行）、模板本身不成对，六种都 rc=1 且不写文件；非 REQUIRED 的可选行给 null 照旧整行去掉；反引号与 `$(…)` 原样进简报。

### 6. 配方脚本的 engine 选项（本收尾）
在草稿区的独立克隆里回放四次真实合并：m7a 集成 basics（`a853573` + `92d4ecf`）与 sprites（`9e58ac9` + `dd686b2`）、m7b 合 #198（`437ac7d` + `6e6f1d7`）加 `--engine-from take`，
暂存结果与当时手工做成的 `9e58ac9`、`4503804`、`5133c85` **逐字节相同**（注册表、两个导航页、有关工具页）；第 4 期 m6b 合 m6a（`8f33413` + `5bae885`，engine 一致、不给选项）与 `9a9101c` 逐字节相同（回归）。
负控制：旧脚本在 basics 那一例上 rc=1（`page_mirror_check` 断言红：「注册表里的 engine 不止一个」）；新脚本不给选项 rc=4、索引与工作区都没动。
**回放发现的事实**：四次里 basics 与 m7b 合 #198 两次**文本都没有冲突**——`git merge --no-ff` 直接自动提交了门红的合并。所以 skill 改成一律 `--no-commit`、没有冲突也跑脚本。

---

## 五、流程上的账

1. **Skill 工具读旧版——关闭（U3）。** 主工作区跟 main；本波改过 skill 时才用 Read 从 `$W` 读。
2. **构建者报告写自己 worktree——生效。** 4 个构建者 0 个 BLOCKED，报告都拷进了台账。**不改**。
3. **期控制方的合并核验——6 / 6 都有记录，其中 #197 记在第 4 期台账。** #197 是第 4 期的收尾 PR，它的核验在 `.superpowers/python-phase4/controller-log.md:26`（CI run 36727089504、head `90a9023`、310 段 0 跳过、203 P、42 门、导航 130），只有 CI 事实、本地全量没记；第 5 期台账只有「→ 9a68732」一句。
   本收尾初稿只读了第 5 期台账，把它写成「6 个里 5 个、#197 缺」——**起草者漏读**，收尾评审 I1 指出（裁决 §五「起草者的失误」）。本收尾用 `gh run view` 补核的 CI 与第 26 行逐项一致。
4. **遗留的 worktree 与分支。** 三份台账记下的都删了（m7a：集成 + 2 个构建者 worktree、5 个分支、origin 集成分支；m7b：同上 5 个分支；chunks：worktree、本地与 origin 分支）。
   收尾当天 22:19（BST）实测：主仓库仍是 **46 个** `worktree-agent-*` 分支、**16 个** `.claude/worktrees/agent-*` 目录——与第 2、3、4 期账本记的数相同，都不是本期的。
   22:19 时正在用的：`claude/python-boards`、`claude/python-docs`、`claude/python-phase5-close`（本 PR）、`claude/python-wave-m8a` / `-m8b`（第 6 期）。`claude/python-subproject-design`（`77a4f35`，第 0 期计划）仍在，归属不明，不删。
   （23:06 BST 复查：`claude/python-docs` 已随 #202 合并，本地分支与 worktree 都已不在；其余四个仍在用。）
5. **设计 §9.2 的两份文档——#202 已补齐**（`2cc8f5e`，2026-09-30 21:53 UTC 合并；`docs/superpowers/python.md` 与 `docs/superpowers/prompts/python-handoff.md`）。
   此前拖欠三次：第 3 期账本说「第 4 期开工前」、第 4 期账本说「第 5 期派构建者之前」，都没做到；第 5 期收尾初稿（基于 `e342ba2`）时两份文件还不存在，第 6 期派发简报把它派给 MDev-02 单独一个 PR，收尾评审期间合并。
   主规格 §9.2 取 main 一侧（#202 写的「第 6 期文档 PR 补齐」），本 PR 只在后面补一句指向这里。
   本收尾新增的标准件（`live-frames.py`、`copyrun.py`、`fill-template.py`、配方脚本的 `--engine-from take`、`probe.js` 的 `keys`）是在 #202 之后才进 main 的——两份文档若要列标准件，下一次动它们时补。
6. **人工验收——关闭为流程项（U4）。** PR 模板删了未勾选项；主规格 §9.1 加了注。
7. **`git-size-before.txt` 又没记时点**（第三次）：m7a 的 `progress.md` 第 0 步没有这一行；m7b 的按台账顺序推得是合 #196 之后的 `4fc58e2`，也没明写。收尾照录（§八）。
8. **中途 `git gc`**：你在主工作区跑了一次 `git gc`（期控制方台账「收尾前」一条），之后的 `count` 从两千多降到两位数、pack 从 26.47 MiB 变成 28.44 MiB——**前后无法直接比增量**（复盘 27），§八 照录。

---

## 六、等你的决定

- **`core.hooksPath` 改成相对路径**（U5）：今天是共享 git 配置里指向主工作区 `.githooks` 的绝对路径，worktree 里提交跑的是主工作区当前分支那一份钩子脚本。控制方已解释、建议改相对路径（`git config core.hooksPath .githooks`，每个 worktree 跑自己那一份）。
- 其余第 4 期列的四件（boards、`run.expect` 显示、主工作区前进、人工验收）都已裁决（U1–U4）。

---

## 七、原描述错在哪（收尾核对发现）

**起草 / 简报错误**一栏在前：

1. **m7a 清单 §0 / D7 的 `Color.lerp` 公式**：`int(a + (b − a)·t + 0.5)` 应为 `int(a·(1 − t) + b·t + 0.5)`（basics 构建者发现）。四次复核的协议与数字照录在裁决 §五；本收尾自己的一次：种子 20260930、5 万组、每组三通道、t = k/100，清单式 133 组不符、实测式 0。
2. **m7a 构建者简报「照 skill 对 pygame 程序的写法处理 run 字段」**：skill 里没有这一写法（两个构建者都报）。
3. **m7a 清单 `keyboard-move-clamped` 签名 `step(pos, keys, step)`**：形参与函数同名（basics 构建者改成 `pixels`）；**`mouse-click-buttons` 的 cases 要求**只写了贴边、漏了「按钮重叠」（没有它，「先列出的赢」对门是瞎的）。
4. **m7a D6「同时结算在 2/200 组上错」**：那是起草原型的 cases；构建者按清单多造「两颗打同一目标」之后同种子 81/200——不是错，是协议不同，refs 头两个数都写了。
5. **m7b 清单 `friction-per-frame` 的参照**与被测同机制；**`bounce-walls` 原型的错误实现**不对应本程序的折返写法（motion 构建者）。
6. **m7b 清单 pong 原型的正确实现 `vy = -vy`**：球下一帧仍与拍子重叠时会被再翻一次、卡进拍子（games 构建者改 `abs`）。
7. **m7b 清单 §1 查重**：漏了并行 m7a 已批准清单里的同题程序（C1）；§3 B4 与 §8 原型表残留 `game-state-screens`（修复者报，控制方 `cd60474` 注明）；规格 breakout 行「一排砖」（范围复审 n1，已改）。
8. **期控制方派发简报 §2.3「一排砖」**：games 构建者做成三行 × 十块，控制方批准——取舍，不是事实错误。
9. **chunks 设计 §7 原裁决「缓冲恰等于 body 时也补」**：会让她习惯性的那一下 Enter 多出一行（实现者 F8b 实测），实现者偏离、接受。
10. **chunks 实现简报漏了 engine 升级规则**（控制方事后补发）。
11. **第 4 期收尾写进 skill 的判定器测量没说要拼缩进**：本收尾实测不拼缩进时报 `lead-indent`（「第 1 行缩进对不上」）；m7b 台账写的是「报 indent」——口径差，本收尾的 skill 文字按实测写 `lead-indent`。

其余：

12. **主规格 §7.1 门表漏了 `chunks_check`**（#198 加了门、没补表）——本收尾补了。
13. **期控制方台账「#196 负控制 8 情形」对 PR 描述的表 7 行**：「缺 pygame」一行含非严格 / 严格两种，口径差。

---

## 八、体积

**页面**（`e342ba2`）：32 页合计 **9,993,782 B**（逐页 gzip -9 之和 3,327,698 B）。新 4 页合计 1,283,649 B：`py-pygame-games` 348,104、`py-pygame-motion` 314,031、`py-pygame-sprites` 310,943、`py-pygame-basics` 310,571。最大的一页仍是 `py-text-data`（351,168）。
前 28 页合计 **8,054,600 → 8,710,133 B**（+655,533）：#198 的 `interact.js` +464 行内联进每一页（约 +23 KB / 页），py-systems 另加 `library-loans` 的分段（304,859 → 329,456）。
第 1–4 期账本的担心应验了：**第一次改 core 重写了全部 28 页**（外加 `_skeleton.html`），这是那一次的量。

**仓库**（`git count-objects -vH`，字段 `count` · `size` · `in-pack` · `size-pack`；整个仓库共用一个 `.git`）：

| 时点 | count | size | in-pack | size-pack | 出处 |
|---|---|---|---|---|---|
| 第 4 期收尾 | 2255 | 25.55 MiB | 6776 | 26.47 MiB | 第 4 期账本 §六 |
| m7a 开工前（时点未记） | 2273 | 25.68 MiB | 6776 | 26.47 MiB | `m7a-ledger/git-size-before.txt` |
| m7b 开工前（按台账顺序约 `4fc58e2`） | 2356 | 26.23 MiB | 6776 | 26.47 MiB | `m7b-ledger/git-size-before.txt` |
| chunks 合并后（#198） | 2566 | 34.39 MiB | 6776 | 26.47 MiB | `chunks-ledger/git-size-after.txt` |
| m7a 合并后（#199） | 2709 | 36.63 MiB | 6776 | 26.47 MiB | `m7a-ledger/git-size-after.txt` |
| — 你在主工作区跑了 `git gc` — | | | | | 期控制方台账 |
| m7b 合并后（#200） | 61 | 928.00 KiB | 8690 | 28.44 MiB | `m7b-ledger/git-size-after.txt` |
| 收尾当天 | 91 | 1.11 MiB | 8690 | 28.44 MiB | 本收尾在主工作区只读实测，2026-09-30 22:19 BST |

gc 之前第 5 期的增量全是松散对象（第 4 期收尾到 #199：+454 个、+11.08 MiB，其中 #198 重写 28 页占大头）；gc 之后松散对象打进了包，pack 从 26.47 涨到 28.44 MiB——
包是压缩过的增量表示，与之前的松散大小不可比，**第 5 期的真实净增量无法从这些数算出来**（复盘 27）。

---

## 九、复盘条目（`retro-items.md` 1–27）的去向

`CW` = `python-content-wave/SKILL.md`，`DT` = `python-drill-tool/SKILL.md`，`BB` = `builder-brief.md`，`FR` = `final-review-brief.md`。

| # | 条目 | 落到哪 / 不改的理由 |
|---|---|---|
| 1 | engine 升而页面行为不变时不升 tool-version | DT 作业 C 新增一段（前提：未启用新功能的页逐字节无行为差、评审核过） |
| 2 | 交互 UI 的浏览器验收要逐键 | `probe.js` 新选项 `keys`；CW「浏览器验收」一条与红旗；FR「逐键」一节；DT chunks 一节 |
| 3 | 自写探针 `clear()` 后快照丢失 | CW 已知的坑新增一行；标准件早已按本页键差分复原；丢键留账 §三.3 |
| 4 | 留账：逐键首次正确率、草稿格式单向 | **留账** §三.1；草稿格式单向写进 DT chunks 一节的「已知限制」 |
| 5 | `eb824e2` 单独不绿 | DT 作业 C 新增「改 core 与重内联放进同一个提交」 |
| 6 | 合 main 后 engine 升级是门红不是文本冲突 | CW 第 6 步（一律 `--no-commit`、没冲突也跑脚本、退出码 4 → `--engine-from take`）；配方脚本本身（见 15） |
| 7 | 不带引号的 heredoc 吃掉一行 | CW 坑表那一行补了本期的事例；`fill-template.py`（见 24） |
| 8 | 跨波「概念 → 页」对照 | CW 第 1 步新增一条；BB 新 REQUIRED 槽「跨波概念对照」 |
| 9 | lerp 公式错；原型要在舍入边界上测 | CW 第 1 步新增一条（边界 cases + 「换一种舍入 → 红」+ 本期反例）；DT property 一节；BB 规矩一条 |
| 10 | 配方脚本在 engine 分歧时无法处理 | 同 15 |
| 11 | pygame 复制真跑：跑帧判别力弱，property 那一道为主 | 标准件 `copyrun.py`（推广到三层）；CW 第 4 步重写 |
| 12 | skill 缺「pygame 不写 run」；FR 判定器用裸 vm；live-frames 须绝对路径 | DT 新增一段（pygame 与 MicroPython 都不写 `run`，定论）；BB；FR「内容」一节改成裸 vm；`live-frames.py` 自己先 resolve 路径（**结构上免掉**「须传绝对路径」，见裁决 P21） |
| 13 | 同 9 | 同 9 |
| 14 | `copyrun.py` 与 `live-frames.py` 收进 skill | 两个标准件进 `.claude/skills/python-content-wave/`；CW 开头与第 4 步 |
| 15 | 配方脚本加 `--engine-from take` | 做了：退出码 4 + `--engine-from take`；四次真实合并回放（§四.6） |
| 16 | 「实测行为」标注测了多少组 | CW 第 1 步；BB 报告第 7 项；DT property 一节（`Rect` 那条本收尾复测并标注了） |
| 17 | 仓库体积、`git gc` 交用户 | **已由你做了**（台账）；不改 skill——第 0 / 7 步照旧量前后，gc 的影响照录（§八） |
| 18 | 两波并行的程序查重 | CW 第 1 步新增一条与红旗 |
| 19 | 英文冠词开头标题不加 the；收尾扫全库 | DT 与 BB 各一句；扫描结果 §三.4（今天 0 处，正对照 2 处） |
| 20 | DT「本期不用 chunks」过时 | DT 删掉，改成「分段临摹 `chunks`」一节（写法、首段 / 末段、段到下一段 from 为止、20–40 行取向、标题、门、逐键、已知限制）；门表加 `chunks_check` 一行 |
| 21 | 低命中阈值与 cases 构造原样进简报 | CW 第 1 步；BB 新 REQUIRED 槽「低命中与 cases 构造」 |
| 22 | 逐键验收做成 `probe.js` 选项 | 同 2；本收尾在 py-pygame-games 上实测（显式 tabId、本页键差分复原、负控制页） |
| 23 | 判定器实测一律 `b.indent + 写法`、先断言标准答案判对 | DT、CW 第 5 步、BB、FR 四处（按本收尾实测写成 `lead-indent`，见 §七.11） |
| 24 | 填模板的小脚本 | `fill-template.py`（本目录）；三份模板改成可按键填（final-review 的三个无名槽起了名，PR 模板重写了槽名与可选行）；CW 第 2、5、6 步让控制方用它；红旗一条 |
| 25 | ugrep 长 Unicode 交替报 complexity 错；工具命令失败先验证 | CW 坑表两行 |
| 26 | 一次性探针也按本页键差分复原 | 同 3 |
| 27 | 体积：中途 gc，无法比增量 | **不改 skill**：一次性事件；§八 如实记 |
