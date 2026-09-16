"""Give a class a readable __str__ and an unambiguous __repr__."""


class Book:
    def __init__(self, title, pages):
        self.title = title
        self.pages = pages

# >>> BLANK id=str-method level=2 hint="给人看的那个：方法名前后各两个下划线，只收 self；返回一个双引号的 f-string，不用 + 拼接，花括号里直接放两个属性、不套 str() || 照输出第一行的样子拼：书名、一个空格，再把页数和那个单词一起放进圆括号" hintEn="The one meant for people: two underscores either side of the name, taking only self; return one double-quoted f-string, not + concatenation, with the two attributes placed straight into the braces and no str() around them || Shape it like the first line of the output: the title, a space, then the page count and the word after it together in round brackets"
    def __str__(self):
        return f"{self.title} ({self.pages} pages)"
# <<< BLANK

# >>> BLANK id=repr-method level=2 hint="给开发者看的那个，同样只收 self、返回一个双引号的 f-string；类名直接写出来；两个字段都用 !r 转换，不在花括号里调 repr()，也不自己加引号 || 目标是一段看上去像重新造出这本书的代码：类名、圆括号、书名和页数用逗号加空格隔开" hintEn="The one meant for developers, again taking only self and returning one double-quoted f-string; write the class name out; apply the !r conversion to both fields, rather than calling repr() inside the braces or adding quotes yourself || The goal is text that looks like the code that would rebuild this book: the class name, round brackets, title and pages separated by a comma and a space"
    def __repr__(self):
        return f"Book({self.title!r}, {self.pages!r})"
# <<< BLANK


if __name__ == "__main__":
    book = Book("Dune", 412)
    print(book)
    print(str(book))
    print(repr(book))
    print([book, Book("Emma", 474)])
    print(f"{book}")
    print(f"{book!r}")
