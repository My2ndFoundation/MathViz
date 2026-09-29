"""ch18-dp-greedy 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里说「实测」的变异，都是把被测 `.py` 里那一行
改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子 properties.SEED、
SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**被测函数都不改实参**（清单 §5 的盲区：门先调被测、再用同一批实参对象调参照）：
网格、重量 / 价值表、字符串、硬币表、活动表都只读；需要排序的地方用的是 `sorted()` 的新表。

**实参范围为什么收紧**（参照多是暴力枚举，规模是指数级的）：
· 网格路径：参照枚举「向下」落在第几步，C(rows+cols−2, rows−1) 条路径逐条走；
  5×5 时是 C(8, 4) = 70 条，200 组仍在瞬间内。清单给的上限是 5×5。
· 0/1 背包：参照枚举全部 2ⁿ 个子集，n ≤ 10 时 1024 个（清单上限）。
· LCS：参照枚举较短串的全部 2^k 个子序列，每个串长 ≤ 8，k ≤ 8 时 256 个（清单上限）。
· 活动选择：参照枚举全部 2ⁿ 个子集、每个子集两两判重叠，n ≤ 10（清单上限）。
· 编辑距离：参照是递归，深度 ≤ len(a) + len(b)；串长 ≤ 8，递归深度远离上限 1000。
· 找零：参照按金额做 BFS，状态数 ≤ 金额；贪心版金额 ≤ 500，DP 版 ≤ 60。
"""
import bisect
import collections
import functools
import itertools


UK_COINS = [1, 2, 5, 10, 20, 50, 100, 200]


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _grid_args(rng):
    # 1..5 行、1..5 列；每格 1/4 概率是障碍。起点 / 终点被堵、1×1 网格都会随机抽到
    # （各分支命中数见构建报告），另以 1/10 概率给一张没有障碍的网格，让路数大的情形常出现。
    rows = rng.randint(1, 5)
    cols = rng.randint(1, 5)
    wall = 0.0 if rng.random() < 0.1 else 0.25
    grid = [''.join('#' if rng.random() < wall else '.' for _ in range(cols))
            for _ in range(rows)]
    return (grid,)


def _knapsack_args(rng):
    # n = 0..10 件（空表也要走到）；容量 0..25（容量 0 什么都装不下）。
    n = rng.randint(0, 10)
    weights = [rng.randint(1, 10) for _ in range(n)]
    values = [rng.randint(1, 20) for _ in range(n)]
    return (weights, values, rng.randint(0, 25))


def _two_strings(rng):
    # 小字母表让公共字符常出现；串长 0..8（含空串）。
    def word():
        return ''.join(rng.choice('abc') for _ in range(rng.randint(0, 8)))
    return (word(), word())


def _uk_change_args(rng):
    # 只用英镑面值（贪心只在这套硬币上最优）；每组把面值表打乱，「忘了从大到小排」的变异才藏不住。
    coins = list(UK_COINS)
    rng.shuffle(coins)
    amount = rng.randint(0, 20) if rng.random() < 0.25 else rng.randint(0, 500)
    return (amount, coins)


def _any_change_args(rng):
    # 面值任意：1..4 种、各 1..12。不一定含 1，所以常有凑不出（返回 -1）的金额；
    # 另以 1/5 概率只给偶数面值、配奇数金额，保证「凑不出」这一支稳定出现。
    if rng.random() < 0.2:
        coins = [2 * rng.randint(1, 6) for _ in range(rng.randint(1, 3))]
        return (2 * rng.randint(0, 30) + 1, coins)
    coins = [rng.randint(1, 12) for _ in range(rng.randint(1, 4))]
    return (rng.randint(0, 60), coins)


def _activities_args(rng):
    # n = 0..10 个活动，开始 0..20、时长 1..8；首尾相接（后一个的开始 == 前一个的结束）常出现。
    acts = []
    for _ in range(rng.randint(0, 10)):
        start = rng.randint(0, 20)
        acts.append((start, start + rng.randint(1, 8)))
    return (acts,)


def _huffman_text(rng):
    # 空串、只有一种字符、多种字符三支都要走到：各以一定概率专门构造。
    roll = rng.random()
    if roll < 0.1:
        return ('',)
    if roll < 0.25:
        return (rng.choice('xyz') * rng.randint(1, 9),)
    return (''.join(rng.choice('abcdef') for _ in range(rng.randint(1, 30))),)


# ── 参照 ─────────────────────────────────────────────────────────────────

def _grid_paths_enumerate(grid):
    # 一条路径就是 (rows−1) 步向下、(cols−1) 步向右的一种排列；用 combinations 选出
    # 「向下」落在第几步，再沿路逐格走一遍、碰到障碍就作废。不递归、不填表。
    rows, cols = len(grid), len(grid[0])
    steps = rows - 1 + cols - 1
    total = 0
    for downs in itertools.combinations(range(steps), rows - 1):
        r = c = 0
        ok = grid[0][0] != '#'
        for k in range(steps):
            if k in downs:
                r += 1
            else:
                c += 1
            if grid[r][c] == '#':
                ok = False
        if ok:
            total += 1
    return total


