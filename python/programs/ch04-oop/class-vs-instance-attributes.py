"""Class attributes are shared by every instance; instance attributes are not."""


class Student:
    count = 0
    clubs = []

    def __init__(self, name):
        self.name = name
# >>> BLANK id=own-list level=1 hint="每个学生自己的一张空列表，名叫 subjects：挂在 self 上，用一对方括号写空列表，不用 list()" hintEn="An empty list of this student's own, called subjects: hang it on self, and write the empty list as a pair of square brackets, not list()"
        self.subjects = []
# <<< BLANK
# >>> BLANK id=bump-count level=2 hint="计数器属于整个类，所以通过类名找到它，不通过 self；用 += 加一 || 如果写成 self 点它再 +=，Python 会给这一个实例新建一个同名属性，类上的那个计数器一动不动" hintEn="The counter belongs to the whole class, so reach it through the class name, not through self; add one with += || Written as self-dot-it with +=, Python would create a brand-new attribute of the same name on this one instance, and the counter on the class would never move"
        Student.count += 1
# <<< BLANK

    def join(self, club):
        self.clubs.append(club)


if __name__ == "__main__":
    ann = Student("Ann")
    ben = Student("Ben")
    print(Student.count, ann.count, ben.count)
    ann.subjects.append("Maths")
    print(ann.subjects, ben.subjects)
    ann.join("Chess")
    print(ann.clubs, ben.clubs, Student.clubs)
    ben.count = 99
    print(Student.count, ann.count, ben.count)
