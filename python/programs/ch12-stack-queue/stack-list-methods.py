"""A Python list used as a stack: the last item pushed is the first one popped."""


def peek(stack):
    if not stack:
        return None
# >>> BLANK id=peek level=2 hint="栈不空时，交回栈顶那一项，但不把它拿走：用下标，不调用任何方法 || 栈顶就是列表的最后一项；用负下标，不用 len() 去算" hintEn="When the stack is not empty, hand back the top item without taking it off: use an index, not a method call || The top of the stack is the last item of the list; use a negative index rather than working it out with len()"
    return stack[-1]
# <<< BLANK


def pop_or_none(stack):
    if not stack:
        return None
    return stack.pop()


if __name__ == "__main__":
    stack = []
    for plate in ["red", "green", "blue"]:
# >>> BLANK id=push level=1 hint="压栈：把 plate 放到列表末尾——用列表方法，不用 += 或 insert" hintEn="Push: put plate on the end of the list - with a list method, not += or insert"
        stack.append(plate)
# <<< BLANK
        print("push", plate, "->", stack)
    print("top:", peek(stack))
    while stack:
# >>> BLANK id=pop level=2 hint="出栈：取下栈顶那一项、存进 plate；只有一个方法既拿走它又把它交回来，而且这里不给它任何实参 || 那个方法的名字就是英文的「弹出」；它缺省就取最后一项" hintEn="Pop: take the top item off and store it in plate; only one method both removes it and hands it back, and here it gets no argument at all || The method's name is the English word for popping; by default it takes the last item"
        plate = stack.pop()
# <<< BLANK
        print("pop", plate, "->", stack)
    print("empty:", not stack)
    print(peek(stack), pop_or_none(stack))
    try:
        stack.pop()
    except IndexError as e:
        print("unguarded pop:", type(e).__name__)
