# 场景作用域参数与时间驱动 · 设计文档

日期：2026-07-31
状态：已确认（用户批准）

## 目标

修掉两个跨越整个工具集的系统性缺陷：

1. **面板显示对当前页签无效的滑块** —— 用户无法知道哪些控件对眼前的画面起作用。
2. **多数页签没有时间驱动** —— 画面静止，"可视化"退化成静态插图。

并把修复固化为**引擎机制 + 开发规范**，让后续新增工具不可能再犯。

## 实测数据（运行时探针，非静态分析）

先尝试静态分析（正则扫 `state.<key>`），发现不可靠：工具普遍在 `SCENES` 之外定义模块级辅助函数（`f1` / `rho` / `sim` 等），场景经由它们间接读取参数，导致漏报；改用传递闭包又因标识符匹配过宽而全面过报。

改用**运行时探针**：驱动每个工具的 `draw()`，把每个滑块推到量程两端，对比画布像素哈希；再让引擎时钟前进 0.5 秒，对比画面是否变化。方法先在 `weierstrass-essence-3d` 上做真值校验，结论与用户独立观察逐字吻合（`chord` 只有 `xAng` 有效且静止 / `rational` 只有 `tSlope` 有效且静止 / `subst` 有动画）。

全量扫描 49 个工具 / 184 个页签（`outputs/` 共 51 个，2 个未能探测，见下）：

| 指标 | 实测 |
|---|---|
| 滑块展示总次数 | 1240 |
| **其中对当前页签完全无效** | **638（51%）** |
| 一个滑块都不起作用的页签 | 11（5%） |
| **无时间驱动（静止）的页签** | **72（39%）** |
| 全部页签都静止的工具 | 4 |

最严重的十个页签：

```
complex-mult-3d      demoivre   16 个滑块 → 有效  0
complex-mult-3d      roots      16 → 3   静止
complex-mult-3d      loci       16 → 4
i-essence-3d         matrix     12 → 0   静止
complex-mult-3d      helix      16 → 5
i-essence-3d         cubic      12 → 1
i-essence-3d         turn       12 → 2
i-essence-3d         roots      12 → 2   静止
i-essence-3d         conj       12 → 3   静止
gaussian-essence-3d  clt         9 → 1   静止
```

**全部页签都静止的 4 个工具**（阶段 3 的最高优先级）：
`combinatorics-generating-functions-3d`、`least-squares-orthogonal-projection-3d`、`limit-essence-3d`、`sequences-series-essence-3d`。这四个目前完全是静态插图，录制功能对它们毫无意义。

**2 个未能探测的工具**，迁移时需人工处理：
- `trig-essence-3d-new` —— 非声明式遗留实现（`engine-version: pre-declarative`），无 `SCENES`，本设计不适用。
- `huffman-coding-text-3d` —— 探针在 `switchTab` 处抛 `dataset` 空指针，说明其页签结构与引擎约定不同，需单独排查。

## 根因

两条都在引擎，不在各个工具的实现里。

**问题 1**：`switchTab()` 已经按页签显隐 `toggles` 与 `views`（靠 `dataset.tab`），**唯独漏了 params**。`buildParams()` 把 `PARAMS` 平铺建出一次，此后不再过问页签。作者们只能把页签名塞进滑块标签（`角 x（弦·半角页）`）作为补丁——这正是"标注不准确"的来源。

**问题 2**：引擎只有一个时钟 `state.theta += state.omega * dt`，**是否消费全凭场景自觉**。场景不读 `theta` 就是死画面。

## 修复思路：把已有的手写模式提升进引擎

`basis-change-coordinates-3d` 已经手写出了正确答案：

```js
function morphS() {
  return state.autoMorph ? state.k * (0.5 - 0.5 * Math.cos(state.theta)) : state.k;
}
```

