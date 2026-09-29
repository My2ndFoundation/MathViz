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
# >>> BLANK id=crossing level=2 hint="跨中点的最好一段 = 左半从中点往左能拿到的最大和 + 右半从中点往右能拿到的最大和；两项都用 best_prefix 算，左边那一项在加号前面，存进 crossing。左半先倒过来再交给 best_prefix：用步长为 -1 的切片，不用 reversed()；右半不用倒 || 倒过来以后，左半的「前缀」正好是那些以中点左边那一格结尾的段——跨中点的段必须两边都至少拿一格" hintEn="The best run across the middle = the largest sum the left half gives reading leftwards from the middle + the largest sum the right half gives reading rightwards; work out both terms with best_prefix, left term before the plus sign, into crossing. Turn the left half round before handing it to best_prefix: a slice with step -1, not reversed(); the right half is not turned round || Once turned round, the prefixes of the left half are exactly the runs that end just left of the middle - and a run across the middle has to take at least one item from each side"
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
