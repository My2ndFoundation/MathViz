"""B 组 · 卫生。

这一组守的全是**看不见的坏**：一条父目录引用要等到有人把目录搬走才失效；一个
`<` + `script` + `>` 字面量会让 awk 抽取配方与浏览器读到不同的字节；一个 NUL
让语法门、grep、awk 给出三种答案；一条写在工厂参数里的 `root.X` 让页面加载时
毫无征兆、到第一次交互才死；一个忘删的 `none` 哨兵今天在任何地方都不报错。

它们的共同点是：**失败时没有任何东西会报警**，所以只能靠门在提交前把它变成一条
会响的断言。
"""
from __future__ import annotations

import re
import sys

from . import (CORE_DIR, META_DESC_RE, PROGRAMS_DIR, REGISTRY, ROOT, TOOLS_DIR,
               all_tool_pages, core_modules, load_registry, read_text, root_pages,
               tool_pages)

# app.html / index.html 各自允许的父目录引用条数。
#
# 为什么是 2 而不是 1：`PARENT_HOME = '../app.html'`（返回 MathViz 的链接，
# 父项目不在时自己隐藏）**加上**同意横幅里的 `../privacy.html`。cryptography 的
# OUTBOUND_ALLOW 也是 2，同一个原因。除这两处外，整个 python/ 子树必须零出站
# 引用——把目录整个搬走之后，双击 app.html 仍然要完整可用。
OUTBOUND_ALLOW = {'app.html': 2, 'index.html': 2}

# \t \n 允许；\r **不允许**——见 control_byte_check 里关于 CRLF 的那一段。
CONTROL_OK = {'\t', '\n'}

PROGRAMS_MARK_RE = re.compile(r'/\* >>> GENERATED:PROGRAMS(.*?) \*/')

SKELETON = TOOLS_DIR / '_skeleton.html'


def outbound_ref_check() -> int:
    """整个 python/ 子树的父目录引用普查。

    设计约束：把 python/ 整个目录复制到任何别处，双击 app.html 仍然完整可用。
    这条约束的敌人不是某一次错误，而是**熵**——第 N 个工具随手写一条
    ../outputs/foo.js，在别人搬走目录的那一刻才失效，而那时没有任何东西会报警。

    只扫会被浏览器加载的文件（html / js / json）。两处排除：
      · scripts/ 下的 Python 不扫——它们是构建工具，不解析成 URL；而且这个
        文件自己就得写出那个字符串。
      · `*.test.js` 不扫——测试文件永远不会被内联进 html，也不随页面被浏览器
        加载，它们跨目录 require（`../_test.js`）是正常的。
    needle 拼出来而不是写成字面量，让这段代码即便被扫也不会自己踩雷。
    """
    needle = '..' + '/'
    rc = 0
    total = 0
    scanned = 0
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file():
            continue
        if path.suffix not in ('.html', '.js', '.json'):
            continue
        rel = path.relative_to(ROOT)
        if rel.parts[0] == 'scripts' or path.name.endswith('.test.js'):
            continue
        scanned += 1
        text = read_text(path)
        n = text.count(needle)
        total += n
        allowed = OUTBOUND_ALLOW.get(str(rel), 0)
        if n != allowed:
            where = [str(i + 1) for i, line in enumerate(text.split('\n')) if needle in line]
            print(f'ERROR: {rel} 里的父目录引用有 {n} 处（第 {"、".join(where)} 行），'
                  f'允许 {allowed} 处。\n'
                  f'       python/ 必须能被整体搬走后独立运行；除 app.html 与\n'
                  f'       index.html 各自的 PARENT_HOME 与隐私链接外，任何文件都不许\n'
                  f'       指向子项目之外。', file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'出站引用：{scanned} 个文件共 {total} 处，全部在白名单内'
              f'（PARENT_HOME 与同意横幅的隐私链接）')
    return rc


