"""ch20-text-data 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（协议：种子 properties.SEED、SAMPLES 组、本文件的
生成器；每个被测入口的每个 return 分支各变异一次，红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

生成器基本只产出 ASCII：`\\d` 与 `str.isdigit()` 在非 ASCII 数字上意见不一
（'²'.isdigit() 为真，却不是 `\\d`），`\\w` 也认 Unicode 字母——被测程序讲的是
ASCII 文本，参照按 ASCII 写。**两处例外是故意的，别「修正」掉**：`_date_cases` 的上标
分支与 tokenise cases 里的 chr(178)（'²'）。date-format-manual 与 tokenise-loop 用
`isdecimal()` 而不是 `isdigit()`，正是这两支让门分得清二者——复审实测：去掉它们，
把被测改回 isdigit，门仍全绿。

两个变体组的共同约定（组内两版一致）：
· date-format-check：`check_date(text)` 交回三种字符串之一——"wrong format"（不是
  DD/MM/YYYY 两位/两位/四位数字）、"out of range"（日不在 1..31 或月不在 1..12；
  不判大小月与闰年，31/02 算 "ok"）、"ok"。
· tokenise-expression：入口 `tokenise_or_none(text)`——记号列表（字符串），遇到
  数字、+ - * / ( )、空白以外的字符时交回 None。相邻两串数字之间隔着空白时是两个记号。
"""
import ast
import json
import re
import string


# ── clean-text-normalise ────────────────────────────────────────────────

def _clean_ref(text):
    # 被测：lower + translate 删标点 + split/join。参照：逐字符，留字母数字、
    # 空白换成空格、其余丢掉——不用 translate，也不用 string.punctuation。
    out = []
    for ch in text:
        if ch.isalnum():
            out.append(ch.lower())
        elif ch.isspace():
            out.append(' ')
    return ' '.join(''.join(out).split())


_PRINTABLE = string.ascii_letters + string.digits + string.punctuation + '    \t\n'


def _clean_cases(rng):
    return (''.join(rng.choice(_PRINTABLE) for _ in range(rng.randint(0, 30))),)


# ── word-frequency-file ─────────────────────────────────────────────────

def _top_words_ref(text, n, stopwords):
    # 清单写定的参照：sorted(set(words), key=(-words.count(w), w))[:n]——每个词
    # 回头在整张列表里数一遍，不建字典。清洗也换一种写法：逐字符滤掉标点。
    kept = ''.join(ch for ch in text.lower() if ch not in string.punctuation)
    words = [w for w in kept.split() if w not in stopwords]
    return [(w, words.count(w)) for w in sorted(set(words), key=lambda w: (-words.count(w), w))][:n]


def _top_words_cases(rng):
    # 清单：窄字母表短词（大量并列次数）、停用词约占一半、n 常大于不同词数。
    vocab = sorted({''.join(rng.choice('abc') for _ in range(rng.randint(1, 2)))
                    for _ in range(8)})
    pieces = []
    for _ in range(rng.randint(0, 25)):
        w = rng.choice(vocab)
        if rng.random() < 0.3:
            w = w.upper() if rng.random() < 0.5 else w.capitalize()
        if rng.random() < 0.3:
            w += rng.choice(".,;:!?'")
        pieces.append(w)
    text = ''.join(p + rng.choice([' ', ' ', '  ', '\n']) for p in pieces)
    stop = {w for w in vocab if rng.random() < 0.5}
    return (text, rng.randint(0, 10), stop)


# ── regex-find-numbers ──────────────────────────────────────────────────

def _find_numbers_ref(text):
    # 被测：re.findall(r"-?\d+")。参照：逐字符扫一串极长的数字，紧挨在它前面的
    # 字符是 '-' 就算负数；不用正则。
    digits = '0123456789'
    result = []
    i = 0
    while i < len(text):
        if text[i] in digits:
            j = i
            while j < len(text) and text[j] in digits:
                j += 1
            value = int(text[i:j])
            if i > 0 and text[i - 1] == '-':
                value = -value
            result.append(value)
            i = j
        else:
            i += 1
    return result


def _numbers_cases(rng):
    # 清单：常出现 '-' 紧贴数字、'-' 单独出现、数字紧贴字母。
    alphabet = '0123456789' * 2 + '--' + ' ' + 'abx' + ':.'
    return (''.join(rng.choice(alphabet) for _ in range(rng.randint(0, 25))),)


