"""Style a line (dashes, markers, colour), switch on a grid, and point an arrow at the highest value."""
import os

import matplotlib.pyplot as plt

HOURS = [8, 9, 10, 11, 12, 13, 14]
VISITORS = [5, 12, 20, 34, 29, 18, 22]
ARROW = {"arrowstyle": "->"}


def draw_visitors(path):
    fig, ax = plt.subplots()
    (line,) = ax.plot(HOURS, VISITORS, linestyle="--", marker="o", color="tab:red")
# >>> BLANK id=peak-index level=2 hint="找出人数最多的那一项在 VISITORS 里的下标，存进 best——先求最大值，再问这个值在列表里的位置 || 用列表的 index 方法，把内置 max 对同一个列表的结果当它的实参" hintEn="Find the position in VISITORS of the largest count and keep it in best - first get the largest value, then ask where that value sits in the list || Use the list's index method, with the built-in max of the same list as its argument"
    best = VISITORS.index(max(VISITORS))
# <<< BLANK
    x, y = HOURS[best], VISITORS[best]
# >>> BLANK id=annotate level=3 hint="经过 ax 加一条带箭头的注释，交回来的对象存进 note：第一个实参是注释文字（一个 f-string），后面三个关键字实参依次是箭头指向的点、文字放在哪、箭头的样式 || 关键字依次是 xy、xytext、arrowprops；两个位置都写成 (横, 纵) 元组，箭头样式直接给上面的常量 ARROW || 文字是 peak、一个空格、再接 y 的值；箭头指向 (x, y)，文字放在它右边 1、上面 3 的地方，写成 x + 1 与 y + 3" hintEn="Through ax, add a note with an arrow and keep the returned object in note: the first argument is the note's text (an f-string), then three keyword arguments in order - the point the arrow aims at, where the text goes, and the arrow's style || The keywords in order are xy, xytext, arrowprops; both positions are (across, up) tuples, and the arrow style is simply the constant ARROW above || The text is peak, a space, then the value of y; the arrow aims at (x, y), and the text sits 1 to the right and 3 above it, written x + 1 and y + 3"
    note = ax.annotate(f"peak {y}", xy=(x, y), xytext=(x + 1, y + 3), arrowprops=ARROW)
# <<< BLANK
# >>> BLANK id=grid level=1 hint="经过 ax 打开背景网格线——把 True 作为唯一的位置实参明确传进去（不写关键字；不传实参的调用是「切换」，已开着会被关掉）" hintEn="Through ax, switch the background grid lines on - pass True explicitly as the only positional argument (no keyword; the call with no argument toggles, so a grid already on would go off)"
    ax.grid(True)
# <<< BLANK
    ax.set_xlabel("Hour")
    ax.set_ylabel("Visitors")
    fig.savefig(path)
    return fig, line, note


if __name__ == "__main__":
    fig, line, note = draw_visitors("visitors.png")
    print("style:", line.get_linestyle(), line.get_marker(), line.get_color())
    print("note text:", note.get_text())
    print("arrow points at:", note.xy)
    print("text sits at:", note.xyann)
    print("has arrow:", note.arrow_patch is not None)
    print("saved:", os.path.exists("visitors.png"))
    plt.close(fig)
