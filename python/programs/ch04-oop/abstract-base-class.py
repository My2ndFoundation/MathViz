"""An abstract base class: a contract every subclass has to fill in."""

from abc import ABC, abstractmethod


# >>> BLANK id=abstract-parent level=1 hint="定义一个叫 Payment 的类，继承上面导入的那个抽象基类" hintEn="Define a class called Payment that inherits from the abstract base class imported above"
class Payment(ABC):
# <<< BLANK
    def __init__(self, pence):
        self.pence = pence

# >>> BLANK id=mark-abstract level=1 hint="给下面这个没写实现的方法戴上上面导入的另一个名字，作装饰器，单独一行" hintEn="Put the other name imported above in front of the unimplemented method below, as a decorator on a line of its own"
    @abstractmethod
# <<< BLANK
    def fee(self):
        pass

    def total(self):
# >>> BLANK id=use-the-hook level=1 hint="一行 return：金额加上手续费；金额写在加号左边，手续费通过调用 self 的 fee() 取得——具体算法由子类决定" hintEn="A single return: the amount plus the fee; the amount on the left of the plus, the fee obtained by calling fee() on self - each subclass decides how it is worked out"
        return self.pence + self.fee()
# <<< BLANK


class Card(Payment):
    def fee(self):
        return self.pence * 2 // 100


class Transfer(Payment):
    def fee(self):
        return 50


class Voucher(Payment):
    pass


if __name__ == "__main__":
    for payment in [Card(1000), Transfer(1000)]:
        print(type(payment).__name__, payment.total())
    for cls in [Payment, Voucher]:
        print(cls.__name__, sorted(cls.__abstractmethods__))
        try:
            cls(1000)
        except TypeError:
            print(cls.__name__, "cannot be instantiated")
