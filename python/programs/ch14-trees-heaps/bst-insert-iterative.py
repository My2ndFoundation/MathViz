"""Insert values into a binary search tree with a loop, then read its shape off in preorder."""


class TreeNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None


def insert(root, value):
    parent = None
    node = root
# >>> BLANK id=walk-down level=2 hint="一行 while 头：一直往下走，直到 node 走到空位为止；判断用 is not None，不要只写 while node || 空位就是 None——node 还不是 None，就说明还没走到可以挂新节点的地方" hintEn="One while header: keep walking down until node reaches an empty spot; test with is not None, not just while node || The empty spot is None - as long as node is not None, you have not yet reached a place to hang the new node"
    while node is not None:
# <<< BLANK
        if value == node.value:
            return root
# >>> BLANK id=remember-parent level=2 hint="一行普通赋值，在 node 往下挪之前做：记住现在站着的这个节点 || 等 node 走到 None 时已经回不去了，新节点要挂在谁身上，全靠这一行留下的名字" hintEn="One plain assignment, done before node moves down: remember the node you are standing on now || Once node reaches None there is no way back up; which node the new one hangs from depends entirely on the name this line keeps"
        parent = node
# <<< BLANK
        if value < node.value:
            node = node.left
        else:
            node = node.right
    if parent is None:
        return TreeNode(value)
    if value < parent.value:
# >>> BLANK id=hang-left level=1 hint="一行赋值：造一个装着 value 的新节点，挂到 parent 的左边（看 else 分支里右边那一行）" hintEn="One assignment: make a new node holding value and hang it on the left of parent (compare the line in the else branch)"
        parent.left = TreeNode(value)
# <<< BLANK
    else:
        parent.right = TreeNode(value)
    return root


def preorder(root):
    out = []
    stack = [root]
    while stack:
        node = stack.pop()
        if node is not None:
            out.append(node.value)
            stack.append(node.right)
            stack.append(node.left)
    return out


def build_preorder(values):
    root = None
    for value in values:
        root = insert(root, value)
    return preorder(root)


if __name__ == "__main__":
    print(build_preorder([8, 3, 10, 1, 6, 14, 4, 7, 13]))
    print(build_preorder([3, 8, 10, 1, 6, 14, 4, 7, 13]))
    print(build_preorder([5, 5, 2, 5, 2]))
    print(build_preorder([1, 2, 3, 4]))
    print(build_preorder([]))
