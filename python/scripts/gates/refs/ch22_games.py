"""ch22-games 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（协议：种子 properties.SEED、SAMPLES 组、本文件的
生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**随机（清单 §5 R2）**：property 只挂在纯核心函数上。`hangman-state` 的 `mask`、
`minesweeper-place-count` 的 `counts` 拿到的都是确定的实参（词与已猜字母、雷的集合），
本文件的生成器自己造这些实参，不经过被测程序的 rng。

**不改实参**：本章被测的 entry 都不改实参（`ttt-minimax` 用切片拼新棋盘、`board-move-2048`
与两个 2048 行函数都返回新列表、`reveal` 只读 grid）。门给两边各一份深拷贝，参照也不改实参。

**返回类型**：门比较值与类型。井字棋判胜两边都交回 'X' / 'O' / 'draw' / None；
minimax 交回 int；2048 一行交回 (list, int) 元组；整盘交回 list 的 list；
扫雷数雷交回 list 的 list（雷为 -1）；连片翻开交回 set，点到雷两边都是 None。
"""
import functools
import re

EMPTY = '.'


# ── 井字棋：局面生成 ─────────────────────────────────────────────────────

_TABLE = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6),
          (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]


def _someone_won(board):
    # 生成器自用（不是参照）：只用来在随机对局里「有人连成就停」。
    return any(board[a] != EMPTY and board[a] == board[b] == board[c] for a, b, c in _TABLE)


def _random_game(rng, k):
    """从空盘起双方轮流随机落子，至多 k 步，有人连成就停。交回 (棋盘, 该谁走)。"""
    board = [EMPTY] * 9
    player = 'X'
    for _ in range(k):
        if _someone_won(board) or EMPTY not in board:
            break
        empties = [i for i in range(9) if board[i] == EMPTY]
        board[rng.choice(empties)] = player
        player = 'O' if player == 'X' else 'X'
    return board, player


def _ttt_board_case(rng):
    # k 取 0–9：少步数多出「未完」，满 9 步常出平局，中间步数常出 X 胜 / O 胜。
    # 另以 1/4 概率把 k 固定成 9，让平局与「最后一步才连成」更常出现。
    k = 9 if rng.random() < 0.25 else rng.randint(0, 9)
    board, _ = _random_game(rng, k)
    return (board,)


def _ref_winner_arith(board):
    # 'ttt-winner-lines' 的参照：不用赢线表，按行 / 列 / 两条对角用下标算术生成每条线。
    lines = []
    for r in range(3):
        lines.append([3 * r + j for j in range(3)])
        lines.append([r + 3 * j for j in range(3)])
    lines.append([4 * j for j in range(3)])
    lines.append([2 + 2 * j for j in range(3)])
    for line in lines:
        marks = {board[i] for i in line}
        if len(marks) == 1 and EMPTY not in marks:
            return marks.pop()
    return 'draw' if board.count(EMPTY) == 0 else None


def _ref_winner_table(board):
    # 'ttt-winner-loops' 的参照：显式的 8 条线表（被测是行循环 + 列循环 + 对角，互为对方的写法）。
    for line in ((0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6),
                 (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)):
        text = ''.join(board[i] for i in line)
        if text in ('XXX', 'OOO'):
            return text[0]
    return None if EMPTY in board else 'draw'


# ── 井字棋：极小化极大 ───────────────────────────────────────────────────

@functools.lru_cache(maxsize=None)
def _negamax(cells, to_move):
    """站在 to_move 一方的角度：+1 这一方必胜，0 和，-1 必负。cells 是 9 个字符的字符串。"""
    other = 'O' if to_move == 'X' else 'X'
    for a, b, c in _TABLE:
        if cells[a] != EMPTY and cells[a] == cells[b] == cells[c]:
            # 连成线的只能是刚走完的一方 other：对 to_move 来说是输。
            return -1
    if EMPTY not in cells:
        return 0
    best = -2
    for i, ch in enumerate(cells):
        if ch == EMPTY:
            best = max(best, -_negamax(cells[:i] + to_move + cells[i + 1:], other))
    return best


