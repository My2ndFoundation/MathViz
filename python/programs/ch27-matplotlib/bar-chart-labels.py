"""Bar charts: upright bars with their values written on top, then the same data as sideways bars."""
import os

import matplotlib.pyplot as plt

CLUBS = ["Chess", "Coding", "Drama", "Robotics"]
MEMBERS = [12, 18, 9, 15]


def draw_upright(path):
    fig, ax = plt.subplots()
# >>> BLANK id=bars level=2 hint="经过 ax 画竖的柱子，交回来的那一组柱子存进 bars：只写两个位置实参，不写关键字 || 第一个实参给每根柱子的名字（社团表），第二个给柱子的高度（人数表）" hintEn="Draw upright bars through ax and keep the group of bars it hands back in bars: two positional arguments only, no keywords || The first argument gives each bar its name (the list of clubs), the second gives the bar heights (the list of members)"
    bars = ax.bar(CLUBS, MEMBERS)
# <<< BLANK
# >>> BLANK id=bar-label level=1 hint="经过 ax 把每根柱子的数值写在柱顶，唯一的实参是上一行存下的 bars，交回来的文字对象存进 labels——方法名是 bar_label" hintEn="Through ax, write each bar's value on top of it, with the bars kept on the line above as the only argument, and keep the text objects it hands back in labels - the method is bar_label"
    labels = ax.bar_label(bars)
# <<< BLANK
    ax.set_ylabel("Members")
    fig.savefig(path)
    return fig, ax, labels


def draw_sideways(path):
# >>> BLANK id=pairs level=2 hint="把人数和社团名一对一对配起来，按人数从少到多排好，存进 pairs——人数放在每一对的前面，这样排序先比人数；把配对的结果直接交给 sorted，不写 key || 配对用 zip，人数表在前、社团表在后" hintEn="Pair up each count with its club name, put the pairs in order from fewest members to most, and keep them in pairs - the count goes first in each pair, so sorting compares counts first; hand the pairing straight to sorted, with no key || Pair them with zip, the members list first and the clubs list second"
    pairs = sorted(zip(MEMBERS, CLUBS))
# <<< BLANK
    fig, ax = plt.subplots()
    ax.barh([name for _, name in pairs], [count for count, _ in pairs])
    ax.set_xlabel("Members")
    fig.savefig(path)
    return fig, ax


if __name__ == "__main__":
    fig, ax, labels = draw_upright("clubs.png")
    print("bars:", len(ax.patches))
    print("heights:", [float(p.get_height()) for p in ax.patches])
    print("ticks:", [t.get_text() for t in ax.get_xticklabels()])
    print("labels on bars:", [t.get_text() for t in labels])
    plt.close(fig)

    fig, ax = draw_sideways("clubs-sideways.png")
    print("widths:", [float(p.get_width()) for p in ax.patches])
    print("heights:", [float(p.get_height()) for p in ax.patches])
    print("ticks:", [t.get_text() for t in ax.get_yticklabels()])
    print("saved:", os.path.exists("clubs.png"), os.path.exists("clubs-sideways.png"))
    plt.close(fig)
