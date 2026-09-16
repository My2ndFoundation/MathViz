"""Find the largest of three numbers with explicit comparisons."""


def max_of_three(a, b, c):
    if a >= b and a >= c:
        largest = a
# >>> BLANK id=three-way level=2 hint="能走到这里，a 已经输了 || 只剩两个候选，一次比较就够，不必再提 a" hintEn="Getting past the first test already tells you a has lost || so only two candidates are left, and one comparison between them settles it without naming a again"
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
