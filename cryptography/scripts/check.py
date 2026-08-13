#!/usr/bin/env python3
"""cryptography 子项目校验门（设计文档 §5、§19）。

十七道门全部**无条件**跑到底，最后按「任一失败则整体失败」汇总退出码。

| # | 函数                              | 守什么 |
|---|-----------------------------------|--------|
| 1 | inline_core.main(check_only=True) | 内联副本与编辑源一致 |
| 2 | node_check()                      | 每个 html 每个 <script> 块语法（含 app/index 两个根级页） |
| 3 | core_tests()                      | core/**/*.test.js + examples/**/*.test.js 全绿 |
| 4 | registry_check()                  | id/file/accent/chapter/version/engine/双语/重复/双向存在 |
| 5 | fallback_check()                  | 两页 FALLBACK 的 id 集合 == 注册表 id 集合 |
| 5b| fallback_version_check()          | 两页 FALLBACK 每条都带 version 且与注册表同值（第 5 道只比 id 集合，抓不到） |
| 6 | version_meta_check()              | 注册表 version == html 的 tool-version meta |
| 7 | algos_gate()                      | 内联的 ALGOS 块在**浏览器分支**下能跑，且 Caesar 全 k 往返成立 |
| 8 | outbound_ref_check()              | `../` 只出现在 app/index 各一次，其余目录零次 |
| 9 | inline_order_check()              | CRYPTO-CORE 的标记必须排在 CRYPTANALYSIS / ALGOS / QUANTUM-SIM 之前 |
|10 | script_literal_check()            | core/ 与 examples/ 的 js 里不许出现 <script / </script 字面量 |
|11 | algos_dep_order_check()           | ALGOS 清单满足模块之间的加载顺序依赖 |
|12 | control_byte_check()              | core/ examples/ tools/ 里不许有 C0 控制字符 |
|13 | quantum_probability_check()       | 量子模块产出的每一个概率 ∈ [0,1]，成组的加到 1 |
|14 | quantum_norm_check()              | 长序列酉演化后 \\|α\\|²+\\|β\\|² 仍在 NORM_TOL 内 |
|15 | quantum_determinism_check()       | 量子测试跑两遍输出逐字节相同；源码里没有未拴住的随机源 |
|16 | quantum_bb84_check()              | 无 Eve QBER 恰为 0、拦截—重发 QBER ≈ 25%、筛选率 ≈ 50% |

13–16 是规范 §19 给量子工具额外列的四条。注意它们跑的是**裸 vm 沙箱**里的
浏览器分支：在第一个量子页面出现之前，没有任何 html 内联 QUANTUM-SIM，
所以第 7 道门那种"从页面里挖内联副本"的路子覆盖不到 quantum-sim.js。
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
# version 不是展示文案，是**缓存键**（?v=<version>），而 file:// 下 FALLBACK 是唯一的
# 数据源。所以另抓一遍 id → version 的配对，见 fallback_version_check()。
# 夹取到下一个 id: 为止，不靠「同一行」这种脆弱假设。与 chess 的同名两条同源。
FALLBACK_ENTRY_RE = re.compile(r"id:\s*'([\w-]+)'(.*?)(?=id:\s*'|\Z)", re.DOTALL)
FALLBACK_VERSION_RE = re.compile(r"version:\s*'([^']*)'")
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


def fallback_version_check() -> int:
    """两页 FALLBACK 的每一条都要带 version，且必须等于注册表里的那个。

    为什么这道门必须单独存在：**fallback_check() 只比 id 集合**，一条缺了 version 的
    条目在它眼里完全正常。而 version 同时是缓存键——app.html 的 srcFor() 与画廊卡片
    都把它拼进 URL（?v=<version>），卡片角上还要把它印出来。

    这不是假想。2026-08-11 写导航契约时实测发现：**两页 27×2 = 54 条 FALLBACK 条目，
    version 字段一个都没有**——尽管根 CLAUDE.md 和本子项目 index.html 自己的注释都
    白纸黑字写着「FALLBACK 必须带 version」「现在也带了」。线上 fetch 拿得到注册表，
    一切正常；file:// 下 TOOLS = FALLBACK，27 张卡片全部渲染成 v0、地址全部 ?v=0。
    规则被写下、被相信、并且是假的，整整持续到这道门出现为止。

    契约见 docs/superpowers/subproject-nav-contract.md 的 C2；chess 侧有一份同源实现。
    """
    reg_ver = {t['id']: t['version'] for t in load_registry()['tools']}
    rc = 0
    checked = 0
    for name in ('app.html', 'index.html'):
        text = (ROOT / name).read_text(encoding='utf-8')
        m = re.search(r'var FALLBACK = \[(.*?)\n\];', text, re.DOTALL)
        if not m:
            continue                     # 缺 FALLBACK 由 fallback_check 报，不重复报
        for tid, body in FALLBACK_ENTRY_RE.findall(m.group(1)):
            vm = FALLBACK_VERSION_RE.search(body)
            if not vm:
                print(f'ERROR: {name} 的 FALLBACK 条目 {tid} 没有 version 字段——'
                      f'file:// 下卡片会渲染成 v0、地址退化成 ?v=0', file=sys.stderr)
                rc = 1
                continue
            want = reg_ver.get(tid)
            if want is None:
                continue                 # id 对不上由 fallback_check 报
            if vm.group(1) != want:
                print(f'ERROR: {name} 的 FALLBACK 条目 {tid} 版本是 '
                      f'{vm.group(1)!r}，注册表是 {want!r}', file=sys.stderr)
                rc = 1
                continue
            checked += 1
    if rc == 0:
        print(f'FALLBACK 版本戳：{checked} 条内嵌条目全部带 version 且与注册表同值')
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
    """把每个页面**它自己内联的那份** ALGOS 块放进裸 vm 里跑，确认浏览器分支真的可用。

    inline_core --check 只保证"内联副本与源文件字节相同"。它答不了另一个问题：
    这段代码在浏览器那个没有 module/require 的环境里跑起来会怎样。UMD 的两条
    分支只有 node 那条被单元测试覆盖，这道门跑的是另一条。

    ⚠ **这道门原来只看含 caesar.js 的页面**（`if 'caesar.js' not in names: continue`），
    却打印"N 个页面"，听上去像覆盖了全部。建 polybius 的实现者报上来时，八个工具
    页里只有两个真被检查过，另外六个一行都没跑——而门的输出看不出这件事。
    这正是本项目反复遇到的那类失败：**一道宣称了自己并不具备的覆盖的门**，
    比没有门更坏。现在改成页面无关：清单里列了几份就验几份。

    分两层，报告里分别计数，不把浅的说成深的：
      · 每一页：清单里的每个模块都必须挂上 root.CryptoAlgos.<basename>，
        且至少暴露一个函数。这能抓住"清单写了但没内联"、"UMD 浏览器分支写错"、
        "文件名与挂载名不一致"。
      · 含 caesar.js 的页面：额外跑教科书向量与全 k 往返的性质断言。

    已知残余缺口（写在这里而不是假装不存在）：模块之间的依赖走
    root.CryptoAlgos.X（polybius 依赖 transposition），清单顺序写反时被依赖方
    会捕获 undefined——模块**仍然挂得上**，要到第一次调用才炸。本门抓不到这一类；
    真要抓得给每份算法配一个冒烟调用。
    """
    rc = 0
    deep = 0
    shallow = 0
    core = (ROOT / 'core' / 'crypto-core.js').read_text(encoding='utf-8')
    for path in all_tool_pages():
        text = path.read_text(encoding='utf-8')
        m = ALGOS_BLOCK_RE.search(text)
        if not m:
            continue
        names = [n.strip() for n in m.group(1).strip().split(',') if n.strip()]
        if not names or names == ['none']:
            continue
        keys = [n[:-3] if n.endswith('.js') else n for n in names]
        with tempfile.TemporaryDirectory() as td:
            core_f = pathlib.Path(td) / 'core.js'
            algos_f = pathlib.Path(td) / 'algos.js'
            core_f.write_text(core, encoding='utf-8')
            algos_f.write_text(m.group(2), encoding='utf-8')
            script = (
                'const vm = require("vm"), fs = require("fs");\n'
                'const sandbox = {}; sandbox.self = sandbox; sandbox.console = console;\n'
                'vm.createContext(sandbox);\n'
                f'vm.runInContext(fs.readFileSync({json.dumps(str(core_f))}, "utf8"), sandbox);\n'
                f'vm.runInContext(fs.readFileSync({json.dumps(str(algos_f))}, "utf8"), sandbox);\n'
                'if (typeof sandbox.module !== "undefined" || typeof sandbox.require !== "undefined") {\n'
                '  console.error("沙箱不干净：module/require 泄漏进来了，测的还是 node 分支");\n'
                '  process.exit(1);\n'
                '}\n'
                f'const want = {json.dumps(keys)};\n'
                'const A = sandbox.CryptoAlgos || {};\n'
                'for (const k of want) {\n'
                '  const mod = A[k];\n'
                '  if (!mod || typeof mod !== "object") {\n'
                '    console.error("CryptoAlgos." + k + " 未挂上 root（清单里列了它）");\n'
                '    process.exit(1);\n'
                '  }\n'
                '  if (!Object.keys(mod).some(n => typeof mod[n] === "function")) {\n'
                '    console.error("CryptoAlgos." + k + " 挂上了但一个函数都没有");\n'
                '    process.exit(1);\n'
                '  }\n'
                '}\n')
            if 'caesar.js' in names:
                script += (
                    'const c = A.caesar;\n'
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
            proc = run_node(script)
        if proc.returncode != 0:
            print(f'ERROR: {path.name} 的内联 ALGOS 块求值失败\n'
                  f'{proc.stderr.strip()}', file=sys.stderr)
            rc = 1
        if 'caesar.js' in names:
            deep += 1
        else:
            shallow += 1
    if deep + shallow == 0:
        print('ERROR: 没有任何工具页含 ALGOS 块——这道门扫空了', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'ALGOS 求值门：{deep + shallow} 个页面的内联算法在浏览器分支下可用'
              f'（其中 {deep} 个另跑了 caesar 性质断言）')
    return rc


# 模块间依赖：浏览器分支里 root.CryptoAlgos.X = factory(..., root.CryptoAlgos.Y)
# 表示 X 依赖 Y，因此 Y 必须在同一页的 ALGOS 清单里排得更靠前。
ALGOS_ASSIGN_RE = re.compile(r'root\.CryptoAlgos(?:\.(\w+)|\[[\'"]([\w-]+)[\'"]\])\s*=\s*factory\(([^;]*)\);')
ALGOS_DEP_RE = re.compile(r'root\.CryptoAlgos(?:\.(\w+)|\[[\'"]([\w-]+)[\'"]\])')


def _algo_deps() -> dict:
    """算法文件名 -> 它在浏览器分支里捕获的其它算法（文件名）。"""
    key_to_file, deps_by_key = {}, {}
    for src in sorted((ROOT / 'core' / 'algos').glob('*.js')):
        if src.name.endswith('.test.js'):
            continue
        text = src.read_text(encoding='utf-8')
        for m in ALGOS_ASSIGN_RE.finditer(text):
            key = m.group(1) or m.group(2)
            key_to_file[key] = src.name
            deps = set()
            for d in ALGOS_DEP_RE.finditer(m.group(3)):
                deps.add(d.group(1) or d.group(2))
            deps_by_key.setdefault(src.name, set()).update(deps)
    return key_to_file, deps_by_key


def algos_dep_order_check() -> int:
    """ALGOS 清单必须满足模块间的加载顺序依赖。

    这道门补的是 algos_gate() docstring 里点名的那个缺口，而那个缺口在补它的
    当天被撞了**两次**：fractionation 的清单我写成 `fractionation.js,polybius.js`
    （真链是 transposition → polybius → fractionation，三层），quagmire 的写成
    `quagmire.js,vigenere.js,substitution.js`（quagmire 加载时捕获 substitution）。
    两次都是实现者靠推理挡下的，门一声不吭——因为顺序写反时被依赖方捕获的是
    undefined，**模块仍然挂得上**，algos_gate 的「挂上了且有函数」因此照样通过，
    要到使用者第一次交互才炸。

    静态可判定，不需要冒烟调用：依赖边就写在每个模块的 UMD 头里。
    """
    key_to_file, deps_by_file = _algo_deps()
    rc = 0
    checked = 0
    for path in all_tool_pages():
        m = ALGOS_BLOCK_RE.search(path.read_text(encoding='utf-8'))
        if not m:
            continue
        names = [n.strip() for n in m.group(1).strip().split(',') if n.strip()]
        if not names or names == ['none']:
            continue
        checked += 1
        pos = {n: i for i, n in enumerate(names)}
        for fname in names:
            for depkey in sorted(deps_by_file.get(fname, ())):
                depfile = key_to_file.get(depkey)
                if depfile is None:
                    print(f'ERROR: {path.name} 的 {fname} 依赖 CryptoAlgos.{depkey}，'
                          f'但 core/algos/ 下没有任何模块挂这个键', file=sys.stderr)
                    rc = 1
                    continue
                if depfile not in pos:
                    print(f'ERROR: {path.name} 的 ALGOS 清单有 {fname}，但缺它依赖的 '
                          f'{depfile}——页面加载时 CryptoAlgos.{depkey} 是 undefined，'
                          f'一调用就炸', file=sys.stderr)
                    rc = 1
                elif pos[depfile] > pos[fname]:
                    print(f'ERROR: {path.name} 的 ALGOS 清单顺序不对：{fname} 在加载时捕获 '
                          f'CryptoAlgos.{depkey}，所以 {depfile} 必须排在它前面。\n'
                          f'       现在的清单：{",".join(names)}\n'
                          f'       顺序写反不会报错——模块照样挂得上，捕获到的是 undefined，'
                          f'要到第一次交互才炸。', file=sys.stderr)
                    rc = 1
    if rc == 0:
        print(f'ALGOS 依赖顺序：{checked} 个页面的清单满足模块加载顺序')
    return rc

# 允许出现出站引用的文件与次数。除这两处外，整个子树必须是零。
# 数值是精确值而不是「随便几次」：多出来的一次就意味着有人绕过了既有的常量。
#
# 2 = PARENT_HOME 常量 + cookie 同意横幅里指向根目录 privacy.html 的链接
# （GENERATED:ANALYTICS 区间，由 scripts/apply_footer.py 写入）。
#
# 从 1 提到 2 是有代价的，写清楚免得后人以为可以随手再提：这条额度削弱的正是本门
# 守着的那个约束——「把子项目整个目录搬走后仍完整可用」。PARENT_HOME 用「父级不
# 存在就自己隐藏」化解了它；隐私说明链接目前没有这层兜底，搬走后会 404。之所以
# 仍然接受，是因为 ICO 要求同意横幅必须能点到一份说明，而把 privacy.html 在三个
# 子站各复制一份是更糟的选择（同一份法律文本三个副本，正是本仓反复吃亏的漂移形态）。
OUTBOUND_ALLOW = {'app.html': 2, 'index.html': 2}


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
        print(f'出站引用：全子树共 {total} 处，全部在白名单内（PARENT_HOME 与同意横幅的隐私链接）')
    return rc


# 依赖在前：这三个模块的浏览器分支都是 factory(root.CryptoCore)，
# crypto-core 必须已经跑过。顺序错了页面**加载时毫无征兆**。
#
# QUANTUM-SIM 是第 5 章加进来的第三条边，形状与前两条一模一样：它在
# keyHex() 里用 CryptoCore 的 fromBits / toHex，而那个捕获发生在**加载时**。
# quantum-sim.test.js 末尾有一段在裸 vm 里复现这个洞的断言——没有 CryptoCore
# 时 QuantumSim 照样挂得上、概率计算照常返回正确答案，要到第一次调用 keyHex
# 才炸。加载时毫无征兆，正是这道门存在的理由。
INLINE_ORDER_AFTER_CORE = ('CRYPTANALYSIS', 'ALGOS', 'QUANTUM-SIM')


def inline_order_check() -> int:
    """CRYPTO-CORE 的标记必须排在依赖它的模块之前。

    这道门守的是一个**静默**失败：caesar.js、cryptanalysis.js 与 quantum-sim.js
    的浏览器分支都写 factory(root.CryptoCore)。若 crypto-core.js 内联在它们之后，
    页面加载时什么都不会发生——C 捕获成 undefined，模块照常挂上 root，直到使用者敲
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


