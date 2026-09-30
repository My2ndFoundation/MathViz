"""ch23-systems 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。每个被测入口的每个 return / 结果分支都各做过一次变异
（把被测 `.py` 里那一行改坏、跑 `algorithm_property_check()` 看到红；协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

入口约定（清单 §1.2）：被测入口只收字符串、整数、元组列表，内部自己建对象，返回内置值；
不改实参。系统类程序的入口是 `run_ops(ops)`，参照用朴素的 dict / list 实现同一套语义。

生成器的共同约定（被测与参照在这些情形下本来就会分歧，所以不生成）：
· 每个学生 / 货号 / 账户 / 书 / 成员**至多建一次**。被测程序重建时换了一个新对象，
  旧对象上的引用（书的借阅人、账户的日志）与按名字记账的参照含义不同。
· 钱：余额与利率都不为负。整数的「加 50 再整除」对负数是向正无穷的半数进位，
  ROUND_HALF_UP 是远离零——两版约定只在非负数上一致（程序的文档串写明了「not negative」）。
"""
from decimal import ROUND_HALF_UP, Decimal


# ── gradebook-classes ────────────────────────────────────────────────────

_PUPILS = ['Ada', 'Ben', 'Cal', 'Dee']


def _gradebook_ops(rng):
    # 分数：一半取整 10 分附近（常常恰好落在 40/50/60/70 分数线上），一半 0..100 均匀。
    # report 的名字取自全池，还没记过分的名字走「查无此人」那一支。
    ops = []
    for _ in range(rng.randint(0, 14)):
        name = rng.choice(_PUPILS)
        if rng.random() < 0.6:
            mark = rng.choice([39, 40, 49, 50, 59, 60, 69, 70]) if rng.random() < 0.5 else rng.randint(0, 100)
            ops.append(('mark', name, mark))
        else:
            ops.append(('report', name))
    return (ops,)


