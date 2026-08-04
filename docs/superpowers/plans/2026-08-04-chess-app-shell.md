# chess 子项目导航壳 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 chess 子项目一个自己的导航壳 `chess/app.html`——左侧按阶段分组的工具列表，右侧 iframe 装工具整页——并把两道扫不到根级页面的 gate 补齐。

**Architecture:** 结构照搬主站 `app.html`（侧边栏 + iframe 舞台 + `home` 项装画廊 + `?tool=&lang=` 深链 + `history.pushState`），工具页一行不改、仍可独立打开。数据取自 `chess-tools.json`，`file://` 下回落到内嵌的 `FALLBACK`——这份副本因此从一份变两份，`check.py` 的一致性门必须跟着扩，否则第二份会安静地腐烂。

**Tech Stack:** 单文件 HTML + 原生 JS（无框架、无构建、无依赖）；Python 3 写 gate；`node --check` 做语法门。

**Spec:** `docs/superpowers/specs/2026-08-04-chess-app-shell-design.md`

## Global Constraints

- **单文件、零依赖**：`chess/app.html` 不得引入任何外部脚本/样式/字体；不得有构建步骤。
- **不改工具页**：`chess/tools/*.html` 一个字节都不动。工具必须仍能被独立打开。
- **不改主站除一行外的任何东西**：主站唯一允许的改动是 `index.html` 里 `id="chessCard"` 那个 `<a>` 的 `href`。不得碰 `tools.json`、`app.html`、`scripts/sync_registry.py`（规格 §9 的 YAGNI 条款）。
- **默认语言 en**：`resolveLang()` 与 `t()` 的两处兜底都是 `'en'`，不是 `'zh'`。`localStorage` 键是 `'chess-lang'`。语义必须与 `chess/core/viz-engine.js` 一致。
- **所有面向使用者的文案是 `{zh, en}` 对象**，经 `t()` 渲染；语言切换即时生效，不许等刷新。
- **设计令牌照抄**：`:root` 里的 CSS 变量与 `chess/index.html` 的那一份逐字一致（`--bg-deep` `#05070d`、`--bg-mid` `#0c1526`、`--trace-cyan` `#2dd4ea`、`--trace-rose` `#fb7185`、`--trace-violet` `#a78bfa`、`--trace-emerald` `#34d399`、`--trace-orange` `#fb923c`、`--ui-slate` `#9fb0c8`、`--ui-bright` `#e2e8f0`、`--panel-bg` `rgba(13,20,36,.74)`、`--panel-line` `rgba(148,163,184,.16)`，三个字体栈同样照抄）。
- **`chess/app.html` 不进 `chess-tools.json`**：它是壳不是工具（主站 `app.html` 同样不在 `tools.json` 里）。
- **每次改完跑 `python3 chess/scripts/check.py`，必须 exit 0。**
- **提交只 stage 明确路径**，禁止 `git add -A` / `git commit -a`（仓库有并行 session）。

## 基线数字（在 `origin/main` = `02c9990`，即阶段 4 合并之后实测，不是估的）

```
node --check：7 个文件、14 个脚本块通过
FALLBACK 一致性：4 个 id 全部对上
```

本计划完成后应为：

```
node --check：9 个文件、16 个脚本块通过
FALLBACK 一致性：2 份内嵌副本 · 4 个 id 全部对上
```

`7 → 9` 是加上 `chess/index.html` 与 `chess/app.html` 两个根级页面；`14 → 16` 是这两页各含一个 `<script>` 块（`chess/tools/` 下 7 个文件各 2 块 = 14，已逐文件核过）。

**注意 `4 个 id`**：阶段 4 已交付并注册了工具④ `chess-search-minimax`（`accent: orange`、`phase: 4`）。`chess/app.html` 的 `FALLBACK` 必须是**四条**，少一条门就会红——这正是这道门存在的意义。

## 与阶段 4 的关系

阶段 4 已合并（PR #86，`02c9990`），本分支已 rebase 到其上，`check.py` 的冲突面因此消失——Task 1 直接改的就是合并后的版本。`check.py` 仍单独成一个 commit，理由改为「它是门的改动，与壳的改动性质不同，分开便于回溯」。

阶段 4 同时给 `check.py` 加了两道新门（`js_string_literal` HTML 安全检查、`ALGOS` 往返校验），本计划不碰它们；`algos_roundtrip_check()` 里另有一处 `(ROOT / 'tools').glob('*.html')`（约第 151 行），那是在校验工具页内联的算法源码，**不应**扩到根级页面——根级页面里没有 `ALGOS`。只改 `node_check()` 与 `fallback_check()` 两处。

## File Structure

| 文件 | 责任 |
|---|---|
| `chess/app.html`（新建） | 导航壳：侧边栏渲染、iframe 导航、深链、语言、折叠。唯一的新文件。 |
| `chess/scripts/check.py`（改） | 两道 gate 扩到根级页面：`node --check` 与 FALLBACK 一致性。 |
| `chess/index.html`（改，仅 2 处） | 工具卡片的 `href` 改为跳进壳；`.back` 链接不动。 |
| `index.html`（主站，改 1 行） | `id="chessCard"` 的 `href` 指向 `chess/app.html`。 |

---

## Task 1: 两道 gate 扩到根级页面，并建起壳的骨架

这一 task 的顺序就是 TDD：**先让门红**（它在抱怨「根级页面只有一个」），**再建 `chess/app.html` 让它绿**。门在这里就是测试——被测的是两份静态资产的一致性，没有可 `require()` 的模块可测。

**Files:**
- Modify: `chess/scripts/check.py`（`node_check()` 约第 36 行、`fallback_check()` 约第 78–98 行）
- Create: `chess/app.html`