# ================= 第 5 章：量子模拟器的四道门（规范 §19）=================
#
# 规范给量子工具额外列了四条：概率落在 [0,1]、态归一化、确定性种子测试、
# BB84 的统计行为。它们在这里比在别处更要紧，原因是一件容易被忽略的事：
# **今天没有任何工具页内联 QUANTUM-SIM**（骨架有意不带这对标记，见
# inline_core.py 的注释），所以 algos_gate 那种"从页面里挖出内联副本再求值"
# 的做法一行都覆盖不到它。在第一个量子页面出现之前，这四道门是
# core/quantum-sim.js **浏览器分支的唯一覆盖**——沙箱因此必须是裸的，
# 而不是图省事直接 require()。
#
# 四道门共用一个裸 vm 沙箱：只有 self 与 console，没有 module、没有 require。
# `node -e` 与 node 从 stdin 读脚本**都会**定义 module 与 require，那样跑到的
# 是 UMD 的 node 分支——一道测错分支的门，比没有门更坏，因为它宣称了自己
# 并不具备的覆盖。外层脚本仍然走 node 分支（它要 require vm 与 fs），
# 裸的是内层沙箱，脚本自己会断言这一点。

# 门 15 用的种子。写死而不是随取，是因为这道门的每个数字都要可复现；
# 用三个而不是一个，是为了让"恰好这个种子对"与"性质成立"分得开。
QUANTUM_SEEDS = (20260810, 7, 991)
# 统计门的容差 = K_SIGMA × √(p(1−p)/m)，m 是**当次真实的样本量**。
# 写成样本量的函数而不是一个魔数：魔数在 n 变大时会莫名其妙地变松，在 n 变小
# 时会变成随机变红。K 取 6 是量出来的——200 个种子、n=4000 的普查里最大偏差
# 是 4.05σ，6σ 留了足够的余量让换种子不至于变红；而真正的错误（Eve 不塌缩 →
# QBER 0、不做基对账 → 筛选率 1）在 n=20000 上都在 50σ 以上，6σ 完全拦得住。
K_SIGMA = 6


