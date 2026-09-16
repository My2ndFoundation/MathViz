"""Decide whether a phrase reads the same backwards, ignoring case, spaces and punctuation."""


def clean(text):
    kept = ""
    for ch in text:
# >>> BLANK id=keep level=2 hint="只留下字母和数字（一个 is 开头的方法同时认这两类），留下的那个字符先改成小写再接到 kept 末尾，接用 += || 外层一个 if 问这个字符是不是字母或数字；里面一行把它的小写形式加到 kept 上" hintEn="Keep only letters and digits (one method starting with is accepts both), and add the kept character to the end of kept in lower case, using += || An if asks whether this character is a letter or a digit; the line inside adds its lower-case form onto kept"
        if ch.isalnum():
            kept += ch.lower()
# <<< BLANK
    return kept


def is_palindrome(text):
    letters = clean(text)
# >>> BLANK id=compare level=1 hint="交回一个比较：规整后的 letters 写在 == 左边，右边是把它整个倒过来的那个切片" hintEn="Hand back a comparison: the cleaned-up letters on the left of ==, and on the right the slice that is the whole of it reversed"
    return letters == letters[::-1]
# <<< BLANK


if __name__ == "__main__":
    tests = (
        "Racecar",
        "A man, a plan, a canal: Panama!",
        "Was it a car or a cat I saw?",
        "No 'x' in Nixon",
        "Python",
        "12 21",
        "",
    )
    for phrase in tests:
        print(is_palindrome(phrase), repr(clean(phrase)))
