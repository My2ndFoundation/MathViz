#!/usr/bin/env python3
"""把版权署名写进每个页面的 GENERATED:COPYRIGHT 区间。

设计与取舍见 docs/superpowers/specs/2026-08-13-copyright-footer-design.md

    python3 scripts/apply_footer.py          # 写入/更新全部页面
    python3 scripts/apply_footer.py --check  # 只校验；不同步则 exit 1

为什么是生成的而不是手抄的：这一串要出现在 102 个页面上。本仓对「同一份内容
散落在 N 个副本里」有明确的教训——tools.json 与 index.html 之间 62 条里 48 条
版本号静默走偏；窄屏标题的修法在 cryptography 的注释里写着「连栽五次」，却整整
一季没回流到另外 67 个副本。没有闸门的约定不是约定。

为什么不并进 apply_branding.py：那个脚本的写入路径需要 pillow/numpy（要从
docs/logo.png 派生 M/V 标记）。版权署名是纯字符串，绑进去意味着以后改一个字
都得先装图像库。本脚本零依赖。

年份**不在这里固化**——写死的话 2027 年 1 月 1 日全站同时过期，而没有任何东西
会提醒。生成的是取 new Date().getFullYear() 的标记。
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PRIMEFORGE = 'https://primeforge.app'
DARKHORSEONE = 'https://www.darkhorseone.co.uk'

BEGIN = 'GENERATED:COPYRIGHT'

# 两种形态。工具面板内容区在桌面上固定 276px（面板 304 − 2×14 padding），
# 完整串在那里要压到 8.5px 才放得下——比设计系统里在用的最小字号（10px）还小。
# 精简串在 10.5px 下量得 273px，留 3px 余量。详见 spec §2。
FULL = ('© <span data-copy-year>—</span> MathViz · '
        'A <a href="{pf}" target="_blank" rel="noopener">PrimeForge</a> Product · '
        'Built by <a href="{dh}" target="_blank" rel="noopener">DarkHorseOne</a>')
COMPACT = ('© <span data-copy-year>—</span> MathViz · '
           '<a href="{pf}" target="_blank" rel="noopener">PrimeForge</a> Product · '
           '<a href="{dh}" target="_blank" rel="noopener">DarkHorseOne</a>')

# 年份在浏览器里填。占位符写成 — 而不是某个年份，这样万一脚本坏了、JS 没跑，
# 页面上出现的是一个明显的破折号，而不是一个看起来很正常的错误年份。
#
# ⚠ `<script>` 与 `</script>` **必须各自独占一行**。本仓的语法门用
#   awk '/<script>/{f=1;next}/<\/script>/{f=0}f'
# 抽取内联脚本——那是个逐行状态机。写成单行 `<script>…</script>` 时，awk 在该行
# 置 f=1 后 next 跳过整行，于是 `</script>` 从没被看到，**后面所有 HTML 都会被
# 当成 JS 喂给 node**。第一版就是单行的，语法门当场把 62 个工具页全判红。
# 这与 CLAUDE.md 里记的「core/*.js 里不得出现 <script> 字面量」是同一个方子的
# 同一个坑，只是从另一头踩进去。
YEAR_JS = ('<script>\n'
           '(function(){var y=new Date().getFullYear();\n'
           'var n=document.querySelectorAll("[data-copy-year]");\n'
           'for(var i=0;i<n.length;i++)n[i].textContent=y;})();\n'
           '</script>')

# 字号 10px，不是 10.5px。10.5px 在本机（macOS，-apple-system）实测文本 273.3px
# 而内容盒 274px——**只剩 1px**。而 macOS 恰好是最宽的那个平台：同一串在
# DejaVu / Segoe UI / 通用 sans-serif 下只有 254–256px。1px 是 0.4%，远小于跨平台
# 字体度量的正常差异，任何一点偏差就会被下面的 overflow:hidden 切掉半个词，
# 而按需求这里**不能**用省略号遮丑。10px 时本机余 14px、其他平台余 30px 以上，
# 且 10px 正是设计系统里已在使用的最小字号，不引入新尺寸。
PANEL_CSS = """<style>
.copyright{padding:9px 14px 12px;font-size:10px;line-height:1.45;color:#5f6e86;
  white-space:nowrap;overflow:hidden;border-top:1px solid var(--panel-line)}
