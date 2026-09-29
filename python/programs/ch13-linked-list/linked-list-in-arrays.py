"""A linked list kept in two parallel arrays, the way exam pseudocode writes it."""

NULL = -1
SIZE = 5

data = [""] * SIZE
next_ptr = [1, 2, 3, 4, NULL]
start = NULL
free = 0


def insert(item):
    global start, free
    if free == NULL:
        print("List full, cannot add", item)
        return
# >>> BLANK id=take-free level=2 hint="两行，从空闲链的最前面取一个格子：先把这个格子的下标记进 new，再让 free 往后挪到空闲链的下一个格子，查表的下标写 free 自己——反过来就取错格子了 || 第二行等号右边查的是 next_ptr 数组" hintEn="Two lines, taking a cell from the front of the free list: first record that cell's index in new, then move free on to the next cell of the free list, looking it up with free itself as the index - the other way round you take the wrong cell || The right-hand side of the second line looks something up in the next_ptr array"
    new = free
    free = next_ptr[free]
# <<< BLANK
    data[new] = item
    prev = NULL
    current = start
    while current != NULL and data[current] < item:
        prev = current
        current = next_ptr[current]
# >>> BLANK id=link-after level=2 hint="新格子的指针先指向它应该排在前面的那个格子——循环停下时 current 停在的地方 || 左边是 next_ptr 数组里新格子那一项" hintEn="The new cell's pointer first points at the cell it belongs in front of - wherever current stopped when the loop ended || The left-hand side is the new cell's entry in the next_ptr array"
    next_ptr[new] = current
# <<< BLANK
    if prev == NULL:
        start = new
    else:
# >>> BLANK id=link-before level=2 hint="新格子不在最前面时，让它前面那个格子的指针改指向新格子 || 前面那个格子的下标存在 prev 里" hintEn="When the new cell is not at the front, make the pointer of the cell before it point at the new cell instead || The index of the cell before it is held in prev"
        next_ptr[prev] = new
# <<< BLANK


def output_list():
    items = []
    current = start
    while current != NULL:
        items.append(data[current])
        current = next_ptr[current]
    print(" -> ".join(items))


if __name__ == "__main__":
    for word in ["pear", "apple", "plum", "fig"]:
        insert(word)
    output_list()
    print("start =", start, "free =", free)
    print(data)
    print(next_ptr)
    insert("kiwi")
    insert("lime")
    output_list()
