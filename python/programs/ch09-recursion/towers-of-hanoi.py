"""Towers of Hanoi: return the list of moves that shifts n discs from one peg to another."""


def hanoi(n, source, target, spare):
    if n == 0:
        return []
# >>> BLANK id=before level=2 hint="先把压在上面的 n - 1 个盘子挪开，移动表存进 before；四个实参都按位置给，顺序与 def 行相同：盘子数、出发柱、目标柱、借用柱 || 这 n - 1 个盘子从 source 出发、要落到 spare 上，这一次 target 暂时当借用柱" hintEn="First move the n - 1 discs on top out of the way and store their moves in before; all four arguments by position, in the def line's order: number of discs, start peg, target peg, spare peg || Those n - 1 discs leave source and have to end up on spare, and this time target is the spare peg"
    before = hanoi(n - 1, source, spare, target)
# <<< BLANK
# >>> BLANK id=after level=2 hint="再把那 n - 1 个盘子搬到终点上、压住最大的盘子，移动表存进 after；实参顺序同上：盘子数、出发柱、目标柱、借用柱——想想它们此刻停在哪根柱子上 || 它们此刻在 spare 上、要去 target，已经空出来的 source 当借用柱" hintEn="Then move those n - 1 discs onto the finishing peg, on top of the biggest disc, and store their moves in after; arguments in the same order as before: number of discs, start peg, target peg, spare peg - think about which peg they are sitting on now || They are sitting on spare now and go to target, with the emptied source as the spare peg"
    after = hanoi(n - 1, spare, target, source)
# <<< BLANK
# >>> BLANK id=join level=2 hint="一行 return 拼出完整的移动表：before、中间那一步、after 三段用 + 连起来；中间那一步是只含一个元组的列表 || 中间那一步把最大的盘子从 source 直接搬到 target，元组里先写出发柱" hintEn="One return that builds the full list of moves: before, the middle move and after joined with +; the middle move is a list holding a single tuple || The middle move takes the biggest disc straight from source to target, with the starting peg first in the tuple"
    return before + [(source, target)] + after
# <<< BLANK


if __name__ == "__main__":
    for start, end in hanoi(3, "A", "C", "B"):
        print(start, "->", end)
    for n in (1, 2, 3, 4, 10):
        print(n, len(hanoi(n, "A", "C", "B")))
