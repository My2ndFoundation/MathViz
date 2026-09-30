"""ch10-lists 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里提到的变异，都是把被测 `.py` 里那一行
改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

⚠ 门先调被测函数、再用**同一份实参**调参照（M3 清单 §1.2）：被测函数若原地改了实参，
参照看到的就是改过的值。本章被测函数都不改实参（rotate-list-pop-append 先 list() 复制），
参照也一律不改（deque 由实参新建）。
"""
import collections


def _grid(rng):
    # 形状四选一、各约四分之一：1×1、1×n、n×1、任意（1..5 × 1..5）。
    # 行和与列和写反，在方阵上可能碰巧相等；在 1×n / n×1 上两个列表连长度都不同。
    shape = rng.randint(0, 3)
    if shape == 0:
        rows, cols = 1, 1
    elif shape == 1:
        rows, cols = 1, rng.randint(2, 5)
    elif shape == 2:
        rows, cols = rng.randint(2, 5), 1
    else:
        rows, cols = rng.randint(1, 5), rng.randint(1, 5)
    return ([[rng.randint(-9, 9) for _ in range(cols)] for _ in range(rows)],)


def _matrices(rng):
    # m、n、p 各自独立取 1..4：绝大多数是非方阵——i / j / k 下标写混在方阵上可能不露馅。
    # 两个矩阵的形状总是相容（a 的列数 = b 的行数 = n），不合法的形状在被测程序的声明之外。
    m, n, p = rng.randint(1, 4), rng.randint(1, 4), rng.randint(1, 4)
    a = [[rng.randint(-5, 5) for _ in range(n)] for _ in range(m)]
    b = [[rng.randint(-5, 5) for _ in range(p)] for _ in range(n)]
    return a, b


def _items_and_k(rng):
    # 约五分之一是空列表（「空列表守卫」那条 return 分支）；k 取 -10..15，
    # 负数、0、等于长度、超过长度数倍都常出现。
    length = 0 if rng.random() < 0.2 else rng.randint(1, 6)
    return [rng.randint(0, 9) for _ in range(length)], rng.randint(-10, 15)


def _signed(rng):
    # -5..5：约一半是负数，所以相邻两个负数（边删边遍历跳过的正是第二个）很常见；可以为空。
    return ([rng.randint(-5, 5) for _ in range(rng.randint(0, 10))],)


def _sum_rows_zip_cols(grid):
    # 被测：两重下标循环同时累加两张合计表；参照：sum 每一行，zip(*grid) 取列再 sum。
    return [sum(row) for row in grid], [sum(col) for col in zip(*grid)]


def _dot_products(a, b):
    # 被测：三重下标循环；参照：zip(*b) 取列，行与列逐对相乘求和（点积）。
    # zip(*b) 写在内层推导式里，外层每一行都重新求一次，不会遇到迭代器只能走一遍的问题。
    return [[sum(x * y for x, y in zip(row, col)) for col in zip(*b)] for row in a]


def _index_loops(a, b):
    # 被测：zip(*b) 取列 + 点积推导式；参照：普通三重下标循环，逐格累加。
    out = []
    for i in range(len(a)):
        row = []
        for j in range(len(b[0])):
            total = 0
            for k in range(len(b)):
                total += a[i][k] * b[k][j]
            row.append(total)
        out.append(row)
    return out


def _deque_rotate(items, k):
    # 被测：两段切片拼接 / 在副本上 k 次 append(pop(0))；参照：deque.rotate，负数是向左。
    # deque 由实参新建，不动实参；空 deque 上 rotate 是合法的空操作。
    d = collections.deque(items)
    d.rotate(-k)
    return list(d)


REFERENCES = {
    'grid-row-col-totals': {
        # 实测：col_totals[c] += grid[r][c] 改成 col_totals[r] += grid[r][c]（列和按行号记）
        # 即红，红在 1×2 的表 [[2, 7]] 上；把 return 的两个列表对调，同样红在这张表上。
        'ref': _sum_rows_zip_cols,
        'cases': _grid,
    },
    'matrix-multiply-loops': {
        # 实测：a[i][k] * b[k][j] 改成 a[i][k] * b[j][k] 即红，红在 1×4 · 4×2 的非方阵上
        # （IndexError，门记为「抛错」的不符）；return result 改成 result[:1] 同样红。
        'ref': _dot_products,
        'cases': _matrices,
    },
    'matrix-multiply-zip': {
        # 实测：去掉 list(...)、直接 columns = zip(*b) 即红——a 有两行以上时第二行起全是空列表；
        # dot 里的 x * y 改成 x + y（另一条 return）同样红。
        'ref': _index_loops,
        'cases': _matrices,
    },
    'rotate-list-slice': {
        # 两条 return 各变异一次，都实测变红：空列表那条改成 return None；
        # 主分支改成 items[:k] + items[k:]（原样拼回去）。
        'ref': _deque_rotate,
        'cases': _items_and_k,
    },
    'rotate-list-pop-append': {
        # 两条 return 各变异一次，都实测变红：空列表那条改成 return None；
        # 主分支 pop(0) 改成 pop()（取出末项又放回末尾，等于一步都没转）。
        'ref': _deque_rotate,
        'cases': _items_and_k,
    },
    'remove-while-iterating': {
        # 被测：普通 for + if + append 建新列表；参照：filter + lambda。
        # 实测：>= 改成 >（丢掉 0）即红；return kept 改成交回坏掉版本在副本上的结果，
        # 红在 [-2, -3, 1] 上（两个相邻负数，第二个被跳过）。
        'ref': lambda xs: list(filter(lambda x: x >= 0, xs)),
        'cases': _signed,
    },
}
