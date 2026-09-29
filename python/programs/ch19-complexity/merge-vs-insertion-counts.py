"""Count the comparisons insertion sort and merge sort make on the same input."""


def insertion_comparisons(values):
    items = list(values)
    count = 0
    for i in range(1, len(items)):
        key = items[i]
        j = i - 1
        while j >= 0:
            count += 1
            if items[j] <= key:
                break
            items[j + 1] = items[j]
            j -= 1
        items[j + 1] = key
    return count


def merge_sort_count(items):
    if len(items) <= 1:
        return list(items), 0
    mid = len(items) // 2
    left, left_count = merge_sort_count(items[:mid])
    right, right_count = merge_sort_count(items[mid:])
# >>> BLANK id=carry-counts level=2 hint="这一层的比较次数从两半已经数好的次数起算：把 left_count 与 right_count 加起来存进 count || 左半的在前、右半的在后，写成一个加法" hintEn="This level's comparisons start from what the two halves have already counted: add left_count and right_count into count || Left half first, right half second, as a single addition"
    count = left_count + right_count
# <<< BLANK
    merged = []
    i = j = 0
    while i < len(left) and j < len(right):
        count += 1
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    return merged + left[i:] + right[j:], count


if __name__ == "__main__":
    print("n insertion merge ratio")
    for n in (8, 32, 128, 512):
        scrambled = [(i * 7) % n for i in range(n)]
        slow = insertion_comparisons(scrambled)
# >>> BLANK id=take-count level=2 hint="merge_sort_count 交回两样东西：排好的表和比较次数；这里只要次数，用下标取出第二样，存进 fast || 下标从 0 数起，第二样的下标是 1；不用拆包" hintEn="merge_sort_count hands back two things: the sorted list and the comparison count; only the count is wanted here, so pick out the second thing by index into fast || Indexes count from 0, so the second thing is index 1; no unpacking"
        fast = merge_sort_count(scrambled)[1]
# <<< BLANK
        print(n, slow, fast, f"{slow / fast:.1f}")
