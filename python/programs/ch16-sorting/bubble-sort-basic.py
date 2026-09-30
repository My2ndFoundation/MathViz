"""Bubble sort: compare neighbours and swap them, so every pass carries the largest to the end."""


def bubble_sort(items):
    n = len(items)
    for _ in range(n - 1):
        for j in range(n - 1):
# >>> BLANK id=compare level=2 hint="一个 if：拿第 j 个和紧挨在它右边的那个比，items[j] 写在比较号左边，用严格的大于号 || 只有左边那个更大时两个才算站反了；相等的不动" hintEn="An if: compare item j with the one just to its right, with items[j] on the left of the comparison and a strict greater-than || Only when the left one is bigger are the two the wrong way round; equal neighbours stay put"
            if items[j] > items[j + 1]:
# <<< BLANK
# >>> BLANK id=swap level=2 hint="一行元组赋值完成交换，不用临时变量；等号左边先写 items[j]，再写 items[j + 1] || 右边把同样两项按相反的顺序写：两边都先求值，再一起赋回去，所以谁也不会被先覆盖掉" hintEn="Swap in one tuple assignment, with no temporary variable; on the left of = write items[j] first, then items[j + 1] || The right-hand side names the same two items in the opposite order: both sides are evaluated before anything is assigned, so neither value is overwritten first"
                items[j], items[j + 1] = items[j + 1], items[j]
# <<< BLANK


def sorted_copy(items):
# >>> BLANK id=copy level=2 hint="先做一份浅拷贝存进 result；用内置的 list() 构造，不用切片 [:]，也不用 .copy() || 之后只排这份拷贝，调用者交进来的那张表一动不动" hintEn="First make a shallow copy and store it in result; use the built-in list() constructor, not a [:] slice and not .copy() || Only the copy gets sorted afterwards, so the list the caller passed in is never touched"
    result = list(items)
# <<< BLANK
    bubble_sort(result)
    return result


if __name__ == "__main__":
    data = [5, 1, 4, 2, 8]
    print(sorted_copy(data))
    print(data)
    print(bubble_sort(data))
    print(data)
    print(sorted_copy(["pear", "fig", "apple", "kiwi"]))
    print(sorted_copy([]), sorted_copy([7]))
