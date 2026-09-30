"""Four small graphs in a 2 by 2 grid that share one x axis, with a title over the whole figure."""
import os

import matplotlib.pyplot as plt

MONTHS = [1, 2, 3, 4, 5, 6]
SHOPS = {
    "North": [20, 24, 23, 30, 35, 33],
    "South": [15, 14, 18, 21, 19, 25],
    "East": [30, 28, 26, 27, 29, 31],
    "West": [10, 13, 17, 22, 26, 30],
}


def draw_grid(path):
    fig, axes = plt.subplots(2, 2, sharex=True, figsize=(8, 6))
    names = list(SHOPS)
    for r in range(2):
        for c in range(2):
# >>> BLANK id=name-index level=2 hint="第 r 行第 c 列的格子该画 names 里的第几个名字？一行有 2 格，先数完前面整行再加上本行的列号，取出来存进 name；下标写成 r 乘 2 在前、加 c 在后（不写成 2 乘 r） || 前面有 r 整行、每行 2 格，所以先跳过 r 乘 2 个名字" hintEn="Which name in names belongs in the cell at row r, column c? A row holds 2 cells, so count the whole rows before it, then add the column number; keep it in name, writing the index as r times 2 first, then plus c (not 2 times r) || There are r whole rows before it with 2 cells each, so first skip r times 2 names"
            name = names[r * 2 + c]
# <<< BLANK
# >>> BLANK id=cell level=2 hint="从 axes 里取出第 r 行第 c 列的那个坐标系，存进 ax——axes 是一个 2 行 2 列的网格，先取行、再取列，用两对分开的方括号（不写成一对方括号里的 r, c） || 第一对方括号里是 r，第二对里是 c" hintEn="Take the axes at row r, column c out of axes and keep them in ax - axes is a grid of 2 rows and 2 columns: row first, then column, with two separate pairs of square brackets (not r, c inside one pair) || The first pair of brackets holds r, the second holds c"
            ax = axes[r][c]
# <<< BLANK
            ax.plot(MONTHS, SHOPS[name], marker="o")
            ax.set_title(name)
    for ax in axes[1]:
        ax.set_xlabel("Month")
# >>> BLANK id=suptitle level=2 hint="给整张图（不是某一个小图）写一个总标题——经过 fig 调用，标题作为唯一的位置实参、写成双引号字符串 || 总标题是 Sales by shop" hintEn="Give the whole figure (not one of the small graphs) an overall title - called through fig, the title as the only positional argument, in double quotes || The overall title is Sales by shop"
    fig.suptitle("Sales by shop")
# <<< BLANK
    fig.tight_layout()
    fig.savefig(path)
    return fig, axes


if __name__ == "__main__":
    fig, axes = draw_grid("shops.png")
    print("grid:", axes.shape, "axes:", len(fig.axes))
    print("titles:", [ax.get_title() for ax in fig.axes])
    print("x labels:", [ax.get_xlabel() for ax in fig.axes])
    print("suptitle:", fig.get_suptitle())
    print("same x limits:", axes[0][0].get_xlim() == axes[1][1].get_xlim())
    print("size in inches:", fig.get_size_inches().tolist())
    print("saved:", os.path.exists("shops.png"))
    plt.close(fig)
