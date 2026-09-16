"""D 组 · 程序库的十二道门。

这一组的期望值几乎全部来自**独立实现**或**磁盘上的另一份字节**：

  · `program_run_check` 让真正的 CPython 跑，比对 stdout —— 「我挑的程序对不对、
    输出符不符合预期」从作者说了算变成 CPython 说了算。
  · `algorithm_property_check` 的参照登记在 `properties.py`，每一条都刻意选了与
    被测程序**不同的机制**（裁决 R26：不能拿 `max` 当 `return max(a,b,c)` 的参照）。
  · `program_embed_roundtrip_check` 比的是 HTML 里的那份副本与磁盘上的 `.py`。
  · `source_indent_check` 用 CPython 的 `tokenize` 认出多行字符串，避免在一段
    合法的续行文本上误报。

只有几个闭集（`kind` / `level` / `boards` / `runtime` / `requires` 白名单）是我
写下的常量——它们本身就是规格（design §2.3）。

编码纪律（裁决 R21）：R16 允许 BLANK 指令行里写中文提示之后，`.py` **不再保证
ASCII 可解码**。本模块每一处读 `.py` 都显式 `encoding='utf-8'`；
`program_embed_roundtrip_check()` 的逐字节比对**两边同在 bytes 层**。
"""
from __future__ import annotations

import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import tokenize
import traceback

from . import (PROGRAMS_DIR, iter_programs, load_chapters, load_registry,
               read_text, run_node, tool_pages)
from . import properties

# ── design §2.3 的闭集。这几个是**规格**，所以可以写成常量。 ────────────────
KINDS = {'syntax', 'pattern', 'algorithm', 'project', 'embedded'}
LEVELS = {1, 2, 3, 4, 5}
BOARDS = {'AQA', 'OCR', 'Edexcel', 'CIE'}
RUNTIMES = {'cpython', 'micropython-microbit', 'micropython-pico'}
REQUIRES_WHITELIST = {'numpy', 'pandas', 'matplotlib', 'scipy', 'pygame'}
PROPERTIES = {'sort', 'search', 'structure', 'pure'}
# 显式弃权的标记。结构性豁免（runtime != cpython / 依赖 pygame）不需要写它——
# 原因已经在 runtime / requires 字段里，再抄一遍只会漂（design §5.4）。
TIERS = {'compile-only'}
# 派生字段一律不手写：build_programs.py 会往内联副本里填 source / lines。
# 手写的派生字段必然漂移——根 CLAUDE.md 已经为此付过一次学费（62 条里 48 条静默漂了）。
DERIVED_FIELDS = ('lines', 'source')

BLANK_OPEN_RE = re.compile(r'^\s*#\s*>>>\s*BLANK\s+(.*)$')
BLANK_CLOSE_RE = re.compile(r'^\s*#\s*<<<\s*BLANK\s*$')
PROGRAMS_BLOCK_RE = re.compile(
    r'/\* >>> GENERATED:PROGRAMS(.*?) \*/\n(.*?)/\* <<< GENERATED:PROGRAMS \*/',
    re.DOTALL)

DEFAULT_TIMEOUT = 5


def _tier(prog: dict) -> str:
    """三层策略（design §5.4）。

    `compile-only` 那一层仍然要过 `compile(src, id, 'exec')`——**`compile` 从不
    执行 import**，所以这道门不需要装 numpy / pandas / pygame 或任何 MicroPython
    运行时。第 0 期的十个程序全是 `stdlib` 层。
    """
    if prog.get('tier') == 'compile-only':
        return 'compile-only'            # 例外豁免（要 why，见 exemption_check）
    if prog.get('runtime', 'cpython') != 'cpython':
        return 'compile-only'            # 结构性
    reqs = prog.get('requires', [])
    if 'pygame' in reqs:
        return 'compile-only'            # 结构性
    if reqs:
        return 'scipy-stack'             # 缺库则跳过，并打印跳过了几段
    return 'stdlib'                      # 每次都真跑


def _pid(chapter_dir, prog) -> str:
    return f'{chapter_dir.name}/{prog.get("id", "<无 id>")}'


# ══════════════════════════════════════════════════════════════════════════
# 1. program_run_check
# ══════════════════════════════════════════════════════════════════════════

