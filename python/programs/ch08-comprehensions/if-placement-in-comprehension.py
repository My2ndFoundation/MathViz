"""Where the if goes in a comprehension: change every item, or drop some."""


def clip_negatives(numbers):
# >>> BLANK id=if-else-front level=2 hint="一行 return 一个列表推导式，循环变量叫 n，结果和 numbers 一样长：n 不小于 0 时留下 n，否则换成 0；用条件表达式（不用 max，外面不加括号），条件写成 n >= 0 || 带 else 的条件表达式是「每一项长什么样」的一部分，所以写在 for 的前面" hintEn="One line: return a list comprehension with loop variable n whose result is as long as numbers: keep n when it is not below 0, otherwise put 0 in its place; use a conditional expression (not max, and no brackets round it), with the condition written as n >= 0 || A conditional expression with else is part of what each item looks like, so it goes before the for"
    return [n if n >= 0 else 0 for n in numbers]
# <<< BLANK


def drop_negatives(numbers):
# >>> BLANK id=if-back level=2 hint="一行 return 一个列表推导式，循环变量叫 n：只留下不小于 0 的 n，其余的整个去掉；条件写成 n >= 0，不加括号 || 筛掉项的 if 没有 else，写在 for 的后面" hintEn="One line: return a list comprehension with loop variable n that keeps only the n not below 0 and leaves the rest out entirely; write the condition as n >= 0, with no brackets || The if that drops items has no else and goes after the for"
    return [n for n in numbers if n >= 0]
# <<< BLANK


if __name__ == "__main__":
    readings = [4, -2, 7, 0, -9, 3]
    print(clip_negatives(readings))
    print(drop_negatives(readings))
    print(len(readings), len(clip_negatives(readings)), len(drop_negatives(readings)))
    print(["even" if n % 2 == 0 else "odd" for n in range(4)])
