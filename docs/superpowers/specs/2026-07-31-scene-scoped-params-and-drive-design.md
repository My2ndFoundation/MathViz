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

样本 27 个工具 / 97 个页签：

| 指标 | 实测 |
|---|---|
| 滑块展示总次数 | 642 |
| **其中对当前页签完全无效** | **333（51%）** |
| 一个滑块都不起作用的页签 | 9（9%） |
| **无时间驱动（静止）的页签** | **34（35%）** |

最严重的样本：

```
complex-mult-3d   demoivre   16 个滑块 → 有效 0
i-essence-3d      matrix     12 个滑块 → 有效 0   静止
cartesian-polar   jac         7 个滑块 → 有效 0
gaussian-essence  clt         9 个滑块 → 有效 1   静止
weierstrass       chord       3 个滑块 → 有效 1   静止
```

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

```js
const sc = SCENES[curTab];
if (sc.drive && autoPlay[curTab]) {
  state[sc.drive.key] = driveValue(sc.drive, state.t);
  syncParamSlider(sc.drive.key);      // 滑块位置与读数跟随，用户看得见"谁在动"
}
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

一处必须同步改动：录制器的**无缝循环**目前把时长吸附到 `2π / |ω|` 的整数倍（`REC.Source.snapDuration`）。当前场景存在 `drive` 时，真正的循环周期是 `drive.period`，不是 `2π/ω`。吸附基准必须改为：

- 场景有 `drive` 且自动播放开着 → 吸附到 `drive.period` 的整数倍
- 否则 → 维持现有的 `2π / |ω|`

`period` 定义为"完整一轮"（loop 绕一圈 / pingpong 往返一次），所以两种模式下吸附规则一致，不需要分支。

## E. 开发规范

按仓库"文档先行"纪律，落地顺序固定：先改 `design-system/math-viz-design-system.md`，再改 `math-viz-starter.html`，最后才是各工具。

§8 新建工具自检清单新增两条硬约束：

1. **每个场景必须声明 `params`**，且必须与该场景实际读取的 `state` 键一致——包括经由模块级辅助函数间接读取的。
2. **每个场景必须声明 `drive`，或显式写 `drive: null` 并注释理由**。静态对照类场景是合法的（例如纯粹展示一个不随时间变化的结构），但必须是有意识的选择，不能是遗漏。
3. **被 `drive` 驱动的参数若带 `map`，必须同时提供 `invMap`**，否则滑块无法回显驱动值。

starter 的 SCENES 注释块同步更新，把 `params` / `drive` 写进"必填字段"一行。

## F. 审计工具

把本次调研用的运行时探针固化为 `scripts/audit-scenes.html`：开发者用本地服务器打开，它依次载入每个工具，输出一张表——每个页签展示了几个滑块、实际有效几个、有没有时间驱动。

- 用于**迁移期**：为 49 个工具生成 `params` 列表的初稿
- 用于**日常**：新工具提交前自查

**不接入 CI**。CI 跑不了浏览器，而仓库的零依赖红线不接受引入 Playwright。这是"人工门禁 + 工具辅助"，写进 §8 清单，不是自动拦截。

探针只能测"改了有没有反应"，测不出"作者本意"——某个滑块本该有效但当前实现漏读了，探针会报它无效。所以生成的 `params` 初稿**必须人工复核**，不能直接套用。

## G. 迁移计划

分三阶段，每阶段独立可合并：

**阶段 1 —— 引擎与规范**（不改任何工具）
设计文档 → starter 引擎实现 `params` / `drive` / 交互 → §8 清单 → 审计工具 → 录制器 `snapDuration` 适配。验收：starter 自身演示 `params` 与两种 `drive` 模式；49 个工具行为零变化。

**阶段 2 —— `params` 批量迁移**
用审计工具生成初稿，人工复核后按批提交。每个工具是 patch 版本号 + changelog 一行。风险低，改动机械。

**阶段 3 —— `drive` 逐个补全**
约 34 个静止页签，每个都要人工判断"什么量应该随时间走、值域多少、circular 还是 linear"。这是真正的工作量，也是最需要数学判断的部分，不能批量生成。按工具分批，每批一个 PR。

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
- 录制一段带 `drive` 的场景，无缝循环时长吸附到 `drive.period` 的整数倍
- 未声明 `params` / `drive` 的场景行为与改动前完全一致（向后兼容）

阶段 2 / 3 每个工具：审计工具显示"展示滑块数 = 有效滑块数"，且无静止页签（除非显式 `drive: null`）。
