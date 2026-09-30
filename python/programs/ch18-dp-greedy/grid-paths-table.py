"""Count the paths across a grid with blocked cells: bottom-up, filling a table."""


def count_paths(grid):
    rows = len(grid)
    cols = len(grid[0])
# >>> BLANK id=table level=2 hint="外层是列表推导式，循环变量写 _，每一轮新建一行；行里的 0 用乘法写，[0] 在乘号左边（别用乘法复制整行——那样每一行都是同一个列表，改一格整列跟着变） || 表要 rows 行、cols 列：推导式跑 range(rows) 那么多轮，每一轮产出的一行有 cols 个 0" hintEn="The outside is a list comprehension with _ as the loop variable, building a fresh row each time round; the 0s in a row are written with multiplication, [0] on the left of the * (but do not copy whole rows with multiplication - every row would then be the same list, and changing one cell would change the whole column) || The table has rows rows and cols columns: the comprehension runs over range(rows), and each row it makes holds cols 0s"
    ways = [[0] * cols for _ in range(rows)]
# <<< BLANK
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "#":
                continue
            if r == 0 and c == 0:
                ways[r][c] = 1
            if r > 0:
# >>> BLANK id=from-above level=2 hint="把从正上方那一格走下来的路数加进这一格：用 +=，左边是这一格 ways[r][c] || 正上方那一格在上一行、同一列" hintEn="Add on the number of paths that come down from the cell directly above: use +=, with this cell ways[r][c] on the left || The cell directly above is in the previous row, same column"
                ways[r][c] += ways[r - 1][c]
# <<< BLANK
            if c > 0:
                ways[r][c] += ways[r][c - 1]
# >>> BLANK id=answer level=1 hint="答案在右下角那一格：用 rows - 1 与 cols - 1 两个下标取它（不用 -1 这样的负下标）" hintEn="The answer is in the bottom-right cell: reach it with the two indexes rows - 1 and cols - 1 (not negative indexes like -1)"
    return ways[rows - 1][cols - 1]
# <<< BLANK


if __name__ == "__main__":
    print(count_paths(["...", "...", "..."]))
    town = [
        "....",
        ".#..",
        "...#",
        "#...",
    ]
    print(count_paths(town))
    print(count_paths(["..", ".#"]))
