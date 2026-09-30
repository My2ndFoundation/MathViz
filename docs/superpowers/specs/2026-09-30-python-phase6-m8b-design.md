# Python 子项目 · 第 6 期 · 波 m8b：py-embedded-patterns 程序清单

> 状态：**已批准**（2026-09-30，Python编程 审定 5704977；裁决见 §8）。派构建者等 boards PR 与第 5 期收尾 PR 合并（派发简报 §0）。
> 日期：2026-09-30
>
> 上游：主规格 §2.2（`py-embedded-patterns` — 非阻塞主循环、按键去抖、环形缓冲、有限状态机、传感器滤波）、
> §5.4 末段（MicroPython 层，#201）；第 6 期派发简报 `.superpowers/python-phase6/phase6-brief.md` §2；
> m8a 已批准清单（`cc212b2`，Python编程 转达：`button-press-edges` 讲边沿、**不去抖**；`timer-periodic-callback` 讲硬件定时器回调；
> `pin-irq-counter` 讲中断本身；`gpio-bitmask` 讲位运算；`elapsed-time` 组讲直接相减 vs `ticks_diff` 回绕；组名 `radio-packet`、`elapsed-time`）。

---

## 0. 固定取值

| 页 | 章目录 | refs 文件 | 页名（title，提请审定） | 程序数 |
|---|---|---|---|---|
| `py-embedded-patterns` | `ch35-embedded-patterns` | `gates/refs/ch35_embedded_patterns.py` | 「嵌入式编程模式」/ "Embedded Patterns" | 11 |

`module` = 8，`accent` = `emerald`，`requires` = `[]`，**没有 `run` 字段**。合计 **11 个程序、3 个变体组、10 个带 P、0 个 `chunks`、0 个用递归**。
页名与模块名「嵌入式 Python」/ "Embedded Python" 不同形（模块名在导航分组里，页名在卡片上）。

**变体组名**（本波新起；已对全库 ch01–ch32 的 `problem` 名与 m8a 的 `radio-packet` / `elapsed-time` 查过无重名）：
`blink-two-rates`、`debounce`、`sensor-smoothing`。

**tag**（全库 grep 过，下列除 `state-machine`（3 处）、`filter`（4 处）、`timer`（2 处）外都是新 tag）：
`micropython`、`microbit` / `pico`（按 runtime 二选一）、`gpio`、`debounce`、`ring-buffer`、`state-machine`、`interrupt`、`uart`、`bytes`、`fixed-point`、`hysteresis`、`non-blocking`。
~~`fsm`~~：**不用**（§8 D3）——状态机程序只挂全库已有的 `state-machine`（ch21 / ch22 / ch29 共 3 处）。

---

## 1. 查重与边界来源

| 已有 / 并行 | 在哪 | 本波怎么避开 |
|---|---|---|
| 边沿计数、`is_pressed` / `was_pressed`（不去抖） | m8a `py-microbit` · `button-press-edges` | 去抖从「抖动」本身讲起：原始电平序列里的毛刺；边沿检测只用、讲解指回「micro:bit」页 |
| 硬件定时器回调 | m8a `py-pico` · `timer-periodic-callback` | 本页讲**主循环里的软件调度**（不开定时器），讲解对照一句「硬件定时器见树莓派 Pico 页」 |
| 中断本身（`Pin.irq`、计数） | m8a `py-pico` · `pin-irq-counter` | 本页 `ring-buffer-isr-handoff` 讲「中断 → 主循环」的**数据交接**，中断注册只用、不重讲 |
| `ticks_diff` 回绕（`elapsed-time` 组） | m8a `py-pico` | **本页不再做回绕程序**（派发简报 §2.1 要求的「专门讲回绕」由 m8a 覆盖）；本页凡涉及时间，`main()` 用 `ticks_diff` 算出 `elapsed_ms` 传给逻辑函数，讲解指回「树莓派 Pico」页的 elapsed-time（§4） |
| 位运算 `gpio-bitmask` | m8a | 本页不做位掩码程序（原拟的 `status-flags-bitmask` 已删）；`ema-fixed-point` 用 `>>` 做除法，讲解指回 |
| 循环队列 `circular-queue-array`（满时**拒绝**入队） | ch12 `py-stack-queue` | `ring-buffer-isr-handoff` 满时**覆盖最旧**并数溢出——策略不同是教学点，讲解明写对照、指回「栈与队列」页 |
| `traffic-light-fsm`（按时长循环的状态机） | ch21 | `press-classifier-fsm` 是**事件驱动**、带超时的状态机，输入是按键电平序列；`hysteresis-thermostat` 是两态带记忆的阈值 |
| `screen-states`（pygame 画面状态） / `ttt-game-loop` | ch29 / ch22 | 同上，不同的驱动方式；不重讲状态机概念，讲解一句指回 |
| `bullet-cooldown`（按时间限频） | ch32 | `debounce-stable-time` 是「**电平保持够久才承认**」、每次变化计时清零——与冷却的「距上次触发够久」机制相反；讲解点明区别 |
| `mean-median-mode` | ch28 | 滤波组做**滑动窗口**上的均值 / 中值，是流式算法，不是整列统计 |
| `move-with-dt` / `animation-frames`（pygame 按帧时间） | ch29 / ch30 | `two-leds-nonblocking` 讲的是累加器「减掉一个周期」而不是「清零」——不漂移；pygame 页没讲这一点 |

