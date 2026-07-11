# MathViz 工程化改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 MathViz 建立工具注册表 + 全量中英双语切换 + 每工具语义化版本机制，并把新增/升级流程固化进 skill。

**Architecture:** 就地双语对象（`{zh,en}`）+ 引擎级 `t()` 查找函数，运行时切换（按钮 + `?lang=` + localStorage）；`tools.json` 为注册权威源，落地页内嵌同步数据；版本号三处落地（注册表 / HTML meta+头注释 / 面板角标）。

**Tech Stack:** 纯 HTML/CSS/JS 单文件、零依赖、无构建。规范文档：`design-system/math-viz-design-system.md`。设计文档：`docs/superpowers/specs/2026-07-11-mathviz-engineering-design.md`（本计划的上游依据，实施者先通读）。

## Global Constraints

- 单文件、零依赖；file:// 双击可开；无 fetch、无 CDN。
- 眉题 `INTERACTIVE MATH · 交互式数学` 是品牌常量，**永不翻译、永不改动**。
- 负号一律 U+2212（−）；数值默认两位小数；角度取整；`|值|>999` 显示 ±∞ —— 中英一致。
- 曲线取色顺序 rose → violet → emerald → orange；青色=源几何/UI 强调；琥珀=度量注记。
- 数学符号（ω、A、φ、θ、z₁…）不翻译，serif italic（`--font-math`），Canvas 与 HTML 皆然。
- design-system-first：改令牌/机制先改 `math-viz-design-system.md`，再改代码。
- 引擎改动只能通过 starter 落地（starter 是引擎唯一权威源），工具从 starter 同步。
- 每个工具改完必须过语法门：`awk '/<script>/{f=1;next}/<\/script>/{f=0}f' <file> | node --check /dev/stdin`
- 英文文案 sentence case；界面英文不用全大写（眉题除外，它是常量）。
- 提交信息用英文，结尾带 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

## 术语对照表（全计划共用，翻译时照抄）

| 中文 | English | 中文 | English |
|---|---|---|---|
| 参数与视角 | Parameters & Views | 视角 | View |
| 暂停 / 继续 / 重置 | Pause / Resume / Reset | 立体 | 3D |
| 正视 x·y | Front x·y | 侧视 y·t | Side y·t |
| 全景 | Panorama | 网格 | Grid |
| 投影辅助线 | Projection guides | 运动轨迹 | Trail |
| 角速度 | Angular speed | 振幅 | Amplitude |
| 初相位 | Initial phase | 波形展开速度 | Wave unroll speed |
| 基频 | Base frequency | 缠绕频率 | Winding frequency |
| 谐波 | Harmonic | 频谱 | Spectrum |
| 谐波叠加 | Harmonic sum | 旋转向量 | Rotating vectors |
| 频率缠绕 | Frequency winding | 本轮 x·y | Epicycles x·y |
| 方波 y·t | Square wave y·t | 缠绕 x·y | Winding x·y |
| 旋转伸缩 | Rotate & scale | 螺旋展开 | Unrolled helix |
| 反复相乘 | Repeated powers | 输入/乘数/乘积 | Input / Multiplier / Product |
| 模长 / 幅角 | Modulus / Argument | 对数螺旋 | Log spiral |
| 各次幂 | Powers | 角度步进辅助 | Angle-step guides |
| 幅角/投影辅助 | Arg / projection guides | 相位/参考辅助 | Phase / reference guides |
| 螺旋展开速度 | Helix unroll speed | 旋转速度 | Rotation speed |
| 弯折变换 | Bending morph | 坐标换算 | Coordinate conversion |
| 变换进度 | Morph progress | 定义域 | Domain |
| 演示速度 | Demo speed | 斜率 / 截距 | Slope / Intercept |
| 系数 | Coefficient | 花瓣参数 | Petal count |
| 尺寸 / 半径 | Size / Radius | 半通径 | Semi-latus rectum |
| 离心率 | Eccentricity | 极坐标网格 | Polar grid |
| 点的迁移线 | Migration threads | 变换全景（切片） | Morph panorama (slices) |
| r = 1 基准线 | r = 1 reference | 函数曲线 | Function curve |
| 圆锥截面 | Conic section | 焦点与准线 | Focus & directrix |
| 丹德林球 | Dandelin spheres | 截线 | Section curve |
| 切面 | Cutting plane | 切触圆 | Tangent circles |
| 焦半径 \|PF\| | Focal radius \|PF\| | 准线距离 d | Directrix distance d |
| 正弦/余弦/正切/余切曲线 | Sine / Cosine / Tangent / Cotangent curve | 螺旋轨迹 | Helix trail |
| 单位/s | units/s | 第 n 圈 | turn n |
| 正对切面 | Face the plane | 正对切面看焦 | Face plane, see focus |
| 正视 焦点·准线 | Front: focus · directrix | 正视 复平面 | Front: complex plane |
| 侧视 β∠α | Side β∠α | 本面 x·y | Base plane x·y |
| 纵览 全景 | Overview | 角度 α·β | Angles α·β |
| x 投影 / y 投影 | x projection / y projection | r 与 θ | r and θ |

工具标题（`<title>` / `<h1>`）：

