# 数学可视化交互教学工具 · 设计系统

**版本** v1.0 · 2026-07 · 提取自《三角函数的本质》(`trig-essence-3d.html`)
**适用范围** 基于 Canvas 2D 的单文件数学 / 物理交互教学页面
**配套文件** `math-viz-starter.html`（可直接开发的起步模板，含本规范全部令牌与引擎代码）

---

## 0. 设计定位（一页速览）

**美学命题：暗色"示波器 / 天文观测仪"。** 波形最早就是在示波器的荧光屏上被人看见的——深空蓝黑的玻璃底上，几条荧光轨迹各司其色，数学符号用衬线斜体排印，像仪器面板上的镌刻。全屏 Canvas 就是主角，UI 是浮在玻璃上的一层薄霜。

五条不可妥协的原则：

1. **单文件、零依赖。** 一个 `.html` 打开即用，可离线、可发给学生、可嵌 iframe。
2. **画布即主角。** 全屏渲染，其余 UI（标题、页签、面板、提示）都是浮层，绝不切分画布。
3. **一条曲线一种颜色，六处同源。** 开关图例圆点、曲线本体、投影虚线、头部光点、读数加粗值、公式标注，全部使用同一语义色。
4. **数学符号一律衬线斜体**（Georgia → Songti SC 回退），无论出现在 Canvas 里还是 HTML 里。
5. **每个工具必须有"顿悟视角"。** 视角预设中除「立体」外，至少包含一个能让抽象关系瞬间显形的正交视角（如"圆被压成振动线段"）。

**签名元素**：可旋转的三维场景本身——同一个数学对象，换个角度就是另一条曲线。

---

## 1. 设计令牌 Design Tokens

### 1.1 颜色 · 语义分配表

所有颜色以 CSS 变量声明在 `:root`，Canvas 内以字面量复用同值。

| 令牌 | 值 | 语义角色 | 典型应用 |
|---|---|---|---|
| `--bg-deep` | `#05070d` | 背景基底 | body 背景、径向渐变外沿 |
| `--bg-mid` | `#0c1526` | 背景中心 | 径向渐变中心（W×0.5, H×0.3） |
| `--trace-cyan` | `#2dd4ea` | **源几何 / 结构** | 单位圆、UI 主强调（滑杆拇指、active 态、焦点环） |
| `--trace-rose` | `#fb7185` | **第一主曲线** | sin、y 分量族 |
| `--trace-violet` | `#a78bfa` | **第二曲线** | cos、x 分量族 |
| `--trace-emerald` | `#34d399` | **第三曲线** | tan 及其切线结构 |
| `--trace-orange` | `#fb923c` | **第四曲线** | cot 及其切线结构 |
| `--angle-amber` | `#fbbf24` | **度量注记** | 角度弧 θ、周期标尺 T、「辅助线」开关图例 |
| `--ui-bright` | `#e2e8f0` | 主体文本 / 运动主体 | 正文、旋转半径、螺旋轨迹 |
| `--ui-slate` | `#9fb0c8` | 次级文本 / 骨架 | 坐标轴、刻度、次级说明 |
| `--panel-bg` | `rgba(13,20,36,.74)` | 玻璃面板底 | 面板、页签容器 |
| `--panel-line` | `rgba(148,163,184,.16)` | 玻璃描边 | 面板边框、分隔线 |

曲线色启用顺序固定：**rose → violet → emerald → orange**。第五条曲线出现时应先质疑场景是否过载，确需时以 `#e2e8f0` 白系补位。

Canvas 专用字面量（与令牌同族）：

| 名称 | 值 | 用途 |
|---|---|---|
| `AXIS` | `rgba(159,176,200,0.9)` | 坐标轴、箭头、轴字母 |
| `AXIS_DIM` | `rgba(159,176,200,0.5)` | 刻度短线 |
| 网格 | `rgba(148,163,184,0.05–0.10)` | 主平面 .10 / 时间竖线 .07 / 次平面 .05 |
| 半径 / 主体 | `rgba(241,245,249,0.92)` | 旋转半径等"当前状态"实线 |
| 运动点晕 | `rgba(186,240,255,0.9)` | 主运动点 P 的光晕中层 |

### 1.2 透明度词汇表

同一色相通过固定的 alpha 档位表达层级，**不要发明新档位**：

| 档位 | alpha | 含义 |
|---|---|---|
| 实体 | `0.9 – 1` | 曲线核心、轴、当前值 |
| 结构 | `0.5 – 0.55` | 切线、刻度、象限短线 |
| 渐近提示 | `0.28 – 0.30` | 渐近线虚线、平面中轴线 |
| 包络 / 参考 | `0.20 – 0.22` | ±A 包络、tan=±1 参考线 |
| 辉光 | `0.12 – 0.14` | 曲线外层辉光描边 |
| 网格 | `0.05 – 0.10` | 背景网格 |
| 渐隐尾 | `0.04 – 0.05` | 历史曲线梯度终点 |

### 1.3 字体

| 令牌 | 栈 | 职责 |
|---|---|---|
| `--font-cn` | `ui-sans-serif, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif` | 全部中文 UI |
| `--font-math` | `Georgia, "Times New Roman", "Songti SC", "Noto Serif SC", serif` | **一切数学内容**：轴字母、θ、公式、∞、页面主标题；出现即斜体（标题除外） |
| `--font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, "Cascadia Mono", monospace` | 数值：滑杆读数、读数区 |

