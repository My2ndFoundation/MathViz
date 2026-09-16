"""ch06-conditionals 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里「实测」的变异，都是把被测 `.py` 里那一行
改坏、跑 `check.py` 看到 algorithm_property_check 报红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**边界值要故意多抽。** 条件判断的变异几乎都只在界线上露馅（`>=` 写成 `>` 只错在 70 这
一个分数上）。0..100 里均匀抽 200 次，某一个指定分数一次都没抽到的概率约 14%——门会
时灵时不灵。所以下面的生成器都以一半概率专抽界线两侧的值。
"""
import bisect
import calendar

_MOVES = ("rock", "paper", "scissors")

# 每 400 年 97 个闰年：4 的倍数，去掉不是 400 倍数的三个整百年。
_LEAP_RESIDUES = frozenset(range(0, 400, 4)) - {100, 200, 300}


def _mark(rng):
    # 只在 0..100：两个 grade 变体对超过 100 的分数本来就不同（descending 给 A、
    # ranges 给 U），而那不是满分 100 的分数。
    if rng.random() < 0.5:
        return (rng.choice((0, 49, 50, 59, 60, 69, 70, 79, 80, 100)),)
    return (rng.randint(0, 100),)


def _year(rng):
    # 一半抽整百年（其中含 400 的倍数），一半随机年份：纯随机时整百年只占 1%。
    if rng.random() < 0.5:
        return (rng.randint(-40, 40) * 100,)
    return (rng.randint(-3000, 3000),)


def _visitor(rng):
    if rng.random() < 0.5:
        age = rng.choice((0, 4, 5, 17, 18, 64, 65, 100))
    else:
        age = rng.randint(0, 100)
    return age, rng.random() < 0.5


def _two_moves(rng):
    return rng.choice(_MOVES), rng.choice(_MOVES)


def _sides(rng):
    # 小范围整数（含 0 与负数）：相等的边、恰好共线（a + b == c）都要常常出现。
    # 三边全等单独以 1/4 概率抽：纯随机时三边相等只有 11/1331，边长为正的只有 8/1331，
    # 200 组里期望约 1 组——曾经一组都没抽到，把 "equilateral" 改成 "isosceles" 门仍是绿的。
    if rng.random() < 0.25:
        k = rng.randint(-1, 8)
        return k, k, k
    return tuple(rng.randint(-2, 8) for _ in range(3))


def _bisect_grade(mark):
    # 被测：elif 链（从高往低只写下界 / 写全区间）；参照：界线表 + bisect 二分查位置。
    return "UDCBA"[bisect.bisect_right((50, 60, 70, 80), mark)]


def _table_price(age, student):
    # 被测：嵌套 if / 守卫子句；参照：bisect 找年龄段，再按是否学生查一张价格表。
    # 每个年龄段一行 (非学生, 学生)。
    prices = ((0, 0), (5, 5), (12, 8), (6, 6))
    return prices[bisect.bisect_right((5, 18, 65), age)][int(student)]


def _outcome_table(move1, move2):
    # 被测：位置相减再 % 3；参照：九种结果逐条写死的字典，一次取余都不做。
    table = {
        ("rock", "rock"): "draw", ("rock", "paper"): "player 2", ("rock", "scissors"): "player 1",
        ("paper", "rock"): "player 1", ("paper", "paper"): "draw", ("paper", "scissors"): "player 2",
        ("scissors", "rock"): "player 2", ("scissors", "paper"): "player 1",
        ("scissors", "scissors"): "draw",
    }
    return table[(move1, move2)]


def _sorted_classify(a, b, c):
    # 被测：三种两边之和逐一比较 + 相等比较；参照：排序后只比最短两边之和与最长边，
    # 再按不同边长的个数（len(set(...))）分类。
    x, y, z = sorted((a, b, c))
    if x + y <= z:
        return "not a triangle"
    return {1: "equilateral", 2: "isosceles", 3: "scalene"}[len({a, b, c})]


REFERENCES = {
    'grade-boundaries-descending': {
        'ref': _bisect_grade,
        'cases': _mark,
    },
    'grade-boundaries-ranges': {
        'ref': _bisect_grade,
        'cases': _mark,
    },
    'leap-year-nested': {
        # 被测：三层嵌套 if；参照：标准库 calendar.isleap。
        'ref': calendar.isleap,
        'cases': _year,
    },
    'leap-year-one-expression': {
        # 被测：一个 and / or 表达式；参照：只取一次 % 400、再查 400 年周期里的闰年余数集合。
        # 不用 calendar.isleap：3.12 的它源码恰好就是被测的同一个表达式，机制并不「不同」。
        # 余数集合对负年份与 0 同样成立（Python 的 % 结果与除数同号），实测在 −100000..100000
        # 上与 calendar.isleap 逐年一致。
        'ref': lambda year: year % 400 in _LEAP_RESIDUES,
        'cases': _year,
    },
    'ticket-price-nested': {
        'ref': _table_price,
        'cases': _visitor,
    },
    'ticket-price-guard-clauses': {
        'ref': _table_price,
        'cases': _visitor,
    },
    'rps-winner': {
        'ref': _outcome_table,
        'cases': _two_moves,
    },
    'triangle-classifier': {
        'ref': _sorted_classify,
        'cases': _sides,
    },
}
