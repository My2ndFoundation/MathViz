# Python 子项目 · 第 6 期 · 波 m8a（M8「嵌入式 Python」上半）程序清单

> 状态：**已批准**（2026-09-30，Python编程 审，受用户委托；批准时的清单提交 cc212b2）。裁决见 §7。
> 日期：2026-09-30
>
> 上游：
> - 主规格 `docs/superpowers/specs/2026-09-16-python-subproject-design.md` §2.2（M8：`py-microbit` 点阵、按钮、加速度计、无线电；
>   `py-pico` GPIO、PWM、ADC、中断、定时器）、§5.4 末段（MicroPython 层，PR #201）、§7.1（`micropython_main_guard_check`）、§9
> - 第 6 期派发简报（主工作区 `.superpowers/python-phase6/phase6-brief.md`，Python编程 定）§2：纯逻辑函数 + `main()` + 恰好一个 main 守卫；
>   `requires: []`、没有 `run` 字段；正确性靠 property（每页至少一半）；逻辑函数里的时间是 `now_ms` 实参；ticks 回绕专门一个程序；
>   boards 新规则（不在考纲就不写、按概念判、写依据、拿不准就不写）；本波共有 tag `micropython` / `microbit` / `pico` / `gpio` / `debounce` / `ring-buffer` / `state-machine`（简报原写 `fsm`，Python编程 更正：全库已有 `state-machine`，不新造 `fsm`）
> - 作者须知与控制方作业：`.claude/skills/python-drill-tool/SKILL.md`、`python-content-wave/`
> - 格式范本：第 5 期 `2026-09-30-python-phase5-m7a-design.md`
>
> 同期并行：波 m8b（`py-embedded-patterns` ch35：非阻塞主循环、按键去抖、环形缓冲、有限状态机、传感器滤波）由另一会话负责。本文只管 ch33、ch34。

---

## 0. 本波做什么

| 页 | 页名（zh / en） | 章目录 | 模块 | accent | runtime | 程序 | 变体组 | 带 P |
|---|---|---|---|---|---|---|---|---|
| `py-microbit` | 「micro:bit」/ micro:bit | `ch33-microbit` | 8 | emerald | `micropython-microbit` | 9 | 1 | 8 |
| `py-pico` | 「树莓派 Pico」/ Raspberry Pi Pico | `ch34-pico` | 8 | emerald | `micropython-pico` | 9 | 1 | 6 |
| **合计** | | | | | | **18** | **2** | **14** |

refs 文件：`python/scripts/gates/refs/ch33_microbit.py`、`ch34_pico.py`。所有程序 `requires: []`、**没有 `run` 字段**；门对它们只过 `compile()`，
property 在装了硬件桩（#201）的环境里导入后跑——入口若碰硬件，门报 `HardwareStubCalled`。

**起草期原型**（台账 `.superpowers/python-waves/m8a/draft-proto.py`，纯 Python、逐层比类型）：
14 个 P 全部「正确 == 参照 200/200」，错误实现全部被抓（命中数见 §2 各表下注）。有取整 / 回绕的 6 个在**全定义域上穷举**（不抽样）：

| 程序 | 定义域 | 正确 ≠ 参照 | 「换一种取整」的错误实现命中 |
|---|---|---|---|
| `pwm-duty-percent` | 百分比 0..100（101 个） | 0 | 50（截断代替四舍五入） |
| `pwm-servo-angle` | 角度 0..180（181 个） | 0 | 89（截断） |
| `adc-temperature` | 原始读数 0..65535（65 536 个） | 0 | 65 536（取整到个位）；另核：整数读数下 1 位小数**恰为 .x5 的平局 0 个**，浮点与精确分数的舍入不会分歧 |
| `compass-point` | 航向 0..360（361 个；清单原写 0..359，构建者查 micro:bit 文档 "from 0 to 360" 更正） | 0 | 176（截断）；**`round(h / 45)`（银行家舍入）在整数航向上与正确写法等价**——h/45 从不恰为 .5——不能当错误实现（原型第一版用了它，命中 0/200） |
| `spirit-level-column` | 读数 −2100..2100（4 201 个） | 0 | 2 100（四舍五入代替整除） |
| `music-note-frequency` | 7 个音名 × 八度 0..8（63 个） | 0 | 34（截断代替 round） |

ticks 回绕（`elapsed-ticks-diff`）在 200 组里一半专造「正好在回绕边界」（相差 ±1、`period/2 − 1`、`−period/2`），「直接相减」的错误实现命中 43/200。

