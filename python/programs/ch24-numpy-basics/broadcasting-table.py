"""Use broadcasting to build a times table without writing a loop."""
import numpy as np


def times_table(n):
    """Return the n by n times table as a list of lists (n may be 0)."""
# >>> BLANK id=col level=2 hint="造一个 n 行 1 列的列向量 col，内容是 1 到 n：先用 np.arange 造出 1..n（终点不含，所以写 n + 1），再接 .reshape 排成 n 行 1 列；reshape 的两个实参都写出来，不用 -1 || reshape 的两个实参是两个单独的整数：先 n、再 1" hintEn="Make a column vector col with n rows and 1 column holding 1 to n: build 1..n with np.arange first (the stop is left out, so write n + 1), then chain .reshape to lay it out as n rows and 1 column; write both arguments of reshape out, without -1 || The two arguments of reshape are two separate integers: n first, then 1"
    col = np.arange(1, n + 1).reshape(n, 1)
# <<< BLANK
    row = np.arange(1, n + 1).reshape(1, n)
# >>> BLANK id=product level=2 hint="一行 return：col 与 row 逐元素相乘，(n,1) 与 (1,n) 广播成 (n,n)，再把结果转回嵌套列表；col 写在乘号左边，乘积整个放在一对圆括号里 || 转回列表用 .tolist()，接在那对圆括号后面" hintEn="One return line: multiply col and row element by element - (n,1) with (1,n) broadcasts to (n,n) - then turn the result back into nested lists; col on the left of the times sign, and the whole product inside one pair of round brackets || Turning it back into lists is .tolist(), chained after those brackets"
    return (col * row).tolist()
# <<< BLANK


if __name__ == "__main__":
    prices = np.array([2.5, 4.0, 1.2])
    print(prices * 2)
    print(prices + 0.5)

    col = np.array([[1], [2], [3]])
    row = np.array([10, 20, 30, 40])
    print(col.shape, row.shape)
    both = col + row
    print(both.shape)
    print(both)

    print(times_table(3))
    print(np.array(times_table(5)))
    print(times_table(0))

    try:
        print(np.array([1, 2, 3]) + np.array([1, 2]))
# >>> BLANK id=except level=2 hint="两行：先是 except 子句，接住形状不兼容时抛出的那种异常，并把它命名为 e；下一行（缩进在里面）打印这个异常的类名——类名从 e 身上取，不写死成字符串 || 异常是 ValueError；类名用 type(e).__name__ 取，不打印 e 本身" hintEn="Two lines: first the except clause, catching the kind of exception raised when shapes do not match and naming it e; the next line (indented inside) prints the class name of that exception - taken from e, not typed in as a string || The exception is ValueError; get the class name with type(e).__name__, not by printing e itself"
    except ValueError as e:
        print(type(e).__name__)
# <<< BLANK
