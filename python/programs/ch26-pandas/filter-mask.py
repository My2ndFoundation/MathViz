"""Keep only the rows that pass a test by indexing a DataFrame with a column of True / False."""

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
# >>> BLANK id=two-conditions level=2 hint="两个条件合成一个掩码 both：先写「分数大于或等于 threshold」，再写「班级等于 form」；都用比较号（不用 .ge / .eq 这类方法），两个比较各自套一层圆括号，中间用 & 连（不是 and），整个式子外面不再加括号；列用方括号加双引号取 || 每一对圆括号都不能省：& 比 >= 和 == 结合得更紧" hintEn="Combine two conditions into one mask, both: first score greater than or equal to threshold, then form equal to form; use comparison signs (not methods such as .ge / .eq), put each comparison in its own round brackets and join them with & (not and), with no extra brackets around the whole thing; take columns with square brackets and double quotes || None of the round brackets can be dropped: & binds more tightly than >= and =="
    both = (df["score"] >= threshold) & (df["form"] == form)
# <<< BLANK
# >>> BLANK id=pick-names level=2 hint="用掩码 both 从 df 里挑出行，再取 name 这一列，转成普通列表返回——三步连着写：df 后面方括号里放 both，接着方括号加双引号取列，最后 .tolist() || 不用 .loc，也不先存进别的变量" hintEn="Use the mask both to pick rows out of df, then take the name column and return it as a plain list - three steps in a row: both in square brackets after df, then the column in square brackets and double quotes, then .tolist() || Do not use .loc, and do not store anything in another variable first"
    return df[both]["name"].tolist()
# <<< BLANK


if __name__ == "__main__":
    df = pd.DataFrame(ROWS)
    mask = df["score"] >= 60
    print(mask.tolist())
    print(df[mask])
    print(passed_in_form(ROWS, 60, "12B"))
    print(passed_in_form(ROWS, 65, "12A"))
    print(passed_in_form(ROWS, 90, "12A"))
    try:
        df[df["score"] >= 60 and df["form"] == "12B"]
    except ValueError as e:
        print(type(e).__name__)
    print(df[~mask]["name"].tolist())
