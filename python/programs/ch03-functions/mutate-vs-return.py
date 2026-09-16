"""The function gets the caller's list itself: change it in place, or build and return a new one."""


def add_bonus_in_place(marks, bonus):
    for i in range(len(marks)):
# >>> BLANK id=in-place level=1 hint="就地改第 i 个分数，把 bonus 加上去：下标赋值，用 += 写" hintEn="Change mark number i where it is by adding bonus: an assignment through the index, written with +="
        marks[i] += bonus
# <<< BLANK


def with_bonus(marks, bonus):
    result = []
    for mark in marks:
# >>> BLANK id=new-list level=1 hint="原列表一个字都不动：把「这个分数加 bonus」加到 result 末尾，用 append，分数写在加号左边" hintEn="Leave the original list untouched: put this mark plus bonus on the end of result with append, the mark on the left of the plus"
        result.append(mark + bonus)
# <<< BLANK
    return result


def replace_all(marks):
    marks = [0, 0, 0]


if __name__ == "__main__":
    original = [50, 60, 70]
    new_marks = with_bonus(original, 5)
    print(original)
    print(new_marks)
    returned = add_bonus_in_place(original, 5)
    print(original)
    print(returned)
    replace_all(original)
    print(original)
