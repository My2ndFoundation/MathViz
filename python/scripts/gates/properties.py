"""property 的参考实现登记表。

规矩（spec §2.3）：新增一个 property 必须**同时写出它的参考实现**，
而且参考实现要用**与被测程序不同的机制**——否则这道门就退化成拿自己验自己
（根 CLAUDE.md 记过这类前科：把 `String(object)` 和自己比了 3600 次，宣布
一条结构定律"确认"）。

`ref` 拿被测程序的实参跑一遍，结果必须与被测程序的 `entry` 相同。
`cases` 产出随机实参（元组），跑 `SAMPLES` 组，种子固定为 `SEED`（门必须逐次可复现）。

裁决 R6：本表**按被测程序的 `id` 索引，不是按 property 族名**。`chapter.json` 里的
`check.property`（第 0 期合法取值只有 `"pure"`）只是一个族名，T14 的
`algorithm_property_check()` 用它挑错误信息的措辞，真正的参考实现与实参生成器
都是逐个程序单独登记的——同一个族名下的两个程序（这里 `max-of-three-if` 与
`max-of-three-builtin`）机制不同，参照也就必须不同，不能共用一份。

裁决 R26：`max-of-three-builtin.py` 的代码本身就是 `return max(a, b, c)`，如果拿
`max` 当它的参照，等于拿自己验自己——被测程序错的地方参照会跟着错，任何变异都测不出来。
所以三条参照都特意选了与被测程序**不同**的实现路径：

- `max-of-three-if`（手写 `if/elif/else` 分支链）—— 参照用内置 `max`：
  被测程序若某个分支条件写反（比如 `elif b > c` 漏了等号），三数相等时的返回值会
  和内置 `max` 的结果对不上，机制不同，这条错才测得出来。
- `max-of-three-builtin`（`return max(a, b, c)`）—— 参照用 `sorted([a, b, c])[-1]`：
  一个是比较链，一个是排序取末位，互不复用对方的判断逻辑；被测程序如果因为参数顺序
  写错（比如误传 `max(a, c, b)` 之类不会发生但假设发生的变体）依旧会被排序版抓到。
- `count-vowels-loop`（索引循环 + 累加器）—— 参照用生成式 `sum(...)`：
  被测程序若把判断写反（`not in` 打成 `in`）或者漏加一次，累加器路径与生成式路径
  给出的计数会不一致，两条路径没有共享的中间状态。
"""
import random
import string


def _rand_words(rng):
    return (''.join(rng.choice(string.ascii_letters + ' ') for _ in range(rng.randint(0, 30))),)


def _rand_triples(rng):
    return (rng.randint(-50, 50), rng.randint(-50, 50), rng.randint(-50, 50))


REFERENCES = {
    # 被测程序 id -> {'ref': 参考实现, 'cases': 实参生成器}
    'count-vowels-loop': {
        # 被测的是「索引循环 + 累加」，参考的是「生成式 + sum」：机制不同
        'ref': lambda s: sum(ch in 'aeiouAEIOU' for ch in s),
        'cases': _rand_words,
    },
    'max-of-three-if': {
        # 被测的是手写的 if/elif/else 分支链，参考的是内置 max()：机制不同
        'ref': lambda a, b, c: max(a, b, c),
        'cases': _rand_triples,
    },
    'max-of-three-builtin': {
        # 被测的是 max()，参考的是「排序取末位」：机制不同——绝不能拿 max 当
        # max() 自己的参照，那是拿自己验自己
        'ref': lambda a, b, c: sorted([a, b, c])[-1],
        'cases': _rand_triples,
    },
}

SAMPLES = 200
SEED = 20260916          # 固定种子：门必须逐次可复现
