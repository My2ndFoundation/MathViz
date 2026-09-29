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
# >>> BLANK id=push-f level=3 hint="用 heapq 模块的函数压进一个三项元组，与上面建堆时那一项同样的形状 || 第一项是 f：新的 g 加上 nxt 到 goal 的曼哈顿距离，g 的部分写在前、不另加括号，曼哈顿函数的两个实参先 nxt、后 goal；第二项是新的 g；第三项是格子 nxt || 新的 g 就是 g + 1；堆按第一项 f 排，f 最小的先展开" hintEn="Push a three-item tuple with the heapq module's function, the same shape as the item the heap started with || First comes f: the new g plus the Manhattan distance from nxt to goal, with the g part first and no extra brackets, and the Manhattan function given nxt then goal; second, the new g; third, the cell nxt || The new g is g + 1; the heap orders by the first item f, so the smallest f is expanded next"
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
