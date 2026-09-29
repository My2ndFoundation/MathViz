"""A stack built from linked nodes: the head of the list is the top of the stack."""


class Node:
    def __init__(self, value, next_node=None):
        self.value = value
        self.next = next_node


class LinkedStack:
    def __init__(self):
        self.top = None

    def is_empty(self):
        return self.top is None

    def push(self, value):
# >>> BLANK id=push level=2 hint="一行：造一个新节点、让它压在原来的栈顶上面，再把它当成新的栈顶；不先存进别的变量，实参按位置传、不写关键字 || Node 的第二个实参就是它下面那个节点" hintEn="One line: make a new node sitting on top of the old top and make it the new top; do not store it in another variable first, and pass the arguments by position, not by keyword || Node's second argument is the node underneath it"
        self.top = Node(value, self.top)
# <<< BLANK

    def pop(self):
        if self.is_empty():
            return None
# >>> BLANK id=take level=2 hint="两行，顺序要紧：先把栈顶节点的值取出来存进 value，再让栈顶往下挪一个节点——反过来取到的就是下面那一个的值 || 第二行是给 self.top 赋值" hintEn="Two lines, and the order matters: first take the top node's value into value, then move the top down one node - the other way round you get the value of the node underneath || The second line assigns to self.top"
        value = self.top.value
        self.top = self.top.next
# <<< BLANK
        return value

    def peek(self):
        if self.is_empty():
            return None
        return self.top.value


def run_ops(ops):
    stack = LinkedStack()
    results = []
    for op in ops:
        if op[0] == "push":
            stack.push(op[1])
        elif op[0] == "pop":
            results.append(stack.pop())
        else:
            results.append(stack.peek())
    return results


if __name__ == "__main__":
    words = LinkedStack()
    for word in ["to", "be", "or"]:
        words.push(word)
    while not words.is_empty():
        print(words.pop())
    ops = [("push", 1), ("push", 2), ("peek",), ("pop",)]
    ops += [("push", 3), ("pop",), ("pop",), ("pop",)]
    print(run_ops(ops))
