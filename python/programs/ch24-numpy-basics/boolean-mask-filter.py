"""Pick out values with a boolean mask instead of a loop."""
import numpy as np


def above_threshold(xs, t):
    """Return, in order, the values of the list xs that are greater than t."""
    a = np.array(xs, dtype=int)
# >>> BLANK id=mask level=2 hint="拿整个数组 a 和 t 比一次，得到一个布尔数组，存进 mask：a 写在比较号左边，用严格的大于号，不加括号 || 这一行里没有循环、没有函数调用——比较号直接作用在整个数组上" hintEn="Compare the whole array a with t in one go and keep the resulting boolean array in mask: a on the left of the comparison, a strict greater-than, no brackets || There is no loop and no function call on this line - the comparison works on the whole array at once"
    mask = a > t
# <<< BLANK
# >>> BLANK id=select level=2 hint="一行 return：用 mask 当下标从 a 里取出那些位置的值，再把结果数组转回普通列表 || 下标就是 mask 本身（写在 a 后面的方括号里），转回列表用 .tolist()" hintEn="One return line: use mask as the subscript to take those values out of a, then turn the result array back into a plain list || The subscript is mask itself (in square brackets after a), and turning it back into a list is .tolist()"
    return a[mask].tolist()
# <<< BLANK


def count_above(xs, t):
    """How many values of xs are greater than t, as a plain int."""
    return int(np.count_nonzero(np.array(xs) > t))


if __name__ == "__main__":
    temps = np.array([12, 18, 21, 15, 25, 18, 9])
    hot = temps > 18
    print(hot)
    print(hot.dtype)
    print(temps[hot])
    print(np.count_nonzero(hot))
    print(temps[(temps >= 12) & (temps <= 18)])
    print(np.where(hot, "hot", "ok"))
# >>> BLANK id=where level=3 hint="打印「封顶」之后的温度：用 np.where，三个实参依次是条件、条件为真时取的值、条件为假时取的值；条件直接写成「temps 大于 20」的比较，temps 在比较号左边，不加括号，也不借用 hot || 为真时取 20，为假时取 temps 自己 || 整行是 print 包着 np.where(...)，三个实参之间用逗号隔开" hintEn="Print the temperatures after capping: use np.where, whose three arguments are, in order, the condition, the value to take where it is true, and the value to take where it is false; write the condition straight in as the comparison temps greater than 20, with temps on the left, no brackets, and not borrowed from hot || Where true take 20, where false take temps itself || The whole line is print wrapped around np.where(...), with commas between the three arguments"
    print(np.where(temps > 20, 20, temps))
# <<< BLANK

    print(above_threshold([3, 7, 7, 1, 9], 7))
    print(above_threshold([3, 7, 7, 1, 9], 6))
    print(above_threshold([], 5))
    print(count_above([3, 7, 7, 1, 9], 1))
