# 场景作用域参数与时间驱动 · 阶段 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给引擎加上「场景声明自己用哪些滑块」与「场景声明自己的时间驱动量」两套机制，并让录制器的离线渲染沿用用户的驱动设定；`outputs/` 下 51 个工具本阶段一律不改。

**Architecture:** 场景新增两个可选字段 `params` 与 `drive`。`params` 复用 `switchTab` 已有的按页签显隐机制（原本只管 `toggles`/`views`）。`drive` 是引擎时钟的纯函数，求值封装成 `applyDrive()`——`frame()` 与录制器的离线渲染各自调用，因此录制自动继承用户的自动播放开关与 loop/pingpong 选择。两个字段都可省略，省略即现状，故 51 个存量工具行为零变化。

**Tech Stack:** 原生 Canvas 2D + ES6（starter 与 tools 用 `const`/箭头函数）；`app.html` 是 ES5 风格（`var` + `function`）。零外部依赖。

设计依据：[docs/superpowers/specs/2026-07-31-scene-scoped-params-and-drive-design.md](../specs/2026-07-31-scene-scoped-params-and-drive-design.md)

## Global Constraints

- **本阶段不修改 `outputs/` 下任何文件、不改 `tools.json`、不做 version bump。** 收尾时 `git diff --name-only main` 只允许出现：`design-system/math-viz-design-system.md`、`design-system/math-viz-starter.html`、`app.html`、`scripts/audit-scenes.html`、`docs/superpowers/**`。
- **零外部依赖**：不引入 npm 包、CDN、Playwright 或任何外部资源。
- **代码风格按文件区分**：`design-system/math-viz-starter.html` 用 `const`/`let`/箭头函数（与该文件现有代码一致）；**`app.html` 用 `var` + `function`，禁止 `const`/`let`/箭头函数/模板字符串/`class`**（与该文件现有代码一致）。注释一律中文。
- **禁止触碰 `app.html` 里的 `/* >>> GENERATED:TOOLS */ … /* <<< GENERATED:TOOLS */` 标记块**——`.githooks/pre-commit` 会运行 `scripts/sync_registry.py` 自动重写它。
- **所有面向用户的文案必须双语**，形如 `{ zh: '…', en: '…' }`，经各文件已有的 `t()` / `REC.t()` 渲染。
- **行为查询不得只认样式类**（本次规范新增第 4 条）：`querySelectorAll` 必须限定结构容器或用 `data-*`。
- **语法门禁**（每个任务提交前必跑，必须通过）：
  ```bash
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' FILE.html | node --check /dev/stdin
  ```

## 核心契约（Task 2/3/4 共同依赖，任何一方都不得改动签名）

```js
/* 场景新增的两个可选字段 */
SCENES[id].params = ['omega', 'amp'];        // 本页签真正读取的滑块 key；省略 = 显示全部
SCENES[id].drive  = {
  key: 'phi',            // 被驱动的 state 键，必须出现在本场景 params 里
  from: 0, to: 2*Math.PI,// 值域，与 state[key] 同量纲（即 map 之后）
  period: 8,             // 完整一轮的秒数：loop 绕一圈 / pingpong 往返一次
  kind: 'circular',      // 'circular'（角度/相位）或 'linear'（坐标轴/标量）
  mode: 'loop'           // 可选；省略时 circular→'loop'，linear→'pingpong'
};

/* 工具顶层导出，供录制器跨 iframe 调用 */
applyDrive()   -> undefined   // 按引擎时钟把驱动量写回 state；只动数据不碰 DOM
                              // 内部自检 autoPlay[curTab]，关闭时是 no-op
driveInfo()    -> { key: String, period: Number, mode: String } | null
                              // 无 drive 或自动播放关闭时返回 null

/* 引擎内部（Task 2 独有，其余任务不直接调用） */
driveValue(d, t, mode) -> Number
syncParamSlider(key)   -> undefined
syncParamVisibility()  -> undefined
setAutoPlay(on)        -> undefined
```

## File Structure

四个任务各占一个文件，**互不重叠，可完全并行**：

| 文件 | 职责 | 任务 |
|---|---|---|
| `design-system/math-viz-design-system.md` | 规范真源：§6 状态约定、§8 清单四条 | Task 1 |
| `design-system/math-viz-starter.html` | 引擎实现 + starter 自身示范两种模式 | Task 2 |
| `app.html` | 录制器适配：Bridge handle、离线渲染、吸附基准 | Task 3 |
| `scripts/audit-scenes.html` | 审计工具（新建） | Task 4 |

Task 5 是串行联调，依赖前四个全部合并。

---

## Task 1: 设计规范文档

**Files:**
- Modify: `design-system/math-viz-design-system.md`（§6 表格在 `:295` 起，§8 清单在 `:320` 起）

**Interfaces:**
- Consumes: 无
- Produces: 无代码接口；本任务产出的是其余任务必须遵守的书面约定

本仓库的纪律是**文档先行**（规范的页脚明确要求改令牌先改文档）。本任务只改文档，不写代码。

- [ ] **Step 1: §6「数据与状态约定」表格补两行**

在 `design-system/math-viz-design-system.md` 的 §6 表格里，`单一运动源` 那一行**之后**插入：

```markdown
| 场景作用域参数 | 场景用 `params: ['key', …]` 声明本页签真正读取的滑块；`switchTab` 按此显隐。省略 = 显示全部（向后兼容）。实测 51% 的滑块展示对当前页签无效，这是修正手段 |
| 时间驱动 | 场景用 `drive: { key, from, to, period, kind, mode? }` 声明随时间走的量。求值是引擎时钟的纯函数（不做增量积分），封装为顶层 `applyDrive()`，`frame()` 与录制器离线渲染各自调用。`kind: 'circular'` 默认 `loop`，`'linear'` 默认 `pingpong`，用户可运行时切换 |
```

