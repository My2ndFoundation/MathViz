"""One button, three events: short press, long press and double press."""
from microbit import *
import utime

LONG_MS = 500
GAP_MS = 250
IDLE, DOWN, WAIT, LOCKED = "idle", "down", "wait", "locked"
SYMBOLS = {"short": "S", "long": "L", "double": "D"}


def step(state, timer, pressed, elapsed, long_ms, gap_ms):
    """One tick of the state machine; return (state, timer, event or None)."""
    if state == IDLE:
        if pressed:
            return DOWN, 0, None
    elif state == DOWN:
        if not pressed:
            return WAIT, 0, None
        timer += elapsed
# >>> BLANK id=long level=2 hint="一个 if 头加一行 return：timer 写在比较号左边，与 long_ms 比，用「大于等于」；return 交回三个值、逗号隔开不加括号——锁定状态、清零的计时、事件名字符串（用双引号，与本程序其余字符串一致） || 按住够久就马上报长按，不等松开；报完进锁定状态，一直到松开都不再报别的。事件名就是 SYMBOLS 里的键 long" hintEn="An if header plus one return line: timer on the left of the comparison, against long_ms, with greater-than-or-equal; the return hands back three values separated by commas, no brackets - the locked state, the timer reset to zero, and the event name as a string (in double quotes, like every other string in this program) || Held long enough, a long press is reported at once, without waiting for the release; then the machine locks and reports nothing else until the button is let go. The event name is the SYMBOLS key long"
        if timer >= long_ms:
            return LOCKED, 0, "long"
# <<< BLANK
    elif state == WAIT:
        if pressed:
# >>> BLANK id=double level=2 hint="一行 return，交回三个值、逗号隔开不加括号：状态、清零的计时、事件名字符串（用双引号，与本程序其余字符串一致）；松开后在间隔之内又按下 || 第二次按下立刻报双击，然后和长按一样进锁定状态，等松开；事件名就是 SYMBOLS 里的键 double" hintEn="One return line handing back three values separated by commas, no brackets: the state, the timer reset to zero, and the event name as a string (in double quotes, like every other string in this program); the button went down again within the gap after a release || The second press is reported as a double press at once, and then, as after a long press, the machine locks until release; the event name is the SYMBOLS key double"
            return LOCKED, 0, "double"
# <<< BLANK
        timer += elapsed
        if timer >= gap_ms:
            return IDLE, 0, "short"
# >>> BLANK id=release level=3 hint="一个 elif 头加一行 return：这里剩下的只有锁定状态，所以条件里不写 state，只用 not 看按键；return 交回三个值、逗号隔开不加括号 || 松开了就回到空闲状态，计时清零 || 松开不算事件，所以第三个值是 None" hintEn="An elif header plus one return line: the only state left here is the locked one, so the condition leaves state out and looks only at the button, using not; the return hands back three values separated by commas, no brackets || Once released it goes back to the idle state, with the timer reset to zero || A release is not an event, so the third value is None"
    elif not pressed:
        return IDLE, 0, None
# <<< BLANK
    return state, timer, None


def classify(samples, long_ms, gap_ms):
    """samples are (elapsed_ms, pressed) pairs; return [(tick, event), ...]."""
    state, timer = IDLE, 0
    events = []
    for tick, (elapsed, pressed) in enumerate(samples):
        state, timer, event = step(state, timer, pressed, elapsed, long_ms, gap_ms)
        if event is not None:
            events.append((tick, event))
    return events


def main():
    state, timer = IDLE, 0
    last = utime.ticks_ms()
    while True:
        now = utime.ticks_ms()
        elapsed = utime.ticks_diff(now, last)
        last = now
        pressed = button_a.is_pressed()
        state, timer, event = step(state, timer, pressed, elapsed, LONG_MS, GAP_MS)
        if event is not None:
            display.show(SYMBOLS[event])
        sleep(10)


if __name__ == "__main__":
    main()