| 工具 | en title | en h1 |
|---|---|---|
| trig-essence-3d-new | The Essence of Trigonometry · Unit Circle / Sine / Tangent | The Essence of Trigonometry |
| fourier-essence-3d | The Essence of the Fourier Transform | The Essence of the Fourier Transform |
| complex-mult-3d | The Essence of Complex Multiplication | The Essence of Complex Multiplication |
| cartesian-polar-coordinate-3d | Cartesian × Polar · A Bending Morph | Cartesian × Polar |
| conic-essence-3d | The Essence of Conic Sections · One Definition | The Essence of Conic Sections |

brand / tips / readout 里的整句文案：实施者读原句后按其含义翻译成地道英文（sentence case、术语照上表、数学符号原样保留），不逐字直译。

---

### Task 1: 设计系统文档增补（design-system-first）

**Files:**
- Modify: `design-system/math-viz-design-system.md`（§7 修订；新增 §9、§10；§8 清单追加）

**Interfaces:**
- Produces: §9 定义的 `t()` / `TOOL` / `UI` / `setLang` 约定名与语义，后续所有任务遵此实现。

- [ ] **Step 1: 修订 §7 文案规范**

原文 `界面语言为中文；…` 一句所在段改为：

```markdown
界面语言为中英双语（见 §9）；默认按「URL 参数 → localStorage → 浏览器语言」解析，右上角可切换。数学符号（ω、A、φ、θ、T、sin…）不翻译，保持原样并交给 math 字体。负号一律 U+2212（−），数值默认两位小数，角度取整，`|值|>999` 显示 `±∞`——中英一致。英文文案用 sentence case，不用 Title Case 与全大写（品牌眉题除外）；语句简洁地道，不逐字直译中文。品牌眉题 `INTERACTIVE MATH · 交互式数学` 是常量，不参与切换。
```

- [ ] **Step 2: 在 §8 之后新增 §9 双语规范**

```markdown
## 9. 双语规范（i18n）

**就地双语对象，不设集中词典。** 一切面向人的文案在声明处写成 `{ zh: '运动轨迹', en: 'Trail' }`；引擎提供

    function t(s){ return (s && typeof s === 'object') ? (s[LANG] != null ? s[LANG] : s.zh) : s; }

传对象取当前语言（缺英文回退中文），传字符串原样返回——数学符号与数字天然免翻译。

**覆盖范围**：`PARAMS[].label`、`SCENES` 的 `label / brand / tips`、`views[].label`、`toggles[].label`、`readout()` 中的说明文字、Canvas 内标注（绘制时经 `t()`）、`<title>` 与 `<h1>`（经工具元信息 `TOOL.title / TOOL.h1`）、引擎 UI 常量 `UI`（面板标题、暂停/继续/重置、视角、hint）。眉题不参与。

**语言解析优先级**：`?lang=` → `localStorage('mathviz-lang')` → `navigator.language`（zh* → zh，否则 en）→ 默认 zh。localStorage 不可用时静默降级。

**切换行为**：面板头部 `中 / EN` 按钮（按钮显示目标语言）；切换时 `history.replaceState` 更新 URL、写 localStorage、更新 `<html lang>`、`document.title`，并重打全部 UI 标签（`applyLang()`）；Canvas 下一帧自然跟随。滑杆当前值、开关状态、相机、历史采样一律不受切换影响。落地页工具链接携带当前 `?lang=`。

**fmt 中的单位**：含中文单位的 fmt 写作 `v => fmt(v) + t({ zh: ' 单位/s', en: ' units/s' })`。
```

- [ ] **Step 3: 新增 §10 版本管理**

```markdown
## 10. 版本管理

每个工具独立语义化版本：不兼容大改 major · 新增功能/场景 minor · 修复与文案微调 patch。

**三处落地，注册表为准**：
1. `tools.json`（仓库根）：`version` + 双语 `changelog`（新→旧）。
2. 工具 HTML：`<meta name="tool-version" content="x.y.z">`、`<meta name="engine-version" content="a.b.c">`（复制时 starter 的版本），文件头注释内 changelog 块。
3. 面板头部版本角标 `vx.y.z`（从 meta 读取，运行时填充）。

**强制规则**：对已有工具的任何修改必须 bump 版本，并同步 tools.json 与文件内两处 changelog；这是 §8 验收门槛之一。starter 自身以 `STARTER_VERSION` 管理版本，工具复制时把它记入 `engine-version`。
```

- [ ] **Step 4: §8 新工具清单追加两条**

在 §8 现有自检清单末尾追加：

```markdown
- [ ] 双语：全部文案为 `{zh,en}` 对象并经 `t()`；`?lang=en` 直达、切换按钮、记忆、`<html lang>`/`document.title` 跟随均正常（§9）
- [ ] 版本：meta 两枚 + 头注释 changelog + 面板角标齐备；已登记 `tools.json` 并同步 `index.html` 内嵌 TOOLS 与 README 工具表（§10）
```

- [ ] **Step 5: 提交**

```bash
git add design-system/math-viz-design-system.md
git commit -m "docs(design-system): add i18n (§9) and versioning (§10) specs, amend copy rules"
```

---

### Task 2: starter 引擎接入 i18n 与版本脚手架

**Files:**
- Modify: `design-system/math-viz-starter.html`

