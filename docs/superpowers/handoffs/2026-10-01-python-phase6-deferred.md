# Python 子项目 · 第 6 期留下的账（规划完成时）

> 第 6 期（M8「嵌入式 Python」MicroPython 三页，两波并行：m8a = `py-microbit` + `py-pico`，m8b = `py-embedded-patterns`）已完成：
> **3 页、29 个程序**（m8a 18 + m8b 11），其中 24 个带 property 检查，`lines` 合计 1,148（299 + 323 + 526），挖空 79 个（26 + 27 + 26）。
> 全库现为 35 页、**375 个程序**（259 个带 property 检查）、`lines` 合计 12,247、挖空 953 个；engine `py-1.2.0` → **`py-1.3.1`**（#203 boards、#204 一致性清理）；门 44 → **45**（#206 `boards_map_check`）。
> 这是主规格 §9 规划的最后一期——主规格 §9.3 记了规划完成；本账本 §十 是**规划完成时仍开着的**汇总。
> PR：#201 · #202 · #203 · #204 · #205（第 5 期收尾）· #206 · #207（m8b）· #208（m8a）。
> 这份文件是**账本**，不是待办列表——每一条都记着**为什么当时没修**，以及**什么时候它会变成必须修**。
>
> **核对基线 `b3d8546`**（#208 合并后的 main），2026-10-01 逐条实测；文中 file:line 都按它。上一期账本的基线是 `e342ba2`，两者之间的「存量没动」在 §一 证明。
> 来源：期控制方的派发简报与台账（主工作区 `.superpowers/python-phase6/phase6-brief.md`、`controller-log.md`）、复盘条目 `retro-items.md`（1–19）、
> 三份台账（`m8a-ledger/`、`m8b-ledger/`、`docs-ledger/`）——都 gitignored，**不在仓库里**，要留下来的这里都抄全了；以及两份清单、考纲依据表与八个 PR 的描述。
>
> 规格：`docs/superpowers/specs/2026-09-16-python-subproject-design.md`（§9、§9.3）
> 清单：`docs/superpowers/specs/2026-09-30-python-phase6-m8a-design.md`、`-m8b-design.md`；考纲依据表 `2026-09-30-python-boards-syllabus-map.md`
> 裁决：`docs/superpowers/handoffs/2026-10-01-python-phase6-rulings.md`
> 前几期账本：`2026-09-16-python-phase0-deferred.md`、`2026-09-30-python-phase{1,2,3,4,5}-deferred.md`

---

## 一、前几期账本 §一 的五件事：第 6 期之后

「存量没动」的整体证明（本收尾实测）：`e342ba2` → `b3d8546` 之间，ch01–ch32 的 `.py` **一个都没变**；29 个 `chapter.json` 变了，逐个去掉 `boards` 字段之后与 `e342ba2` **全部相同**
（Python 逐文件比 `git show e342ba2:<f>` 与 `git show b3d8546:<f>`：「boards 之外的改动」0 个；没有删掉、也没有新增 ch33 以外的文件）。即：存量里唯一的改动是 #203 的 boards 重判。
`python/core/` 变了 4 个文件（#203 的占位文案、#204 的「清空本页」与注释），`gates/` 只变了 `library.py`（#201 的硬件桩与 #206 的门）与三份新 refs。

### 1. 讲解与提示指向「页面上看不到的输出」——存量是缺陷清单（第 5 期 U2），本期新内容 0
- 存量：第 1 期 27 处、第 2 期 1 处，都在（路径没动）。
- 新内容：扫 ch33–ch35 的中英 `title` / `blurb` / `notes` / `lineNotes`（短语「看输出」「输出的第」「打印的第」「屏幕上」「打印出来的」「输出」「打印」"printed" "the output" "print"）共 38 个（段 × 短语）命中，逐条看过**全都在描述板子或 USB 串口**
  （「串口每两秒打印一行」「板子上的 print 把文字经 USB 串口送出去」「屏幕上显示 S、L 或 D」——micro:bit 的点阵），真指向页面输出 0 处。
- **什么时候必须修**：下一个动 ch01 等那几页的内容 PR 顺手改掉并升版。

### 2. 复制进 PyCharm 时没有 `_fixtures/`——仍开
- 本期 0 个新 fixture（全库仍是 4 个章目录、源码 9 处引用）。MicroPython 程序复制出去是粘进 Thonny 一类编辑器、烧到板子上——这一路**任何测量都没走过**（§四.1）。