def script_literal_check() -> int:
    """任何 `.js` 里都不许出现 `<`+`script`+`>` 或 `<`+`/script`。

    本仓的 `awk '/<script>/{f=1;next}…'` 抽取配方会在这样的行上静默改变状态，
    于是语法门检查的字节与浏览器执行的字节不是同一份；配上一个 `<`+`!--`
    还能直接翻掉 HTML 分词器、把整页吞掉。cryptography 从 chess 继承过一个。

    两个 needle 都拼出来，让这个文件自己不踩雷。
    """
    open_needle = '<' + 'script' + '>'
    close_needle = '<' + '/script'
    rc = 0
    scanned = 0
    for path in sorted(CORE_DIR.rglob('*.js')):
        scanned += 1
        text = read_text(path)
        for i, line in enumerate(text.split('\n')):
            if open_needle in line or close_needle in line:
                print(f'ERROR: {path.relative_to(ROOT)}:{i + 1} 出现了 script 标签'
                      f'字面量——awk 抽取配方会在这里改变状态，语法门检查的字节\n'
                      f'       与浏览器执行的字节于是不是同一份。把它拆开写'
                      f'（如 "<" + "script" + ">"）。\n'
                      f'       {line.strip()[:100]}', file=sys.stderr)
                rc = 1
    if rc == 0:
        print(f'script 字面量：{scanned} 个 js 文件干净')
    return rc


def control_byte_check() -> int:
    """core/ programs/ tools/ **两个导航页与注册表** 里不许有 BOM、CRLF、或杂散 C0。

    ⚠ 扫描集里那两个根级页面（`app.html` / `index.html`）与 `python-tools.json`
    是最终评审补进来的。原来的扫描集是 `CORE_DIR / PROGRAMS_DIR / TOOLS_DIR` 三个
    目录，而那两页在 `python/` **根**、注册表也在根——三个目录一个都罩不到它们。
    评审员往两页的内联脚本各塞一个 NUL 和一个 VT，**34 道门全绿**，本门还照样
    打印「28 个文件无 BOM、无 CRLF、无杂散 C0」。

    这正是本包 `root_pages()` 的文档字符串记着的那件事：chess 的 `node_check()`
    只 glob `tools/*.html`，CI 的语法门只扫主站文件，合起来 `chess/index.html`
    从来没被任何语法门覆盖过。`node_check()` 用了 `root_pages()`，本门没用——
    **同一个错误隔了一个函数又犯了一次**。新增子目录或根级文件时，先问一句
    「这道门看得见它吗」。

    三样分开说，因为它们的坏法不同：

    · **BOM**：`\\ufeff` 在 `.py` 开头对 CPython 无害（它认），但 `json.dumps`
      会把它编进内联的 `source` 字符串，`program_embed_roundtrip_check` 的两边
      就都带着它、比对照样相等——一个逐字节比对抓不到的字节。而 `node --check`
      在 js 里遇到它是语法错。
    · **CRLF**：`len(src.splitlines())` 与 `src.split('\\n')` 在 CRLF 上给出
      同样的行数，`judge` 的相对缩进却会把 `\\r` 当成行内容的一部分；三层影子
      临摹逐字符对齐时，一个看不见的 `\\r` 会让光标从那一行起全部错位。
    · **其余 C0**：一个 NUL 能让语法门（合法）、grep（当二进制）、awk（截断）
      给出三种答案，而最权威的那一样说没事。cryptography 真擦肩而过一次。
    """
    rc = 0
    scanned = 0
    paths = []
    for base, patterns in ((CORE_DIR, ('*.js',)),
                           (PROGRAMS_DIR, ('*.py', '*.json')),
                           (TOOLS_DIR, ('*.html',))):
        for pattern in patterns:
            paths.extend(sorted(base.rglob(pattern)))
    # 根级的两个导航页 + 注册表：不在上面任何一个目录下，必须单独点名。
    paths.extend(root_pages())
    paths.append(REGISTRY)
    for path in paths:
        scanned += 1
        raw = path.read_bytes()
        rel = path.relative_to(ROOT)
        if raw.startswith(b'\xef\xbb\xbf'):
            print(f'ERROR: {rel} 以 UTF-8 BOM 开头——它会被原样编进内联副本，'
                  f'逐字节往返比对抓不到；js 里它还是语法错。', file=sys.stderr)
            rc = 1
        text = raw.decode('utf-8', errors='replace')
        if '\r' in text:
            line = text[:text.index('\r')].count('\n') + 1
            print(f'ERROR: {rel}:{line} 含 CR（CRLF 行尾）——'
                  f'三层逐字符对齐会从那一行起错位。', file=sys.stderr)
            rc = 1
        bad = {}
        for ch in text:
            if ch < ' ' and ch not in CONTROL_OK and ch != '\r':
                bad[ch] = bad.get(ch, 0) + 1
        if bad:
            first = min(bad, key=lambda c: text.index(c))
            line = text[:text.index(first)].count('\n') + 1
            detail = '、'.join(f'U+{ord(c):04X}×{n}' for c, n in sorted(bad.items()))
            print(f'ERROR: {rel} 含 C0 控制字符（{detail}），首次出现在第 '
                  f'{line} 行。\n'
                  f'       node --check 看不见它（NUL 在 JS 字符串里合法），'
                  f'但 awk 抽取配方会在那里截断、\n'
                  f'       grep 会把文件当二进制——门检查的字节与浏览器执行的'
                  f'字节于是不是同一份。', file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'控制字节：{scanned} 个文件无 BOM、无 CRLF、无杂散 C0'
              f'（含根级 {len(root_pages())} 个导航页与注册表 {REGISTRY.name}）')
    return rc


