"""Linear search in a sorted list: stop as soon as the items get bigger than the target."""


def sorted_linear_search(items, target):
    for i in range(len(items)):
# >>> BLANK id=match level=1 hint="这一格就是要找的吗？一个 if，按下标取出的那一项写在 == 左边" hintEn="Is this the item being looked for? An if, with the item taken by index on the left of =="
        if items[i] == target:
# <<< BLANK
            return i
# >>> BLANK id=passed-it level=2 hint="再用一个独立的 if（不用 elif）问：这一格是不是已经比 target 大了？下标取出的元素写在比较号左边，严格的大于号 || 列表从小到大排好了，后面只会更大，target 不可能再出现" hintEn="Ask with a separate if (not elif): is this item already bigger than target? The element taken by index on the left, with a strict greater-than || The list is sorted from small to large, so everything after it is bigger still and target cannot turn up any more"
        if items[i] > target:
# <<< BLANK
            return -1
    return -1


if __name__ == "__main__":
    primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
    print(sorted_linear_search(primes, 13))
    print(sorted_linear_search(primes, 12))
    print(sorted_linear_search(primes, 1))
    print(sorted_linear_search(primes, 31))
