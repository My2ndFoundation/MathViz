"""A 组 · 注册表与两个导航页的七道门。

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
的另一份数据，不是来自我写下的常量。只有 MODULES / ACCENTS 两个闭集是例外，它们
本身就是规格（design §6.1 与两页的 ACCENTS 白名单）。
"""
from __future__ import annotations

import re
import sys

from . import (ACCENTS, BILINGUAL_FIELDS, ENGINE_PREFIX,
               META_VERSION_RE, MODULES, PROGRAMS_DIR, ROOT, ROOT_PAGES,
               iter_programs, load_registry, read_text, tool_pages)

FALLBACK_ARRAY_RE = re.compile(r'var FALLBACK = \[(.*?)\n\];', re.DOTALL)
FALLBACK_ID_RE = re.compile(r"id:\s*'([\w-]+)'")
# 夹取到下一个 id: 为止，不靠「同一行」这种脆弱假设——与 cryptography / chess
# 的同名两条同源。
FALLBACK_ENTRY_RE = re.compile(r"id:\s*'([\w-]+)'(.*?)(?=id:\s*'|\Z)", re.DOTALL)
FALLBACK_VERSION_RE = re.compile(r"version:\s*'([^']*)'")
MODULE_LABELS_RE = re.compile(r'var MODULE_LABELS = \{(.*?)\n\};', re.DOTALL)
MODULE_LABEL_ROW_RE = re.compile(
    r"^\s*(\d+):\s*\{\s*en:\s*'((?:[^'\\]|\\.)*)',\s*zh:\s*'((?:[^'\\]|\\.)*)'\s*\},?\s*$",
    re.MULTILINE)


def _fallback_body(name: str):
    """取出一页的 FALLBACK 数组体；取不到返回 None（由调用方各自报错）。"""
    text = read_text(ROOT / name)
    m = FALLBACK_ARRAY_RE.search(text)
    return m.group(1) if m else None


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
    """两页内嵌的 FALLBACK 与注册表的 id 集合必须完全相同。

    FALLBACK 是 file:// 下唯一的数据来源（fetch 会因同源限制失败）。它一旦落后
    于注册表，本地双击打开的画廊就会少工具，而线上是全的——一个只在离线时出现
    的差异，没有这道门就只能靠人撞见。
    """
    reg_ids = set(d['id'] for d in load_registry()['tools'])
    rc = 0
    for name in ROOT_PAGES:
        body = _fallback_body(name)
        if body is None:
            print(f'ERROR: {name} 里找不到 FALLBACK 数组', file=sys.stderr)
            rc = 1
            continue
        ids = set(FALLBACK_ID_RE.findall(body))
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

    为什么这道门必须单独存在：**fallback_check() 只比 id 集合**，一条缺了
    version 的条目在它眼里完全正常。而 version 同时是缓存键——app.html 的
    iframe 地址与画廊卡片都把它拼进 URL（?v=<version>），卡片角上还要印出来。

    cryptography 实测过这个洞：两页 27×2 = 54 条条目，version 字段一个都没有，
    而根 CLAUDE.md 和那一页自己的注释都写着「现在也带 version」。线上 fetch
    拿得到注册表，一切正常；file:// 下 27 张卡片全部渲染成 v0、地址全部 ?v=0。
    """
    reg_ver = {t['id']: t['version'] for t in load_registry()['tools']}
    rc = 0
    checked = 0
    for name in ROOT_PAGES:
        body = _fallback_body(name)
        if body is None:
            continue                     # 缺 FALLBACK 由 fallback_check 报，不重复报
        for tid, entry in FALLBACK_ENTRY_RE.findall(body):
            vm = FALLBACK_VERSION_RE.search(entry)
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

    `lines` 的定义**必须与 build_programs.py 同法**：`len(src.splitlines())`，
    **含** BLANK 指令行。两边不同法这道门就会在一处无害的差异上永远报红，
    而一道从第一天起就误报的门，结局只有被调弱或被无视。

    与 build_programs --check 不重复：那一道只在「回写后有变化」时报红，靠的是
    同一份计算逻辑；这一道从 `.py` 文件重新数一遍行，是对同一事实的第二次独立
    测量——注册表被人手改过一个数字时，它是先响的那个。
    """
    reg = load_registry()
    by_id = {t['id']: t for t in reg['tools']}
    counts: dict = {}
    for chapter_dir, data, prog, py_path in iter_programs():
        tool = data.get('tool')
        if not py_path.exists():
            continue                     # 缺文件由 chapter_manifest_check 报
        src = read_text(py_path)
        n, total = counts.get(tool, (0, 0))
        counts[tool] = (n + 1, total + len(src.splitlines()))

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
                  f'重算是 {total}（定义：len(src.splitlines())，含 BLANK 指令行）',
                  file=sys.stderr)
            rc = 1
    if not counts:
        print('ERROR: programs/ 下一个章节都没有——这道门本该重算计数，'
              '不是跑了个寂寞', file=sys.stderr)
        return 1
    if rc == 0:
        print(f'程序计数：{len(counts)} 个工具的 programs/lines 与磁盘重算一致')
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
    """同模块同 accent；**相邻**模块必须异 accent。

    颜色在这套导航里是分组的第二条线索（侧栏圆点、卡片左边条）。同一个模块里
    两个工具用两种颜色，读者会以为它们不是一组；相邻两个模块用同一种颜色，
    分组线索当场消失——而这两种坏法都不会让任何页面报错。

    第 0 期只有一个模块，所以「相邻异色」这一条**今天在真实数据上无事可做**。
    它的负控制因此必须往注册表里临时加一条 module:2 / accent:'cyan' 的假条目，
    否则这道门的后半截是一条从没被执行过的断言——那正是本仓反复抓到的
    「在结构上无法观察到它声称排除之物」的形状。
    """
    reg = load_registry()
    by_module: dict = {}
    rc = 0
    for d in reg['tools']:
        mod = d.get('module')
        if mod not in MODULES:
            continue                     # 非法 module 由 registry_check 报
        by_module.setdefault(mod, []).append(d)

    accent_of = {}
    for mod, items in sorted(by_module.items()):
        accents = {d.get('accent') for d in items}
        if len(accents) > 1:
            detail = '、'.join(f'{d["id"]}={d.get("accent")!r}' for d in items)
            print(f'ERROR: 模块 {mod} 内部 accent 不统一：{detail}', file=sys.stderr)
            rc = 1
        accent_of[mod] = sorted(accents)[0] if accents else None

    mods = sorted(accent_of)
    adjacent = 0
    for a, b in zip(mods, mods[1:]):
        if b - a != 1:
            continue                     # 中间还没有工具的模块不算相邻
        adjacent += 1
        if accent_of[a] == accent_of[b]:
            ids_a = '、'.join(d['id'] for d in by_module[a])
            ids_b = '、'.join(d['id'] for d in by_module[b])
            print(f'ERROR: 相邻模块 {a}（{ids_a}）与 {b}（{ids_b}）都用了 '
                  f'{accent_of[a]!r}——分组的颜色线索会消失', file=sys.stderr)
            rc = 1
    if rc == 0:
        print(f'配色：{len(by_module)} 个模块内部同色，{adjacent} 对相邻模块异色'
              + ('（第 0 期只有一个模块，相邻这一条今天无事可做——'
                 '它的负控制靠临时加一条假条目来执行）' if adjacent == 0 else ''))
    return rc
