"""Preorder, inorder and postorder traversal of a binary search tree, each with an explicit stack."""


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


def preorder(root):
    out = []
    stack = [root]
    while stack:
        node = stack.pop()
        if node is not None:
            out.append(node.value)
# >>> BLANK id=push-children level=2 hint="两行 append，每行把一个孩子压进 stack（孩子是 None 也照压，弹出来时上面那个 if 会跳过它）；两行的先后顺序就是这一空的要点 || 栈是后进先出：想让左孩子先被弹出来访问，它就得后压——先压右孩子，再压左孩子" hintEn="Two append lines, each pushing one child onto stack (push it even if it is None - the if above skips it when it is popped); the order of the two lines is the whole point || A stack is last in, first out: for the left child to be popped and visited first it has to go on last - push the right child, then the left"
            stack.append(node.right)
            stack.append(node.left)
# <<< BLANK
    return out


def inorder(root):
    out = []
    stack = []
    node = root
    while stack or node is not None:
        while node is not None:
# >>> BLANK id=go-left level=2 hint="两行：先把 node 本身压进 stack，再让 node 走到它的左孩子；用 append 与普通赋值 || 一路向左：沿途每个节点都先压栈记下来，等左边走到头再一个个弹出来访问" hintEn="Two lines: push node itself onto stack, then move node to its left child; use append and a plain assignment || Keep going left: every node on the way is pushed to be remembered, and only when the left runs out are they popped one by one and visited"
            stack.append(node)
            node = node.left
# <<< BLANK
        node = stack.pop()
        out.append(node.value)
        node = node.right
    return out


def postorder(root):
    first = [root]
    second = []
    while first:
        node = first.pop()
        if node is not None:
            second.append(node.value)
            first.append(node.left)
            first.append(node.right)
# >>> BLANK id=read-second level=2 hint="一个 return：把 second 从栈顶读到栈底交回去——用切片写，不调用 reversed 之类的函数 || second 里攒下的是「自己、右、左」的顺序，倒过来正好是「左、右、自己」" hintEn="One return: hand back second read from its top down to its bottom - write it as a slice, not with a function such as reversed || second has collected the order self, right, left; reversed, that is exactly left, right, self"
    return second[::-1]
# <<< BLANK


def traversals(values):
    root = None
    for value in values:
        root = insert(root, value)
    return preorder(root), inorder(root), postorder(root)


if __name__ == "__main__":
    pre, mid, post = traversals([50, 30, 70, 20, 40, 60, 80])
    print("preorder: ", pre)
    print("inorder:  ", mid)
    print("postorder:", post)
    print(traversals([3, 1, 2, 3, 1]))
    print(traversals([1, 2, 3]))
    print(traversals([]))
