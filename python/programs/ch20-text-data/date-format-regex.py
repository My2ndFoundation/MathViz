"""Check a date typed as DD/MM/YYYY, using a regular expression for the format."""

import re


def check_date(text):
# >>> BLANK id=fullmatch level=2 hint="text 整个不符合格式时进入这个 if：用 not 加 re 模块里那个要求整串都匹配的函数（不是 match，也不是 search 加锚点）；模式是双引号的原始字符串，每一位数字都用简写的数字类（反斜杠加 d），每一段的位数用花括号里的次数写死（不连写两个数字类），text 是第二个实参 || 模式依次是：两位数字、斜杠、两位数字、斜杠、四位数字" hintEn="Enter this if when text as a whole does not fit the format: not, then the function in the re module that must match the entire string (not match, and not search with anchors); the pattern is a raw string in double quotes, every digit is the shorthand digit class (backslash d), and each group's length is fixed with a count in braces (rather than writing the digit class twice); text is the second argument || The pattern is, in order: two digits, a slash, two digits, a slash, four digits"
    if not re.fullmatch(r"\d{2}/\d{2}/\d{4}", text):
# <<< BLANK
        return "wrong format"
# >>> BLANK id=unpack level=2 hint="格式已经对了：把 text 按斜杠（双引号）切开，每段转成 int，一次解包给 day、month、year 三个名字——用 map，不用推导式 || map 的第一个实参是 int，第二个是 split 切出来的列表" hintEn="The format is right now: split text at the slashes (double quotes), turn each piece into an int and unpack them into day, month and year in one go - use map, not a comprehension || map's first argument is int and its second is the list that split gives back"
    day, month, year = map(int, text.split("/"))
# <<< BLANK
    if not 1 <= day <= 31 or not 1 <= month <= 12:
        return "out of range"
    return "ok"


if __name__ == "__main__":
    tests = [
        "25/12/2024", "5/12/2024", "25-12-2024", "25/12/2024x",
        "31/02/2024", "00/10/2024", "12/13/2024", "01/01/0000",
    ]
    for t in tests:
        print(f"{t:<12}{check_date(t)}")
    print(re.fullmatch(r"\d+", "2024x"))
    print(re.match(r"\d+", "2024x").group())
    print(re.match(r"\d+", "year 2024"))
    print(re.search(r"\d+", "year 2024").group())
