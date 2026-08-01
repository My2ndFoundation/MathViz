# 演算记录与回放（record / replay）· 设计

**日期** 2026-08-02
**范围** 引擎能力（`design-system/math-viz-starter.html` + 设计系统文档），首批接入 `chaos-double-pendulum-3d`、`three-body-problem-3d`
**前置** [2026-08-02-chaos-and-three-body-design.md](2026-08-02-chaos-and-three-body-design.md) §2.5 记录了本期的决定与理由

---

## 0. 要解决的问题

混沌系统的后续演化高度依赖初始条件，因此**同一次运行是不可复得的**——除非把它记下来。用户要的是：运行时记录演算数据，随时下载存档；需要重现时上传存档，工具进入 replay 态直接播放。

做成**引擎能力**而不是两份手写实现。通用部分（序列化、下载 / 上传、回放时钟、面板控件、格式校验）与工具无关；工具只提供四个钩子。理由见前置文档 §2.5：同一子系统被手写多遍，正是这个引擎长成 51 份互有差异副本的成因。

---

## 1. 一个必须讲清楚的事实：从种子重跑 ≠ 复现

系统是确定性的，所以**初值 + 积分参数**在数学上唯一决定整条演化。这诱使人只存种子——几百字节，优雅。

**但这在跨机器时不成立。** ECMAScript 不保证 `Math.sin` / `Math.cos` / `Math.pow` 等超越函数的结果跨实现逐位相同（规范只要求实现质量，未规定精确舍入）。而对李雅普诺夫指数 λ ≈ 1.1 s⁻¹ 的双摆，1 ULP ≈ 2⁻⁵² 的差别在

    t = ln(1 / 2⁻⁵²) / λ ≈ 52 · ln2 / 1.1 ≈ 33 秒

之后就长到 O(1)。也就是说：**换一台机器 / 换一个浏览器版本，从同一个种子重跑，半分钟后画面就完全不同了。**

所以：

- **默认存轨迹**（用户要的那个），它在任何机器上都能忠实播放，因为播放不做算术。
- **种子一并存**，但它的用途不是"重现"，而是下面这条。

### 1.1 把这条事实做成功能（本期的点睛之处）

存档同时携带**种子**与**轨迹**。加载时引擎做两件事：

1. 按轨迹进入 replay（一定成功）；
2. **同时**用种子在本机重新积分，与记录的轨迹逐点比对，画出分离曲线 δ(t)。

于是有两种结局，都有价值：

- 曲线贴地（δ ~ 1e−16 量级的舍入噪声）→ 本机复现了原始运行。
- 曲线按指数抬起来 → **工具在自己身上演示了自己的论点**：同一个种子、同一段代码，换台机器就是另一条轨迹。

这不是噱头，这正是这两个工具的课程内容。UI 必须把这一层说明白，不能让用户以为是 bug。

---

## 2. 存档格式

单个 JSON 文件，`.json`，UTF-8。

```jsonc
{
  "format": "mathviz-run",
  "formatVersion": 1,
  "tool": { "id": "chaos-double-pendulum-3d", "version": "1.1.0", "engine": "1.1.0" },
  "tab": "twin",                       // 录制时所在页签
  "recordedAt": "2026-08-02T10:30:00Z",
  "ua": "…",                           // 仅供诊断，不参与校验
  "seed": { … },                       // 工具的 seed() 产物：初值 + 积分参数
  "trace": {
    "dt": 0.02,                        // 记录间隔（秒，模拟时间）
    "fields": ["t", "…"],              // 由工具的 captureState() 决定
    "rows": [[…], […], …]              // 行数组，不是对象数组（体积差 3–5 倍）
  }
}
```

**约定**

