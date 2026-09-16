"""and / or hand back one of their operands, and stop as soon as the answer is known."""


def display_name(nickname, full_name):
# >>> BLANK id=or-default level=2 hint="昵称是空串就退回全名：用 or 一步交回，不写条件表达式、不写 if；nickname 写在 or 左边 || or 在左边为真时交回左边、否则交回右边——所以候补的那个放右边" hintEn="Fall back to the full name when the nickname is an empty string: hand it back in one step with or - no conditional expression, no if; nickname on the left of the or || or hands back its left side when that is truthy and its right side otherwise - so the fallback goes on the right"
    return nickname or full_name
# <<< BLANK


def first_letter(word):
# >>> BLANK id=and-guard level=2 hint="空串没有第 0 个字符：用 and 当守卫，一步交回——不写条件表达式、不写 if，也不用切片 word[:1]；and 左边就放 word 本身，不写 len() || and 左边为假时直接交回左边、右边根本不求值——所以右边可以放心去取第 0 个字符" hintEn="An empty string has no character 0: use and as a guard and hand the result back in one step - no conditional expression, no if, and not the slice word[:1]; the left side of and is word itself, with no len() || When the left side of and is falsy, and hands it straight back without evaluating the right side at all - so the right side is safe to take character 0"
    return word and word[0]
# <<< BLANK


def is_high_average(total, count):
    return count > 0 and total / count >= 50


def loud(value):
    print("  checked", value)
    return value


def parity(n):
# >>> BLANK id=ternary level=2 hint="用一个条件表达式交回一个词，不写 if 语句：条件问 n 除以 2 的余数是否等于 0，条件为真时的那个词写在最前面；两个词都用双引号 || 两个词逐字是 even 与 odd；余数为 0 时交回 even" hintEn="Hand back one word using a conditional expression, not an if statement: the condition asks whether the remainder of n divided by 2 equals 0, and the word for when it is true comes first; both words in double quotes || The two words are, exactly, even and odd; a remainder of 0 gives even"
    return "even" if n % 2 == 0 else "odd"
# <<< BLANK


if __name__ == "__main__":
    print(display_name("Mo", "Mohammed Ali"))
    print(display_name("", "Mohammed Ali"))
    print(repr(first_letter("python")), repr(first_letter("")))
    print(is_high_average(180, 3), is_high_average(0, 0))
    print(0 or [] or "last", 3 and "x" and 0)
    print(loud(0) and loud(1))
    print(loud(2) or loud(3))
    print(parity(7), parity(10))
