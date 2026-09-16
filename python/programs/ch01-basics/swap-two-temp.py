"""Swap two values through a temporary variable."""


def swap(a, b):
# >>> BLANK id=three-assignments level=2 hint="a 一被覆盖，旧值就没了，所以先把它存起来 || 三行简单赋值，临时变量叫 temp：先存的是 a 而不是 b；最后一行从 temp 取，不从 a 取" hintEn="Once a is overwritten its old value is gone, so put it somewhere safe first || three plain assignments with a temporary called temp: temp saves a, not b; the last line reads from temp, not from a"
    temp = a
    a = b
    b = temp
# <<< BLANK
    return a, b


if __name__ == "__main__":
    x, y = 1, 2
    print(x, y)
# >>> BLANK id=catch-result level=1 hint="swap() 改不到外面这里的 x 和 y——调用它，再把它交回来的两个值按原来的先后接回 x 和 y" hintEn="swap() cannot reach the x and y out here - call it, and catch the two values it hands back in x and y again, in the same order"
    x, y = swap(x, y)
# <<< BLANK
    print(x, y)