同时把 `单一运动源` 那一行的表述改为（原文强调"全部页签共享同一份 state"，加上 `params` 后需要澄清"共享的是值，可见性按页签"）：

```markdown
| 单一运动源 | 全部页签共享同一份 `state`（参数）与 `samples`（历史）——强调"同一个运动、不同的测量"。共享的是**值**：滑块的可见性由 `params` 按页签决定，但值本身跨页签连续，切回来不会丢。相机与显示开关按页签区分 |
```

- [ ] **Step 2: §8 自查清单补四条**

§8 第 6 点的自查清单是一长串 `□` 项。在 `□ node --check 通过` **之前**插入四项：

```
□ 每个场景声明 params，且与该场景实际读取的 state 键一致（含经模块级辅助函数间接读取的）
□ 每个场景声明 drive，或显式 drive: null 并注释理由（静态对照场景合法，但须是有意识的选择）
□ 被 drive 驱动的参数若带 map，必须同时提供 invMap（否则滑块无法回显驱动值）
□ 引擎的行为查询不只认样式类：querySelectorAll 限定结构容器（如 .views .vbtn）或改用 data-* 属性
```

- [ ] **Step 3: §8 第 3 步的场景字段清单加上新字段**

§8 落地流程第 3 点原文是：

```
3. 在 `SCENES` 注册场景：`label`（页签名）、`brand`、`tips`、`views`（首项 iso）、`toggles`（曲线开关按启用顺序取色）、`draw(C)`、`readout()`；
```

改为：

```
3. 在 `SCENES` 注册场景：`label`（页签名）、`brand`、`tips`、`views`（首项 iso）、`toggles`（曲线开关按启用顺序取色）、`params`（本页签真正读取的滑块 key 数组）、`drive`（时间驱动声明，无则显式 `null`）、`draw(C)`、`readout()`；
```

- [ ] **Step 4: 任务简报模板补一行**

§8 末尾「给 Claude Code 的任务简报模板」代码块里，`场景（SCENES 页签）：` 那一行**之后**插入：

```
每页签的驱动：〔哪个参数随时间走、值域、circular（角度类，默认 loop）还是 linear（坐标轴类，默认 pingpong）；确实该静止的写「无」并说明理由〕
```

- [ ] **Step 5: 检查改动范围并提交**

```bash
git diff --name-only
```
预期：只有 `design-system/math-viz-design-system.md`。

```bash
git add design-system/math-viz-design-system.md && git commit -m "docs(design-system): §6 补场景作用域参数与时间驱动，§8 清单增四条"
```

---

## Task 2: starter 引擎实现

**Files:**
- Modify: `design-system/math-viz-starter.html`
  - CSS 插在 `.toggles` 规则之后（`:122` 附近）
  - `#driveHost` 插在 `#togglesHost` 之前（`:169`）
  - `UI` 字典在 `:208`–`:215`
  - `PARAMS` 在 `:222`–`:227`；`SCENES.lissa` 在 `:239`，`SCENES.blank` 在 `:300`
  - `frame()` 在 `:670`；`buildParams()` 在 `:704`；`switchTab()` 在 `:818`；启动序列在 `:969`–`:982`

**Interfaces:**
- Consumes: 无（本任务是契约的定义方）
- Produces: 上文「核心契约」全部——`SCENES[].params`、`SCENES[].drive`、`applyDrive()`、`driveInfo()`。Task 3 跨 iframe 调用 `applyDrive` 与 `driveInfo`，Task 4 读取 `SCENES[].params` / `SCENES[].drive`。**签名不得改动。**

本文件用 `const`/`let`/箭头函数（与现有代码一致）。

- [ ] **Step 1: 先验证当前行为（RED 基线）**

起本地服务器（`python3 -m http.server 8777`，Bash `run_in_background: true`），浏览器开
`http://localhost:8777/design-system/math-viz-starter.html`，控制台执行：

```js
({ hasApplyDrive: typeof applyDrive,
   hasDriveInfo: typeof driveInfo,
   ctlCount: document.querySelectorAll('#paramsHost .ctl').length,
   visibleCtl: [...document.querySelectorAll('#paramsHost .ctl')].filter(e => e.style.display !== 'none').length,
   curTab })
```

预期（这是改造前的现状，记录为 RED 证据）：
`{ hasApplyDrive: "undefined", hasDriveInfo: "undefined", ctlCount: 4, visibleCtl: 4, curTab: "lissa" }`

四个滑块在两个页签上都全部显示——正是要修的问题。

- [ ] **Step 2: 加 CSS**

在 `.toggles` 规则之后（`.tg .dot` 那行之后）插入：

```css
/* 驱动控制行 */
.drive{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0 2px}
.drive .dmode{display:flex;gap:4px;margin-left:auto}
.drive .dmode .btn{padding:4px 8px;font-size:11px}
```

- [ ] **Step 3: 加 DOM 容器**

在 `<div id="togglesHost"></div>`（`:169`）**之前**插入：

```html
    <div id="driveHost"></div>
```

- [ ] **Step 4: `UI` 字典加三条双语文案**

在 `UI` 对象里 `views:` 那一行之后插入：

```js
  autoPlay: { zh: '自动播放', en: 'Auto-play' },
  pingpong: { zh: '往返',     en: 'Ping-pong' },
  loop:     { zh: '循环',     en: 'Loop' },
```

- [ ] **Step 5: `phi` 参数补 `invMap`**

`PARAMS` 里 `phi` 带 `map: v => v * Math.PI`，将被 `lissa` 场景驱动，按规范必须提供反函数。把该行改为：

