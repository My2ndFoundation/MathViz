"""Take any number of arguments with *args and **kwargs, and unpack them at the call."""


# >>> BLANK id=star-param level=1 hint="定义 total：它收任意多个位置实参，全部装进一个叫 numbers 的元组——形参名前面加一个星号" hintEn="Define total so it takes any number of positional arguments, all packed into one tuple called numbers - one star in front of the parameter name"
def total(*numbers):
# <<< BLANK
    result = 0
    for n in numbers:
        result += n
    return result


def describe(name, **details):
    print(name)
    for key, value in details.items():
        print(f"  {key} = {value}")


def show(*args, **kwargs):
    print("args:", args)
    print("kwargs:", kwargs)


if __name__ == "__main__":
    print(total())
    print(total(4, 5, 6))
    scores = [10, 20, 30]
# >>> BLANK id=star-call level=2 hint="把 scores 这个列表拆开、当成三个分开的实参交给 total，并打印结果 || 拆开用的是调用处的一个星号，写在实参前面；不要自己写 scores[0] 这类下标" hintEn="Spread the list scores out into three separate arguments for total, and print the result || the spreading is one star at the call, in front of the argument; do not write out scores[0] and the like yourself"
    print(total(*scores))
# <<< BLANK
    describe("Ada", born=1815, field="maths")
    info = {"born": 1912, "field": "computing"}
# >>> BLANK id=double-star-call level=2 hint="用字典 info 里的键值对当关键字实参调用 describe；人名 Alan 按位置写在最前（双引号字符串，不写 name=）；不要把 info 里的键值自己抄一遍 || 把字典拆成关键字实参用的是两个星号；这一行只是调用，不套 print——describe 自己会打印" hintEn="Call describe with the key-value pairs in the dictionary info as keyword arguments; the name Alan goes first by position (a string in double quotes, no name=); do not copy the keys and values out of info by hand || spreading a dictionary into keyword arguments takes two stars; this line is just the call, no print around it - describe prints for itself"
    describe("Alan", **info)
# <<< BLANK
    show(1, "two", three=3)
