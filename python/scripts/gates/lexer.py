"""D 组 · 词法器与判定器。

> **验证一个自己写的词法器，最坏的方式是用自己写的测试用例。** CPython 的
> `tokenize` 是这里的「免费 OpenSSL」——根 CLAUDE.md 拿 node 的 `crypto` 当独立
> 实现，同一条规矩。

`lex_vs_cpython_check` 是整套设计里最重要的一道，也是**最容易造错**的一道。两种
造错方式都已被实测撞到：

1. **比对必须是双向的逐区间相等，不能是「包含」。** 一个只断言「CPython 的每个
   token 起点也是 PyLex 的 token 起点」的探针，在 **44,081 个区间上报告零不匹配**，
   并且**通过了两个负控制**——包括计划亲自点名的那个「把 `//` 切成两个 `/`」。
   包含关系在结构上对**过度切分**失明，而过度切分正是这道门要抓的头号缺陷。
   （裁决 R24）
2. **CPython 对残缺字面量是 `raise` 而不是「给出不同答案」。** 实测 `0x` / `0b`
   抛 `invalid hexadecimal/binary literal`，`1e+` 抛 `invalid decimal literal`。
   门遇到这类输入必须**跳过**，否则它死在参照实现那一侧，报一个与被测代码毫无
   关系的错。（裁决 R25）

所以这里的比对是：两边各自算出一串 `(start, end, 类别)`，**按下标逐项相等**，
长度也必须相等。过度切分会让某一项对不上并让后面全部错位——正是要抓的那个。
"""
from __future__ import annotations

import io
import json
import os
import sys
import sysconfig
import tempfile
import tokenize

from . import CORE_DIR, iter_programs, read_text, run_node

# ── CPython tokenize 的 type -> PyLex 的 type 集合 ────────────────────────
# 只比对**这张表里的类别**的 (start, end) 区间；两边对 f-string 内部结构与空白
# 片段的处理必然不同，那部分不参与比对。差别写在这里，而不是散落在代码里。
TOKEN_MAP = {
    'NAME':    {'name', 'keyword', 'softkw', 'builtin'},
    'NUMBER':  {'number'},
    'STRING':  {'string', 'fstring'},
    'COMMENT': {'comment'},
    'OP':      {'op', 'punct'},
}
# PyLex 的 type -> 归一化到的 CPython 类别。由 TOKEN_MAP 反推，外加 decorator。
PYLEX_CATEGORY = {t: cat for cat, types in TOKEN_MAP.items() for t in types}
PYLEX_CATEGORY['decorator'] = 'DECORATOR'

# 不参与比对的 CPython 类别，以及为什么：
#   NEWLINE / NL / INDENT / DEDENT / ENDMARKER —— PyLex 不维护缩进栈（spec §4.2），
#       它把换行当 'nl'、把缩进当 'ws'，两边结构不同源，比对没有意义。
#   行续反斜杠 —— CPython 对 `t = a \<换行>    + b` 里的 `\` **一个 token 都不发**
#       （实测确认），而 PyLex 必须发一个才能保持无缝全覆盖。这条排除是 T1 的
#       实现者撞出来的真红，不是推测（R15）。所以下面把 PyLex 那一侧文本恰为
#       `\` 的 op token 丢掉。
#   FSTRING_START / MIDDLE / END（3.12+，PEP 701）—— PyLex 把整个 f 串当一个
#       token。所以 f 串在这里只比**整体区间**：CPython 的 START..END 合并后的
#       (start, end) 必须等于 PyLex 那一个 fstring token 的 (start, end)。
#       3.11 及以前 CPython 直接给一个 STRING，形状不同——两种都要处理，而且
#       **每次运行都打印跑在哪个 Python 版本上**，因为这一章十条 f-string 是这道
#       门的主力语料，它天生属于「本地绿 / CI 红」家族（R19）。
#   '@' 装饰器 —— PyLex 把 '@name'（含点分名字）合成一个 decorator token，
#       CPython 切成 OP + NAME(+ OP '.' + NAME)*。所以装饰器行只比**合并后的
#       整体区间**，而「这个 @ 算不算装饰器」由本文件**独立**跟踪括号深度与
#       逻辑行首来判定——**不能问 PyLex**，那样就成了拿被测者的答案当参照。
# 这张「不参与比对」的清单不是注释，是一条**被执行的**规则：任何既不在
# TOKEN_MAP 也不在这里的 CPython 类别，都会被 _cpython_intervals() 记下来并让这道
# 门变红。悄悄忽略一个没见过的类别，正是「在结构上无法观察到它声称排除之物」的
# 那种形状——新版本 CPython 加一个 token 类型，门会安静地少比一批区间。
IGNORED_CPYTHON = {'NEWLINE', 'NL', 'INDENT', 'DEDENT', 'ENDMARKER', 'ENCODING'}
LINE_CONTINUATION = '\\'

