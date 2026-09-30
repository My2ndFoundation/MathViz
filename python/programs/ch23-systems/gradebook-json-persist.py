"""Save a gradebook of objects as JSON, then load it back as objects equal to the originals."""

import json
from pathlib import Path


class Student:
    def __init__(self, name, marks=()):
        self.name = name
        self.marks = list(marks)

    def to_dict(self):
# >>> BLANK id=to-dict level=2 hint="交回一个字典字面量，两个键依次是 name 和 marks（双引号），值取自这个对象自己的两个属性 || 键名与 from_dict 里读的那两个键一模一样" hintEn="Return a dictionary literal with two keys, name then marks (double quotes), whose values are this object's own two attributes || The keys are exactly the two keys that from_dict reads"
        return {"name": self.name, "marks": self.marks}
# <<< BLANK

    @classmethod
    def from_dict(cls, data):
# >>> BLANK id=from-dict level=2 hint="用 cls 造一个新对象交回去：两个位置实参按 __init__ 的顺序，从 data 里按键取出（双引号） || 先取 name 那个键，再取 marks 那个键" hintEn="Build a new object with cls and return it: two positional arguments in the order __init__ takes them, looked up in data by key (double quotes) || First the name key, then the marks key"
        return cls(data["name"], data["marks"])
# <<< BLANK

    def __eq__(self, other):
        return self.name == other.name and self.marks == other.marks


class Gradebook:
    def __init__(self, students=()):
        self.students = {s.name: s for s in students}

    def record(self, name, mark):
        self.students.setdefault(name, Student(name)).marks.append(mark)

    def to_dict(self):
        return {"students": [s.to_dict() for s in self.students.values()]}

    @classmethod
    def from_dict(cls, data):
        return cls(Student.from_dict(d) for d in data["students"])

    def __eq__(self, other):
        return self.students == other.students


def save(book, path):
    with open(path, "w") as f:
        json.dump(book.to_dict(), f, indent=2)


def load(path):
    if not Path(path).exists():
        return Gradebook()
    with open(path) as f:
# >>> BLANK id=load-back level=2 hint="一行 return：先用 json 模块从文件对象 f 读出普通的字典，再交给 Gradebook 的备用构造器变回对象；读文件对象用 json.load，不用 json.loads(f.read()) || 备用构造器就是上面那个 classmethod" hintEn="One return line: use the json module to read a plain dictionary from the file object f, then hand it to Gradebook's alternative constructor to turn it back into objects; read the file object with json.load, not json.loads(f.read()) || The alternative constructor is the classmethod above"
        return Gradebook.from_dict(json.load(f))
# <<< BLANK


if __name__ == "__main__":
    book = load("gradebook.json")
    print(len(book.students), "students at the start")
    book.record("Ada", 72)
    book.record("Ben", 58)
    book.record("Ada", 65)
    save(book, "gradebook.json")
    print(Path("gradebook.json").read_text())
    again = load("gradebook.json")
    print(again == book, again is book)
    print(again.students["Ada"].marks, type(again.students["Ada"]).__name__)
