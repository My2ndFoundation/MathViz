"""ch21-simulation 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里说「实测」的变异，都是把被测 `.py` 里那一行
改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**随机只在驱动里（裁决 R2）。** 本页用到 random 的程序，被检查的都是纯核心函数：随机序列
由演示块生成、当实参传进去。这里的 cases 自己造这些实参（任意的点、任意的 (a, b) 列表、
任意的 ±1 序列、任意的到达间隔与服务时长），不经过被测程序的 rng。唯一的例外是
`shuffle-fisher-yates`，见它那一条的注释。

**entry 不改实参。** 门给被测与参照各一份深拷贝，但约定照旧：本章每个 entry 都不改实参
（`shuffled_copy` 先 `list(items)` 复制；两个生命游戏的 `step` 都另建新表 / 新集合；
其余入口只读实参）。构建时逐个用 `copy.deepcopy` 比对过跑前跑后的实参。
"""
import math
from collections import Counter
from itertools import accumulate
import random


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _points_and_radius(rng):
    # 半径 1..30，点的坐标取 -3..r+3：圆里、圆外、正方形外、负坐标都有。
    # 三分之一的组专门放进圆周上的点 (0, ±r)、(±r, 0) 与勾股数点（3, 4, 5 的倍数）——
    # 「严格小于」改成「小于等于」只在圆周上的点上现形。
    r = rng.randint(1, 30)
    points = [(rng.randint(-3, r + 3), rng.randint(-3, r + 3))
              for _ in range(rng.randint(0, 25))]
    if rng.random() < 1 / 3:
        k = rng.randint(1, 6)
        r = 5 * k
        points += [(0, r), (r, 0), (-r, 0), (3 * k, 4 * k), (4 * k, -3 * k)]
        rng.shuffle(points)
    return points, r


def _grid_side(rng):
    # grid_count(n) 两重循环 O(n²)：n 收到 0..60。四分之一概率专门抽 0..3（空网格与最小的几格）。
    if rng.random() < 0.25:
        return (rng.randint(0, 3),)
    return (rng.randint(0, 60),)


def _dice_rolls(rng):
    # 0..60 掷，每掷两个 1..6：空列表（13 格全 0）也在内。
    return ([(rng.randint(1, 6), rng.randint(1, 6)) for _ in range(rng.randint(0, 60))],)


def _plus_minus_ones(rng):
    # 长 0..40 的 ±1 序列。四分之一概率专门造「先走远再走回来」的序列（+1 若干次再 -1 同样次数），
    # 让回到原点与离原点最远都一定发生；另四分之一全走同一个方向（一次都不回来）。
    roll = rng.random()
    if roll < 0.25:
        k = rng.randint(0, 20)
        sign = rng.choice((-1, 1))
        return ([sign] * k + [-sign] * k,)
    if roll < 0.5:
        return ([rng.choice((-1, 1))] * rng.randint(0, 40),)
    return ([rng.choice((-1, 1)) for _ in range(rng.randint(0, 40))],)


def _ruin_args(rng):
    # target 1..10，start 0..target（两端的 0 与 target 本身就是「一开局就结束」）；
    # 抛硬币序列长 0..40：短的序列常常走不到任何一端（unfinished 那一支）。
    # 三个结局 ruined / won / unfinished 的命中数见构建报告。
    target = rng.randint(1, 10)
    start = rng.randint(0, target)
    flips = [rng.choice((-1, 1)) for _ in range(rng.randint(0, 40))]
    return start, target, flips


def _queue_args(rng):
    # 顾客 0..15 个；到达间隔 0..5（0 = 与上一位同一分钟到），服务时长 1..6。
    # 间隔窄、服务长时会排起队，间隔宽时一直没人等：两种都常见。
    n = rng.randint(0, 15)
    wide = rng.random() < 0.3
    gaps = [rng.randint(0, 9 if wide else 3) for _ in range(n)]
    services = [rng.randint(1, 6) for _ in range(n)]
    return gaps, services


def _grid_board(rng):
    # 1..7 行、1..7 列、活细胞密度 0.2..0.6：边、角、满格都会碰到。
    rows, cols = rng.randint(1, 7), rng.randint(1, 7)
    density = rng.uniform(0.2, 0.6)
    return ([[1 if rng.random() < density else 0 for _ in range(cols)] for _ in range(rows)],)


