"""Decide whether a year is a leap year, one rule per level of nested if."""


def is_leap(year):
    if year % 4 == 0:
# >>> BLANK id=century level=2 hint="第二层规则：在能被 4 整除的年份里，再问它是不是整百年——余数写成和上一行一样的「% … == 0」形式，不用 not || 整百年就是能被 100 整除的年份" hintEn="The second rule: among years divisible by 4, ask whether this one is a whole century - write the remainder test in the same % ... == 0 form as the line above, not with not || A whole century is a year divisible by 100"
        if year % 100 == 0:
# <<< BLANK
# >>> BLANK id=four-hundred level=2 hint="第三层规则：整百年里只有一部分是闰年——同样写成「% … == 0」的形式 || 整百年要能被 400 整除才是闰年" hintEn="The third rule: only some whole centuries are leap years - again in the % ... == 0 form || A whole century is a leap year only if it is divisible by 400"
            if year % 400 == 0:
# <<< BLANK
                return True
            else:
                return False
        else:
            return True
    else:
        return False


def days_in_february(year):
# >>> BLANK id=february level=2 hint="用一个条件表达式交回天数，不写 if 语句；条件就是调用上面那个函数本身（不再拿结果和 True 比较），闰年的天数写在最前面 || 闰年二月 29 天，平年 28 天" hintEn="Hand back the number of days with a conditional expression, not an if statement; the condition is just a call to the function above (not compared with True), and the leap-year number comes first || February has 29 days in a leap year and 28 otherwise"
    return 29 if is_leap(year) else 28
# <<< BLANK


if __name__ == "__main__":
    for year in (2024, 2023, 1900, 2000, 2100, 2400):
        print(year, is_leap(year), days_in_february(year))
