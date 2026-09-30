"""Keep money as a whole number of pence, so sums are exact and rounding is a rule you choose."""


def add_interest(balance, rate_percent, months):
    """balance in pence (not negative); rate_percent a whole-number monthly rate; returns pence."""
    for _ in range(months):
# >>> BLANK id=round-half-up level=2 hint="算出这个月的利息（整数便士），存进 interest：balance 乘以 rate_percent 再除以 100，按半数进位取整——全程只用整数运算；乘积写成 balance 在前，进位用的那个加数写在乘积后面 || 半数进位的办法：在乘积后面加上除数的一半，整个括起来，再用整除 // 除以 100" hintEn="Work out this month's interest in whole pence and keep it in interest: balance times rate_percent divided by 100, rounded half up - using whole-number arithmetic only; write the product with balance first, and put the number added for rounding after the product || Rounding half up: add half of the divisor after the product, bracket the whole thing, then floor-divide by 100 with //"
        interest = (balance * rate_percent + 50) // 100
# <<< BLANK
# >>> BLANK id=add-on level=1 hint="把这个月的利息加进余额——用增强赋值 +=" hintEn="Add this month's interest to the balance - use the augmented assignment +="
        balance += interest
# <<< BLANK
    return balance


def show(pence):
# >>> BLANK id=split-pounds level=1 hint="一行同时得到英镑数和余下的便士数，拆包进 pounds 和 pennies——用内置的 divmod，除数是 100" hintEn="Get the pounds and the pence left over in one line, unpacked into pounds and pennies - use the built-in divmod with 100 as the divisor"
    pounds, pennies = divmod(pence, 100)
# <<< BLANK
    return f"{pounds}.{pennies:02d}"


if __name__ == "__main__":
    print(0.1 + 0.2, 0.1 + 0.2 == 0.3)
    print(10 + 20, 10 + 20 == 30)
    print(show(add_interest(1000, 5, 1)))
    print(show(add_interest(1010, 5, 1)))
    print(show(add_interest(1030, 5, 1)))
    print(show(add_interest(250000, 1, 12)))
    print(add_interest(1010, 5, 0), type(add_interest(1010, 5, 2)).__name__)
