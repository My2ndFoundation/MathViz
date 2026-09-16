"""Raise x to a whole-number power by recursion, one call for every step down to zero."""

calls = 0


def power(x, n):
    global calls
    calls += 1
# >>> BLANK id=base level=1 hint="基例：一个 if、下一行单独一个 return；n 恰好为 0 时（相等比较，n 在左边）交回任何数的零次方" hintEn="The base case: an if with its own return on the next line; when n is exactly 0 (an equality test, n on the left) hand back any number to the power zero"
    if n == 0:
        return 1
# <<< BLANK
# >>> BLANK id=step level=2 hint="一行 return：x 乘以 x 的少一次的幂；x 写在乘号左边、递归调用写在右边，调用里实参的顺序与 def 行相同 || n 每次只减 1，所以算 x 的 n 次方要调用 n + 1 次" hintEn="One return: x times x raised to one power fewer; x on the left of the multiplication and the recursive call on the right, with the arguments in the same order as the def line || n only goes down by 1 each time, so x to the power n takes n + 1 calls"
    return x * power(x, n - 1)
# <<< BLANK


if __name__ == "__main__":
    for x, n in ((2, 10), (3, 4), (5, 3), (2, 100)):
        calls = 0
        value = power(x, n)
        print(f"{x} ** {n} = {value} in {calls} calls")
