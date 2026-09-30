"""Send three readings by radio as one line of text, and read them back."""
from microbit import *
import radio

DEVICE = 7               # which board sent it: 0..255
GROUP = 12               # boards only hear others in the same group


def encode(device, temp, light):
    return ",".join([str(device), str(temp), str(light)])


def parse(message):
    # "7,21,180" -> (7, 21, 180); anything without exactly 3 fields -> None
# >>> BLANK id=split level=1 hint="一行：用字符串方法 split 在逗号处把 message 切开，结果存进 parts；逗号写在双引号里" hintEn="One line: cut message at the commas with the string method split and store the result in parts; the comma in double quotes"
    parts = message.split(",")
# <<< BLANK
# >>> BLANK id=count level=2 hint="两行：一个 if 判断 parts 的长度不等于 3（len(parts) 写在左边，用 !=），下一行 return 并写出 None || 多一个、少一个字段都不是这台板子发的报文，直接放弃" hintEn="Two lines: an if testing that the length of parts is not 3 (len(parts) on the left, with !=), and on the next line return, writing None out || One field too many or too few means it is not a message from this kind of sender, so give up on it"
    if len(parts) != 3:
        return None
# <<< BLANK
    return (int(parts[0]), int(parts[1]), int(parts[2]))


def main():
    radio.on()
    radio.config(group=GROUP)
    while True:
        if button_a.was_pressed():
            radio.send(encode(DEVICE, temperature(), display.read_light_level()))
        message = radio.receive()
# >>> BLANK id=got level=2 hint="一个 if：真的收到了东西才往下走——用 is not 和 None 比（不写 != None，也不只写 if message:） || 队列里没有报文时，radio.receive() 交回 None" hintEn="One if: go on only if something really arrived - compare with None using is not (not != None, and not just if message:) || When no message is waiting, radio.receive() hands back None"
        if message is not None:
# <<< BLANK
            packet = parse(message)
            if packet is not None:
                display.scroll(str(packet[1]))
        sleep(20)


if __name__ == "__main__":
    main()
