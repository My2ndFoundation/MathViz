"""Population versus sample standard deviation, and z-scores."""
import statistics

import numpy as np


def sample_sd(xs):
    a = np.array(xs, dtype=float)
# >>> BLANK id=ddof1 level=2 hint="一行 return：样本标准差。写法先定下：调用数组 a 自己的 std 方法（不用 np.std），用关键字实参 ddof；结果先用 float 转成 Python 的小数，再 round 到 9 位 || 样本标准差的平方和除以 n - 1，ddof 就是从 n 里减掉的那个数" hintEn="One return line: the sample standard deviation. Fix the form first: call the array a's own std method (not np.std) with the keyword argument ddof; turn the result into a Python float with float, then round it to 9 places || The sample version divides the sum of squares by n - 1, and ddof is the number taken away from n"
    return round(float(a.std(ddof=1)), 9)
# <<< BLANK


def z_scores(a):
# >>> BLANK id=zscore level=2 hint="一行 return：整个数组的 z 分数一次算完。写法先定下：分子是一对括号里的 a 减去 a 的均值，分母是 a 的标准差，都用数组自己的方法（mean、std），std 显式写出 ddof=0 || z 分数量的是一个值离均值有几个标准差：(值 - 均值) / 总体标准差" hintEn="One return line: the z-scores of the whole array in one go. Fix the form first: the top is a minus the mean of a, inside one pair of brackets; the bottom is the standard deviation of a; use the array's own methods (mean, std), and write ddof=0 explicitly in std || A z-score says how many standard deviations a value sits from the mean: (value - mean) / population standard deviation"
    return (a - a.mean()) / a.std(ddof=0)
# <<< BLANK


if __name__ == "__main__":
    times = [12.1, 11.8, 12.4, 12.0, 11.9, 12.2, 14.6, 12.3, 11.7, 12.0]
    a = np.array(times)
    print("n:", len(a), "mean:", round(float(a.mean()), 3))

    population = a.std(ddof=0)
    print("population sd (ddof=0):", round(float(population), 3))
    print("sample sd (ddof=1):", round(sample_sd(times), 3))
    print("pstdev:", round(statistics.pstdev(times), 3))
    print("stdev:", round(statistics.stdev(times), 3))

    small = [4, 8]
    print("two values, ddof=0:", float(np.array(small).std(ddof=0)))
    print("two values, ddof=1:", round(sample_sd(small), 3))

    z = z_scores(a)
    print("z-scores:")
    print(np.round(z[:5], 2))
    print(np.round(z[5:], 2))
# >>> BLANK id=outlier level=2 hint="一行赋值给 outliers：用一个布尔数组当下标，从 a 里挑出离群值。写法先定下：方括号里直接写条件、不加多余的括号；绝对值用 np.abs，比较号用严格的大于，数字写在右边 || 离群值的判据：z 分数的绝对值大于 2，不管偏高还是偏低" hintEn="One assignment to outliers: use a boolean array as the index to pick the outliers out of a. Fix the form first: write the condition straight inside the square brackets with no extra brackets; take the absolute value with np.abs, use a strict greater-than, with the number on the right || The rule for an outlier: the absolute value of its z-score is more than 2, whether it is too high or too low"
    outliers = a[np.abs(z) > 2]
# <<< BLANK
    print("outliers:", outliers.tolist())
