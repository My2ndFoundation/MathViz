"""A min-heap written by hand in a list: push sifts the new item up, pop sifts the last item down."""


def push(heap, item):
    heap.append(item)
    i = len(heap) - 1
    while i > 0:
# >>> BLANK id=parent level=2 hint="一行赋值：算出下标 i 的父节点下标，存进 parent；用整除，i 写在括号里 || 孩子在 2p + 1 与 2p + 2，反过来：先减 1，再整除 2" hintEn="One assignment: work out the index of i's parent and store it in parent; use floor division, with i inside brackets || Children sit at 2p + 1 and 2p + 2; going back the other way: subtract 1 first, then floor-divide by 2"
        parent = (i - 1) // 2
# <<< BLANK
        if heap[i] >= heap[parent]:
            break
# >>> BLANK id=swap-up level=2 hint="一行同时赋值，交换两格：等号左边先写 heap[i]、再写 heap[parent] || 右边是同样两格，顺序反过来" hintEn="One simultaneous assignment that swaps two cells: on the left of the =, heap[i] first and then heap[parent] || The right-hand side is the same two cells in the opposite order"
        heap[i], heap[parent] = heap[parent], heap[i]
# <<< BLANK
        i = parent


def sift_down(heap, i):
    while 2 * i + 1 < len(heap):
# >>> BLANK id=left-child level=1 hint="一行赋值：把左孩子的下标存进 child；式子和上面 while 条件里的那个一模一样（2 写在 i 前面）" hintEn="One assignment: store the left child's index in child; the expression is exactly the one in the while condition above (2 before i)"
        child = 2 * i + 1
# <<< BLANK
        if child + 1 < len(heap) and heap[child + 1] < heap[child]:
            child = child + 1
        if heap[i] <= heap[child]:
            return
        heap[i], heap[child] = heap[child], heap[i]
        i = child


def pop(heap):
    if not heap:
        return None
    smallest = heap[0]
    last = heap.pop()
    if heap:
        heap[0] = last
        sift_down(heap, 0)
    return smallest


def run_ops(ops):
    heap = []
    popped = []
    for op in ops:
        if op[0] == "push":
            push(heap, op[1])
        else:
            popped.append(pop(heap))
    return popped


if __name__ == "__main__":
    heap = []
    for item in [5, 3, 8, 1, 9, 2]:
        push(heap, item)
        print(heap)
    while heap:
        print(pop(heap), heap)
    print(pop(heap))
    print(run_ops([("push", 4), ("push", 4), ("pop",), ("push", 1), ("pop",), ("pop",), ("pop",)]))
