"""Read a CSV file by hand: strip each line and split it on commas."""


def read_scores(path):
    rows = []
    with open(path) as f:
# >>> BLANK id=header-readline level=2 hint="先单独读掉第一行表头，切成字段列表存进 header：和下面循环里处理每一行的那句同一条链、同样的双引号，只是这一行不是从 for 拿来的，而是在文件对象上用读一行的方法取 || 链上三步依次是：readline()、只去掉右端的换行符（实参明写）、按逗号切" hintEn="Read the header row on its own first and keep its fields as a list in header: the same chain, with the same double quotes, that the loop below uses on each line - except this line does not come from the for, it comes from the file object's read-one-line method || the three links, in order: readline(), removing only the newline from the right-hand end (argument written out), and splitting on a comma"
        header = f.readline().rstrip("\n").split(",")
# <<< BLANK
        for line in f:
            fields = line.rstrip("\n").split(",")
            marks = []
            for field in fields[1:]:
# >>> BLANK id=convert-mark level=1 hint="字段读进来都是字符串；转成整数后放进 marks 的末尾——用列表的那个加一项的方法，不用 +=" hintEn="Every field arrives as a string; turn it into an int and put it on the end of marks - use the list method that adds one item, not +="
                marks.append(int(field))
# <<< BLANK
            rows.append((fields[0], marks))
    return header, rows


if __name__ == "__main__":
    header, rows = read_scores("_fixtures/scores.csv")
    print(header)
    for name, marks in rows:
        print(f"{name}: {marks} total {sum(marks)}")
