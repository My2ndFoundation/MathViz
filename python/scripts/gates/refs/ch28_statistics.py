"""ch28-statistics 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里说「实测」的变异，都是把被测 `.py` 里那一行
改坏、跑 check.py 看到 algorithm_property_check 断言红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**参照是纯 Python，不 import numpy**（第 4 期 scipy-stack 层的约定）。被测程序多半用 numpy
的浮点求和；参照尽量走**整数精确算术**（`fractions.Fraction`，最后一步才变成 float），
所以两边不共享任何一步浮点运算——cases 因此一律是小整数。

**舍入写法。** 浮点结果入口与参照两边都 `round(v, 9)`；`normal-probabilities`、
`z-test-one-sample` 两边 `round(v, 6)`（参照是辛普森数值积分）。例外：`mean-median-mode`
的 `median` 两边都**不**舍入——cases 是整数，中位数要么是一个整数、要么是两个整数之和除以 2，
在 float 里精确可表示，两边算出的是同一个精确值。

**辛普森积分**（`_simpson_std_normal`）：标准正态密度，步长 h ≤ 1/200（区间先截到 [-10, 10]，
截掉的尾部面积 < 1e-22）。复合辛普森的截断误差上界 (b - a) h^4 max|f''''| / 180，
f'''' 的最大值 3 / sqrt(2 pi) ≈ 1.2，区间长 ≤ 20：≤ 20 × 6.25e-10 × 1.2 / 180 ≈ 8.3e-11，
远小于 6 位舍入要求的 1e-7。在门的 200 组上实测的最大绝对误差见构建报告。
这里不用 `math.erf` / `math.erfc`：`NormalDist.cdf` 的实现就是 `erfc`（inspect.getsource 可见），同源。

**entry 不改实参。** 本章每个 entry 都只读实参（`sorted` 另建新列表、`np.array` 另建新数组）。
构建时逐个用 `copy.deepcopy` 比对过跑前跑后的实参。
"""
import math
from fractions import Fraction


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _median_cases(rng):
    # 长度奇偶各半（奇 1..13、偶 2..14），值域 0..9，重复多。
    # 偶数长时四分之三的组要求排序后中间两数不等：原型里「偶数个也取中间一个」只在中间两数
    # 不等时露馅（相等时两种写法同值）——这一条是那个变异的守门，别删。
    odd = rng.random() < 0.5
    n = 2 * rng.randint(1, 7) - (1 if odd else 0)
    want_gap = (not odd) and rng.random() < 0.75
    for _ in range(50):
        xs = [rng.randint(0, 9) for _ in range(n)]
        if not want_gap:
            break
        s = sorted(xs)
        if s[n // 2 - 1] != s[n // 2]:
            break
    return (xs,)


def _sd_cases(rng):
    # 长 2..12、值 0..20 的整数；十分之一的组全部相同（标准差为 0）。
    n = rng.randint(2, 12)
    if rng.random() < 0.1:
        return ([rng.randint(0, 20)] * n,)
    return ([rng.randint(0, 20) for _ in range(n)],)


def _not_constant(rng, n):
    while True:
        vs = [rng.randint(-10, 12) for _ in range(n)]
        if len(set(vs)) > 1:
            return vs


def _paired_cases(rng):
    # 裁决 D5(a)：x、y 都不是常数列（否则分母为 0 出 nan，nan != nan 门红得与程序无关）。
    # 长 3..10；五分之一的组 y 恰好是 x 的直线 a x + b（a ≠ 0），r 恰好是 ±1。
    n = rng.randint(3, 10)
    xs = _not_constant(rng, n)
    if rng.random() < 0.2:
        a = rng.choice((-3, -2, -1, 1, 2, 3))
        b = rng.randint(-5, 5)
        return xs, [a * x + b for x in xs]
    return xs, _not_constant(rng, n)


def _normal_cases(rng):
    # 裁决：区间在均值两侧、一侧、宽度为 0 三种都要有，各占三分之一。
    # mu -20..20、sigma 1..10，端点是整数，离 mu 不超过 4 sigma。
    mu = rng.randint(-20, 20)
    sigma = rng.randint(1, 10)
    kind = rng.randrange(3)
    reach = 4 * sigma
    if kind == 0:                          # 两侧：a < mu < b
        a = mu - rng.randint(1, reach)
        b = mu + rng.randint(1, reach)
    elif kind == 1:                        # 一侧：都在 mu 的同一边（可以有一端正好是 mu）
        lo, hi = sorted((rng.randint(0, reach), rng.randint(0, reach)))
        if rng.random() < 0.5:
            a, b = mu + lo, mu + hi
        else:
            a, b = mu - hi, mu - lo
    else:                                  # 宽度为 0
        a = b = mu + rng.randint(-reach, reach)
    return mu, sigma, a, b


def _z_cases(rng):
    # 裁决：样本均值偏移 0 / 小 / 大三档各占三分之一，保证 reject 真假两支都走到
    # （偏移 0 与小的多半不拒绝，大的一定拒绝）。命中数见构建报告。
    n = rng.randint(4, 25)
    sigma = rng.randint(1, 10)
    mu0 = rng.randint(-50, 50)
    se = sigma / math.sqrt(n)
    tier = rng.randrange(3)
    shift = (0.0, 1.0 * se, 4.0 * se)[tier] * rng.choice((-1, 1))
    sample = [mu0 + round(shift + rng.gauss(0, sigma)) for _ in range(n)]
    return sample, mu0, sigma


# ── 参照 ─────────────────────────────────────────────────────────────────

def _kth_smallest(xs, k):
    # 不排序：v 是第 k 小（从 0 数）当且仅当「比它小的」不超过 k 个、「不大于它的」超过 k 个。
    for v in xs:
        below = sum(1 for w in xs if w < v)
        upto = sum(1 for w in xs if w <= v)
        if below <= k < upto:
            return v
    raise ValueError('unreachable')


def _median_by_rank(xs):
    # 被测程序排序后取中；参照对每个候选数数排名。实测：偶数分支写成
    # `return float(ordered[mid])`、奇数分支写成 `float(ordered[mid - 1])`，门各自红。
    n = len(xs)
    if n % 2 == 1:
        return float(_kth_smallest(xs, n // 2))
    return (_kth_smallest(xs, n // 2 - 1) + _kth_smallest(xs, n // 2)) / 2


def _sample_sd_exact(xs):
    # 被测程序用 numpy 的 std(ddof=1)（先求均值、再求离差平方和）。参照走一遍式的整数精确算术：
    # 离差平方和 = (n Σx² - (Σx)²) / n，全是整数，最后一步才开方。实测：ddof=1 改成 ddof=0，门红。
    n = len(xs)
    top = n * sum(x * x for x in xs) - sum(xs) ** 2
    return round(math.sqrt(Fraction(top, n * (n - 1))), 9)


def _pearson_exact(xs, ys):
    # 被测程序（两个变体）用 numpy：一个照定义算离差，一个用 np.corrcoef。参照用整数精确的
    # 一遍式：S_xy = n Σxy - Σx Σy，S_xx、S_yy 同理；r = S_xy / sqrt(S_xx S_yy)。
    # 实测（by-formula）：分子写成 (dx * dx).sum()、分母漏掉 np.sqrt，门各自红；
    # （corrcoef）取 matrix[0, 0]，门红。
    n = len(xs)
    sxy = n * sum(x * y for x, y in zip(xs, ys)) - sum(xs) * sum(ys)
    sxx = n * sum(x * x for x in xs) - sum(xs) ** 2
    syy = n * sum(y * y for y in ys) - sum(ys) ** 2
    return round(sxy / math.sqrt(sxx * syy), 9)


def _line_exact(xs, ys):
    # 被测程序（两个变体）用 numpy：一个照公式算离差，一个用 np.polyfit。参照用 Fraction 精确求
    # 斜率 S_xy / S_xx 与截距 (Σy - b Σx) / n，最后一步才变成 float。
    # 实测（by-formula）：截距写成 y.mean() + slope * x.mean()、斜率分母写成 (dx ** 2).mean()，门各自红；
    # （polyfit）写成 np.polyfit(ys, xs, 1)，门红。
    n = len(xs)
    sxy = n * sum(x * y for x, y in zip(xs, ys)) - sum(xs) * sum(ys)
    sxx = n * sum(x * x for x in xs) - sum(xs) ** 2
    slope = Fraction(sxy, sxx)
    intercept = (sum(ys) - slope * sum(xs)) / n
    return round(float(slope), 9), round(float(intercept), 9)


SQRT_2PI = math.sqrt(2 * math.pi)


def _phi(t):
    return math.exp(-t * t / 2) / SQRT_2PI


def _simpson_std_normal(lo, hi):
    # 标准正态密度从 lo 到 hi 的面积（lo <= hi），复合辛普森，步长 ≤ 1/200。
    lo, hi = max(lo, -10.0), min(hi, 10.0)
    if hi <= lo:
        return 0.0
    steps = 2 * math.ceil((hi - lo) * 100)
    h = (hi - lo) / steps
    total = _phi(lo) + _phi(hi)
    for i in range(1, steps):
        total += (4 if i % 2 else 2) * _phi(lo + i * h)
    return total * h / 3


def _between_by_simpson(mu, sigma, a, b):
    # 被测程序用 NormalDist(mu, sigma).cdf 相减（内部是 erfc）。参照把端点标准化后对密度做
    # 数值积分。实测：写成 dist.cdf(b) - dist.cdf(-a)、写成 1 - dist.cdf(a)，门各自红。
    return round(_simpson_std_normal((a - mu) / sigma, (b - mu) / sigma), 6)


def _z_test_by_simpson(sample, mu0, sigma):
    # z：被测程序先求均值再减 mu0、除以 sigma / sqrt(n)；参照先用整数算 Σx - n mu0，一次除法。
    # p：被测程序用 NormalDist().cdf；参照 1 - 2 × ∫_0^|z| φ（辛普森）。reject：参照用未舍入的 p。
    # 实测：p 漏掉因子 2、reject 写成 p > ALPHA、z 的分母写成 sigma（漏掉 / math.sqrt(n)），门各自红。
    n = len(sample)
    z = (sum(sample) - n * mu0) / (sigma * math.sqrt(n))
    p = 1 - 2 * _simpson_std_normal(0.0, abs(z))
    return round(z, 6), round(p, 6), p < 0.05


REFERENCES = {
    'mean-median-mode': {
        'ref': _median_by_rank,
        'cases': _median_cases,
    },
    'population-vs-sample-sd': {
        'ref': _sample_sd_exact,
        'cases': _sd_cases,
    },
    'pearson-by-formula': {
        'ref': _pearson_exact,
        'cases': _paired_cases,
    },
    'pearson-corrcoef': {
        'ref': _pearson_exact,
        'cases': _paired_cases,
    },
    'regression-by-formula': {
        'ref': _line_exact,
        'cases': _paired_cases,
    },
    'regression-polyfit': {
        'ref': _line_exact,
        'cases': _paired_cases,
    },
    'normal-probabilities': {
        'ref': _between_by_simpson,
        'cases': _normal_cases,
    },
    'z-test-one-sample': {
        'ref': _z_test_by_simpson,
        'cases': _z_cases,
    },
}
