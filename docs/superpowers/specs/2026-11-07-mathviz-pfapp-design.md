# MathViz → 4 个 PrimeForge pfapp · 设计

> 2026-11-07 · 基线 `1876069`（#210 合并后的 main）
> 调研报告（gitignored，主工作区）：`.superpowers/pfapp-research/research-report.md`——协议事实的出处都在那里，本文只在关键处重复。
> 本文里标「**用户定**」的是用户在对话里拍板的；标「**控制方定**」的是写这份设计时替用户做的默认选择，用户审阅时可以推翻；其余留给实现者。

缩写：**MV** = 本仓库；**PFD** = `/Users/nickma/Develop/darkhorseone/system/PrimeForge-Desktop`（1.45.1）；**MTB** = `/Users/nickma/Develop/MathTestBuddy/trainer`；**LSL** = `/Users/nickma/Develop/LiveStudioLab`。

---

## 1. 要做什么、为什么

MV 是一个零依赖、单文件 HTML 的教学工具网站，四块内容：数学可视化（根目录 `outputs/`，62 页）、国际象棋算法（`chess/`，5 页）、密码学（`cryptography/`，27 页）、Python 练习（`python/`，35 页、375 个程序）。

用户要把它们做成 **4 个 PrimeForge Desktop 应用（pfapp）**：数学、chess、加解密、python 学习。为什么：网页版只能「看和练」；进了 Desktop，就能用 Desktop 提供的 AI 能力在每个工具、每个程序旁边**问问题、存笔记**，还能**对整个内容库提问**，数据存在本机 SQLite 里。技术栈照 MTB（**用户定**）。

**网页版保留，而且是唯一的内容源**（**用户定**）。以后加内容的流程固定为：先在网页版里加、走网页版自己的门与评审、合并；然后在 pfapp 那边「提取 → 更新 → 构建 → 发布」。pfapp 侧**不手改任何内容**。

## 2. 目标、非目标、反目标

**目标**
1. 4 个可安装、可签名发布的 pfapp，各自管一块内容。
2. 每个 pfapp：原生侧栏目录 + 工具页（iframe 原样嵌入）+ 按主题的 AI 问答与笔记 + 「问整个库」。
3. 一条从网页版到 pfapp 的、可重复、可校验的内容管线：一条命令把网页版某一块提取成内容包，门能证明内容包与网页版逐字节一致。
4. 网页版新增或升级一页之后，pfapp 侧只需「提取 → 打内容包 → 发布内容包」，**不必重发应用**。

**非目标（这一版不做）**
- 不重写任何工具页，不把工具页改成 React。
- 不做流式对话、嵌入向量、RAG 相似度检索（平台没有这些接口）。
- 不做 AI 预算上限功能（**用户定**）：没有预算设置、没有用量统计界面。manifest 里平台要求的 `maxBudgetUsd` 字段照填一个固定值，仅此而已。
- 不做账号、收费、授权（平台的 entitlement 功能本来就关着）。
- 不做跨应用通信、跨应用的统一搜索。
- 不改网页版的行为。唯一的例外是 python 的**只读状态桥与程序深链接**（§7.3，**用户定**）：网页版单独打开时行为不变，这项改动走网页版自己的门与评审。

**反目标（即使能跑也算失败）**
- pfapp 里的内容与网页版**悄悄走样**：某页在 pfapp 里是旧的、缺的、被改过的，而没有任何门变红。
- 网页版为了迁就 pfapp 而改变结构或降低它的门的严格度。
- AI 在学生做挖空题时**直接说出答案**。
- 用户换个端口、重装一次应用，**笔记与问答历史就丢了**。

## 3. 约束（来自平台，不可协商）

摘自调研报告 §2，实现前读原文：

