"""Work out a ticket price with conditions nested inside each other."""


def ticket_price(age, student):
    if age < 18:
        if age < 5:
            return 0
        else:
            return 5
    else:
# >>> BLANK id=senior level=2 hint="成年人这一支里先把老年人分出来：一个 if，age 写在比较号左边，用大于等于 || 老年票从 65 岁起" hintEn="In the adult branch, split off the seniors first: an if with age on the left of the comparison and greater-than-or-equal || Senior tickets start at age 65"
        if age >= 65:
# <<< BLANK
            return 6
        else:
# >>> BLANK id=student level=1 hint="剩下的成年人里分出学生：让 student 自己当条件——它本来就是 True 或 False，不调用 bool()，也不拿它去和 True 比较" hintEn="Among the remaining adults, split off the students: let student be the condition on its own - it already is True or False, so no bool() and no comparison with True"
            if student:
# <<< BLANK
                return 8
            else:
                return 12


if __name__ == "__main__":
    visitors = [(3, False), (12, True), (17, False), (18, True),
                (40, False), (64, True), (65, True), (80, False)]
    for age, student in visitors:
        print(age, student, ticket_price(age, student))
