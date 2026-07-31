# 画布动画录制为视频 · 设计文档

日期：2026-07-31
状态：已确认（用户批准）

## 目标

让用户把在工具里调好的**参数、视角、位置**下产生的动画，导出为一个 web 通用、可直接播放和分享的视频文件（优先 mp4）。

约束前提：

- 不修改 `outputs/` 下任何已发布工具（50 个），因此**不产生 version bump、不改 `tools.json`**。
- 不引入任何外部依赖（不使用 ffmpeg.wasm / mp4-muxer / gif.js）。
- 外壳 `app.html` 保持单文件、零依赖。

## 可行性结论（已实测）

### 编码能力

引擎是纯 Canvas 2D（`design-system/math-viz-starter.html:374`），`canvas.captureStream()` → `MediaRecorder` 这条标准路径直接可用。本机 Chromium 148 实测：

| MIME | `MediaRecorder.isTypeSupported` |
|---|---|
| `video/mp4;codecs=avc1` | ✅ |
| `video/mp4;codecs=av01` | ✅ |
| `video/webm;codecs=vp9` | ✅ |
| `VideoEncoder`（WebCodecs） | ✅ 可用（本方案未使用） |

跨浏览器：Chrome/Edge 已 ship MediaRecorder 的 MP4 容器支持；Safari 14.1+ 原生只出 mp4；**Firefox 是唯一缺口**（Bugzilla 1631143 未实现），落回 webm。

**结论：无需任何库即可直出 mp4。**

### 跨 iframe 桥（方案成立的地基，已实测）

工具用裸 `<script>` + 顶层 `const` 声明 `canvas` / `state` / `cam` / `SCENES`，这些**不会**成为 `window` 属性。实测确认：

```
window.state          → undefined                              ❌
window.eval('state')  → {running:true, t:0, omega:1, …}        ✅
window.eval('cam')    → {az:-0.9, el:0.33, dist:21, …}         ✅
window.eval('canvas') / 'draw' / 'SCENES' / 'resize'            ✅
```

`eval` 在全局作用域执行，能看穿 script-scope 的词法绑定。`app.html` 已经在跨 iframe 访问工具文档（`app.html:1100`），且 iframe 无 `sandbox` 属性，blob 下载正常。

**结论：外壳可完全操控工具内部状态，工具文件一行不改。**

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 功能落点 | 做进 `app.html` 外壳，50 个存量工具立刻全覆盖 |
| 画面内容 | 三种模式全做，可设置，默认「叠层」 |
| 画幅 | 16:9 / 9:16 / 1:1 可选，作用于模式 1 与 2 |
| 驱动方式 | 两种都做，默认「定长离线渲染」，另有「实时录制」 |
| 离线镜头 | 锁定当前镜位 + 可选自动运镜（自动环绕 / 视角过渡） |
| 输出格式 | mime 优先级探测，能出 mp4 就出 mp4，否则 webm |
| 代价（已接受） | 模式 1/2 仅在通过本地服务器打开时可用；`file://` 下降级为模式 3 |

## A. 架构与边界

全部内联进 `app.html`，划为 5 个互不穿透的单元：

| 单元 | 职责 | 依赖 |
|---|---|---|
| `ToolBridge` | **唯一的跨 iframe 耦合面**。经 `contentWindow.eval` 取回 `canvas / state / cam / SCENES / curTab / draw / resize / pushSample / applyView` 并缓存；iframe `load` 时失效重取 | iframe 同源 |
| `Compositor` | 决定「画进哪张画布」：目标画幅、叠层绘制 | ToolBridge |
| `FrameSource` | 产帧。两个实现同一接口 `{ start(), stop() }` | Compositor |
| `Encoder` | `MediaRecorder` 封装 + mime 探测 + 出 Blob 与扩展名 | — |
| `RecorderUI` | 面板、设置、进度、下载。**不碰 canvas** | 以上四者 |

判据：`RecorderUI` 换一套 UI 不应触及其余四个；`Encoder` 可独立于工具单测（喂任意 stream）。

## B. 固定画幅：临时重排 iframe，而非缩放贴图

工具 canvas 尺寸绑死在 `window.innerWidth × DPR`（`math-viz-starter.html:378`），录制需要固定且为偶数的输出尺寸。

