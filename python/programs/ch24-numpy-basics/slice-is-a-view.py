"""Show that a NumPy slice is a view of the original array, not a copy."""
import numpy as np


def clear_block(grid, top, left):
    """Set everything from row top and column left onwards to 0, in place."""
    block = grid[top:, left:]
# >>> BLANK id=fill level=2 hint="把 block 里的每一个元素都改成 0：写成切片赋值，方括号里只放一个冒号，右边是整数 0；不用 fill 方法 || 改的是 block 这个视图，grid 里对应的那一块跟着变——所以这个函数不需要 return" hintEn="Change every element of block to 0: write it as a slice assignment with a single colon inside the square brackets and the integer 0 on the right; not the fill method || What changes is the view block, and the matching part of grid changes with it - which is why this function needs no return"
    block[:] = 0
# <<< BLANK


def last_set_to(grid, r, value):
    """Return a changed copy of row r; grid itself is left alone."""
# >>> BLANK id=copy level=2 hint="取出 grid 的第 r 行，并立刻做一份独立的拷贝，存进 row：下标只写 r 一个，拷贝用数组自己的方法，不用 np.copy || 方法名是 copy，接在 grid[r] 后面" hintEn="Take row r of grid and at once make an independent copy of it, kept in row: the subscript is just r, and the copy uses the array's own method, not np.copy || The method is copy, chained straight after grid[r]"
    row = grid[r].copy()
# <<< BLANK
    row[-1] = value
    return row


if __name__ == "__main__":
    seats = np.arange(1, 13).reshape(3, 4)
    print(seats)
    print(seats[1, 2])
    print(seats[0])
# >>> BLANK id=column level=2 hint="打印 seats 的第 1 列（从 0 数起），结果是一个一维数组：两个下标写在同一对方括号里、用逗号隔开；行的位置只写一个单独的冒号（不写 0: 这类起止），不用 .T || 冒号表示「所有行」，逗号后面是列号 1" hintEn="Print column 1 of seats (counting from 0) as a one-dimensional array: two subscripts in one pair of square brackets, separated by a comma; the row position is just a single colon (no start or stop such as 0:), and no .T || The colon means every row, and after the comma comes the column number 1"
    print(seats[:, 1])
# <<< BLANK
    print(seats[1:, 2:])

    front = seats[0]
    front[0] = 99
    print(seats[0])
    print(np.shares_memory(seats, front))

    clear_block(seats, 1, 2)
    print(seats)

    safe = last_set_to(seats, 2, -1)
    print(safe)
    print(seats[2])
    print(np.shares_memory(seats, safe))

    row = [1, 2, 3]
    part = row[:2]
    part[0] = 99
    print(row)
