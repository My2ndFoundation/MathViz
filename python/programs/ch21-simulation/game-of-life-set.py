"""Game of Life on an unbounded plane: keep only the live cells, as a set of coordinates."""


def step(live):
    counts = {}
    for row, col in live:
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == 0 and dc == 0:
                    continue
                cell = (row + dr, col + dc)
# >>> BLANK id=tally-neighbour level=2 hint="一行，写成 counts[cell] = 旧票数 + 1 的形状（旧票数在加号左边），旧票数用字典的 get 方法取 || get 的两个实参是 cell 与 0：这个邻格还没有票时当 0" hintEn="One line shaped counts[cell] = old count + 1 (the old count on the left of the plus), taking the old count with the dictionary's get method || The two arguments to get are cell and 0: a neighbour with no votes yet counts as 0"
                counts[cell] = counts.get(cell, 0) + 1
# <<< BLANK
    new = set()
    for cell, n in counts.items():
# >>> BLANK id=rule level=3 hint="两行：一个 if 加一次 add。写法先定下：条件是 or 连起来的两部分，先写正好 3 票的那一部分；后一部分加括号，括号里用 and，先比票数、再看原来活不活 || 下一代活着的只有两种：正好 3 票的（原来活不活都行），以及正好 2 票而且原来就活着的 || 票数比较写成 n == 数字，原来就活着写成 cell in live，加进新集合用 new.add(cell)" hintEn="Two lines: an if and an add. Fix the form first: the condition is two parts joined by or, the exactly-3-votes part first; the second part in brackets, using and inside, with the vote test before the was-it-alive test || Only two kinds of cell are alive next time: those with exactly 3 votes (alive before or not), and those with exactly 2 votes that were already alive || Write each vote test as n == number, already alive as cell in live, and add to the new set with new.add(cell)"
        if n == 3 or (n == 2 and cell in live):
            new.add(cell)
# <<< BLANK
    return new


def run(live, generations):
    for _ in range(generations):
        live = step(live)
    return live


if __name__ == "__main__":
    glider = {(0, 1), (1, 2), (2, 0), (2, 1), (2, 2)}
    later = run(glider, 40)
    print("glider after 40:", sorted(later))
    print("same shape, moved:", later == {(r + 10, c + 10) for r, c in glider})
    r_pentomino = {(0, 1), (0, 2), (1, 0), (1, 1), (2, 1)}
    print("generation alive")
    live = r_pentomino
    for generation in range(0, 201, 40):
        print(generation, len(live))
        live = run(live, 40)
