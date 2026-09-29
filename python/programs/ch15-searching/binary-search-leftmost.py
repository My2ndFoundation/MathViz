"""Binary search for the FIRST place a value appears, even when the sorted list has repeats."""


def first_index(items, target):
    lo = 0
# >>> BLANK id=half-open level=2 hint="这次的区间是半开的：hi 指的是区间右边第一个不在区间里的位置——不减 1 || 一开始整张表都在区间里，所以 hi 就是列表的长度" hintEn="This time the range is half-open: hi is the first place just past the range - no minus 1 || At the start the whole list is in the range, so hi is simply the length of the list"
    hi = len(items)
# <<< BLANK
# >>> BLANK id=until-met level=2 hint="一个 while：lo 写在比较号左边；半开区间里 lo 等于 hi 就已经空了 || 所以用严格的小于号" hintEn="A while with lo on the left of the comparison; in a half-open range the range is already empty when lo equals hi || So use a strict less-than"
    while lo < hi:
# <<< BLANK
        mid = (lo + hi) // 2
        if items[mid] < target:
            lo = mid + 1
        else:
# >>> BLANK id=keep-left level=2 hint="items[mid] 大于或等于 target：第一次出现只可能在 mid 或它左边，于是收拢右端 hi || 命中了也不停：mid 可能就是答案，所以不能把它丢出区间——不减 1（半开区间的右端本来就不在区间里）" hintEn="items[mid] is at least target: the first appearance can only be at mid or to its left, so pull in the right end hi || Do not stop on a match: mid might be the answer, so it must not be thrown out of the range - no minus 1 (the right end of a half-open range is outside it anyway)"
            hi = mid
# <<< BLANK
    if lo < len(items) and items[lo] == target:
        return lo
    return -1


if __name__ == "__main__":
    marks = [40, 55, 55, 55, 55, 62, 70, 70, 88]
    print(first_index(marks, 55))
    print(first_index(marks, 70))
    print(first_index(marks, 40))
    print(first_index(marks, 60))
    print(first_index(marks, 99))