# ── date-format-check（两版互为参照）───────────────────────────────────────

def _date_manual(text):
    # 给 date-format-regex 当参照：split + len + isdecimal。isdecimal 与 str 模式里的 \d 认的
    # 都是 Unicode Nd 类，所以哪怕遇到非 ASCII 的数字两者也一致（全码位逐个替换实测过）。
    parts = text.split('/')
    if len(parts) != 3 or [len(p) for p in parts] != [2, 2, 4]:
        return 'wrong format'
    if not all(p.isdecimal() for p in parts):
        return 'wrong format'
    day, month = int(parts[0]), int(parts[1])
    if day < 1 or day > 31 or month < 1 or month > 12:
        return 'out of range'
    return 'ok'


_DATE = re.compile(r'([0-9][0-9])/([0-9][0-9])/[0-9][0-9][0-9][0-9]')


def _date_regex(text):
    # 给 date-format-manual 当参照：正则判格式，再用集合判范围。这里写的是 [0-9]（只认 ASCII），
    # 所以 cases 只混进 isdigit 认、isdecimal 不认的上标（No 类），不混进非 ASCII 的 Nd 数字——
    # 后者被测（isdecimal）会放行，这个参照却不放行。
    m = _DATE.fullmatch(text)
    if m is None:
        return 'wrong format'
    if m.group(1) in {f'{d:02d}' for d in range(1, 32)} and \
            m.group(2) in {f'{d:02d}' for d in range(1, 13)}:
        return 'ok'
    return 'out of range'


def _date_cases(rng):
    # 清单：约一半格式对（纯随机串几乎全不对），专门造 00/..、31/02、月 13 这类。
    r = rng.random()
    if r < 0.5:
        day = rng.choice([0, 1, 9, 10, 29, 30, 31, 32, 39, 99, rng.randint(0, 99)])
        month = rng.choice([0, 1, 2, 9, 12, 13, 19, rng.randint(0, 99)])
        return (f'{day:02d}/{month:02d}/{rng.randint(0, 9999):04d}',)
    if r < 0.6:
        return ('31/02/' + str(rng.randint(1000, 9999)),)
    if r < 0.8:
        # 格式差一点：某段少一位或多一位、换分隔符、混进字母、尾巴多一个字符
        good = f'{rng.randint(1, 31):02d}/{rng.randint(1, 12):02d}/{rng.randint(1000, 9999)}'
        i = rng.randrange(len(good))
        how = rng.randrange(4)
        if how == 0:
            return (good[:i] + good[i + 1:],)
        if how == 1:
            return (good[:i] + rng.choice('0123456789/-a ') + good[i:],)
        if how == 2:
            return (good[:i] + rng.choice('-. x') + good[i + 1:],)
        return (good + rng.choice('x0/ '),)
    if r < 0.9:
        # 某一位换成上标数字（chr(185)/chr(178)/chr(179)）：isdigit 认、int() 不认。被测若用
        # isdigit 就会在 int() 那一步抛 ValueError——区分 isdecimal 与 isdigit 的正是这一支。
        good = f'{rng.randint(1, 31):02d}/{rng.randint(1, 12):02d}/{rng.randint(1000, 9999)}'
        i = rng.choice([k for k, ch in enumerate(good) if ch != '/'])
        return (good[:i] + chr(rng.choice([185, 178, 179])) + good[i + 1:],)
    return (''.join(rng.choice('0123456789/ -') for _ in range(rng.randint(0, 12))),)


# ── name-swap-regex-sub ─────────────────────────────────────────────────

_WORD = set(string.ascii_letters + string.digits + '_')


def _swap_ref(line):
    # 被测：re.sub(r"^(\w+), (\w+)$", r"\2 \1", line)。参照：partition 手工换位。
    before, sep, after = line.partition(', ')
    if sep and before and after and set(before) <= _WORD and set(after) <= _WORD:
        return after + ' ' + before
    return line


def _swap_cases(rng):
    def word():
        return ''.join(rng.choice('abXY9_') for _ in range(rng.randint(1, 5)))
    r = rng.random()
    if r < 0.5:
        return (word() + ', ' + word(),)
    seps = [',', ' ', ', ', ',  ', ' , ', "'", '-', ', ']
    parts = [word() for _ in range(rng.randint(1, 4))]
    line = parts[0]
    for p in parts[1:]:
        line += rng.choice(seps) + p
    if rng.random() < 0.2:
        line = rng.choice(['', ' ', ', ']) + line + rng.choice(['', ' ', ','])
    return (line,)


