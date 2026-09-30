"""A least-squares line of best fit worked out from its formula."""
import numpy as np


def fit_line(xs, ys):
    x = np.array(xs, dtype=float)
    y = np.array(ys, dtype=float)
    dx = x - x.mean()
# >>> BLANK id=slope level=3 hint="斜率存进 slope。写法先定下：分子是一对括号里 dx 乘以（y 减去 y 的均值），再调用 sum 方法，dx 在前；分母是 dx 的平方（写成 ** 2）加一对括号后调用 sum 方法；均值用数组的 mean 方法 || 斜率 = Σ(x - x̄)(y - ȳ) / Σ(x - x̄)²，而 dx 已经是 x - x̄ || 形状是 (dx * (…)).sum() / (…).sum()" hintEn="The gradient, stored in slope. Fix the form first: the top is dx times (y minus the mean of y) inside one pair of brackets, then the sum method, with dx first; the bottom is dx squared (written ** 2) in a pair of brackets followed by the sum method; take means with the array's mean method || gradient = sum of (x - x-bar)(y - y-bar) / sum of (x - x-bar) squared, and dx is already x - x-bar || The shape is (dx * (...)).sum() / (...).sum()"
    slope = (dx * (y - y.mean())).sum() / (dx ** 2).sum()
# <<< BLANK
# >>> BLANK id=intercept level=2 hint="截距存进 intercept。写法先定下：y 的均值在前，减去 slope 乘 x 的均值（slope 在乘号左边）；均值都用数组的 mean 方法 || 最佳拟合直线一定经过均值点 (x̄, ȳ)：ȳ = 斜率 × x̄ + 截距，移项就得到截距" hintEn="The intercept, stored in intercept. Fix the form first: the mean of y comes first, minus slope times the mean of x (slope on the left of the times sign); take both means with the array's mean method || The line of best fit always passes through the mean point (x-bar, y-bar): y-bar = gradient * x-bar + intercept, so rearrange for the intercept"
    intercept = y.mean() - slope * x.mean()
# <<< BLANK
    return round(float(slope), 9), round(float(intercept), 9)


def predict(slope, intercept, x):
# >>> BLANK id=predict level=1 hint="一行 return：直线上的值 = 斜率乘 x 再加截距；slope 在乘号左边，截距加在最后" hintEn="One return line: the value on the line is the gradient times x plus the intercept; slope on the left of the times sign, the intercept added last"
    return slope * x + intercept
# <<< BLANK


if __name__ == "__main__":
    hours = [1, 2, 3, 4, 5, 6, 7, 8]
    marks = [52, 55, 61, 58, 70, 74, 73, 81]
    slope, intercept = fit_line(hours, marks)
    print("slope:", round(slope, 3))
    print("intercept:", round(intercept, 3))
    print(f"line: mark = {slope:.3f} * hours + {intercept:.3f}")

    for h in (2.5, 6, 9):
        print("hours", h, "-> predicted mark", round(predict(slope, intercept, h), 1))

    x_bar = sum(hours) / len(hours)
    y_bar = sum(marks) / len(marks)
    print("mean point:", x_bar, y_bar)
    print("line at the mean:", round(predict(slope, intercept, x_bar), 3))

    print("exact line y = 3x - 2:", fit_line(hours, [3 * h - 2 for h in hours]))
    print("40 hours:", round(predict(slope, intercept, 40), 1))
