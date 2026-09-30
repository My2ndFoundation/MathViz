"""Time a reaction by subtracting two ticks_ms() readings - right until the counter wraps."""
from machine import Pin
import utime

LED_PIN = 25
BUTTON_PIN = 14
WAIT_MS = 2000


def elapsed_ms(new, old):
# >>> BLANK id=subtract level=1 hint="一行 return：后一次读数减前一次读数，照参数名写，new 在前" hintEn="One return line: the later reading minus the earlier one, using the parameter names, new first"
    return new - old
# <<< BLANK


def main():
    led = Pin(LED_PIN, Pin.OUT)
    button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)
    print("wrap at 1024, 1000 then 24:", elapsed_ms(24, 1000))
    while True:
        led.value(0)
        utime.sleep_ms(WAIT_MS)
        led.value(1)
        start = utime.ticks_ms()
# >>> BLANK id=wait-press level=2 hint="两行：一个 while 头，只要按钮还松着就一直转；下一行循环体什么也不做，写 pass。条件照程序末尾等松手的那个 while 的样子写：按钮读数写在左边、用 == 与一个数比，不写 !=，也不单写读数 || 上拉的按钮松开时读 1、按下时读 0，所以读数离开 1 的那一刻循环结束" hintEn="Two lines: a while header that keeps spinning as long as the button is still released, and a body that does nothing, written pass. Write the test the way the while at the end of the program that waits for you to let go is written: the button reading on the left, compared with a number using ==, not != and not the reading on its own || A pulled-up button reads 1 when released and 0 when pressed, so the loop ends the moment the reading leaves 1"
        while button.value() == 1:
            pass
# <<< BLANK
        end = utime.ticks_ms()
# >>> BLANK id=report level=2 hint="一行 print，三个实参按位置、用逗号分开（不用 f-string，不用 + 拼接）：一个双引号字符串、这次的毫秒数、再一个双引号字符串；第一个字符串逐字是 reaction 加一个冒号，最后一个逐字是 ms；毫秒数调用本程序里的那个函数来算（不直接相减），它的实参也按位置写 || 两个读数的顺序：后读到的那个在前，先读到的在后" hintEn="One print line with three arguments by position, separated by commas (no f-string, no + joining): a double-quoted string, the milliseconds this time, and another double-quoted string; the first string is exactly reaction followed by a colon, the last is exactly ms; the milliseconds come from calling this program's own function (not a subtraction written out), its arguments by position too || The order of the two readings: the one taken later goes first, the earlier one second"
        print("reaction:", elapsed_ms(end, start), "ms")
# <<< BLANK
        while button.value() == 0:
            pass


if __name__ == "__main__":
    main()
