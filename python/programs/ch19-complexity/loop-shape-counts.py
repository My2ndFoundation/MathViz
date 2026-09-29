"""Count the basic steps that four loop shapes take for the same n."""


def count_single(n):
    steps = 0
    for i in range(n):
        steps += 1
    return steps


def count_nested(n):
    steps = 0
    for i in range(n):
        for j in range(n):
            steps += 1
    return steps


def count_dependent_pairs(n):
    steps = 0
    for i in range(n):
# >>> BLANK id=inner-start level=2 hint="里层循环只走 i 之后的位置：一个 for，循环变量叫 j，用两个参数的 range，终点是 n || 起点比 i 大一——这样每一对 (i, j) 只数一次，i 也不会和自己配对" hintEn="The inner loop only visits positions after i: a for with loop variable j, using range with two arguments, ending at n || The start is one more than i - so each pair (i, j) is counted once and i is never paired with itself"
        for j in range(i + 1, n):
# <<< BLANK
            steps += 1
    return steps


def count_halving(n):
    steps = 0
# >>> BLANK id=halving-test level=2 hint="只要 n 还没减到 0 就继续：一个 while，n 写在比较号左边，与 0 比较 || 用严格的大于号——n 等于 0 时已经没有东西可以再对半分了" hintEn="Keep going until n has come down to 0: a while with n on the left of the comparison, compared with 0 || Use a strict greater-than - once n is 0 there is nothing left to halve"
    while n > 0:
# <<< BLANK
        steps += 1
# >>> BLANK id=halve level=1 hint="把 n 对半分、扔掉余数：用复合赋值（运算符紧跟等号的那种）写整除 2，不用右移" hintEn="Halve n and drop the remainder: an augmented assignment (the operator written right before the equals sign) doing floor division by 2, not a right shift"
        n //= 2
# <<< BLANK
    return steps


if __name__ == "__main__":
    print("n single nested pairs halving")
    for n in (1, 2, 4, 8, 16, 100):
        print(n, count_single(n), count_nested(n), count_dependent_pairs(n), count_halving(n))
