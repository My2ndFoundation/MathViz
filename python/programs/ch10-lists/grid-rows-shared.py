"""Why [[0] * 3] * 3 is one row seen three times, and how to build a real grid."""


def shared_grid(size):
# >>> BLANK id=shared level=2 hint="一行 return：先造一行 size 个 0，再把「装着这一行的列表」重复 size 次；两处都用 *，列表写在 * 的左边 || 一行 size 个 0，是一个只含 0 的单元素列表乘出来的；外层方括号里只有一项——那一整行，要几行就乘几" hintEn="One return line: first make one row of size zeros, then repeat a list holding that row size times; use * both times, with the list on the left of the * || A row of size zeros comes from multiplying a one-item list holding 0; the outer brackets hold a single item - that whole row - multiplied by however many rows you want"
    return [[0] * size] * size
# <<< BLANK


def separate_grid(size):
# >>> BLANK id=separate level=3 hint="一行 return 一个列表推导式：每转一圈就新造一行，所以每一行都是不同的列表对象；造一行时列表写在 * 的左边；循环变量用不上，按习惯写成一个下划线 || 每一项是一行 size 个 0；for 部分跑 size 次 || 一行由单元素列表 [0] 乘出来；下划线从 range(size) 里取值" hintEn="One return line with a list comprehension: a new row is built on every pass, so every row is a different list object; when building a row, the list goes on the left of the *; the loop variable is never used, so by convention it is a single underscore || Each item is one row of size zeros; the for part runs size times || A row comes from multiplying the one-item list [0]; the underscore takes its values from range(size)"
    return [[0] * size for _ in range(size)]
# <<< BLANK


def mark_corner(grid):
# >>> BLANK id=corner level=1 hint="把第一行的第一格改成 1：两层下标，先选行、再选格，下标都是 0" hintEn="Set the first cell of the first row to 1: two indexes, first the row, then the cell, both of them 0"
    grid[0][0] = 1
# <<< BLANK
    return grid


if __name__ == "__main__":
    bad = mark_corner(shared_grid(3))
    good = mark_corner(separate_grid(3))
    print(bad)
    print(good)
    print(bad[0] is bad[1], good[0] is good[1])
