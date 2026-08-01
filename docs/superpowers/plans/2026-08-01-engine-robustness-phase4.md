# 引擎健壮性与一致性 · 阶段 4 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 51 个工具的渲染循环在任何一帧抛出异常时都不再永久断掉，并清掉阶段 3 终审分诊过来的三项小欠账。

**Architecture:** `frame()` 整体包一层 `try/catch`，`requestAnimationFrame(frame)` 放 `finally`——循环不断是机械保证，不依赖 catch 里写对什么。先改真源 `design-system/math-viz-starter.html`，再用现有的 `scripts/port_drive_engine.py` 做三次严格字面替换铺到 51 个 `outputs/*.html`（实测 frame() 只有三种变体：starter 与 49 个工具逐字节相同、`cartesian-polar-coordinate-3d` 一种、`trig-essence-3d-new` 一种）。

**Tech Stack:** 无构建、无测试框架。验证靠 `node --check` 语法门禁 + 真实无头 Chromium（`playwright-core` + 本机缓存的 `chromium_headless_shell`）里的控制组实验 + `scripts/audit-scenes.html` 全量审计。

设计依据：[docs/superpowers/specs/2026-08-01-engine-robustness-design.md](../specs/2026-08-01-engine-robustness-design.md)

## Global Constraints

- **零外部依赖**；每个工具保持单文件、可直接用浏览器打开。
- **不新写第二个移植脚本**——扩展现有的 `scripts/port_drive_engine.py`。手改 51 个文件必然漂移，这正是本仓库引擎长成 51 份略有差异副本的原因。
- **脚本必须幂等**：第二次运行零改动（`--check` 模式验证）。
- **命中失败即报错并跳过该文件、把跳过清单打印出来**，绝不模糊匹配硬塞。
- **范围是 51 个 `outputs/*.html`**（含 `trig-essence-3d-new`，它虽是 `pre-declarative`、无 `SCENES`，但有同构的 `frame()` 与同样的变砖风险）。
- **版本各自 patch +1**，51 个工具全改。**不要写死 `1.1.0` → `1.1.1`**——实测版本号分散（`1.1.0` 35 个、`1.0.1` 9 个、`1.2.0` 3 个、`1.1.1` 3 个、`1.3.0` 1 个），规则是**读该文件当前 meta、patch 位加一**（`1.0.1` → `1.0.2`、`1.3.0` → `1.3.1`）。照字面套会给 16 个文件写错版本号。三处落地：HTML `<meta name="tool-version">`、HTML 头注释 changelog 顶行、`tools.json`。**changelog 标题两种写法（`版本记录（新→旧）：` / `版本记录（changelog，新→旧）：`）保持各文件原样。**
- **文档先行**：文档提交必须早于代码提交（仓库明文纪律，见 `CLAUDE.md`）。
- **所有面向用户的文案双语** `{ zh, en }`。
- **`app.html` 的 `/* >>> GENERATED:TOOLS */` 块只能由 `scripts/sync_registry.py` 重写**，不得手改。
- 语法门禁：`awk '/<script>/{f=1;next}/<\/script>/{f=0}f' FILE | node --check /dev/stdin`

## 验收的硬要求（阶段 3 用血换来的，本阶段继续适用）

1. **断言必须实际调用 `draw()` 与 `readout()`**，全周期多采样点。只读 `state` 数值**测不出崩溃类缺陷**——阶段 3 有批次因此把一个渲染循环已死的工具报成全绿。
2. **`seamless` 断言（`driveValue(d,0) === driveValue(d,period)`）是恒真式**，零信息量，不得作为无跳变的证据。
3. **`readout()` 文本不能当「在动」判据**——`readoutHead()` 的 `t=`/`θ=` 表头每帧都变，**任何页签（含永久定格的）都读出「全不重复」**。
4. **统一像素阈值已被否决**（阶段 3 实测 12 个页签标定跨度 38 倍）。主判据是数值。
5. **测静止先喂满 20 秒**（否则量到历史缓冲填充的瞬态）。
6. **声称「零问题」之前先造控制组证明方法抓得住。** 没有控制组的「零命中」等于没测。