```js
  { key: 'phi',       label: { zh: '初相位 <i>φ</i>', en: 'Initial phase <i>φ</i>' }, min: 0,   max: 2,   step: 0.05, value: 0,   fmt: v => fmt(v) + ' π', map: v => v * Math.PI, invMap: v => v / Math.PI },
```

- [ ] **Step 6: 两个场景各加 `params` 与 `drive`（starter 自身即示范）**

`SCENES.lissa`（`:239`）的 `label:` 行之后插入——它读 omega/amp/phi/waveSpeed，驱动 `phi`（相位是角度量 → circular → 默认 loop）：

```js
    params: ['omega', 'amp', 'phi', 'waveSpeed'],
    /* 相位是角度量：绕满一圈首尾天然相接，故 kind: 'circular' → 默认 loop */
    drive: { key: 'phi', from: 0, to: TAU, period: 8, kind: 'circular' },
```

`SCENES.blank`（`:300`）的 `label:` 行之后插入——它只读 omega/waveSpeed，驱动 `omega`（标量区间 → linear → 默认 pingpong）：

```js
    params: ['omega', 'waveSpeed'],
    /* 角速度是标量区间：单向回绕会跳变，故 kind: 'linear' → 默认 pingpong */
    drive: { key: 'omega', from: 0.2, to: 4, period: 6, kind: 'linear' },
```

- [ ] **Step 7: 实现引擎函数**

在 `function buildParams()`（`:704`）**之前**插入：

```js
/* ================= 场景作用域参数与时间驱动 ================= */
const paramWraps = {};   // key -> { wrap, input, val, p }
const autoPlay = {};     // tabId -> 是否自动播放
const driveMode = {};    // tabId -> 'loop' | 'pingpong'

/* 驱动求值：引擎时钟的纯函数，不做增量积分 —— 不累积浮点漂移，
   暂停恢复不跳变，且录制器按固定 dt 推进 state.t 时可直接复用。 */
function driveValue(d, tt, mode) {
  const m = mode || d.mode || (d.kind === 'circular' ? 'loop' : 'pingpong');
  const u = ((tt / d.period) % 1 + 1) % 1;              // 负时间也落在 [0,1)
  const s = (m === 'loop') ? u : (u < 0.5 ? 2 * u : 2 - 2 * u);
  return d.from + (d.to - d.from) * s;
}

/* 把当前场景的驱动量按引擎时钟写回 state。只动数据、不碰 DOM ——
   录制器的离线渲染也调它，那条路径上没有面板可同步（见规范 §D1）。 */
function applyDrive() {
  const sc = SCENES[curTab];
  if (!sc || !sc.drive || !autoPlay[curTab]) return;
  state[sc.drive.key] = driveValue(sc.drive, state.t, driveMode[curTab]);
}

/* 供录制器判断无缝循环的吸附基准；无驱动或用户关掉自动播放时返回 null */
function driveInfo() {
  const sc = SCENES[curTab];
  if (!sc || !sc.drive || !autoPlay[curTab]) return null;
  return { key: sc.drive.key, period: sc.drive.period, mode: driveMode[curTab] };
}

/* 把驱动出的值反算回滑块刻度并回显。带 map 的参数必须提供 invMap，
   否则只能退回显示映射后的值（规范 §8 已把 invMap 列为硬约束）。 */
function syncParamSlider(key) {
  const e = paramWraps[key];
  if (!e) return;
  const raw = (e.p.map && e.p.invMap) ? e.p.invMap(state[key]) : state[key];
  e.input.value = raw;
  e.val.textContent = e.p.fmt(raw);
}

/* 按当前页签的 params 显隐滑块。省略 params = 全部显示（向后兼容）。
   不复制 DOM：滑块值是跨页签共享的 state，复制会引入多份 DOM 的同步问题。 */
function syncParamVisibility() {
  const list = SCENES[curTab] && SCENES[curTab].params;
  Object.keys(paramWraps).forEach(k => {
    paramWraps[k].wrap.style.display = (!list || list.indexOf(k) >= 0) ? '' : 'none';
  });
}

function setAutoPlay(on) { autoPlay[curTab] = on; refreshDriveRow(curTab); }

function refreshDriveRow(id) {
  const row = document.querySelector('.drive[data-tab="' + id + '"]');
  if (!row) return;
  row.querySelector('input').checked = !!autoPlay[id];
  row.querySelectorAll('[data-mode]').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === driveMode[id]);
  });
}

function buildDrive() {
  const host = document.getElementById('driveHost');
  Object.keys(SCENES).forEach(id => {
    const d = SCENES[id].drive;
    if (!d) return;
    autoPlay[id] = true;
    driveMode[id] = d.mode || (d.kind === 'circular' ? 'loop' : 'pingpong');
    const row = document.createElement('div');
    row.className = 'drive';
    row.dataset.tab = id;
    row.innerHTML = '<label class="tg"><input type="checkbox" checked><span class="autoL"></span></label>' +
      '<span class="dmode"><button class="btn" data-mode="pingpong"></button>' +
      '<button class="btn" data-mode="loop"></button></span>';
    row.querySelector('input').addEventListener('change', e => { autoPlay[id] = e.target.checked; });
    row.querySelectorAll('[data-mode]').forEach(b => {
      b.addEventListener('click', () => { driveMode[id] = b.dataset.mode; refreshDriveRow(id); });
    });
    host.appendChild(row);
    const relabel = () => {
      row.querySelector('.autoL').textContent = t(UI.autoPlay);
      row.querySelector('[data-mode="pingpong"]').textContent = t(UI.pingpong);
      row.querySelector('[data-mode="loop"]').textContent = t(UI.loop);
    };
    RELABEL.push(relabel);
    relabel();
    refreshDriveRow(id);
  });
}
```

