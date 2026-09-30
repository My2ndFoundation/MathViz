"""Point a hobby servo: angle -> pulse width in microseconds -> 16-bit PWM duty."""
from machine import Pin, PWM
import utime

SERVO_PIN = 16
FREQ_HZ = 50
PERIOD_US = 20000
MIN_US = 500
MAX_US = 2500
MAX_DUTY = 65535
ANGLES = (0, 45, 90, 135, 180, 90)


def pulse_us(angle):
# >>> BLANK id=pulse level=3 hint="一行 return，只用整数算术，只用一次 //，不加多余的括号；MIN_US 写在最前面，再加上按角度摊出去的那一截：angle 写在前，乘以写成 (MAX_US - MIN_US) 的可变范围（不写 2000） || 那一截要先乘后整除 180：先算 angle // 180 的话，180 度以下全是 0 || 整行形如 return MIN_US + angle * (…) // 180" hintEn="One return line with integer arithmetic only, a single // and no extra brackets; MIN_US comes first, plus the share the angle adds on: angle first, times the range the pulse can vary over, written (MAX_US - MIN_US) rather than 2000 || That share must be multiplied before it is floor-divided by 180: doing angle // 180 first gives 0 for every angle below 180 || The line has the shape return MIN_US + angle * (...) // 180"
    return MIN_US + angle * (MAX_US - MIN_US) // 180
# <<< BLANK


def servo_duty(angle):
    width = pulse_us(angle)
# >>> BLANK id=duty level=2 hint="一行 return，只用整数算术（不用 round、不用 /）：width 乘 MAX_DUTY，加上半个周期，再整除整个周期；width 写在最前面，周期都用常量 PERIOD_US 表示，不写数字 || 半个周期写成 PERIOD_US // 2：加上除数的一半再整除，就是四舍五入" hintEn="One return line in integer arithmetic (no round, no /): width times MAX_DUTY, plus half a period, floor-divided by the whole period; width comes first, and every period is written with the constant PERIOD_US, no bare numbers || Half a period is PERIOD_US // 2: adding half the divisor before floor division rounds to the nearest"
    return (width * MAX_DUTY + PERIOD_US // 2) // PERIOD_US
# <<< BLANK


def main():
    servo = PWM(Pin(SERVO_PIN))
    servo.freq(FREQ_HZ)
    for angle in ANGLES:
        print(angle, "deg ->", pulse_us(angle), "us ->", servo_duty(angle))
# >>> BLANK id=move level=1 hint="servo 上的一个方法调用，设 16 位占空比；实参就是 servo_duty 对这个角度算出的值，直接嵌套调用，不另存变量" hintEn="One method call on servo that sets the 16-bit duty; its argument is what servo_duty works out for this angle, called inline rather than stored in a variable first"
        servo.duty_u16(servo_duty(angle))
# <<< BLANK
        utime.sleep(1)
    servo.deinit()


if __name__ == "__main__":
    main()
