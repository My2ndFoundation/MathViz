"""ch34-pico 的 property 参考实现（第 6 期 m8a，MicroPython 层，runtime micropython-pico）。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（实测记录见构建报告）。

**参照是纯 Python，不 import machine / utime**。门导入被测程序之前装硬件桩（#201），
入口只许是纯逻辑函数；本章 6 个入口（blink_schedule、duty、servo_duty、celsius、ticks_diff、apply）
都只做整数 / 浮点算术，不碰引脚、不 sleep、不读 ticks_ms。参照里写死的常量
（65535、20000、500、2500、3.3、0.706、0.001721）**必须与对应 `.py` 顶部 / 函数里的数一致**。

**据官方文档、本机未实测**（本机没有 MicroPython；裁决 M8A-D6）：
- `utime.ticks_diff(t1, t2)` 返回有符号值，范围 [-TICKS_PERIOD/2, TICKS_PERIOD/2 - 1]，TICKS_PERIOD 是 2 的幂、
  因 port 而异；`ticks_add(0, -1)` 交回 TICKS_MAX（MicroPython `docs/library/time.rst`，ticks_ms / ticks_diff /
  ticks_add 三节）。所以 `elapsed-ticks-diff` 把 period 当实参，不写死任何 port 的值；
- `PWM.duty_u16` 取 0..65535，占空比 = value / 65535；`ADC.read_u16` 取 0..65535（`docs/library/machine.PWM.rst`、
  `machine.ADC.rst`）；温度公式 27 - (V - 0.706) / 0.001721 取自 RP2040 数据手册的温度传感器一节。

**舍入 / 回绕的实测（全定义域穷举，不抽样；数字见构建报告）：**
- `pwm-duty-percent`：0..100 共 101 个。被测「加 50 再 // 100」== Fraction 四舍五入 101/101；
  「截断」（去掉 + 50）不符 50/101；`round(p * 65535 / 100)`（银行家舍入）不符 2/101（p = 30、70：
  真实值恰为 .5 的 p 是 10、30、50、70、90，其中 10 / 50 / 90 半数取偶恰好也是进位）。
  所以 `_duty_cases` 三成的组专取 p ≡ 10 (mod 20)——**别删**：它是 round() 写法的唯一守门。
- `pwm-servo-angle`：0..180 共 181 个。被测 == 参照 181/181；「截断」不符 89/181；
  0..180 里「恰为 .5」只有 angle = 135（6553.5），半数取偶与四舍五入在那里都给 6554——
  **`round(width * 65535 / 20000)` 在本定义域上与正确写法等价，不能当负控制**（同 M8A-D7 compass 那一类）。
- `adc-temperature`：0..65535 共 65 536 个。被测（浮点）== 参照（Fraction 精确算、最后 float 取一位）65536/65536；
  精确值乘 10 恰为 .5 的读数 0 个（浮点与精确分数的舍入不会分歧）；「取整到个位」不符 65536/65536（类型也不同）。
- `elapsed-ticks-diff`：`_ticks_cases` 一半的组专造回绕边界（相差 0、±1、period/2 - 1、-period/2），
  period 取 16 / 64 / 256 / 1024——**别删**：「直接相减」只在跨过回绕点的组上露馅，
  「> 代替 >=」只在恰为 period/2 的组上露馅。

**专门构造的分支（别删）：**
- `_bitmask_cases`：一半的组 mask 很稀（至多 2 个 1）、随机操作里 clear 占四成，另有一半的组第一步
  就清一个本来是 0 的位——「clear 写成 ^=」只在「清一个本来就是 0 的位」时露馅（起草原型只随机时
  82/200，加了这两条之后门的种子下 127/200）；invert 占一成五，守「忘了 & 0xFF」（51/200）。
- `_blink_cases`：一成的组 n = 0（空计划那一支）。

**entry 不改实参。** 本章入口收的都是整数、字符串组成的元组与列表；`apply` 只读 ops、不改它。
构建时逐个用 `copy.deepcopy` 比对过跑前跑后的实参（见构建报告）。
"""
from fractions import Fraction

MAX_DUTY = 65535


# ── 参照 ─────────────────────────────────────────────────────────────────

