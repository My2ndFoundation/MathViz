"""Rotate a list k places to the left by gluing two slices together."""


def rotate_left(items, k):
# >>> BLANK id=guard level=1 hint="空列表没法取余（下一步要除以长度），先挡住它：用 not 判断 items 是空的，不写 len(...) == 0" hintEn="An empty list cannot be taken modulo (the next step divides by its length), so stop it first: test that items is empty with not, rather than len(...) == 0"
    if not items:
# <<< BLANK
        return []
# >>> BLANK id=wrap-k level=2 hint="把 k 换成它除以列表长度的余数，这样旋转 7 位和旋转 2 位（5 项时）是一回事，负数也落回 0 到长度之间；用增强赋值 %=，不写 k = k % … || 右边是 items 的长度" hintEn="Replace k by its remainder after dividing by the length of the list, so that rotating by 7 is the same as rotating by 2 (for five items) and a negative k lands back between 0 and the length; use the augmented assignment %=, not k = k % ... || The right-hand side is the length of items"
    k %= len(items)
# <<< BLANK
# >>> BLANK id=glue level=2 hint="一行 return：从下标 k 起到末尾的那一段放前面，开头到 k 之前的那一段接在后面；两个切片用 + 连起来；前一段的切片只写起点，后一段只写终点 || 起点和终点都是 k——同一个下标，前一段从它开始，后一段在它之前停下" hintEn="One return line: the stretch from index k to the end goes first, and the stretch from the start up to just before k is joined on after it; connect the two slices with +; the first slice has only a start and the second only a stop || The start and the stop are both k - the same index, where the first stretch begins and just before which the second one stops"
    return items[k:] + items[:k]
# <<< BLANK


if __name__ == "__main__":
    days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    print(rotate_left(days, 2))
    print(rotate_left(days, 7))
    print(rotate_left(days, -1))
    print(rotate_left([], 3))
    print(days)
