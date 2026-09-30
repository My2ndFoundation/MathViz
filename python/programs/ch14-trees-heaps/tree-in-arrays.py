"""A binary search tree kept in three parallel arrays, the way exam pseudocode stores it."""

NULL = -1
value = []
left = []
right = []


def insert(item):
    value.append(item)
    left.append(NULL)
    right.append(NULL)
    new = len(value) - 1
    if new == 0:
        return
    current = 0
    while True:
        if item < value[current]:
            if left[current] == NULL:
# >>> BLANK id=link-left level=2 hint="一行赋值：左指针还是空的，就让它指向新节点——数组里存的是下标，不是值；新节点的下标上面已经算好、存在一个名字里，直接用它 || 左指针都存在 left 数组里，这一行改的是当前节点的那一格" hintEn="One assignment: the left pointer is still empty, so point it at the new node - the arrays store indexes, not values; the new node's index was worked out above and kept in a name, so use that name || The left pointers all live in the left array; this line changes the current node's cell"
                left[current] = new
# <<< BLANK
                return
# >>> BLANK id=follow-left level=2 hint="一行赋值：左边已经有节点了，就顺着左指针走过去——current 换成下一个节点的下标 || 下一个节点的下标，就是当前节点的左指针" hintEn="One assignment: there is already a node on the left, so follow the left pointer - current becomes the next node's index || The next node's index is simply the current node's left pointer"
            current = left[current]
# <<< BLANK
        else:
            if right[current] == NULL:
                right[current] = new
                return
            current = right[current]


def in_order(node):
    if node == NULL:
        return []
    return in_order(left[node]) + [value[node]] + in_order(right[node])


if __name__ == "__main__":
    for name in ["Mia", "Dev", "Sam", "Ali", "Kai", "Zoe", "Ben"]:
        insert(name)
    print("index value left right")
    for i in range(len(value)):
# >>> BLANK id=table-row level=1 hint="一行 print：按表头的顺序打出第 i 行的四样东西——下标本身，再是三个数组各自在 i 那一格的内容；用逗号分隔的多个实参，不用 f-string" hintEn="One print: the four things in row i in the order of the heading - the index itself, then what each of the three arrays holds at i; several arguments separated by commas, not an f-string"
        print(i, value[i], left[i], right[i])
# <<< BLANK
    print(" ".join(in_order(0)))
