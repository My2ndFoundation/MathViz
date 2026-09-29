"""Undo and redo for a tiny text editor, kept on two stacks."""


def run_ops(ops):
    text = ""
    undo_stack = []
    redo_stack = []
    after_each = []
    for op in ops:
        if op[0] == "type":
            undo_stack.append(text)
# >>> BLANK id=clear level=2 hint="新打的字让「重做」失去意义：把 redo 栈清空。用列表方法就地清空，不重新赋值成 [] || 那个方法不带实参，名字就是「清空」的英文" hintEn="New typing makes redo meaningless: empty the redo stack. Empty it in place with a list method, not by assigning [] again || The method takes no argument and its name is the English word for emptying it"
            redo_stack.clear()
# <<< BLANK
            text = text + op[1]
        elif op[0] == "undo":
            if undo_stack:
# >>> BLANK id=undo level=2 hint="两行，顺序要紧：先把现在的 text 压进 redo 栈，再从 undo 栈弹出上一版、交给 text || 和下面 redo 那一支的两行是镜像：两个栈的名字对调" hintEn="Two lines, and the order matters: first push the current text onto the redo stack, then pop the previous version off the undo stack into text || They mirror the two lines in the redo branch below, with the two stack names swapped"
                redo_stack.append(text)
                text = undo_stack.pop()
# <<< BLANK
        elif op[0] == "redo":
            if redo_stack:
                undo_stack.append(text)
                text = redo_stack.pop()
        after_each.append(text)
    return after_each


if __name__ == "__main__":
    ops = [
        ("type", "Hi"), ("type", " there"), ("undo",), ("undo",), ("undo",),
        ("redo",), ("type", "!"), ("redo",), ("undo",),
    ]
    for op, text in zip(ops, run_ops(ops)):
        print(op[0], repr(text))
