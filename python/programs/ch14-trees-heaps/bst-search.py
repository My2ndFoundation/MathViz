"""Search a binary search tree with a loop, throwing away one subtree at every step."""


class TreeNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None


def insert(node, value):
    if node is None:
        return TreeNode(value)
    if value < node.value:
        node.left = insert(node.left, value)
    elif value > node.value:
        node.right = insert(node.right, value)
    return node


def contains(root, target):
    node = root
    while node is not None:
        if target == node.value:
            return True
# >>> BLANK id=which-side level=2 hint="一行 if 头（写 if，不写 elif：上面找到时已经 return 了）：判断该往哪边走；target 写在比较号左边，用严格的小于号 || 比这个节点小的值只可能在它的左子树里——条件成立时，下一行就往左走" hintEn="One if header (if, not elif: the lines above have already returned when it was found) deciding which way to go: target on the left of the comparison, with a strict less-than || A value smaller than this node can only be in its left subtree - when the condition holds, the next line goes left"
        if target < node.value:
# <<< BLANK
            node = node.left
        else:
# >>> BLANK id=go-right level=1 hint="一行赋值：往右走一步，node 换成它自己的右孩子" hintEn="One assignment: take one step right - node becomes its own right child"
            node = node.right
# <<< BLANK
# >>> BLANK id=not-found level=1 hint="循环结束说明 node 走到了 None：没有地方可找了，交回一个布尔值" hintEn="The loop ending means node reached None: there is nowhere left to look, so hand back a Boolean"
    return False
# <<< BLANK


def bst_contains(values, queries):
    root = None
    for value in values:
        root = insert(root, value)
    return [contains(root, query) for query in queries]


if __name__ == "__main__":
    values = [50, 30, 70, 20, 40, 60, 80]
    queries = [60, 65, 20, 50, 85, 5]
    for query, found in zip(queries, bst_contains(values, queries)):
        print(query, found)
    print(bst_contains([], [1]))
    print(bst_contains([1, 2, 3, 4, 5], [5, 6]))
