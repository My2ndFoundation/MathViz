# 引擎健壮性与一致性 · 阶段 4 设计

**日期**：2026-08-01
**状态**：已确认，待写实施计划
**前序**：阶段 1（PR #39 驱动引擎与录制器）、阶段 2（PR #40 场景作用域 params）、阶段 3（PR #41 静止页签接入时间驱动）

## 1. 问题

阶段 3 的全分支终审把四项缺陷分诊到本阶段，其中一项是引擎级的：

**`frame()` 没有 `try/catch`，51 个工具全部如此。** `frame()` 一个函数里串了五段——tween 相机插值、`state` 推进与 `applyDrive()`/`syncParamSlider()`、`pushSample()`、样本窗口裁剪、`draw()` 与节流的 `updateReadout()`——末尾才是 `requestAnimationFrame(frame)`。任何一段抛出，那句 rAF 就到不了，**渲染循环永久断掉**：相机、页签切换、语言切换随之全部失效，整个工具变砖，只能刷新页面。

这不是理论风险。阶段 3 实测过一次：`phi-essence-3d` 的 `frac` 页驱动了一个数组下标，`PHI_CONV[5.3]` 为 `undefined`，读它的属性抛 `TypeError`，Node 复现 600 帧里 594 帧命中——工具从第一秒起就是死的。时间驱动放大了这个暴露面：驱动量每帧都在变，任何对取值范围的疏忽都会以每秒 60 次的频率触发。

另外三项较轻：文案欠账、两处 off-grid 默认值、一句规范里缺失的因果说明。

## 2. 决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 崩溃语义 | **保住渲染循环** | 「整个工具变砖」比「画面停在错误状态」更不可接受 |
| `try/catch` 位置 | **整帧一层，`rAF` 放 `finally`** | 循环不断是机械保证，不依赖 catch 里写对什么；51 份改动一致，最易脚本化验证 |
| 失败可见性 | **只进控制台，面板不露出** | 上一条的直接后果；代价见 §4 |
| 共享键漂移 | **不加运行时机制** | 「消费即声明」规则已在 §8、检查已在审计工具、当前零违反 |
| 版本 | **patch 递增** | 健壮性修复 + 文案订正，无新能力，正常路径行为一字不变 |
| 范围 | **51 个工具**（含 `trig-essence-3d-new`） | 它虽是 `pre-declarative`、无 `SCENES`，但有同构的 `frame()` 与同样的变砖风险 |

### 2.1 为什么共享键不需要新机制

自动播放会把跨页签共享的参数留在任意值上——30 个工具里存在「被驱动、且同时出现在别的场景 `params` 里」的键。但这不是缺陷，而是仓库明文主题「同一场运动，不同的测量」的必然后果（§6「单一运动源」）。

真正危险的只有一种情形：**某个场景消费了这个键却没有把它声明进 `params`**——那样它就没有滑杆，漂移不可纠正。阶段 3 出过一次（`optimization` 的 `eta`），而它违反的是一条**已经存在**的规则：§8 自查清单「每个场景声明 `params`，且与该场景实际读取的 state 键一致（含经模块级辅助函数间接读取的）」。`audit-scenes.html` 已用探针算 `live` vs `declared` 并把「漏声明」标红，终审实测 203 → 203、零违反。

规则在、检查在、当前零违反。缺的只有一句因果：规范没写出「这条规则正是驱动漂移不会变成不可纠正的原因」。补这句话即可，不动引擎。

## 3. 组件

### 3.1 引擎改动（真源：`design-system/math-viz-starter.html`）

`frame()` 整体包一层：

```js
function frame(ts) {
  try {
    /* …原有全部内容，一行不动… */
  } catch (err) {
    frameError(err);
  } finally {
    requestAnimationFrame(frame);
  }
}
```

模块级去重器（不去重则每秒 60 条刷屏）：

```js
const frameErrSeen = Object.create(null);
function frameError(err) {
  const k = curTab + '|' + ((err && err.message) || err);
  if (frameErrSeen[k]) return;
  frameErrSeen[k] = 1;
  console.warn('[frame] 场景「' + curTab + '」抛出异常，已跳过该帧并继续渲染循环：', err);
}
```

去重键带 `curTab`：同一错误在不同页签各报一次，同一页签的不同错误也各报一次。`resetSim()` 里清空 `frameErrSeen`——用户主动重置后应允许重新报。

启动处那句 `requestAnimationFrame(frame)`（`frame()` 之外）不动，它不在循环里。

因为 `draw()` 排在 `updateReadout()` 之前，读数抛出时画面已经画完；`draw()` 抛出时画布停在上一帧好内容。相机、页签、语言切换都是 DOM 驱动，与 canvas 渲染无关，照常可用。

`trig-essence-3d-new` 的 `frame()` 结构相同（少了 `applyDrive()`/`syncParamSlider()`），且它有 `curTab` 与 `resetSim()`，同一补丁直接适用。

### 3.2 落地方式

