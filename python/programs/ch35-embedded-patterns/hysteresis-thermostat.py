"""A thermostat with two thresholds, so the heater does not chatter."""
from microbit import *

LOW = 19
HIGH = 22
CHECK_MS = 1000


def heater_step(on, temp, low, high):
    """Return whether the heater should be on after this reading."""
# >>> BLANK id=cold level=2 hint="一个 if 头加一行 return：temp 写在比较号左边，与 low 比，用「小于等于」；体里交回 True || 冷到下限（含正好等于下限）就开，不管原来是开是关" hintEn="An if header plus one return line: temp on the left of the comparison, against low, with less-than-or-equal; the body hands back True || Cold down to the lower limit (including exactly at it) switches it on, whatever it was before"
    if temp <= low:
        return True
# <<< BLANK
    if temp >= high:
        return False
# >>> BLANK id=keep level=1 hint="函数最后一行：温度落在两个阈值之间，交回原来的状态，也就是参数 on 本身" hintEn="The function's last line: the temperature is between the two thresholds, so hand back the state it already had - the parameter on itself"
    return on
# <<< BLANK


def heater(temps, low, high):
    """Return the heater state after each reading; it starts off."""
    on = False
    states = []
    for temp in temps:
        on = heater_step(on, temp, low, high)
        states.append(on)
    return states


def main():
    on = False
    while True:
        on = heater_step(on, temperature(), LOW, HIGH)
        pin1.write_digital(1 if on else 0)
        display.show(Image.YES if on else Image.NO)
        sleep(CHECK_MS)


if __name__ == "__main__":
    main()
