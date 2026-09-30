"""Preorder, inorder and postorder traversal of a binary search tree, each written recursively."""


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


def preorder(node):
    if node is None:
        return []
    return [node.value] + preorder(node.left) + preorder(node.right)


def inorder(node):
    if node is None:
        return []
# >>> BLANK id=inorder level=2 hint="照 preorder 最后那一行的样子写一个 return：三段列表用 + 连起来，自己的值包成只有一个元素的列表；左子树永远在右子树前面 || 中序：先整棵左子树，再自己，最后整棵右子树——两棵子树都靠再调用 inorder" hintEn="Write one return shaped like the last line of preorder: three lists joined with +, with this node's value wrapped in a one-item list; the left subtree always comes before the right || Inorder: the whole left subtree, then this node, then the whole right subtree - both subtrees come from calling inorder again"
    return inorder(node.left) + [node.value] + inorder(node.right)
# <<< BLANK


def postorder(node):
    if node is None:
        return []
# >>> BLANK id=postorder level=2 hint="同样是三段列表用 + 连成的一个 return，自己的值包成单元素列表，左子树在右子树前面 || 后序：自己排在两棵子树都走完之后——也就是整行的最后一段" hintEn="Again one return made of three lists joined with +, this node's value in a one-item list, left subtree before right || Postorder: this node comes after both subtrees are finished - the very last of the three parts"
    return postorder(node.left) + postorder(node.right) + [node.value]
# <<< BLANK


def traversals(values):
    root = None
    for value in values:
# >>> BLANK id=build level=1 hint="把 value 插进树里：insert 收的是当前的根和这个值，它返回（可能是新的）根，要用 root 接住" hintEn="Put value into the tree: insert takes the current root and the value and returns the (possibly new) root, which root has to catch"
        root = insert(root, value)
# <<< BLANK
    return preorder(root), inorder(root), postorder(root)


if __name__ == "__main__":
    pre, mid, post = traversals([50, 30, 70, 20, 40, 60, 80])
    print("preorder: ", pre)
    print("inorder:  ", mid)
    print("postorder:", post)
    print(traversals([3, 1, 2, 3, 1]))
    print(traversals([1, 2, 3]))
    print(traversals([]))
