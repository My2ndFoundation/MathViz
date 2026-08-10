#!/usr/bin/env python3
"""cryptography 子项目校验门（设计文档 §5）。

十道门全部**无条件**跑到底，最后按「任一失败则整体失败」汇总退出码。

| # | 函数                              | 守什么 |
|---|-----------------------------------|--------|
| 1 | inline_core.main(check_only=True) | 内联副本与编辑源一致 |
| 2 | node_check()                      | 每个 html 每个 <script> 块语法（含 app/index 两个根级页） |
| 3 | core_tests()                      | core/**/*.test.js + examples/**/*.test.js 全绿 |
| 4 | registry_check()                  | id/file/accent/chapter/version/engine/双语/重复/双向存在 |
| 5 | fallback_check()                  | 两页 FALLBACK 的 id 集合 == 注册表 id 集合 |
| 6 | version_meta_check()              | 注册表 version == html 的 tool-version meta |
| 7 | algos_gate()                      | 内联的 ALGOS 块在**浏览器分支**下能跑，且 Caesar 全 k 往返成立 |
| 8 | outbound_ref_check()              | `../` 只出现在 app/index 各一次，其余目录零次 |
| 9 | inline_order_check()              | CRYPTO-CORE 的标记必须排在 CRYPTANALYSIS / ALGOS 之前 |
|10 | script_literal_check()            | core/ 与 examples/ 的 js 里不许出现 <script / </script 字面量 |
"""
import json
import pathlib
import re
import subprocess
import sys
import tempfile

import inline_core

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / 'cryptography-tools.json'
SCRIPT_RE = re.compile(r'<script>(.*?)</script>', re.DOTALL)
FALLBACK_ID_RE = re.compile(r"id:\s*'([\w-]+)'")
META_VERSION_RE = re.compile(r'<meta\s+name="tool-version"\s+content="([^"]+)"')
# node --check -（从 stdin 读）报错时行号前缀是 [stdin]:<n>；把 <n> 换算回该脚本块
# 在原文件里的真实行号，见 node_check() 里的用法。
STDIN_LINE_RE = re.compile(r'^\[stdin\]:(\d+)$', re.MULTILINE)
# 区间体是 group(2)，**不要求非空**：空区间（两条标记贴在一起）也要匹配得上。
# 理由与 inline_core.ALGOS_MARK_RE 那一段完全相同，那里写着完整的事故记录——
# 两份正则必须同形，否则一份能看见的东西另一份看不见，就又出现「一道门以为
# 另一道门管了」的缝。
ALGOS_BLOCK_RE = re.compile(
    r'/\* >>> GENERATED:ALGOS(.*?) \*/\n(.*?)/\* <<< GENERATED:ALGOS \*/', re.DOTALL)