- 一个 pfapp = 目录 + 根 `manifest.json`；`id` 必须匹配 `app.primeforge.*`；`runtime: node@24`；`surface: "http"`；只监听 `127.0.0.1:<PRIMEFORGE_PORT>`。
- **安装目录只读**；数据只能写 `PRIMEFORGE_DATA_DIR`；环境变量是平台构造的、没有 `PATH`。
- **不能带原生代码**：SQLite 只能用 `node:sqlite`（Bun 下测试用 `bun:sqlite`），`next.config` 必须是 `.mjs`，不能用 sharp / better-sqlite3。
- AI **只有 agent 任务**：`POST /ai/jobs` → agent 通过应用自己的 MCP 工具取上下文、调提交工具交回答案 → 应用轮询。没有流式、没有补全接口、没有嵌入接口。每个 workflow 的工具白名单、轮数、时长写在 manifest，由平台执行。
- 内容包 `.pfaddon`：应用自定 `payload/` 格式；平台负责签名校验、商店、更新；应用通过 `PRIMEFORGE_ADDONS_DIR` 与 `/addons/v1/installed` 读取，需要 `addons` capability；需 Desktop ≥ 1.45。
- 打包、签名、发布只能在持有签名种子的机器上做（`bun run pack` / `pack:addon` / `publish:app` / `publish:addon`）。
- MV 仓库的门会扫 `git ls-files '*.html'`（branding、footer、gallery-bg 等）：**pfapp 目录下不提交任何 `.html` 文件**，否则这些门会把它当成网页版的页去要求 favicon 区段。

## 4. 用户已经定了的

1. **4 个独立 pfapp**：数学、chess、加解密、python 学习。
2. **内容做成 `.pfaddon` 内容包**，与应用壳分开签名、发布、更新。
3. **工具页 iframe 原样嵌入**：内容包里的 HTML 与网页版逐字节相同，不在提取时改写。
4. **侧栏菜单在 pfapp 里原生重做**：不嵌网页版的 `app.html` / `index.html`，由 pfapp 从内容包里的注册表数据渲染。
5. **AI**：按主题的问答 + 学习笔记（照 MTB 的 tutor threads），**另加「问整个库」**。
6. **打包脚本放进 PFD 仓库**（与 MTB、LSL 的 `scripts/build-*.ts` 同一模式）。
7. **不做预算上限功能。**
8. 技术栈参考 MTB；pfapp 代码放在 **MV 仓库的新子目录**里。
9. **python 的页面状态**：在网页版 python core 里加一个只读的 postMessage 状态桥（外加程序深链接），外壳据此知道当前的程序、模式和空（§7.3）。
10. **分发**：四个应用与四个内容包**公开上架商店、免费**；第一期就把 python 发到商店、本机从商店装（§8）。
11. **AI 引擎**：**Claude 与 Codex 都支持**。Codex 任务不受 manifest 工具白名单约束，所以不泄题不能靠白名单，只能靠服务器（§7.4）。

## 5. 整体结构

### 5.1 代码组织（控制方定）

一套应用代码、四个构建目标。四个应用的界面与机制几乎相同——内容来自内容包，侧栏从注册表渲染——差别只在 id、端口、名称、图标、侧栏分组方式、主题类型的上下文拼法，以及 python 独有的挖空相关 MCP 工具。所以：

```
MV/pfapp/
├── package.json  bun.lock  biome.json  tsconfig.json
├── app/                        一个 Next.js 应用（App Router），四个目标共用
│   ├── src/app/…               页面与 API 路由
│   ├── src/lib/platform/       平台客户端（抄 MTB client.ts）
│   ├── src/lib/mcp/            应用 MCP 端点与工具
│   ├── src/lib/ai/             任务状态机、上下文拼装、各主题类型的取材
│   ├── src/lib/db/             node:sqlite 双后端 + Drizzle schema + 迁移
│   ├── src/lib/content/        读内容包、建目录与检索索引
│   ├── src/lib/http/           Host / Origin / Sec-Fetch-Site 防护、CSRF、CSP（抄 MTB）
│   ├── src/lib/i18n/           中英双语（照 LSL）
│   ├── drizzle/                迁移 SQL
│   └── primeforge-entry.mjs    进程内启动 Next（抄 MTB）
├── targets/
│   ├── math/   { target.json, manifest.json, icon.svg }
│   ├── chess/  { … }
│   ├── crypto/ { … }
│   └── python/ { … }
├── extract/                    网页版 → 内容包 payload 的提取器（Bun/TS）
├── scripts/check.ts            pfapp 自己的门（见 §9）
└── tests/                      单元、集成（假平台）、Playwright
```

构建时用 `MATHVIZ_TARGET=<math|chess|crypto|python>` 选目标：`target.json` 提供 id、名称、端口、默认语言、侧栏分组字段、主题类型等，manifest 与图标原样进包。每个目标**各自的版本号**写在自己的 `manifest.json` 里，独立升。

