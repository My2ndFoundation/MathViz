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
ANALYTICS = 'GENERATED:ANALYTICS'

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


# ============================ GA4 + Cookie 同意 ============================
# 设计见 docs/superpowers/specs/2026-08-13-analytics-consent-design.md
#
# 只写给 gallery / shell 两类页面。97 个工具页不加——全仓当前 <script src=
# 出现 0 次，GA 会是第一个外部脚本，加进工具页就废掉「单文件·零依赖·file://
# 可开」这条第一原则。代价是直接打开的工具 URL（侧栏 ↗ 按钮、分享链接）看不到，
# 明确接受（spec §3.3）。

GA_ID = 'G-QJZ5Y8HQG9'
CONSENT_KEY = 'mathviz-consent'

# 三个子站三个 LANG_KEY、两种默认。代码块**自包含地**复刻 ?lang= → localStorage
# → 默认 这套优先级，不读页面的 LANG 变量：壳里 LANG 定义在注入点之后，读不到。
LANG_CFG = {
    '': ('mathviz-lang', "(navigator.language||'zh').toLowerCase().indexOf('zh')===0?'zh':'en'", 'privacy.html'),
    'chess': ('chess-lang', "'en'", '../privacy.html'),
    'cryptography': ('cryptography-lang', "'en'", '../privacy.html'),
}

CONSENT_CSS = """<style>
.mv-consent{position:fixed;left:14px;right:14px;bottom:14px;z-index:9000;max-width:660px;
  margin:0 auto;padding:14px 16px;border-radius:14px;font-size:12.5px;line-height:1.6;
  border:1px solid rgba(255,255,255,.14);background:rgba(8,13,24,.96);
  backdrop-filter:blur(12px);color:#c8d6ea;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.mv-consent p{margin:0 0 11px}
.mv-consent a{color:#7fd8ef}
.mv-consent .row{display:flex;gap:9px}
/* 拒绝与接受**同样的尺寸与视觉权重**——ICO 明确要求拒绝不得比接受更难。
   不要把其中一个改成小字链接或次要色。 */
.mv-consent button{flex:1;padding:9px 0;border-radius:9px;cursor:pointer;font-size:12.5px;
  border:1px solid rgba(45,212,234,.45);background:rgba(45,212,234,.12);color:#bfefff}
.mv-consent button:hover{border-color:rgba(45,212,234,.8)}
.mv-consent button:focus-visible{outline:2px solid rgba(45,212,234,.85);outline-offset:2px}
.mv-cookie-link{margin-left:8px;cursor:pointer;text-decoration:none}
</style>"""


def analytics_block(sub: str) -> str:
    lang_key, default_lang, privacy = LANG_CFG[sub]
    js = f"""<script>
(function(){{
  /* 在 iframe 里什么都不做：三个壳的 srcFor(null) 都返回 index.html，即画廊是被
     装进 iframe 的。不拦就是一次访问打两次 pageview、叠两个同意横幅。
     这里自己判断，不依赖各页的 IN_SHELL——那个变量只有根目录的 index.html 有。 */
  try {{ if (window.self !== window.top) return; }} catch (e) {{ return; }}

  var GA_ID = '{GA_ID}', CKEY = '{CONSENT_KEY}', LKEY = '{lang_key}';
  function ls(k) {{ try {{ return localStorage.getItem(k); }} catch (e) {{ return null; }} }}
  function save(k, v) {{ try {{ localStorage.setItem(k, v); }} catch (e) {{}} }}
  function lang() {{
    try {{
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'zh' || q === 'en') return q;
      var s = ls(LKEY);
      if (s === 'zh' || s === 'en') return s;
    }} catch (e) {{}}
    return {default_lang};
  }}
  var T = {{
    zh: {{ msg: '我们使用 Google Analytics 了解哪些工具更有用。仅在你同意后才会设置 cookie。',
          ok: '接受', no: '拒绝', priv: '隐私说明', set: 'Cookie 设置' }},
    en: {{ msg: 'We use Google Analytics to see which tools are useful. Cookies are set only if you agree.',
          ok: 'Accept', no: 'Reject', priv: 'Privacy', set: 'Cookie settings' }}
  }}[lang()];

  var loaded = false;
  function loadGA() {{
    if (loaded) return; loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {{ window.dataLayer.push(arguments); }};
    gtag('js', new Date());
    /* send_page_view:false 是必须的。壳初始加载会调一次 go() 去恢复 ?tool=，
       不关掉自动 pageview 就会把第一个工具计两次。 */
    gtag('config', GA_ID, {{ send_page_view: false }});
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    send();
  }}
  function path() {{
    var id = null;
    try {{ id = new URLSearchParams(location.search).get('tool'); }} catch (e) {{}}
    var base = location.pathname.replace(/\\/[^\\/]*$/, '/');
    return id ? base + 'tool/' + id : base;
  }}
  function send() {{
    if (!window.gtag) return;
    gtag('event', 'page_view', {{ page_path: path(), page_title: document.title }});
  }}

  /* 包装 go 而不是在三个壳里各手写一行：go 是壳换工具的唯一漏斗，包装它
     让整件事 100% 由生成器产出，三个壳一行不改。GA 看不进 iframe，所以这是
     唯一能知道「用户开了哪个工具」的地方。 */
  if (typeof window.go === 'function') {{
    var _go = window.go;
    window.go = function () {{ var r = _go.apply(this, arguments); send(); return r; }};
  }}

  var box = null;
  function banner() {{
    if (box) {{ box.hidden = false; return; }}
    box = document.createElement('div');
    box.className = 'mv-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', T.set);
    box.innerHTML = '<p>' + T.msg + ' <a href="{privacy}">' + T.priv + '</a></p>'
      + '<div class="row"><button type="button" data-a="1"></button>'
      + '<button type="button" data-a="0"></button></div>';
    var b = box.querySelectorAll('button');
    b[0].textContent = T.ok; b[1].textContent = T.no;
    b[0].onclick = function () {{ save(CKEY, 'granted'); box.hidden = true; loadGA(); }};
    /* 关闭 / Esc 等同**拒绝**，不等同同意。 */
    b[1].onclick = function () {{ save(CKEY, 'denied'); box.hidden = true; }};
    document.addEventListener('keydown', function (e) {{
      if (e.key === 'Escape' && box && !box.hidden) {{ save(CKEY, 'denied'); box.hidden = true; }}
    }});
    document.body.appendChild(box);
  }}

  /* 撤回要和给出同意一样容易（ICO）：版权那一行旁边常驻一个入口。 */
  var foot = document.querySelector('.copyright, .sb-copyright');
  if (foot) {{
    var a = document.createElement('a');
    a.className = 'mv-cookie-link'; a.href = '#'; a.textContent = '· ' + T.set;
    a.onclick = function (e) {{ e.preventDefault(); banner(); }};
    foot.appendChild(a);
  }}

  var c = ls(CKEY);
  if (c === 'granted') loadGA();
  else if (c !== 'denied') banner();   /* 未做选择 = 未同意，不加载 GA */
}})();
</script>"""
    return (f'<!-- >>> {ANALYTICS} -->\n{CONSENT_CSS}\n{js}\n<!-- <<< {ANALYTICS} -->')


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
    # privacy.html 有 <footer> 会被当成画廊页，但它**不能**加 GA：在解释追踪的
    # 那一页上追踪，法律上尴尬且无收益。给它单独一类：要版权署名，不要 GA。
    if rel == 'privacy.html':
        return 'legal'
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


