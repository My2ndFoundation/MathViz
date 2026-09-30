"""Split an arithmetic expression into tokens, one character at a time."""

OPERATORS = "+-*/()"


def tokenise(text):
    tokens = []
    number = ""
    for ch in text:
        if ch.isdigit():
# >>> BLANK id=grow-number level=1 hint="这个数字字符接到正在拼的数字后面：用增强赋值（不写 number = number + …）" hintEn="Add this digit character to the end of the number being built: use augmented assignment (not number = number + ...)"
            number += ch
# <<< BLANK
            continue
        if number:
            tokens.append(number)
            number = ""
        if ch in OPERATORS:
            tokens.append(ch)
# >>> BLANK id=not-space level=2 hint="上面那个 if 的另一支：ch 不是空白字符时进入——用 elif，加 not，再加字符串的一个方法（不用和空格比较，那样漏掉制表符） || 方法是 isspace" hintEn="The other branch of the if above: enter it when ch is not a whitespace character - elif, then not, then a string method (not a comparison with a space, which would miss tabs) || The method is isspace"
        elif not ch.isspace():
# <<< BLANK
# >>> BLANK id=raise level=2 hint="抛出 ValueError，消息是一个双引号的 f-string，把出问题的字符用 !r 转换（带引号）放进去（不调用 repr） || f-string 的文字是：unexpected character，一个空格，然后是花括号里的 ch!r" hintEn="Raise a ValueError whose message is an f-string in double quotes that puts in the offending character with the !r conversion (so it shows with quotes; do not call repr) || The f-string's text is: unexpected character, one space, then ch!r in braces"
            raise ValueError(f"unexpected character {ch!r}")
# <<< BLANK
    if number:
        tokens.append(number)
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
