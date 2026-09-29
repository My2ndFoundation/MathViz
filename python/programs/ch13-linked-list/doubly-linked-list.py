"""A doubly linked list: every node points both ways, so it can be walked backwards too."""


class Node:
    def __init__(self, value):
        self.value = value
        self.prev = None
        self.next = None


class DoublyLinkedList:
    def __init__(self):
        self.sentinel = Node(None)
        self.sentinel.prev = self.sentinel
        self.sentinel.next = self.sentinel

    def insert(self, i, value):
        after = self.sentinel.next
        while i > 0 and after is not self.sentinel:
            after = after.next
            i -= 1
        before = after.prev
        new = Node(value)
# >>> BLANK id=new-links level=1 hint="两行，先连新节点自己的两根指针，一根往前、一根往后：先写往前指的那根，再写往后指的那根" hintEn="Two lines, first the new node's own two pointers, one backwards and one forwards: the backward one first, then the forward one"
        new.prev = before
        new.next = after
# <<< BLANK
# >>> BLANK id=neighbour-links level=2 hint="两行，再让两个邻居都认新节点：先改 before 往后指的那根，再改 after 往前指的那根 || before 与 after 都已经存在变量里，所以这四根指针改的先后不会弄丢任何节点" hintEn="Two lines, then make both neighbours take the new node: first before's forward pointer, then after's backward pointer || before and after are both held in variables already, so no order of these four pointer changes can lose a node"
        before.next = new
        after.prev = new
# <<< BLANK

    def remove(self, value):
        node = self.sentinel.next
        while node is not self.sentinel:
            if node.value == value:
# >>> BLANK id=unlink level=2 hint="两行，让 node 前后两个邻居绕过它、互相指着：先改前一个节点往后指的那根，再改后一个节点往前指的那根 || 两个邻居都从 node 出发找：node 的 prev 与 node 的 next" hintEn="Two lines, making the neighbours on either side of node skip it and point at each other: first the node before's forward pointer, then the node after's backward pointer || Reach both neighbours from node: node's prev and node's next"
                node.prev.next = node.next
                node.next.prev = node.prev
# <<< BLANK
                return
            node = node.next

    def walk(self, forwards):
        values = []
        node = self.sentinel.next if forwards else self.sentinel.prev
        while node is not self.sentinel:
            values.append(node.value)
            node = node.next if forwards else node.prev
        return values


def run_ops(ops):
    dll = DoublyLinkedList()
    for op in ops:
        if op[0] == "insert":
            dll.insert(op[1], op[2])
        else:
            dll.remove(op[1])
    return dll.walk(True), dll.walk(False)


if __name__ == "__main__":
    ops = [("insert", 0, "b"), ("insert", 0, "a"), ("insert", 9, "d"), ("insert", 2, "c")]
    print(run_ops(ops))
    print(run_ops(ops + [("remove", "b"), ("remove", "x")]))
    print(run_ops([]))
