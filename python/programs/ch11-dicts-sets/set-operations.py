"""Compare two club rosters with set operations."""


def show(label, names):
    print(label, sorted(names))


if __name__ == "__main__":
    chess = {"Ada", "Ben", "Cara", "Dev"}
    drama = {"Cara", "Dev", "Eli"}
    show("either:", chess | drama)
# >>> BLANK id=both level=2 hint="和上下几行一样调用 show：标签是双引号字符串 both:（冒号紧跟，前后没有空格），第二个实参用运算符符号求两个社团都有的人，不调用方法；chess 写在左边 || 「两边都有」是交集，它的运算符和按位与是同一个符号" hintEn="Call show like the lines around it: the label is the double-quoted string both: (colon attached, no spaces round it), and the second argument uses an operator symbol, not a method, for the people in both clubs; chess on the left || In both is the intersection, and its operator is the same symbol as bitwise and"
    show("both:", chess & drama)
# <<< BLANK
    show("chess only:", chess - drama)
# >>> BLANK id=exactly-one level=2 hint="再调用一次 show：标签是双引号字符串 exactly one:（中间一个空格，冒号紧跟），第二个实参用运算符符号求「只在其中一个社团」的人，不调用方法；chess 写在左边 || 这叫对称差：并集减去交集。它的运算符是按位异或的那个符号" hintEn="Call show once more: the label is the double-quoted string exactly one: (one space in the middle, colon attached), and the second argument uses an operator symbol, not a method, for the people in exactly one of the clubs; chess on the left || This is the symmetric difference: the union minus the intersection. Its operator is the bitwise exclusive-or symbol"
    show("exactly one:", chess ^ drama)
# <<< BLANK
    print({"Cara", "Dev"} <= chess, drama <= chess)
    drama.add("Ben")
    drama.add("Ben")
    show("drama now:", drama)
# >>> BLANK id=discard level=1 hint="把 Zed 从 drama 里拿掉——他本来就不在里面，所以要用那个「不在也不报错」的方法；名字写成双引号字符串" hintEn="Take Zed out of drama - he was never in it, so use the method that does not complain when the item is missing; write the name as a double-quoted string"
    drama.discard("Zed")
# <<< BLANK
    try:
        drama.remove("Zed")
    except KeyError as e:
        print("remove:", type(e).__name__)
