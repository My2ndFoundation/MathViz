"""Count how many times a value appears in a sorted list with two binary searches instead of one full scan."""
from bisect import bisect_left, bisect_right


def count_sorted(items, target):
# >>> BLANK id=first level=1 hint="左边界：第一个 target 所在（或该在）的下标，存进 first；实参先列表、后 target" hintEn="The left edge: the index where the first target is (or would be), stored in first; the list comes first, then target"
    first = bisect_left(items, target)
# <<< BLANK
# >>> BLANK id=past-last level=2 hint="右边界：最后一个 target 后面那一格的下标，存进 past_last；实参同样先列表、后 target || 用 bisect 的另一个函数——它遇到相等的元素时往右走" hintEn="The right edge: the index just after the last target, stored in past_last; again the list first, then target || Use the other bisect function - the one that moves to the right past equal items"
    past_last = bisect_right(items, target)
# <<< BLANK
# >>> BLANK id=difference level=1 hint="两个边界之间有几个位置，就出现了几次：大的减小的" hintEn="The number of places between the two edges is the number of times it appears: the bigger one minus the smaller one"
    return past_last - first
# <<< BLANK


if __name__ == "__main__":
    dice = [1, 1, 2, 3, 3, 3, 3, 5, 6, 6]
    for face in range(1, 7):
        print(face, bisect_left(dice, face), bisect_right(dice, face), count_sorted(dice, face))
