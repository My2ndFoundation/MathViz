"""Build an expression tree from reverse Polish notation, then evaluate and print it recursively."""


class Node:
    def __init__(self, value, left=None, right=None):
        self.value = value
        self.left = left
        self.right = right


def build(tokens):
    stack = []
    for token in tokens:
        if token in ("+", "-", "*"):
# >>> BLANK id=pop-two level=2 hint="两行，各从 stack 弹出一棵子树，分别存进 right 和 left；哪一行在前是这一空的要点 || 后压进去的先弹出来：先弹出的是右边那棵，所以 right 那一行在前" hintEn="Two lines, each popping one subtree off stack, into right and into left; which line comes first is the whole point || The last one pushed comes off first: the first one popped is the right-hand subtree, so the right line comes first"
            right = stack.pop()
            left = stack.pop()
# <<< BLANK
# >>> BLANK id=join level=2 hint="一行：造一个新节点压回 stack——运算符是它的值，刚弹出的两棵子树是它的两个孩子；三个实参都按位置给 || 实参顺序与 Node 的 __init__ 相同：token、left、right" hintEn="One line: make a new node and push it back onto stack - the operator is its value and the two subtrees just popped are its children; all three arguments by position || The arguments go in the same order as Node's __init__: token, left, right"
            stack.append(Node(token, left, right))
# <<< BLANK
        else:
            stack.append(Node(int(token)))
    return stack.pop()


def evaluate(node):
    if node.left is None:
        return node.value
# >>> BLANK id=both-sides level=1 hint="两行，先左后右：把两棵子树各自的值算出来存进 a 和 b——靠的是再调用 evaluate" hintEn="Two lines, left first and then right: work out the value of each subtree into a and b - by calling evaluate again"
    a = evaluate(node.left)
    b = evaluate(node.right)
# <<< BLANK
    if node.value == "+":
        return a + b
    if node.value == "-":
        return a - b
    return a * b


def infix(node):
    if node.left is None:
        return str(node.value)
    return "(" + infix(node.left) + " " + node.value + " " + infix(node.right) + ")"


def solve(text):
    root = build(text.split())
    return evaluate(root), infix(root)


if __name__ == "__main__":
    print(solve("3 4 + 2 *"))
    print(solve("3 4 2 * +"))
    print(solve("5 1 2 + 4 * + 3 -"))
    print(solve("9 2 - 1 -"))
    print(solve("9 2 1 - -"))
    print(solve("7"))