实测行为的出处（照第 5 期复盘，写明测了多少、怎么测）：`ticks_diff` 的语义取自 MicroPython 官方文档 `docs/library/time.rst`
（返回有符号值、范围 [−TICKS_PERIOD/2, TICKS_PERIOD/2 − 1]、TICKS_PERIOD 是 2 的幂、各 port 不同）——**本机没有 MicroPython，无法实测**，
所以程序把 `period` 当实参，不写死任何 port 的值。`duty_u16` 取 0..65535（官方 `machine.PWM` 文档）；micro:bit 加速度计单位 milli-g、罗盘航向 0..360 整数（micro:bit MicroPython 文档原文 "from 0 to 360"；清单起草时误写 0..359，构建者更正）——同样未实测，讲解按文档写。

---

## 1. 约定

1. **结构**（`micropython_main_guard_check` 守）：纯逻辑函数 + `main()`（引脚、显示、无线电、按钮、主循环全在里面）+ **恰好一个** `if __name__ == "__main__":` 调 `main()`；
   顶层只许 import / def / class / docstring / 常量赋值（调用只许 `const(...)` / `Image(...)`）。
2. **property 入口**：收内置值、返回内置类型；参照纯 Python、机制与被测不同；取整用整数算术或 `Fraction`，不靠浮点碰运气（上表）。不改实参。
3. **时间**：逻辑函数里的时间是毫秒整数实参（`now_ms`）；`sleep` / `ticks_ms` 只在 `main()` 里调用。micro:bit 的 `sleep(ms)` 收毫秒，Pico 的 `utime.sleep(s)` 收秒、`sleep_ms(ms)` 收毫秒——讲解写清楚。
4. **不带外部文件**、不用 `_fixtures/`；随机只许 `random.Random(<种子>)`（本波没有随机程序）。
5. **`problem`**：变体组 2 个——`radio-packet`（ch33 文本 CSV vs 字节）、`elapsed-time`（ch34 直接相减 vs `ticks_diff`）；已对全库 346 个程序、275 个 problem 名查过无重名。单个程序 `problem` = `id`。
6. **tags**：本波共有 `micropython`（每个程序都带，第一位）、`microbit` / `pico`（按页）、`gpio`；`debounce` / `ring-buffer` / `state-machine` 归 m8b，本波不用（**不新造 `fsm`**）。已有可复用的：`modulo`、`timer`。
7. **长度**取向 40–70 行；不用 `chunks`。
8. 讲解按「页面不显示输出」写，而且**板子上看到什么**（点阵亮哪几格、LED 亮度、舵机转到哪）用文字说清楚。

「组」空 = 单个程序；「P」写参照实现的**机制**（空 = 无 property）。

---

## 2. 程序清单

### 2.1 py-microbit · `ch33-microbit` · M8 · 9

| id | 组 | 教什么 | P | boards（依据） |
|---|---|---|---|---|
| `led-image-string` | | 5×5 点阵：`display.set_pixel(x, y, b)`、亮度 0–9、`Image("09090:…")` 字符串格式（行用 `:` 分开）；入口 `image_string(rows)` 把 5×5 亮度表变成 Image 字符串 | 逐行逐字符拼接（查 `"0123456789"` 表） | 待定（二维数组？见 §5） |
| `scroll-and-show` | | `display.scroll` 与 `display.show` 的区别、内置 `Image.HEART` 等、`sleep(ms)` 收毫秒（与 CPython `time.sleep(s)` 对照）；主循环 `while True` 在板上永不退出 | | [] |
| `button-press-edges` | | `button_a.is_pressed()`（此刻按着没有）vs `was_pressed()`（上次问过之后按过没有）；入口 `count_presses(samples)` 从一串「按着 / 没按」采样里数按下的次数（上升沿） | 逐个样本记住上一个状态 | [] |
| `accelerometer-tilt` | | `accelerometer.get_x() / get_y()`（milli-g）判断板子往哪边倾：阈值以内是平放，否则取绝对值大的那一轴；入口 `tilt(x, y, threshold)` | 两个候选按「绝对值降序、x 优先」排序取第一 | [] |
| `spirit-level-column` | | 水平仪：把 −1024..1023 的读数映射到 0..4 列、越界夹住；整除映射 vs 四舍五入映射的区别；入口 `column(reading)` | `Fraction` 逐个比较分界 | [] |
| `compass-point` | | `compass.heading()`（0..360，文档原文 "from 0 to 360"）换成八方位 N / NE / … / NW：先加半格再整除；入口 `point(heading)` | `Fraction(h) + 45/2` 整除 45 | [] |
| `radio-packet-csv` | radio-packet | 无线电只传字符串：`radio.send("12,21,180")`、`radio.receive()`；收到的报文 `split(",")` 解析成三个整数，格式不对交回 `None`；入口 `parse(msg)` | 元组解包 + `ValueError` | [] |
| `radio-packet-bytes` | radio-packet | 同一问题用字节：`radio.send_bytes(bytes([...]))`；温度可能为负，按有符号字节解码（`> 127` 减 256）；入口 `decode(packet)` | `int.from_bytes(…, signed=True)` 逐字节 | 待定（二进制补码？见 §5） |
| `music-note-frequency` | | `music.play` 的音名字符串；十二平均律：以 A4 = 440 Hz 为基准，每半音乘 2 的 12 次根；入口 `frequency(name, octave)` 取整到 Hz | 查 C4–B4 的频率表再按八度乘 2 的幂 | [] |

