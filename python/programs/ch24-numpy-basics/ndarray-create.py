"""Build NumPy arrays from lists and with the ready-made makers."""
import numpy as np


def describe(name, a):
# >>> BLANK id=describe level=2 hint="一行 print：先打印名字 name，再依次打印 a 的四个属性——元素类型、形状、维数、元素个数；全都是属性，不加括号调用 || 四个属性名依次是 dtype、shape、ndim、size，都写成 a.属性名，用逗号隔开交给同一个 print" hintEn="One print line: the name first, then four attributes of a in this order - element type, shape, number of dimensions, number of elements; they are all attributes, so no brackets to call them || The four attribute names, in order, are dtype, shape, ndim and size, each written as a.name and separated by commas inside the one print"
    print(name, a.dtype, a.shape, a.ndim, a.size)
# <<< BLANK


if __name__ == "__main__":
    marks = np.array([12, 15, 9, 20])
    describe("marks", marks)
    print(marks)

    mixed = np.array([1, 2, 3.5])
    describe("mixed", mixed)
    print(mixed)

    grid = np.array([[1, 2, 3], [4, 5, 6]])
    describe("grid", grid)
    print(grid)
    print(grid[1])

    print(np.arange(5))
    print(np.arange(2, 12, 3))
    print(np.linspace(0, 1, 5))

# >>> BLANK id=zeros level=2 hint="新建一个 2 行 3 列、全是 0 的数组，存进 blank：形状作为一个元组、写在圆括号里，按位置传（不写 shape=），也不另给 dtype || 函数是 np.zeros，所以括号里还套着一对括号" hintEn="Make a new array of zeros with 2 rows and 3 columns and keep it in blank: the shape is one tuple in round brackets, passed by position (no shape=), and no dtype is given || The function is np.zeros, so there is a pair of brackets inside the call's brackets"
    blank = np.zeros((2, 3))
# <<< BLANK
    describe("blank", blank)
    print(blank)
    print(np.ones(4, dtype=int))

    tenths = np.array([0.1, 0.2])
    total = tenths.sum()
    print(total == 0.3)
# >>> BLANK id=isclose level=2 hint="打印「total 与 0.3 是否足够接近」的判断结果：用 NumPy 的一个函数，total 写在前、0.3 写在后，不另外给容差 || 这个函数是 np.isclose，整行就是 print 包着它" hintEn="Print whether total and 0.3 are close enough: use a NumPy function with total first and 0.3 second, and no extra tolerance || The function is np.isclose, and the whole line is print wrapped around it"
    print(np.isclose(total, 0.3))
# <<< BLANK
