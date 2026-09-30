"""Turn a compass heading in degrees into one of eight compass points."""
from microbit import *

NAMES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def point(heading):
    # Each point owns a 45-degree slice centred on it, so N covers 338..22.
    # Adding half a slice (22.5) before dividing by 45 rounds to the nearest
    # point; doubling everything keeps it in whole numbers: 2h + 45 over 90.
# >>> BLANK id=index level=3 hint="一行赋值给 index：整数算术，不用 round()、不用 / || 括号里是 heading 乘 2 再加 45（heading * 2 写在前面），然后整除 90 || 这等于 (heading + 22.5) // 45，只是全乘了 2，免得出现小数" hintEn="One assignment to index: whole-number arithmetic, no round(), no / || In brackets, heading times 2 plus 45 (heading * 2 first), then whole-number division by 90 || That is (heading + 22.5) // 45 with everything doubled, so no fractions appear"
    index = (heading * 2 + 45) // 90
# <<< BLANK
    # 338..359 (and 360) give index 8, which wraps back round to N.
# >>> BLANK id=wrap level=1 hint="一行 return：用 index 除以 8 的余数去 NAMES 里取名字（直接写数字 8，不用 len()）" hintEn="One return line: look the name up in NAMES using the remainder of index divided by 8 (write the number 8, not len())"
    return NAMES[index % 8]
# <<< BLANK


def main():
    compass.calibrate()      # scroll a message, then tilt to fill the screen
    while True:
        display.scroll(point(compass.heading()))
        sleep(500)


if __name__ == "__main__":
    main()
