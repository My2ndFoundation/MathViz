"""Flatten a grid and swap its rows and columns with nested comprehensions."""


def flatten(grid):
# >>> BLANK id=flatten level=3 hint="一行 return 一个列表推导式，里面只有一对方括号、两个 for；外层循环变量叫 row、内层叫 cell || 两个 for 的先后与写成两层普通循环时一样：先取出每一行，再从这一行里取格子 || 每一项就是格子本身，不用再做运算" hintEn="One line: return a list comprehension with a single pair of brackets and two fors; the outer loop variable is row and the inner one is cell || The two fors come in the same order as two ordinary nested loops would: first take each row, then take the cells out of that row || Each item is just the cell itself, with nothing worked out"
    return [cell for row in grid for cell in row]
# <<< BLANK


def transpose(matrix):
# >>> BLANK id=transpose level=3 hint="一行 return 一个嵌套推导式，不用 zip：外层方括号逐个列号生成新的一行，列号叫 i，由 range 按第一行的长度产生；内层方括号逐行取出第 i 格，循环变量叫 row || 外层的 for 写在外层方括号里、内层方括号之后；内层的 for 写在内层方括号里 || 内层每一项用 i 去下标 row；列号有几个，看 matrix 第一行（下标 0）有多长" hintEn="One line: return a nested comprehension, no zip: the outer brackets build one new row per column number, called i, produced by range from the length of the first row; the inner brackets take cell i out of each row, with loop variable row || The outer for sits inside the outer brackets, after the inner brackets; the inner for sits inside the inner brackets || Each inner item indexes row with i; how many column numbers there are depends on how long the first row of matrix (index 0) is"
    return [[row[i] for row in matrix] for i in range(len(matrix[0]))]
# <<< BLANK


if __name__ == "__main__":
    grid = [[1, 2, 3], [4, 5, 6]]
    print(flatten(grid))
    print(flatten([[7], [], [8, 9]]))
    print(transpose(grid))
    print(transpose(transpose(grid)) == grid)
    print(transpose([[1, 2], [3, 4], [5, 6]]))
