"""Getting item i of a linked list means walking there; a Python list jumps straight to it."""


class Node:
    def __init__(self, value, next_node=None):
        self.value = value
        self.next = next_node


def build(values):
    head = None
    for value in reversed(values):
        head = Node(value, head)
    return head


def get_at(head, i):
    steps = 0
    current = head
    while steps < i:
# >>> BLANK id=walk level=1 hint="两行：current 往前走一个节点，再把步数加 1——加 1 用 +=" hintEn="Two lines: current moves on one node, then the step count goes up by 1 - use += for that"
        current = current.next
        steps += 1
# <<< BLANK
    return current.value, steps


def push_front(head, value):
# >>> BLANK id=new-head level=2 hint="一行：造一个新节点，让它指向原来的头，并把它直接交回去当新的头；不先存进变量，实参按位置传、不写关键字 || Node 的第二个实参是它后面的那个节点" hintEn="One line: make a new node pointing at the old head and hand it straight back as the new head; do not store it in a variable first, and pass the arguments by position, not by keyword || Node's second argument is the node after it"
    return Node(value, head)
# <<< BLANK


if __name__ == "__main__":
    letters = ["a", "b", "c", "d", "e", "f"]
    head = build(letters)
    value, steps = get_at(head, 4)
    print("linked list, item 4:", value, "after", steps, "steps")
    print("python list, item 4:", letters[4], "in one step")
    head = push_front(head, "z")
    print("new head:", head.value, "- no other node moved")
    letters.insert(0, "z")
    print("list.insert(0, ...) shifted", len(letters) - 1, "items along")
    print(get_at(head, 0))
