"""A Series is a column with labels; a DataFrame is a table of Series that share one index."""

import pandas as pd


def build_table(names, forms, scores):
    df = pd.DataFrame({"name": names, "form": forms, "score": scores})
# >>> BLANK id=derived-column level=2 hint="给 df 加一列 passed，写成「df[列名] = 比较」的样子（不用 .loc）；两处列名都用方括号加双引号；右边把 score 那一列写在比较号左边，直接用「大于或等于」号和及格线比，不加括号、不调用方法 || 及格线是 60，比较的结果是一整列 True / False" hintEn="Add a column passed to df in the shape df[column name] = comparison (not .loc); both column names in square brackets and double quotes; on the right put the score column on the left of the comparison and compare it with the pass mark using the greater-than-or-equal sign directly, with no brackets around it and no method call || The pass mark is 60, and the comparison gives a whole column of True / False"
    df["passed"] = df["score"] >= 60
# <<< BLANK
    return df


if __name__ == "__main__":
    marks = pd.Series([72, 58, 65], index=["a", "b", "c"])
    print(marks)
    print(marks["b"])
    print(marks.loc["b"])
# >>> BLANK id=by-position level=1 hint="打印 marks 按位置取的第二项（位置从 0 数，用正数）——用 .iloc，方括号里写位置，外面套 print()" hintEn="Print the second item of marks taken by position (positions count from 0; use a positive number) - use .iloc with the position in square brackets, wrapped in print()"
    print(marks.iloc[1])
# <<< BLANK

    bonus = pd.Series([5, 5], index=["a", "c"])
    print(marks + bonus)

    df = build_table(["Ada", "Ben", "Cal"], ["12A", "12B", "12A"], [72, 58, 65])
    print(df)
    print(df.shape)
    print(df.columns.tolist())
    print(df.dtypes)
    print(type(df["score"]).__name__)
# >>> BLANK id=double-brackets level=2 hint="照上一行的样子打印 type(…).__name__，只是这回取出来的是只有一列的表，不是一列——把列名（双引号）放进一个列表里再交给 df 的方括号 || 两层方括号：外层是 df 的取列，内层是列表" hintEn="Print type(...).__name__ just like the line above, except that this time what comes out is a table with one column, not a column - put the column name (double quotes) inside a list and hand that to df's square brackets || Two layers of square brackets: the outer ones select from df, the inner ones make a list"
    print(type(df[["score"]]).__name__)
# <<< BLANK

    average = df["score"].mean()
    print(type(average).__name__)
    print(round(float(average), 2))
