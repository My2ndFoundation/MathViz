"""Find the largest of three numbers with the built-in max()."""


def max_of_three(a, b, c):
# >>> BLANK id=builtin-call level=1 hint="不自己比，让内置函数取最大值再交回去——三个数作为三个分开的参数传进去，按参数表的先后，不先装进列表或元组" hintEn="No comparisons of your own: let the built-in pick the largest and hand it back - pass the three numbers as three separate arguments in parameter order, not packed into a list or tuple first"
    return max(a, b, c)
# <<< BLANK


if __name__ == "__main__":
    print(max_of_three(3, 9, 5))
    print(max_of_three(9, 3, 5))
    print(max_of_three(3, 5, 9))
    print(max_of_three(7, 7, 7))
