"""Count the paths across a grid with blocked cells: top-down, with lru_cache."""
import functools


def count_paths(grid):
    rows = len(grid)
    cols = len(grid[0])

    @functools.lru_cache(maxsize=None)
    def paths_from(r, c):
        if r >= rows or c >= cols or grid[r][c] == "#":
            return 0
# >>> BLANK id=goal level=2 hint="到了右下角那一格就停：一个 if，用 and 连起两个相等比较，先比 r 再比 c；每个比较都是变量在左、右边是长度减 1（不写成两个元组相比） || 最后一行的下标是 rows - 1，最后一列的下标是 cols - 1" hintEn="Stop on the bottom-right cell: an if joining two equality tests with and, r first and then c; in each test the variable goes on the left and a length minus 1 on the right (not two tuples compared) || The last row's index is rows - 1 and the last column's is cols - 1"
        if r == rows - 1 and c == cols - 1:
# <<< BLANK
            return 1
# >>> BLANK id=step level=2 hint="从这一格出发的路，要么先向下走一步、要么先向右走一步：把两种情况的路数加起来 return；先写向下的那一项 || 向下是行号加 1、列号不变；向右是行号不变、列号加 1——两项都是再调用 paths_from" hintEn="A path from this cell either takes its first step down or its first step right: return the two counts added together, with the step down written first || Down means the row plus 1 with the same column; right means the same row with the column plus 1 - both terms call paths_from again"
        return paths_from(r + 1, c) + paths_from(r, c + 1)
# <<< BLANK

# >>> BLANK id=start level=1 hint="整个问题就是「从左上角那一格出发有几条路」：交回对内层函数的一次调用，行、列都从 0 开始" hintEn="The whole question is how many paths start from the top-left cell: return one call of the inner function, with row and column both starting at 0"
    return paths_from(0, 0)
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
