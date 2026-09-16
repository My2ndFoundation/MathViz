#!/usr/bin/env python3
"""子项目导航契约的机械门。

契约：docs/superpowers/subproject-nav-contract.md

    python3 scripts/check_nav_contract.py          # 全部条款，任一条不过 exit 1
    python3 scripts/check_nav_contract.py -v       # 逐条打印通过项

为什么存在
----------
三个子项目的六个导航页（`<sub>/app.html` 与 `<sub>/index.html`）**不共享任何代码
文件**——那是「整个子目录可以被搬走后独立运行」的前提。不共享代码，同一条导航行为
就只能靠人记得手工搬运到每一份，而事实证明记不住：`?v=` 缓存键在 cryptography 落地
之后，chess 少了它整整一个季度（PR #158）。

契约文档第 2 节那张表里，C4–C8 五条一直写着「❌ 无机械门」，理由是「它们是行为，
不是可以用正则数出来的字段」。加第三个子项目正是这笔债变贵的时刻：`wireParentLink()`
与 `ACCENTS` 从四份变六份。实测下来其中五条能静态扫出来，另外两条（btnAlone 的版本
戳、页面求值后的绑定）静态扫不出来，用 node 的 `vm` 真求值一遍页面脚本。

零依赖：只用标准库 + `node`（仓库已经依赖 node 做语法门）。

⚠ 给页面脚本传路径，不传内容。Linux 把**单个** argv 元素卡在 MAX_ARG_STRLEN = 128 KiB
  （与 ARG_MAX 是两条不同的限制），macOS 没有这条上限——chess 的 `check.py` 就是这么
  「本机全绿、CI 连红四次」的。这里 node 拿到的两个参数都是短路径。
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SUBPROJECTS = ('chess', 'cryptography', 'python')

# 分组轴按子项目不同，这是契约第 3 节明确允许的差异，不是漂移。
GROUP_LABELS = {'chess': 'PHASE_LABELS',
                'cryptography': 'CHAPTER_LABELS',
                'python': 'MODULE_LABELS'}

SHELLS = [f'{s}/app.html' for s in SUBPROJECTS]
GALLERIES = [f'{s}/index.html' for s in SUBPROJECTS]
NAV_PAGES = SHELLS + GALLERIES          # 契约管的这六页
ROOT_INDEX = 'index.html'

# 根 index.html 上的三张子项目卡片。id → 目的地。
ROOT_CARDS = {'chessCard': 'chess/app.html',
              'cryptoCard': 'cryptography/app.html',
              'pythonCard': 'python/app.html'}

failures: list[str] = []
passes: list[str] = []


def fail(clause: str, msg: str) -> None:
    failures.append(f'{clause}: {msg}')


def ok(clause: str, msg: str) -> None:
    passes.append(f'{clause}: {msg}')


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8')


def markup(rel: str) -> str:
    """去掉 HTML 注释之后的页面文本，给一切「标记里必须有 X」的检查用。

    负控制实测出来的：把根 index.html 的 python 卡片整段注释掉之后，
    `'id="pythonCard"' in s` 依然为真——注释里那份被数了进去，门报绿。
    一道会把注释掉的元素当成存在的门，正好在「有人临时注掉一张卡片」这个
    最现实的场景下失效。
    """
    return re.sub(r'<!--.*?-->', '', read(rel), flags=re.S)


def inline_script(rel: str) -> str:
    """与仓库语法门那句 awk 逐行同法抽取内联脚本。

        awk '/<script>/{f=1;next}/<\\/script>/{f=0}f'

    刻意复刻它而不是用 HTML 解析器：语法门检查的就是这些字节，本门求值的必须是
    同一批字节，否则两道门会在不同的输入上给出结论。
    """
    out, f = [], False
    for line in read(rel).splitlines():
        if '<script>' in line:
            f = True
            continue
        if '</script>' in line:
            f = False
            continue
        if f:
            out.append(line)
    return '\n'.join(out)


# ---------------------------------------------------------------- 代码块抽取
#
# 只认「行首 `function NAME` / `var NAME` 起，到行首 `}` 或行尾 `;` 止」这种形状。
# 六个导航页里这三块都是这么写的；抽不出来是硬错误，**绝不当成空串继续比较**——
# 空串和空串永远相等，那会得到一道报绿而什么都没看的门（sha1('') 是
# da39a3ee5e6b…，根目录那两页没有 wireParentLink，抽出来正是这个值）。

def _block(text: str, header: str) -> str | None:
    m = re.search(rf'^{re.escape(header)}\b', text, re.M)
    if not m:
        return None
    rest = text[m.start():]
    first = rest.splitlines()[0]
    # 单行形式：`var ACCENTS = {...};` / `function safeAccent(a) { ... }`
    if first.count('{') == first.count('}') and first.rstrip().endswith((';', '}')):
        return first
    # 多行形式：到行首的 `}` 为止
    end = re.search(r'^\}', rest[len(first):], re.M)
    if not end:
        return None
    return rest[:len(first) + end.end()]


SHARED_BLOCKS = ('function wireParentLink', 'var ACCENTS', 'function safeAccent')


def shared_block_check() -> None:
    """C3 / C6 —— 六页的三块代码逐字节相同。"""
    for header in SHARED_BLOCKS:
        seen: dict[str, list[str]] = {}
        for rel in NAV_PAGES:
            b = _block(inline_script(rel), header)
            if b is None or not b.strip():
                fail('C3/C6', f'{rel}: 抽不出 `{header}` 代码块（契约要求六页各有一份）')
                continue
            seen.setdefault(b, []).append(rel)
        if len(seen) > 1:
            fail('C3/C6', f'`{header}` 在六个导航页上并非逐字节相同，分成了 {len(seen)} 组：'
                          + ' | '.join('+'.join(v) for v in seen.values()))
        elif len(seen) == 1:
            ok('C3/C6', f'`{header}` 六页逐字节相同（{len(next(iter(seen)))} 字节）')


def parent_home_check() -> None:
    """C3 —— PARENT_HOME 恰好一处，且指向父级的**壳**而不是画廊。"""
    for rel in NAV_PAGES:
        s = read(rel)
        decls = re.findall(r"^var PARENT_HOME = '([^']*)';", s, re.M)
        if len(decls) != 1:
            fail('C3', f'{rel}: `var PARENT_HOME = ...` 出现 {len(decls)} 次（需恰好 1 次）')
            continue
        if decls[0] != '../app.html':
            fail('C3', f"{rel}: PARENT_HOME 是 {decls[0]!r}，契约要求 '../app.html'"
                       '（指向 MathViz 的壳，不是它的扁平画廊）')
        else:
            ok('C3', f'{rel}: PARENT_HOME = ../app.html')


def top_target_check() -> None:
    """C4 —— 返回链接与根页三张卡片都带 target="_top"。"""
    for rel in SHELLS:
        m = re.search(r'<a[^>]*id="brandLink"[^>]*>', markup(rel))
        if not m:
            fail('C4', f'{rel}: 找不到 `<a id="brandLink">`（返回 MathViz 的那一个）')
        elif 'target="_top"' not in m.group(0):
            fail('C4', f'{rel}: `#brandLink` 少了 target="_top"——'
                       '在自己的 iframe 里点它会把 MathViz 换进那个 iframe')
        else:
            ok('C4', f'{rel}: #brandLink target="_top"')
    for rel in GALLERIES:
        m = re.search(r'<a[^>]*id="backLink"[^>]*>', markup(rel))
        if not m:
            fail('C4', f'{rel}: 找不到 `<a id="backLink">`')
        elif 'target="_top"' not in m.group(0):
            fail('C4', f'{rel}: `#backLink` 少了 target="_top"')
        else:
            ok('C4', f'{rel}: #backLink target="_top"')

    s = markup(ROOT_INDEX)
    for cid, dest in ROOT_CARDS.items():
        m = re.search(rf'<a[^>]*id="{cid}"[^>]*>', s)
        if not m:
            fail('C4', f'{ROOT_INDEX}: 找不到子项目卡片 `#{cid}`（应指向 {dest}）')
        elif 'target="_top"' not in m.group(0):
            fail('C4', f'{ROOT_INDEX}: `#{cid}` 少了 target="_top"——'
                       '在主站壳里点它会变成「壳里套壳」')
        else:
            ok('C4', f'{ROOT_INDEX}: #{cid} target="_top"')


def card_check() -> None:
    """三张子项目卡片齐全，且运行时 href 指向各自的壳、带 ?lang=。

    `sync_registry.py` **不管这三张卡片**（根注册表里没有它们的 id），在这道门之前
    它们一处门都没有——而根页面已经因为「把工具数抄进文案」漏改过两次。
    """
    s = markup(ROOT_INDEX)
    for cid, dest in ROOT_CARDS.items():
        if not re.search(rf'<a[^>]*id="{cid}"[^>]*href=|<a[^>]*href=[^>]*id="{cid}"', s):
            fail('卡片', f'{ROOT_INDEX}: 缺子项目卡片 `<a id="{cid}">`（{dest}）')
            continue
        pat = rf"getElementById\('{cid}'\)\.href = '{re.escape(dest)}\?lang=' \+ LANG;"
        if not re.search(pat, s):
            fail('卡片', f"{ROOT_INDEX}: `#{cid}` 的运行时 href 不是 "
                         f"'{dest}?lang=' + LANG")
        else:
            ok('卡片', f'{ROOT_INDEX}: #{cid} → {dest}?lang=')


WRAP_WIDTH = 'max-width:min(2600px,96vw)'


def wrap_width_check() -> None:
    """C5 —— 画廊装在壳的 iframe 里，左边还站着一条侧边栏，写死的窄 max-width
    会把卡片挤成中间一条窄柱。"""
    for rel in GALLERIES:
        m = re.search(r'\.wrap\s*\{([^}]*)\}', read(rel))
        if not m:
            fail('C5', f'{rel}: 找不到 `.wrap{{…}}` 规则')
            continue
        body = re.sub(r'\s+', '', m.group(1))
        if WRAP_WIDTH.replace(' ', '') not in body:
            got = re.search(r'max-width:[^;]*', body)
            fail('C5', f'{rel}: `.wrap` 的 max-width 是 '
                       f'{got.group(0) if got else "<缺失>"}，契约要求 {WRAP_WIDTH}')
        else:
            ok('C5', f'{rel}: .wrap {WRAP_WIDTH}')


def lang_check() -> None:
    """C7 —— 兜底字面量是 'en'；存储键前缀与所在子项目一致。"""
    for rel in NAV_PAGES:
        sub = rel.split('/')[0]
        src = inline_script(rel)

        fn = _block(src, 'function resolveLang')
        if fn is None:
            fail('C7', f'{rel}: 抽不出 `resolveLang()`')
        else:
            ret = re.findall(r"return\s+'(en|zh)'\s*;", fn)
            if ret != ['en']:
                fail('C7', f'{rel}: `resolveLang()` 的兜底 return 是 {ret or "<找不到字面量>"}，'
                           "契约要求 'en'（子项目默认英文）")
            else:
                ok('C7', f"{rel}: resolveLang() 兜底 'en'")

        tfn = _block(src, 'function t')
        if tfn is None:
            fail('C7', f'{rel}: 抽不出 `t()`')
        elif not re.search(r's\[LANG\]\s*!=\s*null\s*\?\s*s\[LANG\]\s*:\s*s\.en', tfn):
            fail('C7', f'{rel}: `t()` 缺 key 时的兜底不是 `s.en`——'
                       '兜底成 zh 会让英文页面突然冒出中文')
        else:
            ok('C7', f'{rel}: t() 兜底 s.en')

        keys = set(re.findall(r"'([a-z]+)-(?:lang|nav)'", src))
        stray = keys - {sub}
        if stray:
            fail('C7', f'{rel}: 出现了不属于本子项目的存储键前缀 {sorted(stray)}'
                       f'（应当只有 {sub!r}）')
        elif keys:
            ok('C7', f'{rel}: 存储键前缀 {sub}-')
        else:
            fail('C7', f'{rel}: 找不到任何 `<sub>-lang` / `<sub>-nav` 存储键')


def frame_nav_check() -> None:
    """C8 —— 换页走 `contentWindow.location.replace`；`frame.src =` 只许作为
    `setFrame()` 里 contentWindow 为假值时的退路出现，别处一次都不许有。

    ⚠ 简报把这一条写成「不出现禁用形状 `frame.src =`」。实测：四个壳（含主站
      `app.html`）各有**恰好一处** `frame.src = url;`，位置都在 `setFrame()` 的
      try/catch 之后，是设计里写明的边缘情形退路。照字面写这道门会当场把现有
      的正确代码全判红。真正的条款是**位置**而不是**存在**，所以这里查的是
      「恰好一次，且在 setFrame 体内、在 location.replace 之后」。
    """
    for rel in SHELLS + ['app.html']:
        src = inline_script(rel)
        n_replace = len(re.findall(r'contentWindow\.location\.replace\s*\(', src))
        if n_replace != 1:
            fail('C8', f'{rel}: `contentWindow.location.replace(` 出现 {n_replace} 次（需恰好 1 次）')
        body = _block(src, 'function setFrame')
        if body is None:
            fail('C8', f'{rel}: 抽不出 `setFrame()`')
            continue
        assigns = [m.start() for m in re.finditer(r'\bframe\.src\s*=', src)]
        inside = [m.start() for m in re.finditer(r'\bframe\.src\s*=', body)]
        if len(assigns) != 1 or len(inside) != 1:
            fail('C8', f'{rel}: `frame.src =` 全页出现 {len(assigns)} 次、setFrame() 内 '
                       f'{len(inside)} 次（契约：恰好一处，且只在 setFrame() 里做退路）')
            continue
        r_pos = body.find('contentWindow.location.replace')
        if r_pos < 0 or r_pos > inside[0]:
            fail('C8', f'{rel}: `setFrame()` 里 `frame.src =` 没有排在 '
                       '`contentWindow.location.replace` 之后——退路跑到了主路前面')
        else:
            ok('C8', f'{rel}: setFrame() = replace 优先 + 单处 src 退路')


# ---------------------------------------------------------------- 求值型条款
#
# 下面两条静态扫不出来，要真把页面脚本跑一遍：
#   · btnAlone 的 `?v=` 与 iframe 的 `?v=` 同值（裁决 R45）。三个子项目的壳里
#     这两处是**各写一份**的表达式，不是共用 srcFor()——所以只比对其中一处
#     的验证脚本会在另一处被写死时全部报 PASS，T11 的自审脚本正是栽在这里。
#   · `TOOLS` / `FALLBACK` / `<分组>_LABELS` 三个绑定存在且非空。T11 自审时误删过
#     `var TOOLS = FALLBACK;`——语法合法、语法门全绿，而整页语义全坏。

PROBE_JS = r'''
'use strict';
const fs = require('fs');
const vm = require('vm');

const src  = fs.readFileSync(process.argv[2], 'utf8');
const spec = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

function makeEl(id) {
  const classes = new Set();
  const el = {
    id: id, tagName: 'DIV', textContent: '', innerHTML: '', title: '', href: '',
    value: '', className: '', hidden: false, lang: '', isContentEditable: false,
    dataset: {}, style: {}, children: [], parentNode: null,
    classList: {
      add: function (c) { classes.add(c); },
      remove: function (c) { classes.delete(c); },
      toggle: function (c, on) {
        if (on === undefined) { classes.has(c) ? classes.delete(c) : classes.add(c); }
        else if (on) { classes.add(c); } else { classes.delete(c); }
      },
      contains: function (c) { return classes.has(c); }
    },
    addEventListener: function () {}, removeEventListener: function () {},
    setAttribute: function (k, v) { el[k] = v; },
    getAttribute: function (k) { return el[k] === undefined ? null : el[k]; },
    appendChild: function (c) { el.children.push(c); return c; },
    insertBefore: function (c) { el.children.push(c); return c; },
    removeChild: function () {}, remove: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    closest: function () { return null; },
    focus: function () {}, blur: function () {}, click: function () {},
    scrollIntoView: function () {},
    getBoundingClientRect: function () {
      return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    },
    getContext: function () { return null; },
    contentDocument: null
  };
  /* iframe：给它一个 contentWindow，这样 setFrame() 走的是契约要求的
     location.replace 那条路，而不是 frame.src 退路——顺带把 URL 录下来，
     它就是「壳里那一份」地址的真身。 */
  if (id === 'frame') {
    el.contentWindow = { location: { replace: function (u) { el.__replaced = u; } } };
  } else {
    el.contentWindow = null;
  }
  return el;
}

const els = Object.create(null);
function byIdEl(id) {
  if (!els[id]) els[id] = makeEl(id);
  return els[id];
}

const store = Object.create(null);
/* 预置「已拒绝」：`apply_footer.py` 铺进每个导航页的 GA 同意代码块在没有选择时
   会弹横幅，而横幅要 querySelectorAll('button')[0] —— 一个真 DOM 才给得出的东西。
   本门不测 GA，也不该为了它去实现一套选择器引擎。'denied' 这条路径既不弹横幅也
   不加载 GA，正好把那一段整个跳过。键名与 apply_footer.py 的 CONSENT_KEY 一致。 */
store['mathviz-consent'] = 'denied';
const doc = {
  title: '',
  documentElement: makeEl('html'),
  body: makeEl('body'),
  getElementById: byIdEl,
  createElement: function (tag) { const e = makeEl(null); e.tagName = String(tag).toUpperCase(); return e; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  addEventListener: function () {}, removeEventListener: function () {},
  createDocumentFragment: function () { return makeEl(null); }
};

const win = {
  document: doc,
  location: {
    protocol: 'file:', href: 'file:///repo/' + spec.rel, pathname: '/repo/' + spec.rel,
    search: '', hash: '', origin: 'null',
    replace: function () {}, assign: function () {}, reload: function () {}
  },
  history: { pushState: function () {}, replaceState: function () {}, state: null },
  localStorage: {
    getItem: function (k) { return k in store ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  navigator: { language: 'en-GB', clipboard: undefined },
  matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
  addEventListener: function () {}, removeEventListener: function () {},
  requestAnimationFrame: function () { return 0; }, cancelAnimationFrame: function () {},
  setTimeout: function () { return 0; }, clearTimeout: function () {},
  setInterval: function () { return 0; }, clearInterval: function () {},
  getComputedStyle: function () { return {}; },
  URLSearchParams: URLSearchParams, URL: URL,
  console: { log: function () {}, warn: function () {}, error: function () {} },
  /* fetch 一律失败：契约要求的就是 file:// 那条路——内嵌 FALLBACK 是唯一数据源。
     顺带让「求值后 TOOLS 非空」这一条真正测到 FALLBACK，而不是测到网络。 */
  fetch: function () { return Promise.reject(new Error('offline')); }
};
win.window = win;
/* self === top：页面里的 GA 代码块靠 `window.self !== window.top` 判断「我在
   iframe 里吗」，相等就整段跳过。本门不测 GA。 */
win.self = win;
win.top = win;
win.globalThis = win;

const ctx = vm.createContext(win);
const out = { rel: spec.rel, errors: [], bindings: {}, pairs: [] };

let threw = false;
try {
  vm.runInContext(src, ctx, { filename: spec.rel, timeout: 20000 });
} catch (e) {
  threw = true;
  out.errors.push('页面脚本求值抛出：' + (e && e.message ? e.message : String(e)));
}

/* 求值抛出之后**仍然**去读那三个绑定，不提前 return。
   负控制实测：删掉 `var TOOLS = FALLBACK;` 时，页面在 boot() 里就崩了，提前
   return 会让报错停在「求值抛出：TOOLS is not defined」——门确实红了，但红的
   理由是崩溃而不是断言，和一道**跑都没跑到断言**的假门长得一模一样。继续读
   绑定，诊断才会指着真正的那一条。 */

/* ---- 绑定存在且非空 ---- */
for (const name of spec.bindings) {
  let v;
  try { v = ctx[name]; } catch (e) { v = undefined; }
  let size = -1;
  if (Array.isArray(v)) size = v.length;
  else if (v && typeof v === 'object') size = Object.keys(v).length;
  out.bindings[name] = { type: v === undefined ? 'undefined' : (Array.isArray(v) ? 'array' : typeof v), size: size };
}

/* ---- btnAlone 的 ?v= 必须与 iframe 的 ?v= 同值 ---- */
if (spec.kind === 'shell' && !threw) {
  const ids = [null];
  const tools = ctx.TOOLS;
  if (Array.isArray(tools)) for (const d of tools) ids.push(d.id);
  for (const id of ids) {
    try {
      ctx.curId = id;
      ctx.renderChrome();
      const alone = byIdEl('btnAlone').href;
      const frameEl = byIdEl('frame');
      frameEl.__replaced = null;
      ctx.setFrame(ctx.srcFor(id));
      const inside = frameEl.__replaced;
      out.pairs.push({ id: id, alone: alone, frame: inside });
    } catch (e) {
      out.errors.push('curId=' + JSON.stringify(id) + ' 求值失败：' + (e && e.message ? e.message : String(e)));
    }
  }
}

console.log(JSON.stringify(out));
'''


def _vparam(url: str | None) -> str | None:
    if not url:
        return None
    m = re.search(r'[?&]v=([^&]*)', url)
    return m.group(1) if m else None


def _run_probe(rel: str, spec: dict) -> dict:
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        (d / 'probe.js').write_text(PROBE_JS, encoding='utf-8')
        (d / 'page.js').write_text(inline_script(rel), encoding='utf-8')
        (d / 'spec.json').write_text(json.dumps(spec), encoding='utf-8')
        # 只传短路径，不传脚本内容：Linux 的 MAX_ARG_STRLEN 是 128 KiB/参数。
        r = subprocess.run(['node', str(d / 'probe.js'), str(d / 'page.js'), str(d / 'spec.json')],
                           capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        return {'rel': rel, 'errors': [f'node 退出码 {r.returncode}：{r.stderr.strip()[:400]}'],
                'bindings': {}, 'pairs': []}
    try:
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as e:                                     # noqa: BLE001
        return {'rel': rel, 'errors': [f'探针输出不是 JSON（{e}）：{r.stdout[:200]}'],
                'bindings': {}, 'pairs': []}


def eval_checks() -> None:
    for rel in NAV_PAGES:
        sub = rel.split('/')[0]
        kind = 'shell' if rel.endswith('app.html') else 'gallery'
        bindings = ['TOOLS', 'FALLBACK', GROUP_LABELS[sub]]
        res = _run_probe(rel, {'rel': rel, 'kind': kind, 'bindings': bindings})

        for e in res['errors']:
            fail('求值', f'{rel}: {e}')

        for name in bindings:
            info = res['bindings'].get(name)
            if info is None or info['type'] == 'undefined':
                fail('绑定', f'{rel}: 求值后 `{name}` 不存在——'
                             '语法门看不见这件事（语法合法，语义全坏）')
            elif info['size'] <= 0:
                fail('绑定', f'{rel}: 求值后 `{name}` 是空的（{info["type"]}，0 项）')
            else:
                ok('绑定', f'{rel}: {name} = {info["type"]}[{info["size"]}]')

        if kind != 'shell':
            continue
        if not res['pairs']:
            fail('C1', f'{rel}: 一对 btnAlone / iframe 地址都没测到——'
                       '要么 TOOLS 是空的，要么 renderChrome() 没跑起来')
        for p in res['pairs']:
            who = p['id'] or '<画廊 home>'
            if not p['alone'] or not p['frame']:
                fail('C1', f'{rel}: curId={who} 时地址缺失（btnAlone={p["alone"]!r} '
                           f'iframe={p["frame"]!r}）')
                continue
            va, vf = _vparam(p['alone']), _vparam(p['frame'])
            if va is None or vf is None:
                fail('C1', f'{rel}: curId={who} 的地址上没有 ?v= 缓存键'
                           f'（btnAlone={p["alone"]} iframe={p["frame"]}）')
            elif va != vf:
                fail('C1', f'{rel}: curId={who} 的 btnAlone 版本戳是 v={va}，'
                           f'iframe 却是 v={vf}——「壳里是新版、单开是旧版」'
                           f'（btnAlone={p["alone"]} iframe={p["frame"]}）')
            else:
                ok('C1', f'{rel}: curId={who} 两处同为 v={va}')


def main() -> int:
    verbose = '-v' in sys.argv or '--verbose' in sys.argv

    missing = [rel for rel in NAV_PAGES + [ROOT_INDEX, 'app.html'] if not (ROOT / rel).exists()]
    if missing:
        print(f'ERROR: 缺页面 {missing}', file=sys.stderr)
        return 1

    shared_block_check()
    parent_home_check()
    top_target_check()
    card_check()
    wrap_width_check()
    lang_check()
    frame_nav_check()
    eval_checks()

    if verbose:
        for p in passes:
            print(f'  ok  {p}')

    if failures:
        print(f'导航契约不通过：{len(failures)} 条', file=sys.stderr)
        for f in failures:
            print(f'  ✗ {f}', file=sys.stderr)
        print('契约：docs/superpowers/subproject-nav-contract.md', file=sys.stderr)
        return 1

    print(f'导航契约：{len(NAV_PAGES)} 个子项目导航页 + 根 index.html/app.html，'
          f'{len(passes)} 项断言全部通过')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
