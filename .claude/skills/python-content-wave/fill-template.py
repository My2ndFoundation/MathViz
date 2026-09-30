#!/usr/bin/env python3
"""填本目录的简报 / PR 模板：读模板 → 按字典替换每个 {{槽}} → 断言没有残留 → 写出（python-content-wave 第 2、5、6 步用）。

为什么要它：第 5 期 m7b 控制方用不带引号的 heredoc 填简报，反引号被 shell 当命令执行，吃掉了约定表里的一行
（skill「已知的坑」本来就写着这一条）。值放进一个 JSON 文件（用写文件工具写，不经过 shell），这里单遍替换、不经过 shell。

槽的键：`{{…}}` 里去掉开头的 `REQUIRED`，再截到第一个「，」或「：」之前，去掉首尾空白——
所以 `{{REQUIRED 页 id，如 py-strings}}` 与 `{{页 id}}` 是同一个键「页 id」，填一次到处生效。
`--list` 列出模板的全部键（带 REQUIRED 标记与出现次数），照它写 JSON。

值：字符串照原样替换（多行也行）；`null` 表示「这一项本次不适用」——删掉含这个槽的**整行**
（PR 模板里「本波有用到随机的 stdlib 层程序才写」那类可选行就这样去掉）。REQUIRED 槽给 null 或空串都是 rc 1。

只输出模板里第一行 `---` 之后的正文（之前是写给控制方的填写说明，不进简报）。

用法：
  python3 fill-template.py --list builder-brief.md
  python3 fill-template.py builder-brief.md --values <值.json> --out <简报.md>
退出码：0 = 写出；1 = 有槽没给值、给了模板里没有的键、或模板本身有不成对的 {{ / }}（什么都不写）。
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

SLOT = re.compile(r'\{\{([^{}\n]*)\}\}')


def key_of(inner: str) -> str:
    k = inner.strip()
    if k.startswith('REQUIRED'):
        k = k[len('REQUIRED'):]
    k = re.split(r'[，：]', k, maxsplit=1)[0]
    return k.strip()


def body_of(text: str) -> str:
    m = re.search(r'^---[ \t]*$\n', text, re.M)
    return text[m.end():] if m else text


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('template')
    ap.add_argument('--list', action='store_true', help='只列出模板的键')
    ap.add_argument('--values', help='JSON 文件：{"键": "值" | null}')
    ap.add_argument('--out', help='写到哪里')
    a = ap.parse_args()

    body = body_of(pathlib.Path(a.template).read_text(encoding='utf-8'))
    slots = [(m.group(0), key_of(m.group(1)), m.group(1).strip().startswith('REQUIRED')) for m in SLOT.finditer(body)]
    stray = SLOT.sub('', body)
    if '{{' in stray or '}}' in stray:
        print('ERROR: 模板正文里有不成对的 {{ 或 }}——先修模板', file=sys.stderr)
        return 1
    empty = sorted({s for s, k, _ in slots if not k})
    if empty:
        print(f'ERROR: 这些槽去掉 REQUIRED 之后没有名字，没法按键填：{empty}——先给模板里的槽起名', file=sys.stderr)
        return 1

    if a.list:
        seen: dict[str, list] = {}
        for _, k, req in slots:
            e = seen.setdefault(k, [0, False])
            e[0] += 1
            e[1] |= req
        for k, (n, req) in seen.items():
            print(f'{"REQUIRED " if req else "         "}{k}  ×{n}')
        return 0

    if not (a.values and a.out):
        ap.error('填写要同时给 --values 与 --out（或只用 --list）')
    values = json.loads(pathlib.Path(a.values).read_text(encoding='utf-8'))
    keys = {k for _, k, _ in slots}
    missing = sorted(keys - set(values))
    unknown = sorted(set(values) - keys)
    # REQUIRED 槽不许空：空串与 null 都算（null 会整行删掉——对可选行是用处，对 REQUIRED 槽是手滑；第 5 期收尾评审 m1）
    blank_req = sorted({k for _, k, req in slots if req and k in values and (values[k] is None or (isinstance(values[k], str) and not values[k].strip()))})
    if missing or unknown or blank_req:
        if missing:
            print(f'ERROR: 这些槽没有给值：{missing}', file=sys.stderr)
        if unknown:
            print(f'ERROR: 这些键模板里没有（拼错了？）：{unknown}', file=sys.stderr)
        if blank_req:
            print(f'ERROR: 这些 REQUIRED 槽给的是空串或 null：{blank_req}', file=sys.stderr)
        return 1
    bad = [k for k in keys if values[k] is not None and not isinstance(values[k], str)]
    if bad:
        print(f'ERROR: 值只能是字符串或 null：{sorted(bad)}', file=sys.stderr)
        return 1

    lines_out = []
    for line in body.splitlines(keepends=True):
        if any(values[key_of(m.group(1))] is None for m in SLOT.finditer(line)):
            continue                                                 # null：这一项不适用，整行去掉
        lines_out.append(SLOT.sub(lambda m: values[key_of(m.group(1))], line))   # 单遍：值里的 {{ 不会再被当成槽
    out = ''.join(lines_out)
    residue = SLOT.findall(out)
    if residue:                                                      # 值里又带着一个没填的槽（半成品粘进来了）
        print(f'ERROR: 填完之后仍有 {{{{…}}}} 残留（来自某个值）：{residue[:5]}——什么都没写', file=sys.stderr)
        return 1
    pathlib.Path(a.out).write_text(out, encoding='utf-8')
    dropped = sorted(k for k in keys if values[k] is None)
    print(f'写出 {a.out}：{len(keys)} 个键、{len(slots)} 处槽' + (f'；整行去掉：{dropped}' if dropped else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
