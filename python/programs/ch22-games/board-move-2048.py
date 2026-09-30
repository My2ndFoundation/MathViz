"""2048: move the whole board in any of four directions by reusing one row rule."""


def merge_left(row):
    tiles = [v for v in row if v != 0]
    out = []
    i = 0
    while i < len(tiles):
        if i + 1 < len(tiles) and tiles[i] == tiles[i + 1]:
            out.append(tiles[i] * 2)
            i += 2
        else:
            out.append(tiles[i])
            i += 1
    return out + [0] * (len(row) - len(out))


def transpose(board):
# >>> BLANK id=flip-diagonal level=2 hint="列变成行：一个列表推导式，对 zip 拆开 board 得到的每一列 col，都转成列表 || zip 前面那个星号把 board 的每一行拆成单独的实参" hintEn="Columns become rows: a list comprehension that turns every column col produced by zip over the unpacked board into a list || The star in front of board inside zip spreads its rows out as separate arguments"
    return [list(col) for col in zip(*board)]
# <<< BLANK


def move(board, direction):
    if direction == "left":
        return [merge_left(row) for row in board]
    if direction == "right":
# >>> BLANK id=right level=2 hint="向右 = 把每一行反过来、向左合并、再反回去：仿照上面向左那一行写成一个列表推导式，循环变量同样叫 row；反转一行用步长为 -1 的切片（不用 reversed），也不调用 move 自己 || 合并前对 row 反转一次，合并后对 merge_left 交回的结果再反转一次" hintEn="Right is: reverse each row, merge it to the left, and reverse it back - a list comprehension shaped like the left one above, with the loop variable again called row; reverse a row with a slice whose step is -1 (not reversed), and do not call move itself || Reverse row once before merging, and reverse what merge_left hands back once more"
        return [merge_left(row[::-1])[::-1] for row in board]
# <<< BLANK
    if direction == "up":
        return transpose([merge_left(row) for row in transpose(board)])
# >>> BLANK id=down level=2 hint="向下 = 转置之后向右、再转置回来：和上面向上那一行一样，外层调用 transpose、里面一个列表推导式，循环变量同样叫 row、同样取 transpose(board) 的每一行；推导式里对每一行的处理换成向右时那一套。反转一行同样用步长为 -1 的切片（不用 reversed），也不调用 move 自己 || 向上那一行里的 merge_left(row)，在这里要变成：先反转 row、合并、再反转结果" hintEn="Down is: transpose, move right, transpose back - like the up line above, an outer transpose call around a list comprehension whose loop variable, again called row, again takes each row of transpose(board) - but each row gets the treatment it gets when moving right. Reverse a row with a slice whose step is -1 here too (not reversed), and do not call move itself || The merge_left(row) of the up line becomes: reverse row, merge, then reverse the result"
    return transpose([merge_left(row[::-1])[::-1] for row in transpose(board)])
# <<< BLANK


def show(board):
    for row in board:
        print(" ".join(f"{v:4}" for v in row))


if __name__ == "__main__":
    start = [
        [2, 0, 2, 4],
        [0, 4, 4, 4],
        [2, 2, 0, 0],
        [8, 0, 0, 8],
    ]
    for direction in ["left", "right", "up", "down"]:
        print(direction)
        show(move(start, direction))
