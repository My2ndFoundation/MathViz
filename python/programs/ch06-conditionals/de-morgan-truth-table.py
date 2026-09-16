"""Print truth tables that check both of De Morgan's laws, row by row."""


def bit(value):
    return 1 if value else 0


def first_law(a, b):
    left = not (a and b)
# >>> BLANK id=first-right level=2 hint="德摩根第一定律的右边，存进 right：两个各自取反之后的量，用一个运算符连起来；a 那一项在前，不加任何括号 || not 分别作用在 a 和 b 上，中间的运算符翻转成与左边相反的那一个" hintEn="The right-hand side of the first law, stored in right: two values, each negated on its own, joined by one operator; the a part first, with no brackets at all || One not applies to a and another to b, and the operator between them flips to the opposite of the one on the left side"
    right = not a or not b
# <<< BLANK
    return left, right


def second_law(a, b):
# >>> BLANK id=second-left level=2 hint="德摩根第二定律的左边，存进 left：对一个带括号的整体取一次反，括号只有这一对；括号里 a 在前 || 括号里是 a 和 b 用右边那个运算符的「另一个」连起来；not 写在括号外面——not 比 and / or 先算，不加括号它就只管紧跟在后面的 a" hintEn="The left-hand side of the second law, stored in left: negate one bracketed group as a whole, with only that one pair of brackets; a first inside them || Inside the brackets, a and b are joined by the opposite of the operator on the right side; not goes outside the brackets - not is worked out before and / or, so without them it would apply only to the a right after it"
    left = not (a or b)
# <<< BLANK
    right = not a and not b
    return left, right


def print_table(title, law):
    print(title)
    print("A B | L R | L == R")
    for a in (False, True):
        for b in (False, True):
            left, right = law(a, b)
            print(bit(a), bit(b), "|", bit(left), bit(right), "|", left == right)


if __name__ == "__main__":
    print_table("De Morgan's first law", first_law)
    print_table("De Morgan's second law", second_law)
    print(not True and False, not (True and False))
