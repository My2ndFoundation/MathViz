"""Counting sort: tally each small whole number, then write the values out in order."""


def counting_sort(items, max_value):
# >>> BLANK id=table level=2 hint="一张全是 0 的表，存进 counts：用乘法造（不用推导式），[0] 写在乘号左边 || 值从 0 到 max_value 都可能出现，每个值占一格，所以长度是 max_value + 1；乘号右边的长度要加括号" hintEn="A list of zeros stored in counts: made by multiplication (not a comprehension), with [0] on the left of the * || Every value from 0 to max_value can occur and each gets one slot, so the length is max_value + 1; the length on the right of the * needs brackets"
    counts = [0] * (max_value + 1)
# <<< BLANK
    for value in items:
        counts[value] += 1
    result = []
    for value, count in enumerate(counts):
# >>> BLANK id=expand level=3 hint="一行，调用 result 的 extend，不写内层循环；乘法里列表写在乘号左边 || 交给 extend 的是一张列表：只含 value 的单元素表乘上 count || count 是 0 时乘出来的是空表，什么也不加" hintEn="One line that calls extend on result, with no inner loop; in the multiplication the list goes on the left of the * || What extend is given is a list: the one-item list holding value, multiplied by count || When count is 0 the product is an empty list and nothing is added"
        result.extend([value] * count)
# <<< BLANK
    return result


if __name__ == "__main__":
    marks = [4, 1, 3, 4, 0, 2, 1, 4]
    print(counting_sort(marks, 4))
    print(marks)
    print(counting_sort([7, 0, 7, 3], 10))
    print(counting_sort([], 5))
