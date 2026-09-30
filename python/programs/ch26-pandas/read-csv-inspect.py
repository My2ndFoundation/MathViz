"""Read a CSV file into a DataFrame, then ask it about its size, its types and its numbers."""

import pandas as pd


def load_pupils(path):
# >>> BLANK id=read-csv level=1 hint="用 pandas 的 read_csv 把 path 指向的文件读成一张表，存进 table——pandas 在这个程序里叫 pd；只给 path 这一个实参" hintEn="Use pandas' read_csv to read the file that path points to into a table, kept in table - pandas is called pd in this program; give path as the only argument"
    table = pd.read_csv(path)
# <<< BLANK
    return table


def describe_size(table):
# >>> BLANK id=unpack-shape level=2 hint="表的 shape 是一个二元组（行数, 列数）；用元组拆包一次拿到两个数，分别叫 rows 和 cols，等号左边不加括号 || 右边就是 table 的那个属性本身（不带括号、不取下标）" hintEn="A table's shape is a pair (number of rows, number of columns); unpack the tuple to get both numbers at once, named rows and cols, with no brackets on the left of the equals sign || The right-hand side is just that attribute of table (no brackets, no indexing)"
    rows, cols = table.shape
# <<< BLANK
    return f"{rows} rows, {cols} columns"


if __name__ == "__main__":
    table = load_pupils("_fixtures/pupils.csv")
    print(describe_size(table))
# >>> BLANK id=head-rows level=2 hint="打印表的前几行——用 head()，行数直接写进括号（不写 n=），外面套 print() || 只看前 3 行" hintEn="Print the first few rows of the table - use head() with the number of rows written straight into the brackets (no n=), wrapped in print() || Look at just the first 3 rows"
    print(table.head(3))
# <<< BLANK
    print(table.columns.tolist())
    print(table.dtypes)
    print(table.describe())
    best = table["score"].idxmax()
    print(table.loc[best, "name"], int(table.loc[best, "score"]))
    print(int(table["homework"].sum()))
