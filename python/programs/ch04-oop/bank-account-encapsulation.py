"""Keep a balance behind methods that check every change to it."""


class BankAccount:
    def __init__(self, owner):
        self.owner = owner
        self._balance = 0

# >>> BLANK id=read-only level=2 hint="三行：一行装饰器，一个只收 self 的方法，方法体只有一个 return；方法名就是外面读的那个名字 || 装饰器用内置的那个把方法变成「像属性一样读」的装饰器，它让外面写 acc.balance 不带括号也能调到这个方法；交回去的是带下划线的那个属性" hintEn="Three lines: a decorator, a method taking only self, and a body that is a single return; the method's name is the name the outside reads || The decorator is the built-in one that turns a method into something you read like an attribute, which lets outside code write acc.balance with no brackets and still reach this method; what it hands back is the underscored attribute"
    @property
    def balance(self):
        return self._balance
# <<< BLANK

    def deposit(self, amount):
        if amount <= 0:
            return False
        self._balance += amount
        return True

    def withdraw(self, amount):
        if amount <= 0 or amount > self._balance:
            return False
# >>> BLANK id=take-out level=1 hint="检查都通过了，从带下划线的余额里扣掉 amount：照 deposit 里加钱那一行的写法，用 -=" hintEn="Every check has passed, so take amount off the underscored balance: written like the line in deposit that adds money, using -="
        self._balance -= amount
# <<< BLANK
        return True


if __name__ == "__main__":
    acc = BankAccount("Ada")
    print(acc.deposit(50), acc.balance)
    print(acc.withdraw(80), acc.balance)
    print(acc.withdraw(30), acc.balance)
    print(acc.deposit(-5), acc.balance)
    print(BankAccount.balance.fset is None)
    print(acc._balance)