HTML 中数学符号写法：`角速度 <i>ω</i>`，由 `.ctl label i { font-family:var(--font-math); font-style:italic }` 接管。

### 1.4 字号阶梯

| 用途 | 规格 |
|---|---|
| 主标题 h1 | math 26px / 600 / 字距 .08em / `text-shadow: 0 2px 20px rgba(45,212,234,.20)` |
| 眉题 eyebrow | 10px / 字距 .22em / 英文大写 + 中文（`INTERACTIVE MATH · 交互式数学`） |
| 品牌描述 | 12.5px / 行高 1.65 |
| 面板标题 | 13px / 600 / 字距 .06em |
| 控件标签 / 开关 / 按钮 | 12px（视角小按钮 11.5px） |
| 滑杆读数 | mono 11.5px / `#7dd3fc` |
| 读数区 | mono 11.5px / 行高 1.75 |
| 提示 tips / hint | 11px / 行高 1.65（hint 字距 .05em） |
| Canvas 轴字母 | italic math 15px |
| Canvas 公式 / θ | italic math 13px |
| Canvas 刻度 / 秒标 | 10px（周期 T 标签 10.5px；`x = A` 类结构标签 italic 11px；∞ italic 15px） |

移动端（≤760px）仅 h1 降为 20px，其余字号不变。

### 1.5 空间 · 圆角 · 阴影 · 模糊

| 令牌 | 值 |
|---|---|
| 面板 | 宽 304px · top/right 14px · 圆角 16px · 内边距 head `12 14 10` / body `6 14 14` |
| 玻璃效果 | `backdrop-filter: blur(14px)` + `--panel-bg` + 1px `--panel-line` |
| 阴影 | 面板 `0 18px 50px rgba(0,0,0,.45)`；页签 `0 12px 34px rgba(0,0,0,.4)` |
| 页签容器 | top 16px 水平居中 · 胶囊 999 · padding 4px · gap 4px |
| 品牌区 | top 20 / left 24 · `pointer-events:none` |
| hint | bottom 12 水平居中 · `pointer-events:none` |
| 按钮 | 圆角 9px · padding `6 10`；折叠钮 24×24 圆角 8 |
| 滑杆 | 轨道 4px 圆角 2 `rgba(148,163,184,.28)`；拇指 14px（Firefox 11px）青色 + 2px `#0b1220` 描边 + `0 0 8px rgba(45,212,234,.8)` 辉光 |
| 控件行距 | `.ctl` 上下 `11px 3px`；开关 gap `7px 12px`；图例圆点 8×8 + `box-shadow:0 0 6px` 同色 |

### 1.6 动效

| 项 | 值 |
|---|---|
| 相机过渡 | 750ms · easeInOutCubic（`prefers-reduced-motion` 时 1ms） |
| UI hover | `transition: .15s`（边框色 / 文字色 / 背景） |
| 主循环 | rAF 常驻（暂停仅停模拟，相机仍可动）；`dt = clamp(Δ, 0, 0.05)` 防后台跳变 |
| 主循环的兜底 | **引擎既定成员，照抄 starter，不要自造**：`frame()` 整体包 `try/catch`，`requestAnimationFrame(frame)` 放 `finally`（机械保证「循环永不断」，不依赖 catch 里写对什么）；catch 里**只调** `frameError(err)`——它用 `frameErrSeen` 按「`curTab` + 错误消息」组成的键去重后 `console.warn`，`resetSim()` 清表。`frameErrSeen` / `frameError()` 的声明要排在 `resetSim()` **之前**（`resetSim()` 引用 `frameErrSeen`）。详见 §8 自查清单同名条目 |
| 主循环**体内** | 不受上一条约束，由工具自己决定。帧内定步长子步进（把一帧的 `dt` 切成 `ceil(dt/h)` 个固定步长 `h`，并给子步数设上限防后台切回卡死）、达到条件后重新播种，都是正当写法——混沌系统直接拿 `dt` 积分是灾难，必须这样写。**标准件是兜底那一层，不是循环体的形状**：别照抄 starter 的循环体，也别指望所有工具的 `frame()` 逐字节相同 |
| 读数刷新 | 节流 120ms |

---

## 2. 布局系统

五个固定区域浮于全屏画布之上，任何新工具不得增减区域，只改内容：

```
┌────────────────────────────────────────────────┐
│ 品牌区(左上)        页签(顶部中央)   参数面板(右上)│
│ eyebrow                                 304px  │
│ h1 标题             ┌────────────┐    可折叠   │
│ 一句话描述           │            │             │
│                     │  全屏画布   │             │
│                     │  (主角)    │             │
│                     └────────────┘             │
│                  操作提示条(底部中央)             │
└────────────────────────────────────────────────┘
```

| 区域 | 规则 |
|---|---|
| 画布 | `position:fixed; inset:0`，`touch-action:none`，`cursor:grab / grabbing` |
| 品牌区 | 不可交互；描述随页签切换（`textContent` 替换） |
| 页签 | `z-index:5`；胶囊分段控件；active 底色随页签主题色变化 |
| 面板 | 可折叠；内部自上而下固定次序：**滑杆组 → 播放/重置 → 开关组(按页签) → 共享开关 → 视角行(按页签) → 读数区 → tips** |
| 提示条 | 单行手势 + 快捷键速查 |