- [ ] **Step 8: `buildParams()` 记账 + 拖动接管**

`buildParams()` 里，`host.appendChild(wrap);` 那一行**之后**插入：

```js
    paramWraps[p.key] = { wrap, input, val, p };
    /* 用户伸手拖被驱动的滑块 = 明确要接管，自动播放当场关闭，
       否则下一帧就会被驱动值覆盖回去。这是与「暂停只冻结模拟」一致的语义。 */
    input.addEventListener('input', () => {
      const d = SCENES[curTab] && SCENES[curTab].drive;
      if (d && d.key === p.key && autoPlay[curTab]) setAutoPlay(false);
    });
```

- [ ] **Step 9: `frame()` 接入驱动**

`frame()`（`:670`）里的 `if (state.running) { … }` 块改为：

```js
  if (state.running) {
    state.t += dt;
    state.theta += state.omega * dt;
    applyDrive();
    const dv = SCENES[curTab].drive;
    if (dv && autoPlay[curTab]) syncParamSlider(dv.key);
    pushSample();
  }
```

- [ ] **Step 10: `switchTab()` 接入显隐**

`switchTab()`（`:818`）里，把显隐选择器那一行的 `.toggles[data-tab], .views[data-tab]` 改成包含 `.drive[data-tab]`，并在 `refreshViewButtons();` **之前**加一行 `syncParamVisibility();`：

```js
  document.querySelectorAll('.toggles[data-tab], .views[data-tab], .drive[data-tab]').forEach(el => {
    el.style.display = el.dataset.tab === id ? '' : 'none';
  });
  cam = cams[id];
  brandDesc.textContent = t(SCENES[id].brand);
  tipsEl.textContent = t(SCENES[id].tips);
  syncParamVisibility();
  refreshViewButtons();
  updateReadout();
```

- [ ] **Step 11: 启动序列加 `buildDrive()`**

`:969`–`:972` 的四行改为：

```js
buildTabs();
buildParams();
buildDrive();
buildToggles();
buildViews();
```

`switchTab(Object.keys(SCENES)[0])`（`:979`）会调用 `syncParamVisibility()`，故初始显隐由它负责，无需另加。

- [ ] **Step 12: 语法门禁**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' design-system/math-viz-starter.html | node --check /dev/stdin
```
预期：无输出。

- [ ] **Step 13: 浏览器验收（GREEN）**

重载 `http://localhost:8777/design-system/math-viz-starter.html`，控制台逐条执行并核对：

```js
/* 1. 契约存在 */
({ applyDrive: typeof applyDrive, driveInfo: typeof driveInfo })
// 期望 { applyDrive: "function", driveInfo: "function" }

/* 2. lissa 页签显示 4 个滑块，blank 只显示 2 个 */
switchTab('lissa');
const vis = () => [...document.querySelectorAll('#paramsHost .ctl')]
  .filter(e => e.style.display !== 'none').length;
vis()          // 期望 4
switchTab('blank'); vis()   // 期望 2

/* 3. 驱动求值：loop 单调上升，pingpong 折返 */
const d = SCENES.lissa.drive;
[0, 2, 4, 6, 8].map(x => +driveValue(d, x, 'loop').toFixed(3))
// 期望 [0, 1.571, 3.142, 4.712, 0]      —— 一圈到头回到起点
[0, 2, 4, 6, 8].map(x => +driveValue(d, x, 'pingpong').toFixed(3))
// 期望 [0, 3.142, 6.283, 3.142, 0]      —— 走到头再折回

/* 4. 首尾无跳变：一整轮结束时回到起点 */
Math.abs(driveValue(d, 0, 'loop') - driveValue(d, d.period, 'loop')) < 1e-9   // 期望 true

/* 5. kind 决定默认模式 */
switchTab('lissa'); driveInfo().mode    // 期望 "loop"      （circular）
switchTab('blank'); driveInfo().mode    // 期望 "pingpong"  （linear）

/* 6. 关掉自动播放后 driveInfo 返回 null、applyDrive 变 no-op */
switchTab('blank'); setAutoPlay(false);
driveInfo()                              // 期望 null
const before = state.omega; state.t += 3; applyDrive(); state.omega === before   // 期望 true
setAutoPlay(true);

/* 7. 自动播放开启时 applyDrive 确实改写 state */
state.t = 1.5; applyDrive();
Math.abs(state.omega - driveValue(SCENES.blank.drive, 1.5, 'pingpong')) < 1e-9   // 期望 true

/* 8. invMap 回显：驱动 phi 后滑块刻度是弧度除以 π */
switchTab('lissa'); state.t = 2; applyDrive(); syncParamSlider('phi');
Math.abs(parseFloat(document.querySelectorAll('#paramsHost .ctl input')[2].value) - state.phi / Math.PI) < 1e-6
// 期望 true

/* 9. 每个页签独立记住自己的模式 */
switchTab('lissa'); driveMode.lissa = 'pingpong';
switchTab('blank'); driveMode.blank    // 期望 "pingpong"（blank 的默认，未被 lissa 影响）
switchTab('lissa'); driveMode.lissa    // 期望 "pingpong"（自己的选择被保留）
```

再做两项肉眼验收：

- 切到 blank 页签，面板上只剩「角速度 ω」「波形展开速度」两个滑块；切回 lissa，四个都在，且**值没有丢**（`params` 只管可见性）
- 勾掉「自动播放」→ 画面定格；重新勾上 → 继续动，且**没有跳变**（纯函数求值的直接结果）
- 拖动被驱动的滑块（lissa 页的 φ）→「自动播放」自动取消勾选

- [ ] **Step 14: 检查改动范围并提交**

```bash
git diff --name-only
```
预期：只有 `design-system/math-viz-starter.html`。