### 3. 判定器在行数不同时完全不比缩进——仍开，行号移了
- `python/core/judge.js:170` 是 `if (na.rel.length === nr.rel.length) {`（`e342ba2` 时在 `:162`；#204 改了文件头注释，代码没动）。`python-drill-tool` 自 #204 起只写「按代码找」，不写行号。
- 新内容：m8b 终审报 26 个空里的两行空全是「复合语句头 + 一行体」、没有跨嵌套块的；m8a 终审没有单列这一项（判定器 53 个空标准答案判对、去缩进 53 / 53 判 `lead-indent`）。

### 4. `boards` 的语义——**已落地**（#203），并有防漂门（#206）
- 全库分布（`b3d8546`）：四家 156 · 三家 33 · 两家 34 · 一家 59 · `[]` 93；按考试局 AQA 222 · OCR 187 · Edexcel 256 · CIE 185。
  与依据表「计数」一节对得上：「改后」行（216 / 183 / 252 / 179 / 70）+ m8b 增量（+3 / +1 / +1 / +3 / +8）+ m8a 增量（+3 / +3 / +3 / +3 / +15）= 222 / 187 / 256 / 185 / 93。
- 本期 29 个：`[]` 23、两家 2（`press-classifier-fsm`、`hysteresis-thermostat`：AQA CIE）、四家 4（`gpio-bitmask`、`radio-packet-bytes`、`pin-irq-counter`、`ring-buffer-isr-handoff`）。

### 5. 程序打印内置 / 操作系统的异常消息——存量仍开，新内容 0
- ch33–ch35 没有一个 `except` 块（逐文件正则 `^\s*except\b`）。存量 5 条路径没动。

---

## 二、第 5 期账本逐条的去向

| 第 5 期账本 | 去向 | `b3d8546` 的实测 / 依据 |
|---|---|---|
| §一.1 讲解指向看不到的输出 | 存量仍开，新内容 0 | §一.1 |
| §一.2 复制不带 fixture | 仍开 | §一.2 |
| §一.3 `judge.js:162` | 仍开，行号移到 `:170` | §一.3 |
| §一.4 boards | **已落地**（#203），防漂门 #206 | §一.4 |
| §一.5 异常消息 | 仍开，新内容 0 | §一.5 |
| §二 第 3、4 期带下来的表（程序长度、钉法缺口、只由 `run.expect` 守、`shuffle-fisher-yates`、isdigit 存量、等价变异注释、fixture 跟踪门、tag 规范化门、「参照返回：None」措辞） | 全部仍开 | 路径没动（§一）；`library.py:538`（超时填 `None`）、`:541`（抛错填 `None`）、`:562`（印「参照返回」）行号与 `e342ba2` 相同 |
| §二 tag 词表分裂 | 存量仍开，本期 0 新增 | 全库 465 个不同 tag（`e342ba2` 448，本期新造 17 个：`adc` `bitwise` `bytes` `debounce` `fixed-point` `gpio` `hysteresis` `interrupt` `microbit` `micropython` `non-blocking` `pico` `pwm` `radio` `ring-buffer` `uart` `wrap-around`）；折叠大小写 / 空格 / 连字符后仍只有存量两组（`nested-loops` / `nested loops`、`lookup-table` / `lookup table`）。m8a 曾把 `overflow` 用于计数器回绕（ch12 是栈上溢），终审 M3 改成 `wrap-around`；今天 `overflow` 只在 ch12 与 ch35（缓冲满），同义 |
| §三.1 逐键首次正确率到不了 100% | 仍开 | `applyEnter` 没动；本期无 `chunks`、浏览器探针没做逐键 |
| §三.2 `lives-and-invulnerability` 与 `bullet-cooldown` 没互相指回 | 仍开 | ch32 只改了 boards |
| §三.3 8777 丢了 3 个 localStorage 键 | 历史事件，不再跟踪 | — |
| §三.4 英文「the + 冠词开头的标题」 | 本期 0 处 | ch33–ch35 英文段正则 `\b[Tt]he (A\|An\|The) [A-Z]` 0 命中 |
| §三.5 程序长度（第 5 期偏长） | 本期反过来偏短 | §三.6 |
| §三.6 `properties.py` R6 的字面 | 仍开 | `properties.py` 本期没动 |
| §三.7 `library-loans` 段 1 标题 | 已改，不再跟踪 | — |
| §四.1 pygame 的 `main()` 只被跑帧测过 | 仍开；MicroPython 更甚——`main()` 一次都没执行过 | §四.1 |
| §四.2 舍入边界只在 `colour-lerp` 上专门造过 | 本期新增 6 个全定义域穷举的程序；`Rect` 属性赋值仍没有专门的 cases | §四.2 |
| §四.3 `chunks_check` 不看段长 | 不变（设计如此） | — |
| §四.4 等价变异 | 本期新增 6 条 | §四.4 |
| §四.5 标准件的测量边界 | `copyrun.py` 的 MicroPython 分支第一次真用、做过负控制（第 5 期账本要求的那一次）；本收尾改了三个标准件 | §四.5 |
| §四.6 配方脚本的 engine 选项 | 本期没用上（两波都在 `py-1.3.1` 放行之后派构建者）；本收尾加了「按章号插入」 | §四.6 |
| §五.1 Skill 工具读旧版 | 已关闭（第 5 期 U3） | — |
| §五.2 构建者报告写自己 worktree | 生效 | 3 个构建者 0 个 BLOCKED，报告都拷进了台账 |
| §五.3 期控制方合并核验进台账 | 8 / 8（其中 #201、#205 在第 5 期台账） | 裁决 P20 |
| §五.4 遗留 worktree 与分支 | 本期清理干净；存量不变 | §五.3 |
| §五.5 设计 §9.2 两份文档 | **#202 已补齐**；但两份文档仍没列第 5 期起的标准件 | §五.5 |
| §五.6 人工验收 | 已关闭（第 5 期 U4） | — |
| §五.7 `git-size-before.txt` 时点 | **又发生一次**（第四次，两波都没记） | §五.4 |
| §五.8 中途 `git gc` | 本期没有 gc | §八 |
| §六 `core.hooksPath` | 仍等你的决定 | §六 |
| §八 体积 | 更新 | §八 |

