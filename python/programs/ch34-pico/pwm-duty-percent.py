"""Fade an LED with PWM, turning a brightness percentage into a 16-bit duty."""
from machine import Pin, PWM
import utime

LED_PIN = 15
FREQ_HZ = 1000
MAX_DUTY = 65535
STEP = 10
PAUSE_MS = 50


def duty(percent):
# >>> BLANK id=round-half-up level=3 hint="一行 return，只用整数算术：不用 round()，不用 /；percent 写在最前面，乘的是常量 MAX_DUTY（不写 65535），先乘、再加、最后整除 || 加上的那个数让整除变成四舍五入，它是除数的一半 || 除数是 100，所以加的是 50；整行形如 return (… + 50) // 100" hintEn="One return line using only integer arithmetic: no round(), no /; percent comes first, multiplied by the constant MAX_DUTY (not 65535), then add, and finally floor-divide || The number you add turns the floor division into rounding half up, and it is half the divisor || The divisor is 100, so you add 50; the line has the shape return (... + 50) // 100"
    return (percent * MAX_DUTY + 50) // 100
# <<< BLANK


def main():
    pwm = PWM(Pin(LED_PIN))
# >>> BLANK id=freq level=1 hint="pwm 上的一个方法调用，设定 PWM 的频率；实参用常量 FREQ_HZ，不写 1000" hintEn="One method call on pwm that sets the PWM frequency; pass the constant FREQ_HZ, not 1000"
    pwm.freq(FREQ_HZ)
# <<< BLANK
    for percent in (0, 1, 25, 50, 99, 100):
        print(percent, "% ->", duty(percent))
    try:
        while True:
            for percent in range(0, 101, STEP):
                pwm.duty_u16(duty(percent))
                utime.sleep_ms(PAUSE_MS)
# >>> BLANK id=fade-down level=2 hint="一个 for 头，循环变量仍叫 percent，用三个实参的 range 从 100 往下数；步长写成 -STEP（不写 -10），不用 reversed() || 终点是 -1：range 不含终点，写 -1 才能数到 0 为止" hintEn="One for header, the loop variable still called percent, using range with three arguments to count down from 100; the step is -STEP (not -10), and no reversed() || The stop is -1: range leaves out its stop, so -1 is what lets it reach 0"
            for percent in range(100, -1, -STEP):
# <<< BLANK
                pwm.duty_u16(duty(percent))
                utime.sleep_ms(PAUSE_MS)
    finally:
        pwm.duty_u16(0)
        pwm.deinit()


if __name__ == "__main__":
    main()
