"""Delete values from a binary search tree: a leaf, a node with one child, a node with two."""


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


def delete(node, value):
    if node is None:
        return None
    if value < node.value:
        node.left = delete(node.left, value)
    elif value > node.value:
        node.right = delete(node.right, value)
    else:
        if node.left is None:
# >>> BLANK id=one-child level=2 hint="一行 return：没有左孩子时，这个节点让出位置——交回去顶替它的是哪一个？ || 交回它的右孩子；右孩子也是 None 时（叶子），交回的就是 None，节点就这样消失" hintEn="One return: with no left child this node steps aside - what goes back up to take its place? || Hand back its right child; if that is None too (a leaf), None goes back and the node simply disappears"
            return node.right
# <<< BLANK
        if node.right is None:
            return node.left
        successor = node.right
# >>> BLANK id=leftmost level=2 hint="一行 while 头：只要 successor 还有左孩子就继续；判断用 is not None || 中序后继是右子树里最小的值——从右孩子出发一路向左走到头" hintEn="One while header: carry on as long as successor still has a left child; test with is not None || The inorder successor is the smallest value in the right subtree - start at the right child and keep going left to the end"
        while successor.left is not None:
# <<< BLANK
            successor = successor.left
        node.value = successor.value
# >>> BLANK id=remove-successor level=2 hint="一行赋值，等号左边是 node.right：把后继原来的那个节点从右子树里删掉，再把删完的右子树接回来；要删的值写成后继的值 successor.value，不写 node.value——此刻两者相等，但这一行说的是「删掉后继」 || 右边是对 delete 的递归调用，第一个实参是右子树；后继最多只有一个右孩子，所以这次删除落在前两种简单情形里" hintEn="One assignment with node.right on the left: delete the successor's old node from the right subtree and put the resulting right subtree back; name the value to delete as successor.value, not node.value - they are equal at this point, but this line is about removing the successor || The right-hand side is a recursive call to delete whose first argument is the right subtree; the successor has at most a right child, so this deletion falls into one of the two easy cases"
        node.right = delete(node.right, successor.value)
# <<< BLANK
    return node


def walk(node, pre, mid):
    if node is not None:
        pre.append(node.value)
        walk(node.left, pre, mid)
        mid.append(node.value)
        walk(node.right, pre, mid)


def delete_all(values, deletes):
    root = None
    for value in values:
        root = insert(root, value)
    for value in deletes:
        root = delete(root, value)
    pre, mid = [], []
    walk(root, pre, mid)
    return mid, pre


if __name__ == "__main__":
    values = [50, 30, 70, 20, 40, 60, 80, 10, 65]
    print(delete_all(values, []))
    print(delete_all(values, [10]))
    print(delete_all(values, [20]))
    print(delete_all(values, [60]))
    print(delete_all(values, [50]))
    print(delete_all(values, [99, 50, 50]))
    print(delete_all([7], [7]))
