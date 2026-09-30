"""Two LEDs at two rates from one loop that never sleeps."""
from machine import Pin
import time

RED_MS = 300
GREEN_MS = 500
RED_PIN = 14
GREEN_PIN = 15
ALERT_PIN = 16
BUTTON_PIN = 17


def step(acc, elapsed, interval_ms):
    """Add one tick's elapsed time; return (new acc, whether to flip now)."""
    acc += elapsed
# >>> BLANK id=due level=2 hint="一个 if 头加一行 return：acc 写在比较号左边，与 interval_ms 比，用「大于等于」；return 交回两个值、逗号隔开不加括号——先是减掉一个周期之后的 acc，再是 True；不要把 acc 清零 || 到期时减掉的正好是一个周期，多出来的那一截留给下一次，所以长时间跑下来不漂移" hintEn="An if header plus one return line: acc on the left of the comparison, against interval_ms, with greater-than-or-equal; the return hands back two values separated by a comma, no brackets - first acc with one period taken off, then True; do not reset acc to zero || When it is due, exactly one period is taken off and the overshoot is kept for next time, so it does not drift over a long run"
    if acc >= interval_ms:
        return acc - interval_ms, True
# <<< BLANK
    return acc, False


def toggles(elapsed_list, interval_ms):
    """Return the tick numbers on which a blinker with this interval flips."""
    acc = 0
    flips = []
    for tick, elapsed in enumerate(elapsed_list):
        acc, flip = step(acc, elapsed, interval_ms)
        if flip:
            flips.append(tick)
    return flips


def main():
    red = Pin(RED_PIN, Pin.OUT)
    green = Pin(GREEN_PIN, Pin.OUT)
    alert = Pin(ALERT_PIN, Pin.OUT)
    button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)
    red_acc = 0
    green_acc = 0
    last = time.ticks_ms()
    while True:
        now = time.ticks_ms()
# >>> BLANK id=elapsed level=2 hint="一行，存进 elapsed：用 time 模块里专门算两个 ticks 之差的函数，不直接相减；较新的 now 写在第一个实参，较早的 last 写在第二个 || 它的名字是 ticks_diff；直接写 now - last 在计数器回绕时会得到一个巨大的负数" hintEn="One line, stored in elapsed: use the time module's function made for the difference of two ticks values, not a plain subtraction; the newer now is the first argument and the older last the second || It is called ticks_diff; writing now - last gives a huge negative number when the counter wraps around"
        elapsed = time.ticks_diff(now, last)
# <<< BLANK
        last = now
        red_acc, flip = step(red_acc, elapsed, RED_MS)
        if flip:
            red.toggle()
        green_acc, flip = step(green_acc, elapsed, GREEN_MS)
        if flip:
            green.toggle()
        alert.value(1 - button.value())


if __name__ == "__main__":
    main()
