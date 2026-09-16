"""Turn a mark out of 100 into a grade: an elif chain that tests from the top down."""


def grade(mark):
    if mark >= 80:
        letter = "A"
# >>> BLANK id=b-boundary level=2 hint="接着上一行往下判：用 elif（不另起一个 if）；只写下界，mark 写在比较号左边，用大于等于 || B 的下界是 70" hintEn="Carry on down from the line above: elif, not a fresh if; write only the lower bound, with mark on the left of the comparison and greater-than-or-equal || The lower bound for a B is 70"
    elif mark >= 70:
# <<< BLANK
        letter = "B"
    elif mark >= 60:
        letter = "C"
# >>> BLANK id=d-boundary level=2 hint="仍然是 elif、仍然只写下界：mark 写在比较号左边，用大于等于 || D 的下界是 50" hintEn="Still elif, still only the lower bound: mark on the left of the comparison, greater-than-or-equal || The lower bound for a D is 50"
    elif mark >= 50:
# <<< BLANK
        letter = "D"
    else:
        letter = "U"
    return letter


if __name__ == "__main__":
    for mark in (100, 80, 79, 70, 69, 60, 59, 50, 49, 0):
        print(mark, grade(mark))
