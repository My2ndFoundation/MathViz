"""Let a pandas DataFrame draw itself as a grouped bar chart onto an Axes you made."""
import os

import pandas as pd
import matplotlib.pyplot as plt


def draw_forms(df, path):
# >>> BLANK id=subplots level=1 hint="先自己建好整张图和一个坐标系，拆包进 fig 和 ax（左边不加括号）——用 pyplot 那个同时建两样的函数，括号里不写实参" hintEn="First make the whole figure and one set of axes yourself, unpacked into fig and ax (no brackets on the left) - use the pyplot function that makes both at once, with nothing in the brackets"
    fig, ax = plt.subplots()
# <<< BLANK
# >>> BLANK id=df-plot level=3 hint="让 df 自己画成柱状图，画到上一行建好的 ax 上：只用关键字实参，依次是图的种类、横轴用哪一列、画到哪个坐标系、刻度文字转多少度；字符串都用双引号 || 关键字依次是 kind、x、ax、rot；种类是字符串 bar，横轴用 form 那一列 || 画到 ax 上写 ax=ax；刻度文字保持水平，转 0 度" hintEn="Have df draw itself as a bar chart onto the ax made on the line above: keyword arguments only, in the order kind of chart, which column goes along the x axis, which axes to draw on, how far to turn the tick labels; strings in double quotes || The keywords in order are kind, x, ax, rot; the kind is the string bar and the x axis uses the form column || Drawing onto ax is written ax=ax; the tick labels stay level, turned 0 degrees"
    df.plot(kind="bar", x="form", ax=ax, rot=0)
# <<< BLANK
    ax.set_ylabel("Pupils")
    ax.set_title("Pupils by form")
    fig.savefig(path)
    return fig, ax


if __name__ == "__main__":
    df = pd.DataFrame({
        "form": ["7A", "7B", "7C"],
        "boys": [14, 12, 15],
        "girls": [13, 16, 11],
    })
# >>> BLANK id=to-string level=2 hint="把整张表打印出来，但不要最左边那一列行号——先把 df 变成字符串，再交给 print || 用 DataFrame 的 to_string 方法，关键字实参 index 设成 False" hintEn="Print the whole table, but without the column of row numbers on the far left - turn df into a string first, then give it to print || Use the DataFrame's to_string method with the keyword argument index set to False"
    print(df.to_string(index=False))
# <<< BLANK
    fig, ax = draw_forms(df, "forms.png")
    print("bars:", len(ax.patches))
    print("heights:", [float(p.get_height()) for p in ax.patches])
    print("x label:", ax.get_xlabel())
    print("x ticks:", [t.get_text() for t in ax.get_xticklabels()])
    print("legend:", [t.get_text() for t in ax.get_legend().get_texts()])
    print("drew on my axes:", fig.axes == [ax])
    print("saved:", os.path.exists("forms.png"))
    plt.close(fig)
