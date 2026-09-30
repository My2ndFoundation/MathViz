"""Multiply two matrices by pairing every row of a with every column of b."""


def dot(u, v):
# >>> BLANK id=dot level=2 hint="一行 return：把 u 和 v 按位置配成对，每对相乘，再全部加起来——sum 里放一个生成器表达式，不加方括号；成对的两个值叫 x 和 y，乘号左边是 x || 配对用 zip(u, v)；for 后面一次解包出 x, y 两个名字" hintEn="One return line: pair up u and v position by position, multiply each pair and add all the products - a generator expression inside sum, with no square brackets; the two values of a pair are x and y, with x on the left of the times sign || Pairing is done by zip(u, v); after for, unpack the two names x, y at once"
    return sum(x * y for x, y in zip(u, v))
# <<< BLANK


def matrix_multiply(a, b):
# >>> BLANK id=columns level=2 hint="把 b 的每一列取出来，存成一个可以反复遍历的列表：zip 配上解包 b，外面再用 list() 包一层 || b 前面的一个星号把 b 的每一行拆成 zip 的一个实参" hintEn="Take out every column of b and keep them in a list that can be gone through again and again: zip with b unpacked, wrapped in list() || The single star in front of b spreads each row of b out as a separate argument to zip"
    columns = list(zip(*b))
# <<< BLANK
# >>> BLANK id=rows-times-columns level=3 hint="一行 return 一个嵌套列表推导式：结果的每一行由 a 的一行得来，行里的每一格是这一行与 b 的一列的点积，交给上面写好的 dot 去算（不在这里另写 sum）；循环变量叫 row 和 col；调用 dot 时先传 row、再传 col || 外层的 for 遍历 a、写在外层方括号里的最后；内层的 for 遍历 columns || 两层推导式都只有一个 for、没有 if；内层整个放在它自己的一对方括号里" hintEn="One return line with a nested list comprehension: each row of the result comes from one row of a, and each cell in it is the dot product of that row with one column of b, worked out by the dot function written above (no separate sum here); the loop variables are row and col; when calling dot, pass row first and col second || The outer for goes through a and sits last inside the outer brackets; the inner for goes through columns || Each comprehension has just one for and no if; the inner one sits inside its own pair of brackets"
    return [[dot(row, col) for col in columns] for row in a]
# <<< BLANK


if __name__ == "__main__":
    a = [[1, 2, 3], [4, 5, 6]]
    b = [[7, 8], [9, 10], [11, 12]]
    print(list(zip(*b)))
    print(matrix_multiply(a, b))
    print(matrix_multiply(b, a))
    print(matrix_multiply([[2, 0], [0, 2]], [[1, 2], [3, 4]]))
    print(matrix_multiply([[1, 2, 3]], [[4], [5], [6]]))
