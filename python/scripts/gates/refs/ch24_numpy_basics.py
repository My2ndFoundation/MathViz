"""ch24-numpy-basics 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。每个被测入口的每个 return 分支都各做过一次变异
（把被测 `.py` 里那一行改坏、跑 `algorithm_property_check()` 看到红；协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**scipy-stack 层（清单 §1.3）。** 被测入口收 Python 内置值（列表、整数），内部转成
np.array，返回**逐层都是内置类型**（`.tolist()` / `float()`）；门逐层比类型（#192），
嵌套列表里留一个 np.int64 就是红。参照一律**纯 Python**，本文件不 import numpy。

**浮点舍入写法。** 本章返回浮点的只有 `mean-variance` 一组两个程序：被测入口写
`round(mean, 9), round(variance, 9)`（向量化那个先 `float(...)` 再 round——对 np.float64
直接 round 返回的仍是 np.float64），参照同样两边 `round(float(v), 9)`。实参全是小整数
（绝对值 ≤ 10、至多 8 个），被测的浮点累加与参照的分数精确算法之差远在 1e-12 以内；
200 组上两边舍入后逐一相等（未撞上舍入边界）。

**entry 不改实参。** 五个入口都先 `np.array(实参)` 建一份新数组、只读这份新数组；
构建时用 `copy.deepcopy` 比对过每组实参跑前跑后相等。
"""
import statistics


# ── reshape-and-axes ────────────────────────────────────────────────────

def _rect_rows(rng):
    # 1..5 行、1..5 列的矩形整数表（含负数）。非方阵占多数：axis=0 与 axis=1 的结果
    # 长度就不同；方阵时两者一般也不同值。
    rows, cols = rng.randint(1, 5), rng.randint(1, 5)
    return ([[rng.randint(-9, 9) for _ in range(cols)] for _ in range(rows)],)


def _column_sums_ref(rows):
    # 被测是 a.sum(axis=0)；参照用 zip(*rows) 把表转置成一列一个元组，逐列 sum。
    return [sum(column) for column in zip(*rows)]


# ── boolean-mask-filter ─────────────────────────────────────────────────

def _values_and_threshold(rng):
    # 值域很窄（0..5），重复多；七成的组里阈值 t 直接取自 xs 的某个元素——清单 §2.1：
    # `>` 写成 `>=` 只在「有元素恰好等于 t」时露馅。实测（门的种子、200 组）：有这个分支时
    # 135 组里 t 等于某个元素、第 2 组就抓到 `>=` 变异；去掉它只剩 57 组、第 10 组才抓到——
    # 门仍会红，但这个分支是清单要求的「调高相等的概率」，别删。
    # 另有空表（27/200）与阈值落在值域之外（-1 或 6）。
    xs = [rng.randint(0, 5) for _ in range(rng.randint(0, 8))]
    if xs and rng.random() < 0.7:
        t = rng.choice(xs)
    else:
        t = rng.randint(-1, 6)
    return xs, t


def _above_threshold_ref(xs, t):
    # 被测是布尔掩码 a[a > t]；参照是列表推导式逐个比较。
    return [x for x in xs if x > t]


# ── broadcasting-table ──────────────────────────────────────────────────

def _table_size(rng):
    # n = 0..9；n = 0 时两边都是 []。
    return (rng.randint(0, 9),)


def _times_table_ref(n):
    # 被测是 (n,1) * (1,n) 的广播；参照是两重循环逐格相乘。
    table = []
    for i in range(1, n + 1):
        line = []
        for j in range(1, n + 1):
            line.append(i * j)
        table.append(line)
    return table


# ── mean-variance（loop / vectorised 两个程序共用参照与生成器）─────────

def _small_ints(rng):
    # 1..8 个 -10..10 的整数；约 1/6 的组全部相等（方差为 0）。
    n = rng.randint(1, 8)
    if rng.random() < 1 / 6:
        return ([rng.randint(-10, 10)] * n,)
    return ([rng.randint(-10, 10) for _ in range(n)],)


def _mean_variance_ref(xs):
    # 被测一个是两遍循环、一个是整数组运算；参照是 statistics.fmean（fsum 精确求和）
    # 与 statistics.pvariance（Fraction 精确算平方差和）——两者都与被测机制不同。
    # pvariance 对全相等的整数返回 int 0，所以外面套 float()。
    return round(float(statistics.fmean(xs)), 9), round(float(statistics.pvariance(xs)), 9)


# ── aggregate-by-axis ───────────────────────────────────────────────────

def _narrow_marks(rng):
    # 1..5 行、1..4 列，值域 0..3：并列很常见（清单 §2.1），「并列取第一个」这一点
    # 由它守。
    rows, cols = rng.randint(1, 5), rng.randint(1, 4)
    return ([[rng.randint(0, 3) for _ in range(cols)] for _ in range(rows)],)


def _top_per_column_ref(marks):
    # 被测是 argmax(axis=0)；参照逐列用 max(range(行数), key=…)，max 在并列时返回
    # 第一个遇到的，即行号小者。
    rows = range(len(marks))
    return [max(rows, key=lambda r: marks[r][c]) for c in range(len(marks[0]))]


REFERENCES = {
    'reshape-and-axes': {'ref': _column_sums_ref, 'cases': _rect_rows},
    'boolean-mask-filter': {'ref': _above_threshold_ref, 'cases': _values_and_threshold},
    'broadcasting-table': {'ref': _times_table_ref, 'cases': _table_size},
    'mean-variance-loop': {'ref': _mean_variance_ref, 'cases': _small_ints},
    'mean-variance-vectorised': {'ref': _mean_variance_ref, 'cases': _small_ints},
    'aggregate-by-axis': {'ref': _top_per_column_ref, 'cases': _narrow_marks},
}
