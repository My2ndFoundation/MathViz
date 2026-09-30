"""Insert values into a binary search tree recursively, then read its shape off in preorder."""


class TreeNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None


def insert(node, value):
    if node is None:
# >>> BLANK id=new-leaf level=1 hint="走到了一个空位：就在这里造一个装着 value 的新节点，并把它交回去（交给调用者去挂）" hintEn="You have reached an empty spot: make a new node holding value right here and hand it back (the caller hangs it in place)"
        return TreeNode(value)
# <<< BLANK
    if value < node.value:
# >>> BLANK id=go-left level=2 hint="一行赋值：往左子树里插，再把插完之后的左子树接回 node.left——等号两边都出现 node.left || 右边是对 insert 的递归调用，实参是左子树和 value；看下面 elif 分支里右边那一行是怎么写的" hintEn="One assignment: insert into the left subtree, then put the resulting left subtree back into node.left - node.left appears on both sides of the = || The right-hand side is a recursive call to insert, given the left subtree and value; compare the line in the elif branch below for the right side"
        node.left = insert(node.left, value)
# <<< BLANK
    elif value > node.value:
        node.right = insert(node.right, value)
# >>> BLANK id=same-root level=2 hint="一行 return：三种情况（往左、往右、重复值什么也不做）最后都走到这里；交回的是这棵子树的根 || 这棵子树的根没有变，还是进来时的那个节点" hintEn="One return: all three cases (went left, went right, duplicate so nothing done) end up here; what goes back is the root of this subtree || The root of this subtree has not changed - it is still the node that came in"
    return node
# <<< BLANK


def preorder(node):
    if node is None:
        return []
    return [node.value] + preorder(node.left) + preorder(node.right)


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
