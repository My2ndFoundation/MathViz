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
    while current is not None:
        count += 1
        current = current.next
    return count


def show(head):
    parts = []
    current = head
    while current is not None:
# >>> BLANK id=collect level=2 hint="一行：把当前节点的值变成字符串，追加到 parts 的末尾——用内置的 str() 转换（不用 f-string），用列表方法 append（不用 +=） || 值在 current 的 value 属性里；后面的 join 只接受字符串，所以要先转" hintEn="One line: turn the current node's value into a string and add it to the end of parts - convert with the built-in str() (not an f-string) and add with the list method append (not +=) || The value is in current's value attribute; the join further down accepts only strings, so convert it first"
        parts.append(str(current.value))
# <<< BLANK
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
