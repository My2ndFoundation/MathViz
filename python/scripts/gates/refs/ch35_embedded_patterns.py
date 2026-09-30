"""ch35-embedded-patterns 的 property 参考实现（第 6 期 m8b，MicroPython 层）。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（实测记录见构建报告）。

**参照是纯 Python，不碰任何硬件名。** 被测程序导入时门装了硬件桩（microbit / machine / utime /
micropython …），入口只收内置值、交回内置类型；参照不导入被测模块，也不需要桩。

**时间一律是「这一拍的 elapsed_ms」**（清单 §4、裁决 D1）：被测的逻辑函数只做累加与比较；
参照多半反过来先求**绝对时刻**（前缀和）再判，机制因此不同。

**entry 不改实参。** 本章每个 entry 收的都是数、布尔、字节串，或由它们组成的列表 / 元组；
被测程序只读它们（构建时逐个用 copy.deepcopy 比对过跑前跑后的实参，见构建报告）。

**专门构造的分支（别删，每条都有守的变异，见构建报告）：**
- `_toggle_cases`：一半组的 elapsed 只取整除 interval 的步长（`step × {1, 1, 2, 3}`）——
  「`>=` 写成 `>`」只在「累加恰好等于周期」时露馅，随机 elapsed 很少撞上（清单原型初版 6/200）；
  另一半含「一拍大于一个周期」的 elapsed（`interval + 0..40`），守「一拍最多翻转一次、余量留到下一拍」。
- `_stable_time_cases`：一半组的 elapsed 只取 `stable_ms` 的大约数（stable_ms、一半、一半、五分之一）——
  「保持时长恰好等于 stable_ms」才分得出 `>=` 与 `>`（清单原型只命中 45/200；只取小约数 1 / 2 / 5 / 10 时更少，
  同种子 24/200；现在的构造 69/200，协议与负控制见构建报告）。
- `_fsm_cases`：elapsed 都整除两个阈值。一半组照清单原型（elapsed ∈ {25, 50, 50, 100}，按下时每拍 0.08、
  松开时每拍 0.3 概率翻转：长按与双击常出现）；另一半按得短、等得久（elapsed ∈ {25, 50}，0.15 / 0.1）——
  只照原型构造时，单改间隔那一处的「`>=` 写成 `>`」同种子只命中 17/200（原型的 68 是两处一起改），加这一半、长度放到 0–100 之后 54。
- `_heater_cases`：三成的组来回扫（每步 ±1、在 low − 1 与 high + 1 之间折返）——随机游走很少从下限一路爬到上限，
  上限处「`>=` 写成 `>`」只命中 28/200；加这一支后 52。
- `_uart_cases`：三成的组由长度恰为 max_len − 1 / max_len / max_len + 1 的行拼成——守「长度差一」。
- `_average_cases` / `_ema_cases`：样本可正可负——`//` 与 `>>` 向下取整，`int(a / b)` 向零截断，
  两者只在负数上分道（负控制：参照换成截断 → 门红，见构建报告）。
"""
import math
from fractions import Fraction


# ── two-leds-nonblocking ────────────────────────────────────────────────

def _toggles_ref(elapsed_list, interval_ms):
    # 被测：累加器 acc += elapsed、到期 acc -= interval。参照：绝对时刻 t 与下一次到期时刻 due。
    t, due, flips = 0, interval_ms, []
    for tick, elapsed in enumerate(elapsed_list):
        t += elapsed
        if t >= due:
            due += interval_ms
            flips.append(tick)
    return flips


def _toggle_cases(rng):
    interval = rng.choice([100, 250, 300, 500])
    if rng.random() < 0.5:
        step = rng.choice([d for d in (5, 10, 20, 25, 50) if interval % d == 0])
        return ([step * rng.choice([1, 1, 2, 3]) for _ in range(rng.randint(0, 40))], interval)
    return ([rng.choice([0, 7, 10, 50, 100, 120, interval]) + rng.randint(0, 40)
             for _ in range(rng.randint(0, 40))], interval)


# ── debounce-counter ────────────────────────────────────────────────────

def _debounce_ref(samples, n):
    # 被测：逐拍计数、一致即清零。参照：回看最近 n 个样本——都与稳定值不同、且都在上次翻转之后。
    stable, last_flip, levels = 0, -1, []
    for i in range(len(samples)):
        lo = i - n + 1
        if lo > last_flip and lo >= 0 and all(v != stable for v in samples[lo:i + 1]):
            stable, last_flip = samples[i], i
        levels.append(stable)
    return levels


def _counter_cases(rng):
    n = rng.randint(1, 5)
    glitch = rng.uniform(0.05, 0.5)
    level, samples = 0, []
    for _ in range(rng.randint(0, 40)):
        if rng.random() < 0.12:
            level = 1 - level
        samples.append(1 - level if rng.random() < glitch else level)
    return (samples, n)


