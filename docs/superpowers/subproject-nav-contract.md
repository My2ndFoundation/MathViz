# Subproject Navigation Contract

## MathViz · 子项目导航契约 v2.0

`chess/`、`cryptography/` 与 `python/` **不共享任何代码文件**——这是「整个子目录可以被搬走后
独立运行」的前提，也是三边各有一份 `wireParentLink()`、一份 `ACCENTS`、一份 i18n 的原因。

不共享代码，就必须共享**契约**。否则每一条导航行为都要靠人记得手工搬运，而事实证明
记不住：`?v=` 缓存键在 cryptography 落地后，chess 少了它整整一个季度（`chess-board-algorithms`
一路升到 1.7.0，六次升级都可能躲在 GitHub Pages 的旧副本后面才被发现，见 PR #158）。

这份文件写的就是那份契约：**三个子项目的六个导航页（各自的 `app.html` 与 `index.html`）
必须满足的条款**。新增第四个子项目时，这份文件是它的验收清单。

> 契约管的是**导航壳与画廊**。工具页（`tools/*.html`）不在范围内——它们各自独立，
> 只被契约要求「能被独立打开」。
>
> 根目录的 `index.html` / `app.html` 不是子项目页，但有两条镜像条款落在它们身上：
> 三张子项目卡片的 `target="_top"`（C4），与主站壳自己的 `setFrame()` 形状（C8）。

**v2.0 的变化**：第三个子项目 `python/` 加入；C4–C8 从「无机械门」变成有门
（`scripts/check_nav_contract.py`）；第 2 节那张表按实测重写。

---

## 0. 为什么是条款，不是「参考实现」

一条只写在文档里、没有门看着的规则，在这个仓库里的存活期约等于一次重构。
根 `CLAUDE.md` 已经记过同一类事故两次（`index.html` 的 48/62 条 version 静默漂移；
`registry-sync.yml` 连红四次没人看）。

所以每一条条款都带三列：**条款 / 谁在守它 / 三个子项目当前的真实状态**。
「当前状态」这一列必须是**实测**的，不是照抄意图——写这份文件 v1.0 时就是靠实测发现
cryptography 违反了自己 CLAUDE.md 里记着的第 1 条（详见第 4 节）。

---

## 1. 条款

### C1 · 版本号是缓存键，必须出现在每一个出站地址上

GitHub Pages 给 HTML 发 `cache-control: max-age=600`，浏览器还会留得更久。地址恒定不变时，
一次已发布的升级可以长期躲在旧副本后面——主站真实发生过（`pi` 已经是 1.2.0，页面仍显示 1.1.1）。

**要求**：以下四个地址全部带 `?v=`，且用同一套版本值：

| 位置 | 值 |
|---|---|
| `app.html` 装工具的 iframe（`srcFor(id)`） | 该工具的 `version` |
| `app.html` 的「单独打开」`#btnAlone` | 同上（**必须与 iframe 同值**，否则「壳里是新版、单开是旧版」） |
| `app.html` 装画廊的 iframe（`srcFor(null)`） | `regFingerprint()`——整张注册表的 djb2 指纹 |
| `index.html` 的每张卡片 | 该工具的 `version` |

画廊用指纹而不是某个工具的版本，因为画廊自己内嵌了一份注册表副本：任何一个工具升级，
它的内容就变了。

> ⚠ **`#btnAlone` 那一行是这条里最容易漏的。** 三个子项目的壳里，`renderChrome()` 里的
> `alone.href = …` 与 `srcFor()` 是**各写一份**的表达式，不是共用一个函数（主站
> `app.html` 才是 `alone.href = srcFor(curId)`）。两份表达式意味着改一处不会带动另一处。
>
> 这一条**静态比对读不出来**，验证脚本也容易在这里留盲点：python 子项目落地时，
> 评审员把 `#btnAlone` 的版本写死成 `v=0`、`srcFor` 保持正确，当时那套断言**全部报
> PASS**——因为它们各自检查两处「有没有 `?v=`」，而没有比较两处**是不是同一个值**。
> 现在由 `check_nav_contract.py` 把页面脚本真求值一遍，逐个工具比对两处产出的地址
> （裁决 R45）。

### C2 · FALLBACK 的每一条都必须带 `version`；页面求值后三个绑定必须非空