```bash
git add design-system/math-viz-starter.html && git commit -m "feat(engine): 场景作用域参数与时间驱动（params / drive / applyDrive）"
```

---

## Task 3: 录制器适配

**Files:**
- Modify: `app.html`
  - `REC.Bridge.get` 的 handle 构造在 `REC:BRIDGE` 锚点区内
  - `REC.Source.offline` 的每帧 `step()` 在 `REC:SOURCE` 锚点区内
  - `REC.Source.snapDuration` 同上
  - `REC.Bridge.__test` / `REC.Source.__test` 各自区内

**Interfaces:**
- Consumes: 工具顶层的 `applyDrive()` 与 `driveInfo()`（见「核心契约」）。**这两个函数由 Task 2 在 starter 里实现，Task 3 与之并行开发，因此在你的工作副本里它们尚不存在**——用下文 Step 2 的桩验证。
- Produces: `REC.Bridge.get()` 的 handle 增加 `applyDrive` 与 `driveInfo` 两个字段（取不到时为 `null`）

**本文件是 ES5 风格：`var` + `function`，禁止 `const`/`let`/箭头函数/模板字符串/`class`。注释中文。**

**这个任务的存在理由**：`REC.Source.offline` 不走工具的 `frame()`，它自己推进时钟后直接 `draw()`。若驱动求值只在 `frame()` 里，离线录制会整段绕过它——`drive` 修好之后，屏幕上参数在动，**录出来的视频依然是静止图**。所有交互验收都会通过，只有真去看导出的视频才发现。

- [ ] **Step 1: 先给两个单元的自检加断言（RED）**

在 `REC.Bridge.__test` 的 `return r;` **之前**插入：

```js
  ok('handle 暴露 applyDrive 字段', 'applyDrive' in h);
  ok('handle 暴露 driveInfo 字段', 'driveInfo' in h);
```

在 `REC.Source.__test` 的 `return r;` **之前**插入：

```js
  /* 无驱动时吸附基准仍是 2π/ω；有驱动时改用 drive.period（见规范 §D2） */
  ok('无驱动时按 2π/ω 吸附',
     Math.abs(REC.Source.snapDuration(8, 1, null) - 6.283185307179586) < 1e-6);
  ok('有驱动时按 drive.period 吸附',
     REC.Source.snapDuration(8, 1, { period: 3 }) === 6);
  ok('有驱动且不足一个周期时补一整轮',
     REC.Source.snapDuration(2, 1, { period: 5 }) === 5);
```

- [ ] **Step 2: 跑自检确认 fail**

起服务器（`python3 -m http.server 8777`，Bash `run_in_background: true`），浏览器新建自己的标签页（`mcp__Claude_Browser__tabs_create`，之后所有浏览器调用都带上这个 `tabId`），开
`http://localhost:8777/app.html?tool=fourier-essence-3d`，等工具画面出现后执行 `REC.selftest()`。

预期：`fail` 里出现上面五条中的若干条。（`snapDuration` 目前只有两个形参，第三个实参被忽略，故后两条必失败；`applyDrive`/`driveInfo` 字段不存在，前两条必失败。）

- [ ] **Step 3: Bridge handle 增加两个字段**

在 `REC.Bridge.get` 构造 `h` 对象的地方，`applyView:` 那一行之后插入两行：

```js
    applyDrive: _peek(win, 'typeof applyDrive === "function" ? applyDrive : null'),
    driveInfo:  _peek(win, 'typeof driveInfo  === "function" ? driveInfo  : null'),
```

**不要**把它们加进 `get()` 末尾那句 `if (!h.state || !h.cam || !h.draw) return null;` 的判定里——未声明 `drive` 的旧工具没有这两个函数，加进去会让 51 个存量工具全部判为不可录制。

- [ ] **Step 4: `snapDuration` 增加驱动基准**

把 `REC.Source.snapDuration` 整个函数替换为：

```js
/* 无缝循环要求整数个周期。周期取谁：场景有驱动且自动播放开着时，
   真正的循环周期是 drive.period；否则仍是相位周期 2π/|ω|。 */
REC.Source.snapDuration = function(sec, omega, di){
  var period;
  if (di && di.period > 0) period = di.period;
  else if (omega) period = 2 * Math.PI / Math.abs(omega);
  else return sec;
  var n = Math.floor(sec / period);
  if (n < 1) n = 1;
  return n * period;
};
```

- [ ] **Step 5: 离线渲染每帧调用 `applyDrive`**

在 `REC.Source.offline` 的 `step()` 函数里，现有三行是：

```js
      h.state.t += dt;
      h.state.theta += omega * dt;
      if (h.pushSample) h.pushSample();
```

（`omega` 是该函数开头 `var omega = REC.Source.omegaOf(h);` 取到的局部变量，不要改动它。）

改为——**只新增中间那一行**：

```js
      h.state.t += dt;
      h.state.theta += omega * dt;
      if (h.applyDrive) h.applyDrive();     /* 沿用当前页签的驱动设定；无驱动的旧工具跳过 */
      if (h.pushSample) h.pushSample();
```

顺序有讲究：必须在 `state.t` 推进**之后**、`pushSample()` **之前**。`applyDrive` 按 `state.t` 求值，早于推进就会拿到上一帧的时间；晚于 `pushSample` 则历史里记的是驱动前的旧值，违反"记录当时真实值"的不变量。

- [ ] **Step 6: `REC.UI.run` 传入驱动信息**

`REC.UI.run` 里调用 `snapDuration` 的那一行改为：

```js
  var dInfo = h.driveInfo ? h.driveInfo() : null;
  var dur = cfg.duration;
  if (cfg.loop) dur = REC.Source.snapDuration(dur, REC.Source.omegaOf(h), dInfo);
```

