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
# node --check -（从 stdin 读）报错时行号前缀是 [stdin]:<n>；把 <n> 换算回
# 该脚本块在原文件里的真实行号，见 node_check() 里的用法。
STDIN_LINE_RE = re.compile(r'^\[stdin\]:(\d+)$', re.MULTILINE)


def node_check() -> int:
    """逐个脚本块跑 node --check，而不是拼成一份大源码再跑一次。

    以前的做法是 '\\n'.join(blocks) 之后整体检查一次——报错行号是拼接后的
    行号，对不上原文件的任何一行。chess/tools/_piece-preview.html 已经有
    两个 <script> 块（一个生成、一个手写），阶段 1 的每个工具都会是这个
    形状：拼接会把报错行号错报到人手写的那块代码上。这里改成每块单独检查，
    再把该块在文件里的真实起始行加回报错信息里的行号，使其始终对得上。
    """
    tools = sorted((ROOT / 'tools').glob('*.html'))
    failed = []
    total_blocks = 0
    for path in tools:
        text = path.read_text(encoding='utf-8')
        matches = list(SCRIPT_RE.finditer(text))
        if not matches:
            print(f'WARN: {path.name} 里没有内联 <script>')
            continue
        for m in matches:
            total_blocks += 1
            # group(1) 的第一个字符所在的行号（1-based）——node --check 报的
            # 「第 1 行」就对应这一行。
            start_line = text.count('\n', 0, m.start(1)) + 1
            proc = subprocess.run(['node', '--check', '-'],
                                  input=m.group(1), text=True, capture_output=True)
            if proc.returncode != 0:
                def fix_line(mm, base=start_line):
                    return '[stdin]:' + str(int(mm.group(1)) + base - 1)
                stderr = STDIN_LINE_RE.sub(fix_line, proc.stderr.strip())
                failed.append((path.name, stderr))

    for name, err in failed:
        print(f'ERROR: {name} 语法检查失败\n{err}', file=sys.stderr)
    if not failed:
        print(f'node --check：{len(tools)} 个文件、{total_blocks} 个脚本块通过')
    return 1 if failed else 0


def core_tests() -> int:
    """跑 core/ 与 games/ 下的全部 *.test.js。

    棋谱校验门（games/games.test.js，规格 §7 门 2）与内核测试同等重要：
    30 局棋谱里抄错的一步，只有它能当场抓住。
    """
    rc = 0
    tests = sorted((ROOT / 'core').glob('*.test.js')) + sorted((ROOT / 'games').glob('*.test.js'))
    for test in tests:
        proc = subprocess.run(['node', str(test)])
        if proc.returncode != 0:
            print(f'ERROR: {test.name} 未通过', file=sys.stderr)
            rc = 1
    return rc


if __name__ == '__main__':
    # 三道门都要跑到底、都要报——不能用 `or` 短路。之前 `a() or b() or c()`
    # 一旦 a() 非零就直接跳过 b()/c()，意味着一份过期的内联副本（或任何语法
    # 错误）会让 406 条断言的 core_tests() 门根本不执行，问题只报出第一个，
    # 最有分量的那道门被悄悄跳过了。这里三个都无条件跑，各自打印自己的
    # ERROR，最后按「任一失败则整体失败」汇总退出码。
    rc_inline = inline_core.main(check_only=True)
    rc_node = node_check()
    rc_core = core_tests()
    sys.exit(1 if (rc_inline or rc_node or rc_core) else 0)
