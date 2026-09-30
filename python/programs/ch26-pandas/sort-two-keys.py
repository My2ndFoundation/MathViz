"""Sort a table by two columns at once, each in its own direction, and take the top rows with nlargest."""

import pandas as pd

ROWS = [
    {"name": "Ada", "form": "12B", "score": 72},
    {"name": "Ben", "form": "12A", "score": 58},
    {"name": "Cal", "form": "12B", "score": 81},
    {"name": "Dee", "form": "12A", "score": 72},
    {"name": "Eve", "form": "12A", "score": 72},
    {"name": "Fay", "form": "12B", "score": 64},
]


def ranked(rows):
    df = pd.DataFrame(rows, columns=["name", "form", "score"])
# >>> BLANK id=two-keys level=2 hint="用 df.sort_values 排好，存进 ordered：第一个实参直接写（不写 by=），是列名列表（先 form、后 score）；再用关键字实参 ascending 给一个同样长的列表（不是元组），说明每一列各自的方向；不写 kind；字符串用双引号 || 班级从小到大，分数从高到低" hintEn="Sort with df.sort_values and keep the result in ordered: the first argument is written straight in (no by=) and is a list of column names (form first, then score); then the keyword argument ascending gets a list (not a tuple) of the same length giving each column its own direction; no kind; strings in double quotes || Forms from low to high, scores from high to low"
    ordered = df.sort_values(["form", "score"], ascending=[True, False])
# <<< BLANK
    return ordered["name"].tolist()


if __name__ == "__main__":
    df = pd.DataFrame(ROWS)
    print(ranked(ROWS))
    print(ranked(ROWS[::-1]))
# >>> BLANK id=stable-one-key level=2 hint="只按 score 一列排、从高到低，并要求分数相同的行保持原来的先后，结果存进 by_score：列名直接作第一个实参（双引号，不写 by=），再给 ascending 和 kind 两个关键字实参，先 ascending 后 kind；kind 取名字 stable（双引号字符串，不用 mergesort） || 从高到低，所以 ascending 是 False" hintEn="Sort by the score column alone, from high to low, and ask for rows with the same score to keep their original order, keeping the result in by_score: the column name goes straight in as the first argument (double quotes, no by=), then two keyword arguments, ascending first and kind second; kind takes the name stable (a string in double quotes, not mergesort) || High to low, so ascending is False"
    by_score = df.sort_values("score", ascending=False, kind="stable")
# <<< BLANK
    print(by_score.to_string(index=False))
    print(df.nlargest(2, "score")["name"].tolist())
    print(df.nlargest(2, "score", keep="all")["name"].tolist())
    print(df["name"].tolist())
