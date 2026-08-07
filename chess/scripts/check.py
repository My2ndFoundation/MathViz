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
# 区间体是 group(2)，**不要求非空**：空区间（两条标记贴在一起）也要匹配得上。
# 理由与 inline_core.ALGOS_MARK_RE 那一段完全相同，那里写着完整的事故记录——
# 两份正则必须同形，否则一份能看见的东西另一份看不见，就又出现"一道门以为
# 另一道门管了"的缝。空区间在这里会走进 `node -e` 并因为 ALGOS 未定义而报
# "node 求值 ALGOS 失败"，这是**期望行为**：要么内联、要么响亮地报错。
ALGOS_BLOCK_RE = re.compile(
    r'/\* >>> GENERATED:ALGOS(.*?) \*/\n(.*?)/\* <<< GENERATED:ALGOS \*/', re.DOTALL)

# 根级页面 = chess/index.html 与 chess/app.html。它们不在 tools/ 下，于是
# 长期躲过了这个文件里的两道门：node_check() 只 glob('tools/*.html')，而 CI
# 的语法门（.github/workflows/registry-sync.yml）扫的是主站的 app.html /
# index.html / outputs/*.html，不含 chess/。两边合起来的结果是 chess/index.html
# 从来没有被任何语法门覆盖过——一个纯 JS 驱动的导航页，语法错了就是整页白屏，
# 而所有门都报绿。
ROOT_PAGE_MIN = 2
# tools/ 下今天有 7 个页面，这里钉一个地板值而不是精确值——目录会随每个
# 阶段继续长（阶段 5 还要再加工具），精确计数只会在下次发布时变成误报。
# 没有这道守卫，node_check() 的 tools glob 一旦目错目录（改名/挪走），
# 结果不会是显眼的 0，而是「根级 2 个」照样凑出一个像模像样的总数，
# 七个工具页悄悄全部失踪却没人发现——跟 ROOT_PAGE_MIN 要防的是同一类坑。
TOOL_PAGE_MIN = 7
def root_pages() -> list:
    """chess/ 根目录下的 html 页面，按文件名排序。

    钉住「至少 ROOT_PAGE_MIN 个」而不是只写一句 glob：本仓库已经栽过两次同类
    的坑——core_tests() 用 glob 而非 rglob，于是 core/algos/minimax.test.js
    整个测试文件在门外躺着没人跑，直到阶段 4 的实现者报上来。遍历漏光了会
    安静地全绿，正是这道门要防的失败模式本身。
    """
    return sorted(ROOT.glob('*.html'))


def node_check() -> int:
    """逐个脚本块跑 node --check，而不是拼成一份大源码再跑一次。

    以前的做法是 '\\n'.join(blocks) 之后整体检查一次——报错行号是拼接后的
    行号，对不上原文件的任何一行。chess/tools/_piece-preview.html 已经有
    两个 <script> 块（一个生成、一个手写），阶段 1 的每个工具都会是这个
    形状：拼接会把报错行号错报到人手写的那块代码上。这里改成每块单独检查，
    再把该块在文件里的真实起始行加回报错信息里的行号，使其始终对得上。
    """
    pages = root_pages()
    if len(pages) < ROOT_PAGE_MIN:
        print(f'ERROR: chess/ 根级页面只找到 {len(pages)} 个，至少要 {ROOT_PAGE_MIN} 个'
              f'（index.html 与 app.html）——glob 漏了或文件被挪走了',
              file=sys.stderr)
        return 1
    tool_pages = sorted((ROOT / 'tools').glob('*.html'))
    if len(tool_pages) < TOOL_PAGE_MIN:
        print(f'ERROR: chess/tools/ 下只找到 {len(tool_pages)} 个页面，至少要 {TOOL_PAGE_MIN} 个'
              f'——glob 漏了或目录被挪走了',
              file=sys.stderr)
        return 1
    tools = tool_pages + pages
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


