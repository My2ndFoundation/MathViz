"""Write dictionaries to a CSV file with DictWriter and read them back with DictReader."""

import csv

FIELDS = ["name", "house", "points"]


def save(path, records):
# >>> BLANK id=open-write level=2 hint="以写模式打开 path，文件对象叫 f；模式作第二个位置实参、写成双引号字符串，后面再用关键字实参关掉换行符翻译 || 关掉翻译的写法与读 CSV 时相同：newline 设成空字符串（双引号）" hintEn="Open path for writing and call the file object f; the mode is the second positional argument, a double-quoted string, followed by a keyword argument that switches newline translation off || switching it off is written exactly as when reading a CSV: newline set to the empty string (double quotes)"
    with open(path, "w", newline="") as f:
# <<< BLANK
# >>> BLANK id=make-dictwriter level=2 hint="用 csv 模块造一个按字典写行的写入器，存进 writer；第一个实参是 f，列的顺序由上面的 FIELDS 决定，用关键字实参交进去 || 类名是 DictWriter；那个关键字实参叫 fieldnames" hintEn="Build a writer from the csv module that writes rows from dictionaries and keep it in writer; its first argument is f, and the column order comes from FIELDS above, passed as a keyword argument || the class is DictWriter; the keyword argument is fieldnames"
        writer = csv.DictWriter(f, fieldnames=FIELDS)
# <<< BLANK
# >>> BLANK id=write-header level=1 hint="逐条写数据之前，先让 writer 把列名那一行写出去——一个不带实参的方法调用" hintEn="Before any record goes out, have writer write the row of column names - a method call with no arguments"
        writer.writeheader()
# <<< BLANK
        for record in records:
            writer.writerow(record)


def load(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


if __name__ == "__main__":
    save("house_points.csv", [
        {"name": "Ada", "house": "Blue", "points": 12},
        {"name": "Brian", "house": "Red", "points": 7},
    ])
    with open("house_points.csv", newline="") as f:
        print(repr(f.read()))
    rows = load("house_points.csv")
    print(rows[0])
    for row in rows:
        print(row["name"], row["house"], int(row["points"]) + 1)
