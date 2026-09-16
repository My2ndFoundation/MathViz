"""Reverse a string by building a new one, one character at a time."""


def reverse(text):
# >>> BLANK id=start level=1 hint="累加器从一个什么字符都没有的字符串开始，名字叫 result；用双引号，和本文件其他字符串一样" hintEn="The accumulator starts as a string with no characters in it, called result; double quotes, like every other string in this file"
    result = ""
# <<< BLANK
# >>> BLANK id=prepend level=2 hint="从头到尾把 text 的每个字符恰好看一次（循环变量叫 ch），每个字符都拼到 result 的前面、而不是后面；用 = 重新赋值，不用 += || += 只能往末尾接；要接到前面，就得把 ch 写在 + 的左边，再把拼出来的新串赋回 result" hintEn="Look at every character of text exactly once, front to back (call the loop variable ch), and stick each one on the front of result, not the end; reassign with =, not += || += can only add to the end; to add to the front, ch has to be on the left of the +, and the new string that makes is assigned back to result"
    for ch in text:
        result = ch + result
# <<< BLANK
    return result


if __name__ == "__main__":
    for word in ("stressed", "Python", "a", ""):
        print(repr(word), "->", repr(reverse(word)))
