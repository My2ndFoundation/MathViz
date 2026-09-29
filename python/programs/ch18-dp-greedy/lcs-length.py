"""Longest common subsequence: fill a table of lengths, then walk back for one answer."""


def lcs_table(a, b):
    table = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
# >>> BLANK id=match level=1 hint="看两个串「这一格对应的字符」是否相同：表的第 i 行对应 a 的第 i 个字符，它的下标是 i - 1（b 与 j 同理）；写 a 的那一边在 == 左边" hintEn="Check whether the characters for this cell are the same: row i of the table stands for the i-th character of a, whose index is i - 1 (the same for b and j); the a side goes on the left of =="
            if a[i - 1] == b[j - 1]:
# <<< BLANK
                table[i][j] = table[i - 1][j - 1] + 1
            else:
# >>> BLANK id=skip-one level=2 hint="字符不同：两个串里总有一个的这个字符用不上。用 max 取两种「丢掉一个字符」里较好的那种，赋给这一格；先写丢掉 a 的字符那一种 || 丢掉 a 的字符是上一行同一列 table[i - 1][j]；丢掉 b 的字符是同一行前一列" hintEn="Different characters: one of the two strings cannot use its character here. Use max to take the better of the two ways of dropping a character and assign it to this cell; write dropping a's character first || Dropping a's character is the row above, same column: table[i - 1][j]; dropping b's is the same row, previous column"
                table[i][j] = max(table[i - 1][j], table[i][j - 1])
# <<< BLANK
    return table


def lcs_length(a, b):
    return lcs_table(a, b)[len(a)][len(b)]


def one_lcs(a, b):
    table = lcs_table(a, b)
    i, j = len(a), len(b)
    letters = []
    while i > 0 and j > 0:
        if a[i - 1] == b[j - 1]:
            letters.append(a[i - 1])
            i -= 1
            j -= 1
        elif table[i - 1][j] >= table[i][j - 1]:
            i -= 1
        else:
            j -= 1
# >>> BLANK id=reverse level=2 hint="倒着走出来的字母是从后往前收集的：把 letters 反过来、拼成一个字符串交回去；用空串的 join，空串写成一对双引号，里面套 reversed（不用切片 [::-1]） || reversed(letters) 给出倒过来的字母，join 把它们一个挨一个接起来" hintEn="The walk back collected the letters from last to first: reverse letters and join them into one string to return; use join on an empty string written as a pair of double quotes, with reversed inside (not the slice [::-1]) || reversed(letters) gives the letters back to front, and join puts them next to each other"
    return "".join(reversed(letters))
# <<< BLANK


if __name__ == "__main__":
    print(lcs_length("ABCBDAB", "BDCABA"))
    print(one_lcs("ABCBDAB", "BDCABA"))
    print(lcs_length("HUMAN", "CHIMPANZEE"), one_lcs("HUMAN", "CHIMPANZEE"))
    print(lcs_length("ABC", "XYZ"), repr(one_lcs("ABC", "XYZ")))