---

## 三、第 6 期留账：内容

### 1. micro:bit 加速度计的轴向——需实机核
micro:bit 文档（accelerometer）只说单位 milli-g、缺省量程 ±2000 mg，**没写板子往哪边倾时 x / y 为正**。`accelerometer-tilt` 与 `spirit-level-column` 的 right / left / back / forward 命名是约定，讲解如实写「文档没说、本机未试，箭头反了就对调名字」（m8a V4）。
- **为什么没修**：本机没有 micro:bit。**什么时候必须修**：有人拿板子实测一次，方向反了就对调四个名字并升 py-microbit 的 patch 版。

### 2. A0 27.5 Hz 恰为平局
`music-note-frequency` 的 `frequency('A', 0)` 真实值是 27.5：CPython 的 `round` 与参照都得 28，**MicroPython 的平局规则本机测不了**。`main()` 只放第 4 八度，板子上不受影响；refs 头写明（m8a V5）。
- **什么时候必须修**：若讲解或 `main()` 改成演奏低八度。

### 3. 往返 entry 的盲区
`radio-packet-bytes` 的 entry 改成往返包装 `roundtrip`（`decode(encode(…))`、参照恒等，终审 I2 / 修复 F2）之后，encode 与 decode 两边的单边错都会红（`% 255` 断言红，修复与复审各验一次）。
**看不见的**：两个空同时错、而且互相抵消（encode 多加的被 decode 多减回来）时恒等照样成立；以及定义域外的输入。`refs/ch33_microbit.py` 文件头 `:33`–`:36` 写明了。
- **为什么不修**：一个程序只有一个 `entry`（门按程序 id 登记一条参照），要分别守两个函数得改门。**什么时候必须修**：门支持「一个程序几个 P」时。写法已进 `python-drill-tool` property 一节。

### 4. 注册表顺序与主规格 §2.2 不同（本收尾发现）
导航页按注册表顺序列页。章号与主规格 §2.2 的页序 35 页逐一相同（本收尾实测），**注册表却有两处不按章号**：M5 是 simulation、games、**text-data**、systems（text-data 是 ch20，§2.2 排第一）；M6 是 numpy-basics、numpy-linalg、**statistics**、pandas、matplotlib（statistics 是 ch28，§2.2 排最后）。
M6 的来历本收尾回放证实了：第 4 期 m6b 合 main（`9a9101c`）时旧配方脚本把 pandas、matplotlib 追加在已合并的 statistics 之后（§四.6）。
- **为什么没修**：挪已有条目是内容改动（改导航页顺序），不在收尾 PR 的范围；配方脚本今天不挪已有条目、只打 WARN。**什么时候必须修**：下一个动 M5 / M6 注册表的 PR 顺手挪（纯移动，`sync_fallback.py` 重写；不升 version）。

