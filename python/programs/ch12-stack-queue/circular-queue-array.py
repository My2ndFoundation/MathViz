"""A circular queue in a fixed-size array: front and rear wrap round to the start."""


class CircularQueue:
    def __init__(self, capacity):
        self.items = [None] * capacity
        self.capacity = capacity
        self.front = 0
        self.rear = -1
        self.count = 0

    def enqueue(self, item):
# >>> BLANK id=full level=2 hint="一个 if 的头：队列已满就拒绝。只看计数，不去比 front 和 rear；用 ==，计数写在左边 || 满的意思是项数已经等于数组的格数" hintEn="The head of an if: refuse when the queue is full. Look only at the count, not at front and rear; use ==, with the count on the left || Full means the number of items already equals the number of slots in the array"
        if self.count == self.capacity:
# <<< BLANK
            return False
# >>> BLANK id=rear level=2 hint="rear 往后挪一格，走过最后一格就绕回 0：一个表达式先加 1、再对 self.capacity 取余；写成 self.rear = … 的赋值，不用 +=，也不用 if || 加 1 那一步要放在括号里（取余比加法先算），写成 self.rear 在前、1 在后" hintEn="Move rear on one slot, wrapping back to 0 after the last slot: one expression that adds 1 and then takes the remainder by self.capacity; write it as an assignment self.rear = ..., not += and not an if || The add-one step needs brackets round it (remainder binds tighter than addition), with self.rear first and 1 second"
        self.rear = (self.rear + 1) % self.capacity
# <<< BLANK
        self.items[self.rear] = item
        self.count = self.count + 1
        return True

    def dequeue(self):
        if self.count == 0:
            return None
        item = self.items[self.front]
# >>> BLANK id=front level=2 hint="front 往后挪一格、走过最后一格就绕回 0：一个表达式先加 1、再对 self.capacity 取余；写成 self.front = … 的赋值，不用 +=，也不用 if || 与挪 rear 的那一行同一个样子，只是换成 front：加 1 放在括号里，self.front 在前、1 在后" hintEn="Move front on one slot, wrapping back to 0 after the last slot: one expression that adds 1 and then takes the remainder by self.capacity; write it as an assignment self.front = ..., not += and not an if || The same shape as the line that moves rear, with front instead: the add-one in brackets, self.front first and 1 second"
        self.front = (self.front + 1) % self.capacity
# <<< BLANK
        self.count = self.count - 1
        return item


def run_ops(capacity, ops):
    queue = CircularQueue(capacity)
    results = []
    for op in ops:
        if op[0] == "enqueue":
            results.append(queue.enqueue(op[1]))
        else:
            results.append(queue.dequeue())
    return results


if __name__ == "__main__":
    q = CircularQueue(3)
    print(q.enqueue(1), q.enqueue(2), q.enqueue(3), q.enqueue(4))
    print(q.dequeue(), q.dequeue())
    print(q.enqueue(5), q.enqueue(6))
    print(q.items, "front =", q.front, "rear =", q.rear, "count =", q.count)
    print(q.dequeue(), q.dequeue(), q.dequeue(), q.dequeue())
    ops = [("enqueue", 7), ("dequeue",), ("dequeue",), ("enqueue", 8)]
    print(run_ops(1, ops))
