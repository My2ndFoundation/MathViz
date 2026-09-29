"""ch19-complexity 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里说「实测」的变异，都是把被测 `.py` 里那一行
改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**门的盲区（M4 清单 §5）**：门先调被测函数、再拿**同一批实参对象**调参照。本章带 property 的
入口没有一个改实参（`count_shifts` 先 `list(values)` 复制、`has-duplicates-sorted` 用 `sorted()`
另建新表），构建时逐个用 `copy.deepcopy` 比对过跑前跑后的实参。

**实参范围为什么收紧**：
· 最大子段和的两个参照是三重循环暴力，O(n³)：表长 ≤ 12（清单给的上限）。
· 分治版递归深度 ≈ log₂ n，不是问题；表长同样 ≤ 12 只因为参照慢。
"""


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _small_n(rng):
    # 0、1、2 是「一对都没有」「只有一对」的边界：四分之一概率专门抽 0..3。
    if rng.random() < 0.25:
        return (rng.randint(0, 3),)
    return (rng.randint(0, 80),)


def _search_n(rng):
    # 0（空表：while 一次都不进）与 2 的幂附近（bit_length 在那里进位）都要抽到：
    # 四分之一概率抽 0..3，四分之一概率抽 2 的幂 ± 1，其余 0..5000。
    roll = rng.random()
    if roll < 0.25:
        return (rng.randint(0, 3),)
    if roll < 0.5:
        return (2 ** rng.randint(1, 12) + rng.randint(-1, 1),)
    return (rng.randint(0, 5000),)


def _int_list(rng):
    # 长 0..12、值 -5..5：值域窄，重复元素常见——插入排序的 > 与 >= 在重复元素上才分得出来。
    # 八分之一概率给已有序、八分之一给倒序，让「零次右移」与「n(n-1)/2 次右移」两端都抽到。
    values = [rng.randint(-5, 5) for _ in range(rng.randint(0, 12))]
    roll = rng.random()
    if roll < 0.125:
        values.sort()
    elif roll < 0.25:
        values.sort(reverse=True)
    return (values,)


def _maybe_duplicates(rng):
    # 长 0..10，值取自 0..k-1，k 在 1..15 里抽：k 小时几乎必有重复，k 大、表短时常常没有。
    # 两个返回分支（True / False）各自的命中数见构建报告。
    k = rng.randint(1, 15)
    return ([rng.randrange(k) for _ in range(rng.randint(0, 10))],)


def _nonempty_list(rng):
    # 最大子段和只定义在非空表上：长 1..12。四分之一概率全是负数——
    # 这时答案是最大的那一个负数，「best 从 0 起」这类错误只在这里现形。
    n = rng.randint(1, 12)
    if rng.random() < 0.25:
        return ([rng.randint(-9, -1) for _ in range(n)],)
    return ([rng.randint(-9, 9) for _ in range(n)],)


# ── 参照 ─────────────────────────────────────────────────────────────────

def _pairs_formula(n):
    # 被测程序两重循环逐个数，参照直接用 n(n-1)/2 的公式：一个循环都没有。
    return n * (n - 1) // 2


def _bit_length(n):
    # 被测程序真的做一遍二分查找再数「看了几次中间」，参照读 n 的二进制位数。
    return n.bit_length()


def _inversions_by_pairs(values):
    # 被测程序跑插入排序、数右移次数；参照不排序，两重循环直接数 i < j 且 values[i] > values[j] 的对数。
    count = 0
    for i in range(len(values)):
        for j in range(i + 1, len(values)):
            if values[i] > values[j]:
                count += 1
    return count


def _dup_by_set_size(items):
    # 嵌套比较版与排序比相邻版的参照：集合去重后长度变短就是有重复。
    return len(set(items)) != len(items)


def _dup_by_sorting(items):
    # 集合版的参照：不用集合，排序后比相邻两项（被测用了集合，参照不用）。
    ordered = sorted(items)
    return any(a == b for a, b in zip(ordered, ordered[1:]))


def _kadane(values):
    # 平方版的参照：一遍扫描，「以这里结尾的最大和」。
    best = current = values[0]
    for value in values[1:]:
        current = value if current < 0 else current + value
        if current > best:
            best = current
    return best


def _brute_force(values):
    # 分治版与 Kadane 版的参照：三重循环，每一段都从头求和。O(n^3)，所以表长 ≤ 12。
    n = len(values)
    best = None
    for start in range(n):
        for end in range(start, n):
            total = 0
            for k in range(start, end + 1):
                total += values[k]
            if best is None or total > best:
                best = total
    return best


REFERENCES = {
    'loop-shape-counts': {
        'ref': _pairs_formula,
        'cases': _small_n,
    },
    'search-comparison-counts': {
        'ref': _bit_length,
        'cases': _search_n,
    },
    'insertion-shift-counts': {
        'ref': _inversions_by_pairs,
        'cases': _int_list,
    },
    'has-duplicates-nested': {
        'ref': _dup_by_set_size,
        'cases': _maybe_duplicates,
    },
    'has-duplicates-sorted': {
        'ref': _dup_by_set_size,
        'cases': _maybe_duplicates,
    },
    'has-duplicates-set': {
        'ref': _dup_by_sorting,
        'cases': _maybe_duplicates,
    },
    'max-subarray-quadratic': {
        'ref': _kadane,
        'cases': _nonempty_list,
    },
    'max-subarray-divide-conquer': {
        'ref': _brute_force,
        'cases': _nonempty_list,
    },
    'max-subarray-kadane': {
        'ref': _brute_force,
        'cases': _nonempty_list,
    },
}