# ── debounce-stable-time ────────────────────────────────────────────────

def _debounce_ms_ref(samples, stable_ms):
    # 被测：since 逐拍累加、电平一变就清零。参照：绝对时刻（前缀和）+ 当前电平连续段的起点。
    # 变化那一拍自己的 elapsed 不计入：一段的保持时长 = 现在的时刻 − 这一段第一拍的时刻；
    # 开头与初值 0 连成的那一段从时刻 0 算起（初值 last = 0，第 0 拍的 elapsed 也计入）。
    times, t = [], 0
    for elapsed, _ in samples:
        t += elapsed
        times.append(t)
    raws = [raw for _, raw in samples]
    stable, levels = 0, []
    for i, raw in enumerate(raws):
        j = i
        while j > 0 and raws[j - 1] == raw:
            j -= 1
        held = times[i] if (j == 0 and raw == 0) else times[i] - times[j]
        if held >= stable_ms and raw != stable:
            stable = raw
        levels.append(stable)
    return levels


def _stable_time_cases(rng):
    stable_ms = rng.choice([20, 30, 50])
    if rng.random() < 0.5:
        steps = [stable_ms, stable_ms // 2, stable_ms // 2, stable_ms // 5]   # 都整除 stable_ms，偏向大步
    else:
        steps = [1, 2, 5, 10, 20, 25]
    level, samples = 0, []
    for _ in range(rng.randint(0, 40)):
        if rng.random() < 0.15:
            level = 1 - level
        raw = 1 - level if rng.random() < 0.25 else level
        samples.append((rng.choice(steps), raw))
    return (samples, stable_ms)


# ── ring-buffer-isr-handoff ─────────────────────────────────────────────

def _ring_ref(capacity, ops):
    # 被测：预分配的格子 + head / count，满时覆盖最旧。参照：普通列表尾部追加、超长砍头。
    queue, got, overruns = [], [], 0
    for op in ops:
        if op[0] == 'put':
            queue.append(op[1])
            if len(queue) > capacity:
                queue = queue[1:]
                overruns += 1
        else:
            got.append(queue.pop(0) if queue else None)
    return (got, overruns)


def _ring_cases(rng):
    capacity = rng.randint(1, 5)
    p_put = rng.uniform(0.4, 0.85)
    ops = [('put', rng.randint(0, 99)) if rng.random() < p_put else ('get',)
           for _ in range(rng.randint(0, capacity * 6 + 4))]
    return (capacity, ops)


# ── uart-line-assembler ─────────────────────────────────────────────────

def _assemble_ref(chunks, max_len):
    # 被测：逐字节状态机（攒、跳过、换行时交出或计丢弃）。参照：整段拼起来按换行切，最后一段未完成不算。
    parts = b''.join(chunks).split(b'\n')[:-1]
    return ([p for p in parts if len(p) <= max_len], sum(1 for p in parts if len(p) > max_len))


def _uart_cases(rng):
    max_len = rng.randint(2, 8)
    if rng.random() < 0.3:
        lines = [bytes(rng.choice(b'abcXYZ') for _ in range(max_len + rng.choice([-1, 0, 1])))
                 for _ in range(rng.randint(1, 5))]
        data = b'\n'.join(lines) + (b'\n' if rng.random() < 0.7 else b'')
    else:
        alphabet = b'ab\n\n' + bytes([rng.randint(65, 70)])
        data = bytes(rng.choice(alphabet) for _ in range(rng.randint(0, 50)))
    cuts = sorted(rng.sample(range(len(data) + 1), min(len(data) + 1, rng.randint(0, 5))))
    chunks = [data[a:b] for a, b in zip([0] + cuts, cuts + [len(data)])]
    return (chunks, max_len)


# ── moving-average-window ───────────────────────────────────────────────

def _smooth_ref(samples, n):
    # 被测：环形下标 + 累计和，每拍 O(1)。参照：每拍重新切片求和，divmod 取商（向下取整）。
    out = []
    for i in range(len(samples)):
        window = samples[max(0, i - n + 1):i + 1]
        quotient, _ = divmod(sum(window), len(window))
        out.append(quotient)
    return out


def _average_cases(rng):
    return ([rng.randint(-1024, 1024) for _ in range(rng.randint(0, 30))], rng.randint(1, 6))


# ── median-filter-spikes ────────────────────────────────────────────────

def _median3_ref(samples):
    # 被测：max / min 组合，不排序。参照：把三个数排序取中间。
    return [x if i < 2 else sorted(samples[i - 2:i + 1])[1] for i, x in enumerate(samples)]


def _median_cases(rng):
    samples = [rng.choice([rng.randint(500, 520), rng.randint(0, 65535)]) if rng.random() < 0.3
               else rng.randint(500, 520) for _ in range(rng.randint(0, 30))]
    return (samples,)


# ── ema-fixed-point ─────────────────────────────────────────────────────

def _ema_ref(samples, k):
    # 被测：定点累加器，<< 与 >>。参照：Fraction 精确算平均值 a' = a + (x − ⌊a⌋) / 2**k，math.floor 取整。
    average, out = None, []
    for x in samples:
        if average is None:
            average = Fraction(x)
        else:
            average = average + Fraction(x - math.floor(average), 2 ** k)
        out.append(math.floor(average))
    return out


def _ema_cases(rng):
    return ([rng.randint(-2000, 2000) for _ in range(rng.randint(0, 30))], rng.randint(1, 4))


# ── press-classifier-fsm ────────────────────────────────────────────────

def _classify_ref(samples, long_ms, gap_ms):
    # 被测：逐拍的状态机。参照：先求绝对时刻与每段按下区间，再逐区间判短按 / 长按 / 双击。
    times, t = [], 0
    for elapsed, _ in samples:
        t += elapsed
        times.append(t)
    down = [pressed for _, pressed in samples]
    n = len(samples)
    events = []

    def press_end(a):
        b = a
        while b + 1 < n and down[b + 1]:
            b += 1
        return b

    i = 0
    while i < n:
        if not down[i]:
            i += 1
            continue
        a = i
        b = press_end(a)
        hit = next((j for j in range(a + 1, b + 1) if times[j] - times[a] >= long_ms), None)
        if hit is not None:
            events.append((hit, 'long'))
            i = b + 1
            continue
        if b + 1 >= n:
            break                       # 按着到结尾：还没判定
        release = b + 1
        q = release + 1
        while q < n and not down[q] and times[q] - times[release] < gap_ms:
            q += 1
        if q >= n:
            break                       # 松开后等到结尾：还没判定
        if down[q]:
            events.append((q, 'double'))
            i = press_end(q) + 1
            continue
        events.append((q, 'short'))
        i = q + 1
    return events


def _fsm_cases(rng):
    long_ms = rng.choice([400, 500])
    gap_ms = rng.choice([200, 250])
    if rng.random() < 0.5:          # 按住久、松开短：长按与双击常出现（清单原型的构造）
        release, press, steps = 0.08, 0.3, [25, 50, 50, 100]
    else:                           # 按得短、间隔长：短按常出现，间隔恰好等于 gap_ms 常出现
        release, press, steps = 0.15, 0.1, [25, 50]
    pressed, samples = False, []
    for _ in range(rng.randint(0, 100)):
        if rng.random() < (release if pressed else press):
            pressed = not pressed
        samples.append((rng.choice(steps), pressed))
    return (samples, long_ms, gap_ms)


# ── hysteresis-thermostat ───────────────────────────────────────────────

def _heater_ref(temps, low, high):
    # 被测：逐拍带记忆的两阈值判断。参照：每拍往回找最近一次越界（≤ low 或 ≥ high），找不到就是初始的关。
    out = []
    for i in range(len(temps)):
        state = False
        for t in reversed(temps[:i + 1]):
            if t <= low:
                state = True
                break
            if t >= high:
                state = False
                break
        out.append(state)
    return out


def _heater_cases(rng):
    low = rng.randint(16, 19)
    high = low + rng.randint(2, 4)
    t = rng.randint(low - 2, high + 2)
    temps = []
    if rng.random() < 0.3:          # 来回扫：每一趟都一度一度地经过 low 与 high，恰好等于阈值必然出现
        d = 1
        for _ in range(rng.randint(0, 30)):
            if t >= high + 1 or (t >= low and rng.random() < 0.15):
                d = -1
            elif t <= low - 1 or (t <= high and rng.random() < 0.15):
                d = 1
            t += d
            temps.append(t)
        return (temps, low, high)
    for _ in range(rng.randint(0, 30)):
        t += rng.choice([-1, 0, 1])
        temps.append(t)
    return (temps, low, high)


REFERENCES = {
    'two-leds-nonblocking': {'ref': _toggles_ref, 'cases': _toggle_cases},
    'debounce-counter': {'ref': _debounce_ref, 'cases': _counter_cases},
    'debounce-stable-time': {'ref': _debounce_ms_ref, 'cases': _stable_time_cases},
    'ring-buffer-isr-handoff': {'ref': _ring_ref, 'cases': _ring_cases},
    'uart-line-assembler': {'ref': _assemble_ref, 'cases': _uart_cases},
    'moving-average-window': {'ref': _smooth_ref, 'cases': _average_cases},
    'median-filter-spikes': {'ref': _median3_ref, 'cases': _median_cases},
    'ema-fixed-point': {'ref': _ema_ref, 'cases': _ema_cases},
    'press-classifier-fsm': {'ref': _classify_ref, 'cases': _fsm_cases},
    'hysteresis-thermostat': {'ref': _heater_ref, 'cases': _heater_cases},
}
