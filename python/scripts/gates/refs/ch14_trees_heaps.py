"""ch14-trees-heaps 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面「实测」的变异，都是把被测 `.py` 里那一行改坏、
跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子 properties.SEED、
SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**入口不改实参**（M3 清单 §1.2）：门先 `fn(*args)` 再 `ref(*args)`，两边拿到同一批对象。
本章每个入口只收值列表 / 查询列表 / 操作元组列表，内部自己建树、建堆，返回内置值；
下面的参照同样只读实参。

**实参长度为什么收紧**：被测的 BST 程序用递归插入（traversals-* / bst-insert-recursive /
bst-search / bst-delete），单调递增的 n 个值会建出一条 n 层的「链」，递归深度 = n；
参照的「按根划分」也递归 n 层。门在 check.py 自己的调用栈里跑（默认上限 1000，外面还垫着
门自己的几层），所以单调序列最长 60 个，随机序列最长 30 个——够把退化成链表的树、
重复值、空列表都喂到，又离上限足够远。
"""
import heapq


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _bst_values(rng):
    # 清单 §2.5：要有重复值、单调递增（退化成链表的树）、空列表。
    r = rng.random()
    if r < 0.12:
        return []
    if r < 0.32:
        return sorted(rng.sample(range(-100, 100), rng.randint(1, 60)))
    if r < 0.42:
        return sorted(rng.sample(range(-100, 100), rng.randint(1, 60)), reverse=True)
    # 窄值域：重复值几乎每组都有。
    return [rng.randint(-15, 15) for _ in range(rng.randint(1, 30))]


def _values_only(rng):
    return (_bst_values(rng),)


def _values_and_queries(rng):
    values = _bst_values(rng)
    queries = []
    for _ in range(rng.randint(0, 12)):
        if values and rng.random() < 0.5:
            queries.append(rng.choice(values))          # 命中：「找到」那条 return
        else:
            queries.append(rng.randint(-110, 110))      # 多半不在：「走到 None」那条 return
    return values, queries


def _values_and_deletes(rng):
    values = _bst_values(rng)
    deletes = []
    for _ in range(rng.randint(0, 10)):
        r = rng.random()
        if values and r < 0.25:
            deletes.append(values[0])                   # 删根：常是双孩子情形
        elif values and r < 0.75:
            deletes.append(rng.choice(values))          # 删树里有的值（可能已被删过——重复删除）
        else:
            deletes.append(rng.randint(-110, 110))      # 多半不在树里：delete 走到 None
    return values, deletes


def _heap_ops(rng):
    # 清单 §2.5：重复优先级、空堆上的 pop。值域 0..9 让重复几乎必然；
    # 三成的组一开头就 pop 空堆。空堆 pop 的约定：结果列表里记 None。
    ops = []
    if rng.random() < 0.3:
        ops.append(("pop",))
    for _ in range(rng.randint(0, 40)):
        if rng.random() < 0.55:
            ops.append(("push", rng.randint(0, 9)))
        else:
            ops.append(("pop",))
    return (ops,)


def _pq_ops(rng):
    # 优先级只取 1..4：同优先级的任务一组里总有好几个，先来先服务这条约定才测得到。
    # 任务名带序号、互不相同，排错了顺序就一定看得出来。空队列上 serve 记 None。
    ops = []
    if rng.random() < 0.3:
        ops.append(("serve",))
    for n in range(rng.randint(0, 40)):
        if rng.random() < 0.6:
            ops.append(("add", rng.randint(1, 4), "task" + str(n)))
        else:
            ops.append(("serve",))
    return (ops,)


def _rpn_tokens(rng, depth):
    # 随机表达式树的后序输出。深度到顶或抽中就出叶子（0..9 的整数）。
    if depth == 0 or rng.random() < 0.3:
        return [str(rng.randint(0, 9))]
    op = rng.choice("+-*")
    return _rpn_tokens(rng, depth - 1) + _rpn_tokens(rng, depth - 1) + [op]


def _rpn_text(rng):
    return (" ".join(_rpn_tokens(rng, rng.randint(0, 5))),)


# ── 参照 ─────────────────────────────────────────────────────────────────

def _build_dict_tree(values):
    # 不用 TreeNode 类：节点是 {'v': 值, 'l': 左, 'r': 右} 字典，用循环插入。
    root = None
    for v in values:
        if root is None:
            root = {'v': v, 'l': None, 'r': None}
            continue
        node = root
        while node['v'] != v:
            side = 'l' if v < node['v'] else 'r'
            if node[side] is None:
                node[side] = {'v': v, 'l': None, 'r': None}
            node = node[side]
    return root


def _traversals_marker_stack(values):
    # traversals-recursive 的参照：显式栈迭代。栈里放 (节点, 已展开?)：第一次弹出时按
    # 该遍历的顺序把「左、自己(已展开)、右」倒着压回去，第二次弹出时才记下值。
    # 三种遍历共用这一套，只是压回去的顺序不同——不递归。
    root = _build_dict_tree(values)

    def walk(order):
        out = []
        stack = [(root, False)]
        while stack:
            node, expanded = stack.pop()
            if node is None:
                continue
            if expanded:
                out.append(node['v'])
                continue
            parts = {'self': (node, True), 'l': (node['l'], False), 'r': (node['r'], False)}
            for key in reversed(order):
                stack.append(parts[key])
        return out

    return (walk(('self', 'l', 'r')), walk(('l', 'self', 'r')), walk(('l', 'r', 'self')))