**Interfaces:**
- Consumes: `chess/chess-tools.json` 的 `{tools: [{id, file, accent, phase, kicker, title, tag}]}`
- Produces: `chess/app.html` 里名为 `FALLBACK` 的顶层 `var` 数组，元素形如 `{ id: '...', file: 'tools/....html', accent: '...', phase: N, kicker: {en,zh}, title: {en,zh}, tag: {en,zh} }`；Task 2/3/4 直接在这个文件上继续写 JS。
- Produces: `check.py` 的模块级函数 `root_pages() -> list[pathlib.Path]`，被 `node_check()` 与 `fallback_check()` 共用。

- [ ] **Step 1: 在 `check.py` 里加共用的 `root_pages()`，并把两道门接上去**

在 `STDIN_LINE_RE` 定义之后、`node_check()` 定义之前，插入：

```python
# 根级页面 = chess/index.html 与 chess/app.html。它们不在 tools/ 下，于是
# 长期躲过了这个文件里的两道门：node_check() 只 glob('tools/*.html')，而 CI
# 的语法门（.github/workflows/registry-sync.yml）扫的是主站的 app.html /
# index.html / outputs/*.html，不含 chess/。两边合起来的结果是 chess/index.html
# 从来没有被任何语法门覆盖过——一个纯 JS 驱动的导航页，语法错了就是整页白屏，
# 而所有门都报绿。
ROOT_PAGE_MIN = 2
def root_pages() -> list:
    """chess/ 根目录下的 html 页面，按文件名排序。

    钉住「至少 ROOT_PAGE_MIN 个」而不是只写一句 glob：本仓库已经栽过两次同类
    的坑——core_tests() 用 glob 而非 rglob，于是 core/algos/minimax.test.js
    整个测试文件在门外躺着没人跑，直到阶段 4 的实现者报上来。遍历漏光了会
    安静地全绿，正是这道门要防的失败模式本身。
    """
    return sorted(ROOT.glob('*.html'))
```

- [ ] **Step 2: 把 `node_check()` 的扫描范围扩到根级页面**

把 `node_check()` 里这一行：

```python
    tools = sorted((ROOT / 'tools').glob('*.html'))
```

替换为：

```python
    pages = root_pages()
    if len(pages) < ROOT_PAGE_MIN:
        print(f'ERROR: chess/ 根级页面只找到 {len(pages)} 个，至少要 {ROOT_PAGE_MIN} 个'
              f'（index.html 与 app.html）——glob 漏了或文件被挪走了',
              file=sys.stderr)
        return 1
    tools = sorted((ROOT / 'tools').glob('*.html')) + pages
```

（函数体后面的 `for path in tools:` 与末尾的 `print(f'node --check：{len(tools)} 个文件…')` 都不用改，它们读的就是 `tools`。）

- [ ] **Step 3: 把 `fallback_check()` 改成遍历所有内嵌了 FALLBACK 的根级页面**

把 `fallback_check()` 的**函数体**（docstring 之后、`return 0` 之前的全部代码）替换为：

```python
    tools_path = ROOT / 'chess-tools.json'
    registry = json.loads(tools_path.read_text(encoding='utf-8'))
    registry_ids = {t['id'] for t in registry['tools']}

    pages = root_pages()
    if len(pages) < ROOT_PAGE_MIN:
        print(f'ERROR: chess/ 根级页面只找到 {len(pages)} 个，至少要 {ROOT_PAGE_MIN} 个',
              file=sys.stderr)
        return 1

    rc = 0
    copies = 0
    for page in pages:
        text = page.read_text(encoding='utf-8')
        m = re.search(r'var FALLBACK = \[(.*?)\n\];', text, re.DOTALL)
        if not m:
            print(f'ERROR: {page.name} 里找不到 FALLBACK 数组'
                  f'（每个根级页面都要能在 file:// 下自己渲染出导航）', file=sys.stderr)
            rc = 1
            continue
        copies += 1
        fallback_ids = set(FALLBACK_ID_RE.findall(m.group(1)))
        if fallback_ids != registry_ids:
            missing = registry_ids - fallback_ids
            extra = fallback_ids - registry_ids
            print(f'ERROR: {page.name} 的 FALLBACK 与 chess-tools.json 的 id 集合不一致',
                  file=sys.stderr)
            if missing:
                print(f'  FALLBACK 里缺失：{sorted(missing)}', file=sys.stderr)
            if extra:
                print(f'  FALLBACK 里多余（chess-tools.json 里已经没有）：{sorted(extra)}',
                      file=sys.stderr)
            rc = 1

    if copies < ROOT_PAGE_MIN:
        print(f'ERROR: 只找到 {copies} 份内嵌 FALLBACK，至少要 {ROOT_PAGE_MIN} 份', file=sys.stderr)
        rc = 1
    if rc == 0:
        print(f'FALLBACK 一致性：{copies} 份内嵌副本 · {len(registry_ids)} 个 id 全部对上')
    return rc
```

同时把该函数 docstring 的第一行由

```
    """chess/index.html 内嵌的 FALLBACK 列表，id 集合必须与 chess-tools.json 一致。
```

改为

```
    """每个根级页面内嵌的 FALLBACK 列表，id 集合必须与 chess-tools.json 一致。
```

- [ ] **Step 4: 跑门，确认它现在是红的，且红在我预期的那句话上**

Run: `cd /path/to/worktree && python3 chess/scripts/check.py; echo "exit=$?"`

Expected: `exit=1`，且 stderr 里同时出现这两行（因为此刻 `chess/app.html` 还不存在，根级页面只有 `index.html` 一个）：

```
ERROR: chess/ 根级页面只找到 1 个，至少要 2 个（index.html 与 app.html）——glob 漏了或文件被挪走了
```

**如果它是绿的，停下来**——说明 `root_pages()` 没接上，后面做什么都没意义。