同样地，`REC.UI.effDur()` 里的 `snapDuration` 调用也要传第三个参数，否则面板显示的有效时长与实际录制的不一致：

```js
  var h = REC.Bridge.get();
  if (!h) return req;
  var di = h.driveInfo ? h.driveInfo() : null;
  return REC.Source.snapDuration(req, REC.Source.omegaOf(h), di);
```

- [ ] **Step 7: 跑自检确认全 pass**

浏览器执行 `REC.selftest()`。预期 `fail` 为空数组。

**注意两个环境坑**（重新发现它们会白费一小时）：
- 该自动化浏览器的标签页恒为 `document.hidden === true`，`requestAnimationFrame` 不会自由运行，只在**截图**时前进几拍。要把一段录制跑完，把 `REC.CFG.duration` 设成 `0.1`（6 帧）再截 2–3 张图。`javascript_exec` 本身不推动 rAF。
- 页面刚载入时工具画布是 0×0，`Bridge · canvas 有尺寸` 会假失败。等画面出现再跑，**不要**去"修"那条断言。
- `REC.Source.__test` 会起一段 0.5 秒的离线渲染并在结束时才释放合成器锁，所以连着跑两次 `REC.selftest()` 第二次必然失败。每次验证前重新加载页面。

- [ ] **Step 8: 语法门禁与范围检查**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
git diff --name-only
```
预期：语法无输出；改动文件只有 `app.html`。

- [ ] **Step 9: 提交**

```bash
git add app.html && git commit -m "feat(app): 录制器沿用场景驱动设定（applyDrive / driveInfo / 吸附基准）"
```

---

## Task 4: 场景审计工具

**Files:**
- Create: `scripts/audit-scenes.html`

**Interfaces:**
- Consumes: 读取每个工具顶层的 `SCENES`、`PARAMS`、`state`、`canvas`、`draw`、`switchTab`（经 iframe 的 `contentWindow.eval`）；以及 Task 2 新增的 `SCENES[].params` / `SCENES[].drive`（读不到时按"未声明"处理，不报错）
- Produces: 无代码接口；产出一张给人看的表格，以及一份可复制的 `params` 初稿

这个工具就是本次调研用的运行时探针的固化版。**它不接入 CI**——CI 跑不了浏览器，而仓库的零依赖红线不接受引入 Playwright。它是"人工门禁 + 工具辅助"。

**探针的已知局限必须写在页面上**：它只能测"改了这个滑块画面有没有变"，测不出"作者本意"。某个滑块本该有效但当前实现漏读了，探针会报它无效。所以生成的 `params` 初稿**必须人工复核**。

- [ ] **Step 1: 建文件**

创建 `scripts/audit-scenes.html`。单文件、零依赖，通过 `../tools.json` 取工具清单，逐个载入隐藏 iframe 探测。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>场景审计 · Scene Audit</title>
<style>
body{margin:0;padding:20px;background:#05070d;color:#dbe6f5;
  font-family:ui-sans-serif,-apple-system,"PingFang SC",sans-serif;font-size:13px}
h1{font-size:18px;margin:0 0 4px}
.note{color:#7d8ca6;font-size:12px;line-height:1.7;margin:0 0 16px;max-width:70em}
.note b{color:#ffd7e3}
button{padding:7px 14px;border-radius:8px;cursor:pointer;
  border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:#dbe6f5}
#bar{margin:12px 0;color:#7d8ca6}
table{border-collapse:collapse;width:100%;margin-top:12px}
th,td{text-align:left;padding:5px 9px;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top}
th{color:#7d8ca6;font-weight:600;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase}
.bad{color:#ff5a8a;font-weight:600}
.warn{color:#ffa653}
.ok{color:#37d9a0}
code{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:#a68bff}
iframe{position:fixed;left:-9999px;top:0;width:1200px;height:700px;border:0}
</style>
</head>
<body>
<h1>场景审计 · Scene Audit</h1>
<p class="note">
逐个载入 <code>outputs/</code> 下的工具，对每个页签：把每个滑块推到量程两端比对画布像素，
判断它对当前页签<b>是否真的有效</b>；再让引擎时钟前进 0.5 秒，判断该页签<b>有没有时间驱动</b>。<br>
<b>局限</b>：只能测「改了有没有反应」，测不出「作者本意」。某个滑块本该有效但实现漏读了，这里会报它无效。
生成的 <code>params</code> 初稿必须人工复核后再用。<br>
必须通过本地服务器打开（<code>python3 -m http.server 8777</code>），<code>file://</code> 下受同源限制无法探测。
</p>
<button id="go">开始审计</button>
<div id="bar"></div>
<table id="out"><thead><tr>
<th>工具</th><th>页签</th><th>滑块 展示/有效</th><th>驱动</th><th>已声明 params</th><th>实测 params 初稿</th>
</tr></thead><tbody></tbody></table>
<iframe id="fr"></iframe>
<script>
'use strict';
var fr = document.getElementById('fr');
var bar = document.getElementById('bar');
var tbody = document.querySelector('#out tbody');

/* 缩到 80×45 再取像素做 FNV-1a 哈希：够灵敏，又不至于每帧读全画布 */
function makeHash(){
  var pc = document.createElement('canvas'); pc.width = 80; pc.height = 45;
  var px = pc.getContext('2d', { willReadFrequently: true });
  return function(cv){
    px.clearRect(0,0,80,45); px.drawImage(cv, 0, 0, 80, 45);
    var d = px.getImageData(0,0,80,45).data, h = 2166136261;
    for (var i = 0; i < d.length; i += 7){ h ^= d[i]; h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
}
var hash = makeHash();

function load(url){
  return new Promise(function(res){
    var done = false;
    function on(){ if (done) return; done = true; fr.removeEventListener('load', on); setTimeout(res, 300); }
    fr.addEventListener('load', on);
    fr.src = url;
    setTimeout(function(){ if (!done){ done = true; res(); } }, 6000);
  });
}

function probe(){
  var w = fr.contentWindow;
  function ev(e){ try { return w.eval(e); } catch(x){ return undefined; } }
  var SCENES = ev('typeof SCENES !== "undefined" ? SCENES : null');
  var PARAMS = ev('typeof PARAMS !== "undefined" ? PARAMS : null');
  var state  = ev('typeof state  !== "undefined" ? state  : null');
  var cv     = ev('typeof canvas !== "undefined" ? canvas : null');
  var draw   = ev('typeof draw === "function" ? draw : null');
  var swt    = ev('typeof switchTab === "function" ? switchTab : null');
  var push   = ev('typeof pushSample === "function" ? pushSample : null');
  if (!SCENES || !PARAMS || !state || !cv || !draw || !swt) return null;
  var res = {};
  Object.keys(SCENES).forEach(function(sk){
    try { swt(sk); } catch(e){}
    draw();
    var t0 = state.t, th0 = state.theta;
    var h0 = hash(cv);
    for (var i = 0; i < 30; i++){
      state.t += 1/60; state.theta += (state.omega || 1) * (1/60);
      if (push) try { push(); } catch(e){}
    }
    draw();
    var anim = hash(cv) !== h0;
    state.t = t0; state.theta = th0; draw();
    var live = [];
    PARAMS.forEach(function(p){
      var old = state[p.key];
      var lo = p.map ? p.map(p.min) : p.min, hi = p.map ? p.map(p.max) : p.max;
      state[p.key] = lo; draw(); var a = hash(cv);
      state[p.key] = hi; draw(); var b = hash(cv);
      state[p.key] = old; draw();
      if (a !== b) live.push(p.key);
    });
    res[sk] = { live: live, anim: anim, total: PARAMS.length,
                declared: SCENES[sk].params || null,
                drive: SCENES[sk].drive ? (SCENES[sk].drive.key + '/' + (SCENES[sk].drive.kind || '?')) : null };
  });
  return res;
}

function row(tool, tab, r){
  var tr = document.createElement('tr');
  var cls = r.live.length === 0 ? 'bad' : (r.live.length < r.total ? 'warn' : 'ok');
  var declared = r.declared ? r.declared.join(', ') : '<span class="bad">未声明</span>';
  var drive = r.drive ? '<span class="ok">' + r.drive + '</span>'
                      : (r.anim ? '<span class="warn">未声明（有动画）</span>'
                                : '<span class="bad">无 · 静止</span>');
  tr.innerHTML = '<td>' + tool + '</td><td>' + tab + '</td>' +
    '<td class="' + cls + '">' + r.total + ' / ' + r.live.length + '</td>' +
    '<td>' + drive + '</td>' +
    '<td><code>' + declared + '</code></td>' +
    '<td><code>' + (r.live.length ? "['" + r.live.join("', '") + "']" : '[]') + '</code></td>';
  tbody.appendChild(tr);
}

document.getElementById('go').addEventListener('click', function(){
  this.disabled = true;
  tbody.innerHTML = '';
  fetch('../tools.json', { cache: 'no-cache' }).then(function(r){ return r.json(); }).then(function(j){
    var list = j.tools.slice();
    var i = 0, statTabs = 0, statStatic = 0, statShown = 0, statLive = 0;
    (function next(){
      if (i >= list.length){
        bar.innerHTML = '完成：' + statTabs + ' 个页签 · 滑块无效率 ' +
          Math.round(100 * (statShown - statLive) / Math.max(1, statShown)) + '% · 静止页签 ' +
          statStatic + ' 个';
        return;
      }
      var d = list[i++];
      bar.textContent = '审计中 ' + i + '/' + list.length + '：' + d.id;
      load('../' + d.file).then(function(){
        var res = null;
        try { res = probe(); } catch(e){ res = null; }
        if (!res){
          var tr = document.createElement('tr');
          tr.innerHTML = '<td>' + d.id + '</td><td colspan="5" class="bad">探测失败（非声明式实现，或页签结构与引擎约定不同）</td>';
          tbody.appendChild(tr);
        } else {
          Object.keys(res).forEach(function(sk){
            statTabs++; statShown += res[sk].total; statLive += res[sk].live.length;
            if (!res[sk].anim && !res[sk].drive) statStatic++;
            row(d.id, sk, res[sk]);
          });
        }
        next();
      });
    })();
  });
});
</script>
</body>
</html>
```

