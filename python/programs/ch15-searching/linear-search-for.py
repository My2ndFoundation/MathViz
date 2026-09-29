"""Linear search: check each item in turn; give back its index, or -1 if it is not there."""


def linear_search(items, target):
# >>> BLANK id=each-index level=2 hint="一个 for 循环走遍每一个下标，循环变量叫 i：用 range 配 len()（不用 enumerate），range 只给一个参数 || 那个参数就是列表的长度——range 从 0 数起，到长度减 1 为止，正好是每一个下标" hintEn="A for loop over every index, with the loop variable i: use range with len() (not enumerate), giving range just one argument || That argument is the length of the list - range counts from 0 up to the length minus 1, which is exactly every index"
    for i in range(len(items)):
# <<< BLANK
# >>> BLANK id=match level=1 hint="用下标取出的元素写在比较号左边，和 target 比相等" hintEn="The element taken by index goes on the left of the comparison, tested for equality with target"
        if items[i] == target:
# <<< BLANK
            return i
# >>> BLANK id=not-found level=2 hint="走完整个列表都没找到，才能下「不在」的结论——这一行写在循环外面，和 for 对齐 || 找不到时交回去的是一个不可能是下标的数：负一" hintEn="Only after the whole list has been checked can you conclude the target is missing - this line goes outside the loop, lined up with the for || When it is not found, hand back a number that can never be an index: minus one"
    return -1
# <<< BLANK


if __name__ == "__main__":
    names = ["Ada", "Alan", "Grace", "Linus", "Grace"]
    print(linear_search(names, "Grace"))
    print(linear_search(names, "Guido"))
    print(linear_search(names, "Ada"))
    print(linear_search([], "Ada"))
