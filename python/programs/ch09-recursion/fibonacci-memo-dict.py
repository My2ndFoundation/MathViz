"""Fibonacci with a dictionary that remembers every value already worked out."""

# >>> BLANK id=seed level=2 hint="字典叫 memo，一开始就把两个基例存进去：键是 n、值是 fib(n)，按 n 从小到大写，用花括号字面量（不用 dict()） || 两个基例是 fib(0) 等于 0、fib(1) 等于 1；有了这两项，fib 里就不用再单独写基例" hintEn="The dictionary is called memo and holds the two base cases from the start: keys are n, values are fib(n), smaller n first, written as a curly-brace literal (not dict()) || The base cases are fib(0) equals 0 and fib(1) equals 1; with those two entries in place, fib needs no base case of its own"
memo = {0: 0, 1: 1}
# <<< BLANK


def fib(n):
# >>> BLANK id=remember level=2 hint="两行：只有当 n 还不是 memo 里的键时才去算（用 not in，不用 get），算出来的值马上存进 memo[n]；存的那一行是两次递归调用相加，往回退一步的那次在左边 || 已经在 memo 里的 n 什么都不做，直接落到下面的 return" hintEn="Two lines: only work it out when n is not yet a key of memo (use not in, not get), and store the value straight into memo[n]; that line adds two recursive calls, with the call one step back on the left || An n that is already in memo does nothing here and falls straight through to the return below"
    if n not in memo:
        memo[n] = fib(n - 1) + fib(n - 2)
# <<< BLANK
    return memo[n]


if __name__ == "__main__":
    print(fib(10))
    print(len(memo))
    print(fib(90))
    print(len(memo))
    print(fib(50) == memo[50])
