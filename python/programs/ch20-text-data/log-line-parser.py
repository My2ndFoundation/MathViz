"""Parse a web server log with named groups, skipping lines that do not fit."""

import re

LINE = re.compile(
    r"(?P<ip>\d+\.\d+\.\d+\.\d+) "
    r"(?P<method>[A-Z]+) "
    r"(?P<path>/\S*) "
# >>> BLANK id=status-group level=2 hint="这一段是一个命名分组，名字叫 status，匹配恰好三位数字，后面跟一个空格；写成双引号的原始字符串，和上下几行同一个样子；三位数字写成反斜杠加 d、后跟花括号里的次数（不连写三个，不用方括号范围） || 分组以 ?P 加尖括号里的名字开头" hintEn="This piece is a named group called status that matches exactly three digits, followed by one space; write it as a raw string in double quotes, in the same shape as the lines around it; the three digits are backslash d followed by a count in braces (not written out three times, not a range in square brackets) || The group starts with ?P and the name in angle brackets"
    r"(?P<status>\d{3}) "
# <<< BLANK
    r"(?P<size>\d+)"
)


def parse_line(line):
    m = LINE.fullmatch(line)
    if m is None:
        return None
# >>> BLANK id=groupdict level=1 hint="把 m 里的全部命名分组一次取出来，成为一个以分组名为键的字典，存进 entry——用 match 对象的一个方法，不带实参" hintEn="Take every named group out of m at once, as a dictionary keyed by group name, and keep it in entry - a method of the match object, with no arguments"
    entry = m.groupdict()
# <<< BLANK
    entry["status"] = int(entry["status"])
    entry["size"] = int(entry["size"])
    return entry


def summarise(lines):
    by_status = {}
    bad = 0
    for line in lines:
        entry = parse_line(line)
        if entry is None:
# >>> BLANK id=count-bad level=1 hint="坏行计数加一：用增强赋值（不写 bad = bad + 1）" hintEn="Add one to the count of bad lines: use augmented assignment (not bad = bad + 1)"
            bad += 1
# <<< BLANK
            continue
        status = entry["status"]
        by_status[status] = by_status.get(status, 0) + 1
    return by_status, bad


if __name__ == "__main__":
    with open("_fixtures/access.log") as f:
        lines = f.read().splitlines()
    first = parse_line(lines[0])
    print(first["ip"], first["method"], first["path"], first["status"])
    print(LINE.fullmatch(lines[1]).group("path"))
    by_status, bad = summarise(lines)
    for status in sorted(by_status):
        print(status, by_status[status])
    print("bad lines:", bad)
