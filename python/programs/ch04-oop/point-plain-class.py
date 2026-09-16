"""A 2D point written by hand: constructor, repr and equality."""


class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
# >>> BLANK id=repr-return level=2 hint="返回一个双引号的 f-string，不用 + 拼接；类名直接写出来；两个字段都用 !r 转换 || 输出要和打印出来的那一行一模一样：类名、圆括号，里面是 x=、y= 各带自己的值，逗号后跟一个空格" hintEn="Return one double-quoted f-string, not + concatenation; write the class name out; apply !r to both fields || The text must be exactly the line that gets printed: the class name and round brackets, holding x= and y= each with its value, a space after the comma"
        return f"Point(x={self.x!r}, y={self.y!r})"
# <<< BLANK

    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
# >>> BLANK id=compare-fields level=2 hint="一行 return：比较两个元组，不用 and 连两次比较；自己的元组写在 == 左边，两个元组都先 x 后 y || 左边的元组装的是 self 的两个坐标，右边的装的是 other 的；元组要带圆括号，否则逗号会把整行拆成别的意思" hintEn="A single return comparing two tuples, not two comparisons joined with and; your own tuple on the left of ==, and both tuples x first, then y || The left tuple holds self's two coordinates and the right one holds other's; the tuples need their round brackets, or the commas split the line into something else"
        return (self.x, self.y) == (other.x, other.y)
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
