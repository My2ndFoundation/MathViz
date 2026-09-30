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
# >>> BLANK id=right level=2 hint="向右 = 把每一行反过来、向左合并、再反回去：仿照上面向左那一行，写成一个列表推导式，循环变量同样叫 row || 反转一行用步长为 -1 的切片，合并前反一次、合并后对结果再反一次" hintEn="Right is: reverse each row, merge it to the left, and reverse it back - a list comprehension shaped like the left one above, with the loop variable again called row || Reverse a row with a slice whose step is -1, once before merging and once more on the result"
        return [merge_left(row[::-1])[::-1] for row in board]
# <<< BLANK
    if direction == "up":
# >>> BLANK id=up level=2 hint="向上 = 转置、每行向左合并、再转置回来：外层调用 transpose，里面是和向左那一行一样的推导式，只是作用在转置后的棋盘上，循环变量同样叫 row || 列表推导式里的 for 取的是 transpose(board) 的每一行" hintEn="Up is: transpose, merge every row to the left, transpose back - an outer transpose call around the same comprehension as for left, applied to the transposed board, with the loop variable again called row || The comprehension's for takes each row of transpose(board)"
        return transpose([merge_left(row) for row in transpose(board)])
# <<< BLANK
    return transpose([merge_left(row[::-1])[::-1] for row in transpose(board)])


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
