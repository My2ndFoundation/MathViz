#!/usr/bin/env python3
"""把 python/programs/ch*/ 下的教学程序注入 python/tools/*.html 的 GENERATED:PROGRAMS 区段。

程序库是**真的 `.py` 文件**，不是嵌在 JS 字符串里的源码（design §5.1）：这样
「我挑的程序对不对、输出符不符合预期」就从作者说了算变成 CPython 说了算——校验门
（T14）会真跑它们、比对 stdout。但 `.py` 不能在运行时读——`file://` 下
`fetch('bubble-sort.py')` 必然失败，而单文件/零依赖是铁律——所以它是**构建期输入**，
地位与 chess/cryptography 的 `core/*.js` 完全相同：唯一编辑源在磁盘上，本脚本把它
注入进页面，页面本身在 `file://` 下依旧自足可开。

编辑源（唯二）：
  - `python/programs/ch*/chapter.json` —— 每章的元数据（含每个程序的 `file`/`entry`/
    `title`/`notes`/… 等字段，形状见 design §2.3）。
  - `python/programs/ch*/<program>.py`  —— 程序源码本身。

映射方向是**双向都要查**：
  - chapter → page：`chapter.json` 的 `"tool"` 字段指名唯一一个工具页
    `python/tools/<tool>.html`。**目标页不存在时当场报错**，不静默跳过——
    一个章节的教学内容如果因为拼错文件名而从没被注入过，不该只是"什么都没发生"。
  - page → chapter：遍历 `python/tools/*.html`，对每一页按文件名反查有没有章节点名它。
    这是 `none` 弃权哨兵与"空清单必须报错"这两条规矩的落脚点（见下）。

`none` 弃权哨兵（裁决 R2）：模板骨架页（`_skeleton.html`）不带任何程序，标记行写成
`/* >>> GENERATED:PROGRAMS none */` 时区段留空、不报错、也不去找对应的章目录。
**没有 `none` 时，找到零个程序是硬错误**——这是 cryptography 让空 `ALGOS` 清单报错的
同一条规矩：疏漏呈现出来的形状就是"悄悄空着"，真工具不会无意中写出 `none`。

三条嵌入硬要求（写进 `encode_payload()`）：
  1. 走 `json.dumps(ensure_ascii=True)` 编码，不手写转义规则。
  2. 编码后的文本里不许出现字面的 `<script>` / `</script` 序列——一段打印 HTML 的
     教学程序会让 HTML 分词器当场断页，而 `json.dumps` 不管这件事。把结果里所有
     `<` 统一替换成 `<`：JSON 与 JS 字面量语法都接受 `<`，解码后逐字节
     还原成 `<`；`<` 在 JSON 语法里从不出现在字符串值以外的地方，所以整串替换
     不会破坏 JSON 结构，也不需要专门分辨 `<script` 与其他 `<`。
  3. `ensure_ascii=True` 顺带转义了 U+2028 / U+2029——它们在 JS 字符串字面量里是
     行终止符，原样出现会在解析期就截断字符串字面量、造成语法错。**不要**改用
     `ensure_ascii=False`，那样两个码位就不再被转义。

`lines` 的定义（Task 11c 追加裁决 T11-1，源自 Task 11 评审 I4；T14 的
`program_count_check` 用同一个定义重算，两边必须同法，否则那道门会在一处无害
的差异上永远报红）：源码**按 `\\n` 切**、去掉文件末尾换行产生的那个空尾巴、再去掉
BLANK 指令行（`# >>> BLANK …` 与 `# <<< BLANK`）之后的行数——这正是读模式与临摹模式
里她看到的程序（`core/exercise.js` 的 `clean()`）的行数。读模式的行号栏会因为文件
末尾的换行多显示一个空行号；`lines` 不数它（控制方裁决：不改 `renderDoc`，改说明）。

只按 `\\n` 切，**不用 `splitlines()`**（第 1 期地基终审 G3）：`splitlines()` 还把
U+0085 / U+2028 / U+2029 / `\\r` / `\\x0b` 等当换行，而页面的 `clean()` 是
`source.split('\\n')`，不认它们。旧写法在一个带 U+0085 的程序上会多数一行，而
`program_count_check` 用同一个 `splitlines()`，两边一起数错、彼此一致——门绿、
数字与页面不符。`syntax.js_parser_parity_check` 在裸 vm 里跑页面自己的 `clean()`
来核对这个数，并禁止 `.py` 里出现 U+2028 / U+2029 / U+0085。

页面把 `lines` 当「程序有多长」显示，选择器「不超过 20 / 40 / 80 行」也按它筛：
旧定义（含指令行）每挖一个空就多算两行，ch01 的 `int-float-str`（看得到 17 行、旧定义显示 21 行）与
`divmod-and-floor`（看得到 19 行、旧定义显示 21 行）都因此被「不超过 20 行」的
筛选漏掉。

判定「是不是指令行」本脚本自带一份实现（见下面 `_is_directive_line()` 与它用的
`_DIRECTIVE_OPEN_RE` / `_DIRECTIVE_CLOSE_RE`），与
`program_count_check` 复用的 `gates/library.py` 判定各自独立——构建脚本与门
互为独立测量，谁都不导入对方的函数。

编码纪律（裁决 R21）：R16 允许 BLANK 指令行里写中文提示（`hint="…" hintEn="…"`）
之后，`.py` **不再保证 ASCII 可解码**。本脚本读写任何 `.py` / `chapter.json` /
`python-tools.json` 都**显式 `encoding='utf-8'`**，绝不依赖平台默认编码。

用法：
    python3 python/scripts/build_programs.py                 # 注入并回写注册表
    python3 python/scripts/build_programs.py --check          # 只检查，不写；不同步则退出码 1
    python3 python/scripts/build_programs.py --print-changed  # 只打印本次改动过的文件路径（机读，一行一个）
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent  # .../python
PROGRAMS_DIR = ROOT / 'programs'
TOOLS_DIR = ROOT / 'tools'
REGISTRY = ROOT / 'python-tools.json'

END_MARK = '/* <<< GENERATED:PROGRAMS */'

MARK_RE = re.compile(
    r'/\* >>> GENERATED:PROGRAMS(.*?) \*/\n(.*?)/\* <<< GENERATED:PROGRAMS \*/',
    re.DOTALL)

# 与 core/exercise.js 的 DIRECTIVE_OPEN / DIRECTIVE_CLOSE 同义（同一对正则，
# 各自独立抄写一份——本脚本不导入 gates/library.py 的 _is_directive，那道门
# 也不导入这两个常量，见文件头「lines 的定义」）：
#   DIRECTIVE_OPEN  = /^\s*#\s*>>>\s*BLANK\s+(.*)$/
#   DIRECTIVE_CLOSE = /^\s*#\s*<<<\s*BLANK\s*$/
_DIRECTIVE_OPEN_RE = re.compile(r'^\s*#\s*>>>\s*BLANK\s+(.*)$')
_DIRECTIVE_CLOSE_RE = re.compile(r'^\s*#\s*<<<\s*BLANK\s*$')


def _is_directive_line(line: str) -> bool:
    return bool(_DIRECTIVE_OPEN_RE.match(line) or _DIRECTIVE_CLOSE_RE.match(line))


def count_lines(src: str) -> int:
    """`lines` 的定义（见文件头）：按 `\\n` 切、去掉文件末尾换行产生的空尾巴、
    再去掉 BLANK 指令行之后的行数。

    按 `\\n` 切、不认 U+0085 / U+2028 / U+2029 为换行，因为页面不认——
    `Exercise.clean()` 是 `split('\\n')`。
    """
    parts = src.split('\n')
    if parts[-1] == '':
        parts.pop()                      # 文件末尾换行之后的那个空尾巴
    return sum(1 for line in parts if not _is_directive_line(line))


def encode_payload(payload: dict) -> str:
    """把 payload 编码成可以安全塞进 `<script>` 标签的 JS 表达式字面量文本。

    见文件头「三条嵌入硬要求」。json.dumps 之后的整串文本上做 `<` -> `\\u003c`
    的全局替换——`<` 在 JSON 语法里只会出现在字符串值内部，不会出现在结构性的
    逗号/冒号/括号之间，所以这个替换永远只触及字符串内容，不会破坏 JSON 结构。
    """
    text = json.dumps(payload, ensure_ascii=True, indent=2)
    return text.replace('<', '\\u003c')


def load_chapter(chapter_path: pathlib.Path) -> dict:
    """读取并解析一个 chapter.json，产出干净的 ERROR 而不是裸 traceback。

    每一章的 chapter.json 由不同的实现者手写，畸形是必然会发生的（JSON 语法错、
    漏字段、字段类型错）。这个脚本的其余每一条失败路径都产出点名文件的
    `ERROR: ...` 信息（目标页不存在、.py 缺失、哨兵内容不认识、注册表缺条目）——
    解析 chapter.json 不该是唯一一条留着裸 KeyError / JSONDecodeError 的路径，
    那对下一个写 chapter.json 的人是完全不同的两种体验。
    """
    try:
        text = chapter_path.read_text(encoding='utf-8')
    except OSError as exc:
        raise SystemExit(f'ERROR: {chapter_path} 读取失败：{exc}') from None
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise SystemExit(f'ERROR: {chapter_path} 不是合法 JSON：{exc}') from None
    if not isinstance(data, dict):
        raise SystemExit(
            f'ERROR: {chapter_path} 顶层必须是一个 JSON 对象，实际是 '
            f'{type(data).__name__}')
    return data


def required_field(data, key: str, context: str):
    """从一个已解析的 JSON 对象里取必需字段；缺失或对象本身形状不对时报干净的
    ERROR（点名 context 与字段名），不是裸 KeyError/TypeError。
    """
    try:
        return data[key]
    except KeyError:
        raise SystemExit(f'ERROR: {context} 缺少必需字段 "{key}"') from None
    except TypeError:
        raise SystemExit(
            f'ERROR: {context} 不是一个 JSON 对象，无法取字段 "{key}"') from None


def discover_chapters() -> dict:
    """`python/programs/ch*/chapter.json` -> {tool 名: [(章目录, chapter 数据), ...]}。

    按目录名排序保证确定性；同一个 tool 名理论上只有一个章节点名它
    （design §5.2："章目录与注册表工具页一一对应"），这里仍按列表处理，
    多个章节共用一页时会合并注入、并要求它们的 module 字段一致。
    """
    groups: dict = {}
    for chapter_path in sorted(PROGRAMS_DIR.glob('ch*/chapter.json')):
        chapter_dir = chapter_path.parent
        data = load_chapter(chapter_path)
        tool = required_field(data, 'tool', str(chapter_path))
        groups.setdefault(tool, []).append((chapter_dir, data))
    return groups


def build_programs_for_chapter(chapter_dir: pathlib.Path, data: dict) -> tuple:
    """返回 (本章的 programs 列表[含 source/lines], 本章总行数)。"""
    chapter_path = chapter_dir / 'chapter.json'
    programs_list = required_field(data, 'programs', str(chapter_path))
    if not isinstance(programs_list, list):
        raise SystemExit(
            f'ERROR: {chapter_path} 的 "programs" 字段必须是数组，实际是 '
            f'{type(programs_list).__name__}')

    programs = []
    total_lines = 0
    for i, prog in enumerate(programs_list):
        entry_context = f'{chapter_path}#programs[{i}]'
        if not isinstance(prog, dict):
            raise SystemExit(
                f'ERROR: {entry_context} 必须是一个 JSON 对象，实际是 '
                f'{type(prog).__name__}')
        file_name = required_field(prog, 'file', entry_context)
        py_path = chapter_dir / file_name
        if not py_path.exists():
            raise SystemExit(
                f'ERROR: {chapter_path} 点名的程序文件不存在：{py_path}')
        src = py_path.read_text(encoding='utf-8')
        lines = count_lines(src)
        prog_out = dict(prog)
        prog_out['source'] = src
        prog_out['lines'] = lines
        programs.append(prog_out)
        total_lines += lines
    return programs, total_lines


def render_page(page: pathlib.Path, original: str, chapters: list) -> tuple:
    """就地渲染一个工具页的 GENERATED:PROGRAMS 区段。

    返回 (新文本, 是否需要把 (programs 数, 行数) 回写进注册表的 (tool, programs, lines) 或 None)。
    `chapters` 为该页对应 tool 名下已发现的 [(章目录, chapter 数据), ...]，可能是空列表
    （表示没有章节点名这一页——只有配合 `none` 哨兵才合法，否则是硬错误）。
    `original` 由调用方读入一次，这里不重复读盘。
    """
    tool = page.stem
    m = MARK_RE.search(original)
    if not m:
        raise SystemExit(f'ERROR: {page} 缺少 GENERATED:PROGRAMS 标记区间')

    sentinel = m.group(1).strip()

    if sentinel == 'none':
        # 裁决 R2：显式弃权。区段留空、不报错、也不去找对应的章目录——即便
        # chapters 恰好非空也是配置冲突（一个章节点名了一个自称"没有程序"的页），
        # 那种情况在下面单独报错，不能被这里悄悄吞掉。
        if chapters:
            names = ', '.join(str(d / 'chapter.json') for d, _ in chapters)
            raise SystemExit(
                f'ERROR: {page} 的 GENERATED:PROGRAMS 标记是 none（显式弃权），但 '
                f'{names} 仍把 {tool!r} 列为目标页——去掉 none 或者改章节的 "tool" 字段')
        new_text = MARK_RE.sub(
            lambda _m: f'/* >>> GENERATED:PROGRAMS{_m.group(1)} */\n{END_MARK}',
            original, count=1)
        return new_text, None

    if sentinel:
        raise SystemExit(
            f'ERROR: {page} 的 GENERATED:PROGRAMS 标记行有未识别的内容 {sentinel!r}——'
            f'只认空白（正常注入）或 none（模板页显式弃权）')

    if not chapters:
        raise SystemExit(
            f'ERROR: {page} 没有任何章节点名它，GENERATED:PROGRAMS 会被注入空列表——'
            f'这是硬错误（照 cryptography 让空 ALGOS 清单报错的同一条规矩：空正是疏漏'
            f'呈现的形状）。如果这确实是一个不带程序的模板页，把标记行改成 '
            f'`/* >>> GENERATED:PROGRAMS none */`')

    module = None
    programs: list = []
    total_lines = 0
    for chapter_dir, data in chapters:
        chapter_path = chapter_dir / 'chapter.json'
        chapter_module = required_field(data, 'module', str(chapter_path))
        if module is None:
            module = chapter_module
        elif module != chapter_module:
            raise SystemExit(
                f'ERROR: 工具页 {tool!r} 下的章节 module 不一致：{module} 与 '
                f'{chapter_module}（{chapter_path}）')
        progs, lines = build_programs_for_chapter(chapter_dir, data)
        programs.extend(progs)
        total_lines += lines

    if not programs:
        # chapter.json 存在但它自己的 "programs" 列表是空的——同样不能悄悄通过。
        raise SystemExit(
            f'ERROR: 点名 {tool!r} 的章节 "programs" 列表是空的，没有东西可注入')

    payload = {'module': module, 'tool': tool, 'programs': programs}
    body = 'var PyPrograms = ' + encode_payload(payload) + ';'
    new_text = MARK_RE.sub(
        lambda _m: f'/* >>> GENERATED:PROGRAMS */\n{body}\n{END_MARK}',
        original, count=1)
    return new_text, (tool, len(programs), total_lines)


def compute_registry_update(updates: dict):
    """把 {tool: (programs 数, 行数)} 写回 REGISTRY 里对应的条目。

    返回 (新 registry dict, 是否有变化)；updates 为空时返回 None（不用碰注册表）。
    找不到匹配条目是硬错误——注册表条目由 R3 指定必须先手写好，脚本只回写数字，
    不代人决定要不要新增一条。
    """
    if not updates:
        return None
    if not REGISTRY.exists():
        raise SystemExit(f'ERROR: 找不到注册表 {REGISTRY}——请先创建它（R3）')
    registry = json.loads(REGISTRY.read_text(encoding='utf-8'))
    by_id = {t['id']: t for t in registry['tools']}
    changed = False
    for tool, (count, lines) in sorted(updates.items()):
        entry = by_id.get(tool)
        if entry is None:
            raise SystemExit(
                f'ERROR: {REGISTRY} 里没有 id={tool!r} 的条目，无法回写 programs/lines')
        if entry.get('programs') != count or entry.get('lines') != lines:
            entry['programs'] = count
            entry['lines'] = lines
            changed = True
    return registry, changed


def main(check_only: bool = False, print_changed: bool = False) -> int:
    chapters_by_tool = discover_chapters()

    pages = sorted(TOOLS_DIR.glob('*.html'))
    page_by_tool = {p.stem: p for p in pages}

    # chapter → page 方向：每个章节点名的工具页必须存在，不存在就当场报错
    # （不要静默跳过——教学内容如果因为拼错文件名而从没被注入过，不该只是
    # "什么都没发生"）。
    missing = sorted(tool for tool in chapters_by_tool if tool not in page_by_tool)
    if missing:
        for tool in missing:
            dirs = ', '.join(str(d) for d, _ in chapters_by_tool[tool])
            print(f'ERROR: 章节（{dirs}）点名的工具页不存在：{TOOLS_DIR / (tool + ".html")}',
                  file=sys.stderr)
        return 1

    stale = []
    registry_updates: dict = {}
    for page in pages:
        chapters = chapters_by_tool.get(page.stem, [])
        original = page.read_text(encoding='utf-8')
        new_text, update = render_page(page, original, chapters)
        if update is not None:
            tool, count, lines = update
            registry_updates[tool] = (count, lines)
        if new_text != original:
            stale.append(page)
            if not check_only:
                page.write_text(new_text, encoding='utf-8')

    result = compute_registry_update(registry_updates)
    registry_changed = False
    if result is not None:
        registry, registry_changed = result
        if registry_changed and not check_only:
            REGISTRY.write_text(
                json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if check_only:
        if stale or registry_changed:
            print('ERROR: 以下文件与 .py 源码 / chapter.json 不一致，运行 '
                  'python3 python/scripts/build_programs.py 修复：', file=sys.stderr)
            for p in stale:
                print(f'  - {p}', file=sys.stderr)
            if registry_changed:
                print(f'  - {REGISTRY}', file=sys.stderr)
            return 1
        print(f'{len(pages)} 个工具页与注册表均已同步')
        return 0

    if print_changed:
        # 机读列表：一行一个本次运行改写过的文件路径。给 pre-commit 钩子用，
        # 让它只 `git add` 这些文件，而不是不分青红皂白地 `git add python/tools/*.html`
        # ——那样会把其他并行会话半写的文件一并卷进本次提交（根 CLAUDE.md
        # 「并行开工纪律」第 2 条记过这次事故）。
        for p in stale:
            print(p)
        if registry_changed:
            print(REGISTRY)
        return 0

    if stale:
        print(f'已更新 {len(stale)} 个工具页：{", ".join(p.name for p in stale)}')
    else:
        print(f'{len(pages)} 个工具页已是最新')
    if registry_changed:
        print(f'已回写 {REGISTRY}：{", ".join(sorted(registry_updates))}')
    return 0


if __name__ == '__main__':
    sys.exit(main(check_only='--check' in sys.argv,
                  print_changed='--print-changed' in sys.argv))