**Interfaces:**
- Produces（后续所有工具改造照抄这套结构）：
  - `let LANG` / `resolveLang()` / `t(s)` / `setLang(l)` / `applyLang()` / `RELABEL[]`
  - 编辑点 **⓪ `TOOL`**（`{ id, title:{zh,en}, h1:{zh,en} }`）
  - 引擎常量 `UI`（panelTitle/pause/resume/reset/views/hint）
  - `STARTER_VERSION = '1.0.0'`；meta `tool-version` / `engine-version`
  - 面板头结构：`#panelTitle` + `.ph-right`（`#verBadge` + `#btnLang` + `#btnFold`）

- [ ] **Step 1: head 加版本 meta 与头注释**

`<meta name="color-scheme">` 之后加：

```html
<meta name="tool-version" content="1.0.0">
<meta name="engine-version" content="1.0.0">
```

头部大注释块首行 `起步模板 v1.0` 改为 `起步模板 · STARTER_VERSION 1.0.0`，注释内追加：

```
  版本记录（changelog，新→旧）：
    1.0.0  2026-07-11  引擎接入双语 i18n 与版本机制；此后为受管版本
```

- [ ] **Step 2: CSS 加语言按钮与版本角标样式**

`.fold` 规则前插入：

```css
.ph-right{display:flex;align-items:center;gap:7px}
.ver{font-family:var(--font-mono);font-size:10px;color:rgba(159,176,200,.55)}
.lang{padding:3px 8px;border-radius:8px;border:1px solid var(--panel-line);
  background:rgba(30,41,59,.5);color:var(--ui-slate);font-size:11px;cursor:pointer}
.lang:hover{border-color:rgba(45,212,234,.5);color:#bfefff}
.lang:focus-visible{outline:2px solid rgba(45,212,234,.8);outline-offset:1px}
```

- [ ] **Step 3: 面板头 HTML 改结构**

```html
<div class="panel-head"><span id="panelTitle">参数与视角</span>
  <span class="ph-right"><span class="ver" id="verBadge"></span><button class="lang" id="btnLang" title="切换语言 / Switch language">EN</button><button class="fold" id="btnFold" title="收起 / 展开">−</button></span></div>
```

- [ ] **Step 4: 脚本区顶部加 i18n 核心与编辑点 ⓪**

`'use strict';` 之后、PARAMS 注释块之前插入：

```js
/* ================= i18n 核心（引擎区） ================= */
const LANG_KEY = 'mathviz-lang';
function resolveLang(){
  try{
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'zh' || q === 'en') return q;
    const s = localStorage.getItem(LANG_KEY);
    if (s === 'zh' || s === 'en') return s;
  }catch(e){}
  return (navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
let LANG = resolveLang();
function t(s){ return (s && typeof s === 'object') ? (s[LANG] != null ? s[LANG] : s.zh) : s; }

const STARTER_VERSION = '1.0.0';
const VERSION = document.querySelector('meta[name="tool-version"]').content;

/* ╔══════════════════════════════════════════════════════════╗
   ║  ⓪ 工具元信息 —— id 与双语标题                              ║
   ╚══════════════════════════════════════════════════════════╝ */
const TOOL = {
  id: 'math-viz-starter',
  title: { zh: '数学可视化起步模板 · Math-Viz Starter', en: 'Math-Viz Starter Template' },
  h1:    { zh: '数学可视化 · 起步模板', en: 'Math Viz · Starter' }
};

/* 引擎 UI 文案（一般无需改动） */
const UI = {
  panelTitle: { zh: '参数与视角', en: 'Parameters & Views' },
  pause:  { zh: '⏸ 暂停', en: '⏸ Pause' },
  resume: { zh: '▶ 继续', en: '▶ Resume' },
  reset:  { zh: '↺ 重置', en: '↺ Reset' },
  views:  { zh: '视角', en: 'View' },
  hint:   { zh: '拖拽旋转 · 滚轮 / 双指缩放 · 右键或 Shift 拖拽平移 · 双击回正 · 空格暂停 · 1–9 视角 · T 切换页签',
            en: 'Drag to rotate · Scroll / pinch to zoom · Right-click or Shift-drag to pan · Double-click to reset · Space to pause · 1–9 views · T to switch tabs' }
};
```

- [ ] **Step 5: 示例场景与 PARAMS 全部改双语对象**

PARAMS 四条 label 改为（含 fmt 单位）：

```js
{ key: 'omega',     label: { zh: '角速度 <i>ω</i>', en: 'Angular speed <i>ω</i>' }, min: 0.2, max: 4,   step: 0.05, value: 1,   fmt: v => fmt(v) + ' rad/s' },
{ key: 'amp',       label: { zh: '振幅 <i>A</i>',   en: 'Amplitude <i>A</i>' },     min: 0.2, max: 1.5, step: 0.05, value: 1,   fmt: v => fmt(v) },
{ key: 'phi',       label: { zh: '初相位 <i>φ</i>', en: 'Initial phase <i>φ</i>' }, min: 0,   max: 2,   step: 0.05, value: 0,   fmt: v => fmt(v) + ' π', map: v => v * Math.PI },
{ key: 'waveSpeed', label: { zh: '波形展开速度',     en: 'Wave unroll speed' },      min: 0.5, max: 2.5, step: 0.05, value: 1.2, fmt: v => fmt(v) + t({ zh: ' 单位/s', en: ' units/s' }) }
```

