#!/usr/bin/env python3
"""把 python/core/*.js 注入 tools/*.html 的 GENERATED 区间。

core/ 是唯一编辑源；每个 html 运行时完全自足，file:// 双击可用。
纪律照抄 cryptography/scripts/inline_core.py（其纪律又照抄自 chess）：
生成区间禁止手改。

与 cryptography 的两处分歧：

1. 没有 ALGOS / EXAMPLES 那一整套逐页清单机制——这个子项目没有"每页选一批
   算法内联"的需求，练习程序库是另一个脚本 `build_programs.py` 管的
   `GENERATED:PROGRAMS` 区段，跟本脚本无关。
2. 没有 inline_order_check 需要的排序纪律。cryptography 里 CRYPTO-CORE 必须
   排在依赖它的模块之前，因为那些模块在 UMD 工厂参数里直接抓
   `root.CryptoCore`；这里全部模块都是惰性取依赖
   （`factory(function () { return root.PyLex; })`），标记之间的物理顺序
   不影响正确性，render() 就地替换每一对标记即可。取而代之的门（另一个
   任务写）查的是"有没有人在工厂参数里直接抓 root.X"——守真实存在的那个坏。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

SOURCES = {
    'PY-LEX':   ROOT / 'core' / 'py-lex.js',
    'STORE':    ROOT / 'core' / 'store.js',
    'EXERCISE': ROOT / 'core' / 'exercise.js',
    'EDITOR':   ROOT / 'core' / 'editor.js',
    'JUDGE':    ROOT / 'core' / 'judge.js',
    'TRACE':    ROOT / 'core' / 'trace.js',
    'INTERACT': ROOT / 'core' / 'interact.js',
}

# 七块全是必需的：每一页都是完整的三模式页面（编辑 / 判题 / 追踪），
# 缺任何一块都该 WARN，而不是被当成"这个工具没有这个功能"悄悄放过。
OPTIONAL_TAGS: set[str] = set()


def block(tag: str, body: str) -> str:
    return (f'/* >>> GENERATED:{tag} */\n'
            f'{body.rstrip()}\n'
            f'/* <<< GENERATED:{tag} */')


def pattern(tag: str) -> re.Pattern:
    # ⚠ 区间体不能要求非空（不用 `.+?`，用 `.*?`）。两条标记贴在一起的空区间
    # 是"新建页面时先写标记、内容交给脚本填"的唯一来源，也就是每一页的第一次。
    # chess 那边这条正则曾要求非空，后果不是报错而是三样都没发生：没内联、
    # missing 列表里也没有它、门也扫不到——新页带着空块全绿上线，在浏览器里
    # 当场死。这里的正则从一开始就允许空区间体，不重复那个事故。
    return re.compile(
        r'/\* >>> GENERATED:' + re.escape(tag) + r' \*/.*?'
        r'/\* <<< GENERATED:' + re.escape(tag) + r' \*/',
        re.DOTALL)


def render(text: str) -> tuple[str, list[str]]:
    """返回注入后的文本与本文件缺失的必需标记列表。"""
    missing = []
    for tag, src in SOURCES.items():
        pat = pattern(tag)
        if not pat.search(text):
            if tag not in OPTIONAL_TAGS:
                missing.append(tag)
            continue
        body = src.read_text(encoding='utf-8')
        text = pat.sub(lambda _m, body=body, tag=tag: block(tag, body), text, count=1)

    return text, missing


def main(check_only: bool = False, print_changed: bool = False) -> int:
    for src in SOURCES.values():
        if not src.exists():
            print(f'ERROR: 缺少编辑源 {src.relative_to(ROOT.parent)}', file=sys.stderr)
            return 1

    # 下划线开头的模板与预览页（如未来的 _skeleton.html）也在内联范围内。
    # 它们不是注册表意义上的工具，但同样内嵌 GENERATED 区间，同样会陈旧。
    # 排除它们的代价是它们的内联块从此无人看管，而它们恰恰是每个新工具的
    # 复制源——cryptography 建项目当天就因为排除了骨架而漂了 354 字节，
    # 没有任何东西报警。这里从一开始就不排除。
    tools = sorted((ROOT / 'tools').glob('*.html'))
    if not tools:
        if not print_changed:
            print('WARN: python/tools/ 下没有 html，本次无事可做', file=sys.stderr)
        return 0

    # WARN 一律走 stderr：--print-changed 模式下 stdout 是给 pre-commit 钩子
    # 机读的路径列表，混进一行诊断文字就会喂给 `git add` 一个不存在的路径。
    stale = []
    for path in tools:
        original = path.read_text(encoding='utf-8')
        updated, missing = render(original)
        if missing:
            print(f'WARN: {path.name} 缺少标记区间：{", ".join(missing)}', file=sys.stderr)
        if updated == original:
            continue
        stale.append(path)
        if not check_only:
            path.write_text(updated, encoding='utf-8')

    if check_only and stale:
        print('ERROR: 以下文件的内联副本与编辑源不一致：', file=sys.stderr)
        for path in stale:
            print(f'  - {path.name}', file=sys.stderr)
        print('修复：python3 python/scripts/inline_core.py', file=sys.stderr)
        return 1

    if print_changed:
        # 机读列表：一行一个被本次运行改写过的文件路径。给 pre-commit 钩子用，
        # 让它只 `git add` 这些文件，而不是不分青红皂白地
        # `git add python/tools/*.html`——那样会把其他并行会话半写的文件
        # 一并卷进本次提交（根 CLAUDE.md「并行开工纪律」第 2 条记过这次事故）。
        for path in stale:
            print(path)
        return 0

    if stale:
        print(f'已更新 {len(stale)} 个文件：{", ".join(p.name for p in stale)}')
    else:
        print(f'{len(tools)} 个文件已是最新')
    return 0


if __name__ == '__main__':
    sys.exit(main(check_only='--check' in sys.argv,
                  print_changed='--print-changed' in sys.argv))