def _live_set(rng):
    # 坐标 -4..4 里 0..25 个活细胞（包括负坐标——集合写法本来就没有边界）。
    size = rng.randint(0, 25)
    return ({(rng.randint(-4, 4), rng.randint(-4, 4)) for _ in range(size)},)


STATES = ('red', 'red+amber', 'green', 'amber')


def _fsm_args(rng):
    # 四个状态都当过起点；0..30 拍（一圈 9 拍，30 拍走过每一条转移至少三次）。
    return rng.choice(STATES), rng.randint(0, 30)


def _shuffle_args(rng):
    # 长 0..11（注 1 实测的范围），元素互不相同，种子 0..10**6。
    n = rng.randint(0, 11)
    return list(range(n)), rng.randint(0, 10 ** 6)


# ── 参照 ─────────────────────────────────────────────────────────────────

def _inside_by_isqrt(points, r):
    # 被测程序对每个点比 x*x + y*y < r*r。参照不比平方和：先对这一列 x 用 math.isqrt
    # 求出圆内允许的最大 |y|（y*y <= r*r - x*x - 1），再看这个点的 |y| 是否不超过它。
    inside = 0
    for x, y in points:
        room = r * r - x * x - 1
        if room >= 0 and abs(y) <= math.isqrt(room):
            inside += 1
    return inside