# ── 固定的全运算符语料（R18）────────────────────────────────────────────
# 实测 ch01 只出现 `!=` `**` `//` `==` `>=`，**没有** `<=` `<` `>` `->` `+=` `:=`。
# 光拿程序库当语料，这道门覆盖到的运算符还不到表里的六分之一。
OPERATOR_CORPUS = '''\
import functools


@functools.lru_cache(maxsize=None)
def ops(a, b, c=1, *args, **kwargs) -> int:
    t = a + b - c * 2 / 3 // 4 % 5 ** 6
    t += 1
    t -= 2
    t *= 3
    t /= 4
    t //= 5
    t %= 6
    t **= 7
    t &= 8
    t |= 9
    t ^= 10
    t >>= 1
    t <<= 1
    u = (a & b) | (a ^ b) | (~a) | (a << 1) | (a >> 1)
    v = a < b <= c and a > b >= c or a == b != c
    w = a if b else c
    x = [1, 2, 3][0:2:1]
    y = {'k': 1}['k']
    z = {1, 2}
    n = lambda p, q=2, *r, **s: p @ q
    if (m := a + b) > 0:
        del x
    q = a \\
        + b
    mat = (a
           @b)
    e = ...
    f = not a in z is not None
    return t + u + v + w + q + f + n(1, 2) + e.__class__ is z


class Sample(dict):
    """Docstring with 'quotes' and "double quotes"."""

    attr: int = 0

    async def go(self, items):
        async for i in items:
            await i
        async with self as s:
            yield s
        for k, val in sorted(self.items(), key=lambda kv: kv[1]):
            print(f"{k}={val!r:>8} {val:{width}.2f}", end='')
        try:
            pass
        except (ValueError, TypeError) as exc:
            raise RuntimeError("bad") from exc
        finally:
            global _cache
        while True:
            break
        else:
            continue


NUMBERS = [0, 1, 10, 0x1F, 0o17, 0b1010, 1_000_000, 1.5, .5, 1., 1e10, 1E-10,
           1.5e+3, 3j, 2.5J, 0xdeadBEEF, 1_0.2_5e1_0]
STRINGS = [
    'single', "double", \'\'\'triple single\'\'\', \"\"\"triple double\"\"\",
    r'raw\\d+', rb'rawbytes', b'bytes', BR"\\x00", f'fmt{1 + 2}',
    rf'rawfmt{1!s}', u'unicode', 'concat' 'enation',
]
match NUMBERS:
    case [first, *rest] if first == 0:
        type Alias = int
    case _:
        pass
'''

# ── 畸形语料（never-throws / roundtrip 用）────────────────────────────────
# 其中 `0x` `0b` `1e+` 在 CPython 那一侧是 **raise**（R25），所以它们只喂
# PyLex，不参与 lex_vs_cpython_check 的比对。
MALFORMED_CORPUS = {
    'empty': '',
    'only-space': '   \n\t\n  ',
    'unterminated-single': "s = 'abc",
    'unterminated-double': 's = "abc\nnext = 1\n',
    'unterminated-triple': 'x = """abc\ndef\n',
    'unterminated-triple-prefix': "y = rb'''abc\n",
    'unterminated-fstring': 'z = f"abc{1 + ',
    'lone-backslash': 'x = 1 \\',
    'backslash-eof': '\\',
    'stray-dollar': 'x = $y\n',
    'stray-question': 'a ? b\n',
    'stray-bang': 'a ! b\n',
    'hex-truncated': 'x = 0x\n',
    'bin-truncated': 'x = 0b\n',
    'oct-truncated': 'x = 0o\n',
    'exp-truncated': 'x = 1e+\n',
    'exp-bare': 'x = 1e\n',
    'dot-only': '.\n',
    'unbalanced-open': 'f(a, [b, {c\n',
    'unbalanced-close': ')]}\n',
    'at-alone': '@\n',
    'at-mid': 'c = a@b\n',
    'at-decorator-dotted': '@a.b.c\ndef f(): pass\n',
    'crlf': 'x = 1\r\ny = 2\r\n',
    'lone-cr': 'x = 1\ry = 2\r',
    # ⚠ 这里必须是**真的**非 BMP 字符（U+1F680 在 JS 里是一对代理项），不是
    # 「rocket」这个词。写成单词的版本让整份畸形语料的最高码位停在 U+007D，于是
    #   · `lex_vs_cpython_check` 那条「含非 BMP → 跳过」的分支一次都不执行；
    #   · PyLex 在代理对上的行为，四道词法门一条都没测过——而
    #     `source_bmp_check` 存在的全部理由就是「CPython 给字符偏移、JS 给
    #     UTF-16 码元偏移」，那条分歧在词法器侧从未被观察；
    #   · 一条叫 emoji 的语料会让下一个人相信这件事有覆盖。
    # 第三条最要命：那正是本仓反复点名的「广告一份它并不具备的覆盖」。
    'emoji': 'x = 1  # \U0001F680\n',
    'fullwidth': 'x = 1  # \uff1b\n',
    'tabs': 'def f():\n\treturn 1\n',
    'nul-ish-control': 'x = 1\x0b\n',
    'prefix-not-prefix': "ru'x'\n",
    'nested-brackets': '[[[[[[[[[[\n',
    'half-op': 'a //\n',
    'comment-eof': '# no newline at eof',
    'bom-ish': '\ufeffx = 1\n',
}