def _gradebook_ref(ops):
    # 一个 {名字: [分数]} 字典 + 函数；等级不查表，按「十位数减 3」算出下标。
    marks = {}
    out = []
    for op in ops:
        if op[0] == 'mark':
            marks.setdefault(op[1], []).append(op[2])
        elif op[1] not in marks:
            out.append('no such student')
        else:
            avg = sum(marks[op[1]]) / len(marks[op[1]])
            letter = 'UDCBA'[min(4, max(0, int(avg) // 10 - 3))]
            out.append(f'{op[1]} {avg:.1f} {letter}')
    return out


# ── competition-ranking ──────────────────────────────────────────────────

def _scores(rng):
    # 清单：大量同分、全部同分、单人、空表。分数取自很窄的范围，平局是常态。
    r = rng.random()
    if r < 0.1:
        return ([],)
    if r < 0.2:
        return ([(rng.choice(_PUPILS), rng.randint(0, 9))],)
    n = rng.randint(2, 8)
    if r < 0.35:
        s = rng.randint(0, 9)
        return ([(rng.choice(_PUPILS + ['Eve', 'Fay']), s) for _ in range(n)],)
    return ([(rng.choice(_PUPILS + ['Eve', 'Fay']), rng.randint(0, 5)) for _ in range(n)],)


def _ranking_ref(scores):
    # 名次 = 1 + 比它严格高的人数（不排序、不看上一行）；最后按元组自然序排行，
    # 名次递增即分数递减，同名次内按名字——与被测的 key=(-分数, 名字) 是两条路。
    rows = [(1 + sum(1 for _, other in scores if other > s), n, s) for n, s in scores]
    return sorted(rows)


# ── inventory-stock ─────────────────────────────────────────────────────
# 构建时暂不登记过：门的 compile 没传 dont_inherit=True，被测程序继承了 library.py 的
# `from __future__ import annotations`，@dataclass 导入即崩。#188 给门的两处 compile 加上了
# dont_inherit=True，这里随之登记、chapter.json 补回 check.property。

_SKUS = ['PEN', 'INK', 'PAD']


def _inventory_ops(rng):
    # 每个货号开头建一次（再订货线 0..5）。出货时 1/4 恰好发光全部库存（「>」与「>=」的分界），
    # 1/4 多要一点（库存不足），其余随机——正常、到线报警两支都常出现。
    levels = {sku: rng.randint(0, 5) for sku in _SKUS}
    qty = dict.fromkeys(_SKUS, 0)
    ops = [('new', sku, levels[sku]) for sku in _SKUS]
    for _ in range(rng.randint(0, 14)):
        sku = rng.choice(_SKUS)
        if rng.random() < 0.4:
            n = rng.randint(0, 10)
            ops.append(('in', sku, n))
            qty[sku] += n
            continue
        r = rng.random()
        if r < 0.25:
            n = qty[sku]
        elif r < 0.5:
            n = qty[sku] + rng.randint(1, 3)
        else:
            n = rng.randint(0, 6)
        ops.append(('out', sku, n))
        if n <= qty[sku]:
            qty[sku] -= n
    return (ops,)


def _inventory_ref(ops):
    # 朴素的 {货号: 数量} 与 {货号: 再订货线} 两个字典；先算出发货后的数量，负数就是不足。
    qty, level, out = {}, {}, []
    for op in ops:
        if op[0] == 'new':
            qty[op[1]], level[op[1]] = 0, op[2]
        elif op[0] == 'in':
            qty[op[1]] += op[2]
            out.append(qty[op[1]])
        else:
            left = qty[op[1]] - op[2]
            if left < 0:
                out.append(f'short by {-left}')
            else:
                qty[op[1]] = left
                out.append('ok' if left > level[op[1]] else 'reorder')
    return out


# ── bank-transfer-atomic ─────────────────────────────────────────────────

def _bank_ops(rng):
    # 开 2..3 个账户（名字池 4 个，总有一个没开：「查无此人」），余额 0..100。
    # 金额：1/6 取 0 或负数，1/6 恰好等于付款方当前余额（可转、转完为 0），其余 1..120。
    # 付款方与收款方可以是同一个人（两版都照常处理：先扣后加，净变化 0）。
    names = ['Ada', 'Ben', 'Cal', 'Dee']
    opened = rng.sample(names, rng.randint(2, 3))
    ops = [('open', n, rng.randint(0, 100)) for n in opened]
    for _ in range(rng.randint(0, 10)):
        src, dst = rng.choice(names), rng.choice(names)
        r = rng.random()
        if r < 1 / 6:
            amt = rng.randint(-5, 0)
        elif r < 2 / 6:
            amt = None                      # 占位：参照里按当时余额填不出来，交给下面
        else:
            amt = rng.randint(1, 120)
        ops.append(['transfer', src, dst, amt])
    # 「恰好等于余额」要知道当时的余额：顺着模拟一遍把占位填上。
    bal = {op[1]: op[2] for op in ops if op[0] == 'open'}
    for op in ops:
        if op[0] != 'transfer':
            continue
        if op[3] is None:
            op[3] = bal.get(op[1], 7)
        s, t, a = op[1], op[2], op[3]
        if s in bal and t in bal and 0 < a <= bal[s]:
            bal[s] -= a
            bal[t] += a
    return ([tuple(op) for op in ops],)


def _bank_ref(ops):
    # 先改、失败再回滚：动手前拷一份余额字典，改完再验，验不过就换回拷贝。
    # 被测是「先全部检查、再改」——两种保证一致性的机制。
    balances, log, out = {}, [], []
    for op in ops:
        if op[0] == 'open':
            balances[op[1]] = op[2]
            continue
        _, s, t, a = op
        snapshot = dict(balances)
        try:
            balances[s] -= a
            balances[t] += a
        except KeyError:
            balances = snapshot
            out.append('no such account')
            continue
        if a <= 0:
            balances = snapshot
            out.append('amount must be positive')
        elif snapshot[s] < a:
            balances = snapshot
            out.append('insufficient funds')
        else:
            log.append((s, t, a))
            out.append('ok')
    return out, balances, log


# ── money-in-pence / money-decimal ───────────────────────────────────────

def _money_args(rng):
    # 清单：常出现恰好 .5 便士的舍入点。余额取「整百 + 50」、利率取奇数时，
    # 第一个月的 余额 × 利率 恰好以 50 结尾，即利息恰好是 x.5 便士。
    months = rng.randint(0, 24)
    if rng.random() < 0.4:
        return (rng.randint(0, 2000) * 100 + 50, rng.choice([1, 3, 5, 7, 9, 11]), rng.randint(1, 3))
    return (rng.randint(0, 100000), rng.randint(0, 20), months)


def _interest_decimal(balance, rate_percent, months):
    # 以便士为单位的 Decimal，量化到整数便士（被测的 Decimal 版是以英镑为单位、量化到 0.01）。
    pence = Decimal(balance)
    for _ in range(months):
        pence += (pence * rate_percent / 100).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return int(pence)


def _interest_divmod(balance, rate_percent, months):
    # 整数便士，但半数进位写成 divmod + 看余数（被测的整数版是「加 50 再整除」）。
    for _ in range(months):
        whole, rest = divmod(balance * rate_percent, 100)
        balance += whole + (1 if rest >= 50 else 0)
    return balance


# ── library-loans ────────────────────────────────────────────────────────

_TITLES = ['Dune', 'Emma', 'Ivanhoe', 'Kim']
_READERS = ['Ada', 'Ben', 'Cal']


def _library_ops(rng):
    # 书与成员各建一次、总有没建的（「查无此人」）。1/5 的样本开头照一段脚本：
    # 同一个人连借三本（第三本撞上限）、另一个人去借已借出的书、去还别人借的书。
    # 日子单调不减，每步 0..10 天，还书常常超过 14 天（罚金 > 0）。
    books = rng.sample(_TITLES, rng.randint(2, 4))
    readers = rng.sample(_READERS, rng.randint(1, 3))
    ops = [('book', b) for b in books] + [('member', m) for m in readers]
    day = rng.randint(0, 5)
    if rng.random() < 0.2 and len(books) >= 3 and len(readers) >= 2:
        a, b = readers[0], readers[1]
        ops += [('borrow', a, books[0], day), ('borrow', a, books[1], day),
                ('borrow', a, books[2], day), ('borrow', b, books[0], day),
                ('return', b, books[1], day)]
    for _ in range(rng.randint(0, 16)):
        day += rng.randint(0, 10)
        kind = 'borrow' if rng.random() < 0.55 else 'return'
        ops.append((kind, rng.choice(_READERS), rng.choice(_TITLES), day))
    return (ops,)


def _library_ref(ops):
    # 两个字典：书 → 借阅人名字（没人借为 None）、人 → 书名集合；外加 书 → 应还日。
    holder, loans, due, out = {}, {}, {}, []
    for op in ops:
        if op[0] == 'book':
            holder[op[1]] = None
            continue
        if op[0] == 'member':
            loans[op[1]] = set()
            continue
        kind, name, title, day = op
        if name not in loans or title not in holder:
            out.append('no such member or book')
        elif kind == 'borrow':
            if holder[title] is not None:
                out.append('already on loan')
            elif len(loans[name]) > 1:
                out.append('loan limit reached')
            else:
                holder[title] = name
                loans[name].add(title)
                due[title] = day + 14
                out.append(due[title])
        elif holder[title] != name:
            out.append('not borrowed by this member')
        else:
            holder[title] = None
            loans[name].discard(title)
            late = day - due[title]
            out.append(late * 20 if late > 0 else 0)
    return out


REFERENCES = {
    'gradebook-classes': {'ref': _gradebook_ref, 'cases': _gradebook_ops},
    'competition-ranking': {'ref': _ranking_ref, 'cases': _scores},
    'inventory-stock': {'ref': _inventory_ref, 'cases': _inventory_ops},
    'bank-transfer-atomic': {'ref': _bank_ref, 'cases': _bank_ops},
    'money-in-pence': {'ref': _interest_decimal, 'cases': _money_args},
    'money-decimal': {'ref': _interest_divmod, 'cases': _money_args},
    'library-loans': {'ref': _library_ref, 'cases': _library_ops},
}