为什么不是 4 个 Next 应用 + 共享包：4 份几乎一样的路由、布局与配置要维护四遍；内容已经搬进内容包，应用之间真正不同的部分小到可以用配置表达。为什么不是 4 个仓库：与「在当前项目下新建子目录」的要求不符。

### 5.2 标识、端口与默认语言（端口与默认语言**用户定**；id 与名称控制方定）

| 目标 | app id | 名称（中 / 英） | 端口 | 默认语言 |
|---|---|---|---|---|
| math | `app.primeforge.mathviz.math` | 数学可视化 / MathViz Maths | 26454 | 英文 |
| chess | `app.primeforge.mathviz.chess` | 国际象棋算法 / MathViz Chess | 26455 | 英文 |
| crypto | `app.primeforge.mathviz.crypto` | 密码学可视化 / MathViz Cryptography | 26456 | 英文 |
| python | `app.primeforge.mathviz.python` | Python 练习 / MathViz Python | 26457 | 英文 |

端口 26454–26457 由用户指定；已知已占用的是 7616、7617、7620、7630、26421、26452、26903、26905，实现者在本机 Desktop 数据目录里再核一遍。**四个应用默认语言都是英文**（与网页版数学默认中文不同，这是用户的决定）；用户在应用里切换后记住选择（存 SQLite），切换时用新的 `?lang=` 重载工具页。

### 5.3 打开方式（控制方定）

**在用户的浏览器里打开**（不声明 `ui.window`）。原因：有 10 个工具页用 `blob:` / `<a download>` 导出（8 个数学工具、`chess-search-minimax`、`chess-game-replay`），而 `ui.window` 窗口拒绝 `blob:` / `data:` 下载；工具页按决定不改，只能选浏览器。代价：拿不到 Desktop 窗口传来的主题与语言，语言由应用自己的设置决定。若以后要改用窗口，先解决这 10 页的下载。

## 6. 内容管线：网页版 → 内容包

### 6.1 每个目标一个内容包（控制方定）

内容包 id：`<appId>/content`（例：`app.primeforge.mathviz.python/content`），每个目标一个，包含该块的**全部**内容。

`payload/` 格式（应用自定，平台不解析）：

```
payload/
├── catalog.json        归一化的目录：每个工具 { id, file, group, accent, version, title{zh,en}, kicker, desc, tag, … }
│                       group = 数学的 cat / chess 的 phase / crypto 的 chapter / python 的 module；
│                       分组标签（zh/en）取自网页版导航页（提取器读，不手写）：chess 的 PHASE_LABELS、
│                       crypto 的 CHAPTER_LABELS、python 的 MODULE_LABELS（各子项目 app.html）；
│                       数学取根 index.html 的 CATS（根 app.html 有同序的一份）
├── tools/<file>.html   工具页，与网页版逐字节相同
├── source/             供 AI 取材的结构化原料（各目标不同，见 6.3）
└── provenance.json     来源：MV 的 commit SHA、提取器版本、每个文件的 sha256（不写时间：同一 SHA 提取两次必须逐字节相同，
                        否则同版本重打会被 publish:addon 以「same version, different bytes」拒绝）
```

python 包约 15 MB、crypto 约 8 MB、math 约 6 MB、chess 约 5 MB，远低于平台上限（512 MB / 2 GB）。按模块或章拆包这一版不做；`addon.json` 的 `requires` 等以后需要拆时再用。

### 6.2 提取器

`pfapp/extract/` 提供一条命令：`bun run extract <target> --mathviz <MV 路径> --out <目录>`。

- 读该块的注册表（`tools.json` / `chess/chess-tools.json` / `cryptography/cryptography-tools.json` / `python/python-tools.json`），按注册表逐条拷贝工具页，不拷注册表之外的文件（`_skeleton.html`、`archive/` 不进包）。
- 要求 MV checkout 干净（与 PFD 的 `build-mathtestbuddy.ts` 同一纪律），把 HEAD SHA 写进 `provenance.json`。
- 提取器的输出是确定的：同一个 MV commit 提取两次，payload 逐字节相同。
- **内容包的版本号**在 PFD 侧的构建脚本里定（控制方定）：指纹 = payload 里除 `provenance.json` 之外全部文件的哈希；与上一次发布的指纹不同则 patch +1，相同则拒绝重复发布。
  「上一次发布的版本与指纹」记在 **PFD 仓库**里（`scripts/mathviz-content-releases.json`），由构建脚本在发布成功后更新、在 PFD 里提交。
  放 PFD 而不放 MV 的原因：版本记录跟着发布走；放 MV 就得在发布后回 MV 提交，而构建又要求 MV checkout 干净，两头打架；也不能让网页版的每个 PR 都去碰 pfapp 的版本文件（反目标 2）。