---

## 2. 程序清单

「组」空 = 单个程序（`problem` = id）。「P」= property：入口是纯逻辑函数，收内置值、返回内置类型，参照纯 Python、机制不同，**不碰硬件**（碰了门报 `HardwareStubCalled`）。
每个程序：`from microbit import *` 或 `from machine import …` 等 → 常量（可用 `const()`）→ 纯逻辑函数 → `main()`（引脚、显示、主循环）→ 恰好一个 `if __name__ == "__main__": main()`。取向 40–70 行。

| id | 组 | runtime | 教什么 | P 入口 · 参照 |
|---|---|---|---|---|
| `two-leds-blocking` | blink-two-rates | pico | 两盏灯各按 300 ms / 500 ms 闪：用 `sleep_ms` 写，**第二盏被第一盏的睡眠拖住**——阻塞主循环的毛病（讲解用文字算出实际周期） | —（整段就是 `sleep_ms`，没有可比的纯逻辑） |
| `two-leds-nonblocking` | blink-two-rates | pico | 同一需求，主循环不睡：每盏灯一个累加器，`acc += elapsed`，到周期就翻转并 **`acc -= interval`**（不是清零：清零会漂移） | `toggles(elapsed_list, interval_ms)` → 翻转发生的拍号列表 · 参照：绝对时刻表（下一次到期时刻 `due += interval`） |
| `debounce-counter` | debounce | microbit | 外接开关（`pin0.read_digital()`，原始电平）：与稳定值不同的样本**连续** n 个才承认，一致就清零计数 | `debounce(samples, n)` → 每拍的稳定值列表 · 参照：回看最近 n 个样本、且都在上次翻转之后 |
| `debounce-stable-time` | debounce | microbit | 同一需求按时间：电平每变一次计时清零，**保持够 `stable_ms`** 才承认 | `debounce_ms(samples, stable_ms)`（`samples` 是 `(elapsed_ms, level)` 对）· 参照：绝对时刻 + 当前电平连续段的起点 |
| `ring-buffer-isr-handoff` | | pico | 中断里只 `put`、主循环 `get`：预分配列表 + `head` / `count`，满时覆盖最旧并数溢出；为什么中断里不 `append`（分配内存） | `run(capacity, ops)` → `(取出的值列表, 溢出次数)` · 参照：普通列表尾部追加、超长砍头 |
| `uart-line-assembler` | | pico | `uart.read()` 一次给的字节不按行切：跨块拼行、遇 `b"\n"` 交出一行；超长行整行丢弃、数一次 | `assemble(chunks, max_len)` → `(行列表, 丢弃行数)` · 参照：整段 `b"".join` 后 `split(b"\n")`，最后一段未完成不算 |
| `moving-average-window` | sensor-smoothing | microbit | 加速度计 `get_x()`（可正可负）：窗口里的滑动平均，环形下标 + 累计和，每拍 O(1)；窗口没满时除以已有个数；**整数 `//` 向下取整**（负数与 `int(a / b)` 不同） | `smooth(samples, n)` · 参照：每拍切片求和再 `divmod` |
| `median-filter-spikes` | sensor-smoothing | pico | ADC（`read_u16()`）偶发尖峰：三点中值不排序，`max(min(a, b), min(max(a, b), c))`；均值会被尖峰拖走、中值不会 | `median3(samples)` · 参照 `sorted(window)[1]` |
| `ema-fixed-point` | sensor-smoothing | microbit | 指数滑动平均不用浮点：`acc += x - (acc >> k)`，输出 `acc >> k`；`>>` 对负数向下取整 | `ema(samples, k)` · 参照：`Fraction` 精确算，`math.floor` 取整 |
| `press-classifier-fsm` | | microbit | 一个键分出短按 / 长按 / 双击：状态 `IDLE → DOWN → WAIT → …`，长按到阈值就报（不等松开），双击后锁到松开 | `classify(samples, long_ms, gap_ms)` → `[(拍号, 事件)]` · 参照：先求绝对时刻与按下区间，再逐区间判 |
| `hysteresis-thermostat` | | microbit | `temperature()` 控加热：低于等于下限开、高于等于上限关、中间**保持原状态**——单一阈值会在阈值附近来回抖 | `heater(temps, low, high)` → 每拍开 / 关列表 · 参照：回看最近一次越界 |

