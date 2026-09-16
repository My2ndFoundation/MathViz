"""Decide whether a year is a leap year with a single boolean expression."""


def is_leap(year):
# >>> BLANK id=one-expression level=3 hint="直接 return 一个布尔表达式，不写 if：先写「能被 4 整除」，接 and，再接一对括号（只这一对，各个比较不再单独加括号），括号里是两种情况用 or 连起来——先写把整百年排除掉的那种，再写把一部分整百年救回来的那种；整除写成 % … == 0，不整除写成 % … != 0（不用 not） || 括号里的两种情况：不是整百年，或者能被 400 整除 || 不是整百年，就是 year 除以 100 的余数不等于 0" hintEn="Return one boolean expression directly, with no if: first divisible by 4, then and, then one pair of brackets (only that pair - no brackets round the single comparisons) holding two cases joined by or - first the case that rules the whole centuries out, then the case that lets some of them back in; write divisible as % ... == 0 and not divisible as % ... != 0 (not with not) || The two cases inside the brackets: not a whole century, or divisible by 400 || Not a whole century means the remainder of year divided by 100 is not equal to 0"
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
# <<< BLANK


def days_in_february(year):
# >>> BLANK id=february level=2 hint="用一个条件表达式交回天数，不写 if 语句；条件就是调用上面那个函数本身（不再拿结果和 True 比较），闰年的天数写在最前面 || 闰年二月 29 天，平年 28 天" hintEn="Hand back the number of days with a conditional expression, not an if statement; the condition is just a call to the function above (not compared with True), and the leap-year number comes first || February has 29 days in a leap year and 28 otherwise"
    return 29 if is_leap(year) else 28
# <<< BLANK


if __name__ == "__main__":
    for year in (2024, 2023, 1900, 2000, 2100, 2400):
        print(year, is_leap(year), days_in_february(year))
