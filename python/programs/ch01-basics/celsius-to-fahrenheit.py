"""Convert Celsius temperatures to Fahrenheit."""


def to_fahrenheit(celsius):
# >>> BLANK id=formula level=2 hint="华氏度等于摄氏度乘以五分之九、再加 32，算好交回去；五分之九就用 9 和 5 写，不换成 1.8，也不加括号 || 照公式的次序从左往右一口气写：先乘 9，再用 / 除以 5，最后加 32" hintEn="Fahrenheit is the Celsius value times nine fifths, plus 32 - work it out and hand it back; write nine fifths with a 9 and a 5, not as 1.8, and use no brackets || write it left to right in the order of the formula: multiply by 9, divide by 5 with /, then add 32"
    return celsius * 9 / 5 + 32
# <<< BLANK


if __name__ == "__main__":
    for c in (-40, 0, 36.6, 100):
        print(f"{c}C = {to_fahrenheit(c)}F")
    print(round(to_fahrenheit(36.6), 1))
# >>> BLANK id=round-to-int level=2 hint="和上一行 round 的是同一个值，只是这次要一个整数 || 整数靠的是完全不给 round() 第二个参数——给 0 回来的仍是 float，会打成 98.0" hintEn="Round the same value as the line above, but this time to a whole number || the whole number comes from giving round() no second argument at all - pass 0 and you still get a float back, printed as 98.0"
    print(round(to_fahrenheit(36.6)))
# <<< BLANK
