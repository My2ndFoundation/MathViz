# Python 子项目 · 第 5 期的裁决

> 这些是控制方在**没有人类在场时**替你做的决定，外加你自己在第 5 期末拍板的五件事（§〇）。每一条记着：
> **决定了什么 · 为什么 · 如果判错了代价是什么**。读它，把判错的地方推翻。
>
> 规格：`docs/superpowers/specs/2026-09-30-python-phase5-m7a-design.md`（§8）、`-m7b-design.md`（§9、§9.1）、`-chunks-design.md`（§5–§7）
> 账本：`docs/superpowers/handoffs/2026-09-30-python-phase5-deferred.md`
> PR：#196（pygame 层开工前提）· #197（第 4 期收尾）· #198（chunks 分段临摹落地）· #199（m7a）· #200（m7b）· #201（MicroPython 层开工前提，第 6 期用）

**第 5 期有三个控制方。** 会话「Python编程」写派发简报（`phase5-brief.md`）、开 #196 与 #201、收第 4 期的尾（#197）、审两波清单与 chunks 设计、集中合并；
MDev-01 做 m7a（`py-pygame-basics` / `py-pygame-sprites`），MDev-02 做 m7b（`py-pygame-motion` / `py-pygame-games`）**外加** chunks PR（#198），两波并行。
下面 §一 是 Python编程 的，§二 是 MDev-01 的，§三、§四 是 MDev-02 的（m7b 与 chunks 各一节）。

**来源。** 三方的台账都活着（主工作区 `.superpowers/python-phase5/`，gitignored，**不在仓库里**）：派发简报 `phase5-brief.md`、期控制方台账 `controller-log.md`、复盘条目 `retro-items.md`（1–27）、
`m7a-ledger/`（29 项；裁决 V1–V7 有编号、理由多有原话，代价多数没写）、`m7b-ledger/`（46 项；`progress.md` 末尾 11 条裁决三栏齐全）、`chunks-ledger/`（13 项；9 条裁决三栏齐全）。
期控制方台账逐个 PR 记了合并前核验（第 3 期裁决 §四的要求，第 4 期起做到），照录在 P20；**#197 例外**，台账只有一句「→ 9a68732」，本收尾用 `gh` 补核了 CI。

---

## 〇、你（用户）在第 5 期末的裁决（出处：用户，2026-09-30）

**U1 · `boards`：不在考纲里就不写（空列表合法）。** 由 boards PR 落地。本收尾不碰 boards 的任何句子；第 5 期 36 个程序照当时的规则四家全写。

**U2 · 页面不显示运行结果（`run.expect` 只给门用）——定论。** 第 1 期起一直挂在「等用户」里的那一条关闭。「讲解与提示别指向页面上看不到的输出」从此是永久规矩，不再是等裁决的临时做法。

**U3 · 主工作区跟 main 同步：期控制方每次合并之后、主工作区干净时快进它。** 第 3、4 期账本「Skill 工具读主工作区旧版」那条因此关闭。
skill 的写法随之改了：主工作区已同步、Skill 工具可用；**本波或并行的收尾 PR 改过 skill 时**，集成 worktree 里才是新版，仍用 Read 从 `$W` 读（`python-content-wave` 第 0 步、已知的坑、红旗）。

**U4 · 人工验收（`file://` 双击、复制粘进 PyCharm 真跑）关闭为流程项：你已在线上验收，有 bug 会提。** 第 1–4 期每个内容 PR 都把它列成未勾选项、没有一次勾上。
PR 模板删了那一项、改成一句说明；主规格 §9.1 第 4、5 条下加了注（控制方一侧的替代测量是 `copyrun.py` 与 `live-frames.py`，它们与门一样拷了 fixture、装了无头 SDL，看不见「粘进 PyCharm 缺数据文件」「本机没装库」）。

**U5 · `core.hooksPath` 改相对路径：你问了它是什么，控制方解释并建议改相对路径——待你决定。** 列在账本 §六「等你的决定」。

---

## 一、Python编程（期控制方）

### 期初（派发简报 `phase5-brief.md` §2、§3）

**P1 · pygame 程序的结构：纯逻辑函数 + `main()` + 恰好一个 `if __name__ == "__main__":`；顶层只许 import / def / class / docstring / 常量赋值（调用只许 `pygame.Color` / `Rect` / `Vector2`）。**
— 理由（简报）：property 要能导入模块、调纯逻辑函数；主循环在顶层时导入就挂住。— 代价：缺。可核的后果：`pygame_main_guard_check`（#196）；36 个程序全过（CI「pygame 顶层：36 个」）。

