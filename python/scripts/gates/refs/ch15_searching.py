"""ch15-searching 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里「实测」的变异，都是把被测 `.py` 里那一行
改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子 properties.SEED、
SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

**本页的参照一律是线性的 `list.index` / `list.count` / `in`，不用 `bisect`**（M4 清单注 2、
裁决 R3）：CPython 3.12 `Lib/bisect.py` 的纯 Python `bisect_left` 与 `binary-search-leftmost`
逐行同构，拿它当参照等于拿自己验自己。

二分的三个变体（迭代 / 递归 / bisect）只喂**无重复**的有序表（注 1）：经典二分命中即返回
`mid`，有重复时返回的下标不唯一，线性参照给的是第一个，两边没有唯一答案可比。
「有重复时要第一个」交给 `binary-search-leftmost`，它的生成器专门造重复。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。
"""


def _target_from(rng, items, low, high):
    """一半取表里的某个元素（命中），一半在 low..high 里随机（多半不中，也可能碰巧命中）。"""
    if items and rng.random() < 0.5:
        return rng.choice(items)
    return rng.randint(low, high)


def _any_list_and_target(rng):
    """无序表，长 0..8、值 0..9——值域窄，重复常见；空表约占九分之一。"""
    items = [rng.randint(0, 9) for _ in range(rng.randint(0, 8))]
    return items, _target_from(rng, items, 0, 11)


def _sorted_list_and_target(rng):
    """有序表（可重复），长 0..10、值 0..12；目标 -1..14，常落在表头之前、两数之间、表尾之后。"""
    items = sorted(rng.randint(0, 12) for _ in range(rng.randint(0, 10)))
    return items, _target_from(rng, items, -1, 14)


def _sorted_distinct_and_target(rng):
    """**无重复**有序表，长 0..12、值 0..30；目标 -1..31。二分三个变体共用（见文件头）。"""
    items = sorted(rng.sample(range(31), rng.randint(0, 12)))
    return items, _target_from(rng, items, -1, 31)


def _keys_and_target(rng):
    """互不相同的键 0..40，个数 0..10——表长 11，装载率始终 < 1，表里至少留一个空位。

    键挤在 0..40 这 41 个数里、表又只有 11 格，冲突、连环探测、从 10 号格绕回 0 号格都常见；
    键 0 也会出现（专测「把 0 当成空位」）。
    """
    keys = rng.sample(range(41), rng.randint(0, 10))
    return keys, _target_from(rng, keys, 0, 40)


def _index_or_minus_one(items, target):
    # 被测：逐个比较 / 哨兵 / 有序提前停 / 二分；参照：in 判在不在，list.index 给第一次出现的下标。
    return items.index(target) if target in items else -1


def _count(items, target):
    # 被测：bisect_right 减 bisect_left；参照：list.count 逐个数。
    return items.count(target)


def _in_keys(keys, target):
    # 被测：自己建的定长表 + 线性探测；参照：对原始键列表做内置的线性 in。
    return target in keys


REFERENCES = {
    'linear-search-for': {
        'ref': _index_or_minus_one,
        'cases': _any_list_and_target,
    },
    'linear-search-sentinel': {
        'ref': _index_or_minus_one,
        'cases': _any_list_and_target,
    },
    'linear-search-sorted-early-exit': {
        'ref': _index_or_minus_one,
        'cases': _sorted_list_and_target,
    },
    'binary-search-iterative': {
        'ref': _index_or_minus_one,
        'cases': _sorted_distinct_and_target,
    },
    'binary-search-recursive': {
        'ref': _index_or_minus_one,
        'cases': _sorted_distinct_and_target,
    },
    'binary-search-bisect': {
        'ref': _index_or_minus_one,
        'cases': _sorted_distinct_and_target,
    },
    'binary-search-leftmost': {
        'ref': _index_or_minus_one,
        'cases': _sorted_list_and_target,
    },
    'count-occurrences-sorted': {
        'ref': _count,
        'cases': _sorted_list_and_target,
    },
    'hash-search-linear-probing': {
        'ref': _in_keys,
        'cases': _keys_and_target,
    },
}
