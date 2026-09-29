"""Multiply two matrices with three nested index loops."""


def matrix_multiply(a, b):
    m = len(a)
    n = len(b)
# >>> BLANK id=cols-of-b level=1 hint="p 是结果的列数，也就是 b 的列数：量一量 b 第一行（下标 0）有多长" hintEn="p is the number of columns in the result, which is the number of columns in b: measure how long the first row of b (index 0) is"
    p = len(b[0])
# <<< BLANK
    result = [[0] * p for _ in range(m)]
    for i in range(m):
        for j in range(p):
# >>> BLANK id=k-loop level=1 hint="最内层的循环：下标 k 从 0 走到 n 之前，range 只给一个实参——n 既是 a 的列数，也是 b 的行数" hintEn="The innermost loop: index k runs from 0 up to just before n, with a single argument to range - n is both the number of columns in a and the number of rows in b"
            for k in range(n):
# <<< BLANK
# >>> BLANK id=accumulate level=2 hint="结果第 i 行第 j 列的格子，加上 a 的一格乘以 b 的一格；用 +=；乘号左边是 a 的格子 || a 的那一格在第 i 行第 k 列，b 的那一格在第 k 行第 j 列——k 是两者共用、被求和掉的下标" hintEn="Add to the result cell in row i, column j the product of one cell of a and one cell of b; use +=; the cell of a goes on the left of the times sign || The cell of a is in row i, column k and the cell of b is in row k, column j - k is the index they share, the one being summed over"
                result[i][j] += a[i][k] * b[k][j]
# <<< BLANK
    return result


if __name__ == "__main__":
    a = [[1, 2, 3], [4, 5, 6]]
    b = [[7, 8], [9, 10], [11, 12]]
    print(matrix_multiply(a, b))
    print(matrix_multiply(b, a))
    print(matrix_multiply([[2, 0], [0, 2]], [[1, 2], [3, 4]]))
    print(matrix_multiply([[1, 2, 3]], [[4], [5], [6]]))
