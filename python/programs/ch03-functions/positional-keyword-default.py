"""Default values, keyword arguments, and the order rules that go with them."""


# >>> BLANK id=defaults level=2 hint="只有 name 必须给；greeting 与 punctuation 是可以省略的形参，按这个先后排；默认值写成双引号字符串 || 省略时 greeting 取 Hello，punctuation 取 !（一个感叹号）" hintEn="Only name has to be given; greeting and punctuation are parameters that may be left out, in that order; write the defaults as strings in double quotes || When left out, greeting is Hello and punctuation is ! (a single exclamation mark)"
def make_greeting(name, greeting="Hello", punctuation="!"):
# <<< BLANK
    return f"{greeting}, {name}{punctuation}"


if __name__ == "__main__":
    print(make_greeting("Ada"))
    print(make_greeting("Ada", "Hi"))
# >>> BLANK id=skip-one level=2 hint="只改标点、问候语留默认：name 照前两行按位置给，punctuation 用关键字实参给，greeting 一个字都不写；字符串用双引号 || 标点是问号；整个调用仍然放在 print 里" hintEn="Change only the punctuation and leave the greeting at its default: name by position as in the two lines above, punctuation as a keyword argument, and greeting not written at all; strings in double quotes || the punctuation is a question mark; the whole call still sits inside print"
    print(make_greeting("Ada", punctuation="?"))
# <<< BLANK
    print(make_greeting(punctuation=".", name="Alan"))
    print(make_greeting("Grace", greeting="Welcome", punctuation="."))
    # make_greeting(name="Ada", "Hi") is rejected before the program runs:
    # SyntaxError: positional argument follows keyword argument
