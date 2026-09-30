"""Draw a two-line graph with the pyplot functions, which always act on the current figure."""
import os

import matplotlib.pyplot as plt

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
LEEDS = [9, 11, 10, 13, 12]
YORK = [8, 10, 12, 12, 14]


def draw_week(path):
    """Draw both towns on one graph and save it; returns nothing."""
    plt.figure()
    plt.plot(DAYS, LEEDS, label="Leeds")
    plt.plot(DAYS, YORK, label="York")
# >>> BLANK id=x-label level=2 hint="给横轴写上名字——用 pyplot 模块自己的函数（不经过任何对象），名字作为唯一的位置实参、写成双引号字符串 || 横轴上是星期几，名字是一个英文单词：Day" hintEn="Name the x axis - with pyplot's own function (not through any object), the name as the only positional argument, in double quotes || The x axis shows the days of the week; its name is the single word Day"
    plt.xlabel("Day")
# <<< BLANK
    plt.ylabel("Temperature (C)")
    plt.title("Midday temperature")
# >>> BLANK id=legend level=1 hint="画出图例，让两条线的 label 显示出来——pyplot 的函数，括号里什么都不写" hintEn="Draw the legend so the two lines' labels appear - a pyplot function, with nothing inside the brackets"
    plt.legend()
# <<< BLANK
    plt.savefig(path)


if __name__ == "__main__":
    draw_week("week-pyplot.png")
# >>> BLANK id=current-axes level=2 hint="draw_week 什么都没交回来，所以直接向 pyplot 要它此刻的当前坐标系（一次调用，不经过 figure），存进 ax || 那个函数名是 get current axes 三个词的首字母，不带实参" hintEn="draw_week handed nothing back, so ask pyplot directly for its current axes right now (one call, not via the figure) and keep them in ax || The function's name is the initials of get current axes, called with no arguments"
    ax = plt.gca()
# <<< BLANK
    print("lines:", len(ax.get_lines()))
    print("x label:", ax.get_xlabel())
    print("y label:", ax.get_ylabel())
    print("title:", ax.get_title())
    print("legend:", [t.get_text() for t in ax.get_legend().get_texts()])
    print("x ticks:", [t.get_text() for t in ax.get_xticklabels()])
    print("saved:", os.path.exists("week-pyplot.png"))
    plt.close()
    print("figures still open:", len(plt.get_fignums()))