def strip_js_comments(text: str) -> str:
    """把一段 JS 里的注释换成等长的空格，字符串/模板/正则字面量原样保留。

    **换成等长空格而不是删掉**，是为了让剩下代码的行号与字符下标一个不动——
    报错要能点名「第几行」。

    ⚠ 这个函数存在的唯一理由是裁决 R47：`lazy_dep_check` 写成裸 grep 会在
    **完全正确的代码上**报红。实测 `core/editor.js:16` 与 `core/judge.js:31`
    的文件头注释里，都把 `factory(root.PyLex)` 当**反面教材**引用了
    （「工厂里直接 `factory(root.PyLex)` 会在装载时就把 undefined 抓死」）。
    一道从第一天起就误报的门，结局只有被调弱或被无视。

    正则字面量的判定靠「上一个有效字符」：`/` 跟在标识符、数字、`)`、`]` 之后
    是除号，别的位置是正则开头。这个启发式对本仓的代码足够——而且它错的方向
    是安全的：把正则当成除号，最坏是把正则内部的 `//` 当注释删掉，删掉的只会是
    正则里的内容，不会凭空造出一个 `factory(root.X)`。
    """
    out = []
    i = 0
    n = len(text)
    prev_significant = ''
    while i < n:
        c = text[i]
        two = text[i:i + 2]
        if two == '//':
            j = text.find('\n', i)
            j = n if j < 0 else j
            out.append(' ' * (j - i))
            i = j
            continue
        if two == '/*':
            j = text.find('*/', i + 2)
            j = n if j < 0 else j + 2
            out.append(''.join(ch if ch == '\n' else ' ' for ch in text[i:j]))
            i = j
            continue
        if c in '\'"`':
            quote = c
            j = i + 1
            while j < n:
                if text[j] == '\\':
                    j += 2
                    continue
                if text[j] == quote:
                    j += 1
                    break
                if quote != '`' and text[j] == '\n':
                    break                       # 未闭合的单行字符串：别吃掉整份文件
                j += 1
            out.append(text[i:j])
            i = j
            prev_significant = quote
            continue
        if c == '/' and prev_significant not in ')]}' and not (
                prev_significant.isalnum() or prev_significant in '_$'):
            # 正则字面量
            j = i + 1
            in_class = False
            while j < n:
                if text[j] == '\\':
                    j += 2
                    continue
                if text[j] == '[':
                    in_class = True
                elif text[j] == ']':
                    in_class = False
                elif text[j] == '/' and not in_class:
                    j += 1
                    break
                elif text[j] == '\n':
                    break
                j += 1
            out.append(text[i:j])
            i = j
            prev_significant = '/'
            continue
        out.append(c)
        if not c.isspace():
            prev_significant = c
        i += 1
    return ''.join(out)


def _factory_args(code: str, open_paren: int):
    """从 `factory(` 的左括号处切出实参列表，按顶层逗号分段。返回 [(片段, 起点), ...]。"""
    depth = 0
    i = open_paren
    n = len(code)
    start = open_paren + 1
    parts = []
    while i < n:
        c = code[i]
        if c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
            if depth == 0:
                parts.append((code[start:i], start))
                return parts
        elif c == ',' and depth == 1:
            parts.append((code[start:i], start))
            start = i + 1
        i += 1
    return parts


BARE_ROOT_RE = re.compile(r'^root\s*\.\s*[A-Za-z_$][\w$]*$')


