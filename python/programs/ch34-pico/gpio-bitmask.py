"""Drive eight LEDs from one byte: set, clear, toggle and invert bits with masks."""
from machine import Pin
import utime

FIRST_PIN = 0
STEP_MS = 500
SHOW = (("set", 0), ("set", 7), ("toggle", 3), ("clear", 0), ("set", 3),
        ("invert", 0), ("toggle", 7), ("clear", 2), ("invert", 0))


def apply(mask, ops):
    for op, bit in ops:
        if op == "set":
            mask |= 1 << bit
        elif op == "clear":
# >>> BLANK id=clear level=2 hint="一行，用增强赋值 &= 改 mask；右边是「只有这一位是 0、其余全是 1」的掩码：把 1 << bit 用括号括起来，前面加取反号 || 与运算里，和 1 相与的位保持原样，和 0 相与的位一定变成 0" hintEn="One line changing mask with the augmented assignment &=; the right-hand side is a mask with a 0 in this bit and 1s everywhere else: put 1 << bit in brackets and put the bitwise NOT in front || In an AND, a bit ANDed with 1 stays as it was, and a bit ANDed with 0 always becomes 0"
            mask &= ~(1 << bit)
# <<< BLANK
        elif op == "toggle":
            mask ^= 1 << bit
        elif op == "invert":
# >>> BLANK id=invert level=2 hint="一行普通赋值 mask = …：先对 mask 取反（~ 写在 mask 前），再与 0xFF 相与截回一个字节；0xFF 写在右边、用十六进制，不用 ^= 0xFF，不用 255 - mask || Python 的整数没有固定位数，~5 是 -6；和 0xFF 相与才只留下最低的 8 位" hintEn="One plain assignment mask = ...: first take the NOT of mask (~ in front of mask), then AND it with 0xFF to cut it back to one byte; 0xFF on the right, in hex, not ^= 0xFF and not 255 - mask || Python integers have no fixed width, so ~5 is -6; ANDing with 0xFF keeps only the lowest 8 bits"
            mask = ~mask & 0xFF
# <<< BLANK
    return mask


def show(leds, mask):
    for i, led in enumerate(leds):
# >>> BLANK id=bit-out level=2 hint="一行：给 led 设电平，实参是 mask 的第 i 位（0 或 1）；先右移 i 位再与 1 相与，右移那一截用括号括起来 || 右移把第 i 位挪到最低位，与 1 相与把其余位全清掉" hintEn="One line setting led's level, whose argument is bit i of mask (0 or 1): shift right by i and then AND with 1, with the shift in brackets || The shift brings bit i down to the lowest place, and the AND with 1 wipes out all the others"
        led.value((mask >> i) & 1)
# <<< BLANK


def main():
    leds = [Pin(FIRST_PIN + i, Pin.OUT) for i in range(8)]
    mask = 0
    show(leds, mask)
    for op in SHOW:
        mask = apply(mask, [op])
        print(op[0], op[1], "->", bin(mask))
        show(leds, mask)
        utime.sleep_ms(STEP_MS)


if __name__ == "__main__":
    main()
