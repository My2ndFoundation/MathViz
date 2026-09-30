"""Estimate pi without randomness: count grid points inside a quarter circle."""
import math


def grid_count(n):
    inside = 0
    for x in range(n):
        for y in range(n):
# >>> BLANK id=centre-test level=3 hint="一行 if：格子 (x, y) 的中心 (x + 0.5, y + 0.5) 在半径 n 的四分之一圆里吗？把不等式两边乘 2 再平方，就只剩整数。写法先定下：平方一律用 **，倍数写成 2 * 变量（2 在前），x 的项在前，比较号用 <= || 左边是两个加了括号的奇数各自平方再相加：一个由 x 算出、一个由 y 算出；右边是半径的两倍，加括号再平方 || 中心不可能正好落在圆周上（两个奇数的平方和除以 4 余 2，右边却是 4 的倍数），所以 < 与 <= 结果相同，这里统一写 <=；左边两个括号里分别是 2 * x + 1 与 2 * y + 1" hintEn="One if line: is the centre (x + 0.5, y + 0.5) of cell (x, y) inside the quarter circle of radius n? Double both sides of the inequality and square them, and only whole numbers are left. Fix the form first: square with ** throughout, write each doubling as 2 * variable (2 first), put the x term first, and compare with <= || On the left, two bracketed odd numbers each squared and then added: one made from x and one from y; on the right, twice the radius, bracketed and squared || A centre can never sit exactly on the circle (the sum of two odd squares leaves 2 when divided by 4, while the right-hand side is a multiple of 4), so < and <= give the same result; <= is used here. The two brackets on the left hold 2 * x + 1 and 2 * y + 1"
            if (2 * x + 1) ** 2 + (2 * y + 1) ** 2 <= (2 * n) ** 2:
# <<< BLANK
                inside += 1
    return inside


def estimate_pi(n):
# >>> BLANK id=grid-ratio level=1 hint="一行 return，直接调用 grid_count：一共 n * n 个格子，落在圆里的比例乘以 4 就是 π 的估计；4 写在最前，乘上那次调用，再除以 n * n——除数整体加括号" hintEn="One return line that calls grid_count directly: there are n * n cells, and the share of them inside the circle, times 4, estimates pi; the 4 comes first, times the call, then divided by n * n - with the whole divisor in brackets"
    return 4 * grid_count(n) / (n * n)
# <<< BLANK


if __name__ == "__main__":
    print("side points estimate error")
    for n in (10, 20, 40, 80, 160, 320):
        estimate = estimate_pi(n)
        print(n, n * n, f"{estimate:.5f}", f"{abs(estimate - math.pi):.5f}")