runtime 分配：pico 5、microbit 6。每个程序只用本 runtime 真有的 API（构建简报会写明查证来源：MicroPython 官方文档的 micro:bit / rp2 port 页）。

---

## 3. 边界（交裁决）

| 程序 | 边界 | 定的语义 | 原型怎么逼出来 |
|---|---|---|---|
| `two-leds-nonblocking` | `acc == interval` | `>=` 触发 | 一半组的 elapsed 取整除周期的值 |
| `two-leds-nonblocking` | 一拍的 elapsed 大于两个周期 | 一拍最多翻转一次，余量留到下一拍（追赶） | 随机 elapsed 含 `interval + 0..40` |
| `debounce-counter` | 恰好 n 个 | `>=` 承认；n = 1 退化为不去抖 | n 取 1..5 |
| `debounce-stable-time` | 恰好 `stable_ms` | `>=`；变化那一拍自己的 elapsed 不计入 | elapsed 取整除 `stable_ms` 的值 |
| `ring-buffer-isr-handoff` | 满时 put / 空时 get | 覆盖最旧、溢出 +1 / 返回 `None` | 容量 1..5、put 概率 0.4..0.85 |
| `uart-line-assembler` | 恰好 `max_len` 字节的行 | 保留；`max_len + 1` 才丢；**丢弃行在它的换行到达时才计数**，结尾未完成的超长行不计 | 行长随机、块切点随机 |
| `moving-average-window` | 负数平均 | `//` 向下取整 | 样本 −1024..1024 |
| `ema-fixed-point` | 负数 `>>` | 向下取整；第一拍 `acc = x << k`（不从 0 爬升） | 样本 −2000..2000 |
| `press-classifier-fsm` | 按住恰好 `long_ms` / 间隔恰好 `gap_ms` | `>=`；按住到结尾、松开后等到结尾都**不报**（未判定） | elapsed 取 25 / 50 / 100，阈值 400 / 500、200 / 250 |
| `hysteresis-thermostat` | 温度恰好等于下限 / 上限 | `<=` 开、`>=` 关；初始关 | 整数温度随机游走 ±1 |

---

## 4. 时间与回绕

- 逻辑函数**不收时间戳，收 `elapsed_ms`**（本拍与上一拍的间隔）：`main()` 里 `now = ticks_ms(); elapsed = ticks_diff(now, last); last = now`，逻辑里只做累加与比较。
  这样逻辑函数**按构造就不受回绕影响**，也不必在本页重讲回绕（m8a `elapsed-time` 组的活）；讲解一句指回「树莓派 Pico」页。
- 派发简报 §2.1 写「逻辑函数里的时间以 `now_ms` 整数作实参传入」——本清单改成 `elapsed_ms`，理由如上；**提请审定**（§6 D1）。
- micro:bit 上 `sleep(ms)` 收毫秒，`utime.sleep(s)` 收秒——`two-leds-blocking` 的讲解写明；本页 pico 程序用 `utime.sleep_ms` 避开歧义。

---

## 5. 其它

### 5.1 随机
本波没有程序用随机。

### 5.2 资源
不用 `_fixtures/`，没有外部文件。

### 5.3 boards
派构建者要等 boards PR，考纲对照文件 `docs/superpowers/specs/2026-09-30-python-boards-syllabus-map.md` 届时进 main。**本清单只列每个程序的核心概念，`boards` 取值由构建者照那份文件定**（拿不准就不写，空列表合法）：

