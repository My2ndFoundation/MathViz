"""Blink the LED from a timer callback while the main loop does other work."""
from machine import Pin, Timer
import utime

LED_PIN = 25
BLINK_MS = 250
RUN_MS = 10000

led = None
toggles = 0
finished = False


def on_blink(timer):
    global toggles
    led.toggle()
    toggles += 1


def on_finish(timer):
# >>> BLANK id=finish level=2 hint="两行：先声明要改的是模块级的那个标志，再把它设成真；直接赋 True，不用 not || 函数里给模块级变量赋值要先用 global 点名；标志的名字就是主循环 while 里判断的那个" hintEn="Two lines: first declare that the flag you are changing is the module-level one, then make it true; assign True directly, not via not || Assigning to a module-level variable inside a function needs global first; the flag is the one the main loop's while tests"
    global finished
    finished = True
# <<< BLANK


def main():
    global led
    led = Pin(LED_PIN, Pin.OUT)
# >>> BLANK id=periodic level=2 hint="构造一个 Timer 存进 blinker：三个实参都用关键字，顺序是 period=、mode=、callback=；周期用常量 BLINK_MS，回调是上面每次翻转 LED 的那个函数名（不加括号） || 这个定时器要一遍又一遍地触发，模式是 Timer 类上的常量 PERIODIC（下一行那个只触发一次的是 ONE_SHOT）" hintEn="Build a Timer and store it in blinker: all three arguments by keyword, in the order period=, mode=, callback=; the period is the constant BLINK_MS and the callback is the name of the function above that flips the LED (no brackets) || This timer fires again and again, so its mode is the Timer constant PERIODIC (the one on the next line, which fires once, is ONE_SHOT)"
    blinker = Timer(period=BLINK_MS, mode=Timer.PERIODIC, callback=on_blink)
# <<< BLANK
    stopper = Timer(period=RUN_MS, mode=Timer.ONE_SHOT, callback=on_finish)
    seconds = 0
# >>> BLANK id=loop level=1 hint="一个 while 头：只要标志 finished 还没变真就继续；用 not，不写 == False，不写 is False" hintEn="One while header: keep going as long as the flag finished has not become true; use not, not == False or is False"
    while not finished:
# <<< BLANK
        utime.sleep(1)
        seconds += 1
        print(seconds, "s:", toggles, "toggles")
    blinker.deinit()
    stopper.deinit()
    led.value(0)
    print("stopped after", toggles, "toggles")


if __name__ == "__main__":
    main()