`file://` 下 `fetch` 因同源限制失败，内嵌的 `FALLBACK` 是**唯一**的数据源。
少一个 `version` 字段，离线打开时每个地址退化成 `?v=0`、每张卡片的徽章写着 `v0`，
而**线上一切正常**——只在别人机器上出现的那一类 bug。

⚠ **`fallback_check()` 只比对 id 集合，看不见这件事。** 这是 `fallback_version_check()`
这道独立的门存在的全部理由。

**下限（裁决 R45）**：页面脚本求值之后，`TOOLS`、`FALLBACK`、以及该子项目的分组标签表
（`PHASE_LABELS` / `CHAPTER_LABELS` / `MODULE_LABELS`）三个绑定必须**存在且非空**。
听起来像废话，但 python 子项目自审时误删过一行 `var TOOLS = FALLBACK;`——**语法门完全
看不见**：删掉之后页面语法依旧合法，`node --check` 全绿，而整页语义全坏。只有真求值
一遍才会发现。

### C3 · 出站引用收敛成一个常量，并且自愈

整个子目录里**只有一处**父目录相对路径：`PARENT_HOME = '../app.html'`，
`app.html` 与 `index.html` 各一份，别处一律为零。

- 目的地是 MathViz 的**导航壳** `app.html`，不是扁平画廊 `index.html`。去程是「壳 → 壳」
  （根 `index.html` 的子项目卡片带 `target="_top"`），回程必须对称——指向 `index.html`
  会把人扔在一张没有侧边栏的画廊上。
- `wireParentLink(el)` 在 http(s) 下对该地址发一次 `HEAD`，404 或网络失败就把链接藏掉；
  `file://` 下探测本就会失败（无法区分「文件不在」与「协议不让探」），保持显示。
- HTML 里的 `href` 写占位的 `#`，真实地址在运行时由 `wireParentLink()` 写入，并且带上当前 `?lang=`。
  所以它要放在 `render()` / `renderChrome()` 里，不是只在启动时调一次。

这六份 `wireParentLink()` 目前**逐字节相同**（`sed -n '/^function wireParentLink/,/^}/p' | shasum`
六份都是 `d353d1f97b61`）。改一处就要改六处。

> ⚠ 跨页比 sha 时**必须先断言抽出来的块非空**。根目录那两页没有 `wireParentLink`，
> 上面那条命令在它们身上抽出空串，`shasum` 给出 `da39a3ee5e6b`（sha1 of ""）——两个
> 空串永远相等。一道把「都抽不到」当成「都相同」的门会永远报绿，而且看不出来。

### C4 · 返回链接必须 `target="_top"`

这一页最常见的运行位置是自己 `app.html` 的 iframe 里。没有 `_top`，点「返回 MathViz」
只会把 MathViz 换进**那个 iframe**，外面的子项目侧边栏原封不动——屏幕上变成
「棋类的壳里装着 MathViz 的画廊」。顶层单独打开时 `_top` 是空操作，所以两种位置共用同一份标记。

同一条规则的镜像：**根 `index.html` 的三张子项目卡片也必须带 `target="_top"`**，
以及**主站 `app.html` 的品牌区指向 `app.html`，不是 `index.html`**（PR #158 修的就是这一侧）。
普通左键在壳内 `go(null)`；带修饰键与中键必须放行，那几条路径要的就是一个新壳。

### C5 · 画廊在壳里要撑满舞台

`index.html` 装在 `app.html` 的 iframe 里，左边还站着一条侧边栏。写死的 `max-width` 会把
卡片挤成中间一条窄柱、两侧大片空白，看起来像布局坏了。

**要求**：`.wrap{max-width:min(2600px,96vw)}`。随之而来的两条（宽网格才需要）：
简介 `-webkit-line-clamp:4` 并按四行占位（否则一张长简介把整行卡片拉长），
眉题与 tag `text-overflow:ellipsis`（版本徽章坐在眉题右边，长眉题必须让位）。

### C6 · accent 是闭集，退路在调色板之外

`accent` 被拼进 `style=""` 属性值内部（`--c:var(--trace-<accent>)`），而 `esc()` 只转义
`& < > "`——一个 CSS 层面的 payload 一个都不含。所以必须在插值点收紧：

```js
var ACCENTS = { cyan: 1, rose: 1, violet: 1, emerald: 1, orange: 1 };
function safeAccent(a) { return ACCENTS.hasOwnProperty(a) ? a : 'unpaired'; }
```