**移动端（≤760px）**：品牌描述隐藏、h1 20px；页签移至 `top:52px; left:14px`（标题下方左对齐）；面板变为底部抽屉（`left/right/bottom:10px`，`max-height:62vh`），JS 判定 `innerWidth<760` 时默认折叠；hint 隐藏。手势：单指旋转、双指捏合缩放 + 平移（Pointer Events 统一实现）。

---

## 3. 组件规范

### 3.1 参数滑杆 `.ctl`

```html
<div class="ctl">
  <div class="top"><label>角速度 <i>ω</i></label><span class="val" id="vOmega"></span></div>
  <input type="range" id="rOmega" min="0.2" max="4" step="0.05" value="1">
</div>
```

标签左、实时读数右（mono 青蓝 `#7dd3fc`）、滑杆整行。读数格式由 `fmt` 函数给出（如 `1.00 rad/s`、`0.50 π`）。焦点态：`outline: 2px solid rgba(45,212,234,.7)`。

### 3.2 开关 `.tg`（带图例圆点）

```html
<label class="tg"><input type="checkbox" id="cSin" checked>
  <i class="dot" style="--c:#fb7185"></i>正弦曲线</label>
```

圆点颜色 = 所控元素的语义色（这是"六处同源"的第一处）。原生 checkbox 用 `accent-color: var(--trace-cyan)`。通用开关固定两枚：「投影辅助线」（琥珀）与「网格」（`#64748b`）。

### 3.3 按钮 `.btn`

| 状态 | 样式 |
|---|---|
| 默认 | 底 `rgba(30,41,59,.55)` · 边 `rgba(148,163,184,.25)` · 字 `#d7e2f2` |
| hover | 边框转青 `rgba(45,212,234,.55)` |
| `.active`（视角选中） | 边 `rgba(45,212,234,.8)` · 底 `rgba(45,212,234,.12)` · 字 `#9be8f7` |
| focus-visible | 青色 2px outline |

变体：`.wide`（flex:1，用于播放键）、`.vbtn`（视角小号 `5px 9px` / 11.5px）。播放键文案在 `⏸ 暂停` / `▶ 继续` 间切换。

### 3.4 页签 `.tabs > .tab`

胶囊分段控件。active 态默认青色系；可按页签主题换色（如正切页 `rgba(52,211,153,…)` 翠绿）。切换职责：换 `body[data-tab]`、换相机对象、换品牌描述与 tips、刷新视角高亮与读数——**不打断模拟**。

### 3.5 读数区 `.readout`

mono 等宽，行高 1.75，顶部 1px 分隔线。固定首两行：

```
t = 3.42 s · θ = ωt+φ = 3.42 rad
≡ 196°（第 0.54 圈）
```

其后每条曲线一行，值用 `<b>` 加粗并着语义色（`.sinC b{color:var(--trace-rose)}` 模式）；末行 `.dim` 放频率 / 周期 / 渐近线说明。

### 3.6 提示 `.tips` 与 hint

tips：**一段话只讲一个顿悟点**，并指向具体操作（某视角 / 某开关）。hint：`拖拽旋转 · 滚轮 / 双指缩放 · 右键或 Shift 拖拽平移 · 双击回正 · 空格暂停 · 1–4 视角 · T 切换页签`。

### 3.7 折叠钮 `.fold`

24×24，`−` / `+` 切换；折叠时隐藏 `.panel-body` 且面板头去掉底部分隔线（`.panel:not(.collapsed) .panel-head { border-bottom: … }`）。

---

## 4. Canvas 绘制语言

### 4.1 世界坐标约定

右手系：**x 横、y 纵（几何所在平面 z=0）、z = t 时间轴**（垂直于几何平面，长度 `WAVE_LEN = 8` 世界单位）。历史曲线"从几何体流出"：最新样本永远贴在 z=0，越旧越远（`z = (now − t) × 波速`）。

### 4.2 线型词汇表

| 元素 | 配方 |
|---|---|
| 历史曲线 | 双描：外层 `width 5.5, alpha .13` 同色辉光 + 内核 `width 2.2` 线性渐变 `[纯色 1 → 同色 .04]`（头亮尾隐，屏幕空间梯度） |
| 白色轨迹（螺旋等） | `width 1.6, fade [rgba(226,232,240,.85) → 0]` |
| 结构线（切线等） | `width 1.6, alpha .55` 同曲线色 |
| 读数粗线段（tan 段等） | 双描 `6 @ .26–.28` + `3` 实色；超界时改用 `fade [实色 → 0]` 渐隐并标 `∞` |
| 旋转半径 | `width 2, rgba(241,245,249,.92)` |
| 圆 | 辉光 `6 @ .13` + 内核 `2 @ .95` 青；象限短线 `1 @ .5`（r×0.95→1.06） |
| 坐标轴 | `width 1.4` AXIS + 箭头（长 9px、张角 ±0.42 rad）+ 轴字母 |
| 刻度 | `width 1.2` AXIS_DIM，短线 ±0.05~0.06 世界单位 |

虚线语义（screen-space `setLineDash`）：

| 图案 | 语义 | 线宽 |
|---|---|---|
| `[7,7]` | 投影虚线（点 → 轴） | 1.5 |
| `[6,6]` | 半径延长线 | 1.3 |
| `[5,6]` | 包络 / 参考值（±A、tan=±1） | 1 |
| `[4,5]` | 渐近线 | 1 |

### 4.3 点的配方（`glowDot`：径向渐变 0→白核，0.35→色晕，1→透明）

