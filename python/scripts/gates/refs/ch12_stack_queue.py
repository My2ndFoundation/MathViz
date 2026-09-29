"""ch12-stack-queue 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。每个被测入口的每个 return 分支都各做过一次变异
（把被测 `.py` 里那一行改坏、跑 `algorithm_property_check()` 看到红；协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

入口约定（清单 §1.2：门先 fn(*args) 再 ref(*args)，两边拿到同一批对象）：
被测入口只收字符串、整数、元组列表，内部自己建栈 / 队列，返回内置 list / str / bool。
hot_potato 收的 names 列表由被测函数先复制（list(names) / deque(names)）再动。

空结构与满结构的约定（被测与参照一致）：
· circular-queue-array：满时 enqueue 不入队、结果记 False；成功记 True；
  空时 dequeue 结果记 None。
· queue-from-two-stacks：空时 dequeue 结果记 None；enqueue 不产生结果。
· undo-redo-two-stacks：undo 栈空时 undo 什么都不做、redo 栈空时 redo 什么都不做；
  每一步之后都记一次当前文本。
· hot-potato-*：k >= 1（k = 0 时两种机制含义不同，生成器不产生）；空名单返回 []。
"""
import collections


# ── 实参生成器 ───────────────────────────────────────────────────────────

_OPEN = '([{'
_CLOSE = ')]}'


def _balanced_brackets(rng, pairs):
    # 随机造一个平衡串：pairs 对括号，每对随机选一种，随机嵌套或并列。
    if pairs == 0:
        return ''
    inner = rng.randint(0, pairs - 1)
    kind = rng.randrange(3)
    return (_OPEN[kind] + _balanced_brackets(rng, inner) + _CLOSE[kind]
            + _balanced_brackets(rng, pairs - 1 - inner))


def _bracket_text(rng):
    # 清单：约一半平衡串（纯随机括号串几乎全不平衡，「平衡」那条返回分支会没人测）。
    # 另一半专门造三种失败，各自落在被测的一个 return 分支上：
    # 栈空时来闭括号、弹出的开括号不配对、结束时栈不空；再加一些纯随机串。
    text = _balanced_brackets(rng, rng.randint(0, 6))
    r = rng.random()
    if r < 0.5:
        return (text,)
    if r < 0.6:
        return (rng.choice(_CLOSE) + text,)                    # 栈空时来闭括号
    if r < 0.7 and text:
        i = rng.randrange(len(text))
        return (text[:i] + text[i + 1:],)                      # 删一个字符：多半剩开括号或空栈闭括号
    if r < 0.8 and text:
        i = rng.randrange(len(text))
        ch = text[i]
        pool = _CLOSE if ch in _CLOSE else _OPEN
        other = rng.choice([c for c in pool if c != ch])
        return (text[:i] + other + text[i + 1:],)              # 换一种括号：不配对
    if r < 0.9:
        return (rng.choice(_OPEN) + text,)                     # 结束时栈不空
    return (''.join(rng.choice(_OPEN + _CLOSE) for _ in range(rng.randint(0, 10))),)


def _expr_tree(rng, depth=0):
    # 随机表达式树：叶子是 0..20 的整数，内部节点是 (运算符, 左, 右)，只用 + - *。
    # 深度 <= 4（至多 15 个运算符）：参照是递归的，深度远离递归上限。
    if depth >= 4 or rng.random() < (0.15 if depth == 0 else 0.4):
        return rng.randint(0, 20)
    return (rng.choice('+-*'), _expr_tree(rng, depth + 1), _expr_tree(rng, depth + 1))


def _postorder(node):
    if isinstance(node, int):
        return [str(node)]
    op, left, right = node
    return _postorder(left) + _postorder(right) + [op]


_PREC = {'+': 1, '-': 1, '*': 2, '/': 2}


def _infix(node, rng):
    # 中序输出，**只在需要时**加括号（左子式优先级更低、右子式优先级不高于父节点），
    # 另以 15% 概率给任一子式多套一层多余的括号。全括号的中序串测不到优先级与左结合，
    # 所以不用它。返回 (字符串, 这个子式对外的优先级；带括号或是数字时为 3)。
    if isinstance(node, int):
        text, prec = str(node), 3
    else:
        op, left, right = node
        ltext, lprec = _infix(left, rng)
        rtext, rprec = _infix(right, rng)
        if lprec < _PREC[op]:
            ltext = '( ' + ltext + ' )'
        if rprec <= _PREC[op]:
            rtext = '( ' + rtext + ' )'
        text, prec = ltext + ' ' + op + ' ' + rtext, _PREC[op]
    if rng.random() < 0.15:
        text, prec = '( ' + text + ' )', 3
    return text, prec


def _rpn_text(rng):
    return (' '.join(_postorder(_expr_tree(rng))),)


def _infix_text(rng):
    return (_infix(_expr_tree(rng), rng)[0],)


def _potato_args(rng):
    # 名单 0..9 人（字母表只有 5 个名字，常有重名——重名不影响淘汰顺序的比较），
    # k 取 1..12，常常大于人数，绕圈多次。
    names = [rng.choice(['Ana', 'Ben', 'Cai', 'Dev', 'Eli']) for _ in range(rng.randint(0, 9))]
    return (names, rng.randint(1, 12))


