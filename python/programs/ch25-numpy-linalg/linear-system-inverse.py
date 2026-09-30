"""Solve simultaneous equations A x = b by inverting A first."""
import numpy as np


def solve_by_inverse(a, b):
    """Solve A x = b as inv(A) @ b; a is a list of rows. Answers to 9 places."""
    A = np.array(a, dtype=float)
    rhs = np.array(b, dtype=float)
# >>> BLANK id=inverse level=2 hint="先求 A 的逆，再用矩阵乘乘以 rhs；逆矩阵写在 @ 左边，整行写在一个表达式里，不另起变量 || 求逆是 np.linalg.inv(A)；结果存进 x" hintEn="Invert A first, then multiply by rhs with the matrix product; the inverse goes on the left of @, all in one expression without a separate variable || The inverse is np.linalg.inv(A); store the result in x"
    x = np.linalg.inv(A) @ rhs
# <<< BLANK
    return [round(float(value), 9) for value in x]


if __name__ == "__main__":
    # 2x + y = 5  and  x - 3y = -1
    A = np.array([[2, 1], [1, -3]])
    b = np.array([5, -1])
    inv = np.linalg.inv(A)
    print(inv)
# >>> BLANK id=identity level=2 hint="打印逆矩阵乘原矩阵（inv 在 @ 左边）是否在误差范围内处处等于 2×2 的单位矩阵；用 np.allclose，第一个实参是 inv @ A，单位矩阵用 np.eye 造（不用 np.identity） || np.eye 的实参是边长，这里是 2" hintEn="Print whether the inverse times the original matrix (inv on the left of @) equals the 2 by 2 identity everywhere to within rounding; use np.allclose with inv @ A as its first argument, and np.eye for the identity (not np.identity) || np.eye takes the side length, 2 here"
    print(np.allclose(inv @ A, np.eye(2)))
# <<< BLANK
    x = np.array(solve_by_inverse(A, b))
    print(x)
    print(A @ x, np.allclose(A @ x, b))

    # x + y + z = 6,  2y + 5z = -4,  2x + 5y - z = 27
    print(solve_by_inverse([[1, 1, 1], [0, 2, 5], [2, 5, -1]], [6, -4, 27]))

    # parallel lines: x + 2y = 3 and 2x + 4y = 6 - A has no inverse
    try:
# >>> BLANK id=no-inverse level=1 hint="对奇异矩阵 [[1, 2], [2, 4]] 求逆（先用 np.array 把它变成数组）；这一行只调用、不存结果——它会抛异常" hintEn="Invert the singular matrix [[1, 2], [2, 4]] (turn it into an array with np.array first); this line only makes the call and stores nothing - it raises an exception"
        np.linalg.inv(np.array([[1, 2], [2, 4]]))
# <<< BLANK
    except np.linalg.LinAlgError as e:
        print(type(e).__name__)
