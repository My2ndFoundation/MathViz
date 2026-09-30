"""Load nested JSON from a file and dig values out of it."""

import json


def students_average(json_text):
    data = json.loads(json_text)
    result = {}
    for student in data["students"]:
        marks = student["marks"]
# >>> BLANK id=average level=2 hint="以这个学生的名字为键，存进 result：值是 marks 的平均分、用 round 保留 1 位小数（位数作为第二个位置实参，不写关键字）；名字从 student 里按键取（双引号），平均用 sum 除以 len || round 的第二个实参是 1" hintEn="Store into result under this student's name: the value is the mean of marks rounded with round to 1 decimal place (the number of places as a second positional argument, no keyword); take the name out of student by its key (double quotes), and work the mean out as sum divided by len || round's second argument is 1"
        result[student["name"]] = round(sum(marks) / len(marks), 1)
# <<< BLANK
    return result


def tutor_room(student):
# >>> BLANK id=get-tutor level=1 hint="用字典的 get 方法取 student 的 tutor（双引号），键不存在时得到 None 而不是 KeyError——只给键这一个实参，不给默认值；存进 tutor" hintEn="Use the dictionary method get to take the tutor (double quotes) out of student, so a missing key gives None instead of a KeyError - pass the key as the only argument, with no default; keep it in tutor"
    tutor = student.get("tutor")
# <<< BLANK
    if tutor is None:
        return "no tutor"
    return tutor["room"]


if __name__ == "__main__":
    with open("_fixtures/students.json") as f:
        text = f.read()
    data = json.loads(text)
    print(data["group"], len(data["students"]))
# >>> BLANK id=dig level=2 hint="打印第一个学生的导师的名字：从 data 出发一路用方括号往下取——先取学生列表，再取下标 0，再取导师，最后取名字；键都用双引号 || 四个方括号依次装着：students、0、tutor、name" hintEn="Print the first student's tutor's name: start from data and go down with square brackets - the list of students, then index 0, then the tutor, and last the name; every key in double quotes || The four pairs of brackets hold, in order: students, 0, tutor, name"
    print(data["students"][0]["tutor"]["name"])
# <<< BLANK
    print(data["students"][1]["marks"][-1])
    print(students_average(text))
    for student in data["students"]:
        print(student["name"], tutor_room(student))
    try:
        print(data["students"][2]["tutor"])
    except KeyError:
        print("KeyError: Chen has no tutor key")
