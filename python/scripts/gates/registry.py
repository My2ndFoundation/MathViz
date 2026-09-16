"""A 组 · 注册表与两个导航页。

这一组守的是「同一份事实被抄在几个地方」这一类的漂移。本仓的历史记录给了三条
不用再论证的结论：

  · 主站 62 条工具里 **48 条**的 version 与 tools.json 悄悄分了家，因为当年的
    检查忽略这两个字段（根 CLAUDE.md「Registry sync is automated」）。
  · cryptography 两页 **54 条** FALLBACK 一条都没有 version，而根 CLAUDE.md 与
    那一页自己的注释都白纸黑字写着「FALLBACK 现在也带 version」——规则被写下、
    被相信、并且是假的，一直到 `fallback_version_check()` 出现为止。
  · chess 的 `?v=` 缓存键整整少了一季，六次升级可能一直躲在 GitHub Pages 的旧
    副本后面（PR #158）。

所以这一组的每一道门都只问一件事：**两份字节是不是真的一样**——期望值来自磁盘上
的另一份数据，不是来自我写下的常量。例外是 MODULES / ACCENTS / MODULE_ACCENTS /
FALLBACK_FIELDS 这几个闭集：它们不是我编的期望值，本身就是规格——MODULES 与
ACCENTS 是主规格 §6.1 的模块数与两页共用的 accent 白名单，MODULE_ACCENTS 是同一节
定死的模块配色表，FALLBACK_FIELDS 是第 1 期设计 D5 规定的两页 FALLBACK 各自的字段
集。规格变了就改常量本身，而不是拿磁盘上的另一份数据去核对规格。
"""
from __future__ import annotations

import json
import re
import sys

from . import (ACCENTS, BILINGUAL_FIELDS, ENGINE_PREFIX,
               META_VERSION_RE, MODULE_ACCENTS, MODULES, PROGRAMS_DIR, ROOT,
               ROOT_PAGES, TOOLS_DIR, iter_programs, load_registry, read_text,
               run_node, tool_pages)

FALLBACK_REGION_RE = re.compile(
    r'/\* >>> GENERATED:FALLBACK \*/\nvar FALLBACK = (.*?);\n/\* <<< GENERATED:FALLBACK \*/',
    re.DOTALL)

# 第 1 期设计 D5：两页 FALLBACK 各自必须**恰好**带这些字段。这是规格，故意不从
# sync_fallback.py 导入——门若与生成器共用同一份字段表，从表里删掉一个字段时
# 两边会一起「同意」：全绿，而页面上少了它。
FALLBACK_FIELDS = {
    'app.html':   ('id', 'file', 'accent', 'module', 'version', 'kicker', 'title', 'tag'),
    'index.html': ('id', 'file', 'accent', 'module', 'version', 'kicker', 'title', 'tag',
                   'desc'),
}

MODULE_LABELS_RE = re.compile(r'var MODULE_LABELS = \{(.*?)\n\};', re.DOTALL)
MODULE_LABEL_ROW_RE = re.compile(
    r"^\s*(\d+):\s*\{\s*en:\s*'((?:[^'\\]|\\.)*)',\s*zh:\s*'((?:[^'\\]|\\.)*)'\s*\},?\s*$",
    re.MULTILINE)


def _fallback_entries(name: str):
    """解析一页的 GENERATED:FALLBACK 区段。返回 (条目列表, None) 或 (None, 错误文本)。

    用 json.loads 而不是正则抠字段：区段由 sync_fallback.py 用 json.dumps 写出，
    门这边用独立的解码器读回来比对——一个比字节（sync_fallback --check），
    一个比语义（本函数的调用方），两次测量互不依赖。
    """
    m = FALLBACK_REGION_RE.search(read_text(ROOT / name))
    if not m:
        return None, (f'{name} 里找不到 GENERATED:FALLBACK 区段'
                      f'（形如 var FALLBACK = [...]; 夹在两条标记之间）')
    try:
        data = json.loads(m.group(1))
    except ValueError as exc:
        return None, f'{name} 的 FALLBACK 区段不是合法 JSON：{exc}'
    if not isinstance(data, list) or not all(isinstance(e, dict) for e in data):
        return None, f'{name} 的 FALLBACK 不是对象数组'
    return data, None


