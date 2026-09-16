"""ch01-basics 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。
"""
from ._gen import rand_triples, rand_words

REFERENCES = {
    # 被测程序 id -> {'ref': 参考实现, 'cases': 实参生成器}
    'count-vowels-loop': {
        # 被测的是「索引循环 + 累加」，参考的是「生成式 + sum」：机制不同
        'ref': lambda s: sum(ch in 'aeiouAEIOU' for ch in s),
        'cases': rand_words,
    },
    'max-of-three-if': {
        # 被测的是手写的 if/elif/else 分支链，参考的是内置 max()：机制不同。
        # 实测能被它抓住的变异见 properties.py 文件头（交错变量 / 比错一对）；「漏等号」
        # 那一类抓不住，因为漏掉 `=` 之后落到的那一支返回的是一个相等的值。
        'ref': lambda a, b, c: max(a, b, c),
        'cases': rand_triples,
    },
    'max-of-three-builtin': {
        # 被测的是 max()，参考的是「排序取末位」：机制不同——绝不能拿 max 当
        # max() 自己的参照，那是拿自己验自己。实测抓得住的是「漏参数 / 用错内置
        # 函数」；「参数顺序写错」抓不住，因为 max 本来就与实参顺序无关。
        'ref': lambda a, b, c: sorted([a, b, c])[-1],
        'cases': rand_triples,
    },
}
