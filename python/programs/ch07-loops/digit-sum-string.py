"""Add up the digits of a whole number by turning it into text."""


def digit_sum(n):
    total = 0
# >>> BLANK id=each-char level=1 hint="一个 for 循环，循环变量叫 ch，逐个走 n 写成文字之后的每个字符——用 str() 转，不用 f-string" hintEn="A for loop with the loop variable ch over every character of n written out as text - convert with str(), not an f-string"
    for ch in str(n):
# <<< BLANK
# >>> BLANK id=add-digit level=1 hint="ch 是一个数字字符，不是数：先用 int() 把它变成整数，再用 += 加进 total" hintEn="ch is a digit character, not a number: turn it into a whole number with int() first, then add it to total with +="
        total += int(ch)
# <<< BLANK
    return total


if __name__ == "__main__":
    for n in (0, 7, 472, 9999, 1000001):
        print(n, digit_sum(n))
