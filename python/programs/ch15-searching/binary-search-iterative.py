"""Binary search on a sorted list: halve the range still in play until the target is found or the range is empty."""


def binary_search(items, target):
    lo = 0
# >>> BLANK id=last-index level=2 hint="区间是闭的：hi 从最后一个元素的下标出发（不用负下标 -1） || 最后一个下标用列表长度减 1 算出来" hintEn="The range is closed: hi starts at the index of the last element (not the negative index -1) || The last index is the length of the list minus 1"
    hi = len(items) - 1
# <<< BLANK
# >>> BLANK id=range-left level=2 hint="一个 while：区间里还剩元素就继续；lo 写在比较号左边 || 区间是闭的，lo 等于 hi 时还剩一个元素要看，所以用带等号的比较" hintEn="A while that goes on as long as the range still holds something, with lo on the left of the comparison || The range is closed: when lo equals hi there is still one item to check, so the comparison includes equality"
    while lo <= hi:
# <<< BLANK
        mid = (lo + hi) // 2
        if items[mid] == target:
            return mid
        elif items[mid] < target:
# >>> BLANK id=go-right level=2 hint="中间那个太小：target 只可能在它右边，所以改的是 lo；新值从 mid 算起，mid 写在运算符左边 || mid 本身已经比过了，不能再留在区间里——新的左端是它的下一格，否则区间可能永远缩不小" hintEn="The middle item is too small, so target can only be to its right, which means lo is what changes; the new value is worked out from mid, with mid on the left of the operator || mid itself has already been checked and must leave the range - the new left end is the place just after it, otherwise the range might never shrink"
            lo = mid + 1
# <<< BLANK
        else:
            hi = mid - 1
    return -1


if __name__ == "__main__":
    ages = [3, 8, 12, 15, 21, 30, 34, 41, 50, 67]
    print(binary_search(ages, 41))
    print(binary_search(ages, 3))
    print(binary_search(ages, 67))
    print(binary_search(ages, 20))
    print(binary_search([], 20))