def program_run_check() -> int:
    """每段 `.py` 在**全新临时目录**里真跑一遍，stdout 必须逐字节等于 `run.expect`。

    沙箱纪律（design §5.4）：`PYTHONHASHSEED=0`、`cwd` 是一个刚建的临时目录
    （`_fixtures/` 先拷进去）、喂 `run.stdin`（缺省空串，这样裸 `input()` 会
    EOFError 而不是挂死）、`run.timeout` 秒超时。

    `PYTHONIOENCODING=utf-8` 是显式钉住的：它在 macOS 与 Linux 上默认值相同，
    但「相同」不该靠运气——本仓已经为「两台机器上不是同一件事」付过两次学费
    （MAX_ARG_STRLEN 与 PNG 压缩字节）。

    `.py` 先拷进临时目录再跑（不是拿绝对路径跑源目录里那一份），这样程序里任何
    相对路径都落在沙箱里，不会写脏 programs/。
    """
    rc = 0
    ran = skipped = compiled = 0
    total = 0
    for chapter_dir, _data, prog, py_path in iter_programs():
        total += 1
        name = _pid(chapter_dir, prog)
        if not py_path.exists():
            print(f'ERROR: {name} 的源码不存在：{py_path}', file=sys.stderr)
            rc = 1
            continue
        src = read_text(py_path)
        tier = _tier(prog)

        if tier == 'compile-only':
            try:
                compile(src, prog.get('id', py_path.name), 'exec')
            except SyntaxError as exc:
                print(f'ERROR: {name} 编译失败（{py_path}:{exc.lineno}）：{exc.msg}',
                      file=sys.stderr)
                rc = 1
                continue
            compiled += 1
            continue

        if tier == 'scipy-stack':
            missing = [m for m in prog.get('requires', []) if not _importable(m)]
            if missing:
                skipped += 1
                print(f'  跳过 {name}：缺库 {missing}（scipy-stack 层）')
                continue

        run = prog.get('run') or {}
        expect = run.get('expect')
        if expect is None:
            print(f'ERROR: {name} 是可运行层却没有 run.expect——没有期望值的真跑'
                  f'什么也验不了', file=sys.stderr)
            rc = 1
            continue

        with tempfile.TemporaryDirectory() as td:
            fixtures = chapter_dir / '_fixtures'
            if fixtures.is_dir():
                shutil.copytree(fixtures, os.path.join(td, '_fixtures'))
            target = os.path.join(td, py_path.name)
            shutil.copyfile(py_path, target)
            env = dict(os.environ)
            env['PYTHONHASHSEED'] = '0'
            env['PYTHONIOENCODING'] = 'utf-8'
            env['MPLBACKEND'] = 'Agg'
            try:
                proc = subprocess.run(
                    [sys.executable, py_path.name],
                    cwd=td, env=env, input=run.get('stdin', ''),
                    capture_output=True, text=True,
                    timeout=run.get('timeout', DEFAULT_TIMEOUT))
            except subprocess.TimeoutExpired:
                print(f'ERROR: {name} 超时（{run.get("timeout", DEFAULT_TIMEOUT)} 秒）'
                      f'——{py_path}', file=sys.stderr)
                rc = 1
                continue

        if proc.returncode != 0:
            print(f'ERROR: {name} 退出码 {proc.returncode}（{py_path}）\n'
                  f'{_indent(proc.stderr.strip())}', file=sys.stderr)
            rc = 1
            continue
        if proc.stdout != expect:
            print(f'ERROR: {name} 的 stdout 与 run.expect 不符（{py_path}）\n'
                  f'    期望：{expect!r}\n'
                  f'    实际：{proc.stdout!r}', file=sys.stderr)
            rc = 1
            continue
        ran += 1

    if total == 0:
        print('ERROR: 一个程序都没找到——这道门本该真跑程序，不是跑了个寂寞',
              file=sys.stderr)
        return 1
    if rc == 0:
        print(f'程序真跑：{ran} 段 stdout 与 run.expect 逐字节相符，'
              f'{compiled} 段只过 compile，{skipped} 段因缺库跳过（共 {total} 段）')
    return rc


def _importable(module: str) -> bool:
    import importlib.util
    try:
        return importlib.util.find_spec(module) is not None
    except (ImportError, ValueError):
        return False


def _indent(text: str, pad: str = '    ') -> str:
    return '\n'.join(pad + line for line in text.split('\n'))


# ══════════════════════════════════════════════════════════════════════════
# 2. algorithm_property_check
# ══════════════════════════════════════════════════════════════════════════

def algorithm_property_check() -> int:
    """带 `check.property` 的程序：拿 `properties.REFERENCES[id]['ref']` 当独立裁判。

    裁决 R26：**参考实现绝不能是被测程序自己用的那个函数。** `max-of-three-builtin.py`
    的代码本身就是 `return max(a, b, c)`，拿 `max` 当它的参照等于拿自己验自己——
    被测程序错的地方参照会跟着错，任何变异都测不出来。所以三条参照分别是内置
    `max`、`sorted([...])[-1]`、生成式 `sum(...)`，各自与被测程序机制不同。

    参照表**按被测程序的 id 索引，不是按 property 族名**（裁决 R6）：同一族名下
    的两个程序机制不同，参照也必须不同。所以「有 check.property 却没登记参照」
    是红，不是跳过——否则加一个程序就悄悄少一份覆盖。

    实参由 `properties.SEED` 固定种子生成 `properties.SAMPLES` 组，逐次可复现。
    """
    rc = 0
    checked = 0
    cases_total = 0
    with_property = set()
    for chapter_dir, _data, prog, py_path in iter_programs():
        check = prog.get('check') or {}
        prop = check.get('property')
        if not prop:
            continue
        with_property.add(prog.get('id'))
        name = _pid(chapter_dir, prog)
        if prop not in PROPERTIES:
            print(f'ERROR: {name} 的 check.property={prop!r} 不在闭集 '
                  f'{sorted(PROPERTIES)} 内', file=sys.stderr)
            rc = 1
            continue
        if _tier(prog) != 'stdlib':
            print(f'ERROR: {name} 标了 check.property 却不在 stdlib 层'
                  f'（tier={_tier(prog)}）——它没法被导入求值', file=sys.stderr)
            rc = 1
            continue
        ref_entry = properties.REFERENCES.get(prog['id'])
        if ref_entry is None:
            print(f'ERROR: {name} 有 check.property={prop!r}，但 '
                  f'gates/properties.py 的 REFERENCES 里没有它的参考实现。\n'
                  f'       参照按**程序 id** 登记（R6），不能跟同族的别的程序共用'
                  f'一份。', file=sys.stderr)
            rc = 1
            continue
        entry_name = prog.get('entry')
        if not entry_name:
            print(f'ERROR: {name} 有 check.property 却没有 entry 字段', file=sys.stderr)
            rc = 1
            continue

        src = read_text(py_path)
        ns: dict = {'__name__': '__pygate__'}   # 不是 __main__：别触发主程序
        try:
            exec(compile(src, str(py_path), 'exec'), ns)     # noqa: S102
        except Exception:                                    # noqa: BLE001
            print(f'ERROR: {name} 导入时抛错（{py_path}）：', file=sys.stderr)
            traceback.print_exc()
            rc = 1
            continue
        fn = ns.get(entry_name)
        if not callable(fn):
            print(f'ERROR: {name} 的 entry={entry_name!r} 在模块里不是可调用对象',
                  file=sys.stderr)
            rc = 1
            continue

        import random
        rng = random.Random(properties.SEED)
        ref = ref_entry['ref']
        cases = ref_entry['cases']
        bad = None
        for _ in range(properties.SAMPLES):
            args = cases(rng)
            cases_total += 1
            try:
                got = fn(*args)
            except Exception as exc:                         # noqa: BLE001
                bad = (args, f'抛错 {type(exc).__name__}: {exc}', None)
                break
            want = ref(*args)
            if got != want or type(got) is not type(want):
                bad = (args, got, want)
                break
        if bad is not None:
            args, got, want = bad
            print(f'ERROR: {name} 的 {entry_name}() 与参考实现不符（property={prop}，'
                  f'种子 {properties.SEED}）\n'
                  f'    反例实参：{args!r}\n'
                  f'    被测返回：{got!r}\n'
                  f'    参照返回：{want!r}\n'
                  f'    源码：{py_path}', file=sys.stderr)
            rc = 1
            continue
        checked += 1

    # 反方向：REFERENCES 里登记了、库里却没有这个程序。一条这样的参照什么都不验，
    # 但会让 `REFERENCES` 看上去比实际覆盖更宽——同一类「广告了并不具备的覆盖」。
    for stale in sorted(set(properties.REFERENCES) - with_property):
        print(f'ERROR: gates/properties.py 的 REFERENCES 里有 {stale!r} 的参考实现，'
              f'但程序库里没有带 check.property 的同名程序——这条参照一次都不会被'
              f'执行', file=sys.stderr)
        rc = 1

    if checked == 0 and rc == 0:
        print('ERROR: 一个带 check.property 的程序都没验到——这道门跑了个寂寞',
              file=sys.stderr)
        return 1
    if rc == 0:
        print(f'性质比对：{checked} 个程序 × {properties.SAMPLES} 组实参 = '
              f'{cases_total} 次调用，与独立参考实现全部一致（种子 {properties.SEED}）')
    return rc


