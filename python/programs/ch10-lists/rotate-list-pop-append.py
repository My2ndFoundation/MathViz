"""Rotate a list k places to the left one step at a time, working on a copy."""


def rotate_left(items, k):
# >>> BLANK id=copy level=2 hint="先给自己做一份副本叫 result，下面所有改动都落在副本上，调用者传进来的列表一点不动；用内置的 list()（不用切片，也不用 .copy()——三种都对，这里练 list()） || list() 收一个可以遍历的东西，造出一个新列表" hintEn="First make yourself a copy called result, so that every change below lands on the copy and the caller's list is not touched at all; use the built-in list() (not a slice and not .copy() - all three work, this line practises list()) || list() takes anything you can loop over and builds a new list from it"
    result = list(items)
# <<< BLANK
    if not result:
        return result
# >>> BLANK id=steps level=2 hint="循环的次数是 k 除以列表长度的余数，所以转一整圈的倍数都省掉；循环变量用不上，写成一个下划线；余数直接写在 range 的括号里，长度量的是 result || 量长度用 len" hintEn="The loop runs as many times as the remainder of k divided by the length of the list, so whole turns are skipped; the loop variable is never used, so it is a single underscore; the remainder is written straight inside the brackets of range, and the length measured is that of result || Measure the length with len"
    for _ in range(k % len(result)):
# <<< BLANK
# >>> BLANK id=step level=2 hint="转一步：把第一项从 result 里取出来，立刻接到 result 的末尾——一行，外层是 append，实参是取出第一项的那个调用 || 取出并删掉第一项：pop 带下标 0" hintEn="One step: take the first item out of result and immediately add it to the end of result - one line, with append on the outside and, as its argument, the call that takes out the first item || Taking out and removing the first item: pop with index 0"
        result.append(result.pop(0))
# <<< BLANK
    return result


if __name__ == "__main__":
    days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    print(rotate_left(days, 2))
    print(rotate_left(days, 7))
    print(rotate_left(days, -1))
    print(rotate_left([], 3))
    print(days)
