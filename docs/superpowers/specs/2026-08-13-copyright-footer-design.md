# 全站版权署名设计

日期：2026-08-13

## 1. 内容

```
© <当前年> MathViz · A PrimeForge Product · Built by DarkHorseOne
```

- **PrimeForge** → `https://primeforge.app`
- **DarkHorseOne** → `https://www.darkhorseone.co.uk`
- 均 `target="_blank" rel="noopener"`
- **中英文同一串**：品牌归属声明按惯例不翻译，两种语言下界面完全一致
- 年份由 `new Date().getFullYear()` 在浏览器里取，不写死、不在生成时固化——
  否则 2027 年 1 月 1 日全站同时过期，而没有任何东西会提醒

## 2. 落点：102 个页面，两种形态

| 页面 | 数量 | 落点 | 文案 |
|---|---|---|---|
| 画廊页（`index.html` ×3） | 3 | 现有 `<footer>` 内 | 完整串 |
| 导航壳（`app.html` ×3） | 3 | 侧边栏 `.sb-foot` | 完整串 |
| 工具页 | 96 | `.panel` 底部（`</aside>` 之前） | **精简串**，10px |
| `design-system/math-viz-starter.html` | 1 | 同工具页 | 精简串 |

工具页内的精简串：

```
© <当前年> MathViz · PrimeForge Product · DarkHorseOne
```

### 为什么工具页用不同的串

工具面板宽度是设计令牌，桌面固定 304px，内容区 `304 − 2×14 = 276px`。实测这
两串在该宽度下能用的最大字号：

| 串 | 字符 | 10px | 10.5px | 11px | 276px 内最大字号 |
|---|---|---|---|---|---|
| 完整串 | 61 | 308 | 324 | 339 | **8.5px** |
| 精简串 | 50 | 260 | 273 | 286 | **10.5px** |

**最终采用 10px，不是 10.5px。** 上表按 276px 估算，而实测的内容盒是 **274px**
（`.copyright` 是 `.panel` 的直接子元素，自带 14px 内边距，面板还有 1px 边框），
10.5px 下文本 273.3px——**只剩 1px**。而本机（macOS，`-apple-system`）恰好是最宽
的平台：同一串在 DejaVu / Segoe UI / 通用 sans-serif 下只有 254–256px。1px 是
0.4%，远小于跨平台字体度量的正常差异；一旦超出就会被 `overflow:hidden` 切掉半个
词，而按需求这里不能用省略号遮丑。10px 时本机余 14px、其他平台余 30px 以上，且
10px 正是设计系统里已在使用的最小字号。

这是本仓记过的同一类错误：**在一台机器上量出来的常数当成普适的**（`MAX_ARG_STRLEN`
四次合并对空气报红、PNG 压缩字节在 macOS 与 ubuntu 不一致导致 107 页全红）。

要求是「一行放得下、不截断、不折行」。完整串要满足它得压到 8.5px——**比设计
系统里在用的最小字号（10px）还小**，且要铺到 96 个页面上。精简串在 10px 下实测
文本 260.3px、内容盒 274px，余 14px，与面板内其他小字（11 / 11.5px）同一量级。

**注意窄屏反而更宽松**：375px 视口下面板是 `left:10;right:10`，内容区 327px。
约束来自桌面的固定宽度，不是手机。

### 不加的地方，各有依据

- `archive/` —— 已退役、未注册、未链接
- `scripts/audit-scenes.html` —— 开发用页面，不对外
- `chess/tools/_debugger-preview.html`、`_piece-preview.html` —— 内部预览页，
  **没有 `.panel`**（与上次窄屏修复中缺媒体查询的是同两个文件）

## 3. 维护方式：生成区间 + 闸门，不手抄

102 份手抄的相同标记，正是本仓反复吃亏的那件事：`tools.json` 与 `index.html`
之间 62 条里 48 条版本号静默走偏；窄屏标题的修法在 cryptography 的注释里写着
「本项目为此在窄屏上连栽五次」，却整整一季没回流到另外 67 个副本。

因此做成 `GENERATED:COPYRIGHT` 区间，由 `scripts/apply_footer.py` 写入，带
`--check`，挂进 `.githooks/pre-commit` 与 `registry-sync.yml`。新建的工具漏了
会当场报红，而不是某天被人发现。

### 为什么是新脚本，不是扩展 `apply_branding.py`

`apply_branding.py` 已经遍历全部 107 个页面、已有 `--check`、已挂在两道闸门
上，看起来该复用。但它的**写入路径需要 pillow/numpy**（要从 `docs/logo.png`
派生 M/V 标记）。把纯字符串的版权署名绑进去，意味着以后改一个字都得先装图像
库。`apply_footer.py` 零依赖，读写都不需要任何第三方包。

代价是多接一道闸门；按本仓规矩，**加闸门就要证明它会变红**（§5）。

### 插入锚点

工具页：唯一的 `</aside>`（`.panel` 的收尾）之前。实测 96 个工具页各含
**恰好一个** `</aside>` / `class="panel-body"` / `id="panel"`，无歧义。
脚本对「不是恰好一个」的文件报错退出，而不是猜。

## 4. 样式

工具页面板内：

```css
.copyright{padding:9px 14px 12px;font-size:10px;line-height:1.45;
  color:#5f6e86;white-space:nowrap;overflow:hidden;
  border-top:1px solid var(--panel-line)}
.copyright a{color:#8b9bb4;text-decoration:none}
.copyright a:hover{color:#bfefff}
```

`white-space:nowrap` 是需求的一部分（不折行）。**不加 `text-overflow:ellipsis`**——
需求明确要求不截断；字号已按实测选定，宽度是够的。若哪天面板变窄，宁可让它
溢出被 `overflow:hidden` 切掉从而**看得见**，也不要用省略号把问题伪装成正常状态。

（与窄屏标题那次的选择相反：那里标题长度不可控，所以用 `nowrap + ellipsis`
把「单行」变成结构上为真；这里字符串是常量，宽度可以一次算准。）

## 5. 闸门与负向对照

`python3 scripts/apply_footer.py --check` 逐页比对生成区间的内容。

按本仓规矩，「全绿」在负向对照失败之前不算证据。加闸门时必须证明它会变红：

| 破坏方式 | 期望 |
|---|---|
| 改掉某一页生成区间里的一个字 | 该页报红 |
| 删掉某一页的整个生成区间 | 该页报红 |
| 新增一个没有生成区间的工具页 | 该页报红 |

前两条在本次实施时执行并记录结果；第三条由「区间缺失即报错」的同一代码路径
覆盖。

## 6. 明确不做

- **不做双语版权串**。品牌归属不翻译（§1）。
- **不在生成时固化年份**。见 §1。
- **不加 `text-overflow:ellipsis`**。见 §4。
- **不改 `apply_branding.py`**。见 §3。
