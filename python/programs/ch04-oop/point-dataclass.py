"""The same point, with a dataclass writing the three methods for you."""

# >>> BLANK id=import-it level=1 hint="从标准库的 dataclasses 模块里只取出同名的那个装饰器，用 from ... import 的写法，这样下面能直接写它的名字" hintEn="Take just the decorator of the same name out of the standard library's dataclasses module, using the from ... import form so that its bare name works below"
from dataclasses import dataclass
# <<< BLANK


# >>> BLANK id=declare-fields level=2 hint="装饰器不带括号，类头不继承任何类；两个字段的类型都写 int，先 x 后 y，都不写默认值 || 一共四行：装饰器单独一行，然后类头，类体里每个字段一行，写成字段名、冒号、类型" hintEn="The decorator without brackets, the class header inheriting from nothing; both fields typed int, x before y, with no default values || Four lines in all: the decorator on a line of its own, then the class header, then one line per field in the body, written as the name, a colon and the type"
@dataclass
class Point:
    x: int
    y: int
# <<< BLANK


if __name__ == "__main__":
    a = Point(1, 2)
    b = Point(1, 2)
    c = Point(3, 4)
    print(a)
    print(a == b, a is b)
    print(a == c)
    print([a, c])
    print(a == (1, 2))
