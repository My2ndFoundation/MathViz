"""Turn Python data into JSON text, save it to a file, and load it back."""

import json


def save_and_load(data, path):
    with open(path, "w") as f:
# >>> BLANK id=dump level=2 hint="把 data 直接写进已打开的文件 f：用 json 里那个收文件对象的函数（名字不以 s 结尾），实参依次是 data、f，再跟两个关键字实参——与下面 dumps 那一行的两个相同、顺序也相同 || 缩进 2 个空格、键排序" hintEn="Write data straight into the open file f: use the json function that takes a file object (its name does not end in s), with data and f as its arguments, followed by two keyword arguments - the same two as on the dumps line below, in the same order || Indent by 2 spaces, and sort the keys"
        json.dump(data, f, indent=2, sort_keys=True)
# <<< BLANK
    with open(path) as f:
# >>> BLANK id=load level=1 hint="从文件 f 读回 JSON 并把得到的 Python 值直接交回去：用 json 里那个收文件对象的函数（名字不以 s 结尾），f 是唯一的实参" hintEn="Read the JSON back from the file f and return the Python value straight away: use the json function that takes a file object (its name does not end in s), with f as its only argument"
        return json.load(f)
# <<< BLANK


if __name__ == "__main__":
    record = {"name": "Ada", "marks": (91, 78), "tutor": None, "active": True}
    text = json.dumps(record, indent=2, sort_keys=True)
    print(text)
    print(type(text).__name__, len(text.splitlines()))
    back = save_and_load(record, "record.json")
    print(back)
    print(back == record, back["marks"] == list(record["marks"]))
    print(json.dumps({7: "seven", "pi": 3.5}))
    print(json.loads('{"7": "seven", "ok": false, "x": null, "n": [1, 2.5]}'))
