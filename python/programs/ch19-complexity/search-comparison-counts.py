"""Count how many items linear and binary search look at before giving up."""


def linear_comparisons(items, target):
    count = 0
    for item in items:
        count += 1
        if item == target:
            return count
    return count


def binary_comparisons(items, target):
    count = 0
    lo, hi = 0, len(items) - 1
    while lo <= hi:
# >>> BLANK id=probe level=2 hint="两行，都与 while 体里其余各行对齐：先算中间位置 mid，写成 lo 与 hi 之和（lo 在前）再整除 2；再给计数器 count 加一，用 += || 看一眼 items[mid] 就是一次比较，所以这一次要在下面两个 if 之前记上——命中时也不会漏数" hintEn="Two lines, both lined up with the rest of the while body: first the middle position mid, written as the sum of lo and hi (lo first) floor-divided by 2; then add one to count with += || One look at items[mid] is one comparison, so it is counted before the two ifs below - that way a hit is not missed from the tally"
        mid = (lo + hi) // 2
        count += 1
# <<< BLANK
        if items[mid] == target:
            return count
        if items[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return count


def binary_worst_comparisons(n):
# >>> BLANK id=worst-case level=2 hint="一行，直接 return 调用 binary_comparisons 的结果：第一个实参是 0 到 n - 1 这 n 个数的有序表，用 list() 把 range(n) 变成真正的列表；第二个实参（目标）就写 n || 目标比表里每个数都大，所以每一次看中间都得往右收，一直收到区间为空——找不到里最费事的一种" hintEn="One line that returns the result of calling binary_comparisons directly: the first argument is the sorted list of the n numbers 0 to n - 1, turned into a real list by calling list() on range(n); the second argument (the target) is simply n || The target is bigger than every number in the list, so every look at the middle has to move right, until the range is empty - the costliest way of not finding something"
    return binary_comparisons(list(range(n)), n)
# <<< BLANK


if __name__ == "__main__":
    print("n linear binary")
    for n in (10, 100, 1000, 10000, 100000, 1000000):
        print(n, linear_comparisons(list(range(n)), n), binary_worst_comparisons(n))
    items = list(range(1000))
    print("found 700:", linear_comparisons(items, 700), binary_comparisons(items, 700))