def subproject_of(p: Path) -> str:
    parts = p.relative_to(ROOT).parts
    return parts[0] if parts[0] in ('chess', 'cryptography') else ''


def analytics_replace(s: str, p: Path, rel: str) -> str:
    """GA 区间只进 gallery / shell，且注入在 </body> 之前。

    为什么是 </body> 而不是主脚本之前：代码块**包装** window.go，所以必须在
    go 已定义之后运行；它同时自己补发一次当前页的 pageview，覆盖住「壳初始
    加载时那次 go() 已经发生过」的情况。
    """
    block = analytics_block(subproject_of(p))
    pat = re.compile(rf'<!-- >>> {ANALYTICS} -->.*?<!-- <<< {ANALYTICS} -->', re.S)
    if pat.search(s):
        return pat.sub(lambda _: block, s, count=1)
    n = s.count('</body>')
    if n != 1:
        raise SystemExit(f'{rel}: 锚点 </body> 出现 {n} 次（需恰好 1 次），拒绝猜测')
    return s.replace('</body>', block + '\n</body>', 1)


def main() -> int:
    check = '--check' in sys.argv
    stale, touched, errs = [], 0, []
    for p in tracked_html():
        kind = classify(p)
        rel = p.relative_to(ROOT).as_posix()

        # 工具页不该有 GA 区间。这条断言存在的理由：一旦有人顺手把它铺到工具页，
        # 「零外部脚本」就在无人察觉中失守，而页面看起来完全正常。
        if kind == 'tool' and ANALYTICS in p.read_text(encoding='utf-8'):
            errs.append(f'{rel}: 工具页里出现了 {ANALYTICS}——工具页必须零外部脚本')
            continue
        if kind is None:
            continue

        s = p.read_text(encoding='utf-8')

        # 隐私说明里的待定字段不许静默上线。空/占位是「疏忽」的天然形状——
        # 一份写着 RETENTION_TBD 的法律文本上线，比没有这一页更糟。
        if kind == 'legal':
            for token in ('RETENTION_TBD', 'CONTACT_TBD'):
                if token in s:
                    errs.append(f'{rel}: 仍有占位符 {token}，隐私说明不能带占位符上线')

        anchor_kind = 'gallery' if kind == 'legal' else kind
        new = anchor_replace(s, {'tool': tool_block, 'gallery': gallery_block,
                                 'shell': shell_block}[anchor_kind](), anchor_kind, rel)
        if kind in ('gallery', 'shell'):
            new = analytics_replace(new, p, rel)
            # 包装 go 只对壳有意义；壳里若没有 go，说明它被改名了，包装会静默失效。
            if kind == 'shell' and 'function go(' not in s:
                errs.append(f'{rel}: 壳里找不到 function go(——GA 靠包装它统计工具打开')
        if new == s:
            continue
        if check:
            stale.append(rel)
        else:
            p.write_text(new, encoding='utf-8')
            touched += 1

    if errs:
        for e in errs:
            print(f'ERROR: {e}', file=sys.stderr)
        return 1

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