def lazy_dep_check() -> int:
    """没有任何 core 模块在 UMD 工厂实参里直接抓 `root.X`。

    依赖必须惰性取：`factory(function () { return root.PyLex; })`，不是
    `factory(root.PyLex)`。`inline_core.py` 就地替换每一对标记，**不保证**
    PY-LEX 排在 EDITOR / JUDGE / INTERACT 之前；直接抓的那一份会在装载时把
    `undefined` 抓死，而页面**加载时毫无征兆**，要到使用者第一次交互才炸。

    cryptography 用 `inline_order_check()` 解决同一个问题（强制排序），这里
    走的是另一条路（惰性取值），所以门也不同：守的是真实存在的那个坏。

    ⚠ **必须先剥注释再扫**（裁决 R47）。实测 `editor.js:16` 与 `judge.js:31`
    的注释里都把 `factory(root.PyLex)` 当反面教材引用了，裸 grep 会在完全正确
    的代码上报两处红。见 strip_js_comments()。
    """
    rc = 0
    scanned = 0
    checked_calls = 0
    for path in sorted(CORE_DIR.glob('*.js')):
        if path.name.endswith('.test.js') or path.name == '_test.js':
            continue
        scanned += 1
        raw = read_text(path)
        code = strip_js_comments(raw)
        for m in re.finditer(r'\bfactory\s*\(', code):
            open_paren = m.end() - 1
            parts = _factory_args(code, open_paren)
            if not parts:
                continue
            checked_calls += 1
            for frag, off in parts:
                arg = frag.strip()
                if not arg:
                    continue
                line = code[:off].count('\n') + 1
                if BARE_ROOT_RE.match(arg):
                    print(f'ERROR: {path.relative_to(ROOT)}:{line} 的工厂实参直接抓了 '
                          f'{arg}——inline_core.py 不保证标记块的先后顺序，这里会在\n'
                          f'       装载时抓死 undefined，页面加载毫无征兆、第一次交互'
                          f'才炸。\n'
                          f'       改成 factory(function () {{ return {arg}; }})。',
                          file=sys.stderr)
                    rc = 1
                elif 'root.' in arg and 'function' not in arg and '=>' not in arg:
                    print(f'ERROR: {path.relative_to(ROOT)}:{line} 的工厂实参在装载时'
                          f'就求值了 root.*：{arg[:80]!r}——同上，改成惰性取。',
                          file=sys.stderr)
                    rc = 1
    if not checked_calls:
        print('ERROR: 一个 factory(...) 调用都没扫到——这道门本该检查 UMD 工厂实参，'
              '不是跑了个寂寞（剥注释是不是把代码也剥掉了？）', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'惰性依赖：{scanned} 个 core 模块、{checked_calls} 处 factory(...) 调用，'
              f'没有一处在实参里直接抓 root.*（已先剥注释，见 R47）')
    return rc


LINE_NOTE_READERS = ('panelLineNotes', 'noteLineIndex')
# 单词级：抓住 `lineNotes` 这个词的**任何**拼出方式——点读取、引号/模板字面量
# 方括号、解构、裸字符串——只要它逐字出现就命中。round-1 复评员实测：旧版
# `\.\s*lineNotes\b|\[\s*['"]lineNotes['"]\s*\]` 只认点读取与引号方括号，
# `var { lineNotes } = p` 与 `` p[`lineNotes`] `` 两条真实绕法都能全绿通过，
# 还照样打印「4 处读取」——正则结构性看不见它们，不是偶然漏测。
LINE_NOTE_WORD_RE = re.compile(r'\blineNotes\b')
# 白名单 (c)：`t('lineNotes', ...)` / `t("lineNotes", ...)`——t() 调用本身就是
# 经白名单函数取值再显示，不是又一条读取路径。允许 `t(` 后有空白；`t` 前用**负向
# 回顾断言**挡掉 `.`、`$`、任何单词字符——round-2 复评员实测：`\b` 在 `.` 与字母
# 之间也算「边界」（非单词字符到单词字符的跳变），`\bt\(` 于是照样匹配
# `foo.t('lineNotes'`，把任意对象上一个恰好叫 `t` 的方法认成白名单函数。挡住
# `.`/`$`/单词字符三类前导，才只放行「独立调用」的 `t(`，不放行「成员调用」。
T_CALL_RE = re.compile(r"""(?<![\w.$])t\(\s*(['"])lineNotes\1""")