def algos_marker_shape_check() -> int:
    """带 `ALGOS` 标记的页面必须**要么被内联、要么当场报错**，绝不能两样都不发生。

    这道门守的是 `inline_core.ALGOS_MARK_RE` 的形状，不是任何一份 html 的内容——
    所以它跟下面的 `algos_roundtrip_check` 分工不同、不能互相替代：那一道是"页面
    里跑起来的 ALGOS 跟磁盘上的源文件是不是同一份字节"，前提是**先能扫到那个
    区间**；这一道守的正是"扫得到"本身。

    事故（2026-08-04，阶段 5 建工具⑤ 当天）：正则原来要求两条标记之间必须有
    内容（`\\n.*?\\n`），而新建一页时先把两条标记贴着写上、内容留给生成脚本填，
    恰恰产出一个空区间。于是 `render()` 里 `ALGOS_MARK_RE.search()` 为假，
    ALGOS 分支整个跳过；`missing` 里也不会有它（ALGOS 在 OPTIONAL_TAGS 里，
    而且那条路径根本没走到）；`algos_roundtrip_check` 用同形的正则，同样扫不到，
    于是打印"1 个文件"（那一个是工具④）并通过。三道门一起对一页视而不见，
    页面带着 `const ALGOS` 从未被定义的 `<script>` 上线——退出码 0。

    夹具全部在内存里构造，不依赖 chess/tools 下有没有某个文件：改坏了正则这道门
    立刻红，不必等下一个人建新页时才暴露。
    """
    algo = 'queens.js'      # 只要求 core/algos/ 下真的有这一份（它是阶段 5 的第一份）
    head = '/* >>> GENERATED:ALGOS ' + algo + ' */\n'
    foot = '/* <<< GENERATED:ALGOS */\n'
    empty_block = '// before\n' + head + foot + '// after\n'

    failed = []
    # ① 空区间必须被内联——这是这道门存在的全部理由。
    filled, missing = inline_core.render(empty_block)
    if filled == empty_block:
        failed.append('空区间（两条标记贴在一起）没有被内联，而且没有报错——'
                      '静默跳过又回来了')
    if 'const ALGOS = {' not in filled or ("'" + algo + "'") not in filled:
        failed.append('空区间内联之后，区间里没有出现 const ALGOS = { …ic 那份源码 }')
    if 'ALGOS' in missing:
        failed.append('ALGOS 被报成 missing——它在 OPTIONAL_TAGS 里，不该走这条路')
    # 标记行本身要逐字节重建（Task 1 定下的性质，别在修空区间时把它弄丢）。
    if head not in filled or foot not in filled:
        failed.append('内联之后两条标记行不再与原文逐字节相同')
    # 区间之外的内容一个字都不许动。
    if not filled.startswith('// before\n') or not filled.endswith('// after\n'):
        failed.append('内联改到了标记区间之外的文本')

    # ② 已经填好的区间再跑一遍必须逐字节不变（幂等）——否则每次跑生成脚本
    #    都会把所有页面判成"内容变了"，而 `--check` 会在 CI 上永远红。
    again, _ = inline_core.render(filled)
    if again != filled:
        failed.append('对已填好的区间重复内联不是幂等的')

    # ③ Task 1 定下的两个响亮错误必须仍然响亮。**空区间下也要响**——
    #    修好①之后这两条才第一次真正覆盖到空区间（以前根本走不到）。
    for label, marker in (('缺清单的裸标记', '/* >>> GENERATED:ALGOS */\n'),
                          ('清单里写了不存在的文件', '/* >>> GENERATED:ALGOS nosuchfile.js */\n')):
        for shape, body in (('空区间', ''), ('已填内容', 'const ALGOS = {};\n')):
            try:
                inline_core.render(marker + body + foot)
            except SystemExit:
                continue
            failed.append(f'{label} + {shape}：没有报错，安静地通过了')

    for err in failed:
        print(f'ERROR: ALGOS 标记形状检查失败\n  {err}', file=sys.stderr)
    if not failed:
        print('ALGOS 标记形状检查：空区间会被内联，填好的区间幂等，'
              '缺清单/清单写错在空区间与非空区间上都当场报错')
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

    标记按页列清单之后（规格 §2.1，2026-08-04 更新），这里再加一条独立
    于 inline_core 的校验：把标记行本身的清单跟求值出来的 ALGOS 对象的
    key 集合互相核对，两边**恰好相等**，多一个少一个都算错。「独立」
    是关键——inline_core.main(check_only=True) 那道门也会重新生成一遍
    再逐字比对，但它用的是同一份 inline_core.render()，如果清单解析或
    校验逻辑本身有 bug（比如漏掉了某种越界情况），重新生成一遍还是那个
    坏结果，两边照样"一致"。这里从标记行的原始文本独立解析一遍清单，
    不经过 inline_core 的任何函数，才能真正测出"页面上跑起来的 ALGOS
    对象，是不是标记行说的那几个文件，一个不多一个不少"。

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
        # 标记行自己的清单，从原始文本独立解析——不调用 inline_core 的任何
        # 函数，见上面文档字符串：要测的正是"标记说的"和"页面上跑起来的"
        # 是否对得上，如果连解析清单都复用 inline_core，这道门就退化成
        # "inline_core 跟自己比对"，测不出 inline_core 本身的 bug。
        expected_names = set(n.strip() for n in m.group(1).strip().split(','))
        expected_names.discard('')
        script = m.group(2) + '\nprocess.stdout.write(JSON.stringify(ALGOS));'
        proc = subprocess.run(['node', '-e', script], capture_output=True, text=True)
        if proc.returncode != 0:
            failed.append((path.name, 'node 求值 ALGOS 失败：' + proc.stderr.strip()))
            continue
        try:
            algos = json.loads(proc.stdout)
        except json.JSONDecodeError as e:
            failed.append((path.name, 'ALGOS 对象序列化失败：' + str(e)))
            continue
        actual_names = set(algos.keys())
        if actual_names != expected_names:
            missing = expected_names - actual_names
            extra = actual_names - expected_names
            detail = []
            if missing:
                detail.append(f'标记清单里有、ALGOS 对象里没有：{sorted(missing)}')
            if extra:
                detail.append(f'ALGOS 对象里有、标记清单里没有：{sorted(extra)}')
            failed.append((path.name, 'ALGOS 键集合与标记清单不一致——' + '；'.join(detail)))
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
    """每个根级页面内嵌的 FALLBACK 列表，id 集合必须与 chess-tools.json 一致。

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
    tools_path = ROOT / 'chess-tools.json'
    registry = json.loads(tools_path.read_text(encoding='utf-8'))
    registry_ids = {t['id'] for t in registry['tools']}

    pages = root_pages()
    if len(pages) < ROOT_PAGE_MIN:
        print(f'ERROR: chess/ 根级页面只找到 {len(pages)} 个，至少要 {ROOT_PAGE_MIN} 个',
              file=sys.stderr)
        return 1

    rc = 0
    copies = 0
    for page in pages:
        text = page.read_text(encoding='utf-8')
        m = re.search(r'var FALLBACK = \[(.*?)\n\];', text, re.DOTALL)
        if not m:
            print(f'ERROR: {page.name} 里找不到 FALLBACK 数组'
                  f'（每个根级页面都要能在 file:// 下自己渲染出导航）', file=sys.stderr)
            rc = 1
            continue
        copies += 1
        fallback_ids = set(FALLBACK_ID_RE.findall(m.group(1)))
        if fallback_ids != registry_ids:
            missing = registry_ids - fallback_ids
            extra = fallback_ids - registry_ids
            print(f'ERROR: {page.name} 的 FALLBACK 与 chess-tools.json 的 id 集合不一致',
                  file=sys.stderr)
            if missing:
                print(f'  FALLBACK 里缺失：{sorted(missing)}', file=sys.stderr)
            if extra:
                print(f'  FALLBACK 里多余（chess-tools.json 里已经没有）：{sorted(extra)}',
                      file=sys.stderr)
            rc = 1

    if copies < ROOT_PAGE_MIN:
        print(f'ERROR: 只找到 {copies} 份内嵌 FALLBACK，至少要 {ROOT_PAGE_MIN} 份', file=sys.stderr)
        rc = 1
    if rc == 0:
        print(f'FALLBACK 一致性：{copies} 份内嵌副本 · {len(registry_ids)} 个 id 全部对上')
    return rc


# 本阶段暂未双语、或明确不在范围内的 algos 文件。
# minimax.js 是工具④ 的：改它要重做那个工具的验收，规格 §1.6 划在阶段 9。
# 其余七份随阶段 8 的任务逐个划掉 —— **这个集合必须缩到只剩 minimax.js**，
# 一直留着就等于这道门没开。这里只用注释钉住这条纪律、不加代码强制：
# Task 4–7 的计划里每一步都钉死了期望打印的census数字（如"2 份双语 / 6 份
# 白名单"），少划掉一个文件、数字对不上，计划本身的验收步骤就会先发现，
# 机制已经够用，不必在 check.py 里再加一道自动化的"白名单只许收缩"检查。
MONOLINGUAL_ALGOS = {
    'minimax.js',
}

# render(parts, lang) 那一段在每份双语 algos 里逐字节相同（规格 §1.6）。
# 用两条锚线夹取，而不是数行数：行数会随注释改动漂移，锚线不会。
RENDER_BEGIN = '  /* ================= 双语渲染（规格 §1.6 / §7.5）'
RENDER_END = '    return out;\n  }\n'


def bilingual_algos_check() -> int:
    """双语算法源码的普查门（规格 §7.5，阶段 8）。

    各文件自己的 *.test.js 已经跑了「代码同一 / 步数同一 / 行数同一」三道门
    ——那三道要真实参数，参数只有测试文件知道，放在那里是对的。这里守的是
    那三道**够不着**的两件事：

    ① **普查**：core/algos/ 下每一份非测试、非白名单的 .js，都得**装上**
       双语机制。将来有人加第八道题却忘了双语，这道门当场响；靠各文件
       测试是守不住的 —— 新文件的新测试当然不会去测一件作者没想到的事。

    ② **render 助手七份逐字节相同**：它在每份里各存一份（不抽共用模块的
       理由见 queens.js 里那段注释），没有门就必然漂移。阶段 7 的
       king-greedy / king-exact 共用段用的是同一个套路。

    ⚠ **①「装上了」是结构判据，不是行为判据**，这一点必须说清楚：这道门
    **不**去调 source({}) 看它抛不抛。因为各份 source() 都先校验自己的参数
    （queens 是「少了 N」），一个空对象撞上的永远是那道校验，根本走不到
    lang —— 而这道门够不着每份的合法参数（那只有各自的测试知道）。
    所以①验的是三件加起来等价的结构事实：
      (a) **render 段在、且逐字节相同**（那一段里就写着两条 lang 的抛）；
      (b) **除 render 定义本身之外，还有别处调用了 render(...)**；
      (c) **source() 的 return 语句本身引用了那次调用的结果**——不是"调了
          一次就把结果丢掉，实际 return 的还是单语数组"（这个坑是真的：
          见下面（c）判据自己的文档字符串）。
    「带全参数、只缺 lang 也抛」由各文件自己的 T.throws(…, /少了 lang/) 守，
    每个文案任务都写了一条；**「render 的返回值有没有真的被用在别处（不只是
    在 return 语句里露了个面）」这道门够不着**，那是各文件自己的
    `zh !== en`（两种语言下生成的源码字符串不同）与三道"代码同一 / 步数
    同一 / 行数同一"测试的职责——这道门的职责只是让一份**全新的、还没人
    给它写过测试的**文件，在"忘了接上双语机制"时当场撞上错误，而不是等到
    英文界面冒出一屏中文才被人发现。

    ⚠ **这道门也不校验 render 段的内容**真的含那两条 lang 的抛——它只验
    "这一段存在、且七份逐字节相同"。段内容本身是否正确（两条 throw 还在不
    在）是行为判据，由各文件自己的 `T.throws(…, /少了 lang/)` 覆盖；这里
    不重复加检查，只是要在文档里说清楚这是"结构判据"的边界，不是漏洞。

    这道门**不判英文写得对不对** —— 机器判不了，那是人工审查项（规格 §8）。
    """
    algos = sorted(p for p in (ROOT / 'core' / 'algos').glob('*.js')
                   if not p.name.endswith('.test.js'))
    if not algos:
        print('ERROR: core/algos/ 下一个 .js 都没找到 —— 这道门本该普查，'
              '不是跑了个寂寞', file=sys.stderr)
        return 1

    stale = MONOLINGUAL_ALGOS - {p.name for p in algos}
    if stale:
        print(f'ERROR: MONOLINGUAL_ALGOS 里有已经不存在的文件：{sorted(stale)}'
              f' —— 白名单指着空气，等于把某个真文件悄悄放行了', file=sys.stderr)
        return 1

    # node -e 里公用的归一化探针：从 stdin 读源码字符串，调 _test.js 的
    # normalizeSource 抽掉注释与字符串字面量，写回 stdout。用 stdin 而不是
    # 让 node 自己读文件，是因为②要喂给它的是**拼接过的字符串**（挖掉了
    # render 定义段），磁盘上并不存在这样一份文件。
    NORMALIZE_PROBE = (
        'const T = require(%r);'
        'const src = require("fs").readFileSync(0, "utf8");'
        'process.stdout.write(T.normalizeSource(src));'
    ) % (str(ROOT / 'core' / '_test.js'),)

    def normalize(src: str):
        """跑 normalize probe，失败时返回 (None, stderr)，成功时返回 (norm, None)。"""
        proc = subprocess.run(['node', '-e', NORMALIZE_PROBE], input=src,
                              capture_output=True, text=True)
        if proc.returncode != 0:
            return None, proc.stderr.strip()[:200]
        return proc.stdout, None

    rc = 0
    renders = {}
    examined = 0    # 尝试过双语检查的文件数——不等于"确认双语"，见下面打印那行的注释
    for p in algos:
        if p.name in MONOLINGUAL_ALGOS:
            continue
        examined += 1
        text = p.read_text(encoding='utf-8')

        # ① render 段在不在（那一段里就写着两条 lang 的抛）
        b = text.find(RENDER_BEGIN)
        e = text.find(RENDER_END, b if b >= 0 else 0)
        if b < 0 or e < 0:
            print(f'ERROR: {p.name} 里找不到 render(parts, lang) 那一段'
                  f'（锚线 {RENDER_BEGIN.strip()[:24]}…）—— 双语化没做完，'
                  f'或者锚线被改了', file=sys.stderr)
            rc = 1
            continue
        segment = text[b:e + len(RENDER_END)]
        renders[p.name] = segment

        # ② (b) source() 真的调了 render —— 光定义不调用，等于没装。
        #
        #    ⚠ **不许在原文（或对原文整体归一化后的文本）上直接搜子串
        #    `render(` 再减掉定义行的匹配数。** 上一轮就是这么写的（用
        #    `len(总匹配) - len(function\s+render\( 的匹配)` 估算"非定义调用
        #    数"），审查的突变 G 抓到它是**假绿**：render 段是**逐字节复制
        #    到七份**的，段内任何一处 render(（哪怕是段内注释或段内自身逻辑
        #    里出现的 render(）都会被当成"调用"计入总数——一处污染七份，
        #    "减掉定义行"这一步根本堵不住"定义段内其它位置的 render("。
        #
        #    正确做法是先在**原文**上用 ①已经验证过的锚线 b/e 把整段 render
        #    定义（含上方注释）**整体挖掉**，剩下两截拼起来，再送去归一化——
        #    这样"数 render( 出现次数"天然只会数到定义段之外的调用，不需要
        #    再用任何正则去猜"哪一处是定义行"。锚线在原文里是可靠的（①已经
        #    验证过 b/e 确实夹住了这一整段），比在归一化文本里重新用
        #    `function render(parts, lang) {` 配对花括号去切更稳，也不必再
        #    应付"箭头函数/函数表达式/多行定义"这类会让配对花括号变复杂的
        #    写法——它们跟普通调用一样，只要出现在挖掉的那一段**之内**就已经
        #    被连根拔掉，不必单独识别。拼接处会断一次行结构，这里只数子串、
        #    不关心行号，不受影响。
        #
        #    「什么算注释」这段知识本仓已经有唯一实现：_test.js 的
        #    normalizeSource（Task 1）。这里 shell 出 node 去调它，不在
        #    Python 里重写一份（Task 2 的审查刚为同一条理由否掉过一个本地
        #    过滤：同一段知识分成两份，迟早分岔）。归一化之后 queens.js 的
        #    非定义 render( 应该有 2 处（HEAD 一次、BODY 一次）。
        rest_raw = text[:b] + text[e + len(RENDER_END):]
        rest_norm, err = normalize(rest_raw)
        if err is not None:
            print(f'ERROR: {p.name} 挖掉 render 定义段之后归一化失败 —— {err}',
                  file=sys.stderr)
            rc = 1
            continue
        calls = len(re.findall(r'(?:^|[^\w$.])render\(', rest_norm))
        if calls < 1:
            print(f'ERROR: {p.name} 定义了 render(parts, lang) 却从来不调它 —— '
                  f'source() 还在吐单语源码', file=sys.stderr)
            rc = 1
            continue

        # ② (c) 调了不等于用了 —— render 的返回值必须真的进了 source() 的
        #    return 语句，不能"先调一次、把结果丢掉，实际 return 的还是单语
        #    数组"（审查的突变 F：正是这种写法，calls>=1 但结果没被用上）。
        #
        #    ⚠ **这条判据是故意收紧的结构判据，脆**：它要求 return 语句本身
        #    （直到下一个分号为止）里字面出现 render( ——如果将来某份文件
        #    合法地先把 render(...) 的结果存进一个变量、再 `return
        #    lines.join(...)`，会被这条误伤为"没用上"。这属于"判据脆是判据
        #    的问题，不是文件的问题"：真遇到这种写法应该回来放宽这条判据
        #    （比如改成追踪变量数据流），不能反过来强迫文件写成
        #    `return render(...)` 的形状。当前七份 algos 的既定写法就是
        #    `return render(HEAD,...).concat(...).concat(render(BODY,...))…`，
        #    在这个前提下这条判据是有效的、且已经用 queens.js 的真实文本验证
        #    过确实能匹配。
        #
        #    「render 的返回值有没有真的在**下游别处**被用上（不只是在 return
        #    语句里露了个面）」这道门够不着，那是各文件自己的 `zh !== en` 与
        #    三道"代码同一/步数同一/行数同一"测试的职责——这道门只保证
        #    return 语句字面引用了 render 调用，不保证它是唯一一次调用，也
        #    不保证调用参数的 lang 传对了。
        if not re.search(r'return[^;]*render\(', rest_norm):
            print(f'ERROR: {p.name} 调用了 render(parts, lang)，但 return 语句'
                  f'里没有用上它的结果 —— source() 实际返回的可能还是单语'
                  f'（render 被调用后结果被丢弃）', file=sys.stderr)
            rc = 1

    if examined == 0:
        print('ERROR: 一份双语 algos 都没有 —— MONOLINGUAL_ALGOS 是不是把'
              '所有文件都放行了？', file=sys.stderr)
        return 1

    # 「render 助手 N 份一致/不一致」这半句只报**这一条**（逐字节比对）的
    # 结果，跟上面①②的结构判据是否失败无关，两者故意分开算——上一版把
    # 它们混在一起：①②任何一处失败都会让整体 rc 非零，而这半句直接读
    # `rc == 0` 来判断"一致"，于是①②真的出错时，这里照样打印"…份一致"，
    # 看起来像是"render 助手没问题"，实际上是别的判据在报错。这里单开一个
    # consistency_ok，只在这条比对本身失败时才置 False。
    names = sorted(renders)
    consistency_ok = True
    if len(names) > 1:
        first = renders[names[0]]
        for name in names[1:]:
            if renders[name] != first:
                print(f'ERROR: {name} 的 render(parts, lang) 与 {names[0]} 的'
                      f'不是逐字节相同 —— 七份里各存一份，就必须一个字节都不差',
                      file=sys.stderr)
                rc = 1
                consistency_ok = False

    # ⚠ `examined` 数的是"尝试过双语检查的文件数"，不是"确认双语通过的文件
    # 数"——①锚线缺失的文件也会先被计入 examined（在 continue 之前）。两者
    # 在door全绿时数值相同（当前 1 份双语场景下就是如此），但读这行输出时
    # 要知道：`examined` 更准确的含义是分母，不是"验收通过"的断言，真正
    # 的通过与否看的是整体 rc 和上面有没有打印任何 ERROR。
    print(f'双语 algos 普查：{examined} 份双语 / {len(algos) - examined} 份白名单，'
          f'render 助手 {len(names)} 份'
          + ('一致' if consistency_ok else '有不一致'))
    return rc


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
    # 八道门都要跑到底、都要报——不能用 `or` 短路。之前 `a() or b() or c()`
    # 一旦 a() 非零就直接跳过 b()/c()，意味着一份过期的内联副本（或任何语法
    # 错误）会让 406 条断言的 core_tests() 门根本不执行，问题只报出第一个，
    # 最有分量的那道门被悄悄跳过了。这里八个都无条件跑，各自打印自己的
    # ERROR，最后按「任一失败则整体失败」汇总退出码。
    # js_string_literal_html_safety_check 与 algos_roundtrip_check 是阶段 4
    # 新加的两道门：前者查转义结果对 HTML 分词器是否安全（`<!--` + 裸
    # `<script` 那类坑，`node -e` 天生看不见），后者查转义结果求值出来的
    # 值是否与源文件字节一致——两者分工互补，各自的文档字符串里写清楚了
    # 为什么不能互相替代。
    # algos_marker_shape_check 是阶段 5 新加的第七道，守的是**扫不扫得到**
    # 那个区间——上面两道都以"已经扫到了"为前提，空区间那次事故正是从这个
    # 前提底下漏过去的。
    # bilingual_algos_check 是阶段 8 新加的第八道，守两件各文件测试守不住的
    # 事：core/algos/ 下有没有文件忘了装双语机制（普查，按 MONOLINGUAL_ALGOS
    # 白名单工作），以及 render(parts, lang) 助手在七份里是否逐字节相同
    # （它在每份里各存一份，没有门就必然漂移）。
    rc_inline = inline_core.main(check_only=True)
    rc_node = node_check()
    rc_html_safety = js_string_literal_html_safety_check()
    rc_marker = algos_marker_shape_check()
    rc_algos = algos_roundtrip_check()
    rc_fallback = fallback_check()
    rc_core = core_tests()
    rc_bilingual = bilingual_algos_check()
    sys.exit(1 if (rc_inline or rc_node or rc_html_safety or rc_marker or
                    rc_algos or rc_fallback or rc_core or rc_bilingual) else 0)
