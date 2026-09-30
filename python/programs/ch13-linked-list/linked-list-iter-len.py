"""Make a linked list behave like a built-in container with __iter__, __len__ and __repr__."""


class Node:
    def __init__(self, value, next_node=None):
        self.value = value
        self.next = next_node


class LinkedList:
    def __init__(self, values=()):
        self.head = None
        self.count = 0
        for value in reversed(list(values)):
            self.push_front(value)

    def push_front(self, value):
        self.head = Node(value, self.head)
        self.count += 1

    def __iter__(self):
        current = self.head
        while current is not None:
# >>> BLANK id=hand-out level=2 hint="两行：先把当前节点的值交出去（这一行让函数停在这里等下一次要值，不是 return），再让 current 往前走一步 || 第一行以 yield 开头" hintEn="Two lines: first hand out the current node's value (this line pauses the function until the next value is asked for - it is not return), then move current one step on || The first line starts with yield"
            yield current.value
            current = current.next
# <<< BLANK

    def __len__(self):
# >>> BLANK id=size level=1 hint="直接交回一路记着的计数器属性，不再把链表走一遍" hintEn="Hand back the counter attribute that has been kept up to date all along, without walking the list again"
        return self.count
# <<< BLANK

    def __repr__(self):
        return "LinkedList(" + repr(list(self)) + ")"


if __name__ == "__main__":
    shopping = LinkedList(["eggs", "milk", "tea"])
    print(len(shopping))
    for item in shopping:
        print(item)
    print(list(shopping))
    print("milk" in shopping)
    shopping.push_front("jam")
    print(shopping)
    walker = iter(shopping)
    print(next(walker), next(walker))
