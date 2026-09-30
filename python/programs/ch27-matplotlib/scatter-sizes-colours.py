"""A scatter plot where each point also shows two more numbers: one by its size, one by its colour."""
import os

import matplotlib.pyplot as plt

HOURS = [2, 5, 1, 8, 6, 3]           # hours revised
SCORES = [48, 66, 41, 83, 74, 55]    # test score out of 100
PAPERS = [1, 3, 0, 5, 4, 2]          # past papers done
ATTEND = [85, 92, 70, 99, 95, 88]    # attendance, per cent


def draw_scatter(path):
    fig, ax = plt.subplots()
    sizes = [40 + 60 * p for p in PAPERS]
# >>> BLANK id=scatter level=3 hint="经过 ax 画散点，交回来的对象存进 points：前两个位置实参是横坐标 HOURS、纵坐标 SCORES，后面三个关键字实参按「大小、颜色、配色表」的顺序写 || 大小用关键字 s，给上一行算好的列表；颜色用关键字 c，给出勤率那张表 || 配色表用关键字 cmap，名字是 viridis（写成双引号字符串）" hintEn="Draw the scatter through ax and keep the returned object in points: the first two positional arguments are the x values HOURS and the y values SCORES, then three keyword arguments in the order size, colour, colour map || Size goes in keyword s, given the list the line above built; colour goes in keyword c, given the attendance list || The colour map goes in keyword cmap, and its name is viridis (written as a string in double quotes)"
    points = ax.scatter(HOURS, SCORES, s=sizes, c=ATTEND, cmap="viridis")
# <<< BLANK
# >>> BLANK id=colorbar level=2 hint="经过 fig 给 points 配一根颜色条（这一行只调用，不存返回值）：第一个实参是 points，再用关键字 ax= 说它挨着哪个坐标系，用关键字 label= 给它写名字（双引号）；先 ax 后 label || 颜色条的名字是 Attendance (%)" hintEn="Through fig, give points a colour bar (this line only calls it, keeping nothing): the first argument is points, then keyword ax= says which axes it sits beside and keyword label= names it (double quotes); ax first, then label || The colour bar's name is Attendance (%)"
    fig.colorbar(points, ax=ax, label="Attendance (%)")
# <<< BLANK
    ax.set_xlabel("Hours revised")
    ax.set_ylabel("Score")
    fig.savefig(path)
    return fig, ax, points


if __name__ == "__main__":
    fig, ax, points = draw_scatter("revision.png")
# >>> BLANK id=offsets level=2 hint="向 points 要每个点的位置（一个 N 行 2 列的数组：第 0 列是横坐标，第 1 列是纵坐标），存进 xy || 这些位置在 matplotlib 里叫 offsets，方法名是 get_ 加上这个词，不带实参" hintEn="Ask points for the position of every point (an array of N rows and 2 columns: column 0 is x, column 1 is y) and keep it in xy || matplotlib calls these positions offsets; the method is get_ followed by that word, with no arguments"
    xy = points.get_offsets()
# <<< BLANK
    print("points:", len(xy))
    print("x from", float(xy[:, 0].min()), "to", float(xy[:, 0].max()))
    print("y from", float(xy[:, 1].min()), "to", float(xy[:, 1].max()))
    print("sizes:", points.get_sizes().tolist())
    print("colour values:", points.get_array().tolist())
    print("axes in figure:", len(fig.axes))
    print("colour bar label:", fig.axes[1].get_ylabel())
    print("saved:", os.path.exists("revision.png"))
    plt.close(fig)
