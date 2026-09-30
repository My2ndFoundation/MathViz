"""Sunny or rainy: a two-state Markov chain with a transition matrix."""
import numpy as np

# row = today, column = tomorrow; order of states: sunny, rainy
P = np.array([[0.75, 0.25], [0.5, 0.5]])


def after_n_days(start, n):
    """Chances of [sunny, rainy] n days after the chances in start."""
    state = np.array(start, dtype=float)
# >>> BLANK id=jump level=2 hint="一步跳到第 n 天：先把 P 自乘 n 次（用 numpy 线性代数模块里求矩阵幂的函数），行向量 state 写在 @ 左边；结果存进 later || 那个函数叫 matrix_power，住在 np.linalg 里，两个实参依次是矩阵与指数；n = 0 时它给出单位矩阵" hintEn="Jump straight to day n: raise P to the power n (with the matrix power function in numpy's linear algebra module), with the row vector state on the left of @; store it in later || The function is called matrix_power and lives in np.linalg; its two arguments are the matrix and then the power; for n = 0 it gives the identity matrix"
    later = state @ np.linalg.matrix_power(P, n)
# <<< BLANK
    return [round(float(p), 9) for p in later]


if __name__ == "__main__":
    print(P.sum(axis=1))

    state = np.array([1.0, 0.0])
    for day in range(1, 5):
# >>> BLANK id=step level=1 hint="走一天：行向量 state 乘以转移矩阵 P（state 在 @ 左边），结果赋回 state；用 @，但不用 @= 这种增强赋值，写成 state = … 的形式" hintEn="Move on one day: the row vector state times the transition matrix P (state on the left of @), assigned back to state; use @ but not the augmented assignment @=, and write it in the form state = …"
        state = state @ P
# <<< BLANK
        print(day, state)

    print(after_n_days([1, 0], 4))
    print(after_n_days([1, 0], 0))
    print(after_n_days([0, 1], 30))
    print(after_n_days([1, 0], 30))

    # the steady state s does not change: s @ P equals s
    s = np.array([2 / 3, 1 / 3])
    print(np.allclose(s @ P, s))
