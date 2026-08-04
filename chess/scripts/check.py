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
ALGOS_BLOCK_RE = re.compile(
    r'/\* >>> GENERATED:ALGOS \*/\n(.*?)\n/\* <<< GENERATED:ALGOS \*/', re.DOTALL)


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


def js_string_literal_html_safety_check() -> int:
    """js_string_literal() 的转义是否真的让内联块在 **HTML 分词器** 眼里安全。

    这道检查跟下面的 algos_roundtrip_check 分工不同、互补，不能互相替代：
    algos_roundtrip_check 走的是 `node -e`，那是纯 JS 解析——只要字符串
    值算得对，它就满意，它压根不经过 HTML 分词器，对分词器层面的坑
    **结构性看不见**。而这个函数是为了补那个盲区存在的。

    真实事故（阶段 4 复现过）：一段文本只要同时含有 `<!--` 和后面某处
    （哪怕隔着任意多字符）一个裸的 `<script`，HTML 分词器就会从那个
    `<!--` 起进入 script-data-escaped / double-escaped 状态，模板自己
    真正的收尾 `</script>` 不再被当成闭合标签，而是被状态机吃掉、状态
    翻转——闭合标签错位，整个页面从这里开始被当脚本文本吞掉。用真实
    浏览器复现过：`document.scripts.length` 从预期的 2 掉到 1，后一个
    `<script>` 里的全局变量全部 undefined。**这个构造里一次 `</script`
    都不出现**——查"有没有 `</script`"防不住它，得直接查有没有裸 `<!--`。

    所以这里不比较"值对不对"（那是 algos_roundtrip_check 的活），而是
    直接在**编码后的字符串本身**里查两类危险子串还在不在：
      1. 裸 `<!--`——分词器进入转义状态的触发点。
      2. 大小写不敏感的 `</script`——分词器提前闭合标签的触发点。
    两个都不该在 js_string_literal() 的输出里出现，不管输入里有什么。
    这是个不依赖任何 html 文件是否存在的直接单元检查：改坏了转义函数，
    这道门立刻红，不必等 Task 6 那样的工具页出现才暴露。
    """
    cases = {
        '<!-- 后面隔着文字接一个裸 <script（无 </script）':
            'before <!-- comment-ish text then later a bare <script tag, no closer here',
        '单独的 <!--（对照组，本身不必然出事，但也不该漏转义）':
            'a <!-- b',
        '</script 各种大小写与空格变体':
            '</script> </SCRIPT> </ScRiPt> </script  >',
        '<!-- 与 </script 同时出现':
            '<!-- start --> mid </script> tail',
    }
    failed = []
    for label, text in cases.items():
        lit = inline_core.js_string_literal(text)
        if '<!--' in lit:
            failed.append(f'{label}：转义结果里仍有裸 <!--')
        if re.search(r'</script', lit, re.IGNORECASE):
            failed.append(f'{label}：转义结果里仍有 </script（大小写不敏感）')
        # 顺手确认值本身没被这两条新规则悄悄改坏——用 node 求值回来对比。
        script = f'const V = {lit};\nprocess.stdout.write(JSON.stringify(V));'
        proc = subprocess.run(['node', '-e', script], capture_output=True, text=True)
        if proc.returncode != 0:
            failed.append(f'{label}：node 求值失败：{proc.stderr.strip()}')
            continue
        if json.loads(proc.stdout) != text:
            failed.append(f'{label}：转义/求值往返后值变了')

    for err in failed:
        print(f'ERROR: js_string_literal HTML 安全检查失败\n  {err}', file=sys.stderr)
    if not failed:
        print(f'js_string_literal HTML 安全检查：{len(cases)} 个构造全部安全且值不变')
    return 1 if failed else 0