# ── 判定器的正负样例表 ───────────────────────────────────────────────────
# 「判同」= 判定器该吞掉的差异；「判异」= 判定器必须留住的差异。
# 严格是有意的（judge.js 文件头）：多写法由题库层面的「一题多变体」容纳，
# 不靠放宽判定。
JUDGE_CASES = [
    # (标签, 参考答案, 使用者答案, 期望 ok)
    ('空白：token 之间加空格',      'x = 1',            'x   =    1',        True),
    ('空白：去掉全部空格',          'x = 1',            'x=1',              True),
    ('空白：行尾空白',              'x = 1',            'x = 1   ',         True),
    ('注释：末尾加注释',            'x = 1',            'x = 1  # hi',      True),
    ('注释：整行注释',              'x = 1',            '# note\nx = 1',    True),
    ('引号风格：单引号 vs 双引号',  "s = 'a'",          's = "a"',          False),
    ('引号风格：三引号',            "s = 'a'",          "s = '''a'''",      False),
    ('数字写法：10000000000 vs 1e10', 'n = 10000000000', 'n = 1e10',        False),
    ('数字写法：1 vs 1.0',          'n = 1',            'n = 1.0',          False),
    ('数字写法：255 vs 0xff',       'n = 255',          'n = 0xff',         False),
    ('相对缩进：内层多缩进四格',
     'if x:\n    y = 1\n    z = 2', 'if x:\n    y = 1\n        z = 2',      False),
    ('少写一个 token',              'a + b',            'a +',              False),
    ('多写一个 token',              'a + b',            'a + b + c',        False),
    ('换了一个 token',              'a // b',           'a / b',            False),
]

# 拿来当语料的标准库文件。**不是随手挑的**：小、稳定、纯 ASCII、语法不花哨。
# 少一个不致命（不同发行版会裁剪 stdlib），但**至少要有 STDLIB_MIN 个**——
# 否则这一路语料可能整条消失而门照样报绿。
STDLIB_FILES = ('string.py', 'textwrap.py', 'bisect.py', 'colorsys.py',
                'types.py', 'copy.py', 'fractions.py', 'dataclasses.py')
STDLIB_MIN = 4


def _incomparable(src: str):
    """这段源码能不能拿去跟 CPython 对表？不能的话返回原因。

    两条结构性排除，都是**实测撞出来的**，不是预防性的：

    · **BOM（U+FEFF）**：CPython 的 `tokenize` 把它并进后面那个 NAME
      （`'\\ufeffx'` 是一个 NAME），PyLex 把它当空白丢掉（JS 的 `\\s` 匹配
      U+FEFF）。两边都不算错——一个 BOM 出现在这里本来就是坏数据，而
      `hygiene.control_byte_check()` 在真实源码里直接禁掉了它。
    · **裸 CR**（`\\r` 后面不跟 `\\n`）：CPython 把它并进相邻 token
      （实测 `'x = 1\\ry = 2'` 给出一个 OP `'\\ry'`），PyLex 把它当换行。
      同样被 `control_byte_check()` 禁掉。

    写成**结构判据**而不是按名字拉黑名单：黑名单会随着「哪条今天红了」增长，
    判据不会。排除的每一条都在输出里逐条打印。
    """
    if '﻿' in src:
        return 'BOM：CPython 把它并进后面的 NAME，PyLex 当空白丢掉——' \
               'control_byte_check() 在真实源码里已禁掉它'
    for i, ch in enumerate(src):
        if ch == '\r' and src[i + 1:i + 2] != '\n':
            return '裸 CR：CPython 把它并进相邻 token，PyLex 当换行——' \
                   'control_byte_check() 在真实源码里已禁掉它'
    return None


def _line_starts(src: str) -> list:
    starts = [0]
    for i, ch in enumerate(src):
        if ch == '\n':
            starts.append(i + 1)
    return starts


