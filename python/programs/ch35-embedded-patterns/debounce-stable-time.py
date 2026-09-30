"""Debounce a switch by time: a new level counts once it has held for stable_ms."""
from microbit import *
import utime

STABLE_MS = 20


def update(stable, last, since, raw, elapsed, stable_ms):
    """Take one raw sample; return the new (stable, last, since)."""
    if raw != last:
        last = raw
        since = 0
    else:
# >>> BLANK id=hold level=1 hint="一行：电平没变，把这一拍经过的毫秒数 elapsed 累加进 since，用增量赋值" hintEn="One line: the level has not changed, so add this tick's elapsed milliseconds to since, with an augmented assignment"
        since += elapsed
# <<< BLANK
# >>> BLANK id=accept level=3 hint="一个 if 头加一行赋值：条件由 and 连起两个比较，先写「since 大于等于 stable_ms」、再写「last 不等于 stable」，每个比较都把这里的变量写在左边；体里把 stable 改成 last || 两个条件缺一不可：保持得够久，而且这个电平确实和目前承认的不一样 || 恰好保持了 stable_ms 毫秒也算够久；承认的是 last 这个已经保持住的电平" hintEn="An if header plus one assignment: the condition joins two comparisons with and, first since greater than or equal to stable_ms, then last not equal to stable, each with the variable named here on the left; the body sets stable to last || Both conditions are needed: it has held long enough, and this level really differs from the one currently accepted || Holding for exactly stable_ms milliseconds is long enough; what gets accepted is last, the level that has held"
    if since >= stable_ms and last != stable:
        stable = last
# <<< BLANK
    return stable, last, since


def debounce_ms(samples, stable_ms):
    """samples are (elapsed_ms, raw) pairs; return the stable level after each."""
    stable, last, since = 0, 0, 0
    levels = []
    for elapsed, raw in samples:
        stable, last, since = update(stable, last, since, raw, elapsed, stable_ms)
        levels.append(stable)
    return levels


def main():
    stable, last, since = 0, 0, 0
    presses = 0
    previous = utime.ticks_ms()
    while True:
        now = utime.ticks_ms()
        elapsed = utime.ticks_diff(now, previous)
        previous = now
        before = stable
        raw = pin0.read_digital()
        stable, last, since = update(stable, last, since, raw, elapsed, STABLE_MS)
        if before == 0 and stable == 1:
            presses += 1
            display.show(presses % 10)


if __name__ == "__main__":
    main()