# ══════════════════════════════════════════════════════════════════════════
# 3. program_embed_roundtrip_check
# ══════════════════════════════════════════════════════════════════════════

def program_embed_roundtrip_check() -> int:
    """从 HTML 抠出 GENERATED:PROGRAMS，在**裸 vm 沙箱**里解码，每段 `source`
    与磁盘 `.py` **逐字节**比。

    为什么在 vm 里解码而不是拿正则把 JSON 抠出来：内联副本经过了
    `encode_payload()` 的 `<` → `\\u003c` 全局替换（否则一段打印 HTML 的教学程序
    会让 HTML 分词器当场断页）。只有真让 JS 引擎求值一遍，才验得到「那个替换
    解码回来确实逐字节还原」。裸 context 顺带保证这里跑的是浏览器看到的那份
    字面量，不是 node 的什么变体。

    **两边同在 bytes 层**（裁决 R21）：node 那边给的是 str，这里 encode 成
    utf-8 再跟 `read_bytes()` 比——不许一边 bytes 一边 str。
    """
    rc = 0
    pages = 0
    programs = 0
    by_id = {}
    # 每个工具页**应该**内联哪些 id：由点名它的章节决定。不靠「只有一页时才查
    # 缺漏」那种写法——那种写法在第二个工具页出现的那一天会**安静地**停止检查
    # 缺漏，而没有任何东西会说一声。
    expected: dict = {}
    for chapter_dir, _data, prog, py_path in iter_programs():
        if prog.get('id'):
            by_id[prog['id']] = py_path
            tool = _data.get('tool')
            if tool:
                expected.setdefault(tool, set()).add(prog['id'])

    for page in tool_pages():
        text = read_text(page)
        m = PROGRAMS_BLOCK_RE.search(text)
        if not m:
            print(f'ERROR: {page.name} 缺 GENERATED:PROGRAMS 标记区间', file=sys.stderr)
            rc = 1
            continue
        if m.group(1).strip() == 'none':
            continue                     # 由 skeleton_leak_check 报，不重复报
        body = m.group(2)
        with tempfile.TemporaryDirectory() as td:
            block = os.path.join(td, 'block.js')
            with open(block, 'w', encoding='utf-8') as fh:
                fh.write(body)
            script = (
                'const vm = require("vm"), fs = require("fs");\n'
                'const sandbox = {}; sandbox.self = sandbox;\n'
                'vm.createContext(sandbox);\n'
                'if (typeof sandbox.module !== "undefined") {\n'
                '  console.error("沙箱不干净"); process.exit(1); }\n'
                f'vm.runInContext(fs.readFileSync({json.dumps(block)}, "utf8"), sandbox);\n'
                'const P = sandbox.PyPrograms;\n'
                'if (!P || !Array.isArray(P.programs)) {\n'
                '  console.error("内联块没有产出 PyPrograms.programs 数组");'
                ' process.exit(1); }\n'
                'const out = {};\n'
                'P.programs.forEach(function (p) { out[p.id] = p.source; });\n'
                'process.stdout.write(JSON.stringify(out));\n')
            proc = run_node(script)
        if proc.returncode != 0:
            print(f'ERROR: {page.name} 的 GENERATED:PROGRAMS 块在裸 vm 里求值失败：\n'
                  f'{_indent((proc.stderr or proc.stdout).strip())}', file=sys.stderr)
            rc = 1
            continue
        pages += 1
        embedded = json.loads(proc.stdout)
        for pid, source in sorted(embedded.items()):
            py_path = by_id.get(pid)
            if py_path is None:
                print(f'ERROR: {page.name} 内联了一个章节清单里没有的程序 id={pid}',
                      file=sys.stderr)
                rc = 1
                continue
            got = source.encode('utf-8')
            want = py_path.read_bytes()
            if got != want:
                where = _first_byte_diff(got, want)
                print(f'ERROR: {page.name} 内联的 {pid} 与磁盘 {py_path} 不一致'
                      f'（第 {where} 个字节起）\n'
                      f'    内联：{got[max(0, where - 20):where + 20]!r}\n'
                      f'    磁盘：{want[max(0, where - 20):where + 20]!r}\n'
                      f'    修复：python3 python/scripts/build_programs.py',
                      file=sys.stderr)
                rc = 1
                continue
            programs += 1
        want_ids = expected.get(page.stem, set())
        missing = sorted(want_ids - set(embedded))
        extra = sorted(set(embedded) - want_ids)
        if missing:
            print(f'ERROR: {page.name} 少内联了 {missing}——章节点名了它们，'
                  f'页面里却没有', file=sys.stderr)
            rc = 1
        if extra:
            print(f'ERROR: {page.name} 多内联了 {extra}——没有章节把它们指向这一页',
                  file=sys.stderr)
            rc = 1

    if pages == 0:
        print('ERROR: 一个带程序的工具页都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'内联往返：{pages} 个页面、{programs} 段程序，'
              f'在裸 vm 里解码后与磁盘 `.py` 逐字节相同')
    return rc