| 点 | 半径 | 核 / 晕 |
|---|---|---|
| 主运动点 P | 15 | `#fff` / `rgba(186,240,255,.9)` |
| 曲线头（投影点） | 9–10 | `#fff` / 曲线色 `.85–.9` |
| 次曲线头 | 8 | 同上 |
| 切点 / 原点（`solidDot`） | 3 / 2.2 | 实色，无晕 |

### 4.4 标注

`label3`：投影后 `fillText`，恒定字号（不随深度缩放），`shadowColor rgba(3,6,12,.85) + shadowBlur 4` 保证任何背景可读，`textBaseline:middle`。公式标注（如 `y = A·sin(ωt + φ)`）为 italic 13px math、着曲线色，锚在曲线附近的固定世界坐标。度量类（θ、`T = … s`）一律琥珀。

### 4.5 绘制顺序（画家算法，后画者在上）

```
背景渐变 → 网格 → 包络/参考虚线 → 坐标轴+刻度+周期标尺
→ 历史曲线(白轨迹 → 次曲线 → 主曲线) → 结构线(切线等)
→ 圆 → 角度弧 θ → 旋转半径 → 投影虚线 → 曲线头光点 → 主点 P → 公式标注
```

### 4.6 引擎不变量

透视投影 `FOCAL = 1.2 × min(H, W×1.1)`；近裁剪 `NEAR = 0.15`（折线逐段裁剪，支持 `null` 断点续画）；`devicePixelRatio` 上限 2.5；背景径向渐变随 resize 重建。**历史采样存"当时的真实值"**（如 x、y 本身），参数中途改变时历史波形保留真实轨迹、绝不重算。

---

## 5. 交互词汇

### 5.1 轨道相机

球面参数 `{ az, el, dist, tx, ty, tz }`，`up = (0,1,0)`，el 钳制 `[−1.45, 1.53]`。**每个页签独立记忆一份相机**；页签切换取回各自相机且取消进行中的 tween。

### 5.2 手势与快捷键

| 输入 | 行为 | 常数 |
|---|---|---|
| 左键拖拽 | 旋转 | `az −= dx×0.0055; el += dy×0.0055` |
| 右键 / Shift / 中键拖拽 | 平移 target | 比例 `dist / FOCAL`；钳制 tx±6 / ty±5 / tz∈[−3,11] |
| 滚轮 | 缩放 | `dist ×= exp(ΔY×0.0012)`，钳制 `[4.5, 60]` |
| 双指 | 捏合缩放 + 质心平移 | Pointer Events 统一处理 |
| 双击 | 回到「立体」视角 | tween |
| `Space` | 暂停 / 继续 | 焦点在控件上时放行 |
| `R` | 重置模拟（清历史，参数与相机不动） | |
| `1–4`（或 1–9） | 当前页签的视角预设 | |
| `T` | 循环切换页签 | |

任何手动拖拽 / 滚轮都会：取消 tween、清除当前页签视角高亮（`lastView[tab] = null`）。

### 5.3 视角预设规则

每个场景的 `views` 首项必须是 `iso`（立体，双击回正的目标）；命名遵循「对象 + 平面」：`圆 x·y`、`正弦 y·t`、`余切 x·t`。正交教学视角用 `az≈0.001 / el≈0.02`（正视）、`az=−π/2, el≈0.001`（侧视 y·t）、`az=−π/2, el=1.52`（俯视 x·t）——微偏 0.001 避免万向锁。移动端 / 竖屏所有预设距离 ×1.4（`viewDist`）。选中某视角若其内容开关未开，应自动开启（如「余切 x·t」联动打开余切曲线）。

---

## 6. 数据与状态约定