### 5. m8b 规格里 3 行还写「硬件定时器」
`docs/superpowers/specs/2026-09-30-python-phase6-m8b-design.md:8`、`:36`（一行两处）、`:159`：rp2 上 `machine.Timer` 是软件定时器（m8a 终审 M4、修复 F6）。学生看得到的地方都已改（m8a 两页、`py-embedded-patterns` 1.0.1 的 `two-leds-nonblocking` 讲解）；m8a 规格与依据表由控制方 `76f6fb2` 改了。
- **为什么没修**：内部文档、学生看不到，m8a 范围复审 N4 列为「可一起改」，没人改。**什么时候必须修**：有人照 m8b 规格去写讲解时。

### 6. 程序偏短
29 个程序里 16 个短于 40 行（ch33 7 个、ch34 6 个、ch35 3 个；最短 `compass-point` 24 行，最长 `ring-buffer-isr-handoff` 66 行），取向是 40–70 行。两波都接受（程序就是这么短，不凑）。
- **什么时候必须修**：不修。选择器「不超过 20 / 40 行」会把它们分在前两档，这是对的。

### 7. 据文档、本机未实测的硬件行为
`ticks_diff` 的范围与 TICKS_PERIOD（time 文档）、`ticks_add(0, -1)` = TICKS_MAX、`duty_u16` 0..65535、`read_u16` 0..65535、加速度计单位 milli-g、罗盘航向 0..360、Pico 温度公式（RP2040 数据手册；**Context7 没取到原文，照清单写**）、舵机 0.5–2.5 ms / 50 Hz（常见值，讲解写明因型号而异）。refs 头与讲解都标了出处（M8A-D6）。
- **什么时候必须修**：实机结果与文档不符时；温度公式先补一个原文出处。

### 8. 几处取舍，记着
- `adc-temperature` 写 `ADC(4)`；rp2 quickref 原文是「0–3 或 `ADC.CORE_TEMP`」，讲解提了 `ADC.CORE_TEMP`（pico 构建者 6）。
- 没用 `Pin.irq(hard=True)`、`Pin("LED")`（rp2 文档没证实，m8b 构建者）；`ring-buffer-isr-handoff` 讲解说明了缺省是软中断、仍写成不分配内存（终审 M5）。
- `display.read_light_level()` 不在门的桩名单 `_STUB_NAMES` 里——只在 `main()` 里调，导入不碰它（microbit 构建者 5）。
- `uart-line-assembler` 的 boards 列进依据表「拿不准」（IAL 11.2.1(c) / CIE 3.1 的 buffers 是理论层）；`timer-periodic-callback` 的回调本身是软中断，按概念与 `pin-irq-counter` 挨得近，判 `[]`（R5 拿不准），组内理由表里没写这一条（m8a 终审 M4 附注）。
- Edexcel「中断」行保留了 m8a 那一行（裁决 P19）；`boards_map_check` 不看四家各节，两波各节的重复行只有人看得见。

---

## 四、门与测量看不见的

### 1. MicroPython 的 `main()` 一次都没执行过
门对 MicroPython 程序只过 `compile()`、在硬件桩下导入、调 entry；桩上**调用即抛** `HardwareStubCalled`，所以 `main()` 不可能在门里跑。pygame 还有活体跑帧（只喂一个 QUIT），MicroPython 连这个都没有。
`main()` 里的东西（引脚号、`sleep` 单位、`ticks_diff` 的实参顺序、串口打印）只由 `compile()`、评审读代码与挖空判定守。讲解里「板子上看到什么」没有被任何测量对过。
- **什么时候必须修**：若要测，得写一个「可调用的硬件桩」（记录调用、按脚本返回读数）——那是另一个测量，写之前先定它要排除什么。或者由你上板（交接文档 §8，「由用户按需做」）。

