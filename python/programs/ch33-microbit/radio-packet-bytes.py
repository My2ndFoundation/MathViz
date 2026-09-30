"""Send three readings by radio as three bytes, one of them signed."""
from microbit import *
import radio

DEVICE = 7               # which board sent it: 0..255
GROUP = 12               # boards only hear others in the same group


def encode(device, temp, light):
    # A byte holds 0..255. A temperature of -5 goes out as 251 (-5 + 256).
# >>> BLANK id=pack level=2 hint="一行 return：用 bytes() 把一个三项的列表变成字节，顺序是 device、温度、light；温度那一项写成 temp 除以 256 的余数（用 %、十进制的 256，不用 &、不用 if） || Python 里负数对 256 取余得到 0..255：-5 % 256 是 251" hintEn="One return line: turn a three-item list into bytes with bytes(), in the order device, temperature, light; the temperature item is the remainder of temp divided by 256 (with % and a decimal 256, not & and not an if) || In Python a negative number % 256 lands in 0..255: -5 % 256 is 251"
    return bytes([device, temp % 256, light])
# <<< BLANK


def decode(packet):
    # Bytes 128..255 in the temperature slot stand for -128..-1.
    temp = packet[1]
# >>> BLANK id=signed level=3 hint="两行：一个 if，下一行把 temp 改掉；比较用严格的大于号、temp 写在左边，改用 -= 写 || 分界是有符号字节能放下的最大正数 || 大于 127 的字节减去 256：255 变回 -1，128 变回 -128" hintEn="Two lines: an if, and on the next line change temp; a strict greater-than with temp on the left, the change written with -= || The dividing line is the largest positive number a signed byte can hold || A byte above 127 has 256 taken off: 255 comes back as -1, 128 as -128"
    if temp > 127:
        temp -= 256
# <<< BLANK
    return (packet[0], temp, packet[2])


def roundtrip(device, temp, light):
    # Send and receive in one go: what comes back should be what went out.
    return decode(encode(device, temp, light))


def main():
    radio.on()
    radio.config(group=GROUP)
    while True:
        if button_a.was_pressed():
            radio.send_bytes(encode(DEVICE, temperature(), display.read_light_level()))
# >>> BLANK id=receive level=1 hint="一行：从无线电收下一条字节报文（receive_bytes，不是 receive），存进 packet" hintEn="One line: take the next bytes message from the radio (receive_bytes, not receive) and store it in packet"
        packet = radio.receive_bytes()
# <<< BLANK
        if packet is not None and len(packet) == 3:
            display.scroll(str(decode(packet)[1]))
        sleep(20)


if __name__ == "__main__":
    main()