| 约定 | 内容 |
|---|---|
| 单一运动源 | 全部页签共享同一份 `state`（参数）与 `samples`（历史）——强调"同一个运动、不同的测量"。共享的是**值**：滑块的可见性由 `params` 按页签决定，但值本身跨页签连续，切回来不会丢。相机与显示开关按页签区分 |
| 场景作用域参数 | 场景用 `params: ['key', …]` 声明本页签真正读取的滑块；`switchTab` 按此显隐。省略 = 显示全部（向后兼容）。实测 67% 的滑块展示对当前页签无效，这是修正手段；这条规则同时是**驱动漂移不会变成不可纠正**的原因——自动播放会把跨页签共享的键留在任意值上（30 个工具存在这种键），只要每个消费它的场景都把它声明进 `params`，那边就永远有滑杆可纠正 |
| 时间驱动 | 场景用 `drive: { key, from, to, period, kind, mode? }` 声明随时间走的量。求值是引擎时钟的纯函数（不做增量积分），封装为顶层 `applyDrive()`，`frame()` 与录制器离线渲染各自调用。`kind: 'circular'` 默认 `loop`，`'linear'` 默认 `pingpong`，用户可运行时切换 |
| 滑杆的两个闭包 | `buildParams()` 为每根滑杆生成两个闭包：`render()` **只**把 `input.value` 回显成读数，`upd()` 才是「用户动了滑杆」的语义（**写 `state`**）。二者必须分开，且写 `state` 的入口只收窄到 `input` 的 `input` 事件。理由：被 `drive` 驱动的参数，其 `state` 值比滑杆 `step` 精细得多，`syncParamSlider()` 把它写进 `input` 时会被吸附到刻度上；若语言切换（`relabel`）顺手调 `upd()`，那个吸附后的粗值就会被永久写回 `state`，等于把驱动量量化一次——而暂停时 `frame()` 不再跑 `applyDrive()`，再也修不回来。所以 `relabel` 只调 `render()`，初始化用一次显式的 `upd()` |
| 双语义迭代（**工具级模式，非引擎能力**） | 当一个页签的被演示对象是「由某个参数**播种**的迭代」（牛顿法的 x₀、梯度下降的起点/步长），给那个参数加 `drive` 会与「历史绝不重算」（§4.6）正面冲突：滑杆已经滑到别处，画面却还画着用旧种子算出来的那条轨迹。已落地的解法是**双语义**——驱动模式下每帧按当前种子整条重播，手动模式下退回只追加的真实历史。三条约束缺一不可：① 判别一律用引擎的只读访问器 `driveInfo()`（它已含「本页有 drive」+「用户没关自动播放」两个条件），**不要**手写 `autoPlay[curTab] && SCENES[curTab].drive`——同一判据出现两种写法，正是这个引擎被复制成 51 份后最容易漂移的地方；② 重播只在 `driveInfo()` 非 null 时发生；③ 反向过渡（关掉自动播放 / 伸手拖那根滑杆）必须把轨迹**只缩不增**地裁回步号，否则读数报第 5 步、画面却画着 60 步。引擎只提供 `driveInfo()` 这一个只读钩子，重播逻辑属于工具自己——绝大多数工具用不上，别照抄。参考实现：`recurrence-iteration-dynamics-3d`（newton 页）、`optimization-convexity-gradient-descent-3d` |
| 相位连续 | `theta += ω·dt` 累积积分；改 ω 不断相位；φ 作用于显示层 `th = theta + phi` |
| 采样 | 每帧 push `{t, …真实值}`；按当前波速滑窗剔除（`windowSec = WAVE_LEN/波速 + 0.5`）；重置后立即补一枚初始样本 |
| 暂停语义 | 暂停只冻结模拟；渲染、相机、参数滑杆全部照常（当前点用实时参数显示） |
| 奇点处理 | 无界函数以 `CLIP` 世界单位裁剪；分支边界（渐近线）折线断开并画渐近虚线；θ 空间自适应细分（步长约束 |Δ值|≤0.3，上限 12 段）使陡峭段平滑并精确触到裁剪边缘 |

---

## 7. 文案规范

界面语言为中英双语（见 §9）；默认按「URL 参数 → localStorage → 浏览器语言」解析，右上角可切换。数学符号（ω、A、φ、θ、T、sin…）不翻译，保持原样并交给 math 字体。负号一律 U+2212（−），数值默认两位小数，角度取整，`|值|>999` 显示 `±∞`——中英一致。英文文案用 sentence case，不用 Title Case 与全大写（品牌眉题除外）；语句简洁地道，不逐字直译中文。品牌眉题 `INTERACTIVE MATH · 交互式数学` 是常量，不参与切换。

| 文案位 | 公式 | 示例 |
|---|---|---|
| 品牌描述 | 一句话讲清数学本质 + 一句交互引导 | 「单位圆上的匀速圆周运动，其 y 方向投影随时间 t 展开，即是正弦曲线。拖拽旋转坐标系，从不同角度观察同一个运动。」 |
| tips | 一个顿悟点 + 指向具体视角或开关；可含一条术语源流 | 「…这正是『正切』(tangent) 名字的由来。」 |
| 读数区 | 首两行固定（t / θ / 度数 / 圈数），每曲线一行同色加粗，末行周期与提醒 | `T = π/ω = 3.14 s · cos θ = 0 处为渐近线` |
| 眉题 | 英文大写 + 间隔点 + 中文 | `INTERACTIVE MATH · 交互式数学` |

---

## 8. 新工具落地流程

基于 `math-viz-starter.html`（内含本规范全部令牌 + 完整引擎 + 声明式配置层）：

