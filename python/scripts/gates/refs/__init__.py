"""property 参考实现，按章一个文件（第 1 期设计 §4 A4）。

为什么拆：第 1 期八页由并行构建者各自写，全都往 properties.REFERENCES 一个字典里加
条目，堆叠分支变基时必然冲突。一章一个文件，构建者只碰自己那一章。

文件名规则：章目录 `programs/ch05-files-errors/` ↔ `refs/ch05_files_errors.py`
（连字符换下划线，才是合法的模块名）。每个文件导出模块级 `REFERENCES` 字典。

`load_references()` **绝不抛**：library.py 在导入期就读它，这里一抛，check.py 连
`import` 都过不去，全部门一道都不跑——那正是 check.py 文件头「一道门抛异常不许带走
别的门」要防的形状。错误收进返回值，由 algorithm_property_check 当红报出来。
错误文本只记异常类型与消息、不记 traceback：负控制执行器把输出里出现 Traceback
当作「门自己崩了」，一条被正确捕获的错误不该长得像崩溃。
"""
from __future__ import annotations

import importlib
import pathlib

REFS_DIR = pathlib.Path(__file__).resolve().parent


def chapter_dir_name(stem: str) -> str:
    """refs 文件名（不含 .py）→ 章目录名：`ch01_basics` → `ch01-basics`。"""
    return stem.replace('_', '-')


def load_references():
    """返回 (REFERENCES, SOURCES, ERRORS)。

    REFERENCES：{程序 id: {'ref': …, 'cases': …}}
    SOURCES：   {程序 id: 登记它的文件名}
    ERRORS：    [错误文本]

    三处校验，任何一处不满足都只记进 ERRORS、不让异常穿出去（理由见上）：

    · 文件名不许有连字符——`ch01-basics.py` 不是合法的 Python 模块名，而且它对
      不上 `chapter_dir_name()` 的换字规则（下划线→连字符），检查提前做、不导入它。
    · `import_module` 本身可能抛——**包括 `SystemExit`**：一个 refs 模块里写
      `raise SystemExit(...)`（本仓硬错误的惯用法）是 `BaseException` 的子类，
      裸 `except Exception` 接不住，会让 check.py 连 import 都过不去、零道门运行。
    · 每条 REFERENCES 条目必须是 dict，且 `ref` / `cases` 两个键都存在且
      callable——形状校验在「登记重复」判断之前做：一条既拼错键名、id 又与别处
      撞车的条目，应该先看见「缺 cases」，不能被撞车错误盖住。
    """
    refs: dict = {}
    sources: dict = {}
    errors: list = []
    for path in sorted(REFS_DIR.glob('ch*.py')):
        if '-' in path.stem:
            errors.append(f'gates/refs/{path.name}：refs 文件名要用下划线，不是连字符'
                          f'——连字符不是合法的模块名，也对不上章目录的换字规则，'
                          f'不导入它')
            continue
        try:
            mod = importlib.import_module(f'{__name__}.{path.stem}')
        except (Exception, SystemExit) as exc:              # noqa: BLE001
            errors.append(f'gates/refs/{path.name} 导入失败：{type(exc).__name__}: {exc}')
            continue
        table = getattr(mod, 'REFERENCES', None)
        if not isinstance(table, dict):
            errors.append(f'gates/refs/{path.name} 没有导出模块级 REFERENCES 字典')
            continue
        for pid, entry in table.items():
            if not isinstance(entry, dict):
                errors.append(f'gates/refs/{path.name} 的 {pid!r} 不是 dict：{entry!r}')
                continue
            bad = []
            for key in ('ref', 'cases'):
                if key not in entry:
                    bad.append(f'缺 {key}')
                elif not callable(entry[key]):
                    bad.append(f'{key} 不是 callable（{type(entry[key]).__name__}）')
            if bad:
                errors.append(f'gates/refs/{path.name} 的 {pid!r}：' + '，'.join(bad))
                continue
            if pid in refs:
                errors.append(f'程序 {pid!r} 的参照同时登记在 gates/refs/{sources[pid]} '
                              f'与 gates/refs/{path.name}')
                continue
            refs[pid] = entry
            sources[pid] = path.name
    return refs, sources, errors