- 原型命中：led-image-string 200、button-press-edges 85、accelerometer-tilt 67、spirit-level-column 113（穷举 2100/4201）、compass-point 97（穷举 176/360）、radio-packet-csv 37、radio-packet-bytes 106、music-note-frequency 118（穷举 34/63）。
- `accelerometer-tilt` 的 cases 约四成造「恰在阈值」（`>` 写成 `>=` 只在这里露馅）；`radio-packet-csv` 约三成造字段数不对的报文；`radio-packet-bytes` 常造 −1、−128、127、0。
- `scroll-and-show` 不挂 P（只有显示与等待）。

### 2.2 py-pico · `ch34-pico` · M8 · 9

| id | 组 | 教什么 | P | boards（依据） |
|---|---|---|---|---|
| `blink-gpio-pin` | | `machine.Pin(25, Pin.OUT)`（板载 LED；Pico W 上是 `"LED"`）、`value()` / `toggle()`、`utime.sleep_ms`；入口 `blink_schedule(n, on_ms, off_ms)` 交回 `(时刻, 电平)` 列表 | 按下标算：第 k 个事件的时刻与电平 | [] |
| `pwm-duty-percent` | | PWM：`PWM(Pin(15))`、`freq(1000)`、`duty_u16(0..65535)`；百分比换成 duty 要四舍五入（加半再整除）；入口 `duty(percent)` | `Fraction` 精确四舍五入 | [] |
| `pwm-servo-angle` | | 舵机：50 Hz（周期 20 ms）、脉宽 0.5–2.5 ms 对应 0–180°；角度 → 微秒 → `duty_u16`；入口 `servo_duty(angle)` | `Fraction` 精确计算 | [] |
| `adc-temperature` | | ADC：`ADC(4)` 板内温度传感器、`read_u16()`（0..65535）→ 电压 → 摄氏度（数据手册公式 27 − (V − 0.706) / 0.001721）；入口 `celsius(raw)` 取一位小数 | 全程 `Fraction` 精确算，最后转 float 取一位 | [] |
| `pin-irq-counter` | | 中断：`Pin(14, Pin.IN, Pin.PULL_UP)`、`irq(trigger=Pin.IRQ_FALLING, handler=…)`；处理函数要短、只改一个计数；主循环读计数显示 | | 待定（中断的概念？见 §5） |
| `timer-periodic-callback` | | `machine.Timer(period=500, mode=Timer.PERIODIC, callback=…)`：不用 `sleep` 也能定时闪灯；回调里别做重活 | | [] |
| `elapsed-naive-subtract` | elapsed-time | 用 `utime.ticks_ms()` 直接相减算经过的时间——平时对，计数器回绕的那一刻错（讲解算一个回绕的例子给她看） | | [] |
| `elapsed-ticks-diff` | elapsed-time | 同一问题用 `utime.ticks_diff(new, old)`：环形算术、结果有符号、只在两次相距不到半个周期时可靠；入口 `ticks_diff(new, old, period)`（period 当实参，2 的幂，不写死） | 在 [−period/2, period/2) 里枚举找「old 加多少得 new」 | 待定（模运算 / 补码？见 §5） |
| `gpio-bitmask` | | 八个 LED 用一个字节表示：`\|=` 置位、`&= ~` 清零、`^=` 翻转、`& 0xFF` 截成一字节；入口 `apply(mask, ops)` | 拆成 8 个 0/1 的列表逐位改再拼回 | 待定（位运算：见 §5） |