### 2. 取整 / 回绕的边界：本期在全定义域上穷举
m8a 6 个（duty 101、servo 181、adc 65 536、compass 361、spirit 4 201、music 63）与 `elapsed-ticks-diff`（period 16 / 64 的全部 (new, old) 组合）由清单、构建者、终审各穷举一次，入口 ≠ 参照都是 0；
「换一种取整」的错误实现在清单 §0 表里有命中数。**但门自己只跑种子下的 200 组**：duty 覆盖 81 / 101、music 61 / 63、servo 105 / 181（m8a 终审实测）——全定义域是门外做的，讲解的说法已照实改成「随机抽样」（F3）。
servo 的半数舍去只有专造的 135 度守（终审实测：改成半数舍去，反例就是 135）。

### 3. `boards_map_check` 只守附录
四家各节的条目、「计数」一节、按概念组的一致性自查都没有门（m8b 终审 M6、I2 都是这一类）。

### 4. 等价变异（本期新增，下一个做负控制的人别把它们当盲区）
- `compass-point`：`round(h / 45)` 在整数航向上与正确写法等价（h / 45 从不恰为 .5）；`+45 → +44` 等价（`2h + 45` 恒为奇数，0..360 上差异 0 个）。
- `pwm-servo-angle`：`round()` 在 0..180 与正确写法等价（唯一的半数 135 两边都得 6554，refs 头写了）。
- `pwm-duty-percent`：`+50 → +51` 等价（`percent × 65535` 除以 100 的余数只可能是 5 的倍数）。
- `spirit-level-column`：下界夹到 `LOW + 1` 等价（仍落在第 0 列）。
- `gpio-bitmask` 参照的拆位改成 `mask // 2 ** i % 2`：门照绿，是好事（修复轮照这个改了，参照不再用位运算）。

### 5. 标准件（本收尾改的三个，各做过负控制）
- **`copyrun.py`** 逐章印「空数：<章> N 个空（全章每个程序，页面自己的 `Exercise.parse` 数）」。`b3d8546` 上 `--chapters ch33-microbit ch34-pico ch35-embedded-patterns --seed 20260930 --k 3`：
  空数 26 / 27 / 26（合计 79，与浏览器探针、两次终审的数相同）；9 / 9 通过，负控制 property 7 / 7。
  负控制：在 `git archive HEAD python` 的导出副本里给 ch35 `two-leds-blocking` 的第 14 行多包一对 BLANK，同一命令的空数从 26 变 27。
  第 5 期账本要求的「第 6 期第一次真用时再做一次负控制」两波都做了：m8a 首跑 property 3 / 4（`radio-packet-bytes` 没抓到——它就是 §三.3 那一空），修复后 4 / 4；m8b 10 / 10。
- **`fill-template.py --list`** 每行第一列印 JSON 键（带引号），后面才是次数与「必填 / 可选」。测量：把 `--list` 每行第一列原样当键写 JSON、填模板——新版三份模板（builder-brief 20 键、final-review-brief 10 键、pr-body 19 键）都 rc 0；
  同一程序对旧版（`b3d8546` 上的那份）三份都 rc 1（「这些槽没有给值」，断言式拒绝、不是崩溃）。
- **`resolve-registry-conflict.py`** 按 (module, 章号) 插入，见 §四.6。

### 6. 配方脚本「按 (module, 章号) 插入」的回放
在草稿区的独立克隆里回放三次真实合并，新旧两版脚本各跑一遍（克隆、`merge --no-commit`、脚本、读索引里的暂存结果）：

| 合并 | 新脚本 | 旧脚本 |
|---|---|---|
| A · m8a 合 main：`3545597` + `602e5cc` → `99c0231`（依据表那一处照 `99c0231` 手解后 `git add`；合并之后手做的 N4——patterns 1.0.1——比较时代入那一条注册表条目、重跑 `sync_fallback.py`） | rc 0，模块 8：microbit(ch33)、pico(ch34)、patterns(ch35)；注册表与两个导航页与 `99c0231` **逐字节相同** | rc 0，模块 8：patterns、microbit、pico；三个文件都**不同**（负控制） |
| B · m8a 集成 pico：`2340b04` + `e095538` → `21b4d62` | 与 `21b4d62` 逐字节相同（回归） | 逐字节相同 |
| C · m6b 合 main：`8f33413` + `5bae885` → `9a9101c` | M6：basics、linalg、pandas、matplotlib、statistics（= 主规格 §2.2）；与 `9a9101c` 不同 | 与 `9a9101c` 逐字节相同——M6 的存量错序（§三.4）就是这样来的 |