def _ref_minimax(board, player):
    # 'ttt-minimax' 的参照：negamax（一个函数、分数对当前走子方取负）+ lru_cache 记忆化，
    # 被测是 X 取 max / O 取 min 的两支写法、不记忆化。同一个博弈值，不同写法。
    value = _negamax(''.join(board), player)
    return value if player == 'X' else -value


def _minimax_case(rng):
    # 从空盘随机落 k 步（k 取 3–8），只留合法且未结束的局面。k >= 3 让空格至多 6 个：
    # 被测不记忆化，6 个空格时搜索至多几千个结点，远在门每次调用 2 秒的时限内
    # （空盘要五十多万个结点，会逼近时限，所以不取 k < 3）。k = 8 时只剩一个空格。
    while True:
        k = rng.randint(3, 8)
        board, player = _random_game(rng, k)
        if not _someone_won(board) and EMPTY in board and board.count(EMPTY) == 9 - k:
            return (board, player)


# ── Hangman ─────────────────────────────────────────────────────────────

def _ref_mask(word, guessed):
    # 'hangman-state' 的参照：正则逐个字母替换（被测是循环拼字符串）。
    return re.sub(r'[a-z]', lambda m: m.group() if m.group() in guessed else '_', word)


def _mask_case(rng):
    # 小字母表让词里常有重复字母、已猜集合常与词相交；也会出现空词、空集合、全猜中。
    alphabet = 'abcdefg'
    word = ''.join(rng.choice(alphabet) for _ in range(rng.randint(0, 9)))
    guessed = {ch for ch in alphabet if rng.random() < 0.5}
    if rng.random() < 0.1:
        guessed = set(word)
    return (word, guessed)


# ── 2048 一行 ───────────────────────────────────────────────────────────

def _ref_merge_stack(row):
    # 'merge-row-2048-compress' 的参照：另写的「输出栈 + 刚合并标志」（被测先挤 0 再逐对合并）。
    out, locked, score = [], [], 0
    for v in row:
        if v == 0:
            continue
        if out and out[-1] == v and not locked[-1]:
            out[-1] += v
            locked[-1] = True
            score += out[-1]
        else:
            out.append(v)
            locked.append(False)
    return out + [0] * (len(row) - len(out)), score


def _ref_merge_compress(row):
    # 'merge-row-2048-stack' 的参照：另写的「先挤 0 再合并」（被测是输出栈 + 标志）。
    tiles = list(filter(None, row))
    result, score = [], 0
    while tiles:
        first = tiles.pop(0)
        if tiles and tiles[0] == first:
            tiles.pop(0)
            result.append(first * 2)
            score += first * 2
        else:
            result.append(first)
    result.extend([0] * (len(row) - len(result)))
    return result, score


_SPECIAL_ROWS = ([2, 2, 2, 2], [2, 2, 2, 0], [0, 0, 0, 0], [4, 0, 4, 8], [2, 2, 4, 0],
                 [2, 4, 8, 16], [8, 8, 8], [], [2], [0, 2, 2, 2, 2, 2])


def _row(rng):
    # 取值偏向少数几种，相邻相等、三块 / 四块连续相等才常见；长度 0–6。
    n = rng.randint(0, 6)
    values = rng.choice(((0, 2), (0, 2, 4), (2, 4, 8), (0, 2, 4, 8, 16)))
    return [rng.choice(values) for _ in range(n)]


def _row_case(rng):
    if rng.random() < 0.2:
        return (list(rng.choice(_SPECIAL_ROWS)),)
    return (_row(rng),)


# ── 2048 整盘 ───────────────────────────────────────────────────────────