- 提取器自己不打包、不签名；打包在 PFD 侧（§8）。

### 6.3 供 AI 取材的原料（`payload/source/`）

| 目标 | 原料 |
|---|---|
| python | 每个程序：`chapter.json` 那一条里的标题、blurb、notes、lineNotes、tags、boards、level + `.py` 源码原文（含 BLANK 指令，挖空答案与分级提示都在里面）。**`run.expect`（程序输出）不进内容包**：页面从不显示输出，有些挖空行的字面量只能从输出推出来，把它交给 AI 就是泄题。 |
| math / chess / crypto | 注册表文案（title / kicker / desc / tag / changelog）+ 从工具页提取出的**可读文字**：页面里的中英文案（例如 `tips`、`STR` 表、标签文字），去掉脚本代码与样式 |

「可读文字」的提取方法留给实现者，约束是：不能执行页面脚本；每页的提取结果要被门检查非空，并对每页人工抽看一份（§9）。

## 7. 应用

### 7.1 启动

1. 读 `PRIMEFORGE_*` 环境，打开 `<DATA_DIR>/mathviz.sqlite`，跑迁移（带备份轮转，照 MTB）。
2. 找到已安装的内容包（`/addons/v1/installed` + `PRIMEFORGE_ADDONS_DIR`）；没有时显示「安装内容包」空状态（提供从商店安装与手动导入本地 `.pfaddon` 两条路，照 MTB）。
3. 内容包版本与库里记录的不同时，重建目录表与检索索引（§7.5）。

### 7.2 侧栏（**用户定**：原生重做）

- 从 `catalog.json` 渲染：按 `group` 分组、组内按注册表顺序；组标签与工具标题按当前语言；可收起；当前工具高亮；显示每个工具的版本号（与网页版的徽章同源）。
- 顶部：应用名、语言切换、⌘K 搜索（按标题 / 标签过滤，照 MTB 的 cmdk）。
- 底部：「笔记」「问整个库」入口、设置。
- 布局抄 MTB 的 `src/components/layout`（可收起侧栏、面包屑）。具体视觉留给实现者，但要与网页版「暗色示波器」的气质一致（`design-system/math-viz-design-system.md` 的色彩 token 可以直接用）。

### 7.3 工具页（**用户定**：iframe 原样嵌入）

- 路由 `/tool/<id>`：外壳 + 同源 iframe；iframe 的地址是应用自己的一条路由 `/c/<内容包版本>/tools/<file>?lang=<zh|en>`，从内容包目录按文件流式返回（`Content-Type: text/html; charset=utf-8`）。地址里带内容包版本，内容包升级就是新 URL，绕开浏览器缓存（与网页版的 `?v=` 同一道理）。
- 外壳语言切换时，用新的 `?lang=` 重新载入 iframe。
- 工具页本身没有指回导航页的相对链接（`PARENT_HOME` 只在导航页里，`1876069` 上全部工具页 grep 为 0），所以 iframe 里不会跳出外壳。实现者仍要实测：工具页里的任何链接都不让 iframe 导航到应用的其他路由。
- 工具页给 iframe 用的 CSP：允许内联脚本与样式、`data:` 图片与字体；`connect-src 'self'`。要求实现者在 4 个目标上**每一页**都打开一次、读控制台，0 个 CSP 报错（可以写成 Playwright 测试）。
- **python 的只读状态桥（用户定）**：网页版 `python/core/` 加两样东西，作为一个网页版 PR 先行（走 python 子项目的门、终审与升版）：
  1. **状态通知**：页面在 `window.parent !== window` 时，每当当前程序、模式（读 / 挖空 / 临摹）、聚焦的空、或某个空被「填进去」（`S.given`）发生变化，向父窗口 `postMessage({type: 'mathviz/py-state', v: 1, page, progId, mode, blankId, given: [blankId…]}, location.origin)`。只发不收——桥是只读的，父窗口无法驱动页面。单独打开时（没有父窗口）一行都不执行，行为与今天逐字节相同（门：新增一个检查，在裸 vm 里以「没有父窗口」装载页面、断言 `postMessage` 从未被调用）。
  2. **程序深链接**：`?prog=<程序 id>` 打开时直接选中那个程序（网页版单独用也受益）。AI 回答里的程序引用据此直接打开到那个程序。
  外壳只信同源、`type` 与版本对得上的消息；页面状态只用于拼 AI 上下文与决定是否允许涉及答案，不落盘。
  数学、chess、crypto 三个目标不需要桥：它们的主题就是整页。
