# Subproject Navigation Contract

## MathViz · 子项目导航契约 v1.0

`chess/` 与 `cryptography/` **不共享任何代码文件**——这是「整个子目录可以被搬走后独立运行」
的前提，也是两边各有一份 `wireParentLink()`、一份 `ACCENTS`、一份 i18n 的原因。

不共享代码，就必须共享**契约**。否则每一条导航行为都要靠人记得手工搬运，而事实证明
记不住：`?v=` 缓存键在 cryptography 落地后，chess 少了它整整一个季度（`chess-board-algorithms`
一路升到 1.7.0，六次升级都可能躲在 GitHub Pages 的旧副本后面才被发现，见 PR #158）。

这份文件写的就是那份契约：**两个子项目的四个导航页（各自的 `app.html` 与 `index.html`）
必须满足的条款**。新增第三个子项目时，这份文件是它的验收清单。

> 契约管的是**导航壳与画廊**。工具页（`tools/*.html`）不在范围内——它们各自独立，
> 只被契约要求「能被独立打开」。

---

## 0. 为什么是条款，不是「参考实现」

一条只写在文档里、没有门看着的规则，在这个仓库里的存活期约等于一次重构。
根 `CLAUDE.md` 已经记过同一类事故两次（`index.html` 的 48/62 条 version 静默漂移；
`registry-sync.yml` 连红四次没人看）。

所以每一条条款都带三列：**条款 / 谁在守它 / 两个子项目当前的真实状态**。
「当前状态」这一列必须是**实测**的，不是照抄意图——写这份文件时就是靠实测发现
cryptography 违反了自己 CLAUDE.md 里记着的第 1 条（详见下方）。

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

### C2 · FALLBACK 的每一条都必须带 `version`

`file://` 下 `fetch` 因同源限制失败，内嵌的 `FALLBACK` 是**唯一**的数据源。
少一个 `version` 字段，离线打开时每个地址退化成 `?v=0`、每张卡片的徽章写着 `v0`,
而**线上一切正常**——只在别人机器上出现的那一类 bug。

⚠ **`fallback_check()` 只比对 id 集合，看不见这件事。** 这是一道独立的门存在的全部理由。

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

这四份 `wireParentLink()` 目前**逐字节相同**（`sed -n '/^function wireParentLink/,/^}/p' | shasum`
四份都是 `d353d1f97b61`）。改一处就要改四处。

### C4 · 返回链接必须 `target="_top"`

这一页最常见的运行位置是自己 `app.html` 的 iframe 里。没有 `_top`，点「返回 MathViz」
只会把 MathViz 换进**那个 iframe**，外面的子项目侧边栏原封不动——屏幕上变成
「棋类的壳里装着 MathViz 的画廊」。顶层单独打开时 `_top` 是空操作，所以两种位置共用同一份标记。

同一条规则的镜像：**主站 `app.html` 的品牌区指向 `app.html`，不是 `index.html`**
（PR #158 修的就是这一侧）。普通左键在壳内 `go(null)`；带修饰键与中键必须放行，
那几条路径要的就是一个新壳。

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

四份 `ACCENTS` / `safeAccent` 目前逐字相同，`--trace-unpaired` 是 per-file token、四份各定义一次。

### C7 · i18n 语义两页同源

- 存储键是子项目自己的：`<sub>-lang` / `<sub>-nav`。
- `resolveLang()` 与 `t()` 的兜底都是 **`en`**（子项目默认英文，与数学工具的中文默认相反）。
  缺 key 时兜底成 zh 会让英文页面突然冒出中文。
- 语言切换即时生效：既要重渲壳自己的文案，也要重设 iframe 的 `?lang=`，还要把 `?lang=` 写回地址栏。
- 壳要监听 `storage` 事件（iframe 里的工具自带一枚语言开关），收到就跟着改，
  但**绝不** `setFrame()`——那等于重载工具、扔掉它刚刚的状态。

### C8 · 历史与 iframe 换页

- 换页用 `frame.contentWindow.location.replace(url)`，不是赋值 `frame.src`。赋值会往联合会话历史
  里塞记录，与壳自己的 `pushState` 交错，后退键就会出现「地址与侧栏都退了、画面还停在上一个工具」。
- 只有「换工具」算一次导航（`pushState`）；切语言与 iframe 回同步用 `replaceState`。
- 点击已经是当前项的那一个：不出手。否则白推一条历史 + 硬重载 iframe（丢掉回放进度、相机、当前页签）。
  这个判断**只能放在点击路径**——放进 `go()` 会让无 query 的首次加载提前返回，iframe 永远指不到画廊。

---

## 2. 谁在守每一条

| 条款 | 门 | chess | cryptography |
|---|---|---|---|
| C1 版本即缓存键 | `version_meta_check()`（注册表 == html meta） | ✅ | ✅ |
| C2 FALLBACK 带 version | `fallback_version_check()` | ✅ | ✅（本次补上） |
| C2 FALLBACK id 集合 | `fallback_check()` | ✅ | ✅ |
| C3 出站引用唯一 | `outbound_ref_check()` | ✅ | ✅ |
| C1 注册表字段/semver | `registry_check()` | ❌ **无** | ✅ |
| C4–C8 | — | ❌ 无机械门 | ❌ 无机械门 |

两处仍然只靠人看：

1. **chess 没有 `registry_check()`**。cryptography 那道门会校验 semver 形状、字段齐全、
   以及「磁盘上的工具页与注册表双向存在」。chess 目前只有 `fallback_check()` 的 id 比对，
   一个注册表里写错的 `file` 路径要到运行时才暴露。
2. **C4–C8 全部没有门**。它们是行为，不是可以用正则数出来的字段；要机械化就得跑一个真实
   DOM。今天靠的是这份文件 + code review。加门之前，这一格必须诚实地写 ❌。

> 加新门时请遵守本仓的规矩：**一道门在你把它守的东西改坏、看到它变红之前，不算数。**
> `fallback_version_check()` 的四个负控制见 PR #158。

---

## 3. 允许的差异（不算违约）

契约管行为，不管词汇。以下差异是**设计**，不是漂移：

| 差异 | chess | cryptography |
|---|---|---|
| 分组轴 | `phase` / `phaseLabel()` / `#phases` | `chapter` / `chapterLabel()` / `#chapters` |
| 分组标签表 | `PHASE_LABELS`（阶段 3 无工具，表里缺 3 是对的） | `CHAPTER_LABELS`（固定五章闭集） |
| 存储键前缀 | `chess-` | `cryptography-` |
| 占位卡片 | 有 `.ghost` + `L.soonKicker/soonDesc` | 无（五章都还没落地时「只画其中一张比一张不画更像 bug」） |
| 章节/阶段数 | 至今 5 个阶段、5 个工具 | 固定 5 章、27 个工具 |

除这张表之外，四个导航页的 **DOM id 集合、`L` 的 key 集合、函数集合**目前是相同的。
实测命令（写这份文件时跑过）：

```bash
diff <(grep -oE '^function [a-zA-Z]+' chess/app.html | sort) \
     <(grep -oE '^function [a-zA-Z]+' cryptography/app.html | sort)
```

`app.html` 两边只差 `phaseLabel` / `chapterLabel`；`index.html` 另外多出 chess 的两个 `soon*` key。

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

修复与那道门一起落在本次改动里。
