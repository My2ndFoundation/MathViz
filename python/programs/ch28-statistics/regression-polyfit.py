"""A least-squares line of best fit from np.polyfit, and its residuals."""
import numpy as np


def fit_line(xs, ys):
# >>> BLANK id=polyfit level=2 hint="一行：调用 np.polyfit 拟合一条直线，把返回的两个数直接解包进 slope 和 intercept。实参依次是 xs、ys 和次数，次数按位置写（不写 deg=），等号左边不加括号 || np.polyfit 返回的系数从最高次开始：先斜率、后截距；直线是一次的" hintEn="One line: call np.polyfit to fit a straight line and unpack the two numbers it returns straight into slope and intercept. The arguments are xs, ys and the degree, in that order, with the degree given by position (not deg=); no brackets on the left of the equals sign || np.polyfit returns the coefficients highest power first: gradient, then intercept; a straight line has degree one"
    slope, intercept = np.polyfit(xs, ys, 1)
# <<< BLANK
    return round(float(slope), 9), round(float(intercept), 9)


if __name__ == "__main__":
    hours = [1, 2, 3, 4, 5, 6, 7, 8]
    marks = [52, 55, 61, 58, 70, 74, 73, 81]
    print("polyfit returns:", np.round(np.polyfit(hours, marks, 1), 3))
    slope, intercept = fit_line(hours, marks)
    print("slope:", round(slope, 3), "intercept:", round(intercept, 3))

    x = np.array(hours)
    y = np.array(marks)
# >>> BLANK id=predicted level=1 hint="每个 x 在直线上的预测值，整个数组一次算完，存进 predicted：slope 乘 x 在前，再加 intercept" hintEn="The value on the line for every x, the whole array in one go, stored in predicted: slope times x first, then plus intercept"
    predicted = slope * x + intercept
# <<< BLANK
# >>> BLANK id=residuals level=1 hint="残差存进 residuals：观测值减去预测值，y 在前、直接减 predicted" hintEn="The residuals, stored in residuals: observed minus predicted, y first, then minus predicted directly"
    residuals = y - predicted
# <<< BLANK
    print("predicted:")
    print(np.round(predicted, 1))
    print("residuals:")
    print(np.round(residuals, 1))

    worst = int(np.argmax(np.abs(residuals)))
    print("furthest from the line: hours =", hours[worst])
    print("sum of squared residuals:", round(float((residuals ** 2).sum()), 2))

    steeper = slope + 0.5
    other = y - (steeper * x + intercept)
    print("a steeper line:", round(float((other ** 2).sum()), 2))
