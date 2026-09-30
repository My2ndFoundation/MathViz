"""Determinant, inverse and the identity matrix."""
import numpy as np


def det_int(m):
    """Determinant of a square matrix of whole numbers, as an int."""
# >>> BLANK id=det level=1 hint="先用 np.array 把列表 m 变成数组，再交给 numpy 线性代数模块里求行列式的函数；结果存进 d" hintEn="Turn the list m into an array with np.array first, then hand it to the determinant function in numpy's linear algebra module; store the result in d"
    d = np.linalg.det(np.array(m))
# <<< BLANK
# >>> BLANK id=round-int level=1 hint="d 是一个带误差的浮点数：先用内置的 round（不是 np.round）取最近的整数，只给一个实参，再在外面套一层 int()，这样无论 round 交回什么类型，结果都是普通的 int" hintEn="d is a float with a little error in it: round it to the nearest whole number first with the built-in round (not np.round), given a single argument, then wrap int() around that, so the result is a plain int whatever type round hands back"
    return int(round(d))
# <<< BLANK


if __name__ == "__main__":
    A = np.array([[1, 2], [3, 4]])
    print(np.linalg.det(A))
    print(det_int(A))

    inv = np.linalg.inv(A)
    print(inv)
    print(A @ inv)
# >>> BLANK id=identity level=2 hint="打印 A 乘它的逆（A 在 @ 左边）是否在误差范围内处处等于 2×2 的单位矩阵；用 np.allclose，第一个实参是 A @ inv，单位矩阵用 np.eye 造（不用 np.identity） || np.eye 的实参是边长，这里是 2" hintEn="Print whether A times its inverse (A on the left of @) equals the 2 by 2 identity everywhere to within rounding; use np.allclose with A @ inv as its first argument, and np.eye for the identity (not np.identity) || np.eye takes the side length, 2 here"
    print(np.allclose(A @ inv, np.eye(2)))
# <<< BLANK
    print(np.eye(3))

    print(det_int([[2, 0, 0], [0, 3, 0], [0, 0, 4]]))
    print(det_int([[1, 2, 3], [4, 5, 6], [7, 8, 10]]))

    # the second row is twice the first: det is 0, so there is no inverse
    S = np.array([[1, 2], [2, 4]])
    print(det_int(S))
    try:
        np.linalg.inv(S)
    except np.linalg.LinAlgError as e:
        print(type(e).__name__)