章号与主规格 §2.2 的页序 35 页逐一相同（本收尾解析 §2.2 的页列表与 `python/programs/ch*/chapter.json` 的 `tool` 比），所以「按章号」就是「按 §2.2」。
脚本只挪**追加的**条目；已有条目不按章号时打 WARN、不动（§三.4）。

---

## 五、流程上的账

1. **构建者报告写自己 worktree——生效。** 3 个构建者（microbit、pico、patterns）0 个 BLOCKED。**不改**。
2. **期控制方的合并核验——8 / 8 都有记录**（#201、#205 在第 5 期台账 `:28`、`:32`；其余在第 6 期台账）。台账没写的几项见裁决 P20 末尾。
3. **遗留的 worktree 与分支。** 两份台账记下的都删了（m8a：集成 + 2 个构建者 worktree、5 个本地分支、origin 集成分支；m8b：集成与构建者 worktree、三条分支本地与 origin）。
   2026-10-01 00:52（BST）实测：主仓库仍是 **46 个** `worktree-agent-*` 分支、**16 个** `.claude/worktrees/agent-*` 目录——与第 2–5 期账本记的数相同，都不是本期的。
   那一刻在用的 python 分支只有 `claude/python-phase6-close`（本 PR）；`claude/python-subproject-design`（第 0 期计划）仍在，归属不明，不删。
4. **`git-size-before.txt` 第四次没记时点**：两波的 `progress.md` 第 0 步都没有这一行（`git-size-after.txt` 两波都记了）。§八 照录。
5. **两份文档没列标准件**：`python.md` 与 `python-handoff.md` 里 `copyrun` / `live-frames` / `fill-template` 一处都没有（`grep -c` 均为 0）——第 5 期账本 §五.5 说「下一次动它们时补」，本收尾只刷新了快照表与过期的状态句，**没补**（简报限定只改那几处）。
   **什么时候必须修**：下一次实质性地改这两份文档时。
6. **文档的快照表刷新了**：`python-handoff.md` §1.1 到 `b3d8546`；它的 ⑤ 命令原来只看 `requires`，`b3d8546` 上会把 29 个 MicroPython 程序算进 stdlib（报 296），改成单列 `micropython`（本收尾）。

---

## 六、等你的决定

- **`core.hooksPath` 改成相对路径**（第 5 期 U5）：共享 git 配置里是指向主工作区 `.githooks` 的绝对路径，worktree 里提交跑的是主工作区当前那份钩子脚本，但它操作的是提交所在 worktree 的文件。控制方建议改成 `git config core.hooksPath .githooks`（每个 worktree 跑自己那一份）。**只剩这一件。**
- 知会、不待决：Edexcel 一列按 IAL YCP01 判（裁决 §〇）。

---

## 七、原描述错在哪（收尾核对发现）

**起草 / 简报错误**：

1. **派发简报约定表的 `fsm`**：违反「tag 先 grep」，全库已有 `state-machine`（期控制方自纠）。
2. **派发简报的 `now_ms`**：m8b 起草者提出 `elapsed_ms`（D1）。
3. **m8a 清单罗盘 0..359**：文档原文 "from 0 to 360"（microbit 构建者）。
4. **m8a 清单 `gpio-bitmask` 的 `& 0xFF`**：只有三种操作时永远空操作（pico 构建者加 invert）。
5. **m8b 清单的原型命中数**是两处一起改的（m8b 构建者）。
6. **m8b 清单与依据表 CIE 中断「3.1 后」**：原文在 4.1（m8b 终审 I2）。
7. **m8b 清单 §4「本页 pico 程序用 `utime.sleep_ms`」与构建者的 `import time`**：清单对、构建者偏离，终审 I3 → 裁决 utime。
8. **跨波「中断」行的裁决**按概念整体下，Edexcel 一节前提不成立（m8a 控制方偏离）。
9. **m8a 修复简报 F2「同一程序两个 P」**：门不支持（修复者）。
10. **m8b 修复简报「新固件上也可以写 import time」**：没有依据（修复者）。
11. **m8b 中值讲解的「上限」**：数学上错（范围复审 N1；a = 5、b = 7、c = 1）。
12. **两份内部文档与 m8b 页讲解的「硬件定时器」**：rp2 上是软件定时器（m8a 终审 M4、范围复审 N4）；m8b 规格 3 行仍在（§三.5）。

