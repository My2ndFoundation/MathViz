"""Read the RP2040's built-in temperature sensor and turn it into Celsius."""
from machine import ADC
import utime

SENSOR_CHANNEL = 4
VREF = 3.3
FULL_SCALE = 65535
PAUSE_S = 2


def volts(raw):
# >>> BLANK id=volts level=2 hint="一行 return：raw 写在最前面，先乘参考电压再除以满量程，两个都用常量（VREF、FULL_SCALE），不写数字；用 /，不用 // || 只写一行、只用这两个常量，不先存中间变量；判定按记号逐个比，换了先后（VREF 写在 raw 前面）会判错" hintEn="One return line: raw comes first, multiplied by the reference voltage and then divided by the full scale, both as constants (VREF, FULL_SCALE) rather than numbers; use /, not // || One line with just those two constants and no helper variable; the checker compares token by token, so another order (VREF before raw) is marked wrong"
    return raw * VREF / FULL_SCALE
# <<< BLANK


def celsius(raw):
    v = volts(raw)
# >>> BLANK id=celsius level=3 hint="一行 return，外面套 round(…, 1) 保留一位小数（第二个实参直接写 1，不写 ndigits=）；里面是 27 减去一个分数：分子是 v 与传感器在 27 度时的电压之差（v 在前，括号括起来），分母是每度的电压变化 || 数字直接写进去（本程序没有为它们定义常量），写成 27 - (…) / …，不写成 27 + (…) || 数据手册的数：27 度时电压是 0.706，每升高一度电压下降 0.001721" hintEn="One return line wrapped in round(..., 1) to keep one decimal place (the second argument is just 1, not ndigits=); inside it, 27 minus a fraction: the top is the difference between v and the sensor's voltage at 27 degrees (v first, in brackets), the bottom is the change in voltage per degree || Write the numbers in directly (the program has no constants for them), as 27 - (...) / ..., not 27 + (...) || The datasheet numbers: at 27 degrees the voltage is 0.706, and each degree warmer lowers it by 0.001721"
    return round(27 - (v - 0.706) / 0.001721, 1)
# <<< BLANK


def main():
    sensor = ADC(SENSOR_CHANNEL)
    while True:
# >>> BLANK id=read level=1 hint="从 sensor 读一个 16 位的原始读数存进 raw：sensor 上的一个方法调用，不带实参，方法名以 _u16 结尾" hintEn="Read a 16-bit raw value from sensor into raw: one method call on sensor with no arguments, whose name ends in _u16"
        raw = sensor.read_u16()
# <<< BLANK
        print("raw", raw, "->", volts(raw), "V ->", celsius(raw), "C")
        utime.sleep(PAUSE_S)


if __name__ == "__main__":
    main()
