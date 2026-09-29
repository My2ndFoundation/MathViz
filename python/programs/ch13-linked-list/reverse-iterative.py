"""Reverse a singly linked list in place by turning every pointer round."""


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
    prev = None
    current = head
    while current is not None:
# >>> BLANK id=turn level=2 hint="两行：先把 current 原来的后继存进一个叫 next_node 的变量，再把 current 的 next 掉头指向 prev——顺序反了，后面那半条链就丢了 || 第一行是新变量的赋值，第二行是给 current 的 next 属性赋值" hintEn="Two lines: first save current's old successor in a variable called next_node, then turn current's next round to point at prev - the other way round, the rest of the chain is lost || The first line assigns the new variable, the second assigns to current's next attribute"
        next_node = current.next
        current.next = prev
# <<< BLANK
# >>> BLANK id=step level=2 hint="两行，三个指针一起往前挪一格：先让 prev 挪到 current，再让 current 挪到刚才存下的那个节点 || 第二行等号右边是上面存下后继的那个变量" hintEn="Two lines, moving the pointers one place along together: first prev moves to current, then current moves to the node saved a moment ago || The right-hand side of the second line is the variable that saved the successor above"
        prev = current
        current = next_node
# <<< BLANK
# >>> BLANK id=result level=2 hint="循环结束时 current 已经走出了链尾；原来的最后一个节点现在是新的头，哪个指针停在它身上？ || 交回的不是 current，也不是 head" hintEn="When the loop ends, current has run off the end; the old last node is now the new head - which pointer is resting on it? || It is not current, and not head"
    return prev
# <<< BLANK


def reversed_values(values):
    return to_list(reverse(build(values)))


if __name__ == "__main__":
    head = build(["a", "b", "c", "d"])
    print(to_list(head))
    head = reverse(head)
    print(to_list(head))
    print(reversed_values([1]))
    print(reversed_values([]))
