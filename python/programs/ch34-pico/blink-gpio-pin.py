"""Blink the Pico's on-board LED from a planned list of on / off times."""
from machine import Pin
import utime

LED_PIN = 25
FLASHES = 3
ON_MS = 200
OFF_MS = 800


def blink_schedule(n, on_ms, off_ms):
    plan = []
    t = 0
    for _ in range(n):
        plan.append((t, 1))
        t += on_ms
# >>> BLANK id=off-event level=2 hint="两行，和上面开灯的那两行对称：先往 plan 里追加一个 (时刻, 电平) 元组，再把 t 往后推；追加用 append、推进用 +=（不写 t = t + …） || 灭灯的电平是 0；灭着的时长是 off_ms" hintEn="Two lines, the mirror image of the two switch-on lines above: first append a (time, level) tuple to plan, then move t forward; append with append and move with += (not t = t + ...) || The level for off is 0; it stays off for off_ms"
        plan.append((t, 0))
        t += off_ms
# <<< BLANK
    return plan


def main():
# >>> BLANK id=led-pin level=2 hint="构造一个 Pin 对象存进 led：第一个实参用常量 LED_PIN（不写 25），第二个实参按位置写引脚模式，不写 mode= || 这个引脚是用来点灯的，所以是输出模式，它是 Pin 类上的一个常量" hintEn="Build a Pin object and store it in led: the first argument is the constant LED_PIN (not 25), the second is the pin mode, given by position, not as mode= || The pin drives a light, so it is an output; that mode is a constant on the Pin class"
    led = Pin(LED_PIN, Pin.OUT)
# <<< BLANK
    led.value(0)
    plan = blink_schedule(FLASHES, ON_MS, OFF_MS)
    for at_ms, level in plan:
        print(at_ms, "ms: LED", "on" if level else "off")
        led.value(level)
        if level == 1:
            utime.sleep_ms(ON_MS)
        else:
            utime.sleep_ms(OFF_MS)
    for _ in range(6):
# >>> BLANK id=toggle level=1 hint="led 上的一个方法调用，不带实参，把灯从亮变灭或从灭变亮；不用 value()" hintEn="One method call on led, with no arguments, that flips the light from on to off or off to on; not value()"
        led.toggle()
# <<< BLANK
        utime.sleep_ms(100)
    print("done")


if __name__ == "__main__":
    main()
