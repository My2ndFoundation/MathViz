"""ch02-strings 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面每条注释里「实测」的变异，都是把被测 `.py`
里那一行改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。
"""
import re
import string

from ._gen import rand_words

_PUNCT = " ,.!?'"


def _palindrome_phrase(rng):
    """一半实参是真回文（镜像后随机改大小写、随机插标点与空格），一半是随机串。

    纯随机串几乎从不是回文，只用 rand_words 的话「漏掉 lower()」这类只在回文上
    才露馅的变异永远测不到——所以要故意造回文。
    """
    alphabet = 'abcdeABCDE01'
    half = [rng.choice(alphabet) for _ in range(rng.randint(0, 6))]
    if rng.random() < 0.5:
        core = half + ([rng.choice(alphabet)] if rng.random() < 0.5 else []) + half[::-1]
    else:
        core = [rng.choice(alphabet) for _ in range(rng.randint(0, 12))]
    out = []
    for ch in core:
        if rng.random() < 0.3:
            out.append(rng.choice(_PUNCT))
        out.append(ch.swapcase() if rng.random() < 0.5 else ch)
    return (''.join(out),)


def _text_and_key(rng):
    pool = string.ascii_letters + string.digits + _PUNCT
    text = ''.join(rng.choice(pool) for _ in range(rng.randint(0, 20)))
    return text, rng.randint(-60, 60)


def _bit_string(rng):
    # 至少 1 位：int('', 2) 会抛 ValueError，而空串不是一个二进制数。
    return (''.join(rng.choice('01') for _ in range(rng.randint(1, 16))),)


def _password(rng):
    pool = string.ascii_lowercase * 2 + string.ascii_uppercase + string.digits + ' &!'
    return (''.join(rng.choice(pool) for _ in range(rng.randint(0, 12))),)


def _mirror_palindrome(text):
    # 规整用正则（被测程序用 isalnum + 循环），比较用下标镜像（被测程序用切片反转）。
    s = re.sub(r'[^A-Za-z0-9]', '', text).lower()
    n = len(s)
    for i in range(n // 2):
        if s[i] != s[n - 1 - i]:
            return False
    return True


def _translate_caesar(text, key):
    k = key % 26
    lower = string.ascii_lowercase
    upper = string.ascii_uppercase
    table = str.maketrans(lower + upper, lower[k:] + lower[:k] + upper[k:] + upper[:k])
    return text.translate(table)


def _place_values(bits):
    # 按位权求和：最右一位权 1，往左每位翻倍。被测的 builtin 版本是 int(bits, 2)。
    total = 0
    weight = 1
    for bit in reversed(bits):
        if bit == '1':
            total += weight
        weight *= 2
    return total


def _regex_rules(password):
    failed = []
    if re.search(r'^.{8,}$', password) is None:
        failed.append("at least 8 characters")
    if re.search(r'[A-Z]', password) is None:
        failed.append("an upper-case letter")
    if re.search(r'[a-z]', password) is None:
        failed.append("a lower-case letter")
    if re.search(r'[0-9]', password) is None:
        failed.append("a digit")
    if re.search(r' ', password) is not None:
        failed.append("no spaces")
    return failed


REFERENCES = {
    'reverse-string-slice': {
        # 被测的是切片 text[::-1]，参照是 reversed() 迭代器 + join：机制不同。
        'ref': lambda s: ''.join(reversed(s)),
        'cases': rand_words,
    },
    'reverse-string-loop': {
        # 被测的是「逐字符前插累加」，参照是 reversed() + join：机制不同。
        'ref': lambda s: ''.join(reversed(s)),
        'cases': rand_words,
    },
    'palindrome-cleaned': {
        # 被测：isalnum 循环规整 + 切片反转比较；参照：正则规整 + 下标镜像比较。
        'ref': _mirror_palindrome,
        'cases': _palindrome_phrase,
    },
    'caesar-shift': {
        # 被测：ord / chr / % 26 逐字符算；参照：str.maketrans 查表 + translate。
        'ref': _translate_caesar,
        'cases': _text_and_key,
    },
    'binary-to-denary-loop': {
        # 被测：从左到右 value * 2 + bit；参照：内置 int(s, 2)。
        'ref': lambda bits: int(bits, 2),
        'cases': _bit_string,
    },
    'binary-to-denary-builtin': {
        # 被测：int(bits, 2)；参照：从右到左按位权求和——绝不能拿 int(s, 2) 验它自己。
        'ref': _place_values,
        'cases': _bit_string,
    },
    'password-rules': {
        # 被测：一次遍历设标志位 + 逐条 if；参照：每条规则一个 re.search。
        'ref': _regex_rules,
        'cases': _password,
    },
}
