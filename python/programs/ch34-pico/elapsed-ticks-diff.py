"""Time a reaction with ring arithmetic, the way utime.ticks_diff() does."""
from machine import Pin
import utime

LED_PIN = 25
BUTTON_PIN = 14
WAIT_MS = 2000


def ticks_diff(new, old, period):
# >>> BLANK id=ring level=2 hint="一行，把结果存进 d：先照常相减（new 在前），整个差用括号括起来，再对 period 取余；用 %，不用 & || Python 的 % 在除数为正时结果总落在 0 到 period - 1 之间，哪怕差是负的" hintEn="One line storing the result in d: subtract as usual (new first), bracket the whole difference, then take it modulo period; use %, not & || In Python, % with a positive divisor always lands between 0 and period - 1, even when the difference is negative"
    d = (new - old) % period
# <<< BLANK
# >>> BLANK id=signed level=2 hint="两行：一个 if 头，d 落在上半圈（大于等于半个周期）时成立——d 写在左边，半个周期写成 period // 2，用 >=；下一行用 -= 把 d 挪到负的那一边 || 上半圈的差其实表示 new 比 old 早：减去一整圈 period，就得到那个负数" hintEn="Two lines: an if header that holds when d is in the upper half of the ring (at least half a period) - d on the left, half a period written period // 2, using >=; then a line that uses -= to move d to the negative side || A difference in the upper half really means new came before old: take off one whole turn, period, and you get that negative number"
    if d >= period // 2:
        d -= period
# <<< BLANK
    return d


def main():
    led = Pin(LED_PIN, Pin.OUT)
    button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)
# >>> BLANK id=period level=3 hint="一行，把计数器的周期存进 period：调用 utime 上的一个函数，再加 1；不写死任何数字（周期因板子而异） || 这个函数把一个 ticks 值往前或往后挪若干毫秒；从 0 往回挪 1，就落在计数器能取到的最大值上 || 函数是 ticks_add，两个实参是 0 和 -1" hintEn="One line storing the counter's period in period: call a utime function and add 1; no hard-coded number (the period differs from board to board) || That function moves a ticks value some milliseconds forward or back; moving back 1 from 0 lands on the largest value the counter can hold || The function is ticks_add, with the arguments 0 and -1"
    period = utime.ticks_add(0, -1) + 1
# <<< BLANK
    print("ticks period:", period)
    print("wrap at 1024, 1000 then 24:", ticks_diff(24, 1000, 1024))
    while True:
        led.value(0)
        utime.sleep_ms(WAIT_MS)
        led.value(1)
        start = utime.ticks_ms()
        while button.value() == 1:
            pass
        end = utime.ticks_ms()
        print("reaction:", ticks_diff(end, start, period), "ms")
        while button.value() == 0:
            pass


if __name__ == "__main__":
    main()