**做法**：把 iframe 的 CSS 尺寸临时设为 `目标宽/DPR × 目标高/DPR` → iframe 内 `window.innerWidth` 变化 → 工具自身的 `resize()` 触发 → `W / H / FOCAL / CX / CY / bgGrad` 全部按新画幅重算，backing store 正好等于目标像素尺寸。录制期间 iframe 用 `transform: scale()` 缩回视口内做预览。

**为什么不用离屏缩放贴图**：`FOCAL = 1.2·min(H, W·1.1)` 依赖画布宽高。缩放贴图会把横构图硬塞进 9:16 竖框；重排 iframe 则让工具**真正按竖屏重新构图**。

画幅预设：16:9 = 1920×1080，9:16 = 1080×1920，1:1 = 1080×1080。

## C. 三种画面模式

工具的品牌区、参数面板、readout、图例小圆点都是浮在 canvas 之上的 **HTML**，`captureStream` 抓不到；canvas 内只有曲线、投影虚线、辉光点与 `label3` 公式标签。

- **模式 1 · 纯净** — 直接录工具 canvas 的 stream，零额外绘制。
- **模式 2 · 叠层（默认）** — 工具 canvas → 离屏 `recCanvas` → 叠画工具标题、实时 readout、曲线图例。遵循设计系统：色彩用同一批字面值、曲线色序固定 rose → violet → emerald → orange、数学符号用 `--font-math` 衬线斜体、负号 U+2212。竖屏时叠层改为上下分区布局。
- **模式 3 · 所见即所得** — `getDisplayMedia` 录整个标签页，面板与侧边栏全在。绕过 `Compositor` 与 `ToolBridge`，因此**不受同源限制**。

## D. 两种驱动

### 定长离线渲染（默认）

`canvas.captureStream(0)` + `track.requestFrame()`。置 `state.running = false` 接管驱动，每帧固定 `dt = 1/60`：推进 `state.t` 与 `state.theta` → `pushSample()` → `draw()` → `requestFrame()`。

好处：画面绝对平滑（不受 rAF 掉帧影响）、时长精确、可比实时更快出片。引擎的结构天然支持——`frame()` 里 `dt` 本就是变量，`pushSample()` 记录真值。

镜位：默认锁定开录时的 `cam`。两个可选开关：

- **自动环绕** — 整段视频 `cam.az` 匀速转满 2π，天然无缝循环。
- **视角过渡** — 复用引擎 `applyView()` 的 tween，从当前镜位滑向选定视角。

⚠️ 引擎的 tween 用真实时钟算进度（`math-viz-starter.html:809` 存 `t0: performance.now()`，`:675` 按 `(ts - tween.t0) / tween.dur` 求进度）。离线模式下**必须改喂虚拟时钟**，否则运镜会在第一帧就跑完。

### 实时录制

`canvas.captureStream(60)`，被动跟随工具自身的 rAF，点开始 / 点停止。捕捉手动拖拽旋转、切 tab、拖滑块的全过程。不保证无缝循环。

## E. 编码与时长

mime 优先级依次探测：

```
video/mp4;codecs=avc1  →  video/mp4  →  video/webm;codecs=vp9  →  video/webm
```

首个 `isTypeSupported` 为真者胜出，扩展名随之。Chrome / Edge / Safari 直出 mp4；Firefox 落 webm 并在 UI 明确说明原因。

时长 3–30s，默认 8s。**无缝循环**开关：把时长吸附到 `2π / state.omega` 的整数倍；若同时开了自动环绕，则环绕周期取为视频时长。

文件名：`<tool-id>-<画幅>-<时长>s.<ext>`。

## F. 错误处理与现场恢复

- **eval 桥不可用**（`file://` 打开、跨源）→ 模式 1/2 禁用并提示「请通过本地服务器打开」；模式 3 仍可用，构成天然降级路径。
- **无可用 mime** → 明确提示不支持，不静默失败。
- **`getDisplayMedia` 被拒** → 提示用户重试或改用模式 1/2。
- **现场恢复（必须）**：离线渲染会真实推进 `state` 与 `samples`。开录前快照 `state / cam / samples / iframe 尺寸`，在结束、用户取消、切换工具、页面卸载四种路径上**无条件还原**。

## G. 验收

仓库无测试框架，沿用设计系统 §8 门禁：

```
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
```

手动矩阵：3 种画面模式 × 3 种画幅 × 2 种驱动。浏览器验证：Chrome 出 mp4、Safari 出 mp4、Firefox 落 webm 且提示正确。

回归检查：`outputs/` 与 `tools.json` **零改动**；关闭录制面板后工具行为与改造前完全一致。