def _brace_span(code: str, start: int):
    """给一个左花括号的下标 `start`，配对扫描出 `[start, 止)` 的区间；找不到收尾返回 None。

    只数花括号，跳过字符串/模板字面量——`_function_span` 与 `_str_table_span`
    共用这一段扫描：两处都是「给一个已知的左花括号位置，找它的右花括号」，
    区别只在起点怎么找（`function name(` 后的第一个 `{` vs `var STR = ` 后的
    那个 `{`），配对算法完全相同。
    """
    depth = 0
    quote = None
    i = start
    n = len(code)
    while i < n:
        c = code[i]
        if quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in '\'"`':
            quote = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    return None


def _function_span(code: str, name: str):
    """在已剥注释的代码里找 `function name(` 的函数体区间 [起, 止)；找不到返回 None。

    两个目标函数体内没有正则字面量；若将来有了、又恰好含未配对的花括号，这里
    会切错区间——门会因「允许的函数里一处读取都没有」或「读取落在函数外」而红，
    不会静默放行。
    """
    m = re.search(r'\bfunction\s+' + re.escape(name) + r'\s*\(', code)
    if not m:
        return None
    start = code.find('{', m.end())
    if start < 0:
        return None
    return _brace_span(code, start)


def _str_table_span(code: str):
    """`var STR = { ... };`（i18n 键表）的对象字面量区间 [起, 止)；找不到返回 None。

    这个区间只是「白名单 (b) 可能生效的范围」，不是白名单本身——区间内的每处
    `lineNotes` 出现还要另过 `_is_str_entry_declaration()` 才算声明（见该函数与
    `line_note_reader_check` 的说明）。找不到这个区间本身就是一条具名的红（不是
    静默放行）：找不到往往意味着 interact.js 换了写法，这道门的假设就该重新
    核实，而不是悄悄认为「没有 STR 表所以没什么要挡」。
    """
    m = re.search(r'\bvar\s+STR\s*=\s*\{', code)
    if not m:
        return None
    return _brace_span(code, m.end() - 1)


# 白名单 (b) 认的**唯一**形状：本仓 STR 表里那一条真实条目——整行从行首（可以有
# 空白）起，`lineNotes` 后面（可隔空白）是 `:`，再（可隔空白）是 `{`，再（可隔
# 空白）是 `zh:`。真实那一行 `lineNotes:   { zh: '行注',     en: 'Line notes' },`
# 正是这个形状。
STR_ENTRY_LINE_RE = re.compile(r'^(\s*)(lineNotes)\s*:\s*\{\s*zh\s*:')


def _is_str_entry_declaration(code: str, pos: int) -> bool:
    """`pos` 处的 `lineNotes` 匹配，是不是 STR 表里那一条真实条目**行首**的那个词。

    round-2 的判据只看「紧跟一个冒号、紧靠在前面的是 `{` 或 `,`」——这个文本形状
    在 JS 里同时是**解构赋值改名**的语法：`leakKey: ({ lineNotes: window.__leak }
    = current()),` 里，`lineNotes:` 前面恰好是 `{`、后面恰好是 `:`，round-2 判据
    分不出这是「对象字面量的键」还是「解构模式里同名的属性」——round-3 复评员验证：
    这一行塞进 STR 表，门照样绿、仍打印「4 处读取」，而这一行其实读取了
    `current().lineNotes` 并把值存进 `window.__leak`。

    这道门是纯文本扫描，没有 JS 语法树（单文件零依赖的约束下没法引入解析器），
    分不清「对象字面量的键」与「文本上长得一样的解构属性」——round-3 不再试图靠
    「相邻字符长什么样」去猜语义，改成**只认本仓这一条目唯一的真实写法**：整行
    必须严格匹配 `STR_ENTRY_LINE_RE`（`^\\s*lineNotes\\s*:\\s*\\{\\s*zh\\s*:`），
    且这次匹配到的 `lineNotes` 必须正是那一行锚定在行首的那个词——同一行里如果
    还有别的地方也拼出这个词（比如藏在 `zh:` 的值里），那些出现的 `pos` 不等于
    锚定位置，不会被这条规则放行，仍按默认判定处理。
    """
    line_start = code.rfind('\n', 0, pos) + 1
    line_end = code.find('\n', pos)
    if line_end < 0:
        line_end = len(code)
    m = STR_ENTRY_LINE_RE.match(code[line_start:line_end])
    if not m:
        return False
    return line_start + m.start(2) == pos


