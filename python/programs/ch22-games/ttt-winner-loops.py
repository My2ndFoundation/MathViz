"""Tic-tac-toe: who has won, checked with a row loop, a column loop and the diagonals."""


def same(board, i, j, k):
    return board[i] != "." and board[i] == board[j] == board[k]


def winner(board):
    for r in range(3):
        if same(board, 3 * r, 3 * r + 1, 3 * r + 2):
            return board[3 * r]
    for c in range(3):
# >>> BLANK id=column level=2 hint="仿照上面那一行写列：同样是 if 调用 same，三个下标都从 c 算出、按从上到下的顺序，c 写在加号左边 || 同一列里往下走一格，下标加 3" hintEn="Write the column version of the row test above: again an if calling same, with all three indexes worked out from c, top to bottom, and c on the left of each plus sign || Going one square down the same column adds 3 to the index"
        if same(board, c, c + 3, c + 6):
# <<< BLANK
# >>> BLANK id=column-owner level=1 hint="这一列三格同属一方：交回这一列最上面那一格里的记号" hintEn="All three squares of this column belong to one side: hand back the mark in the top square of the column"
            return board[c]
# <<< BLANK
    if same(board, 0, 4, 8) or same(board, 2, 4, 6):
# >>> BLANK id=centre level=2 hint="两条对角线里不知道是哪一条连成了，但交回的记号可以从两条线共有的那一格取 || 两条对角线都经过正中间那一格" hintEn="We do not know which diagonal made the line, but the mark can be taken from the one square both lines share || Both diagonals pass through the square in the very middle"
        return board[4]
# <<< BLANK
    if "." not in board:
        return "draw"
    return None


if __name__ == "__main__":
    for text in ["XXXOO....", "XOOX..X..", "OXXXO...O", "XOXXOOOXX", "X...O...."]:
        print(text, "->", winner(list(text)))