def _circular_args(rng):
    # 清单：容量 1..4、操作序列长于容量数倍，常出现「满后入队」「空时出队」与绕回。
    # 入队概率在 0.3..0.8 之间逐组变化：偏入队的组常满，偏出队的组常空。
    capacity = rng.randint(1, 4)
    p = rng.uniform(0.3, 0.8)
    ops = []
    for _ in range(rng.randint(0, capacity * 6 + 4)):
        if rng.random() < p:
            ops.append(('enqueue', rng.randint(0, 99)))
        else:
            ops.append(('dequeue',))
    return (capacity, ops)


def _undo_ops(rng):
    # 打字 / 撤销 / 重做随机混排；撤销与重做常落在空栈上，打字常落在 redo 栈非空时。
    ops = []
    for _ in range(rng.randint(0, 14)):
        r = rng.random()
        if r < 0.4:
            ops.append(('type', rng.choice(['a', 'b', 'cd'])))
        elif r < 0.75:
            ops.append(('undo',))
        else:
            ops.append(('redo',))
    return (ops,)


def _queue_ops(rng):
    # 入队与出队交错：outbox 非空时又有新入队（「只在 outbox 空时才倒」那条规矩的用武之地），
    # 也常在空队列上出队。
    p = rng.uniform(0.3, 0.8)
    ops = []
    for _ in range(rng.randint(0, 16)):
        if rng.random() < p:
            ops.append(('enqueue', rng.randint(0, 99)))
        else:
            ops.append(('dequeue',))
    return (ops,)


# ── 参照 ─────────────────────────────────────────────────────────────────

def _balanced_by_replace(text):
    # 不用栈：反复删掉相邻的 () [] {}，直到不再变化；剩空串即平衡。
    # 只对纯括号串成立——生成器只产括号字符。
    before = None
    while before != text:
        before = text
        text = text.replace('()', '').replace('[]', '').replace('{}', '')
    return text == ''


def _rpn_by_descent(expression):
    # 不用栈：从末尾往前递归下降。最后一个记号是根；是运算符就先解析右子式、再解析左子式。
    tokens = expression.split()
    pos = len(tokens)

    def parse():
        nonlocal pos
        pos -= 1
        token = tokens[pos]
        if token in ('+', '-', '*'):
            right = parse()
            left = parse()
            if token == '+':
                return left + right
            if token == '-':
                return left - right
            return left * right
        return int(token)

    return parse()


def _infix_by_descent(expression):
    # 不用运算符栈：递归下降解析器（expr → term → factor）建树，再后序输出。
    # 左结合由 expr / term 里的 while 循环给出，优先级由两层函数给出。
    tokens = expression.split()
    pos = 0

    def peek():
        return tokens[pos] if pos < len(tokens) else None

    def expr():
        nonlocal pos
        node = term()
        while peek() in ('+', '-'):
            op = tokens[pos]
            pos += 1
            node = (op, node, term())
        return node

    def term():
        nonlocal pos
        node = factor()
        while peek() in ('*', '/'):
            op = tokens[pos]
            pos += 1
            node = (op, node, factor())
        return node

    def factor():
        nonlocal pos
        token = tokens[pos]
        pos += 1
        if token == '(':
            node = expr()
            pos += 1                  # 跳过配对的 ')'
            return node
        return token

    def post(node):
        if isinstance(node, str):
            return [node]
        return post(node[1]) + post(node[2]) + [node[0]]

    return ' '.join(post(expr()))


def _josephus_by_index(names, k):
    # 不转圈：下标算术直接算出下一个出局者的位置，pop(i)。
    people = list(names)
    order = []
    i = 0
    while people:
        i = (i + k - 1) % len(people)
        order.append(people.pop(i))
    return order


def _circular_by_list(capacity, ops):
    # 不绕回：一个普通 Python 列表，长度到容量就判满，出队取下标 0。
    items = []
    results = []
    for op in ops:
        if op[0] == 'enqueue':
            if len(items) == capacity:
                results.append(False)
            else:
                items.append(op[1])
                results.append(True)
        else:
            results.append(items.pop(0) if items else None)
    return results


def _undo_by_history(ops):
    # 不用两个栈：一条历史列表 + 当前位置下标。新打字截断下标之后的历史再追加。
    states = ['']
    pos = 0
    after_each = []
    for op in ops:
        if op[0] == 'type':
            states = states[:pos + 1] + [states[pos] + op[1]]
            pos += 1
        elif op[0] == 'undo':
            pos = max(pos - 1, 0)
        elif op[0] == 'redo':
            pos = min(pos + 1, len(states) - 1)
        after_each.append(states[pos])
    return after_each


def _queue_by_deque(ops):
    # 不用两个栈：collections.deque 两端进出。
    queue = collections.deque()
    results = []
    for op in ops:
        if op[0] == 'enqueue':
            queue.append(op[1])
        else:
            results.append(queue.popleft() if queue else None)
    return results


REFERENCES = {
    'bracket-matching': {
        'ref': _balanced_by_replace,
        'cases': _bracket_text,
    },
    'rpn-evaluate': {
        'ref': _rpn_by_descent,
        'cases': _rpn_text,
    },
    'infix-to-rpn': {
        'ref': _infix_by_descent,
        'cases': _infix_text,
    },
    'hot-potato-list': {
        'ref': _josephus_by_index,
        'cases': _potato_args,
    },
    'hot-potato-deque': {
        'ref': _josephus_by_index,
        'cases': _potato_args,
    },
    'circular-queue-array': {
        'ref': _circular_by_list,
        'cases': _circular_args,
    },
    'undo-redo-two-stacks': {
        'ref': _undo_by_history,
        'cases': _undo_ops,
    },
    'queue-from-two-stacks': {
        'ref': _queue_by_deque,
        'cases': _queue_ops,
    },
}
