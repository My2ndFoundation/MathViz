"""Does any value appear twice? Remember everything seen so far in a set."""


def has_duplicates(items):
    seen = set()
    for item in items:
# >>> BLANK id=seen-before level=1 hint="这个值以前见过吗？一个 if，用 in 查它在不在 seen 里" hintEn="Has this value been seen before? An if that uses in to check whether it is in seen"
        if item in seen:
# <<< BLANK
            return True
# >>> BLANK id=remember level=1 hint="没见过：把它记进集合，用集合的 add 方法" hintEn="Not seen yet: remember it in the set, using the set's add method"
        seen.add(item)
# <<< BLANK
    return False


if __name__ == "__main__":
    print(has_duplicates([3, 1, 4, 1, 5]))
    print(has_duplicates([2, 7, 1, 8]))
    print(has_duplicates([]))
    print(has_duplicates(["cat", "dog", "cat"]))