def line_note_reader_check() -> int:
    """core/ 里逐字出现 `lineNotes` 这个词，只放行三种形状，别的一律当场红：

      (a) 落在 `panelLineNotes` / `noteLineIndex` 两个函数体内——白名单读取点；
      (b) 落在 STR 表（i18n 键表）里，且**整行**从行首（可以有空白）起严格是
          本仓这一条真实条目的写法：`lineNotes` + 可选空白 + `:` + 可选空白 +
          `{` + 可选空白 + `zh:`（`STR_ENTRY_LINE_RE`），并且这次匹配到的词
          正是那一行行首锚定的那个——不是「落在 STR 的花括号区间里」就算，见
          `_is_str_entry_declaration()`；
      (c) 是 `t('lineNotes', ...)` / `t("lineNotes", ...)` 的**独立调用**——`t`
          前面不能是 `.`、`$` 或任意单词字符，否则算成员调用（`foo.t(...)`），
          不算这道门认的那个全局 `t(key, lang)`。

    **威胁模型（读这段就知道这道门保什么、不保什么）：** 这是一道纯文本扫描，
    没有 JS 语法解析器（单文件零依赖是本仓的硬约束，不引入解析器）。它的目标是
    抓**本仓日常写法里意外新增的一个 lineNotes 读取点**——比如有人加了一条新的
    渲染路径去读 `p.lineNotes`、随手写了一次解构、或者换成了方括号读取。它**不
    试图对抗蓄意的混淆**：故意在 STR 表里塞一段解构赋值改名、遮蔽全局 `t`、
    在运行时才拼出键名、或用反射遍历属性——这些都不是这道门的战场，下面逐条
    举例：

      · **遮蔽 `t`**：`var t = function (key) { return current()[key]; };` 之后
        再写 `t('lineNotes', 'zh')`——这确实读取了 `lineNotes`，但 `T_CALL_RE`
        只看「有没有一个叫 `t` 的独立调用」，看不出这个 `t` 是不是被局部变量
        遮蔽成了别的函数。这是已知盲区，不打算工程上堵——堵法是要求 `t` 全局
        不可遮蔽，那已经不是这道门管的范围。
      · **运行时拼键**：`p['line' + 'Notes']`——代码里从没有逐字出现
        `lineNotes` 这个词，`\\blineNotes\\b` 天生扫不到。
      · **反射遍历**：`Object.keys(p)` / `for...in`——同上，没有逐字拼出这个词。
      · **STR 值内部的混淆**：`zh:` / `en:` 的值位置里如果藏进另一次不逐字拼出
        `lineNotes` 的等价读取（比如先把 `p` 存成 `_p` 再用一层间接），这道门
        也看不见——它认的始终是「这个词逐字出现在哪」，不是「这行代码语义上
        做了什么」。

    **认词不认语法**：单词级正则 `\\blineNotes\\b` 在剥完注释的源码上扫，不区分
    点读取（`p.lineNotes`）、引号/模板字面量方括号（`p['lineNotes']` /
    `` p[`lineNotes`] ``）、解构赋值（`var { lineNotes } = p`）、裸字符串
    （`'lineNotes'`）——只要不落在上面三种放行形状里，字面拼出这个词就是红。
    这是 round-1 定的方法：旧版正则只认「点」与「引号方括号」两种写法，两条
    真实绕法（解构、模板字面量键）能全绿通过；round-1 把「认语法」换成「认词」，
    堵的是这一类问题的所有已知形状，不是再补正则分支。

    **(b) 为什么从「区间＋相邻字符」收紧到「整行严格匹配」**：round-2 曾经
    只要求「这个词紧跟冒号、紧靠在前面的是 `{` 或 `,`」——这个文本形状同时是
    JS 里**解构赋值改名**的语法：`leakKey: ({ lineNotes: window.__leak } =
    current()),` 里 `lineNotes:` 前面恰好是 `{`、后面恰好是 `:`，round-2 判据
    分不出这是「对象字面量的键」还是「解构模式里同名的属性」——这两种语法在
    纯文本层面长得一模一样，只有 JS 语法树才分得出，而这道门没有语法树。
    round-3 不再猜测「文本相邻等不等于声明」，改成只认本仓这一条目**唯一**的
    真实写法（见 (b)）——别的写法，包括看似无害的变体，都不放行。

    **先剥注释再扫**（R47）：interact.js 的注释里会提到 lineNotes，剥注释后那些
    提及会变成等长空格，不会被计入。
    """
    rc = 0
    reads = 0
    hits = {name: 0 for name in LINE_NOTE_READERS}
    saw_interact = False
    for path in core_modules():
        code = strip_js_comments(read_text(path))
        spans = {}
        str_span = None
        t_call_spans = []
        if path.name == 'interact.js':
            saw_interact = True
            for name in LINE_NOTE_READERS:
                span = _function_span(code, name)
                if span is None:
                    print(f'ERROR: core/interact.js 里找不到允许读取 lineNotes 的函数 {name}()'
                          f'——改名了就同步改 LINE_NOTE_READERS', file=sys.stderr)
                    rc = 1
                else:
                    spans[name] = span
            str_span = _str_table_span(code)
            if str_span is None:
                print('ERROR: core/interact.js 里找不到 `var STR = {...}`（i18n 键表）——'
                      '白名单 (b) 无处安放，这道门关于 lineNotes 声明处的假设不再成立',
                      file=sys.stderr)
                rc = 1
            t_call_spans = [m.span() for m in T_CALL_RE.finditer(code)]

        lines_src = code.split('\n')
        for m in LINE_NOTE_WORD_RE.finditer(code):
            pos = m.start()
            owner = next((nm for nm, (a, b) in spans.items() if a <= pos < b), None)
            if owner is not None:
                hits[owner] += 1
                reads += 1
                continue
            if (str_span is not None and str_span[0] <= pos < str_span[1]
                    and _is_str_entry_declaration(code, pos)):
                continue                          # (b) STR 键表：本仓真实条目形状的声明
            if any(a <= pos < b for a, b in t_call_spans):
                continue                          # (c) t('lineNotes', ...) 独立调用
            line = code[:pos].count('\n') + 1
            snippet = lines_src[line - 1].strip()[:100]
            print(f'ERROR: core/{path.name}:{line} 出现了 lineNotes，不在白名单内——'
                  f'只允许出现在 {" / ".join(LINE_NOTE_READERS)} 函数体、STR 的 i18n '
                  f'键表、或 t(\'lineNotes\', ...) 调用里。点读取、引号/模板字面量'
                  f'方括号、解构赋值、裸字符串——这个词不管怎么拼出来，落在别处都'
                  f'算绕过白名单。\n'
                  f'    {snippet}', file=sys.stderr)
            rc = 1
    if not saw_interact:
        print('ERROR: core_modules() 里没有 interact.js——这道门无处可扫', file=sys.stderr)
        return 1
    for name, n in hits.items():
        if n == 0 and name in LINE_NOTE_READERS and rc == 0:
            print(f'ERROR: 允许的读取点 {name}() 里一处 lineNotes 读取都没扫到——'
                  f'要么剥注释剥坏了，要么函数不再读它（那就把它移出白名单）', file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'行注读取点：core/ 共 {reads} 处读取 lineNotes，全部在 '
              f'{" / ".join(LINE_NOTE_READERS)} 内（STR 键表声明与 t() 调用各自另有'
              f'一处，不计入 reads；已先剥注释，见 R47）')
    return rc