- [ ] **Step 5: 建 `chess/app.html`——结构、样式、数据、i18n 基础**

创建 `chess/app.html`，完整内容如下。这一步只建到「静态骨架 + 数据 + 语言解析」为止；侧边栏渲染在 Task 2、导航在 Task 3、语言与折叠在 Task 4。

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="description" content="Chess teaching tools — navigation shell. 国际象棋教学工具导航壳。">
<!-- 版本记录（changelog，新→旧）：
     1.0.0  2026-08-04  首发：子项目导航壳。左侧按阶段分组列出工具，右侧 iframe 装
                        工具整页；home 项装 chess/index.html 当画廊。?tool=<id> 深链、
                        ?lang= 贯穿壳与工具、Ctrl/Cmd+B 与 [ 折叠侧边栏。
                        工具页一行未改，仍可独立打开。 -->
<meta name="tool-version" content="1.0.0">
<title>Chess Teaching Tools · 国际象棋教学工具</title>
<!-- 子项目导航壳。**不是工具**，所以不进 chess/chess-tools.json（主站的 app.html
     同样不在 tools.json 里）。结构照搬主站 app.html：侧边栏 + iframe 舞台。
     用 iframe 而不是把工具注入本页——CLAUDE.md 写明的理由：每个工具是一整页，
     有自己的顶层 state/cam、全屏 canvas 与键盘绑定，两个塞进同一个文档必然互踩。
     设计令牌与 i18n 语义与 chess/index.html 逐字同源。 -->
<style>
:root{
  --bg-deep:#05070d;
  --bg-mid:#0c1526;
  --trace-cyan:#2dd4ea;
  --trace-rose:#fb7185;
  --trace-violet:#a78bfa;
  --trace-emerald:#34d399;
  --trace-orange:#fb923c;
  --ui-slate:#9fb0c8;
  --ui-bright:#e2e8f0;
  --panel-bg:rgba(13,20,36,.74);
  --panel-line:rgba(148,163,184,.16);
  --font-cn:ui-sans-serif,-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif;
  --font-mono:ui-monospace,"SF Mono",Menlo,Consolas,"Cascadia Mono",monospace;
  --font-math:Georgia,"Times New Roman","Songti SC","Noto Serif SC",serif;
  --sb-w:246px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%;overflow:hidden}
body{background:var(--bg-deep);color:var(--ui-bright);font-family:var(--font-cn);-webkit-font-smoothing:antialiased}

.shell{display:flex;height:100vh;height:100dvh;width:100%}
.sidebar{flex:0 0 var(--sb-w);width:var(--sb-w);height:100%;display:flex;flex-direction:column;
  background:linear-gradient(180deg,rgba(12,21,38,.96),rgba(5,7,13,.96));
  border-right:1px solid var(--panel-line);transition:margin-left .22s ease}
.shell.hid .sidebar{margin-left:calc(-1 * var(--sb-w))}

.sb-head{display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:14px 12px 10px;border-bottom:1px solid var(--panel-line)}
.brand{display:block;text-decoration:none;color:inherit}
.brand .eyebrow{font-size:9.5px;letter-spacing:.2em;color:rgba(159,176,200,.62);text-transform:uppercase}
.brand .name{margin-top:3px;font-family:var(--font-math);font-weight:600;font-size:17px;
  letter-spacing:.04em;color:#eaf1fb;transition:color .15s}
.brand:hover .name{color:#bfefff}
.iconbtn{flex:none;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;
  background:rgba(5,7,13,.6);border:1px solid var(--panel-line);border-radius:8px;
  color:var(--ui-slate);font-size:12px;cursor:pointer;transition:border-color .15s,color .15s}
.iconbtn:hover{border-color:rgba(45,212,234,.5);color:#bfefff}
.iconbtn:focus-visible{outline:2px solid rgba(45,212,234,.85);outline-offset:2px}

.sb-list{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:6px 8px 14px}
.sb-list::-webkit-scrollbar{width:8px}
.sb-list::-webkit-scrollbar-thumb{background:rgba(148,163,184,.24);border-radius:8px}

.grp{margin:13px 6px 5px;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;
  color:rgba(159,176,200,.55)}
.item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;
  padding:8px 10px;margin:2px 0;border-radius:10px;cursor:pointer;
  background:transparent;border:1px solid transparent;color:var(--ui-slate);
  font-family:var(--font-cn);font-size:12.5px;line-height:1.35;transition:background .15s,border-color .15s,color .15s}
.item:hover{background:rgba(45,212,234,.07);border-color:rgba(148,163,184,.2);color:#eaf1fb}
.item:focus-visible{outline:2px solid rgba(45,212,234,.85);outline-offset:-2px}
.item .dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--c,var(--ui-slate));
  box-shadow:0 0 8px var(--c,transparent)}
.item .tx{flex:1;min-width:0}
.item.on{background:rgba(45,212,234,.12);border-color:rgba(45,212,234,.42);color:#fff}
.item.on .tx{font-weight:600}
.item.home{margin-bottom:2px}
.item.home .dot{background:transparent;border:1.5px dashed rgba(159,176,200,.55);box-shadow:none;
  width:9px;height:9px}

.sb-foot{display:flex;align-items:center;gap:8px;padding:10px 12px;
  border-top:1px solid var(--panel-line)}
.sb-foot .sp{flex:1}
.sb-foot a,.sb-foot button{font-family:var(--font-mono);font-size:11px;letter-spacing:.04em;
  color:rgba(159,176,200,.8);text-decoration:none;background:rgba(5,7,13,.6);
  border:1px solid var(--panel-line);border-radius:7px;padding:4px 9px;cursor:pointer;
  transition:border-color .15s,color .15s}
.sb-foot a:hover,.sb-foot button:hover{border-color:rgba(45,212,234,.5);color:#bfefff}
.sb-foot a:focus-visible,.sb-foot button:focus-visible{outline:2px solid rgba(45,212,234,.85);outline-offset:2px}

.stage{position:relative;flex:1;min-width:0;height:100%;background:var(--bg-deep)}
#frame{display:block;width:100%;height:100%;border:0;background:var(--bg-deep)}

.edge{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:30;
  display:none;align-items:center;justify-content:center;width:22px;height:56px;
  background:rgba(13,20,36,.86);border:1px solid var(--panel-line);border-left:0;
  border-radius:0 10px 10px 0;color:var(--ui-slate);font-size:11px;cursor:pointer;
  transition:background .15s,color .15s,border-color .15s}
.edge:hover{background:rgba(20,30,52,.94);color:#bfefff;border-color:rgba(45,212,234,.5)}
.edge:focus-visible{outline:2px solid rgba(45,212,234,.85);outline-offset:2px}
.shell.hid .edge{display:flex}

/* 窄屏：侧边栏浮在舞台之上，点击遮罩收起 */
.scrim{display:none}
@media (max-width:760px){
  .sidebar{position:fixed;left:0;top:0;z-index:25;box-shadow:0 0 60px rgba(0,0,0,.6)}
  .shell:not(.hid) .scrim{display:block;position:fixed;inset:0;z-index:20;background:rgba(5,7,13,.55)}
}
</style>
</head>
<body>

<div class="shell" id="shell">
  <aside class="sidebar" id="sidebar" aria-label="Chess tools">
    <div class="sb-head">
      <a class="brand" id="brandLink" href="../index.html">
        <div class="eyebrow">Interactive Chess</div>
        <div class="name" id="brandName">Chess</div>
      </a>
      <button class="iconbtn" id="btnHide" type="button">❮</button>
    </div>
    <nav class="sb-list" id="navList"></nav>
    <div class="sb-foot">
      <button id="btnLang" type="button">中</button>
      <span class="sp"></span>
      <a id="btnAlone" href="index.html" target="_blank" rel="noopener">↗</a>
    </div>
  </aside>

  <div class="scrim" id="scrim"></div>
  <button class="edge" id="btnShow" type="button">❯</button>

  <main class="stage">
    <iframe id="frame" title="Chess tool" allow="fullscreen"></iframe>
  </main>
</div>

<script>
'use strict';

/* ================= i18n =================
   与 chess/index.html 同源的那 15 行（它自己也是从 chess/core/viz-engine.js
   抄来的）。语义必须一致：存储键 chess-lang，两处兜底都是 en 不是 zh——
   否则缺 key 时英文页面会突然冒出中文。 */
var LANG_KEY = 'chess-lang';
var NAV_KEY = 'chess-nav';
function resolveLang() {
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'zh') return q;
    var s = localStorage.getItem(LANG_KEY);
    if (s === 'en' || s === 'zh') return s;
  } catch (e) { /* file:// 下 localStorage 可能不可用 */ }
  return 'en';
}
var LANG = resolveLang();
function t(s) { return (s && typeof s === 'object') ? (s[LANG] != null ? s[LANG] : s.en) : s; }
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ================= 回退列表 =================
   运行时优先 fetch('chess-tools.json')；file:// 下 fetch 会因同源限制失败，
   靠这份内嵌副本兜底——一个在 file:// 下只剩 home 一项的导航壳等于没有。
   代价是这份副本与 chess/index.html 里的那份都要跟注册表同步，由
   chess/scripts/check.py 的 fallback_check() 逐页比对 id 集合来保证。 */
var FALLBACK = [
  {
    id: 'chess-moves-geometry', file: 'tools/chess-moves-geometry.html', accent: 'rose', phase: 1,
    kicker: { en: 'Rules', zh: '规则' },
    title: { en: 'Geometry of Movement', zh: '走法的几何本质' },
    tag: { en: 'attack domain · min-move field · mobility', zh: '攻击域 · 最少步数场 · 机动性' }
  },
  {
    id: 'chess-rules-check-mate', file: 'tools/chess-rules-check-mate.html', accent: 'violet', phase: 1,
    kicker: { en: 'Rules', zh: '规则' },
    title: { en: 'Rules, Legality and Mate', zh: '规则、合法性与将杀' },
    tag: { en: 'pseudo-legal minus legal · castling · mate', zh: '伪合法减合法 · 易位 · 将杀' }
  },
  {
    id: 'chess-game-replay', file: 'tools/chess-game-replay.html', accent: 'emerald', phase: 2,
    kicker: { en: 'Games', zh: '棋局' },
    title: { en: 'Reading a Game', zh: '读懂一局棋' },
    tag: { en: '30 games · piece traces · evaluation curves · heat map', zh: '30 局棋谱 · 子力轨迹 · 评估曲线 · 热力图' }
  },
  {
    id: 'chess-search-minimax', file: 'tools/chess-search-minimax.html', accent: 'orange', phase: 4,
    kicker: { en: 'Search', zh: '搜索' },
    title: { en: 'Game Trees and Search', zh: '博弈树与搜索' },
    tag: { en: 'minimax · alpha-beta · move ordering · Shannon number', zh: '极小极大 · α-β 剪枝 · 走法排序 · 香农数' }
  }
];
var TOOLS = FALLBACK;

/* 阶段标签与 chess/index.html 的 PHASE_LABELS 逐条同源（它已经有阶段 4 了）。
   缺的阶段有兜底，阶段 5 的工具一进注册表就能自己长出分组，不必回来改这里。 */
var PHASE_LABELS = {
  1: { en: 'Phase 1 · Rules Crash Course', zh: '阶段 1 · 规则速成' },
  2: { en: 'Phase 2 · Game Replay', zh: '阶段 2 · 棋谱回放' },
  4: { en: 'Phase 4 · Search and Game Trees', zh: '阶段 4 · 搜索与博弈树' }
};
function phaseLabel(n) { return PHASE_LABELS[n] || { en: 'Phase ' + n, zh: '阶段 ' + n }; }

var L = {
  title: { en: 'Chess Teaching Tools · MathViz', zh: '国际象棋教学工具 · MathViz' },
  brand: { en: 'Chess', zh: '国际象棋' },
  home: { en: 'All tools · Gallery', zh: '全部工具 · 画廊' },
  hide: { en: 'Hide sidebar', zh: '收起侧栏' },
  show: { en: 'Show sidebar', zh: '展开侧栏' },
  alone: { en: 'Open current tool in a new tab', zh: '在新标签页单独打开当前工具' },
  back: { en: 'Back to MathViz', zh: '返回 MathViz' }
};

/* ================= DOM 引用与状态 ================= */
var shell = document.getElementById('shell');
var navList = document.getElementById('navList');
var frame = document.getElementById('frame');
var curId = null;      // null = home（iframe 里装画廊）
var syncing = false;   // 见 Task 3：区分「壳驱动的换页」与「使用者在画廊里点了卡片」
</script>
</body>
</html>
```

- [ ] **Step 6: 跑门，必须全绿，且两行数字变成预期值**

Run: `python3 chess/scripts/check.py; echo "exit=$?"`

Expected: `exit=0`，输出里出现：

```
node --check：9 个文件、16 个脚本块通过
FALLBACK 一致性：2 份内嵌副本 · 4 个 id 全部对上
```

- [ ] **Step 7: 变异验证——三处，每处必须让门变红**

这一步是本 task 最重要的一步。没有它，「门扩过了」只是一句自称。**每次改完都要把文件改回去。**

变异 A（FALLBACK 漏同步）：把 `chess/app.html` 的 `FALLBACK` 里 `chess-game-replay` 那一整个对象删掉。
Run: `python3 chess/scripts/check.py; echo "exit=$?"`
Expected: `exit=1`，stderr 出现 `ERROR: app.html 的 FALLBACK 与 chess-tools.json 的 id 集合不一致` 与 `FALLBACK 里缺失：['chess-game-replay']`。**改回去。**

变异 B（根级页面语法错）：在 `chess/app.html` 的 `<script>` 里加一行 `var x = ;`。
Run: `python3 chess/scripts/check.py; echo "exit=$?"`
Expected: `exit=1`，stderr 出现 `ERROR: app.html 语法检查失败`，且报错行号指向你加的那一行。**改回去。**

变异 C（数量断言有牙）：把 `root_pages()` 的返回值临时改成 `sorted(ROOT.glob('index.html'))`。
Run: `python3 chess/scripts/check.py; echo "exit=$?"`
Expected: `exit=1`，stderr 出现 `根级页面只找到 1 个，至少要 2 个`。**改回去。**

- [ ] **Step 8: 提交（两个 commit，check.py 单独一个）**

`check.py` 的改动与阶段 4 那条线冲突，单独成 commit 便于择时 rebase/摘取。

```bash
git add chess/scripts/check.py
git commit -m "$(cat <<'EOF'
fix(chess): 两道门都扫不到根级页面 —— chess/index.html 从来没被语法检查过

node_check() 只 glob('tools/*.html')，而 CI 的语法门扫的是主站的
app.html / index.html / outputs/*.html，不含 chess/。两边合起来的结果是
chess/index.html 从没被任何语法门覆盖——一个纯 JS 驱动的导航页，语法错了
就是整页白屏，而所有门都报绿。

FALLBACK 一致性门同样写死了 index.html 单文件。导航壳要在 file:// 下可用
就必须内嵌第二份 FALLBACK，于是这道门必须改成遍历所有根级页面。

两处都钉住「至少 2 个根级页面」。只写遍历不钉数量是本仓库栽过两次的坑：
core_tests() 用 glob 而非 rglob，core/algos/minimax.test.js 整个测试文件
在门外躺着没人跑。遍历漏光了会安静地全绿。

三处变异各自确认有牙：删 FALLBACK 里一个 id、根级页面写语法错、把
root_pages() 缩回单文件——都变红。
EOF
)"

git add chess/app.html
git commit -m "feat(chess): 导航壳的骨架 —— 结构、令牌、数据与语言解析"
```

---

## Task 2: 侧边栏渲染

**Files:**
- Modify: `chess/app.html`（`<script>` 块末尾追加）

**Interfaces:**
- Consumes: Task 1 的 `TOOLS` / `phaseLabel()` / `L` / `t()` / `esc()` / `navList` / `curId`
- Produces: `renderNav()`（重画侧边栏，读 `TOOLS` 与 `curId`）、`byId(id) -> obj|null`、`fileOf(id) -> string|null`

- [ ] **Step 1: 追加查表与渲染函数**

在 Task 1 那段 `var syncing = false;` 之后追加：

```js
/* ================= 查表 ================= */
function byId(id) {
  for (var i = 0; i < TOOLS.length; i++) { if (TOOLS[i].id === id) return TOOLS[i]; }
  return null;
}
function fileOf(id) { var d = byId(id); return d ? d.file : null; }

/* ================= 侧边栏渲染 =================
   分组依据是 phase（主站 app.html 用的是 cat）。阶段顺序按数值升序，
   不写死 1/2——阶段 4/5 的工具进了注册表就自己长出分组。 */
function renderNav() {
  var html = '<button class="item home' + (curId === null ? ' on' : '') + '" data-id="">' +
             '<span class="dot"></span><span class="tx">' + esc(t(L.home)) + '</span></button>';

  var phases = [];
  for (var i = 0; i < TOOLS.length; i++) {
    var p = TOOLS[i].phase || 1;
    if (phases.indexOf(p) < 0) phases.push(p);
  }
  phases.sort(function (a, b) { return a - b; });

  for (var k = 0; k < phases.length; k++) {
    var ph = phases[k];
    html += '<div class="grp">' + esc(t(phaseLabel(ph))) + '</div>';
    for (var j = 0; j < TOOLS.length; j++) {
      var d = TOOLS[j];
      if ((d.phase || 1) !== ph) continue;
      html += '<button class="item' + (d.id === curId ? ' on' : '') + '"' +
              ' data-id="' + esc(d.id) + '"' +
              ' style="--c:var(--trace-' + esc(d.accent) + ')"' +
              ' title="' + esc(t(d.tag)) + '">' +
              '<span class="dot"></span><span class="tx">' + esc(t(d.title)) + '</span></button>';
    }
  }
  navList.innerHTML = html;
}

renderNav();
```

- [ ] **Step 2: 语法门必须仍然绿**

Run: `python3 chess/scripts/check.py; echo "exit=$?"`
Expected: `exit=0`，仍是 `node --check：9 个文件、16 个脚本块通过`

- [ ] **Step 3: 浏览器验收**

用 preview 打开 `chess/app.html`（本 worktree 内的路径），确认：
- 侧边栏出现五项：`All tools · Gallery`，分组 `Phase 1 · Rules Crash Course` 下两项、`Phase 2 · Game Replay` 下一项、`Phase 4 · Search and Game Trees` 下一项
- `All tools · Gallery` 是高亮态（`curId === null`）
- 四个工具项各自的色点颜色不同（rose / violet / emerald / orange）
- 舞台是空的（iframe 还没接，Task 3 才接）

- [ ] **Step 4: 提交**

```bash
git add chess/app.html
git commit -m "feat(chess): 侧边栏按阶段分组渲染 —— 阶段顺序读数据不写死"
```

---

## Task 3: iframe 导航、深链与历史

**Files:**
- Modify: `chess/app.html`（`<script>` 块末尾追加，并把 Task 2 末尾那句裸调用 `renderNav();` 删掉——本 task 末尾的 `boot()` 会统一调）

**Interfaces:**
- Consumes: Task 2 的 `renderNav()` / `byId()` / `fileOf()`，Task 1 的 `frame` / `curId` / `syncing` / `LANG`
- Produces: `srcFor(id)`、`setFrame(url)`、`go(id, push)`、`idFromPath(path)`、`renderChrome()`、`boot()`

- [ ] **Step 1: 删掉 Task 2 末尾的裸调用**

删除 Task 2 Step 1 追加的最后一行 `renderNav();`（含其上的空行）。它的位置由本 task 的 `boot()` 接管。

- [ ] **Step 2: 追加导航层**

```js
/* ================= 从 iframe 的路径反推 id =================
   使用者在画廊（home）里点了一张卡片时，导航不是壳发起的——iframe 自己换了
   页面。载入回调里靠文件名反查 id，才能把侧边栏高亮与地址栏同步过去。 */
function idFromPath(path) {
  var f = String(path).split('/').pop();
  for (var i = 0; i < TOOLS.length; i++) {
    if (TOOLS[i].file.split('/').pop() === f) return TOOLS[i].id;
  }
  return null;
}

function srcFor(id) {
  var f = id ? fileOf(id) : 'index.html';
  return (f || 'index.html') + '?lang=' + LANG;
}

/* 换页面用 location.replace 而不是赋值 frame.src——这一条抄自主站 app.html，
   理由也照抄：赋值 src 会往「联合会话历史」里塞一条 iframe 记录，与壳自己的
   pushState 交错，后退键就会出现「地址与侧栏都退了、画面还停在上一个工具」的
   错位。replace 不产生历史记录，历史完全由壳掌握。跨源时回落到 src。 */
function setFrame(url) {
  try {
    if (frame.contentWindow) { frame.contentWindow.location.replace(url); return; }
  } catch (e) { /* 跨源（file://）时读 contentWindow 会抛 */ }
  frame.src = url;
}

function renderChrome() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.getElementById('brandName').textContent = t(L.brand);
  document.getElementById('brandLink').href = '../index.html?lang=' + LANG;
  document.getElementById('brandLink').title = t(L.back);
  document.getElementById('btnLang').textContent = LANG === 'zh' ? 'EN' : '中';
  document.getElementById('btnHide').title = t(L.hide) + ' (Ctrl+B)';
  document.getElementById('btnShow').title = t(L.show) + ' (Ctrl+B)';
  var d = curId ? byId(curId) : null;
  document.title = d ? t(d.title) + ' · MathViz' : t(L.title);
  var alone = document.getElementById('btnAlone');
  alone.title = t(L.alone);
  alone.href = (d ? d.file : 'index.html') + '?lang=' + LANG;
}

function go(id, push) {
  if (id && !byId(id)) id = null;      // 未知 id 一律落回 home，不留 undefined
  curId = id || null;
  syncing = true;
  setFrame(srcFor(curId));
  renderNav();
  renderChrome();
  if (push !== false) {
    try {
      var u = new URL(location.href);
      if (curId) u.searchParams.set('tool', curId); else u.searchParams.delete('tool');
      u.searchParams.set('lang', LANG);
      history.pushState({ tool: curId }, '', u);
    } catch (e) {}
  }
  if (window.innerWidth <= 760) setSidebarOpen(false);
}

/* 侧边栏点击：事件委托到容器上，renderNav() 每次重画都不必重新绑 */
navList.addEventListener('click', function (e) {
  var btn = e.target.closest ? e.target.closest('.item') : null;
  if (!btn) return;
  go(btn.dataset.id || null, true);
});

/* 后退/前进 */
window.addEventListener('popstate', function (e) {
  var id = (e.state && e.state.tool) || null;
  if (!id) {
    try { id = new URLSearchParams(location.search).get('tool'); } catch (err) { id = null; }
  }
  go(id, false);
});

/* iframe 载入后回同步：使用者在画廊里点卡片时，导航不是壳发起的 */
frame.addEventListener('load', function () {
  if (syncing) { syncing = false; return; }
  var id = null;
  try { id = idFromPath(frame.contentWindow.location.pathname); } catch (e) { return; }
  if (id === curId) return;
  curId = id;
  renderNav();
  renderChrome();
  try {
    var u = new URL(location.href);
    if (curId) u.searchParams.set('tool', curId); else u.searchParams.delete('tool');
    history.replaceState({ tool: curId }, '', u);
  } catch (e) {}
});

function boot() {
  var id = null;
  try { id = new URLSearchParams(location.search).get('tool'); } catch (e) {}
  go(id, false);
  try { history.replaceState({ tool: curId }, '', location.href); } catch (e) {}
}
boot();
```

- [ ] **Step 3: 加一个临时的 `setSidebarOpen` 桩，让本 task 可独立运行**

`go()` 里调了 `setSidebarOpen()`，它的正式实现在 Task 4。在 `boot();` **之前**插入这一行桩，Task 4 会把它替换成真实实现：

```js
/* 桩：正式实现见下一段（折叠与键盘）。先声明是为了让 go() 在本阶段就能跑通。 */
function setSidebarOpen(open) { shell.classList.toggle('hid', !open); }
```

- [ ] **Step 4: 语法门**

Run: `python3 chess/scripts/check.py; echo "exit=$?"`
Expected: `exit=0`

- [ ] **Step 5: 浏览器验收**

- 直接打开 `chess/app.html`：iframe 里装的是 `chess/index.html` 画廊，侧边栏 home 项高亮
- 点侧边栏四个工具，各自装进 iframe，高亮跟随，地址栏出现 `?tool=<id>&lang=en`
- 直接打开 `chess/app.html?tool=chess-game-replay`：进来就是回放工具，对应项高亮
- 打开 `chess/app.html?tool=不存在的id`：安静落回 home，不报错、不白屏
- 点几个工具后按浏览器后退键：地址、侧边栏高亮、iframe 画面三者同步后退（不出现「地址退了画面没退」）
- 在 home 画廊里点一张卡片：侧边栏高亮与地址栏跟着走

- [ ] **Step 6: 提交**

```bash
git add chess/app.html
git commit -m "feat(chess): iframe 导航、?tool= 深链与历史 —— 换页走 location.replace"
```

---

## Task 4: 语言贯穿、折叠与键盘、注册表覆盖

**Files:**
- Modify: `chess/app.html`

**Interfaces:**
- Consumes: Task 3 的 `go()` / `renderChrome()` / `srcFor()` / `setFrame()`、Task 2 的 `renderNav()`
- Produces: `setSidebarOpen(open, remember)`（替换 Task 3 的桩）、`setLang(l)`、`hotkey(e)`

- [ ] **Step 1: 用正式实现替换 Task 3 的 `setSidebarOpen` 桩**

删除 Task 3 Step 3 那两行桩，替换为：

```js
/* ================= 侧边栏显隐 ================= */
function setSidebarOpen(open, remember) {
  shell.classList.toggle('hid', !open);
  if (remember !== false) {
    try { localStorage.setItem(NAV_KEY, open ? 'open' : 'hid'); } catch (e) {}
  }
}
function toggleSidebar() { setSidebarOpen(shell.classList.contains('hid')); }

document.getElementById('btnHide').addEventListener('click', function () { setSidebarOpen(false); });
document.getElementById('btnShow').addEventListener('click', function () { setSidebarOpen(true); });
document.getElementById('scrim').addEventListener('click', function () { setSidebarOpen(false); });

/* ================= 键盘 =================
   只认两枚：Ctrl/Cmd+B 与 [。chess 工具已经占了 1–9（视角）、T（切页签）、
   Space（播放/暂停）、F（翻转棋盘）、r（重置），阶段 4/5 的调试器还要占
   F5/F9/F10/F11——壳不许碰这些。isTyping() 挡住代码编辑器里敲 [ 的情形。 */
function isTyping(el) {
  if (!el) return false;
  var tag = (el.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
function hotkey(e) {
  if (isTyping(e.target)) return;
  var mod = e.ctrlKey || e.metaKey;
  if ((mod && (e.key === 'b' || e.key === 'B')) || (!mod && !e.altKey && e.key === '[')) {
    e.preventDefault();
    toggleSidebar();
  }
}
document.addEventListener('keydown', hotkey);

/* 工具在 iframe 里，键盘事件落在它的文档上，壳收不到——载入后把同一个
   handler 也挂进去（同源才行，跨源会抛，try/catch 兜住）。 */
frame.addEventListener('load', function () {
  try { frame.contentDocument.addEventListener('keydown', hotkey); } catch (e) {}
});

/* 恢复上次的折叠状态。不 remember，否则「恢复」这件事本身会写一次存储。 */
try {
  if (localStorage.getItem(NAV_KEY) === 'hid') setSidebarOpen(false, false);
} catch (e) {}
```

- [ ] **Step 2: 加语言切换**

在上面那段之后追加：

```js
/* ================= 语言 =================
   切换要同时做两件事：① 重渲壳自己的文案 ② 重设 iframe 的 ?lang=。
   只做①会得到「壳是中文、工具是英文」。 */
function setLang(l) {
  LANG = l;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  renderNav();
  renderChrome();
  syncing = true;
  setFrame(srcFor(curId));
  try {
    var u = new URL(location.href);
    u.searchParams.set('lang', l);
    history.replaceState({ tool: curId }, '', u);
  } catch (e) {}
}
document.getElementById('btnLang').addEventListener('click', function () {
  setLang(LANG === 'zh' ? 'en' : 'zh');
});
```

- [ ] **Step 3: 加注册表覆盖**

在文件最末尾、`boot();` **之后**追加：

```js
/* 优先取 chess-tools.json（有服务器时永远最新）；file:// 或离线时 fetch 失败，
   静默沿用内嵌的 FALLBACK，不弹错误、不阻塞渲染（boot() 已经先渲染过一次）。
   覆盖之后要重渲侧边栏——注册表里可能多出 FALLBACK 还没有的工具。curId 不动：
   它此刻装的那一页是有效的，重新 go() 会白白重载一次 iframe。 */
(function () {
  try {
    fetch('chess-tools.json', { cache: 'no-cache' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (j) {
      if (j && j.tools && j.tools.length) { TOOLS = j.tools; renderNav(); renderChrome(); }
    })['catch'](function () {});
  } catch (e) {}
})();
```

- [ ] **Step 4: 语法门**

Run: `python3 chess/scripts/check.py; echo "exit=$?"`
Expected: `exit=0`

- [ ] **Step 5: 浏览器验收**

- 点 footer 的 `中`：侧边栏文案变中文，**且 iframe 里的工具也变中文**，地址栏 `?lang=zh`
- 再点一次变回 en，两边同步
- 点 `❮` 收起侧边栏，左边缘出现 `❯`，点它展开
- `Ctrl/Cmd+B` 与 `[` 都能折叠/展开；把焦点放进 iframe 里的工具再按，同样有效
- 打开工具① 后按 `1` `2` `3`（视角）与 `T`（切页签），确认壳没有抢走这些键
- 刷新页面：折叠状态被记住
- `↗` 在新标签页单独打开当前工具，且带着当前语言

- [ ] **Step 6: 提交**

```bash
git add chess/app.html
git commit -m "feat(chess): 语言贯穿壳与 iframe、折叠与两枚快捷键、注册表覆盖"
```

---

## Task 5: 接线两个 index.html，全量验收

**Files:**
- Modify: `chess/index.html`（`card()` 函数里的 `href`，约第 205 行）
- Modify: `index.html`（主站，`id="chessCard"` 的 `href`，约第 146 行）

**Interfaces:**
- Consumes: Task 3 的 `?tool=` 深链约定

- [ ] **Step 1: 落地页的工具卡片改为跳进壳**

`chess/index.html` 的 `card()` 里这一行：

```js
    return '<a class="card" style="--c:var(--trace-' + d.accent + ')" href="' + d.file + '?lang=' + LANG + '">' +
```

改为：

```js
    /* 跳进壳而不是直接开工具页：落地页此刻可能正被装在 chess/app.html 的
       iframe 里当画廊，壳的 load 回调会反查 id 把侧边栏高亮同步过去；直接
       开工具页在壳外也一样工作（?tool= 深链由壳解析）。 */
    return '<a class="card" style="--c:var(--trace-' + d.accent + ')" href="app.html?tool=' + d.id + '&lang=' + LANG + '">' +
```

- [ ] **Step 2: 主站卡片改指壳**

`index.html`（主站根目录）里：

```html
    <a class="card" style="--c:var(--trace-cyan)" href="chess/index.html" id="chessCard">
```

改为：

```html
    <a class="card" style="--c:var(--trace-cyan)" href="chess/app.html" id="chessCard">
```

- [ ] **Step 3: 两道 gate 都跑**

Run: `python3 chess/scripts/check.py; echo "chess=$?"` 与 `python3 scripts/sync_registry.py --check; echo "sync=$?"`
Expected: 都是 `0`。`sync_registry.py` 不受影响——Chess 卡片是手写的 `<a>`，不在 `TOOLS` 数组里（该文件注释写明 chess/ 不受 `sync_registry.py` 管辖）。

- [ ] **Step 4: 全量浏览器验收（规格 §7 的清单，逐条走一遍）**

- 从主站 `index.html` 点 Chess 卡片 → 落在 `chess/app.html`，iframe 里是画廊
- 在画廊里点任一工具卡片 → 壳装上该工具，侧边栏高亮与地址栏同步
- `chess/app.html?tool=chess-moves-geometry` 深链直达
- 四个工具在侧边栏之间互切
- 语言切换壳与工具同步
- 折叠 + `Ctrl/Cmd+B` + `[`
- **`file://` 下（不起服务器）重跑上面全部**：走 FALLBACK，导航必须完整可用
- **四个工具单独打开**（含 `chess/tools/chess-search-minimax.html`）仍然正常，与壳无关
- 工具页自己的键（`1`–`9` / `T` / `Space` / `F`）在壳里仍然有效

- [ ] **Step 5: 提交**

```bash
git add chess/index.html index.html
git commit -m "feat(chess): 落地页卡片与主站入口都指向导航壳"
```

---

## 完成标准

- [ ] `python3 chess/scripts/check.py` exit 0，输出为 `node --check：9 个文件、16 个脚本块通过` 与 `FALLBACK 一致性：2 份内嵌副本 · 4 个 id 全部对上`
- [ ] `python3 scripts/sync_registry.py --check` exit 0
- [ ] Task 1 Step 7 的三处变异各自确认让门变红，且都已改回
- [ ] `chess/tools/` 下没有任何文件被改动（`git diff --stat main...HEAD` 里不出现 `chess/tools/`）
- [ ] 四个工具单独打开仍正常
- [ ] `file://` 下壳的导航完整可用
- [ ] 主站除 `index.html` 的一行 `href` 外没有任何改动