def registry_check() -> int:
    """注册表自洽 + 与磁盘双向一致。

    双向很重要：只查「注册表里的文件存在」会漏掉反方向——一个写完但忘了注册的
    工具页会悄悄躺在 tools/ 里进不了任何导航。根仓库真出过这事（main 上
    61 个 output 文件对 60 条注册）。`_` 开头的模板页不参与这个双向普查。
    """
    reg = load_registry()
    rc = 0
    if reg.get('schemaVersion') != 1:
        print(f'ERROR: python-tools.json 的 schemaVersion 应为 1，'
              f'实际 {reg.get("schemaVersion")!r}', file=sys.stderr)
        rc = 1
    tools = reg.get('tools') or []
    if not tools:
        print('ERROR: python-tools.json 里一个工具都没有', file=sys.stderr)
        return 1

    seen_ids, seen_files = {}, {}
    for d in tools:
        tid = d.get('id')
        if not tid:
            print('ERROR: python-tools.json 有条目缺 id', file=sys.stderr)
            rc = 1
            continue
        if tid in seen_ids:
            print(f'ERROR: 重复的 id：{tid}', file=sys.stderr)
            rc = 1
        seen_ids[tid] = 1

        f = d.get('file', '')
        if f in seen_files:
            print(f'ERROR: 重复的 file：{f}', file=sys.stderr)
            rc = 1
        seen_files[f] = 1
        if not f.startswith('tools/'):
            print(f'ERROR: {tid} 的 file 必须在 tools/ 下，实际 {f!r}', file=sys.stderr)
            rc = 1
        # 硬边界（根 CLAUDE.md「Registry isolation is a hard boundary」）：本注册表
        # 只管 python/tools/*.html。一条指向 ../outputs/ 的路径既越了注册表边界，
        # 也毁了可搬迁性。
        if '..' + '/' in f:
            print(f'ERROR: {tid} 的 file 指向了子项目之外：{f!r}', file=sys.stderr)
            rc = 1
        if not (ROOT / f).exists():
            print(f'ERROR: {tid} 的 file 不存在：{f}', file=sys.stderr)
            rc = 1

        if d.get('module') not in MODULES:
            print(f'ERROR: {tid} 的 module 必须是 1–8，实际 {d.get("module")!r}',
                  file=sys.stderr)
            rc = 1
        if d.get('accent') not in ACCENTS:
            print(f'ERROR: {tid} 的 accent 必须是 {sorted(ACCENTS)} 之一，'
                  f'实际 {d.get("accent")!r}', file=sys.stderr)
            rc = 1
        if not re.fullmatch(r'\d+\.\d+\.\d+', str(d.get('version', ''))):
            print(f'ERROR: {tid} 的 version 不是 semver：{d.get("version")!r}',
                  file=sys.stderr)
            rc = 1
        if not str(d.get('engine', '')).startswith(ENGINE_PREFIX):
            print(f'ERROR: {tid} 的 engine 应形如 {ENGINE_PREFIX}x.y.z，'
                  f'实际 {d.get("engine")!r}', file=sys.stderr)
            rc = 1
        if not isinstance(d.get('changelog'), list) or not d.get('changelog'):
            print(f'ERROR: {tid} 的 changelog 必须是非空数组', file=sys.stderr)
            rc = 1

        for field in BILINGUAL_FIELDS:
            v = d.get(field)
            if not isinstance(v, dict) or not v.get('en') or not v.get('zh'):
                print(f'ERROR: {tid} 的 {field} 必须同时有非空的 zh 与 en',
                      file=sys.stderr)
                rc = 1

    # 反方向：磁盘上有、注册表里没有
    registered = set(seen_files)
    for p in tool_pages():
        rel = 'tools/' + p.name
        if rel not in registered:
            print(f'ERROR: {rel} 在磁盘上但没进注册表——它进不了任何导航',
                  file=sys.stderr)
            rc = 1

    if rc == 0:
        print(f'注册表：{len(tools)} 个工具，字段与磁盘双向一致')
    return rc


