"""0/1 knapsack: the best total value that fits, from a two-dimensional table."""


def best_value(weights, values, capacity):
    n = len(weights)
    best = [[0] * (capacity + 1) for _ in range(n + 1)]
# >>> BLANK id=items level=2 hint="第 0 行代表「一件都不许拿」，全是 0 已经填好了；外层循环从第 1 件跑到第 n 件：一个 for，循环变量 i，用两个实参的 range，件数用上面算好的 n || range 的终点不包含在内，所以终点要写 n + 1" hintEn="Row 0 means no items allowed, and it is already all 0; the outer loop runs from item 1 to item n: a for with loop variable i, using range with two arguments and the n worked out above || range stops before its end value, so the end has to be n + 1"
    for i in range(1, n + 1):
# <<< BLANK
        weight = weights[i - 1]
        value = values[i - 1]
        for w in range(capacity + 1):
# >>> BLANK id=leave-it level=2 hint="先当第 i 件不拿：这一格就抄上一行、同一列那一格的值 || 上一行是 best[i - 1]，同一列就是同一个 w" hintEn="First assume item i is left out: this cell just copies the cell in the row above, same column || The row above is best[i - 1], and the same column means the same w"
            best[i][w] = best[i - 1][w]
# <<< BLANK
            if weight <= w:
# >>> BLANK id=take-it level=3 hint="装得下时再看拿它会不会更好：用 max 在两个数里取大的，赋回这一格；max 的第一个实参是这一格现在的值（不拿），第二个是拿它的总价值，写成「查表得到的值 + value」 || 拿了第 i 件，剩给前 i - 1 件的容量就少了 weight；那部分最好能拿到多少，查上一行 || 查的是：上一行、w - weight 那一列" hintEn="When it fits, see whether taking it is better: use max to keep the larger of two numbers and assign it back to this cell; max's first argument is this cell's current value (leave it), the second the total if you take it, written as the looked-up value + value || Taking item i leaves weight less capacity for the first i - 1 items; the best they can do is in the row above || The cell to look up is in the row above, at column w - weight"
                best[i][w] = max(best[i][w], best[i - 1][w - weight] + value)
# <<< BLANK
    return best[n][capacity]


if __name__ == "__main__":
    weights = [3, 4, 5]
    values = [5, 6, 8]
    print(best_value(weights, values, 9))
    print(best_value(weights, values, 7))
    print(best_value(weights, values, 2))
