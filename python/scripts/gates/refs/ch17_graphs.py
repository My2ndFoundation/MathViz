"""ch17-graphs 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（协议：种子 properties.SEED、SAMPLES 组、本文件的
生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**实参的形状**：结点一律取 `0..n-1`（n ≤ 7），邻居列表的顺序每组打乱——BFS / DFS 的
访问顺序取决于邻居顺序，排好序的邻居会把「倒序压栈」这类变异藏起来。每个生成器都
按一定概率专门造出被测函数的冷门返回分支：不连通（`inf` / `None`）、不可达
（`None` / `-1`）、有环（`None`）、起点即终点。各分支的命中数见构建报告。

**门的盲区（清单 §5）**：门先调被测函数、再用同一批实参对象调参照。本章所有被测
函数都不改实参（构建时每组先 `copy.deepcopy` 实参、跑完比对过），参照也不改实参。

**返回类型**：门比较值**与类型**。距离表里可达结点是 int、不可达是 `float('inf')`，
与被测程序一致；找不到路径时两边都是 `None`，A* 不可达时两边都是 int `-1`。
"""
import itertools

INF = float('inf')


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _n(rng, low=1, high=7):
    return rng.randint(low, high)


def _density(rng):
    # 稀疏到稠密各一档：稀疏档常出不连通 / 不可达，稠密档常出多条等长路与环。
    return rng.choice((0.15, 0.3, 0.5, 0.8))


def _shuffled_keys(rng, graph):
    # 字典键的插入顺序也打乱：「按 for node in graph 的先后」不该影响答案。
    keys = list(graph)
    rng.shuffle(keys)
    return {k: graph[k] for k in keys}


def _undirected(rng, n):
    p = _density(rng)
    graph = {v: [] for v in range(n)}
    for u in range(n):
        for v in range(u + 1, n):
            if rng.random() < p:
                graph[u].append(v)
                graph[v].append(u)
    for v in graph:
        rng.shuffle(graph[v])
    return graph


def _directed(rng, n):
    p = _density(rng)
    graph = {v: [] for v in range(n)}
    for u in range(n):
        for v in range(n):
            if u != v and rng.random() < p:
                graph[u].append(v)
    for v in graph:
        rng.shuffle(graph[v])
    return graph


def _any_graph(rng, n):
    return _undirected(rng, n) if rng.random() < 0.5 else _directed(rng, n)


def _matrix_case(rng):
    # 对称 0/1 矩阵、对角线为 0；nodes 是 0..n-1 的一个打乱排列——
    # 名字与下标不再相同，「键写成下标 i」这类变异才看得见。n 可以是 0。
    n = rng.randint(0, 7)
    p = _density(rng)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if rng.random() < p:
                matrix[i][j] = matrix[j][i] = 1
    nodes = list(range(n))
    rng.shuffle(nodes)
    return (matrix, nodes)


def _traversal_case(rng):
    n = _n(rng)
    graph = _shuffled_keys(rng, _any_graph(rng, n))
    return (graph, rng.randrange(n))


def _count_shortest(graph, start):
    # 生成器自用：逐层数最短路条数（不是参照，只用来筛「最短路唯一」的实参）。
    dist = {start: 0}
    ways = {start: 1}
    layer = [start]
    while layer:
        nxt = []
        for u in layer:
            for v in graph[u]:
                if v not in dist:
                    dist[v] = dist[u] + 1
                    ways[v] = 0
                    nxt.append(v)
                if dist[v] == dist[u] + 1:
                    ways[v] += ways[u]
        layer = nxt
    return ways


def _path_case(rng):
    # 最短路不唯一时，BFS 交回哪一条取决于邻居顺序，参照没有唯一答案；
    # 所以只留「终点不可达」或「最短路恰好一条」的实参。起点即终点单独以约 1/8 概率造
    # （以及 n = 1 时），其余时候终点取起点以外的结点。
    while True:
        n = _n(rng)
        graph = _shuffled_keys(rng, _any_graph(rng, n))
        start = rng.randrange(n)
        others = [v for v in range(n) if v != start]
        goal = start if not others or rng.random() < 0.125 else rng.choice(others)
        ways = _count_shortest(graph, start)
        if ways.get(goal, 0) <= 1:
            return (graph, start, goal)


def _weighted_undirected(rng, n):
    p = _density(rng)
    graph = {v: [] for v in range(n)}
    for u in range(n):
        for v in range(u + 1, n):
            if rng.random() < p:
                w = rng.randint(0, 9)
                graph[u].append((v, w))
                graph[v].append((u, w))
    for v in graph:
        rng.shuffle(graph[v])
    return graph


def _weighted_directed(rng, n):
    p = _density(rng)
    graph = {v: [] for v in range(n)}
    for u in range(n):
        for v in range(n):
            if u != v and rng.random() < p:
                graph[u].append((v, rng.randint(0, 9)))
    for v in graph:
        rng.shuffle(graph[v])
    return graph


