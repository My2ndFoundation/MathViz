"""Escape sequences, raw strings, and what len() really counts."""


def backslash_count(text):
# >>> BLANK id=count level=2 hint="交回 text 里反斜杠的个数：用字符串的计数方法；要数的那个反斜杠写成普通双引号串里的转义形式（不用 r 串） || 在普通字符串里，一个真正的反斜杠要写两个字符——反斜杠本身也得被转义" hintEn="Hand back how many backslashes are in text, using the string counting method; write the backslash you are counting as an escape inside an ordinary double-quoted string (not an r-string) || In an ordinary string one real backslash takes two characters to write - the backslash has to be escaped too"
    return text.count("\\")
# <<< BLANK


if __name__ == "__main__":
    two_lines = "first\nsecond"
    print(two_lines)
    print(repr(two_lines), len(two_lines))
    print("name\tmark")
    print("Ada\t91")
    print("She said \"hi!\"", len("\"hi!\""))
    print(repr('It\'s'), repr("\\"), len("\\"))
    path = "C:\\temp\\new"
# >>> BLANK id=raw level=2 hint="写出和上一行 path 一模一样的字符串，存进 raw_path，但这次用原始字符串，每个反斜杠只写一个；前缀用小写字母、字符串用双引号 || 原始字符串里反斜杠不再开启转义，所以它后面的 t 和 n 就是普通字母" hintEn="Write the very same string as path on the line above and store it in raw_path, but this time as a raw string with each backslash written only once; a lower-case prefix letter and double quotes || In a raw string a backslash no longer starts an escape, so the t and the n after it are just letters"
    raw_path = r"C:\temp\new"
# <<< BLANK
    print(path)
    print(path == raw_path, len(path), len(raw_path))
    oops = "C:\temp\new"
    print(oops)
    print(len(oops), backslash_count(oops), backslash_count(raw_path))
