"""Decide a game of rock-paper-scissors with one modulo instead of nine cases."""

MOVES = ["rock", "paper", "scissors"]


def winner(move1, move2):
# >>> BLANK id=difference level=3 hint="把两步棋换成它们在 MOVES 里的位置，第一步减第二步，再对 3 取余，存进 difference；用列表的 index 方法查位置；取余之前不先加 3（Python 的 % 3 对负数也交回 0 到 2） || 减法要先算完再取余，所以两次查位置与中间的减号一起放进一对括号，% 3 写在括号外面 || 位置写成 MOVES.index(…) 的形式，move1 的在减号左边" hintEn="Turn both moves into their positions in MOVES, subtract the second from the first, take the remainder mod 3 and store it in difference; find a position with the list's index method; do not add 3 before taking the remainder (Python's % 3 gives 0 to 2 even for a negative number) || The subtraction has to happen before the remainder, so both position lookups and the minus between them go inside one pair of brackets, with % 3 outside || Write each position as MOVES.index(...), move1's on the left of the minus"
    difference = (MOVES.index(move1) - MOVES.index(move2)) % 3
# <<< BLANK
    if difference == 0:
        return "draw"
# >>> BLANK id=one-ahead level=2 hint="接着判第二种情况：用 elif，difference 写在比较号左边，与一个数比较是否相等 || 第一步正好比第二步在列表里靠后一位（绕回开头也算）时，第一个玩家赢——那时 difference 是 1" hintEn="Test the second case next: elif, with difference on the left, compared for equality with a number || Player 1 wins when their move sits exactly one place after player 2's in the list (wrapping round to the start counts) - and then difference is 1"
    elif difference == 1:
# <<< BLANK
        return "player 1"
    else:
        return "player 2"


if __name__ == "__main__":
    for first in MOVES:
        for second in MOVES:
            print(first, "v", second, "->", winner(first, second))
    print(-2 % 3, -1 % 3)
