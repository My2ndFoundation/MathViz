"""Insertion sort: hold one item aside, shift the bigger ones right, then drop it into the gap."""


def insertion_sort(items):
    for i in range(1, len(items)):
# >>> BLANK id=hold level=1 hint="在任何东西挪动之前，把第 i 项存进一个叫 key 的变量——下面的右移会把位置 i 盖掉" hintEn="Before anything moves, store item i in a variable called key - the shifting below will write over position i"
        key = items[i]
# <<< BLANK
        j = i - 1
# >>> BLANK id=scan level=3 hint="一个 while，两个条件用 and 连接。写法上钉三处：下标那个条件写在前；它写成 >= 的比较（不写 > -1）；另一个条件里 items[j] 写在比较号左边 || 下标条件管的是 j 还没越过表头：j 退到 -1 时 and 会短路，items[-1] 就不会被拿去比较 || 另一个条件：items[j] 严格大于 key 才右移；相等的留在原处，这正是插入排序稳定的原因" hintEn="A while with two conditions joined by and. Three choices are fixed: the index condition comes first; it is written as a >= comparison (not > -1); in the other condition items[j] goes on the left of the comparison || The index condition says j has not run past the front: when j reaches -1 the and short-circuits, so items[-1] is never compared || The other condition: items[j] moves right only when strictly greater than key; an equal one stays where it is, which is exactly why insertion sort is stable"
        while j >= 0 and items[j] > key:
# <<< BLANK
            items[j + 1] = items[j]
            j -= 1
# >>> BLANK id=place level=2 hint="一行赋值，把 key 写回表里；下标用 j 表示，不写 i || 循环停下时 j 指着第一个不比 key 大的项（或者是 -1），空出来的位置在它右边一格" hintEn="One assignment that writes key back into the list; express the index with j, not i || When the loop stops, j points at the first item not bigger than key (or is -1), and the free slot is one to its right"
        items[j + 1] = key
# <<< BLANK


def sorted_copy(items):
    result = list(items)
    insertion_sort(result)
    return result


if __name__ == "__main__":
    data = [12, 11, 13, 5, 6]
    print(sorted_copy(data))
    print(data)
    insertion_sort(data)
    print(data)
    print(sorted_copy([4, 3, 2, 1]))
    print(sorted_copy([1, 2, 4, 3]))
