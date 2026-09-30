"""ch33-microbit 的 property 参考实现（第 6 期 m8a，MicroPython 层，runtime micropython-microbit）。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（实测记录见构建报告）。

**参照是纯 Python，不 import microbit / radio / music**。门导入被测程序前装硬件桩（#201），
入口只许是纯逻辑函数（碰硬件即 HardwareStubCalled）；`scroll-and-show` 只有显示与等待，不挂 P。
参照里写死的常量（-1024 / 1023 / 5 列、八方位名、A4 = 440 Hz）**必须与对应 `.py` 顶部的常量一致**。

**据文档、未实测**（本机没有 MicroPython，裁决 M8A-D6）：加速度计读数单位 milli-g、缺省量程 ±2000 mg
（microbit-micropython v2-docs accelerometer.html；文档**没有**写哪个方向的倾斜让 x / y 为正）；
罗盘 `compass.heading()` 返回「0 到 360 的整数，北为 0、顺时针」（compass.html 原文是 "from 0 to 360"，
清单写的 0..359——两者都在 `_compass_cases` 的定义域里，360 也当成北）；`radio.receive()` 没有报文时交回 None
（radio.html；`receive_bytes()` 同样）；`music` 的音名以 A4 = 440 Hz 为准（music.html）。这些只影响讲解，不影响参照：参照比的是纯函数。

**entry 不改实参。** 本章 entry 收的是数、字符串、bytes（不可变）与 list（`image_string` 的 5×5 表、
`count_presses` 的布尔列表）；两者只读不写（`[False] + samples` 是新列表）。构建时逐个用 `copy.deepcopy`
比对过跑前跑后的实参（见构建报告）。

**专门构造的分支（别删，每条都有守的变异，见构建报告）：**
- `_edge_cases`：一成全 True、一成全 False——「开头就按着算不算一次」「一直按着只算一次」；
- `_tilt_cases`：四成的组有一个轴**恰在阈值**（`<` 写成 `<=` 只在这里露馅），另有两轴绝对值相等的组
  （`>=` 写成 `>` 只在这里露馅）；随机交换 x / y，保证「前 / 后」两支也常被走到；
- `_column_cases`：一半的组落在五列的分界上（分界值与分界值减 1）——「四舍五入代替整除」「整除写错顺序」在这里露馅；
  另有越界的 ±2000、±1025 与恰在 LOW / HIGH 的组，守两个夹住分支；
- `_compass_cases`：一半的组落在 45 度格子的分界上（45k + 22 与 45k + 23），外加 0 与 360；
  **`round(heading / 45)`（银行家舍入）在整数航向上与被测写法等价**（heading / 45 从不恰为 .5）——
  **不得当负控制**（裁决 M8A-D7）；截断 `heading // 45` 才是会被抓住的错；
- `_csv_cases`：三成的组字段数不对（0、1、2、4、5 个字段，含空串；4、5 个各占三份）——`!= 3` 写成 `< 3` / `>= 3` 只在这里露馅；
  参照另会把非整数字段当 None，而被测会抛错：生成器只产出整数字段，所以两者在这条流上一致（守不住「字段不是整数」）；
- `_roundtrip_cases`：温度常取 -1、-128、127、0、-127、126——decode 的 `> 127` 写成 `>= 127` / `> 128`、
  encode 的 `% 256` 写成 `% 255` 都在这里露馅（m8a 修复轮实测，见修复报告）。
  **radio-packet-bytes 的 entry 是往返包装 `roundtrip`**（m8a 终审 I2）：原先 entry 是 `decode`、cases 自己造字节包，
  encode 那一空除 compile 外无门守（`% 255` 变异门绿）。参照是**恒等**——在定义域（设备号、光线 0..255，
  温度 -128..127）上「发出去再收回来」就该原样拿回，与被测的取余 / 减 256 毫无共同机制。
  守不住的：encode 与 decode **同时**错且恰好互相抵消（两个空都写错），以及定义域外的输入（被测本来就不接）；
- `_note_cases`：七个音名 × 八度 0..8 全定义域均匀抽（63 个组合，全定义域穷举见构建报告）。
"""
import math
from fractions import Fraction

LOW, HIGH, COLUMNS = -1024, 1023, 5
NAMES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _grid_cases(rng):
    return ([[rng.randint(0, 9) for _ in range(5)] for _ in range(5)],)


def _edge_cases(rng):
    roll = rng.random()
    n = rng.randint(0, 12)
    if roll < 0.1:
        return ([True] * n,)
    if roll < 0.2:
        return ([False] * n,)
    return ([rng.random() < 0.5 for _ in range(n)],)


def _tilt_cases(rng):
    th = rng.choice([200, 300, 500])
    roll = rng.random()
    if roll < 0.4:
        a = rng.choice([th, -th, th - 1, -(th - 1)])
        b = rng.choice([0, 17, th, -th, th - 1, -(th - 1)])
    elif roll < 0.5:
        a = rng.choice([1, -1]) * rng.randint(th, 1500)
        b = rng.choice([1, -1]) * abs(a)
    else:
        return (rng.randint(-2000, 2000), rng.randint(-2000, 2000), th)
    if rng.random() < 0.5:
        a, b = b, a
    return (a, b, th)


