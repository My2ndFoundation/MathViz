"""A one-dimensional random walk: where it ends, how far it strays, how often it comes home."""
import random


def walk_stats(steps):
    position = 0
    farthest = 0
    returns = 0
    for step in steps:
        position += step
# >>> BLANK id=farthest level=2 hint="两行：一个 if 加一次赋值（不用内置的 max）。写法先定下：abs(position) 写在比较号左边，用严格的大于号 || 离原点的距离不管在哪一边都是 position 的绝对值；超过纪录时把这个距离存进 farthest" hintEn="Two lines: an if and an assignment (not the built-in max). Fix the form first: abs(position) on the left of the comparison, with a strict greater-than || The distance from the origin, on either side, is the absolute value of position; when it beats the record, store that distance in farthest"
        if abs(position) > farthest:
            farthest = abs(position)
# <<< BLANK
# >>> BLANK id=home level=1 hint="两行：这一步之后正好回到原点，就把回家次数加一；比较写成 position == 0，加一用 +=" hintEn="Two lines: if this step lands exactly back on the origin, add one to the count of returns; write the test as position == 0 and add with +="
        if position == 0:
            returns += 1
# <<< BLANK
    return position, farthest, returns


def random_steps(rng, n):
    return [rng.choice((-1, 1)) for _ in range(n)]


def mean_distance(rng, n, walks):
    total = 0
    for _ in range(walks):
        end, _, _ = walk_stats(random_steps(rng, n))
        total += abs(end)
    return total / walks


if __name__ == "__main__":
    rng = random.Random(11)
    end, farthest, returns = walk_stats(random_steps(rng, 1000))
    print("one walk of 1000 steps: end", end, "farthest", farthest, "returns", returns)
    print("steps mean_distance")
    for n in (100, 400, 1600):
        print(n, round(mean_distance(rng, n, 400), 1))