- 工具页存在 localStorage 里的东西（语言、python 的草稿与进度）跟着 `127.0.0.1:<端口>` 走。端口固定（§5.2）时它们能保留；用户改端口会丢。**这一版接受这个限制**（控制方定）：要可靠就得改网页版 core 加桥接，不在本期范围，记为后续。应用自己的数据（笔记、问答、设置、最近打开）一律在 SQLite，不受影响。

### 7.4 AI：按主题问答与笔记（**用户定**）

照 MTB 的「AI 问答 + 学习笔记」，主题类型换成我们的：

| 主题类型 | 所在目标 | 上下文（代码按主题精确拼装） |
|---|---|---|
| `tool` | 全部 | 注册表文案 + 该页的可读文字 |
| `program` | python | 程序的标题、讲解、行注、源码；**挖空答案的处理见下** |
| `blank` | python | 某个程序里的某个空：所在行附近的源码（挖掉的行用占位代替）、这个空的分级提示 |
| `library` | 全部 | 见 7.5 |

- 数据：`threads` / `thread_subjects` / `messages` / `ai_jobs` 四张表，字段照 MTB 的 `tutor_*`，主题键为 `(subject_type, subject_id)`。一条线索可以挂多个主题。
- 流程：`POST /api/threads` → 202 → 建 `ai_jobs` 行 → 向平台提交 workflow `ask`，带一次性 ticket → agent 调 `get_task(ticket)` 取拼好的上下文 → agent 调 `submit_answer(ticket, text, citations[])` → 写进 `messages` → 前端轮询。启动时对账未完成的任务（照 MTB `jobs.ts`）。
- 回答是 Markdown（数学目标支持 KaTeX）；`citations` 是条目 id，服务器校验存在后渲染成可点的链接，打开对应工具页（照 PFD Hello 的做法）。
- 任何一条回答都可以「存为笔记」；笔记页按主题、按时间列出，可搜索、可删除。
- **不泄题**（反目标 3）。防的是**无意剧透**：读模式本来就显示全文、「填进去」一点就给答案，存心要答案的学生拦不住，也不必拦。规则：
  - 允许涉及答案，当且仅当状态桥报告的模式是「读」，或这个空在 `given` 里（学生已经点过「填进去」）。其余情况（挖空、临摹、桥没有报告状态）一律不允许。
  - 不允许时，`get_task` / `read_item` 交给 agent 的取材里：挖空行原文换成占位；**挂在挖空行上的 `lineNotes` 去掉**（它的 `at` 就是整行原文，而且常常解释这一行）；`run.expect` 本来就不在内容包里（§6.3）。
  - **服务器在 `submit_answer` 时检查**（这是唯一可靠的一道，因为 Codex 任务不受工具白名单约束，§4 第 11 条）：把回答里的代码与正文归一（去空白），只要包含任何一个不允许涉及的空的答案行（同样归一），就拒收、要求 agent 重写；连续拒收两次则任务失败，界面提示「这个问题需要先做完这个空」。agent 提交时也照 MTB 声明 `revealsAnswer`，但服务器不信它，只信自己的检查。
  - 实现者给这三条各写集成测试（含一个「agent 不按规矩、直接贴答案」的假引擎）。
- 等待体验：提交后显示「正在思考」与可取消按钮；没有流式。

### 7.5 「问整个库」（**用户定**）

