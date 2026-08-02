#!/usr/bin/env python3
"""把 chess/core/*.js 注入 chess/tools/*.html 的 GENERATED 标记区间。

core/*.js 是唯一编辑源；每个 html 运行时完全自足，file:// 双击可用。
照抄 scripts/sync_registry.py 的纪律：生成区间禁止手改。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = {
    'VIZ-ENGINE': ROOT / 'core' / 'viz-engine.js',
    'CHESS-CORE': ROOT / 'core' / 'chess-core.js',
    'BOARD-RENDER': ROOT / 'core' / 'board-render.js',
}


def block(tag: str, body: str) -> str:
    return (f'/* >>> GENERATED:{tag} */\n'
            f'{body.rstrip()}\n'
            f'/* <<< GENERATED:{tag} */')


def pattern(tag: str) -> re.Pattern:
    return re.compile(
        r'/\* >>> GENERATED:' + re.escape(tag) + r' \*/.*?'
        r'/\* <<< GENERATED:' + re.escape(tag) + r' \*/',
        re.DOTALL)


def render(text: str) -> tuple[str, list[str]]:
    """返回注入后的文本与本文件缺失的标记列表。"""
    missing = []
    for tag, src in SOURCES.items():
        pat = pattern(tag)
        if not pat.search(text):
            missing.append(tag)
            continue
        body = src.read_text(encoding='utf-8')
        text = pat.sub(lambda _m: block(tag, body), text, count=1)
    return text, missing


def main(check_only: bool = False) -> int:
    for src in SOURCES.values():
        if not src.exists():
            print(f'ERROR: 缺少编辑源 {src.relative_to(ROOT.parent)}', file=sys.stderr)
            return 1

    tools = sorted((ROOT / 'tools').glob('*.html'))
    if not tools:
        print('WARN: chess/tools/ 下没有 html，本次无事可做')
        return 0

    stale = []
    for path in tools:
        original = path.read_text(encoding='utf-8')
        updated, missing = render(original)
        if missing:
            print(f'WARN: {path.name} 缺少标记区间：{", ".join(missing)}')
        if updated == original:
            continue
        stale.append(path.name)
        if not check_only:
            path.write_text(updated, encoding='utf-8')

    if check_only and stale:
        print('ERROR: 以下文件的内联副本与编辑源不一致：', file=sys.stderr)
        for name in stale:
            print(f'  - {name}', file=sys.stderr)
        print('修复：python3 chess/scripts/inline_core.py', file=sys.stderr)
        return 1

    if stale:
        print(f'已更新 {len(stale)} 个文件：{", ".join(stale)}')
    else:
        print(f'{len(tools)} 个文件已是最新')
    return 0


if __name__ == '__main__':
    sys.exit(main(check_only='--check' in sys.argv))