def _quantum_script(body: str) -> str:
    """把 crypto-core.js 与 quantum-sim.js 装进裸 vm 沙箱，再跑 body。

    两个文件按**依赖顺序**求值（core 在前）——这既是页面里必须成立的顺序，
    也让这段脚本本身成为 inline_order_check 那条规则的一个活样例。
    """
    core = ROOT / 'core' / 'crypto-core.js'
    qsim = ROOT / 'core' / 'quantum-sim.js'
    return (
        'const vm = require("vm"), fs = require("fs");\n'
        'const sandbox = {}; sandbox.self = sandbox; sandbox.console = console;\n'
        'vm.createContext(sandbox);\n'
        f'vm.runInContext(fs.readFileSync({json.dumps(str(core))}, "utf8"), sandbox);\n'
        f'vm.runInContext(fs.readFileSync({json.dumps(str(qsim))}, "utf8"), sandbox);\n'
        'if (typeof sandbox.module !== "undefined" || typeof sandbox.require !== "undefined") {\n'
        '  console.error("沙箱不干净：module/require 泄漏进来了，测的还是 node 分支");\n'
        '  process.exit(1);\n'
        '}\n'
        'const Q = sandbox.QuantumSim;\n'
        'if (!Q) { console.error("QuantumSim 没有挂到 root——浏览器分支坏了"); process.exit(1); }\n'
        'function fail(msg) { console.error(msg); process.exit(1); }\n'
        + body)


