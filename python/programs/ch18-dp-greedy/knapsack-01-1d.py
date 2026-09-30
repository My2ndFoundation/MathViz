"""0/1 knapsack with one rolling row, walking the capacities from high to low."""


def best_value(weights, values, capacity):
# >>> BLANK id=row level=2 hint="只要一行 0：用 [0] 乘以格数写出来，[0] 在乘号左边（不用推导式） || 下标 0 到 capacity 各一格，一共 capacity + 1 格；乘号右边的格数加上括号" hintEn="Just one row of 0s: written as [0] times the number of places, [0] on the left of the * (not a comprehension) || One place for each index from 0 to capacity, so capacity + 1 places; put the number of places on the right of the * in brackets"
    best = [0] * (capacity + 1)
# <<< BLANK
    for weight, value in zip(weights, values):
# >>> BLANK id=downwards level=3 hint="容量从大往小走：一个 for，循环变量 w，用三个实参的 range，步长是 -1 || 起点是 capacity；比 weight 还小的容量装不下这一件，不用看，所以最后一个要走到的是 weight 本身 || range 不包含终点：要停在 weight 上，终点就写 weight - 1" hintEn="Walk the capacities from high to low: a for with loop variable w, using range with three arguments and a step of -1 || Start at capacity; a capacity smaller than weight cannot hold this item and need not be looked at, so the last one to visit is weight itself || range stops before its end: to finish on weight, the end is weight - 1"
        for w in range(capacity, weight - 1, -1):
# <<< BLANK
            best[w] = max(best[w], best[w - weight] + value)
    return best[capacity]


if __name__ == "__main__":
    weights = [3, 4, 5]
    values = [5, 6, 8]
    print(best_value(weights, values, 9))
    print(best_value(weights, values, 7))
    print(best_value(weights, values, 2))
