"""Convert between int, float and str, and name the type you end up with."""


def describe(value):
# >>> BLANK id=describe level=3 hint="交回一个双引号 f-string：左边是值本身，字符串要连引号显示；右边是它的类型名；中间是空格、->、空格。引号靠花括号里的转换标志来要，不调用 repr()；类型从 type() 取 || 转换标志写在字段里值的后面：一个感叹号加一个字母，repr 对应 r；type() 交回的是类型对象，它的名字存在一个两边带双下划线的属性里 || 两个花括号字段：第一个只放 value 和它的转换标志；第二个是 type(value) 后面用点取 __name__" hintEn="Hand back an f-string in double quotes: the value itself on the left, with a string showing its quotes; its type name on the right; a space, ->, and a space in between. Get the quotes from a conversion flag inside the braces rather than calling repr(), and get the type from type() || a conversion flag goes after the value inside its field: an exclamation mark and one letter, r for repr; type() hands back a type object whose name sits in an attribute wrapped in double underscores || two brace fields: the first holds just value and its conversion flag; the second is type(value) with __name__ read off it after a dot"
    return f"{value!r} -> {type(value).__name__}"
# <<< BLANK


if __name__ == "__main__":
    text = "42"
    print(describe(text))
    print(describe(int(text)))
    print(describe(float(text)))
    print(describe(str(3.5)))
    print("3" + "4")
# >>> BLANK id=add-as-numbers level=2 hint="上一行把两个字符串拼成了 34；这一行拿同样那两个字符串字面量真的相加、打出 7 || 各自先转成 int 再相加——转换套在每一个上，不是套在拼好的结果上" hintEn="The line above joined the two strings into 34; this one takes the same two string literals and really adds them, printing 7 || each one is turned into an int before the addition - the conversion goes on each one, not on the joined result"
    print(int("3") + int("4"))
# <<< BLANK
    print("42" == 42, int("42") == 42)
    print(int(3.9), int(-3.9))