def _report_node(name: str, proc) -> int:
    if proc.returncode != 0:
        print(f'ERROR: {name}\n{(proc.stderr or "").strip()}', file=sys.stderr)
        return 1
    out = (proc.stdout or '').strip()
    if out:
        print(out)
    return 0


def quantum_probability_check() -> int:
    """本模块能产出的**每一个**概率都必须落在 [0,1]，成组的还要加到 1。

    覆盖的产出点逐个列出来，免得下次加了新出口没人想起要扫它：
      probabilities / probabilityOf / malus / jointProbabilities /
      measure().p / measurePair().p / bb84Run().siftRate / qber.rate /
      每个光子里 Eve 那次测量的 p。

    最后要求 checked > 0：一个循环体一次都没转的门会安安静静地报绿，
    本仓真发出过这样的探针。
    """
    body = r'''
let checked = 0;
function p01(v, what) {
  if (typeof v !== 'number' || !isFinite(v)) fail(what + ' 不是有限数：' + v);
  if (v < 0 || v > 1) fail(what + ' 落在 [0,1] 之外：' + v);
  checked++;
}
function sum1(arr, what) {
  let s = 0; for (const x of arr) s += x;
  if (Math.abs(s - 1) > Q.NORM_TOL) fail(what + ' 的概率和不是 1：' + s);
}

// 1) probabilities / probabilityOf：Bloch 球上的网格 × 三个基
const states = [];
for (let ti = 0; ti <= 12; ti++) {
  for (let pi = 0; pi < 12; pi++) {
    states.push(Q.fromBloch(ti * Math.PI / 12, pi * Math.PI / 6));
  }
}
for (const s of states) {
  for (const id of Object.keys(Q.BASES)) {
    const pr = Q.probabilities(s, id);
    p01(pr[0], 'probabilities(' + id + ')[0]');
    p01(pr[1], 'probabilities(' + id + ')[1]');
    sum1(pr, 'probabilities(' + id + ')');
  }
  for (const t of states) p01(Q.probabilityOf(s, t), 'probabilityOf');
}

// 2) malus：整周角，含钝角——cos 在那里是负的，忘了平方就会在这里露馅
for (let d = -360; d <= 360; d += 3) p01(Q.malus(d), 'malus(' + d + ')');

// 3) jointProbabilities：四个贝尔态 × 角度网格
for (const id of Object.keys(Q.BELL)) {
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      const jp = Q.jointProbabilities(Q.bellState(id), i * Math.PI / 4, j * Math.PI / 4);
      jp.forEach((x, k) => p01(x, 'jointProbabilities(' + id + ')[' + k + ']'));
      sum1(jp, 'jointProbabilities(' + id + ')');
    }
  }
}

// 4) 测量返回的 p
const r = Q.rng32(20260810);
for (let i = 0; i < 3000; i++) {
  const s = states[i % states.length];
  p01(Q.measure(s, 'rect', r).p, 'measure().p');
  p01(Q.measure(s, 'diag', r).p, 'measure().p');
  p01(Q.measure(s, 'circ', r).p, 'measure().p');
  const mp = Q.measurePair(Q.BELL['psi-'], i * 0.01, i * 0.017, r);
  p01(mp.p, 'measurePair().p');
  sum1(mp.probabilities, 'measurePair().probabilities');
}

// 5) 协议层：筛选率、QBER、Eve 每一次测量的 p
for (const eve of [false, true]) {
  const run = Q.bb84Run({ n: 4000, rng: Q.rng32(991), eve: eve });
  p01(run.siftRate, 'bb84Run().siftRate');
  p01(run.qber.rate, 'bb84Run().qber.rate');
  for (const ph of run.photons) if (ph.eve) p01(ph.eve.p, '光子记录里 Eve 那次测量的 p');
}
// 空比对返回 null 而不是 0：没有证据不等于没有错误。null 不该被当成概率检查。
if (Q.qberOf([], []).rate !== null) fail('qberOf([],[]) 的 rate 应该是 null');

if (checked === 0) fail('一个概率都没检查到——这道门扫空了');
console.log('量子概率门：' + checked.toLocaleString('en-US') + ' 个概率全部落在 [0,1]，成组的都加到 1');
'''
    return _report_node('量子概率门失败', run_node(_quantum_script(body)))


