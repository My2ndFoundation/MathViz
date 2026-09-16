"""Build a list of squares with a loop and append."""


def squares(numbers):
# >>> BLANK id=empty-list level=1 hint="结果列表先从空开始，名字叫 result；用一对方括号写空列表，不用 list()" hintEn="The result list starts out empty and is called result; write the empty list as a pair of square brackets, not list()"
    result = []
# <<< BLANK
    for n in numbers:
# >>> BLANK id=append-square level=2 hint="把 n 的平方接到 result 末尾：调用列表的方法，不用 += 或 insert；平方写成 n 乘 n（用 *，不用 ** 2） || 每轮循环只接一项，接的是算出来的值，不是 n 本身" hintEn="Add the square of n to the end of result: call the list's own method, not += or insert; write the square as n times n (with *, not ** 2) || Each pass of the loop adds exactly one item, and what goes in is the value worked out, not n itself"
        result.append(n * n)
# <<< BLANK
    return result


if __name__ == "__main__":
    print(squares([1, 2, 3, 4, 5]))
    print(squares([-3, 0, 7]))
    print(squares(range(4)))
    print(squares([]))