退路是 `--trace-unpaired`（一块洋红，取三维渲染里 missing texture 的老规矩），
**不能**是调色板里的任何一个颜色——chess 的退路曾经是 cyan，理由是「四个工具都不用它」，
阶段 5 的第五个工具用掉 cyan 之后那个哨兵当场失效。
维持这条只需一件事：给新工具选 accent 时只从这五个键里选，不许把 `unpaired` 加进表。

六份 `ACCENTS` / `safeAccent` 目前逐字相同，`--trace-unpaired` 是 per-file token、六份各定义一次。

### C7 · i18n 语义两页同源

- 存储键是子项目自己的：`<sub>-lang` / `<sub>-nav`。一页里不许出现别的子项目的前缀。
- `resolveLang()` 与 `t()` 的兜底都是 **`en`**（子项目默认英文，与数学工具的中文默认相反）。
  缺 key 时兜底成 zh 会让英文页面突然冒出中文。
- 语言切换即时生效：既要重渲壳自己的文案，也要重设 iframe 的 `?lang=`，还要把 `?lang=` 写回地址栏。
- 壳要监听 `storage` 事件（iframe 里的工具自带一枚语言开关），收到就跟着改，
  但**绝不** `setFrame()`——那等于重载工具、扔掉它刚刚的状态。

> 同一套 i18n 语义还要复刻进 `scripts/apply_footer.py` 的 `LANG_CFG`：GA 同意代码块
> 自包含地重走一遍「`?lang=` → localStorage → 默认」，用的是它自己那张表里的
> `LKEY` 与隐私链接路径。**新增子项目时那张表和 `subproject_of()` 要一起改**，
> 否则新子项目的两个导航页会被当成根页面处理——拿到 `mathviz-lang` 与 `privacy.html`，
> 而且脚本跑一遍就会把页面里写对的那份覆盖掉（裁决 R43，实测确认）。
> 现在那两处收敛成一个 `SUBPROJECTS` 常量，只有一处真相。

### C8 · 历史与 iframe 换页

- 换页用 `frame.contentWindow.location.replace(url)`，不是赋值 `frame.src`。赋值会往联合会话历史
  里塞记录，与壳自己的 `pushState` 交错，后退键就会出现「地址与侧栏都退了、画面还停在上一个工具」。
- 只有「换工具」算一次导航（`pushState`）；切语言与 iframe 回同步用 `replaceState`。
- 点击已经是当前项的那一个：不出手。否则白推一条历史 + 硬重载 iframe（丢掉回放进度、相机、当前页签）。
  这个判断**只能放在点击路径**——放进 `go()` 会让无 query 的首次加载提前返回，iframe 永远指不到画廊。

> ⚠ 条款是 `frame.src =` 的**位置**，不是它的**存在**。四个壳（含主站 `app.html`）里
> 各有恰好一处 `frame.src = url;`，都在 `setFrame()` 的 `try/catch` 之后，是
> `contentWindow` 为假值（iframe 还没挂好窗口对象）时的退路，写在设计里。
> 把这条写成「页面里不许出现 `frame.src =`」会当场把现有的正确代码全判红——
> 门查的是「全页恰好一次，且那一次在 `setFrame()` 体内、排在 `location.replace` 之后」。

---

## 2. 谁在守每一条

> **这张表的每一格都跑过一次命令。** 不要照抄意图，也不要照抄上一版——第 4 节记着
> 这份文件自己是怎么因为照抄而差点写出假状态的。每一格后面括号里是它的实测来源。

实测日期：2026-09-16。复现命令见每格下方的「实测」块。

