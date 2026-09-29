"""Make change with the fewest coins for any set of coins: build up from 0."""


def min_coins(amount, coins):
    impossible = amount + 1
# >>> BLANK id=table level=2 hint="best[a] 是凑出 a 最少要几枚：金额 0 一枚都不用，其余先全填成 impossible；用两个列表相加写出来——先写只装着 0 的那个，后一个用乘法写、列表在乘号左边 || 后一个列表里只有 impossible，乘以 amount——下标 1 到 amount 正好 amount 格" hintEn="best[a] is the fewest coins that make a: amount 0 needs none, and every other place starts as impossible; write it as two lists added together - the one holding just 0 first, the second written with multiplication, list on the left of the * || The second list holds just impossible, times amount - indexes 1 to amount are exactly amount places"
    best = [0] + [impossible] * amount
# <<< BLANK
    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a:
# >>> BLANK id=use-coin level=2 hint="最后一枚用 coin：先凑出 a - coin，再加这一枚。用 min 在「现在记着的」与「这种凑法」之间取小的，赋回 best[a]；现在记着的写在前面，这种凑法写成「查表得到的值 + 1」 || 查的是金额 a - coin 那一格" hintEn="Make coin the last one: first make a - coin, then add this coin. Use min to keep the smaller of what is recorded now and this way of doing it, and assign it back to best[a]; the recorded value goes first, and this way is written as the looked-up value + 1 || The place to look up is the one for amount a - coin"
                best[a] = min(best[a], best[a - coin] + 1)
# <<< BLANK
# >>> BLANK id=cannot level=1 hint="凑不出来的金额，格子里还是一开始填的那个值：一个 if，用 == 把 best[amount] 和它相比，best[amount] 写在左边" hintEn="An amount that cannot be made still holds the value it started with: an if comparing best[amount] with it using ==, best[amount] on the left"
    if best[amount] == impossible:
# <<< BLANK
        return -1
    return best[amount]


if __name__ == "__main__":
    print(min_coins(6, [1, 3, 4]))
    print(min_coins(288, [1, 2, 5, 10, 20, 50, 100, 200]))
    print(min_coins(7, [2, 4]))
    print(min_coins(0, [5]))
