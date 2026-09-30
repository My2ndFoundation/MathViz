"""Estimate pi by scattering random points over a square."""
import math
import random

R = 10000


def count_inside(points, r):
    inside = 0
    for x, y in points:
# >>> BLANK id=inside-test level=2 hint="一行 if：点 (x, y) 离原点比半径 r 近吗？不开根号，两边都比平方。写法先定下：每个平方写成自己乘自己（不用 **），x 的项在前、y 的项在后，r 的平方在比较号右边，比较号用严格的小于号 || 正好落在圆周上的点（例如 (0, r)）不算在里面，所以是严格小于；左边是两个平方相加" hintEn="One if line: is the point (x, y) closer to the origin than the radius r? No square root - compare squares. Fix the form first: each square written as a number times itself (not **), the x term before the y term, r squared on the right, and a strict less-than || A point exactly on the circle (such as (0, r)) does not count as inside, hence the strict less-than; the left-hand side is the two squares added"
        if x * x + y * y < r * r:
# <<< BLANK
            inside += 1
    return inside


def random_points(rng, n, r):
# >>> BLANK id=scatter level=3 hint="一行 return 一个列表推导式，造 n 个 (x, y) 元组。写法先定下：两个坐标都用 rng 的 randrange 方法、只给一个实参（不用 randint），循环变量用下划线 || randrange 的那个实参是 r，取到的是 0 到 r - 1 的整数；两个坐标各调用一次 || 推导式的形状是 [(横坐标, 纵坐标) for _ in range(n)]" hintEn="One line that returns a list comprehension making n tuples (x, y). Fix the form first: both coordinates come from rng's randrange method with a single argument (not randint), and the loop variable is an underscore || That single argument is r, which yields a whole number from 0 to r - 1; call it once for each coordinate || The comprehension has the shape [(x value, y value) for _ in range(n)]"
    return [(rng.randrange(r), rng.randrange(r)) for _ in range(n)]
# <<< BLANK


def estimate_pi(rng, n):
    points = random_points(rng, n, R)
# >>> BLANK id=ratio level=1 hint="一行 return，直接调用 count_inside（半径用常量 R）：落进四分之一圆的比例乘以 4 就是 π 的估计；4 写在最前，乘上那次调用，除以 n 放在最后" hintEn="One return line that calls count_inside directly (with the constant R as the radius): the share of points inside the quarter circle, times 4, estimates pi; the 4 comes first, times the call, and the division by n comes last"
    return 4 * count_inside(points, R) / n
# <<< BLANK


def mean_error(rng, n, runs):
    total = 0
    for _ in range(runs):
        total += abs(estimate_pi(rng, n) - math.pi)
    return total / runs


if __name__ == "__main__":
    rng = random.Random(2026)
    print("one run of 10000 points:", round(estimate_pi(rng, 10000), 4))
    print("points mean_error")
    for n in (400, 1600, 6400, 25600):
        print(n, round(mean_error(rng, n, 50), 4))