def _corpus() -> list:
    """(名字, 源码) 的完整语料：全部 `.py` + 固定运算符语料 + 若干 stdlib 文件。"""
    items = []
    for chapter_dir, _data, prog, py_path in iter_programs():
        if py_path.exists():
            items.append((f'{chapter_dir.name}/{py_path.name}', read_text(py_path)))
    items.append(('<固定运算符语料>', OPERATOR_CORPUS))
    stdlib = sysconfig.get_paths().get('stdlib', '')
    found = 0
    for name in STDLIB_FILES:
        path = os.path.join(stdlib, name)
        if os.path.exists(path):
            try:
                items.append((f'<stdlib>/{name}',
                              open(path, encoding='utf-8').read()))
                found += 1
            except (OSError, UnicodeDecodeError):
                pass
    return items, found


def _pylex_tokens(sources: dict) -> dict:
    """在裸 vm 沙箱里跑 py-lex 的**浏览器分支**，返回 {名字: [[type, start, end], ...]}。

    抛错的那一条返回 {'throw': 消息}，由调用方各自决定怎么处理——这个函数不替
    调用方判定，因为「抛了算不算红」在调用它的几道门里不是同一个答案。
    """
    with tempfile.TemporaryDirectory() as td:
        data = os.path.join(td, 'corpus.json')
        with open(data, 'w', encoding='utf-8') as fh:
            json.dump(sources, fh, ensure_ascii=True)
        script = (
            'const vm = require("vm"), fs = require("fs");\n'
            'const sandbox = {}; sandbox.self = sandbox;\n'
            'vm.createContext(sandbox);\n'
            'if (typeof sandbox.module !== "undefined" ||'
            ' typeof sandbox.require !== "undefined") {\n'
            '  console.error("沙箱不干净：测的是 node 分支"); process.exit(1); }\n'
            f'vm.runInContext(fs.readFileSync({json.dumps(str(CORE_DIR / "py-lex.js"))},'
            ' "utf8"), sandbox);\n'
            f'const corpus = JSON.parse(fs.readFileSync({json.dumps(data)}, "utf8"));\n'
            'const out = {};\n'
            'for (const k of Object.keys(corpus)) {\n'
            '  try {\n'
            '    out[k] = sandbox.PyLex.tokenize(corpus[k])'
            '      .map(function (t) { return [t.type, t.start, t.end]; });\n'
            '  } catch (e) { out[k] = { throw: String(e && e.message || e) }; }\n'
            '}\n'
            'process.stdout.write(JSON.stringify(out));\n')
        proc = run_node(script)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return json.loads(proc.stdout)


# ══════════════════════════════════════════════════════════════════════════
# lex_roundtrip_check
# ══════════════════════════════════════════════════════════════════════════

