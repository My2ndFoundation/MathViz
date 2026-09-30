"""Count values into equal-width bins, then let ax.hist count and draw the same bins."""
import os

import numpy as np
import matplotlib.pyplot as plt


def histogram_counts(values, bins, lo, hi):
    """How many values fall in each of bins equal bins from lo to hi (values outside are ignored)."""
# >>> BLANK id=np-histogram level=3 hint="让 numpy 分箱计数，交回的两样东西拆包进 counts 和 edges（左边不加括号）：第一个实参是 values，箱数与范围都用关键字实参给、先箱数后范围，范围写成一个元组 || 箱数的关键字是 bins，范围的关键字是 range || 元组里下界在前、上界在后，都用本函数的形参名" hintEn="Let numpy do the binning and counting, unpacking the two things it hands back into counts and edges (no brackets on the left): values is the first argument, and the number of bins and the range both go in as keyword arguments, the number of bins first and the range second, the range written as a tuple || The keyword for the number of bins is bins, and the keyword for the range is range || In the tuple the lower end comes first and the upper end second, both using this function's parameter names"
    counts, edges = np.histogram(values, bins=bins, range=(lo, hi))
# <<< BLANK
# >>> BLANK id=to-list level=2 hint="counts 是一个 numpy 数组，里面装的是 numpy 的整数；交回去之前用数组自己的一个方法（不写推导式）把它变成装着 Python 整数的普通列表 || 不用内置的 list，那样元素仍是 numpy 整数；这个方法的名字说的就是「变成列表」，不带实参" hintEn="counts is a numpy array holding numpy integers; before handing it back, turn it into an ordinary list of Python integers with one of the array's own methods (no comprehension) || Not the built-in list, which would keep numpy integers inside; the method's name says turn to list, and it takes no arguments"
    return counts.tolist()
# <<< BLANK


if __name__ == "__main__":
    print(histogram_counts([0, 19, 20, 99, 100], 5, 0, 100))
    print(histogram_counts([-5, 0, 100, 105], 5, 0, 100))

    rng = np.random.default_rng(20260930)
    marks = rng.integers(0, 101, size=40).tolist() + [100]
    fig, ax = plt.subplots()
# >>> BLANK id=ax-hist level=3 hint="经过 ax 画直方图，它交回三样东西，按顺序拆包进 counts、edges、patches（左边不加括号）：第一个实参按位置给 marks，箱数与范围用关键字实参、先箱数后范围，范围写成元组 || ax 的方法名就是 hist；箱数的关键字是 bins，范围的关键字是 range || 箱数和范围与下面调用 histogram_counts 时给的一样：5 个箱，从 0 到 100（写成整数）" hintEn="Draw the histogram through ax; it hands back three things, unpacked in order into counts, edges and patches (no brackets on the left): marks is the first argument, given by position, then the number of bins and the range as keyword arguments, the number of bins first and the range second, the range written as a tuple || The method on ax is simply hist; the keyword for the number of bins is bins, and the keyword for the range is range || The bins and range match the histogram_counts call further down: 5 bins, from 0 to 100 (written as whole numbers)"
    counts, edges, patches = ax.hist(marks, bins=5, range=(0, 100))
# <<< BLANK
    ax.set_xlabel("Mark")
    ax.set_ylabel("Pupils")
    fig.savefig("marks.png")

    print("edges:", edges.tolist())
    print("ax.hist counts:", counts.tolist())
    print("our counts:", histogram_counts(marks, 5, 0, 100))
    print("bars:", len(patches), "total:", int(counts.sum()), "of", len(marks))
    print("saved:", os.path.exists("marks.png"))
    plt.close(fig)
