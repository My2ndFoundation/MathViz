"""Read the accelerometer and show an arrow for the way the board is tipped."""
from microbit import *

THRESHOLD = 300          # milli-g: smaller tilts than this count as flat
ARROWS = {
    "left": Image.ARROW_W,
    "right": Image.ARROW_E,
    "forward": Image.ARROW_N,
    "back": Image.ARROW_S,
    "flat": Image.SQUARE_SMALL,
}


def tilt(x, y, threshold):
    # x and y are readings in milli-g; about 1000 means tipped right over.
# >>> BLANK id=flat level=2 hint="一个 if：两个轴的绝对值都没到阈值——abs(x) 的比较写在前、abs(y) 的写在后，用 and 连起来，abs(...) 写在比较号左边，用严格的小于号 || 恰好等于阈值的读数不算平放" hintEn="One if: neither axis has reached the threshold in size - the abs(x) comparison first, then the abs(y) one, joined with and, abs(...) on the left of each comparison, with a strict less-than || A reading exactly equal to the threshold does not count as flat"
    if abs(x) < threshold and abs(y) < threshold:
# <<< BLANK
        return "flat"
# >>> BLANK id=bigger level=2 hint="一个 if：x 轴倾得至少和 y 轴一样多——abs(x) 写在比较号左边、abs(y) 写在右边 || 两个轴一样大时算 x 轴赢，所以用大于等于号" hintEn="One if: the x axis is tipped at least as much as the y axis - abs(x) on the left of the comparison, abs(y) on the right || When the two are the same size x wins, so use greater-than-or-equal"
    if abs(x) >= abs(y):
# <<< BLANK
        if x > 0:
            return "right"
        return "left"
    if y > 0:
        return "back"
    return "forward"


def main():
    while True:
# >>> BLANK id=read level=1 hint="一行：把加速度计此刻的 x 读数、y 读数（get_x()、get_y()，按这个顺序）和 THRESHOLD 交给 tilt，结果存进 direction" hintEn="One line: hand the accelerometer's current x reading, its y reading (get_x(), get_y(), in that order) and THRESHOLD to tilt, and store the result in direction"
        direction = tilt(accelerometer.get_x(), accelerometer.get_y(), THRESHOLD)
# <<< BLANK
        display.show(ARROWS[direction])
        sleep(100)


if __name__ == "__main__":
    main()
