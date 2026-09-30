"""Tabulate how log n, n, n log n, n squared and 2 to the n grow as n doubles."""


def show_big(value):
    text = str(value)
# >>> BLANK id=short-enough level=2 hint="数字够短就原样显示：一个 if，拿 len(text) 与 8 比较，len(text) 写在左边 || 用小于等于——正好 8 位的数还原样显示，9 位起才改成「有几位」" hintEn="Show the number as it is when it is short enough: an if comparing len(text) with 8, len(text) on the left || Use less-than-or-equal - a number with exactly 8 digits is still shown in full; from 9 digits on it becomes a digit count"
    if len(text) <= 8:
# <<< BLANK
        return text
    return f"{len(text)} digits"


def growth_row(n):
# >>> BLANK id=exact-log level=2 hint="n 是 2 的整数次幂，log2 n 不用 math 模块、只用整数算：借 n 自己的 bit_length 方法，结果存进 log_n || 2 的 k 次幂写成二进制是 1 后面跟 k 个 0，一共 k + 1 位——位数比 log2 n 多 1，要减掉" hintEn="n is a whole power of 2, so log2 n can be worked out in whole numbers without the math module: use n's own bit_length method and store the result in log_n || 2 to the power k in binary is a 1 followed by k zeros - k + 1 bits in all, one more than log2 n, so take 1 off"
    log_n = n.bit_length() - 1
# <<< BLANK
    return [n, log_n, n * log_n, n * n, show_big(2 ** n)]


if __name__ == "__main__":
    print(f"{'n':>5} {'log n':>6} {'n log n':>8} {'n^2':>8} {'2^n':>11}")
    for k in range(11):
        n, log_n, n_log_n, n_squared, two_power = growth_row(2 ** k)
        print(f"{n:>5} {log_n:>6} {n_log_n:>8} {n_squared:>8} {two_power:>11}")
