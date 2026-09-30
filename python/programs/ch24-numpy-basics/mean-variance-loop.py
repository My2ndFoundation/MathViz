"""Mean and population variance with two plain loops."""


def mean_variance(xs):
    """Return (mean, population variance) of a non-empty list, each to 9 places."""
    total = 0
    for x in xs:
        total += x
# >>> BLANK id=mean level=1 hint="均值 mean 等于总和 total 除以个数：个数直接用 len(xs) 现算，用普通除法 /" hintEn="The mean is the sum total divided by how many values there are: work the count out on the spot with len(xs), and use ordinary division /"
    mean = total / len(xs)
# <<< BLANK

    squares = 0
    for x in xs:
# >>> BLANK id=squares level=2 hint="把「x 离均值有多远」的平方累加进 squares：写成 += 的增量赋值，右边是 x 减 mean 放在圆括号里、再用 ** 平方 || x 写在减号左边；平方写成 ** 2，不写成自己乘自己" hintEn="Add the square of how far x is from the mean onto squares: an augmented assignment with +=, and on the right x minus mean in round brackets, squared with ** || x goes on the left of the minus sign; the square is ** 2, not the value multiplied by itself"
        squares += (x - mean) ** 2
# <<< BLANK
    variance = squares / len(xs)

    return round(mean, 9), round(variance, 9)


def standard_deviation(xs):
    """The population standard deviation: the square root of the variance."""
    _, variance = mean_variance(xs)
    return round(variance ** 0.5, 9)


if __name__ == "__main__":
    marks = [12, 15, 9, 20, 14]
    m, v = mean_variance(marks)
    print(m, v)
    print(standard_deviation(marks))

    print(mean_variance([5, 5, 5]))
    print(mean_variance([1, 2, 3, 4]))
    print(mean_variance([7]))

    shifted = [x + 100 for x in marks]
    print(mean_variance(shifted))
