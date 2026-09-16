"""Three ways to write an import, and what __name__ is set to when a file runs."""

import math
# >>> BLANK id=from-import level=1 hint="只把 math 里的平方根函数这一个名字拿进来，下面的 hypotenuse 可以直接叫它、不带 math. 前缀" hintEn="Bring in just the one name for the square-root function from math, so hypotenuse below can call it without the math. prefix"
from math import sqrt
# <<< BLANK
# >>> BLANK id=import-as level=1 hint="导入 statistics 模块，但在本文件里给它起一个短名字——就是下面代码里用的那个" hintEn="Import the statistics module, but give it a short name in this file - the one the code below uses"
import statistics as stats
# <<< BLANK


def hypotenuse(a, b):
    return sqrt(a * a + b * b)


def show_names():
    print("this file:", __name__)
    print("math module:", math.__name__)
    print("stats alias:", stats.__name__)


# >>> BLANK id=main-guard level=1 hint="只有这个文件被直接运行、而不是被别的文件 import 时，才执行下面这一块——字符串用双引号，比较号左边是那个特殊变量" hintEn="Run the block below only when this file is run directly, not when another file imports it - double quotes for the string, and the special variable on the left of the comparison"
if __name__ == "__main__":
# <<< BLANK
    print(hypotenuse(3, 4))
    print(math.floor(2.7), stats.mean([2, 4, 9]))
    print(sqrt is math.sqrt)
    show_names()
