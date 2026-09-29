"""Linear search in a sorted list: stop as soon as the items get bigger than the target."""


def sorted_linear_search(items, target):
    for i in range(len(items)):
        if items[i] == target:
            return i
# >>> BLANK id=passed-it level=2 hint="再用一个独立的 if（不用 elif）问：这一格是不是已经比 target 大了？下标取出的元素写在比较号左边，严格的大于号 || 列表从小到大排好了，后面只会更大，target 不可能再出现" hintEn="Ask with a separate if (not elif): is this item already bigger than target? The element taken by index on the left, with a strict greater-than || The list is sorted from small to large, so everything after it is bigger still and target cannot turn up any more"
        if items[i] > target:
# <<< BLANK
# >>> BLANK id=give-up-early level=1 hint="不必再往下看了：当场交回「找不到」的那个值" hintEn="No need to look any further: hand back the not-found value right here"
            return -1
# <<< BLANK
    return -1


if __name__ == "__main__":
    primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
    print(sorted_linear_search(primes, 13))
    print(sorted_linear_search(primes, 12))
    print(sorted_linear_search(primes, 1))
    print(sorted_linear_search(primes, 31))