| 程序 | 按概念可能被点名的考纲点 |
|---|---|
| `press-classifier-fsm`、`hysteresis-thermostat` | 有限状态机 |
| `ring-buffer-isr-handoff` | 循环队列；中断 |
| `moving-average-window`、`median-filter-spikes`、`ema-fixed-point` | 无专门考纲点（算法本身不在考纲；`>>` 属位移，看对照文件） |
| `debounce-counter`、`debounce-stable-time`、`two-leds-*`、`uart-line-assembler` | 硬件 API 不在任何考纲——预计空列表 |

### 5.4 递归
本波没有递归（嵌入式栈小，讲解不提也可）。

---

## 6. 需要裁决的点

- **D1** 逻辑函数收 `elapsed_ms` 而不是 `now_ms`（§4）。推荐：收 `elapsed_ms`。
- **D2** 页名「嵌入式编程模式」/ "Embedded Patterns"。推荐：采用。
- **D3** `fsm` 与 `state-machine` 两个 tag 并挂（§0）。推荐：并挂。
- **D4** `two-leds-blocking` 不挂 P（11 个里 10 个挂，过半要求满足）。推荐：不挂。
- **D5** boards 由构建者照考纲对照文件定、本清单只给概念（§5.3）。推荐：采用。

---

## 7. 起草原型（`.superpowers/python-waves/m8b/proto.py`）

四件套（正确 / 错误 / 参照 / cases），`SEED = 20260916`、`SAMPLES = 200`、比较用门的 `_deep_mismatch`（逐层比值与类型）。
「正确 ≠ 参照」必须是 0；每个错误写法都是一次负控制，命中数 = 200 组里被参照判错的组数。

| 程序 | 正确 ≠ 参照 | 错误写法 → 命中 |
|---|---|---|
| `two-leds-nonblocking` | 0 | 清零代替减周期 126；`>` 代 `>=` 66 |
| `debounce-counter` | 0 | `>` 代 `>=` 123；一致时不清零 115 |
| `debounce-stable-time` | 0 | 变化时不清零 169；`>` 代 `>=` 45 |
| `ring-buffer-isr-handoff` | 0 | 满时不推进 `head` 62 |
| `uart-line-assembler` | 0 | 长度差一 51 |
| `moving-average-window` | 0 | `int(a / b)` 截断 140；填充期除以 n 163 |
| `median-filter-spikes` | 0 | 中值公式写错 170 |
| `ema-fixed-point` | 0 | `int(a / b)` 截断 146 |
| `press-classifier-fsm` | 0 | `>` 代 `>=` 68；双击后不锁 69 |
| `hysteresis-thermostat` | 0 | 严格 `<` / `>` 75；单阈值 67 |

原型过程中改过三处，都记在这里：
- `uart-line-assembler` 初版在「超长被发现的那一刻」计丢弃，参照在「换行到达时」计，200 组里 17 组不一致（结尾未完成的超长行）。定为换行到达时计（§3）。
- `two-leds-nonblocking` 的 `>` 负控制初版只命中 6/200（随机 elapsed 很少恰好凑满周期）；cases 一半改取整除周期的值后 66。`press-classifier-fsm` 同理（20 → 68）。
  构建者写 cases 时照此：**边界要专门造，不靠随机撞**。
- `debounce-stable-time` 只有 45 次命中（`>` 代 `>=`），低于约 50 的取向；构建者的 cases 要再偏向整除值。

---

## 8. 裁决（2026-09-30，Python编程 审定 5704977）

Python编程 逐程序对过 m8a（`cc212b2` 的 18 个）与全库：无同题（two-leds-nonblocking 是主循环 ticks 调度、m8a `timer-periodic-callback` 是硬件定时器回调；
ring-buffer-isr-handoff 是 ISR → 主循环交接、m8a `pin-irq-counter` 是中断本身；hysteresis-thermostat 消费温度、m8a `adc-temperature` 做换算）。组名不撞。

