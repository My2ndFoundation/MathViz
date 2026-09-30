"""Light single LEDs, then turn a 5x5 table of brightness into an Image."""
from microbit import *

HEART = [
    [0, 9, 0, 9, 0],
    [9, 9, 9, 9, 9],
    [9, 9, 9, 9, 9],
    [0, 9, 9, 9, 0],
    [0, 0, 9, 0, 0],
]


def image_string(rows):
    # Each row becomes five digits; a colon ends every row but the last.
    lines = []
    for row in rows:
        line = ""
        for b in row:
# >>> BLANK id=digit level=1 hint="把这个亮度变成一个字符、接到 line 的末尾：用 str() 转，用 += 接（不写成 line = line + …）" hintEn="Turn this brightness into one character and add it to the end of line: convert with str(), add with += (not line = line + ...)"
            line += str(b)
# <<< BLANK
        lines.append(line)
# >>> BLANK id=join level=2 hint="一行 return：用字符串方法 join 把 lines 里的五行接起来，分隔符写在双引号里 || micro:bit 的 Image 字符串里，行与行之间用冒号隔开" hintEn="One return line: glue the five lines in lines together with the string method join, the separator written in double quotes || In a micro:bit Image string the rows are separated by colons"
    return ":".join(lines)
# <<< BLANK


def fade_rows():
    # Brightness 0, 2, 4, 6, 8 from left to right, the same on every row.
    return [[2 * x for x in range(5)] for y in range(5)]


def main():
    display.clear()
    for x in range(5):
# >>> BLANK id=pixel level=2 hint="一行 display.set_pixel：三个实参依次是列、行、亮度；列和行都用 x，亮度用最亮的那个整数 || 列与行相同的那些格子连起来，是从左上角到右下角的一条斜线" hintEn="One display.set_pixel line: its three arguments are column, row and brightness in that order; use x for both column and row, and the brightest whole number for the brightness || The cells whose column equals their row make a diagonal from the top-left corner to the bottom-right"
        display.set_pixel(x, x, 9)
# <<< BLANK
    sleep(1000)
    display.show(Image(image_string(HEART)))
    sleep(1000)
    display.show(Image(image_string(fade_rows())))


if __name__ == "__main__":
    main()
