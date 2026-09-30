"""Quicksort in place: partition around the last item, then sort the two sides."""


def partition(items, low, high):
    pivot = items[high]
    i = low
    for j in range(low, high):
        if items[j] <= pivot:
            items[i], items[j] = items[j], items[i]
            i += 1
# >>> BLANK id=pivot level=3 hint="一行元组赋值完成交换；等号左边先写 items[i]，再写 items[high] || 循环结束时，low 到 i - 1 都不比枢轴大，i 到 high - 1 都比它大 || 把一直待在末尾 high 处的枢轴换到位置 i，它就站到了最终的位置上" hintEn="Swap in one tuple assignment; on the left of = write items[i] first, then items[high] || When the loop ends, low to i - 1 are all no bigger than the pivot and i to high - 1 are all bigger || Swap the pivot, which has sat at the end in position high all along, into position i, and it is standing in its final place"
    items[i], items[high] = items[high], items[i]
# <<< BLANK
    return i


def quicksort(items, low, high):
    if low < high:
        p = partition(items, low, high)
# >>> BLANK id=recurse level=2 hint="两行，各调用一次 quicksort，先排左边再排右边；两次调用都跳过位置 p 本身 || 枢轴已经在位置 p 上站定，只剩它左边 low 到 p - 1、右边 p + 1 到 high 两段要排" hintEn="Two lines, each a call to quicksort, the left side first and then the right; neither call includes position p itself || The pivot is already fixed at p, leaving only low to p - 1 on its left and p + 1 to high on its right"
        quicksort(items, low, p - 1)
        quicksort(items, p + 1, high)
# <<< BLANK


def sorted_copy(items):
    result = list(items)
    quicksort(result, 0, len(result) - 1)
    return result


if __name__ == "__main__":
    data = [10, 80, 30, 90, 40, 50, 70]
    print(sorted_copy(data))
    print(data)
    quicksort(data, 0, len(data) - 1)
    print(data)
    print(sorted_copy([3, 3, 1, 3, 2]))
    print(sorted_copy([1, 2, 3, 4, 5, 6]))