def lex_roundtrip_check() -> int:
    """`Editor.highlight(src)` 拼回去逐字节等于原文，且 token 无缝全覆盖。

    两条一起验，缺一不可：**只验 highlight 的往返是不够的**——`highlight` 里有
    一条防御性降级路径（tokenize 抛错时整篇退成一个 `tok-plain` 片段），那条路径
    下 `join('') === src` **照样成立**。所以必须另外直接问 `PyLex.tokenize`：
    首 token 起点是 0、相邻 token 首尾相接、末 token 终点等于 `src.length`。
    这三条是 py-lex 文件头的构造性保证，也是三层影子临摹逐字符对齐的全部地基。

    语料 = 全部 `.py` + 畸形语料。畸形那一份尤其重要：使用者打字打到一半，源码
    几乎总是暂时不合法，而那正是编辑器最需要不塌的时刻。
    """
    items, stdlib_found = _corpus()
    # 与 lex_vs_cpython_check 同一条守卫，理由也一模一样：stdlib 那一路语料是
    # 这道门最真实的那一批（8 份陌生代码，不是我自己写的十个教学程序），而它在
    # CI 上**会**因为发行版裁剪 stdlib 而整条消失。没有这条判据时，少跑 8 份语料
    # 的表现是 `n` 变小——一个只被打印、不被比对的数字，也就是报绿。
    # 同一个 `_corpus()`、同一批文件、同一个失败模式，两道门必须同一条守卫。
    if stdlib_found < STDLIB_MIN:
        print(f'ERROR: 只找到 {stdlib_found} 个标准库语料文件，至少要 {STDLIB_MIN} 个。\n'
              f'       stdlib 那一路语料整条消失而门照样报绿，是这道门最容易出现的'
              f'空转形态。', file=sys.stderr)
        return 1
    sources = {name: src for name, src in items}
    for name, src in MALFORMED_CORPUS.items():
        sources[f'<畸形>/{name}'] = src
    with tempfile.TemporaryDirectory() as td:
        data = os.path.join(td, 'corpus.json')
        with open(data, 'w', encoding='utf-8') as fh:
            json.dump(sources, fh, ensure_ascii=True)
        script = (
            'const vm = require("vm"), fs = require("fs");\n'
            'const sandbox = {}; sandbox.self = sandbox;\n'
            'vm.createContext(sandbox);\n'
            'if (typeof sandbox.module !== "undefined") {\n'
            '  console.error("沙箱不干净"); process.exit(1); }\n'
            f'vm.runInContext(fs.readFileSync({json.dumps(str(CORE_DIR / "py-lex.js"))},'
            ' "utf8"), sandbox);\n'
            f'vm.runInContext(fs.readFileSync({json.dumps(str(CORE_DIR / "editor.js"))},'
            ' "utf8"), sandbox);\n'
            f'const corpus = JSON.parse(fs.readFileSync({json.dumps(data)}, "utf8"));\n'
            'const bad = []; let n = 0, toks = 0;\n'
            'for (const k of Object.keys(corpus)) {\n'
            '  const src = corpus[k]; n++;\n'
            '  let frags;\n'
            '  try { frags = sandbox.Editor.highlight(src); }\n'
            '  catch (e) { bad.push(k + "：highlight 抛错 " + e.message); continue; }\n'
            '  const joined = frags.map(function (f) { return f.text; }).join("");\n'
            '  if (joined !== src) {\n'
            '    let i = 0; while (i < joined.length && i < src.length'
            ' && joined[i] === src[i]) i++;\n'
            '    bad.push(k + "：highlight 拼回去 != 原文，第 " + i + " 个字符起"'
            ' + " 原文=" + JSON.stringify(src.slice(i, i + 24))'
            ' + " 拼回=" + JSON.stringify(joined.slice(i, i + 24)));\n'
            '    continue; }\n'
            '  let ts;\n'
            '  try { ts = sandbox.PyLex.tokenize(src); }\n'
            '  catch (e) { bad.push(k + "：tokenize 抛错 " + e.message); continue; }\n'
            '  toks += ts.length;\n'
            '  if (src.length === 0) { if (ts.length) bad.push(k + "：空串却有 token");'
            ' continue; }\n'
            '  if (!ts.length) { bad.push(k + "：非空源码却没有 token"); continue; }\n'
            '  if (ts[0].start !== 0) { bad.push(k + "：首 token 起点是 " + ts[0].start'
            ' + "，不是 0"); }\n'
            '  for (let i = 0; i + 1 < ts.length; i++) {\n'
            '    if (ts[i].end !== ts[i + 1].start) {\n'
            '      bad.push(k + "：第 " + i + " 与第 " + (i + 1) + " 个 token 之间有缝——"'
            ' + ts[i].end + " != " + ts[i + 1].start'
            ' + "（漏掉 " + JSON.stringify(src.slice(ts[i].end, ts[i + 1].start)) + "）");'
            ' break; } }\n'
            '  const last = ts[ts.length - 1];\n'
            '  if (last.end !== src.length) { bad.push(k + "：末 token 终点是 " + last.end'
            ' + "，源码长 " + src.length); }\n'
            '}\n'
            'if (bad.length) { bad.slice(0, 12).forEach(function (b) {'
            ' console.error("FAIL " + b); });\n'
            '  console.error("共 " + bad.length + " 条"); process.exit(1); }\n'
            'console.log(JSON.stringify({ n: n, toks: toks }));\n')
        proc = run_node(script)
    if proc.returncode != 0:
        print('ERROR: 词法往返/无缝覆盖不成立：', file=sys.stderr)
        print((proc.stderr or proc.stdout).strip(), file=sys.stderr)
        return 1
    stat = json.loads(proc.stdout)
    print(f'词法往返：{stat["n"]} 份语料（含 {len(MALFORMED_CORPUS)} 份畸形）、'
          f'{stat["toks"]} 个 token，拼回去逐字节等于原文且无缝全覆盖')
    return 0


# ══════════════════════════════════════════════════════════════════════════
# lex_vs_cpython_check
# ══════════════════════════════════════════════════════════════════════════