1. 复制模板，填写 ⓪ `TOOL`（id 与双语标题，运行时驱动 `<title>`/`<h1>`）；
2. 在 `PARAMS` 数组声明滑杆（key / label / 范围 / 格式化 / 可选映射函数）；
3. 在 `SCENES` 注册场景：`label`（页签名）、`brand`、`tips`、`views`（首项 iso）、`toggles`（曲线开关按启用顺序取色）、`params`（本页签真正读取的滑块 key 数组）、`drive`（时间驱动声明；正当静止写显式 `null` 并注释理由，已有动画则不写 `drive` 而留一行注释说明它靠什么在动——四条出路见下方自查清单）、`draw(C)`、`readout()`；
4. 按需扩展 `pushSample` 的采样字段（原则：记录当时真实值）；
5. 用引擎部件拼场景：`drawAxes / drawGridXY / drawTimeGrid / drawPeriodBracket / drawCircle / drawAngleArc / strokePoly / line3 / glowDot / label3`；
6. 自查清单：□ 曲线六处同源 □ 有顿悟视角 □ tips 只讲一件事 □ 暂停时相机仍可动 □ 参数中途可调且历史不重算 □ 移动端折叠正常 □ 每个场景声明 params，且与该场景实际读取的 state 键一致（含经模块级辅助函数间接读取的） □ 没有静止页签：每个页签必须落在**四条出路之一**，且后三条都要留下可核对的痕迹——① 由引擎时钟直接驱动（`theta` / `state.t` 让被演示量自己走，无需任何声明）；② 声明 `drive`；③ 正当静止：显式写 `drive: null` **并在同一处注释写明理由**（静态对照场景合法，但须是有意识的选择）；④ 已有动画、故不声明 `drive`：**必须在场景里留一行注释写明它靠什么机制在动**（哪个量、由谁推进、晚期实测读数）。第 ④ 条不是可选的礼貌——没有这行注释，「已排除」与「漏了」在事后审计里无法区分。判「有没有动」的口径：**一次性演进后永久定格算静止**（喂满 20 s 再推到 t≈200 s 取窗口，不重复帧 = 1 即定格），此时正确的修法通常是让这段演进在工具局部区循环起来，而不是补一条假的 `drive: null` 理由 □ 被 drive 驱动的参数若带 map，必须同时提供 invMap（否则滑块无法回显驱动值） □ drive 的 [from, to] 必须落在该参数映射后的 [min, max] 之内（越界会被滑杆钳住：读数与滑杆句柄停在端点上；此后**用户第一次拖动这根滑杆**时 upd() 就把钳过的值写回 state。语言切换不再触发此事——relabel 只调 render()，见 §6「滑杆的两个闭包」） □ 引擎的行为查询不只认样式类：querySelectorAll 限定结构容器（如 .views .vbtn）或改用 data-* 属性 □ `frame()` 有 `try/catch` 且 `requestAnimationFrame(frame)` 在 `finally` 里（一帧抛出不得杀死整个渲染循环；rAF 放 finally 是机械保证，不依赖 catch 里写对什么）。**去重器同样是标准件**：catch 里只调引擎的 `frameError(err)`，它靠 `frameErrSeen` 按「`curTab` + 错误消息」组成的键去重、`console.warn` 输出、`resetSim()` 清表；声明位置排在 `resetSim()` 之前。**不许自造一次性全局布尔**（`let frameErrLogged = false` / `let frameErr = false` 之类）——那种写法第一条错报完就永久关麦，**第二个页签抛出的错会被完全吞掉**，用户和维护者都再也看不见；按页签去重的口径是「同一页签的不同错误、不同页签的同一错误，都各报一次」。反过来，`frame()` **体内**写什么不受本条约束（子步进、重新播种等见 §6「主循环体内」），下方的结构断言也只查兜底那一层，与循环体形状无关 □ 若声明了 `RECORD`（§11）：每个可录制页签六个钩子齐备（`capture` / `restore` / `seed` / `reseed` / `lock` / `roundOf`），且 **`capture` 与 `restore` 对称**——`restore(capture())` 之后再走一步，结果必须与不经过这趟往返时逐位相同（否则回放会悄悄偏离，而画面看上去完全正常）；`lock` 必须列全所有种子滑杆；判当前模式一律走引擎的 `recInfo()`，不得自拼判据 □ `node --check` 通过 □ 双语：全部文案为 `{zh,en}` 对象并经 `t()`；`?lang=en` 直达、切换按钮、记忆、`<html lang>`/`document.title` 跟随均正常（§9）□ 版本：meta 两枚 + 头注释 changelog + 面板角标齐备；已登记 `tools.json` 并同步 `index.html` 内嵌 TOOLS 与 README 工具表（§10）

7. `frame()` 兜底层的结构断言（上一条清单项的机器可查版本）：

```bash
python3 - outputs/*.html <<'PY'
import sys
bad = 0
for path in sys.argv[1:]:
    L = open(path, encoding='utf-8').read().split('\n')
    why = []
    st = [i for i, l in enumerate(L) if l == 'function frame(ts) {']
    if len(st) != 1:
        why.append('function frame(ts) { 命中 %d 次（期望 1）' % len(st))
    else:
        s = st[0]
        e = next((i for i in range(s + 1, len(L)) if L[i] == '}'), None)
        body = L[s + 1:e] if e else []
        # A. 外壳：三条断言，与循环体的形状无关（子步进、重新播种都不影响）
        if not body or body[0].strip() != 'try {':
            why.append('函数体第一行不是 try {')
        fin = [i for i, l in enumerate(body) if l.strip() == '} finally {']
        raf = [i for i, l in enumerate(body) if 'requestAnimationFrame(frame)' in l]
        if len(fin) != 1: why.append('} finally { 出现 %d 次（期望 1）' % len(fin))
        if len(raf) != 1: why.append('rAF 出现 %d 次（期望 1）' % len(raf))
        if len(fin) == 1 and len(raf) == 1 and raf[0] < fin[0]:
            why.append('rAF 在 } finally { 之前')
        # B. 兜底层：只调 frameError()，且声明排在 resetSim() 之前
        cat = [i for i, l in enumerate(body) if l.strip() == '} catch (err) {']
        if len(cat) != 1: why.append('} catch (err) { 出现 %d 次（期望 1）' % len(cat))
        elif len(fin) == 1 and [l.strip() for l in body[cat[0]+1:fin[0]] if l.strip()] != ['frameError(err);']:
            why.append('catch 体不是单独一句 frameError(err);')
    d = [i for i, l in enumerate(L) if l == 'const frameErrSeen = Object.create(null);']
    r = [i for i, l in enumerate(L) if l == 'function resetSim() {']
    if len(d) != 1: why.append('frameErrSeen 声明命中 %d 次（期望 1）' % len(d))
    elif len(r) == 1 and d[0] > r[0]: why.append('frameErrSeen 声明排在 resetSim() 之后（TDZ 隐患）')
    if not any('Object.keys(frameErrSeen)' in l for l in L):
        why.append('resetSim() 没有清空 frameErrSeen')
    if any(p in l for l in L for p in ('frameErrLogged', 'frameErr ', 'frameErr=')):
        why.append('存在自造的一次性错误容器')
    if why:
        bad += 1
        print('FAIL  %s\n%s' % (path, ''.join('        · %s\n' % w for w in why)), end='')
print('%d 个文件，%d 个不合规' % (len(sys.argv) - 1, bad))
sys.exit(1 if bad else 0)
PY
```

   为什么是解析式断言而不是 `grep`：**曾经用过** `grep -B2 "requestAnimationFrame(frame);" outputs/*.html | grep -c "} finally {"`，它检查的是「`finally` 与 rAF 之间隔几行」，而那段距离取决于中间写了几行设计注释——纯属自由。实测：51 个引擎标准文件的距离是 4 行（中间三行注释），`-B2` 只数出 3 个，**51/54 的假阴性**。把 `-B2` 换成 `-B5` 不是修复，只是把一个脆弱的行数换成另一个：注释多写一行就又塌了。断言必须落在结构上（哪一行是函数体第一行、某个记号在函数体内出现几次、谁的行号在谁之后），不能落在行距上。同理，断言里**不许**出现「与 starter 逐字节相同」这种判据——那会把帧内子步进的混沌/多体工具判成违规，而它们的写法是对的（§6「主循环体内」）。

