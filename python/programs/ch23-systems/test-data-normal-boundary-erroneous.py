"""Test a validator with normal, boundary and erroneous data, and watch the tests catch a boundary bug."""


def buggy_is_valid_age(text):
    """First attempt, kept to show what the tests catch: the upper limit is off by one."""
    return text.isdecimal() and int(text) < 120


def is_valid_age(text):
    """An age is a whole number of years from 0 to 120, typed as digits only."""
# >>> BLANK id=valid-age level=2 hint="这是修 bug 的练习：写出 buggy_is_valid_age 修掉那个差一错误之后的样子。一行 return：先用字符串方法 isdecimal() 判全是数字，再用 and 接上「换成整数后不超过 120」——int(text) 写在比较号左边，另一边仍是 120，不写下界 || 120 岁本身是合法的；负号、小数点、空串都过不了第一个判断，所以下界用不着" hintEn="This is a bug-fixing exercise: write buggy_is_valid_age as it should be once its off-by-one mistake is fixed. One return line: first the string method isdecimal() to test for digits only, then and, then that the whole number is at most 120 - int(text) on the left of the comparison, 120 still on the other side, and no lower bound || 120 itself is a valid age; a minus sign, a decimal point or an empty string all fail the first test, so a lower bound is not needed"
    return text.isdecimal() and int(text) <= 120
# <<< BLANK


TESTS = [
    ("normal", "17", True),
    ("normal", "64", True),
    ("boundary", "0", True),
    ("boundary", "120", True),
    ("boundary", "-1", False),
    ("boundary", "121", False),
    ("erroneous", "abc", False),
    ("erroneous", "12.5", False),
    ("erroneous", "", False),
]


def run_tests(check):
    passed = 0
    for kind, text, expected in TESTS:
        try:
# >>> BLANK id=assert-row level=2 hint="断言：把 text 交给 check 得到的结果等于这一行期待的 expected——调用写在 == 左边，不带说明信息 || 断言不成立时抛 AssertionError，由下面的 except 接住" hintEn="Assert that handing text to check gives the expected value for this row - the call on the left of ==, with no message || When the assertion fails it raises AssertionError, which the except below catches"
            assert check(text) == expected
# <<< BLANK
# >>> BLANK id=count-pass level=1 hint="走到这一行说明断言成立：通过数加一——用增强赋值 +=" hintEn="Reaching this line means the assertion held: add one to the pass count - use the augmented assignment +="
            passed += 1
# <<< BLANK
        except AssertionError:
            print(f"  FAIL {kind:<9} {text!r:>6} should give {expected}")
    print(f"{check.__name__}: {passed} of {len(TESTS)} tests passed")


if __name__ == "__main__":
    run_tests(buggy_is_valid_age)
    run_tests(is_valid_age)
    print(is_valid_age("007"), is_valid_age(" 17"))
