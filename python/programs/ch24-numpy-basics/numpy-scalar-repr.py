"""Why a number taken out of a NumPy array prints with a type name."""
import numpy as np


def as_plain(values):
    """Turn a list of NumPy scalars into a list of Python's own numbers."""
# >>> BLANK id=item level=2 hint="一行 return 一个列表推导式：对 values 里的每个 v 调用它自己的一个方法，把 NumPy 标量换成 Python 自己的数；循环变量叫 v，不用 float() || 这个方法叫 item，不带实参" hintEn="One return line with a list comprehension: for every v in values, call one of v's own methods that swaps the NumPy scalar for Python's own number; the loop variable is v, and not float() || The method is item, with no arguments"
    return [v.item() for v in values]
# <<< BLANK


if __name__ == "__main__":
    a = np.array([1.5, 2.0, 3.25])
    first = a[0]
    print(first)
# >>> BLANK id=repr level=1 hint="打印 first 的 repr（在列表里、在交互窗口里看到的就是这种样子）：调用内置函数 repr，外面再包 print" hintEn="Print the repr of first (the form you see inside a list or at the interactive prompt): call the built-in repr, with print around it"
    print(repr(first))
# <<< BLANK
    print(type(first).__name__)

    picked = [a[0], a[2]]
    print(picked)
    print(as_plain(picked))
    print(float(a[1]))
# >>> BLANK id=tolist level=1 hint="打印把整个数组 a 一次转成 Python 列表的结果：用数组的方法，不用 list(a)——list(a) 只拆开最外一层，元素仍是 NumPy 标量" hintEn="Print the whole array a turned into a Python list in one go: use the array's method, not list(a) - list(a) only opens the outer layer and the elements are still NumPy scalars"
    print(a.tolist())
# <<< BLANK
    print(list(a))

    n = np.array([3, 4]).sum()
    print(n, repr(n))
    print(n.item(), type(n.item()).__name__)

    print(a.dtype, np.array([1, 2]).dtype, np.array([True, False]).dtype)
    print(isinstance(first, float))
    print(isinstance(n, int))

    lowest, highest = a.min(), a.max()
    print((lowest, highest))
    print((float(lowest), float(highest)))
