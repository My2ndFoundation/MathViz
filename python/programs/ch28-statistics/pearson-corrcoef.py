"""Pearson's correlation coefficient from NumPy's correlation matrix."""
import numpy as np


def pearson(xs, ys):
# >>> BLANK id=corrcoef level=1 hint="调用 np.corrcoef 得到相关矩阵，存进 matrix：两个列表分成两个实参传入（不先拼成一个列表），xs 在前、ys 在后" hintEn="Call np.corrcoef to get the correlation matrix and store it in matrix: pass the two lists as two separate arguments (not joined into one list first), xs first and ys second"
    matrix = np.corrcoef(xs, ys)
# <<< BLANK
# >>> BLANK id=pick level=2 hint="一行 return：从矩阵里取出 x 与 y 之间的那个系数，用 float 转成 Python 的小数，再 round 到 9 位。下标写成一对方括号、里面用逗号隔开行和列（不写成两对方括号） || 矩阵的第 0 行第 1 列就是 xs 与 ys 的相关系数（第 1 行第 0 列也是它；这里取行号小的那个）" hintEn="One return line: take the coefficient between x and y out of the matrix, turn it into a Python float with float, then round it to 9 places. Write the index as one pair of square brackets with the row and column separated by a comma (not two pairs of brackets) || Row 0, column 1 of the matrix is the coefficient between xs and ys (so is row 1, column 0; use the one with the smaller row number)"
    return round(float(matrix[0, 1]), 9)
# <<< BLANK


if __name__ == "__main__":
    hours = [1, 2, 3, 4, 5, 6, 7, 8]
    marks = [52, 55, 61, 58, 70, 74, 73, 81]
    matrix = np.corrcoef(hours, marks)
    print("correlation matrix:")
    print(np.round(matrix, 3))
    print("r:", round(pearson(hours, marks), 3))
    print("swap the order:", round(pearson(marks, hours), 3))

    temperature = [14, 16, 19, 22, 25, 27, 30, 31]
    ice_creams = [120, 135, 160, 210, 240, 260, 300, 310]
    sunburns = [2, 3, 5, 7, 9, 12, 14, 15]
# >>> BLANK id=table level=2 hint="三个变量的相关矩阵，存进 table：把三个列表放进一个列表，作为唯一的实参传给 np.corrcoef；顺序是温度、冰淇淋、晒伤 || 每个列表是一个变量；结果是 3 x 3 的矩阵，第 i 行第 j 列是第 i 个与第 j 个变量之间的 r" hintEn="The correlation matrix of three variables, stored in table: put the three lists inside one list and pass it as the only argument to np.corrcoef, in the order temperature, ice creams, sunburns || Each list is one variable; the result is a 3 x 3 matrix whose row i, column j is r between variable i and variable j"
    table = np.corrcoef([temperature, ice_creams, sunburns])
# <<< BLANK
    print("temperature, ice creams, sunburns:")
    print(np.round(table, 3))
    r = pearson(ice_creams, sunburns)
    print("ice creams vs sunburns:", round(r, 3))
    if r > 0.9:
        print("strong correlation - but ice cream does not cause sunburn")
