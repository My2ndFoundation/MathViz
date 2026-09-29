"""A shallow copy makes a new outer list but still shares the lists inside it."""


def shallow_copy_and_change():
    a = [[1, 2], [3, 4]]
# >>> BLANK id=shallow level=2 hint="给 b 一个新的外层列表：调用列表自己的那个复制方法（不用切片 a[:]，也不用 list(a)——三种都对，这里练的是方法） || 方法名就是英文的「复制」，不带实参" hintEn="Give b a new outer list: call the list's own copying method (not the slice a[:] and not list(a) - all three work, but this line practises the method) || The method name is simply the English word for it, with no arguments"
    b = a.copy()
# <<< BLANK
# >>> BLANK id=change-inner level=2 hint="通过 b 把第一行的第一格改成 99：两层下标，先选行、再选格 || 行和格的下标都是 0" hintEn="Through b, change the first cell of the first row to 99: two indexes, first choosing the row, then the cell || Both the row index and the cell index are 0"
    b[0][0] = 99
# <<< BLANK
    b.append([5, 6])
    return a, b


if __name__ == "__main__":
    a, b = shallow_copy_and_change()
    print(a)
    print(b)
    print(b is a, b[0] is a[0])
    print(a[:] is a, list(a) is a, a.copy() is a)
    print(a[:] == a, a[:][0] is a[0])
