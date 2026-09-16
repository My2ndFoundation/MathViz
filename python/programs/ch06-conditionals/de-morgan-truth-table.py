"""Print truth tables that check both of De Morgan's laws, row by row."""


def bit(value):
    return 1 if value else 0


def first_law(a, b):
    left = not (a and b)
# >>> BLANK id=first-right level=2 hint="德摩根第一定律的右边：把 not 分别放到 a 和 b 前面，中间的运算符翻成另一个；a 在前，不加括号 || 「与」的否定，等于「各自否定」之后的「或」" hintEn="The right-hand side of the first law: put a not in front of a and in front of b separately, and flip the operator between them to the other one; a first, no brackets || The negation of and equals or, once each side has been negated"
    right = not a or not b
# <<< BLANK
    return left, right


def second_law(a, b):
# >>> BLANK id=second-left level=2 hint="德摩根第二定律的左边：先把 a 和 b 用第一定律左边那个运算符的「另一个」连起来，再对整体取 not；这时括号必不可少（只要这一对），a 在前 || not 比 and / or 先算：不加括号，not 就只管紧跟在它后面的 a，而这里要取反的是整个「或」" hintEn="The left-hand side of the second law: join a and b with the opposite of the operator on the first law's left side, then apply not to the whole thing; this time the brackets are essential (just that one pair), a first || not is worked out before and / or: without brackets it applies only to the a right after it, and here what needs negating is the whole or"
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
    print_table("not (A and B)  vs  not A or not B", first_law)
    print_table("not (A or B)  vs  not A and not B", second_law)
    print(not True and False, not (True and False))