- 原型命中：blink-schedule 145、pwm-duty-percent 111（穷举 50/101）、pwm-servo-angle 96（穷举 89/181）、adc-temperature 200（穷举 65536/65536）、elapsed-ticks-diff 43、gpio-bitmask 82。
- `elapsed-ticks-diff` 的 cases 一半专造回绕边界（相差 ±1、`period/2 − 1`、`−period/2`）；`elapsed-naive-subtract` 不挂 P（它是「错」的那种写法，讲解算给她看）。
- `pin-irq-counter`、`timer-periodic-callback` 不挂 P：逻辑就是「计数加一」，由 compile 与桩导入守。

---

## 3. 边界（待裁决）

- **3.1 与 m8b 的分工。** 本波**不讲**：按键去抖、环形缓冲、有限状态机、传感器滤波（滑动平均 / 中值）、非阻塞主循环——这些在 `py-embedded-patterns`。
  - `button-press-edges` 讲「上升沿计数」与 `is_pressed` / `was_pressed` 的区别，**不去抖**（假设采样已干净）；讲解点一句「去抖见「嵌入式模式」一页」（页名以 m8b 定稿为准）。请 Python编程 与 m8b 对：它的去抖程序若也从「边沿」讲起，两边哪边讲边沿。
  - `timer-periodic-callback` 讲定时器回调（rp2 上 `machine.Timer` 是软件定时器，回调缺省以 soft IRQ 跑；修复轮 F6）；「用 `ticks_diff` 写不阻塞的主循环」归 m8b，本波 `elapsed-ticks-diff` 只讲 `ticks_diff` 的语义与回绕，不写调度循环。
  - `pin-irq-counter` 讲中断本身；中断里怎么安全地把数据交给主循环（环形缓冲）归 m8b。
- **3.2 位运算。** `gpio-bitmask` 讲 `| & ^ ~` 置位清零翻转——全库还没有专门讲位运算的程序（M1 未覆盖）；本页讲，别页只用。
- **3.3 十二平均律**只作 `music` 的背景，讲解不展开乐理。
- **3.4 硬件差异**：Pico / Pico W 板载 LED 引脚不同（25 / `"LED"`），讲解写明；程序按 Pico 写。

## 4. 时间与回绕

- 逻辑函数的时间一律 `now_ms` 整数实参；`sleep` / `sleep_ms` / `ticks_ms` 只在 `main()` 里。
- 回绕专讲一组（`elapsed-time`）：直接相减 vs `ticks_diff`。TICKS_PERIOD 因 port 而异（官方文档只保证是 2 的幂），**程序与参照都把 period 当实参**，讲解不写某个 port 的具体值，只说「是 2 的幂、到了就从 0 重来」。
- `ticks_diff` 的参照用枚举（在 [−period/2, period/2) 里找 d 使 `(old + d) % period == new`），与被测的位与 / 条件减法机制不同；cases 的 period 取 16 / 64 / 256 / 1024，让边界常被踩到。

## 5. boards（新规则：不在考纲就不写、按概念判、写依据、拿不准就不写）

**已核**（2026-09-30，对照 `docs/superpowers/specs/2026-09-30-python-boards-syllabus-map.md` 的判定原则 R1–R6，并逐条读了四家官方文件——对照文件的考纲表只收全库已用到的概念，
位运算、补码、中断三条它还没有，所以回到它列出的官方来源核）：

| 概念 | AQA 7517 | OCR H446 | Edexcel IAL YCP01 | CIE 9618（2027–29） |
|---|---|---|---|---|
| 位运算 / 掩码 | 4.7.3.5 "logical bitwise operators (AND, OR, NOT, XOR), logical shift right, shift left" | 1.4.1(i) "Bitwise manipulation and masks: shifts, combining with AND, OR, and XOR" | 2.2.2 Bitwise manipulation (logical / arithmetic shift, bit masks AND OR XOR)；7.1.3(d) Bitwise operators | 4.3 Bit manipulation："how bit manipulation can be used to monitor/control a device … Test and set a bit (using bit masking)" |
| 补码 | 4.5.4.3 "signed binary … two's complement" | 1.4.1(c) "sign and magnitude and two's complement to represent negative numbers" | 2.1.3 Two's complement representation of signed numbers | 1.1 Data Representation "one's and two's complement representation" |
| 中断 | 4.7.3.6 "role of interrupts and interrupt service routines (ISRs)" | 1.2.1(c) "Interrupts, the role of interrupts and Interrupt Service Routines (ISR)" | 11.2.1(e) Interrupt handling in device management；1.2.2(c) | 4.1 CPU Architecture "purpose of interrupts … use of an Interrupt Service handling Routine (ISR)" |

