"""Gambler's ruin: a random walk that stops for good at 0 or at the target."""
import random


def play(start, target, flips):
    money = start
    steps = 0
# >>> BLANK id=keep-going level=2 hint="一行 while，用 Python 的连写比较（一个表达式里两个比较号，不用 and）；0 写在最左、target 写在最右，money 夹在中间 || 两个比较号都是严格的小于号：钱正好是 0 或 target 时游戏已经结束" hintEn="One while line using Python's chained comparison (two comparison operators in one expression, not and); 0 on the far left, target on the far right, money in between || Both operators are a strict less-than: the game is already over when the money is exactly 0 or target"
    while 0 < money < target:
# <<< BLANK
        if steps == len(flips):
            return "unfinished", steps
# >>> BLANK id=one-flip level=2 hint="两行，都用 +=：先改钱数、后把步数加一 || 钱数这一行加上第 steps 次抛硬币的结果（+1 或 -1），用 steps 当下标去取——所以它必须排在 steps 变大之前" hintEn="Two lines, both with +=: change the money first, then add one to the step count || The money line adds the result of flip number steps (+1 or -1), using steps as the index - which is why it has to come before steps grows"
        money += flips[steps]
        steps += 1
# <<< BLANK
    if money == 0:
        return "ruined", steps
    return "won", steps


def simulate(rng, start, target, games):
    wins = 0
    total_steps = 0
    for _ in range(games):
        flips = [rng.choice((-1, 1)) for _ in range(300)]
        outcome, steps = play(start, target, flips)
        if outcome == "won":
            wins += 1
        total_steps += steps
    return wins / games, total_steps / games


if __name__ == "__main__":
    rng = random.Random(5)
    target = 10
    print("start won won_theory steps steps_theory")
    for start in (1, 3, 5, 9):
        won, steps = simulate(rng, start, target, 1000)
        print(start, f"{won:.3f}", f"{start / target:.3f}", f"{steps:.1f}", start * (target - start))
