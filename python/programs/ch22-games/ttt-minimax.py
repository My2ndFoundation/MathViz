"""Tic-tac-toe minimax: the result of a position if both sides play perfectly."""

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


def minimax(board, player):
    """Score for X with player to move: 1 X wins, 0 draw, -1 O wins."""
    won = winner(board)
    if won == "X":
        return 1
    if won == "O":
        return -1
    if "." not in board:
        return 0
    other = "O" if player == "X" else "X"
    scores = []
    for i in range(9):
        if board[i] == ".":
# >>> BLANK id=child level=2 hint="不改 board，拼出一个新棋盘：一个表达式，三段用加号连起来——i 之前的切片（省略起点）、只装着 player 的一个单元素列表、i 之后的切片 || 后一段切片从 i + 1 开始，一直到末尾" hintEn="Build a new board without changing board: one expression, three parts joined with plus signs - the slice before i (start left out), a one-item list holding player, and the slice after i || The second slice starts at i + 1 and runs to the end"
            child = board[:i] + [player] + board[i + 1:]
# <<< BLANK
# >>> BLANK id=recurse level=1 hint="新棋盘上轮到另一方走：对它求 minimax，把结果追加进 scores（一行）" hintEn="On the new board it is the other side's turn: work out minimax for it and append the result to scores (one line)"
            scores.append(minimax(child, other))
# <<< BLANK
    if player == "X":
# >>> BLANK id=x-chooses level=1 hint="轮到 X 时，X 挑对自己最有利的那一步：用一个内置函数从 scores 里取出那个值，直接 return" hintEn="When it is X's turn, X picks the move that is best for X: return that value, picked out of scores with one built-in function"
        return max(scores)
# <<< BLANK
    return min(scores)


def best_move(board):
    """X to move: the first square with the highest score, and that score."""
    best_square, best_score = None, -2
    for i in range(9):
        if board[i] == ".":
            trial = list(board)
            trial[i] = "X"
            score = minimax(trial, "O")
            if score > best_score:
                best_square, best_score = i, score
    return best_square, best_score


if __name__ == "__main__":
    for text in ["XX.OO....", "OO..X...X", "X..O.....", "X...O...."]:
        square, score = best_move(list(text))
        print(text, "X plays square", square + 1, "score", score)
