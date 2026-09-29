"""A stack in a fixed-size array with a top pointer, the way exam pseudocode writes it."""


class ArrayStack:
    def __init__(self, capacity):
        self.items = [None] * capacity
        self.capacity = capacity
        self.top = -1

    def is_empty(self):
        return self.top == -1

    def is_full(self):
# >>> BLANK id=full level=2 hint="满了的意思是 top 已经指着数组的最后一格；写成一个 == 比较，== 左边只有 self.top，下标算术全放右边 || 最后一格的下标比容量小 1，容量存在 self.capacity 里" hintEn="Full means top already points at the last slot of the array; write it as one == comparison with only self.top on the left and all the index arithmetic on the right || The last slot's index is one less than the capacity, which is kept in self.capacity"
        return self.top == self.capacity - 1
# <<< BLANK

    def push(self, item):
        if self.is_full():
            print("Stack overflow: cannot push", item)
            return False
# >>> BLANK id=push level=2 hint="两行：先把 top 往上挪一格，再把 item 存进 top 指着的那一格；挪指针写成 self.top = self.top + 1 这种伪代码式的赋值，不用 += || 顺序反过来会把栈顶那一项覆盖掉：新的一格要先腾出来" hintEn="Two lines: first move top up one slot, then store item in the slot top points at; write the pointer move as a pseudocode-style assignment self.top = self.top + 1, not += || The other order would overwrite the current top item: the new slot has to be made first"
        self.top = self.top + 1
        self.items[self.top] = item
# <<< BLANK
        return True

    def pop(self):
        if self.is_empty():
            print("Stack underflow: nothing to pop")
            return None
# >>> BLANK id=pop level=2 hint="两行，与压栈那两行镜像：先把 top 指着的那一项读进变量 item，再把 top 往下挪一格；同样写成 self.top = self.top - 1，不用 -= || 读值要在挪指针之前——挪完之后 top 指着的已经是下面那一项了" hintEn="Two lines that mirror the push: first read the item top points at into a variable item, then move top down one slot; again write self.top = self.top - 1, not -= || Read before moving - after the move, top already points at the item underneath"
        item = self.items[self.top]
        self.top = self.top - 1
# <<< BLANK
        return item


if __name__ == "__main__":
    s = ArrayStack(3)
    for n in [10, 20, 30, 40]:
        s.push(n)
    print(s.items, "top =", s.top)
    print(s.pop())
    print(s.pop())
    print(s.items, "top is now", s.top)
    print(s.pop())
    print(s.pop())
    print(s.is_empty(), s.is_full())
