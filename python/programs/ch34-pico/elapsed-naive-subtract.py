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
# >>> BLANK id=start level=1 hint="灯刚亮的这一刻记下毫秒计数器的读数，存进 start：utime 上的一个函数调用，不带实参" hintEn="At the moment the light comes on, store the millisecond counter's reading in start: one call to a utime function, with no arguments"
        start = utime.ticks_ms()
# <<< BLANK
# >>> BLANK id=wait-press level=2 hint="两行：一个 while 头，只要按钮读数还是 1 就一直转；下一行循环体什么也不做，写 pass；比较写成 button.value() == 1，不写 != 0 || 上拉的按钮松开时读 1、按下时读 0，所以读数离开 1 的那一刻循环结束" hintEn="Two lines: a while header that keeps spinning as long as the button reads 1, and a body that does nothing, written pass; write the test as button.value() == 1, not != 0 || A pulled-up button reads 1 when released and 0 when pressed, so the loop ends the moment the reading leaves 1"
        while button.value() == 1:
            pass
# <<< BLANK
        end = utime.ticks_ms()
        print("reaction:", elapsed_ms(end, start), "ms")
        while button.value() == 0:
            pass


if __name__ == "__main__":
    main()
