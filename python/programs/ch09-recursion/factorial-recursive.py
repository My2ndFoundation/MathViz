"""Factorial by recursion: a base case that stops, a step that shrinks the problem."""


def factorial(n):
# >>> BLANK id=base level=2 hint="基例写在最前面：一个 if、下一行单独一个 return（不写 else）；条件只接住最小的那个 n——零，用相等比较、n 写在比较号左边（不写 <= 1 或 < 1） || 零的阶乘按定义就是乘法的单位元：一个数都没乘，结果不能是 0" hintEn="The base case goes first: an if with its own return on the next line (no else); the condition catches only the smallest n - zero - using an equality test with n on the left of the comparison (not <= 1 or < 1) || By definition the factorial of zero is the identity for multiplication: nothing has been multiplied yet, so the result cannot be 0"
    if n == 0:
        return 1
# <<< BLANK
# >>> BLANK id=step level=2 hint="递归步只有一行 return：n 乘以比 n 小 1 的那个数的阶乘；n 写在乘号左边、递归调用写在右边，不先存进变量 || 每调用一次 n 就减 1，一步步走到上面的基例——少了减 1，就永远到不了" hintEn="The recursive step is a single return: n times the factorial of the number one less than n; n on the left of the multiplication and the recursive call on the right, nothing stored in a variable first || Each call takes 1 off n, stepping down towards the base case above - leave out the minus one and it never gets there"
    return n * factorial(n - 1)
# <<< BLANK


if __name__ == "__main__":
    for n in range(6):
        print(n, factorial(n))
    print(factorial(20))
    print(factorial(5) == 5 * factorial(4))
