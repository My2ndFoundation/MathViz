"""Skip blank lines and comments, and stop reading at END."""


def read_commands(lines):
    commands = []
    for line in lines:
# >>> BLANK id=tidy level=1 hint="先把这一行两端的空白去掉、存回 line：用字符串那个不带参数的去两端空白的方法（不是只去一端的那两个）" hintEn="First remove the whitespace from both ends of this line and store it back in line: use the string method that strips both ends, called with no arguments (not one of the two that strip only one end)"
        line = line.strip()
# <<< BLANK
        if line == "" or line.startswith("#"):
# >>> BLANK id=skip level=1 hint="这一行不要了，但循环不结束：跳过本轮剩下的语句，直接去拿下一行——一个关键字" hintEn="This line is not wanted, but the loop is not over: skip the rest of this pass and go straight to the next line - a single keyword"
            continue
# <<< BLANK
# >>> BLANK id=stop level=2 hint="遇到结束标记就整个离开循环，后面的行一行都不再看：一个 if 用 == 比较，line 写在左边、标记字符串在右边用双引号；下一行一个关键字 || 结束标记就是文档串里那个全大写的单词" hintEn="On the end marker leave the loop altogether, without looking at any later line: an if comparing with ==, line on the left and the marker string on the right in double quotes; a single keyword on the next line || The end marker is the all-capitals word in the docstring"
        if line == "END":
            break
# <<< BLANK
        commands.append(line)
    return commands


if __name__ == "__main__":
    script = [
        "# robot script",
        "forward 3",
        "",
        "left",
        "   # turn to face the door",
        "forward 1",
        "END",
        "forward 99",
    ]
    commands = read_commands(script)
    for command in commands:
        print(command)
    print(len(commands), "commands read")
