"""Replace, insert and delete whole stretches of a list through slices."""


def show_slices():
    a = [1, 2, 3, 4, 5]
    a[1:3] = [7, 8, 9]
    print(a, len(a))
# >>> BLANK id=insert-slice level=2 hint="在下标 1 处插进两个 0，原有的一项都不替换：一个切片赋值，不用 insert；右边把两个 0 直接写进一个列表的方括号里，不用 * || 切片的起点和终点写同一个下标，切出来的是一段空的——把东西放进空段，就是插入" hintEn="Insert two zeros at index 1 without replacing any existing item: one slice assignment, not insert; on the right, write both zeros straight into the brackets of a list, without * || Give the slice the same index for its start and its stop, so it covers an empty stretch - putting things into an empty stretch is inserting"
    a[1:1] = [0, 0]
# <<< BLANK
    print(a)
# >>> BLANK id=del-step level=2 hint="一条 del 语句删掉下标 0、2、4……上的每一项；切片的起点和终点都留空 || 只写第三段步长：每一步往前跨几个位置？" hintEn="One del statement that removes the item at every index 0, 2, 4 and so on; leave the start and the stop of the slice empty || Write only the third part, the step: how many places does each move jump forward?"
    del a[::2]
# <<< BLANK
    print(a)
    b = a
# >>> BLANK id=replace-all level=2 hint="不换 a 指向的那个列表，而是就地把它的全部内容换成 10 和 20 两个数——所以 b 也看得见；切片的起点和终点都留空 || 切片写在等号左边，右边是一个新的列表" hintEn="Do not point a at a different list; replace the whole contents of the list it already names with the two numbers 10 and 20, in place - which is why b sees it too; leave the start and the stop of the slice empty || The slice goes on the left of the equals sign, and a new list on the right"
    a[:] = [10, 20]
# <<< BLANK
    print(a, b, a is b)
    a = [30, 40]
    print(a, b, a is b)


if __name__ == "__main__":
    show_slices()
