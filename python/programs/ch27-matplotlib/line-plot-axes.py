"""Draw the same two-line graph through a Figure and an Axes object, so every call names its target."""
import os

import matplotlib.pyplot as plt

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
LEEDS = [9, 11, 10, 13, 12]
YORK = [8, 10, 12, 12, 14]


def draw_week(path):
    """Draw both towns on one graph and save it; returns the figure and its axes."""
# >>> BLANK id=subplots level=2 hint="一次拿到两个对象：整张图 fig 和其中的一个坐标系 ax，拆包到这两个名字里（左边不加括号）；调用时括号里不写实参（缺省就是一行一列） || 调用的是 pyplot 那个同时建图和坐标系的函数，名字是 subplot 的复数" hintEn="Get two objects at once, the whole figure fig and one set of axes ax inside it, unpacked into those two names (no brackets on the left); call it with nothing in the brackets (the default is one row, one column) || The call is to the pyplot function that makes a figure together with its axes; its name is the plural of subplot"
    fig, ax = plt.subplots()
# <<< BLANK
    ax.plot(DAYS, LEEDS, label="Leeds")
    ax.plot(DAYS, YORK, label="York")
# >>> BLANK id=x-label level=2 hint="给横轴写上名字——经过 ax 调它的方法（方法名和下一行给纵轴写名字的那个对称），名字作为唯一的位置实参、写成双引号字符串 || 横轴上是星期几，名字是一个英文单词：Day" hintEn="Name the x axis - through ax, calling its method (the twin of the one the next line uses for the y axis), the name as the only positional argument, in double quotes || The x axis shows the days of the week; its name is the single word Day"
    ax.set_xlabel("Day")
# <<< BLANK
    ax.set_ylabel("Temperature (C)")
    ax.set_title("Midday temperature")
    ax.legend()
# >>> BLANK id=save level=1 hint="把图存到 path——经过 fig 这个对象来存（不用 pyplot 模块的同名函数），path 是唯一的实参、按位置传" hintEn="Save the figure to path - through the fig object (not pyplot's function of the same name), with path as the only argument, passed by position"
    fig.savefig(path)
# <<< BLANK
    return fig, ax


if __name__ == "__main__":
    fig, ax = draw_week("week-axes.png")
    print("lines:", len(ax.get_lines()))
    print("x label:", ax.get_xlabel())
    print("y label:", ax.get_ylabel())
    print("title:", ax.get_title())
    print("legend:", [t.get_text() for t in ax.get_legend().get_texts()])
    print("x ticks:", [t.get_text() for t in ax.get_xticklabels()])
    print("saved:", os.path.exists("week-axes.png"))
    plt.close(fig)
    print("figures still open:", len(plt.get_fignums()))
