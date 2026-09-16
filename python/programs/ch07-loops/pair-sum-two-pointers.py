"""Do any two numbers in a sorted list add up to the target? Walk in from both ends."""


def has_pair_sum(numbers, target):
    left = 0
# >>> BLANK id=right-end level=1 hint="右指针从最后一个元素的下标出发：用列表长度减 1 算出来（不用负下标 -1），存进 right" hintEn="The right pointer starts at the index of the last element: work it out as the length of the list minus 1 (not the negative index -1), and store it in right"
    right = len(numbers) - 1
# <<< BLANK
# >>> BLANK id=pointers-apart level=2 hint="两个指针还没碰头就继续：一个 while，left 写在比较号左边 || 用严格的小于号——两个指针指到同一格时，那只是一个数，不能和它自己配成一对" hintEn="Keep going while the two pointers have not met: a while with left on the left of the comparison || Use a strict less-than - when both pointers are on the same place that is only one number, and it cannot be paired with itself"
    while left < right:
# <<< BLANK
        total = numbers[left] + numbers[right]
        if total == target:
            return True
# >>> BLANK id=move-left level=2 hint="和太小：接在上面那个 if 后面再问一句（elif），total 写在比较号左边、严格小于 target；下一行让 left 往右挪一格，用 += || 列表从小到大排好了，要让和变大，只能把左边那个数换成它右边更大的那个" hintEn="The sum is too small: carry on from the if above with elif, total on the left and strictly less than target; on the next line move left one place to the right with += || The list is sorted from small to large, so the only way to make the sum bigger is to swap the left number for the bigger one to its right"
        elif total < target:
            left += 1
# <<< BLANK
        else:
            right -= 1
    return False


if __name__ == "__main__":
    numbers = [1, 3, 4, 6, 9]
    for target in (10, 8, 11, 13):
        print(target, has_pair_sum(numbers, target))