两个示例场景（lissa/blank）的 `label / brand / tips / views[].label / toggles[].label` 全部改 `{zh,en}`（brand/tips 英文按含义翻译）；`draw` 里两处 `label3` 的公式文本是纯数学符号，不动；blank 场景 `draw` 里的中文占位标注 `'在 draw(C) 中绘制场景内容'` 改为 `t({ zh: '在 draw(C) 中绘制场景内容', en: 'Draw your scene in draw(C)' })`；`drawPeriodBracket` 调用中的 `'T = … s'` 为符号+数字，不动。

- [ ] **Step 6: readoutHead 双语化**

```js
function readoutHead() {
  const th = state.theta;
  const deg = (mod2pi(th) * 180 / Math.PI).toFixed(0);
  const lap = fmt(th / TAU);
  return '<div>t = <b>' + fmt(state.t) + '</b> s&ensp;·&ensp;θ = ωt = <b>' + fmt(th) + '</b> rad</div>' +
         '<div class="dim">' + t({ zh: '≡ ' + deg + '°（第 ' + lap + ' 圈）', en: '≡ ' + deg + '° (turn ' + lap + ')' }) + '</div>';
}
```

各场景 `readout()` 内其余中文说明文字同法用 `t({zh,en})` 包裹（lissa 的 `'频率比 3 : 2…'` 一行：`t({ zh: '频率比 3 : 2', en: 'frequency ratio 3 : 2' })` + 符号部分不动）。

- [ ] **Step 7: build 函数注册 relabel 回调**

全局加 `const RELABEL = [];`（放 `let curTab = null;` 附近）。四个 build 函数改造：

```js
function buildParams() {
  const host = document.getElementById('paramsHost');
  PARAMS.forEach(p => {
    const wrap = document.createElement('div');
    wrap.className = 'ctl';
    wrap.innerHTML = '<div class="top"><label></label><span class="val"></span></div>';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = p.min; input.max = p.max; input.step = p.step; input.value = p.value;
    const val = wrap.querySelector('.val');
    const upd = () => {
      const raw = parseFloat(input.value);
      state[p.key] = p.map ? p.map(raw) : raw;
      val.textContent = p.fmt(raw);
    };
    input.addEventListener('input', upd);
    wrap.appendChild(input);
    host.appendChild(wrap);
    const relabel = () => { wrap.querySelector('label').innerHTML = t(p.label); upd(); };
    RELABEL.push(relabel);
    relabel();
  });
}
```

buildToggles 中开关行改为：

```js
lab.innerHTML = '<input type="checkbox" data-key="' + tg.key + '"' + (state[tg.key] ? ' checked' : '') + '>' +
  '<i class="dot" style="--c:' + tg.color + '"></i><span class="tgl"></span>';
const relabel = () => { lab.querySelector('.tgl').innerHTML = t(tg.label); };
RELABEL.push(relabel);
relabel();
```

buildViews：`lab.textContent = '视角'` 改为 relabel 回调 `lab.textContent = t(UI.views)`；每个视角按钮 `b.textContent = SCENES[id].views[name].label` 改为回调 `b.textContent = t(SCENES[id].views[name].label)`；同样 push + 立即执行。buildTabs 同法：`b.textContent = t(SCENES[id].label)`。

- [ ] **Step 8: switchTab / togglePlay 过 t()，新增 applyLang/setLang 与按钮**

`switchTab` 中 `brandDesc.textContent = SCENES[id].brand` → `t(SCENES[id].brand)`；tips 同。`togglePlay` 中 `btnPlay.textContent = state.running ? t(UI.pause) : t(UI.resume);`。播放/折叠代码块之后加：

```js
/* ================= 语言切换 ================= */
function applyLang() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.title = t(TOOL.title);
  document.querySelector('.brand h1').textContent = t(TOOL.h1);
  document.getElementById('panelTitle').textContent = t(UI.panelTitle);
  document.querySelector('.hint').textContent = t(UI.hint);
  document.getElementById('btnLang').textContent = LANG === 'zh' ? 'EN' : '中';
  btnPlay.textContent = state.running ? t(UI.pause) : t(UI.resume);
  document.getElementById('btnReset').textContent = t(UI.reset);
  RELABEL.forEach(f => f());
  brandDesc.textContent = t(SCENES[curTab].brand);
  tipsEl.textContent = t(SCENES[curTab].tips);
  updateReadout();
}
function setLang(l) {
  LANG = l;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  try {
    const u = new URL(location.href);
    u.searchParams.set('lang', l);
    history.replaceState(null, '', u);
  } catch (e) {}
  applyLang();
}
document.getElementById('btnLang').addEventListener('click', () => setLang(LANG === 'zh' ? 'en' : 'zh'));
document.getElementById('verBadge').textContent = 'v' + VERSION;
```

启动区 `switchTab(Object.keys(SCENES)[0]);` 之后加一行 `applyLang();`。

