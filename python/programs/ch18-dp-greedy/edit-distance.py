"""Edit distance: the fewest inserts, deletes and replacements that turn a into b."""


def edit_distance(a, b):
    rows = len(a) + 1
    cols = len(b) + 1
    dist = [[0] * cols for _ in range(rows)]
    for i in range(rows):
# >>> BLANK id=first-column level=1 hint="第 0 列是「把 a 的前 i 个字符变成空串」：只能一个个删掉，所以要删几次？赋给 dist 第 i 行第 0 列" hintEn="Column 0 means turning the first i characters of a into the empty string: they can only be deleted one by one, so how many deletions is that? Assign it to row i, column 0 of dist"
        dist[i][0] = i
# <<< BLANK
    for j in range(cols):
        dist[0][j] = j
    for i in range(1, rows):
        for j in range(1, cols):
# >>> BLANK id=cost level=2 hint="替换这一步要不要花一次：一个条件表达式赋给 cost——两个字符相同时是 0，否则是 1；0 写在前面，用 == 比较、a 的那个字符写在左边 || 这一格对应 a 的下标 i - 1 与 b 的下标 j - 1" hintEn="Does replacing cost anything here: assign a conditional expression to cost - 0 when the two characters are the same, otherwise 1; write the 0 first, and compare with == with the character from a on the left || This cell stands for index i - 1 of a and index j - 1 of b"
            cost = 0 if a[i - 1] == b[j - 1] else 1
# <<< BLANK
            delete = dist[i - 1][j] + 1
            insert = dist[i][j - 1] + 1
# >>> BLANK id=replace level=2 hint="替换（或字符相同时原样保留）：从左上对角那一格出发，再加上 cost，存进 replace；写法照上面两行的样子 || 左上对角是上一行、前一列" hintEn="Replace (or keep, when the characters are the same): start from the cell diagonally up and to the left and add cost, storing it in replace; write it in the same shape as the two lines above || Diagonally up-left is the previous row and the previous column"
            replace = dist[i - 1][j - 1] + cost
# <<< BLANK
            dist[i][j] = min(delete, insert, replace)
    return dist[rows - 1][cols - 1]


if __name__ == "__main__":
    print(edit_distance("kitten", "sitting"))
    print(edit_distance("flaw", "lawn"))
    print(edit_distance("", "abc"), edit_distance("same", "same"))