- 检索：每个目标在 SQLite 里建一张全文索引表（`fts5`），收录每个条目的标题、标签、讲解、可读文字、（python）源码。中文需要能检索：用 `fts5` 的 `trigram` 分词器。**trigram 查不到少于 3 个字符的词**（实测：存「二分查找的循环不变式」，查「查找的」命中、查「查找」0 行），而递归、排序、向量这类中文术语大多是两个字——所以查询词短于 3 个字符时，退到同一批文本上的 `LIKE '%…%'` 子串匹配（库只有几百条，代价可以忽略）。**实现者第一步先实测** `node:sqlite`（Node 24）与 `bun:sqlite` 都支持 `fts5` 与 `trigram`；不支持就整体退到 `LIKE`，接口不变。
- agent 拿到的 MCP 工具：`search_library(query, limit)`（返回条目 id、标题、片段）、`read_item(id)`（返回该条目的完整取材，挖空答案照 7.4 的规则处理）、`list_groups()`、`submit_answer(...)`。由 agent 自己决定搜什么、读几条。
- 主题类型 `library`，回答必须带 `citations`；一条都没有时服务器照样收下，但界面标明「未引用库内条目」。
- 它只搜**本应用**的内容（数学应用搜不到 python 的程序）；跨应用不做（非目标）。

### 7.6 manifest 要点

- `capabilities: ["ai", "addons"]`；`ai.mcp.path` 指向应用的 MCP 端点（按 job 的一次性路径，照 MTB）。
- workflows：`ask`（主题问答）与 `library`（问整个库）；python 另有 `hint`（挖空时要一条提示，比 `ask` 更严：只能用 `get_task` / `submit_answer`）。每个 workflow 的 `tools.allow` 列出它能用的 MCP 工具；`maxTurns` / `maxRuntimeSeconds` 照 MTB 的量级给（`library` 比 `ask` 宽）；`maxBudgetUsd` 填一个固定值（平台必填），不做任何预算界面（**用户定**）。
- 引擎：Claude 与 Codex 都支持（**用户定**）——按平台的方式发引擎偏好（PFD `CLAUDE.md` 引擎一节；MTB 的做法），Codex 需要用户在 Desktop 里授权。只装了 Codex 又没授权时，界面要给出明确的提示，而不是一个失败的任务。
- 不声明 `ui.window`（§5.3）；`minDesktopVersion: "1.45.0"`；图标 `icon.svg` 照 PFD 的图标标准，从 `docs/logo.png` 的 M/V 标记派生，四个目标用网页版闭集里的四种 accent 区分。

## 8. 构建与发布（**用户定**：脚本放 PFD）

PFD 新增一个通用脚本 `scripts/build-mathviz.ts <target>`（不写四份），读邻居 checkout（环境变量 `MATHVIZ_PATH`，缺省按 PFD 现有约定找相邻目录）：

- **应用包**：要求 MV checkout 干净 → 在 `pfapp/` 里 `MATHVIZ_TARGET=<t>` 构建 → 拷 `.next`、`drizzle`、入口、`next.config.mjs`、`package.json`、`bun.lock`、`public`、`targets/<t>/manifest.json` 与 `icon.svg` → frozen 装生产依赖 → 检查无原生代码 / 无 checkout 绝对路径 / 无符号链接 → `pack`。照 `build-mathtestbuddy.ts`。
- **内容包**：`scripts/build-mathviz-addon.ts <target>`（或同一脚本的子命令）：调 MV 的提取器 → 写 `addon.json`（版本取自提取器算出的版本，`minAppVersion` 填该目标应用的当前版本）→ `pack:addon`。
- 发布：PFD 现有的 `publish:app` / `publish:addon`。
- **分发（用户定）**：四个应用与四个内容包公开上架商店、免费。每个应用与每个内容包都要在控制台建商品（内容包是 `addon` 类）；平台规定应用先 `publish:app` 进签名目录，内容包才能发。所以第一期的验收就是：python 应用与 python 内容包发到商店，本机 Desktop（先升到 ≥ 1.45）从商店装。应用里同时保留「手动导入本地 `.pfaddon`」，用于开发调试（照 MTB `src/lib/content/addon.ts`；注意它与 `/addons/v1/installed` 是两条来源，应用要能读两者、以版本高者为准）。
- **过期信号**：构建脚本加 `--status`：报告 MV main 当前的内容指纹与上一次发布的是否相同、差了哪些页；应用的「关于」里显示内容包版本与它对应的 MV SHA。网页版改了而内容包没重发，靠这两处看得见（它不是门——网页版不应因 pfapp 没发布而变红）。

