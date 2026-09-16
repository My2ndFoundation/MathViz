"""Teach +, *, == and abs() what to do with a 2D vector."""

import math


class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

    def __add__(self, other):
# >>> BLANK id=add-return level=2 hint="返回一个新的对象，不改 self 也不改 other；类名直接写 Vector；每个分量的和里 self 的写在加号左边 || 两个分量各自相加：第一个实参是 x 的和，第二个是 y 的和" hintEn="Return a brand-new object, changing neither self nor other; write the class name Vector out; in each sum, self's part goes on the left of the plus || Add the parts separately: the first argument is the sum of the x parts, the second the sum of the y parts"
        return Vector(self.x + other.x, self.y + other.y)
# <<< BLANK

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

# >>> BLANK id=abs-method level=2 hint="abs() 会去找的那个特殊方法，只收 self；返回长度时用 math 模块里现成的函数，不自己写平方和开方，分量先 x 后 y || 那个函数专门算直角三角形的斜边" hintEn="The special method that abs() looks for, taking only self; for the length, use a ready-made function from the math module rather than squaring and square-rooting by hand, passing x before y || That function is the one made for the hypotenuse of a right-angled triangle"
    def __abs__(self):
        return math.hypot(self.x, self.y)
# <<< BLANK


if __name__ == "__main__":
    u = Vector(3, 4)
    v = Vector(1, 2)
    print(u + v)
    print(u * 2)
    print(abs(u))
    print(u == Vector(3, 4), u == v)
    print(u + v * 2)