def _programs_sentinel(path):
    """返回 GENERATED:PROGRAMS 标记行上的哨兵内容（`''` 表示正常注入），无标记返回 None。"""
    m = PROGRAMS_MARK_RE.search(read_text(path))
    return None if not m else m.group(1).strip()


def skeleton_sentinel_check() -> int:
    """`_skeleton.html` 的 GENERATED:PROGRAMS 标记行必须写 `none`；非模板页不许写。

    `none` 是显式弃权（裁决 R2）：骨架不带任何程序，区段留空、不报错、也不去找
    章目录。去掉它，骨架就成了「找到零个程序」——build_programs.py 会当硬错误报。
    反过来，一个真工具页留着 `none`，它的程序永远不会被注入，而**今天任何地方
    都不报错**：render_page 走弃权分支、没有章节冲突、注册表也不被触碰。
    """
    rc = 0
    if not SKELETON.exists():
        print(f'ERROR: 找不到模板页 {SKELETON.relative_to(ROOT)}——每个新工具的复制源'
              f'没了', file=sys.stderr)
        return 1
    sentinel = _programs_sentinel(SKELETON)
    if sentinel is None:
        print(f'ERROR: {SKELETON.name} 缺 GENERATED:PROGRAMS 标记区间', file=sys.stderr)
        rc = 1
    elif sentinel != 'none':
        print(f'ERROR: {SKELETON.name} 的 GENERATED:PROGRAMS 哨兵是 {sentinel!r}，'
              f'必须是 none。\n'
              f'       模板页不带任何程序，没有 none 就变成「找到零个程序」——'
              f'那是硬错误。', file=sys.stderr)
        rc = 1

    for path in all_tool_pages():
        if path.name.startswith('_'):
            continue
        s = _programs_sentinel(path)
        if s is None:
            print(f'ERROR: {path.name} 缺 GENERATED:PROGRAMS 标记区间', file=sys.stderr)
            rc = 1
        elif s == 'none':
            print(f'ERROR: {path.name} 是真工具页却写着 GENERATED:PROGRAMS none——'
                  f'它的程序永远不会被注入，而这件事今天在别处一个错都不报。',
                  file=sys.stderr)
            rc = 1
        elif s:
            print(f'ERROR: {path.name} 的 GENERATED:PROGRAMS 标记行有未识别的内容 '
                  f'{s!r}——只认空白或 none', file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'骨架哨兵：_skeleton.html 写着 none，{len(tool_pages())} 个真工具页都没写')
    return rc


