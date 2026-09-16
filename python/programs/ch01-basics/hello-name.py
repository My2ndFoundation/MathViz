"""Read a name from the keyboard and greet it."""


def greet(name):
# >>> BLANK id=greeting level=2 hint="交回一句问候：Hello、逗号、空格、名字、感叹号 || 用 f-string 把 name 直接嵌进句子里，不用 + 拼接；双引号，和本文件其他字符串一样" hintEn="Hand back a greeting made of: the word Hello; a comma; a space; the name; an exclamation mark || make it an f-string with name placed straight inside the sentence rather than joined on with +, in double quotes like every other string in this file"
    return f"Hello, {name}!"
# <<< BLANK


if __name__ == "__main__":
    who = input("What is your name? ")
# >>> BLANK id=show-greeting level=1 hint="greet() 只把句子交回来、自己不打印——把刚读到的 who 交给它，再把交回来的句子打印出来" hintEn="greet() only hands the sentence back and prints nothing itself - give it who, the name just read, and print the sentence that comes back"
    print(greet(who))
# <<< BLANK
    print(f"Your name has {len(who)} letters.")
