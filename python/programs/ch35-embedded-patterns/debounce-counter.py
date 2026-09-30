"""Debounce a switch by counting: a change counts only after n samples in a row."""
from microbit import *

SAMPLE_MS = 5
NEEDED = 4


def update(stable, count, raw, n):
    """Take one raw sample; return the new (stable, count)."""
    if raw != stable:
        count += 1
# >>> BLANK id=accept level=2 hint="一个 if 头加一行 return：count 写在比较号左边，与 n 比，用「大于等于」；return 交回两个值、逗号隔开不加括号——先是新承认的电平 raw，再是清零后的计数 || 连续不一致的样本够了 n 个，就承认这个新电平，计数从 0 重新开始" hintEn="An if header plus one return line: count on the left of the comparison, against n, with greater-than-or-equal; the return hands back two values separated by a comma, no brackets - first the newly accepted level raw, then the count reset to zero || Once n disagreeing samples in a row have arrived, the new level is accepted and counting starts again from 0"
        if count >= n:
            return raw, 0
# <<< BLANK
        return stable, count
# >>> BLANK id=agree level=2 hint="函数最后一行：走到这里说明 raw 与 stable 一致；return 交回两个值、逗号隔开不加括号——第一个值写 stable、不写 raw：这里两者恰好相等，但这一行要说的是「稳定值不变」，写 stable 才说得出这个意思；计数怎么办由你想 || 一个一致的样本说明刚才那几个不一致的只是毛刺，计数要清零——「连续」二字靠的就是这一行" hintEn="The function's last line: reaching it means raw agrees with stable; the return hands back two values separated by a comma, no brackets - write stable as the first value, not raw: the two happen to be equal here, but what this line says is that the stable level is unchanged, and only stable says that; you decide what happens to the count || One agreeing sample shows the disagreeing ones before it were only a glitch, so the count goes back to zero - the words in a row depend on this line"
    return stable, 0
# <<< BLANK


def debounce(samples, n):
    """Return the stable level after each raw sample (it starts at 0)."""
    stable = 0
    count = 0
    levels = []
    for raw in samples:
        stable, count = update(stable, count, raw, n)
        levels.append(stable)
    return levels


def main():
    stable = 0
    count = 0
    presses = 0
    while True:
        raw = pin0.read_digital()
        before = stable
        stable, count = update(stable, count, raw, NEEDED)
        if before == 0 and stable == 1:
            presses += 1
            display.show(presses % 10)
        sleep(SAMPLE_MS)


if __name__ == "__main__":
    main()
