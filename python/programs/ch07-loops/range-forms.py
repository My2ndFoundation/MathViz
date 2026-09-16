"""The shapes of range(), and why a range is not a list."""


def show(r):
    print(r, "->", list(r), "len", len(r))


def countdown(n):
# >>> BLANK id=count-down level=1 hint="一个 for 循环，循环变量叫 i，从 n 一路数到 1：用三个参数的 range，第三个参数是一个负的步长（不用 reversed）" hintEn="A for loop with the loop variable i, counting from n all the way down to 1: use range with three arguments, the third one a negative step (not reversed)"
    for i in range(n, 0, -1):
# <<< BLANK
        print(i, end=" ")
    print("lift off")


def evens_below(n):
# >>> BLANK id=evens level=2 hint="直接交回一个 range 对象，不要把它变成列表、也不要再切片：三个参数全都写出来，起点 0 也写 || 它从 0 开始、每次跳 2、到 n 为止；顺序是起点、终点、步长，终点 n 自己不会被取到" hintEn="Hand back a range object as it is, without turning it into a list or slicing it: write all three arguments out, including the start of 0 || It starts at 0, jumps by 2 each time and runs up to n; the order is start, stop, step, and the stop value n itself is never reached"
    return range(0, n, 2)
# <<< BLANK


if __name__ == "__main__":
    show(range(5))
    show(range(2, 6))
    show(range(1, 10, 3))
    show(range(10, 0, -3))
    show(range(5, 0))
    countdown(3)
    evens = evens_below(1000000)
    print(evens, len(evens), evens[250], 999998 in evens)