OCR 三条先从 *Subject content clarification guide* v2 读出，再由 Python编程 用 **H446 v3.0 全文（Version 3.0, April 2026）** 核实：编号与原文一致（1.2.1(c) "Interrupts, the role of interrupts and Interrupt Service Routines (ISR), role within the Fetch-Decode-Execute Cycle"；1.4.1(c)、1.4.1(i) 同上表）。

逐程序判定（R1：核心教学点被点名才写）：

| 程序 | 判定 | 依据 |
|---|---|---|
| `gpio-bitmask` | AQA OCR Edexcel CIE | 核心就是用掩码置位 / 清零 / 翻转：A 4.7.3.5 · O 1.4.1(i) · E 2.2.2、7.1.3(d) · C 4.3（点名「用位掩码控制设备」，与本程序同义） |
| `radio-packet-bytes` | AQA OCR Edexcel CIE | 核心是把有符号温度按一个字节收发、`> 127` 减 256 还原——即 8 位补码：A 4.5.4.3 · O 1.4.1(c) · E 2.1.3 · C 1.1 |
| `pin-irq-counter` | AQA OCR Edexcel CIE | 核心是硬件中断与短小的中断处理函数：A 4.7.3.6 · O 1.2.1(c) · E 11.2.1(e) · C 4.1 |
| `elapsed-ticks-diff` | `[]` | 核心是计数器回绕的环形算术。四家点名的是补码的**表示与换算**、MOD 的**运算符**；读不出它们覆盖「回绕差值」——R5 拿不准不写 |
| `led-image-string` | `[]` | 核心是把 5×5 亮度表拼成 Image 字符串，教的是字符串格式，不是二维数组本身（R1） |
| 其余 13 个 | `[]` | micro:bit / Pico 硬件 API、PWM、ADC、舵机、音符频率、倾斜 / 罗盘判定：四家都不点名（R3：库是工具） |

## 6. 递归

无（⟳ 无）。

---

## 7. 裁决记录

| # | 问题 | 决定 |
|---|---|---|
| M8A-D1 | 页名 | 「micro:bit」/ micro:bit、「树莓派 Pico」/ Raspberry Pi Pico |
| M8A-D2 | 组名 | `radio-packet`、`elapsed-time` 全库无撞；与 m8b 的逐程序对照由 Python编程 做 |
| M8A-D3 | §3.1 分工 | 同意。**边沿检测归本波**：`button-press-edges` 讲上升沿计数与 `is_pressed` / `was_pressed`（不去抖）；m8b 的去抖从「抖动」讲起，讲解指回「micro:bit」页的边沿（Python编程 转告 m8b）。`timer-periodic-callback` 只讲定时器回调、`pin-irq-counter` 只讲中断本身，数据交接归 m8b 环形缓冲 |
| M8A-D4 | §3.2 位运算 | `gpio-bitmask` 讲（全库首次）；tag 用 `bitwise`（先 grep） |
| M8A-D5 | §3.3、§3.4 | 同意 |
| M8A-D6 | §4 时间 | 同意。`ticks_diff`、`duty_u16`、milli-g、航向范围（0..360）等**据官方文档、本机无法实测**的行为，在 refs 文件头与讲解里标明「据文档、未实测」并给文档出处 |
| M8A-D7 | compass 等价变异 | `round(h / 45)` 在整数航向上与正确写法等价——写进 refs 文件头，不得当负控制 |
| M8A-D8 | §5 boards | 默认 `[]`；五个候选拿到 boards PR 的考纲对照文件后逐条核，核不实留 `[]`，依据写到考纲条目编号 |
| M8A-D9 | §6 递归 | 无 |
| M8A-D11 | §5 boards 核定 | `gpio-bitmask`、`radio-packet-bytes`、`pin-irq-counter` → AQA OCR Edexcel CIE（OCR 经 v3.0 全文核实）；`elapsed-ticks-diff`、`led-image-string` 与其余 13 个 → `[]`。本波 PR 里由控制方把 18 行加进考纲对照文件的附录表，并把位运算 / 补码 / 中断三个概念的条目补进四家各自一节；终审核附录行与 chapter.json 一致 |
| M8A-D10 | tag 约定更正 | 共有 tag 里的 `fsm` 作废，只用全库已有的 `state-machine`（两波同）；m8b 已批准，组名 `blink-two-rates`、`debounce`、`sensor-smoothing`，与本波 18 个程序逐个对过无同题 |
