"""ch27-matplotlib 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（协议：种子 properties.SEED、SAMPLES 组、本文件的生成器；
红在哪组实参上见构建报告）。本章的生成器写在本文件里，不动 `_gen.py`。

本页只有 `histogram-bins` 挂 property（第 4 期 m6b 清单 §2.2）。

**scipy-stack 层的入口约定**（清单 §2.1 / §5）：入口收纯 Python 实参（整数列表与三个整数），
在函数里交给 numpy，返回纯 Python 值（`counts.tolist()` → `list[int]`）。参照写纯 Python，
不 import numpy / matplotlib。门逐层比「值相等且类型相同」（#192），所以入口若忘了 `.tolist()`、
交回 `list(counts)`（元素是 `np.int64`），门会红——实测见下。

**浮点**：本章被检查的返回值只有整数计数，没有浮点，所以入口与参照都**不**做 `round(v, 9)`
（清单 §5 的舍入约定只对返回浮点的入口适用；这里写明，免得有人以为漏了）。
cases 只造**整数**：被测的 np.histogram 用浮点边界（linspace）再逐边修正，参照用整数的
`(v - lo) * bins // (hi - lo)`——对整数值两者一致（构建时对 20000 组随机 bins / lo / hi、
范围内外的全部整数逐个比过，0 处不同）；浮点值落在边界上时两者可能差一位末位，不造。

**随机只在驱动里（第 3 期裁决 R2）。** 演示块用 `np.random.default_rng(<种子>)` 造分数；
这里的 cases 自己造整数列表，不经过被测程序的 rng。

**守什么（每条都实测过、看到门红；种子 properties.SEED 下 200 组里 150 组含 hi、109 组含 lo、
94 组踩中内部边界、134 组有低于 lo 的值、146 组有高于 hi 的值、3 组是空列表）：**
· 类型：被测改成返回 `list(counts)`（元素 np.int64）而不是 `counts.tolist()`——逐层类型比较红。
· 边界：被测把 `range=(lo, hi)` 改成 `(lo, hi + 1)`、或把 `bins=bins` 改成 `bins + 1`——红。
· 右端点：np.histogram 的「末格含右端点」没法在被测的一行里单独改坏，所以反过来改参照——
  参照丢掉恰好等于 hi 的值（`counts[bins - 1] += 1` 改成 `pass`），门在 `([26, 26, -14], 5, -14, 26)`
  上红。这证明 cases 真的踩到了右端点，「丢掉右端点」的实现过不了门。
· 范围外：参照把 `v < lo` 放宽成 `v < lo - 1`（多收一个低于下界的值），门红。高于 hi 那一侧
  同样放宽时参照自己越界抛 IndexError（崩溃，不是有效的红），所以那一侧只有上面的命中统计。
"""


def _hist_ref(values, bins, lo, hi):
    # 纯 Python、整数运算：先丢掉范围外的值，恰好等于上界的归最后一格，
    # 其余按「离下界多远 × 箱数 // 总宽」算出格号——与 np.histogram 的浮点边界 + 逐边修正机制不同。
    counts = [0] * bins
    span = hi - lo
    for v in values:
        if v < lo or v > hi:
            continue
        if v == hi:
            counts[bins - 1] += 1
        else:
            counts[(v - lo) * bins // span] += 1
    return counts


def _values_bins_range(rng):
    # bins 1..8；lo -20..20；一半的组让总宽是 bins 的整数倍（内部边界都是整数，能被值踩中），
    # 另一半总宽任取 1..60（边界多半不是整数）。值 0..30 个，取 lo - 5 .. hi + 5。
    bins = rng.randint(1, 8)
    lo = rng.randint(-20, 20)
    if rng.random() < 0.5:
        hi = lo + bins * rng.randint(1, 10)
    else:
        hi = lo + rng.randint(1, 60)
    values = [rng.randint(lo - 5, hi + 5) for _ in range(rng.randint(0, 30))]
    if rng.random() < 0.6:
        values += [hi] * rng.randint(1, 3)          # 右端点：只有末格收它
    if rng.random() < 0.3:
        values.append(lo)                            # 左端点：第一格收它
    if (hi - lo) % bins == 0 and rng.random() < 0.5:
        step = (hi - lo) // bins
        values += [lo + k * step for k in range(1, bins)]   # 内部边界：归右边那一格
    rng.shuffle(values)
    return values, bins, lo, hi


REFERENCES = {
    'histogram-bins': {'ref': _hist_ref, 'cases': _values_bins_range},
}