def algos_roundtrip_check() -> int:
    """ALGOS 内联的是**字符串**，不是代码（inline_core.js_string_literal，规格 §2.1）。

    inline_core.main(check_only=True) 的「内联副本与编辑源是否一致」只能
    抓「忘了重新跑生成脚本」——它是拿*同一个*转义函数重新生成一遍再逐字
    比对，如果转义函数本身有 bug（漏转义 `</script`、`\\u2028` 处理错、
    JSON 转义少一层……），重新生成一遍还是那个坏结果，两边照样"一致"，
    这道门会眼睁睁放过一个正在悄悄改坏算法源码的 bug。

    这里换一种独立的验证方式：不比较"生成了什么"，而是把内联块**当真的
    JS 跑起来**，求值出 ALGOS 对象，再拿每个 key 的值跟 core/algos/ 下
    对应源文件按字节比较。用 node 求值而不是自己解析转义序列，是因为
    "转义序列该怎么解码"这件事的唯一权威就是 JS 引擎本身——用 Python
    重新实现一遍转义规则，等于又造了一份可能跟 js_string_literal 各自
    漂移的平行实现。

    **本函数的校验范围止于 JS 求值等价，不覆盖 HTML 嵌入安全**：`node -e`
    是纯 JS 解析器，从不经过 HTML 分词器，天生看不见"分词器提前进入
    转义状态、把收尾 `</script>` 吃掉"这一类坑（`<!--` + 后面裸 `<script`
    的组合就是一个真实例子）。这一类由上面的 js_string_literal_html_safety_check
    覆盖——不要以为这里的"往返一致"已经证明了转义在 HTML 语境下也安全。

    没有任何工具页带 ALGOS 标记区时，这道检查跑 0 次、静默通过——这是
    存在性探测（presence detection），不是漏检：render() 那道通用门
    已经确认了"没有标记区的文件不该被这个 tag 影响"，这里只是同一件事
    在 ALGOS 专属校验里的自然结果。工具④（chess-search-minimax.html）
    落地后这道门开始真正咬合，逐个标记区跑起来。
    """
    tools = sorted((ROOT / 'tools').glob('*.html'))
    checked_files = 0
    checked_algos = 0
    failed = []
    for path in tools:
        text = path.read_text(encoding='utf-8')
        m = ALGOS_BLOCK_RE.search(text)
        if not m:
            continue
        checked_files += 1
        script = m.group(1) + '\nprocess.stdout.write(JSON.stringify(ALGOS));'
        proc = subprocess.run(['node', '-e', script], capture_output=True, text=True)
        if proc.returncode != 0:
            failed.append((path.name, 'node 求值 ALGOS 失败：' + proc.stderr.strip()))
            continue
        try:
            algos = json.loads(proc.stdout)
        except json.JSONDecodeError as e:
            failed.append((path.name, 'ALGOS 对象序列化失败：' + str(e)))
            continue
        for name, content in algos.items():
            src = inline_core.ALGOS_DIR / name
            if not src.exists():
                failed.append((path.name, f'{name} 在 core/algos/ 下已不存在，内联副本是孤儿'))
                continue
            expected = src.read_text(encoding='utf-8')
            if content != expected:
                failed.append((path.name, f'{name} 往返求值后与源文件字节不一致'))
            else:
                checked_algos += 1

    for name, err in failed:
        print(f'ERROR: {name} 的 ALGOS 往返校验失败\n{err}', file=sys.stderr)
    if not failed:
        if checked_files:
            print(f'ALGOS 往返校验：{checked_files} 个文件、{checked_algos} 份算法源码字节级一致')
        else:
            print('ALGOS 往返校验：当前没有工具页带 ALGOS 标记区，跳过')
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
    # 六道门都要跑到底、都要报——不能用 `or` 短路。之前 `a() or b() or c()`
    # 一旦 a() 非零就直接跳过 b()/c()，意味着一份过期的内联副本（或任何语法
    # 错误）会让 406 条断言的 core_tests() 门根本不执行，问题只报出第一个，
    # 最有分量的那道门被悄悄跳过了。这里六个都无条件跑，各自打印自己的
    # ERROR，最后按「任一失败则整体失败」汇总退出码。
    # js_string_literal_html_safety_check 与 algos_roundtrip_check 是阶段 4
    # 新加的两道门：前者查转义结果对 HTML 分词器是否安全（`<!--` + 裸
    # `<script` 那类坑，`node -e` 天生看不见），后者查转义结果求值出来的
    # 值是否与源文件字节一致——两者分工互补，各自的文档字符串里写清楚了
    # 为什么不能互相替代。
    rc_inline = inline_core.main(check_only=True)
    rc_node = node_check()
    rc_html_safety = js_string_literal_html_safety_check()
    rc_algos = algos_roundtrip_check()
    rc_fallback = fallback_check()
    rc_core = core_tests()
    sys.exit(1 if (rc_inline or rc_node or rc_html_safety or rc_algos or
                    rc_fallback or rc_core) else 0)
