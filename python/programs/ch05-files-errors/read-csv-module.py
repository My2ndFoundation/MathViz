"""Read the same CSV file with the csv module instead of split."""

import csv


def read_scores(path):
    rows = []
# >>> BLANK id=open-newline level=2 hint="打开文件，文件对象叫 f；csv 模块要求打开时关掉换行符翻译——用一个关键字实参把它设成空字符串（双引号），不写打开模式 || 那个关键字实参的名字就是 newline" hintEn="Open the file and call the file object f; the csv module wants newline translation switched off when the file is opened - set it to the empty string (double quotes) with a keyword argument, and leave the mode out || the keyword argument's name is newline"
    with open(path, newline="") as f:
# <<< BLANK
# >>> BLANK id=make-reader level=1 hint="用 csv 模块把 f 包成一个读取器，存进 reader——模块名点出那个函数，只给 f 一个实参" hintEn="Wrap f in a reader from the csv module and keep it in reader - the function is read off the module name with a dot, and f is its only argument"
        reader = csv.reader(f)
# <<< BLANK
# >>> BLANK id=header-next level=2 hint="读取器也是一个迭代器：从它那里取出第一行（已经切好的字段列表）存进 header，剩下的留给下面的 for；文件是空的就让它当场报错，不给后备值 || 用内置函数 next，读取器是它唯一的实参；不调用任何带双下划线的方法" hintEn="The reader is an iterator too: take the first row (already split into a list of fields) out of it and keep it in header, leaving the rest for the for below; if the file is empty let it fail on the spot, with no fallback value || use the built-in function next with the reader as its only argument, not a method with double underscores"
        header = next(reader)
# <<< BLANK
        for fields in reader:
            marks = []
            for field in fields[1:]:
                marks.append(int(field))
            rows.append((fields[0], marks))
    return header, rows


if __name__ == "__main__":
    header, rows = read_scores("_fixtures/scores.csv")
    print(header)
    for name, marks in rows:
        print(f"{name}: {marks} total {sum(marks)}")