---

## Task 1: 文档先行 —— §6 与 §8 补两条

**必须最先做，且单独一个提交。** 仓库纪律是文档先行；后续代码提交必须晚于本提交。

**Files:**
- Modify: `design-system/math-viz-design-system.md`

**Interfaces:**
- Consumes: 无
- Produces: 无（后续任务不依赖本任务的产物，但提交顺序有依赖）

- [ ] **Step 1: §6 补一句因果**

在 `design-system/math-viz-design-system.md` 的 §6「数据与状态约定」表格里，找到「场景作用域参数」那一行（当前文本以 `| 场景作用域参数 | 场景用 \`params: ['key', …]\` 声明本页签真正读取的滑块` 开头）。在该行末尾的句号前追加：

```
；这条规则同时是**驱动漂移不会变成不可纠正**的原因——自动播放会把跨页签共享的键留在任意值上（30 个工具存在这种键），只要每个消费它的场景都把它声明进 `params`，那边就永远有滑杆可纠正
```

- [ ] **Step 2: §8 自查清单补一条**

在 `design-system/math-viz-design-system.md` §8 第 6 条自查清单里，在 `□ node --check 通过` 这一项**之前**插入：

```
□ `frame()` 有 `try/catch` 且 `requestAnimationFrame(frame)` 在 `finally` 里（一帧抛出不得杀死整个渲染循环；rAF 放 finally 是机械保证，不依赖 catch 里写对什么）
```

- [ ] **Step 3: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有 `design-system/math-viz-design-system.md`。

```bash
git add design-system/math-viz-design-system.md
git commit -m "docs(design-system): §6 补驱动漂移的因果，§8 补 frame() 的 try/catch 要求"
```

---

## Task 2: `frame()` 加固铺到 51 个工具 + patch 版本号

**Files:**
- Modify: `design-system/math-viz-starter.html`
- Modify: `scripts/port_drive_engine.py`
- Modify: 全部 51 个 `outputs/*.html`

**Interfaces:**
- Consumes: Task 1 的文档（提交顺序）
- Produces: 51 个 HTML 的 `<meta name="tool-version">` = `1.1.1`，供 Task 4 的脚本读回

### 为什么必须脚本化

手改 51 个文件必然漂移——本仓库的引擎正是靠复制粘贴扩散成 51 份略有差异副本的。阶段 1 与阶段 3 都用 `scripts/port_drive_engine.py` 集中铺过，本次继续用它。

- [ ] **Step 1: 建立变体基线**

```bash
python3 - <<'PY'
import pathlib, re, hashlib, collections
h = collections.defaultdict(list)
for p in sorted(pathlib.Path('outputs').glob('*.html')):
    src = p.read_text(encoding='utf-8')
    m = re.search(r'\nfunction frame\(ts\) \{\n.*?\n\}\n', src, re.S)
    if not m: h['(no frame)'].append(p.name); continue
    h[hashlib.sha1(m.group(0).encode()).hexdigest()[:10]].append(p.name)
for k, v in sorted(h.items(), key=lambda kv: -len(kv[1])):
    print(f"{k}  {len(v)}  {'' if len(v) > 3 else v}")
PY
```

预期恰好三行：`3596fa4be1 49`、`97f4b2f9e5 1 ['cartesian-polar-coordinate-3d.html']`、`4a471a027f 1 ['trig-essence-3d-new.html']`。
**若不是三行，停下来查**——说明有文件的 `frame()` 与预期不符，字面替换会漏掉它。

- [ ] **Step 2: 改真源 starter 的 `frame()`**

`design-system/math-viz-starter.html` 里 `function frame(ts) {` 的整块，改为（**注意函数体整体缩进两格**）：

