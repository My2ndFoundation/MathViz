"""Check a date typed as DD/MM/YYYY by hand, without a regular expression."""


def check_date(text):
    parts = text.split("/")
# >>> BLANK id=three-parts level=1 hint="切出来的段数不是 3 就进入这个 if：len(parts) 写在左边，用不等号和 3 比（不用 not 包一个等号）" hintEn="Enter this if when the number of pieces is not 3: len(parts) on the left, compared with 3 by not-equal (not a not wrapped round ==)"
    if len(parts) != 3:
# <<< BLANK
        return "wrong format"
    for part, width in zip(parts, (2, 2, 4)):
# >>> BLANK id=part-check level=2 hint="这一段长度不对、或者含有不是数字的字符，就进入这个 if：两个条件用 or 连起来，长度那个写在前面、用不等号和 width 比；数字那个是 not 加字符串方法 isdigit（不用 isnumeric 或 isdecimal） || 长度就是 len 这一段，应有的长度是 width" hintEn="Enter this if when the piece has the wrong length or holds something that is not a digit: join the two tests with or, the length test first and compared with width by not-equal; the digit test is not followed by the string method isdigit (not isnumeric or isdecimal) || The length is len of the piece, and the length it should have is width"
        if len(part) != width or not part.isdigit():
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
    print("2024".isdigit(), "-7".isdigit(), "".isdigit())
