"""Keep only the even numbers with a comprehension that has an if."""


def keep_evens(numbers):
# >>> BLANK id=filter-if level=2 hint="一行 return 一个列表推导式，循环变量叫 n，每一项就是 n 本身；判断偶数用取余：n 除以 2 的余数等于 0（取余写在 == 左边，不用 not，条件外面不加括号） || 筛选条件写在 for 之后、方括号之内，以 if 开头" hintEn="One line: return a list comprehension whose loop variable is n and whose items are n itself; test for even with the remainder: n modulo 2 equals 0 (the % on the left of ==, no not, and no brackets round the condition) || The condition that drops items goes after the for, still inside the brackets, and starts with if"
    return [n for n in numbers if n % 2 == 0]
# <<< BLANK


if __name__ == "__main__":
    print(keep_evens([3, 8, 5, 12, 7, 0, -4]))
    print(keep_evens([1, 3, 5]))
    print(keep_evens(range(10)))
