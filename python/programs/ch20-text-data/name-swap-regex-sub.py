"""Turn "Surname, Forename" into "Forename Surname" with groups and re.sub."""

import re


def swap_name(line):
# >>> BLANK id=sub level=3 hint="交回 re 模块里 sub 的结果：三个实参依次是模式、替换串、line；模式和替换串都写成双引号的原始字符串；单词用反斜杠加 w（不用字母范围），替换串里用反斜杠加数字引用分组（不用 g 加尖括号） || 模式用 ^ 和 $ 钉住整行，里面是两个括号分组，每组是一个或多个单词字符，两组之间是一个逗号加一个空格 || 替换串是：先引用第 2 组，一个空格，再引用第 1 组" hintEn="Return the result of sub from the re module: its three arguments are the pattern, the replacement and line; write both as raw strings in double quotes; words are backslash w (not a range of letters), and the replacement refers to groups in the backslash-number form (not g with angle brackets) || The pattern is pinned to the whole line with ^ and $, and holds two bracketed groups, each one or more word characters, with a comma and one space between them || The replacement is: group 2 first, one space, then group 1"
    return re.sub(r"^(\w+), (\w+)$", r"\2 \1", line)
# <<< BLANK


if __name__ == "__main__":
    names = [
        "Lovelace, Ada", "Turing, Alan", "Grace Hopper",
        "Hopper,Grace", "O'Neil, Cathy", "Liskov, Barbara, Jane",
    ]
    for name in names:
        print(swap_name(name))
    m = re.fullmatch(r"(\w+), (\w+)", "Lovelace, Ada")
    print(m.group(0))
# >>> BLANK id=groups level=1 hint="打印 m 的第 1 组和第 2 组，作为 print 的两个实参：用 match 对象的 group 方法、给组号（不用方括号下标，也不用 groups）" hintEn="Print group 1 and group 2 of m as two arguments to print: use the match object's group method with the group number (not square-bracket indexing, and not groups)"
    print(m.group(1), m.group(2))
# <<< BLANK
    print(re.sub(r"(\d+)kg", r"\1 kg", "5kg of flour, 12kg of rice"))
