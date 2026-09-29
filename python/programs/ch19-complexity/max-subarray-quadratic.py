"""Largest sum of a run of neighbours: try every start and grow the run to the right."""


def max_subarray(values):
# >>> BLANK id=first-best level=2 hint="best 先要有一个真实存在的和当起点：用第一个元素本身，写下标 || 不能从 0 起——全是负数的表，最大和是一个负数，从 0 起就会交回一个根本不存在的 0" hintEn="best needs a real sum to start from: the first item itself, written with an index || It cannot start at 0 - for a list of nothing but negatives the largest sum is negative, and starting at 0 would hand back a 0 that no run adds up to"
    best = values[0]
# <<< BLANK
    for start in range(len(values)):
# >>> BLANK id=fresh-total level=1 hint="每换一个起点，这一段的和都从头算：给 total 一个整数初值" hintEn="Each new start begins its run's sum again from scratch: give total a whole-number starting value"
        total = 0
# <<< BLANK
        for end in range(start, len(values)):
            total += values[end]
            if total > best:
                best = total
    return best


if __name__ == "__main__":
    print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))
    print(max_subarray([-8, -3, -6, -2, -5, -4]))
    print(max_subarray([5]))
    print(max_subarray([2, -1, 2, -1, 2]))