def _knapsack_subsets(weights, values, capacity):
    # 枚举每一个子集（位掩码），装得下的里面取价值最大。
    best = 0
    n = len(weights)
    for mask in range(1 << n):
        w = sum(weights[i] for i in range(n) if mask >> i & 1)
        if w <= capacity:
            best = max(best, sum(values[i] for i in range(n) if mask >> i & 1))
    return best


def _is_subsequence(small, big):
    it = iter(big)
    return all(ch in it for ch in small)


def _lcs_enumerate(a, b):
    # 取较短的串，从长到短枚举它的子序列（按位置组合），第一个同时是另一串子序列的就是答案。
    short, long_ = (a, b) if len(a) <= len(b) else (b, a)
    for k in range(len(short), 0, -1):
        for picks in itertools.combinations(range(len(short)), k):
            if _is_subsequence(''.join(short[i] for i in picks), long_):
                return k
    return 0


def _edit_distance_topdown(a, b):
    # 自顶向下 + lru_cache，而且下标约定与被测相反：d(i, j) 是 a[i:] 与 b[j:] 的距离
    # （后缀，从 0 数起），被测表格的 dist[i][j] 是 a[:i] 与 b[:j]（前缀，从 1 数起）。
    # 字符相同时直接走对角线、不取三者最小——这一步的正确性另有论证，与被测的递推式不逐项相同。
    # 缓存挂在每次调用新建的内层函数上，不跨组共享。
    @functools.lru_cache(maxsize=None)
    def d(i, j):
        if i == len(a):
            return len(b) - j
        if j == len(b):
            return len(a) - i
        if a[i] == b[j]:
            return d(i + 1, j + 1)
        return 1 + min(d(i + 1, j), d(i, j + 1), d(i + 1, j + 1))
    return d(0, 0)


def _change_bfs(amount, coins):
    # 从 0 出发按层扩展：第 k 层是恰好用 k 枚能凑出的金额；最先到达 amount 的层数就是最少枚数。
    # 不填 best 表、不取 min。到不了返回 -1。
    if amount == 0:
        return 0
    seen = {0}
    frontier = collections.deque([(0, 0)])
    while frontier:
        total, used = frontier.popleft()
        for coin in coins:
            nxt = total + coin
            if nxt == amount:
                return used + 1
            if nxt < amount and nxt not in seen:
                seen.add(nxt)
                frontier.append((nxt, used + 1))
    return -1


def _activities_subsets(activities):
    # 枚举每一个子集，两两不重叠（一个的结束 <= 另一个的开始）的里面取最大个数。不排序、不贪心。
    n = len(activities)
    best = 0
    for mask in range(1 << n):
        picked = [activities[i] for i in range(n) if mask >> i & 1]
        if len(picked) <= best:
            continue
        ok = all(e1 <= s2 or e2 <= s1
                 for (s1, e1), (s2, e2) in itertools.combinations(picked, 2))
        if ok:
            best = len(picked)
    return best


def _huffman_insort(text):
    # 同样是「反复合并最轻两组」，但：不用堆（有序列表 + bisect.insort），也不记每个字符的码长——
    # 总位数 = 每次合并的两组次数之和再求和（每合并一次，这两组里每个字符都多一位）。
    # 只有一种字符时约定每个字符 1 位，与被测相同。
    counts = collections.Counter(text)
    if len(counts) == 1:
        return len(text)
    weights = sorted(counts.values())
    total = 0
    while len(weights) > 1:
        merged = weights.pop(0) + weights.pop(0)
        total += merged
        bisect.insort(weights, merged)
    return total


REFERENCES = {
    'grid-paths-memo': {
        'ref': _grid_paths_enumerate,
        'cases': _grid_args,
    },
    'grid-paths-table': {
        'ref': _grid_paths_enumerate,
        'cases': _grid_args,
    },
    'knapsack-01-table': {
        'ref': _knapsack_subsets,
        'cases': _knapsack_args,
    },
    'knapsack-01-1d': {
        'ref': _knapsack_subsets,
        'cases': _knapsack_args,
    },
    'lcs-length': {
        'ref': _lcs_enumerate,
        'cases': _two_strings,
    },
    'edit-distance': {
        'ref': _edit_distance_topdown,
        'cases': _two_strings,
    },
    'coin-change-greedy': {
        'ref': _change_bfs,
        'cases': _uk_change_args,
    },
    'coin-change-dp': {
        'ref': _change_bfs,
        'cases': _any_change_args,
    },
    'activity-selection': {
        'ref': _activities_subsets,
        'cases': _activities_args,
    },
    'huffman-code-lengths': {
        'ref': _huffman_insort,
        'cases': _huffman_text,
    },
}