**P2 · `requires: ["pygame"]`、没有 `run.expect`，正确性主要靠 property：每页至少一半程序在纯逻辑函数上挂 P；入口收内置值、返回内置类型（`Rect` / `Vector2` → `tuple`），参照纯 Python、不 import pygame、机制不同。**
— 代价：缺。可核的后果：36 个程序 32 个带 P（ch29 7、ch30 7、ch31 9、ch32 9）；`mask-pixel-collision`、`move-per-frame`、`window-and-game-loop`、`image-save-and-load` 不带（m7a D8 与构建者判断）。

**P3 · 帧率无关：运动函数收 `dt`（秒）；浮点 `round(v, 9)` 或整数 cases；随机只许 `random.Random(<固定种子>)` 或 `rng` 当实参。** — 代价：缺。
可核的后果：全期只有 `snake-full` 构造 `random.Random(`（本收尾扫 ch29–ch32），property 不经过 rng；games 构建者在 3.9.6 / 3.12.9 上比对了它的随机那一半（2000 步、132 行 `cmp` 相同，版本负控制两边不同）。

**P4 · 资源：不带外部文件；图像在代码里画，要讲 `image.load` 就先 `image.save`；字体只用 `pygame.font.Font(None, size)`；不用 `_fixtures/`；讲解按「页面不显示输出」写窗口里看到什么。** — 代价：缺。可核的后果：本期 0 个 fixture（全库仍 7 个文件）。

**P5 · 长度：basics / sprites / motion 取向 40–70 行；games 可到约 120 行但必须声明 `chunks`（每段 20–40 行），前提是 chunks PR 已合并；一个游戏只做机制完整的最小版本。**
— 代价：缺。可核的后果：实交 39–70 行（前三页）、60–97 行（games）；四个完整游戏各 3 段；「一排砖」被 games 构建者做成三行 × 十块、控制方批准（P13）。

**P6 · chunks 落地是本期唯一授权改 `python/core/` 的地方，派给 MDev-02 单独一个 PR；设计先回报、批准再实现；chunks PR 合并前 games 页不派构建者。**
— 理由（台账）：主规格 §2.3 / §4 早定义了 `chunks`，`anchor_check` 也验锚，但 `python/core/` 里 `grep chunk` 为空——第 3、4 期「不用 chunks」就是因为这一支从没被真实数据走过。— 代价：缺。

**P7 · 沿用：起草期原型四件套报命中数；tag 先 grep，本期共有 tag `pygame` / `game-loop` / `event` / `collision` / `sprite` / `vector`；boards 照当时现行规则四家全写（U1 之后由 boards PR 改）；程序可用前六个模块的一切，讲解只点出「见「页名」」。**
— 代价：缺。可核的后果：本期新造 16 个只在 ch29–ch32 出现的 tag，折叠大小写 / 空格 / 连字符后没有新分裂（`nested-loops`、`lookup-table` 用的是连字符写法，存量分裂两组不变）。

### 清单审批

**P8 · m7a 清单批准（`e9a1011`，18 程序 / 2 组 / 14 P；规格 §8 M7A-D1…D9）。** 事件归 basics、motion 只讲「输入 → 速度 / 加速度」（已告 MDev-02）；低命中两题贴边 cases ≥ 1/3；
`group-collide-kill` 按顺序结算写参照、refs 头注明；实测 pygame 行为进 refs 头；`mask-pixel-collision` / `move-per-frame` 不挂 P 接受。 — 代价：缺。
**本收尾补一条：§0 实测的五条 pygame 行为里，`Color.lerp` 那条公式是错的**（§五），控制方批准时没有复测。

**P9 · m7b 清单批准（`4fc58e2`，18 程序全挂 P、4 个 chunks、3 组）。** 游戏不用 `Sprite` 类；三处低命中的 cases 构造写进构建者简报；英文跨页写 `the <页名> page`；motion 构建者也等第 4 期收尾合并后再派（两波同版模板）。
— 代价：缺。**本收尾补一条：批准时只交叉核了两波的组名，没有逐个程序核「是不是同一道题」**——`game-state-screens` 与 m7a 已批准的 `screen-states` 同题，漏到终审（C1，§五）。

**P10 · chunks 设计批准（`e09da83`）：C1–C8 全按推荐，另加六条（首段覆盖文本开头并单列负控制；新 UI 走 `t()`、窄屏 nowrap + 省略号；切段不丢草稿；core 测试覆盖边界；py-systems 1.1.0；显式 tabId）。**
详见 §四。— 代价：缺。

### 集成期

**P11 · 第 4 期收尾（#197）合并后，两波才派构建者（m7a、m7b 的 motion）；games 另等 #198。** — 理由：两波同一版模板（`checkout -B`、报告写构建者自己 worktree、本波共有约定表槽、`probe.js` 标准件）。
— 代价：只耗时。可核的后果：4 个构建者 0 个 BLOCKED。