# ── json-load-fixture ───────────────────────────────────────────────────

def _average_ref(json_text):
    # 清单写定的参照：不用 json 模块，用 ast.literal_eval 解析（生成器只产出
    # JSON 与 Python 字面量共有的写法：无 true / false / null）；平均也换成手工累加。
    data = ast.literal_eval(json_text)
    result = {}
    for student in data['students']:
        total = 0
        for mark in student['marks']:
            total += mark
        result[student['name']] = round(total / len(student['marks']), 1)
    return result


def _students_cases(rng):
    names = ['Ada', 'Brian', 'Chen', 'Dee', 'Eve']
    students = []
    for _ in range(rng.randint(0, 5)):
        s = {'name': rng.choice(names),
             'marks': [rng.randint(0, 100) for _ in range(rng.randint(1, 4))]}
        if rng.random() < 0.5:
            s['tutor'] = {'name': 'T' + rng.choice(names), 'room': rng.choice(['B12', 'C3'])}
        students.append(s)
    data = {'group': rng.choice(['12A', '13B']), 'students': students}
    # 写成 JSON 文本：键序、缩进随机，参照与被测都得从文本解析
    return (json.dumps(data, indent=rng.choice([None, 2]), sort_keys=rng.random() < 0.5),)


# ── config-parser ───────────────────────────────────────────────────────

_BLANK_OR_COMMENT = re.compile(r'\s*(#.*)?')
_HEADER = re.compile(r'\s*\[(.*)\]\s*')
_SETTING = re.compile(r'\s*([^=]*?)\s*=\s*(.*?)\s*')


def _config_ref(text):
    # 被测：strip + startswith / endswith + partition。参照：每行按 re.fullmatch
    # 归进四类之一（空或注释 / 节头 / 设置 / 坏行），用 split('\n') 切行、手工数行号。
    config = {}
    section = None
    number = 0
    for raw in text.split('\n'):
        number += 1
        if _BLANK_OR_COMMENT.fullmatch(raw):
            continue
        m = _HEADER.fullmatch(raw)
        if m:
            name = m.group(1).strip()
            if name not in config:
                config[name] = {}
            section = config[name]
            continue
        m = _SETTING.fullmatch(raw)
        if m is None or m.group(1) == '':
            return f'error: line {number}: expected key = value'
        if section is None:
            return f'error: line {number}: {m.group(1)} is outside a section'
        section[m.group(1)] = m.group(2)
    return config


def _config_cases(rng):
    def tok():
        return ''.join(rng.choice('abc') for _ in range(rng.randint(1, 3)))

    def sp():
        return rng.choice(['', '', ' ', '  ', '\t'])

    lines = []
    if rng.random() > 0.3:           # 约三成的文本在第一个节头之前就有设置
        lines.append(sp() + '[' + sp() + tok() + sp() + ']' + sp())
    for _ in range(rng.randint(0, 8)):
        r = rng.random()
        if r < 0.1:
            lines.append(sp())
        elif r < 0.2:
            lines.append(sp() + '#' + rng.choice(['', ' x = 1', tok()]))
        elif r < 0.35:
            lines.append(sp() + '[' + sp() + rng.choice(['', tok()]) + sp() + ']' + sp())
        elif r < 0.85:
            value = rng.choice(['', tok(), tok() + ' ' + tok(), tok() + ' = ' + tok(), '[x]'])
            lines.append(sp() + tok() + sp() + '=' + sp() + value + sp())
        elif r < 0.93:
            lines.append(sp() + tok() + sp() + rng.choice(['', ' ' + tok(), ']']))  # 没有 =
        else:
            lines.append(sp() + '=' + sp() + tok())                              # 键是空的
    return ('\n'.join(lines) + rng.choice(['', '\n']),)


# ── tokenise-expression（两版互为参照）─────────────────────────────────────

_ALL = re.compile(r'(?P<num>\d+)|(?P<op>[-+*/()])|(?P<space>\s+)|(?P<bad>.)', re.S)


def _tokenise_by_finditer(text):
    # 给 tokenise-loop 当参照：一个顶层交替的正则逐段 finditer，落进 bad 分组就是非法。
    tokens = []
    for m in _ALL.finditer(text):
        if m.lastgroup == 'bad':
            return None
        if m.lastgroup != 'space':
            tokens.append(m.group())
    return tokens


