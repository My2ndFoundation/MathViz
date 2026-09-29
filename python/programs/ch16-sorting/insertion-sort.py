"""Insertion sort: hold one item aside, shift the bigger ones right, then drop it into the gap."""


def insertion_sort(items):
    for i in range(1, len(items)):
# >>> BLANK id=hold level=1 hint="在任何东西挪动之前，把第 i 项存进一个叫 key 的变量——下面的右移会把位置 i 盖掉" hintEn="Before anything moves, store item i in a variable called key - the shifting below will write over position i"
        key = items[i]
# <<< BLANK
        j = i - 1
# >>> BLANK id=scan level=3 hint="一个 while，两个条件用 and 连接：先写下标没有越过表头（j >= 0），再写 items[j] 严格大于 key，items[j] 写在比较号左边 || 先查下标：j 变成 -1 时 and 会短路，items[-1] 就不会被拿去比较 || 只有比 key 大的才右移；相等的留在原处，这正是插入排序稳定的原因" hintEn="A while with two conditions joined by and: first that the index has not run past the front (j >= 0), then that items[j] is strictly greater than key, with items[j] on the left of the comparison || Check the index first: when j reaches -1 the and short-circuits, so items[-1] is never compared || Only items bigger than key move right; an equal one stays where it is, which is exactly why insertion sort is stable"
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
