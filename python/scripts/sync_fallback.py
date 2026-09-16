#!/usr/bin/env python3
"""把 python-tools.json 同步进两个导航页内嵌的 FALLBACK（第 1 期设计 §4 A1）。

FALLBACK 是 file:// 下唯一的数据来源（fetch 会因同源限制失败）。第 0 期它是手抄的：
两页各一份、每条带 accent / module / kicker / title / tag 五个镜像字段，门只比 id
集合与 version——把 accent 改成 orange、module 改成 7，34 道门全绿。根仓为同一族
问题付过学费（62 条里 48 条静默漂移），解法是把镜像改成生成的；本脚本照
scripts/sync_registry.py 的形状做同一件事。

两页字段不同（设计 D5）：
  app.html   —— 侧栏用到的字段，不带 desc
  index.html —— 再加 desc：画廊卡片要显示简介，离线与线上从此一致

编码用 json.dumps（desc 是带撇号与引号的正文，手写 JS 单引号字面量的转义不可靠），
然后额外把三种字符写成 JSON 的 unicode 转义（反斜杠 + u + 四位十六进制）：
  <        —— 防正文里出现 script 结束标签或 HTML 注释开头，那会让 HTML 分词器断页
  U+2028 / U+2029 —— 自 ES2019 起不是语法错（R41 实测），但旧引擎与工具链把它们
              当换行，而且肉眼不可见
JSON 的结构字符里没有这三种，所以它们只可能出现在字符串内部，整体替换是安全的。

用法：
    python3 python/scripts/sync_fallback.py                  # 重写两页
    python3 python/scripts/sync_fallback.py --check          # 只查，不同步退出 1
    python3 python/scripts/sync_fallback.py --print-changed  # 重写并逐行打印改过的文件（给钩子）
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / 'python-tools.json'

BEGIN = '/* >>> GENERATED:FALLBACK */'
END = '/* <<< GENERATED:FALLBACK */'
REGION_RE = re.compile(re.escape(BEGIN) + r'.*?' + re.escape(END), re.DOTALL)

BASE_FIELDS = ('id', 'file', 'accent', 'module', 'version', 'kicker', 'title', 'tag')
PAGE_FIELDS = {
    'app.html': BASE_FIELDS,
    'index.html': BASE_FIELDS + ('desc',),
}

_ESCAPED = ('<', chr(0x2028), chr(0x2029))


def load_tools() -> list:
    try:
        data = json.loads(REGISTRY.read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        raise SystemExit(f'ERROR: 读不了注册表 {REGISTRY}：{exc}') from None
    tools = data.get('tools') if isinstance(data, dict) else None
    if not isinstance(tools, list) or not tools:
        raise SystemExit(f'ERROR: {REGISTRY} 的 "tools" 不是非空数组')
    return tools


def minimal(tools: list, fields: tuple) -> list:
    out = []
    for i, tool in enumerate(tools):
        if not isinstance(tool, dict):
            raise SystemExit(f'ERROR: {REGISTRY} 的 tools[{i}] 不是对象')
        missing = [f for f in fields if f not in tool]
        if missing:
            raise SystemExit(
                f'ERROR: {REGISTRY} 的 tools[{i}]（id={tool.get("id")!r}）缺字段 {missing}')
        out.append({f: tool[f] for f in fields})
    return out


def encode(entries: list) -> str:
    text = json.dumps(entries, ensure_ascii=False, indent=2)
    for ch in _ESCAPED:
        text = text.replace(ch, '\\' + 'u%04x' % ord(ch))
    return text


def render_page(name: str, text: str, tools: list) -> str:
    found = len(REGION_RE.findall(text))
    if found != 1:
        raise SystemExit(
            f'ERROR: python/{name} 里 GENERATED:FALLBACK 区段有 {found} 个，应恰好 1 个')
    block = f'{BEGIN}\nvar FALLBACK = {encode(minimal(tools, PAGE_FIELDS[name]))};\n{END}'
    return REGION_RE.sub(lambda _m: block, text, count=1)


def main(check_only: bool = False, print_changed: bool = False) -> int:
    tools = load_tools()
    stale = []
    for name in PAGE_FIELDS:
        path = ROOT / name
        original = path.read_text(encoding='utf-8')
        updated = render_page(name, original, tools)
        if updated == original:
            continue
        stale.append(path)
        if not check_only:
            path.write_text(updated, encoding='utf-8')

    if check_only:
        if stale:
            print('ERROR: 以下导航页的 FALLBACK 与 python-tools.json 不同步：', file=sys.stderr)
            for path in stale:
                print(f'  - {path.name}', file=sys.stderr)
            print('修复：python3 python/scripts/sync_fallback.py', file=sys.stderr)
            return 1
        print(f'FALLBACK 生成：两个导航页与注册表同步（{len(tools)} 个工具）')
        return 0

    if print_changed:
        # 机读列表，给 pre-commit 钩子只 git add 这些路径（同 inline_core.py 的纪律）。
        for path in stale:
            print(path)
        return 0

    if stale:
        print(f'已重写 {len(stale)} 个导航页：{", ".join(p.name for p in stale)}')
    else:
        print('两个导航页已是最新')
    return 0


if __name__ == '__main__':
    sys.exit(main(check_only='--check' in sys.argv,
                  print_changed='--print-changed' in sys.argv))
