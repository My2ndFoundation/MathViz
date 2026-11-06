"""A first-in, first-out queue built from two last-in, first-out stacks."""


class TwoStackQueue:
    def __init__(self):
        self.inbox = []
        self.outbox = []

    def enqueue(self, item):
        self.inbox.append(item)

    def dequeue(self):
        if not self.outbox:
# >>> BLANK id=pour-all level=2 hint="一个 while 的头：只要 inbox 里还有东西就接着倒——直接拿 self.inbox 本身当条件，不加括号，不用 len()，也不和 [] 比 || 要倒就倒干净：一项一项地倒，直到 inbox 空了为止，最早入队的那一项才会落到 outbox 的顶上" hintEn="The head of a while: keep pouring as long as inbox still holds something - use self.inbox itself as the condition, with no brackets, without len() and without comparing with [] || Pour it all: one item at a time until inbox is empty, and only then is the item that joined first on top of outbox"
            while self.inbox:
# <<< BLANK
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
