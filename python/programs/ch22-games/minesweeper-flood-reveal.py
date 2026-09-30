"""Minesweeper: clicking a 0 opens the whole connected patch, breadth first."""
from collections import deque

FIELD = [
    "1*100000",
    "11100000",
    "00000111",
    "000001*1",
    "11000122",
    "*100001*",
]


def neighbours(w, h, x, y):
    cells = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            nx, ny = x + dx, y + dy
            if (dx, dy) != (0, 0) and 0 <= nx < w and 0 <= ny < h:
                cells.append((nx, ny))
    return cells


def reveal(grid, x, y):
# >>> BLANK id=boom level=2 hint="点到的是雷就什么都不翻开：一个 if，先按行、再按列取出这一格，和 0 比较 || 雷在网格里记作 -1；用小于号，不写等于 -1" hintEn="If the square clicked is a mine, nothing opens: an if that reads the square row first, then column, and compares it with 0 || A mine is stored as -1 in the grid; use less-than rather than equals -1"
    if grid[y][x] < 0:
# <<< BLANK
        return None
    opened = {(x, y)}
    queue = deque([(x, y)])
    while queue:
        cx, cy = queue.popleft()
# >>> BLANK id=only-zero level=2 hint="只有 0 才向四周扩散：这一格不是 0 就跳过它的邻居——一个 if，先行后列取这一格，用不等于和 0 比较 || 条件成立时下一行是 continue：这一格不再往外扩散" hintEn="Only a 0 spreads to its neighbours, so skip the neighbours of any other square - an if that reads the square row first, then column, and tests it with not-equals against 0 || When the condition holds the next line is continue: this square spreads no further"
        if grid[cy][cx] != 0:
# <<< BLANK
            continue
        for nx, ny in neighbours(len(grid[0]), len(grid), cx, cy):
# >>> BLANK id=new-cell level=1 hint="还没翻开过的邻居才入队：一个 if，用 not in，把 nx、ny 组成一个元组（加括号）" hintEn="Only a neighbour that has not been opened yet joins the queue: an if using not in, with nx and ny made into a tuple (in brackets)"
            if (nx, ny) not in opened:
# <<< BLANK
                opened.add((nx, ny))
                queue.append((nx, ny))
    return opened


def show(grid, opened):
    for y, row in enumerate(grid):
        print("".join(str(v) if (x, y) in opened else "#" for x, v in enumerate(row)))


if __name__ == "__main__":
    grid = [[-1 if ch == "*" else int(ch) for ch in line] for line in FIELD]
    for x, y in [(4, 1), (0, 0), (1, 0)]:
        opened = reveal(grid, x, y)
        if opened is None:
            print("click", (x, y), "- a mine!")
        else:
            print("click", (x, y), "- opened", len(opened))
            show(grid, opened)
