"""Selection sort: find the position of the smallest remaining item, then swap it into place once."""


def selection_sort(items):
    n = len(items)
    for i in range(n - 1):
        smallest = i
        for j in range(i + 1, n):
# >>> BLANK id=better level=2 hint="一个 if：items[j] 写在比较号左边，与目前最小的那一项比，用严格的小于号 || 目前最小的那一项不是一个值，而是一个下标：要用 smallest 去表里取" hintEn="An if: items[j] on the left of the comparison, against the smallest item so far, with a strict less-than || The smallest so far is kept as a position, not a value: look it up in the list with smallest"
            if items[j] < items[smallest]:
# <<< BLANK
                smallest = j
# >>> BLANK id=swap level=2 hint="一行元组赋值完成交换；等号左边先写 items[i]，再写 items[smallest] || 这一行在内层循环之外：每趟只交换一次，把找到的最小项放到位置 i" hintEn="Swap in one tuple assignment; on the left of = write items[i] first, then items[smallest] || This line sits outside the inner loop: one swap per pass, putting the smallest item found into position i"
        items[i], items[smallest] = items[smallest], items[i]
# <<< BLANK


def sorted_copy(items):
    result = list(items)
    selection_sort(result)
    return result


if __name__ == "__main__":
    data = [29, 10, 14, 37, 13]
    print(sorted_copy(data))
    print(data)
    selection_sort(data)
    print(data)
    print(sorted_copy([3, -1, 3, 0, -1]))
