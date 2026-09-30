"""A spirit level: light the column that matches how far the board leans."""
from microbit import *

LOW = -1024              # milli-g at the far left
HIGH = 1023              # milli-g at the far right
SPAN = HIGH - LOW + 1    # 2048 possible readings between them
COLUMNS = 5


def column(reading):
    # Past either end, stay on the end column instead of leaving the display.
    if reading < LOW:
        reading = LOW
# >>> BLANK id=clamp level=2 hint="两行，和上面管下界的那两行写成对称的样子：一个 if（reading 写在比较号左边，严格的大于号），下一行单独一个赋值（不用 elif，不用 min()） || 读数超过 HIGH 时，把 reading 换成 HIGH 本身" hintEn="Two lines, the mirror image of the two lower-end lines above: an if (reading on the left of the comparison, a strict greater-than) with a single assignment on the next line (not elif, not min()) || When the reading is past HIGH, replace reading with HIGH itself"
    if reading > HIGH:
        reading = HIGH
# <<< BLANK
    # Cut the 2048 readings into 5 equal strips with whole-number division.
# >>> BLANK id=strip level=3 hint="一行 return：先算 reading 离 LOW 有多远（括号里 reading 减 LOW），乘以 COLUMNS，再用整除 // 除以 SPAN——按这个顺序写，不用 round()、不用 int() || 先乘后除：先除的话几乎总是 0 || LOW 处得到列 0，HIGH 处得到列 4" hintEn="One return line: first how far reading is from LOW (reading minus LOW, in brackets), times COLUMNS, then whole-number division // by SPAN - written in that order, no round(), no int() || Multiply before you divide: dividing first nearly always gives 0 || At LOW this gives column 0, at HIGH column 4"
    return (reading - LOW) * COLUMNS // SPAN
# <<< BLANK


def main():
    while True:
        col = column(accelerometer.get_x())
        display.clear()
        for y in range(5):
# >>> BLANK id=bar level=1 hint="一行 display.set_pixel：列是 col、行是 y，亮度取最亮" hintEn="One display.set_pixel line: column col, row y, brightness the brightest"
            display.set_pixel(col, y, 9)
# <<< BLANK
        sleep(50)


if __name__ == "__main__":
    main()