```js
function frame(ts) {
  try {
    const dt = clamp((ts - lastTs) / 1000, 0, 0.05);
    lastTs = ts;

    if (tween) {
      const k = Math.min(1, (ts - tween.t0) / tween.dur);
      const e = ease(k);
      const f = tween.from, o = tween.to;
      cam.az = f.az + wrapPI(o.az - f.az) * e;
      cam.el = f.el + (o.el - f.el) * e;
      cam.dist = f.dist + (o.dist - f.dist) * e;
      cam.tx = f.tx + (o.tx - f.tx) * e;
      cam.ty = f.ty + (o.ty - f.ty) * e;
      cam.tz = f.tz + (o.tz - f.tz) * e;
      if (k >= 1) tween = null;
    }

    if (state.running) {
      state.t += dt;
      state.theta += state.omega * dt;
      applyDrive();
      const dv = SCENES[curTab].drive;
      if (dv && autoPlay[curTab]) syncParamSlider(dv.key);
      pushSample();
    }
    const windowSec = (SCENES[curTab].sampleWindow || (() => 10))();
    while (samples.length && samples[0].t < state.t - windowSec) samples.shift();

    draw();
    if (ts - lastRO > 120) { lastRO = ts; updateReadout(); }
  } catch (err) {
    frameError(err);
  } finally {
    /* rAF 放 finally 是「循环永不断」的机械保证：不依赖 catch 里写对什么。
       代价是画布可能停在最后一帧好内容而屏幕无提示——这是有意的取舍，
       「整个工具变砖」比「画面停在错误状态」更不可接受。 */
    requestAnimationFrame(frame);
  }
}
```

- [ ] **Step 3: 在 starter 里新增 `frameError`**

紧贴 `function frame(ts) {` 之前插入：

```js
/* 帧级异常兜底：同一页签的同一条错误只报一次，否则 60 fps 会把控制台刷爆。
   resetSim() 会清空它——用户主动重置后应当允许重新报。 */
const frameErrSeen = Object.create(null);
function frameError(err) {
  const k = curTab + '|' + ((err && err.message) || err);
  if (frameErrSeen[k]) return;
  frameErrSeen[k] = 1;
  console.warn('[frame] 场景「' + curTab + '」抛出异常，已跳过该帧并继续渲染循环：', err);
}
```

- [ ] **Step 4: 在 starter 的 `resetSim()` 里清空去重表**

把 `function resetSim() {` 这一行替换为：

```js
function resetSim() {
  /* 清空帧级异常去重表：用户主动重置后应当允许重新报 */
  Object.keys(frameErrSeen).forEach(k => delete frameErrSeen[k]);
```

