"""Convert between int, float and str, and name the type you end up with."""


def describe(value):
# >>> BLANK id=describe level=3 hint="交回一句描述：左边是值本身，字符串要连引号一起显示；右边是它的类型名；中间是空格、->、空格 || 带引号的是 repr 形式，在花括号里用转换标志来要，不调用 repr()；类型名是先用 type() 取到类型，再取这个类型的名字属性 || 整条是一个双引号 f-string、两个花括号字段：第一个是 value 后面跟感叹号和 r；第二个对 value 调 type()，再用点取 __name__" hintEn="Hand back a description: the value itself on the left, with a string showing its quotes; its type name on the right; a space, ->, and a space in between || the quoted form is the repr form - ask for it with a conversion flag inside the braces rather than calling repr(); the type name comes from type() first, then that type's name attribute || the whole thing is one f-string in double quotes with two brace fields: the first is value followed by an exclamation mark and r; the second calls type() on value and reads __name__ off it with a dot"
    return f"{value!r} -> {type(value).__name__}"
# <<< BLANK


if __name__ == "__main__":
    text = "42"
    print(describe(text))
    print(describe(int(text)))
    print(describe(float(text)))
    print(describe(str(3.5)))
    print("3" + "4")
# >>> BLANK id=add-as-numbers level=2 hint="上一行把两个字符串拼成了 34，这一行要真的相加、打出 7 || 还是上一行那两个字符串字面量，各自先转成 int 再相加——转换套在每一个上，不是套在拼好的结果上" hintEn="The line above joined the two strings into 34 - this one has to really add them and print 7 || the same two string literals as the line above, each turned into an int before the addition - the conversion goes on each one, not on the joined result"
    print(int("3") + int("4"))
# <<< BLANK
    print("42" == 42, int("42") == 42)
    print(int(3.9), int(-3.9))
