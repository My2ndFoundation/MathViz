"""A function is a value: pass it in, hand it back, or write a small one with lambda."""


def double(n):
    return n * 2


def apply_twice(func, value):
# >>> BLANK id=call-twice level=2 hint="拿 func 调两次：第一次的结果直接当第二次的实参，一行交回，不存中间变量 || 所以是 func 套 func，最里面是 value" hintEn="Call func twice: the result of the first call goes straight in as the argument of the second, handed back in one line with no variable in between || so func wrapped around func, with value at the very inside"
    return func(func(value))
# <<< BLANK


def make_multiplier(factor):
    def multiply(n):
        return n * factor
# >>> BLANK id=hand-back level=1 hint="把刚定义好的内层函数本身交回去——是交回函数，不是调用它的结果" hintEn="Hand back the inner function you have just defined - the function itself, not the result of calling it"
    return multiply
# <<< BLANK


if __name__ == "__main__":
    print(double(4))
    print(apply_twice(double, 3))
    triple = make_multiplier(3)
    print(triple(5))
    print(apply_twice(triple, 2))
    print(apply_twice(lambda n: n - 1, 10))
    print(double.__name__, triple.__name__)
    print(callable(double), callable(double(4)))