**P12 · m7a 集成时 engine 不一致（构建者基于 py-1.1.x、集成分支已合 #198）：手工配方 + 把两页注册表 engine 与 `tool-engine` meta 改成 py-1.2.0。** — 理由（m7a 台账）：配方脚本会因「engine 全库唯一」红。
— 代价：缺。**本收尾把这个手工步骤做成了配方脚本的 `--engine-from take`**，拿那两次真实合并回放、暂存结果与当时手工做成的 `9e58ac9`、`4503804` 逐字节相同（账本 §四.6）。

**P13 · 对 m7b 第 2 次回报的裁决：打砖块三行 × 十块接受（改控制方简报的「一排」）；反弹一律 `abs`、`AI_SPEED` 150、snake 先弹尾再判撞、main 段 44 / 45 行超取向，都同意；friction 参照用 `Fraction` 好；diagonal 参照交终审；「速度 × dt」在「pygame 入门」页，motion 讲解可明说。**
— 理由：各有构建者的实测理由（单纯取反球会卡进拍子；AI 速度 240 时电脑一球不漏）。— 代价：缺。可核的后果：终审「构建者偏离全部同意」；规格 §9.1。

**P14 · m7b 终审 C1 的裁决：`game-state-screens` 换成 `lives-and-invulnerability`（推荐项），P 在 `take_hit`，三支 cases + 无敌到期边界。** — 理由：与 m7a 已合并的 `screen-states` 同题。
— 代价：多一轮修复里写一个新程序。可核的后果：新程序 61 行、3 空、200/200；原型四个错误实现 52 / 73 / 63 / 74（/200），首版「恰为 0」只命中 27，把「到期那一帧且被击中」调到四成才过 50。

**P15 · 英文跨页指程序标题、标题以冠词开头时不再加 the（m7b 终审 M5，控制方同意，收尾统一）。** — 理由：`the An AI Paddle…` 不成英文。
— 代价：缺。可核的后果：本收尾扫全库（§D，账本 §三.4）今天 0 处真命中；扫描在修复前的 `8a97b28` 上报出 2 处（正对照）。已写进 `python-drill-tool` 与 `builder-brief.md`。

**P16 · 用户四项裁决（U1–U4）下达时，m7b 已开 PR：m7b 的 boards 本波不动，合并后由 boards PR 统一改。** — 代价：boards 那一栏在 ch31–ch32 上暂时照旧规则。

### 门

**P17 · #196：pygame 层的开工前提**——CI 钉 `pygame==2.6.1`、无头 SDL；property 可挂 pygame 逻辑函数、导入限时 10 秒；新门 `pygame_main_guard_check`（41 → 42）。
— 负控制（PR 描述，全部断言红、无 Traceback）：合规两边绿；逻辑变异 property 红；**顶层 `pygame.init()` / `set_mode` 只有结构门红、property 照样绿**（无头 SDL 下导入成功——这是这道门存在的理由）；
顶层 `while True` 两道都红（导入超过 10 秒、没挂死）；无 main 守卫结构门红；MicroPython 挂 property 红；缺 pygame 非严格跳过 / 严格红。
（台账写「8 情形」，PR 描述的表是 7 行——「缺 pygame」一行含非严格 / 严格两种，口径差，不是漏了一种。）— 代价：缺。

**P18 · #201：MicroPython 层的开工前提**（第 6 期用，第 5 期收尾期间合并）——`runtime: micropython-*` 的程序可挂 property，导入前装**硬件桩**（取属性得桩、调用即 `HardwareStubCalled`，`const()` 恒等、`Image(...)` 纯值）；
新门 `micropython_main_guard_check`（43 → 44）。— 负控制（PR 描述）：合规绿、桩不泄漏；逻辑变异 property 红；入口调 `button_a.was_pressed()` → `HardwareStubCalled` 红；顶层 `display.show` / `Pin(...)` 结构门红；
顶层 `while True` 两道红；无守卫红。**第一轮基线是红的**（`const(3)` 被当成硬件、空桩 `import *` 取不到 `Image`）——红得没有理由，查因修桩后重跑。— 代价：缺。

**P19 · chunks PR 新门 `chunks_check`（42 → 43），裁决与负控制见 §四。**

### 合并

**P20 · 六个 PR 的合并前核验。** 出自 `controller-log.md`；CI run、head、开合时间、合并提交、范围本收尾用 `gh pr view` / `gh run view --log` / `git diff --shortstat <合并>^1 <合并>` 逐个复核过。
合并顺序：#196 → #197 → #198 → #199（m7a）→ #200（m7b）→ #201。每个都用 `--match-head-commit` 合并；合并之后主工作区快进（U3）。

