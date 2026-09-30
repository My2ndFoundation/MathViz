"""D 组 · 程序库。

这一组的期望值几乎全部来自**独立实现**或**磁盘上的另一份字节**：

  · `program_run_check` 让真正的 CPython 跑，比对 stdout —— 「我挑的程序对不对、
    输出符不符合预期」从作者说了算变成 CPython 说了算。
  · `algorithm_property_check` 的参照按章登记在 `gates/refs/chNN_<slug>.py`
    （由 `properties.py` 汇总），每一条都刻意选了与被测程序**不同的机制**
    （裁决 R26：不能拿 `max` 当 `return max(a,b,c)` 的参照）。
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

import ast
import copy
import io
import json
import os
import pathlib
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import tokenize
import traceback

from . import (PROGRAMS_DIR, TOOLS_DIR, iter_programs, load_chapters, load_registry,
               read_text, run_node, tool_pages)
from . import properties
from . import refs

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
                compile(src, prog.get('id', py_path.name), 'exec', dont_inherit=True)
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
                if _scipy_strict():
                    print(f'ERROR: {name} 缺库 {missing}，而 PYTHON_GATES_REQUIRE_SCIPY=1（CI）——'
                          f'scipy-stack 层在 CI 上一段都不许跳过', file=sys.stderr)
                    rc = 1
                    continue
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


def _scipy_strict() -> bool:
    """CI 设 PYTHON_GATES_REQUIRE_SCIPY=1：scipy-stack 层缺库不再「跳过」而是红。

    本地缺库跳过是 design §5.4 的约定（不必人人装 numpy）；但 CI 若也缺库，这些程序就在
    **任何地方都没跑过**，而门照样全绿——跳过只打印一行，没人看。所以 CI 必须装齐并要求一个都不跳。
    """
    return os.environ.get('PYTHON_GATES_REQUIRE_SCIPY') == '1'


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

def _ref_chapter_mismatches(prog_chapter: dict, ref_sources: dict) -> list:
    """参照所在的章文件必须对应程序所在的章目录。纯函数，负控制直接喂合成数据。

    prog_chapter：{程序 id: 章目录名}（只含带 check.property 的程序）
    ref_sources： {程序 id: refs 文件名}
    """
    out = []
    for pid, fname in sorted(ref_sources.items()):
        home = prog_chapter.get(pid)
        if home is None:
            continue                     # 程序不存在由「反方向」那条报
        want = refs.chapter_dir_name(pathlib.PurePath(fname).stem)
        if want != home:
            out.append(f'程序 {pid!r} 在 programs/{home}/，参照却登记在 gates/refs/{fname}'
                       f'（那个文件对应 programs/{want}/）')
    return out


# 逐次调用的时限（秒）。被测函数或参照若进了死循环，原先这道门会一直跑下去——第 2 期 M4 终审
# 的一个负控制（删掉 bfs-order 的 visited.add）让它跑满外层 600 秒、队列无限增长，swap 撑到约 21 GB，
# 数据卷只剩约 124 MiB，把同机的三个会话一起拖垮。门跑在自己的进程里（被测程序是 exec 进来的），
# 所以用 SIGALRM 打断当前调用，把死循环变成一条具名的红。200 组 × 两次调用，正常程序每次远低于 1 ms。
PROPERTY_CALL_TIMEOUT = 2.0


def _deep_mismatch(got, want, path: str = '返回值'):
    """逐层比「值相等且类型相同」；相同返回 None，否则返回第一个差异的位置与原因。

    原先只比顶层：`got != want or type(got) is not type(want)`。容器的 `==` 逐元素用 `==`，而
    `np.int64(3) == 3`、`3.0 == 3`、`True == 1` 都成立——于是 `[np.int64(3)]` 对 `[3]`、`[3.0]` 对 `[3]`、
    `(True,)` 对 `(1,)` 全判相同。第 4 期 m6b 起草时发现（M6 最常见的错正是入口忘了 `.tolist()`，
    列表里装着 numpy 标量）。list / tuple 按位置、dict 按键递归，set 比元素类型集合；叶子比 type 与值。
    """
    if type(got) is not type(want):
        return f'{path}：类型 {type(got).__module__}.{type(got).__qualname__} ≠ 参照的 {type(want).__module__}.{type(want).__qualname__}'
    if isinstance(want, (list, tuple)):
        if len(got) != len(want):
            return f'{path}：长度 {len(got)} ≠ 参照的 {len(want)}'
        for i, (g, w) in enumerate(zip(got, want)):
            m = _deep_mismatch(g, w, f'{path}[{i}]')
            if m is not None:
                return m
        return None
    if isinstance(want, dict):
        if set(got) != set(want):
            return f'{path}：键集合不同（多 {sorted(map(repr, set(got) - set(want)))}，缺 {sorted(map(repr, set(want) - set(got)))}）'
        wkeys = {k: k for k in want}
        for k in got:
            if type(k) is not type(wkeys[k]):
                return f'{path}：键 {k!r} 的类型 {type(k).__qualname__} ≠ 参照的 {type(wkeys[k]).__qualname__}'
            m = _deep_mismatch(got[k], want[k], f'{path}[{k!r}]')
            if m is not None:
                return m
        return None
    if isinstance(want, (set, frozenset)):
        if got != want:
            return f'{path}：集合不等'
        gt = sorted(type(x).__qualname__ for x in got)
        wt = sorted(type(x).__qualname__ for x in want)
        if gt != wt:
            return f'{path}：元素类型 {gt} ≠ 参照的 {wt}'
        return None
    if got != want:
        return f'{path}：值不等'
    return None


class _PropertyTimeout(Exception):
    pass


# 导入被测程序的时限（秒）。导入 pygame / pandas 本身约零点几秒；超过这个数只可能是模块顶层在跑东西。
IMPORT_TIMEOUT = 10.0


def _is_pygame(prog: dict) -> bool:
    """结构性豁免里的 pygame 程序（cpython 运行时、requires 含 pygame）。MicroPython 不算。"""
    return prog.get('runtime', 'cpython') == 'cpython' and 'pygame' in prog.get('requires', [])


def _is_micropython(prog: dict) -> bool:
    """runtime 是 MicroPython（micro:bit / Pico）的程序：整段跑不了（要硬件），但纯逻辑函数可以导入求值。"""
    return prog.get('runtime', 'cpython').startswith('micropython')


# MicroPython 程序导入时装进 sys.modules 的桩模块名。`from microbit import *` 对空模块什么也不导入（`import *`
# 不走模块 __getattr__），`from machine import Pin` 取到桩类；桩被**调用**就抛具名错——逻辑函数不许碰硬件。
MICROPYTHON_STUB_MODULES = ('microbit', 'machine', 'utime', 'micropython', 'neopixel', 'radio', 'music',
                            'speech', 'rp2', 'uasyncio', 'ustruct', 'ubinascii')


class HardwareStubCalled(RuntimeError):
    pass


class _HardwareStub:
    """硬件名的替身：取属性得到另一个替身（`Pin.OUT`、`Image.HEART` 在顶层常量里合法），调用即抛错。"""

    def __init__(self, path):
        self._path = path

    def __getattr__(self, attr):
        if attr.startswith('__'):
            raise AttributeError(attr)
        return _HardwareStub(f'{self._path}.{attr}')

    def __call__(self, *args, **kwargs):
        if self._path in _STUB_VALUE_CALLS:              # Image("09090:…") 这类纯值构造在顶层常量里合法
            return _HardwareStub(f'{self._path}(…)')
        raise HardwareStubCalled(f'调用了硬件 {self._path}(…)——property 的入口只许是纯逻辑函数，硬件调用放进 main()')

    def __repr__(self):
        return f'<硬件桩 {self._path}>'


# 桩模块上**真有**的名字：`from microbit import *` 只导入模块里真有的非下划线名（不走 __getattr__），
# 所以常用名要事先放上去，否则 `Image.HEART` 这种顶层常量在导入时就 NameError。
_STUB_NAMES = {
    'microbit': ('display', 'button_a', 'button_b', 'Image', 'accelerometer', 'compass', 'pin0', 'pin1', 'pin2',
                 'pin_logo', 'sleep', 'running_time', 'temperature', 'audio', 'speaker', 'microphone', 'Sound',
                 'SoundEvent', 'set_volume'),
    'machine': ('Pin', 'PWM', 'ADC', 'Timer', 'I2C', 'SPI', 'UART', 'freq', 'reset'),
    'utime': ('sleep', 'sleep_ms', 'sleep_us', 'ticks_ms', 'ticks_us', 'ticks_diff', 'ticks_add', 'time'),
    'radio': ('on', 'off', 'config', 'send', 'receive'),
    'music': ('play', 'pitch', 'stop', 'set_tempo'),
}
_STUB_VALUE_CALLS = {'microbit.Image'}


def _stub_const(value):
    """MicroPython 的 `const()` 是编译期常量标记，不是硬件；在 CPython 里就是恒等函数。"""
    return value


def _stub_getattr(mod_name):
    def __getattr__(attr):
        if attr.startswith('__'):
            raise AttributeError(attr)
        return _HardwareStub(f'{mod_name}.{attr}')
    return __getattr__


def _micropython_stubs():
    """返回 (装桩, 卸桩) 两个函数；卸桩把 sys.modules 恢复原样（门在同一进程里跑全库，桩不许漏到别的程序）。"""
    import types
    saved = {}

    def install():
        for mod_name in MICROPYTHON_STUB_MODULES:
            saved[mod_name] = sys.modules.get(mod_name)
            mod = types.ModuleType(mod_name)
            mod.__getattr__ = _stub_getattr(mod_name)            # PEP 562：`from machine import Pin` 走这里
            for attr in _STUB_NAMES.get(mod_name, ()):
                setattr(mod, attr, _HardwareStub(f'{mod_name}.{attr}'))
            if mod_name == 'micropython':
                mod.const = _stub_const
            sys.modules[mod_name] = mod

    def uninstall():
        for mod_name, old in saved.items():
            if old is None:
                sys.modules.pop(mod_name, None)
            else:
                sys.modules[mod_name] = old
        saved.clear()
    return install, uninstall


def _headless_sdl() -> None:
    """在 import pygame 之前把 SDL 设成无头：不开窗、不出声、不打印欢迎语。CI 的 step env 也设了同样三项。"""
    os.environ.setdefault('SDL_VIDEODRIVER', 'dummy')
    os.environ.setdefault('SDL_AUDIODRIVER', 'dummy')
    os.environ.setdefault('PYGAME_HIDE_SUPPORT_PROMPT', '1')


def _call_with_timeout(func, args, limit: float = None):
    """在 limit（缺省 PROPERTY_CALL_TIMEOUT）秒内调用 func(*args)；超时抛 _PropertyTimeout。

    只能在主线程用（signal 的限制）；check.py 与 CI 都是在主线程里跑门的。
    """
    def _on_alarm(_signum, _frame):
        raise _PropertyTimeout()
    previous = signal.signal(signal.SIGALRM, _on_alarm)
    signal.setitimer(signal.ITIMER_REAL, PROPERTY_CALL_TIMEOUT if limit is None else limit)
    try:
        return func(*args)
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


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
    prop_skipped = {}                    # 层 → 因缺库跳过的程序数（scipy-stack / pygame 分开数）
    cases_total = 0
    with_property = set()
    prog_chapter = {}
    pending_uninstall = None
    for chapter_dir, _data, prog, py_path in iter_programs():
        if pending_uninstall is not None:        # 上一个 MicroPython 程序的硬件桩：无论它从哪个分支 continue 出来，都在这里卸
            pending_uninstall()
            pending_uninstall = None
        check = prog.get('check') or {}
        prop = check.get('property')
        if not prop:
            continue
        with_property.add(prog.get('id'))
        prog_chapter[prog.get('id')] = chapter_dir.name
        name = _pid(chapter_dir, prog)
        if prop not in PROPERTIES:
            print(f'ERROR: {name} 的 check.property={prop!r} 不在闭集 '
                  f'{sorted(PROPERTIES)} 内', file=sys.stderr)
            rc = 1
            continue
        tier = _tier(prog)
        pygame_prog = _is_pygame(prog)
        micro_prog = _is_micropython(prog)
        if tier == 'compile-only' and not (pygame_prog or micro_prog):
            print(f'ERROR: {name} 标了 check.property 却在 compile-only 层'
                  f'——它没法被导入求值', file=sys.stderr)
            rc = 1
            continue
        if tier == 'scipy-stack' or pygame_prog:
            # 第 4 期（M6）起 scipy-stack 层也可以挂 property：numpy 写的纯函数最该有一个
            # 纯 Python 的独立参照。第 5 期（M7）起 pygame 程序也可以：它整段跑不了（主循环不终止），
            # 但主循环在 `if __name__ == "__main__":` 里（pygame_main_guard_check 守着），导入只定义函数，
            # 纯逻辑函数（碰撞、前进一步、反弹）照样可以对参照（主规格 §5.4 末段的设想）。
            # 缺库时照 program_run_check 的约定：本地跳过、CI 红。
            missing = [m for m in prog.get('requires', []) if not _importable(m)]
            if missing:
                if _scipy_strict():
                    print(f'ERROR: {name} 的 property 缺库 {missing}，而 PYTHON_GATES_REQUIRE_SCIPY=1（CI）',
                          file=sys.stderr)
                    rc = 1
                else:
                    layer = 'pygame' if pygame_prog else 'scipy-stack'
                    prop_skipped[layer] = prop_skipped.get(layer, 0) + 1
                    print(f'  跳过 {name} 的 property：缺库 {missing}（{layer} 层）')
                continue
            if pygame_prog:
                _headless_sdl()
        ref_entry = properties.REFERENCES.get(prog['id'])
        if ref_entry is None:
            print(f'ERROR: {name} 有 check.property={prop!r}，但 gates/refs/ 里没有它的参考实现'
                  f'（应写在 gates/refs/{chapter_dir.name.replace("-", "_")}.py）。\n'
                  f'       参照按**程序 id** 登记（R6），不能跟同族的别的程序共用一份。',
                  file=sys.stderr)
            rc = 1
            continue
        entry_name = prog.get('entry')
        if not entry_name:
            print(f'ERROR: {name} 有 check.property 却没有 entry 字段', file=sys.stderr)
            rc = 1
            continue

        src = read_text(py_path)
        ns: dict = {'__name__': '__pygate__'}   # 不是 __main__：别触发主程序
        # 第 6 期（M8）起 MicroPython 程序也可以挂 property：导入前装硬件桩（micropython_main_guard_check
        # 保证顶层不调用硬件），这个程序比完再卸掉。
        if micro_prog:
            stub_install, pending_uninstall = _micropython_stubs()
            stub_install()
        try:
            # dont_inherit=True：本模块有 `from __future__ import annotations`，compile 默认会把它继承给被测程序，
            # 注解全变成字符串；加上 ns 的 __name__ 不在 sys.modules，@dataclass 在导入时崩（AttributeError）。
            # 第 3 期 m5a 的 inventory-stock 因此挂不上 property，构建者发现、控制方复现。
            # 导入也限时：主循环若没放进 `if __name__ == "__main__":`，exec 会永远不返回（逐次调用的
            # 2 秒闹钟管不到导入）。pygame_main_guard_check 从结构上拦这类写法，这里是兜底。
            _call_with_timeout(exec, (compile(src, str(py_path), 'exec', dont_inherit=True), ns),   # noqa: S102
                               IMPORT_TIMEOUT)
        except _PropertyTimeout:
            print(f'ERROR: {name} 导入超过 {IMPORT_TIMEOUT:g} 秒没有返回——主循环是不是没放进 '
                  f'`if __name__ == "__main__":`？（{py_path}）', file=sys.stderr)
            rc = 1
            continue
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
            # 被测与参照**各拿一份深拷贝**。原先两者拿的是同一批对象：被测函数若就地改了
            # 实参（原地排序写坏、清空字典……），参照看到的已是改过的对象，于是「错的输出」
            # 与「对改过的输入算出的正确答案」相等，门比不出来。实测：把 invert() 改成
            # `mapping.clear(); return {}`，修之前这道门是绿的。`args` 本身不交给任何一方，
            # 留给报错时打印原始实参。
            try:
                got = _call_with_timeout(fn, copy.deepcopy(args))
            except _PropertyTimeout:
                bad = (args, f'超过 {PROPERTY_CALL_TIMEOUT:g} 秒没有返回（死循环？）', None)
                break
            except Exception as exc:                         # noqa: BLE001
                bad = (args, f'抛错 {type(exc).__name__}: {exc}', None)
                break
            try:
                want = _call_with_timeout(ref, copy.deepcopy(args))
            except _PropertyTimeout:
                print(f'ERROR: {name} 的参考实现超过 {PROPERTY_CALL_TIMEOUT:g} 秒没有返回——'
                      f'参照本身有问题（gates/refs/），实参 {args!r}', file=sys.stderr)
                rc = 1
                bad = None
                break
            where = _deep_mismatch(got, want)
            if where is not None:
                bad = (args, got, want, where)
                break
        if bad is not None:
            args, got, want, *rest = bad
            where = rest[0] if rest else None
            print(f'ERROR: {name} 的 {entry_name}() 与参考实现不符（property={prop}，'
                  f'种子 {properties.SEED}）\n'
                  f'    反例实参：{args!r}\n'
                  f'    被测返回：{got!r}\n'
                  f'    参照返回：{want!r}\n'
                  + (f'    首个差异：{where}\n' if where else '')
                  + f'    源码：{py_path}', file=sys.stderr)
            rc = 1
            continue
        checked += 1
    if pending_uninstall is not None:
        pending_uninstall()

    # 反方向：REFERENCES 里登记了、库里却没有这个程序。一条这样的参照什么都不验，
    # 但会让 `REFERENCES` 看上去比实际覆盖更宽——同一类「广告了并不具备的覆盖」。
    for stale in sorted(set(properties.REFERENCES) - with_property):
        print(f'ERROR: gates/refs/{properties.REF_SOURCES.get(stale)} 里有 {stale!r} 的参考实现，'
              f'但程序库里没有带 check.property 的同名程序——这条参照一次都不会被'
              f'执行', file=sys.stderr)
        rc = 1

    for err in properties.REF_ERRORS:
        print(f'ERROR: {err}', file=sys.stderr)
        rc = 1
    chapter_names = {d.name for d, _ in load_chapters()}
    for path in sorted(refs.REFS_DIR.glob('ch*.py')):
        want_dir = refs.chapter_dir_name(path.stem)
        if want_dir not in chapter_names:
            print(f'ERROR: gates/refs/{path.name} 对不上任何章目录（期望 programs/{want_dir}/）'
                  f'——这个文件里的参照永远找不到程序', file=sys.stderr)
            rc = 1
    for msg in _ref_chapter_mismatches(prog_chapter, properties.REF_SOURCES):
        print(f'ERROR: {msg}', file=sys.stderr)
        rc = 1

    if checked == 0 and rc == 0:
        print('ERROR: 一个带 check.property 的程序都没验到——这道门跑了个寂寞',
              file=sys.stderr)
        return 1
    if rc == 0:
        print(f'性质比对：{checked} 个程序 × {properties.SAMPLES} 组实参 = '
              f'{cases_total} 次调用，与独立参考实现全部一致（种子 {properties.SEED}）'
              + ('；因缺库跳过 ' + '、'.join(f'{layer} 层 {n} 个' for layer, n in sorted(prop_skipped.items()))
                 + '（CI 上不许）' if prop_skipped else ''))
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
    """`lineNotes.at` / `chunks.from` / `chunks.to` 的整行原文在源码里存在且唯一，
    **在 `clean()` 之后仍然存在且唯一**。

    锚用整行原文而不是行号（design §2.3）：行号会在编辑上方任何一行时静默错位，
    把注解挂到错的行上——而那是一种**看起来完全正常**的坏。所以「找不到」与
    「不唯一」都必须当场红：失败得响亮，好过挂错行。

    **行注可以锚在挖空体内**（第 1 期设计 D7）。第 0 期这里禁止它（最终评审 I1）：
    面板曾在挖空模式照样打印 `note.at` 的整行原文。那个泄题现在由两道防线挡：
    `panelLineNotes` 的模式白名单（只有读模式给行注，interact.test.js 钉着），以及
    hygiene.line_note_reader_check（全仓只有两个函数能读 lineNotes）。数据层的禁令
    在「每程序 ≥ 1 空」之后代价太高——值得讲解的行通常正是值得挖掉的行，ch01 待补空
    的 7 个程序里有 5 个就是这样。

    ① **锚要在 `clean()` 之后仍然成立**（M3）。这道门验的是**原文**，而 UI 解析的
       是 `Exercise.clean()` 之后的文本——`clean()` 剥掉两条 BLANK 指令行，所以
       clean 后的行是原文行的**子集**：「原文里存在且唯一」并**不蕴含**「clean 后
       仍存在」。一条锚在指令行上的 lineNote 会门绿、面板静默失锚（点行号没反应，
       没有任何错误）。所以两份文本各验一遍。
    """
    rc = 0
    anchors = 0
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not py_path.exists():
            continue
        name = _pid(chapter_dir, prog)
        lines = read_text(py_path).split('\n')
        # 与 core/exercise.js 的 clean() 同法：只剥两条指令行，别的一律照抄。
        cleaned = [line for line in lines if not _is_directive(line)]
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
                continue
            if len(hits) > 1:
                print(f'ERROR: {name} 的 {where} 在 {py_path} 里出现 {len(hits)} 次'
                      f'（第 {hits} 行）——锚必须唯一\n'
                      f'    锚：{text!r}', file=sys.stderr)
                rc = 1
                continue

            # clean() 之后再验一遍：指令行会整条消失，UI 就是在那份文本上解析的。
            c_hits = [n + 1 for n, line in enumerate(cleaned) if line == text]
            if len(c_hits) != 1:
                gone = '在 clean() 后消失了（锚落在 BLANK 指令行上？指令行整条会被剥掉）' \
                       if not c_hits else f'在 clean() 后出现 {len(c_hits)} 次'
                print(f'ERROR: {name} 的 {where} {gone}——UI 解析的是 '
                      f'Exercise.clean() 之后的文本，不是原文。\n'
                      f'    锚：{text!r}', file=sys.stderr)
                rc = 1
    if anchors == 0:
        print('ERROR: 一个锚都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'行锚：{anchors} 条 lineNotes/chunks 锚在源码里都存在且唯一，'
              f'clean() 之后仍然存在且唯一')
    return rc


# ══════════════════════════════════════════════════════════════════════════
# 5b. chunks_check（第 5 期 · 分段临摹）
# ══════════════════════════════════════════════════════════════════════════

# 工具页里内联 core 的七个区段（与 inline_core.py 同一组标记）。
CORE_REGION_TAGS = ('PY-LEX', 'STORE', 'EXERCISE', 'EDITOR', 'JUDGE', 'TRACE', 'INTERACT')


def _region_body(text: str, tag: str):
    m = re.search(r'/\* >>> GENERATED:' + re.escape(tag) + r'(?: [^*]*)? \*/\n(.*?)'
                  r'/\* <<< GENERATED:' + re.escape(tag) + r' \*/', text, re.DOTALL)
    return m.group(1) if m else None


def _nonempty_str(v) -> bool:
    return isinstance(v, str) and v != ''


def chunks_check() -> int:
    """声明了 `chunks` 的程序：段的形状、顺序、相接，以及**页面上的 JS 与门切得一样**。

    段的定义（第 5 期 chunks 设计 §1，裁决 C1）：**段 = clean 文本里从本段 `from` 那一行
    起、到下一段 `from` 之前为止的全部行**；第一段从偏移 0 起，最后一段到文本末尾（含结尾
    换行）。`to` 是本段最后一个非空行，只用来让作者写清「到哪为止」、让这道门核对「段与段
    之间只有空行」。于是各段首尾相接、覆盖全文，拼回去逐字节等于 clean 文本。

    逐条，任何一条不满足都红：
      1. 形状：`chunks` 是数组、**至少 2 段**；每段 `title.en` / `title.zh` 是非空字符串，
         `from` / `to` 是非空字符串（锚本身的存在与唯一归 `anchor_check`；这里锚在 clean
         文本里定位不了就报一句「见 anchor_check」并跳过这个程序的后几条）。
      2. 顺序：clean 文本里 `from_k` 行号 ≤ `to_k` 行号 < `from_{k+1}` 行号。
      3. 相接：`to_k` 与 `from_{k+1}` 之间只有空行；第一段 `from` 之前、最后一段 `to` 之后
         也只有空行——第一段 `from` 就是 clean 文本的第一个非空行（设计 §6.1：docstring /
         import 属于第 1 段，不许有「第一段之前」的代码被丢掉）。
      4. **JS 与门一致**：在 node 的**裸 `vm` context**（浏览器分支——`node -e` / stdin 会
         定义 module 与 require，走的是 node 分支）里装载**工具页内联的**七块 core 与
         `GENERATED:PROGRAMS`，对页面上的那份程序调 `Exercise.clean` 与
         `PyInteract.chunkSegments(clean, chunks)`，断言：clean 与门算的逐字相同；段数、
         每段 start / end / fromLine / toLine 与门用 Python 独立算出的一致；各段 `text`
         拼接 === clean。第 0 期 `anchor_check` ① 付过「门验的与 UI 用的不是同一个解析」的
         代价，所以这一条比的是页面自己的那个函数，不是门里的一份复刻。

    每段的行数（简报说 games 每段 20–40 行）**只是取向，不进门**——一个 45 行的 `main()`
    硬拆成两段更糟（设计 C8）。

    0 个程序声明 `chunks` 时这道门是绿的，但会**说出来**：绿只是因为无事可查，1–4 条没有被
    任何真实数据走过。
    """
    rc = 0
    declared = []          # 通过了 1–3 条、要进第 4 条的程序
    n_declared = 0
    for chapter_dir, data, prog, py_path in iter_programs():
        if 'chunks' not in prog:
            continue
        n_declared += 1
        name = _pid(chapter_dir, prog)
        chunks = prog.get('chunks')

        # ── 1. 形状 ──
        bad = []
        if not isinstance(chunks, list):
            bad.append(f'chunks 不是数组：{type(chunks).__name__}')
        elif len(chunks) < 2:
            bad.append(f'chunks 只有 {len(chunks)} 段——分段至少 2 段；不分段就别写 chunks')
        else:
            for i, ch in enumerate(chunks):
                if not isinstance(ch, dict):
                    bad.append(f'chunks[{i}] 不是对象')
                    continue
                title = ch.get('title')
                if not isinstance(title, dict):
                    bad.append(f'chunks[{i}].title 不是 {{en, zh}} 对象')
                else:
                    for lang in ('en', 'zh'):
                        if not _nonempty_str(title.get(lang)):
                            bad.append(f'chunks[{i}].title.{lang} 不是非空字符串：'
                                       f'{title.get(lang)!r}')
                for key in ('from', 'to'):
                    if not _nonempty_str(ch.get(key)):
                        bad.append(f'chunks[{i}].{key} 不是非空字符串：{ch.get(key)!r}')
        if bad:
            for b in bad:
                print(f'ERROR: {name} 的 {b}', file=sys.stderr)
            rc = 1
            continue
        if not py_path.exists():
            continue                     # 缺文件由 chapter_manifest_check 报

        # 与 core/exercise.js 的 clean() 同法（anchor_check 同一行）：只剥两条指令行。
        clean_lines = [ln for ln in read_text(py_path).split('\n') if not _is_directive(ln)]
        clean = '\n'.join(clean_lines)

        def locate(anchor):
            hits = [n for n, ln in enumerate(clean_lines) if ln == anchor]
            return hits[0] if len(hits) == 1 else None

        froms = [locate(ch['from']) for ch in chunks]
        tos = [locate(ch['to']) for ch in chunks]
        lost = [f'chunks[{i}].{key}' for i in range(len(chunks))
                for key, at in (('from', froms[i]), ('to', tos[i])) if at is None]
        if lost:
            print(f'ERROR: {name} 的 {", ".join(lost)} 在 clean() 文本里定位不到唯一的一行'
                  f'（原因见 anchor_check）——段无从切起', file=sys.stderr)
            rc = 1
            continue

        # ── 2. 顺序 ──
        order_bad = False
        for k in range(len(chunks)):
            if not froms[k] <= tos[k]:
                print(f'ERROR: {name} 的 chunks[{k}] 的 to（第 {tos[k] + 1} 行）在 from'
                      f'（第 {froms[k] + 1} 行）之前', file=sys.stderr)
                order_bad = True
            if k + 1 < len(chunks) and not tos[k] < froms[k + 1]:
                print(f'ERROR: {name} 的 chunks[{k + 1}] 的 from（第 {froms[k + 1] + 1} 行）'
                      f'不在 chunks[{k}] 的 to（第 {tos[k] + 1} 行）之后——段要按源码顺序、'
                      f'互不重叠', file=sys.stderr)
                order_bad = True
        if order_bad:
            rc = 1
            continue

        # ── 3. 相接：缝里只许有空行 ──
        gaps = [('第一段 from 之前', 0, froms[0])]
        for k in range(len(chunks) - 1):
            gaps.append((f'chunks[{k}] 的 to 与 chunks[{k + 1}] 的 from 之间',
                         tos[k] + 1, froms[k + 1]))
        gaps.append(('最后一段 to 之后', tos[-1] + 1, len(clean_lines)))
        seam_bad = False
        for where, lo, hi in gaps:
            code = [n + 1 for n in range(lo, hi) if clean_lines[n].strip() != '']
            if code:
                print(f'ERROR: {name} 的 {where}有非空行（clean() 后第 {code} 行）——段必须'
                      f'首尾相接，缝里只许有空行；这些行会落进前一段却不在它的 from…to 里，'
                      f'或者（在第一段之前）被默认归给第一段', file=sys.stderr)
                seam_bad = True
        if seam_bad:
            rc = 1
            continue

        starts = []
        pos = 0
        for ln in clean_lines:
            starts.append(pos)
            pos += len(ln) + 1
        expected = []
        for k in range(len(chunks)):
            expected.append({
                'start': 0 if k == 0 else starts[froms[k]],
                'end': len(clean) if k == len(chunks) - 1 else starts[froms[k + 1]],
                'fromLine': froms[k] + 1,
                'toLine': tos[k] + 1,
            })
        declared.append({'name': name, 'tool': data.get('tool'), 'id': prog.get('id'),
                         'clean': clean, 'expected': expected})

    if n_declared == 0:
        print('分段：0 个程序声明 chunks——这道门是绿的，但 1–4 条没有被任何真实数据走过'
              '（绿只是因为无事可查）')
        return rc
    if not declared:
        return rc or 1

    # ── 4. 页面上的 JS 与门一致（裸 vm） ──
    by_tool: dict = {}
    for d in declared:
        by_tool.setdefault(d['tool'], []).append(d)
    pages_ok = 0
    for tool, items in sorted(by_tool.items(), key=lambda kv: str(kv[0])):
        page = TOOLS_DIR / f'{tool}.html'
        if not tool or not page.is_file():
            print(f'ERROR: {items[0]["name"]} 所在章点名的工具页 {tool!r} 不存在，'
                  f'第 4 条无从核对', file=sys.stderr)
            rc = 1
            continue
        text = read_text(page)
        with tempfile.TemporaryDirectory() as td:
            files = []
            missing = []
            for tag in CORE_REGION_TAGS + ('PROGRAMS',):
                body = _region_body(text, tag)
                if body is None:
                    missing.append(tag)
                    continue
                f = os.path.join(td, tag + '.js')
                with open(f, 'w', encoding='utf-8') as fh:
                    fh.write(body)
                files.append(f)
            if missing:
                print(f'ERROR: {page.name} 缺 GENERATED 区段 {missing}，第 4 条无从核对',
                      file=sys.stderr)
                rc = 1
                continue
            script = r'''
const vm = require('vm'), fs = require('fs');
const files = %s;
const ids = %s;
const sandbox = {};
sandbox.self = sandbox;
vm.createContext(sandbox);
if (typeof sandbox.module !== 'undefined' || typeof sandbox.require !== 'undefined') {
  console.error('FAIL 沙箱不干净：module/require 泄漏进来了，测的还是 node 分支');
  process.exit(1);
}
for (const f of files) { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }); }
if (typeof sandbox.module !== 'undefined' || typeof sandbox.require !== 'undefined') {
  console.error('FAIL 装载之后沙箱里出现了 module/require'); process.exit(1);
}
const PI = sandbox.PyInteract, E = sandbox.Exercise, P = sandbox.PyPrograms;
if (!PI || typeof PI.chunkSegments !== 'function') {
  console.error('FAIL 页面内联的 PyInteract 没有 chunkSegments'); process.exit(1);
}
if (!E || typeof E.clean !== 'function' || !P || !Array.isArray(P.programs)) {
  console.error('FAIL 页面内联的 Exercise.clean / PyPrograms.programs 不可用'); process.exit(1);
}
const out = {};
for (const id of ids) {
  const prog = P.programs.filter(function (x) { return x.id === id; })[0];
  if (!prog) { out[id] = { error: '页面的 PyPrograms 里没有这个程序' }; continue; }
  try {
    const clean = E.clean(prog.source);
    const segs = PI.chunkSegments(clean, prog.chunks);
    out[id] = { clean: clean, segs: segs === null ? null : segs.map(function (g) {
      return { start: g.start, end: g.end, fromLine: g.fromLine, toLine: g.toLine, text: g.text };
    }) };
  } catch (e) { out[id] = { error: '抛错：' + String(e && e.message) }; }
}
process.stdout.write(JSON.stringify(out));
''' % (json.dumps(files), json.dumps([d['id'] for d in items]))
            proc = run_node(script)
        if proc.returncode != 0:
            print(f'ERROR: {page.name} 的内联 core 在裸 vm 里装载 / 调用失败：\n'
                  f'{_indent((proc.stderr or proc.stdout).strip())}', file=sys.stderr)
            rc = 1
            continue
        got = json.loads(proc.stdout)
        page_bad = False
        for d in items:
            g = got.get(d['id']) or {'error': '没有输出'}
            name = d['name']
            if 'error' in g:
                print(f'ERROR: {name}：{g["error"]}', file=sys.stderr)
                page_bad = True
                continue
            if g['clean'] != d['clean']:
                print(f'ERROR: {name} 页面 Exercise.clean 的结果与门剥指令行的结果不同'
                      f'——两边切的不是同一份文本', file=sys.stderr)
                page_bad = True
                continue
            segs = g['segs']
            if segs is None:
                print(f'ERROR: {name} 页面的 PyInteract.chunkSegments 返回 null——页面会退回'
                      f'不分段，而门认为这份 chunks 是合法的', file=sys.stderr)
                page_bad = True
                continue
            mine = [{k: s[k] for k in ('start', 'end', 'fromLine', 'toLine')} for s in segs]
            if mine != d['expected']:
                print(f'ERROR: {name} 页面切出的段与门算的不一致\n'
                      f'    页面：{mine}\n    门：  {d["expected"]}', file=sys.stderr)
                page_bad = True
                continue
            joined = ''.join(s['text'] for s in segs)
            if joined != d['clean']:
                print(f'ERROR: {name} 页面各段 text 拼起来不等于 clean() 文本'
                      f'（{len(joined)} vs {len(d["clean"])} 个字符）——段间的行丢了或重了',
                      file=sys.stderr)
                page_bad = True
                continue
            spans = ' · '.join(f'{e["fromLine"]}–{e["toLine"]}' for e in d['expected'])
            print(f'分段：{name}  {len(d["expected"])} 段（from–to 行：{spans}）')
        if page_bad:
            rc = 1
        else:
            pages_ok += 1

    if rc == 0:
        n_segs = sum(len(d['expected']) for d in declared)
        print(f'分段：{len(declared)} 个程序声明了 chunks（共 {n_segs} 段），形状 / 顺序 / 相接都对；'
              f'在 {pages_ok} 个工具页的裸 vm 里，页面自己的 PyInteract.chunkSegments 与门逐段一致，'
              f'各段拼回去等于 clean()')
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

# core/interact.js 的 HINT_MARK（第 1 期设计 B1）。两边各存一份，
# 由 syntax.closed_set_mirror_check 比对（Task 10）。
HINT_MARK = ' || '


def _hint_parts(raw: str) -> int:
    """一条提示按 `hintAt()` 的规则切出几段：按 HINT_MARK 切。

    `hintAt` 拿到的是**未转义**的正则捕获组，所以这里也不做反转义——两边看的必须是
    同一串字符。没有标记 = 一段。
    """
    return len(raw.split(HINT_MARK))


_WELL_FORMED_MARK_RE = re.compile(r'(?<!\s) \|\| (?!\s)')


def _stray_marks(raw: str) -> int:
    """出现了 `||` 却不是「两侧各恰好一个空格，且那个空格不再挨着别的空白」的形状的
    次数——十有八九是写错的分级标记。

    「恰好一个空格」不能只靠字面找 `' || '`：`'a  ||  b'`（两侧各两个空格）里
    仍然嵌着一段逐字符相等的 `' || '` 子串（挨着标记的那个空格 + 标记 + 挨着的
    下一个空格），`raw.count(HINT_MARK)` 会数到它，于是段数照样对得上、门却看不出
    多出来的空白——那段空白会原样留在切出来的那一级里。`_WELL_FORMED_MARK_RE`
    额外要求标记前后各只有那一个空格（左右各挡一次相邻空白），把这种情况从
    「合规」里踢出来。

    标记落在整条提示的最前或最后（`' || b'` / `'a || '`）也算写错：那样切出来的
    一段是空串——正则的环视在字符串边界上会**通过**（那里没有相邻字符，谈不上
    是不是空白），所以额外按匹配位置排除开头/结尾的命中。
    """
    total = raw.count('||')
    well = 0
    for m in _WELL_FORMED_MARK_RE.finditer(raw):
        if m.start() == 0 or m.end() == len(raw):
            continue
        well += 1
    return total - well


_HINT_EN_RE = re.compile(r'\bhintEn="((?:[^"\\]|\\.)*)"')
_HINT_RE = re.compile(r'\bhint="((?:[^"\\]|\\.)*)"')
_ID_RE = re.compile(r'\bid=(\S+)')
_LEVEL_RE = re.compile(r'\blevel=(\S+)')


def _split_attrs(attrs: str):
    """按 `exercise.js` 的顺序摘属性：先摘 `hintEn`、再摘 `hint`，返回
    (hintEn 匹配或 None, hint 匹配或 None, 摘干净引号文本后的裸文本)。

    `_check_attrs` 与 `blank_ids` 共用这一份——「Python 侧怎么解析指令行」只写一次，
    `syntax.js_parser_parity_check` 拿它的结论去对页面里 `Exercise.parse` 的结论。
    """
    hint_en_m = _HINT_EN_RE.search(attrs)
    rest = attrs if not hint_en_m else attrs[:hint_en_m.start()] + attrs[hint_en_m.end():]
    hint_m = _HINT_RE.search(rest)
    bare = rest if not hint_m else rest[:hint_m.start()] + rest[hint_m.end():]
    return hint_en_m, hint_m, bare


def blank_ids(src: str) -> list:
    """按本模块解析指令行的规则，列出一段源码里每个 BLANK 的 id（出现顺序；
    缺 id 的记成 None）。只看开始行，不查配对——配对与属性是否齐全由
    `blank_directive_check` 报。"""
    ids = []
    for line in src.split('\n'):
        om = BLANK_OPEN_RE.match(line)
        if om:
            id_m = _ID_RE.search(_split_attrs(om.group(1))[2])
            ids.append(id_m.group(1) if id_m else None)
    return ids


def blank_presence_check() -> int:
    """每个程序至少一个 BLANK（第 1 期设计 D2），无豁免。

    第 0 期 ch01 十个程序里七个一个空都没有。挖空模式对它们照常逐行渲染：没有输入框、
    没有说明，使用者面对的是一页无事可做的代码——不报错，也没有任何东西会发现。
    挖空是三种模式里唯一带判定的一种，所以「零个空」不是合法的内容形状。
    """
    rc = 0
    scanned = 0
    total = 0
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not py_path.exists():
            continue                     # 缺文件由 chapter_manifest_check 报
        scanned += 1
        n = sum(1 for line in read_text(py_path).split('\n') if BLANK_OPEN_RE.match(line))
        total += n
        if n == 0:
            print(f'ERROR: {_pid(chapter_dir, prog)} 一个挖空都没有：{py_path}\n'
                  f'       挖空模式下这个程序整页无事可做，而且不会有任何提示。至少挖一行'
                  f'（规则见 .claude/skills/python-drill-tool/SKILL.md）。', file=sys.stderr)
            rc = 1
    if scanned == 0:
        print('ERROR: 一个程序都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'挖空下限：{scanned} 个程序每个都至少有一个空（共 {total} 个）')
    return rc


def blank_directive_check() -> int:
    """BLANK 指令成对；四属性齐全；id 页内唯一；`level ∈ 1..3`；挖空体非空；
    **`hint` 与 `hintEn` 切出来的段数都恰好等于 `level`**。

    最后那条是最终评审补的（I6）。原来这道门只查两条提示**非空**——「分级」这件
    事在整条门链上一次都没有被观察过，而 ch01 三个空全是 `level=2`：hint 里有
    ` || ` 标记、切出两段，**hintEn 里一个标记都没有、是一整条**。`hintAt()` 里
    `cap = min(level, parts)` 于是钳到 1，按钮上却印着「Hint (L2)」——点第二下
    什么都不变。而这个子项目**默认英文**（导航契约 C7），坏的正是她看到的那一侧。
    第 1 期起 34 页都从 ch01 抄，一条没有门的规矩会被抄 34 次。

    两个方向都要卡死，`hintAt` 的两条钳位各对应一个方向：
      · 段数 < level：`cap = min(level, parts)` 钳到段数，后面几级点了没反应；
      · 段数 > level：`n = min(tier, cap)` 钳到 level，超出的那几段**永远读不到**。
    所以判据是**相等**，不是「至少」。

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
              f'id 页内唯一、level ∈ 1–3、挖空体非空，'
              f'hint 与 hintEn 切出的段数都 == level（中英两侧都真的分级）')
    return rc