- [ ] **Step 9: 语法检查**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' design-system/math-viz-starter.html | node --check /dev/stdin
```
Expected: 无输出（通过）。

- [ ] **Step 10: 浏览器验证**

`python3 -m http.server 8123`（后台）或用 `/run`。打开 `http://localhost:8123/design-system/math-viz-starter.html` 逐项确认：默认中文；点 EN → 全部 UI（页签/滑杆/开关/视角/tips/readout/hint/标题）变英文、按钮变「中」、URL 带 `?lang=en`、`document.title` 变英文；刷新保持英文（localStorage）；`?lang=zh` 覆盖记忆；切换时滑杆值/开关状态/相机不跳；暂停后切语言按钮文本仍为 Resume 态；面板角标显示 v1.0.0。用 file:// 直开再验一次（localStorage 可能不可用，需不报错、正常切换）。

- [ ] **Step 11: 提交**

```bash
git add design-system/math-viz-starter.html
git commit -m "feat(starter): bilingual i18n runtime, version meta and badge (STARTER_VERSION 1.0.0)"
```

---

### Task 3: 改造 complex-mult-3d（声明式改造样板）

**Files:**
- Modify: `outputs/complex-mult-3d.html`

**Interfaces:**
- Consumes: Task 2 的引擎 i18n 结构（照 starter 同步）。
- Produces: 声明式工具改造的操作序列，Task 4–6 复用同一序列。

- [ ] **Step 1: 同步引擎 i18n 结构**

对照改造后的 starter，把以下六件事在本文件中逐一落地（本工具引擎源自同一 starter，函数位置一致）：
1. head 加 `<meta name="tool-version" content="1.1.0">` 与 `<meta name="engine-version" content="1.0.0">`；头注释加 changelog 块：
   ```
   版本记录（新→旧）：
     1.1.0  2026-07-11  全量双语支持（中/EN 切换）
     1.0.0  2026-07-11  首个版本
   ```
2. CSS 加 `.ph-right / .ver / .lang` 三条规则（照抄 Task 2 Step 2）。
3. 面板头 HTML 换成 Task 2 Step 3 的结构。
4. 脚本顶部插入 i18n 核心块 + `TOOL`（id `complex-mult-3d`，title/h1 用总表中的英文）+ `UI` 常量（照抄 Task 2 Step 4，`STARTER_VERSION` 行不要）。
5. 四个 build 函数、switchTab、togglePlay 按 Task 2 Step 7–8 改造；加 `applyLang/setLang`、按钮监听、`verBadge` 填充、启动处 `applyLang()`。
6. `readoutHead` 按 Task 2 Step 6 双语化。

- [ ] **Step 2: 声明区全部文案改双语对象**

PARAMS 5 条、SCENES 3 个场景（旋转伸缩/螺旋展开/反复相乘）的 `label / brand / tips / views[].label / toggles[].label`、各 `readout()` 中的中文说明，全部改 `{zh,en}`。标签词照术语对照表；brand/tips 整句按含义译。fmt 中 `' 单位/s'` → `t({zh:' 单位/s', en:' units/s'})`。

- [ ] **Step 3: Canvas 标注过 t()**

grep 本文件全部 `label3(` 调用：纯数学符号/数字者不动；含中文者把文本参数改为 `t({zh:'…', en:'…'})`。场景级辅助函数里的中文标注同理。

