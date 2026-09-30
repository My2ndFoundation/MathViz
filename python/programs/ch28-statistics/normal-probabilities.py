"""Normal distribution probabilities with statistics.NormalDist."""
from statistics import NormalDist

import numpy as np


def prob_between(mu, sigma, a, b):
# >>> BLANK id=dist level=1 hint="建一个均值 mu、标准差 sigma 的正态分布对象，存进 dist；两个实参按位置写（不写 mu=、sigma=）" hintEn="Make a normal distribution object with mean mu and standard deviation sigma and store it in dist; give both arguments by position (not mu=, sigma=)"
    dist = NormalDist(mu, sigma)
# <<< BLANK
# >>> BLANK id=between level=2 hint="一行 return：落在 a 与 b 之间的概率，round 到 6 位。写法先定下：dist 的 cdf 在 b 处的值在前，减去它在 a 处的值 || cdf(x) 是「不超过 x」的概率：不超过 b 的里面去掉不超过 a 的，剩下的就在 a 与 b 之间" hintEn="One return line: the probability of landing between a and b, rounded to 6 places. Fix the form first: dist's cdf at b comes first, minus its cdf at a || cdf(x) is the probability of being at most x: take the part at most a away from the part at most b, and what is left lies between a and b"
    return round(dist.cdf(b) - dist.cdf(a), 6)
# <<< BLANK


if __name__ == "__main__":
    heights = NormalDist(170, 8)
    print("P(height < 180):", round(heights.cdf(180), 4))
    print("P(height > 185):", round(1 - heights.cdf(185), 4))
    print("P(160 < height < 180):", round(prob_between(170, 8, 160, 180), 4))
    print("P(height = 175 exactly):", prob_between(170, 8, 175, 175))

# >>> BLANK id=inverse level=2 hint="最高 5% 的起点，存进 cutoff：调用 heights 的 inv_cdf 方法，实参写成一个小数字面量（带前导 0，不写成算式） || inv_cdf(q) 给出「不超过它的概率恰好是 q」的那个身高；最高的 5% 以下还有 95%" hintEn="Where the tallest 5% begin, stored in cutoff: call heights' inv_cdf method with a single decimal literal as the argument (with a leading 0, not a calculation) || inv_cdf(q) gives the height that exactly a share q of people are at most; below the tallest 5% lie the other 95%"
    cutoff = heights.inv_cdf(0.95)
# <<< BLANK
    print("the tallest 5% are over:", round(cutoff, 1))
    low, high = heights.inv_cdf(0.25), heights.inv_cdf(0.75)
    print("the middle half:", round(low, 1), "to", round(high, 1))

    for k in (1, 2, 3):
        print("within", k, "sd:", round(prob_between(0, 1, -k, k), 4))

    rng = np.random.default_rng(7)
    draws = rng.normal(170, 8, size=100000)
    inside = (draws > 160) & (draws < 180)
    print("simulated P(160 < height < 180):", round(float(inside.mean()), 4))
    print("simulated P(height > 185):", round(float((draws > 185).mean()), 4))
