"""Random numbers the NumPy way: one Generator made from a seed."""
import numpy as np


def roll_dice(rng, n):
    """n rolls of a six-sided die, drawn from the generator passed in."""
# >>> BLANK id=integers level=2 hint="用传进来的 rng 的 integers 方法一次掷 n 次；下界、上界按位置写、都写成整数字面量，个数用关键字实参 size 给 || integers 的范围是半开的：上界本身取不到，所以骰子的上界要比 6 大 1" hintEn="Use the integers method of the rng passed in to roll n times at once; low and high are given by position, each as a plain whole-number literal, and the count by the keyword argument size || The range of integers is half-open: the upper bound itself never comes up, so a die needs an upper bound one more than 6"
    return rng.integers(1, 7, size=n)
# <<< BLANK


if __name__ == "__main__":
# >>> BLANK id=generator level=1 hint="从 np.random 造一个生成器，种子是 2026（按位置写，不写 seed=），存进 rng；用 default_rng，不用 np.random.seed" hintEn="Make a generator from np.random with the seed 2026 (given by position, not as seed=) and store it in rng; use default_rng, not np.random.seed"
    rng = np.random.default_rng(2026)
# <<< BLANK
    print(roll_dice(rng, 8))
    print(rng.integers(0, 10, size=5))
    print(np.round(rng.random(4), 3))
    print(np.round(rng.normal(170, 8, size=4), 1))
    print(rng.choice(["red", "green", "blue"], size=5))
    print(rng.permutation(6))

    # same seed, same sequence
    a = np.random.default_rng(7)
    b = np.random.default_rng(7)
    print(a.integers(1, 7, size=6))
    print(b.integers(1, 7, size=6))

    # drawing from one generator does not move another
    c = np.random.default_rng(7)
    d = np.random.default_rng(99)
    d.random(1000)
    print(c.integers(1, 7, size=6))

    # a long run: each face comes up about a sixth of the time
    rolls = roll_dice(np.random.default_rng(1), 6000)
    faces, counts = np.unique(rolls, return_counts=True)
    print(faces)
    print(counts)
    print(round(float(rolls.mean()), 3))