其余：

13. **依据表开头「附录是全库 N 个程序」**：两波都没改（346），后合并的 m8a 改成 375；本收尾把它改成指向 `boards_map_check` 的输出行、不写数字（复盘 6）。
14. **`python-handoff.md` §1.1 ⑤ 的运行层分类**在有 MicroPython 程序之后不再准确（§五.6）。

---

## 八、体积

**页面**（`b3d8546`）：35 页合计 **11,030,852 B**（逐页 gzip -9 之和 3,685,738 B）。新 3 页：`py-embedded-patterns` 332,255、`py-microbit` 316,351、`py-pico` 313,535。最大的一页仍是 `py-text-data`（353,638）。
原 32 页合计 9,993,782 → 10,068,711 B（+74,929，每页 +1,857 到 +2,859：#203 的占位文案与 boards、#204 的「清空本页」与注释——都是 core 内联进每一页的量）。

**仓库**（`git count-objects -vH`，字段 `count` · `size` · `in-pack` · `size-pack`；整个仓库共用一个 `.git`）：

| 时点 | count | size | in-pack | size-pack | 出处 |
|---|---|---|---|---|---|
| 第 5 期收尾 | 91 | 1.11 MiB | 8690 | 28.44 MiB | 第 5 期账本 §八 |
| m8a 开工前（时点未记） | 85 | 1.08 MiB | 8690 | 28.44 MiB | `m8a-ledger/git-size-before.txt` |
| m8b 开工前（时点未记） | 97 | 1.13 MiB | 8690 | 28.44 MiB | `m8b-ledger/git-size-before.txt` |
| m8b 合并后（#207，`602e5cc`，00:30:08 BST） | 765 | 18.73 MiB | 8690 | 28.44 MiB | `m8b-ledger/git-size-after.txt` |
| m8a 合并后（#208，`b3d8546`，00:46:08 BST） | 811 | 19.65 MiB | 8690 | 28.44 MiB | `m8a-ledger/git-size-after.txt` |
| 收尾当天（00:52:56 BST） | 811 | 19.65 MiB | 8690 | 28.44 MiB | 本收尾在主工作区只读实测 |

本期没有 gc：pack 不变，第 6 期的增量全是松散对象，约 **+18.5 MiB、+720 个**（从约 1.1 MiB / 91 个到 19.65 MiB / 811 个；m8a 开工前那一行比第 5 期收尾少 6 个，时点不明，不深究）。
这一期第一次能直接比增量（第 5 期中途 gc 过）。体积主要来自三个新页（每页约 0.31–0.33 MB）与 #203 / #204 重写全部页面各一次。

---

## 九、复盘条目（`retro-items.md` 1–19）的去向

`CW` = `python-content-wave/SKILL.md`，`DT` = `python-drill-tool/SKILL.md`，`BB` = `builder-brief.md`，`FR` = `final-review-brief.md`，`PB` = `pr-body.md`。19 条全部落地，没有「不改」的。

