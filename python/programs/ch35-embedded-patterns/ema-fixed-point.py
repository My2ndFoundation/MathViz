"""An exponential moving average in whole numbers: shifts instead of floats."""
from microbit import *

SHIFT = 3
SAMPLE_MS = 20


class Ema:
    def __init__(self, k):
        self.k = k
        self.acc = None

    def add(self, x):
        """Take one sample; return the smoothed value (weight 1 / 2**k on x)."""
        if self.acc is None:
# >>> BLANK id=first level=2 hint="一行，给 self.acc 赋值：第一个样本直接当作平均值，但存成放大 2 的 k 次方倍的定点数；用左移 <<，移 self.k 位，不用乘法 || acc 里存的始终是「平均值乘以 2**k」，所以第一拍就从 x 本身起步，而不是从 0 慢慢爬上来" hintEn="One line assigning self.acc: the first sample is taken as the average straight away, but stored as a fixed-point number scaled up by 2 to the power k; use a left shift <<, by self.k places, not a multiplication || acc always holds the average times 2**k, so the first tick starts from x itself instead of climbing up slowly from 0"
            self.acc = x << self.k
# <<< BLANK
        else:
# >>> BLANK id=update level=2 hint="一行，用增量赋值改 self.acc：加上新样本 x，再减去当前平均值；当前平均值是 self.acc 右移 self.k 位，这一段外面加一层括号 || 放大过的 acc 加 x、减一个平均值，等于让平均值朝 x 挪了 (x - 平均值) / 2**k" hintEn="One line changing self.acc with an augmented assignment: add the new sample x and take off the current average; the current average is self.acc shifted right by self.k places, with one pair of brackets round that part || Adding x to the scaled acc and taking one average off moves the average towards x by (x - average) / 2**k"
            self.acc += x - (self.acc >> self.k)
# <<< BLANK
        return self.acc >> self.k


def ema(samples, k):
    """Return the smoothed value after each sample."""
    f = Ema(k)
    return [f.add(x) for x in samples]


def column(milli_g):
    """Map -1024..1024 milli-g onto display columns 0..4."""
    return min(4, max(0, (milli_g + 1024) // 410))


def main():
    f = Ema(SHIFT)
    while True:
        raw = accelerometer.get_x()
        smoothed = f.add(raw)
        display.clear()
        display.set_pixel(column(raw), 0, 4)
        display.set_pixel(column(smoothed), 4, 9)
        sleep(SAMPLE_MS)


if __name__ == "__main__":
    main()