def _first_byte_diff(a: bytes, b: bytes) -> int:
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return i
    return min(len(a), len(b))


# ══════════════════════════════════════════════════════════════════════════
# 4. chapter_manifest_check
# ══════════════════════════════════════════════════════════════════════════

def chapter_manifest_check() -> int:
    """清单点名的 `.py` 存在；目录里的 `.py` 都被点名；章目录与注册表工具页一一对应。

    双向都要查：只查一个方向，反方向的疏漏（写了程序忘了登记 / 登记了忘了写）
    就是「什么都没发生」。章目录 ↔ 工具页的一一对应同理——一个 `tool` 字段拼错
    的章节，今天只会让它的程序静静地没进任何页面。
    """
    rc = 0
    reg_ids = {t['id'] for t in load_registry()['tools']}
    tools_seen: dict = {}
    chapters = load_chapters()
    if not chapters:
        print(f'ERROR: {PROGRAMS_DIR} 下一个 chapter.json 都没有', file=sys.stderr)
        return 1

    files_total = 0
    for chapter_dir, data in chapters:
        named = set()
        for prog in data.get('programs') or []:
            fname = prog.get('file')
            if not fname:
                print(f'ERROR: {chapter_dir.name} 有条目缺 file 字段', file=sys.stderr)
                rc = 1
                continue
            named.add(fname)
            if not (chapter_dir / fname).exists():
                print(f'ERROR: {chapter_dir.name}/chapter.json 点名的程序文件不存在：'
                      f'{chapter_dir / fname}', file=sys.stderr)
                rc = 1
        on_disk = {p.name for p in chapter_dir.glob('*.py')}
        files_total += len(on_disk)
        orphan = sorted(on_disk - named)
        if orphan:
            for f in orphan:
                print(f'ERROR: {chapter_dir / f} 躺在章目录里但 chapter.json 没点名它'
                      f'——它不会被注入任何页面，今天在别处一个错都不报',
                      file=sys.stderr)
            rc = 1

        tool = data.get('tool')
        if not tool:
            print(f'ERROR: {chapter_dir.name}/chapter.json 缺 "tool" 字段',
                  file=sys.stderr)
            rc = 1
            continue
        if tool not in reg_ids:
            print(f'ERROR: {chapter_dir.name}/chapter.json 的 tool={tool!r} 不在注册表里',
                  file=sys.stderr)
            rc = 1
        tools_seen.setdefault(tool, []).append(chapter_dir.name)

    for tool, dirs in sorted(tools_seen.items()):
        if len(dirs) > 1:
            print(f'ERROR: 工具页 {tool!r} 被多个章目录点名：{dirs}——'
                  f'章目录与工具页必须一一对应', file=sys.stderr)
            rc = 1
    for tid in sorted(reg_ids - set(tools_seen)):
        print(f'ERROR: 注册表里的工具 {tid!r} 没有任何章目录点名它——'
              f'它是一个空页面', file=sys.stderr)
        rc = 1

    if rc == 0:
        print(f'章节清单：{len(chapters)} 个章目录、{files_total} 个 .py 双向点名齐全，'
              f'与注册表的 {len(reg_ids)} 个工具页一一对应')
    return rc


# ══════════════════════════════════════════════════════════════════════════
# 5. anchor_check
# ══════════════════════════════════════════════════════════════════════════