.copyright a{color:#8b9bb4;text-decoration:none}
.copyright a:hover{color:#bfefff}
</style>"""


def tool_block() -> str:
    return (f'<!-- >>> {BEGIN} -->\n'
            f'{PANEL_CSS}\n'
            f'<div class="copyright">{COMPACT.format(pf=PRIMEFORGE, dh=DARKHORSEONE)}</div>\n'
            f'{YEAR_JS}\n'
            f'<!-- <<< {BEGIN} -->')


def gallery_block() -> str:
    """画廊页：整页宽的 <footer> 里，一个行内 span 就够，不需要额外样式。"""
    return (f'<!-- >>> {BEGIN} -->\n'
            f'<span class="copyright">{FULL.format(pf=PRIMEFORGE, dh=DARKHORSEONE)}</span>\n'
            f'{YEAR_JS}\n'
            f'<!-- <<< {BEGIN} -->')


# 侧栏是 268px 宽、内容区 244px，而完整串在 10px 下实测 260px——**一行放不下**。
# 这里允许折行：不折行的要求针对的是工具面板那一行，侧栏页脚是块状区域，
# 两行完全正常。也**不能**塞进 .sb-foot——那是 display:flex 的一行控件，塞进去
# 会被当成 flex 项挤到右边并溢出侧栏（实测盒 105×64、右边缘超出 3px）。
# 所以给它自己的块，放在 .sb-foot 之前。
SHELL_CSS = """<style>
.sb-copyright{padding:10px 12px 0;font-size:10px;line-height:1.55;color:#5f6e86}
.sb-copyright a{color:#8b9bb4;text-decoration:none}
.sb-copyright a:hover{color:#bfefff}
</style>"""


def shell_block() -> str:
    return (f'<!-- >>> {BEGIN} -->\n'
            f'{SHELL_CSS}\n'
            f'<div class="sb-copyright">{FULL.format(pf=PRIMEFORGE, dh=DARKHORSEONE)}</div>\n'
            f'{YEAR_JS}\n'
            f'<!-- <<< {BEGIN} -->')


def tracked_html() -> list[Path]:
    out = subprocess.run(['git', 'ls-files', '*.html'], cwd=ROOT,
                         capture_output=True, text=True, check=True)
    return [ROOT / p for p in out.stdout.split()]


def classify(p: Path) -> str | None:
    """返回 'gallery' / 'shell' / 'tool' / None（不加）。

    三种形态，因为三处的可用宽度差一个量级：画廊页整页宽、侧栏 244px、
    工具面板 274px。同一串在同一字号下并非哪里都放得下（见 spec §2/§4）。

    排除项各有依据（spec §2）：archive/ 已退役；audit-scenes 是开发页；
    两个 _preview 页没有 .panel。判据是**文件内容**（有没有 .panel / .sb-foot），
    不是文件名清单——清单会随新增文件腐烂，内容判据不会。
    """
    rel = p.relative_to(ROOT).as_posix()
    if rel.startswith('archive/') or rel == 'scripts/audit-scenes.html':
        return None
    s = p.read_text(encoding='utf-8')
    if '<div class="sb-foot">' in s:
        return 'shell'
    if '<footer>' in s:
        return 'gallery'
    return 'tool' if 'id="panel"' in s else None


def anchor_replace(s: str, block: str, kind: str, rel: str) -> str:
    """插入或更新区间。锚点不唯一就报错退出，不猜。"""
    pat = re.compile(rf'<!-- >>> {BEGIN} -->.*?<!-- <<< {BEGIN} -->', re.S)
    if pat.search(s):
        return pat.sub(lambda _: block, s, count=1)

    anchor = {'tool': '</aside>',
              'gallery': '</footer>',
              # 壳：插在 .sb-foot **之前**，不是里面。它是 display:flex 的一行控件。
              'shell': '<div class="sb-foot">'}[kind]

    n = s.count(anchor)
    if n != 1:
        raise SystemExit(f'{rel}: 锚点 {anchor} 出现 {n} 次（需恰好 1 次），拒绝猜测')
    return s.replace(anchor, block + '\n    ' + anchor, 1)


def main() -> int:
    check = '--check' in sys.argv
    stale, touched = [], 0
    for p in tracked_html():
        kind = classify(p)
        if kind is None:
            continue
        s = p.read_text(encoding='utf-8')
        block = {'tool': tool_block, 'gallery': gallery_block, 'shell': shell_block}[kind]()
        new = anchor_replace(s, block, kind, p.relative_to(ROOT).as_posix())
        if new == s:
            continue
        if check:
            stale.append(p.relative_to(ROOT).as_posix())
        else:
            p.write_text(new, encoding='utf-8')
            touched += 1

    if check:
        if stale:
            print(f'版权署名不同步：{len(stale)} 个页面', file=sys.stderr)
            for r in stale[:20]:
                print(f'  {r}', file=sys.stderr)
            if len(stale) > 20:
                print(f'  …还有 {len(stale) - 20} 个', file=sys.stderr)
            print('修复：python3 scripts/apply_footer.py', file=sys.stderr)
            return 1
        total = sum(1 for p in tracked_html() if classify(p))
        print(f'版权署名：{total} 个页面全部同步')
        return 0

    print(f'版权署名：写入 {touched} 个页面')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