| 条款 | 门 | chess | cryptography | python |
|---|---|---|---|---|
| C1 版本即缓存键（注册表 == html meta） | `<sub>/scripts/check.py: version_meta_check()` | ✅ | ✅ | ⏳ 见下方注① |
| **C1 `#btnAlone` 与 iframe 同值** | `scripts/check_nav_contract.py: eval_checks()` | ✅ 6 组地址 | ✅ 28 组地址 | ✅ 2 组地址 |
| C2 FALLBACK 带 version | `<sub>/scripts/check.py: fallback_version_check()` | ✅ | ✅ | ⏳ 见下方注① |
| C2 FALLBACK id 集合 | `<sub>/scripts/check.py: fallback_check()` | ✅ | ✅ | ⏳ 见下方注① |
| **C2 求值后三个绑定非空** | `scripts/check_nav_contract.py: eval_checks()` | ✅ | ✅ | ✅ |
| C3 出站引用唯一 | `<sub>/scripts/check.py: outbound_ref_check()` | ✅ | ✅ | ⏳ 见下方注① |
| **C3 `PARENT_HOME` 形状与去向** | `scripts/check_nav_contract.py: parent_home_check()` | ✅ | ✅ | ✅ |
| C1 注册表字段/semver | `<sub>/scripts/check.py: registry_check()` | ✅ | ✅ | ⏳ 见下方注① |
| **C3/C6 三块代码六页逐字节相同** | `scripts/check_nav_contract.py: shared_block_check()` | ✅ | ✅ | ✅ |
| **C4 `target="_top"`** | `scripts/check_nav_contract.py: top_target_check()` | ✅ | ✅ | ✅ |
| **C5 `.wrap` 撑满舞台** | `scripts/check_nav_contract.py: wrap_width_check()` | ✅ | ✅ | ✅ |
| **C7 兜底语言与存储键前缀** | `scripts/check_nav_contract.py: lang_check()` | ✅ | ✅ | ✅ |
| **C8 `setFrame()` 形状** | `scripts/check_nav_contract.py: frame_nav_check()` | ✅ | ✅ | ✅ |
| **根 `index.html` 三张子项目卡片** | `scripts/check_nav_contract.py: card_check()` | ✅（一张表三格共用） | ✅ | ✅ |

加粗的九行是 v2.0 新增的门。加它们之前，C4–C8 五条整整一份文档都写着「❌ 无机械门」。

**实测**：

```bash
# 门到底存不存在（grep，不猜）
grep -oE '^def (registry_check|fallback_check|fallback_version_check|version_meta_check|outbound_ref_check)' \
     chess/scripts/check.py cryptography/scripts/check.py
# → chess 与 cryptography 五道门齐全；chess 的 registry_check() 在 check.py:1114

python3 chess/scripts/check.py           # exit 0
python3 cryptography/scripts/check.py    # exit 0
python3 scripts/check_nav_contract.py -v # exit 0，100 项断言
```

> **注①** —— `python/scripts/check.py` 由并行任务落地，写这张表时磁盘上还**没有**它，
> 所以那五格**没有实测过，故意不写 ✅**。它落地之后，跑一次
> `python3 python/scripts/check.py` 再逐格改。**不要照抄 chess / cryptography 那两列**——
> 那正是第 4 节记着的那种写法。（注：这五条的**状态**倒是量过：六个导航页的
> FALLBACK 条目 5/5、27/27、1/1 条全带 `version`，一条不缺；缺的是「谁在守它」。）

> 加新门时请遵守本仓的规矩：**一道门在你把它守的东西改坏、看到它变红之前，不算数。**
> `fallback_version_check()` 的四个负控制见 PR #158；
> `check_nav_contract.py` 的十一个负控制见 Task 15 报告，其中「删掉
> `var TOOLS = FALLBACK;`」那一个同时证明了**语法门仍绿、本门变红**。

### 2.1 `check_nav_contract.py` 的两个实现要点

1. **它抽内联脚本的方式与语法门那句 `awk` 逐行同法。** 两道门必须看同一批字节，
   否则会在不同的输入上给出结论。
2. **它给 `node` 传路径，不传内容。** Linux 把单个 `argv` 元素卡在
   `MAX_ARG_STRLEN` = 128 KiB（与 `ARG_MAX` 是两条不同的限制），macOS 没有这条上限——
   `chess/scripts/check.py` 就是这么「本机全绿、CI 连红四次」的（#97–#100）。

### 2.2 钩子触发条件里的一个坑

`.githooks/pre-commit` 里这道门的触发条件**故意**写成两个顶层分支：

```sh
'^(app|index)\.html$|^(chess|cryptography|python)/(app|index)\.html$|^scripts/check_nav_contract\.py$'
```

不写成更短的 `'^((chess|cryptography|python)/)?(app|index)\.html$'`：后者在
**ugrep 7.8.4**（不少开发机 PATH 上的 `grep`）下**会漏掉 `cryptography/app.html`**——
只漏这一条，`chess/` 与 `python/` 照常命中，稳定复现；`/usr/bin/grep` 与 Python 的 `re`
都认为它该匹配。可选捕获组 `(…)?` 套交替是触发条件。漏掉的后果是这道门对那一页静默
失效，而本机与 CI 会给出不同的结论。

