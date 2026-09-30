"""Rank a competition: equal scores share a place, and the places after a tie are skipped (1, 2, 2, 4)."""


def ranking(scores):
    """scores is a list of (name, score) pairs; returns (place, name, score) rows, best first."""
    ordered = sorted(scores, key=lambda pair: (-pair[1], pair[0]))
    rows = []
# >>> BLANK id=positions level=2 hint="for 的头：边走 ordered 边数第几个，计数从 1 起，起点用关键字实参 start 给出；循环变量写成 position 和一个拆开的 (name, score) 元组 || 数数的内置函数是 enumerate" hintEn="The head of the for: walk through ordered while counting positions from 1, giving the starting point with the keyword argument start; the loop variables are position and an unpacked (name, score) tuple || The built-in that counts as it goes is enumerate"
    for position, (name, score) in enumerate(ordered, start=1):
# <<< BLANK
# >>> BLANK id=same-as-above level=2 hint="一个 if 的头：rows 非空、而且上一行的分数和这一个相同——两个条件用 and 连起来，先判 rows 本身（直接写 rows，不用 len()）；上一行的分数写在 == 左边，score 在右边 || 上一行是 rows[-1]，每一行是 (名次, 姓名, 分数)，分数是下标为 2 的那一项" hintEn="The head of an if: rows is not empty and the previous row has the same score as this one - join the two conditions with and, testing rows itself first (just rows, no len()); the previous row's score goes on the left of == and score on the right || The previous row is rows[-1]; each row is (place, name, score), so the score is the item at index 2"
        if rows and rows[-1][2] == score:
# <<< BLANK
            place = rows[-1][0]
        else:
# >>> BLANK id=new-place level=1 hint="分数与上一个不同：名次就是它在排好的队伍里的位置——不是上一个名次加一，所以平局之后的名次会跳过去" hintEn="A different score from the one above: the place is simply its position in the sorted line - not the previous place plus one, which is why the places after a tie are skipped"
            place = position
# <<< BLANK
        rows.append((place, name, score))
    return rows


if __name__ == "__main__":
    scores = [("Ben", 72), ("Ada", 88), ("Dee", 72), ("Cal", 95), ("Eve", 60), ("Fay", 72)]
    for place, name, score in ranking(scores):
        print(f"{place:>2}  {name:<4}{score:>3}")
    print(ranking([("Ann", 50), ("Bob", 50)]))
    print(ranking([]))
