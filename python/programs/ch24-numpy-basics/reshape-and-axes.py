"""Reshape an array and add it up along each axis."""
import numpy as np


def column_sums(rows):
    """rows: a rectangular list of lists with at least one row."""
    a = np.array(rows)
# >>> BLANK id=axis0 level=2 hint="一行 return：让 a 自己做加法（用方法，不用 np.sum），关键字实参 axis 选「沿着行往下加、每一列得一个结果」的那个轴，最后把结果数组转回普通列表 || 每一列一个结果是 axis=0；转回列表用 .tolist()，直接接在 sum(...) 后面" hintEn="One return line: let a do the adding itself (the method, not np.sum), with the keyword argument axis set to the axis that adds down the rows and gives one result per column, then turn the result array back into a plain list || One result per column is axis=0; turning it back into a list is .tolist(), chained straight after sum(...)"
    return a.sum(axis=0).tolist()
# <<< BLANK


if __name__ == "__main__":
    a = np.arange(1, 7)
    print(a)
    print(a.shape)

# >>> BLANK id=reshape level=2 hint="把 a 重新排成 2 行 3 列，存进 grid：用数组的方法，行数与列数作为两个单独的整数实参，不包成元组，两个都写出来（不用 -1） || 方法名是 reshape，先写行数 2、再写列数 3" hintEn="Rearrange a into 2 rows and 3 columns and keep it in grid: use the array's method, with the row count and column count as two separate integer arguments, not wrapped in a tuple, and both written out (no -1) || The method is reshape, with the row count 2 first and the column count 3 second"
    grid = a.reshape(2, 3)
# <<< BLANK
    print(grid)
    print(grid.shape)
    print(a.reshape(3, -1))
    print(a.reshape(-1, 1).shape)

# >>> BLANK id=transpose level=1 hint="打印 grid 的转置（行变列、列变行）：用那个单字母的属性，不调用函数" hintEn="Print the transpose of grid (rows become columns and columns become rows): use the one-letter attribute, not a function call"
    print(grid.T)
# <<< BLANK
    print(grid.T.shape)

    print(grid.sum())
    print(grid.sum(axis=1))
    print(column_sums(grid.tolist()))
    print(column_sums([[5, 1], [2, 2], [0, 3]]))
    print(column_sums([[4, 7, 1]]))
