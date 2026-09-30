"""Fisher-Yates: shuffle a list in place so that every order is equally likely."""
import random


def shuffle(items, rng):
# >>> BLANK id=backwards level=2 hint="一行 for，i 从最后一个下标往回走到 1；用 range 的三个实参（不用 reversed） || 起点是 len(items) - 1，终点写 0（range 不含终点，0 号位不用再换），步长 -1" hintEn="One for line, with i walking back from the last index down to 1; use range with three arguments (not reversed) || Start at len(items) - 1, write 0 as the stop (range leaves the stop out, and slot 0 needs no swap), with a step of -1"
    for i in range(len(items) - 1, 0, -1):
# <<< BLANK
# >>> BLANK id=pick level=2 hint="从下标 0 到 i（含 i）里随机挑一个位置，存进 j；用 rng 的一个方法，只给一个实参（不用 randint） || 用 randrange，实参是 i + 1：终点不含在内，加一才挑得到 i 自己" hintEn="Pick a random position from index 0 up to and including i, stored in j; use one method of rng with a single argument (not randint) || Use randrange with the argument i + 1: the stop is left out, so add one to be able to pick i itself"
        j = rng.randrange(i + 1)
# <<< BLANK
        items[i], items[j] = items[j], items[i]


def shuffled_copy(items, seed):
    result = list(items)
    shuffle(result, random.Random(seed))
    return result


if __name__ == "__main__":
    print(shuffled_copy(range(10), 3))
    rng = random.Random(2026)
    counts = {}
    for _ in range(6000):
        cards = ["A", "B", "C"]
        shuffle(cards, rng)
        order = "".join(cards)
        counts[order] = counts.get(order, 0) + 1
    for order in sorted(counts):
        print(order, counts[order])
