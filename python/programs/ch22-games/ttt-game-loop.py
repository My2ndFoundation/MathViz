"""Tic-tac-toe for two players sharing one keyboard."""

LINES = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6),
]


def winner(board):
    for a, b, c in LINES:
        if board[a] != "." and board[a] == board[b] == board[c]:
            return board[a]
    return None


def show(board):
    for r in range(0, 9, 3):
        print(" ".join(board[r:r + 3]))


def read_move(board, player):
    while True:
        reply = input(f"{player} square 1-9: ")
        if reply.isdecimal() and 1 <= int(reply) <= 9:
# >>> BLANK id=to-index level=2 hint="把敲进来的 1–9 换成列表下标 0–8，存进 square：int 包住 reply，再做一次减法 || 格子 1 在列表的第 0 位" hintEn="Turn the 1-9 that was typed into a list index 0-8 and store it in square: int around reply, then one subtraction || Square 1 lives at position 0 of the list"
            square = int(reply) - 1
# <<< BLANK
            if board[square] == ".":
                return square
            print("That square is taken")
        else:
            print("Not a square")


def play():
    board = ["."] * 9
    player = "X"
    state = "playing"
# >>> BLANK id=loop-state level=1 hint="只要状态还是开局时设的那个值，就一直循环：一个 while，state 写在比较号左边，字符串用双引号" hintEn="Keep looping for as long as the state still has the value it was given at the start: a while with state on the left of the comparison and the string in double quotes"
    while state == "playing":
# <<< BLANK
        show(board)
        board[read_move(board, player)] = player
        if winner(board) == player:
            state = player + " wins"
        elif "." not in board:
            state = "draw"
        else:
# >>> BLANK id=swap level=2 hint="轮到另一方：一行条件表达式（不是 if 语句），判断的是 player 是否等于 X || X 之后换 O，否则换回 X；记号都用双引号" hintEn="Hand the turn to the other side: a one-line conditional expression (not an if statement) testing whether player equals X || After X comes O, otherwise back to X; both marks in double quotes"
            player = "O" if player == "X" else "X"
# <<< BLANK
    show(board)
    print("Game over:", state)


if __name__ == "__main__":
    play()
    play()