- **D1** 逻辑函数收 `elapsed_ms`：**采用**。比派发简报的 `now_ms` 更对（按构造不受回绕影响）——记为「简报被纠正」。
- **D2** 页名「嵌入式编程模式」/ "Embedded Patterns"：**采用**。
- **D3** **不并挂**：只用全库已有的 `state-machine`，不新造 `fsm`（简报约定表写 `fsm` 违反「tag 先 grep」，m8a 同样改）。构建者简报的约定表里 `fsm` → `state-machine`。
- **D4** `two-leds-blocking` 不挂 P：**采用**。
- **D5** boards 由构建者照考纲对照文件定：**采用**；核不实留 `[]`，依据写到考纲条目编号。
- `debounce-stable-time` 的 `>` 负控制 45/200 偏低：「cases 偏向整除 `stable_ms` 的 elapsed」写进构建者简报，构建者报告最终命中数。
- 派构建者等 boards PR 与第 5 期收尾 PR 合并，Python编程 发 SHA。

### 8.1 boards（按考纲对照文件 R1–R6 与概念组判，2026-09-30，#203 合并后）

| 程序 | boards | 概念组 | 依据 |
|---|---|---|---|
| `press-classifier-fsm` | AQA CIE | fsm | A 4.4.2.1 FSM · C 12.2 state-transition diagrams；OCR、Edexcel 未点名（与 `traffic-light-fsm`、`screen-states` 同组一致） |
| `hysteresis-thermostat` | AQA CIE | fsm | 同上：两态 + 越界事件的状态转移；滞回本身未点名 |
| `ring-buffer-isr-handoff` | AQA OCR Edexcel CIE | queue | 循环队列（R4 按 ADT 判）：A 4.2.2.1 circular · O 1.4.2(c) · E 14.1.5、18.2.1 · C 10.4（与 `circular-queue-array` 同组一致）；中断只是用 |
| `moving-average-window`、`median-filter-spikes`、`ema-fixed-point` | `[]` | sensor-smoothing（新组） | 滑动窗口滤波四家未点名；`central-tendency` 组的 E 18.1.4(b) 在数据科学 / pandas 语境下，按 R5 不套用；`>>` 只是用到（R1） |
| `debounce-counter`、`debounce-stable-time` | `[]` | debounce（新组） | 去抖、硬件输入四家未点名 |
| `two-leds-blocking`、`two-leds-nonblocking` | `[]` | embedded-loop（新组） | 非阻塞主循环 / 调度四家未点名（同 pygame 游戏循环的判法） |
| `uart-line-assembler` | `[]` | embedded-io（新组） | 串口分帧未点名；字节拼接只是用到（R1） |

**回到四家官方原文核过**（Python编程 提供的全文文本：AQA 7517、OCR H446 v3.0、Pearson IAL YCP01、CIE 9618 2027–29；grep 买的是「新概念有没有被点名」）：

| 概念 | AQA | OCR | Edexcel IAL | CIE | 对本波的影响 |
|---|---|---|---|---|---|
| 中断 / ISR | 4.7.3.6 | 1.2.1(c) | 11.2.1(e) | 4.1（CPU Architecture 之下）「purpose of interrupts … Interrupt Service handling Routine」 | `ring-buffer-isr-handoff` 的核心是循环队列（已四家），中断只是用——不改 |
| 缓冲（硬件 / I/O） | —（只有 memory buffer register） | — | 11.2.1(c) Role of buffering | 3.1「use of buffers」 | 都是理论层的「为什么要缓冲」。`uart-line-assembler` 的核心是按分隔符分帧 → R1 / R5 仍 `[]`（**拿不准**，列进对照文件「拿不准」） |
| 传感器 / 监控系统 | 4.5.6.3（ADC 与模拟传感器） | 1.2.1(e) 只点名 embedded OS | 11.1.5 Embedded systems（传感器、执行器、ADC） | 3.1 monitoring and control systems（sensors、actuators、**importance of feedback**） | `hysteresis-thermostat`：C 另有 3.1 控制系统 / 反馈佐证（已写 C）；E 11.1.5 讲部件不讲控制逻辑 → 不写 E（R5）。滤波三个：四家都只点名传感器 / ADC 本身，不点名滤波算法 → `[]` |
| 去抖、非阻塞主循环、滑动平均、中值滤波、定点 EMA、串口分帧 | — | — | — | — | 均未找到 |

对照文件附录表的 11 行由控制方在集成时补进 `docs/superpowers/specs/2026-09-30-python-boards-syllabus-map.md`（「新程序照 R1–R6 判，把一行加进附录表」），构建者照本表写 `boards`、不改对照文件；新概念（上表）的考纲条目也由控制方补进对照文件四家各自的一节，终审核附录行与 chapter.json 一致（Python编程 2026-09-30）。
