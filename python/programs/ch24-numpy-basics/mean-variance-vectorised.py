"""Mean and population variance with whole-array operations, no loop."""
import numpy as np


def mean_variance(xs):
    """Return (mean, population variance) of a non-empty list, each to 9 places."""
    a = np.array(xs)
# >>> BLANK id=mean level=1 hint="让数组 a 自己求均值，存进 mean：用数组的方法，不用 np.mean，也不写 sum 除以个数" hintEn="Let the array a work out its own mean and keep it in mean: use the array's method, not np.mean, and not a sum divided by a count"
    mean = a.mean()
# <<< BLANK
# >>> BLANK id=variance level=2 hint="照定义写出总体方差，存进 variance：每个元素减去 mean、平方、再求这些平方的均值——求均值用数组的 .mean() 方法，不用 np.mean，也不调用 var；a 写在减号左边，平方写成 ** 2 || 「减、平方」整个放在一对圆括号里，.mean() 接在这对括号后面" hintEn="Write the population variance from its definition and keep it in variance: take mean away from every element, square, then take the mean of those squares - using the array's .mean() method, not np.mean, and not calling var; a on the left of the minus sign, the square written as ** 2 || The subtract-and-square part sits inside one pair of round brackets, with .mean() chained after them"
    variance = ((a - mean) ** 2).mean()
# <<< BLANK
# >>> BLANK id=plain level=3 hint="一行 return 两个值，不加外层括号，mean 在前：每个值先用 float() 转成 Python 自己的 float，再在外面套 round（不用 .item()，也不是先 round 再 float） || 每个值的写法是 round(float(...), 位数) || 两个值都保留 9 位小数" hintEn="One return line with two values, no outer brackets, mean first: each value is turned into Python's own float with float() first, with round wrapped around the outside (not .item(), and not round first then float) || Each value is written as round(float(...), places) || Both values keep 9 decimal places"
    return round(float(mean), 9), round(float(variance), 9)
# <<< BLANK


if __name__ == "__main__":
    marks = np.array([12, 15, 9, 20, 14])
    print(marks - marks.mean())
    print((marks - marks.mean()) ** 2)

    m, v = mean_variance(marks.tolist())
    print(m, v)
    print(round(float(marks.var()), 9))
    print(round(float(marks.std()), 9))

    print(mean_variance([5, 5, 5]))
    print(mean_variance([1, 2, 3, 4]))
    print(mean_variance([7]))

    shifted = marks + 100
    print(shifted)
    print(mean_variance(shifted.tolist()))

    raw = round(marks.mean(), 9)
    print(type(raw).__name__, type(m).__name__)