def quantum_norm_check() -> int:
    """|α|²+|β|² = 1，在 QuantumSim.NORM_TOL 的容差内。

    **必须在一段序列之后测，不能只测一次。** 单次施加酉门的误差在 1e-16
    量级，任何容差都过得去；只有连着施加成千上万次，浮点误差才积到能说明
    问题的量级（实测 20000 步 4.8e-13、200000 步 4.8e-12，大致按 √步数 走）。
    容差 1e-9 因此有五到六个数量级的余量，而真实的错误（H 门的 1/√2 写成
    0.707 一步就把模长打到 0.99970）比它大五个数量级以上——两边都够远。

    容差从模块自己的 NORM_TOL 读，不在这里另写一个常数：两处各写各的时，
    改了一处而忘了另一处不会有任何东西报警。

    防真空的那一条比看上去难写，这里记下踩过的那一脚。最初写的是
    `worst > 0`——想法是"如果 applyGate 哪天偷偷重新归一化，偏差会恒为 0，
    这道门就只是在比较 1 和 1"。**负控证明这条守卫不成立**：把 applyGate 换成
    unitQubit(...) 之后，偏差不是 0 而是 6.661e-16（除以 √模长本身还剩一个
    ulp），门照样报绿，还印出"余量 1501200×"这种听着很安全的话。
    真正区分得开的是**增长**：真实的累积是随机游走，20000 步的最大偏差比
    100 步大两个数量级（实测 4.0e-15 → 4.8e-13，约 120 倍）；而被重新归一化过的
    序列不管跑多长都停在一个 ulp 上，比值约等于 1。所以这道门要求长序列的偏差
    至少是短前缀的 GROWTH_MIN 倍——这才是"我确实在观测累积"的证据。
    """
    body = r'''
const SEQ = [Q.GATES.H, Q.GATES.X, Q.GATES.Y, Q.GATES.Z, Q.GATES.S, Q.GATES.T,
             Q.rx(0.7), Q.ry(1.3), Q.rz(2.1), Q.rx(-0.37), Q.ry(-2.9), Q.rz(0.11)];
for (const k of Object.keys(Q.GATES)) {
  if (!Q.isUnitary(Q.GATES[k])) fail('GATES.' + k + ' 不是酉矩阵');
}
// SHORT 是"短前缀"，LONG 是整条序列；两者的最大偏差之比就是增长证据。
const SHORT = 100, LONG = 20000, GROWTH_MIN = 8;
let worst = 0, steps = 0, worstAt = '';
let seqShort = 0, seqLong = 0;
function note(dev, where) {
  if (!isFinite(dev)) fail(where + ' 的模方不是有限数');
  if (dev > worst) { worst = dev; worstAt = where; }
}
for (const seed of [20260810, 7, 991]) {
  for (const start of [Q.KET.zero, Q.KET.plus, Q.KET.right]) {
    const r = Q.rng32(seed);
    let s = start;
    for (let i = 0; i < LONG; i++) {
      s = Q.applyGate(s, Q.randomChoice(r, SEQ));
      steps++;
      const dev = Math.abs(Q.norm2(s) - 1);
      note(dev, '种子 ' + seed + ' 第 ' + i + ' 步');
      if (dev > seqLong) seqLong = dev;
      if (i < SHORT && dev > seqShort) seqShort = dev;
      // 纯态必然落在 Bloch 球面上；半径是同一条守恒律的另一张脸。
      if (dev <= Q.NORM_TOL) {
        note(Math.abs(Q.blochRadius(s) - 1), '种子 ' + seed + ' 第 ' + i + ' 步的 Bloch 半径');
      }
    }
  }
}
// 塌缩后的态、fromBloch 造出来的态、双比特态也一并查——归一化不是只有门会破坏它。
const r2 = Q.rng32(20260810);
for (let i = 0; i < 4000; i++) {
  const st = Q.fromBloch(Math.PI * (i % 97) / 96, Math.PI * (i % 53) / 26);
  note(Math.abs(Q.norm2(st) - 1), 'fromBloch');
  const m = Q.measure(st, ['rect', 'diag', 'circ'][i % 3], r2);
  note(Math.abs(Q.norm2(m.state) - 1), '塌缩后的态');
  steps += 2;
}
for (const id of Object.keys(Q.BELL)) {
  let s = 0;
  for (const c of Q.BELL[id]) s += Q.cAbs2(c);
  note(Math.abs(s - 1), '贝尔态 ' + id);
  steps++;
}
if (steps === 0) fail('一步都没跑——这道门扫空了');
if (!(seqLong > 0)) fail('整条序列的最大偏差恰好是 0——这道门在比较 1 和 1');
// 防真空：偏差必须随序列变长而增大。停在一个 ulp 上说明有人在 applyGate 里
// 重新归一化了，那时这道门测的是"我什么都没测"（见 docstring 里的负控记录）。
const growth = seqShort > 0 ? seqLong / seqShort : Infinity;
if (growth < GROWTH_MIN) {
  fail('偏差没有随序列长度增长：前 ' + SHORT + ' 步 ' + seqShort.toExponential(3) +
       '，' + LONG + ' 步 ' + seqLong.toExponential(3) + '（仅 ' + growth.toFixed(1) +
       '×，至少要 ' + GROWTH_MIN + '×）。applyGate 是不是偷偷重新归一化了？' +
       '那样的话这道门观测不到任何累积，报出来的绿是空的。');
}
if (worst > Q.NORM_TOL) {
  fail('归一化偏差 ' + worst.toExponential(3) + ' 超过容差 ' + Q.NORM_TOL +
       '（' + worstAt + '）');
}
console.log('量子归一化门：' + steps.toLocaleString('en-US') + ' 步后最大偏差 ' +
            worst.toExponential(3) + '，容差 ' + Q.NORM_TOL +
            '（余量 ' + Math.round(Q.NORM_TOL / worst) + '×）；' +
            '累积可观测：前 ' + SHORT + ' 步 ' + seqShort.toExponential(3) +
            ' → ' + LONG + ' 步 ' + seqLong.toExponential(3) +
            '（' + growth.toFixed(0) + '×）');
'''
    return _report_node('量子归一化门失败', run_node(_quantum_script(body)))


