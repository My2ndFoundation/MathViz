"""Find the largest of three numbers with explicit comparisons."""


def max_of_three(a, b, c):
    if a >= b and a >= c:
        largest = a
# >>> BLANK id=three-way level=2 hint="能走到这里，a 已经输了 || 只剩 b 和 c，一次比较就够、不必再提 a：照第一个判断的写法，b 在左、用 >=；其余情况交给不带条件的 else" hintEn="Getting past the first test already tells you a has lost || so only b and c are left, and one comparison settles it without naming a again: written like the first test, b on the left with >=, and everything else goes to an else with no condition"
    elif b >= c:
        largest = b
    else:
        largest = c
# <<< BLANK
    return largest


if __name__ == "__main__":
    print(max_of_three(3, 9, 5))
    print(max_of_three(9, 3, 5))
    print(max_of_three(3, 5, 9))
    print(max_of_three(7, 7, 7))
