"""Swap two values with tuple unpacking."""


def swap(a, b):
# >>> BLANK id=one-line-swap level=1 hint="一行完成，不借临时变量：左边依次是 a、b，右边是同样两个名字对调过来；两边都不加括号" hintEn="One line and no temporary: a then b on the left, the same two names the other way round on the right, and no brackets on either side"
    a, b = b, a
# <<< BLANK
    return a, b


if __name__ == "__main__":
    x, y = 1, 2
    print(x, y)
    x, y = swap(x, y)
    print(x, y)
