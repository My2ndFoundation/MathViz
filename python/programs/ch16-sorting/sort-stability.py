"""Insertion sort keeps equal scores in their original order; selection sort can swap them."""


def insertion_sort_by_score(records):
    for i in range(1, len(records)):
        key = records[i]
        j = i - 1
# >>> BLANK id=scan level=2 hint="与插入排序同一个 while：下标检查在前、用 and 连接；只比两条记录的成绩，也就是各自下标 0 的那一项，records[j] 那一边写在比较号左边，用严格的大于号 || 相等的成绩不满足严格大于，记录就停在原来那条的后面——稳定性就来自这个符号" hintEn="The same while as in insertion sort: the index check first, joined with and; compare only the two records' scores - item 0 of each - with the records[j] side on the left and a strict greater-than || An equal score fails a strict greater-than, so the record stops behind the one that was already there - stability comes from this operator"
        while j >= 0 and records[j][0] > key[0]:
# <<< BLANK
            records[j + 1] = records[j]
            j -= 1
        records[j + 1] = key


def selection_sort_by_score(records):
    n = len(records)
    for i in range(n - 1):
        smallest = i
        for j in range(i + 1, n):
            if records[j][0] < records[smallest][0]:
                smallest = j
        records[i], records[smallest] = records[smallest], records[i]


def is_stable(original, result):
    for score, _ in original:
        before = [r for r in original if r[0] == score]
# >>> BLANK id=after level=2 hint="与上面一行同一个样子的列表推导式，存进 after，只把被扫的表换成 result || 两张表里成绩为 score 的那几条，按各自出现的先后排成列表；稳定就是这两张列表一模一样" hintEn="A list comprehension shaped like the line above, stored in after, with only the list being scanned changed to result || The records with this score, listed in the order each list has them; stable means the two lists are identical"
        after = [r for r in result if r[0] == score]
# <<< BLANK
        if before != after:
            return False
    return True


if __name__ == "__main__":
    marks = [(3, "Ann"), (3, "Ben"), (1, "Cat"), (2, "Dan"), (2, "Eve")]
    by_insertion = list(marks)
    insertion_sort_by_score(by_insertion)
    print(by_insertion)
    print(is_stable(marks, by_insertion))
    by_selection = list(marks)
    selection_sort_by_score(by_selection)
    print(by_selection)
    print(is_stable(marks, by_selection))