def skeleton_leak_check() -> int:
    """已注册的工具页不许携带骨架的 description 原文，也不许留着 `none` 哨兵（裁决 R51）。

    两条各堵一个真实的洞：

    · `description` 是**逐页**字段，却不在骨架的「要改的地方」清单里。照清单抄
      的人会把骨架的描述原样带走，而页面照样能开、注册表也不看这个字段——它只
      出现在搜索结果与分享卡片上，也就是没有人会在本地看见的地方。
    · `none` 哨兵：**忘删 `none` 且忘写 `chapter.json` 的 `tool` 字段**，今天
      在任何地方都不报错——render_page 走弃权分支、没有章节冲突、注册表也不被
      触碰。这条与 skeleton_sentinel_check 的后半截有意重叠：那一道扫的是
      「所有非模板页」，这一道扫的是「注册表里的页」，两个集合今天相同、以后
      未必（一个写完没注册的页只会被前者看见）。
    """
    rc = 0
    if not SKELETON.exists():
        print(f'ERROR: 找不到模板页 {SKELETON.relative_to(ROOT)}', file=sys.stderr)
        return 1
    m = META_DESC_RE.search(read_text(SKELETON))
    if not m:
        print(f'ERROR: {SKELETON.name} 没有 <meta name="description">——这道门拿它'
              f'当参照，没有参照就等于没有门', file=sys.stderr)
        return 1
    skeleton_desc = m.group(1)

    reg = load_registry()
    checked = 0
    for d in reg['tools']:
        path = ROOT / d['file']
        if not path.exists():
            continue                       # 缺文件由 registry_check 报
        text = read_text(path)
        dm = META_DESC_RE.search(text)
        if not dm:
            print(f'ERROR: {d["file"]} 缺 <meta name="description">', file=sys.stderr)
            rc = 1
        elif dm.group(1) == skeleton_desc:
            line = text[:dm.start()].count('\n') + 1
            print(f'ERROR: {d["file"]}:{line} 的 description meta 还是骨架原文：\n'
                  f'       {skeleton_desc[:90]}…\n'
                  f'       description 是逐页字段，不在骨架的复制清单里——照清单抄'
                  f'就会原样带走。', file=sys.stderr)
            rc = 1
        s = _programs_sentinel(path)
        if s == 'none':
            print(f'ERROR: {d["file"]} 是已注册的工具页却留着 GENERATED:PROGRAMS none'
                  f'——配上忘写的 chapter.json "tool" 字段，这个组合今天在任何地方'
                  f'都不报错。', file=sys.stderr)
            rc = 1
        checked += 1
    if not checked:
        print('ERROR: 一个已注册的工具页都没检查到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'骨架泄漏：{checked} 个已注册页面的 description 都是自己的，没有残留 none')
    return rc
