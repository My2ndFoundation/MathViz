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
# >>> BLANK id=else-clause level=1 hint="接下来这一句只在 try 块一个异常都没抛时才执行——它是哪个子句？" hintEn="The clause that comes next runs only when the try block raised nothing at all - which clause is that?"
    else:
# <<< BLANK
        print(f"else: result is {result}")
# >>> BLANK id=finally-clause level=1 hint="接下来这一句不管有没有异常、有没有被接住，最后都一定执行——它是哪个子句？" hintEn="The clause that comes next always runs last, whether or not anything was raised and whether or not it was caught - which clause is that?"
    finally:
# <<< BLANK
        print("finally: always runs")
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
