"""Pick single characters and whole pieces out of a string by position."""


def first_and_last(word):
# >>> BLANK id=ends level=2 hint="交回一对值：第一个字符和最后一个字符，各用一个下标取（不用切片）；最后一个用负数下标去拿，不用 len()；两个值之间一个逗号，外面不加括号 || 第一个字符的下标是 0，最后一个字符从右往左数是 -1" hintEn="Hand back a pair: the first character and the last one, each taken with a single index (not a slice); reach the last one with a negative index, not with len(); one comma between the two values and no brackets around them || The first character is at index 0, and counting from the right the last one is -1"
    return word[0], word[-1]
# <<< BLANK


def middle(word):
# >>> BLANK id=middle level=2 hint="交回去掉头尾各一个字符之后剩下的那一段：一个切片，终点用负数写，不用 len() || 从下标 1 开始切，切到倒数第一个字符之前停下——终点本身不包含在内" hintEn="Hand back what is left once one character is cut off each end: a single slice, with the stop written as a negative number, not with len() || Start the slice at index 1 and stop just before the last character - the stop position itself is never included"
    return word[1:-1]
# <<< BLANK


def every_other(word):
# >>> BLANK id=step level=2 hint="从第一个字符起隔一个取一个：一个三段式切片，起点和终点都留空，只写步长 || 步长写在第二个冒号后面，意思是每一步往前跨几个位置——隔一个取一个，就是每步跨过去几个？" hintEn="Take every second character starting from the first: a three-part slice with both start and stop left empty, only the step written || The step goes after the second colon and says how many positions each move jumps forward - taking every other character means jumping how far each time?"
    return word[::2]
# <<< BLANK


if __name__ == "__main__":
    word = "Python"
    print(first_and_last(word))
    print(word[2], word[-2])
    print(word[0:2], word[2:], word[:-2])
    print(middle(word))
    print(every_other(word), word[1::2])
    print(repr(word[4:100]), repr(word[10:]))
    try:
        print(word[10])
    except IndexError as err:
        print("IndexError:", err)
