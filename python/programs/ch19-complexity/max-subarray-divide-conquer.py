"""Largest sum of a run of neighbours: split in half, and check the runs across the middle."""


def best_prefix(values):
    total = 0
    best = values[0]
    for value in values:
        total += value
        best = max(best, total)
    return best


def max_subarray(values):
    if len(values) == 1:
        return values[0]
    mid = len(values) // 2
    left, right = values[:mid], values[mid:]
# >>> BLANK id=crossing level=2 hint="跨中点的最好一段由两截拼成：左半里紧挨中点的一截、右半里紧挨中点的一截，各取最大和再相加，存进 crossing。写法上钉三处：两半就用上一行切好的 left 和 right（不再从 values 里切）；左半那一项写在加号前面；要把一张表倒过来时用步长为 -1 的切片，不用 reversed() || 两截都交给上面的 best_prefix 算——它只看从表头开始的段。右半从中点往右读，本来就从表头开始，直接交给它；左半要从中点往左读，先倒过来再交：倒过来以后，它的前缀正好是那些以中点左边那一格结尾的段" hintEn="The best run across the middle is made of two pieces: the piece of the left half next to the middle and the piece of the right half next to the middle; take the largest sum of each and add them, into crossing. Three choices are fixed: use the left and right already sliced on the line above (do not slice values again); the left half term goes before the plus sign; to turn a list round, use a slice with step -1, not reversed() || Both pieces are worked out by best_prefix above - it only looks at runs that start at the front. The right half, read rightwards from the middle, already starts at its front, so it goes in as it is; the left half has to be read leftwards from the middle, so turn it round first: once turned round, its prefixes are exactly the runs that end just left of the middle"
    crossing = best_prefix(left[::-1]) + best_prefix(right)
# <<< BLANK
# >>> BLANK id=three-way level=2 hint="答案在三个地方之一：全在左半、全在右半、跨过中点；一次 max 调用取三者最大，直接 return || 实参的顺序：先左半的递归结果，再右半的，最后 crossing" hintEn="The answer lies in one of three places: all in the left half, all in the right half, or across the middle; take the largest with one call to max and return it directly || Argument order: the left half's recursive result, then the right half's, then crossing"
    return max(max_subarray(left), max_subarray(right), crossing)
# <<< BLANK


if __name__ == "__main__":
    print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))
    print(max_subarray([-8, -3, -6, -2, -5, -4]))
    print(max_subarray([5]))
    print(max_subarray([2, -1, 2, -1, 2]))
