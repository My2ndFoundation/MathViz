"""Shell sort: insertion sort over items gap apart, halving the gap until it reaches 1."""


def shell_sort(items):
    gap = len(items) // 2
    while gap > 0:
        for i in range(gap, len(items)):
            key = items[i]
            j = i - gap
            while j >= 0 and items[j] > key:
# >>> BLANK id=shift level=2 hint="两行，都和「插入排序」里的右移那两行一个样子，只是步长从 1 换成 gap；第二行用 -= 写 || 先把 items[j] 往后挪 gap 格，再让 j 往前退 gap 格" hintEn="Two lines, each shaped like the two shifting lines in Insertion Sort, with the step changed from 1 to gap; write the second one with -= || First move items[j] gap places later, then step j gap places back"
                items[j + gap] = items[j]
                j -= gap
# <<< BLANK
            items[j + gap] = key
# >>> BLANK id=halve level=2 hint="一行，用增量赋值 //=，不写 gap = gap // 2 || 间隔每轮减半；1 // 2 是 0，外层 while 就在做完间隔为 1 的那一轮之后停下" hintEn="One line using the augmented assignment //=, not gap = gap // 2 || The gap halves every round; 1 // 2 is 0, so the outer while stops right after the round with a gap of 1"
        gap //= 2
# <<< BLANK


def sorted_copy(items):
    result = list(items)
    shell_sort(result)
    return result


if __name__ == "__main__":
    data = [23, 12, 1, 8, 34, 54, 2, 3]
    print(sorted_copy(data))
    print(data)
    shell_sort(data)
    print(data)
    print(sorted_copy([9, 8, 7, 6, 5, 4, 3, 2, 1]))
