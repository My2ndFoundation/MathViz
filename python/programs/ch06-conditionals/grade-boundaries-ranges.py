"""Turn a mark out of 100 into a grade: every branch names its whole range."""


def grade(mark):
    if 80 <= mark <= 100:
        letter = "A"
# >>> BLANK id=b-range level=2 hint="用 elif 写一条链式比较，把 B 的整个区间写全：下界写在最左、用小于等于，mark 在中间，上界写在右边、用严格小于（不拆成两个比较再用 and 连） || B 从 70 起，到 80 为止但不含 80" hintEn="Use elif with one chained comparison that spells out the whole range for a B: the lower bound on the far left with less-than-or-equal, mark in the middle, the upper bound on the right with a strict less-than (not two comparisons joined by and) || A B starts at 70 and runs up to, but not including, 80"
    elif 70 <= mark < 80:
# <<< BLANK
        letter = "B"
    elif 60 <= mark < 70:
        letter = "C"
# >>> BLANK id=d-range level=2 hint="同样的链式比较：下界在最左、小于等于，mark 在中间，上界在右、严格小于 || D 从 50 起，到 60 为止但不含 60" hintEn="The same chained comparison: lower bound on the far left with less-than-or-equal, mark in the middle, upper bound on the right with a strict less-than || A D starts at 50 and runs up to, but not including, 60"
    elif 50 <= mark < 60:
# <<< BLANK
        letter = "D"
    else:
        letter = "U"
    return letter


if __name__ == "__main__":
    for mark in (100, 80, 79, 70, 69, 60, 59, 50, 49, 0):
        print(mark, grade(mark))