def _traversals_recursive(values):
    # traversals-iterative 的参照：递归遍历字典树（学生看不到参照，参照用递归不算重讲）。
    root = _build_dict_tree(values)

    def pre(n):
        return [] if n is None else [n['v']] + pre(n['l']) + pre(n['r'])

    def mid(n):
        return [] if n is None else mid(n['l']) + [n['v']] + mid(n['r'])

    def post(n):
        return [] if n is None else post(n['l']) + post(n['r']) + [n['v']]

    return (pre(root), mid(root), post(root))


def _preorder_by_partition(values):
    # 不建节点：第一个值是根；其余值按「比根小 / 比根大」保序分成两组（等于根的丢掉），
    # 各自递归得出左、右子树的前序，拼成 [根] + 左 + 右。插入顺序在每一组里保持不变，
    # 所以每组的第一个值就是那棵子树的根——与逐个插入建出的形状相同。
    if not values:
        return []
    root = values[0]
    smaller = [v for v in values[1:] if v < root]
    larger = [v for v in values[1:] if v > root]
    return [root] + _preorder_by_partition(smaller) + _preorder_by_partition(larger)


def _contains_by_set(values, queries):
    members = set(values)
    return [q in members for q in queries]


def _delete_from_preorder(pre, value):
    # 一棵 BST 由它的前序唯一确定，所以删除直接在前序列表上做，不建节点。
    # 约定与被测相同：没有左子树 → 右子树顶上来；没有右子树 → 左子树顶上来；
    # 两棵都有 → 根换成右子树里最小的值（中序后继），再从右子树里删掉它。
    if not pre:
        return []
    root = pre[0]
    smaller = [v for v in pre[1:] if v < root]
    larger = [v for v in pre[1:] if v > root]
    if value < root:
        return [root] + _delete_from_preorder(smaller, value) + larger
    if value > root:
        return [root] + smaller + _delete_from_preorder(larger, value)
    if not smaller:
        return larger
    if not larger:
        return smaller
    successor = min(larger)
    return [successor] + smaller + _delete_from_preorder(larger, successor)


def _delete_all_ref(values, deletes):
    # 中序：清单给的集合差再排序。前序：在前序列表上逐个删（上面那个函数）。
    pre = _preorder_by_partition(values)
    for value in deletes:
        pre = _delete_from_preorder(pre, value)
    return sorted(set(values) - set(deletes)), pre


def _heap_ops_by_min(ops):
    # 朴素列表：pop 时 min() 取最小再 remove。不用 heapq——它与被测同为二叉堆上浮下沉。
    items = []
    popped = []
    for op in ops:
        if op[0] == "push":
            items.append(op[1])
        elif items:
            smallest = min(items)
            items.remove(smallest)
            popped.append(smallest)
        else:
            popped.append(None)
    return popped


def _pq_by_min_key(ops):
    # priority-queue-heapq 的参照：普通列表按到达顺序存 (优先级, 任务)；serve 时
    # min(range(...), key=优先级) 取下标——min 在并列时返回最早的那个，即先来先服务。
    items = []
    served = []
    for op in ops:
        if op[0] == "add":
            items.append((op[1], op[2]))
        elif items:
            best = min(range(len(items)), key=lambda i: items[i][0])
            served.append(items.pop(best)[1])
        else:
            served.append(None)
    return served


def _pq_by_heapq(ops):
    # priority-queue-scan-min 的参照：heapq 存 (优先级, 到达序号, 任务)。
    heap = []
    served = []
    for n, op in enumerate(ops):
        if op[0] == "add":
            heapq.heappush(heap, (op[1], n, op[2]))
        elif heap:
            served.append(heapq.heappop(heap)[2])
        else:
            served.append(None)
    return served


def _rpn_by_stack(text):
    # 不建树：一个栈里直接放 (值, 加好括号的中缀串)，遇运算符弹两个（先弹出的是右操作数）。
    stack = []
    for token in text.split():
        if token in ("+", "-", "*"):
            b_val, b_txt = stack.pop()
            a_val, a_txt = stack.pop()
            if token == "+":
                val = a_val + b_val
            elif token == "-":
                val = a_val - b_val
            else:
                val = a_val * b_val
            stack.append((val, "(" + a_txt + " " + token + " " + b_txt + ")"))
        else:
            stack.append((int(token), token))
    return stack.pop()


REFERENCES = {
    'traversals-recursive': {
        'ref': _traversals_marker_stack,
        'cases': _values_only,
    },
    'traversals-iterative': {
        'ref': _traversals_recursive,
        'cases': _values_only,
    },
    'bst-insert-recursive': {
        'ref': _preorder_by_partition,
        'cases': _values_only,
    },
    'bst-insert-iterative': {
        'ref': _preorder_by_partition,
        'cases': _values_only,
    },
    'bst-search': {
        'ref': _contains_by_set,
        'cases': _values_and_queries,
    },
    'bst-delete': {
        'ref': _delete_all_ref,
        'cases': _values_and_deletes,
    },
    'heap-sift-up-down': {
        'ref': _heap_ops_by_min,
        'cases': _heap_ops,
    },
    'priority-queue-heapq': {
        'ref': _pq_by_min_key,
        'cases': _pq_ops,
    },
    'priority-queue-scan-min': {
        'ref': _pq_by_heapq,
        'cases': _pq_ops,
    },
    'expression-tree': {
        'ref': _rpn_by_stack,
        'cases': _rpn_text,
    },
}
