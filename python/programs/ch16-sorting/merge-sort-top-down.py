"""Merge sort, top down: split in half, sort each half, then merge the two sorted halves."""


def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
# >>> BLANK id=take level=2 hint="一个 if：比两张表各自最前面还没取走的那一项，左表的写在比较号左边；两项相等时要取左表的 || 相等时取左边，原本排在前面的那一项就仍然在前——这就是归并排序稳定的原因" hintEn="An if: compare the front item not yet taken from each list, the left list's on the left of the comparison; when the two are equal, the left one must be taken || Taking the left one on a tie keeps whichever came first still first - that is what makes merge sort stable"
        if left[i] <= right[j]:
# <<< BLANK
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
# >>> BLANK id=rest level=2 hint="两行，先左后右，各用一次 extend 接上一个从当前下标切到末尾的切片 || 循环停下时，总有一张表已经取空；另一张剩下的那一段本来就有序、而且都不比已取的小，原样接上即可" hintEn="Two lines, left first and then right, each using extend with a slice from the current index to the end || When the loop stops one list is used up; what is left of the other is already sorted and no smaller than anything taken, so it goes on as it is"
    result.extend(left[i:])
    result.extend(right[j:])
# <<< BLANK
    return result


def merge_sort(items):
    if len(items) <= 1:
        return
    mid = len(items) // 2
    left = items[:mid]
    right = items[mid:]
    merge_sort(left)
    merge_sort(right)
# >>> BLANK id=back level=3 hint="一行，把 merge 的结果写回 items 原来那个列表对象；等号左边是 items 的整段切片，切片的两端都省略不写 || 写成 items = merge(...) 只是让局部变量换了个指向，调用者手里那张表一点没变 || 切片赋值 [:] 替换的是这个列表对象里面的全部内容" hintEn="One line that writes merge's result back into the very list object items; the left of = is a full slice of items, with both ends of the slice left out || Writing items = merge(...) only points the local name somewhere else, and the caller's list does not change at all || Slice assignment with [:] replaces everything inside this one list object"
    items[:] = merge(left, right)
# <<< BLANK


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
    print(merge([1, 4, 9], [2, 3, 10, 11]))