一个 per-tab 开关，在"引擎时钟"和"手动滑块"之间切换。本设计把它声明化、通用化。

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 自动播放交互 | per-tab「自动播放」开关，默认开；拖动被驱动的滑块自动关闭，交回手动 |
| `params` 是否必填 | 引擎侧选填（省略=显示全部，保证 49 个存量工具不崩）；**规范侧当作必填** |
| 迁移节奏 | 引擎 + starter + 规范先落地，工具分批迁移 |
| 驱动模式默认值 | 由 `kind` 决定：`circular`（单位圆/角度类）默认 `loop`，`linear`（坐标轴类）默认 `pingpong` |
| 模式可切换 | 同一页签同时支持两种，用户可运行时切换 |

## A. 场景作用域参数

场景新增可选字段 `params`，列出本页签**真正读取**的滑块键：

```js
chord: {
  label:  { zh: '弦 · 半角', en: 'Chord · Half angle' },
  params: ['xAng'],                 // ← 新增
  toggles: [ … ],
  views:   { … },
  draw(C) { … },
  readout() { … }
}
```

### 引擎实现

`buildParams()` 建 DOM 时把每个 `.ctl` 按 key 记账：

```js
const paramWraps = {};          // key -> .ctl 元素
…
paramWraps[p.key] = wrap;
```

`switchTab()` 末尾调用：

```js
function syncParamVisibility() {
  const list = SCENES[curTab].params;
  Object.keys(paramWraps).forEach(k => {
    paramWraps[k].style.display = (!list || list.indexOf(k) >= 0) ? '' : 'none';
  });
}
```

**不为每个页签复制滑块 DOM**。滑块值是跨页签共享的状态（`state[key]`），复制会引入多份 DOM 需要互相同步的问题——`toggles` 那样做是因为开关本就分属各页签，params 不同。只切 `display` 即可。

**向后兼容**：`params` 省略时显示全部，等于现状。因此引擎可以先落地，工具逐个迁移。

## B. 时间驱动

场景新增可选字段 `drive`，声明本页签"随时间走"的量：

```js
chord: {
  params: ['xAng'],
  drive: { key: 'xAng', from: -Math.PI, to: Math.PI, period: 8, kind: 'linear' },
  …
}
```

| 字段 | 含义 |
|---|---|
| `key` | 被驱动的 `state` 键，必须出现在本场景的 `params` 里 |
| `from` / `to` | 值域（已 `map` 后的最终值，与 `state[key]` 同一量纲） |
| `period` | **走完一整轮**的秒数：`loop` 是绕一圈，`pingpong` 是往返一次 |
| `kind` | `'circular'`（角度/相位，首尾天然相接）或 `'linear'`（坐标轴/标量区间） |
| `mode` | 可选，`'loop'` 或 `'pingpong'`。省略时由 `kind` 决定默认：circular → `loop`，linear → `pingpong` |

`kind` 决定默认而不是直接写死 `mode`，是因为两者表达的东西不同：`kind` 是量的**性质**（角度量扫到 180° 再跳回 −180° 会有视觉跳变，所以该 loop；坐标量单向回绕才会跳变，所以该往返），`mode` 是**当前选择**。用户可以在运行时改 `mode`，`kind` 不变。

### 求值

驱动是**引擎时钟的纯函数**，不做增量积分：

```js
function driveValue(d, t) {
  const mode = d.mode || (d.kind === 'circular' ? 'loop' : 'pingpong');
  const u = (t / d.period) % 1;                       // [0,1)
  const s = (mode === 'loop') ? u : (u < 0.5 ? 2 * u : 2 - 2 * u);
  return d.from + (d.to - d.from) * s;
}
```

纯函数有三个好处：不累积浮点漂移；暂停/恢复不产生跳变；**录制器的离线定长渲染直接可用**（它按固定 `dt` 推进 `state.t`，驱动值自然跟着走）。

在 `frame()` 里，`state.t` 推进之后、`draw()` 之前：

求值本身封装成**工具顶层函数** `applyDrive()`，只写 `state`、不碰 DOM：

```js
/* 把当前场景的驱动量按引擎时钟求值写回 state。只动数据，不动 UI ——
   录制器的离线渲染也要调它（见 §D），那条路径上没有面板可同步。 */
function applyDrive() {
  const sc = SCENES[curTab];
  if (!sc || !sc.drive || !autoPlay[curTab]) return;
  state[sc.drive.key] = driveValue(sc.drive, state.t);
}
```

