"""Number items with enumerate and walk two lists side by side with zip."""


def print_ranking(names):
# >>> BLANK id=enumerate-start level=2 hint="不用 range(len(names))：让内置的 enumerate 同时交出名次和名字，循环变量依次叫 position、name（不加括号）；名次从 1 数起，这个 1 用 start= 关键字实参写 || enumerate 每轮交出一个 (计数, 项) 二元组，for 后面用两个名字把它当场拆开" hintEn="No range(len(names)): let the built-in enumerate hand over the place and the name together, with loop variables position then name (no brackets round them); places count from 1, and that 1 is passed as the start= keyword argument || Each pass enumerate gives a (count, item) pair, and the two names after for unpack it on the spot"
    for position, name in enumerate(names, start=1):
# <<< BLANK
        print(f"{position}. {name}")


def print_pairs(names, scores):
# >>> BLANK id=zip-loop level=1 hint="用内置的 zip 并排走 names 与 scores（names 在前），zip 只接这两个实参；循环变量依次叫 name、score（不加括号），不用下标" hintEn="Use the built-in zip to walk names and scores side by side (names first, and no other arguments), with loop variables name then score (no brackets round them), and no indexes"
    for name, score in zip(names, scores):
# <<< BLANK
        print(f"{name}: {score}")


if __name__ == "__main__":
    names = ["Ada", "Brian", "Chen"]
    scores = [91, 64, 88]
    print_ranking(names)
    print_pairs(names, scores)
# >>> BLANK id=dict-zip level=1 hint="把两个列表配成字典存进 lookup：名字当键、分数当值；直接把 zip 的结果交给 dict()，不用推导式" hintEn="Pair the two lists up into a dictionary called lookup, names as keys and scores as values; hand the result of zip straight to dict(), no comprehension"
    lookup = dict(zip(names, scores))
# <<< BLANK
    print(lookup)
    print(lookup["Chen"])
    print(list(zip(names, [1, 2])))