- [ ] **Step 5: 语法门禁验 starter**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' design-system/math-viz-starter.html | node --check /dev/stdin && echo "starter OK"
```

- [ ] **Step 6: 扩展 `scripts/port_drive_engine.py`**

新增三个严格字面替换（沿用该脚本已有的 `replace_block` 写法——命中数必须恰为 1，否则报错跳过该文件并列入跳过清单）：

1. **`frame()` 变体 A**（starter 与 49 个工具共用同一段旧文本）：旧文本取 Step 1 里哈希为 `3596fa4be1` 的整块，新文本即 Step 2 的结果。
2. **`frame()` 变体 B**（`cartesian-polar-coordinate-3d`）：它的 `state.running` 块比标准版多三行（`state.theta += state.speed * 0.75 * dt;`、`state.kPhase += state.speed * 0.55 * dt;`、`state.morphK = 0.5 - 0.5 * Math.cos(state.kPhase);`、`syncKSlider();`），其余相同。做同样的包裹与整体缩进两格。
3. **`frame()` 变体 C**（`trig-essence-3d-new`）：它没有 `applyDrive()`/`syncParamSlider()`，且 `windowSec` 用的是 `WAVE_LEN / state.waveSpeed + 0.5`。做同样的包裹与整体缩进两格。

另加两个对全部 51 个文件通用的替换：

4. **插入 `frameError`**：把 `\nfunction frame(ts) {\n` 替换为 Step 3 的注释 + `frameErrSeen` + `frameError` 定义，再接 `function frame(ts) {\n`。
5. **`resetSim()` 清表**：把 `function resetSim() {\n` 替换为 Step 4 的两行结果。每个文件只有一个 `resetSim()`，命中数恰为 1。

- [ ] **Step 7: 跑脚本并验幂等**

```bash
python3 scripts/port_drive_engine.py
python3 scripts/port_drive_engine.py --check
```
预期：第一次报告 51 个文件被改动、跳过 0；`--check` 报告改动 0。**若有跳过文件，把清单贴进报告并逐个查明原因，不要绕过。**

- [ ] **Step 8: 结构验收**

```bash
echo -n "含 frameError 的文件数: "; grep -l "function frameError" outputs/*.html | wc -l
echo -n "rAF 在 finally 里的文件数: "; grep -B2 "requestAnimationFrame(frame);" outputs/*.html | grep -c "} finally {"
echo -n "resetSim 清表的文件数: "; grep -l "清空帧级异常去重表" outputs/*.html | wc -l
```
预期三行均为 `51`。

- [ ] **Step 9: 语法门禁全量**

```bash
fail=0
for f in outputs/*.html app.html index.html; do
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "$f" | node --check /dev/stdin || { echo "FAIL $f"; fail=1; }
done
[ $fail -eq 0 ] && echo "全部通过"
```

- [ ] **Step 10: 控制组实验 —— 先证明尺子抓得住**

用真实无头 Chromium（`playwright-core` + 本机缓存的 `chromium_headless_shell`，`document.hidden === false`、rAF 自由运行、画布 1280×800）。起服务器 `python3 -m http.server 8880`（Bash `run_in_background: true`）。

**先在未修复的副本上验证探针有效**：

```bash
mkdir -p /tmp/p4ctl && git show HEAD~1:outputs/pi-essence-3d.html > /tmp/p4ctl/before.html
```

把 `/tmp/p4ctl/before.html` 里当前页签的 `draw(C)` 开头插入 `throw new Error('ctl');`，用浏览器加载它，注入一个帧计数器：

```js
window.__n = 0;
const _raf = window.requestAnimationFrame;
window.requestAnimationFrame = function (cb) { window.__n++; return _raf(cb); };
```

等 2 秒读 `window.__n`。**预期：计数停住**（证明未修复版确实会死，探针抓得住）。

- [ ] **Step 11: 控制组实验 —— 再证明修好了**

把同样的 `throw new Error('ctl');` 注入**修复后**的 `outputs/pi-essence-3d.html` 副本，同样加载并等 2 秒。

预期：
- `window.__n` **持续增长**（循环还活着）
- 控制台**恰好一条** `[frame] 场景「…」抛出异常` 警告（去重生效，不是每秒 60 条）
- 切到别的页签后画面正常动、控制台不再新增该条
- 切回出问题的页签，仍然只有那一条

- [ ] **Step 12: 抽样验证正常路径零影响**

对 ≥8 个工具（**必须含 `cartesian-polar-coordinate-3d`（唯一 `paramRefs` 结构）与 `trig-essence-3d-new`（唯一 `pre-declarative`）**），不注入任何异常，逐个确认：

```js
Object.keys(SCENES).map(k => {
  switchTab(k);
  let threw = null;
  try { draw(); SCENES[k].readout(); } catch (e) { threw = String(e); }
  return { tab: k, threw };
})
```

预期每个页签 `threw: null`。`trig-essence-3d-new` 没有 `SCENES`，改为直接调 `draw()` 与 `updateReadout()` 各一次并确认不抛。

- [ ] **Step 13: patch 版本号（51 个文件两处）**

meta 的 patch 位加一——**以该文件当前值为准**（`1.1.0` → `1.1.1`、`1.0.1` → `1.0.2`、`1.3.0` → `1.3.1`），不是所有文件都从 `1.1.0` 起步。头注释 changelog 最上方加一行（版本号用该文件递增后的实际值）：

```
    1.1.1  2026-08-01  帧级异常兜底：单帧抛出不再杀死渲染循环
```

**保持各文件原有的 changelog 标题写法**（`版本记录（新→旧）：` 与 `版本记录（changelog，新→旧）：` 两种）。这一步也用脚本做，不要手改 51 个文件。

- [ ] **Step 14: 确认范围并提交**

```bash
git diff --name-only
```
预期：`design-system/math-viz-starter.html`、`scripts/port_drive_engine.py`、51 个 `outputs/*.html`。**不含 `tools.json`**（Task 4 统一处理）。

```bash
git add design-system/math-viz-starter.html scripts/port_drive_engine.py outputs/
git commit -m "fix(engine): frame() 加 try/catch，rAF 移入 finally —— 单帧抛出不再杀死渲染循环"
```

---

## Task 3: 文案轮与两处 off-grid 默认值

**Files:**
- Modify: `outputs/limit-essence-3d.html`
- Modify: `outputs/proof-logic-induction-3d.html`
- Modify: `outputs/complex-mult-3d.html`
- Modify: `outputs/lines-planes-3d.html`

**Interfaces:**
- Consumes: Task 2 已把这四个文件的版本号改到 `1.1.1`
- Produces: 无

**版本号不再递增**——这四处与 Task 2 同属本次交付。

- [ ] **Step 1: `limit-essence-3d/series` 的 tips 补「会自己重播」**

该场景 `tips` 当前两句都以「按 R 重开」结尾，没说它走完一轮会自己重来。改这两处结尾：

`zh`：把 `就差一阶，命运两分。按 R 重开。` 改为

```
就差一阶，命运两分。走完 60 项会自己从头累一次，也可按 R 立刻重开。
```

`en`：把 `One order apart, two fates. Press R to restart.` 改为

```
One order apart, two fates. After 60 terms it starts over on its own; press R to restart immediately.
```

保持 §7 规范：tips 只讲一个顿悟点。补的这句是对既有那句的机制补充，不另起知识点。

- [ ] **Step 2: `proof-logic-induction-3d/induction` 的 tips 同样处理**

该场景 `tips` 完全没提重播。在两句末尾各追加一句：

`zh`：把 `两句话，缺一不可。` 改为

```
两句话，缺一不可。波前推完整列后会自己从头再来。
```

`en`：把 `Two sentences — and neither is optional.` 改为

```
Two sentences — and neither is optional. Once the wave clears the ladder it replays from the start.
```

- [ ] **Step 3: 两页的留痕注释补上修复后的晚期读数**

这两页的「已有动画」留痕注释里引的数字是**修复前**的定格实测（阶段 3 终审 O-2 指出）。例如 `limit-essence-3d` 的 `pushSample()` 上方写着「实测 ω=0.8 时 t≈37.5 s 封顶；t≈200 s 起 12 秒窗口 721 帧只有 1 个不重复画面、maxΔ = 0、读数正文 distinct = 1」——那是**病症**，不是现状。§8 第 ④ 条要求留痕注释写「晚期实测读数」，好让日后审计能核对。

**不要删掉病症数字**（它解释了为什么要改），而是在其后补一句修复后的实测。先用真实无头 Chromium 测（喂满 20 秒再推到 t≈200 s，取 12 秒窗口的不重复帧数，与病症数字同一口径），再把实测值填进这个句式：

```
修复后同一口径实测：t≈200 s 起 12 秒窗口 <N> 个不重复画面。
```

两页各补一句，`<N>` 用你自己测出来的数，**不要照抄阶段 3 报告里的数字**（那是当时的版本，且本阶段动过 `frame()`）。

- [ ] **Step 4: `complex-mult-3d` 的 `phi2` 对齐 step 网格**

`PARAMS` 里 `phi2` 当前 `value: 0.33` 而 `step: 0.02`，range 输入会吸附到 `0.34`，导致代码声明的初值与面板实际初值不一致。把 `value` 改为落在 step 网格上的值（`0.34`），使两者一致。

- [ ] **Step 5: `lines-planes-3d` 的 `aEl` 对齐 step 网格**

同理，`aEl` 当前 `value: 0.35` 被吸附到 `0.36`。把 `value` 改为 `0.36`。

- [ ] **Step 6: 语法门禁**

```bash
for f in limit-essence-3d proof-logic-induction-3d complex-mult-3d lines-planes-3d; do
  printf "%-32s " "$f"
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "outputs/$f.html" | node --check /dev/stdin && echo OK
done
```
预期 4 行全 OK。

- [ ] **Step 7: 验证四处改动**

- 两处 tips：切到中英文各看一遍，确认双语都补上了、且渲染不串版。
- 两处 `value`：加载页面后读 `state.phi2` 与 `state.aEl`，确认与 `PARAMS` 里声明的 `value` **相等**（此前不等，正是这个缺陷）。

- [ ] **Step 8: 确认范围并提交**

```bash
git diff --name-only
```
预期：只有这四个 `outputs/*.html`，**不含 `tools.json`**。

```bash
git add outputs/limit-essence-3d.html outputs/proof-logic-induction-3d.html outputs/complex-mult-3d.html outputs/lines-planes-3d.html
git commit -m "fix(tools): 两页 tips 补上「会自己重播」，两处默认值对齐 step 网格"
```

---

## Task 4: 注册表登记与全量验收

**必须最后做**，依赖 Task 1–3 全部完成。

**Files:**
- Modify: `tools.json`
- Modify（由脚本自动重写）: `app.html`、`index.html`

**Interfaces:**
- Consumes: Task 2 写入 51 个 HTML 的 `<meta name="tool-version">` = `1.1.1`
- Produces: 无

- [ ] **Step 1: 从 HTML 读回版本号，写进 `tools.json`**

以 HTML 的 meta 为准，脚本同步，不手抄：

```bash
python3 - <<'PY'
import json, re, pathlib, collections
d = json.load(open('tools.json', encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
CH = collections.OrderedDict([
    ('date', '2026-08-01'),
    ('zh', '帧级异常兜底：单帧抛出不再杀死渲染循环'),
    ('en', 'Frame-level error containment: one throwing frame no longer kills the render loop')])
changed = []
for t in d['tools']:
    src = pathlib.Path(t['file']).read_text(encoding='utf-8')
    v = re.search(r'<meta name="tool-version" content="([^"]+)">', src).group(1)
    if v == t['version']:
        continue
    e = collections.OrderedDict([('version', v)]); e.update(CH)
    t['version'] = v
    t['changelog'].insert(0, e)
    changed.append((t['id'], v))
with open('tools.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2); f.write('\n')
print(f'更新 {len(changed)} 个条目')
for i, v in changed: print(f'  {i:<46} -> {v}')
PY
```

预期：`更新 51 个条目`。**若不是 51，停下来查是哪个文件漏改了 meta**——阶段 3 的同类脚本预期是 38，本次因为 `frame()` 每个文件都有，所以是全部 51 个（含 `trig-essence-3d-new`）。

- [ ] **Step 2: 同步注册表镜像**

```bash
python3 scripts/sync_registry.py
```
预期两行 `已同步（51 个工具）`。

- [ ] **Step 3: 三处版本号一致性校验**

```bash
python3 - <<'PY'
import json, re, pathlib
d = json.load(open('tools.json', encoding='utf-8'))
bad = []
for t in d['tools']:
    src = pathlib.Path(t['file']).read_text(encoding='utf-8')
    meta = re.search(r'<meta name="tool-version" content="([^"]+)">', src).group(1)
    m = re.search(r'版本记录（(?:changelog，)?新→旧）：\s*\n\s*([0-9.]+)', src)
    head = m.group(1) if m else '(缺)'
    if not (meta == t['version'] == head): bad.append((t['id'], meta, t['version'], head))
print('全部一致' if not bad else bad)
PY
```
预期：`全部一致`。**注意本次连 `trig-essence-3d-new` 也要一致**（阶段 3 的同类校验把它排除在外，因为当时没改它）。

- [ ] **Step 4: 语法门禁与注册表校验**

```bash
fail=0
for f in outputs/*.html app.html index.html; do
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "$f" | node --check /dev/stdin || { echo "FAIL $f"; fail=1; }
done
[ $fail -eq 0 ] && echo "全部通过"
python3 scripts/sync_registry.py --check
python3 scripts/port_drive_engine.py --check
```
三项都要通过；`port_drive_engine.py --check` 必须报告改动 0（幂等）。

- [ ] **Step 5: 全量审计不得回归**

起服务器，用 `scripts/audit-scenes.html` 跑全部 51 工具 188 页签。

对照阶段 3 的收尾基线：**静止未声明 0 / 驱动异常 0 / 需人工 16**。本阶段不碰 `drive` 声明也不碰 `params`，三桶计数**不得变化**；任何一桶变了都是回归，停下来查。

审计页自带的已知答案自检也要仍然 15 PASS / 0 FAIL。

- [ ] **Step 6: 抽样人工验收**

挑三个代表，用真实无头 Chromium 肉眼确认正常路径一切照旧：

- `weierstrass-essence-3d`「弦·半角」页：角 x 自扫、弦与半角同步——这是用户最初报告的场景，确认加固没有破坏它
- `cartesian-polar-coordinate-3d`：全仓唯一 `paramRefs` 结构，确认 `frame()` 变体 B 替换正确
- `trig-essence-3d-new`：唯一 `pre-declarative`，确认 `frame()` 变体 C 替换正确、且它本来就没有 `SCENES` 也不受影响

- [ ] **Step 7: 提交**

```bash
git add tools.json app.html index.html
git commit -m "feat(registry): 阶段 4 的 51 个工具版本登记与镜像同步"
```

---

## Self-Review 记录

**Spec 覆盖**：§3.1 引擎改动 → Task 2 Step 2–4；§3.2 落地方式（扩展现有脚本、严格字面、幂等、失败即响）→ Task 2 Step 6–8；§3.3 文档（§6/§8 + 文档先行）→ Task 1；§3.4 文案轮 → Task 3 Step 1–3；§3.5 两处 off-grid 默认值 → Task 3 Step 4–5；§4 已知代价 → 写进 Task 2 Step 2 的代码注释；§5 验证（控制组优先）→ Task 2 Step 10–12 与 Task 4 Step 4–6；§6 版本与注册表 → Task 2 Step 13 与 Task 4。无遗漏。

**已知取舍（有意为之）**：
- **整帧一层 `try/catch` 而非分段**：分段多换来的只有「`pushSample()` 抛出时 `draw()` 仍执行」这一种情形，代价是三倍注入点与 51 份文件里更多分歧面。
- **只进控制台、面板不露出**：这是「保住渲染循环」优先于「绝不静默给错内容」的直接后果，代价已写进 spec §4 与代码注释。
- **范围含 `trig-essence-3d-new`**：它在阶段 2/3 被排除是因为没有 `SCENES`，但 `frame()` 的变砖风险与其它 50 个完全相同。
- **`tools.json` 预期 51 条而非阶段 3 的 38 条**：`frame()` 每个文件都有，这个数字对不上就说明有文件被漏掉，是个有用的门禁。
