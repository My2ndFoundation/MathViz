"""python 子项目校验门的公共底座。

这个包被拆成五个模块（registry / hygiene / syntax / library / lexer）而不是
一个 1800 行的 check.py，理由写在提交信息里：本期由多个并行实现者同时写，
同一个文件会成为串行瓶颈。`check.py` 只保留运行器。

这里放的是五个模块都要用的东西：路径常量、注册表读取、页面枚举、以及
`run_node()`。**`run_node()` 逐字照抄 `cryptography/scripts/check.py:72-90`**，
包括那条 MAX_ARG_STRLEN 断言——本仓为这个 Linux 单参数上限 CI 假绿过四次合并。

编码纪律（裁决 R21）：R16 允许 BLANK 指令行里写中文提示之后，`.py` 不再保证
ASCII 可解码。本包里每一个读文件的地方都显式 `encoding='utf-8'`。
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess

# .../python —— 注意是 gates/ 的祖父目录（gates -> scripts -> python）
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
REGISTRY = ROOT / 'python-tools.json'
TOOLS_DIR = ROOT / 'tools'
CORE_DIR = ROOT / 'core'
PROGRAMS_DIR = ROOT / 'programs'

SCRIPT_RE = re.compile(r'<script>(.*?)</script>', re.DOTALL)
META_VERSION_RE = re.compile(r'<meta\s+name="tool-version"\s+content="([^"]+)"')
META_DESC_RE = re.compile(r'<meta\s+name="description"\s+content="([^"]*)"')
# node --check -（从 stdin 读）报错时行号前缀是 [stdin]:<n>；把 <n> 换算回该脚本块
# 在原文件里的真实行号，见 syntax.node_check() 里的用法。
STDIN_LINE_RE = re.compile(r'^\[stdin\]:(\d+)$', re.MULTILINE)

# 八个知识模块是固定闭集（design §6.1），五个 accent 也是（两页的 ACCENTS 白名单）。
MODULES = set(range(1, 9))
ACCENTS = {'cyan', 'rose', 'violet', 'emerald', 'orange'}
BILINGUAL_FIELDS = ('kicker', 'title', 'desc', 'tag')
ENGINE_PREFIX = 'py-'

ROOT_PAGES = ('app.html', 'index.html')

# Linux 的 execve 对**单个 argv 元素**有 MAX_ARG_STRLEN = 32 页 = 131072 字节的
# 上限（跟 ARG_MAX 那个总量上限是两回事），超了直接 E2BIG。**macOS 没有这个
# 单参数上限。** 根 CLAUDE.md 记录了本仓因此连续四次合并 CI 假绿的事故：
# 一个 225 KB 的内联块当 `node -e` 参数传出去，所有人本地全绿、CI 一直红而
# 没人看。所以脚本一律走 stdin；真需要 stdin 送数据时，在这里当场断言脚本
# 够小——把一个只在 Linux 上出现的失败，变成开发机上就会响的失败。
MAX_ARG_STRLEN = 128 * 1024


def run_node(script: str, stdin_data: str = None):
    """跑一段 node 脚本，返回 CompletedProcess。

    stdin_data 为 None 时**脚本走 stdin**（node 无脚本文件参数时会执行 stdin），
    彻底避开 MAX_ARG_STRLEN。需要用 stdin 送数据时，脚本只能走 `-e`，此处断言
    它小于上限——今天本文件没有这样的调用点，这条分支是给下一个人留的护栏：
    真要往 stdin 送数据时，别让「只在 Linux 上炸」的那种失败悄悄溜进 CI。
    """
    if stdin_data is None:
        return subprocess.run(['node'], input=script, capture_output=True, text=True)
    size = len(script.encode('utf-8'))
    if size >= MAX_ARG_STRLEN:
        raise AssertionError(
            f'要走 argv 的 node 脚本有 {size:,} 字节，超过 Linux 的单参数上限 '
            f'{MAX_ARG_STRLEN:,}——在 macOS 上跑得动、到 CI 上就是 '
            f'"Argument list too long"。把大的那一头挪到 stdin 或磁盘。')
    return subprocess.run(['node', '-e', script], input=stdin_data,
                          capture_output=True, text=True)


def load_registry() -> dict:
    return json.loads(REGISTRY.read_text(encoding='utf-8'))


def tool_pages() -> list:
    """**注册表意义上**的工具页：排除下划线开头的模板与预览页。

    只给「注册表 / 版本 / 双向存在」那几道门用——`_skeleton.html` 不是发布的
    工具，没有注册表条目，也不该有版本号被比对。
    """
    return sorted(p for p in TOOLS_DIR.glob('*.html') if not p.name.startswith('_'))


def all_tool_pages() -> list:
    """tools/ 下的**全部**页面，含 `_` 开头的模板。

    语法门要用这个，不是 tool_pages()。骨架同样内嵌八个 GENERATED 区间、同样会
    因为一次手滑而语法错，而它是以后每个新工具的复制源——它坏了，坏的是所有后代。
    """
    return sorted(TOOLS_DIR.glob('*.html'))


def root_pages() -> list:
    """python/ 根目录下的两个导航页。

    单列它们是因为 chess 栽过：它的 node_check() 只 glob('tools/*.html')，
    而 CI 的语法门只扫主站文件，合起来的结果是 chess/index.html 从来没有被任何
    语法门覆盖过——一个纯 JS 驱动的导航页，语法错了就是整页白屏，所有门报绿。
    """
    return [ROOT / name for name in ROOT_PAGES]


def core_modules() -> list:
    """core/ 下的编辑源（不含 `*.test.js` 与 `_test.js` harness）。"""
    return sorted(p for p in CORE_DIR.glob('*.js')
                  if not p.name.endswith('.test.js') and p.name != '_test.js')


def chapter_dirs() -> list:
    return sorted(p.parent for p in PROGRAMS_DIR.glob('ch*/chapter.json'))


def load_chapters() -> list:
    """[(章目录, chapter 数据), ...]，按目录名排序。"""
    out = []
    for d in chapter_dirs():
        out.append((d, json.loads((d / 'chapter.json').read_text(encoding='utf-8'))))
    return out


def iter_programs():
    """逐个产出 (章目录, chapter 数据, program 条目, .py 路径)。

    所有读 `.py` 的门都从这里取文件，保证「哪些 .py 算数」只有一个定义。
    """
    for chapter_dir, data in load_chapters():
        for prog in data.get('programs') or []:
            yield chapter_dir, data, prog, chapter_dir / prog.get('file', '')


def read_text(path: pathlib.Path) -> str:
    """显式 utf-8 读取。裁决 R21：`.py` 不再保证 ASCII 可解码。"""
    return path.read_text(encoding='utf-8')
