"""Split an arithmetic expression into tokens with one regular expression."""

import re

# >>> BLANK id=pattern level=3 hint="用 re 模块的 compile 把模式编译好存进 TOKEN；模式是双引号的原始字符串，由竖线分成两个选项，数字那一项在前：一个或多个数字，用简写的数字类（反斜杠加 d）和加号（不用方括号范围，不用花括号次数）；运算符那一项里只有减号前加反斜杠转义，其余符号原样写 || 第二项：一个方括号字符类，列出四个运算符与两个括号 || 字符类里的顺序是 加、减、乘、除、左括号、右括号" hintEn="Compile the pattern with compile from the re module and keep it in TOKEN; the pattern is a raw string in double quotes, split into two alternatives by a vertical bar, numbers first: one or more digits, with the shorthand digit class (backslash d) and a plus (not a range in square brackets, not a count in braces); in the operators alternative only the minus gets a backslash, every other symbol is written as it is || Second alternative: a character class in square brackets listing the four operators and the two brackets || Inside the class the order is plus, minus, times, divide, open bracket, close bracket"
TOKEN = re.compile(r"\d+|[+\-*/()]")
# <<< BLANK


def tokenise(text):
# >>> BLANK id=findall level=1 hint="调用编译好的 TOKEN 自己的 findall 方法（不是 re.findall），text 是唯一的实参；结果存进 tokens" hintEn="Call the findall method of the compiled TOKEN itself (not re.findall), with text as the only argument; keep the result in tokens"
    tokens = TOKEN.findall(text)
# <<< BLANK
# >>> BLANK id=rejoin level=2 hint="记号拼回去若不等于去掉全部空白之后的原串，就进入这个 if：不等号两边都是在空字符串（双引号）上调用 join，左边拼 tokens || 右边拼的是 text 用不带实参的 split 切出来的那些片段" hintEn="Enter this if when the tokens glued back together differ from the original with all its whitespace removed: both sides of the not-equal are join called on an empty string (double quotes), the left side joining tokens || The right side joins the pieces that split with no arguments cuts text into"
    if "".join(tokens) != "".join(text.split()):
# <<< BLANK
        raise ValueError("unexpected character in expression")
    return tokens


def tokenise_or_none(text):
    try:
        return tokenise(text)
    except ValueError:
        return None


if __name__ == "__main__":
    for expr in ["12*(3+45)", " 7 - 2/ 10 ", "(1+2)*3^2", "3 + x", ""]:
        try:
            print(tokenise(expr))
        except ValueError as e:
            print("error:", e)
    print(tokenise_or_none("4 % 2"), tokenise_or_none("40 2"))
    print(TOKEN.findall("3 + x"), "".join("3 + x".split()))