def _cpython_intervals(src: str, unknown: set = None):
    """把一段源码切成 [(start, end, 类别), ...]，f 串与装饰器已合并。

    抛 `tokenize` 的异常给调用方，由它决定跳过（R25）。
    `unknown` 传进来时，把遇到的、既不比对也没登记在 IGNORED_CPYTHON 里的类别
    记进去——调用方据此报红，而不是让它们悄悄消失。
    """
    starts = _line_starts(src)

    def off(pos):
        row, col = pos
        return starts[row - 1] + col

    toks = list(tokenize.generate_tokens(io.StringIO(src).readline))
    out = []
    depth = 0
    line_start = True
    i = 0
    while i < len(toks):
        t = toks[i]
        name = tokenize.tok_name[t.type]

        if name == 'ERRORTOKEN':
            raise tokenize.TokenError(f'ERRORTOKEN {t.string!r}', t.start)

        if name == 'FSTRING_START':
            # PEP 701（3.12+）：START..END 合并成一个区间，内部结构不参与比对。
            depth_f = 0
            j = i
            while j < len(toks):
                n2 = tokenize.tok_name[toks[j].type]
                if n2 == 'FSTRING_START':
                    depth_f += 1
                elif n2 == 'FSTRING_END':
                    depth_f -= 1
                    if depth_f == 0:
                        break
                j += 1
            if j >= len(toks):
                raise tokenize.TokenError('FSTRING_START 没有配对的 FSTRING_END', t.start)
            out.append((off(t.start), off(toks[j].end), 'STRING'))
            line_start = False
            i = j + 1
            continue

        # ⚠ 括号深度在这里有**两道冗余的闸**：这个 `depth == 0`，以及下面
        # 「NL 只在 depth == 0 时才开新逻辑行」。任何一道单独留着都挡得住
        # `mat = (a\n       @b)` 那种括号内续行，所以**只拆一道看不出区别**——
        # 实测两道都拆掉才会红（固定运算符语料第 210 个区间：CPython 的
        # DECORATOR '@b' 对 PyLex 的 OP '@'）。留着两道是有意的；要验这条规则
        # 有没有被执行，必须两道一起拆。
        if (name == 'OP' and t.string == '@' and line_start and depth == 0
                and i + 1 < len(toks)
                and tokenize.tok_name[toks[i + 1].type] == 'NAME'
                and off(toks[i + 1].start) == off(t.end)):
            # PyLex 把 '@name'（含点分名字）合成一个 decorator token。
            # 「这个 @ 算不算装饰器」由本函数**独立**判定（自己跟踪括号深度与
            # 逻辑行首），不问 PyLex——否则就是拿被测者的答案当参照。
            end = off(toks[i + 1].end)
            j = i + 2
            while (j + 1 < len(toks)
                   and tokenize.tok_name[toks[j].type] == 'OP' and toks[j].string == '.'
                   and off(toks[j].start) == end
                   and tokenize.tok_name[toks[j + 1].type] == 'NAME'
                   and off(toks[j + 1].start) == off(toks[j].end)):
                end = off(toks[j + 1].end)
                j += 2
            out.append((off(t.start), end, 'DECORATOR'))
            line_start = False
            i = j
            continue

        if name in TOKEN_MAP:
            out.append((off(t.start), off(t.end), name))
        elif unknown is not None and name not in IGNORED_CPYTHON \
                and not name.startswith('FSTRING_'):
            unknown.add(name)

        # ── 逻辑行首与括号深度的记账，逐条对应 py-lex.js 的 push() ──
        # 裁决 R20：**CPython 在括号内照样发 NL**，所以「上一个 token 是 NL」
        # 不等于逻辑行首。必须自己跟踪括号深度，否则这道门会对着一个正确的
        # 词法器报红。
        if name == 'COMMENT':
            pass                                   # ws / comment 不影响行首
        elif name in ('NEWLINE', 'NL'):
            if depth == 0:
                line_start = True
        elif name in ('INDENT', 'DEDENT', 'ENCODING', 'ENDMARKER'):
            pass                                   # PyLex 把缩进当 ws
        else:
            if name == 'OP':
                if t.string in '([{':
                    depth += 1
                elif t.string in ')]}':
                    depth = max(0, depth - 1)
            line_start = False
        i += 1
    return out


def _pylex_intervals(tokens, src: str):
    out = []
    for ttype, start, end in tokens:
        if ttype in ('ws', 'nl'):
            continue
        if ttype == 'op' and src[start:end] == LINE_CONTINUATION:
            # 行续反斜杠：CPython 一个 token 都不发，PyLex 必须发一个才能无缝（R15）
            continue
        cat = PYLEX_CATEGORY.get(ttype)
        if cat is None:
            out.append((start, end, f'<未登记类型 {ttype}>'))
            continue
        out.append((start, end, cat))
    return out


