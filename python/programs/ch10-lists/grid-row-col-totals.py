"""Total every row and every column of a 2D grid with two nested index loops."""


def row_col_totals(grid):
    rows = len(grid)
    cols = len(grid[0])
    row_totals = [0] * rows
# >>> BLANK id=col-start level=1 hint="和上一行对称：给 col_totals 一个列表，每一列一个 0；用 * 重复，列表写在 * 的左边" hintEn="The mirror image of the line above: give col_totals a list with one 0 per column; repeat it with *, with the list on the left of the *"
    col_totals = [0] * cols
# <<< BLANK
    for r in range(rows):
        for c in range(cols):
# >>> BLANK id=row-add level=2 hint="把这一格的值加到它所在那一行的合计上；用 +=，不写成 x = x + … || 合计列表用行号 r 取；这一格是 grid 先按行号、再按列号取出来的" hintEn="Add the value of this cell to the total for the row it is in; use +=, not x = x + ... || Index the totals list with the row number r; the cell is taken from grid by row number first, then column number"
            row_totals[r] += grid[r][c]
# <<< BLANK
# >>> BLANK id=col-add level=2 hint="同一格的值再加到它所在那一列的合计上；同样用 += || 合计列表这回用列号 c 取；取格子的写法与上一行完全相同——grid 的下标永远是先行后列" hintEn="Add the same cell's value to the total for the column it is in; again use += || This time index the totals list with the column number c; the cell is taken exactly as on the line above - grid is always indexed row first, then column"
            col_totals[c] += grid[r][c]
# <<< BLANK
    return row_totals, col_totals


if __name__ == "__main__":
    marks = [[3, 5, 2], [4, 0, 6]]
    rows, cols = row_col_totals(marks)
    print(rows)
    print(cols)
    print(row_col_totals([[7]]))
    print(row_col_totals([[1, 2, 3]]))
    print(row_col_totals([[1], [2], [3]]))
