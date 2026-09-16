"""Does a list contain a negative number? Let for...else remember for you."""


def has_negative(numbers):
    for x in numbers:
# >>> BLANK id=is-negative level=1 hint="问这个元素是不是负数：x 写在比较号左边，用严格的小于号跟 0 比——0 本身不是负数" hintEn="Ask whether this element is negative: x on the left of the comparison, with a strict less-than against 0 - 0 itself is not negative"
        if x < 0:
# <<< BLANK
            found = True
            break
# >>> BLANK id=no-break level=2 hint="只有循环自然走完、从没被 break 打断时才执行的那一支：这个关键字和 for 对齐，不和里面的 if 对齐 || 它下面缩进一层，把 found 设成假的那个布尔常量" hintEn="The branch that runs only when the loop finishes by itself and was never cut short by break: this keyword lines up with for, not with the if inside it || Indented one level below it, set found to the false Boolean constant"
    else:
        found = False
# <<< BLANK
    return found


if __name__ == "__main__":
    for numbers in ([4, 0, 7], [4, -1, 7], []):
        print(numbers, has_negative(numbers))
