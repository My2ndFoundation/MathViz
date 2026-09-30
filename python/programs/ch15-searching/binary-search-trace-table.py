"""Print the trace table of a binary search: lo, mid, hi and the comparison made at every step."""


def trace_binary_search(items, target):
    print(f"target {target}")
    print(" lo mid  hi  items[mid]  result")
    lo = 0
    hi = len(items) - 1
# >>> BLANK id=range-left level=2 hint="一个 while：区间里还剩元素就继续；lo 写在比较号左边 || 区间是闭的，lo 等于 hi 时还剩一个元素要看，所以用带等号的比较" hintEn="A while that goes on as long as the range still holds something, with lo on the left of the comparison || The range is closed: when lo equals hi there is still one item to check, so the comparison includes equality"
    while lo <= hi:
# <<< BLANK
        mid = (lo + hi) // 2
        value = items[mid]
        if value == target:
            print(f"{lo:>3} {mid:>3} {hi:>3} {value:>11}  found")
            return mid
        if value < target:
            print(f"{lo:>3} {mid:>3} {hi:>3} {value:>11}  too small")
# >>> BLANK id=move-lo level=1 hint="太小了，要往右找：改 lo，新值从 mid 算起，mid 写在运算符左边" hintEn="Too small, so look to the right: change lo, working the new value out from mid, with mid on the left of the operator"
            lo = mid + 1
# <<< BLANK
        else:
            print(f"{lo:>3} {mid:>3} {hi:>3} {value:>11}  too big")
# >>> BLANK id=move-hi level=1 hint="太大了，要往左找：改 hi，新值从 mid 算起，mid 写在运算符左边" hintEn="Too big, so look to the left: change hi, working the new value out from mid, with mid on the left of the operator"
            hi = mid - 1
# <<< BLANK
    print(f"{lo:>3}   - {hi:>3}           -  not found")
    return -1


if __name__ == "__main__":
    ages = [3, 8, 12, 15, 21, 30, 34, 41, 50, 67]
    trace_binary_search(ages, 41)
    print()
    trace_binary_search(ages, 20)
