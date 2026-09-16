"""Return the smallest, largest and mean of a list as one tuple, and unpack it."""


def summarise(values):
# >>> BLANK id=three-back level=2 hint="一个 return 交回三样东西，用逗号隔开、不加括号：先最小、再最大、最后均值；最小与最大用内置函数，均值用内置的 sum 除以 len（不用 statistics） || 三样都直接作用在 values 上，不先存进变量；除法用 / 而不是 //" hintEn="One return handing back three things separated by commas, no brackets: smallest first, then largest, then the mean; smallest and largest come from built-in functions, and the mean is the built-in sum divided by len (not statistics) || all three work on values directly, nothing stored in a variable first; divide with / and not //"
    return min(values), max(values), sum(values) / len(values)
# <<< BLANK


if __name__ == "__main__":
    readings = [12, 7, 19, 3, 9]
# >>> BLANK id=unpack level=1 hint="一行把 summarise(readings) 交回的三样东西分别接进 low、high、mean 三个名字，左边不加括号" hintEn="In one line, catch the three things summarise(readings) hands back in the names low, high and mean, with no brackets on the left"
    low, high, mean = summarise(readings)
# <<< BLANK
    print(low, high, mean)
    result = summarise([4, 4, 5])
    print(result)
    print(type(result).__name__, len(result))
    print(result[2])
