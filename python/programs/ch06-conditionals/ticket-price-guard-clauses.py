"""Work out a ticket price with guard clauses that return early."""


def ticket_price(age, student):
    if age < 5:
        return 0
    if age < 18:
        return 5
# >>> BLANK id=senior level=2 hint="再一条守卫子句把老年人打发走：一个 if（不用 elif），age 写在比较号左边，用大于等于 || 老年票从 65 岁起" hintEn="One more guard clause to send the seniors on their way: an if (not elif), age on the left of the comparison, greater-than-or-equal || Senior tickets start at age 65"
    if age >= 65:
# <<< BLANK
        return 6
# >>> BLANK id=student level=1 hint="还剩下的都是成年人，再把学生分出来：一个 if（不用 elif），让 student 自己当条件——它本来就是 True 或 False，不调用 bool()，也不拿它去和 True 比较" hintEn="Everyone still here is an adult, so split off the students: an if (not elif) with student as the condition on its own - it already is True or False, so no bool() and no comparison with True"
    if student:
# <<< BLANK
        return 8
    return 12


if __name__ == "__main__":
    visitors = [(3, False), (12, True), (17, False), (18, True),
                (40, False), (64, True), (65, True), (80, False)]
    for age, student in visitors:
        print(age, student, ticket_price(age, student))
