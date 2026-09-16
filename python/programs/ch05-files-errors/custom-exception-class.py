"""Define your own exception classes, give them attributes, and catch them as a family."""


class BankError(Exception):
    """Base class for every error this module raises."""


# >>> BLANK id=subclass-line level=1 hint="定义 InsufficientFunds 这个类：它是本模块自己那个异常基类的子类（不是直接继承 Exception）" hintEn="Define the class InsufficientFunds: it is a subclass of this module's own base exception class (not of Exception directly)"
class InsufficientFunds(BankError):
# <<< BLANK
    def __init__(self, balance, amount):
        super().__init__(f"cannot withdraw {amount} from {balance}")
        self.balance = balance
        self.amount = amount


class AccountFrozen(BankError):
    pass


def withdraw(balance, amount, frozen=False):
    if frozen:
        raise AccountFrozen("this account is frozen")
    if amount > balance:
# >>> BLANK id=raise-custom level=2 hint="余额不够：抛出上面定义的那个带属性的异常，把两个数按位置交给它的构造方法（不写关键字实参） || 实参顺序照 __init__ 的形参表：先余额，后金额" hintEn="Not enough money: raise the exception defined above that carries attributes, handing both numbers to its constructor by position (no keyword arguments) || argument order follows the parameters of __init__: the balance first, then the amount"
        raise InsufficientFunds(balance, amount)
# <<< BLANK
    return balance - amount


if __name__ == "__main__":
    print(withdraw(100, 30))
    try:
        withdraw(100, 250)
    except InsufficientFunds as e:
        print(e)
        print("short by", e.amount - e.balance)
    for frozen in [False, True]:
        try:
            withdraw(20, 50, frozen)
# >>> BLANK id=except-family level=2 hint="这一个子句要同时接住余额不足与账户冻结两种情况，绑定到 e——不列出两个具体类，也不用 Exception（那会把不相干的 bug 一起吞掉） || 接住一个类，就接住了它的所有子类；那两个类共同的父类是谁？" hintEn="This one clause has to catch both the not-enough-money case and the frozen-account case, bound to e - without listing the two specific classes, and not with Exception (that would swallow unrelated bugs too) || catching a class catches every subclass of it; which class do those two share as a parent?"
        except BankError as e:
# <<< BLANK
            print(type(e).__name__, "->", e)
    print(issubclass(AccountFrozen, Exception))
