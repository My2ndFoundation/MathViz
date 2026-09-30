"""Check a date typed as DD/MM/YYYY by hand, without a regular expression."""


def check_date(text):
    parts = text.split("/")
# >>> BLANK id=three-parts level=2 hint="一个 if 的头：len 那一侧写在比较号左边，用不等号（不用 not 包一个等号） || 数的是 split 切出来的段数，恰好 3 段才对" hintEn="The head of an if: the len side goes on the left of the comparison, with not-equal (not a not wrapped round ==) || What is counted is the pieces that split gave back, and only exactly 3 is right"
    if len(parts) != 3:
# <<< BLANK
        return "wrong format"
    for part, width in zip(parts, (2, 2, 4)):
# >>> BLANK id=part-check level=2 hint="一个 if 的头：这一段长度不对、或者含有不是数字的字符——两个条件用 or 连起来，长度那个在前；长度那个是 len 写在比较号左边、用不等号；数字那个是 not 加字符串方法 isdecimal()，不用 isdigit() 或 isnumeric()（² 这类上标 isdigit() 也认，int() 却不认） || 被检查的是循环里的这一段 part，它应有的长度是 width" hintEn="The head of an if: the piece has the wrong length or holds something that is not a digit - join the two tests with or, the length test first; the length test has len on the left of the comparison and not-equal; the digit test is not followed by the string method isdecimal(), not isdigit() or isnumeric() (isdigit() also accepts superscripts such as ², which int() rejects) || The piece being checked is part, from the loop, and the length it should have is width"
        if len(part) != width or not part.isdecimal():
# <<< BLANK
            return "wrong format"
    day, month, year = map(int, parts)
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
    print("25-12-2024".split("/"), "1/2/3/4".split("/"))
    print("2024".isdecimal(), "-7".isdecimal(), "".isdecimal())
    print(chr(178).isdigit(), chr(178).isdecimal())
