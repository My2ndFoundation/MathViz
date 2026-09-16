"""ch07-loops 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面每条注释里「实测」的变异，都是把被测 `.py`
里那一行改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。
"""


def _small_int_list(rng):
    """非空列表，值域窄（-5..5）好让最大值经常重复；四分之一的列表全是负数。

    值域宽的随机列表几乎不出现「最大值出现两次」与「全是负数」，而 find-max-and-index
    最该守的两个变异（`>` 写成 `>=`、初值写成 0）恰恰只在这两种列表上露馅。
    """
    n = rng.randint(1, 8)
    if rng.random() < 0.25:
        return ([rng.randint(-9, -1) for _ in range(n)],)
    return ([rng.randint(-5, 5) for _ in range(n)],)


def _maybe_negative_list(rng):
    """长度 0..8，值域 -2..9：约一半的列表不含负数，常含 0（「0 算不算负数」的边界）。"""
    return ([rng.randint(-2, 9) for _ in range(rng.randint(0, 8))],)


def _non_negative_int(rng):
    """一半是 0..99 的小数（含 0 与一位数），一半是到 10**9 的大数。"""
    if rng.random() < 0.5:
        return (rng.randint(0, 99),)
    return (rng.randint(0, 10 ** 9),)


def _sorted_list_and_target(rng):
    """有序（从小到大）的列表 + 目标值。双指针版本要求有序，两个版本共用这一个生成器。

    值域窄（0..12）使重复值常见；目标一半取某个元素的两倍（专测「一个数和它自己配对」），
    一半在 0..24 里随机。
    """
    numbers = sorted(rng.randint(0, 12) for _ in range(rng.randint(0, 7)))
    if numbers and rng.random() < 0.5:
        target = 2 * rng.choice(numbers)
    else:
        target = rng.randint(0, 24)
    return numbers, target


def _positive_int(rng):
    return (rng.randint(1, 300),)


def _max_by_builtins(numbers):
    # 被测：从第一个元素起步、逐个严格比较；参照：内置 max 求值，list.index 求首次出现的位置。
    largest = max(numbers)
    return (largest, numbers.index(largest))


def _any_negative(numbers):
    return any(x < 0 for x in numbers)


def _digit_chars(n):
    # 被测（modulo 版）：% 10 与 //= 10；参照：写成文字后逐字符求和。
    return sum(int(ch) for ch in str(n))


def _divmod_loop(n):
    # 被测（string 版）：str() 逐字符；参照：取模循环，这里用 divmod 一次拿商和余数。
    total = 0
    while n:
        n, digit = divmod(n, 10)
        total += digit
    return total


def _complement_seen(numbers, target):
    # 被测：两重循环试每一对 / 有序数组双指针；参照：边走边记见过的数，查补数在不在集合里。
    seen = set()
    for x in numbers:
        if target - x in seen:
            return True
        seen.add(x)
    return False


_FIZZ = {
    (True, True): "FizzBuzz",
    (True, False): "Fizz",
    (False, True): "Buzz",
}


def _fizz_table(n):
    # 被测：if / elif 链、先判 15；参照：(能被 3 整除, 能被 5 整除) 元组查表，没有顺序可言。
    return _FIZZ.get((n % 3 == 0, n % 5 == 0), str(n))


REFERENCES = {
    'find-max-and-index': {
        'ref': _max_by_builtins,
        'cases': _small_int_list,
    },
    'has-negative-flag': {
        # 被测：标志位 + break；参照：any() 生成器表达式。
        'ref': _any_negative,
        'cases': _maybe_negative_list,
    },
    'has-negative-for-else': {
        # 被测：for...else + break；参照：any() 生成器表达式。
        'ref': _any_negative,
        'cases': _maybe_negative_list,
    },
    'digit-sum-modulo': {
        'ref': _digit_chars,
        'cases': _non_negative_int,
    },
    'digit-sum-string': {
        'ref': _divmod_loop,
        'cases': _non_negative_int,
    },
    'pair-sum-nested-loops': {
        'ref': _complement_seen,
        'cases': _sorted_list_and_target,
    },
    'pair-sum-two-pointers': {
        'ref': _complement_seen,
        'cases': _sorted_list_and_target,
    },
    'fizzbuzz': {
        'ref': _fizz_table,
        'cases': _positive_int,
    },
}