先改真源 starter，再**扩展现有的 `scripts/port_drive_engine.py`** 铺到全部 51 个 `outputs/*.html`——不新写第二个脚本。该脚本已有严格字面 `replace_block`（命中数必须恰为 1）与 `--check` 幂等模式，且 `frame()` 本就是它的锚点之一。50 个声明式工具的 `frame()` 尾行 `  requestAnimationFrame(frame);` 完全一致，锚点干净。

命中失败即报错、跳过该文件并列出，绝不模糊匹配硬塞。脚本第二次运行必须零改动。

该脚本已知局限「更新能力不覆盖 `relabel` 块」不影响本次——`frame()` 不是 `relabel` 块。

### 3.3 文档

- **§6**（数据与状态约定）与 **§8**（自查清单）补一句因果：「消费即声明」是驱动漂移不会变成不可纠正的原因。
- §8 补一条：`frame()` 必须有 `try/catch` 且 `rAF` 在 `finally`。

仓库纪律是文档先行——文档提交必须早于代码提交。

### 3.4 文案轮

- `limit-essence-3d/series` 与 `proof-logic-induction-3d/induction` 的 `tips` 补上「它会自己重播」（双语）。这两页在阶段 3 被改成局部循环，但 tips 没跟上，读者不知道不必按 R。
- 同两页的留痕注释里引的是**修复前**的定格数字，换成修复后读数。

### 3.5 两处 off-grid 默认值

`complex-mult-3d` 的 `phi2`（`value: 0.33` / `step: 0.02` → range 输入吸附到 0.34）、`lines-planes-3d` 的 `aEl`（`0.35` → `0.36`）。把 `value` 对齐 step 网格，使面板初值与代码声明一致。两者都不是驱动量，影响仅限初值显示。

## 4. 已知代价（有意接受）

**若某个场景每帧都抛，画布会停在最后一帧好内容，而屏幕上没有任何提示。** 用户看到一张静止图，只有控制台有一条警告。这是「保住渲染循环」优先于「绝不静默给错内容」的直接后果。

缓解：相机、页签切换、语言切换仍然可用，用户能切到别的页签继续使用工具——这正是变砖时做不到的事。若日后要屏幕提示，是一处独立的增量（面板加一条双语错误行），不影响本设计。

## 5. 验证

**控制组优先——先证明尺子抓得住，再证明修好了。** 这是阶段 3 确立的标准做法：没有控制组的「零命中」等于没测。

1. 在**未修复**的副本上，把某页 `draw()` 临时改成必抛，用真实无头 Chromium（`playwright-core` + 本机缓存的 `chromium_headless_shell`，`document.hidden === false`、rAF 自由运行）确认帧计数**停住**。
2. 同样注入到**修复后**的版本，确认帧计数**继续增长**、控制台**恰好一条**警告、切到别的页签一切正常、切回来仍活。
3. 抽样 ≥8 个工具，必须含 `cartesian-polar-coordinate-3d`（全仓唯一用 `paramRefs` 而非 `paramWraps` 的结构异类）与 `trig-essence-3d-new`（唯一 `pre-declarative`）。
4. 语法门禁 51 个工具 + `app.html` + `index.html` 全过。
5. `python3 scripts/port_drive_engine.py --check` 幂等零改动。
6. `python3 scripts/sync_registry.py --check` 通过。
7. 全量审计 `scripts/audit-scenes.html`：188 页签的三桶计数相对阶段 3 基线（静止未声明 0 / 驱动异常 0 / 需人工 16）**不得回归**。

沿用阶段 3 的验收硬要求：断言必须实际调用 `draw()` 与 `readout()`；`seamless` 断言是恒真式不得作为证据；`readout()` 文本不能当「在动」判据（表头每帧变）；测静止先喂满 20 秒。

## 6. 版本与注册表

51 个工具 patch 递增 `1.1.0` → `1.1.1`（已核实：含 `trig-essence-3d-new`，其 meta 与 `tools.json` 当前均为 `1.1.0`，changelog 标题写法为「版本记录（新→旧）：」）。三处落地：HTML meta、HTML 头注释 changelog、`tools.json`。changelog 标题两种写法保持各文件原样。

注意本次与阶段 3 的一处差别：**阶段 3 只改了 36 个工具，本次 51 个全改**（`frame()` 每个文件都有）。因此 `tools.json` 会有 51 条更新，而非阶段 3 的 38 条。

`tools.json` 统一在最后一步由脚本从 HTML meta 读回，不手抄；随后 `python3 scripts/sync_registry.py` 同步 `app.html` 与 `index.html`。

## 7. 非目标

- **不加屏幕错误提示**（见 §4）。
- **不给共享键加运行时恢复机制**（见 §2.1）。
- **不做分段 `try/catch`**：多换来的只有「`pushSample()` 抛出时 `draw()` 仍执行」这一种情形，代价是三倍注入点与更多分歧面。
- **不碰 `lines-planes-3d` 的 `bEl`**（第二条直线的仰角从未接线，阶段 2 中被删除）——那是一个独立待办，需要先决定补实现还是明确放弃。
