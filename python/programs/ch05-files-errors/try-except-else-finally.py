"""Print the order in which try, except, else and finally actually run."""


def divide(a, b):
    try:
        print(f"try: {a} / {b}")
        result = a / b
# >>> BLANK id=except-zero level=1 hint="只接住除以零这一种异常，别的照样往外抛；这一句不需要拿到异常对象，所以不写 as" hintEn="Catch only the division-by-zero exception and let anything else carry on outwards; this clause does not need the exception object, so leave out as"
    except ZeroDivisionError:
# <<< BLANK
        print("except: cannot divide by zero")
        result = None
# >>> BLANK id=else-clause level=2 hint="两行：先写一个子句行，这个子句只在 try 块一个异常都没抛时才执行；再在它下面缩进一层打印算出来的结果——print 只收一个双引号的 f-string，不用逗号把文字和值分开传 || 子句行只有子句名和冒号；打印的文字逐字是 else: result is 再加一个空格，后面紧跟放着 result 的花括号" hintEn="Two lines: first a clause line for the clause that runs only when the try block raised nothing at all; then, indented one level below it, print the result that was worked out - print takes one double-quoted f-string, not the text and the value passed separately with a comma || The clause line is just the clause name and a colon; the printed text is exactly else: result is followed by one space, then the braces holding result"
    else:
        print(f"else: result is {result}")
# <<< BLANK
# >>> BLANK id=finally-clause level=2 hint="两行：先写一个子句行，这个子句不管有没有异常、有没有被接住，最后都一定执行；再在它下面缩进一层打印一句收尾的话——print 只收一个双引号的普通字符串（不是 f-string） || 子句行只有子句名和冒号；打印的文字逐字是：finally: always runs" hintEn="Two lines: first a clause line for the clause that always runs last, whether or not anything was raised and whether or not it was caught; then, indented one level below it, print a closing message - print takes one plain double-quoted string (not an f-string) || The clause line is just the clause name and a colon; the printed text is exactly: finally: always runs"
    finally:
        print("finally: always runs")
# <<< BLANK
    print("after the try statement")
    return result


def leave_early():
    try:
        return "value from try"
    finally:
        print("finally: runs even on the way out of a return")


if __name__ == "__main__":
    print(divide(10, 4))
    print("---")
    print(divide(1, 0))
    print("---")
    print(leave_early())