### 给 Claude Code 的任务简报模板

```
请基于 math-viz-starter.html 制作一个新的数学可视化教学工具，
严格遵循 math-viz-design-system.md 的全部令牌与约定。

工具主题：〔例：圆锥曲线的离心率统一定义〕
数学内容：〔核心关系式、要演示的定理/性质〕
参数（PARAMS）：〔例：离心率 e ∈ (0,3)、焦准距 p〕
场景（SCENES 页签）：〔每页签：名称、要画什么、顿悟视角是什么〕
每页签的驱动：〔哪个参数随时间走、值域、circular（角度类，默认 loop）还是 linear（坐标轴类，默认 pingpong）；确实该静止的写「无」并说明理由〕
曲线配色：按 rose → violet → emerald → orange 顺序启用
特殊处理：〔奇点/渐近线/无界值？参照第 6 节裁剪与断开约定〕
验收：node --check 通过；符合第 8 节自查清单。
```

---

## 9. 双语规范（i18n）

**就地双语对象，不设集中词典。** 一切面向人的文案在声明处写成 `{ zh: '运动轨迹', en: 'Trail' }`；引擎提供

    function t(s){ return (s && typeof s === 'object') ? (s[LANG] != null ? s[LANG] : s.zh) : s; }

传对象取当前语言（缺英文回退中文），传字符串原样返回——数学符号与数字天然免翻译。

**覆盖范围**：`PARAMS[].label`、`SCENES` 的 `label / brand / tips`、`views[].label`、`toggles[].label`、`readout()` 中的说明文字、Canvas 内标注（绘制时经 `t()`）、`<title>` 与 `<h1>`（经工具元信息 `TOOL.title / TOOL.h1`）、引擎 UI 常量 `UI`（面板标题、暂停/继续/重置、视角、hint）。眉题不参与。

**语言解析优先级**：`?lang=` → `localStorage('mathviz-lang')` → `navigator.language`（zh* → zh，否则 en）→ 默认 zh。localStorage 不可用时静默降级。

**切换行为**：面板头部 `中 / EN` 按钮（按钮显示目标语言）；切换时 `history.replaceState` 更新 URL、写 localStorage、更新 `<html lang>`、`document.title`，并重打全部 UI 标签（`applyLang()`）；Canvas 下一帧自然跟随。滑杆当前值、开关状态、相机、历史采样一律不受切换影响。落地页工具链接携带当前 `?lang=`。

**fmt 中的单位**：含中文单位的 fmt 写作 `v => fmt(v) + t({ zh: ' 单位/s', en: ' units/s' })`。

---

## 10. 版本管理

每个工具独立语义化版本：不兼容大改 major · 新增功能/场景 minor · 修复与文案微调 patch。

**三处落地，注册表为准**：
1. `tools.json`（仓库根）：`version` + 双语 `changelog`（新→旧）。
2. 工具 HTML：`<meta name="tool-version" content="x.y.z">`、`<meta name="engine-version" content="a.b.c">`（复制时 starter 的版本），文件头注释内 changelog 块。
3. 面板头部版本角标 `vx.y.z`（从 meta 读取，运行时填充）。

**强制规则**：对已有工具的任何修改必须 bump 版本，并同步 tools.json 与文件内两处 changelog；这是 §8 验收门槛之一。starter 自身以 `STARTER_VERSION` 管理版本，工具复制时把它记入 `engine-version`。

---

## 11. 演算记录与回放（record / replay）

**适用范围**：演化高度依赖初始条件、因而「同一次运行不可复得」的工具（混沌、多体、随机游走、由种子驱动的迭代）。**这是可选能力：不声明 `RECORD` 的工具没有任何录制 UI，行为与体积均不受影响。**

### 11.1 为什么默认存轨迹，而不是只存种子

系统是确定性的，初值 + 积分参数在数学上唯一决定整条演化——这诱使人只存种子（几百字节，优雅）。**但它跨机器不成立。**

ECMAScript 不保证 `Math.sin` / `Math.cos` / `Math.pow` 等超越函数的结果跨实现逐位相同（规范只要求实现质量，未规定精确舍入）。对李雅普诺夫指数 λ ≈ 1.1 s⁻¹ 的双摆，1 ULP ≈ 2⁻⁵² 的差别在

    t = 52 · ln2 / λ ≈ 33 秒

