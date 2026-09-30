"""ch26-pandas 的 property 参考实现（scipy-stack 层，requires 含 pandas）。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（协议：种子 properties.SEED、SAMPLES 组、本文件的生成器；
红在哪组实参上见构建报告）。

入口约定（m6b 清单 §2.1）：被测入口收**纯 Python** 实参（字典列表 / 元组列表 / 数字列表），
在函数里建 DataFrame / Series，返回**纯 Python** 值；参照只用纯 Python，**不 import
numpy / pandas**，生成器造的也是纯 Python 实参。门逐层比值与类型（#192），入口忘了
`.tolist()` / `float()` / `int()`、列表里留着 numpy 标量，就是红。

浮点：凡返回均值的入口（group-mean-*、missing-fill-mean），入口与参照**都**用 `round(v, 9)`，
写法一致——pandas 求均值的求和次序与逐项相加不同，末位可能差一点，舍到 9 位后两边相同。

缺失值：返回值里**不许有 NaN**（nan != nan，门会红得与程序无关）。merge-left-join 的入口
把缺失的分数转成 None，参照同样给 None；missing-fill-mean 的生成器保证至少有一个在场的读数
（全缺时均值本身就是 NaN，补不上）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。
"""

_FORMS = ['12A', '12B', '13A']


def _rows(rng, n_lo=0, n_hi=8, narrow=False):
    # narrow：分数只取 3 个值，同班同分的并列常见——sort-two-keys 的稳定性靠它才有东西可比。
    rows = []
    for i in range(rng.randint(n_lo, n_hi)):
        score = rng.choice([60, 65, 70]) if narrow else rng.randint(40, 80)
        rows.append({'name': f's{i}', 'form': rng.choice(_FORMS), 'score': score})
    return rows


def _mean(values):
    return sum(values) / len(values)


# ── filter-mask / filter-query ───────────────────────────────────────────
# 同一个入口 passed_in_form(rows, threshold, form)，两种写法（布尔掩码 / query 字符串）。
# 一半的实参让第一行恰好压在门槛上、班级恰好是要找的班——`>` 代替 `>=` 的错就落在这里。

def _filter_cases(rng):
    rows = _rows(rng)
    threshold = rng.choice([50, 60, 70])
    form = rng.choice(_FORMS)
    if rows and rng.random() < 0.5:
        rows[0]['score'] = threshold
        rows[0]['form'] = form
    return (rows, threshold, form)


def _filter_ref(rows, threshold, form):
    # 被测靠 DataFrame 的布尔掩码 / query 表达式；参照是逐行的列表推导式。
    return [r['name'] for r in rows if r['score'] >= threshold and r['form'] == form]


# ── group-mean-groupby / group-mean-pivot-table ──────────────────────────

def _group_cases(rng):
    return (_rows(rng, 1, 10),)


def _group_ref(rows):
    # 被测靠 groupby / pivot_table；参照是手工 setdefault 分组、sum / len 求均值。
    groups = {}
    for r in rows:
        groups.setdefault(r['form'], []).append(r['score'])
    return {form: round(_mean(scores), 9) for form, scores in groups.items()}


# ── missing-fill-mean ────────────────────────────────────────────────────

def _missing_cases(rng):
    values = [rng.randint(0, 20) for _ in range(rng.randint(1, 8))]
    for i in range(len(values)):
        if rng.random() < 0.3:
            values[i] = None
    if all(v is None for v in values):
        values[rng.randrange(len(values))] = rng.randint(0, 20)
    return (values,)


def _missing_ref(values):
    # 被测靠 Series.fillna(Series.mean())；参照先挑出在场的值求均值，再逐个替换 None。
    present = [v for v in values if v is not None]
    m = round(_mean(present), 9)
    return [m if v is None else round(float(v), 9) for v in values]


# ── merge-left-join ──────────────────────────────────────────────────────

def _merge_cases(rng):
    # 左右两表的 id 各自不重复；右表可以有左表没有的 id（左连接里丢掉），也可以为空。
    ids = rng.sample(range(1, 9), rng.randint(0, 6))
    pupils = [(i, f's{i}') for i in ids]
    scores = [(i, rng.randint(40, 90)) for i in rng.sample(range(1, 9), rng.randint(0, 6))]
    return (pupils, scores)


def _merge_ref(pupils, scores):
    # 被测靠 DataFrame.merge(how="left")；参照是字典查找，查不到给 None。
    by_id = dict(scores)
    return [(pid, name, by_id.get(pid)) for pid, name in pupils]


# ── sort-two-keys ────────────────────────────────────────────────────────

def _sort_cases(rng):
    return (_rows(rng, narrow=rng.random() < 0.5),)


def _sort_ref(rows):
    # 被测靠 sort_values 两列各自升降序；参照是 sorted 按 (班级, -分数) 排——sorted 稳定，
    # 同班同分的两行保持原来的先后，pandas 的多列排序也如此（生成器的 narrow 分支专门造这种并列）。
    return [r['name'] for r in sorted(rows, key=lambda r: (r['form'], -r['score']))]


REFERENCES = {
    'filter-mask': {'ref': _filter_ref, 'cases': _filter_cases},
    'filter-query': {'ref': _filter_ref, 'cases': _filter_cases},
    'group-mean-groupby': {'ref': _group_ref, 'cases': _group_cases},
    'group-mean-pivot-table': {'ref': _group_ref, 'cases': _group_cases},
    'missing-fill-mean': {'ref': _missing_ref, 'cases': _missing_cases},
    'merge-left-join': {'ref': _merge_ref, 'cases': _merge_cases},
    'sort-two-keys': {'ref': _sort_ref, 'cases': _sort_cases},
}
