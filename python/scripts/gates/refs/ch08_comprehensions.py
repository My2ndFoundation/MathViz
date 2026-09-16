"""ch08-comprehensions 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里提到的变异，都是把被测 `.py` 里那一行
改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

⚠ 门先调被测函数、再用**同一份实参**调参照：被测函数若原地改了实参，参照看到的就是
改过的值。本章被测函数都不改实参，参照也一律不改（插入排序先拷贝）。
"""


def _int_list(rng):
    # 可以为空：空列表是推导式与循环都该平安通过的边界。-20..20 让正、负、0、奇偶都常出现。
    return ([rng.randint(-20, 20) for _ in range(rng.randint(0, 12))],)


def _str_int_dict(rng):
    # 值只取 0..4：键多于 5 个时必然撞值，「后来者覆盖」这一条才测得到。
    keys = ['k%d' % rng.randint(0, 30) for _ in range(rng.randint(0, 10))]
    return ({key: rng.randint(0, 4) for key in keys},)


def _matrix(rng):
    # 至少 1 行 1 列（被测程序按 matrix[0] 取列数，空矩阵在它的声明之外）；
    # 行数与列数独立取，非方阵占大多数——行列下标用反了只在非方阵上露馅。
    rows = rng.randint(1, 5)
    cols = rng.randint(1, 5)
    return ([[rng.randint(0, 99) for _ in range(cols)] for _ in range(rows)],)


def _marks(rng):
    # 分数与及格线都在 0..100 的一小撮值里取，mark == pass_mark 与 mark == 100 才常出现；
    # 列表可以为空（all 对空为 True、any 对空为 False，参照必须同样处理）。
    pool = [0, 38, 39, 40, 41, 55, 99, 100]
    marks = [rng.choice(pool) for _ in range(rng.randint(0, 8))]
    return marks, rng.choice([39, 40, 41, 100])


def _players(rng):
    # 名字取自很小的字母表、分数只有 4 种：同分（稳定性）与同名同分（完全相同的元组）都常出现。
    names = ['Ada', 'Bob', 'Chen', 'Dan']
    return ([(rng.choice(names), rng.choice([64, 88, 91, 100])) for _ in range(rng.randint(0, 9))],)


def _loop_evens(numbers):
    # 被测：推导式里的 if / filter + lambda；参照：普通 for + if + append。
    out = []
    for n in numbers:
        if n % 2 == 0:
            out.append(n)
    return out


def _loop_invert(mapping):
    # 被测：字典推导式遍历 items()；参照：按键遍历、下标取值、逐条赋值。
    # 两边都按插入顺序遍历，撞值时后来者覆盖——与推导式同一条语义，不是碰巧。
    out = {}
    for key in mapping:
        out[mapping[key]] = key
    return out


def _zip_transpose(matrix):
    # 被测：嵌套推导式按列号下标；参照：zip(*matrix) 解包再逐列转回列表。
    return list(map(list, zip(*matrix)))


def _loop_report(marks, pass_mark):
    # 被测：sum / all / any 各跑一个生成器表达式；参照：一次显式循环同时记三样。
    passes = 0
    everyone = True
    full_marks = False
    for mark in marks:
        if mark >= pass_mark:
            passes += 1
        else:
            everyone = False
        if mark == 100:
            full_marks = True
    return passes, everyone, full_marks


def _insertion_by_score(players):
    # 被测：sorted(key=...)；参照：手写插入排序，只在分数**严格**更大时后移——
    # 同分的元素永远不越过彼此，所以它和 sorted 一样稳定。先拷贝，不动实参。
    out = list(players)
    for i in range(1, len(out)):
        item = out[i]
        j = i - 1
        while j >= 0 and out[j][1] > item[1]:
            out[j + 1] = out[j]
            j -= 1
        out[j + 1] = item
    return out


def _loop_clip(numbers):
    # 被测：推导式里 for 前面的条件表达式；参照：普通 for + if/else + append。
    out = []
    for n in numbers:
        if n < 0:
            out.append(0)
        else:
            out.append(n)
    return out


REFERENCES = {
    'squares-append-loop': {
        # 被测：for + append；参照：map + lambda。实测：n * n 改成 n * 2 即红。
        'ref': lambda xs: list(map(lambda x: x * x, xs)),
        'cases': _int_list,
    },
    'squares-comprehension': {
        # 被测：列表推导式；参照：map + lambda。实测：末尾加 if n（丢掉 0）即红。
        'ref': lambda xs: list(map(lambda x: x * x, xs)),
        'cases': _int_list,
    },
    'evens-comprehension': {
        # 实测：n % 2 == 0 改成 n % 4 == 0 即红。
        'ref': _loop_evens,
        'cases': _int_list,
    },
    'evens-filter': {
        # 实测：lambda 里加 n > 0 and（丢掉 0 与负偶数）即红。
        'ref': _loop_evens,
        'cases': _int_list,
    },
    'dict-and-set-comprehensions': {
        # 实测：遍历 reversed(mapping.items())（撞值时变成先来者留下）即红——撞值是生成器故意造的。
        'ref': _loop_invert,
        'cases': _str_int_dict,
    },
    'flatten-and-transpose': {
        # entry 只能点名一个函数：这里验 transpose（参照 zip(*m)）。flatten 只由
        # program_run_check 比对输出——设计 §7.7 给它列的参照 chain.from_iterable
        # 没有落点，见构建报告的偏离说明。不写一个门永远不调的参照函数：那是广告覆盖。
        # 实测：range(len(matrix[0])) 改成 range(len(matrix))（列数错取成行数）即红，红在 1×4 的非方阵上。
        'ref': _zip_transpose,
        'cases': _matrix,
    },
    'generator-sum-any-all': {
        # 实测：passes 那行的 >= 改成 >（及格线本身不算及格）即红。
        'ref': _loop_report,
        'cases': _marks,
    },
    'sorted-min-max-with-key': {
        # 实测：key 改成 (player[1], player[0])——同分改按名字排、不再保留原顺序——即红：
        # 值比对看得见稳定性，因为生成器让同分异名的元组常常出现。
        'ref': _insertion_by_score,
        'cases': _players,
    },
    'if-placement-in-comprehension': {
        # 实测：else 0 改成 else -n 即红。（>= 改成 > 测不出来：0 走哪一支结果都是 0。）
        'ref': _loop_clip,
        'cases': _int_list,
    },
}