| PR | head | CI run（全部 success） | 开 → 合（UTC） | 合并提交 | 范围 | 本地全量 / CI 读到的 | 控制方自选负控制 |
|---|---|---|---|---|---|---|---|
| #196 pygame 层 | `d95f5dd` | 36721985620 | 13:29 → 13:34 | `8493a5f` | 5 文件 +146 / −11 | CI：CPython 3.12.14、`scipy-stack 2.3.1 2.3.0 3.10.3`、`pygame 2.6.1 dummy`、310 段 0 跳过、203 P、「pygame 顶层：今天 0 个」、42 道门、导航 130 | PR 作者即控制方：见 P17 |
| #197 第 4 期收尾 | `90a9023` | 36727089504 | 14:10 → 14:51 | `9a68732` | 11 文件 +959 / −44 | **台账只记「→ 9a68732」，本地全量缺记录**；本收尾补核 CI：同上各行、42 道门、导航 130 | —（文档 PR） |
| #198 chunks | `a40e001` | 36732395825 | 14:13 → 15:18 | `6e6f1d7` | 38 文件 +14575 / −272；注册表删除行只有 engine / version | verify-198 严格全量：43 道门、导航 130、品牌 139、根注册表、画廊背景 4；「分段：library-loans 3 段（1–22 · 25–58 · 61–86）」；浏览器（8777，tab-2，`TOOL.id` = py-systems 1.1.0，engine py-1.2.0）：段条、影子只显示第 1 段、无 chunks 的程序无段条、控制台 0 错误；CI 同上 + 43 道门 | `chapter.json` 交换 chunks[1] / [2] → `chunks_check` 断言红（from 第 25 行不在 to 第 86 行之后）；core `chunkTotals` 丢掉 errors → `interact.test` 两条 ✗；复原复绿（354 条） |
| #199 m7a | `745abf0`（= origin 分支头） | 36741363291 | 16:03 → 16:06 | `2ece8d7` | 28 文件 +13303 / −0（注册表 / 导航页 0 删除行） | verify-199 严格 + 无头 SDL：43 道门、310 真跑 + 18 只过 compile、0 跳过、217 P 行尾无跳过、pygame 顶层 18、导航 132、品牌 141、根注册表、画廊 4；CI 一致 | `animation-frames` `min(step, n_frames - 1)` → `min(step, n_frames)` 断言红（4 对 3）；`colour-lerp` `tuple(mixed)[:3]` → `list(…)` 断言红（list ≠ tuple）；另独立核 `Color.lerp` 5 万组 t = k/100：新式 0 差、旧式 66 差 |
| #200 m7b | `42e0d90` | 36745516760 | 16:37 → 21:04 | `b656e87` | 28 文件 +13734 / −0 | verify-200 严格 + 无头 SDL：43 道门、310 + 36 compile、0 跳过、235 P、chunks 5 程序 15 段、导航 134、品牌 143；CI 一致 | `snake-full` `body[:-1]` → `body` 断言红（长度 4 ≠ 3）；`screen-wrap` `% WIDTH` → `% (WIDTH - 1)` 断言红；复原复绿 |
| #201 MicroPython 层 | `c446492` | 36777551777 | 21:09 → 21:12 | `e342ba2` | 4 文件 +153 / −5 | CI：`pygame 2.6.1 dummy`、346 段（310 真跑 + 36 compile）0 跳过、235 P、「MicroPython 顶层：今天 0 个」、44 道门、导航 134 | PR 作者即控制方：见 P18 |

— 理由：`python-content-wave` 第 7 步「在 PR head 上自己跑一遍、外加一个不是作者做过的负控制」。— 代价：缺。
本收尾复核：六个 run 的 `headSha` 都等于上表 head、conclusion 都是 success；日志里的门数、段数、P 数、导航项数与上表逐一相同。

### 收尾

