"""Pig: two computer players with different strategies race to 100."""
import random


def hold_at_20(turn_total, rolls):
# >>> BLANK id=enough level=1 hint="这一轮攒到 20 分或更多就收手：直接 return 一个比较，turn_total 写在比较号左边、右边就是 20" hintEn="Stop once this turn has banked 20 points or more: return a single comparison, with turn_total on the left and 20 itself on the right"
    return turn_total >= 20
# <<< BLANK


def three_rolls(turn_total, rolls):
    return rolls >= 3


def take_turn(strategy, rng):
    turn_total = 0
    rolls = 0
    while True:
        die = rng.randint(1, 6)
        rolls += 1
        if die == 1:
# >>> BLANK id=bust level=1 hint="掷出 1：这一轮攒下的分全部作废，这一轮给总分加的就是零" hintEn="A 1 is rolled: everything saved up this turn is lost, so this turn adds nothing to the total"
            return 0
# <<< BLANK
        turn_total += die
        if strategy(turn_total, rolls):
            return turn_total


def play(strategies, rng, target=100):
    scores = [0, 0]
    player = 0
    while True:
        scores[player] += take_turn(strategies[player], rng)
        if scores[player] >= target:
            return player
# >>> BLANK id=next-player level=2 hint="换另一名玩家：玩家编号只有 0 和 1，用一次减法算出另一个（不用 if） || 用 1 去减当前编号" hintEn="Hand over to the other player: the players are numbered 0 and 1, so one subtraction gives the other number (no if) || Take the current number away from 1"
        player = 1 - player
# <<< BLANK


if __name__ == "__main__":
    rng = random.Random(100)
    names = ["hold at 20", "three rolls"]
    wins = [0, 0]
    for game in range(1000):
        if game % 2 == 0:
            wins[play([hold_at_20, three_rolls], rng)] += 1
        else:
            wins[1 - play([three_rolls, hold_at_20], rng)] += 1
    for name, count in zip(names, wins):
        print(f"{name}: {count} wins out of 1000")
