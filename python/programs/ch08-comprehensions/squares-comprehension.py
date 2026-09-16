"""Build the same list of squares with a list comprehension."""


def squares(numbers):
# >>> BLANK id=comprehension level=2 hint="一行 return 一个列表推导式，不先存进变量；每一项写成 n 乘 n（用 *，不用 ** 2），循环变量叫 n || 方括号里先写每一项长什么样，再写 for 从 numbers 里逐个取" hintEn="One line: return a list comprehension directly, without storing it in a variable first; write each item as n times n (with *, not ** 2), and call the loop variable n || Inside the square brackets, first say what each item looks like, then write the for that takes them one by one from numbers"
    return [n * n for n in numbers]
# <<< BLANK


if __name__ == "__main__":
    print(squares([1, 2, 3, 4, 5]))
    print(squares([-3, 0, 7]))
    print(squares(range(4)))
    print(squares([]))