def _tokenise_by_index(text):
    # 给 tokenise-regex 当参照：下标 while 循环，碰到数字就向后吃尽一整串。
    tokens = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch in '0123456789':
            j = i
            while j < len(text) and text[j] in '0123456789':
                j += 1
            tokens.append(text[i:j])
            i = j
            continue
        if ch in '+-*/()':
            tokens.append(ch)
        elif ch not in ' \t\n':
            return None
        i += 1
    return tokens


def _expr(rng, depth=0):
    if depth >= 3 or rng.random() < (0.2 if depth == 0 else 0.45):
        return str(rng.randint(0, 120))
    left, right = _expr(rng, depth + 1), _expr(rng, depth + 1)
    text = left + rng.choice('+-*/') + right
    return '(' + text + ')' if rng.random() < 0.4 else text


def _tokenise_cases(rng):
    # 清单：随机表达式树的中缀串加随机空白；约四分之一混入一个非法字符。
    out = ''
    for ch in _expr(rng):
        out += rng.choice(['', '', '', ' ', '  ', '\t']) + ch
    out += rng.choice(['', ' ', '\n'])
    if rng.random() < 0.25:
        i = rng.randint(0, len(out))
        # 末尾那个是上标 ²（chr(178)）：isdigit 认、isdecimal 与 \d 都不认，守的是 tokenise-loop 的 isdecimal。
        out = out[:i] + rng.choice('x^%.=a!' + chr(178)) + out[i:]
    return (out,)


# ── log-line-parser ─────────────────────────────────────────────────────

def _parse_line_ref(line):
    # 被测：一个带命名分组的正则 fullmatch。参照：按单个空格 split 成五段、逐段校验。
    # （按单个空格而不是 split()：被测模式里段与段之间恰好一个空格，多一个空格就是坏行。）
    parts = line.split(' ')
    if len(parts) != 5:
        return None
    ip, method, path, status, size = parts
    octets = ip.split('.')
    if len(octets) != 4 or not all(o and set(o) <= set(string.digits) for o in octets):
        return None
    if not method or not set(method) <= set(string.ascii_uppercase):
        return None
    if not path.startswith('/') or any(ch.isspace() for ch in path):
        return None
    if len(status) != 3 or not set(status) <= set(string.digits):
        return None
    if not size or not set(size) <= set(string.digits):
        return None
    return {'ip': ip, 'method': method, 'path': path, 'status': int(status), 'size': int(size)}


def _log_cases(rng):
    ip = '.'.join(str(rng.randint(0, 300)) for _ in range(4))
    method = rng.choice(['GET', 'POST', 'PUT'])
    path = '/' + ''.join(rng.choice('abc/.1') for _ in range(rng.randint(0, 6)))
    status = str(rng.choice([200, 302, 404, 500, rng.randint(0, 9999)]))
    size = str(rng.randint(0, 99999))
    fields = [ip, method, path, status, size]
    r = rng.random()
    if r < 0.5:
        pass                                       # 多数是好行（status 偶尔不是三位）
    elif r < 0.85:
        i = rng.randrange(5)                       # 弄坏一段
        fields[i] = rng.choice(['', 'abc', 'get', '1.2.3', '1..2.3', 'x/y', '12a', '\t', '-1'])
    else:
        return (rng.choice(['', 'not a log line', ' '.join(fields) + ' extra',
                            '  '.join(fields), ' '.join(fields) + ' ']),)
    return (' '.join(fields),)


REFERENCES = {
    'clean-text-normalise': {'ref': _clean_ref, 'cases': _clean_cases},
    'word-frequency-file': {'ref': _top_words_ref, 'cases': _top_words_cases},
    'regex-find-numbers': {'ref': _find_numbers_ref, 'cases': _numbers_cases},
    'date-format-regex': {'ref': _date_manual, 'cases': _date_cases},
    'date-format-manual': {'ref': _date_regex, 'cases': _date_cases},
    'name-swap-regex-sub': {'ref': _swap_ref, 'cases': _swap_cases},
    'json-load-fixture': {'ref': _average_ref, 'cases': _students_cases},
    'config-parser': {'ref': _config_ref, 'cases': _config_cases},
    'tokenise-loop': {'ref': _tokenise_by_finditer, 'cases': _tokenise_cases},
    'tokenise-regex': {'ref': _tokenise_by_index, 'cases': _tokenise_cases},
    'log-line-parser': {'ref': _parse_line_ref, 'cases': _log_cases},
}
