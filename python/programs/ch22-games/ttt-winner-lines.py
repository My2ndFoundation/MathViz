"""Tic-tac-toe: who has won, checked against a table of the eight lines."""

# Squares are numbered 0-8, left to right and top to bottom.
LINES = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6),
]


def winner(board):
# >>> BLANK id=each-line level=1 hint="逐条取出表里的赢线，并在 for 这一行直接拆成三个下标 a、b、c（不加括号）" hintEn="Take the winning lines from the table one at a time, unpacking each one straight into three indexes a, b and c on the for line itself (no brackets)"
    for a, b, c in LINES:
# <<< BLANK
        if board[a] != "." and board[a] == board[b] == board[c]:
# >>> BLANK id=who-won level=1 hint="三格已知同属一方，交回这一方的记号：取这条线第一格里的那个（用 a）" hintEn="The three squares belong to the same side, so hand back that side's mark: the one in the first square of the line (use a)"
            return board[a]
# <<< BLANK
# >>> BLANK id=board-full level=2 hint="没有人连成线时，再问棋盘上是否一个空格都不剩：一个 if，用 not in，字符串用双引号 || 空格在棋盘上记作一个英文句点" hintEn="When nobody has a line, ask whether the board has no empty square left: an if, using not in, with the string in double quotes || An empty square is written as a single full stop"
    if "." not in board:
# <<< BLANK
        return "draw"
    return None


def show(board):
    for row in range(3):
        print(" ".join(board[3 * row:3 * row + 3]))


if __name__ == "__main__":
    for text in ["XXXOO....", "XXOXO.O..", "XOXXOOOXX", "X...O...."]:
        board = list(text)
        show(board)
        print("result:", winner(board))
        print()
