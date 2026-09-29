"""Quicksort with comprehensions: split into smaller, equal and larger, then join the sorted parts."""


def quicksort(items):
    if len(items) <= 1:
        return list(items)
    pivot = items[len(items) // 2]
    smaller = [x for x in items if x < pivot]
# >>> BLANK id=equal level=2 hint="与上面一行同一个样子的列表推导式，存进 equal；条件是与枢轴相等 || 枢轴可能不止出现一次；只放一个 pivot 进去，重复的那些就丢了" hintEn="A list comprehension shaped like the line above, stored in equal; the condition is being equal to the pivot || The pivot value may appear more than once; putting in a single pivot would lose the repeats"
    equal = [x for x in items if x == pivot]
# <<< BLANK
    larger = [x for x in items if x > pivot]
# >>> BLANK id=join level=3 hint="一行 return，用 + 把三段按从小到大的顺序接起来 || 只有两边那两段要再排；中间那段全是同一个值，已经有序 || 两边各递归调用一次 quicksort，中间那段原样放进去" hintEn="One return that joins three parts with + in order from smallest to largest || Only the two outer parts need sorting; the middle part holds one value only, so it is already in order || Call quicksort recursively on each outer part and put the middle part in unchanged"
    return quicksort(smaller) + equal + quicksort(larger)
# <<< BLANK


if __name__ == "__main__":
    data = [3, 6, 1, 8, 1, 9, 2, 6]
    print(quicksort(data))
    print(data)
    print(quicksort(["m", "c", "x", "a", "c"]))
    print(quicksort([]), quicksort([4]))
