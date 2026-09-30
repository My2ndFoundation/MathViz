"""Hand values from an interrupt to the main loop through a ring buffer."""
from machine import Pin, disable_irq, enable_irq
import micropython
import time

CAPACITY = 8
SENSOR_PIN = 16


class Ring:
    def __init__(self, capacity):
        self.slots = [0] * capacity
        self.head = 0
        self.count = 0
        self.overruns = 0

    def put(self, value):
# >>> BLANK id=tail level=2 hint="一行，存进 tail：最旧的一格在 head，往后数 count 格就是下一个空位；用取余绕回开头，除数写成 len(self.slots)，不写 capacity；相加时 self.head 写在前 || 先把 self.head 与 self.count 相加（外面一层括号），再对格数取余" hintEn="One line, stored in tail: the oldest slot is at head, and count slots further on is the next free one; wrap round to the start with the remainder, dividing by len(self.slots), not capacity; in the sum, self.head comes first || Add self.head and self.count first (one pair of brackets round them), then take the remainder by the number of slots"
        tail = (self.head + self.count) % len(self.slots)
# <<< BLANK
        self.slots[tail] = value
        if self.count == len(self.slots):
            self.head = (self.head + 1) % len(self.slots)
            self.overruns += 1
        else:
            self.count += 1

    def get(self):
# >>> BLANK id=empty level=1 hint="一个 if 头加一行 return：缓冲里一个值都没有时，交回 None；条件用 == 把 self.count 与 0 比，self.count 写在左边" hintEn="An if header plus one return line: when the buffer holds no values at all, hand back None; the condition compares self.count with 0 using ==, self.count on the left"
        if self.count == 0:
            return None
# <<< BLANK
        value = self.slots[self.head]
        self.head = (self.head + 1) % len(self.slots)
        self.count -= 1
        return value


def run(capacity, ops):
    """ops are ("put", value) or ("get",); return (values got, overrun count)."""
    ring = Ring(capacity)
    got = []
    for op in ops:
        if op[0] == "put":
            ring.put(op[1])
        else:
            got.append(ring.get())
    return got, ring.overruns


def main():
    micropython.alloc_emergency_exception_buf(100)
    ring = Ring(CAPACITY)
    sensor = Pin(SENSOR_PIN, Pin.IN, Pin.PULL_UP)

    def on_edge(pin):
        ring.put(time.ticks_ms())

    sensor.irq(trigger=Pin.IRQ_FALLING, handler=on_edge)
    while True:
# >>> BLANK id=guard level=2 hint="一行，存进 state：取出之前先关中断，把关之前的中断状态记下来，下面几行后再用它恢复；函数已经从 machine 导入，直接写名字 || 它叫 disable_irq，不带实参" hintEn="One line, stored in state: switch interrupts off before taking a value out, remembering the interrupt state from before, which is used a couple of lines later to restore it; the function is already imported from machine, so write its bare name || It is called disable_irq, with no arguments"
        state = disable_irq()
# <<< BLANK
        stamp = ring.get()
        enable_irq(state)
        if stamp is not None:
            print("edge at", stamp, "ms; overruns:", ring.overruns)
        time.sleep_ms(100)


if __name__ == "__main__":
    main()