def anchor_check() -> int:
    """`lineNotes.at` / `chunks.from` / `chunks.to` 的整行原文在源码里存在且唯一。

    锚用整行原文而不是行号（design §2.3）：行号会在编辑上方任何一行时静默错位，
    把注解挂到错的行上——而那是一种**看起来完全正常**的坏。所以「找不到」与
    「不唯一」都必须当场红：失败得响亮，好过挂错行。
    """
    rc = 0
    anchors = 0
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not py_path.exists():
            continue
        name = _pid(chapter_dir, prog)
        lines = read_text(py_path).split('\n')
        targets = []
        for i, note in enumerate(prog.get('lineNotes') or []):
            targets.append((f'lineNotes[{i}].at', note.get('at')))
        for i, chunk in enumerate(prog.get('chunks') or []):
            targets.append((f'chunks[{i}].from', chunk.get('from')))
            targets.append((f'chunks[{i}].to', chunk.get('to')))
        for where, text in targets:
            if not isinstance(text, str) or not text:
                print(f'ERROR: {name} 的 {where} 不是非空字符串：{text!r}',
                      file=sys.stderr)
                rc = 1
                continue
            anchors += 1
            hits = [n + 1 for n, line in enumerate(lines) if line == text]
            if not hits:
                near = [n + 1 for n, line in enumerate(lines) if line.strip() == text.strip()]
                hint = (f'（第 {near} 行去掉首尾空白后相同——锚是**整行原文**，'
                        f'缩进也算）' if near else '')
                print(f'ERROR: {name} 的 {where} 在 {py_path} 里找不到{hint}\n'
                      f'    锚：{text!r}', file=sys.stderr)
                rc = 1
            elif len(hits) > 1:
                print(f'ERROR: {name} 的 {where} 在 {py_path} 里出现 {len(hits)} 次'
                      f'（第 {hits} 行）——锚必须唯一\n'
                      f'    锚：{text!r}', file=sys.stderr)
                rc = 1
    if anchors == 0:
        print('ERROR: 一个锚都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'行锚：{anchors} 条 lineNotes/chunks 锚在源码里都存在且唯一')
    return rc


# ══════════════════════════════════════════════════════════════════════════
# 6. exemption_check
# ══════════════════════════════════════════════════════════════════════════

def exemption_check() -> int:
    """例外豁免必须带 `why`，每页至多 2 个，且每次运行**逐条打印**（design §5.4）。

    豁免分两类，只有第二类需要具名：

      · **结构性豁免**：`runtime != cpython`，或 `requires` 含 pygame。自动放行、
        无需 `why`——原因已经在字段里，再抄一遍只会漂。
      · **例外豁免**：一个普通的 `cpython` 程序（`requires` 不含 pygame）却写了
        `"tier": "compile-only"`。必须带非空 `why`，每页至多 2 个。

    单一阈值在这里是自相矛盾的：M7/M8 几乎整章都跑不了，任何「一章 compile-only
    超过 N% 就红」的规则会永远红。而**逐条打印**是这道门的另一半：疏漏呈现出来
    的形状就是「安静地积累」，所以例外不能是无声的默认。

    第 0 期十个程序全在 stdlib 层，今天一条例外都没有——这一条的负控制因此必须
    **临时造一条**出来，否则它是一段从没被执行过的断言。
    """
    rc = 0
    structural = 0
    exceptional: dict = {}
    for chapter_dir, data, prog, _py in iter_programs():
        name = _pid(chapter_dir, prog)
        tier_field = prog.get('tier')
        if tier_field is not None and tier_field not in TIERS:
            print(f'ERROR: {name} 的 tier={tier_field!r} 不在闭集 {sorted(TIERS)} 内',
                  file=sys.stderr)
            rc = 1
            continue
        runtime = prog.get('runtime', 'cpython')
        reqs = prog.get('requires') or []
        is_structural = runtime != 'cpython' or 'pygame' in reqs
        if is_structural:
            if _tier(prog) == 'compile-only':
                structural += 1
            continue
        if tier_field != 'compile-only':
            continue
        # 到这里就是例外豁免
        tool = data.get('tool', chapter_dir.name)
        exceptional.setdefault(tool, []).append((name, prog))

    for tool, items in sorted(exceptional.items()):
        print(f'例外豁免 · {tool}：{len(items)} 条')
        for name, prog in items:
            why = prog.get('why')
            print(f'    - {name}：{why!r}')
            if not isinstance(why, str) or not why.strip():
                print(f'ERROR: {name} 是例外豁免（普通 cpython 程序却标了 '
                      f'compile-only）却没有非空的 why——原因不在任何字段里，'
                      f'只能靠人写下来', file=sys.stderr)
                rc = 1
        if len(items) > 2:
            print(f'ERROR: 工具页 {tool!r} 有 {len(items)} 条例外豁免，上限是 2',
                  file=sys.stderr)
            rc = 1

    if rc == 0:
        print(f'豁免：结构性 {structural} 条（runtime / pygame，自动放行），'
              f'例外 {sum(len(v) for v in exceptional.values())} 条'
              + ('——今天一条都没有，所以这道门的例外分支只在负控制里被执行过'
                 if not exceptional else ''))
    return rc


# ══════════════════════════════════════════════════════════════════════════
# 7/8/9. 源码字符与排版
# ══════════════════════════════════════════════════════════════════════════

def _is_directive(line: str) -> bool:
    return bool(BLANK_OPEN_RE.match(line) or BLANK_CLOSE_RE.match(line))


def source_ascii_check() -> int:
    """每段 `.py` 的**程序体**纯 ASCII；`# >>> BLANK` / `# <<< BLANK` 指令行豁免。

    指令行按双语设计就是中文（`hint="…"` 是给中文使用者看的，`hintEn="…"` 是
    英文那份，见全局约束 6 / 裁决 R16）。豁免只给**指令行本身**——不是「跳过所有
    注释行」，那样豁免就退化成一条什么都不管的规则。程序体要纯 ASCII 是因为
    A-level 卷面本来就是英文，而且中文全角字符会让三层影子临摹的逐字符对齐错位。
    """
    rc = 0
    files = 0
    exempt_lines = 0
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not py_path.exists():
            continue
        files += 1
        name = _pid(chapter_dir, prog)
        for n, line in enumerate(read_text(py_path).split('\n'), 1):
            if _is_directive(line):
                exempt_lines += 1
                continue
            for col, ch in enumerate(line, 1):
                if ord(ch) > 127:
                    print(f'ERROR: {name} 的程序体有非 ASCII 字符 '
                          f'{ch!r}（U+{ord(ch):04X}）：{py_path}:{n}:{col}\n'
                          f'       {line.strip()[:90]}\n'
                          f'       只有 BLANK 指令行可以写中文（hint=/hintEn=），'
                          f'普通注释与代码不行。', file=sys.stderr)
                    rc = 1
                    break
    if files == 0:
        print('ERROR: 一个 .py 都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'源码 ASCII：{files} 个 .py 的程序体纯 ASCII'
              f'（{exempt_lines} 行 BLANK 指令按 R16 豁免）')
    return rc


def source_bmp_check() -> int:
    """`.py` 里不许出现**非 BMP** 字符（码位 > U+FFFF），**含指令行**（裁决 R22）。

    CPython 的 `tokenize` 给**字符**偏移、JS 给 **UTF-16 码元**偏移，两者只在全
    BMP 时相等。一个 emoji 会让该行之后所有偏移**静默平移且不报错**——
    `lex_vs_cpython_check` 会开始比对错位的区间，三层影子临摹会从那一行起对不上。

    实测本章最高码位 U+FF1B（全角分号），482 字符 == 482 码元——安全，但那是运气：
    换成 `x = 1  # 🚀` 立刻是 17 字符 vs 18 码元。所以这道门每次运行都把
    「字符数 vs 码元数」打出来，让「今天恰好相等」这件事是被测量的，不是被假设的。
    """
    rc = 0
    files = 0
    chars = units = 0
    top = 0
    top_where = ''
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not py_path.exists():
            continue
        files += 1
        name = _pid(chapter_dir, prog)
        text = read_text(py_path)
        chars += len(text)
        units += len(text.encode('utf-16-le')) // 2
        for n, line in enumerate(text.split('\n'), 1):
            for col, ch in enumerate(line, 1):
                if ord(ch) > top:
                    top, top_where = ord(ch), f'{name}:{n}:{col}'
                if ord(ch) > 0xFFFF:
                    print(f'ERROR: {name} 有非 BMP 字符 {ch!r}（U+{ord(ch):04X}）：'
                          f'{py_path}:{n}:{col}\n'
                          f'       CPython 给字符偏移、JS 给 UTF-16 码元偏移，'
                          f'这一行之后所有偏移会静默平移且不报错。', file=sys.stderr)
                    rc = 1
    if files == 0:
        print('ERROR: 一个 .py 都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'BMP：{files} 个 .py 共 {chars} 字符 == {units} 个 UTF-16 码元'
              f'（最高码位 U+{top:04X} @ {top_where}）')
    return rc


def _multiline_string_rows(src: str) -> set:
    """源码里落在**多行字符串内部**的行号（1-based，不含起始那一行）。

    拿 CPython 的 `tokenize` 认，而不是自己数三引号：缩进规则不适用于一段续行的
    文本，而「这一行在不在字符串里」正是 tokenize 天生知道、正则天生不知道的事。
    源码不合法时（这道门不该替语法门报错）返回空集合，让缩进规则照常适用。
    """
    rows = set()
    try:
        for tok in tokenize.generate_tokens(io.StringIO(src).readline):
            if tok.type == tokenize.STRING and tok.end[0] > tok.start[0]:
                rows.update(range(tok.start[0] + 1, tok.end[0] + 1))
    except (tokenize.TokenError, SyntaxError, IndentationError):
        return set()
    return rows


def source_indent_check() -> int:
    """无制表符；缩进是 4 的倍数；行尾无多余空白；文件以单个 LF 结尾。

    多行字符串内部的行不参与缩进判定——用 CPython 的 `tokenize` 认出来
    （见 `_multiline_string_rows`）。一段续行文本的缩进由文本自己决定，拿
    「4 的倍数」去要求它只会在合法代码上误报，而一道误报的门会被调弱或无视。
    """
    rc = 0
    files = 0
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not py_path.exists():
            continue
        files += 1
        name = _pid(chapter_dir, prog)
        raw = py_path.read_bytes()
        text = read_text(py_path)
        skip_rows = _multiline_string_rows(text)
        for n, line in enumerate(text.split('\n'), 1):
            if '\t' in line:
                print(f'ERROR: {name} 第 {n} 行有制表符：{py_path}:{n}\n'
                      f'       {line.replace(chr(9), "→")[:90]}', file=sys.stderr)
                rc = 1
            if line != line.rstrip():
                print(f'ERROR: {name} 第 {n} 行有行尾空白（{len(line) - len(line.rstrip())} 个）：'
                      f'{py_path}:{n}', file=sys.stderr)
                rc = 1
            if not line.strip() or n in skip_rows:
                continue
            indent = len(line) - len(line.lstrip(' '))
            if indent % 4 != 0:
                print(f'ERROR: {name} 第 {n} 行缩进是 {indent} 个空格，不是 4 的倍数：'
                      f'{py_path}:{n}\n       {line[:90]}', file=sys.stderr)
                rc = 1
        if not raw.endswith(b'\n'):
            print(f'ERROR: {name} 的文件末尾没有换行：{py_path}', file=sys.stderr)
            rc = 1
        elif raw.endswith(b'\n\n'):
            print(f'ERROR: {name} 的文件末尾有多余空行：{py_path}', file=sys.stderr)
            rc = 1
    if files == 0:
        print('ERROR: 一个 .py 都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'排版：{files} 个 .py 无制表符、缩进 4 的倍数、无行尾空白、单 LF 收尾')
    return rc


# ══════════════════════════════════════════════════════════════════════════
# 10. blank_directive_check
# ══════════════════════════════════════════════════════════════════════════

_HINT_EN_RE = re.compile(r'\bhintEn="((?:[^"\\]|\\.)*)"')
_HINT_RE = re.compile(r'\bhint="((?:[^"\\]|\\.)*)"')
_ID_RE = re.compile(r'\bid=(\S+)')
_LEVEL_RE = re.compile(r'\blevel=(\S+)')


def blank_directive_check() -> int:
    """BLANK 指令成对；`id/level/hint/hintEn` 齐全；id 页内唯一；`level ∈ 1..3`；挖空体非空。

    这里**不调用 `core/exercise.js`**，而是在 Python 里重写一遍同一套解析规则。
    理由是这道门守的是**数据**（`.py` 里的指令），拿被守护的那个模块去解析它，
    等于让实现替自己的输入背书——`exercise.js` 若把 `hintEn` 的正则写松了，
    两边会一起松。两份独立的解析器对同一份数据给出同样的结论，才是证据。

    属性解析顺序照 `exercise.js` 的注释：先摘 `hintEn`、再摘 `hint`、最后在剩下
    的裸文本上取 `id` / `level`——否则 `hint="..."` 的正则会先吃掉 `hintEn` 的值
    （`hintEn` 里含子串 `hint`）。
    """
    rc = 0
    blanks = 0
    files = 0
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not py_path.exists():
            continue
        files += 1
        name = _pid(chapter_dir, prog)
        lines = read_text(py_path).split('\n')
        open_at = -1
        open_attrs = ''
        seen_ids = set()
        for n, line in enumerate(lines, 1):
            om = BLANK_OPEN_RE.match(line)
            if om:
                if open_at >= 0:
                    print(f'ERROR: {name}:{n} 又开了一个 BLANK，但第 {open_at} 行的'
                          f'那个还没关：{py_path}:{n}', file=sys.stderr)
                    rc = 1
                open_at, open_attrs = n, om.group(1)
                continue
            if BLANK_CLOSE_RE.match(line):
                if open_at < 0:
                    print(f'ERROR: {name}:{n} 有一条 `# <<< BLANK` 却没有与之配对的'
                          f'开始行：{py_path}:{n}', file=sys.stderr)
                    rc = 1
                    continue
                body = lines[open_at:n - 1]
                if not any(b.strip() for b in body):
                    print(f'ERROR: {name} 第 {open_at}–{n} 行的挖空体是空的：'
                          f'{py_path}:{open_at}——挖一个什么都没有的空，'
                          f'使用者面对的是一条无法回答的题', file=sys.stderr)
                    rc = 1
                rc |= _check_attrs(name, py_path, open_at, open_attrs, seen_ids)
                blanks += 1
                open_at = -1
        if open_at >= 0:
            print(f'ERROR: {name} 第 {open_at} 行的 BLANK 一直没有关闭：'
                  f'{py_path}:{open_at}', file=sys.stderr)
            rc = 1
    if blanks == 0:
        print('ERROR: 一条 BLANK 指令都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'BLANK 指令：{files} 个 .py 共 {blanks} 个挖空，成对、四属性齐全、'
              f'id 页内唯一、level ∈ 1–3、挖空体非空')
    return rc


def _check_attrs(name, py_path, line_no, attrs, seen_ids) -> int:
    rc = 0
    hint_en_m = _HINT_EN_RE.search(attrs)
    if not hint_en_m:
        print(f'ERROR: {name}:{line_no} 的 BLANK 指令缺 hintEn="..."：'
              f'{py_path}:{line_no}', file=sys.stderr)
        rc = 1
        rest = attrs
    else:
        if not hint_en_m.group(1).strip():
            print(f'ERROR: {name}:{line_no} 的 hintEn 是空串：{py_path}:{line_no}',
                  file=sys.stderr)
            rc = 1
        rest = attrs[:hint_en_m.start()] + attrs[hint_en_m.end():]

    hint_m = _HINT_RE.search(rest)
    if not hint_m:
        print(f'ERROR: {name}:{line_no} 的 BLANK 指令缺 hint="..."：'
              f'{py_path}:{line_no}', file=sys.stderr)
        rc = 1
        bare = rest
    else:
        if not hint_m.group(1).strip():
            print(f'ERROR: {name}:{line_no} 的 hint 是空串：{py_path}:{line_no}',
                  file=sys.stderr)
            rc = 1
        bare = rest[:hint_m.start()] + rest[hint_m.end():]

    id_m = _ID_RE.search(bare)
    if not id_m:
        print(f'ERROR: {name}:{line_no} 的 BLANK 指令缺 id=：{py_path}:{line_no}',
              file=sys.stderr)
        rc = 1
    else:
        if id_m.group(1) in seen_ids:
            print(f'ERROR: {name}:{line_no} 的 BLANK id={id_m.group(1)!r} 在本页重复：'
                  f'{py_path}:{line_no}', file=sys.stderr)
            rc = 1
        seen_ids.add(id_m.group(1))

    level_m = _LEVEL_RE.search(bare)
    if not level_m:
        print(f'ERROR: {name}:{line_no} 的 BLANK 指令缺 level=：{py_path}:{line_no}',
              file=sys.stderr)
        rc = 1
    elif level_m.group(1) not in ('1', '2', '3'):
        print(f'ERROR: {name}:{line_no} 的 BLANK level={level_m.group(1)!r}，'
              f'必须是 1、2 或 3：{py_path}:{line_no}', file=sys.stderr)
        rc = 1
    return rc


# ══════════════════════════════════════════════════════════════════════════
# 11. program_meta_check
# ══════════════════════════════════════════════════════════════════════════

def program_meta_check() -> int:
    """id 全库唯一；四个闭集；双语字段齐全；`requires` 在白名单；派生字段不许手写。

    `chapter.json` 里**不许出现 `lines` / `source`**：它们由 `build_programs.py`
    从 `.py` 数出来、填进内联副本。手写的派生字段必然漂移——根 CLAUDE.md 已经为此
    付过一次学费（62 条里 48 条静默漂了），而漂的那一份还被印在卡片上。
    """
    rc = 0
    seen: dict = {}
    total = 0
    for chapter_dir, _data, prog, _py in iter_programs():
        total += 1
        name = _pid(chapter_dir, prog)
        pid = prog.get('id')
        if not pid:
            print(f'ERROR: {chapter_dir.name} 有条目缺 id', file=sys.stderr)
            rc = 1
            continue
        if pid in seen:
            print(f'ERROR: 程序 id 重复：{pid!r} 同时出现在 {seen[pid]} 与 '
                  f'{chapter_dir.name}', file=sys.stderr)
            rc = 1
        seen[pid] = chapter_dir.name

        for field in DERIVED_FIELDS:
            if field in prog:
                print(f'ERROR: {name} 手写了派生字段 "{field}"={prog[field]!r}——'
                      f'它由 build_programs.py 从 .py 算出来，手写的必然漂移',
                      file=sys.stderr)
                rc = 1

        if prog.get('kind') not in KINDS:
            print(f'ERROR: {name} 的 kind={prog.get("kind")!r} 不在闭集 '
                  f'{sorted(KINDS)} 内', file=sys.stderr)
            rc = 1
        if prog.get('level') not in LEVELS:
            print(f'ERROR: {name} 的 level={prog.get("level")!r} 不在 1–5 内',
                  file=sys.stderr)
            rc = 1
        boards = prog.get('boards')
        if not isinstance(boards, list) or not boards or not set(boards) <= BOARDS:
            print(f'ERROR: {name} 的 boards={boards!r} 必须是 {sorted(BOARDS)} 的'
                  f'非空子集', file=sys.stderr)
            rc = 1
        if prog.get('runtime', 'cpython') not in RUNTIMES:
            print(f'ERROR: {name} 的 runtime={prog.get("runtime")!r} 不在闭集 '
                  f'{sorted(RUNTIMES)} 内', file=sys.stderr)
            rc = 1
        reqs = prog.get('requires')
        if not isinstance(reqs, list) or not set(reqs) <= REQUIRES_WHITELIST:
            print(f'ERROR: {name} 的 requires={reqs!r} 必须是 '
                  f'{sorted(REQUIRES_WHITELIST)} 的子集（可以是空数组）',
                  file=sys.stderr)
            rc = 1
        if not isinstance(prog.get('problem'), str) or not prog.get('problem'):
            print(f'ERROR: {name} 缺非空的 problem 字段——变体分组靠它',
                  file=sys.stderr)
            rc = 1
        if not isinstance(prog.get('entry'), str) or not prog.get('entry'):
            print(f'ERROR: {name} 缺非空的 entry 字段', file=sys.stderr)
            rc = 1

        for field in ('title', 'blurb'):
            v = prog.get(field)
            if not isinstance(v, dict) or not isinstance(v.get('en'), str) \
                    or not isinstance(v.get('zh'), str) or not v.get('en') or not v.get('zh'):
                print(f'ERROR: {name} 的 {field} 必须同时有非空的 zh 与 en 字符串',
                      file=sys.stderr)
                rc = 1
        notes = prog.get('notes')
        if not isinstance(notes, dict):
            print(f'ERROR: {name} 的 notes 必须是 {{en: [...], zh: [...]}}',
                  file=sys.stderr)
            rc = 1
        else:
            for lang in ('en', 'zh'):
                arr = notes.get(lang)
                if not isinstance(arr, list) or not arr \
                        or not all(isinstance(x, str) and x.strip() for x in arr):
                    print(f'ERROR: {name} 的 notes.{lang} 必须是非空的段落数组'
                          f'（不是带 \\n 的长字符串）', file=sys.stderr)
                    rc = 1

        check = prog.get('check')
        if check is not None:
            if not isinstance(check, dict):
                print(f'ERROR: {name} 的 check 必须是对象', file=sys.stderr)
                rc = 1
            elif check.get('property') is not None and check['property'] not in PROPERTIES:
                print(f'ERROR: {name} 的 check.property={check["property"]!r} 不在'
                      f'闭集 {sorted(PROPERTIES)} 内', file=sys.stderr)
                rc = 1

    if total == 0:
        print('ERROR: 一条程序元数据都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'程序元数据：{total} 条 id 全库唯一，kind/level/boards/runtime 在闭集，'
              f'双语齐全，requires 在白名单，没有手写的派生字段')
    return rc


# ══════════════════════════════════════════════════════════════════════════
# 12. variant_check
# ══════════════════════════════════════════════════════════════════════════

def variant_check() -> int:
    """**只对成员数 > 1 的 `problem` 组**校验 `title.en` 互不相同，外加一条全库断言。

    为什么只校验多成员组：绝大多数程序是单例，一条「每个 problem ≥ 2」的规则会把
    任何一章判红。变体的价值在**并排对照**（design §2.4），而并排时两栏顶着同一个
    标题，读者根本分不出哪栏是哪种写法。

    **另加的那一条才是这道门的关键**：全库至少要存在一个多变体组。没有它，这道门
    在一个全是单例的库上永远绿——一段在结构上无法观察到它声称排除之物的断言，
    等于没有门。本仓已经为这个形状抓到过九次。
    """
    rc = 0
    groups: dict = {}
    for chapter_dir, _data, prog, _py in iter_programs():
        problem = prog.get('problem')
        if not problem:
            continue                     # 缺 problem 由 program_meta_check 报
        groups.setdefault(problem, []).append((chapter_dir, prog))

    multi = {k: v for k, v in groups.items() if len(v) > 1}
    for problem, items in sorted(multi.items()):
        titles: dict = {}
        for chapter_dir, prog in items:
            title = ((prog.get('title') or {}).get('en') or '').strip()
            if title in titles:
                print(f'ERROR: problem={problem!r} 的两个变体 '
                      f'{titles[title]} 与 {_pid(chapter_dir, prog)} '
                      f'的 title.en 相同：{title!r}——并排对照时两栏分不出谁是谁',
                      file=sys.stderr)
                rc = 1
            titles[title] = _pid(chapter_dir, prog)

    if not multi:
        print(f'ERROR: 全库 {len(groups)} 个 problem 组里一个多变体组都没有——'
              f'这道门的正文（title.en 必须互不相同）于是一次都没执行过。\n'
              f'       「同一问题的多种写法」是 design §2.4 的核心；一个全是单例的'
              f'库让这道门永远绿，等于没有门。', file=sys.stderr)
        return 1
    if rc == 0:
        detail = '、'.join(f'{k}×{len(v)}' for k, v in sorted(multi.items()))
        print(f'变体：{len(groups)} 个 problem 组，其中 {len(multi)} 个多变体'
              f'（{detail}），组内 title.en 互不相同')
    return rc
