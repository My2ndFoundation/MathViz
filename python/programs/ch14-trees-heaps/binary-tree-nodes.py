"""A binary tree built by hand, with its size and height worked out recursively."""


class TreeNode:
    def __init__(self, value, left=None, right=None):
        self.value = value
# >>> BLANK id=children level=1 hint="两行：把两个孩子参数原样存成同名的属性，先 left 后 right；没传的孩子就是默认的 None，不用另外判断" hintEn="Two lines: store the two child parameters as attributes with the same names, left first and then right; a child that was not passed is the default None, so there is nothing to check"
        self.left = left
        self.right = right
# <<< BLANK


def count_nodes(node):
    if node is None:
        return 0
# >>> BLANK id=count level=2 hint="一个 return，三项用 + 连起来：左子树的节点数在前、右子树的在后，自己这一个 1 写在最后 || 两棵子树各有多少个节点，都是再调用 count_nodes 得来的，实参是这个节点的两个孩子" hintEn="One return with three terms joined by +: the left subtree's count first, the right subtree's next, and the 1 for this node last || How many nodes each subtree has comes from calling count_nodes again, given this node's two children"
    return count_nodes(node.left) + count_nodes(node.right) + 1
# <<< BLANK


def height(node):
    if node is None:
        return 0
# >>> BLANK id=height level=2 hint="一个 return：用内置 max 取两棵子树里更高的那个（左子树写在前），再在 max(...) 后面 + 1 || 两棵子树的高度也是再调用 height 得来的；加的那个 1 是这个节点自己占的一层" hintEn="One return: use the built-in max to pick the taller of the two subtrees (left one first), then + 1 after the max(...) || The height of each subtree comes from calling height again; the 1 you add is the level this node itself takes up"
    return max(height(node.left), height(node.right)) + 1
# <<< BLANK


if __name__ == "__main__":
    d = TreeNode("D")
    e = TreeNode("E")
    b = TreeNode("B", d, e)
    c = TreeNode("C", None, TreeNode("F"))
    root = TreeNode("A", b, c)
    print(root.value, root.left.value, root.right.value)
    print(root.left.right.value, root.right.right.value, root.right.left)
    print(count_nodes(root), height(root))
    print(count_nodes(b), height(b))
    print(count_nodes(d), height(d))
    print(count_nodes(None), height(None))
    chain = TreeNode("G", TreeNode("H", TreeNode("I")))
    print(count_nodes(chain), height(chain))
