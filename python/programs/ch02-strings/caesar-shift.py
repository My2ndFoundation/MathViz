"""Caesar cipher: move every letter along the alphabet and leave everything else alone."""


def shift_char(ch, key):
    if "a" <= ch <= "z":
        base = ord("a")
# >>> BLANK id=upper level=1 hint="和上面小写那一支写成对称的样子：elif 加同样的连写比较（不用 isupper()），下一行同样用 ord() 把 base 设成大写字母表起点的编码（不直接写数字）；字符串用双引号" hintEn="Mirror the lower-case branch above: an elif with the same chained comparison (not isupper()), and on the next line base set with ord() to the code of the start of the upper-case alphabet (not a bare number); double quotes for the strings"
    elif "A" <= ch <= "Z":
        base = ord("A")
# <<< BLANK
    else:
        return ch
# >>> BLANK id=shift level=3 hint="一行 return 写完，不用中间变量。项的顺序钉死：括号里先减 base、再加 key；取余之后 base 加在最后，不写在最前；除了 chr() 自己的，只加必需的那一对括号 || ord(ch) - base 把字母变成 0 到 25 的位置；加上 key 之后它可能跑出 25，也可能变成负数 || 对 26 取余把位置绕回 0 到 25（Python 里负数也一样绕得回来）；加回 base 变回这一套字母表里的编码，最后用 chr() 把编码变回字符" hintEn="Write it in one return line with no intermediate variable. The order of the terms is fixed: inside the brackets subtract base first, then add key; after the remainder, base is added at the end, not written at the front; apart from chr() itself, only the one pair of brackets that is really needed || ord(ch) - base turns the letter into a position from 0 to 25; once key is added it may go past 25, or below 0 || Taking the remainder by 26 wraps the position back into 0 to 25 (in Python negative positions wrap too); adding base turns it back into a code in the right alphabet, and chr() finally turns the code into a character"
    return chr((ord(ch) - base + key) % 26 + base)
# <<< BLANK


def caesar(text, key):
    result = ""
    for ch in text:
        result += shift_char(ch, key)
    return result


if __name__ == "__main__":
    secret = caesar("Hello, World!", 3)
    print(secret)
    print(caesar(secret, -3))
    print(caesar("xyz XYZ", 3))
    print(caesar("abc", 29), caesar("abc", -1))
    print(ord("a"), ord("A"), ord("z") - ord("a"), chr(100))
