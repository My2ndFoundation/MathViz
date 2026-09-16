"""Understand short typed commands with match / case (needs Python 3.10 or later)."""

DIRECTIONS = ("north", "south", "east", "west")


def run_command(line):
# >>> BLANK id=match-words level=1 hint="拿 line 按空白切出来的单词列表去做匹配：match 后面紧跟对 line 调用切分方法，不给实参" hintEn="Match against the list of words you get by splitting line on whitespace: match, followed straight away by the split method called on line, with no argument"
    match line.split():
# <<< BLANK
        case []:
            return "nothing typed"
# >>> BLANK id=quit-or-exit level=2 hint="一个 case 接住两种单词列表：写两个各只含一个单词的列表模式，中间用竖线 | 连起来（不把竖线写进同一个列表里）；单词用双引号 || 两个单词逐字是 quit 与 exit，quit 在前" hintEn="One case that catches two word lists: two list patterns holding one word each, joined by a vertical bar | (not the bar inside a single list); the words in double quotes || The two words are, exactly, quit and exit, quit first"
        case ["quit"] | ["exit"]:
# <<< BLANK
            return "goodbye"
        case ["go", direction] if direction in DIRECTIONS:
            return f"you walk {direction}"
        case ["go", _]:
            return "you cannot go that way"
        case ["take", item]:
            return f"you pick up the {item}"
# >>> BLANK id=fallback level=1 hint="最后一个 case 什么都接：用通配符，不绑定任何名字" hintEn="The last case catches everything else: use the wildcard, binding no name"
        case _:
# <<< BLANK
            return f"unknown command: {line}"


if __name__ == "__main__":
    commands = ["go north", "go up", "take lamp", "take lamp key",
                "", "exit", "dance"]
    for command in commands:
        print(repr(command), "->", run_command(command))
