"""Smooth the accelerometer with a moving average: O(1) work per sample."""
from microbit import *

WINDOW = 8
SAMPLE_MS = 20


class MovingAverage:
    def __init__(self, n):
        self.window = [0] * n
        self.i = 0
        self.total = 0
        self.count = 0

    def add(self, x):
        """Take one sample; return the average of the last n (or of all so far)."""
# >>> BLANK id=total level=2 hint="一行，用增量赋值改 self.total：加上新样本 x，同时减去它要顶替的那个旧样本（self.window 里下标 self.i 那一格）；右边写成 x 减旧样本 || 旧格子一开始是 0，所以窗口没满时减掉的是 0，总和照样对" hintEn="One line changing self.total with an augmented assignment: add the new sample x and at the same time take off the old sample it replaces (the slot of self.window at index self.i); write the right-hand side as x minus the old sample || The slots start at 0, so while the window is filling it is 0 that gets taken off and the total still comes out right"
        self.total += x - self.window[self.i]
# <<< BLANK
        self.window[self.i] = x
        self.i = (self.i + 1) % len(self.window)
        if self.count < len(self.window):
            self.count += 1
# >>> BLANK id=mean level=2 hint="一行 return：总和除以现有的样本个数 self.count（不是窗口长度），用整数除法 //，不用 / 再套 int() || // 向下取整：负的平均值也往更小的方向取" hintEn="One return line: the total divided by the number of samples held, self.count (not the window length), with integer division //, not / wrapped in int() || // rounds down: a negative average also goes towards the smaller number"
        return self.total // self.count
# <<< BLANK


def smooth(samples, n):
    """Return the moving average after each sample, with a window of n."""
    average = MovingAverage(n)
    return [average.add(x) for x in samples]


def column(milli_g):
    """Map -1024..1024 milli-g onto display columns 0..4."""
    return min(4, max(0, (milli_g + 1024) // 410))


def main():
    average = MovingAverage(WINDOW)
    while True:
        raw = accelerometer.get_x()
        smoothed = average.add(raw)
        display.clear()
        display.set_pixel(column(raw), 0, 4)
        display.set_pixel(column(smoothed), 4, 9)
        sleep(SAMPLE_MS)


if __name__ == "__main__":
    main()
