"""Bubble sort that stops after a pass with no swaps and compares one pair fewer each pass."""


def bubble_sort(items):
    n = len(items)
    for i in range(n - 1):
        swapped = False
# >>> BLANK id=shrink level=2 hint="内层 for 仍用 j 走 range，只写一个参数；上界是基础版的 n - 1 再减去已经走完的趟数 i，按 n - 1 - i 的顺序写 || 第 i 趟开始时，末尾 i 个位置已经放好了最大的 i 个数，不必再去比" hintEn="The inner for still walks j over a range with a single argument; the bound is the basic version's n - 1 minus the i passes already done, written in the order n - 1 - i || When pass i starts, the last i places already hold the i largest values, so there is nothing to compare there"
        for j in range(n - 1 - i):
# <<< BLANK
            if items[j] > items[j + 1]:
                items[j], items[j + 1] = items[j + 1], items[j]
                swapped = True
# >>> BLANK id=stop level=2 hint="一个 if，条件用 not 直接作用在标志上，不写 == False || 整趟一次交换都没发生，说明表已经有序，下一行的 break 就跳出外层循环" hintEn="An if whose condition applies not directly to the flag, not == False || A whole pass without a single swap means the list is already in order, and the break on the next line leaves the outer loop"
        if not swapped:
# <<< BLANK
            break


def sorted_copy(items):
    result = list(items)
    bubble_sort(result)
    return result


if __name__ == "__main__":
    print(sorted_copy([5, 1, 4, 2, 8]))
    print(sorted_copy([1, 2, 3, 4, 5]))
    print(sorted_copy([2, 1, 3, 4, 5]))
    print(sorted_copy([5, 4, 3, 2, 1]))
