"""Does a list contain a negative number? Keep a flag while you look."""


def has_negative(numbers):
# >>> BLANK id=flag-start level=1 hint="循环开始之前把标志立起来：一个叫 found 的布尔变量，表示「还没找到」——用布尔常量，不用 0" hintEn="Before the loop starts, set up the flag: a Boolean variable called found meaning not found yet - use the Boolean constant, not 0"
    found = False
# <<< BLANK
    for x in numbers:
        if x < 0:
# >>> BLANK id=flag-set level=2 hint="找到了：先把标志改过来，再立刻离开循环——两行，顺序不能反 || 第一行把 found 设成真的那个布尔常量；第二行一个关键字，剩下的元素不用再看" hintEn="Found one: first switch the flag, then leave the loop at once - two lines, and the order matters || The first line sets found to the true Boolean constant; the second is a single keyword, since the remaining elements need not be looked at"
            found = True
            break
# <<< BLANK
    return found


if __name__ == "__main__":
    for numbers in ([4, 0, 7], [4, -1, 7], []):
        print(numbers, has_negative(numbers))