**P21 · 本收尾起草者的做法（交控制方审）。**
- 配方脚本加 `--engine-from take` 与退出码 4，**并**把合并一律改成 `git merge --no-commit --no-ff`、没有冲突也跑脚本——简报让我在「加选项」与「写手工配方」之间选一个；回放发现两次 engine 不一致的合并里**两次都是文本干净的**（m7a basics、m7b 合 #198），git 会自动提交一个门红的合并，脚本根本没机会跑。所以只加选项不够，`--no-commit` 这一半是必须的。
- `copyrun.py` 从「pygame 版」推广到三层（有 `run.expect` 的真跑、pygame 跑帧、带 P 的比参照；MicroPython 装门的硬件桩）——第 6 期派发简报已点名要它的第二道测量，而第 4 步的 stdlib 复制真跑原来没有标准件。
- `probe.js` 的逐键选项照人打（只打影子层看得见的部分），见账本 §四.5：第一版照参考逐行打，在拿掉 `chunkTailFill` 的负控制页上照样「完成」。
- 主规格 §7.1 的门表缺 `chunks_check` 一行（#198 没补），本收尾补了——超出简报 B 的范围（B 只说 §9），是文档与门的一致性修正。
- 复盘 12 说「`live-frames.py` 须传绝对路径」：标准件改成自己先 `resolve()` 路径，写进 skill 的是「不必记得」而不是「要记得」（旧版传相对路径实测报 ERROR，新版 OK）。
- 复盘 23 与 m7b 台账说「不拼缩进时判定器报 indent」：本收尾实测报的是 `lead-indent`（「第 1 行缩进对不上」），skill 按实测写。同一次实测发现两行空的例外条款漏了 `elif` 头（ch29 两处），补进作者须知。
- 主规格 §9.1 第 4、5 条（`file://` 与 PyCharm 验收）按 U4 加了注——简报 B 没点名，但 U4 让那两条原文与现行流程不符。

---

## 二、m7a 控制方（MDev-01，#199）

清单裁决（规格 §8，Python编程 审）：

| # | 决定 | 理由 | 判错的代价 |
|---|---|---|---|
| M7A-D1 | 页名「pygame 入门 / Pygame Basics」「精灵与碰撞 / Sprites & Collisions」 | 第 3 期起页名在清单里定 | 缺 |
| M7A-D2 | 组名 `frame-independent-motion`、`rect-overlap`，全库无撞；与 m7b 的交叉核由 Python编程 做 | `variant_check` 按全库分组 | 缺（P9：交叉核只核了组名） |
| M7A-D3 | §3.1–§3.3 边界同意（运动物理归 motion、碰撞归 sprites、状态机只用） | 一个知识点只在一页讲 | 缺 |
| M7A-D4 | 事件归 basics；motion 只讲「输入 → 速度 / 加速度」，讲解指回「pygame 入门」 | 同上 | 缺 |
| M7A-D5 | 低命中两条 P（keyboard 14/200、mouse 21/200）贴边 cases ≥ 1/3 | 原型：贴边才露馅 | 缺；实交 77 / 85（/200），终审在门的实参流上复数一致 |
| M7A-D6 | `group-collide-kill` 参照按顺序结算、refs 头写明「同时结算在 2/200 组上错，这是讲点」 | 顺序结算是 pygame 语义 | 缺；构建者多造「两颗打同一目标」后同种子 81/200（V1） |
| M7A-D7 | §0 实测的五条 pygame 行为写进 refs 头与讲解 | 构建者别凭记忆 | **其中 lerp 公式是错的**（§五），代价是一轮修复与一个 Important |
| M7A-D8 | `mask-pixel-collision`、`move-per-frame` 不挂 P | 由 compile 与活体跑帧守 | 缺 |
| M7A-D9 | boards 照现行规则四家全写，表进台账 | 当时的规则（U1 之前） | 缺 |

集成与评审期（`m7a-ledger/progress.md`；V1–V7 全部被 Python编程 接受）：

- **V1 · D6 的数字：原型 2/200 与构建者 81/200 两个数都写进 refs 头、写明协议差别——接受。** 理由（原话）：写协议不写期望值的实例。代价：缺。
- **V2 · 两个 `rect-overlap` 程序共用同一参照（格点求交，按 id 各登记）——接受，交终审核。** 理由：参照与两种写法机制都不同，R6 的意图是「机制不同」，ch11 `word-count` 有先例。
  代价：缺；终审认可。（注意 `gates/properties.py` 文件头 R6 的字面是「同族两个程序参照也必须不同」——与这条字面冲突、意图一致，留账 §三.6。）
- **V3 · colliderect 版 cases 加一成零宽高矩形——接受。** 理由：它是「函数体被换成手写比较」的唯一守门。代价：缺。
- **V4 · 修复波把 lerp 参照改成实测公式、放开 t——** 理由：限定 t = k/64 是在迁就错参照。**判错了一半**：终审 I1 实测只放开 t 门对新旧参照都绿，V4 缺负控制（§五）。
- **V5 · 修复范围 = I1–I3、M1–M4；M5（skill 缺「pygame 不写 run」）交 Python编程 补 skill；I1 照评审方案做，并做「旧参照放回 → 门红」负控制。** 代价：缺。本收尾补了 M5（`python-drill-tool`）。
- **V6 · 修复者用「枚举同余候选」代替评审写的拒绝采样——接受。** 理由（修复报告）：b − a 能取 256 个连续整数、超过模 100 一整圈，候选必非空、不会挂。这是「我的做法与简报不一致、而我的做法更对」的一例。
- **V7 · 范围复审的 N1（mask 讲解 a / b 失去先行词）与两处第 2 级近乎念出整行，由控制方直接改（讲解一句、提示两处），不再复审 → `745abf0`。** 代价：缺；严格 43 绿。

