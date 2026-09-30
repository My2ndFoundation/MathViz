"""Count button presses with a pin interrupt; the main loop only reports them."""
from machine import Pin
import utime

BUTTON_PIN = 14
LED_PIN = 25
REPORT_MS = 100

presses = 0


def on_press(pin):
# >>> BLANK id=count level=2 hint="两行：先声明要改的是模块级的那个计数变量，再让它加一；加一用 +=，不写 presses = presses + 1 || 函数里给一个模块级变量赋值，得先用 global 点名它，否则 Python 会把它当成新的局部变量" hintEn="Two lines: first declare that the counter you are changing is the module-level one, then add one to it; add with +=, not presses = presses + 1 || To assign to a module-level variable inside a function you must name it with global first, or Python treats it as a new local variable"
    global presses
    presses += 1
# <<< BLANK


def main():
# >>> BLANK id=button-pin level=2 hint="构造一个 Pin 存进 button：三个实参全按位置写——常量 BUTTON_PIN（不写 14）、输入模式、上拉电阻，不写 mode= / pull= || 模式与上拉都是 Pin 类上的常量：输入是 IN，上拉是 PULL_UP" hintEn="Build a Pin and store it in button, with all three arguments given by position - the constant BUTTON_PIN (not 14), the input mode and the pull-up resistor, no mode= or pull= || The mode and the pull-up are both constants on the Pin class: input is IN and pull-up is PULL_UP"
    button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)
# <<< BLANK
    led = Pin(LED_PIN, Pin.OUT)
# >>> BLANK id=irq level=2 hint="button 上的一个方法调用，给这个引脚挂中断；两个实参都用关键字写，先 trigger= 后 handler=，handler 就是上面那个函数的名字（不加括号） || 按下时引脚从 1 掉到 0（上拉），所以触发条件是下降沿，Pin 类上的常量 IRQ_FALLING" hintEn="One method call on button that attaches an interrupt to the pin; both arguments by keyword, trigger= first and then handler=, where the handler is the name of the function above (no brackets) || Pressing pulls the pin from 1 down to 0 (it has a pull-up), so the trigger is a falling edge, the Pin constant IRQ_FALLING"
    button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)
# <<< BLANK
    shown = 0
    print("press the button on GP14")
    while True:
        count = presses
        if count != shown:
            print("presses:", count)
            led.toggle()
            shown = count
        utime.sleep_ms(REPORT_MS)


if __name__ == "__main__":
    main()
