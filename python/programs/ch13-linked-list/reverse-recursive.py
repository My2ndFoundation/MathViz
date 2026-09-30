"""Reverse a singly linked list recursively: reverse the rest, then hang the head on the end."""


class Node:
    def __init__(self, value, next_node=None):
        self.value = value
        self.next = next_node


def build(values):
    head = None
    for value in reversed(values):
        head = Node(value, head)
    return head


def to_list(head):
    values = []
    current = head
    while current is not None:
        values.append(current.value)
        current = current.next
    return values


def reverse(head):
    if head is None or head.next is None:
        return head
# >>> BLANK id=rest level=2 hint="把 head 后面的那一整段交给 reverse 自己去反转，把它交回的新头存进一个叫 new_head 的变量 || 实参是 head 的下一个节点" hintEn="Hand the whole stretch after head to reverse itself, and store the new head it gives back in a variable called new_head || The argument is the node after head"
    new_head = reverse(head.next)
# <<< BLANK
# >>> BLANK id=flip level=3 hint="两行，顺序要紧：先让原来 head 后面那个节点回头指向 head，再切断 head 往后的指针——反过来，head.next 已经没了，就找不到那个节点了 || 反转之后，原来 head 后面那个节点正好是那一段的最后一个节点，head 要挂在它后面 || 第一行要从 head 出发走两步，才到它要改的那个属性；第二行改的是 head 自己往后的指针" hintEn="Two lines, and the order matters: first make the node that used to follow head point back at head, then cut head's forward pointer - the other way round, head.next is already gone and that node cannot be found || After the reversal, the node that used to follow head is exactly the last node of that stretch, and head is hung on after it || The first line reaches the attribute it changes by going two steps from head; the second changes head's own forward pointer"
    head.next.next = head
    head.next = None
# <<< BLANK
    return new_head


def reversed_values(values):
    return to_list(reverse(build(values)))


if __name__ == "__main__":
    head = build(["a", "b", "c", "d"])
    print(to_list(head))
    head = reverse(head)
    print(to_list(head))
    print(reversed_values([1]))
    print(reversed_values([]))