def _dijkstra_case(rng):
    n = _n(rng)
    make = _weighted_undirected if rng.random() < 0.5 else _weighted_directed
    graph = _shuffled_keys(rng, make(rng, n))
    return (graph, rng.randrange(n))


def _dag_or_cycle(rng):
    # 按一个随机排列只连「往后」的边就是无环图；约 1/3 的实参再加一条往回的边
    # 或一个自环，造出环。
    n = _n(rng)
    order = list(range(n))
    rng.shuffle(order)
    p = _density(rng)
    graph = {v: [] for v in range(n)}
    for i in range(n):
        for j in range(i + 1, n):
            if rng.random() < p:
                graph[order[i]].append(order[j])
    if rng.random() < 0.34:
        i = rng.randrange(n)
        j = rng.randrange(i + 1)          # j <= i：往回的边，或 i == j 时的自环
        if order[j] not in graph[order[i]]:
            graph[order[i]].append(order[j])
    for v in graph:
        rng.shuffle(graph[v])
    return (_shuffled_keys(rng, graph),)


def _prim_case(rng):
    # n ≤ 6：参照要枚举 n−1 条边的全部子集。
    n = _n(rng, 1, 6)
    return (_shuffled_keys(rng, _weighted_undirected(rng, n)),)


def _kruskal_case(rng):
    n = _n(rng, 1, 6)
    graph = _weighted_undirected(rng, n)
    edges = [(w, u, v) for u in graph for v, w in graph[u] if u < v]
    rng.shuffle(edges)
    # 端点顺序也打乱：边 (w, u, v) 与 (w, v, u) 是同一条。
    edges = [(w, v, u) if rng.random() < 0.5 else (w, u, v) for w, u, v in edges]
    nodes = list(range(n))
    rng.shuffle(nodes)
    return (nodes, edges)


# 「高估的启发函数」陷阱。A* 找到的步数最短，靠的是曼哈顿距离从不高估；把它乘 2、
# 乘 3 或平方，在随机网格上几乎测不出来（6×6 以内、200 组：0 组不符）。下面两张网格
# 是离线搜出来的反例：启发高估时，A* 会先从一条更长的路弹出终点。实参生成器按约 15% 的
# 概率原样交出其中一张（不旋转、不翻转——换个方向，邻居的先后变了，陷阱未必还在）。
_ASTAR_TRAPS = (
    (('....', '..#.', '#...', '#...', '##..', '....'), (0, 3), (5, 1)),
    (('...#', '.#.#', '....', '.#..', '.##.', '....'), (0, 0), (5, 2)),
)


def _grid_case(rng):
    if rng.random() < 0.15:
        grid, start, goal = rng.choice(_ASTAR_TRAPS)
        return (list(grid), start, goal)
    rows, cols = rng.randint(1, 6), rng.randint(1, 6)
    p = rng.choice((0.1, 0.25, 0.4))
    cells = [['#' if rng.random() < p else '.' for _ in range(cols)] for _ in range(rows)]
    start = (rng.randrange(rows), rng.randrange(cols))
    others = [(r, c) for r in range(rows) for c in range(cols) if (r, c) != start]
    goal = start if not others or rng.random() < 0.1 else rng.choice(others)
    cells[start[0]][start[1]] = '.'
    cells[goal[0]][goal[1]] = '.'
    return ([''.join(row) for row in cells], start, goal)


# ── 参照 ─────────────────────────────────────────────────────────────────

def _matrix_to_list(matrix, nodes):
    # 先收成边集合 {(i, j)}，再按排好序的边逐条分给起点。
    # 被测是两重下标循环逐格看；这里不逐格建表。
    edges = {(i, j) for i, row in enumerate(matrix) for j, cell in enumerate(row) if cell == 1}
    out = {node: [] for node in nodes}
    for i, j in sorted(edges):
        out[nodes[i]].append(nodes[j])
    return out


def _bfs_frontier(graph, start):
    # 逐层 frontier：整层整层地往外扩，不用队列。
    order = [start]
    seen = {start}
    frontier = [start]
    while frontier:
        nxt = []
        for node in frontier:
            for nb in graph[node]:
                if nb not in seen:
                    seen.add(nb)
                    nxt.append(nb)
        order.extend(nxt)
        frontier = nxt
    return order


def _bellman_ford_unit(graph, start):
    # 无权图当作每条边权 1，反复松弛全部边 n−1 轮。
    dist = {v: INF for v in graph}
    dist[start] = 0
    for _ in range(len(graph) - 1):
        for u in graph:
            for v in graph[u]:
                if dist[u] + 1 < dist[v]:
                    dist[v] = dist[u] + 1
    return dist