---

## 3. 允许的差异（不算违约）

契约管行为，不管词汇。以下差异是**设计**，不是漂移：

| 差异 | chess | cryptography | python |
|---|---|---|---|
| 分组轴 | `phase` / `phaseLabel()` / `#phases` | `chapter` / `chapterLabel()` / `#chapters` | `module` / `moduleLabel()` / `#modules` |
| 分组标签表 | `PHASE_LABELS`（阶段 3 无工具，表里缺 3 是对的） | `CHAPTER_LABELS`（固定五章闭集） | `MODULE_LABELS`（固定八模块闭集） |
| 存储键前缀 | `chess-` | `cryptography-` | `python-` |
| 占位卡片 | 有 `.ghost` + `L.soonKicker/soonDesc` | 无（五章都还没落地时「只画其中一张比一张不画更像 bug」） | 无（同理：八个模块只落地了一个） |
| 章节/阶段/模块数 | 至今 5 个阶段、5 个工具 | 固定 5 章、27 个工具 | 固定 8 模块 |
| 页面里有没有 canvas | 有 | 有 | **没有**——python 的工具是代码编辑器，不是三维场景 |

除这张表之外，六个导航页的 **DOM id 集合、`L` 的 key 集合、函数集合**目前是相同的。
实测命令与结果（2026-09-16）：

```bash
diff <(grep -oE '^function [a-zA-Z]+' chess/app.html | sort) \
     <(grep -oE '^function [a-zA-Z]+' python/app.html | sort)
# → 只差一行：phaseLabel ↔ moduleLabel

diff <(grep -oE '^  [a-zA-Z]+:' chess/index.html | sort) \
     <(grep -oE '^  [a-zA-Z]+:' python/index.html | sort)
# → 只差 chess 多出的 soonDesc / soonKicker（占位卡片的文案）
```

`app.html` 三边只差 `phaseLabel` / `chapterLabel` / `moduleLabel`；
`index.html` 另外多出 chess 的两个 `soon*` key。

---

## 4. 这份文件是怎么发现自己第一条被违反的

写第 2 节那张表时，「cryptography 的 C2」这一格本来准备照抄根 `CLAUDE.md`——那里白纸黑字写着
FALLBACK 必须带 `version`，还特地注明 `fallback_check()` 抓不到。`cryptography/index.html`
自己的注释也写着「FALLBACK 现在也带 version，所以 `file://` 下这里不会退化成 `v=0`」。

实测的结果是：**两页 27×2 = 54 条 FALLBACK 条目，`version` 字段一个都没有。**

`file://` 下把 `TOOLS = FALLBACK` 走一遍（`fetch` 失败时就是这条路径），27 张卡片
全部渲染成 `v0`，地址全部是 `?v=0`——缓存键等于不存在，徽章是错的。

两个教训，都不新鲜，但这次是在同一天里同时踩到的：

1. **文档写着「已修复」不等于修复了。** 注释是意图的快照，会和代码分岔，而且分岔之后
   它比没有注释更危险——它会让下一个人跳过检查。
2. **没有门的条款就是没有条款。** 这一条在 cryptography 的 CLAUDE.md 里被郑重记了一笔，
   仍然被违反了；它在 chess 那边有门，所以没有。差别不是谁更用心，是谁有门。

修复与那道门一起落在 v1.0 那次改动里。

### 4.1 v2.0 里同一个形状的第二次

v1.0 的第 2 节表格里写着两处「仍然只靠人看」，其中第一处是「**chess 没有
`registry_check()`**」。v2.0 实测的结果是：**它有**，在 `chess/scripts/check.py:1114`，
在这两版之间由另一个任务补上了。表格里那一格当时已经改成了 ✅，而它下面的正文没跟着改——
于是这份**讲「文档会和代码分岔」的文档**，自己带着一处内部矛盾过了一整段时间。

这就是为什么 v2.0 的第 2 节不再有「表格 + 一段解释表格的正文」这种两处真相的结构：
每一格的实测命令直接写在表下面，没有第二个地方可以走偏。

**给下一个改这份文件的人：每一格都要跑一次命令再填。** 包括那些「明明上次就是 ✅」的格子。
