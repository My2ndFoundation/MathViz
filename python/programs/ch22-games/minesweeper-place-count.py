"""Minesweeper: lay the mines at random, then count the mines around every square."""
import random


def neighbours(w, h, x, y):
    cells = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            nx, ny = x + dx, y + dy
            if (dx, dy) != (0, 0) and 0 <= nx < w and 0 <= ny < h:
                cells.append((nx, ny))
    return cells


def place_mines(w, h, count, first, rng):
    safe = set(neighbours(w, h, first[0], first[1]))
    safe.add(first)
    spots = [(x, y) for y in range(h) for x in range(w) if (x, y) not in safe]
# >>> BLANK id=sample level=2 hint="从 spots 里不重复地随机挑 count 个位置，交回一个集合：用 rng 的一个方法（两个位置实参），外面套 set || 那个方法一次抽出若干个互不相同的元素，第一个实参是候选列表，第二个是个数" hintEn="Pick count different positions at random from spots and hand them back as a set: one method of rng (two positional arguments), wrapped in set || That method draws several distinct items in one go; its first argument is the list to draw from, the second is how many"
    return set(rng.sample(spots, count))
# <<< BLANK


def counts(w, h, mines):
    grid = []
    for y in range(h):
        row = []
        for x in range(w):
# >>> BLANK id=is-mine level=1 hint="这一格本身是不是雷：一个 if，把 x、y 组成一个元组（加括号），看它在不在 mines 里" hintEn="Is this square itself a mine: an if that makes a tuple of x and y (in brackets) and asks whether it is in mines"
            if (x, y) in mines:
# <<< BLANK
                row.append(-1)
            else:
# >>> BLANK id=near level=2 hint="数邻居里的雷：一个列表推导式存进 near，逐个取这一格的邻居 c，只留在 mines 里的 || 邻居由 neighbours(w, h, x, y) 给出" hintEn="Count the mines among the neighbours: a list comprehension stored in near, taking each neighbour c of this square and keeping only those in mines || The neighbours come from neighbours(w, h, x, y)"
                near = [c for c in neighbours(w, h, x, y) if c in mines]
# <<< BLANK
                row.append(len(near))
        grid.append(row)
    return grid


if __name__ == "__main__":
    rng = random.Random(7)
    first = (0, 0)
    mines = place_mines(9, 6, 10, first, rng)
    print("first click at", first, "- mines:", len(mines))
    for row in counts(9, 6, mines):
        print(" ".join("*" if v < 0 else str(v) for v in row))
