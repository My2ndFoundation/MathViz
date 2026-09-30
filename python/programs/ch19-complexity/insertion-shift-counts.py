"""Count the shifts insertion sort makes: one for every pair that is out of order."""


def count_shifts(values):
# >>> BLANK id=copy-first level=1 hint="先复制一份再排，调用方的列表一个元素都不动：用内置的 list() 复制（不用切片、不用 .copy()），存进 items" hintEn="Sort a copy so that not one item of the caller's list moves: copy it with the built-in list() (not a slice, not .copy()), into items"
    items = list(values)
# <<< BLANK
    shifts = 0
    for i in range(1, len(items)):
        key = items[i]
        j = i - 1
# >>> BLANK id=shift-test level=2 hint="还有左邻、而且左邻比 key 大，就继续右移：一个 while，两个条件用 and 连起来。写法上钉两处：下标那个条件写在前，写成 >= 的比较（不写 > -1）；另一个条件里 items[j] 写在比较号左边 || 下标条件管的是 j 还没越过表头；另一个条件用严格的大于号——相等的元素不挪，它们本来就不是逆序对" hintEn="Keep shifting while there is a left neighbour and it is bigger than key: a while with two conditions joined by and. Two choices are fixed: the index condition comes first, written as a >= comparison (not > -1); in the other condition items[j] goes on the left of the comparison || The index condition says j has not run past the front; the other one uses a strict greater-than - equal items stay put, since they are not an out-of-order pair"
        while j >= 0 and items[j] > key:
# <<< BLANK
            items[j + 1] = items[j]
# >>> BLANK id=count-shift level=1 hint="刚才那一行就是一次右移，把它记下来：计数器 shifts 加一，用复合赋值（+=）" hintEn="The line just above is one shift, so record it: add one to shifts with an augmented assignment (+=)"
            shifts += 1
# <<< BLANK
            j -= 1
        items[j + 1] = key
    return shifts


if __name__ == "__main__":
    print("n sorted scrambled reversed n(n-1)/2")
    for n in (10, 100, 1000):
        ascending = list(range(n))
        scrambled = [(i * 7) % n for i in range(n)]
        descending = list(range(n, 0, -1))
        print(n, count_shifts(ascending), count_shifts(scrambled), count_shifts(descending), n * (n - 1) // 2)
