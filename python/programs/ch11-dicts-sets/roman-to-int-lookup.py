"""Convert a Roman numeral to an integer with a lookup table."""

VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


def roman_to_int(numeral):
    total = 0
    for i in range(len(numeral)):
# >>> BLANK id=lookup level=1 hint="在查找表 VALUES 里查出第 i 个字符的值，存进 value；用方括号下标查，不用 get" hintEn="Look up the value of character i in the table VALUES and store it in value; use a square-bracket index, not get"
        value = VALUES[numeral[i]]
# <<< BLANK
# >>> BLANK id=smaller-than-next level=3 hint="一个 if，两个条件用 and 连起来，顺序不能反：先确认后面还有一个字符，再比较。第一个条件写成 i + 1 小于长度；第二个条件 value 写在比较号左边、用严格的小于号；两个条件都不另加括号 || 先判「还有下一个字符」是为了守住下标：没有下一个字符时 and 短路，右边的查表根本不会执行 || 右边查的是下一个字符的值：下标是 i + 1，外面同样套一层 VALUES[...]" hintEn="One if, with two conditions joined by and, in this order: first make sure there is another character after this one, then compare. Write the first condition as i + 1 less than the length; in the second, value goes on the left with a strict less-than; no extra brackets round either condition || Checking for a next character first guards the index: when there is none, and short-circuits and the lookup on the right never runs || The right-hand side looks up the value of the next character: index i + 1, wrapped in VALUES[...] the same way"
        if i + 1 < len(numeral) and value < VALUES[numeral[i + 1]]:
# <<< BLANK
# >>> BLANK id=subtract level=1 hint="比右边那个字符小：这个值要从总数里减掉，用增强赋值写" hintEn="Smaller than the character to its right: this value is taken away from the total - write it as an augmented assignment"
            total -= value
# <<< BLANK
        else:
            total += value
    return total


if __name__ == "__main__":
    for numeral in ["III", "IX", "XIV", "XL", "MCMXCIV", "MMXXVI"]:
        print(numeral, roman_to_int(numeral))
    print("Q" in VALUES, "X" in VALUES)
