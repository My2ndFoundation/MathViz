#!/usr/bin/env python3
"""把 chess/core/*.js 注入 chess/tools/*.html 的 GENERATED 标记区间。

core/*.js 是唯一编辑源；每个 html 运行时完全自足，file:// 双击可用。
照抄 scripts/sync_registry.py 的纪律：生成区间禁止手改。
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAMES_DIR = ROOT / 'games'
ALGOS_DIR = ROOT / 'core' / 'algos'
# games/ 下的分组文件先注入、汇总器最后——games.js 在浏览器里读的是
# root.ChessGamesParts，那份对象由每个分组文件自己挂上去。靠文件名排序
# 碰巧成立（'games-' < 'games.'）不算依据，这里显式写死顺序。
GAMES_PARTS = ['games-teaching.js', 'games-machine.js', 'games-romantic.js',
               'games-coldwar.js', 'games-theory.js', 'games-human.js', 'games.js']

SOURCES = {
    'VIZ-ENGINE': ROOT / 'core' / 'viz-engine.js',
    'CHESS-CORE': ROOT / 'core' / 'chess-core.js',
    'INTERACT': ROOT / 'core' / 'interact.js',
    'BOARD-RENDER': ROOT / 'core' / 'board-render.js',
    'REPLAY': ROOT / 'core' / 'replay.js',
    'INTERP': ROOT / 'core' / 'interp.js',
    'DEBUGGER': ROOT / 'core' / 'debugger.js',
    'EDITOR': ROOT / 'core' / 'editor.js',
    'TREE-MODEL': ROOT / 'core' / 'tree-model.js',
}

# 只有部分工具有这些标记区；其余 html 缺它们是正常的，不该 WARN。
# INTERP / DEBUGGER / EDITOR 只出现在阶段 3b 的验收页
# （tools/_debugger-preview.html）与将来的工具 ④⑤ 上——阶段 1/2 的三个
# 工具没有这三块是正常的，不该 WARN。TREE-MODEL / ALGOS 只出现在阶段 4
# 的工具④（chess-search-minimax.html，Task 6 才创建）与工具⑤上。
OPTIONAL_TAGS = {'REPLAY', 'GAMES', 'INTERP', 'DEBUGGER', 'EDITOR', 'TREE-MODEL', 'ALGOS'}


def js_string_literal(text: str) -> str:
    """把任意文本编码成一个可以安全塞进 <script> 标签的 JS 双引号字符串字面量。

    `algos/*.js` 不当代码内联、而当字符串内联（规格 §2.1）：interp.js 要
    执行它、editor.js 要显示它，「她读到的字符串」必须就是「会被跑的那份
    源码」，一个字节都不能在编码/解码路径上被悄悄改掉。这个函数就是那条
    路径，风险全在这里：

      · json.dumps 处理引号/反斜杠/控制字符/换行——JS 字符串字面量语法是
        JSON 字符串语法的超集，JSON 转义出来的结果原样是合法 JS。
        ensure_ascii=False：源码里的中文注释保留原样好读好 diff，而不是
        变成一串 \\uXXXX（两种写法结果字符串相等，这里选可读的那种）。
      · U+2028 / U+2029（行分隔符/段落分隔符）：JSON 允许它们原样出现在
        字符串里，但 ES2019 之前的 JS 字符串字面量把它们当行终止符处理，
        原样出现会截断字符串字面量。手动转成 \\u2028 / \\u2029，不赌
        运行环境的 JS 引擎版本。
      · `</script`：一旦原文里出现这个子串，HTML 分词器会在 JS 引擎看到
        字符串内容之前就把 <script> 标签提前闭合——这发生在 HTML 解析层，
        JS 字符串转义规则救不了它。在 `/` 前插入一个反斜杠
        （`<\\/script`）：在 JS 字符串字面量里 `\\/` 就是 `/`，字符串的值
        不变，但 HTML 分词器不再认得这个子串。大小写不敏感地匹配（浏览器
        闭合标签时也不区分大小写），用捕获组保留原始大小写。
      · `<!--`：单独出现时无害，但**跟后面某处的裸 `<script`（哪怕隔着
        任意多字符）组合在一起**会要命——HTML 分词器一进入 script data
        escaped / double-escaped 状态，模板自己真正的收尾 `</script>`
        就不再被当成闭合标签，而是被状态机吃掉、状态翻转，闭合标签往后
        错位，整个页面从这里开始被当成脚本文本吞掉。这在浏览器里实测
        复现过：`document.scripts.length` 从预期的 2 变成 1，`ALGOS`
        与后续全局变量都是 undefined。检查「有没有 `</script`」防不住
        这一类——触发条件恰恰是**一个 `</script` 都没有**。在 `!` 前插
        一个反斜杠（`<\\!--`）就地拆掉这个子串，同一招数：JS 字符串里
        `\\!` 就是 `!`，字符串的值不变，但从源头上不让分词器进入那个
        状态机，比事后证明"清一色只有一个 `</script`"更彻底——那种证明
        只覆盖了已经想到的构造，防不住换一种没有 `</script` 的组合。
    """
    s = json.dumps(text, ensure_ascii=False)
    s = s.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    s = re.sub(r'</(script)', r'<\\/\1', s, flags=re.IGNORECASE)
    s = s.replace('<!--', '<\\!--')
    return s


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
            if tag not in OPTIONAL_TAGS:
                missing.append(tag)
            continue
        body = src.read_text(encoding='utf-8')
        text = pat.sub(lambda _m: block(tag, body), text, count=1)

    pat = pattern('GAMES')
    if pat.search(text):
        parts = []
        for name in GAMES_PARTS:
            p = GAMES_DIR / name
            if not p.exists():
                raise SystemExit(f'ERROR: 缺少棋谱源 {p.relative_to(ROOT.parent)}')
            parts.append(p.read_text(encoding='utf-8').rstrip())
        text = pat.sub(lambda _m: block('GAMES', '\n'.join(parts)), text, count=1)

    pat = pattern('ALGOS')
    if pat.search(text):
        # 按文件名排序，不看目录遍历顺序——这是个 dict 字面量，key 顺序
        # 不影响运行时行为，但排序让生成结果在不同机器/文件系统上确定、
        # diff 也稳定。排除 *.test.js：那是给 node 跑的，不是给她读的算法。
        algo_files = sorted(p for p in ALGOS_DIR.glob('*.js')
                             if not p.name.endswith('.test.js'))
        if not algo_files:
            raise SystemExit(f'ERROR: 缺少算法源码 {ALGOS_DIR.relative_to(ROOT.parent)}/*.js')
        entries = [f"  '{p.name}': {js_string_literal(p.read_text(encoding='utf-8'))}"
                   for p in algo_files]
        body = 'const ALGOS = {\n' + ',\n'.join(entries) + '\n};'
        text = pat.sub(lambda _m: block('ALGOS', body), text, count=1)

    return text, missing


def main(check_only: bool = False, print_changed: bool = False) -> int:
    for src in SOURCES.values():
        if not src.exists():
            print(f'ERROR: 缺少编辑源 {src.relative_to(ROOT.parent)}', file=sys.stderr)
            return 1

    tools = sorted((ROOT / 'tools').glob('*.html'))
    if not tools:
        if not print_changed:
            print('WARN: chess/tools/ 下没有 html，本次无事可做')
        return 0

    # WARN 一律走 stderr：--print-changed 模式下 stdout 是给调用方（pre-commit
    # 钩子）机读的路径列表，混进一行诊断文字就会喂给 `git add` 一个不存在的路径。
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
        print('修复：python3 chess/scripts/inline_core.py', file=sys.stderr)
        return 1

    if print_changed:
        # 机读列表：一行一个被本次运行改写过的文件路径。给 pre-commit 钩子用，
        # 让它只 `git add` 这些文件，而不是不分青红皂白地 `git add chess/tools/*.html`
        # ——那样会把其他并行会话半写的文件一并卷进本次提交（CLAUDE.md 的
        # 「并行开工纪律」第 2 条明确记过这次事故）。
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
