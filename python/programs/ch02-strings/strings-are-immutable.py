"""Strings cannot be changed in place, so every change builds a new string."""


def replace_at(text, index, ch):
# >>> BLANK id=rebuild level=2 hint="不能改 text 本身，只能拼一个新串交回去：下标之前的那一段、新字符、下标之后的那一段，按这个顺序用 + 连起来；第一段切片的起点留空 || 前一段切到 index 为止（不含 index）；后一段从 index 的下一个位置切到末尾，终点留空" hintEn="text itself cannot be changed, so build a new string and hand it back: the piece before the index, the new character, the piece after the index, joined with + in that order; leave the start of the first slice empty || The first piece stops at index (index itself not included); the last piece starts one position after index and runs to the end, stop left empty"
    return text[:index] + ch + text[index + 1:]
# <<< BLANK


if __name__ == "__main__":
    name = "python"
    try:
# >>> BLANK id=assign level=1 hint="试着把大写的 P 直接写进 name 的第 0 个位置——正是 Python 不允许的那件事，所以下一行会接住一个 TypeError；字符串用双引号，和本文件其他字符串一样" hintEn="Try to write a capital P straight into position 0 of name - exactly the thing Python refuses to do, which is why the next line catches a TypeError; put the string in double quotes like every other string in this file"
        name[0] = "P"
# <<< BLANK
    except TypeError as err:
        print("TypeError:", err)
    print(name)
    fixed = name[0].upper() + name[1:]
    print(fixed, name)
    print(replace_at("cat", 1, "u"))
    greeting = "Hello, world"
# >>> BLANK id=replace level=2 hint="用字符串方法造一个把 world 换成 Python 的新串，存进变量 shouted；greeting 自己不变（下面会打印它来证明）；字符串用双引号 || 方法的第一个实参是要找的旧片段，第二个是换上去的新片段" hintEn="Use a string method to make a new string with world swapped for Python, and store it in a variable called shouted; greeting itself does not change (it gets printed below to prove it); put the strings in double quotes || The method's first argument is the old piece to look for, the second is the new piece to put in its place"
    shouted = greeting.replace("world", "Python")
# <<< BLANK
    print(greeting)
    print(shouted)
    before = greeting
    greeting = greeting + "!"
    print(before)
    print(greeting)
