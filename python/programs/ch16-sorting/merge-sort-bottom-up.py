"""Merge sort, bottom up: merge runs of width 1, then 2, then 4, with no recursion."""


def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result


def merge_sort(items):
    width = 1
    while width < len(items):
        for start in range(0, len(items), 2 * width):
            left = items[start:start + width]
# >>> BLANK id=right level=2 hint="一个切片赋给 right：从左段结束的地方开始，再取 width 个；两个端点都以 start 开头、再加上用 width 表示的偏移，乘法写成 2 * width || 最后一对可能不满：切片越过表尾不会出错，只是拿到的更少，甚至是空表" hintEn="A slice assigned to right: it starts where the left run ends and takes width more; write each end as start first plus an offset in terms of width, with the product as 2 * width || The last pair may be short: a slice that runs past the end is not an error, it just gives fewer items, perhaps none"
            right = items[start + width:start + 2 * width]
# <<< BLANK
# >>> BLANK id=write level=2 hint="一行切片赋值：左边是 items 里这一对原来占的那一整段（与 right 同一个终点，写法也相同），右边是 merge 两段的结果 || 合并出来的长度正好等于这一段的长度，所以写回去不会让表变长或变短" hintEn="One slice assignment: on the left, the whole stretch of items this pair occupied (ending where right ends, written the same way); on the right, the result of merging the two runs || The merged list is exactly as long as that stretch, so writing it back never makes the list longer or shorter"
            items[start:start + 2 * width] = merge(left, right)
# <<< BLANK
        width *= 2


def sorted_copy(items):
    result = list(items)
    merge_sort(result)
    return result


if __name__ == "__main__":
    data = [38, 27, 43, 3, 9, 82, 10]
    print(sorted_copy(data))
    print(data)
    merge_sort(data)
    print(data)
    print(sorted_copy(["d", "a", "c", "b", "a"]))