def lex_vs_cpython_check() -> int:
    """拿 CPython 的 `tokenize` 当独立裁判，**双向逐区间相等**地对表。

    每次运行都打印跑在哪个 Python 版本上：PEP 701 让 3.12+ 与 3.11- 对 f-string
    给出**完全不同的 token 形状**，而这一章十条 f-string 是本门的主力语料。
    一道在两个版本上行为不同的门，天生属于「本地绿 / CI 红」家族（R19）。
    """
    py = sys.version_info
    print(f'  lex_vs_cpython_check 跑在 CPython {py.major}.{py.minor}.{py.micro} 上'
          f'（f-string 形状：{"PEP 701 的 FSTRING_START/MIDDLE/END" if py >= (3, 12) else "单个 STRING"}）')

    items, stdlib_found = _corpus()
    # 畸形语料也进比对池。**不是为了多测几条**，是为了让 R25 那条「CPython 自己
    # 就拒绝它 → 跳过」的分支每次运行都真的被执行：只喂合法源码的话，那条分支
    # 一次都不跑，而一段从没执行过的跳过逻辑，等到第一次真需要它时才第一次运行。
    # CPython 接受的那几条（`1e`、`a//`、`ru'x'` …）照常参与比对，白赚一份覆盖。
    items = items + [(f'<畸形>/{k}', v) for k, v in MALFORMED_CORPUS.items()]
    if stdlib_found < STDLIB_MIN:
        print(f'ERROR: 只找到 {stdlib_found} 个标准库语料文件，至少要 {STDLIB_MIN} 个。\n'
              f'       程序库本身覆盖不到半数运算符（R18 实测：ch01 只出现 '
              f'!= ** // == >=），\n'
              f'       stdlib 那一路语料整条消失而门照样报绿，是这道门最容易出现的'
              f'空转形态。', file=sys.stderr)
        return 1

    sources = {}
    skipped = []
    for name, src in items:
        if any(ord(ch) > 0xFFFF for ch in src):
            skipped.append((name, '含非 BMP 字符：CPython 给字符偏移、JS 给 UTF-16 '
                                  '码元偏移，两边不可比'))
            continue
        why = _incomparable(src)
        if why:
            skipped.append((name, why))
            continue
        try:
            _cpython_intervals(src)
        except (tokenize.TokenError, SyntaxError, IndentationError) as exc:
            # R25：CPython 对残缺字面量是 raise 而不是给出不同答案。门必须跳过，
            # 否则它死在参照实现那一侧，报一个与被测代码无关的错。
            skipped.append((name, f'CPython 自己就拒绝它：{type(exc).__name__}: {exc}'))
            continue
        sources[name] = src

    if not sources:
        print('ERROR: 没有一份语料能跟 CPython 对表——这道门跑了个寂寞', file=sys.stderr)
        return 1

    try:
        pylex = _pylex_tokens(sources)
    except RuntimeError as exc:
        print(f'ERROR: 在裸 vm 里跑 py-lex 失败：{exc}', file=sys.stderr)
        return 1

    rc = 0
    compared = 0
    unknown: set = set()
    for name in sorted(sources):
        src = sources[name]
        toks = pylex.get(name)
        if isinstance(toks, dict):
            print(f'ERROR: {name}：PyLex.tokenize 抛错 {toks.get("throw")!r}——'
                  f'它按设计永不抛错', file=sys.stderr)
            rc = 1
            continue
        want = _cpython_intervals(src, unknown)
        got = _pylex_intervals(toks, src)
        if want == got:
            compared += len(want)
            continue
        rc = 1
        k = 0
        while k < len(want) and k < len(got) and want[k] == got[k]:
            k += 1
        starts = _line_starts(src)

        def where(off_):
            row = max(i for i, s in enumerate(starts) if s <= off_) + 1
            return f'{row}:{off_ - starts[row - 1] + 1}'

        w = want[k] if k < len(want) else None
        g = got[k] if k < len(got) else None
        print(f'ERROR: {name} 的第 {k} 个区间与 CPython 不符'
              f'（CPython {len(want)} 个 / PyLex {len(got)} 个）', file=sys.stderr)
        if w:
            print(f'    CPython：{w[2]:9} [{w[0]}, {w[1]}) @ {where(w[0])}  '
                  f'{src[w[0]:w[1]]!r}', file=sys.stderr)
        else:
            print('    CPython：（到头了）', file=sys.stderr)
        if g:
            print(f'    PyLex  ：{g[2]:9} [{g[0]}, {g[1]}) @ {where(g[0])}  '
                  f'{src[g[0]:g[1]]!r}', file=sys.stderr)
        else:
            print('    PyLex  ：（到头了）', file=sys.stderr)
        print(f'    上下文：{src[max(0, (w or g)[0] - 40):(w or g)[1] + 40]!r}',
              file=sys.stderr)

    if unknown:
        print(f'ERROR: 遇到既不比对、也没登记在 IGNORED_CPYTHON 里的 CPython token '
              f'类别：{sorted(unknown)}\n'
              f'       悄悄忽略它等于少比一批区间。要么把它映进 TOKEN_MAP，'
              f'要么把它写进 IGNORED_CPYTHON 并说明为什么。', file=sys.stderr)
        rc = 1

    for name, why in skipped:
        print(f'  跳过 {name}：{why}')
    if rc == 0:
        print(f'与 CPython 对表：{len(sources)} 份语料、{compared} 个区间'
              f'**双向逐项相等**（不是包含关系——R24），跳过 {len(skipped)} 份')
    return rc


# ══════════════════════════════════════════════════════════════════════════
# judge_strictness_check
# ══════════════════════════════════════════════════════════════════════════

