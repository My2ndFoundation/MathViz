"""各章参照共用的实参生成器。

从 properties.py 原样搬来，**逐字符不改**：门的可复现性建立在「同一种子 + 同一段
生成代码 = 同一条实参流」上，改一个字符（哪怕只是调换 choice 的字母表顺序）就换了
一条流，文件头里任何「实测 N 组不匹配」的数字都会跟着失效。
"""
import string


def rand_words(rng):
    return (''.join(rng.choice(string.ascii_letters + ' ') for _ in range(rng.randint(0, 30))),)


def rand_triples(rng):
    return (rng.randint(-50, 50), rng.randint(-50, 50), rng.randint(-50, 50))
