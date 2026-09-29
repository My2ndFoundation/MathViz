"""Does any value appear twice? Compare every pair of positions."""


def has_duplicates(items):
    for i in range(len(items)):
# >>> BLANK id=later-only level=2 hint="第二个位置只从 i 之后找：一个 for，循环变量 j，用两个参数的 range，终点是 len(items) || 起点比 i 大一——不和自己比，每一对也只比一次" hintEn="The second position is only looked for after i: a for with loop variable j, using range with two arguments, ending at len(items) || The start is one more than i - an item is never compared with itself, and each pair is compared only once"
        for j in range(i + 1, len(items)):
# <<< BLANK
            if items[i] == items[j]:
                return True
# >>> BLANK id=none-equal level=1 hint="每一对都比过、没有一对相等，才能下结论；这一行与外层的 for 对齐，交回一个布尔值" hintEn="Only after every pair has been compared and none were equal can the answer be given; this line lines up with the outer for and hands back a Boolean"
    return False
# <<< BLANK


if __name__ == "__main__":
    print(has_duplicates([3, 1, 4, 1, 5]))
    print(has_duplicates([2, 7, 1, 8]))
    print(has_duplicates([]))
    print(has_duplicates(["cat", "dog", "cat"]))
