"""Split one job into small functions: parse, summarise, format, and a main that joins them."""


def parse_readings(text):
    readings = []
    for part in text.split(","):
# >>> BLANK id=convert level=1 hint="把这一段文字转成浮点数，直接加到 readings 末尾：一行，转换写在 append 的括号里；段首的空格不用先 strip 掉，float 自己会忽略" hintEn="Turn this piece of text into a float and put it straight on the end of readings: one line, with the conversion inside the brackets of append; no need to strip the leading space first, float ignores it by itself"
        readings.append(float(part))
# <<< BLANK
    return readings


def summarise(readings):
    mean = sum(readings) / len(readings)
    above = 0
    for value in readings:
        if value > mean:
            above += 1
    return len(readings), mean, above


def format_report(count, mean, above):
    return f"{count} readings, mean {mean:.2f}, {above} above the mean"


def main():
    text = input("Readings: ")
# >>> BLANK id=pipeline level=2 hint="一行里先把 text 解析成列表、再把列表交给 summarise，交回的三样依次接进 count、mean、above || 两个调用嵌套写：parse_readings 在里、summarise 在外，不存中间变量" hintEn="In one line, parse text into a list, give that list to summarise, and catch the three things it hands back in count, mean and above || nest the two calls: parse_readings on the inside, summarise on the outside, with no variable in between"
    count, mean, above = summarise(parse_readings(text))
# <<< BLANK
    print(format_report(count, mean, above))


if __name__ == "__main__":
    main()
