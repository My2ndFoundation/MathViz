"""Does any value appear twice? Sort a copy, then equal values sit side by side."""


def has_duplicates(items):
# >>> BLANK id=sorted-copy level=2 hint="排的是一份新表，调用方的 items 原样不动：一行写完，用那个「交回一个新的排好序的列表」的内置函数，把 items 直接交给它（不必先套一层 list()），结果存进 ordered || 那个内置函数本来就另建新表、不碰原表；不要先复制再调 .sort()，也绝不对 items 本身调 .sort()" hintEn="Sort a new list and leave the caller's items exactly as they were: one line, using the built-in function that hands back a new sorted list, passing items to it directly (no extra list() around it), with the result in ordered || That built-in builds a new list anyway and never touches the original; do not copy first and then call .sort(), and never call .sort() on items itself"
    ordered = sorted(items)
# <<< BLANK
    for i in range(1, len(ordered)):
# >>> BLANK id=neighbours level=2 hint="排好序以后，相等的值一定挨在一起：拿第 i 个与它左边那个比，左边的写在 == 左边 || 左邻的下标是 i - 1" hintEn="Once sorted, equal values must be next to each other: compare item i with the one on its left, the left one written on the left of == || The left neighbour's index is i - 1"
        if ordered[i - 1] == ordered[i]:
# <<< BLANK
            return True
    return False


if __name__ == "__main__":
    print(has_duplicates([3, 1, 4, 1, 5]))
    print(has_duplicates([2, 7, 1, 8]))
    print(has_duplicates([]))
    print(has_duplicates(["cat", "dog", "cat"]))