def _grid_by_columns(n):
    # 被测程序逐格看中心在不在圆里（两重循环）。参照一个格子都不看：第 x 列里，中心
    # (2y+1)² <= 4n² - (2x+1)² 的格子数，就是 (isqrt(右边) + 1) // 2，逐列加起来。
    return sum((math.isqrt(4 * n * n - (2 * x + 1) ** 2) + 1) // 2 for x in range(n))


def _tally_by_counter(rolls):
    # 被测程序用列表下标累加；参照用 collections.Counter 数每个和，再摊成 13 格的列表。
    counter = Counter(a + b for a, b in rolls)
    return [counter[total] for total in range(13)]


def _walk_by_accumulate(steps):
    # 被测程序一步一步走、边走边更新纪录；参照先用 itertools.accumulate 求出全部位置，
    # 再对整张位置表取末项、取绝对值的最大值、数 0 的个数。
    positions = list(accumulate(steps))
    end = positions[-1] if positions else 0
    farthest = max((abs(p) for p in positions), default=0)
    return end, farthest, positions.count(0)


def _ruin_by_prefix(start, target, flips):
    # 被测程序一边抛一边看钱数；参照先求出全部前缀和（每次抛完的钱数），再找第一个
    # 落到 0 或 target 的位置。
    if start <= 0:
        return 'ruined', 0
    if start >= target:
        return 'won', 0
    for k, money in enumerate(accumulate(flips, initial=start)):
        if money == 0:
            return 'ruined', k
        if money == target:
            return 'won', k
    return 'unfinished', len(flips)


def _queue_by_clock(gaps, services):
    # 被测程序按事件推进（每来一位顾客算一次）；参照按分钟推进时钟：每一分钟先让这一分钟
    # 到达的人排进队尾，柜台空着就让队首开始服务，再量一次队长。服务时长 >= 1，所以
    # 每分钟至多一人开始，时钟一定走得完。
    n = min(len(gaps), len(services))
    arrive = list(accumulate(gaps[:n]))
    waits = [0] * n
    waiting = []
    nxt = served = 0
    busy_until = 0
    longest = 0
    minute = 0
    while served < n:
        while nxt < n and arrive[nxt] == minute:
            waiting.append(nxt)
            nxt += 1
        if waiting and busy_until <= minute:
            k = waiting.pop(0)
            waits[k] = minute - arrive[k]
            busy_until = minute + services[k]
            served += 1
        longest = max(longest, len(waiting))
        minute += 1
    return waits, longest


def _neighbour_counts(live):
    return Counter((r + dr, c + dc) for r, c in live
                   for dr in (-1, 0, 1) for dc in (-1, 0, 1) if dr or dc)


def _life_grid_by_set(grid):
    # 二维表版的参照：把表换成活细胞集合，用 Counter 从活细胞向外数邻居，
    # 出界的邻格直接丢掉，再摊回同样大小的二维表。
    rows, cols = len(grid), len(grid[0])
    live = {(r, c) for r in range(rows) for c in range(cols) if grid[r][c]}
    counts = _neighbour_counts(live)
    return [[1 if counts[(r, c)] == 3 or (counts[(r, c)] == 2 and (r, c) in live) else 0
             for c in range(cols)] for r in range(rows)]


def _life_set_by_grid(live):
    # 集合版的参照：在活细胞外包一圈的二维表上逐格数 8 个邻居（被测与参照互为对方的写法）。
    if not live:
        return set()
    top = min(r for r, _ in live) - 1
    left = min(c for _, c in live) - 1
    rows = max(r for r, _ in live) - top + 2
    cols = max(c for _, c in live) - left + 2
    table = [[0] * cols for _ in range(rows)]
    for r, c in live:
        table[r - top][c - left] = 1
    new = set()
    for r in range(rows):
        for c in range(cols):
            n = 0
            for rr in range(max(r - 1, 0), min(r + 2, rows)):
                for cc in range(max(c - 1, 0), min(c + 2, cols)):
                    n += table[rr][cc]
            n -= table[r][c]
            if n == 3 or (n == 2 and table[r][c]):
                new.add((r + top, c + left))
    return new


def _fsm_by_if_chain(start, ticks):
    # 被测程序查两张表（转移表 NEXT、时长表 DURATION）；参照不查表，写成一条 if 链，
    # 每个状态的时长与下一个状态都写死在各自的分支里。
    state = start
    spent = 0
    out = []
    for _ in range(ticks):
        out.append(state)
        spent += 1
        if state == 'red':
            if spent == 4:
                state, spent = 'red+amber', 0
        elif state == 'red+amber':
            state, spent = 'green', 0
        elif state == 'green':
            if spent == 3:
                state, spent = 'amber', 0
        else:
            state, spent = 'red', 0
    return out


def _shuffle_by_library(items, seed):
    # ⚠ 同一算法（裁决 R3）：Random.shuffle 的源码（inspect.getsource）就是 Fisher-Yates——
    # `for i in reversed(range(1, len(x))): j = randbelow(i + 1)`。实现者不同：它走
    # `_randbelow`，被测走 `randrange`，两者对同一个种子取出同一串数（注 1：3.9.6 与 3.12.9
    # 上 300 个种子 × 长 0–11 逐项相同）。所以这条参照守得住「下标范围与遍历方向写错」——
    # 实测：randrange(i) 代替 randrange(i + 1)、改成 range(1, len(items)) 从前往后走，门都红；
    # range 的终点写成 -1（多走一次 i = 0）门是绿的，但那是等价程序：randrange(1) 只能是 0、
    # 自己跟自己换，多取的随机位又在最后，不影响结果。守不住的是「算法本身错」：算法本身
    # 就是标准库拿来比的那一个。这是裁决 R3 接受的局限，进第 3 次回报留账。
    result = list(items)
    random.Random(seed).shuffle(result)
    return result


REFERENCES = {
    'monte-carlo-pi-random': {
        'ref': _inside_by_isqrt,
        'cases': _points_and_radius,
    },
    'monte-carlo-pi-grid': {
        'ref': _grid_by_columns,
        'cases': _grid_side,
    },
    'dice-sum-frequencies': {
        'ref': _tally_by_counter,
        'cases': _dice_rolls,
    },
    'random-walk-1d': {
        'ref': _walk_by_accumulate,
        'cases': _plus_minus_ones,
    },
    'gamblers-ruin': {
        'ref': _ruin_by_prefix,
        'cases': _ruin_args,
    },
    'queue-single-server': {
        'ref': _queue_by_clock,
        'cases': _queue_args,
    },
    'game-of-life-grid': {
        'ref': _life_grid_by_set,
        'cases': _grid_board,
    },
    'game-of-life-set': {
        'ref': _life_set_by_grid,
        'cases': _live_set,
    },
    'traffic-light-fsm': {
        'ref': _fsm_by_if_chain,
        'cases': _fsm_args,
    },
    'shuffle-fisher-yates': {
        'ref': _shuffle_by_library,
        'cases': _shuffle_args,
    },
}
