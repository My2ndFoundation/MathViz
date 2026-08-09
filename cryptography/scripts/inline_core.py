#!/usr/bin/env python3
"""把 cryptography/core/*.js 与 examples/*.js 注入 tools/*.html 的 GENERATED 区间。

core/ 与 examples/ 是唯一编辑源；每个 html 运行时完全自足，file:// 双击可用。
纪律照抄 chess/scripts/inline_core.py：生成区间禁止手改。

与 chess 的一处分歧：ALGOS 在这里内联成**代码**而不是字符串。chess 那边要把
算法源码交给解释器执行、交给编辑器显示，所以必须保住字节级保真，为此有一整套
`</script` / `<!--` / U+2028 转义。CryptoViz 的工具直接调用算法函数，没有那个
需求，也就不引入那套转义。若将来新增"显示算法源码"的工具，要回到字符串方案，
并连同 chess 那三条转义规则一起搬过来——不要只搬一半。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ALGOS_DIR = ROOT / 'core' / 'algos'
EXAMPLES_DIR = ROOT / 'examples'

# 分组文件先注入、汇总器最后——examples.js 在浏览器里读的是
# root.CryptoExamplesParts，那份对象由每个分组文件自己挂上去。靠文件名排序
# 碰巧成立不算依据，这里显式写死顺序（chess 的 GAMES_PARTS 同理）。
EXAMPLES_PARTS = ['examples-classical.js', 'examples.js']

SOURCES = {
    'VIZ-ENGINE': ROOT / 'core' / 'viz-engine.js',
    'CRYPTO-CORE': ROOT / 'core' / 'crypto-core.js',
    'INTERACT': ROOT / 'core' / 'interact.js',
    'ANIMATION': ROOT / 'core' / 'animation.js',
    'CRYPTANALYSIS': ROOT / 'core' / 'cryptanalysis.js',
}

# 只有部分工具有这些标记区；其余 html 缺它们是正常的，不该 WARN。
# CRYPTANALYSIS 只有带破解页的工具要；EXAMPLES / ALGOS 逐页按需。
# VIZ-ENGINE 与 CRYPTO-CORE 不在此列——每个工具都必须有这两块。
OPTIONAL_TAGS = {'INTERACT', 'ANIMATION', 'CRYPTANALYSIS', 'EXAMPLES', 'ALGOS'}


def block(tag: str, body: str) -> str:
    return (f'/* >>> GENERATED:{tag} */\n'
            f'{body.rstrip()}\n'
            f'/* <<< GENERATED:{tag} */')


def pattern(tag: str) -> re.Pattern:
    return re.compile(
        r'/\* >>> GENERATED:' + re.escape(tag) + r' \*/.*?'
        r'/\* <<< GENERATED:' + re.escape(tag) + r' \*/',
        re.DOTALL)


# ALGOS 的开始标记要携带一份逐页清单：`GENERATED:ALGOS caesar.js`。
# group(1) 捕获 "ALGOS" 和收尾 " */" 之间的原文，两处都要用：校验时 strip()
# 取干净清单，重建标记时用**原文、不 strip()**——这样清单前后没有多余空格时
# 重建结果与原文逐字节相同，不会每次跑脚本都因空白抖动而显得"内容变了"。
#
# ⚠ 区间体不能要求非空。两条标记贴在一起的空区间是"新建页面时先写标记、
# 内容交给脚本填"的唯一来源，也就是每一页的第一次。chess 那边这条正则曾要求
# 非空，后果不是报错而是三样都没发生：没内联、missing 里也没有它（ALGOS 是
# 可选标记）、门也扫不到——新页带着空 ALGOS 块全绿上线，在浏览器里当场死。
# 收尾 `\n` 收进区间体自己，空区间照样匹配、照样被填。
ALGOS_MARK_RE = re.compile(
    r'/\* >>> GENERATED:ALGOS(.*?) \*/\n(.*?)/\* <<< GENERATED:ALGOS \*/',
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
        text = pat.sub(lambda _m: block(tag, body), text, count=1)

    pat = pattern('EXAMPLES')
    if pat.search(text):
        parts = []
        for name in EXAMPLES_PARTS:
            p = EXAMPLES_DIR / name
            if not p.exists():
                raise SystemExit(f'ERROR: 缺少教学数据源 {p.relative_to(ROOT.parent)}')
            parts.append(p.read_text(encoding='utf-8').rstrip())
        text = pat.sub(lambda _m: block('EXAMPLES', '\n'.join(parts)), text, count=1)

    m = ALGOS_MARK_RE.search(text)
    if m:
        # 清单从标记行本身来，不扫目录——一页只内联它真正会调用的算法。
        # 扫目录的做法会让每个页面都带上十几份它永远不会跑的算法：体积白涨，
        # 读到的人也会疑惑"这些是干嘛的"。
        raw_list = m.group(1).strip()
        if raw_list == 'none':
            # 模板专用的显式弃权：`GENERATED:ALGOS none` 表示"这一页有意不带
            # 任何算法"，区间留空、不报错。
            #
            # 为什么要这个哨兵，而不是像原先那样把 _skeleton.html 整个排除在
            # glob 之外：排除掉的代价是**它其余六个内联块从此没有任何门看着**。
            # 这不是假设，建项目当天就漂了——引擎改了一次，骨架里的副本旧了
            # 354 字节，inline_core 不碰它、check.py 也不查它，没有任何东西报警。
            # 而骨架恰恰是以后每一个新工具的复制源，一个长期陈旧的模板是会把
            # 陈旧扩散出去的东西。
            #
            # 用一个必须显式写出来的词而不是"留空即弃权"：留空是手滑最常见的
            # 形状（新建页面时先写标记、内容待填），那正是必须报错的情形。
            # 真工具不会无意中写出 `none`。
            text = ALGOS_MARK_RE.sub(
                lambda _m: f'/* >>> GENERATED:ALGOS{_m.group(1)} */\n'
                           f'/* <<< GENERATED:ALGOS */', text, count=1)
            return text, missing
        if not raw_list:
            raise SystemExit(
                'ERROR: GENERATED:ALGOS 标记缺少清单——语法是逐页显式列出文件名'
                '（例如 GENERATED:ALGOS caesar.js），不会自动内联整个 '
                'core/algos/ 目录，请在标记行里补上清单。'
                '模板页若有意不带算法，写 `GENERATED:ALGOS none`')
        names = [n.strip() for n in raw_list.split(',')]
        if any(not n for n in names):
            # 多余的逗号 split 出来是空字符串。清单本身已经写错了，当场报错，
            # 不要悄悄丢弃这个空位。
            raise SystemExit(
                f'ERROR: GENERATED:ALGOS 清单里有空文件名（多余的逗号？）：{raw_list!r}')
        bodies = []
        for name in names:
            src = ALGOS_DIR / name
            if not src.exists():
                # 拼错一个字符就该在这里炸掉，而不是让页面带着一个悄悄少一份的
                # CryptoAlgos 上线，等运行到 CryptoAlgos.caesar 才发现是 undefined。
                raise SystemExit(
                    f'ERROR: GENERATED:ALGOS 清单里的 {name!r} 在 '
                    f'{ALGOS_DIR.relative_to(ROOT.parent)}/ 下不存在')
            bodies.append(src.read_text(encoding='utf-8').rstrip())
        # 开始标记原样重建（用未 strip 的 group(1)），收尾标记是固定字符串。
        replacement = (f'/* >>> GENERATED:ALGOS{m.group(1)} */\n'
                       + '\n'.join(bodies) + '\n'
                       + '/* <<< GENERATED:ALGOS */')
        text = ALGOS_MARK_RE.sub(lambda _m: replacement, text, count=1)

    return text, missing


def main(check_only: bool = False, print_changed: bool = False) -> int:
    for src in SOURCES.values():
        if not src.exists():
            print(f'ERROR: 缺少编辑源 {src.relative_to(ROOT.parent)}', file=sys.stderr)
            return 1

    # 下划线开头的模板与预览页（_skeleton.html 等）**也在内联范围内**。
    # 它们不是注册表意义上的工具——check.py 的 tool_pages() 因此仍然把它们
    # 排除在"注册表/版本/双向存在"那几道门之外——但它们同样内嵌着六个
    # GENERATED 区间，同样会陈旧。曾经这里排除过它们，理由是骨架的 ALGOS
    # 清单必须留空而空清单是硬错误；代价是骨架其余六块从此无人看管，
    # 建项目当天就漂了 354 字节而没有任何东西报警。骨架是以后每个新工具的
    # 复制源，让它长期陈旧等于把陈旧扩散出去。
    # 现在骨架用 `GENERATED:ALGOS none` 显式弃权（见 render()），两条规则
    # 不再冲突，也就不需要这条排除了。
    tools = sorted((ROOT / 'tools').glob('*.html'))
    if not tools:
        if not print_changed:
            print('WARN: cryptography/tools/ 下没有 html，本次无事可做', file=sys.stderr)
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
        print('修复：python3 cryptography/scripts/inline_core.py', file=sys.stderr)
        return 1

    if print_changed:
        # 机读列表：一行一个被本次运行改写过的文件路径。给 pre-commit 钩子用，
        # 让它只 `git add` 这些文件，而不是不分青红皂白地
        # `git add cryptography/tools/*.html`——那样会把其他并行会话半写的文件
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
