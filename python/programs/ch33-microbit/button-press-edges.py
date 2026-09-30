"""Count button presses: a press is the moment "up" turns into "down"."""
from microbit import *

SAMPLE_MS = 20
SAMPLES = 150            # 150 samples x 20 ms = 3 seconds


def count_presses(samples):
    # samples[i] is True while the button is held at sample i.
    # Pair every sample with the one before it; before the first one it was up.
    presses = 0
# >>> BLANK id=pairs level=3 hint="一个 for 头，同时拿到两个名字 before 和 now（先 before 后 now，不加括号）：用 zip 把两份列表并排走 || 第一份是在 samples 前面接上一个 False 的新列表（用 + 接，False 放在方括号里写在左边），第二份就是 samples 本身 || 这样第 i 对里 now 是第 i 个样本、before 是它前一个；第一个样本前面那个「前一个」就是那个 False" hintEn="One for header that gets two names at once, before and now (before first, no brackets round them): walk two lists side by side with zip || The first list is a new list made by putting a False in front of samples (joined with +, the False in square brackets on the left); the second is samples itself || So in pair i, now is sample i and before is the one ahead of it; for the very first sample, the one ahead is that False"
    for before, now in zip([False] + samples, samples):
# <<< BLANK
# >>> BLANK id=edge level=2 hint="一个 if：这一刻按着、前一刻没按着；now 写在前面、直接写（不和 True 比），两个条件用 and 连起来，后一个用 not（不写 == False，也不写 is False） || 只有「从没按到按下」的那一刻算一次；一直按着不算新的一次" hintEn="One if: held now and not held the moment before; now comes first and stands on its own (not compared with True), the two conditions joined with and, the second one with not (not == False, not is False) || Only the moment it goes from up to down counts as a press; holding it down does not count again"
        if now and not before:
# <<< BLANK
            presses += 1
    return presses


def main():
    while True:
        display.show("B")                   # press B to start
        while not button_b.was_pressed():
            sleep(SAMPLE_MS)
        button_a.get_presses()              # read once to reset its total to 0
        display.show(Image.TARGET)
        samples = []
        for _ in range(SAMPLES):
# >>> BLANK id=sample level=1 hint="一行：问按钮 A「此刻按着没有」（is_pressed，不是 was_pressed），用 append 把答案接到 samples 末尾" hintEn="One line: ask button A whether it is held right now (is_pressed, not was_pressed) and add the answer to the end of samples with append"
            samples.append(button_a.is_pressed())
# <<< BLANK
            sleep(SAMPLE_MS)
        display.scroll(str(count_presses(samples)))
        display.scroll(str(button_a.get_presses()))


if __name__ == "__main__":
    main()