`frame()` 里在 `state.t` 推进之后、`draw()` 之前调用，并额外同步滑块 UI：

```js
applyDrive();
const d = SCENES[curTab].drive;
if (d && autoPlay[curTab]) syncParamSlider(d.key);   // 滑块位置与读数跟随，用户看得见"谁在动"
```

`syncParamSlider` 复用 `buildParams()` 已经建好的 DOM 记账（`paramWraps` 同时存 `.ctl` 容器、`input` 元素与该参数的 `fmt`），把驱动出的值反算回滑块的原始刻度并回显：

```js
function syncParamSlider(key) {
  const e = paramWraps[key];
  if (!e) return;
  const raw = e.p.map ? e.p.invMap(state[key]) : state[key];   // 见下
  e.input.value = raw;
  e.val.textContent = e.p.fmt(raw);
}
```

`map` 的存在带来一个约束：滑块原始刻度到 `state` 值是单向映射（如 `v => v * Math.PI / 180`），要回显就需要反函数。**声明了 `drive` 且被驱动参数带 `map` 时，该参数必须同时提供 `invMap`**（如 `v => v * 180 / Math.PI`）。§8 清单要写明这条。没有 `map` 的参数不受影响。

**`state.theta` 保持不变**，仍由 `omega` 积分。已有工具依赖它，且它是历史曲线沿 z 轴流动的时基。`drive` 是叠加的新机制，不是替换。

## C. 交互模型

每个有 `drive` 的场景，在开关区多出一行：

```
[✓] 自动播放        (○ 往返  ● 循环)
```

- **自动播放**：默认开。关掉后 `state[key]` 停在当前值，滑块恢复完全手动。
- **模式切换**：`往返 / 循环` 二选一，初值取 `kind` 的默认，用户可随时改。**同一页签两种都支持**。
- **拖动被驱动的滑块 ⇒ 自动播放自动关闭**。用户"伸手接管"是明确意图，不该被下一帧覆盖掉。这也是 §4 第五原则"暂停只冻结仿真"的自然延伸。

状态由引擎按页签保存（`autoPlay[tabId]` / `driveMode[tabId]`），与 `cams[tabId]` 同构——每个页签记住自己的选择。

## D. 与录制器的交互

**这条是本次修复优先级被提高的原因**：目前 35% 的页签录出来是一张静止图，刚上线的录制功能在这些页签上等于废的。修复后它们自动获得可录制的动画。

录制的两种驱动必须**原样沿用用户在面板上设定的驱动状态**——自动播放开关与 `loop`/`pingpong` 模式选择，都以录制开始那一刻的当前页签设定为准，录制器不引入任何自己的默认值。

### D1. 离线定长渲染必须显式调用 `applyDrive()`

**这是最容易漏掉、且漏掉就前功尽弃的一处。** `REC.Source.offline` 不走工具的 `frame()`，它自己手动推进时钟再直接绘制：

```js
h.state.t += dt;
h.state.theta += h.state.omega * dt;
if (h.pushSample) h.pushSample();
h.draw();                       // ← 中间没有任何驱动求值
```

若驱动求值只写在 `frame()` 里，离线录制就会整段绕过它，被驱动的参数一帧不动——修完 `drive` 之后录出来**仍然是静止图**。

因此：

1. 工具顶层导出 `applyDrive()`（§B 已定义，只写 `state` 不碰 DOM）。
2. `REC.Bridge` 的 handle 增加 `applyDrive` 字段，取法与现有字段一致（`contentWindow.eval`），取不到时为 `null`。
3. `REC.Source.offline` 的每帧步进改为：

```js
h.state.t += dt;
h.state.theta += omega * dt;
if (h.applyDrive) h.applyDrive();      // ← 新增：沿用当前页签的驱动设定
if (h.pushSample) h.pushSample();
h.draw();
```

