"""Roll two dice many times and compare the counts with the exact chances."""
import random


def tally(rolls):
# >>> BLANK id=counts-list level=2 hint="用列表乘法造一张全是 0 的计数表，存进 counts || 下标就是两颗骰子的点数和；最大的和是 12，所以要 13 格（0 号与 1 号两格永远是 0，只是为了让下标等于点数和）" hintEn="Build a table of counts that is all zeros using list multiplication, and store it in counts || The index is the total of the two dice; the biggest total is 12, so it needs 13 slots (slots 0 and 1 always stay 0 - they are there so that the index equals the total)"
    counts = [0] * 13
# <<< BLANK
    for a, b in rolls:
# >>> BLANK id=count-one level=1 hint="这一掷的点数和就是下标，把那一格加一；用增强赋值 +=，下标里 a 在前、b 在后" hintEn="The total of this roll is the index; add one to that slot, using the augmented assignment +=, with a before b inside the brackets"
        counts[a + b] += 1
# <<< BLANK
    return counts


def roll_many(rng, n):
    return [(rng.randint(1, 6), rng.randint(1, 6)) for _ in range(n)]


if __name__ == "__main__":
    every_pair = [(a, b) for a in range(1, 7) for b in range(1, 7)]
# >>> BLANK id=exact level=2 hint="精确分布不用掷：36 种 (a, b) 组合同样可能，把它们全部交给同一个计数函数，结果存进 exact || 一行赋值，右边是一次函数调用，实参是上一行造好的那张表" hintEn="The exact distribution needs no rolling: the 36 pairs (a, b) are equally likely, so hand all of them to the same counting function and store the result in exact || One assignment whose right-hand side is a single function call, passing the list built on the line above"
    exact = tally(every_pair)
# <<< BLANK
    rng = random.Random(7)
    small = tally(roll_many(rng, 100))
    large = tally(roll_many(rng, 10000))
    print("sum chance freq_100 freq_10000")
    for total in range(2, 13):
        chance = exact[total] / 36
        print(total, f"{chance:.3f}", f"{small[total] / 100:.3f}", f"{large[total] / 10000:.3f}")
    worst_small = max(abs(small[t] / 100 - exact[t] / 36) for t in range(2, 13))
    worst_large = max(abs(large[t] / 10000 - exact[t] / 36) for t in range(2, 13))
    print("largest gap:", f"{worst_small:.3f}", f"{worst_large:.3f}")
