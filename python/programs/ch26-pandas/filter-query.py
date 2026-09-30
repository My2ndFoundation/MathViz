"""Keep only the rows that pass a test by writing the test as a string for DataFrame.query."""

import pandas as pd

ROWS = [
    {"name": "Ada", "form": "12A", "score": 72},
    {"name": "Ben", "form": "12B", "score": 58},
    {"name": "Cal", "form": "12A", "score": 65},
    {"name": "Dee", "form": "12B", "score": 81},
    {"name": "Eve", "form": "12A", "score": 49},
    {"name": "Fay", "form": "12B", "score": 70},
]


def passed_in_form(rows, threshold, form):
    df = pd.DataFrame(rows, columns=["name", "form", "score"])
# >>> BLANK id=query-string level=2 hint="用 df.query 挑出行，存进 chosen：条件写成一个双引号字符串，先写分数、后写班级，中间用小写的 and 连；字符串里直接写列名，函数的两个形参前面各加 @（不用 f-string）；每个比较号两边各一个空格 || 分数用「大于或等于」，班级用 ==" hintEn="Pick the rows with df.query and keep them in chosen: the condition is one string in double quotes, score first and form second, joined by a lower-case and; inside the string write the column names as they are, and put @ in front of each of the function's two parameters (no f-string); one space on each side of every comparison sign || Use greater than or equal to for the score, and == for the form"
    chosen = df.query("score >= @threshold and form == @form")
# <<< BLANK
    return chosen["name"].tolist()


if __name__ == "__main__":
    df = pd.DataFrame(ROWS)
    print(df.query("score >= 60"))
    print(df.query("form == '12B'")["name"].tolist())
    cut = 70
# >>> BLANK id=at-variable level=2 hint="打印分数大于或等于变量 cut 的那些行的名字列表：query 的字符串里用 @ 引用 cut，然后用方括号加双引号取 name 列、再 .tolist()，整句套在 print() 里 || 字符串用双引号，>= 两边各一个空格" hintEn="Print the list of names in the rows whose score is greater than or equal to the variable cut: refer to cut with @ inside the query string, then take the name column with square brackets and double quotes and call .tolist(), all wrapped in print() || The string is in double quotes, with one space on each side of >="
    print(df.query("score >= @cut")["name"].tolist())
# <<< BLANK
    print(passed_in_form(ROWS, 60, "12B"))
    print(passed_in_form(ROWS, 65, "12A"))
    print(passed_in_form(ROWS, 90, "12A"))
    print(df.query("score < 60 or form == '12A'")["name"].tolist())
