"""Knock out single-sample spikes with a three-point median filter."""
from machine import ADC, Pin
import time

ADC_PIN = 26
SAMPLE_MS = 50


class Median3:
    def __init__(self):
        self.a = None
        self.b = None

    def add(self, c):
        """Take one sample; return the median of it and the two before it."""
        a, b = self.a, self.b
# >>> BLANK id=shift level=2 hint="一行，同时给 self.a 与 self.b 赋值（逗号隔开的两个目标，右边也是逗号隔开、不加括号）：两个旧样本整体往前挪一格，最新的 c 进到 self.b；右边用上一行取出来的局部变量，不再写 self. || 旧的 b 变成新的 self.a，c 变成新的 self.b" hintEn="One line assigning self.a and self.b together (two targets separated by a comma, and a comma-separated right-hand side with no brackets): the two old samples move along one place and the newest, c, goes into self.b; the right-hand side uses the local variables from the line above, not self. || The old b becomes the new self.a and c becomes the new self.b"
        self.a, self.b = b, c
# <<< BLANK
        if a is None:
            return c
# >>> BLANK id=median level=3 hint="一行 return，不排序：外层是 max，它的两个实参依次是 a 与 b 里较小的那个、以及另一个 min；每一处 min / max 里，实参都按 a、b、c 的先后写（嵌套的那个调用算作占它里面最靠前的字母的位置） || 第二个实参是 min 取「a 与 b 里较大的那个」和 c 之间较小的 || 拿 a 不大于 b 的情形核一遍：外层 max 的第一个实参就是 a，第二个是 b 与 c 里较小的——三个数的中间那个正是它俩里较大的" hintEn="One return line, without sorting: the outer call is max, whose two arguments are, in order, the smaller of a and b, and another min; inside every min / max the arguments go in the order a, b, c (a nested call takes the place of the earliest letter inside it) || The second argument is min of the larger of a and b and c || Check it for the case a is not bigger than b: the outer max then gets a and the smaller of b and c - and the middle of the three is exactly the larger of those two"
        return max(min(a, b), min(max(a, b), c))
# <<< BLANK


def median3(samples):
    """Return the filtered value after each sample (the first two pass through)."""
    f = Median3()
    return [f.add(x) for x in samples]


def main():
    adc = ADC(Pin(ADC_PIN))
    f = Median3()
    while True:
        raw = adc.read_u16()
        print(raw, f.add(raw))
        time.sleep_ms(SAMPLE_MS)


if __name__ == "__main__":
    main()
