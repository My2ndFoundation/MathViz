"""Define a function, call it, and see the difference between return and print."""


def rectangle_area(width, height):
# >>> BLANK id=give-back level=1 hint="把面积交回给调用方，而不是打印它：宽乘高，两个形参按参数表里的先后写，不加括号" hintEn="Hand the area back to the caller rather than printing it: width times height, the two parameters in the order the parameter list gives them, no brackets"
    return width * height
# <<< BLANK


def show_area(width, height):
# >>> BLANK id=only-show level=1 hint="这个函数只把面积显示在屏幕上、什么都不交回：同样是宽乘高、同样的先后，直接放进 print 的括号里" hintEn="This one only puts the area on the screen and hands nothing back: the same width times height in the same order, straight inside the brackets of print"
    print(width * height)
# <<< BLANK


if __name__ == "__main__":
    area = rectangle_area(3, 4)
    print(area)
    print(rectangle_area(3, 4) + 1)
    shown = show_area(3, 4)
    print(shown)
    print(show_area(5, 2))