- `rows` 用**数组的数组**而非对象数组：字段名只出现一次。实测同样内容体积约为对象形式的 1/4。
- 数值统一 `toPrecision(12)` 后再序列化。12 位有效数字远超绘图需要，又能把体积压掉约 40%；**但这意味着存档不是逐位精确的状态快照**——§1.1 的比对曲线要把这一项舍入计入基线，不能把它误报成"复现失败"。
- **不做压缩**、不引外部依赖（`CompressionStream` 可用性与格式跨浏览器不一致，且违反"单文件零依赖"的精神）。一次 60 秒、`dt = 0.02`、8 个字段的记录约 3000 行 × 8 × 13 字节 ≈ **310 KB**，可接受。
- 记录长度设上限（默认 20000 行 ≈ 400 秒），到顶后**停止记录并在面板提示**，绝不静默丢弃或环形覆盖——静默截断会让用户以为录到了全程。

### 2.1 加载校验

按顺序检查，任何一条不过就**明确拒绝并说明原因**，不做兼容性猜测：

1. `format === "mathviz-run"`；
2. `formatVersion` 引擎认识；
3. `tool.id` 与当前工具一致（否则提示"这份存档属于〈某工具〉"）；
4. `tab` 是当前工具存在的页签；
5. `trace.fields` 与当前 `captureState()` 的字段集一致。

第 3、5 条是硬门槛：跨工具或跨版本的字段错位会画出**看似合理实则错误**的图，比报错危险得多。

---

## 3. 引擎 API

### 3.1 工具侧钩子（新增第 ④ 个编辑点）

工具在 `SCENES` 之后声明一个可选的 `RECORD` 对象。**不声明就完全没有录制 UI**，51 个既有工具因此零影响。

```js
const RECORD = {
  /* 每个可录制页签一份钩子；未列出的页签不提供录制 */
  twin: {
    /* 本页签的完整状态向量 —— 必须足以让 restore 后的画面与当时一致 */
    capture: () => ({ t: SIM.twin.t, a: SIM.twin.a.slice(), b: SIM.twin.b.slice() }),
    restore: s => { SIM.twin.t = s.t; SIM.twin.a = s.a.slice(); SIM.twin.b = s.b.slice(); },
    /* 种子：初值 + 积分参数。用于 §1.1 的本机重算比对 */
    seed:   () => ({ th1: state.th1, th2: state.th2, d0: state.logD0, h: H }),
    reseed: s => { state.th1 = s.th1; state.th2 = s.th2; state.logD0 = s.d0; seedTwin(); },
    /* 回放期间必须锁死的滑杆（改了它们等于改种子，画面与数据会脱节） */
    lock:   ['th1', 'th2', 'logD0']
  },
  …
};
```

`capture` 返回的对象会被**扁平化成一行数字**（嵌套数组按固定顺序展开），字段名在 `trace.fields` 里记一次。展开顺序由第一次 `capture()` 的结构决定并冻结；后续结构变化视为错误。

### 3.2 引擎侧新增

| 名称 | 职责 |
|---|---|
| `recState` | `{ mode: 'live' \| 'recording' \| 'replay', rows, i, rate, playing, src }` |
| `recTick(dtSim)` | 在 `frame()` 的模拟分支里调用；`recording` 时按 `trace.dt` 节流采样，`replay` 时推进 `i` 并 `restore` |
| `recSave()` | 组装 JSON → `Blob` → `URL.createObjectURL` → `<a download>` |
| `recLoad(file)` | `FileReader` → 校验（§2.1）→ 进 replay 态 |
| `recVerify()` | 用 `seed` 在本机重积分，与 `rows` 逐点比对，产出 δ(t) 序列供工具绘制 |
| `recInfo()` | 只读访问器，供 `draw()` / `readout()` 查询当前模式与进度——**同 `driveInfo()` 的约定，工具不得自己拼判据** |

`recInfo()` 这条是照搬 §6「双语义迭代」那一行的教训：同一判据出现两种写法，正是这个引擎被复制成 51 份后最容易漂移的地方。

### 3.3 `frame()` 的改动

模拟分支从

```js
if (state.running) { …推进…; pushSample(); }
```

