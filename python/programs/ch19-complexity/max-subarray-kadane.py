"""Largest sum of a run of neighbours in one pass: the best run ending here, item by item."""


def max_subarray(values):
    best = current = values[0]
    for value in values[1:]:
# >>> BLANK id=extend-or-restart level=2 hint="以这一项结尾的最好一段，要么是这一项自己重新起头，要么接在上一段后面：一次 max 调用，存回 current || 实参顺序：先 value 自己，再 current + value" hintEn="The best run ending at this item either starts afresh with the item alone, or carries on from the run before: one call to max, stored back in current || Argument order: value alone first, then current + value"
        current = max(value, current + value)
# <<< BLANK
# >>> BLANK id=keep-best level=1 hint="到目前为止最好的一段：用 max 在 best 与 current 之间取大，存回 best，best 写在前" hintEn="The best run so far: use max to take the larger of best and current, stored back in best, with best written first"
        best = max(best, current)
# <<< BLANK
    return best


if __name__ == "__main__":
    print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))
    print(max_subarray([-8, -3, -6, -2, -5, -4]))
    print(max_subarray([5]))
    print(max_subarray([2, -1, 2, -1, 2]))
