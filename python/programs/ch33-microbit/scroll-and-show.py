"""Scroll text, show pictures and wait in milliseconds on the micro:bit."""
from microbit import *

PICTURES = [Image.HEART, Image.HAPPY, Image.SAD]
PAUSE_MS = 500


def main():
    # scroll slides the whole text across; it returns once the text has gone.
    display.scroll("HELLO")
# >>> BLANK id=fast level=2 hint="再滚一次同样的 HELLO，这次用关键字实参 delay 让它滚得更快；HELLO 写在双引号里 || delay 是每挪一步等多少毫秒，缺省是 150；这里取 80" hintEn="Scroll the same HELLO again, this time faster, using the keyword argument delay; HELLO in double quotes || delay is how many milliseconds each step waits, 150 by default; use 80 here"
    display.scroll("HELLO", delay=80)
# <<< BLANK
    # show with a string puts up one character at a time.
    display.show("ABC")
    display.show(Image.HEART)
    sleep(1000)
    # A countdown: 3, 2, 1, one second each.
# >>> BLANK id=countdown level=2 hint="一个 for 头：循环变量叫 n，用三个实参的 range 从 3 数到 1（倒着数，步长是负数）；不用 reversed() || range 的终点取不到，所以要停在 1，终点得写 0" hintEn="One for header: the loop variable is n, and a three-argument range counts from 3 down to 1 (counting backwards, so the step is negative); not reversed() || A range never reaches its stop value, so to stop at 1 the stop must be 0"
    for n in range(3, 0, -1):
# <<< BLANK
        display.show(str(n))
        sleep(1000)
    display.clear()
    # On the board this loop never ends: main.py runs until the power goes.
    while True:
        for picture in PICTURES:
# >>> BLANK id=picture level=1 hint="一行：把这一轮的 picture 放上点阵（用 display 的 show，不是 scroll）" hintEn="One line: put this round's picture on the display (display's show, not scroll)"
            display.show(picture)
# <<< BLANK
            sleep(PAUSE_MS)
        display.clear()
        sleep(PAUSE_MS)


if __name__ == "__main__":
    main()
