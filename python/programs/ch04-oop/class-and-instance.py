"""Define a class once and build two independent objects from it."""


class Dog:
# >>> BLANK id=init-header level=1 hint="构造方法的头一行：第一个形参是每个方法都有的那个对象自己，后面按下面几行用到的顺序接 name、age" hintEn="The header of the constructor: the first parameter is the object itself, as in every method, followed by name and age in the order the lines below use them"
    def __init__(self, name, age):
# <<< BLANK
        self.name = name
        self.age = age
        self.tricks = []

    def add_trick(self, trick):
# >>> BLANK id=append-trick level=1 hint="把这一个 trick 加到这条狗自己的列表末尾：用列表的 append 方法，不用 += 拼一个新列表" hintEn="Add this one trick to the end of this dog's own list: use the list's append method, not += with a new list"
        self.tricks.append(trick)
# <<< BLANK

    def describe(self):
        return f"{self.name} is {self.age} and knows {len(self.tricks)} tricks"


if __name__ == "__main__":
    rex = Dog("Rex", 3)
    fido = Dog("Fido", 5)
    rex.add_trick("sit")
    rex.add_trick("roll over")
    print(rex.describe())
    print(fido.describe())
    print(rex.tricks, fido.tricks)
    fido.age = 6
    print(rex.age, fido.age)
    print(type(rex).__name__, rex is fido)
