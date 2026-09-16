"""Raise x to a whole-number power by halving n, so the calls grow like log n."""

calls = 0


def power(x, n):
    global calls
    calls += 1
    if n == 0:
        return 1
# >>> BLANK id=half level=2 hint="只递归一次，算 x 的「一半次」幂，结果存进 half；一半用整数除法 //（不用 >> 1，也不用 int(n / 2)） || 奇数 n 除以 2 会丢掉 1，这一个 x 下面再单独补回来" hintEn="Recurse only once, working out x to half the power, and store it in half; halve with integer division // (not >> 1, and not int(n / 2)) || Halving an odd n drops a 1, and that single x is put back below"
    half = power(x, n // 2)
# <<< BLANK
# >>> BLANK id=square level=3 hint="三行：n 为偶数时（用 % 2 与 0 做相等比较，不写 if n % 2:）交回 half 自乘；否则不写 else，直接一行 return，比偶数情况多乘一个 x，x 写在最右边；两个 return 里的自乘都写成 half * half，不写 half ** 2 || 两个 return 都不再调用 power：half 已经是算好的一半次幂，再调用一次，折半省下的那些调用就又花回去了 || 偶数：x 的 n 次方 = 一半次幂的平方；奇数：平方之后还差一个 x" hintEn="Three lines: when n is even (compare % 2 with 0 for equality, not if n % 2:) return half times itself; otherwise, with no else, one return that multiplies in one more x than the even case, with x on the far right; in both returns write the squaring as half * half, not half ** 2 || Neither return calls power again: half already holds the half power, and one more call would spend again the calls that halving saved || Even: x to the n is the square of the half power; odd: after squaring there is still one x missing"
    if n % 2 == 0:
        return half * half
    return half * half * x
# <<< BLANK


if __name__ == "__main__":
    for x, n in ((2, 10), (3, 4), (5, 3), (2, 100)):
        calls = 0
        value = power(x, n)
        print(f"{x} ** {n} = {value} in {calls} calls")
