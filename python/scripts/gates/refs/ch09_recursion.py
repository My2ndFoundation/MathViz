"""ch09-recursion 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里「实测」的变异，都是把被测 `.py` 里那一行
改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**实参范围为什么收紧**：本章被测程序全是递归或指数级的。
· 朴素斐波那契 fib(n) 要调用 2·fib(n+1) − 1 次：n = 18 是 8361 次，200 组仍在一秒内；
  n = 30 是 270 万次，200 组要几十秒。所以只取 0..18（清单 §7.8 给的上限）。
· 汉诺塔返回 2ⁿ − 1 步的列表，每层还要拼接列表：n ≤ 8（清单给的上限）。
· 其余递归程序的递归深度都 ≈ n：门在 check.py 自己的调用栈里跑，默认递归上限 1000，
  所以深度都留在几百以内，不让一个合法实参因为栈深撞上 RecursionError。
"""
import itertools
import math


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _factorial_n(rng):
    # 0 与 1 是两个基例边界，单独以四分之一概率抽 0..3，其余 0..200。
    if rng.random() < 0.25:
        return (rng.randint(0, 3),)
    return (rng.randint(0, 200),)


def _fib_small(rng):
    # 朴素递归：n ≤ 18，理由见文件头。
    return (rng.randint(0, 18),)


def _fib_n(rng):
    # 记忆化 / lru_cache / 迭代：0..300。记忆化两版的缓存跨组保留，首次遇到大 n 时
    # 递归深度 ≈ n，300 离默认上限 1000 足够远（含 lru_cache 包装层）。
    if rng.random() < 0.25:
        return (rng.randint(0, 3),)
    return (rng.randint(0, 300),)


def _power_args(rng):
    # 底数含负数与 0；指数 0..60（线性版递归深度 = n + 1）。
    return (rng.randint(-9, 9), rng.randint(0, 60))


def _hanoi_args(rng):
    # n ≤ 8，理由见文件头。柱子名每组打乱，免得「把某根柱子名写死」的变异藏起来。
    pegs = ['A', 'B', 'C']
    rng.shuffle(pegs)
    return (rng.randint(0, 8), pegs[0], pegs[1], pegs[2])


def _perm_text(rng):
    # 长度 0..6（6! = 720 项）；字母表只有 4 个字母，常常出现重复字符——
    # 重复字符时排列里会出现重复项，顺序约定照样要逐项一致。
    return (''.join(rng.choice('abcd') for _ in range(rng.randint(0, 6))),)


def _nested_list(rng, depth=0):
    out = []
    for _ in range(rng.randint(0, 5)):
        if depth < 4 and rng.random() < 0.35:
            out.append(_nested_list(rng, depth + 1))
        else:
            out.append(rng.randint(-20, 20))
    return out


def _flatten_args(rng):
    return (_nested_list(rng),)


# ── 参照 ─────────────────────────────────────────────────────────────────

def _fib_fast_doubling(n):
    # 快速倍增：F(2k) = F(k)·(2F(k+1) − F(k))，F(2k+1) = F(k)² + F(k+1)²。
    # 按 n 的二进制位从高到低迭代，不递归、不记忆化、不逐项滚动——与四个被测版本机制都不同。
    a, b = 0, 1                      # (F(k), F(k+1))，k 从 0 开始
    for bit in bin(n)[2:]:
        c = a * (2 * b - a)
        d = a * a + b * b
        if bit == '1':
            a, b = d, c + d
        else:
            a, b = c, d
    return a


def _hanoi_iterative(n, source, target, spare):
    # 迭代版：三根柱子各是一个栈，模拟真的搬盘子。最小的盘子每隔一步沿固定方向循环移动
    # （n 为奇数时 source→target→spare→source，偶数时 source→spare→target→source），
    # 其余步骤只有一种不动最小盘子的合法移动。不递归，结果是同样的 (出发柱, 目标柱) 列表。
    if n == 0:
        return []
    stacks = {source: list(range(n, 0, -1)), target: [], spare: []}
    cycle = [source, target, spare] if n % 2 == 1 else [source, spare, target]
    small_at = 0
    moves = []
    for step in range(2 ** n - 1):
        if step % 2 == 0:
            frm = cycle[small_at]
            small_at = (small_at + 1) % 3
            to = cycle[small_at]
        else:
            x, y = [p for p in (source, target, spare) if p != cycle[small_at]]
            if not stacks[x]:
                frm, to = y, x
            elif not stacks[y]:
                frm, to = x, y
            elif stacks[x][-1] < stacks[y][-1]:
                frm, to = x, y
            else:
                frm, to = y, x
        stacks[to].append(stacks[frm].pop())
        moves.append((frm, to))
    return moves


def _permutations_itertools(text):
    # itertools.permutations 按**位置**的字典序产出（第 0 位先取下标 0 的字符……），
    # 不去重；被测程序按下标依次选第一个字符、再递归排剩下的，产出顺序相同。
    # 所以这里比的是**有序列表本身**，不排序、不转集合——顺序错了也要红。
    return [''.join(p) for p in itertools.permutations(text)]


def _flatten_stack(items):
    # 显式栈：栈里放迭代器，遇到子列表就压栈、耗尽就弹栈。不递归。
    out = []
    stack = [iter(items)]
    while stack:
        for item in stack[-1]:
            if isinstance(item, list):
                stack.append(iter(item))
                break
            out.append(item)
        else:
            stack.pop()
    return out


REFERENCES = {
    'factorial-recursive': {
        'ref': math.factorial,
        'cases': _factorial_n,
    },
    'factorial-iterative': {
        'ref': math.factorial,
        'cases': _factorial_n,
    },
    'fibonacci-naive': {
        'ref': _fib_fast_doubling,
        'cases': _fib_small,
    },
    'fibonacci-memo-dict': {
        'ref': _fib_fast_doubling,
        'cases': _fib_n,
    },
    'fibonacci-lru-cache': {
        'ref': _fib_fast_doubling,
        'cases': _fib_n,
    },
    'fibonacci-iterative': {
        'ref': _fib_fast_doubling,
        'cases': _fib_n,
    },
    'power-linear': {
        'ref': pow,
        'cases': _power_args,
    },
    'power-by-squaring': {
        'ref': pow,
        'cases': _power_args,
    },
    'towers-of-hanoi': {
        'ref': _hanoi_iterative,
        'cases': _hanoi_args,
    },
    'permutations-recursive': {
        'ref': _permutations_itertools,
        'cases': _perm_text,
    },
    'flatten-nested': {
        'ref': _flatten_stack,
        'cases': _flatten_args,
    },
}
