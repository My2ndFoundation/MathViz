"""Pull every whole number out of messy text with a regular expression."""

import re


def find_numbers(text):
# >>> BLANK id=findall level=2 hint="用 re 模块的 findall 在 text 里找出全部匹配，列表存进 matches；模式写成双引号的原始字符串，数字用简写的数字类（反斜杠加 d，不用方括号里写 0-9 的范围），负号就写它本身、用一个单字符的量词标成可有可无；整个模式里不用花括号写次数 || 模式从左到右是：一个可有可无的负号，然后一个或多个数字" hintEn="Use findall from the re module to collect every match in text and keep the list in matches; write the pattern as a raw string in double quotes, with the shorthand digit class (backslash d, not a 0-9 range in square brackets); the minus sign is written as itself and made optional with a one-character quantifier; no counts in braces anywhere in the pattern || Read left to right, the pattern is: an optional minus sign, then one or more digits"
    matches = re.findall(r"-?\d+", text)
# <<< BLANK
# >>> BLANK id=to-ints level=1 hint="把 matches 里的每个字符串转成 int，用列表推导式直接交回去，循环变量叫 m（不用 map）" hintEn="Turn every string in matches into an int and return the result straight away with a list comprehension whose loop variable is m (not map)"
    return [int(m) for m in matches]
# <<< BLANK


def find_codes(text):
    return re.findall(r"[A-Z]{2}\d+", text)


if __name__ == "__main__":
    line = "Room B12: 3 chairs, -4 C at 07:30, total=15kg; ref AB123-9 and x-2"
    print(find_numbers(line))
    print(find_codes(line))
    print(re.findall(r"\d", "a1b22"))
    print(re.findall(r"\d+", "a1b22"))
    print(re.findall(r"\d*", "a1b22"))
    print(re.findall(r"colou?r", "color colour colouur"))
    print(re.findall(r"[aeiou]", "regular expression"))
    print(len("\b"), len(r"\b"), r"\d" == "\\d")
