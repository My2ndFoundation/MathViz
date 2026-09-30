"""A priority queue on heapq: (priority, seq, task) tuples keep equal priorities first come, first served."""
import heapq


class PriorityQueue:
    def __init__(self):
        self.heap = []
        self.count = 0

    def add(self, priority, task):
# >>> BLANK id=push-entry level=2 hint="一行：用 heapq 模块的函数把一个三元组压进 self.heap；元组的顺序是要点，先比的放前面 || 三元组依次是：优先级、这是第几个进来的（self.count）、任务本身" hintEn="One line: use the heapq module's function to push a three-item tuple onto self.heap; the order inside the tuple is the point - what is compared first goes first || The tuple holds, in order: the priority, which arrival this is (self.count), and the task itself"
        heapq.heappush(self.heap, (priority, self.count, task))
# <<< BLANK
# >>> BLANK id=next-seq level=1 hint="一行：计数器加 1，留给下一个进来的任务；用 += 写" hintEn="One line: add 1 to the counter, ready for the next task to arrive; write it with +="
        self.count += 1
# <<< BLANK

    def serve(self):
        if not self.heap:
            return None
# >>> BLANK id=pop-entry level=2 hint="一行：从 self.heap 弹出最小的那个元组，当场解包给 priority、seq、task 三个名字（顺序与压进去时相同；用不到的也写出名字，不用 _） || 弹出用的是 heapq 模块里与 heappush 配对的那个函数，实参只有 self.heap" hintEn="One line: pop the smallest tuple off self.heap and unpack it straight into the three names priority, seq and task (in the order it was pushed; name even the ones you do not use - no _) || The popping is done by the heapq function that pairs with heappush, given only self.heap"
        priority, seq, task = heapq.heappop(self.heap)
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
    try:
        heapq.heapify([(1, {"job": "a"}), (1, {"job": "b"})])
    except TypeError as e:
        print(type(e).__name__)
    print(run_ops([("add", 3, "c"), ("add", 3, "a"), ("serve",), ("serve",), ("serve",)]))
