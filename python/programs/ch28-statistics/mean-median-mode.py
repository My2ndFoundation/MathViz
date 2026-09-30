"""Three kinds of average: mean, median and mode."""
import statistics


def median(xs):
# >>> BLANK id=sort level=1 hint="排好序的新列表，起名 ordered：用内置函数 sorted 直接排 xs（不先复制 xs、不用列表的 sort 方法）" hintEn="A new sorted list called ordered: use the built-in function sorted directly on xs (no copy of xs first, not the list's sort method)"
    ordered = sorted(xs)
# <<< BLANK
    n = len(ordered)
    mid = n // 2
# >>> BLANK id=odd level=2 hint="一行 if：个数是奇数吗？写法先定下：用变量 n（不再调用 len），对 2 取余，再用 == 与 1 比较；不加多余的括号 || 奇数个时正中间只有一个数，下一行就把它交回去" hintEn="One if line: is the count odd? Fix the form first: use the variable n (no second call to len), take the remainder by 2, then compare with 1 using ==; no extra brackets || With an odd count there is exactly one middle value, and the next line hands it back"
    if n % 2 == 1:
# <<< BLANK
        return float(ordered[mid])
# >>> BLANK id=even level=2 hint="一行 return：偶数个时，中位数是正中间两个数的平均。写法先定下：一对括号里两个元素相加，下标 mid - 1 的在前、mid 的在后；括号外除以整数 2（不写 2.0，不用切片或 sum） || 偶数个时 mid = n // 2 指向中间靠右的那个数，紧挨在它左边的下标是 mid - 1" hintEn="One return line: with an even count, the median is the average of the two middle values. Fix the form first: inside one pair of brackets add the two elements, index mid - 1 first and index mid second; outside the brackets divide by the whole number 2 (not 2.0, no slice, no sum) || With an even count, mid = n // 2 points at the right-hand middle value, and the index just to its left is mid - 1"
    return (ordered[mid - 1] + ordered[mid]) / 2
# <<< BLANK


if __name__ == "__main__":
    marks = [7, 3, 9, 3, 5, 8, 3]
    print("marks:", marks)
    print("sorted:", sorted(marks))
    print("mean:", round(statistics.mean(marks), 2))
    print("median:", statistics.median(marks), median(marks))
    print("mode:", statistics.mode(marks))

    even = [4, 1, 6, 2]
    print("even count:", sorted(even))
    print("median:", statistics.median(even), median(even))

    shoes = [5, 6, 6, 7, 8, 8, 9]
    print("shoe sizes:", shoes)
    print("multimode:", statistics.multimode(shoes))
    print("mode:", statistics.mode(shoes))

    colours = ["red", "blue", "red", "green", "blue", "red"]
    print("favourite colour:", statistics.mode(colours))

    pay = [21, 23, 24, 25, 26, 250]
    print("pay:", pay)
    print("mean:", round(statistics.mean(pay), 2))
    print("median:", median(pay))
