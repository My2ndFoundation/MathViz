#!/usr/bin/env python3
"""把画廊的背景荧光屏（几条缓慢流动的示波器轨迹）铺进四个画廊页。

    python3 scripts/apply_gallery_bg.py           # 写入四页
    python3 scripts/apply_gallery_bg.py --check   # 只校验；不同步则 exit 1

唯一的编辑源是 `scripts/gallery-bg.fragment`。它**故意不叫 `.html`**：`apply_branding.py`、`apply_footer.py`
与 CI 的几道门都按 `git ls-files '*.html'` 把每个 html 当成一张页面去铺 favicon / 版权署名——
一个没有 `<head>` 的片段叫 `.html` 会被当成缺 favicon 的坏页面（第一版就是这样红的）。脚本把它原样写进每一页
`<body>` 之后的 `<!-- >>> GENERATED:GALLERY-BG -->` … `<!-- <<< GENERATED:GALLERY-BG -->`
区段；某页还没有这个区段时（第一次铺），就紧跟在 `<body>` 那一行后面插入。

为什么要生成而不是四页各抄一份：这段背景原先只长在根 `index.html` 里，三个子项目的
画廊从来没有它（git 史里 `<canvas id="bg">` 只出现在根画廊）。「一个导航行为只落在
一个子项目里」正是 `docs/superpowers/subproject-nav-contract.md` 为之存在的那种失败；
手抄四份，第一次有人调一条曲线的颜色，四份就开始各走各的。

--check 守三件事，缺一不可：
  1. 四页每页恰好一个 GALLERY-BG 区段，且与编辑源逐字节相同；
  2. 区段之外不许再有 `id="bg"`——旧的手写画布若没删干净，页面会有两块画布、两个
     动画循环，而第 1 条照样是绿的；
  3. 任何**不在**名单里的已跟踪 html 都不许带这个区段（区段被复制进了错误的页面时，
     第 1 条同样看不见）。
"""
import argparse
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FRAGMENT = ROOT / 'scripts' / 'gallery-bg.fragment'
PAGES = ('index.html', 'chess/index.html', 'cryptography/index.html', 'python/index.html')

BEGIN = '<!-- >>> GENERATED:GALLERY-BG -->'
END = '<!-- <<< GENERATED:GALLERY-BG -->'
BG_ID = re.compile(r'id\s*=\s*["\']bg["\']')


def render_block(fragment: str) -> str:
    return f'{BEGIN}\n{fragment.rstrip()}\n{END}'


def regions(text: str) -> list:
    """所有 [BEGIN, END] 区段的 (起, 止)；结构不配对时抛 ValueError。"""
    out, pos = [], 0
    while True:
        b = text.find(BEGIN, pos)
        if b < 0:
            break
        e = text.find(END, b)
        if e < 0:
            raise ValueError('GALLERY-BG 区段没有收尾标记')
        out.append((b, e + len(END)))
        pos = e + len(END)
    if text.find(END, pos) >= 0:
        raise ValueError('GALLERY-BG 收尾标记多于开头标记')
    return out


def apply_page(rel: str, block: str, check: bool) -> list:
    """返回问题列表（空 = 同步）。check 为假时就地修正可修的问题。"""
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')
    try:
        spans = regions(text)
    except ValueError as exc:
        return [f'{rel}: {exc}']
    if len(spans) > 1:
        return [f'{rel}: GALLERY-BG 区段出现 {len(spans)} 次']

    if not spans:
        if check:
            return [f'{rel}: 缺少 GALLERY-BG 区段——运行 python3 scripts/apply_gallery_bg.py']
        m = re.search(r'<body[^>]*>\n', text)
        if not m:
            return [f'{rel}: 找不到 <body> 行，无法插入 GALLERY-BG 区段']
        text = text[:m.end()] + block + '\n' + text[m.end():]
        spans = regions(text)

    b, e = spans[0]
    problems = []
    outside = text[:b] + text[e:]
    if BG_ID.search(outside):
        problems.append(f'{rel}: GALLERY-BG 区段之外还有 id="bg" 的元素——旧的手写背景没删干净'
                        '（两块画布、两个动画循环）')
    if text[b:e] != block:
        if check:
            problems.append(f'{rel}: GALLERY-BG 区段与 scripts/gallery-bg.fragment 不一致'
                            '——运行 python3 scripts/apply_gallery_bg.py')
        else:
            text = text[:b] + block + text[e:]
    if not check:
        if text != path.read_text(encoding='utf-8'):
            path.write_text(text, encoding='utf-8')
            print(f'已写入 {rel}')
    return problems


def stray_pages() -> list:
    """名单之外、却带着 GALLERY-BG 区段的已跟踪 html。"""
    try:
        files = subprocess.run(['git', 'ls-files', '*.html'], cwd=ROOT, capture_output=True,
                               text=True, check=True).stdout.split()
    except (OSError, subprocess.CalledProcessError) as exc:
        return [f'无法列出已跟踪的 html：{exc}']
    out = []
    for rel in files:
        if rel in PAGES:
            continue
        p = ROOT / rel
        if p.exists() and BEGIN in p.read_text(encoding='utf-8', errors='replace'):
            out.append(f'{rel}: 不在画廊名单里，却带着 GALLERY-BG 区段')
    return out


def main(check_only: bool = False) -> int:
    if not FRAGMENT.exists():
        print(f'ERROR: 编辑源不存在：{FRAGMENT.relative_to(ROOT)}', file=sys.stderr)
        return 1
    block = render_block(FRAGMENT.read_text(encoding='utf-8'))
    problems = []
    for rel in PAGES:
        problems += apply_page(rel, block, check_only)
    problems += stray_pages()
    for msg in problems:
        print(f'ERROR: {msg}', file=sys.stderr)
    if problems:
        return 1
    print(f'画廊背景：{len(PAGES)} 个画廊页与 scripts/gallery-bg.fragment 一致')
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='只校验，不写盘；不同步则 exit 1')
    sys.exit(main(check_only=ap.parse_args().check))
