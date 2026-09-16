"""Fibonacci with two variables rolling forward and no recursion at all."""


def fib(n):
# >>> BLANK id=start level=1 hint="一行同时给两个变量赋初值：a 是 fib(0)、b 是 fib(1)；a 写在前面，两边都不加括号" hintEn="Give both variables their starting values in one line: a is fib(0) and b is fib(1); a comes first, with no brackets on either side"
    a, b = 0, 1
# <<< BLANK
    for _ in range(n):
# >>> BLANK id=roll level=2 hint="一行同时赋值，左边先 a 后 b：新的 a 是旧的 b，新的 b 是旧的两个数之和，加法里 a 在左边 || 必须写在同一行：右边先整个算完再装回去；拆成两行的话，第二行读到的 a 已经被改掉了" hintEn="One simultaneous assignment with a then b on the left: the new a is the old b, and the new b is the sum of the old two, with a on the left of the plus || It has to be one line: the right-hand side is worked out completely before anything is stored; split it into two lines and the second one reads an a that has already changed"
        a, b = b, a + b
# <<< BLANK
    return a


if __name__ == "__main__":
    for n in (0, 1, 2, 10, 30):
        print(n, fib(n))
    print(fib(90))
    print(len(str(fib(1000))))
