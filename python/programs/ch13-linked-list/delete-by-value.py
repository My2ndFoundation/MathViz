"""Delete the first node holding a given value from a singly linked list."""


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


def delete_value(head, target):
    prev = None
    current = head
    while current is not None:
        if current.value == target:
# >>> BLANK id=at-head level=2 hint="要问的是「current 前面还没有节点吗」：拿 prev 与 None 做 is 比较，不写 current is head，也不靠真假值 || 成立时要删的就是头节点，下一行把它后面那个节点交回去当新的头" hintEn="The question is 'is there no node before current yet?': compare prev with None using is - not current is head, and not a truthiness test || When it holds, the node to delete is the head, and the next line hands back the node after it as the new head"
            if prev is None:
# <<< BLANK
                return current.next
# >>> BLANK id=bypass level=1 hint="让 prev 跳过 current、直接指向 current 后面的节点；等号右边从 current 出发写，不写 prev.next.next" hintEn="Make prev skip over current and point straight at the node after it; start the right-hand side from current, not prev.next.next"
            prev.next = current.next
# <<< BLANK
            return head
# >>> BLANK id=follow level=1 hint="current 马上就要往前走一步，在那之前先为下一轮把「身后那个节点」记下来——想一想：等 current 到了下一个节点，prev 应该指着哪一个？" hintEn="current is about to move one step on; before it does, record the node that will be behind it next time round - ask yourself: once current reaches the next node, which node should prev refer to?"
        prev = current
# <<< BLANK
        current = current.next
    return head


def remove_first(values, target):
    return to_list(delete_value(build(values), target))


if __name__ == "__main__":
    print(remove_first([3, 1, 4, 1, 5], 1))
    print(remove_first([3, 1, 4, 1, 5], 3))
    print(remove_first([3, 1, 4, 1, 5], 9))
    print(remove_first([7], 7))
    print(remove_first([], 7))