def _path_by_distances(graph, start, goal):
    # 距离表来自 Bellman-Ford；从终点往回，每一步找「有边指向我、距离比我少 1」的
    # 那个结点。生成器保证最短路唯一，所以每一步只有一个候选。
    dist = _bellman_ford_unit(graph, start)
    if dist[goal] == INF:
        return None
    path = [goal]
    while path[-1] != start:
        here = path[-1]
        prev = [u for u in graph if here in graph[u] and dist[u] == dist[here] - 1]
        path.append(prev[0])
    path.reverse()
    return path


def _dfs_stack(graph, start):
    # 显式栈，栈里放 (结点, 邻居迭代器)：与递归的调用帧一一对应，入栈时标记。
    order = [start]
    seen = {start}
    stack = [iter(graph[start])]
    while stack:
        for nb in stack[-1]:
            if nb not in seen:
                seen.add(nb)
                order.append(nb)
                stack.append(iter(graph[nb]))
                break
        else:
            stack.pop()
    return order


def _dfs_recursive(graph, start):
    # 递归版（给显式栈的被测程序当参照）。
    order = []

    def go(node):
        order.append(node)
        for nb in graph[node]:
            if nb not in order:
                go(nb)

    go(start)
    return order


def _bellman_ford(graph, start):
    # 带权 Bellman-Ford：不挑结点、不用堆，每轮把全部边松弛一遍，共 n−1 轮。
    dist = {v: INF for v in graph}
    dist[start] = 0
    for _ in range(len(graph) - 1):
        for u in graph:
            for v, w in graph[u]:
                if dist[u] + w < dist[v]:
                    dist[v] = dist[u] + w
    return dist


def _topo_quadratic(graph):
    # O(n²)：每轮在剩下的结点里挑「剩下的图里没有边指向它」的最小者；挑不出就是有环。
    # 不数入度。
    remaining = set(graph)
    order = []
    while remaining:
        free = [v for v in remaining
                if not any(v in graph[u] for u in remaining)]
        if not free:
            return None
        pick = min(free)
        order.append(pick)
        remaining.remove(pick)
    return order


def _connected_by(nodes, edges):
    # 标签传播：每个结点带一个组号，反复把边两端的组号统一成较小者，直到不变。
    label = {v: v for v in nodes}
    changed = True
    while changed:
        changed = False
        for _, u, v in edges:
            low = min(label[u], label[v])
            if label[u] != low or label[v] != low:
                label[u] = label[v] = low
                changed = True
    return len(set(label.values())) <= 1


def _mst_brute(nodes, edges):
    # 枚举 n−1 条边的全部子集：连通的那些就是生成树，取总权最小的。n ≤ 6。
    nodes = list(nodes)
    best = None
    for subset in itertools.combinations(edges, max(len(nodes) - 1, 0)):
        if _connected_by(nodes, subset):
            total = sum(w for w, _, _ in subset)
            if best is None or total < best:
                best = total
    return best


def _prim_ref(graph):
    edges = [(w, u, v) for u in graph for v, w in graph[u] if u < v]
    return _mst_brute(list(graph), edges)


def _grid_bfs(grid, start, goal):
    # 网格 BFS：逐层扩展，不用启发、不用堆。
    rows, cols = len(grid), len(grid[0])
    seen = {start}
    layer = [start]
    steps = 0
    while layer:
        if goal in layer:
            return steps
        nxt = []
        for r, c in layer:
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr, nc = r + dr, c + dc
                if (0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] != '#'
                        and (nr, nc) not in seen):
                    seen.add((nr, nc))
                    nxt.append((nr, nc))
        layer = nxt
        steps += 1
    return -1


REFERENCES = {
    'adjacency-list-and-matrix': {
        'ref': _matrix_to_list,
        'cases': _matrix_case,
    },
    'bfs-order': {
        'ref': _bfs_frontier,
        'cases': _traversal_case,
    },
    'bfs-shortest-path': {
        'ref': _path_by_distances,
        'cases': _path_case,
    },
    'dfs-recursive': {
        'ref': _dfs_stack,
        'cases': _traversal_case,
    },
    'dfs-iterative-stack': {
        'ref': _dfs_recursive,
        'cases': _traversal_case,
    },
    'dijkstra-array-scan': {
        'ref': _bellman_ford,
        'cases': _dijkstra_case,
    },
    'dijkstra-heapq': {
        'ref': _bellman_ford,
        'cases': _dijkstra_case,
    },
    'topological-sort-kahn': {
        'ref': _topo_quadratic,
        'cases': _dag_or_cycle,
    },
    'mst-prim': {
        'ref': _prim_ref,
        'cases': _prim_case,
    },
    'mst-kruskal': {
        'ref': _mst_brute,
        'cases': _kruskal_case,
    },
    'a-star-grid': {
        'ref': _grid_bfs,
        'cases': _grid_case,
    },
}