def fallback_check() -> int:
    """两页 FALLBACK 与注册表：id 顺序相同；字段集恰为 FALLBACK_FIELDS；
    除 version（归 fallback_version_check）外逐字段相等。

    FALLBACK 是 file:// 下唯一的数据来源。第 0 期这道门只比 id 集合，于是把
    accent 改成 orange、module 改成 7、title 改成 WRONG TITLE，34 道门全绿——
    离线打开的侧栏会把工具归进错的模块、画错的颜色（账本 §一.1）。
    """
    tools = load_registry()['tools']
    reg_ids = [t['id'] for t in tools]
    by_id = {t['id']: t for t in tools}
    rc = 0
    compared = 0
    for name in ROOT_PAGES:
        entries, err = _fallback_entries(name)
        if err:
            print(f'ERROR: {err}', file=sys.stderr)
            rc = 1
            continue
        ids = [e.get('id') for e in entries]
        if ids != reg_ids:
            print(f'ERROR: {name} 的 FALLBACK 条目与注册表不一致（顺序也算）\n'
                  f'    FALLBACK：{ids}\n'
                  f'    注册表：  {reg_ids}', file=sys.stderr)
            rc = 1
            continue
        want_fields = set(FALLBACK_FIELDS[name])
        for e in entries:
            tid = e['id']
            got_fields = set(e)
            if got_fields != want_fields:
                print(f'ERROR: {name} 的 FALLBACK 条目 {tid} 字段集不符——'
                      f'多出 {sorted(got_fields - want_fields)}，'
                      f'缺少 {sorted(want_fields - got_fields)}', file=sys.stderr)
                rc = 1
            for field in sorted((want_fields & got_fields) - {'version'}):
                if e[field] != by_id[tid].get(field):
                    print(f'ERROR: {name} 的 FALLBACK 条目 {tid} 的 {field} 与注册表不同\n'
                          f'    FALLBACK：{e[field]!r}\n'
                          f'    注册表：  {by_id[tid].get(field)!r}\n'
                          f'    修复：python3 python/scripts/sync_fallback.py',
                          file=sys.stderr)
                    rc = 1
                else:
                    compared += 1
    if rc == 0 and compared == 0:
        print('ERROR: 一个 FALLBACK 字段都没比到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'FALLBACK：两页各 {len(reg_ids)} 条，id 顺序与注册表相同，'
              f'{compared} 个镜像字段逐一相等')
    return rc


