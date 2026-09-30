"""A* search on a grid: expand the cell with the smallest f = g + h first."""

import heapq


def manhattan(cell, goal):
# >>> BLANK id=heuristic level=2 hint="一个 return：行号之差的绝对值加上列号之差的绝对值；两处都是 cell 的分量减 goal 的分量，行（下标 0）在前 || 只能上下左右走一格时，这是不计墙壁的最少步数，从不高估——A* 找到的才一定是最短的" hintEn="One return: the absolute difference of the rows plus the absolute difference of the columns; both times cell's part minus goal's part, the row (index 0) first || With one step up, down, left or right at a time, this is the fewest steps ignoring walls, so it never overestimates - which is what guarantees A* finds a shortest path"
    return abs(cell[0] - goal[0]) + abs(cell[1] - goal[1])
# <<< BLANK


def a_star(grid, start, goal):
    rows, cols = len(grid), len(grid[0])
    best = {start: 0}
    heap = [(manhattan(start, goal), 0, start)]
    while heap:
        _, g, cell = heapq.heappop(heap)
        if cell == goal:
            return g
        if g > best[cell]:
            continue
        r, c = cell
        for nxt in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            nr, nc = nxt
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] != "#":
# >>> BLANK id=better-g level=2 hint="一个 if，两种情况用 or、按这个先后：nxt 还不是 best 的键（not in），或者 g + 1 严格小于 best 里记着的它的步数；g + 1 写在比较号左边 || 头一回走到的格子，或者这回走得比以前记下的更近，才值得记下来、放进堆里" hintEn="An if with two cases joined by or, in this order: nxt is not yet a key of best (not in), or g + 1 is strictly less than the steps best has for it; g + 1 on the left of the comparison || A cell reached for the first time, or reached more cheaply than before, is the only kind worth recording and pushing"
                if nxt not in best or g + 1 < best[nxt]:
# <<< BLANK
                    best[nxt] = g + 1
# >>> BLANK id=push-f level=3 hint="用 heapq 模块的函数压进一个三项元组，与上面建堆时那一项同样的形状。写法上钉四处：新的 g 一律写成 g + 1（不用 best[nxt]）；f 里 g + 1 在前、曼哈顿距离在后；曼哈顿函数的实参照建堆那一项的顺序，格子在前、goal 在后；f 里不加任何多余的括号（g + 1 也不单独括起来） || 第一项是 f：新的 g 加上 nxt 到 goal 的曼哈顿距离；第二项还是写成 g + 1 的新的 g；第三项是格子 nxt || 函数是 heapq.heappush，第一个实参是 heap；堆按第一项 f 排，f 最小的先展开" hintEn="Push a three-item tuple with the heapq module's function, the same shape as the item the heap started with. Four choices are fixed: the new g is always written g + 1 (not best[nxt]); in f, g + 1 comes first and the Manhattan distance after it; the Manhattan function takes its arguments in the same order as in the heap's first item, the cell first and goal second; f gets no extra brackets anywhere (not even round g + 1) || First comes f: the new g plus the Manhattan distance from nxt to goal; second, the new g, again written g + 1; third, the cell nxt || The function is heapq.heappush and its first argument is heap; the heap orders by the first item f, so the smallest f is expanded next"
                    heapq.heappush(heap, (g + 1 + manhattan(nxt, goal), g + 1, nxt))
# <<< BLANK
    return -1


if __name__ == "__main__":
    grid = [
        "....#...",
        ".##.#.#.",
        ".#..#.#.",
        ".#.##.#.",
        "...#..#.",
        ".#...#..",
    ]
    print(a_star(grid, (0, 0), (0, 7)))
    print(a_star(grid, (0, 0), (5, 0)))
    walled = ["..#..", "..#..", "..#.."]
    print(a_star(walled, (0, 0), (2, 4)))
