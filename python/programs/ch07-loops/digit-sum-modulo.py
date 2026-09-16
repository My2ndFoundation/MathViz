"""Add up the digits of a whole number with % 10 and // 10."""


def digit_sum(n):
    total = 0
# >>> BLANK id=digits-left level=2 hint="还有数位没拆完就继续：一个 while，n 写在比较号左边，用严格的大于号跟 0 比（不写成只有 n 的真假判断） || 每转一圈 n 少一位，最后一位也拆掉之后 n 变成 0，循环就该停了" hintEn="Keep going while there are digits left to take off: a while with n on the left of the comparison, strictly greater than 0 (not a bare truth test on n) || Every pass removes one digit from n, and once the last one has gone n is 0 and the loop should stop"
    while n > 0:
# <<< BLANK
# >>> BLANK id=take-digit level=2 hint="两行：先把最右边那一位加进 total，再把这一位从 n 上去掉——顺序不能反；两行都用增强赋值（+= 与 //=） || 最右边那一位是 n 除以 10 的余数；去掉它就是 n 整除 10" hintEn="Two lines: first add the rightmost digit to total, then remove that digit from n - the order matters; write both with augmented assignment (+= and //=) || The rightmost digit is the remainder of n divided by 10; removing it is n floor-divided by 10"
        total += n % 10
        n //= 10
# <<< BLANK
    return total


if __name__ == "__main__":
    for n in (0, 7, 472, 9999, 1000001):
        print(n, digit_sum(n))
