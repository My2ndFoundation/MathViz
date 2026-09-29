"""ch16-sorting 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（协议：种子 properties.SEED、SAMPLES 组、本文件的
生成器；红在哪组实参上见构建报告）。

**参照**：十个排序程序一律拿内置 `sorted` 当参照。它是 C 实现的 Timsort（短表走二分
插入 + 游程合并），与被测的冒泡 / 选择 / 插入 / 希尔 / 归并 / 快排 / 计数排序
机制都不同；被测程序里没有一个调用 `sorted` 或 `list.sort`。

**门的盲区与本页的绕法（清单 §5、裁决 R1）**：门先调被测函数、再用**同一批实参
对象**调参照。原地排序若直接当 entry，写坏成「移位时丢了 key」「交换写成覆盖」
——元素多重集变了——参照看到的是被改过的表，`sorted(被改过的表)` 恰好等于它，
门就瞎了。所以原地排序的 entry 一律是 `sorted_copy(items)`：先 `list(items)`
复制、只排副本、交回副本，实参不动；`quicksort-comprehension` 与 `counting-sort`
天然返回新表，entry 就是算法本身。本页每个程序都做过一次改变多重集的变异，
门在该程序的实参上变红（见构建报告）。

**生成器为什么这样抽**：值取 −9..9、长度 0..12，重复值很多（稳定性、`<=` 与 `<`、
快排的等值段都要重复值才看得出来）；另外各以一定概率专门构造空表、单元素、
全相等、已有序、倒序——空表与单元素是各算法的基例 / 零趟分支，已有序是冒泡提前
停下与 Lomuto 退化的那一支，倒序是交换最多的那一支。长度留在十几：Lomuto 在有序
输入上递归深度 = n，离 check.py 的递归上限 1000 很远。
"""


def _int_list(rng, low=-9, high=9):
    roll = rng.random()
    if roll < 0.08:
        return []
    if roll < 0.16:
        return [rng.randint(low, high)]
    n = rng.randint(2, 12)
    xs = [rng.randint(low, high) for _ in range(n)]
    if roll < 0.24:
        return [xs[0]] * n                  # 全相等
    if roll < 0.36:
        return sorted(xs)                   # 已有序
    if roll < 0.48:
        return sorted(xs, reverse=True)     # 倒序
    return xs


def _one_list(rng):
    return (_int_list(rng),)


def _counting_args(rng):
    # 计数排序只收 0..max_value 的整数；max_value 每组在 0..20 里变，值能取到
    # max_value 本身，所以计数表少开一格（`[0] * max_value`）会在值等于 max_value
    # 时越界、门报抛错。注意：把表长写死成 21 这类「够大」的常数**测不出来**——
    # 多出来的格子计数为 0、什么也不写，在这个值域里与正确程序行为相同（实测门绿）。
    max_value = rng.randint(0, 20)
    return (_int_list(rng, 0, max_value), max_value)


def _ref_sort(items):
    return sorted(items)


REFERENCES = {
    'bubble-sort-basic': {'ref': _ref_sort, 'cases': _one_list},
    'bubble-sort-early-exit': {'ref': _ref_sort, 'cases': _one_list},
    'selection-sort': {'ref': _ref_sort, 'cases': _one_list},
    'insertion-sort': {'ref': _ref_sort, 'cases': _one_list},
    'shell-sort': {'ref': _ref_sort, 'cases': _one_list},
    'merge-sort-top-down': {'ref': _ref_sort, 'cases': _one_list},
    'merge-sort-bottom-up': {'ref': _ref_sort, 'cases': _one_list},
    'quicksort-lomuto': {'ref': _ref_sort, 'cases': _one_list},
    'quicksort-comprehension': {'ref': _ref_sort, 'cases': _one_list},
    'counting-sort': {
        'ref': lambda items, max_value: sorted(items),
        'cases': _counting_args,
    },
}
