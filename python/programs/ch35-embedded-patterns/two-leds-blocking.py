"""Two LEDs at two rates with sleep_ms - and every sleep holds up everything else."""
from machine import Pin
import utime

RED_MS = 300
GREEN_MS = 500
RED_PIN = 14
GREEN_PIN = 15
ALERT_PIN = 16
BUTTON_PIN = 17


def main():
    red = Pin(RED_PIN, Pin.OUT)
    green = Pin(GREEN_PIN, Pin.OUT)
    alert = Pin(ALERT_PIN, Pin.OUT)
# >>> BLANK id=button level=2 hint="一个输入引脚存进 button：引脚号用上面的常量 BUTTON_PIN，第二个实参是输入模式，第三个实参开内部上拉电阻；三个实参都按位置写，常量都从 Pin 类上取 || 按钮一头接这个引脚、另一头接地：没按时上拉把它拉到 1，按下时被拉到 0；模式与上拉的常量名是 Pin.IN 与 Pin.PULL_UP" hintEn="One input pin stored in button: the pin number is the constant BUTTON_PIN above, the second argument is input mode, the third turns on the internal pull-up resistor; all three arguments positional, the constants taken from the Pin class || One side of the button goes to this pin and the other to ground: unpressed, the pull-up holds it at 1; pressed, it is pulled to 0. The constants are Pin.IN and Pin.PULL_UP"
    button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)
# <<< BLANK
    while True:
        red.toggle()
        utime.sleep_ms(RED_MS)
        green.toggle()
# >>> BLANK id=green-wait level=1 hint="和红灯那两行对称：绿灯翻转之后，用 utime 模块的毫秒睡眠等上绿灯自己的周期常量" hintEn="The mirror image of the red LED's two lines: after the green LED flips, sleep with the utime module's millisecond sleep for the green LED's own period constant"
        utime.sleep_ms(GREEN_MS)
# <<< BLANK
# >>> BLANK id=alert level=2 hint="一行：用 alert 的 value 方法写入 1 减去 button 读到的值（button.value()）；不写 if，不用 not || 按下时 button 读到 0，所以 1 减去它就是 1、提示灯亮；没按时读到 1，减出来是 0、灯灭" hintEn="One line: write 1 minus the value read from button (button.value()) with alert's value method; no if, no not || Pressed, button reads 0, so 1 minus it is 1 and the alert LED lights; unpressed it reads 1, the result is 0 and the LED goes off"
        alert.value(1 - button.value())
# <<< BLANK


if __name__ == "__main__":
    main()
