"""Make change greedily: always take the biggest coin that still fits."""

UK_COINS = [1, 2, 5, 10, 20, 50, 100, 200]


def greedy_change(amount, coins):
    used = []
# >>> BLANK id=largest-first level=2 hint="面值从大到小一个个看：一个 for，循环变量 coin；用 sorted 排出一份新的（不改 coins 本身），并给 sorted 一个关键字实参让它直接从大到小排（不另外套 reversed，也不用切片） || 这个关键字实参是 reverse，值是 True" hintEn="Look at the coins from largest to smallest: a for with loop variable coin; use sorted to make a new ordered copy (leaving coins itself alone), and give sorted a keyword argument so it sorts from largest to smallest directly (no reversed around it, no slice) || That keyword argument is reverse, set to True"
    for coin in sorted(coins, reverse=True):
# <<< BLANK
# >>> BLANK id=still-fits level=2 hint="同一种硬币可以拿好几枚：只要剩下的金额还不小于这枚硬币就一直拿——一个 while，直接拿 amount 与 coin 相比，amount 写在比较号左边 || 刚好相等时也能拿，所以用大于等于" hintEn="The same coin can be taken several times: keep taking it while what is left is not less than the coin - a while comparing amount directly with coin, amount on the left of the comparison || An exact match can be taken too, so use greater-than-or-equal"
        while amount >= coin:
# <<< BLANK
            used.append(coin)
            amount -= coin
    return used


def count_coins(amount, coins):
    return len(greedy_change(amount, coins))


if __name__ == "__main__":
    print(greedy_change(288, UK_COINS))
    print(count_coins(288, UK_COINS))
    print(greedy_change(40, UK_COINS))
    print(greedy_change(6, [1, 3, 4]))