# 未拴住的随机源。**只匹配调用形态**（名字后面跟一个左括号），不匹配裸名字。
#
# 这条区分是必须的，而且是被自己绊了一跤才写下来的：本模块与它的测试里到处
# 在注释与报错文案里写"本模块内不使用 Math.random"——一条裸的子串规则会把
# 这些**在讲不要用它**的句子判成违规。那样的门只有两个结局：被绕过，或者
# 被删掉。要在注释里提它，写成不带括号的名字即可。
#
# 已知残余缺口，写出来而不是假装不存在：`const f = Math.random; f();` 这样绕开
# 调用形态的写法这条正则抓不到。抓它的是本门的另一半——把测试跑两遍比对字节。
# 文本扫描的职责是"在引入的那一刻指出是哪一行"，双跑的职责才是"证明确定性"。
NONDETERMINISM_RE = re.compile(
    r'(?:Math\.random|Date\.now|new\s+Date|performance\.now|process\.hrtime'
    r'|getRandomValues)\s*\(')


def quantum_determinism_check() -> int:
    """量子测试必须是确定性的：跑两遍，输出逐字节相同。

    为什么以**行为**为准而不是只 grep：grep 'Math.random' 抓不到 Date.now()、
    抓不到 Set / Map 的遍历顺序、抓不到一次没上种子的洗牌，也抓不到"输出里
    印了一个耗时"。跑两遍比对字节能一次抓住全部——这是唯一真正证明了
    确定性的做法。文本扫描仍然保留，因为它能在**引入的那一刻**指出是哪一行，
    而双跑只会告诉你"两次不一样"。两者一起才既抓得住又指得出。

    两条防真空的守卫：输出必须非空（两份空输出当然逐字节相同），
    测试文件必须存在。
    """
    rc = 0
    test = ROOT / 'core' / 'quantum-sim.test.js'
    if not test.exists():
        print(f'ERROR: 找不到 {test.relative_to(ROOT)}——这道门本该跑它', file=sys.stderr)
        return 1

    for name in ('quantum-sim.js', 'quantum-sim.test.js'):
        path = ROOT / 'core' / name
        text = path.read_text(encoding='utf-8')
        for m in NONDETERMINISM_RE.finditer(text):
            line = text[:m.start()].count('\n') + 1
            print(f'ERROR: {path.relative_to(ROOT)} 第 {line} 行调用了 '
                  f'{m.group(0).strip()!r}。\n'
                  f'       量子模块的随机性必须全部来自显式种子——一个只在某些\n'
                  f'       运行里变红的测量测试，比没有测试更糟。用注入的 rng '
                  f'或 rng32(seed)。', file=sys.stderr)
            rc = 1

    runs = []
    for _ in range(2):
        proc = subprocess.run(['node', str(test)], capture_output=True, text=True)
        if proc.returncode != 0:
            print(f'ERROR: {test.name} 未通过\n{proc.stderr.strip()}', file=sys.stderr)
            return 1
        runs.append(proc.stdout + proc.stderr)
    if not runs[0].strip():
        print(f'ERROR: {test.name} 什么都没输出——两份空输出当然逐字节相同，'
              f'这道门会因此报出一个没有内容的绿', file=sys.stderr)
        return 1
    if runs[0] != runs[1]:
        print('ERROR: 量子测试跑两遍的输出不一致——有随机性没被种子拴住。\n'
              f'       第一遍：{runs[0].strip()[:200]}\n'
              f'       第二遍：{runs[1].strip()[:200]}', file=sys.stderr)
        rc = 1
    if rc == 0:
        print(f'量子确定性门：{test.name} 跑两遍输出逐字节相同'
              f'（{len(runs[0])} 字节），源码里没有未拴住的随机源')
    return rc


