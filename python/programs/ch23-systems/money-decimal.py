"""Do money sums with decimal.Decimal: build values from strings, and state the rounding at every step."""

from decimal import ROUND_HALF_UP, Decimal

PENNY = Decimal("0.01")


def add_interest(balance, rate_percent, months):
    """balance in pence (not negative); rate_percent a whole-number monthly rate; returns pence."""
# >>> BLANK id=to-pounds level=1 hint="把整数便士变成 Decimal 表示的英镑，存进 pounds：先用 Decimal() 包住 balance，再除以整数 100" hintEn="Turn the whole pence into pounds held as a Decimal and keep it in pounds: wrap balance in Decimal() first, then divide by the whole number 100"
    pounds = Decimal(balance) / 100
# <<< BLANK
    for _ in range(months):
# >>> BLANK id=quantize level=2 hint="算出这个月的利息，存进 interest：pounds 乘以 rate_percent 再除以 100，整个括起来，然后调用它的 quantize 方法舍到一便士——quantize 的第一个实参是上面定义的常量 PENNY，舍入规则用关键字实参给出 || 关键字是 rounding，值是从 decimal 导入的半数进位常量" hintEn="Work out this month's interest and keep it in interest: pounds times rate_percent divided by 100, all in brackets, then call its quantize method to round it to a penny - quantize's first argument is the constant PENNY defined above, and the rounding rule is given as a keyword argument || The keyword is rounding, and its value is the round-half-up constant imported from decimal"
        interest = (pounds * rate_percent / 100).quantize(PENNY, rounding=ROUND_HALF_UP)
# <<< BLANK
        pounds += interest
# >>> BLANK id=back-to-pence level=2 hint="交回整数便士：pounds 乘以 100（pounds 在前），再用 int() 变成整数 || 结果与另一个写法一样是 int，不是 Decimal——pounds 始终只有两位小数，所以乘以 100 之后是精确的整数" hintEn="Return whole pence: pounds times 100 (pounds first), turned into a whole number with int() || The result is an int, just like the other version, not a Decimal - pounds only ever has two decimal places, so times 100 it is an exact whole number"
    return int(pounds * 100)
# <<< BLANK


if __name__ == "__main__":
    print(Decimal("0.1") + Decimal("0.2"), Decimal("0.1") + Decimal("0.2") == Decimal("0.3"))
    print(Decimal(0.1))
    print(Decimal("50.5").quantize(Decimal("1"), rounding=ROUND_HALF_UP), round(50.5), round(51.5))
    print(add_interest(1000, 5, 1))
    print(add_interest(1010, 5, 1))
    print(add_interest(1030, 5, 1))
    print(add_interest(250000, 1, 12))
    print(add_interest(1010, 5, 0), type(add_interest(1010, 5, 2)).__name__)
