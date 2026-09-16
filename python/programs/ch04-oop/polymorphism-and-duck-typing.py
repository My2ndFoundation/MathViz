"""One call, different behaviour - and a class that joins in without inheriting."""


class Shape:
    def area(self):
        return 0


class Rectangle(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height


# Not a Shape at all: it only happens to have an area() method.
# >>> BLANK id=no-parent level=1 hint="定义一个叫 Plot 的类，但它不继承任何类：类名后面连一对空的圆括号也不写" hintEn="Define a class called Plot that inherits from nothing: do not even write an empty pair of round brackets after the name"
class Plot:
# <<< BLANK
    def __init__(self, acres):
        self.acres = acres

    def area(self):
        return self.acres * 4047


def total_area(things):
    total = 0
    for thing in things:
# >>> BLANK id=same-call level=1 hint="不管 thing 是哪一类，都只问它同一个问题：调它的 area() 方法，用 += 累加进 total，不写 isinstance 判断" hintEn="Whatever class thing is, ask it the same one question: call its area() method and add the answer into total with +=, with no isinstance test"
        total += thing.area()
# <<< BLANK
    return total


if __name__ == "__main__":
    things = [Rectangle(3, 4), Shape(), Plot(2)]
    for thing in things:
        print(type(thing).__name__, thing.area())
    print(total_area(things))
    print(isinstance(things[2], Shape))
