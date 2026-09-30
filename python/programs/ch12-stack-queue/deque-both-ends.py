"""A deque adds and removes at both ends; with maxlen it keeps only the newest items."""
from collections import deque


def recent_pages(visits, keep):
# >>> BLANK id=maxlen level=2 hint="造一个空的双端队列存进 history，并让它最多只留 keep 项：只给一个关键字实参，不给位置实参 || 那个关键字实参的名字是 max 加上 len" hintEn="Build an empty deque in history that holds at most keep items: give it a single keyword argument and no positional ones || The keyword argument's name is max followed by len"
    history = deque(maxlen=keep)
# <<< BLANK
    for page in visits:
        history.append(page)
    return list(history)


if __name__ == "__main__":
    line = deque(["b", "c"])
# >>> BLANK id=left level=1 hint="从左端放进一个只含小写字母 a 的字符串：用 deque 专有的那个方法（不是 insert），字符串用双引号" hintEn="Put in a string holding just the lower-case letter a, at the left end: with the method only a deque has (not insert), and the string in double quotes"
    line.appendleft("a")
# <<< BLANK
    line.append("d")
    print(line, len(line), line[0], line[-1])
# >>> BLANK id=take level=2 hint="两行：先从左端取下一项存进 first，再从右端取下一项存进 last；每行一个方法调用 || 左端用 deque 专有的那个取法；右端的取法与列表同名" hintEn="Two lines: first take an item off the left end into first, then one off the right end into last; one method call per line || The left end uses the method only a deque has; the right end's method has the same name as the list one"
    first = line.popleft()
    last = line.pop()
# <<< BLANK
    print(first, last, line)
    print(recent_pages(["home", "news", "sport", "weather", "news"], 3))
    print(recent_pages(["home"], 3))
