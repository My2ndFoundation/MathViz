"""Linear search with a sentinel: put the target on the end of a copy, so the loop needs no end check."""


def sentinel_search(items, target):
    n = len(items)
    padded = list(items)
# >>> BLANK id=sentinel level=2 hint="把哨兵放到副本的最末尾：用列表自己的、一次加一个元素的那个方法（不用 + 或 +=） || 哨兵就是要找的那个值本身，所以循环一定会停下" hintEn="Put the sentinel on the very end of the copy, using the list's own method that adds one item (not + or +=) || The sentinel is the value being searched for, so the loop is certain to stop"
    padded.append(target)
# <<< BLANK
    i = 0
# >>> BLANK id=scan level=2 hint="一个 while：只要当前这一格还不是 target 就往下走；下标取出的元素写在比较号左边，用不等号（不用 not） || 条件里只有这一个比较——不用再问 i 有没有越界，哨兵保证了会停" hintEn="A while that keeps going as long as the current place is not target, with the element taken by index on the left of the comparison and the not-equal operator (not the word not) || The condition holds just this one comparison - no need to ask whether i has run off the end, the sentinel makes sure it stops"
    while padded[i] != target:
# <<< BLANK
        i += 1
# >>> BLANK id=real-hit level=2 hint="停下来的地方在原来那 n 个元素里面，才是真找到了：i 写在比较号左边、和 n 比（不再调 len），用严格的小于号（不用 !=） || 停在下标 n 上，说明撞上的是自己放的哨兵" hintEn="Only if it stopped inside the original n items was it a real find: i on the left of the comparison, compared with n (no second call to len), with a strict less-than (not !=) || Stopping at index n means it ran into the sentinel you put there yourself"
    if i < n:
# <<< BLANK
        return i
    return -1


if __name__ == "__main__":
    scores = [42, 17, 88, 17, 63]
    print(sentinel_search(scores, 88))
    print(sentinel_search(scores, 17))
    print(sentinel_search(scores, 50))
    print(sentinel_search([], 5))
    print(scores)
