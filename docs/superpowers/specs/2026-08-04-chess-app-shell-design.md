# chess 子项目导航壳 · 设计规格

**日期**：2026-08-04
**状态**：已与使用者逐段确认，待写实现计划
**范围**：新增 `chess/app.html`；改 `chess/index.html` 的工具卡片链接；改主站 `index.html` 一行 `href`；补 `chess/scripts/check.py` 两道门。

---

## 0. 问题

主站有两层：`index.html`（落地卡片）与 `app.html`（导航壳——侧边栏 + 搜索 + 分组 + iframe 舞台 + 边缘折叠条）。62 个工具都在那个壳里逛。

chess 子项目只有一层。`chess/index.html` 是一张按阶段分组的落地页，点进任何一个工具就是一个**独立全屏页面**，没有壳。于是从 `chess-moves-geometry` 想去 `chess-game-replay`，唯一的路是按浏览器后退键回落地页再点一次；工具运行时也没有「当前在哪、旁边还有什么」的持续可见性。

数据层其实早就就绪：`chess-tools.json` 的字段（`id` / `file` / `accent` / `title` / `kicker`，外加 `phase` 代替主站的 `cat`）与主站 `app.html` 的 `GENERATED:TOOLS` 是同一副形状。缺的只是壳本身。

## 1. 已考虑并否决的方案

| 方案 | 否决理由 |
|---|---|
| 把 chess 工具并进主站 `app.html` 的侧边栏 | 推翻规格 §9 的 YAGNI 条款「不改 `tools.json` / `app.html` / `sync_registry.py`，对主站的唯一改动是在 `index.html` 加一个入口链接」，且会把 chess 的注册表拖进 `sync_registry.py` 的管辖范围 |
| 每个工具页内嵌一条侧边栏（不用 iframe） | 三份重复的导航代码；且工具页现在遵守「canvas 全屏、UI 浮在其上、永不分屏」这条设计原则，侧边栏会破掉它 |
| 只在工具页角上加一个跳转浮层 | 每次切换整页重载，且仍然没有「当前在哪」的持续可见性 |

**采用**：在 `chess/` 下做一个自己的壳，结构照搬主站 `app.html`。

## 2. 架构

```
chess/app.html          新增：侧边栏 + iframe 舞台
chess/index.html        内容不动，只改工具卡片的 href（跳进壳）
index.html（主站）      改一行 href：chess/index.html → chess/app.html
chess/scripts/check.py  补两道门（§5）
chess/tools/*.html      一行不改
```

**为什么是 iframe 而不是注入**：`CLAUDE.md` 已经写明——每个工具是一整页，有自己的顶层 `state` / `cam`、全屏 canvas 和键盘绑定；两个塞进同一个文档必然互相踩。主站 `app.html` 用 iframe 正是这个理由，chess 的工具在这一点上只多不少（它们还各自绑了 `Space` / `F` / `r`）。

**工具保持可独立打开**。壳是可选的一层，不是必经之路——这条是整个子项目「单文件、零依赖、双击就能开」承诺的一部分。

### 2.1 壳的构成（逐项对应主站 `app.html`）

| 部件 | 说明 |
|---|---|
| 品牌区 | `← MathViz` 回主站 `index.html` |
| 工具列表 | 按 `phase` 分组（主站按 `cat`），每项一个 accent 色点 + 标题 |
| `home` 项 | `curId === null` 时 iframe 装 `chess/index.html` 当画廊，与主站的「全部工具 · 画廊」同构 |
| 舞台 | `<iframe>` 满铺，无边框 |
| 折叠 | `.shell.hid` 收起侧边栏 + `.edge` 边缘条唤回 |
| footer | 语言切换 |

### 2.2 URL 约定

- `chess/app.html` → home（iframe 装画廊）
- `chess/app.html?tool=chess-game-replay` → 直接装该工具
- `?lang=en|zh` 贯穿全程

切工具与切语言都用 `history.replaceState` 更新地址栏（照搬主站 `app.html` 的做法），因此任意状态都可以直接复制链接分享。iframe 载入后回读 `contentWindow.location.pathname` 反推 `id`，以便使用者在画廊里点卡片时侧边栏高亮跟着走——这一段主站已有现成实现。

### 2.3 语言

沿用 chess 子项目自己那套：`localStorage` 键 `chess-lang`，`?lang=` 优先，两处兜底都是 `en`（不是 `zh`）。语义必须与 `chess/core/viz-engine.js` 的 `resolveLang()` / `t()` 一致——`chess/index.html` 已经手抄了那 15 行，壳沿用同一份语义。

切换语言要**同时**做两件事：① 重渲侧边栏文案；② 重设 iframe `src` 上的 `?lang=`。只做①会得到「壳是中文、工具是英文」。

### 2.4 键盘

只认两枚，与主站一致：`Ctrl/Cmd+B` 与 `[`，都用于折叠侧边栏。iframe 载入后把同一个 handler 挂进工具文档（同源才行，`try/catch` 兜住）。

不冲突的核验：chess 工具已占用 `1–9`（视角）、`T`（切页签）、`Space`（播放/暂停）、`F`（翻转棋盘）、`r`（重置），阶段 4/5 的调试器还要占 `F5` / `F9` / `F10` / `F11`。壳只取 `Ctrl/Cmd+B` 与 `[`，均不在其中。`[` 与代码编辑器的潜在冲突由主站 handler 自带的 `isTyping()` 挡住（编辑器是 textarea / contentEditable）。

### 2.5 明确不做（YAGNI）

