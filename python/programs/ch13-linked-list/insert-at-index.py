"""Insert a value at position i of a singly linked list."""


class Node:
    def __init__(self, value):
        self.value = value
        self.next = None


def insert_at(head, i, value):
    new = Node(value)
    if i == 0 or head is None:
# >>> BLANK id=front level=2 hint="两行：新节点排到原来的第一个节点前面——先让新节点接上原来的头，再把新节点交回去 || 调用者会拿返回值当新的 head；变量名是 new 与 head" hintEn="Two lines: the new node goes in front of the old first node - first link the new node to the old head, then hand the new node back || The caller uses the return value as the new head; the names are new and head"
        new.next = head
        return new
# <<< BLANK
    prev = head
    for _ in range(i - 1):
        if prev.next is None:
            break
        prev = prev.next
# >>> BLANK id=splice level=2 hint="两行，顺序就是要点：先接后面，再接前面。先让新节点接上 prev 原来的后继；然后才让 prev 指向新节点——反过来做，prev 原来的后继就再也找不到了 || 每行都是给一个 next 属性赋值：第一行改的是 new 的，第二行改的是 prev 的" hintEn="Two lines, and the order is the point: link the back first, then the front. First make the new node point at prev's old successor; only then make prev point at the new node - the other way round, prev's old successor is lost for good || Each line assigns to a next attribute: the first changes new's, the second changes prev's"
    new.next = prev.next
    prev.next = new
# <<< BLANK
    return head


def to_list(head):
    values = []
    current = head
    while current is not None:
        values.append(current.value)
        current = current.next
    return values


def apply_inserts(ops):
    head = None
    for i, value in ops:
        head = insert_at(head, i, value)
    return to_list(head)


if __name__ == "__main__":
    print(apply_inserts([(0, "b"), (0, "a"), (2, "d"), (2, "c")]))
    print(apply_inserts([(0, "x"), (7, "y")]))
    print(apply_inserts([]))