变为

```js
if (recState.mode === 'replay') {
  if (recState.playing) recStep();     // 推进 i、restore、pushSample
} else if (state.running) {
  …推进…;
  pushSample();
  if (recState.mode === 'recording') recTick(dt);
}
```

**replay 态下相机、视角、页签内的显示开关全部照常可用**——这与「暂停只冻结模拟」（§6）是同一条精神：回放冻结的是演算，不是观察。

### 3.4 面板 UI

在「播放/重置」行之下、开关组之上，插入一行录制控件（仅当本页签在 `RECORD` 中声明时出现）：

```
[● 记录] [⬇ 保存] [⬆ 载入]            0:42 / 3120 行
```

进入 replay 后该行变为：

```
[▶/⏸] [⏮] [1× ▾] [✕ 退出回放]        ━━━━●━━━━━  t = 12.4 s
存档：run-2026-08-02.json · 种子比对：δ = 3.2e−13（本机复现）
```

replay 是**一等状态**：`lock` 里的滑杆置灰，面板显示存档来源与比对结论，退出即回到实时积分。

---

## 4. 落地顺序

仓库纪律是**文档先行**（`CLAUDE.md`、设计系统页脚）。

1. **文档**：`design-system/math-viz-design-system.md` 新增 §11「演算记录与回放」，并在 §8 自查清单补一条（声明了 `RECORD` 的工具必须提供 `lock`，且 `capture` 字段集与 `restore` 对称）。单独一个提交。
2. **引擎**：`math-viz-starter.html` 实现 §3，`STARTER_VERSION` → 1.1.0。**不动 51 个既有工具**——未声明 `RECORD` 即无 UI、无行为变化。
3. **接入**：两个混沌工具各自提供 `RECORD`，版本 → 1.1.0，三处落地。
4. **注册**：`tools.json` 版本与 changelog，`sync_registry.py`。

## 5. 与 `feat/engine-uniformity-phase5` 的冲突（**必须先解决**）

该分支未合并、无 PR，包含 5 个提交，同时改动：

- `design-system/math-viz-design-system.md`（§6 / §8 的帧级兜底条目）
- `design-system/math-viz-starter.html`（把 `frameErrSeen` 声明块移到 `resetSim()` 之前）
- 51 个 `outputs/*.html` 与 `scripts/port_drive_engine.py`

两处冲突是确定的：本期要改的正是设计系统文档的 §6/§8 与 starter 的 `resetSim`/`frame` 一段。

**另外该分支已经过时**：它切出时两个混沌工具尚未落地，因此它的一致性扫描**漏掉了这两个新工具**（`git diff --stat` 确认只覆盖到 `dimension-fractal-3d` 与 `newton-to-minkowski-3d`）。

**建议**：先把 phase 5 rebase 到 main、把扫描范围补上两个混沌工具、开 PR 合入，再在干净且一致的基线上做本期。反过来做会让 phase 5 的 51 文件扫描撞上一个刚改过的 starter，代价高得多。

## 6. 验收

- 设计系统 §11 与 §8 新条目落地，且**文档提交早于代码提交**
- starter 的 `node --check` 通过；51 个未声明 `RECORD` 的工具**逐字节不变**
- 两个混沌工具：记录 → 保存 → 刷新页面 → 载入 → 回放，画面与录制时一致
- 载入以下存档必须**明确拒绝并给出原因**：工具 id 不符、`formatVersion` 未知、`fields` 不匹配、非 JSON
- 记录到达行数上限时面板有提示，且不静默丢数据
- replay 态下：`lock` 滑杆置灰、相机可动、退出后回到实时积分且不残留状态
- §1.1 的种子比对曲线在**本机**应贴在舍入噪声量级（含 §2 的 `toPrecision(12)` 基线）；跨浏览器差异出现时，UI 的说明文案要能自洽
- 全部新增文案双语经 `t()`；`node --check` 全量通过；`sync_registry.py --check` 通过