CHAPTERS = {1, 2, 3, 4, 5}
ACCENTS = {'cyan', 'rose', 'violet', 'emerald', 'orange'}
BILINGUAL_FIELDS = ('kicker', 'title', 'desc', 'tag')

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

    只给「注册表 / 版本 / 双向存在 / ALGOS 求值」那几道门用——`_skeleton.html`
    不是发布的工具，没有注册表条目，也不该有版本号被比对。
    """
    return sorted(p for p in (ROOT / 'tools').glob('*.html')
                  if not p.name.startswith('_'))


def all_tool_pages() -> list:
    """tools/ 下的**全部**页面，含 `_` 开头的模板。

    语法门与内联顺序门要用这个，不是 tool_pages()。骨架同样内嵌七个 GENERATED
    区间、同样会因为一次手滑而语法错或顺序错，而它是以后每个新工具的复制源——
    它坏了，坏的是所有后代。`inline_core.py` 的 glob 也不排除它（模板用
    `GENERATED:ALGOS none` 显式弃权，见那边的注释）。
    """
    return sorted((ROOT / 'tools').glob('*.html'))


def root_pages() -> list:
    """cryptography/ 根目录下的 html：index.html 与 app.html。

    chess 的同名函数注释里记着为什么要单列它们：它的 node_check() 只
    glob('tools/*.html')，而 CI 的语法门只扫主站文件，两边合起来的结果是
    chess/index.html 从来没有被任何语法门覆盖过——一个纯 JS 驱动的导航页，
    语法错了就是整页白屏，而所有门都报绿。这里从第一天就把它们纳入。
    """
    return sorted(ROOT.glob('*.html'))


ROOT_PAGE_MIN = 2      # index.html + app.html


def node_check() -> int:
    """逐个 <script> 块跑 node --check，并把报错行号换算回原文件真实行号。

    不把多个块拼起来再检查一次：工具页有两个 script 块（一个生成、一个手写），
    拼接会把报错行号错报到人手写的那块代码上。
    """
    pages = root_pages()
    if len(pages) < ROOT_PAGE_MIN:
        print(f'ERROR: cryptography/ 根级页面只找到 {len(pages)} 个，至少要 '
              f'{ROOT_PAGE_MIN} 个（index.html 与 app.html）——glob 漏了或文件被挪走了',
              file=sys.stderr)
        return 1
    # 语法门用 all_tool_pages()：骨架也内嵌七个 GENERATED 区间、也会语法错，
    # 而它是以后每个新工具的复制源——它坏了，坏的是所有后代。
    tools = all_tool_pages()
    if not tools:
        print('ERROR: cryptography/tools/ 下一个页面都没有——这道门本该检查语法，'
              '不是跑了个寂寞', file=sys.stderr)
        return 1

    failed = []
    total_blocks = 0
    for path in tools + pages:
        text = path.read_text(encoding='utf-8')
        matches = list(SCRIPT_RE.finditer(text))
        if not matches:
            print(f'WARN: {path.name} 里没有内联 <script>', file=sys.stderr)
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
                failed.append((path.name, STDIN_LINE_RE.sub(fix_line, proc.stderr.strip())))

    for name, err in failed:
        print(f'ERROR: {name} 语法检查失败\n{err}', file=sys.stderr)
    if not failed:
        print(f'node --check：{len(tools) + len(pages)} 个文件、{total_blocks} 个脚本块通过')
    return 1 if failed else 0


def core_tests() -> int:
    """跑 core/ 与 examples/ 下的全部 *.test.js（**含子目录**）。

    用 rglob 而不是 glob：core/algos/caesar.test.js 在子目录里，glob 不下钻。
    chess 在这一点上栽过——algos/minimax.test.js 整个落在门外，本地手跑是绿的，
    这道门却一次都没跑到它。
    """
    tests = (sorted((ROOT / 'core').rglob('*.test.js'))
             + sorted((ROOT / 'examples').rglob('*.test.js')))
    # 一个测试都没找到必须是失败，不是通过——空列表下循环一次都不转、
    # rc 保持 0，这道门就会「因为什么都没找到」而通过。
    if not tests:
        print('ERROR: core/ 与 examples/ 下一个 *.test.js 都没找到 —— '
              '这道门本该跑测试，不是跑了个寂寞', file=sys.stderr)
        return 1
    rc = 0
    for test in tests:
        if subprocess.run(['node', str(test)]).returncode != 0:
            print(f'ERROR: {test.relative_to(ROOT)} 未通过', file=sys.stderr)
            rc = 1
    print(f'core/examples 测试：{len(tests)} 个测试文件'
          + ('全部通过' if rc == 0 else '有未通过的'))
    return rc


def registry_check() -> int:
    """注册表自洽 + 与磁盘双向一致。

    双向很重要：只查「注册表里的文件存在」会漏掉反方向——一个写完但忘了注册的
    工具页会悄悄躺在 tools/ 里进不了任何导航。根仓库真出过这事（main 上
    61 个 output 文件对 60 条注册）。
    """
    reg = load_registry()
    rc = 0
    if reg.get('schemaVersion') != 1:
        print(f'ERROR: schemaVersion 应为 1，实际 {reg.get("schemaVersion")!r}', file=sys.stderr)
        rc = 1
    tools = reg.get('tools') or []
    if not tools:
        print('ERROR: 注册表里一个工具都没有', file=sys.stderr)
        return 1

    seen_ids, seen_files = {}, {}
    for d in tools:
        tid = d.get('id')
        if not tid:
            print('ERROR: 有条目缺 id', file=sys.stderr); rc = 1; continue
        if tid in seen_ids:
            print(f'ERROR: 重复的 id：{tid}', file=sys.stderr); rc = 1
        seen_ids[tid] = 1

        f = d.get('file', '')
        if f in seen_files:
            print(f'ERROR: 重复的 file：{f}', file=sys.stderr); rc = 1
        seen_files[f] = 1
        if not f.startswith('tools/'):
            print(f'ERROR: {tid} 的 file 必须在 tools/ 下，实际 {f!r}', file=sys.stderr); rc = 1
        # 硬边界（规范 §8）：本注册表只管 cryptography/tools/*.html。
        # 一条指向 ../outputs/ 的路径既越了注册表边界，也毁了可搬迁性。
        if '..' + '/' in f:
            print(f'ERROR: {tid} 的 file 指向了子项目之外：{f!r}', file=sys.stderr); rc = 1
        if not (ROOT / f).exists():
            print(f'ERROR: {tid} 的 file 不存在：{f}', file=sys.stderr); rc = 1

        if d.get('chapter') not in CHAPTERS:
            print(f'ERROR: {tid} 的 chapter 必须是 1–5，实际 {d.get("chapter")!r}',
                  file=sys.stderr); rc = 1
        if d.get('accent') not in ACCENTS:
            print(f'ERROR: {tid} 的 accent 必须是 {sorted(ACCENTS)} 之一，'
                  f'实际 {d.get("accent")!r}', file=sys.stderr); rc = 1
        if not re.fullmatch(r'\d+\.\d+\.\d+', str(d.get('version', ''))):
            print(f'ERROR: {tid} 的 version 不是 semver：{d.get("version")!r}',
                  file=sys.stderr); rc = 1
        if not str(d.get('engine', '')).startswith('crypto-'):
            print(f'ERROR: {tid} 的 engine 应形如 crypto-x.y.z，'
                  f'实际 {d.get("engine")!r}', file=sys.stderr); rc = 1
        if not isinstance(d.get('changelog'), list):
            print(f'ERROR: {tid} 的 changelog 必须是数组', file=sys.stderr); rc = 1

        for field in BILINGUAL_FIELDS:
            v = d.get(field)
            if not isinstance(v, dict) or not v.get('en') or not v.get('zh'):
                print(f'ERROR: {tid} 的 {field} 必须同时有非空的 zh 与 en',
                      file=sys.stderr); rc = 1

    # 反方向：磁盘上有、注册表里没有
    registered = set(seen_files)
    for p in tool_pages():
        rel = 'tools/' + p.name
        if rel not in registered:
            print(f'ERROR: {rel} 在磁盘上但没进注册表——它进不了任何导航',
                  file=sys.stderr); rc = 1

    if rc == 0:
        print(f'注册表：{len(tools)} 个工具，字段与磁盘双向一致')
    return rc


def fallback_check() -> int:
    """两页内嵌的 FALLBACK 与注册表的 id 集合必须完全相同。

    FALLBACK 是 file:// 下唯一的数据来源（fetch 会因同源限制失败）。它一旦
    落后于注册表，本地双击打开的画廊就会少工具，而线上是全的——一个只在
    离线时出现的差异，没有这道门就只能靠人撞见。
    """
    reg_ids = set(d['id'] for d in load_registry()['tools'])
    rc = 0
    for name in ('app.html', 'index.html'):
        path = ROOT / name
        text = path.read_text(encoding='utf-8')
        m = re.search(r'var FALLBACK = \[(.*?)\n\];', text, re.DOTALL)
        if not m:
            print(f'ERROR: {name} 里找不到 FALLBACK 数组', file=sys.stderr); rc = 1; continue
        ids = set(FALLBACK_ID_RE.findall(m.group(1)))
        if ids != reg_ids:
            print(f'ERROR: {name} 的 FALLBACK 与注册表不一致\n'
                  f'    只在 FALLBACK：{sorted(ids - reg_ids)}\n'
                  f'    只在注册表：  {sorted(reg_ids - ids)}', file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'FALLBACK：两页各 {len(reg_ids)} 条，与注册表一致')
    return rc


def version_meta_check() -> int:
    """注册表的 version 必须等于工具页 <meta name="tool-version"> 的值。

    版本号在这个仓库不只是标签，还是**缓存键**：app.html 与画廊都把它拼进
    iframe/卡片的 URL（?v=<version>）。两处不一致时，一次已发布的升级会
    躲在浏览器的旧副本后面，直到使用者清缓存——根 CLAUDE.md 记着这事真发生过。
    """
    rc = 0
    for d in load_registry()['tools']:
        path = ROOT / d['file']
        if not path.exists():
            continue                       # 缺文件由 registry_check 报，不重复报
        m = META_VERSION_RE.search(path.read_text(encoding='utf-8'))
        if not m:
            print(f'ERROR: {d["file"]} 缺 <meta name="tool-version">', file=sys.stderr)
            rc = 1; continue
        if m.group(1) != d['version']:
            print(f'ERROR: {d["id"]} 版本不一致——注册表 {d["version"]}、'
                  f'html meta {m.group(1)}', file=sys.stderr)
            rc = 1
    if rc == 0:
        print('版本元数据：注册表与 html meta 一致')
    return rc


def algos_gate() -> int:
    """内联进 html 的 ALGOS 块必须真的能跑，且 Caesar 的往返性质成立。

    inline_core --check 只保证「内联副本与源文件字节相同」。它答不了另一个问题：
    这段代码在浏览器那个没有 module/require 的环境里跑起来会怎样。ALGOS 的
    UMD 分支在 node 下走 module.exports、在页面里走 root.CryptoAlgos——两条
    分支只有一条会被 core 测试覆盖到。这道门跑的是**另一条**。
    """
    rc = 0
    checked = 0
    for path in tool_pages():
        text = path.read_text(encoding='utf-8')
        m = ALGOS_BLOCK_RE.search(text)
        if not m:
            continue
        names = [n.strip() for n in m.group(1).strip().split(',') if n.strip()]
        if 'caesar.js' not in names:
            continue
        core = (ROOT / 'core' / 'crypto-core.js').read_text(encoding='utf-8')
        # ⚠ **不能用 `const self = globalThis;` 加直接执行来模拟浏览器。**
        # node -e 与 node-读-stdin **都**定义了 module 与 require（实测：
        # `typeof module === 'object'`、`typeof require === 'function'`），
        # 于是 UMD 头部会走**node 分支**——这道门就变成了在测 core 测试已经
        # 覆盖过的那条路，同时看起来一切正常。一道测错分支的门比没有门更坏：
        # 它会让人以为浏览器分支被覆盖了。
        #
        # 正确做法是 vm + 一个**裸上下文**（没有 module / require），让 UMD
        # 只能走 root.CryptoAlgos 那条分支。源码经临时文件送进去而不是拼进
        # 脚本字符串：省掉一整套 JS 字面量转义，也更接近浏览器真实的
        # 「读文件内容、在全局上下文里执行」。
        with tempfile.TemporaryDirectory() as td:
            core_f = pathlib.Path(td) / 'core.js'
            algos_f = pathlib.Path(td) / 'algos.js'
            core_f.write_text(core, encoding='utf-8')
            algos_f.write_text(m.group(2), encoding='utf-8')
            script = (
                'const vm = require("vm"), fs = require("fs");\n'
                'const sandbox = {}; sandbox.self = sandbox;\n'
                'sandbox.console = console;\n'
                'vm.createContext(sandbox);\n'
                f'vm.runInContext(fs.readFileSync({json.dumps(str(core_f))}, "utf8"), sandbox);\n'
                f'vm.runInContext(fs.readFileSync({json.dumps(str(algos_f))}, "utf8"), sandbox);\n'
                'if (typeof sandbox.module !== "undefined" || typeof sandbox.require !== "undefined") {\n'
                '  console.error("沙箱不干净：module/require 泄漏进来了，测的还是 node 分支");\n'
                '  process.exit(1);\n'
                '}\n'
                'const c = sandbox.CryptoAlgos && sandbox.CryptoAlgos.caesar;\n'
                'if (!c) { console.error("CryptoAlgos.caesar 未挂上 root"); process.exit(1); }\n'
                'const P = "The Quick Brown Fox! 123";\n'
                'for (let k = 0; k < 26; k++) {\n'
                '  if (c.decrypt(c.encrypt(P, k), k) !== P) {\n'
                '    console.error("往返失败 k=" + k); process.exit(1);\n'
                '  }\n'
                '}\n'
                'if (c.bruteForce("DWWDFN").length !== 26) {\n'
                '  console.error("bruteForce 不是 26 个候选"); process.exit(1);\n'
                '}\n'
                'if (c.encrypt("ATTACK AT DAWN", 3) !== "DWWDFN DW GDZQ") {\n'
                '  console.error("教科书向量对不上"); process.exit(1);\n'
                '}\n')
            # 脚本走 stdin（见 run_node 顶上的注释）。临时文件必须在 run_node
            # **之内**还活着，所以这一句留在 with 块里。
            proc = run_node(script)
        if proc.returncode != 0:
            print(f'ERROR: {path.name} 的内联 ALGOS 块求值失败\n'
                  f'{proc.stderr.strip()}', file=sys.stderr)
            rc = 1
        checked += 1
    if checked == 0:
        print('ERROR: 没有任何工具页含 caesar.js 的 ALGOS 块——这道门扫空了',
              file=sys.stderr)
        return 1
    if rc == 0:
        print(f'ALGOS 求值门：{checked} 个页面的内联算法在浏览器分支下可用')
    return rc


# 允许出现出站引用的文件与次数。除这两处外，整个子树必须是零。
# 数值是 1 而不是「随便几次」：两页都已经把这条路径收敛到唯一的 PARENT_HOME
# 常量上，多出来的一次就意味着有人绕过了那个常量。
OUTBOUND_ALLOW = {'app.html': 1, 'index.html': 1}


def outbound_ref_check() -> int:
    """整个 cryptography/ 子树的父目录引用普查。

    设计约束：把 cryptography/ 整个目录复制到任何别处，双击 app.html 仍然
    完整可用。这条约束的敌人不是某一次错误，而是**熵**——第 N 个工具随手写
    一条 ../outputs/foo.js，在别人搬走目录的那一刻才失效，而那时没有任何
    东西会报警。这道门把它变成提交前就会响的断言。

    只扫会被浏览器加载的文件（html / js / json）。两处排除：
      · scripts/ 下的 Python 不扫——它们是构建工具，不解析成 URL；而且这个
        文件自己就得写出那个字符串。
      · `*.test.js` 不扫——测试文件永远不会被内联进 html，也不随页面被浏览器
        加载，它们跨目录 require（`../_test.js`、`../core/_test.js`）是正常的。
    needle 拼出来而不是写成字面量，让这段代码即便被扫也不会自己踩雷。
    """
    needle = '..' + '/'
    rc = 0
    total = 0
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file():
            continue
        if path.suffix not in ('.html', '.js', '.json'):
            continue
        rel = path.relative_to(ROOT)
        if rel.parts[0] == 'scripts' or path.name.endswith('.test.js'):
            continue
        n = path.read_text(encoding='utf-8').count(needle)
        total += n
        allowed = OUTBOUND_ALLOW.get(str(rel), 0)
        if n != allowed:
            print(f'ERROR: {rel} 里的父目录引用有 {n} 处，允许 {allowed} 处。\n'
                  f'       cryptography/ 必须能被整体搬走后独立运行；除 app.html 与\n'
                  f'       index.html 各自的 PARENT_HOME 常量外，任何文件都不许指向\n'
                  f'       子项目之外。', file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'出站引用：全子树共 {total} 处，全部在 PARENT_HOME 上')
    return rc


# 依赖在前：这两个模块的浏览器分支都是 factory(root.CryptoCore)，
# crypto-core 必须已经跑过。顺序错了页面**加载时毫无征兆**。
INLINE_ORDER_AFTER_CORE = ('CRYPTANALYSIS', 'ALGOS')


def inline_order_check() -> int:
    """CRYPTO-CORE 的标记必须排在依赖它的模块之前。

    这道门守的是一个**静默**失败：caesar.js 与 cryptanalysis.js 的浏览器分支
    都写 factory(root.CryptoCore)。若 crypto-core.js 内联在它们之后，页面加载
    时什么都不会发生——C 捕获成 undefined，模块照常挂上 root，直到使用者敲
    第一个键才炸在 "Cannot read properties of undefined (reading 'mod')"。
    建这个子项目时在 vm 沙箱里复现过。

    标记顺序就是页面里的物理顺序（render() 是就地替换，不是按 SOURCES 的
    字典序拼接），所以调换两行标记即可造出这个洞，而语法门、内联门、算法门
    三道都看不见它——它们各自的前提都是「模块已经正确加载」。
    """
    rc = 0
    # 同样用 all_tool_pages()：骨架的标记顺序错了，会复制给它的每一个后代。
    for path in all_tool_pages():
        text = path.read_text(encoding='utf-8')
        core_at = text.find('/* >>> GENERATED:CRYPTO-CORE */')
        if core_at < 0:
            print(f'ERROR: {path.name} 没有 CRYPTO-CORE 标记区间——每个工具页都必须有',
                  file=sys.stderr)
            rc = 1
            continue
        for tag in INLINE_ORDER_AFTER_CORE:
            at = text.find(f'/* >>> GENERATED:{tag}')
            if at < 0:
                continue                   # 这一页不用这个模块，正常
            if at < core_at:
                print(f'ERROR: {path.name} 的 {tag} 标记排在 CRYPTO-CORE 之前。\n'
                      f'       该模块的浏览器分支是 factory(root.CryptoCore)，'
                      f'加载顺序错了不会报错，\n'
                      f'       只会在第一次调用时炸。把 CRYPTO-CORE 移到它前面。',
                      file=sys.stderr)
                rc = 1
    if rc == 0:
        print('内联顺序：CRYPTO-CORE 均排在依赖它的模块之前')
    return rc


# core/ 与 examples/ 的内容会被原样内联进 html 的 <script> 块里。这两个
# 字面量在那里是有毒的：
#   · 本仓到处在用的抽取配方 `awk '/<script>/{f=1;next}…'` 会**静默丢掉那一行**，
#     于是语法门检查的字节与浏览器真正执行的字节不是同一份；
#   · 更坏的一层（chess 的 js_string_literal() 注释里记着实测复现）：一个裸的
#     `<script` 配上任意位置的 `<!--`，会让 HTML 分词器进入 script-data-escaped
#     状态，把页面真正的 `</script>` 吃掉，整页从那里开始被当成脚本文本吞掉
#     （`document.scripts.length` 从 2 变成 1）。
# 从 chess 继承的 viz-engine.js 注释里原本就有一处字面的 `<script>`；今天没有
# `<!--` 所以只是良性的，但「今天恰好没有」不是不变量。改注释措辞即可消除，
# 这道门保证它不会被下一次上游同步带回来。
# 用拼接构造针，让这个文件自己不踩雷。
SCRIPT_NEEDLES = ('<' + 'script', '</' + 'script')


def script_literal_check() -> int:
    rc = 0
    for base in ('core', 'examples'):
        for path in sorted((ROOT / base).rglob('*.js')):
            text = path.read_text(encoding='utf-8')
            for needle in SCRIPT_NEEDLES:
                if needle in text:
                    n = text.count(needle)
                    print(f'ERROR: {path.relative_to(ROOT)} 里有 {n} 处 {needle!r} 字面量。\n'
                          f'       这些文件会被原样内联进 html 的脚本块：该字面量会让\n'
                          f'       awk 抽取配方静默丢行（语法门于是检查了另一份字节），\n'
                          f'       并且一旦同页出现 <' + '!-- 就会翻转 HTML 分词器状态、\n'
                          f'       把整页吞成脚本文本。改注释措辞即可。',
                          file=sys.stderr)
                    rc = 1
    if rc == 0:
        print('脚本字面量：core/ 与 examples/ 干净')
    return rc


# C0 控制字符里只有这三个在源码里是正常的。其余（尤其 NUL）一旦混进来，
# 各个工具对它的解释就不再一致，而**语法门恰恰是看不见它的那一个**。
CONTROL_OK = {'\t', '\n', '\r'}


def control_byte_check() -> int:
    """源码里不许出现 C0 控制字符（\\t \\n \\r 除外）。

    这道门是从一次真实的擦肩而过里来的：建换位密码那一页时，一个 NUL 字节
    混进了某个字符串字面量。**`node --check` 接受它**——NUL 在 JS 字符串里
    是合法字符——所以语法门（门 2）当场报绿；而本仓到处在用的 awk 抽取配方
    在 NUL 处把那一行截断，报出一个跟真实代码毫无关系的 SyntaxError，grep
    则直接把文件当二进制、静默不匹配。

    失败形状与门 10 守的 `<`+`script` 完全一样：**门检查的字节与浏览器真正
    执行的字节不是同一份**。门 10 只挡那一个特定子串，挡不住这一类。一个
    看不见的字节能让三样工具给出三种答案，而最权威的那一样（语法门）说没事。

    范围比门 10 宽：core/ 与 examples/ 会被内联，tools/ 是最终产物，
    三处都必须干净。
    """
    rc = 0
    scanned = 0
    for base, pattern in (('core', '*.js'), ('examples', '*.js'), ('tools', '*.html')):
        for path in sorted((ROOT / base).rglob(pattern)):
            scanned += 1
            text = path.read_text(encoding='utf-8')
            bad = {}
            for ch in text:
                if ch < ' ' and ch not in CONTROL_OK:
                    bad[ch] = bad.get(ch, 0) + 1
            if bad:
                detail = '、'.join(f'U+{ord(c):04X}×{n}' for c, n in sorted(bad.items()))
                line = text[:text.index(min(bad, key=lambda c: text.index(c)))].count('\n') + 1
                print(f'ERROR: {path.relative_to(ROOT)} 含 C0 控制字符（{detail}），'
                      f'首次出现在第 {line} 行。\n'
                      f'       node --check 看不见它（NUL 在 JS 字符串里合法），但 awk 抽取\n'
                      f'       配方会在那里截断、grep 会把文件当二进制——门检查的字节与浏览器\n'
                      f'       执行的字节于是不是同一份。用 JSON.stringify 或转义写法重写那个\n'
                      f'       字面量。', file=sys.stderr)
                rc = 1
    if rc == 0:
        print(f'控制字符：{scanned} 个文件干净')
    return rc


if __name__ == '__main__':
    # 十道门都要跑到底、都要报——**不能用 `or` 短路**。`a() or b() or c()`
    # 一旦 a() 非零就跳过后面的，意味着一份过期的内联副本（或任何语法错误）
    # 会让整个 core_tests() 门根本不执行，问题只报出第一个，最有分量的那道门
    # 被悄悄跳过了。chess 的同一处注释记着这个教训。
    rc = [
        inline_core.main(check_only=True),
        node_check(),
        core_tests(),
        registry_check(),
        fallback_check(),
        version_meta_check(),
        algos_gate(),
        outbound_ref_check(),
        inline_order_check(),
        script_literal_check(),
        control_byte_check(),
    ]
    sys.exit(1 if any(rc) else 0)
