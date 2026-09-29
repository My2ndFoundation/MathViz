"""ch11-dicts-sets 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面每条注释里「实测」的变异，都是把被测 `.py`
里那一行改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

⚠ 门先调被测函数、再用**同一份实参**调参照（第 2 期 M3 清单 §1.2）。本章被测函数都只读
实参、在内部建自己的字典 / 集合 / 列表；参照也一律不改实参。

⚠ 返回类型严格比较：被测的 Counter / defaultdict 版本在入口里转成普通 dict，参照也交回
普通 dict——`Counter({...}) == {...}` 为真，但门比较类型，两边必须同为 dict。
"""
import collections
import itertools


# ---------------------------------------------------------------- 生成器

def _words(rng):
    """词列表：约六分之一为空；其余的词取自两三个字母的小字母表、长度 1..3。

    清单要求「空列表与大量重复」：字母表窄到 ab / abc、词长至多 3，12 个词里重复是常态，
    计数加一写成加二、初值写成 0 这类变异在第一组非空实参上就露馅。
    """
    if rng.random() < 1 / 6:
        return ([],)
    alphabet = rng.choice(['ab', 'abc'])
    words = [''.join(rng.choice(alphabet) for _ in range(rng.randint(1, 3)))
             for _ in range(rng.randint(1, 12))]
    return (words,)


def _group_words(rng):
    """分组用的词：每个词非空（被测按 word[0] 取首字母，空串在它的声明之外）；列表可以为空。

    首字母只有 a..d 四种、同一首字母下常有多个词，组内顺序（保序）因此测得到。
    """
    if rng.random() < 1 / 8:
        return ([],)
    words = [''.join(rng.choice('abcd') for _ in range(rng.randint(1, 4)))
             for _ in range(rng.randint(1, 10))]
    return (words,)


