"""2048: slide one row to the left by pushing tiles onto an output stack."""


def merge_left(row):
    out = []
    just_merged = False
    score = 0
    for v in row:
        if v == 0:
            continue
# >>> BLANK id=can-merge level=2 hint="三个条件用 and 连起来，依次是：out 不空（直接写 out）、栈顶（用负下标取，写在等号左边）等于 v、用 not 说明栈顶不是刚合并出来的 || 最后一个条件用的是上面设成 False 的那个标志变量" hintEn="Three conditions joined with and, in this order: out is not empty (just write out), the top of the stack (reached with a negative index, on the left of ==) equals v, and not says the top was not made by a merge just now || The last condition uses the flag variable that was set to False above"
        if out and out[-1] == v and not just_merged:
# <<< BLANK
# >>> BLANK id=double-top level=1 hint="合并：直接把栈顶改成 v 的两倍（不 pop 也不 append，也不用 *=），等号右边 v 写在乘号左边" hintEn="Merge: change the top of the stack to twice v in place (no pop, no append and no *=), with v on the left of the multiplication sign"
            out[-1] = v * 2
# <<< BLANK
            score += v * 2
# >>> BLANK id=mark-merged level=1 hint="记下栈顶这一块是刚合并出来的，这一步里它不能再合并" hintEn="Record that the tile on top was just made by a merge, so it cannot merge again in this move"
            just_merged = True
# <<< BLANK
        else:
            out.append(v)
            just_merged = False
    return out + [0] * (len(row) - len(out)), score


if __name__ == "__main__":
    for row in [[2, 2, 2, 2], [2, 2, 2, 0], [4, 0, 4, 8], [2, 4, 8, 16], [0, 0, 0, 0]]:
        new_row, score = merge_left(row)
        print(row, "->", new_row, "score", score)
