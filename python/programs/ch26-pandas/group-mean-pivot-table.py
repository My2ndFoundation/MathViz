"""Average the scores of each form with pivot_table, and compare its shape with a groupby answer."""

import pandas as pd

ROWS = [
    {"name": "Ada", "form": "12A", "score": 72},
    {"name": "Ben", "form": "12B", "score": 58},
    {"name": "Cal", "form": "12A", "score": 65},
    {"name": "Dee", "form": "12B", "score": 81},
    {"name": "Eve", "form": "12A", "score": 49},
    {"name": "Fay", "form": "12B", "score": 70},
    {"name": "Gus", "form": "13A", "score": 77},
]


def form_table(rows):
    df = pd.DataFrame(rows, columns=["name", "form", "score"])
# >>> BLANK id=pivot level=3 hint="用 df.pivot_table 做成一张表，存进 table：三个关键字实参按 index、values、aggfunc 的顺序写，一个都不省，值都是双引号字符串 || 每个班一行，所以 index 是 form；要算的是 score 这一列 || 聚合函数用它的名字 mean 给出（一个字符串，不是函数）" hintEn="Make a table with df.pivot_table and keep it in table: three keyword arguments in the order index, values, aggfunc, none of them left out, each value a string in double quotes || One row per form, so index is form; the column to work on is score || Give the aggregate function by its name mean (a string, not a function)"
    table = df.pivot_table(index="form", values="score", aggfunc="mean")
# <<< BLANK
    return table


def form_means(rows):
    table = form_table(rows)
    result = {}
# >>> BLANK id=one-column level=2 hint="table 是只有一列 score 的表：先用方括号加双引号把这一列取出来，再对它 .items()；循环变量叫 form 和 mean，不加括号 || 这一步把表变回一列，才能一对一对地走" hintEn="table has a single column, score: take that column out with square brackets and double quotes first, then call .items() on it; the loop variables are form and mean, with no brackets || This step turns the table back into one column, so that you can walk it pair by pair"
    for form, mean in table["score"].items():
# <<< BLANK
        result[form] = round(mean, 9)
    return result


if __name__ == "__main__":
    table = form_table(ROWS)
    print(table)
    print(type(table).__name__, table.shape)
    df = pd.DataFrame(ROWS)
    by_group = df.groupby("form")["score"].mean()
    print(type(by_group).__name__, by_group.shape)
    print(table.columns.tolist(), table.index.tolist())
    print(form_means(ROWS))
    print(form_means(ROWS[:2]))
