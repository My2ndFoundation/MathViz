"""Assigning a list to a second name copies nothing: both names share one list."""


def alias_and_change():
    a = [[1, 2], [3, 4]]
# >>> BLANK id=alias level=1 hint="不复制任何东西：只让名字 b 指向 a 所指的那同一个列表" hintEn="Copy nothing: just make the name b refer to the very same list that a refers to"
    b = a
# <<< BLANK
# >>> BLANK id=change-inner level=2 hint="通过 b 把第一行的第一格改成 99：两层下标，先选行、再选格 || 行和格的下标都是 0" hintEn="Through b, change the first cell of the first row to 99: two indexes, first choosing the row, then the cell || Both the row index and the cell index are 0"
    b[0][0] = 99
# <<< BLANK
    b.append([5, 6])
    return a, b


if __name__ == "__main__":
    a, b = alias_and_change()
    print(a)
    print(b)
    print(b is a, b[0] is a[0])