def _column_cases(rng):
    if rng.random() < 0.5:
        k = rng.randint(1, 4)
        edge = LOW + math.ceil(Fraction(2048 * k, COLUMNS))
        return (edge + rng.choice([-1, 0]),)
    return (rng.choice([rng.randint(-1100, 1100), LOW, HIGH, -2000, 2000, -1025, 1024]),)


def _compass_cases(rng):
    if rng.random() < 0.5:
        k = rng.randint(0, 7)
        return (rng.choice([45 * k + 22, 45 * k + 23]) % 360,)
    roll = rng.random()
    if roll < 0.1:
        return (0,)
    if roll < 0.2:
        return (360,)
    return (rng.randint(0, 360),)


def _csv_cases(rng):
    if rng.random() < 0.3:
        n = rng.choice([0, 1, 2, 4, 4, 4, 5, 5, 5])
        if n == 0:
            return ("",)
        return (",".join(str(rng.randint(-5, 99)) for _ in range(n)),)
    return (",".join([str(rng.randint(0, 255)), str(rng.randint(-10, 40)), str(rng.randint(0, 255))]),)


def _roundtrip_cases(rng):
    temp = rng.choice([rng.randint(-128, 127), -1, -128, 127, 0, -127, 126])
    return (rng.randint(0, 255), temp, rng.randint(0, 255))


def _note_cases(rng):
    return (rng.choice(["C", "D", "E", "F", "G", "A", "B"]), rng.randint(0, 8))


# ── 参照 ─────────────────────────────────────────────────────────────────

def _image_string(rows):
    # 被测：每行 str() 拼好、":".join；参照：查 "0123456789" 表逐字符接，行首（除第一行）补冒号
    out = ""
    for i in range(len(rows)):
        if i > 0:
            out = out + ":"
        for v in rows[i]:
            out = out + "0123456789"[v]
    return out


def _count_presses(samples):
    # 被测：zip 把「前一个 / 这一个」配对；参照：逐个样本记住上一个状态
    n = 0
    prev = False
    for s in samples:
        if s and not prev:
            n += 1
        prev = s
    return n


def _tilt(x, y, threshold):
    # 被测：一串 if；参照：两个候选按「绝对值降序、x 优先」排序取第一，再看够不够阈值
    cands = [(abs(x), 0, "right" if x > 0 else "left"), (abs(y), 1, "back" if y > 0 else "forward")]
    size, _, name = sorted(cands, key=lambda c: (-c[0], c[1]))[0]
    return name if size >= threshold else "flat"


def _column(reading):
    # 被测：夹住后 (reading - LOW) * 5 // 2048；参照：Fraction 精确的分界，逐个比
    v = max(LOW, min(HIGH, reading))
    c = 0
    while c < COLUMNS - 1 and Fraction(v - LOW) >= Fraction(2048 * (c + 1), COLUMNS):
        c += 1
    return c


def _point(heading):
    # 被测：(2h + 45) // 90 取模 8；参照：Fraction(h) + 45/2 再整除 45
    x = Fraction(heading) + Fraction(45, 2)
    return NAMES[int(x // 45) % 8]


def _parse(message):
    # 被测：split 后先数字段；参照：元组解包，个数不对由 ValueError 接住
    try:
        a, b, c = message.split(",")
        return (int(a), int(b), int(c))
    except ValueError:
        return None


def _roundtrip(device, temp, light):
    # 被测：decode(encode(...))，% 256 出、> 127 减 256 回；参照：定义域上的恒等——原样交回
    return (device, temp, light)


_A4_OCTAVE = {"C": 261.6256, "D": 293.6648, "E": 329.6276, "F": 349.2282,
              "G": 391.9954, "A": 440.0, "B": 493.8833}


def _frequency(name, octave):
    # 被测：从 A4 数半音、440 * 2 ** (n / 12)；参照：查第 4 八度的频率表（四位小数）再乘 2 的整数次幂
    return round(_A4_OCTAVE[name] * 2 ** (octave - 4))


REFERENCES = {
    'led-image-string': {'ref': _image_string, 'cases': _grid_cases},
    'button-press-edges': {'ref': _count_presses, 'cases': _edge_cases},
    'accelerometer-tilt': {'ref': _tilt, 'cases': _tilt_cases},
    'spirit-level-column': {'ref': _column, 'cases': _column_cases},
    'compass-point': {'ref': _point, 'cases': _compass_cases},
    'radio-packet-csv': {'ref': _parse, 'cases': _csv_cases},
    'radio-packet-bytes': {'ref': _roundtrip, 'cases': _roundtrip_cases},
    'music-note-frequency': {'ref': _frequency, 'cases': _note_cases},
}
