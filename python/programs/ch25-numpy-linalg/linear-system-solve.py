"""Solve simultaneous equations A x = b with np.linalg.solve."""
import numpy as np


def solve_system(a, b):
    """Solve A x = b; a is a list of rows, b a list. Answers to 9 places."""
    A = np.array(a, dtype=float)
    rhs = np.array(b, dtype=float)
# >>> BLANK id=solve level=1 hint="交给 numpy 的线性代数模块一步解出 x：先写系数矩阵 A、再写右边的 rhs；不求逆" hintEn="Let numpy's linear algebra module solve for x in one step: the coefficient matrix A first, then the right-hand side rhs; no inverse"
    x = np.linalg.solve(A, rhs)
# <<< BLANK
    return [round(float(value), 9) for value in x]


if __name__ == "__main__":
    # 2x + y = 5  and  x - 3y = -1
    A = np.array([[2, 1], [1, -3]])
    b = np.array([5, -1])
    x = np.array(solve_system(A, b))
    print(x)
# >>> BLANK id=check level=2 hint="回代检验：先打印 A 乘 x（矩阵乘），再在同一个 print 里打印它与 b 是否在误差范围内处处相等；用 @（不用 .dot）与 np.allclose，np.allclose 的两个实参依次是 A @ x 和 b || print 的第一个实参就是 A @ x 本身，第二个是那次 np.allclose 的结果" hintEn="Check by substituting back: print A times x (matrix product), then in the same print whether it equals b everywhere to within rounding; use @ (not .dot) and np.allclose, which takes A @ x and then b || The first argument of print is A @ x itself and the second is the result of that np.allclose"
    print(A @ x, np.allclose(A @ x, b))
# <<< BLANK

    # x + y + z = 6,  2y + 5z = -4,  2x + 5y - z = 27
    print(solve_system([[1, 1, 1], [0, 2, 5], [2, 5, -1]], [6, -4, 27]))

    # parallel lines: x + 2y = 3 and 2x + 4y = 6 have no single answer
    try:
        np.linalg.solve(np.array([[1, 2], [2, 4]]), np.array([3, 6]))
# >>> BLANK id=singular level=2 hint="接住 numpy 线性代数模块自己的那个异常类，并把它绑定到名字 e；写全路径，从 np 开始 || 它住在 np.linalg 里，名字是 LinAlgError" hintEn="Catch the exception class that belongs to numpy's linear algebra module and bind it to the name e; write the full path starting from np || It lives in np.linalg and is called LinAlgError"
    except np.linalg.LinAlgError as e:
# <<< BLANK
        print(type(e).__name__)
