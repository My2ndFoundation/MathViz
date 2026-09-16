"""A second way to build an object, and a helper that needs no object at all."""


class Date:
    def __init__(self, day, month, year):
        self.day = day
        self.month = month
        self.year = year

# >>> BLANK id=alt-constructor level=2 hint="两行：先是让方法收到类本身而不是实例的那个装饰器，再是方法头；方法名 from_string，第一个形参按惯例叫 cls，第二个叫 text || 这个方法不需要任何已有的 Date 对象，调用时写的是 Date 点它" hintEn="Two lines: first the decorator that makes the method receive the class itself instead of an instance, then the header; the method is from_string, its first parameter is cls by convention and its second is text || The method needs no existing Date object: it is called as Date-dot-its-name"
    @classmethod
    def from_string(cls, text):
# <<< BLANK
        day, month, year = text.split("/")
# >>> BLANK id=build-with-cls level=2 hint="用 cls 造对象，不写死类名 Date；三个实参按位置传、不写关键字，每个都先转成整数 || 实参顺序跟 __init__ 一样：先日、再月、再年，每个都包一层 int()" hintEn="Build the object with cls rather than hard-coding the name Date; pass the three arguments by position, not as keywords, each turned into a whole number first || The arguments go in __init__'s order - day, month, year - each wrapped in int()"
        return cls(int(day), int(month), int(year))
# <<< BLANK

# >>> BLANK id=no-self level=1 hint="下面这个方法既不收 self 也不收 cls：它前面该放的是那个表示「和对象、和类都无关」的装饰器" hintEn="The method below takes neither self nor cls: the decorator in front of it is the one that says it has nothing to do with any object or with the class"
    @staticmethod
# <<< BLANK
    def is_leap_year(year):
        return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

    def __str__(self):
        return f"{self.year}-{self.month:02d}-{self.day:02d}"


class SchoolDate(Date):
    pass


if __name__ == "__main__":
    d = Date.from_string("29/02/2024")
    print(d)
    print(Date.is_leap_year(2024), Date.is_leap_year(1900))
    print(d.is_leap_year(d.year))
    print(type(SchoolDate.from_string("01/09/2025")).__name__)