---

## 三、m7b 控制方（MDev-02，#200）

m7b 台账末尾的 11 条裁决，三栏原文照录：

1. **motion 去掉逐帧 / 按秒位移对照，从加速度讲起** — 理由：m7a 已讲速度 × dt。 — 代价：无。
2. **起草原型三处低命中改 cases（invaders 0 → 24、snake 2 → 61、pong 1 → 84）写进简报** — 理由：首版 cases 走不到那一支。 — 代价：门对那一支是瞎的。
3. **motion 构建者先派、games 等 chunks 合并** — 理由：依赖。 — 代价：只耗时。
4. **合 #198 后文本无冲突但 engine 不一致 → 手工把 motion 条目与页面升 py-1.2.0、重内联** — 理由：门点名。 — 代价：无（门守着）。（本收尾：做成了配方脚本 `--engine-from take`，回放与 `5133c85` 逐字节相同。）
5. **接受 games 构建者：abs 定方向、AI_SPEED 150、snake 变体顺序、main 段 44 / 45 行** — 理由：各有实测理由。 — 代价：无。
6. **打砖块三行交 Python编程 裁（已批准）** — 理由：改的是期控制方的裁决。 — 代价：无。
7. **C1 换成 lives-and-invulnerability（Python编程 裁）** — 理由：与 m7a 同题。 — 代价：无。
8. **C1 边界「恰为 0 不无敌」并在原型里把「到期那一帧且被击中」调到四成** — 理由：首版该错误实现只命中 27。 — 代价：门对边界是瞎的。
9. **范围复审 n1 / n2 只动文字，控制方直接落地 + 判定器实测（skill 第 5 步新规）** — 理由：不开第二轮修复。 — 代价：钉法漏一种写法——判定器表已核（`n2-blankfeedback.txt`）。
10. **n3 接受、n4 留账** — 理由：一次修复 + 一次复审。 — 代价：学生不知道两个倒计时器同类（账本 §三.2）。
11. **英文冠词开头标题不加 the（M5，Python编程 同意）** — 理由：避免 the An …。 — 代价：两波写法不一（本收尾扫全库统一：今天 0 处）。

**未编号、但台账里写着的决定**：
- motion 构建者的清单纠错全部接受：`friction-per-frame` 的参照「逐帧乘」与被测同机制 → `Fraction` 精确乘；`bounce-walls` 原型的错误实现（贴墙单纯取反）不对应本程序的折返写法 → 改测「位置折回、速度单纯取反」（45/200）。
- 修复者两处偏离接受：中文跨页写「…」**一页**（与全页与 skill 例子一致，不是简报写的「…」页）；M5 去掉 the 时连 program 一起去掉（`An AI Paddle with a Speed Limit is about exactly this`）。
- 集成：games 干净合并；合 origin/main（m7a #199）用配方脚本 `--take MERGE_HEAD --from HEAD` rc = 0 → `d8896c3`。
- 用户裁决（Python编程 转达，U1–U3）在开 PR 前收到；清理：集成 worktree、两个构建者 worktree、5 个本地分支（均核 ancestor）、origin 集成分支。

---

## 四、chunks 分段临摹（MDev-02，#198）

### 设计裁决 C1–C8（规格 `-chunks-design.md` §5，Python编程 全按推荐批准）

| # | 问题 | 决定 | 理由（设计原文） | 判错的代价 |
|---|---|---|---|---|
| C1 | 段的范围 | 到下一段 `from` 为止（`to` 只作校验） | 闭区间丢段间空行、拼不回原文 | 段尾空行要特别处理——果然出了评审 I1，解法是 `chunkTailFill` |
| C2 | 加不加门 | 加 `chunks_check`（形状、顺序、相接、≥ 2 段、JS 与门一致） | 门与 UI 用同一解析 | 门多一道 |
| C3 | 影子层显示什么 | 只显示当前段 | 三层坐标系不变、对齐引擎不动 | 她看不到上下文（段条写了行号范围） |
| C4 | 段打完自动跳吗 | 不自动，给「下一段」按钮 | 她可能想回看 | 缺 |
| C5 | 「重来」的范围 | 当前段；整题重来走已有清空 | 缺 | 缺 |
| C6 | 分段程序的 progress | schema 不变，N 段都干净打完时按全程汇总写一次 | 缺 | 缺 |
| C7 | 活体验收程序 | `library-loans`（py-systems 升次版本） | 86 行、现成的长程序 | 缺 |
| C8 | 段数 / 行数进门吗 | 段数 ≥ 2 进门；每段行数只是取向 | 缺 | 缺（第 5 期两个 main 段 44 / 45 行） |