- [ ] **Step 4: 语法检查**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' outputs/complex-mult-3d.html | node --check /dev/stdin
```
Expected: 通过。

- [ ] **Step 5: 浏览器验证**

按 Task 2 Step 10 的清单逐项过一遍（三个页签都切到英文看 Canvas 标注、readout、tips）；另确认：切语言不清空历史螺旋（samples 不受影响）；双击回正、1–9 视角、暂停语义全部不回归；六处一色不破。

- [ ] **Step 6: 提交**

```bash
git add outputs/complex-mult-3d.html
git commit -m "feat(complex-mult-3d): full bilingual support, version 1.1.0"
```

---

### Task 4: 改造 fourier-essence-3d

**Files:**
- Modify: `outputs/fourier-essence-3d.html`

**Interfaces:** Consumes Task 3 的操作序列。

- [ ] **Step 1: 照 Task 3 Step 1 同步引擎 i18n**（`tool-version` 1.1.0、`engine-version` 1.0.0、changelog 同格式、TOOL id `fourier-essence-3d`、title/h1 用总表英文）
- [ ] **Step 2: 声明区双语化** — PARAMS 4 条、SCENES 3 场景（谐波叠加/旋转向量/频率缠绕），`fmt` 中 `' × f₀'` 为符号不译；`频谱 <i>|X(f)|</i>` → `Spectrum <i>|X(f)|</i>`
- [ ] **Step 3: Canvas 标注过 t()** — 该工具场景级 helper 较多（自绘频谱轴等），grep `label3(` 逐处判断
- [ ] **Step 4: 语法检查**（同 Task 3 Step 4，换文件名）Expected: 通过
- [ ] **Step 5: 浏览器验证**（同 Task 3 Step 5 清单；特别看频谱视角 `spec` 的 onSelect 联动不回归）
- [ ] **Step 6: 提交** `git commit -m "feat(fourier-essence-3d): full bilingual support, version 1.1.0"`

---

### Task 5: 改造 cartesian-polar-coordinate-3d（首次登记，1.0.0）

**Files:**
- Modify: `outputs/cartesian-polar-coordinate-3d.html`

**Interfaces:** Consumes Task 3 的操作序列。

- [ ] **Step 1: 先过一遍现状** — 该文件未提交过，先跑语法检查确认基线健康，再开始改造
- [ ] **Step 2: 照 Task 3 Step 1 同步引擎 i18n** — `tool-version` **1.0.0**（首次发布即含双语），changelog 只一条 `1.0.0 2026-07-11 首个版本（含双语）`；TOOL id `cartesian-polar-coordinate-3d`
- [ ] **Step 3: 声明区双语化** — 注意它的 PARAMS 是「按曲线族分组」的结构（p1/p2 嵌套在曲线定义里），label 双语化方式相同；曲线族名称（直线/螺线/玫瑰线/心脏线/圆/圆锥曲线等，grep `name:` 或对应字段确认）一并 `{zh,en}`
- [ ] **Step 4: Canvas 标注过 t()**
- [ ] **Step 5: 语法检查** Expected: 通过
- [ ] **Step 6: 浏览器验证**（同 Task 3 Step 5 清单；特别验证 morphK 变换动画中途切语言不打断动画）
- [ ] **Step 7: 提交** `git commit -m "feat(cartesian-polar-3d): first release with full bilingual support, version 1.0.0"`

---

### Task 6: 改造 conic-essence-3d（首次登记，1.0.0）

**Files:**
- Modify: `outputs/conic-essence-3d.html`

**Interfaces:** Consumes Task 3 的操作序列。

- [ ] **Step 0: 确认文件已定稿** — 该文件由并行会话产出。先 `git status` + `ls -la outputs/conic-essence-3d.html` 看 mtime 是否还在变、跑语法检查；若仍在被编辑则先做 Task 7–9，最后回来
- [ ] **Step 1: 照 Task 3 Step 1 同步引擎 i18n** — `tool-version` **1.0.0**，changelog 一条；TOOL id `conic-essence-3d`
- [ ] **Step 2: 声明区双语化** — 3 场景（圆锥截面/焦点与准线/丹德林球）；注意 views 里带 onSelect 的具名视角（正对切面/正对切面看焦）用总表译法
- [ ] **Step 3: Canvas 标注过 t()** —（α、β、|PF|、d 等符号不译；"离心率 e" 之类混合文案拆开：符号留原样）
- [ ] **Step 4: 语法检查** Expected: 通过
- [ ] **Step 5: 浏览器验证**（同 Task 3 Step 5 清单）
- [ ] **Step 6: 提交** `git commit -m "feat(conic-essence-3d): first release with full bilingual support, version 1.0.0"`

---

### Task 7: 改造 trig-essence-3d-new（非声明式，特殊处理）

**Files:**
- Modify: `outputs/trig-essence-3d-new.html`

**Interfaces:** Consumes Task 2 的 `t()/resolveLang/setLang` 核心（可照搬）；本工具**没有** PARAMS/SCENES 声明层，面板是手写静态 HTML（滑杆 id vOmega…、开关 id cSin…、静态 `<span class="vlabel">`）。

- [ ] **Step 1: head 与头注释** — 同 Task 3 Step 1 第 1 点：`tool-version` 1.1.0、`engine-version` 留空值 `pre-declarative`（它不源自受管 starter），changelog 两条
- [ ] **Step 2: 静态面板打 data-i18n 标记** — 给每个含中文的静态节点（滑杆 label、开关文本、vlabel、页签按钮、面板标题、暂停/重置按钮、hint、h1、brand p、tips）补 `data-i18n="<key>"` 属性；脚本顶部建页面级词典：

```js
const STR = {
  omega: { zh: '角速度 <i>ω</i>', en: 'Angular speed <i>ω</i>' },
  /* …每个 key 一条，中文取自现有文本，英文照术语对照表… */
};
```

- [ ] **Step 3: 接入 i18n 核心与切换** — 插入 Task 2 Step 4 的 `resolveLang/t/LANG_KEY`、面板头加 `.ph-right`（版本角标 + 语言按钮，CSS 三条规则照抄）；`applyLang()` 实现为：

```js
function applyLang() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.title = t(TOOL.title);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const s = STR[el.dataset.i18n];
    if (s) el.innerHTML = t(s);
  });
  /* 开关文本节点在 label 内、input 之后：data-i18n 打在包裹的 span 上（Step 2 时把裸文本包进 <span>） */
}
```

注意：开关 `<label class="tg">` 里的裸文本先包成 `<span data-i18n="…">`，避免 innerHTML 重建毁掉 input 监听。暂停/继续按钮在其 toggle 函数里用 `t(STR.pause)/t(STR.resume)`。

- [ ] **Step 4: Canvas 标注过 t()** — grep `label3(`，含中文者改 `t({zh,en})`（该文件有 `'正切 = 斜率'` 一类标注）；readout 生成处同理
- [ ] **Step 5: 语法检查** Expected: 通过
- [ ] **Step 6: 浏览器验证** — 同 Task 2 Step 10 清单；重点回归：它的开关/滑杆是手写监听，确认切语言后监听仍在（点开关仍生效）
- [ ] **Step 7: 提交** `git commit -m "feat(trig-essence-3d-new): full bilingual support, version 1.1.0"`

---

### Task 8: tools.json 注册表 + 落地页重构 + README

**Files:**
- Create: `tools.json`
- Modify: `index.html`、`README.md`

**Interfaces:**
- Consumes: Task 3–7 定稿的版本号与双语标题。
- Produces: `tools.json` 的 schema（Task 9 的 skill 文案引用它）；index.html 内嵌 `TOOLS` 数组与 `L` 词典。

- [ ] **Step 1: 写 tools.json**

五个工具各一条，schema 与设计文档一致。完整骨架（desc/tag 的 zh 取自现落地页卡片文案，en 按含义译；trig-new 沿用现卡片的 emerald，fourier violet，complex orange，cartesian-polar 用 cyan，conic 用 rose）：

```json
{
  "schemaVersion": 1,
  "tools": [
    {
      "id": "trig-essence-3d-new",
      "file": "outputs/trig-essence-3d-new.html",
      "accent": "emerald",
      "kicker": { "zh": "三角函数", "en": "Trigonometry" },
      "title": { "zh": "单位圆 · 正弦 · 正切", "en": "Unit Circle · Sine · Tangent" },
      "desc": { "zh": "圆、正弦、正切是同一个运动的三种测量。切换视角，看它们如何互为投影。", "en": "Circle, sine and tangent are three measurements of one motion. Switch views to see each as a projection of the others." },
      "tag": { "zh": "圆 · sin · tan", "en": "circle · sin · tan" },
      "version": "1.1.0",
      "engine": "pre-declarative",
      "changelog": [
        { "version": "1.1.0", "date": "2026-07-11", "zh": "全量双语支持", "en": "Full bilingual support" },
        { "version": "1.0.0", "date": "2026-07-11", "zh": "首个版本", "en": "Initial release" }
      ]
    }
  ]
}
```

（其余四条同构：fourier-essence-3d v1.1.0 / complex-mult-3d v1.1.0 / cartesian-polar-coordinate-3d v1.0.0 / conic-essence-3d v1.0.0，engine 均为 "1.0.0"，kicker/title/desc 参考现落地页与各工具 h1，conic 的 kicker `{ "zh": "圆锥曲线", "en": "Conic Sections" }`。）

`python3 -c "import json;json.load(open('tools.json'))"` 校验。Expected: 无输出。

- [ ] **Step 2: index.html 重构为数据驱动 + 双语**

脚本区顶部加与 tools.json **逐字段一致**的 `const TOOLS = [...]`（含 version，不含 changelog——落地页不展示历史），加 `resolveLang/t/LANG_KEY`（照 Task 2 Step 4）与页面词典：

```js
const L = {
  title: { zh: '数学可视化 · MathViz', en: 'MathViz · Interactive Math Visualizations' },
  h1: { zh: '数学可视化', en: 'MathViz' },
  lead: { zh: '把抽象的数学概念变成能旋转、能拖动的三维场景。同一个数学对象，换个角度就是另一条曲线——转到对的视角，关系会突然显形。',
          en: 'Abstract math turned into rotatable, draggable 3D scenes. The same object viewed from a different angle becomes a different curve — find the right view and the relationship suddenly appears.' },
  hintline: { zh: '点开即在浏览器中运行，无需安装 · 拖拽旋转 · 滚轮缩放 · 双击回正', en: 'Runs in the browser, nothing to install · Drag to rotate · Scroll to zoom · Double-click to reset' },
  sectTools: { zh: 'Tools · 工具集', en: 'Tools' },
  available: { zh: ' 个可用', en: ' available' },
  open: { zh: '打开', en: 'Open' },
  soonKicker: { zh: 'Soon · 敬请期待', en: 'Coming soon' },
  soonTitle: { zh: '更多工具', en: 'More tools' },
  soonDesc: { zh: '这是一个持续生长的合集，新的可视化会陆续加入。', en: 'A growing collection — new visualizations land here over time.' },
  footLeft: { zh: '开源 · 单文件 · 零依赖 · 可离线', en: 'Open source · Single file · Zero dependencies · Works offline' }
};
```

卡片渲染函数（替换现静态 `.grid` 内容为空容器 `<div class="grid" id="grid"></div>`，静态文案节点打上 id）：

```js
function render() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.title = t(L.title);
  document.getElementById('h1').textContent = t(L.h1);
  document.getElementById('lead').textContent = t(L.lead);
  document.getElementById('hintline').textContent = t(L.hintline);
  document.getElementById('sectTools').textContent = t(L.sectTools);
  document.getElementById('count').textContent = TOOLS.length + t(L.available);
  document.getElementById('footLeft').textContent = t(L.footLeft);
  document.getElementById('btnLang').textContent = LANG === 'zh' ? 'EN' : '中';
  document.getElementById('grid').innerHTML = TOOLS.map(d =>
    '<a class="card" style="--c:var(--trace-' + d.accent + ')" href="' + d.file + '?lang=' + LANG + '">' +
      '<div class="k"><span class="dot"></span><span class="kicker">' + (LANG === 'zh' ? d.kicker.zh + ' · ' + d.kicker.en : d.kicker.en) + '</span></div>' +
      '<h2>' + t(d.title) + '</h2><p>' + t(d.desc) + '</p>' +
      '<div class="foot"><span class="tag">' + t(d.tag) + '</span><span class="open">' + t(L.open) + '<span class="arw">→</span></span></div>' +
    '</a>').join('') +
    '<div class="card ghost"><div class="k"><span class="dot"></span><span class="kicker">' + t(L.soonKicker) + '</span></div>' +
    '<h2>' + t(L.soonTitle) + '</h2><p>' + t(L.soonDesc) + '</p>' +
    '<div class="foot"><span class="tag">building…</span></div></div>';
}
function setLang(l) {
  LANG = l;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  try { const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u); } catch (e) {}
  render();
}
```

语言按钮放眉题行右侧（`.eyebrow` 行改为 flex，按钮样式复用 `.lang` 三条 CSS）。眉题文本本身不译。启动时调 `render()`。背景荧光屏脚本不动。

- [ ] **Step 3: README 更新**

工具表加 conic 与 cartesian-polar 两行、移除 trig-essence-3d 行（表下加一行斜体：*The original hand-written `trig-essence-3d` has been archived to `archive/`.*）；「Building a new tool」节加两段：注册表（tools.json 是登记权威源，每工具 semver + changelog）、双语（所有工具支持 中/EN 切换，`?lang=en` 直达）。

- [ ] **Step 4: 浏览器验证**

落地页两种语言下：卡片全渲染、计数正确、点卡片带 `?lang=`、进入工具后语言一致；file:// 直开正常。

- [ ] **Step 5: 提交**

```bash
git add tools.json index.html README.md
git commit -m "feat: tools.json registry, data-driven bilingual landing page, README refresh"
```

---

### Task 9: skill 增补 + 老工具归档

**Files:**
- Modify: `.claude/skills/math-viz-tool/SKILL.md`、`CLAUDE.md`
- Move: `outputs/trig-essence-3d.html` → `archive/trig-essence-3d.html`

**Interfaces:** Consumes Task 8 的 tools.json schema。

- [ ] **Step 1: 归档**

```bash
mkdir -p archive && git mv outputs/trig-essence-3d.html archive/trig-essence-3d.html
```

- [ ] **Step 2: SKILL.md 增补**

frontmatter description 末尾加触发词句：`Also use it when the developer wants to improve, adjust, upgrade, or 改进/调整/升级 an existing tool in outputs/ — version bump and changelog rules apply.`

Step 2 清单中「Copy starter」处追加一句：填写 ⓪ `TOOL`（id 与双语标题）；所有文案写成 `{zh,en}` 对象（§9）。

Step 3 验证清单追加：双语与版本验收（§8 新增两条）。

新增 **Step 4 — Register & publish**（放在 Step 3 之后）：

```markdown
## Step 4 — Register & publish (a tool is not "done" until it is registered)

