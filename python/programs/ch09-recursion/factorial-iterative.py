"""Factorial with a loop: the same answers as the recursive version, with no calls piling up."""


def factorial(n):
# >>> BLANK id=start level=1 hint="累加器叫 result，从乘法的单位元开始——不是 0：乘进一个 0 之后什么都救不回来" hintEn="The accumulator is called result and starts at the identity for multiplication - not 0: once a 0 has been multiplied in, nothing can bring the value back"
    result = 1
# <<< BLANK
# >>> BLANK id=loop level=2 hint="循环变量叫 k，用 range 的两参数形式从 2 数到 n（含 n）——乘 1 不改变结果，所以不从 1 开始；循环体一行，用 *= 把 k 乘进 result（不写 result = result * k） || range 不含终点，所以终点要写成比 n 多 1" hintEn="Call the loop variable k and use the two-argument form of range to count from 2 up to n inclusive - multiplying by 1 changes nothing, so do not start at 1; the body is one line that multiplies k into result with *= (not result = result * k) || range leaves out its stop value, so the stop has to be one more than n"
    for k in range(2, n + 1):
        result *= k
# <<< BLANK
    return result


if __name__ == "__main__":
    for n in range(6):
        print(n, factorial(n))
    print(factorial(20))
    print(len(str(factorial(1000))))