_ROMAN_TABLE = [(1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'), (100, 'C'), (90, 'XC'),
                (50, 'L'), (40, 'XL'), (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')]


def _int_to_roman(n):
    out = []
    for value, symbols in _ROMAN_TABLE:
        while n >= value:
            out.append(symbols)
            n -= value
    return ''.join(out)


def _roman(rng):
    """1..3999 的合法罗马数字（清单要求；不喂非法串），由上面的 int -> roman 贪心生成。

    三分之一取 1..60：小数里 IV / IX / XL 与末位字母的比例高，「最后一个字母没有下一个」
    这条守卫路径每组都走，「比右边小就减」在小数上更密。其余在 1..3999 均匀取，覆盖 CM / CD / MMM。
    """
    if rng.random() < 1 / 3:
        return (_int_to_roman(rng.randint(1, 60)),)
    return (_int_to_roman(rng.randint(1, 3999)),)


def _dedupe_items(rng):
    """约六分之一为空；其余一半是 0..4 的整数、一半是 a..c 的单字母串，长度 1..12——重复是常态。"""
    if rng.random() < 1 / 6:
        return ([],)
    n = rng.randint(1, 12)
    if rng.random() < 0.5:
        return ([rng.randint(0, 4) for _ in range(n)],)
    return ([rng.choice('abc') for _ in range(n)],)


def _word_pair(rng):
    """两个词，约一半互为变位词。

    纯随机的两个串几乎从不互为变位词，「True」那一支会没人测，所以一半的 b 是把 a 的字母
    打乱重排；另一半的 b 与 a 等长、取自同一个 ab / abc 小字母表——aab 与 abb 这种
    「字母集合相同、次数不同」的对常出现，把计数换成集合比较的变异才测得到。偶尔 b 更长。
    a 可以是空串。
    """
    alphabet = rng.choice(['ab', 'abc'])
    a = ''.join(rng.choice(alphabet) for _ in range(rng.randint(0, 5)))
    r = rng.random()
    if r < 0.5:
        letters = list(a)
        rng.shuffle(letters)
        b = ''.join(letters)
    elif r < 0.9:
        b = ''.join(rng.choice(alphabet) for _ in range(len(a)))
    else:
        b = a + rng.choice(alphabet)
    return a, b


# ---------------------------------------------------------------- 参照

def _count_with_counter(words):
    # 被测：if in / else 两支。参照：collections.Counter（清单指定），转成普通 dict 与被测同型。
    return dict(collections.Counter(words))


def _count_with_list_count(words):
    # 被测：counts[w] = counts.get(w, 0) + 1。
    # 清单写的参照是 dict(Counter(words))，但 Counter 的计数就是这一行：collections.py 里
    # _count_elements 的纯 Python 版逐字是 mapping[elem] = mapping_get(elem, 0) + 1
    # （inspect.getsource(collections) 可见；CPython 用的 C 版本逻辑相同）——同源，改用
    # list.count 逐词数：不建计数表、不累加，机制不同。偏离见构建报告。
    return {word: words.count(word) for word in words}


def _count_with_if_in(words):
    # 被测：Counter；参照：refs 里另写的 if in 循环（清单指定）。
    counts = {}
    for word in words:
        if word in counts:
            counts[word] = counts[word] + 1
        else:
            counts[word] = 1
    return counts


def _group_with_groupby(words):
    # 被测：setdefault / defaultdict 逐个追加。参照：按首字母**稳定**排序后用 itertools.groupby
    # 切段——sorted 稳定，同一首字母内保持原先后，所以组内顺序与逐个追加一致。
    # 字典键的顺序不同（这里按字母表，被测按首次出现），但 dict 相等不看顺序。
    ordered = sorted(words, key=lambda word: word[0])
    return {letter: list(group) for letter, group in itertools.groupby(ordered, key=lambda word: word[0])}


_EXPAND = [('CM', 'DCCCC'), ('CD', 'CCCC'), ('XC', 'LXXXX'), ('XL', 'XXXX'), ('IX', 'VIIII'), ('IV', 'IIII')]
_WEIGHTS = (('M', 1000), ('D', 500), ('C', 100), ('L', 50), ('X', 10), ('V', 5), ('I', 1))


def _roman_by_expansion(numeral):
    # 被测：逐字查表 + 「比右边小就减」。参照：先用 str.replace 把六种减法组合展开成纯加法串，
    # 再按每个字母出现的次数乘权相加——不看相邻字母、不做减法，机制不同。
    for pair, spelled_out in _EXPAND:
        numeral = numeral.replace(pair, spelled_out)
    return sum(numeral.count(letter) * weight for letter, weight in _WEIGHTS)


def _dedupe_fromkeys(items):
    # 被测：seen 集合 + 结果列表。参照：list(dict.fromkeys(xs))（清单指定）。
    return list(dict.fromkeys(items))


def _dedupe_seen_loop(items):
    # 被测：list(dict.fromkeys(items))。参照：refs 里另写的 seen 循环（清单指定）。
    seen = set()
    out = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _anagram_sorted(a, b):
    # 被测：两张字母计数表比较。参照：排序后比较（清单指定）。
    return sorted(a) == sorted(b)


REFERENCES = {
    'word-count-if-in': {
        'ref': _count_with_counter,
        'cases': _words,
    },
    'word-count-get': {
        'ref': _count_with_list_count,
        'cases': _words,
    },
    'word-count-counter': {
        'ref': _count_with_if_in,
        'cases': _words,
    },
    'group-by-setdefault': {
        'ref': _group_with_groupby,
        'cases': _group_words,
    },
    'group-by-defaultdict': {
        'ref': _group_with_groupby,
        'cases': _group_words,
    },
    'roman-to-int-lookup': {
        'ref': _roman_by_expansion,
        'cases': _roman,
    },
    'dedupe-seen-set': {
        'ref': _dedupe_fromkeys,
        'cases': _dedupe_items,
    },
    'dedupe-dict-fromkeys': {
        'ref': _dedupe_seen_loop,
        'cases': _dedupe_items,
    },
    'anagram-check-counts': {
        'ref': _anagram_sorted,
        'cases': _word_pair,
    },
}
