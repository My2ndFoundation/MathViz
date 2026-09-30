"""Summarise a marks table: one row per student, one column per subject."""
import numpy as np

NAMES = ["Ada", "Ben", "Cal", "Dee"]
SUBJECTS = ["Maths", "CS", "Physics"]


def top_per_column(marks):
    """For each column, the row number of its highest value (first one on a tie)."""
    a = np.array(marks)
# >>> BLANK id=argmax level=2 hint="一行 return：让 a 自己求「最大值所在的行号」，每一列得一个结果，再转回普通列表；用数组的方法，关键字实参写 axis || 方法名是 argmax；每一列一个结果是 axis=0；最后接 .tolist()" hintEn="One return line: let a find the row number of the largest value, one result per column, then turn it back into a plain list; use the array's method with the keyword argument axis || The method is argmax; one result per column is axis=0; finish with .tolist()"
    return a.argmax(axis=0).tolist()
# <<< BLANK


if __name__ == "__main__":
    marks = np.array([
        [72, 88, 65],
        [90, 75, 70],
        [68, 88, 91],
        [90, 60, 55],
    ])
    print(marks.shape)

# >>> BLANK id=averages level=2 hint="每个学生（每一行）一个平均分，存进 averages：用数组的方法，关键字实参 axis 选「每一行得一个结果」的那个轴 || 方法名是 mean；每一行一个结果是 axis=1" hintEn="One average per student (per row), kept in averages: use the array's method, with the keyword argument axis set to the axis that gives one result per row || The method is mean; one result per row is axis=1"
    averages = marks.mean(axis=1)
# <<< BLANK
    for name, avg in zip(NAMES, averages):
        print(f"{name}: {avg:.1f}")
    print(NAMES[averages.argmax()])

# >>> BLANK id=best level=2 hint="每一科（每一列）的最高分，存进 best：用数组的方法，关键字实参 axis 选「每一列得一个结果」的那个轴 || 方法名是 max，不是 argmax——这里要的是分数本身，不是行号" hintEn="The top mark in each subject (each column), kept in best: use the array's method, with the keyword argument axis set to the axis that gives one result per column || The method is max, not argmax - here we want the mark itself, not the row number"
    best = marks.max(axis=0)
# <<< BLANK
    print(best)

    winners = top_per_column(marks.tolist())
    print(winners)
    for col, subject in enumerate(SUBJECTS):
        row = winners[col]
        print(f"{subject}: {NAMES[row]} ({marks[row, col]})")

    print(top_per_column([[1, 3], [3, 3], [2, 0]]))
