#!/usr/bin/env python3
"""子项目校验门：内联副本一致性 + 每个 html 的内联脚本语法。

对应规格 §7 的第 5、6 道门。第 1–4 道由 node 测试文件负责。
"""
import json
import pathlib
import re
import subprocess
import sys

import inline_core

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT_RE = re.compile(r'<script>(.*?)</script>', re.DOTALL)
# chess/index.html 里内嵌的 FALLBACK 列表（file:// 下 fetch chess-tools.json
# 会因同源限制失败，靠它兜底渲染）。只抓 id 字段——FALLBACK 里其余字段
# （kicker/title/tag）是给人看的展示文案，不是这道检查关心的东西。
FALLBACK_ID_RE = re.compile(r"id:\s*'([\w-]+)'")
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


def fallback_check() -> int:
    """chess/index.html 内嵌的 FALLBACK 列表，id 集合必须与 chess-tools.json 一致。

    放在这里而不是 core/ 或 games/ 下的某个 *.test.js：这道检查跨的是两份
    非 JS-模块的静态资产（一份 html 里手写的 JS 字面量、一份 json），不像
    core/games 的测试那样是在测某个可 require() 的模块——用 Python 直接读
    两份文件、正则摘 id、求集合差，比现开一个 node 脚本去手搓一个「假 DOM
    环境」解析 <script> 里的字面量要直接。check.py 本来就是「跨文件一致性」
    这类检查的家（node_check/inline_core 也是同一类）。

    真正会坏的从来不是「fetch 失败」这条分支本身（那条分支好测、也测过），
    而是「以后加了第四个工具，忘了同步 FALLBACK」——这份内嵌副本会不知不觉
    地和 chess-tools.json 分岔，而任何 file:// 冒烟测试都不会触发这条分支
    去暴露它（本机预览通常走 http server，不是 file://）。
    """
    index_path = ROOT / 'index.html'
    tools_path = ROOT / 'chess-tools.json'
    index_text = index_path.read_text(encoding='utf-8')
    m = re.search(r'var FALLBACK = \[(.*?)\n\];', index_text, re.DOTALL)
    if not m:
        print('ERROR: index.html 里找不到 FALLBACK 数组', file=sys.stderr)
        return 1
    fallback_ids = set(FALLBACK_ID_RE.findall(m.group(1)))
    registry = json.loads(tools_path.read_text(encoding='utf-8'))
    registry_ids = {t['id'] for t in registry['tools']}
    if fallback_ids != registry_ids:
        missing = registry_ids - fallback_ids
        extra = fallback_ids - registry_ids
        print('ERROR: index.html 的 FALLBACK 与 chess-tools.json 的 id 集合不一致', file=sys.stderr)
        if missing:
            print(f'  FALLBACK 里缺失：{sorted(missing)}', file=sys.stderr)
        if extra:
            print(f'  FALLBACK 里多余（chess-tools.json 里已经没有）：{sorted(extra)}', file=sys.stderr)
        return 1
    print(f'FALLBACK 一致性：{len(registry_ids)} 个 id 全部对上')
    return 0


def core_tests() -> int:
    """跑 core/ 与 games/ 下的全部 *.test.js（**含子目录**）。

    棋谱校验门（games/games.test.js，规格 §7 门 2）与内核测试同等重要：
    30 局棋谱里抄错的一步，只有它能当场抓住。

    用 rglob 而不是 glob：glob 不下钻，`core/algos/minimax.test.js` 因此
    整个落在门外——本地手跑是绿的，这道门却一次都没跑到它，而它正是
    阶段 4 最核心的那条对拍测试（「剪枝不许改变答案」）。阶段 5 还要往
    `core/algos/` 里再加六个算法，这个洞不补会变成六倍大。
    报错用相对 ROOT 的路径而不是 test.name：加了子目录之后光看文件名
    分不清是哪一层的（`algos/minimax.test.js` vs `minimax.test.js`）。
    """
    rc = 0
    tests = sorted((ROOT / 'core').rglob('*.test.js')) + sorted((ROOT / 'games').rglob('*.test.js'))
    # 一个测试都没找到必须是失败，不是通过。空列表下这个循环一次都不转、
    # rc 保持 0，这道门就会"因为什么都没找到"而通过——正是上面那个
    # glob 洞的同一类错误，只是低一层：那次是漏掉一部分，这次是漏掉全部
    # （目录改名、脚本被挪走、rglob 手滑写错，都会走到这里）。
    if not tests:
        print('ERROR: core/ 与 games/ 下一个 *.test.js 都没找到 —— '
              '这道门本该跑测试，不是跑了个寂寞', file=sys.stderr)
        return 1
    for test in tests:
        proc = subprocess.run(['node', str(test)])
        if proc.returncode != 0:
            print(f'ERROR: {test.relative_to(ROOT)} 未通过', file=sys.stderr)
            rc = 1
    print(f'core/games 测试：{len(tests)} 个测试文件全部通过' if rc == 0
          else f'core/games 测试：{len(tests)} 个测试文件，有未通过的')
    return rc


if __name__ == '__main__':
    # 四道门都要跑到底、都要报——不能用 `or` 短路。之前 `a() or b() or c()`
    # 一旦 a() 非零就直接跳过 b()/c()，意味着一份过期的内联副本（或任何语法
    # 错误）会让 406 条断言的 core_tests() 门根本不执行，问题只报出第一个，
    # 最有分量的那道门被悄悄跳过了。这里四个都无条件跑，各自打印自己的
    # ERROR，最后按「任一失败则整体失败」汇总退出码。
    rc_inline = inline_core.main(check_only=True)
    rc_node = node_check()
    rc_fallback = fallback_check()
    rc_core = core_tests()
    sys.exit(1 if (rc_inline or rc_node or rc_fallback or rc_core) else 0)
