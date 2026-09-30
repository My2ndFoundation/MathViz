"""Build a linked list by hand and walk it from the head to the end."""


class Node:
    def __init__(self, value):
        self.value = value
# >>> BLANK id=fresh level=1 hint="一个刚造出来的节点还没有连上任何节点：给它的 next 属性一个表示「什么也没有」的值" hintEn="A node that has just been made is not linked to anything yet: give its next attribute the value that means 'nothing'"
        self.next = None
# <<< BLANK


def length(head):
    count = 0
    current = head
# >>> BLANK id=loop level=2 hint="循环条件：current 还指着一个节点就继续；写成 is not 与 None 的比较，不靠真假值、不用 != || 走过最后一个节点之后，current 会变成最后那个节点的 next" hintEn="The loop condition: carry on while current still refers to a node; write it as an is not comparison with None, not a truthiness test and not != || After the last node, current becomes that last node's next"
    while current is not None:
# <<< BLANK
        count += 1
        current = current.next
    return count


def show(head):
    parts = []
    current = head
    while current is not None:
        parts.append(str(current.value))
        current = current.next
    return " -> ".join(parts)


if __name__ == "__main__":
    a = Node("ant")
    b = Node("bee")
    c = Node("cat")
# >>> BLANK id=link level=2 hint="两行，沿着链条从前往后连：先连第一个到第二个，再连第二个到第三个；每行都是给一个节点的 next 属性赋值 || 三个节点的变量名是 a、b、c；c 是最后一个，它的 next 保持原样" hintEn="Two lines, linking from the front of the chain to the back: first the first node to the second, then the second to the third; each line assigns to one node's next attribute || The three nodes are called a, b and c; c is the last, so its next stays as it is"
    a.next = b
    b.next = c
# <<< BLANK
    head = a
    print(show(head))
    print(length(head))
    print(head.next.value)
    print(c.next)
    print(length(None))