1. Add an entry to `tools.json`: id / file / accent (design-system trace color) / bilingual
   kicker · title · desc · tag / `version: "1.0.0"` / `engine` (the starter's STARTER_VERSION
   you copied) / one changelog entry. Validate: `python3 -c "import json;json.load(open('tools.json'))"`.
2. Mirror the same entry into the `TOOLS` array embedded in `index.html` (field-for-field; no
   changelog there). The landing page renders from it.
3. Add a row to the README tools table.
4. Re-run the §8 self-check (now includes i18n + versioning gates), then commit the tool,
   registry, landing page and README together.

## Upgrading an existing tool

Any change to a shipped tool MUST: bump the semver in three places — `tools.json`, the
`tool-version` meta + header changelog block in the HTML, nothing else displays it (the badge
reads the meta) — and add a bilingual changelog entry to both `tools.json` and the header block.
major = breaking rework · minor = new feature/scene · patch = fix or copy tweak.
```

- [ ] **Step 3: CLAUDE.md 同步**

「What this repo is」加一句 tools.json 注册表与 archive/ 说明；Conventions 加两条：双语 `{zh,en}` + `t()`（§9）、版本三处落地（§10）；删去「trig-essence-3d 是原始工具」一段，改为指向 archive/ 并注明 trig-essence-3d-new 为非声明式遗留（其面板为手写 HTML，用 data-i18n 方案）。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: archive legacy trig tool; codify register/upgrade workflow in skill and CLAUDE.md"
```

---

### Task 10: 全量验收

**Files:** 无新改动（发现问题则回对应任务修）。

- [ ] **Step 1: 语法门全绿**

```bash
for f in outputs/*.html design-system/math-viz-starter.html; do
  echo "== $f"; awk '/<script>/{f=1;next}/<\/script>/{f=0}f' "$f" | node --check /dev/stdin && echo OK; done
```
Expected: 每个文件 OK。

- [ ] **Step 2: 浏览器全量走查** — 五个工具 + 落地页，各在 zh/en 两种语言下：切换、记忆、URL 直达、Canvas 标注、readout、六处一色、暂停/回正/视角键、移动端断点（拉窄到 ≤760px 看面板变抽屉、语言按钮仍可点）。
- [ ] **Step 3: 版本一致性核对** — 逐工具比对 tools.json / meta / 角标三处版本号一致；`grep -o 'tool-version" content="[^"]*"' outputs/*.html` 对照 tools.json。
- [ ] **Step 4: file:// 抽查** — 双击打开落地页与任一工具，无控制台报错、切换可用。
- [ ] **Step 5: 收尾提交与汇报** — 若有修正则按任务归属提交；向开发者汇报每个工具的版本与试玩链接（含 `?lang=en` 示例）。