之后就长到 O(1)。**换一个浏览器版本，从同一个种子重跑，半分钟后画面就完全不同了。**

因此：**默认存轨迹**（回放不做算术，任何机器都忠实）；**种子一并存**，但它的用途不是重现，而是 §11.2。

### 11.2 把这条事实做成功能

存档同时携带种子与轨迹。加载时引擎做两件事：① 按轨迹进入 replay（一定成功）；② **同时**用种子在本机重新积分，与记录的轨迹逐点比对，画出分离曲线 δ(t)。

两种结局都有价值：曲线贴在舍入噪声量级 ⇒ 本机复现了原始运行；曲线按指数抬起来 ⇒ **工具在自己身上演示了自己的论点**。UI 必须把这一层讲明白，不能让用户以为是 bug。

**前提：录制期间必须把时间量子化。** 平时引擎按帧的真实 `dt` 推进，那条轨迹依赖于帧率抖动 —— 于是「从同一种子重算」**在本机都对不上**，比对曲线沦为噪声、上面这段话一句都不成立。所以录制态下 `frame()` 把经过的时间攒成整数个 `REC_DT` 再推进（`while (acc >= REC_DT) { acc -= REC_DT; simAdvance(REC_DT); recPush(); }`），轨迹因此是种子的确定性函数。**重算必须走与录制完全相同的那一个 `simAdvance`** —— 两边各写一份推进逻辑，「重算」就变成了另一条数值轨迹。实测：量子化前本机比对 δ = 4.24（失败），之后 δ = 0（逐位复现）。

**推论：录制时不要再做时间节流。** 量子化本身就是节流，一格记一行即可。曾经按 `state.t - lastAt >= REC_DT` 判定，累加出的差常是 `0.019999999999999997`，于是约一半的行被悄悄丢掉、行号与步数错位 —— 这类缺陷不会报错，只会让比对永远失败。

### 11.3 录制的边界是「一轮」，不是「一段任意时长」

若工具的场景本身有周期性重新播种（§8 出路①的常见形态，如双摆①页每 18.5 s 重演一次「重合 → 分手 → 分开」），**录制应当以一轮为单位**：从种子开始，到该轮结束为止。存档于是天然对应一次完整的现象，而不是从中间截一段没头没尾的片段。工具在 `RECORD` 里用 `roundOf()` 告诉引擎当前轮次，引擎据此决定何时停止录制。

### 11.4 存档格式

单个 JSON 文件，UTF-8。

```jsonc
{
  "format": "mathviz-run",
  "formatVersion": 1,
  "tool": { "id": "…", "version": "…", "engine": "…" },
  "tab": "twin",
  "recordedAt": "…",
  "seed": { … },                       // 工具 seed() 的产物
  "trace": { "dt": 0.02, "fields": ["…"], "rows": [[…], …] }
}
```

- `rows` 用**数组的数组**而非对象数组：字段名只出现一次，体积约为对象形式的 1/4。
- 数值统一 `toPrecision(12)`。**这意味着存档不是逐位精确的状态快照**——§11.2 的比对曲线要把这项舍入计入基线，不得把它误报成「复现失败」。
- **不压缩、不引外部依赖**。60 秒 / `dt = 0.02` / 8 字段 ≈ 310 KB，可接受。
- 行数设上限，到顶后**停止录制并在面板提示**，绝不静默截断或环形覆盖——静默截断会让用户以为录到了全程。

### 11.5 加载校验

按顺序检查，任何一条不过就**明确拒绝并说明原因，不做兼容性猜测**：`format` → `formatVersion` → `tool.id` 与当前工具一致 → `tab` 存在 → `trace.fields` 与当前 `capture()` 的字段集一致。

后两条是硬门槛：跨工具或跨版本的字段错位会画出**看似合理实则错误**的图，比报错危险得多。

### 11.6 工具侧钩子（第 ④ 个编辑点）

在 `SCENES` 之后声明 `RECORD`，每个可录制页签一份：

| 键 | 职责 |
|---|---|
| `capture()` | 返回本页签的完整状态向量（JSON 可序列化）。必须足以让 `restore` 后的画面与当时一致 |
| `restore(s)` | 把状态写回 |
| `seed()` | 初值 + 积分参数，供 §11.2 本机重算 |
| `reseed(s)` | 从种子重新初始化 |
| `lock` | 回放期间必须置灰的滑杆 key 数组（改它们等于改种子，画面与数据会脱节） |
| `roundOf()` | 当前轮次，供 §11.3 判定一轮何时结束 |

`capture()` 的返回值会被扁平化成一行数字，展开顺序由第一次调用的结构冻结；后续结构变化视为错误。

### 11.7 引擎侧约定

`recInfo()` 是**唯一的只读判据访问器**——工具的 `draw()` / `readout()` 要查当前是 live / recording / replay，一律走它，**不得自己拼判据**。理由同 §6「双语义迭代」那一行：同一判据出现两种写法，正是这个引擎被复制成多份后最容易漂移的地方。

**replay 态下相机、视角、显示开关全部照常可用**——与「暂停只冻结模拟」（§6）是同一条精神：回放冻结的是演算，不是观察。replay 是一等状态，不是「暂停 + 手动拖时间」：进入后 `lock` 滑杆置灰、面板显示存档来源与比对结论、可暂停 / 逐帧 / 变速，退出即回到实时积分且不残留状态。

---

*本规范与 starter 同步演进；改动令牌时先改此文档，再改代码。*