- [ ] **Step 2: 语法门禁**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' scripts/audit-scenes.html | node --check /dev/stdin
```
预期：无输出。

- [ ] **Step 3: 实跑验收**

起服务器后打开 `http://localhost:8777/scripts/audit-scenes.html`，点「开始审计」。

**注意**：整轮要跑数分钟，且该自动化浏览器的标签页被节流会更慢。可以只等前 10 个工具出结果就判定通过，不必等完。

核对三项（用调研阶段已知的真值）：

- `weierstrass-essence-3d` 三行分别是 `chord 3/1 · 无·静止`、`rational 3/1 · 无·静止`、`subst 3/1`（第三行有动画）
- `complex-mult-3d` 的 `demoivre` 行显示 `16 / 0` 且标红
- 底部汇总的「滑块无效率」在 45%–55% 之间

这三项对上，说明探针与调研阶段的结论一致。

- [ ] **Step 4: 提交**

```bash
git add scripts/audit-scenes.html && git commit -m "feat(scripts): 场景审计工具——实测每个页签的滑块有效性与时间驱动"
```

---

## Task 5: 联调与阶段验收

**必须最后做**，依赖 Task 1–4 全部合并。

**Files:**
- 不新增改动；本任务只做验证。若发现缺陷，在对应文件内修复。