`applyDrive()` 内部自己检查 `autoPlay[curTab]`，所以**用户关掉自动播放时，录制自然录下定格的手动值**——这正是"沿用用户设定"的正确含义，不需要录制器再做判断。同理 `loop`/`pingpong` 的选择也从同一份 per-tab 状态读取，自动继承。

**实时录制不需要改**：它被动跟随工具自己的 rAF，`frame()` 正常执行，驱动照常生效。

**向后兼容**：未声明 `drive` 的工具没有 `applyDrive`，`h.applyDrive` 为 `null`，跳过即可。

### D2. 无缝循环的吸附基准

录制器的**无缝循环**目前把时长吸附到 `2π / |ω|` 的整数倍（`REC.Source.snapDuration`）。当前场景存在 `drive` 且自动播放开着时，真正的循环周期是 `drive.period`，不是 `2π/ω`。吸附基准必须改为：

- 场景有 `drive` 且自动播放开着 → 吸附到 `drive.period` 的整数倍
- 否则（无 `drive`，或用户关掉了自动播放）→ 维持现有的 `2π / |ω|`

`period` 定义为"完整一轮"（loop 绕一圈 / pingpong 往返一次），所以两种模式下吸附规则一致，不需要分支。

判定所需的信息（当前场景是否有 `drive`、其 `period`、自动播放是否开着）同样经 `REC.Bridge` 取得；为此 handle 再增加一个 `driveInfo()` 字段，由工具顶层导出：

```js
/* 供录制器判断无缝循环的吸附基准；无驱动或未启用时返回 null */
function driveInfo() {
  const sc = SCENES[curTab];
  if (!sc || !sc.drive || !autoPlay[curTab]) return null;
  return { key: sc.drive.key, period: sc.drive.period, mode: driveMode[curTab] };
}
```

## E. 开发规范

按仓库"文档先行"纪律，落地顺序固定：先改 `design-system/math-viz-design-system.md`，再改 `math-viz-starter.html`，最后才是各工具。

§8 新建工具自检清单新增四条硬约束：

1. **每个场景必须声明 `params`**，且必须与该场景实际读取的 `state` 键一致——包括经由模块级辅助函数间接读取的。
2. **每个场景必须声明 `drive`，或显式写 `drive: null` 并注释理由**。静态对照类场景是合法的（例如纯粹展示一个不随时间变化的结构），但必须是有意识的选择，不能是遗漏。
3. **被 `drive` 驱动的参数若带 `map`，必须同时提供 `invMap`**，否则滑块无法回显驱动值。
4. **引擎的行为查询不得只认样式类**，必须限定到结构容器（`.views .vbtn`）或改用 `data-*` 属性。

starter 的 SCENES 注释块同步更新，把 `params` / `drive` 写进"必填字段"一行。

### 第 4 条的由来

这条不是预防性的洁癖，是刚刚踩过的坑。`refreshViewButtons()` 原本这样遍历：

```js
document.querySelectorAll('.vbtn').forEach(b => {
  const row = b.closest('.views');
  b.classList.toggle('active', row.dataset.tab === curTab && …);   // row 为 null → 抛
});
```

`.vbtn` 只是个样式类。`huffman-coding-text-3d` 的"文本预设"按钮为复用外观也挂了它，却位于 `#txtPresets` 而非 `.views` 内，于是 `closest('.views')` 返回 `null` 当场抛错。那 4 个孤儿按钮在 DOM 里恰好排在最前，函数第一次迭代就中断——**该工具的视角按钮从未高亮过**，而且因为 `switchTab` 里它排在倒数第二行、被吞掉的 `updateReadout()` 又会被主循环在 120ms 内自愈，这个缺陷一直没被发现。

同样的未限定写法存在于**全部 51 个文件**（所有工具 + starter），只是其余 48 个没有孤儿 `.vbtn` 才没发病。修复已单独落地（见 `fix/view-button-selector-scope`），只改引擎真源与唯一发病的工具。

教训是可推广的：**样式类归样式，行为查询必须锚定结构或语义属性**。工具作者复用一个 class 只是想要那个外观，他没有义务知道引擎在拿它做行为判定。

## F. 审计工具

