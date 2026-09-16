#!/usr/bin/env python3
"""python 子项目的校验门运行器（spec §5）。

**全部返回码无条件跑到底**，最后按「任一非零则整体失败」汇总。
生成脚本的 `--check` 各算一道门，`gates/` 下每个函数各算一道门。

门数**不写在这里**：它是一个可数的事实，写进散文就会漂——`chess/check.py`
的同类数字漂出过三个答案。运行结束时 `main()` 按组打印自己数出来的数目。

| 组 | 模块 | 守什么 |
|----|------|--------|
| 生成   | `inline_core` / `build_programs` / `sync_fallback` | 生成物与编辑源一致 |
| A      | `gates/registry.py` | 注册表 / FALLBACK / 版本 / 计数 / 标签 / 配色 / 页面镜像 |
| B      | `gates/hygiene.py`  | 出站引用 / script 字面量 / 控制字节 / 惰性依赖 / 骨架 |
| C      | `gates/syntax.py`   | node --check / core 测试 / 浏览器分支 |
| D·库   | `gates/library.py`  | 程序库 |
| D·词法 | `gates/lexer.py`    | 词法器 |

── 两条铁律 ─────────────────────────────────────────────────────────

1. **绝不能用 `or` 短路。** `a() or b() or c()` 一旦 a() 非零就跳过后面的，
   意味着一份过期的内联副本会让最有分量的几道门根本不执行，问题只报出第一个。
   cryptography/scripts/check.py 的 `__main__` 里有这条教训的注释。

2. **一道门抛异常不许带走别的门。** `build_programs.py` 的每条硬错误路径都是
   `raise SystemExit(...)`；直接写进 `rc` 列表的话，一个拼错的 `file` 字段会让
   它后面的门一道都不跑——效果与 `or` 短路完全相同，只是伪装成了异常。
   所以每一项都过 `_guard()`：异常被就地翻成「这道门红了」，别的门照跑。
   `_guard()` 打印异常本身（含 traceback 摘要），不吞。

`run_node()` 在 `gates/__init__.py` 里，逐字照抄 cryptography 的同名函数，
包括那条 MAX_ARG_STRLEN 断言（本仓为这个 Linux 单参数上限 CI 假绿过四次合并）。

用法：
    python3 python/scripts/check.py       # 全绿退出 0，任一门红退出 1
"""
from __future__ import annotations

import pathlib
import sys
import traceback

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import build_programs                                     # noqa: E402
import inline_core                                        # noqa: E402
from gates import hygiene, lexer, library, registry, syntax  # noqa: E402


def _guard(name, fn, *args, **kwargs) -> int:
    """跑一道门，把任何异常翻成「红」而不是让整个运行器当场退出。

    见文件头第 2 条。SystemExit 单独接住：build_programs 用它报硬错误，
    未接住的话 sys.exit 会在列表求值到一半时把进程带走。
    """
    try:
        rc = fn(*args, **kwargs)
    except SystemExit as exc:
        code = exc.code
        if isinstance(code, str):
            print(code, file=sys.stderr)
            code = 1
        if code:
            print(f'ERROR: {name} 以 SystemExit({code!r}) 中止——当作红处理，'
                  f'其余的门继续跑', file=sys.stderr)
        return 1 if code else 0
    except Exception:                                     # noqa: BLE001
        print(f'ERROR: {name} 抛出异常——这本身就是红（门自己坏了，'
              f'不是「没检查出问题」）：', file=sys.stderr)
        traceback.print_exc()
        return 1
    if rc is None:
        print(f'ERROR: {name} 返回了 None——门必须返回 0 或 1', file=sys.stderr)
        return 1
    return 1 if rc else 0


GATES = [
    ('生成', 'inline_core --check',    lambda: inline_core.main(check_only=True)),
    ('生成', 'build_programs --check', lambda: build_programs.main(check_only=True)),

    ('A', 'registry_check',         registry.registry_check),
    ('A', 'fallback_check',         registry.fallback_check),
    ('A', 'fallback_version_check', registry.fallback_version_check),
    ('A', 'version_meta_check',     registry.version_meta_check),
    ('A', 'program_count_check',    registry.program_count_check),
    ('A', 'module_label_check',     registry.module_label_check),
    ('A', 'accent_module_check',    registry.accent_module_check),

    ('B', 'outbound_ref_check',       hygiene.outbound_ref_check),
    ('B', 'script_literal_check',     hygiene.script_literal_check),
    ('B', 'control_byte_check',       hygiene.control_byte_check),
    ('B', 'lazy_dep_check',           hygiene.lazy_dep_check),
    ('B', 'skeleton_sentinel_check',  hygiene.skeleton_sentinel_check),
    ('B', 'skeleton_leak_check',      hygiene.skeleton_leak_check),

    ('C', 'node_check',            syntax.node_check),
    ('C', 'core_tests',            syntax.core_tests),
    ('C', 'browser_branch_check',  syntax.browser_branch_check),

    ('D·库', 'program_run_check',              library.program_run_check),
    ('D·库', 'algorithm_property_check',       library.algorithm_property_check),
    ('D·库', 'program_embed_roundtrip_check',  library.program_embed_roundtrip_check),
    ('D·库', 'chapter_manifest_check',         library.chapter_manifest_check),
    ('D·库', 'anchor_check',                   library.anchor_check),
    ('D·库', 'exemption_check',                library.exemption_check),
    ('D·库', 'source_ascii_check',             library.source_ascii_check),
    ('D·库', 'source_bmp_check',               library.source_bmp_check),
    ('D·库', 'source_indent_check',            library.source_indent_check),
    ('D·库', 'blank_directive_check',          library.blank_directive_check),
    ('D·库', 'program_meta_check',             library.program_meta_check),
    ('D·库', 'variant_check',                  library.variant_check),

    ('D·词法', 'lex_roundtrip_check',    lexer.lex_roundtrip_check),
    ('D·词法', 'lex_vs_cpython_check',   lexer.lex_vs_cpython_check),
    ('D·词法', 'judge_strictness_check', lexer.judge_strictness_check),
    ('D·词法', 'lex_never_throws_check', lexer.lex_never_throws_check),
]


def _tally() -> str:
    """按组自数，保持 GATES 里各组第一次出现的顺序。"""
    counts: dict = {}
    for group, _name, _fn in GATES:
        counts[group] = counts.get(group, 0) + 1
    return ' · '.join(f'{g} {n}' for g, n in counts.items())


def main() -> int:
    # 全部跑到底、全部要报——**不能用 `or` 短路**，见文件头。
    rc = [_guard(name, fn) for _group, name, fn in GATES]
    bad = [name for (_group, name, _fn), code in zip(GATES, rc) if code]
    print()
    if bad:
        print(f'{len(bad)} / {len(GATES)} 道门红了：{", ".join(bad)}（{_tally()}）',
              file=sys.stderr)
    else:
        print(f'{len(GATES)} 道门全绿（{_tally()}）。')
    return 1 if any(rc) else 0


if __name__ == '__main__':
    sys.exit(main())