def _blink(n, on_ms, off_ms):
    # 被测：累加 t，每轮追加开、关两个事件。参照：第 k 个事件直接按下标算时刻与电平。
    cycle = on_ms + off_ms
    return [((k // 2) * cycle + (on_ms if k % 2 else 0), 1 - k % 2) for k in range(2 * n)]


def _half_up(x):
    # Fraction 精确四舍五入（半数进位）：与被测的「加半个除数再整除」机制不同。
    whole = x.numerator // x.denominator
    return whole + (1 if x - whole >= Fraction(1, 2) else 0)


def _duty(percent):
    return _half_up(Fraction(percent * MAX_DUTY, 100))


def _servo_duty(angle):
    width = 500 + (Fraction(angle * 2000, 180).numerator // Fraction(angle * 2000, 180).denominator)
    return _half_up(Fraction(width * MAX_DUTY, 20000))


def _celsius(raw):
    # 全程精确分数，最后才转 float 取一位；被测是浮点一路算下来。
    v = Fraction(raw) * Fraction(33, 10) / MAX_DUTY
    c = 27 - (v - Fraction(706, 1000)) / Fraction(1721, 1000000)
    return round(float(c), 1)


def _ticks_diff(new, old, period):
    # 被测：取余再按半圈条件减一整圈。参照：在 [-period/2, period/2) 里逐个试，找 old 加多少得 new。
    for d in range(-(period // 2), period // 2):
        if (old + d) % period == new:
            return d
    return None


def _apply(mask, ops):
    # 被测：| & ~ ^ 位运算。参照：拆成 8 个 0/1 的列表逐位改，再按权相加拼回。
    bits = [(mask >> i) & 1 for i in range(8)]
    for op, bit in ops:
        if op == 'set':
            bits[bit] = 1
        elif op == 'clear':
            bits[bit] = 0
        elif op == 'toggle':
            bits[bit] = 1 - bits[bit]
        elif op == 'invert':
            bits = [1 - b for b in bits]
    return sum(b * 2 ** i for i, b in enumerate(bits))


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _blink_cases(rng):
    n = 0 if rng.random() < 0.1 else rng.randint(1, 5)
    return (n, rng.randint(1, 500), rng.randint(1, 500))


def _duty_cases(rng):
    if rng.random() < 0.3:
        return (rng.choice([10, 30, 50, 70, 90]),)          # 真实值恰为 .5：守 round() 写法
    return (rng.randint(0, 100),)


def _servo_cases(rng):
    if rng.random() < 0.3:
        return (rng.choice([0, 1, 9, 135, 179, 180]),)      # 两端、脉宽整除的边、唯一的 .5（135）
    return (rng.randint(0, 180),)


def _celsius_cases(rng):
    if rng.random() < 0.5:
        return (rng.randint(12000, 16000),)                 # 室温附近真会读到的范围
    return (rng.randint(0, 65535),)


def _ticks_cases(rng):
    period = rng.choice([16, 64, 256, 1024])
    old = rng.randrange(period)
    if rng.random() < 0.5:
        delta = rng.choice([0, 1, -1, period // 2 - 1, -(period // 2)])
    else:
        delta = rng.randint(-(period // 2), period // 2 - 1)
    return ((old + delta) % period, old, period)


def _bitmask_cases(rng):
    if rng.random() < 0.5:
        mask = sum(1 << b for b in rng.sample(range(8), rng.randint(0, 2)))
    else:
        mask = rng.randint(0, 255)
    ops = []
    for _ in range(rng.randint(0, 6)):
        roll = rng.random()
        if roll < 0.4:
            op = 'clear'
        elif roll < 0.6:
            op = 'set'
        elif roll < 0.85:
            op = 'toggle'
        else:
            op = 'invert'
        ops.append((op, rng.randint(0, 7)))
    zeros = [b for b in range(8) if not (mask >> b) & 1]
    if zeros and rng.random() < 0.5:
        ops.insert(0, ('clear', rng.choice(zeros)))        # 第一步就清一个本来是 0 的位：守「clear 写成 ^=」
    return (mask, ops)


REFERENCES = {
    'blink-gpio-pin': {'ref': _blink, 'cases': _blink_cases},
    'pwm-duty-percent': {'ref': _duty, 'cases': _duty_cases},
    'pwm-servo-angle': {'ref': _servo_duty, 'cases': _servo_cases},
    'adc-temperature': {'ref': _celsius, 'cases': _celsius_cases},
    'elapsed-ticks-diff': {'ref': _ticks_diff, 'cases': _ticks_cases},
    'gpio-bitmask': {'ref': _apply, 'cases': _bitmask_cases},
}
