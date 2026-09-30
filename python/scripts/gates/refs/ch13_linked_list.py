"""ch13-linked-list 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（实测记录见构建报告）。

本章被测程序都在**内部**建自己的链表（清单 §1.2：门先 `fn(*args)` 再 `ref(*args)`，
两者拿到同一批对象），入口收值列表或操作元组列表、返回 Python 内置值。参照一律用
Python 内置 list 实现同一套语义，不建节点、不碰指针。

**下标约定**（insert-at-index 与 doubly-linked-list 的 insert，被测与参照一致）：
下标是非负整数；大于长度的下标插到末尾——与 `list.insert` 对非负下标的行为相同。
负下标不在约定内，生成器不产。

**空栈约定**（stack-as-linked-list）：空栈上的 pop 与 peek 都返回 None，不抛错。

**删除约定**（delete-by-value 与 doubly-linked-list 的 remove）：只删第一个等于目标的
节点；找不到时什么都不动。

生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。
reverse-recursive 的递归深度 ≈ 链表长度：长度收在 0..30，离默认递归上限 1000 很远。
"""


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _insert_index(rng, length):
    # 清单点名的三种边界各占一份：i == 0（头插）、i == 长度（尾插）、i > 长度（越界插到末尾）；
    # 其余是 0..长度 之间的任意位置。空表时 i == 0 与 i == 长度 是同一个。
    r = rng.random()
    if r < 0.25:
        return 0
    if r < 0.5:
        return length
    if r < 0.65:
        return length + rng.randint(1, 3)
    return rng.randint(0, length)


def _insert_ops(rng):
    ops = []
    for _ in range(rng.randint(0, 10)):
        ops.append((_insert_index(rng, len(ops)), rng.randint(-9, 99)))
    return (ops,)


def _delete_args(rng):
    # 窄字母表 0..4：目标常常重复出现。目标三种各三分之一：在头、表里任意一个（常重复）、不在。
    values = [rng.randint(0, 4) for _ in range(rng.randint(0, 8))]
    r = rng.random()
    if values and r < 1 / 3:
        target = values[0]
    elif values and r < 2 / 3:
        target = rng.choice(values)
    else:
        target = rng.choice([5, 6, -1])
    return (values, target)


def _reverse_values(rng):
    # 长度 0 与 1 是两个基例边界，四分之一概率专门抽 0..2。
    if rng.random() < 0.25:
        n = rng.randint(0, 2)
    else:
        n = rng.randint(0, 30)
    return ([rng.randint(-50, 50) for _ in range(n)],)


def _dll_ops(rng):
    # 插入与删除混着来；删除的值取自窄字母表 0..4，于是「删到了」与「没找到」都常见，
    # 删头、删尾、删中间与删到空表也都会出现。
    ops = []
    length = 0
    for _ in range(rng.randint(0, 12)):
        if rng.random() < 0.6:
            ops.append(("insert", _insert_index(rng, length), rng.randint(0, 4)))
            length += 1
        else:
            ops.append(("remove", rng.randint(0, 5)))
    return (ops,)


def _stack_ops(rng):
    # pop 与 peek 占一半，空栈上的 pop / peek 很常见。
    ops = []
    for _ in range(rng.randint(0, 15)):
        r = rng.random()
        if r < 0.5:
            ops.append(("push", rng.randint(-20, 20)))
        elif r < 0.8:
            ops.append(("pop",))
        else:
            ops.append(("peek",))
    return (ops,)


# ── 参照 ─────────────────────────────────────────────────────────────────

def _insert_ref(ops):
    values = []
    for i, value in ops:
        values.insert(i, value)
    return values


def _delete_ref(values, target):
    values = list(values)          # 复制：不改门传进来的那一份
    if target in values:
        values.remove(target)
    return values


def _reverse_ref(values):
    return values[::-1]


def _dll_ref(ops):
    values = []
    for op in ops:
        if op[0] == "insert":
            values.insert(op[1], op[2])
        elif op[1] in values:
            values.remove(op[1])
    return values, values[::-1]


def _stack_ref(ops):
    values = []
    results = []
    for op in ops:
        if op[0] == "push":
            values.append(op[1])
        elif op[0] == "pop":
            results.append(values.pop() if values else None)
        else:
            results.append(values[-1] if values else None)
    return results


REFERENCES = {
    'insert-at-index': {
        'ref': _insert_ref,
        'cases': _insert_ops,
    },
    'delete-by-value': {
        'ref': _delete_ref,
        'cases': _delete_args,
    },
    'reverse-iterative': {
        'ref': _reverse_ref,
        'cases': _reverse_values,
    },
    'reverse-recursive': {
        'ref': _reverse_ref,
        'cases': _reverse_values,
    },
    'doubly-linked-list': {
        'ref': _dll_ref,
        'cases': _dll_ops,
    },
    'stack-as-linked-list': {
        'ref': _stack_ref,
        'cases': _stack_ops,
    },
}
