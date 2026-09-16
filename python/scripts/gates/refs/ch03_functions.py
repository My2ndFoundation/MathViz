"""ch03-functions 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。

**本文件的实参生成器只在这里定义、不进 _gen.py**：_gen.py 要求逐字符不改（改了就换了
别章的实参流），而这两条生成器只给本章用。
"""
import statistics


def _int_list(rng):
    # 非空：summarise 的均值要除以 len，空列表是被测程序声明之外的输入（docstring 没写，
    # 但 min() 对空列表本来就抛 ValueError，参照同样会抛——比了也不说明什么）。
    return ([rng.randint(-50, 50) for _ in range(rng.randint(1, 12))],)


def _prime_candidate(rng):
    # 负数、0、1、2 都要常常落到：-10..2000 里前 13 个值占约 0.6%，不够，所以另外
    # 以四分之一的概率专抽 -3..30 这一小段（边界都在那里）。上限 2000：埃氏筛每组
    # 现造一次，200 组 × 2000 格，门仍然瞬时。
    if rng.random() < 0.25:
        return (rng.randint(-3, 30),)
    return (rng.randint(-10, 2000),)


def _sieve_is_prime(n):
    # 被测的是「试除到 isqrt、提前 return」，参照是「埃氏筛把合数划掉、再查表」：
    # 从不对 n 做一次取余，机制不同。返回 bool（查表得到的就是 True/False），类型一致。
    if n < 2:
        return False
    marks = [True] * (n + 1)
    marks[0] = marks[1] = False
    p = 2
    while p * p <= n:
        if marks[p]:
            for multiple in range(p * p, n + 1, p):
                marks[multiple] = False
        p += 1
    return marks[n]


def _sorted_ends_fmean(values):
    # 被测的是 min / max / sum÷len，参照是「排序取两端 + statistics.fmean」：
    # 最值走排序而非线性扫描，均值走 fsum 而非逐项相加。整数输入下 fsum 与 sum 都精确，
    # 所以两边的 float 逐位相同（实测 200 组全等），不是靠运气碰上的舍入。
    ordered = sorted(values)
    return ordered[0], ordered[-1], statistics.fmean(values)


REFERENCES = {
    'return-several-values': {
        'ref': _sorted_ends_fmean,
        'cases': _int_list,
    },
    'is-prime-trial-division': {
        'ref': _sieve_is_prime,
        'cases': _prime_candidate,
    },
}
