"""Store a sparse grid in a dictionary keyed by (row, col) tuples."""


def cell(grid, row, col):
# >>> BLANK id=get-cell level=2 hint="一行 return：用 get 按元组键 (row, col) 查 grid，查不到时交回一个句点；元组带上自己的圆括号，句点写成双引号字符串 || 网格里大多数格子根本没有存，get 的缺省值就是这些空格子的样子" hintEn="One line of return: look grid up with get using the tuple key (row, col), handing back a full stop when there is nothing there; keep the tuple's own brackets, and write the full stop as a double-quoted string || Most cells of the grid are never stored at all, and get's default is what those empty cells look like"
    return grid.get((row, col), ".")
# <<< BLANK


def draw(grid, rows, cols):
    for r in range(rows):
        line = ""
        for c in range(cols):
# >>> BLANK id=build-line level=1 hint="把第 r 行第 c 列那一格的字符接到 line 后面：调用上面的 cell，用增强赋值写" hintEn="Add the character for row r, column c to the end of line: call cell from above, and write it as an augmented assignment"
            line += cell(grid, r, c)
# <<< BLANK
        print(line)


if __name__ == "__main__":
    grid = {(0, 1): "#", (2, 3): "#", (1, 1): "@"}
    grid[(2, 0)] = "#"
    draw(grid, 3, 4)
    print(len(grid), (1, 1) in grid, (1, 2) in grid)
    try:
        grid[[0, 0]] = "#"
# >>> BLANK id=except-type level=2 hint="接住用列表当键时抛出的那种异常，把它绑定到名字 e 上 || 出错的是键的类型：列表这种类型不能被哈希" hintEn="Catch the kind of exception raised when a list is used as a key, and bind it to the name e || What is wrong is the type of the key: a list is a type that cannot be hashed"
    except TypeError as e:
# <<< BLANK
        print("list key:", type(e).__name__)
    visited = {(0, 0), (0, 1)}
    visited.add((0, 1))
    visited.add((1, 1))
    print(sorted(visited))