- **搜索框**：主站 62 个工具需要，chess 3 个（阶段 5 之后 5 个）不需要
- **录制桥**（主站的 `REC.Bridge`）：chess 没有这套东西
- **ghost 占位卡片**：落地页已经有了，侧边栏只列注册表里真实存在的工具
- **壳自己的键盘视角/播放控制**：那些属于工具，壳不代劳

## 3. 数据源

两段式，与 `chess/index.html` 完全一致：

1. 先用内嵌的 `FALLBACK` 数组渲染一次
2. 再 `fetch('chess-tools.json')`，成功就覆盖重渲，失败静默沿用

**为什么必须内嵌一份**：`file://` 下 `fetch` 因同源限制失败。「可离线、双击就能开」是这三个工具的卖点之一，壳不能例外——一个在 `file://` 下只剩 home 一项的导航壳，等于没有。

## 4. 这里唯一有真实腐烂风险的地方

上一节的代价是：内嵌副本从一份（`index.html`）变成两份（`+ app.html`）。而 `check.py` 现有的 FALLBACK 一致性门是写死单文件的：

```python
index_path = ROOT / 'index.html'
m = re.search(r'var FALLBACK = \[(.*?)\n\];', index_text, re.DOTALL)
```

考虑过三条路：

- **A. 抽成生成块**（像主站 `app.html` 的 `/* >>> GENERATED:TOOLS */`，由脚本写入）。最彻底，但 chess 子项目没有 sync 脚本；为两份 20 行的数组新造一个生成器加一套生成/校验流程，是拿工具换问题。
- **B. `app.html` 不带 FALLBACK**，`file://` 下退化成只有 home 一项。副本数不增加，但壳失去它存在的唯一理由。否决。
- **C.（采用）保持内嵌副本，把门从「检查 `index.html`」扩成「检查每一个内嵌了 `FALLBACK` 的根级页面」。**

C 的实现要点：用 `ROOT.glob('*.html')` 找出所有含 `var FALLBACK = [` 的文件，逐个与 `chess-tools.json` 比对 id 集合，**并断言至少找到 2 个**。

只写「遍历所有文件」而不钉住数量，是这个仓库已经栽过两次的坑：`check.py` 用 `(ROOT/'core').glob('*.test.js')` 而非 `rglob`，于是 `core/algos/minimax.test.js` 整个测试文件在门外躺着没人跑，直到阶段 4 的实现者报上来；`check.py` 自己在别处补过同类的数量断言。遍历漏光了会安静地全绿——这正是这道门要防的失败模式本身。

## 5. 顺带补的第二道门

查 `check.py` 时发现同一类病的另一处：

```python
tools = sorted((ROOT / 'tools').glob('*.html'))     # 第 36 行、第 86 行
```

`node --check` 只扫 `chess/tools/*.html`。CI 的语法门（`.github/workflows/registry-sync.yml`）扫的是 `app.html index.html outputs/*.html`——**主站的**那两个，不含 `chess/`。

两边合起来的结论：**`chess/index.html` 今天没有任何语法门覆盖**，新增的 `chess/app.html` 同样不会有。一个纯 JS 驱动的导航页，语法错了就是整页白屏，而两道门都报绿。

所以一并补：chess 的语法门从 `tools/*.html` 扩到 `tools/*.html` + `ROOT/*.html`（即 `index.html` 与 `app.html`），同样钉住「至少 2 个根级页面」。

## 6. 版本

壳不是工具——主站的 `app.html` 也不在 `tools.json` 里。因此：

- `chess/app.html` **不进** `chess-tools.json`
- 它在文件头带一段 changelog 注释 + `<meta name="tool-version">`，起于 `1.0.0`，供追溯
- 三个工具的版本**不动**（它们一行没改）

主站 `index.html` 里的 Chess 卡片是手写的 `<a id="chessCard" href="chess/index.html">`，不在 `TOOLS` 数组里（该文件的注释写明「chess/ 有自己的注册表，不受 `sync_registry.py` 管辖」），所以改它的 `href` 不影响 `sync_registry.py --check`。

## 7. 验收

全部机器可执行，外加一轮浏览器实测。

**机器**

- `python3 chess/scripts/check.py` exit 0，且输出里语法门的文件数从 6 变 8、FALLBACK 门报「2 份副本」
- `python3 scripts/sync_registry.py --check` exit 0
- **变异验证两道新门确实有牙**：故意在 `app.html` 的 FALLBACK 里删掉一个 id、故意写一处语法错，各自必须变红；把 `ROOT/*.html` 那一路改回单文件，数量断言必须变红

**浏览器**

- `?tool=<id>` 深链直达对应工具
- 点侧边栏能在三个工具之间切换，高亮跟随
- `home` 项装回画廊；在画廊里点卡片，侧边栏高亮与地址栏跟着走
- 语言切换：壳与 iframe 内的工具同时改变
- 折叠条与 `Ctrl/Cmd+B` / `[`
- `file://` 下（无服务器）仍能完整导航——走 FALLBACK
- 三个工具**独立打开**仍然正常，与壳无关

## 8. 与阶段 4 的关系

在自己的 worktree 里从 `main` 开分支做，不碰 phase 4 那条线。

**唯一的冲突面是 `chess/scripts/check.py`**——§4 与 §5 两道门都落在这个文件上，而阶段 4 那条线此刻正在改它。处理方式：等阶段 4 的 PR 合并后 rebase，或把 `check.py` 的改动单独拆成一个 commit 以便择时合入。

阶段 4 交付工具④ 之后，它会自动出现在侧边栏里（数据来自 `chess-tools.json`），唯一需要人做的是同步两份 `FALLBACK`——而那正是 §4 那道门要挡住的事。