**Interfaces:**
- Consumes: Task 1–4 的全部产出

- [ ] **Step 1: 语法门禁全过**

```bash
for f in design-system/math-viz-starter.html app.html scripts/audit-scenes.html; do
  printf "%-46s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "$f" | node --check /dev/stdin && echo OK
done
```
预期：三行都 OK。

- [ ] **Step 2: 存量工具零回归**

```bash
git diff --name-only main
```
预期：只有 `design-system/math-viz-design-system.md`、`design-system/math-viz-starter.html`、`app.html`、`scripts/audit-scenes.html`、`docs/superpowers/**`。**`outputs/` 与 `tools.json` 必须零改动。**

再在浏览器里开 `http://localhost:8777/app.html?tool=fourier-essence-3d`，执行 `REC.selftest()`，预期 `fail` 为空——证明未声明 `params`/`drive` 的旧工具完全不受影响。

- [ ] **Step 3: 录制沿用驱动设定 —— 逐条实录验证**

这是本阶段最容易"看代码觉得没问题"而实际失效的一环，**必须真的产出文件并检查**，不接受推理。

在浏览器里开 `http://localhost:8777/app.html`，把 iframe 指向 starter：

```js
frame.contentWindow.location.replace('design-system/math-viz-starter.html');
```

等载入后，把下载改成捕获 Blob 并读出真实分辨率与时长：

```js
window.__p = null;
REC.Encoder.download = function(b, n){
  var v = document.createElement('video'); v.preload = 'metadata';
  v.onloadedmetadata = function(){
    window.__p = { name: n, bytes: b.size, w: v.videoWidth, h: v.videoHeight, dur: +v.duration.toFixed(3) };
    URL.revokeObjectURL(v.src);
  };
  v.src = URL.createObjectURL(b);
};
```

逐项执行（每次录制后截图 2–3 张推动 rAF，再读 `window.__p`）：

| # | 操作 | 预期 |
|---|---|---|
| 1 | starter 停在 lissa 页、自动播放开、`REC.CFG.duration=0.1` 离线录制 | 导出视频里 φ 确实在变（对比首末帧像素哈希不同） |
| 2 | 同上但 `driveMode.lissa='loop'` 与 `'pingpong'` 各录一次 | 两段视频的 `bytes` 或首末帧哈希不同 |
| 3 | 勾掉自动播放后录制 | 视频是定格画面（首末帧哈希相同） |
| 4 | 自动播放开 + 无缝循环开，`REC.CFG.duration=8` 读 `REC.UI.effDur()` | 返回 8（lissa 的 `period` 是 8，8 正好一整轮） |
| 5 | 把 `REC.CFG.duration` 设为 5 再读 `REC.UI.effDur()` | 返回 8（不足一轮补一整轮） |
| 6 | 关掉自动播放后同样读 `REC.UI.effDur()` | 回到按 `2π/ω` 吸附的值（`ω=1` 时是 6.283…） |
| 7 | 切到 realtime 驱动录制一小段 | 驱动照常生效（走 `frame()`，验证没被本次改动破坏） |

第 1 项是核心证据：**漏掉 `applyDrive()` 时它必然失败，而其余各项可能全过。**

- [ ] **Step 4: starter 交互回归**

在 `http://localhost:8777/design-system/math-viz-starter.html` 上逐项肉眼确认：

- 切页签时滑块按 `params` 显隐，切回来值没丢
- 勾掉自动播放画面定格，重新勾上继续动且无跳变
- 拖被驱动的滑块 → 自动播放自动取消
- 两个页签各自记住自己的模式选择
- 空格暂停时驱动也停，相机仍可拖动（§4 第五原则）
- 语言切换后驱动行的「自动播放 / 往返 / 循环」跟着变中英文

- [ ] **Step 5: 审计工具复核 starter 自身**

打开 `http://localhost:8777/scripts/audit-scenes.html`——它读 `tools.json`，starter 不在清单里，所以**不会**被审计到。手工验证 starter 的声明与实测一致即可：在 starter 页面执行

```js
Object.keys(SCENES).map(k => ({ tab: k, declared: SCENES[k].params, drive: SCENES[k].drive.key }))
```
预期：`lissa` 声明 4 个参数、驱动 `phi`；`blank` 声明 2 个、驱动 `omega`。

- [ ] **Step 6: 提交（若 Step 1–5 有修复）**

```bash
git add -A && git commit -m "fix: 阶段 1 联调修复"
```

若无修复则跳过本步。

---

## Self-Review 记录

**Spec 覆盖**：§A 场景作用域参数 → Task 2 Step 6/7/8/10；§B 时间驱动（`driveValue` / `applyDrive` / `syncParamSlider` / `invMap`）→ Task 2 Step 5/7/9；§C 交互模型（自动播放开关、模式切换、拖动接管、per-tab 记忆）→ Task 2 Step 2/3/4/7/8；§D1 离线渲染调用 `applyDrive` → Task 3 Step 3/5；§D2 吸附基准 → Task 3 Step 4/6；§E 开发规范四条 → Task 1 Step 2；§F 审计工具 → Task 4；§H 验收 → Task 2 Step 13 + Task 5。无遗漏。

**已知取舍（有意为之）**：
- 一个场景只能有一个 `drive`。多量同时驱动的需求尚未出现，YAGNI。
- 审计工具不接入 CI（零依赖红线不接受 Playwright），定位为人工门禁的辅助。
- starter 的 `blank` 场景驱动 `omega` 而非更"自然"的 `amp`——因为 `blank` 的 `draw()` 只读 `omega` 与 `waveSpeed`，驱动它没读的量就看不见效果，示范会失效。
