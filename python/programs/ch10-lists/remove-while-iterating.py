"""Removing items from a list while looping over it skips some of them."""


def drop_negatives_broken(numbers):
    for n in numbers:
        if n < 0:
            numbers.remove(n)
    return numbers


def drop_negatives_in_place(numbers):
# >>> BLANK id=loop-copy level=2 hint="和上面坏掉的那个函数只差这一行：for 走的是 numbers 的一份副本，删除却落在 numbers 本身上；副本用切片做，起点终点都留空（不用 list()、不用 .copy()） || 循环变量仍叫 n；副本就是 numbers 后面跟一个只有冒号的切片" hintEn="This is the only line that differs from the broken function above: the for goes through a copy of numbers while the removing happens on numbers itself; make the copy with a slice whose start and stop are both empty (not list() and not .copy()) || The loop variable is still n; the copy is numbers followed by a slice with nothing but a colon"
    for n in numbers[:]:
# <<< BLANK
        if n < 0:
            numbers.remove(n)


def drop_negatives(numbers):
    kept = []
    for n in numbers:
# >>> BLANK id=keep-test level=1 hint="留下不是负数的那些：n 写在比较号左边，用「大于等于」，0 也要留下" hintEn="Keep the ones that are not negative: n on the left of the comparison, using greater-than-or-equal, and 0 must be kept too"
        if n >= 0:
# <<< BLANK
# >>> BLANK id=keep level=1 hint="把 n 加到新列表 kept 的末尾，用列表的方法（不用 +=）；原列表 numbers 一点不动" hintEn="Add n to the end of the new list kept with a list method (not +=); the original list numbers is not touched at all"
            kept.append(n)
# <<< BLANK
    return kept


if __name__ == "__main__":
    data = [3, -1, -2, 4, -5, -6, 7]
    print(drop_negatives(data))
    print(data)
    print(drop_negatives_broken(data[:]))
    fixed = data[:]
    drop_negatives_in_place(fixed)
    print(fixed)
