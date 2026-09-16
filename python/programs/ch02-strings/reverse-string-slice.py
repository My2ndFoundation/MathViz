"""Reverse a string with a single slice."""


def reverse(text):
# >>> BLANK id=slice level=2 hint="一个切片就够了，不用循环、不用 reversed()：起点和终点都留空，只写一个负的步长 || 步长为负时，留空的起点表示从最后一个字符开始、留空的终点表示一直走到第一个字符为止——每一步往回退几个位置？" hintEn="One slice is enough - no loop and no reversed(): leave both start and stop empty and write only a negative step || With a negative step an empty start means begin at the last character and an empty stop means keep going through the first one - how many positions back does each move go?"
    return text[::-1]
# <<< BLANK


if __name__ == "__main__":
    for word in ("stressed", "Python", "a", ""):
        print(repr(word), "->", repr(reverse(word)))
