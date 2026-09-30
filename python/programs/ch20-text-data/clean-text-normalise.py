"""Clean text before comparing it: lower case, no punctuation, single spaces."""

import string

# >>> BLANK id=make-table level=2 hint="用 str 这个类自己的 maketrans 方法（不是从某个字符串上点出来）造一张翻译表，给三个实参：前两个都是空字符串（双引号），第三个是 string 模块里那个装着全部标点的常量 || 前两个空串的意思是「不把任何字符换成别的字符」；第三个实参列出的字符会被删掉——它就是 string.punctuation" hintEn="Build a translation table with maketrans called on the str class itself (not on some string), with three arguments: the first two are both empty strings (double quotes), the third is the constant in the string module that holds every punctuation character || The two empty strings mean 'swap no character for another'; the characters listed in the third argument are deleted - it is string.punctuation"
REMOVE_PUNCTUATION = str.maketrans("", "", string.punctuation)
# <<< BLANK


def clean(text):
    lowered = text.lower()
    no_punct = lowered.translate(REMOVE_PUNCTUATION)
# >>> BLANK id=split-words level=1 hint="把 no_punct 按空白切成单词列表，存进 words——split 不给任何实参，这样连续的空格、制表符、换行都算一处分隔，首尾的空白也不会切出空串" hintEn="Cut no_punct into a list of words and keep it in words - call split with no arguments at all, so a run of spaces, tabs or newlines counts as one gap and whitespace at either end gives no empty strings"
    words = no_punct.split()
# <<< BLANK
# >>> BLANK id=join-words level=1 hint="把 words 用恰好一个空格重新连成一个字符串并交回去：在分隔串（双引号里一个空格）上调用 join" hintEn="Glue words back into one string with exactly one space between neighbours and return it: call join on the separator (one space in double quotes)"
    return " ".join(words)
# <<< BLANK


def same_text(a, b):
    return clean(a) == clean(b)


if __name__ == "__main__":
    samples = [
        "  Hello,   World!  ",
        "hello world",
        "It's a TEST... isn't it?",
        "Tabs\tand\nnewlines   too",
        "Rock 'n' roll -- 1950s!",
    ]
    for s in samples:
        print(repr(clean(s)))
    print(same_text("Hello, World!", "hello   world"))
    print("Hello, World!" == "hello   world")
    print(same_text("Don't STOP", "dont stop"))
