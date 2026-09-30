"""A first-in, first-out queue built from two last-in, first-out stacks."""


class TwoStackQueue:
    def __init__(self):
        self.inbox = []
        self.outbox = []

    def enqueue(self, item):
        self.inbox.append(item)

    def dequeue(self):
# >>> BLANK id=only-when-empty level=2 hint="一个 if 的头：只有 outbox 已经空了，才把 inbox 倒过去——直接对 self.outbox 用 not 判空，不用 len()，也不和 [] 比 || outbox 里还有东西时绝不能倒：那些是更早入队的，得先出去" hintEn="The head of an if: pour inbox across only when outbox is already empty - put not straight in front of self.outbox, without len() and without comparing with [] || Never pour while outbox still holds something: those items joined earlier and must leave first"
        if not self.outbox:
# <<< BLANK
            while self.inbox:
# >>> BLANK id=pour level=2 hint="一行：从 inbox 顶上弹出一项，直接压到 outbox 上——弹出的调用写在压栈调用的括号里 || 两个都是列表的栈方法：弹出用 pop，压栈用 append" hintEn="One line: pop an item off the top of inbox and push it straight onto outbox - the pop call goes inside the brackets of the push call || Both are the list's stack methods: pop to take off, append to put on"
                self.outbox.append(self.inbox.pop())
# <<< BLANK
        if not self.outbox:
            return None
# >>> BLANK id=take level=1 hint="从 outbox 的顶上弹出一项交回去——倒过来之后，最早入队的那一项正在顶上；pop 不带实参" hintEn="Pop an item off the top of outbox and return it - after the pour, the item that joined first is on top; pop with no argument"
        return self.outbox.pop()
# <<< BLANK


def run_ops(ops):
    queue = TwoStackQueue()
    results = []
    for op in ops:
        if op[0] == "enqueue":
            queue.enqueue(op[1])
        else:
            results.append(queue.dequeue())
    return results


if __name__ == "__main__":
    q = TwoStackQueue()
    for n in [1, 2, 3]:
        q.enqueue(n)
    print(q.dequeue(), q.inbox, q.outbox)
    q.enqueue(4)
    print(q.dequeue(), q.inbox, q.outbox)
    print(q.dequeue(), q.dequeue(), q.dequeue())
    print(run_ops([("enqueue", "a"), ("dequeue",), ("enqueue", "b"), ("dequeue",), ("dequeue",)]))
