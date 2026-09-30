"""A priority queue on a plain list: every serve scans the whole list for the smallest priority."""


class PriorityQueue:
    def __init__(self):
        self.items = []

    def add(self, priority, task):
        self.items.append((priority, task))

    def serve(self):
        if not self.items:
            return None
        best = 0
        for i in range(1, len(self.items)):
# >>> BLANK id=better level=2 hint="一行 if 头：第 i 项的优先级比目前最好的那一项更小吗？优先级是元组的第 0 项；第 i 项写在比较号左边，用严格的小于号 || 严格小于才换：优先级相等时留住排在前面、先进来的那一个——先来先服务就靠这个" hintEn="One if header: is the priority of item i smaller than that of the best item so far? The priority is item 0 of the tuple; item i goes on the left of the comparison, with a strict less-than || Only a strictly smaller one replaces it: on a tie the earlier arrival, further forward in the list, is kept - that is what makes it first come, first served"
            if self.items[i][0] < self.items[best][0]:
# <<< BLANK
# >>> BLANK id=remember-best level=1 hint="一行赋值：记下这个更好的位置（存的是下标，不是元组）" hintEn="One assignment: remember this better position (store the index, not the tuple)"
                best = i
# <<< BLANK
# >>> BLANK id=take-best level=2 hint="一行：把 best 那一项从列表里取出来，当场解包给 priority 和 task 两个名字（顺序与 add 里存进去时相同；用不到的也写出名字，不用 _） || 取出用的是列表自己的 pop 方法，实参是要取的那个下标" hintEn="One line: take the item at best out of the list and unpack it straight into the two names priority and task (in the order add stored it; name even the one you do not use - no _) || Taking it out is done with the list's own pop method, given the index to take"
        priority, task = self.items.pop(best)
# <<< BLANK
        return task


def run_ops(ops):
    queue = PriorityQueue()
    served = []
    for op in ops:
        if op[0] == "add":
            queue.add(op[1], op[2])
        else:
            served.append(queue.serve())
    return served


if __name__ == "__main__":
    queue = PriorityQueue()
    queue.add(2, "email Sam")
    queue.add(1, "fix the bug")
    queue.add(2, "book a room")
    queue.add(1, "call Mia")
    for _ in range(5):
        print(queue.serve())
    print(run_ops([("add", 3, "c"), ("add", 3, "a"), ("serve",), ("serve",), ("serve",)]))
