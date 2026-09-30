"""Conway's Game of Life on a bounded grid: build the whole next generation first."""


def live_neighbours(grid, row, col):
    count = 0
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            r, c = row + dr, col + dc
# >>> BLANK id=on-board level=2 hint="两行：一个 if 加一次 +=。写法先定下：行、列两个范围各用一个连写比较（不拆成四个单独的比较），用 and 连起来，行在前、列在后；列数用第 0 行的长度 len(grid[0])；+= 加的是那一格的值 grid[r][c] 本身（0 或 1） || 每个连写比较写成 0 <= 下标 < 长度：行数是 len(grid)" hintEn="Two lines: an if and a +=. Fix the form first: each of the two ranges, row and column, is one chained comparison (not four separate comparisons), joined by and, row first and column second; the number of columns is the length of row 0, len(grid[0]); the += adds that cell's value grid[r][c] itself (0 or 1) || Each chained comparison is 0 <= index < length: the number of rows is len(grid)"
            if 0 <= r < len(grid) and 0 <= c < len(grid[0]):
                count += grid[r][c]
# <<< BLANK
    return count


def step(grid):
    new = []
    for row in range(len(grid)):
        new_row = []
        for col in range(len(grid[0])):
            n = live_neighbours(grid, row, col)
            if grid[row][col] == 1:
# >>> BLANK id=survive level=2 hint="一行 append 一个条件表达式，形状是「1 if 条件 else 0」；条件用 in 检查 n 是否在一个元组里（不用 or），元组里的数从小到大写 || 活细胞有 2 个或 3 个活邻居时活下来，否则死去" hintEn="One append line holding a conditional expression shaped 1 if condition else 0; the condition uses in to check whether n is in a tuple (not or), with the numbers in the tuple written smallest first || A live cell survives with 2 or 3 live neighbours and dies otherwise"
                new_row.append(1 if n in (2, 3) else 0)
# <<< BLANK
            else:
                new_row.append(1 if n == 3 else 0)
        new.append(new_row)
    return new


def show(grid):
    for row in grid:
        print("".join("#" if cell else "." for cell in row))


if __name__ == "__main__":
    grid = [
        [0, 1, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
        [1, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
    ]
    for generation in range(17):
        if generation % 4 == 0:
            print("generation", generation, "alive", sum(sum(row) for row in grid))
            show(grid)
# >>> BLANK id=next-gen level=1 hint="用整张旧表算出整张新表，再让 grid 指向新表；一行赋值，右边是一次函数调用" hintEn="Work out the whole new board from the whole old one, then make grid refer to the new board: one assignment whose right-hand side is a single function call"
        grid = step(grid)
# <<< BLANK
