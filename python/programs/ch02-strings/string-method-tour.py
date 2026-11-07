"""A tour of the string methods you will reach for every week."""


def tidy_name(raw):
# >>> BLANK id=tidy level=2 hint="一个表达式、两个方法串在一起：先去掉两头的空白，再把每个词改成首字母大写；顺序就是这个顺序 || 先调的方法写在左边、紧跟在 raw 后面，它交回的新串再接着调第二个方法" hintEn="One expression with two methods chained: first remove the whitespace at both ends, then give every word a capital first letter - in exactly that order || The method called first sits on the left, straight after raw, and the new string it hands back is what the second method is called on"
    return raw.strip().title()
# <<< BLANK


def is_pin(text):
# >>> BLANK id=pin level=2 hint="一个 PIN 必须恰好 4 个字符、而且全是数字：交回用 and 连起来的两个判断，长度那个写在前面，长度写在 == 的左边，两个判断和整个表达式都不加括号；数字那个判断用下面演示块里也出现过的那个 is 方法（不是 isdigit 或 isnumeric） || 数字那个方法问的是：每个字符是不是都是 int() 认得的十进制数字" hintEn="A PIN must be exactly 4 characters and all digits: hand back two tests joined with and, the length test first, with the length on the left of ==, and no brackets round either test or round the whole expression; for the digit test use the is-method that also appears in the demo block below (not isdigit or isnumeric) || The digit method asks whether every single character is a decimal digit that int() understands"
    return len(text) == 4 and text.isdecimal()
# <<< BLANK


if __name__ == "__main__":
    raw = "   ada LOVELACE  "
    print(repr(raw.strip()))
    print(raw.strip().lower(), "|", raw.strip().upper())
    print(tidy_name(raw))
    file_name = "report_final.py"
    print(file_name.startswith("report"), file_name.endswith(".txt"))
    print(file_name.find("_"), file_name.find("z"))
    try:
        file_name.index("z")
    except ValueError as err:
        print(type(err).__name__)
    print(file_name.replace("final", "draft"), file_name)
    print("banana".count("an"), "banana".count("a"))
    print("2026".isdecimal(), "20.5".isdecimal(), "-7".isdecimal())
    print("Ada".isalpha(), "Ada L".isalpha(), "".isalpha())
    for attempt in ("1234", "12a4", "12345", ""):
        print(repr(attempt), is_pin(attempt))
