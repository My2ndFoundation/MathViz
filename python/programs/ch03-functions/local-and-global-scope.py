"""Where a name lives: a local that shadows a global, global, and UnboundLocalError."""

count = 0


def shadow():
# >>> BLANK id=local-copy level=1 hint="在函数里新建一个同名的局部变量 count，值是 99（输出第一行就是它）——只是普通赋值，不加任何声明" hintEn="Make a new local variable called count inside the function, holding 99 (it is the first line of the output) - a plain assignment with no declaration"
    count = 99
# <<< BLANK
    return count


def increment():
# >>> BLANK id=declare level=1 hint="声明：这个函数里的 count 指的是模块顶层那一个，不是新的局部变量" hintEn="Declare that count in this function means the one at the top of the module, not a new local variable"
    global count
# <<< BLANK
    count += 1


def broken():
    count += 1


if __name__ == "__main__":
    print(shadow())
    print(count)
    increment()
    increment()
    print(count)
    try:
        broken()
    except UnboundLocalError as error:
        print(type(error).__name__)
    print(count)