日常流程（写进 MV 根 `CLAUDE.md` 与 `pfapp/README.md`）：

1. 网页版加内容、走网页版的门与评审、合并到 main。
2. `bun run extract <target>` 本地看一眼差异（哪些页变了、内容包版本将升到几）。
3. 在 PFD 里 `build-mathviz-addon <target>` → `publish:addon`。应用本身没改就不发应用。
4. 应用代码改了才 `build-mathviz <target>` → `publish:app`，并升该目标 manifest 的版本。

## 9. 门与验证（沿用 MV 的纪律）

MV 的规矩照样适用：「一道门在你把它守的东西改坏、看到它变红之前，不算数」。

`pfapp/scripts/check.ts`（进 `.githooks/pre-commit` 与 `.github/workflows/registry-sync.yml`，pfapp 有改动或网页版注册表有改动时跑）：
- **提取一致**：对 4 个目标各跑一次提取到临时目录，逐个工具断言 payload 与网页版源文件 sha256 相同、注册表里的每一条都在 catalog 里、catalog 里没有注册表之外的条目；组标签与网页版导航页里的那几份标签（§6.1）一致。负控制：改一页的一个字节、删一条注册表条目、多放一个文件，各自断言红。
- **可读文字非空**：每页的提取结果非空（math / chess / crypto）。
- **提取确定**：同一 commit 提取两次，payload 逐字节相同。
- 「内容包版本前进」不在 MV 的门里，在 PFD 构建脚本里（§6.2）：MV 的 pre-commit 与 CI 只跑本节其余各项，网页版的 PR 不因 pfapp 而变红。
- **python 状态桥**：没有父窗口时 `postMessage` 从未被调用（进 `python/scripts/check.py`，网页版的门）。
- **无 `.html` 进仓库**：`pfapp/` 下被 git 跟踪的 `.html` 为 0（§3 最后一条）。
- 应用侧：`bun test`（单元 + 集成，假平台照 MTB `fake-platform.ts`）、Biome、类型检查；Playwright 端到端：每个目标装一个测试内容包，侧栏渲染、每一页 iframe 打开 0 个控制台错误、一次 `ask` 与一次 `library` 走假平台跑通、不泄题的集成测试。
- CI 只能跑到「构建 + 测试」，**签名与发布只在持有种子的机器上做**。

## 10. 分期（控制方定）

0. **网页版的 python 状态桥与深链接**：一个网页版 PR，照 python 子项目的流程（engine 升版、终审、门）。
1. **地基 + python**：`pfapp/` 骨架、平台客户端、SQLite、内容管线（提取器 + 门）、侧栏、iframe、按主题问答与笔记、问整个库、不泄题——全部在 python 目标上做通；PFD 的两个构建脚本；python 应用与内容包发到商店，本机 Desktop（要先升到 ≥ 1.45；本机现装 1.7.2）从商店安装验收。python 是最结构化、AI 最有用的一块，先做它能最早暴露问题。
2. **math、chess、crypto**：三个目标的 `target.json`、可读文字提取、各自的 `tool` 上下文；逐页 iframe 验证（10 个带下载的页在浏览器里实测导出）。
3. **发布**：图标、商店文案、四个应用与四个内容包首发；把日常流程写进 MV 根 `CLAUDE.md`。

## 11. 留给实现者的

- Next.js 的具体版本与写法：MTB 用的是 16.4.3，它的 `AGENTS.md` 说「这不是你熟悉的 Next.js」——动手前读 `node_modules/next/dist/docs/`。
- 页面视觉细节、组件拆分、Drizzle schema 的具体列名。
- 「可读文字」的提取实现。
- 轮询间隔、任务对账细节、错误文案。
- `fts5` 不可用时的退路实现。

## 12. 风险

1. AI 体验是「等几秒到几十秒、一次性出来」，每次花用户的 Claude 额度；只装了 Codex 的机器上，要发引擎偏好且用户授权才可用。
2. 工具页的 localStorage 跟端口走（§7.3），改端口丢草稿与进度。
3. 签名种子只在一台机器上，发布不能自动化。
4. 本机 Desktop 1.7.2 太旧，试装前要升级。
5. 网页版的门不认识 pfapp；pfapp 的门（§9）漏一项，内容就可能悄悄走样——这是反目标 1，门要先于功能写。
