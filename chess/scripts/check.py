#!/usr/bin/env python3
"""子项目校验门：内联副本一致性 + 每个 html 的内联脚本语法。

对应规格 §7 的第 5、6 道门。第 1–4 道由 node 测试文件负责。
"""
import pathlib
import re
import subprocess
import sys

import inline_core

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT_RE = re.compile(r'<script>(.*?)</script>', re.DOTALL)


def node_check() -> int:
    tools = sorted((ROOT / 'tools').glob('*.html'))
    failed = []
    for path in tools:
        blocks = SCRIPT_RE.findall(path.read_text(encoding='utf-8'))
        if not blocks:
            print(f'WARN: {path.name} 里没有内联 <script>')
            continue
        source = '\n'.join(blocks)
        proc = subprocess.run(['node', '--check', '-'],
                              input=source, text=True, capture_output=True)
        if proc.returncode != 0:
            failed.append((path.name, proc.stderr.strip()))

    for name, err in failed:
        print(f'ERROR: {name} 语法检查失败\n{err}', file=sys.stderr)
    if not failed:
        print(f'node --check：{len(tools)} 个文件通过')
    return 1 if failed else 0


def core_tests() -> int:
    rc = 0
    for test in sorted((ROOT / 'core').glob('*.test.js')):
        proc = subprocess.run(['node', str(test)])
        if proc.returncode != 0:
            print(f'ERROR: {test.name} 未通过', file=sys.stderr)
            rc = 1
    return rc


if __name__ == '__main__':
    sys.exit(inline_core.main(check_only=True) or node_check() or core_tests())