def _ref_move(board, direction):
    # 'board-move-2048' 的参照：不转置、不反转，按方向直接列出每条线上格子的 (行, 列) 次序，
    # 沿这个次序取值、合并、再按同一次序写回一个新棋盘。
    h = len(board)
    w = len(board[0]) if h else 0
    if direction in ('left', 'right'):
        lines = [[(r, c) for c in range(w)] for r in range(h)]
    else:
        lines = [[(r, c) for r in range(h)] for c in range(w)]
    if direction in ('right', 'down'):
        lines = [line[::-1] for line in lines]
    new = [[0] * w for _ in range(h)]
    for line in lines:
        merged, _ = _ref_merge_stack([board[r][c] for r, c in line])
        for (r, c), v in zip(line, merged):
            new[r][c] = v
    return new


def _board_case(rng):
    # 宽高各取 1–5（也有非正方形：被测的转置对长方形同样成立）；方向四选一均匀抽。
    h, w = rng.randint(1, 5), rng.randint(1, 5)
    values = rng.choice(((0, 2), (0, 2, 4), (0, 2, 4, 8)))
    board = [[rng.choice(values) for _ in range(w)] for _ in range(h)]
    return (board, rng.choice(('left', 'right', 'up', 'down')))


# ── 扫雷 ────────────────────────────────────────────────────────────────

def _ref_counts(w, h, mines):
    # 'minesweeper-place-count' 的参照：从每颗雷向外给 8 个邻格各加一，最后把雷格写成 -1
    # （被测是从每格向内数邻格里的雷）。
    grid = [[0] * w for _ in range(h)]
    for mx, my in mines:
        for y in range(max(0, my - 1), min(h, my + 2)):
            for x in range(max(0, mx - 1), min(w, mx + 2)):
                grid[y][x] += 1
    for mx, my in mines:
        grid[my][mx] = -1
    return grid


def _mines(rng, w, h):
    density = rng.choice((0.0, 0.1, 0.25, 0.5, 0.9))
    return {(x, y) for y in range(h) for x in range(w) if rng.random() < density}


def _counts_case(rng):
    w, h = rng.randint(1, 7), rng.randint(1, 7)
    return (w, h, _mines(rng, w, h))


def _ref_reveal(grid, x, y):
    # 'minesweeper-flood-reveal' 的参照：递归 DFS（只在参照里递归；被测是 deque 的 BFS）。
    if grid[y][x] < 0:
        return None
    h, w = len(grid), len(grid[0])
    seen = set()

    def visit(cx, cy):
        if (cx, cy) in seen:
            return
        seen.add((cx, cy))
        if grid[cy][cx]:
            return
        for ny in range(max(0, cy - 1), min(h, cy + 2)):
            for nx in range(max(0, cx - 1), min(w, cx + 2)):
                visit(nx, ny)

    visit(x, y)
    return seen


def _reveal_case(rng):
    # 棋盘至多 7 × 7，递归深度至多 49，远低于 1000 的上限。低密度档多出大片 0（扩散），
    # 高密度档多出点到雷；点击格均匀抽，所以雷 / 数字 / 0 三种起点都会抽到。
    w, h = rng.randint(1, 7), rng.randint(1, 7)
    grid = _ref_counts(w, h, _mines(rng, w, h))
    return (grid, rng.randrange(w), rng.randrange(h))


REFERENCES = {
    'ttt-winner-lines': {'ref': _ref_winner_arith, 'cases': _ttt_board_case},
    'ttt-winner-loops': {'ref': _ref_winner_table, 'cases': _ttt_board_case},
    'ttt-minimax': {'ref': _ref_minimax, 'cases': _minimax_case},
    'hangman-state': {'ref': _ref_mask, 'cases': _mask_case},
    'merge-row-2048-compress': {'ref': _ref_merge_stack, 'cases': _row_case},
    'merge-row-2048-stack': {'ref': _ref_merge_compress, 'cases': _row_case},
    'board-move-2048': {'ref': _ref_move, 'cases': _board_case},
    'minesweeper-place-count': {'ref': _ref_counts, 'cases': _counts_case},
    'minesweeper-flood-reveal': {'ref': _ref_reveal, 'cases': _reveal_case},
}