**附加条件（设计 §6）**：① 首段 `from` 必须是 clean 文本的第一个非空行，负控制单列（首段指向第 5 行 → 红）；② 新 UI 文字全走 `t()`，窄屏不换行、省略号截断、不靠调常量；
③ 切段不丢草稿、刷新恢复同段同缓冲，浏览器实测；④ core 测试覆盖 `chunkSegments` 的四种边界，每组至少一条断言先改坏看它红；⑤ py-systems 1.0.0 → 1.1.0；⑥ 显式 tabId、每段都量三层对齐。
**评审修复轮补记（§7）**：`chunkTailFill` 段尾自动补齐；`chunkResumedAny` 让「全程不计」说出来；已知限制「分段草稿格式单向」。

### chunks 台账的 9 条裁决（三栏原文）

1. **段到下一段 from 为止（C1）** — 理由：闭区间丢段间空行、拼不回原文。 — 代价：段尾空行要特别处理（→ I1 自动补齐）。
2. **加门 chunks_check，第 4 条在裸 vm 里比页面内联** — 理由：门与 UI 用同一解析。 — 代价：门多一道。
3. **影子只显示当前段（C3）** — 理由：trace.js 不动、三层坐标不变。 — 代价：她看不到上下文（段条写了行号范围）。
4. **实现派 opus 实现者、控制方并行起草 m7b 清单** — 理由：省时。 — 代价：简报漏了 engine 升级规则——事后补发（控制方疏漏，§五）。
5. **其余 27 页不升 tool-version** — 理由：评审核过不分段路径逐字节无行为差。 — 代价：旧缓存页读不到新 core，但行为相同。（本收尾写进 `python-drill-tool` 作业 C。）
6. **I1 用「打完末个非空行并按 Enter 时自动补齐段尾空行」** — 理由：空行不是练习；缓冲仍拼回原文。 — 代价：少练两个 Enter。
7. **接受实现者对 I1 的偏离（缓冲恰等于去尾空行时不补）** — 理由：否则她习惯的 Enter 多出一行（F8b 实测）。 — 代价：段要等她按 Enter 才完成。
8. **控制方负控制与评审变异都放导出副本** — 理由：不动评审正在读的 worktree。 — 代价：无。
9. **不 squash、PR 描述写明 eb824e2 单独不绿** — 理由：合并提交保留历史。 — 代价：bisect 落在 eb824e2 上会看到红（本收尾在作业 C 加了「改 core 与重内联同一个提交」）。

实现者的其余偏离（台账「偏离接受」）：段按钮带序号、「下一段 →」在统计行、段条自成一行（`main` 里 topBar 与 stage 之间）、`chunkSegments` 多两种返回 null（锚不唯一、乱序）。
实现者顺带记下：`52ec1fd`（挖空反馈改字面量）改了 core 却没升 engine——此前 engine 与 core 早已不严格对应。

---

## 五、失误与「简报有错」

### 控制方的失误（三个控制方合计；没有一条造成合进 main 的错误）

- **`Color.lerp` 公式写错，起草原型没看出来。** m7a 清单 §0 / D7（MDev-01 写、Python编程 批准）写 `int(a + (b − a)·t + 0.5)`，pygame 2.6.1 实为 `int(a·(1 − t) + b·t + 0.5)`：实数上相等，真实值恰为 .5 时浮点结果落在 .5 两侧
  （a = 205、b = 255、t = 0.29：pygame 219、清单式 220）。起草原型 200/200 是运气——t 多取 0 / 0.25 / 0.5 / 0.75 / 1。basics 构建者实测发现（B2）；m7a 控制方复核 10 万组 t = k/100：清单式错 95、实测式 0；期控制方复核 5 万组：旧式 66、新式 0；
  终审 20 万组（t 混合取法）：旧式 59、新式 0；本收尾在自己的协议上再核（种子 20260930，5 万组、每组三通道、t = k/100）：清单式 133 组不符、实测式 0。**四个数协议各不相同，照录、不抹平；结论一致。**
  随后的 V4（「放开 t」）也缺负控制——终审 I1 实测只放开 t 门对新旧参照都绿，要专门造「恰为 .5」的分支（门同种子 200 组旧式错 22、新式 0）。
  → 本收尾写进 `python-content-wave` 第 1 步（舍入边界 + 「换一种舍入 → 红」的负控制；「实测行为」标注测了多少组）、`python-drill-tool` property 一节、`builder-brief.md`。