def quantum_bb84_check() -> int:
    """BB84 的三个统计数字必须对得上教科书。

      · 无 Eve：筛后密钥逐位相同，QBER **恰好** 0（不是"约等于"）。
      · 有 Eve（拦截—重发）：QBER 期望 25% —— Eve 有 1/2 的机会选对基（此时
        无害），另 1/2 里 Bob 的结果完全随机、其中一半出错，0.5 × 0.5 = 0.25。
      · 基对账保留约 50% 的光子（双方各自独立地在两个基里等概率选）。

    每一个"零"都配了负控，否则它证明不了任何事：QBER = 0 那一条后面紧跟着
    "不做基对账时错误率跳到 25%"——若模拟器根本不会出错，后一条会当场变红。

    容差 = K_SIGMA × √(p(1−p)/m)，m 取当次真实的样本量（QBER 用筛后长度，
    筛选率用 n），不是魔数。
    """
    body = r'''
const N = 20000;
const SEEDS = __SEEDS__;
const K = __K__;
const lines = [];
for (const seed of SEEDS) {
  const clean = Q.bb84Run({ n: N, rng: Q.rng32(seed), eve: false });
  const spied = Q.bb84Run({ n: N, rng: Q.rng32(seed), eve: true });

  // 防真空：一个空的筛后密钥也能让 "errors === 0" 报绿。
  if (!(clean.qber.compared > N / 4)) {
    fail('种子 ' + seed + ' 的筛后密钥只有 ' + clean.qber.compared + ' 位，太少，' +
         '后面的断言会退化成真空');
  }
  if (clean.qber.rate !== 0 || clean.qber.errors !== 0) {
    fail('种子 ' + seed + '：无 Eve 时 QBER 必须恰好为 0，实际 ' + clean.qber.rate +
         '（' + clean.qber.errors + '/' + clean.qber.compared + '）');
  }
  // 上面那个 0 的负控：不做基对账时错误率必须跳到 25%。若这一条不成立，
  // "QBER = 0" 就只说明这个模拟器根本不会出错，什么也没证明。
  let raw = 0;
  for (const p of clean.photons) if (p.bobBit !== p.aliceBit) raw++;
  const rawRate = raw / N;
  const rawTol = K * Math.sqrt(0.25 * 0.75 / N);
  if (Math.abs(rawRate - 0.25) > rawTol) {
    fail('种子 ' + seed + '：不筛选时的错误率是 ' + rawRate.toFixed(5) +
         '，期望 0.25 ± ' + rawTol.toFixed(5) +
         '——那个 "QBER = 0" 于是不是基对账带来的');
  }

  const qTol = K * Math.sqrt(0.25 * 0.75 / spied.qber.compared);
  if (Math.abs(spied.qber.rate - 0.25) > qTol) {
    fail('种子 ' + seed + '：拦截—重发的 QBER 是 ' + spied.qber.rate.toFixed(5) +
         '，期望 0.25 ± ' + qTol.toFixed(5) + '（' + K + 'σ，样本量 ' +
         spied.qber.compared + '）');
  }
  const sTol = K * Math.sqrt(0.25 / N);
  if (Math.abs(clean.siftRate - 0.5) > sTol) {
    fail('种子 ' + seed + '：筛选率是 ' + clean.siftRate.toFixed(5) +
         '，期望 0.5 ± ' + sTol.toFixed(5) + '（' + K + 'σ，样本量 ' + N + '）');
  }
  if (spied.siftRate !== clean.siftRate) {
    fail('种子 ' + seed + '：Eve 不该改变筛选率，' + clean.siftRate + ' -> ' + spied.siftRate);
  }
  // 开关 Eve 只改变一件事：同种子下 Alice 比特与双方基必须逐位不变。
  // 这条性质是 DRAWS_PER_PHOTON 恒为 6 的理由，破了它页面就分不清多出来的
  // 错误是 Eve 造成的还是换了一批光子造成的。
  for (let i = 0; i < N; i++) {
    const a = clean.photons[i], b = spied.photons[i];
    if (a.aliceBit !== b.aliceBit || a.aliceBasis !== b.aliceBasis ||
        a.bobBasis !== b.bobBasis) {
      fail('种子 ' + seed + ' 第 ' + i + ' 个光子：开关 Eve 后光子链错位了');
    }
  }
  lines.push('  种子 ' + seed + '：筛选率 ' + clean.siftRate.toFixed(5) +
             '（筛后 ' + clean.qber.compared + ' 位）· 无 Eve QBER ' + clean.qber.rate +
             ' · 有 Eve QBER ' + spied.qber.rate.toFixed(5) +
             ' · 不筛选时 ' + rawRate.toFixed(5));
}
console.log('BB84 统计门：' + SEEDS.length + ' 个种子 × n=' + N +
            '，无 Eve QBER 恰为 0、拦截—重发 QBER ≈ 0.25、筛选率 ≈ 0.5（容差 ' +
            K + 'σ，随样本量计算）');
lines.forEach(l => console.log(l));
'''
    # 用占位符替换而不是 % 或 .format()：这段 JS 里到处是百分号（"25%"、"50%"），
    # 走 % 格式化会当场炸在一个跟内容毫无关系的 "not enough arguments"，
    # 走 .format() 则要把每一对花括号都转义——而 JS 全是花括号。
    body = (body.replace('__SEEDS__', json.dumps(list(QUANTUM_SEEDS)))
                .replace('__K__', str(K_SIGMA)))
    return _report_node('BB84 统计门失败', run_node(_quantum_script(body)))


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
        fallback_version_check(),
        version_meta_check(),
        algos_gate(),
        outbound_ref_check(),
        inline_order_check(),
        script_literal_check(),
        algos_dep_order_check(),
        control_byte_check(),
        quantum_probability_check(),
        quantum_norm_check(),
        quantum_determinism_check(),
        quantum_bb84_check(),
    ]
    sys.exit(1 if any(rc) else 0)
