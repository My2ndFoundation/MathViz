"""Move money between two accounts so that a failed transfer can never leave only one side changed."""


class TransferError(Exception):
    pass


class Account:
    def __init__(self, owner, balance):
        self.owner = owner
        self.balance = balance


class Bank:
    def __init__(self):
        self.accounts = {}
        self.log = []

    def open(self, owner, balance):
        self.accounts[owner] = Account(owner, balance)

    def transfer(self, source, target, amount):
        # Check everything first ...
# >>> BLANK id=both-exist level=2 hint="一个 if 的头：付款方或收款方有一个不在 self.accounts 里——两个 not in 判断用 or 连起来，先判 source || 不查到底有没有这两个账户就动钱，正是一边扣了、一边却找不到人的来源" hintEn="The head of an if: either the payer or the payee is missing from self.accounts - join two not in tests with or, testing source first || Moving money before checking that both accounts exist is exactly how one side gets charged while the other cannot be found"
        if source not in self.accounts or target not in self.accounts:
# <<< BLANK
            raise TransferError("no such account")
        if amount <= 0:
            raise TransferError("amount must be positive")
        payer = self.accounts[source]
# >>> BLANK id=enough-money level=2 hint="一个 if 的头：付款方的余额不够这笔钱——payer.balance 写在比较号左边，用严格的小于号 || 余额恰好等于金额时可以转，转完是 0" hintEn="The head of an if: the payer's balance is not enough for this amount - payer.balance on the left of the comparison, with a strict less-than || A balance exactly equal to the amount can be transferred, leaving 0"
        if payer.balance < amount:
# <<< BLANK
            raise TransferError("insufficient funds")
        # ... then change both sides together.
# >>> BLANK id=move-money level=2 hint="两行，同一层：先从付款方扣、再给收款方加，都用增强赋值（-= 与 +=）；付款方就用上面已经取好的 payer，收款方的账户用方括号从 self.accounts 里按 target 取 || 两行改的都是账户的 balance 属性，改动的数目是 amount" hintEn="Two lines at the same depth: take from the payer first, then add to the payee, both with augmented assignment (-= and +=); for the payer use payer, already fetched above, and get the payee's account out of self.accounts with square brackets and target || Both lines change an account's balance attribute, and the size of the change is amount"
        payer.balance -= amount
        self.accounts[target].balance += amount
# <<< BLANK
        self.log.append((source, target, amount))


def run_ops(ops):
    bank = Bank()
    results = []
    for op in ops:
        if op[0] == "open":
            bank.open(op[1], op[2])
        else:
            try:
                bank.transfer(op[1], op[2], op[3])
                results.append("ok")
            except TransferError as e:
                results.append(str(e))
    balances = {owner: acct.balance for owner, acct in bank.accounts.items()}
    return results, balances, bank.log


if __name__ == "__main__":
    bank = Bank()
    bank.open("Ada", 50)
    bank.open("Ben", 20)
    for source, target, amount in [("Ada", "Ben", 30), ("Ben", "Ada", 100), ("Ada", "Cal", 5), ("Ben", "Ada", 0)]:
        try:
            bank.transfer(source, target, amount)
            print("done:", source, "->", target, amount)
        except TransferError as e:
            print("refused:", e)
        print("   ", bank.accounts["Ada"].balance, bank.accounts["Ben"].balance)
    print(bank.log)