把本次调研用的运行时探针固化为 `scripts/audit-scenes.html`：开发者用本地服务器打开，它依次载入每个工具，输出一张表——每个页签展示了几个滑块、实际有效几个、有没有时间驱动。

- 用于**迁移期**：为 49 个工具生成 `params` 列表的初稿
- 用于**日常**：新工具提交前自查

**不接入 CI**。CI 跑不了浏览器，而仓库的零依赖红线不接受引入 Playwright。这是"人工门禁 + 工具辅助"，写进 §8 清单，不是自动拦截。

探针只能测"改了有没有反应"，测不出"作者本意"——某个滑块本该有效但当前实现漏读了，探针会报它无效。所以生成的 `params` 初稿**必须人工复核**，不能直接套用。

## G. 迁移计划

分三阶段，每阶段独立可合并：

**阶段 1 —— 引擎与规范**（不改任何工具）

设计文档 → starter 引擎实现 `params` / `drive` / `applyDrive` / `driveInfo` / 交互 → §8 清单 → 审计工具 → **录制器适配**（`app.html`：`REC.Bridge` handle 增加 `applyDrive` 与 `driveInfo`，`REC.Source.offline` 每帧调用 `applyDrive`，`snapDuration` 改吸附基准）。

注意阶段 1 横跨两个文件族：`design-system/` 与 `app.html`。录制器那半边的改动**必须与引擎同批落地**——否则 starter 里做好了 `drive`，用离线录制却依然录出静止图。验收：starter 自身演示 `params` 与两种 `drive` 模式并能正确录制；49 个工具行为零变化。

**阶段 2 —— `params` 批量迁移**
用审计工具生成初稿，人工复核后按批提交。每个工具是 patch 版本号 + changelog 一行。风险低，改动机械。

**阶段 3 —— `drive` 逐个补全**

**72 个静止页签**，每个都要人工判断"什么量应该随时间走、值域多少、circular 还是 linear"。这是真正的工作量，也是最需要数学判断的部分，不能批量生成。按工具分批，每批一个 PR。

优先级建议：先做那 4 个全静止的工具（`combinatorics-generating-functions-3d` / `least-squares-orthogonal-projection-3d` / `limit-essence-3d` / `sequences-series-essence-3d`），它们目前完全没有动画，收益最直接；再按静止页签数从多到少推进。

## H. 验收

无测试框架，沿用 §8 门禁：

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' FILE.html | node --check /dev/stdin
```

阶段 1 额外验收：

- starter 里切换页签，滑块按 `params` 正确显隐
- `drive` 在 `loop` / `pingpong` 两种模式下值域正确、首尾无跳变
- 拖动被驱动滑块后自动播放关闭，松手不被覆盖
- 每个页签独立记住自己的自动播放与模式选择
- 暂停时驱动停止，恢复后不跳变
- 未声明 `params` / `drive` 的场景行为与改动前完全一致（向后兼容）

录制器沿用驱动设定（§D），必须**逐条实录验证**，不接受"看代码应该没问题"：

- 带 `drive` 的场景用**离线定长**录一段 → 导出的视频里被驱动的参数确实在动。这是 §D1 的核心证据，漏掉 `applyDrive()` 时此项必然失败而其余项可能全过。
- 同一场景分别用 `loop` 与 `pingpong` 各录一段 → 两段视频内容不同（证明模式被继承，而非用了某个固定默认）
- **关掉自动播放**后录一段 → 视频是定格画面（证明"沿用用户设定"包含"用户选择不动"这一情形）
- 开着自动播放、勾选无缝循环 → 录制时长吸附到 `drive.period` 的整数倍；关掉自动播放后同样操作 → 吸附回 `2π / |ω|`
- **实时录制**同一场景 → 驱动照常生效（走 `frame()`，不需要额外改动，但要验证没有被 §D1 的改动破坏）
- 未声明 `drive` 的旧工具录制行为与改动前完全一致（`h.applyDrive` 为 null 的跳过路径）

阶段 2 / 3 每个工具：审计工具显示"展示滑块数 = 有效滑块数"，且无静止页签（除非显式 `drive: null`）。
