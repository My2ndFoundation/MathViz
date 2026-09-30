"""Pearson's correlation coefficient worked out from its definition."""
import numpy as np


def pearson(xs, ys):
    x = np.array(xs, dtype=float)
    y = np.array(ys, dtype=float)
    dx = x - x.mean()
    dy = y - y.mean()
# >>> BLANK id=top level=2 hint="离差乘积之和，存进 top。写法先定下：一对括号里 dx 乘 dy（dx 在前），再调用结果数组的 sum 方法（不用 np.sum、内置 sum 或 @） || 两列离差逐项相乘再加起来：同向偏离（同正或同负）的点贡献正数，反向的贡献负数" hintEn="The sum of the products of deviations, stored in top. Fix the form first: dx times dy inside one pair of brackets (dx first), then call the sum method of the resulting array (not np.sum, the built-in sum or @) || Multiply the two lists of deviations item by item and add them up: points that stray the same way (both above or both below) add a positive amount, points that stray opposite ways add a negative one"
    top = (dx * dy).sum()
# <<< BLANK
# >>> BLANK id=bottom level=3 hint="分母存进 bottom：两个平方和相乘再开方。写法先定下：np.sqrt 包住整个乘积；每个平方写成 ** 2、加一对括号后调用 sum 方法；dx 的那个在前 || dx 各项平方后求和，dy 各项平方后求和，两者相乘，再开平方 || 形状是 np.sqrt((…).sum() * (…).sum())" hintEn="The bottom, stored in bottom: multiply two sums of squares and take the square root. Fix the form first: np.sqrt wraps the whole product; write each square as ** 2 inside a pair of brackets and then call the sum method; the dx one comes first || Square every dx and add them up, square every dy and add them up, multiply the two, then take the square root || The shape is np.sqrt((...).sum() * (...).sum())"
    bottom = np.sqrt((dx ** 2).sum() * (dy ** 2).sum())
# <<< BLANK
# >>> BLANK id=ratio level=1 hint="一行 return：r 就是 top 除以 bottom。相除得到的是 numpy 的小数：先用 float 包住整个商（不用 .item()），再 round 到 9 位" hintEn="One return line: r is top divided by bottom. The quotient is a NumPy number: wrap the whole quotient in float (not .item()), then round it to 9 places"
    return round(float(top / bottom), 9)
# <<< BLANK


if __name__ == "__main__":
    hours = [1, 2, 3, 4, 5, 6, 7, 8]
    marks = [52, 55, 61, 58, 70, 74, 73, 81]
    print("hours vs marks:", round(pearson(hours, marks), 3))

    line = [2 * h + 1 for h in hours]
    print("exact straight line:", round(pearson(hours, line), 3))

    falling = [100 - 5 * h for h in hours]
    print("exact falling line:", round(pearson(hours, falling), 3))

    shoe = [6, 9, 7, 5, 8, 6, 9, 5]
    print("hours vs shoe size:", round(pearson(hours, shoe), 3))

    curve = [(h - 4.5) ** 2 for h in hours]
    print("a U-shaped curve:", round(pearson(hours, curve), 3))

    x = np.array(hours, dtype=float)
    dx = x - x.mean()
    print("deviations from the mean:")
    print(dx)
    print("they add up to:", float(dx.sum()))