def fallback_version_check() -> int:
    """两页 FALLBACK 的每一条都要带 version，且必须等于注册表里的那个。

    为什么这道门必须单独存在：`fallback_check()` 按设计**跳过 version 的取值
    比较**——它逐字段比对时显式排除了 version（见该函数 for 循环里的
    `- {'version'}`），只在「字段集恰为 FALLBACK_FIELDS」这一步顺带查出
    version 缺失。也就是说，**缺一个 version 字段**会被 fallback_check 的字段集
    检查抓到，但 version **取值对不对**从来不是它管的——那正是这道门要单独存在
    的理由。而 version 同时是缓存键——app.html 的 iframe 地址与画廊卡片都把它
    拼进 URL（?v=<version>），卡片角上还要印出来，值本身必须有专门的门盯着。

    cryptography 实测过这个洞：两页 27×2 = 54 条条目，version 字段一个都没有，
    而根 CLAUDE.md 和那一页自己的注释都写着「现在也带 version」。线上 fetch
    拿得到注册表，一切正常；file:// 下 27 张卡片全部渲染成 v0、地址全部 ?v=0。
    """
    reg_ver = {t['id']: t['version'] for t in load_registry()['tools']}
    rc = 0
    checked = 0
    for name in ROOT_PAGES:
        entries, err = _fallback_entries(name)
        if err:
            continue                     # 解析不了由 fallback_check 报，不重复报
        for e in entries:
            tid = e.get('id')
            if 'version' not in e:
                print(f'ERROR: {name} 的 FALLBACK 条目 {tid} 没有 version 字段——'
                      f'file:// 下卡片会渲染成 v0、地址退化成 ?v=0', file=sys.stderr)
                rc = 1
                continue
            want = reg_ver.get(tid)
            if want is None:
                continue                 # id 对不上由 fallback_check 报
            if e['version'] != want:
                print(f'ERROR: {name} 的 FALLBACK 条目 {tid} 版本是 '
                      f'{e["version"]!r}，注册表是 {want!r}', file=sys.stderr)
                rc = 1
                continue
            checked += 1
    if rc == 0 and checked == 0:
        print('ERROR: 一条 FALLBACK 版本戳都没比到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'FALLBACK 版本戳：{checked} 条内嵌条目全部带 version 且与注册表同值')
    return rc


def version_meta_check() -> int:
    """注册表的 version 必须等于工具页 <meta name="tool-version"> 的值。

    版本号在这个仓库不只是标签，还是**缓存键**：两个导航页都把它拼进
    iframe/卡片的 URL（?v=<version>）。两处不一致时，一次已发布的升级会躲在
    浏览器的旧副本后面，直到使用者清缓存——根 CLAUDE.md 记着这事真发生过。
    """
    rc = 0
    checked = 0
    for d in load_registry()['tools']:
        path = ROOT / d['file']
        if not path.exists():
            continue                       # 缺文件由 registry_check 报，不重复报
        m = META_VERSION_RE.search(read_text(path))
        if not m:
            print(f'ERROR: {d["file"]} 缺 <meta name="tool-version">', file=sys.stderr)
            rc = 1
            continue
        if m.group(1) != d['version']:
            print(f'ERROR: {d["id"]} 版本不一致——注册表 {d["version"]}、'
                  f'html meta {m.group(1)}（{d["file"]}）', file=sys.stderr)
            rc = 1
            continue
        checked += 1
    if rc == 0:
        print(f'版本元数据：{checked} 个页面的 tool-version 与注册表一致')
    return rc


def program_count_check() -> int:
    """注册表的 programs / lines 必须等于从 programs/ch*/ 现场重算的结果。

    `lines` 的定义（Task 11c 追加裁决 T11-1，源自 Task 11 评审 I4）：源码去掉
    BLANK 指令行（`# >>> BLANK …` 与 `# <<< BLANK`）之后的行数——**不含**指令行。
    页面把 `lines` 当「程序有多长」显示（左侧列表、说明面板顶部），选择器
    「不超过 20 / 40 / 80 行」也按它筛；每挖一个空就多算两行的旧定义
    （`len(src.splitlines())`，含指令行）会让程序在筛选器里显得比她实际看到的
    （`Exercise.clean()` 之后的行数，读模式/临摹模式给她看的就是这份）更长，
    ch01 的 `int-float-str`（看得到 17 行、旧定义显示 21 行）与
    `divmod-and-floor`（看得到 19 行、旧定义显示 21 行）都因此被「不超过 20 行」
    的筛选漏掉。`lines` 的定义**必须与 build_programs.py 同法**，否则这道门会
    在一处无害的差异上永远报红。

    「去掉指令行」的判定复用 `library.py` 已有的 `_is_directive`——两边都在
    校验门这一侧，是同一件事的同一个判定，不是独立测量。真正要求互相独立的是
    构建脚本（build_programs.py）与这道门：门不导入构建脚本的函数，构建脚本
    也不导入这里的，各自维护一份与 `core/exercise.js` 的
    `DIRECTIVE_OPEN`/`DIRECTIVE_CLOSE` 同义的判定。

    与 build_programs --check 不重复：那一道只在「回写后有变化」时报红，靠的是
    同一份计算逻辑；这一道从 `.py` 文件重新数一遍行，是对同一事实的第二次独立
    测量——注册表被人手改过一个数字时，它是先响的那个。
    """
    from . import library  # 惰性导入：与 syntax.py 的做法一致，避开模块级耦合

    reg = load_registry()
    by_id = {t['id']: t for t in reg['tools']}
    counts: dict = {}
    for chapter_dir, data, prog, py_path in iter_programs():
        tool = data.get('tool')
        if not py_path.exists():
            continue                     # 缺文件由 chapter_manifest_check 报
        src = read_text(py_path)
        body_lines = sum(1 for line in src.splitlines()
                          if not library._is_directive(line))
        n, total = counts.get(tool, (0, 0))
        counts[tool] = (n + 1, total + body_lines)

    rc = 0
    for tool, (n, total) in sorted(counts.items()):
        entry = by_id.get(tool)
        if entry is None:
            print(f'ERROR: 章节点名的工具 {tool!r} 不在注册表里，programs/lines '
                  f'无处可比', file=sys.stderr)
            rc = 1
            continue
        if entry.get('programs') != n:
            print(f'ERROR: {tool} 的 programs 注册表写 {entry.get("programs")!r}，'
                  f'从 {PROGRAMS_DIR} 重算是 {n}', file=sys.stderr)
            rc = 1
        if entry.get('lines') != total:
            print(f'ERROR: {tool} 的 lines 注册表写 {entry.get("lines")!r}，'
                  f'重算是 {total}（定义：去掉 BLANK 指令行之后的行数，不含指令行）',
                  file=sys.stderr)
            rc = 1
    if not counts:
        print('ERROR: programs/ 下一个章节都没有——这道门本该重算计数，'
              '不是跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'程序计数：{len(counts)} 个工具的 programs/lines 与磁盘重算一致'
              f'（lines 不含 BLANK 指令行）')
    return rc


def _module_labels(name: str):
    """返回 (原始区间文本, {编号: (en, zh)})；找不到返回 (None, None)。"""
    text = read_text(ROOT / name)
    m = MODULE_LABELS_RE.search(text)
    if not m:
        return None, None
    rows = {int(n): (en, zh) for n, en, zh in MODULE_LABEL_ROW_RE.findall(m.group(1))}
    return m.group(1), rows


def module_label_check() -> int:
    """MODULE_LABELS 两页**逐字节相同**，且 1..8 一个不缺。

    逐字节而不是「解析出来的字典相等」：这张表是两页共用的分组排序（design §6.1），
    一页把某个模块的中文改了一个字，两页的侧栏与画廊就会给同一个模块两个名字。
    逐字节比对连空格对齐都管，而这正是「复制一份改一半」最先留下的痕迹。
    解析出的字典另比一遍，是为了在逐字节红的时候能说出**是哪个模块、哪半边**不同。
    """
    rc = 0
    bodies = {}
    rows_by_page = {}
    for name in ROOT_PAGES:
        body, rows = _module_labels(name)
        if body is None:
            print(f'ERROR: {name} 里找不到 MODULE_LABELS 表', file=sys.stderr)
            rc = 1
            continue
        bodies[name] = body
        rows_by_page[name] = rows
        missing = sorted(MODULES - set(rows))
        if missing:
            print(f'ERROR: {name} 的 MODULE_LABELS 缺模块 {missing}', file=sys.stderr)
            rc = 1
        extra = sorted(set(rows) - MODULES)
        if extra:
            print(f'ERROR: {name} 的 MODULE_LABELS 多出模块 {extra}（闭集是 1–8）',
                  file=sys.stderr)
            rc = 1
    if len(bodies) == 2:
        a, b = ROOT_PAGES
        if bodies[a] != bodies[b]:
            rc = 1
            ra, rb = rows_by_page[a], rows_by_page[b]
            named = False
            for n in sorted(set(ra) | set(rb)):
                if ra.get(n) != rb.get(n):
                    print(f'ERROR: MODULE_LABELS 模块 {n} 两页不同——'
                          f'{a}: {ra.get(n)!r}；{b}: {rb.get(n)!r}', file=sys.stderr)
                    named = True
            if not named:
                print(f'ERROR: MODULE_LABELS 两页解析结果相同但**字节不同**'
                      f'（空白或排版有差异）：{a} 与 {b}', file=sys.stderr)
    if rc == 0:
        print(f'模块标签：两页 MODULE_LABELS 逐字节相同，模块 1–8 齐全')
    return rc


def accent_module_check() -> int:
    """注册表每条的 accent == MODULE_ACCENTS[module]；表本身覆盖 1–8、取值在闭集、相邻异色。

    第 0 期这道门只查「同模块同色、相邻异色」，而且因为只有一个模块，后半截在真实
    数据上从没执行过。改成「照表」之后：同模块同色是表的推论；相邻异色从「临场挑色
    时碰运气」变成「对表做一次静态断言」——这条断言每次运行都在真实数据（表）上执行。
    """
    rc = 0
    if set(MODULE_ACCENTS) != MODULES:
        print(f'ERROR: MODULE_ACCENTS 的键应恰为模块 1–8，实际 {sorted(MODULE_ACCENTS)}',
              file=sys.stderr)
        rc = 1
    for mod, accent in sorted(MODULE_ACCENTS.items()):
        if accent not in ACCENTS:
            print(f'ERROR: MODULE_ACCENTS[{mod}]={accent!r} 不在五色闭集 {sorted(ACCENTS)} 内',
                  file=sys.stderr)
            rc = 1
        nxt = MODULE_ACCENTS.get(mod + 1)
        if nxt is not None and nxt == accent:
            print(f'ERROR: MODULE_ACCENTS 相邻模块 {mod} 与 {mod + 1} 都是 {accent!r}——'
                  f'分组的颜色线索会消失', file=sys.stderr)
            rc = 1

    checked = 0
    for d in load_registry()['tools']:
        mod = d.get('module')
        if mod not in MODULES:
            continue                     # 非法 module 由 registry_check 报
        want = MODULE_ACCENTS.get(mod)
        if d.get('accent') != want:
            print(f'ERROR: {d.get("id")} 在模块 {mod}，accent 应为 {want!r}（主规格 §6.1），'
                  f'实际 {d.get("accent")!r}', file=sys.stderr)
            rc = 1
            continue
        checked += 1
    if rc == 0 and checked == 0:
        print('ERROR: 一条注册表 accent 都没比到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'配色：{checked} 个工具的 accent 与模块配色表一致；表本身覆盖 1–8 且相邻异色')
    return rc


TOOL_BLOCK_RE = re.compile(r'var TOOL = (\{.*?\n\});', re.DOTALL)
META_ENGINE_RE = re.compile(r'<meta\s+name="tool-engine"\s+content="([^"]+)"')


def _eval_tool_blocks(paths: list) -> dict:
    """{文件名: {'value': TOOL 对象} | {'error': 文本}}。在 node vm 里求值对象字面量，
    不用正则抠字段——TOOL 块里有注释、有嵌套对象，正则抠出来的是「看起来像」的值。"""
    blocks = {}
    for p in paths:
        m = TOOL_BLOCK_RE.search(read_text(p))
        blocks[p.name] = m.group(1) if m else None
    script = r'''
const vm = require('vm');
const blocks = %s;
const out = {};
for (const name of Object.keys(blocks)) {
  if (blocks[name] === null) { out[name] = { error: '找不到 var TOOL = {...};' }; continue; }
  try { out[name] = { value: vm.runInNewContext('(' + blocks[name] + ')', {}) }; }
  catch (e) { out[name] = { error: 'TOOL 块求值抛错：' + e.message }; }
}
process.stdout.write(JSON.stringify(out));
''' % json.dumps(blocks, ensure_ascii=False)
    proc = run_node(script)
    if proc.returncode != 0:
        raise RuntimeError('node 求值 TOOL 块失败：' + proc.stderr)
    return json.loads(proc.stdout)


def page_mirror_check() -> int:
    """每个已注册工具页的 TOOL.id / accent / title 与 tool-engine meta 都等于注册表；
    全部工具的 engine 相同，且等于 _skeleton.html 的 tool-engine。

    这几处是第 0 期账本没点到的镜像：TOOL 块每页一份，`TOOL.id` 全页零读者、只有一句
    「必须与注册表一致」的注释；engine 在注册表与页面 meta 各存一份，也无门。
    所有页面内联的是同一份 core，所以 engine 只可能有一个真值——骨架也要对上，否则
    下一个从骨架复制出来的新页会带着旧 engine 出生。
    """
    reg = load_registry()['tools']
    present = [d for d in reg if (ROOT / d['file']).exists()]   # 缺文件由 registry_check 报
    skeleton = TOOLS_DIR / '_skeleton.html'
    evaluated = _eval_tool_blocks([ROOT / d['file'] for d in present])
    rc = 0
    checked = 0
    for d in present:
        path = ROOT / d['file']
        res = evaluated.get(path.name) or {'error': '没有求值结果'}
        if 'error' in res:
            print(f'ERROR: {d["file"]}：{res["error"]}', file=sys.stderr)
            rc = 1
            continue
        tool = res['value']
        for field in ('id', 'accent', 'title'):
            if tool.get(field) != d.get(field):
                print(f'ERROR: {d["file"]} 的 TOOL.{field} 与注册表不同\n'
                      f'    页面：  {tool.get(field)!r}\n'
                      f'    注册表：{d.get(field)!r}', file=sys.stderr)
                rc = 1
        m = META_ENGINE_RE.search(read_text(path))
        if not m:
            print(f'ERROR: {d["file"]} 缺 <meta name="tool-engine">', file=sys.stderr)
            rc = 1
        elif m.group(1) != d.get('engine'):
            print(f'ERROR: {d["file"]} 的 tool-engine meta 是 {m.group(1)!r}，'
                  f'注册表是 {d.get("engine")!r}', file=sys.stderr)
            rc = 1
        checked += 1

    engines = sorted({str(d.get('engine')) for d in reg})
    if len(engines) != 1:
        print(f'ERROR: 注册表里的 engine 不止一个：{engines}——所有页面内联同一份 core，'
              f'engine 只能有一个真值', file=sys.stderr)
        rc = 1
    sm = META_ENGINE_RE.search(read_text(skeleton)) if skeleton.exists() else None
    if not sm:
        print('ERROR: tools/_skeleton.html 缺 <meta name="tool-engine">', file=sys.stderr)
        rc = 1
    elif len(engines) == 1 and sm.group(1) != engines[0]:
        print(f'ERROR: _skeleton.html 的 tool-engine 是 {sm.group(1)!r}，工具们是 '
              f'{engines[0]!r}——从骨架复制出来的新页会带着旧 engine 出生', file=sys.stderr)
        rc = 1

    if rc == 0 and checked == 0:
        print('ERROR: 一个工具页都没比到——这道门跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'页面镜像：{checked} 个工具页的 TOOL.id/accent/title 与 tool-engine 与注册表一致；'
              f'engine 全库唯一（{engines[0]}），骨架同值')
    return rc