| # | 条目 | 落到哪 |
|---|---|---|
| 1 | 大纲逐节写「事实来源」+ 审批修正 | CW 新节「期末收尾与文档 PR」第 1 条 |
| 2 | 会过期的数字只放一张快照表 | 同上第 2 条 |
| 3 | 时间说法锚到 SHA | 同上第 3 条（本收尾自己也照做：交接两份文件里的状态句都写「至 `<SHA>`」） |
| 4 | 负控制表「依据」列分设计规定 / 执行记录 | 同上第 4 条（`python-handoff.md` §5 已是〔设〕〔执〕两种） |
| 5 | 原型负控制一次只改一处 | CW 第 1 步原型一条；BB 报告第 4 项；CW 红旗 |
| 6 | 依据表计数增量、开头不写总数 | 依据表开头改成指向 `boards_map_check` 输出行（本收尾）；CW 第 3 步新一条；DT 门表 `boards_map_check` 一行 |
| 7 | 清单 boards 一节写条目编号 + 原文所在处 | CW 第 1 步新一条（以 CIE 4.1 / 第 909 行为例，本收尾在全文文本上复核了行号） |
| 8 | 合 main 时 merge --no-commit → 编辑并 add → 跑脚本 | CW 第 6 步；CW 红旗 |
| 9 | `fill-template --list` 打印可用键名 | `fill-template.py` 改了 + 负控制（§四.5）；CW 第 2 步 |
| 10 | 跨波约定进本波共有约定表 | CW 第 1 步；BB 约定表槽的提示；CW 红旗 |
| 11 | MicroPython 页的空数由工具输出 | `copyrun.py` 逐章印空数 + 负控制（§四.5）；CW 第 4 步；BB 报告第 2 项；PB 表格加「空数」列 |
| 12 | 选变异前先在定义域上穷举差异数 | CW 第 4 步；FR「门与测量」；BB 报告第 4 项；CW 红旗 |
| 13 | 配方脚本按模块内章序放本波页 | `resolve-registry-conflict.py` 按 (module, 章号) 插入 + 三次回放（§四.6）；CW 第 3 步；DT「堆叠分支之间的冲突」 |
| 14 | 往返 entry 让只有 compile 守的空被看见；盲区写进 refs 头 | DT property 一节新一条（含盲区写法与 `radio-packet-bytes` 的实例） |
| 15 | 门保持绿时先报差异数 | 同 12 |
| 16 | 配方脚本排序、至少打印模块内顺序并对 §2.2 | 同 13；脚本打印「模块 N 内顺序」，已有条目不按章号时打 WARN；章号与 §2.2 页序本收尾核过 35 / 35 相同 |
| 17 | 两波改同一份依据表时裁决逐节逐行写 | CW 第 7 步「两波并行」一条 |
| 18 | 每个空落在 entry 可达路径上，否则往返包装 | 同 14；FR「门与测量」；BB 报告第 4 项 |
| 19 | PR 里的验证数据测在 PR head 上 | CW 第 6 步；PB 新 REQUIRED 槽「验证所在 SHA」；CW 红旗 |

另外顺手写进 DT 的（不是复盘条目，是本期裁决）：MicroPython 程序一律 `import utime`、逻辑函数优先收 `elapsed_ms`、「据文档未实测」要标出处、MicroPython 的 `main()` 没有任何测量。

---

## 十、规划完成时仍开着的（汇总）

主规格 §10「明确不做」之外、各期账本里到 `b3d8546` 仍开着的。逐条的来龙去脉在括号里的出处；这里只按「谁来定」归类。

**等你决定**
- `core.hooksPath` 改相对路径（§六）。

**方向已定、存量未改**（改就要给页升版，下一个动这些页的内容 PR 顺手做）
- 讲解指向页面看不到的输出：第 1 期 27 处、第 2 期 1 处（§一.1）。
- 英文讲解用「」括页名 36 段（ch20、ch23、ch26、ch27）与 ch02 三处 `the Files and Errors page`（第 4 期账本 §三.6）。
- 程序打印内置 / 操作系统的异常消息 5 个（§一.5）。
- `lives-and-invulnerability` 与 `bullet-cooldown` 互相指回（第 5 期账本 §三.2）。
- 注册表 M5、M6 的顺序与 §2.2 不同（§三.4）。
- 「照抄空」存量、各期钉法缺口、讲解用程序 id 指兄弟程序、`isdigit` 存量（第 2–4 期账本）。
- m8b 规格 3 行「硬件定时器」（§三.5）；两份文档没列标准件（§五.5）。

**门与判定器**
- `judge.js:170` 行数不同时不比缩进（§一.3）。
- 一个程序只有一个 property 入口（往返包装是绕法，§三.3）；只由 `run.expect` 守的部分（第 3、4 期账本）。
- 建议过而没做的门：fixture 必须被 git 跟踪、tag 规范化、`isdigit` → `int()` 扫描、「照抄空」扫描、依据表四家各节与计数（§四.3）。
- `properties.py` R6 的字面（第 5 期账本 §三.6）；「参照返回：None」措辞（`library.py:538` / `:541` / `:562`）。

**测量没走到的**
- MicroPython 的 `main()`、pygame `main()` 里的事件分支、matplotlib 的图、pygame 的窗口（§四.1；第 4、5 期账本）——只有人看得见。
- 硬件行为据文档未实测（§三.1、§三.2、§三.7）。
- 复制进 PyCharm / Thonny 不带 `_fixtures/`、本机缺库（§一.2）——人工验收由你在线上做（第 5 期 U4）。
- 逐键临摹首次正确率（第 5 期账本 §三.1）。
