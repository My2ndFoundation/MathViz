"""A library of three classes: Book and Member hold the facts, Library applies the loan rules."""

LOAN_LIMIT = 2
LOAN_DAYS = 14
FINE_PER_DAY = 20


class LoanError(Exception):
    pass


class Book:
    def __init__(self, title):
        self.title = title
        self.borrower = None
        self.due = None


class Member:
    def __init__(self, name):
        self.name = name
        self.titles = set()


class Library:
    def __init__(self):
        self.books = {}
        self.members = {}

    def add_book(self, title):
        self.books[title] = Book(title)

    def join(self, name):
        self.members[name] = Member(name)

    def lookup(self, name, title):
        if name not in self.members or title not in self.books:
            raise LoanError("no such member or book")
        return self.members[name], self.books[title]

    def borrow(self, name, title, day):
        member, book = self.lookup(name, title)
# >>> BLANK id=already-out level=2 hint="一个 if 的头：这本书已经有借阅人了——拿 book.borrower 和 None 比，用 is not，不靠真值判断 || 没人借时 borrower 是 None" hintEn="The head of an if: this book already has a borrower - compare book.borrower with None using is not, rather than relying on truthiness || When nobody has it, borrower is None"
        if book.borrower is not None:
# <<< BLANK
            raise LoanError("already on loan")
# >>> BLANK id=at-limit level=2 hint="一个 if 的头：这位成员手上的书已经到了上限——对 member.titles 用 len()，写在比较号左边，右边是常量 LOAN_LIMIT；用大于等于，不用 == || 已经借满 2 本时再借就不行；大于等于比 == 稳：哪天数目因为别的 bug 超了，== 会放行" hintEn="The head of an if: this member already holds as many books as allowed - len() of member.titles on the left of the comparison, the constant LOAN_LIMIT on the right; use greater-than-or-equal, not == || Once 2 are out, the next is refused; >= is safer than ==, which would let a loan through if some other bug ever pushed the count past the limit"
        if len(member.titles) >= LOAN_LIMIT:
# <<< BLANK
            raise LoanError("loan limit reached")
        book.borrower = member
# >>> BLANK id=due-day level=1 hint="记下应还日，存进 book.due：借出那天的 day 加上常量 LOAN_DAYS，day 写在前" hintEn="Record the due day in book.due: the day it was borrowed plus the constant LOAN_DAYS, with day first"
        book.due = day + LOAN_DAYS
# <<< BLANK
        member.titles.add(title)
        return book.due

    def give_back(self, name, title, day):
        member, book = self.lookup(name, title)
        if book.borrower is not member:
            raise LoanError("not borrowed by this member")
        book.borrower = None
        member.titles.remove(title)
        return max(0, day - book.due) * FINE_PER_DAY


def run_ops(ops):
    library = Library()
    results = []
    for op in ops:
        if op[0] == "book":
            library.add_book(op[1])
        elif op[0] == "member":
            library.join(op[1])
        else:
            action = library.borrow if op[0] == "borrow" else library.give_back
            try:
                results.append(action(op[1], op[2], op[3]))
            except LoanError as e:
                results.append(str(e))
    return results


if __name__ == "__main__":
    setup = [("book", "Dune"), ("book", "Emma"), ("book", "Ivanhoe"), ("member", "Ada"), ("member", "Ben")]
    loans = [
        ("borrow", "Ada", "Dune", 1), ("borrow", "Ben", "Dune", 2), ("borrow", "Ada", "Emma", 3),
        ("borrow", "Ada", "Ivanhoe", 4), ("return", "Ben", "Emma", 10), ("return", "Ada", "Emma", 10),
        ("return", "Ada", "Dune", 20), ("borrow", "Cal", "Dune", 21),
    ]
    for op, result in zip(loans, run_ops(setup + loans)):
        print(op, "->", result)
