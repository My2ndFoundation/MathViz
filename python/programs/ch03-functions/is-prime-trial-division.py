"""Test whether a number is prime by trying divisors up to its square root."""
import math


def is_prime(n):
    if n < 2:
        return False
    if n % 2 == 0:
# >>> BLANK id=even level=2 hint="走到这里 n 是偶数：偶数里只有一个是素数。直接 return 一个比较的结果（n 写在比较号左边），不再写 if || 比较的是 n 是否等于那个唯一的偶素数" hintEn="Getting here means n is even, and only one even number is prime. Return the result of a comparison directly (n on the left of the comparison), with no further if || the comparison asks whether n equals that one even prime"
        return n == 2
# <<< BLANK
# >>> BLANK id=odd-divisors level=3 hint="只试奇数除数，从 3 开始、试到 n 的整数平方根为止（含它）；循环变量叫 divisor；整数平方根用 math.isqrt（不用 ** 0.5 或 math.sqrt），「加 1」写在它后面 || 用 range 的三参数形式：起点、终点、步长；终点要比平方根多 1，因为 range 不含终点 || 步长让除数每次跳过一个偶数——偶数 n 上面已经处理完了" hintEn="Try odd divisors only, starting at 3 and going up to the integer square root of n inclusive; call the loop variable divisor; the integer square root is math.isqrt (not ** 0.5 or math.sqrt), with the plus one written after it || use the three-argument form of range: start, stop, step; the stop is one more than the square root, since range leaves the stop out || the step makes the divisor skip every even number - even n were dealt with above"
    for divisor in range(3, math.isqrt(n) + 1, 2):
# <<< BLANK
        if n % divisor == 0:
            return False
    return True


if __name__ == "__main__":
    primes = []
    for n in range(30):
        if is_prime(n):
            primes.append(n)
    print(primes)
    print(is_prime(97), is_prime(91), is_prime(-7))
    print(math.isqrt(97), math.isqrt(100))
