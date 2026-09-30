"""A small parser for settings: [sections], key = value lines and # comments."""


def parse_config(text):
    config = {}
    section = None
    for number, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
# >>> BLANK id=section level=3 hint="进入（或新建）这一节，让 section 指向这一节的字典：用 config 的 setdefault 方法，第二个实参是一个空字典、写成一对花括号（不用 dict()）；节名用切片从 line 里取出来（不用 strip 去掉方括号字符） || 第一个实参是节名：line 去掉第一个和最后一个字符，再去掉两头的空白 || 切片的起点是 1、终点是 -1，后面紧跟 strip()" hintEn="Enter (or create) this section and make section point at its dictionary: call config's setdefault method with an empty dictionary written as a pair of braces as the second argument (not dict()); cut the section name out of line with a slice (not strip with the bracket characters) || The first argument is the section name: line without its first and last characters, with the whitespace at both ends stripped off || The slice starts at 1 and stops at -1, followed straight away by strip()"
            section = config.setdefault(line[1:-1].strip(), {})
# <<< BLANK
            continue
# >>> BLANK id=partition level=1 hint="在第一个等号处把 line 切成三份，依次存进 key、sep、value：用那个总是交回三份的字符串方法（不是 split，也不是从右边找的那个），等号写在双引号里" hintEn="Cut line into three at the first equals sign and unpack into key, sep and value: use the string method that always hands back three parts (not split, and not the one that searches from the right), with the equals sign in double quotes"
        key, sep, value = line.partition("=")
# <<< BLANK
        if not sep or not key.strip():
            raise ValueError(f"line {number}: expected key = value")
        if section is None:
            raise ValueError(f"line {number}: {key.strip()} is outside a section")
# >>> BLANK id=store level=1 hint="在当前这一节里记下这个设置：键和值都用不带实参的 strip 去掉两头的空白；同一个键再出现时，这一行直接覆盖前一个" hintEn="Record the setting in the current section: strip both the key and the value with strip and no arguments, taking the whitespace off both ends; when the same key comes again, this line simply overwrites the earlier one"
        section[key.strip()] = value.strip()
# <<< BLANK
    return config


def parse_or_error(text):
    try:
        return parse_config(text)
    except ValueError as e:
        return f"error: {e}"


SETTINGS = """
# game settings
[display]
width = 800
height=600
title = Space Race = Deluxe

[sound]
volume = 7
    volume = 9
"""

if __name__ == "__main__":
    config = parse_config(SETTINGS)
    print(config)
    print(config["display"]["title"], int(config["sound"]["volume"]) + 1)
    print(parse_or_error("[a]\nx = 1\njust some words\n"))
    print(parse_or_error("speed = 3\n[b]\n"))
    print(parse_or_error("[a]\n = 5\n"))