- **批准 m7b 清单时只核组名、没核两波程序是否同题**（Python编程，自承）；m7b 清单 §1 查重也只核了全库已合并的程序（MDev-02）。`game-state-screens` 与 m7a `screen-states` 同题（四画面、同一张转移表、`lookup` 空的答案行逐字相同），
  漏到整波终审（C1）。→ 本收尾写进 `python-content-wave` 第 1 步（两波清单逐个程序互查、批准第二份清单时逐条对）与红旗。
- **chunks 实现者的简报漏了 engine 升级规则**（MDev-02，台账裁决 4），事后补发。
- **m7b 控制方用不带引号的 heredoc 填构建者简报**，反引号被当命令执行（全部 command not found / permission denied，未改任何受控文件），补充文件一行与约定表里的反引号内容被吃掉；改 `<<'EOF'` + argv 重写。skill 的坑表本来就写着这一条。→ `fill-template.py`。
- **m7b 控制方一次 grep 因 ugrep 复杂度限制失败，差点据此下「m7a 没有命数机制」的结论**，改用 Python 扫 m7a 18 个程序才核实（3 处 "lives" 都是英文 "lives in"）。→ 坑表两行。
- **m7b 控制方落地 n2 时，判定器头一轮没拼缩进**，把缩进错（第 1 行缩进对不上）误判成「钉法漏了」。→ 「`b.indent + 写法`、先断言标准答案判对」写进三处。
- **chunks 控制方的一次性探针丢了 8777 上 3 个 localStorage 键**：`restore()` 先 `clear()` 再从页面内存里的快照写回，刷新后快照没了。内容不明、无法恢复（账本 §三.3）。标准件 `probe.js`（#197）早已按本页键差分复原——这个探针写在它之前。
- **m7a 的构建者简报写「照 skill 对 pygame 程序的写法处理 run 字段」，skill 里没有这一写法**（两个构建者都报了，B1）。→ 本收尾写进 `python-drill-tool`：pygame 与 MicroPython 程序不写 `run`（定论）。
- **文书**：#197 的合并核验没进期控制方台账（P20）；m7a 的 `git-size-before.txt` 第三次没记测量时点（m7b 的按台账顺序推得是 `4fc58e2`，也没明写）；#196 台账「8 情形」对 PR 表 7 行（P17 的口径说明）。

### 子代理上报「简报 / 清单有错」

两波共 4 个构建者、2 次终审、2 轮修复、2 次范围复审，chunks 另有 1 个实现者（含修复轮）与 1 次评审。经复核**成立**的：

- `Color.lerp` 公式（basics 构建者，B2）——见上。
- skill 里没有「pygame 程序的 run 写法」（两个 m7a 构建者，B1）。
- `keyboard-move-clamped` 清单签名 `step(pos, keys, step)` 形参与函数同名、是坏样板 → `pixels`（basics 构建者）。
- `mouse-click-buttons` 清单只要求贴边，没有「按钮重叠」分支时「先列出的赢」对门是瞎的（原生成器 200 组 0 次重叠）→ 加后 48/200（basics 构建者）。
- `friction-per-frame` 的清单参照与被测同机制 → `Fraction`；`bounce-walls` 原型的错误实现不对应本程序（motion 构建者）。
- pong 原型的正确实现 `vy = -vy` 会让球卡进拍子 → 一律 `abs` 定方向，另补「单纯取反」错误实现 24/200（games 构建者）。
- 「一排砖」→ 三行 × 十块（games 构建者；是取舍不是事实错误，控制方批准）。
- V4「放开 t」缺负控制（m7a 终审 I1）——修复者照评审方案加「恰为 .5」分支，又用枚举代替评审写的拒绝采样（V6，更对）。
- 评审员验判定器用了 `require`（走 node 分支）——m7a 修复者发现、改用裸 vm 重验。
- `game-state-screens` 与 m7a 同题（m7b 终审 C1）。
- 清单 §3 B4 与 §8 原型表残留 `game-state-screens`（m7b 修复者报范围外）→ 控制方 `cd60474` 注明。
- 规格 breakout 行仍写「一排砖」（m7b 范围复审 n1）→ 控制方改。
- chunks：段尾空行不可见、逐键打不到「段完成」（评审 I1，**控制方与实现者的整段粘贴验收都看不见**）；刷新后全程成绩静默不记（I2）；设计的「缓冲恰等于 body 时补」会多出一行（实现者 F8b，偏离接受）；
  engine 升而行为不变是否升 tool-version，规则没写（实现者上报，控制方定「不升」，本收尾写进作业 C）。

报成疑点、复核为**等价程序**的：`invuln += INVULN`（m7b 范围复审：算数的撞击发生时 invuln 必为 0.0）；m7b 终审 9 个变异里 3 个判错写法证实为等价。
没有一条被判为「上报者错了」而驳回。