def _check_attrs(name, py_path, line_no, attrs, seen_ids) -> int:
    rc = 0
    hint_en_m, hint_m, bare = _split_attrs(attrs)
    if not hint_en_m:
        print(f'ERROR: {name}:{line_no} 的 BLANK 指令缺 hintEn="..."：'
              f'{py_path}:{line_no}', file=sys.stderr)
        rc = 1
    elif not hint_en_m.group(1).strip():
        print(f'ERROR: {name}:{line_no} 的 hintEn 是空串：{py_path}:{line_no}',
              file=sys.stderr)
        rc = 1

    if not hint_m:
        print(f'ERROR: {name}:{line_no} 的 BLANK 指令缺 hint="..."：'
              f'{py_path}:{line_no}', file=sys.stderr)
        rc = 1
    elif not hint_m.group(1).strip():
        print(f'ERROR: {name}:{line_no} 的 hint 是空串：{py_path}:{line_no}',
              file=sys.stderr)
        rc = 1

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
    else:
        # ── 分级：两条提示切出来的段数都必须**恰好等于** level ──────────────
        level = int(level_m.group(1))
        for field, m in (('hint', hint_m), ('hintEn', hint_en_m)):
            if not m:
                continue                      # 缺字段已经红过一次，不再叠一条
            stray = _stray_marks(m.group(1))
            if stray:
                print(f'ERROR: {name}:{line_no} 的 {field} 里有 {stray} 处疑似写错的分级标记——'
                      f'分级标记必须写成两侧各一个空格的 {HINT_MARK!r}：{py_path}:{line_no}\n'
                      f'       {field}={m.group(1)!r}', file=sys.stderr)
                rc = 1
                continue
            parts = _hint_parts(m.group(1))
            if parts == level:
                continue
            why = (f'点到第 {parts + 1} 级什么都不会变'
                   if parts < level else
                   f'第 {level + 1} 段起永远读不到')
            print(f'ERROR: {name}:{line_no} 的 {field} 切出 {parts} 段，但 '
                  f'level={level}——按钮上印着「(L{level})」，而 {why}：'
                  f'{py_path}:{line_no}\n'
                  f'       分级标记是 {HINT_MARK!r}（与 core/interact.js 的 HINT_MARK 同值）\n'
                  f'       {field}={m.group(1)!r}', file=sys.stderr)
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
        # boards 的语义（用户裁决，2026-09-30）：一个考试局只在这个程序的核心教学点被它的
        # 考纲点名时才写；不在任何一家考纲里就写空列表——空列表合法，学生按考纲筛时它不出现。
        # 仍然要求：是列表、元素都在闭集、不重复（重复的考试局在面板上会显示两遍）。
        # 判定依据：docs/superpowers/specs/2026-09-30-python-boards-syllabus-map.md
        boards = prog.get('boards')
        if not isinstance(boards, list):
            print(f'ERROR: {name} 的 boards={boards!r} 必须是列表（考纲外的程序写 []）',
                  file=sys.stderr)
            rc = 1
        elif not all(isinstance(b, str) for b in boards) or not set(boards) <= BOARDS:
            print(f'ERROR: {name} 的 boards={boards!r} 里有闭集 {sorted(BOARDS)} 之外的值',
                  file=sys.stderr)
            rc = 1
        elif len(set(boards)) != len(boards):
            print(f'ERROR: {name} 的 boards={boards!r} 有重复的考试局', file=sys.stderr)
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
        print(f'程序元数据：{total} 条 id 全库唯一，kind/level/boards/runtime 在闭集'
              f'（boards 可为空、不重复），'
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


# ══════════════════════════════════════════════════════════════════════════
# fixture_notes_check
# ══════════════════════════════════════════════════════════════════════════

FIXTURE_REF_RE = re.compile(r'_fixtures/([A-Za-z0-9_.\-]+(?:/[A-Za-z0-9_.\-]+)*)')


# pygame 程序顶层允许的调用：纯值类型的构造，没有副作用
_PYGAME_VALUE_CALLS = {'pygame.Color', 'pygame.Rect', 'pygame.Vector2', 'pygame.math.Vector2'}


def _dotted(node) -> str:
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
        return '.'.join(reversed(parts))
    return ''


def _is_main_guard(node) -> bool:
    if not isinstance(node, ast.If) or node.orelse:
        return False
    t = node.test
    return (isinstance(t, ast.Compare) and len(t.ops) == 1 and isinstance(t.ops[0], ast.Eq)
            and isinstance(t.left, ast.Name) and t.left.id == '__name__'
            and len(t.comparators) == 1 and isinstance(t.comparators[0], ast.Constant)
            and t.comparators[0].value == '__main__')


# MicroPython 程序顶层允许的调用：`const(...)`（MicroPython 的编译期常量）与点阵图像构造
_MICROPYTHON_VALUE_CALLS = {'const', 'micropython.const', 'Image', 'microbit.Image'}


def _pygame_top_level_problems(src: str, allowed: set = None, advice: str = '窗口、时钟、init 放进 main()') -> list:
    """纯函数，负控制直接喂源码。返回 [(行号, 说明)]；空列表 = 合规。allowed 缺省是 pygame 的纯值构造。"""
    allowed = _PYGAME_VALUE_CALLS if allowed is None else allowed
    tree = ast.parse(src)
    out = []
    guards = 0
    for i, node in enumerate(tree.body):
        if isinstance(node, (ast.Import, ast.ImportFrom, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue
        if i == 0 and isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) \
                and isinstance(node.value.value, str):
            continue                                  # 模块 docstring
        if _is_main_guard(node):
            guards += 1
            continue
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            value = node.value
            bad = [c for c in ast.walk(value) if isinstance(c, ast.Call)
                   and _dotted(c.func) not in allowed] if value is not None else []
            if bad:
                out.append((node.lineno, f'顶层赋值里调用了 {_dotted(bad[0].func) or "表达式"}(…)——'
                                         f'只许常量与 {sorted(allowed)}；{advice}'))
            continue
        out.append((node.lineno, f'顶层有 {type(node).__name__} 语句——导入时就会执行；'
                                 f'放进函数或 `if __name__ == "__main__":`'))
    if guards != 1:
        out.append((len(src.splitlines()), f'`if __name__ == "__main__":` 有 {guards} 个，应恰好 1 个'))
    return out


def pygame_main_guard_check() -> int:
    """pygame 程序导入时只定义、不执行：顶层只许 import / def / class / 常量赋值 / 恰好一个 main 守卫。

    为什么：pygame 程序整段跑不了（要显示器，主循环不终止），门对它的全部约束是 compile 加上纯逻辑函数的
    property——而 property 要先**导入**它。顶层若有 `pygame.init()`、`set_mode(...)` 或 `while True:`，
    导入就开窗或永不返回（IMPORT_TIMEOUT 是兜底，这道门是结构上的拦截）。这也是更好的教学结构（主规格 §5.4 末段）。
    """
    rc = 0
    count = 0
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not _is_pygame(prog) or not py_path.exists():
            continue
        count += 1
        name = _pid(chapter_dir, prog)
        try:
            problems = _pygame_top_level_problems(read_text(py_path))
        except SyntaxError:
            continue                                  # program_run_check 的 compile 会具名报它
        for line, msg in problems:
            print(f'ERROR: {name}（{py_path}:{line}）{msg}', file=sys.stderr)
            rc = 1
    if rc == 0:
        if count:
            print(f'pygame 顶层：{count} 个 pygame 程序导入时只定义、不执行，各有恰好一个 main 守卫')
        else:
            print('pygame 顶层：今天 0 个 pygame 程序——这道门只在负控制里被执行过')
    return rc


def micropython_main_guard_check() -> int:
    """MicroPython 程序（micro:bit / Pico）导入时只定义、不执行——与 pygame_main_guard_check 同一套结构规则，
    顶层调用只许 `const(...)` 与 `Image(...)`。

    为什么：M8 的程序整段跑不了（要硬件），门对它的约束是 compile 加纯逻辑函数（去抖、环形缓冲、滤波、状态机）的
    property；property 要先在装了硬件桩的环境里**导入**它。顶层的 `Pin(25, Pin.OUT)`、`display.show(...)`、
    `while True:` 会在导入时撞上桩或永不返回——这道门从结构上拦（第 6 期开工前）。
    `if __name__ == "__main__":` 在 MicroPython 里同样成立（板上的 main.py 就是 `__main__`）。
    """
    rc = 0
    count = 0
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not _is_micropython(prog) or not py_path.exists():
            continue
        count += 1
        name = _pid(chapter_dir, prog)
        try:
            problems = _pygame_top_level_problems(read_text(py_path), _MICROPYTHON_VALUE_CALLS,
                                                  '引脚、显示、无线电、主循环放进 main()')
        except SyntaxError:
            continue
        for line, msg in problems:
            print(f'ERROR: {name}（{py_path}:{line}）{msg}', file=sys.stderr)
            rc = 1
    if rc == 0:
        if count:
            print(f'MicroPython 顶层：{count} 个程序导入时只定义、不执行，各有恰好一个 main 守卫')
        else:
            print('MicroPython 顶层：今天 0 个 MicroPython 程序——这道门只在负控制里被执行过')
    return rc


def _fixture_run(paras: list, lines: list) -> bool:
    """`lines` 是否作为**连续的若干段、按原顺序、逐段与该行相等**出现在 `paras` 里。"""
    n = len(lines)
    if n == 0:
        return True
    for i in range(len(paras) - n + 1):
        if [str(p).strip() for p in paras[i:i + n]] == lines:
            return True
    return False


def fixture_notes_check() -> int:
    """读 `_fixtures/<名>` 的程序，讲解（中英两边）必须把那份文件**逐行**抄出来。

    复制按钮只复制 `.py`（第 1 期账本 §一.2）：她把程序粘进 PyCharm 时没有数据文件，
    唯一的来源是讲解末段手抄的那份内容。手抄与 `_fixtures/` 里的真文件之间原本没有门，
    改 fixture 的人不会想到去改讲解——跑出来的结果与页面讲的就对不上了，而且没有任何东西报红。

    判据（每个被引用的文件、中英各一遍）：
      1. 讲解某一段里出现文件名 `<名>`（她得知道文件叫什么、放在哪）；
      2. 文件的每一行（去掉行尾换行、再去首尾空白）**各自成为一段**，这些段在 `notes`
         里**连续且按原顺序**出现。

    为什么要「各自成段」而不只是「某段里包含这行文字」：讲解段落渲染成 `<p>`，没有
    `white-space: pre`，段内的换行会塌成空格。第 1 期 ch05 写的是
    「name,maths,physics,cs / Ada,91,78,95 / …（每个 / 处换行）」——子串判据对它是绿的，
    可她拿到的是一行要自己拆的文字。只有一段一行，页面上才真是一行一行。

    引用的识别：源码（含 BLANK 指令行）里所有 `_fixtures/<名>`。源码提到 `_fixtures`
    却一处 `_fixtures/<名>` 都没有（例如 `Path("_fixtures") / "x.csv"` 拼路径），门就看不见
    它读哪个文件——这种写法本身报红，要求把路径写全。
    """
    rc = 0
    scanned = 0
    checked = []
    for chapter_dir, _data, prog, py_path in iter_programs():
        if not py_path.exists():
            continue                     # 缺文件由 chapter_manifest_check 报
        scanned += 1
        src = read_text(py_path)
        if '_fixtures' not in src:
            continue
        pid = _pid(chapter_dir, prog)
        names = sorted(set(FIXTURE_REF_RE.findall(src)))
        if not names:
            print(f'ERROR: {pid} 的源码提到 _fixtures，却没有一处写成 `_fixtures/<文件名>`：'
                  f'{py_path}\n'
                  f'       这道门靠这个写法认出程序读哪份数据文件、再核对讲解有没有逐行抄出它。'
                  f'把路径写全（例如 "_fixtures/scores.csv"）。', file=sys.stderr)
            rc = 1
            continue
        for name in names:
            fx = chapter_dir / '_fixtures' / name
            if not fx.is_file():
                print(f'ERROR: {pid} 读 _fixtures/{name}，但 {fx} 不存在', file=sys.stderr)
                rc = 1
                continue
            lines = [ln.strip() for ln in fx.read_text(encoding='utf-8').splitlines()]
            base = name.rsplit('/', 1)[-1]
            for lang in ('zh', 'en'):
                paras = list(((prog.get('notes') or {}).get(lang)) or [])
                if not any(base in str(p) for p in paras):
                    print(f'ERROR: {pid} 的 notes.{lang} 没有提到文件名 {base!r}——'
                          f'她粘进 PyCharm 时不知道要建哪个文件（_fixtures/{name}）',
                          file=sys.stderr)
                    rc = 1
                if not _fixture_run(paras, lines):
                    missing = [ln for ln in lines if ln not in [str(p).strip() for p in paras]]
                    why = (f'缺这几行：{missing!r}' if missing else
                           '每一行都各有一段，但不是按原顺序连在一起')
                    print(f'ERROR: {pid} 的 notes.{lang} 没有把 _fixtures/{name} 逐行抄出来'
                          f'（每行单独一段、连续、按文件里的顺序；共 {len(lines)} 行）。{why}\n'
                          f'       复制按钮不带数据文件，讲解里的这份手抄是她唯一的来源。',
                          file=sys.stderr)
                    rc = 1
            checked.append(f'{pid}→{name}')
    if scanned == 0:
        print('ERROR: 一个程序都没扫到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if not checked and rc == 0:
        print('ERROR: 全库没有一个程序读 _fixtures/——这道门的正文一次都没执行过',
              file=sys.stderr)
        return 1
    if rc == 0:
        print(f'fixture 手抄：{len(checked)} 处引用（{"、".join(checked)}），'
              f'讲解中英两边都逐行、按序抄出了文件内容并写出文件名')
    return rc
