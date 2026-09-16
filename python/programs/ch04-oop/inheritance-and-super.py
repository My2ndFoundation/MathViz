"""A subclass reuses its parent's constructor and extends one method."""


class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def describe(self):
        return f"{self.name}, {self.age}"

    def greet(self):
        return f"Hi, I am {self.name}"


# >>> BLANK id=subclass level=1 hint="定义一个叫 Student 的类，并把它的父类写在类名后面的圆括号里" hintEn="Define a class called Student, with its parent class written in round brackets after the name"
class Student(Person):
# <<< BLANK
    def __init__(self, name, age, school):
# >>> BLANK id=parent-init level=2 hint="名字和年龄交给父类的构造方法去存：用空括号的 super()，不直接写父类的名字；实参按位置传，不写 name= 这种关键字 || super() 已经替你带上了 self，所以实参只有父类要的那两个，顺序和父类的形参一样" hintEn="Hand name and age to the parent's constructor to store: use super() with empty brackets, not the parent's name written out; pass the arguments by position, not as name= keywords || super() already brings self along, so the only arguments are the two the parent asks for, in the parent's order"
        super().__init__(name, age)
# <<< BLANK
        self.school = school

    def describe(self):
# >>> BLANK id=extend-describe level=2 hint="返回一个双引号的 f-string，不用 + 拼接；第一个花括号里放父类那份 describe() 的结果，不要把 name 和 age 再写一遍 || 父类那份后面还要接的文字与学校，逐字照着输出第二行对上" hintEn="Return one double-quoted f-string, not + concatenation; the first pair of braces holds the result of the parent's describe(), rather than writing name and age out again || The text and the school that follow the parent's part should match the second line of output character for character"
        return f"{super().describe()}, studies at {self.school}"
# <<< BLANK


if __name__ == "__main__":
    p = Person("Sam", 40)
    s = Student("Ava", 17, "Hill College")
    print(p.describe())
    print(s.describe())
    print(s.greet())
    print(isinstance(s, Person), isinstance(p, Student))
    print(issubclass(Student, Person))