def judge_strictness_check() -> int:
    """判定器的正负样例表：该吞的差异吞掉，该留的差异留住。

    严格是有意的，不是偷懒（judge.js 文件头）。Python 允许同一件事写出好几种等价
    写法，但这里不靠「放宽判定」去容纳它们——多写法由「同一问题给多个变体程序」
    在题库层面容纳。判定器只吞 token 之间的空白与注释。

    **两个方向都要在表里**：只列「该判同」的用例，一个把什么都判成相同的判定器
    会全绿；只列「该判异」的，一个什么都判不同的判定器会全绿。
    """
    positives = sum(1 for c in JUDGE_CASES if c[3])
    negatives = len(JUDGE_CASES) - positives
    if not positives or not negatives:
        print('ERROR: 样例表必须两个方向都有——只有一个方向时，一个「永远判同」'
              '或「永远判异」的判定器会全绿', file=sys.stderr)
        return 1

    cases = [{'label': lbl, 'ref': ref, 'ans': ans, 'ok': ok}
             for lbl, ref, ans, ok in JUDGE_CASES]
    with tempfile.TemporaryDirectory() as td:
        data = os.path.join(td, 'cases.json')
        with open(data, 'w', encoding='utf-8') as fh:
            json.dump(cases, fh, ensure_ascii=True)
        script = (
            'const vm = require("vm"), fs = require("fs");\n'
            'const sandbox = {}; sandbox.self = sandbox;\n'
            'vm.createContext(sandbox);\n'
            'if (typeof sandbox.module !== "undefined") {\n'
            '  console.error("沙箱不干净"); process.exit(1); }\n'
            f'vm.runInContext(fs.readFileSync({json.dumps(str(CORE_DIR / "py-lex.js"))},'
            ' "utf8"), sandbox);\n'
            f'vm.runInContext(fs.readFileSync({json.dumps(str(CORE_DIR / "judge.js"))},'
            ' "utf8"), sandbox);\n'
            f'const cases = JSON.parse(fs.readFileSync({json.dumps(data)}, "utf8"));\n'
            'const bad = [];\n'
            'cases.forEach(function (c) {\n'
            '  let r;\n'
            '  try { r = sandbox.Judge.compare(c.ans, c.ref); }\n'
            '  catch (e) { bad.push(c.label + "：compare 抛错 " + e.message); return; }\n'
            '  if (!!r.ok !== !!c.ok) {\n'
            '    bad.push(c.label + "：期望 " + (c.ok ? "判同" : "判异") + "，实际 "'
            ' + (r.ok ? "判同" : "判异 kind=" + r.kind + " index=" + r.index'
            ' + " expected=" + JSON.stringify(r.expected)'
            ' + " got=" + JSON.stringify(r.got))'
            ' + "\\n      参考=" + JSON.stringify(c.ref)'
            ' + "\\n      作答=" + JSON.stringify(c.ans)); }\n'
            '});\n'
            'if (bad.length) { bad.forEach(function (b) { console.error("FAIL " + b); });'
            ' process.exit(1); }\n'
            'console.log("OK");\n')
        proc = run_node(script)
    if proc.returncode != 0:
        print('ERROR: 判定器的严格度与样例表不符：', file=sys.stderr)
        print((proc.stderr or proc.stdout).strip(), file=sys.stderr)
        return 1
    print(f'判定严格度：{len(JUDGE_CASES)} 条样例（{positives} 条该判同、'
          f'{negatives} 条该判异）全部符合')
    return 0


# ══════════════════════════════════════════════════════════════════════════
# lex_never_throws_check
# ══════════════════════════════════════════════════════════════════════════

def lex_never_throws_check() -> int:
    """畸形语料逐条喂 `PyLex.tokenize`，**一条都不许抛**。

    这不是「稳健性加分项」，是三层影子临摹的前提：使用者打字打到一半，源码几乎
    总是暂时不合法。chess 那边走的是另一条路（tokenize 允许抛、抛了整篇降级成
    纯文本），代价写在它自己的注释里——「一个引号没有闭合期间，整份文档都会短暂
    失去颜色」，而那个代价会一直付。这里从设计上绕开，所以必须有一道门守住。
    """
    sources = {f'<畸形>/{k}': v for k, v in MALFORMED_CORPUS.items()}
    if len(sources) < 20:
        print(f'ERROR: 畸形语料只有 {len(sources)} 条——太少，抓不住什么',
              file=sys.stderr)
        return 1
    try:
        result = _pylex_tokens(sources)
    except RuntimeError as exc:
        print(f'ERROR: 在裸 vm 里跑 py-lex 失败：{exc}', file=sys.stderr)
        return 1
    rc = 0
    for name in sorted(result):
        toks = result[name]
        if isinstance(toks, dict):
            print(f'ERROR: {name} 让 PyLex.tokenize 抛了：{toks.get("throw")!r}\n'
                  f'       源码：{sources[name]!r}\n'
                  f'       它按设计永不抛错——三层影子临摹的逐字符对齐全靠这一条。',
                  file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'永不抛错：{len(sources)} 条畸形语料全部平安通过 PyLex.tokenize')
    return rc
