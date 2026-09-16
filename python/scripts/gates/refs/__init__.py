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
    """
    refs: dict = {}
    sources: dict = {}
    errors: list = []
    for path in sorted(REFS_DIR.glob('ch*.py')):
        try:
            mod = importlib.import_module(f'{__name__}.{path.stem}')
        except Exception as exc:                          # noqa: BLE001
            errors.append(f'gates/refs/{path.name} 导入失败：{type(exc).__name__}: {exc}')
            continue
        table = getattr(mod, 'REFERENCES', None)
        if not isinstance(table, dict):
            errors.append(f'gates/refs/{path.name} 没有导出模块级 REFERENCES 字典')
            continue
        for pid, entry in table.items():
            if pid in refs:
                errors.append(f'程序 {pid!r} 的参照同时登记在 gates/refs/{sources[pid]} '
                              f'与 gates/refs/{path.name}')
                continue
            refs[pid] = entry
            sources[pid] = path.name
    return refs, sources, errors
