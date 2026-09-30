"""Average the scores of each form in one line with groupby, and see what shape the answer has."""

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


def form_means(rows):
    df = pd.DataFrame(rows, columns=["name", "form", "score"])
# >>> BLANK id=groupby-mean level=2 hint="按班级分组、取 score 列、求均值，结果存进 means——一条链写完：df.groupby(...)（列名直接作实参，不写 by=），接方括号加双引号取列，最后 .mean() || groupby 的实参是列名 form（双引号）" hintEn="Group by form, take the score column and average it, keeping the result in means - one chain: df.groupby(...) (the column name goes straight in as the argument, no by=), then the column in square brackets and double quotes, then .mean() || The argument of groupby is the column name form (double quotes)"
    means = df.groupby("form")["score"].mean()
# <<< BLANK
    result = {}
# >>> BLANK id=walk-groups level=2 hint="for 的头：边走 means 的每一对（组名, 均值），组名叫 form、均值叫 mean，两个名字外面不加括号——Series 给出「索引, 值」对的方法和字典给出键值对的方法同名 || 方法是 items()" hintEn="The head of the for: go through each (group name, average) pair of means, calling the group name form and the average mean, with no brackets around the two names - the Series method that gives (index, value) pairs has the same name as the dictionary method that gives key-value pairs || The method is items()"
    for form, mean in means.items():
# <<< BLANK
        result[form] = round(mean, 9)
    return result


if __name__ == "__main__":
    df = pd.DataFrame(ROWS)
    stats = df.groupby("form")["score"].agg(["mean", "count"])
    print(stats)
    print(stats.index.tolist())
    print(stats.loc["12B", "count"])
    print(form_means(ROWS))
    print(form_means(ROWS[:2]))
