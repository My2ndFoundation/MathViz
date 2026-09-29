"""Binary search written recursively: the range still in play is passed down as two arguments."""


def binary_search(items, target, lo=0, hi=None):
    if hi is None:
        hi = len(items) - 1
# >>> BLANK id=empty-range level=2 hint="基例：区间已经空了。lo 写在比较号左边，用严格的大于号 || 闭区间里 lo 等于 hi 时还剩一个元素，只有 lo 跑到 hi 右边才真的空了" hintEn="The base case: the range is empty. lo on the left of the comparison, with a strict greater-than || In a closed range there is still one item when lo equals hi; it is only empty once lo has passed hi"
    if lo > hi:
# <<< BLANK
        return -1
    mid = (lo + hi) // 2
    if items[mid] == target:
        return mid
    if items[mid] < target:
# >>> BLANK id=search-right level=2 hint="把右半边交给同一个函数去找，并把它的结果原样交回去：return 后面是一次调用，四个实参按形参的顺序、都按位置写（不写关键字） || 右半边从 mid 的下一格开始，右端还是原来的 hi" hintEn="Hand the right half to the same function and pass its answer straight back: return followed by one call, with the four arguments given by position in the order of the parameters (no keywords) || The right half starts at the place just after mid, and its right end is still the old hi"
        return binary_search(items, target, mid + 1, hi)
# <<< BLANK
# >>> BLANK id=search-left level=2 hint="剩下的情况只能在左半边：同样 return 一次调用，四个实参按形参的顺序、都按位置写（不写关键字） || 左端还是原来的 lo，右端是 mid 的前一格" hintEn="Otherwise it can only be in the left half: again return one call, with the four arguments given by position in the order of the parameters (no keywords) || The left end is still the old lo, and the right end is the place just before mid"
    return binary_search(items, target, lo, mid - 1)
# <<< BLANK


if __name__ == "__main__":
    ages = [3, 8, 12, 15, 21, 30, 34, 41, 50, 67]
    print(binary_search(ages, 41))
    print(binary_search(ages, 3))
    print(binary_search(ages, 67))
    print(binary_search(ages, 20))
    print(binary_search([], 20))
