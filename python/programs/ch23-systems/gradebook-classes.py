"""A gradebook made of two classes: each Student keeps its own marks, the Gradebook finds students."""

GRADES = [(70, "A"), (60, "B"), (50, "C"), (40, "D")]


class StudentNotFound(Exception):
    pass


class Student:
    def __init__(self, name):
        self.name = name
        self.marks = []

    def add_mark(self, mark):
        self.marks.append(mark)

    def average(self):
# >>> BLANK id=average level=1 hint="交回分数的平均值：总和除以个数——用内置的 sum 和 len，普通除法 /（不是 //），不引入 statistics" hintEn="Return the mean of the marks: the total divided by how many there are - use the built-ins sum and len with ordinary division / (not //), and no statistics module"
        return sum(self.marks) / len(self.marks)
# <<< BLANK


def grade_for(average):
    for cutoff, letter in GRADES:
# >>> BLANK id=cutoff level=2 hint="一个 if 的头：平均分够到这条分数线就算——average 写在比较号左边；表是从高分线往下排的，所以第一条够得着的线就是答案 || 恰好等于分数线也算够到：70 分是 A" hintEn="The head of an if: the average reaches this cutoff - average on the left of the comparison; the table runs from the highest cutoff down, so the first one reached is the answer || Landing exactly on a cutoff counts as reaching it: 70 is an A"
        if average >= cutoff:
# <<< BLANK
            return letter
    return "U"


class Gradebook:
    def __init__(self):
        self.students = {}

    def record(self, name, mark):
        if name not in self.students:
            self.students[name] = Student(name)
        self.students[name].add_mark(mark)

    def find(self, name):
        if name not in self.students:
# >>> BLANK id=not-found level=2 hint="查不到这个名字：抛出本程序自己定义的那个异常，把 name 作为唯一的位置实参交进去 || 异常类定义在文件开头，名字说的就是「查无此学生」" hintEn="The name is not there: raise the exception this program defines for itself, with name as its only positional argument || The exception class is defined at the top of the file, and its name says the student was not found"
            raise StudentNotFound(name)
# <<< BLANK
        return self.students[name]

    def report(self, name):
        average = self.find(name).average()
        return f"{name} {average:.1f} {grade_for(average)}"


def run_ops(ops):
    book = Gradebook()
    results = []
    for op in ops:
        if op[0] == "mark":
            book.record(op[1], op[2])
        else:
            try:
                results.append(book.report(op[1]))
            except StudentNotFound:
                results.append("no such student")
    return results


if __name__ == "__main__":
    book = Gradebook()
    for name, mark in [("Ada", 72), ("Ben", 58), ("Ada", 67), ("Ben", 61)]:
        book.record(name, mark)
    print(book.students["Ada"].marks, book.report("Ada"), "|", book.report("Ben"))
    print(run_ops([("mark", "Dee", 40), ("report", "Dee"), ("report", "Cal")]))
