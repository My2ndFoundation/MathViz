# 画布动画录制为视频 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `app.html` 外壳里加一套录制器，把当前工具的画布动画导出为可分享的视频文件（能出 mp4 就出 mp4），`outputs/` 下 50 个工具一行不改。

**Architecture:** 全部内联进 `app.html`，划为 5 个互不穿透的单元挂在全局 `REC` 命名空间下：`Bridge`（唯一的跨 iframe 耦合面，靠 `contentWindow.eval` 穿透工具的 script-scope 顶层 `const`）、`Encoder`（`MediaRecorder` 封装 + mime 探测）、`Compositor`（画幅与叠层）、`Source`（离线定长 / 实时两种产帧驱动）、`UI`（面板与下载）。Task 1 一次性钉死全部接口签名与锚点区，Task 2–6 因此可以完全并行开发。

**Tech Stack:** 原生 Canvas 2D、`canvas.captureStream()`、`MediaRecorder`、`getDisplayMedia`。**零外部库**。

设计依据：[docs/superpowers/specs/2026-07-31-canvas-video-recording-design.md](../specs/2026-07-31-canvas-video-recording-design.md)

## Global Constraints

- **不修改 `outputs/` 下任何文件、不改 `tools.json`、不做 version bump。** 本计划只动 `app.html`、新增 `.claude/launch.json`。收尾时 `git diff --name-only main` 必须只有这两个文件 + 本计划文档。
- **零外部依赖**：不引入 ffmpeg.wasm / mp4-muxer / gif.js / 任何 npm 包或 CDN。
- **代码风格必须与 `app.html` 现有代码一致**：文件顶部是 `'use strict'`，全篇用 `var` + `function` 声明，**不用 `const` / `let` / 箭头函数 / 模板字符串 / `class`**。注释用中文。照抄周围代码的写法。
- **禁止触碰 `/* >>> GENERATED:TOOLS */ … /* <<< GENERATED:TOOLS */` 标记块**（`app.html:168` 起）。`.githooks/pre-commit` 会在提交 `app.html` 时运行 `scripts/sync_registry.py` 自动重写该块；改动它会被覆盖或让钩子报错。
- **文本规范**（沿用设计系统）：负号用 U+2212（−），数值默认 2 位小数，角度取整。叠层里的数学符号用衬线斜体（`Georgia, 'Songti SC', serif`）。
- **曲线色序固定**：rose `#ff5a8a` → violet `#a68bff` → emerald `#37d9a0` → orange `#ffa653`。
- **所有面向用户的文案必须双语**，形如 `{ zh: '…', en: '…' }`，经外壳现有的 `LANG` 变量取值（`app.html:904` 的 i18n 段）。
- **语法门禁**（每个任务提交前必须跑，且必须通过）：
  ```bash
  awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
  ```

## 单元测试约定（本仓库没有测试框架，这是替代方案）

每个单元自带一个 `__test()` 方法，返回 `{ pass: [名称…], fail: [名称 + 原因…] }`，纯浏览器内断言、零依赖。`REC.selftest()` 汇总全部单元。跑法：起本地服务器后用浏览器执行 `REC.selftest()` 并读回 JSON。**这就是本计划的 red/green 循环**：先写 `__test()` 让它 fail，再实现让它 pass。

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `app.html` | 外壳 + 全部录制器代码（单文件、零依赖） | 修改 |
| `.claude/launch.json` | 本地静态服务器配置（模式 1/2 依赖同源，`file://` 下不可用） | 新建 |

`app.html` 内的锚点区（Task 1 建立，Task 2–6 各填一个，**互不重叠**）：

```
/* ===== REC:BRIDGE ===== */      … /* ===== /REC:BRIDGE ===== */
/* ===== REC:ENCODER ===== */     … /* ===== /REC:ENCODER ===== */
/* ===== REC:COMPOSITOR ===== */  … /* ===== /REC:COMPOSITOR ===== */
/* ===== REC:SOURCE ===== */      … /* ===== /REC:SOURCE ===== */
/* ===== REC:UI ===== */          … /* ===== /REC:UI ===== */
```

---

## Task 1: 骨架、接口契约与本地服务器

奠基任务，**必须先单独完成并合并**，Task 2–6 全部依赖它钉死的签名。

**Files:**
- Modify: `app.html`（在 `/* ================= 启动 ================= */`（`app.html:1118`）**之前**插入整个 `REC` 段；DOM 插到 `<main class="stage">` 内 `</main>` 之前，`app.html:162`；CSS 插到 `</style>` 前，`app.html:134`）
- Create: `.claude/launch.json`

**Interfaces:**
- Consumes: 外壳现有的 `frame`（iframe 元素）、`curId`、`LANG`、`byId(id)`
- Produces: 下列全部，Task 2–6 只许实现、不许改签名

```js
/* 配置（UI 读写，Compositor / Source 只读） */
REC.CFG = {
  visual: 'overlay',   /* 'clean' | 'overlay' | 'screen' */
  aspect: '16:9',      /* '16:9' | '9:16' | '1:1' */
  drive:  'offline',   /* 'offline' | 'realtime' */
  duration: 8,         /* 秒，3..30 */
  loop: true,          /* 无缝循环：时长吸附到动画周期整数倍 */
  orbit: false,        /* 自动环绕：整段视频 cam.az 转满 2π */
  viewTo: ''           /* '' = 不做视角过渡；否则为 SCENES[curTab].views 的 key */
};
REC.SIZES = { '16:9': [1920,1080], '9:16': [1080,1920], '1:1': [1080,1080] };
REC.FPS = 60;
REC.COLORS = ['#ff5a8a','#a68bff','#37d9a0','#ffa653'];

/* Task 2 */
REC.Bridge.available()      -> boolean
REC.Bridge.get()            -> handle | null
REC.Bridge.invalidate()     -> undefined
REC.Bridge.snapshot()       -> snap | null
REC.Bridge.restore(snap)    -> undefined
REC.Bridge.__test()         -> {pass:[],fail:[]}
/* handle = { win, doc, canvas, state, cam, SCENES, curTab, samples,
              draw, resize, pushSample, applyView, toolId } */
/* curTab 是字符串快照；applyView(key) 是函数 */

/* Task 3 */
REC.Encoder.pickMime()               -> {mime:String, ext:String} | null
REC.Encoder.start(stream, mime)      -> session
REC.Encoder.stop(session)            -> Promise<Blob>
REC.Encoder.download(blob, filename) -> undefined
REC.Encoder.__test()                 -> {pass:[],fail:[]}

/* Task 4 */
REC.Compositor.begin(handle, cfg)    -> ctxObj | null
REC.Compositor.frame(ctxObj, handle, info) -> undefined
REC.Compositor.end(ctxObj)           -> undefined
REC.Compositor.__test()              -> {pass:[],fail:[]}
/* ctxObj = { w, h, canvas, mode, restore }；info = { i, total, t } */

/* Task 5 */
REC.Source.offline(handle, ctxObj, cfg, onProgress) -> {stream, done:Promise, cancel:Function}
REC.Source.realtime(handle, ctxObj, cfg)            -> {stream, stop:Function}
REC.Source.__test()                                 -> {pass:[],fail:[]}

/* Task 6 */
REC.UI.mount()   -> undefined
REC.UI.__test()  -> {pass:[],fail:[]}
```

- [ ] **Step 1: 建本地服务器配置**

模式 1/2 需要同源，`file://` 下 `contentDocument` 会被 Chrome 拦掉，所以开发和验收都必须走 http。

创建 `.claude/launch.json`：

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "mathviz",
      "runtimeExecutable": "python3",
      "runtimeArgs": ["-m", "http.server", "8777"],
      "port": 8777
    }
  ]
}
```

- [ ] **Step 2: 写 selftest 聚合器（此刻必然 fail）**

在 `app.html` 的 `/* ================= 启动 ================= */` 之前插入：

```js
/* ================= 录制器 ================= */
var REC = {};

REC.CFG = {
  visual: 'overlay', aspect: '16:9', drive: 'offline',
  duration: 8, loop: true, orbit: false, viewTo: ''
};
REC.SIZES = { '16:9': [1920,1080], '9:16': [1080,1920], '1:1': [1080,1080] };
REC.FPS = 60;
REC.COLORS = ['#ff5a8a','#a68bff','#37d9a0','#ffa653'];

/* 双语取词：与外壳其余部分一致，读全局 LANG */
REC.t = function(o){ return (o && o[LANG]) || (o && o.zh) || ''; };

/* 汇总各单元自检。跑法：起服务器后在控制台执行 REC.selftest() */
REC.selftest = function(){
  var units = ['Bridge','Encoder','Compositor','Source','UI'];
  var out = { pass: [], fail: [] };
  for (var i = 0; i < units.length; i++){
    var u = units[i], m = REC[u] && REC[u].__test;
    if (typeof m !== 'function'){ out.fail.push(u + ': 未实现 __test()'); continue; }
    var r;
    try{ r = m(); }catch(e){ out.fail.push(u + ': __test() 抛错 ' + e); continue; }
    for (var a = 0; a < r.pass.length; a++) out.pass.push(u + ' · ' + r.pass[a]);
    for (var b = 0; b < r.fail.length; b++) out.fail.push(u + ' · ' + r.fail[b]);
  }
  return out;
};

/* ===== REC:BRIDGE ===== */
REC.Bridge = {};
/* ===== /REC:BRIDGE ===== */

/* ===== REC:ENCODER ===== */
REC.Encoder = {};
/* ===== /REC:ENCODER ===== */

/* ===== REC:COMPOSITOR ===== */
REC.Compositor = {};
/* ===== /REC:COMPOSITOR ===== */

/* ===== REC:SOURCE ===== */
REC.Source = {};
/* ===== /REC:SOURCE ===== */

/* ===== REC:UI ===== */
REC.UI = {};
/* ===== /REC:UI ===== */
```

在 `boot()` 函数体末尾（`app.html:1133` 的 `setSidebar(...)` 之后）追加一行：

```js
  if (REC.UI.mount) REC.UI.mount();
```

- [ ] **Step 3: 跑自检，确认它 fail**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
```
预期：语法通过。

起服务器后在 `http://localhost:8777/app.html` 执行 `REC.selftest()`。
预期：`fail` 数组含 5 条「未实现 `__test()`」——**这就是 red 状态，Task 2–6 各消掉一条。**

- [ ] **Step 4: 加录制按钮的 DOM 与 CSS 占位**

CSS 插在 `</style>`（`app.html:134`）之前：

```css
  /* ===== 录制器 ===== */
  .rec-btn{position:absolute;right:16px;bottom:16px;z-index:40;
    display:flex;align-items:center;gap:7px;
    padding:9px 14px;border-radius:999px;cursor:pointer;
    border:1px solid rgba(255,255,255,.14);
    background:rgba(10,16,28,.82);backdrop-filter:blur(8px);
    color:#dbe6f5;font-size:13px;letter-spacing:.02em}
  .rec-btn:hover{border-color:rgba(255,255,255,.28)}
  .rec-btn[disabled]{opacity:.4;cursor:not-allowed}
  .rec-btn .dot{width:9px;height:9px;border-radius:50%;background:#ff5a8a}
  .rec-panel{position:absolute;right:16px;bottom:62px;z-index:41;width:274px;
    padding:14px;border-radius:14px;display:none;
    border:1px solid rgba(255,255,255,.12);
    background:rgba(8,13,24,.94);backdrop-filter:blur(12px);
    color:#dbe6f5;font-size:12.5px}
  .rec-panel.on{display:block}
  .rec-panel h4{margin:0 0 10px;font-size:12px;letter-spacing:.14em;
    text-transform:uppercase;color:#7d8ca6;font-weight:600}
  .rec-row{margin-bottom:11px}
  .rec-row > label{display:block;margin-bottom:5px;color:#93a3bd;font-size:11.5px}
  .rec-seg{display:flex;gap:5px}
  .rec-seg button{flex:1;padding:6px 0;border-radius:7px;cursor:pointer;font-size:11.5px;
    border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:#93a3bd}
  .rec-seg button.on{border-color:#ff5a8a;color:#ffd7e3;background:rgba(255,90,138,.14)}
  .rec-chk{display:flex;align-items:center;gap:7px;color:#93a3bd;cursor:pointer}
  .rec-go{width:100%;padding:9px 0;margin-top:3px;border-radius:9px;cursor:pointer;
    border:1px solid rgba(255,90,138,.5);background:rgba(255,90,138,.16);color:#ffd7e3}
  .rec-go[disabled]{opacity:.45;cursor:not-allowed}
  .rec-note{margin-top:9px;color:#6f7f99;font-size:11px;line-height:1.5}
  .rec-bar{height:3px;margin-top:9px;border-radius:2px;background:rgba(255,255,255,.09);overflow:hidden}
  .rec-bar i{display:block;height:100%;width:0;background:#ff5a8a;transition:width .1s linear}
  /* 录制期间：iframe 脱离 flex 布局，按目标画幅定尺寸再缩放预览 */
  .stage.rec-live{overflow:hidden;position:relative}
  .stage.rec-live > iframe{position:absolute;left:50%;top:50%;
    transform-origin:50% 50%;border:0}
```

DOM 插在 `</main>`（`app.html:162`）之前：

```html
    <button class="rec-btn" id="recBtn" title="录制视频 / Record video"><span class="dot"></span><span id="recBtnTxt">录制</span></button>
    <div class="rec-panel" id="recPanel"></div>
```

- [ ] **Step 5: 语法门禁 + 提交**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
```
预期：无输出（通过）。

```bash
git add app.html .claude/launch.json && git commit -m "feat(app): 录制器骨架、接口契约与本地服务器配置"
```

---

## Task 2: `REC.Bridge` — 跨 iframe 桥

**Files:**
- Modify: `app.html`，**只填 `/* ===== REC:BRIDGE ===== */` 区内**

**Interfaces:**
- Consumes: 外壳的 `frame`、`curId`（Task 1）
- Produces: `available() / get() / invalidate() / snapshot() / restore() / __test()`，`handle` 形如 `{ win, doc, canvas, state, cam, SCENES, curTab, samples, draw, resize, pushSample, applyView, toolId }`

**背景（已实测，别再重新发现一遍）**：工具用裸 `<script>` + 顶层 `const` 声明 `canvas` / `state` / `cam` / `SCENES` / `curTab` / `samples`，这些**不是** `window` 的属性，`frame.contentWindow.state` 恒为 `undefined`。但 `frame.contentWindow.eval('state')` 在全局作用域执行，能看穿 script-scope 的词法绑定，返回**活对象引用**。这是整个方案的地基。

- [ ] **Step 1: 写失败的自检**

填入 `REC:BRIDGE` 区：

```js
REC.Bridge = {};
REC.Bridge.__test = function(){
  var r = { pass: [], fail: [] };
  function ok(n, c){ if (c) r.pass.push(n); else r.fail.push(n); }
  var h = REC.Bridge.get();
  ok('available() 与 get() 结论一致', REC.Bridge.available() === !!h);
  if (!h){ r.fail.push('拿不到 handle（是否用 file:// 打开、或当前停在画廊首页？）'); return r; }
  ok('canvas 是 canvas 元素', h.canvas && h.canvas.tagName === 'CANVAS');
  ok('canvas 有尺寸', h.canvas.width > 0 && h.canvas.height > 0);
  ok('state 是对象且含 theta', h.state && typeof h.state.theta === 'number');
  ok('cam 是对象且含 az', h.cam && typeof h.cam.az === 'number');
  ok('draw 是函数', typeof h.draw === 'function');
  ok('resize 是函数', typeof h.resize === 'function');
  ok('pushSample 是函数', typeof h.pushSample === 'function');
  ok('samples 是数组', Object.prototype.toString.call(h.samples) === '[object Array]');
  ok('toolId 非空', !!h.toolId);
  /* 快照 / 还原必须真正复原被改动的字段 */
  var snap = REC.Bridge.snapshot();
  var t0 = h.state.theta, az0 = h.cam.az, n0 = h.samples.length;
  h.state.theta = t0 + 12.5; h.cam.az = az0 + 1.25; h.samples.length = 0;
  REC.Bridge.restore(snap);
  ok('restore 复原 state.theta', Math.abs(h.state.theta - t0) < 1e-9);
  ok('restore 复原 cam.az', Math.abs(h.cam.az - az0) < 1e-9);
  ok('restore 复原 samples 长度', h.samples.length === n0);
  return r;
};
```

- [ ] **Step 2: 跑自检确认 fail**

起服务器（`.claude/launch.json` 的 `mathviz`），开 `http://localhost:8777/app.html?tool=fourier-essence-3d`，等 iframe 载完后在控制台执行 `REC.Bridge.__test()`。
预期：`fail` 里出现「拿不到 handle」——`get()` 还没实现。

- [ ] **Step 3: 实现**

```js
REC.Bridge = {};
var _bridgeCache = null;

/* 工具里的顶层 const 不挂 window，只能靠全局 eval 穿透 script scope。
   跨源（file:// 打开）时 contentWindow.eval 会抛错，这里统一吞掉并回落 null。 */
function _peek(win, expr){
  try{ return win.eval(expr); }catch(e){ return undefined; }
}

REC.Bridge.get = function(){
  if (_bridgeCache && _bridgeCache.win === frame.contentWindow) return _bridgeCache;
  _bridgeCache = null;
  if (!curId) return null;                       /* 画廊首页没有工具可录 */
  var win = null, doc = null;
  try{ win = frame.contentWindow; doc = frame.contentDocument; }catch(e){ return null; }
  if (!win || !doc) return null;
  var cv = _peek(win, 'typeof canvas !== "undefined" ? canvas : null');
  if (!cv || cv.tagName !== 'CANVAS') return null;
  var h = {
    win: win, doc: doc, canvas: cv,
    state:   _peek(win, 'typeof state   !== "undefined" ? state   : null'),
    cam:     _peek(win, 'typeof cam     !== "undefined" ? cam     : null'),
    SCENES:  _peek(win, 'typeof SCENES  !== "undefined" ? SCENES  : null'),
    curTab:  _peek(win, 'typeof curTab  !== "undefined" ? curTab  : null'),
    samples: _peek(win, 'typeof samples !== "undefined" ? samples : null'),
    draw:       _peek(win, 'typeof draw       === "function" ? draw       : null'),
    resize:     _peek(win, 'typeof resize     === "function" ? resize     : null'),
    pushSample: _peek(win, 'typeof pushSample === "function" ? pushSample : null'),
    applyView:  _peek(win, 'typeof applyView  === "function" ? applyView  : null'),
    toolId: curId
  };
  if (!h.state || !h.cam || !h.draw) return null;   /* 老工具可能不合规，直接判不可用 */
  _bridgeCache = h;
  return h;
};

REC.Bridge.available = function(){ return !!REC.Bridge.get(); };
REC.Bridge.invalidate = function(){ _bridgeCache = null; };

/* 离线渲染会真实推进 state 与 samples，必须能无条件还原现场 */
REC.Bridge.snapshot = function(){
  var h = REC.Bridge.get();
  if (!h) return null;
  var st = {}, k;
  for (k in h.state) if (Object.prototype.hasOwnProperty.call(h.state, k)) st[k] = h.state[k];
  var cm = {};
  for (k in h.cam) if (Object.prototype.hasOwnProperty.call(h.cam, k)) cm[k] = h.cam[k];
  return { state: st, cam: cm, samples: h.samples ? h.samples.slice() : null, curTab: h.curTab };
};

REC.Bridge.restore = function(snap){
  var h = REC.Bridge.get();
  if (!h || !snap) return;
  var k;
  for (k in snap.state) if (Object.prototype.hasOwnProperty.call(snap.state, k)) h.state[k] = snap.state[k];
  for (k in snap.cam)   if (Object.prototype.hasOwnProperty.call(snap.cam, k))   h.cam[k]   = snap.cam[k];
  if (snap.samples && h.samples){
    h.samples.length = 0;
    for (var i = 0; i < snap.samples.length; i++) h.samples.push(snap.samples[i]);
  }
};
```

同时给 iframe 的 `load` 挂失效钩子。在 `app.html:1098` 现有的 `frame.addEventListener('load', ...)` 回调**第一行**加：

```js
  REC.Bridge.invalidate();
```

- [ ] **Step 4: 跑自检确认全 pass**

浏览器执行 `REC.Bridge.__test()`。
预期：`fail` 为空数组，`pass` 含 13 条。

同时执行一次 `REC.selftest()`，确认 Bridge 那一条「未实现 __test()」已消失。

- [ ] **Step 5: 语法门禁 + 提交**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
```

```bash
git add app.html && git commit -m "feat(app): REC.Bridge 跨 iframe 桥与现场快照还原"
```

---

## Task 3: `REC.Encoder` — mime 探测与编码

**Files:**
- Modify: `app.html`，**只填 `/* ===== REC:ENCODER ===== */` 区内**

**Interfaces:**
- Consumes: 无（本单元零依赖，可独立开发）
- Produces: `pickMime() -> {mime,ext}|null`、`start(stream, mime) -> session`、`stop(session) -> Promise<Blob>`、`download(blob, filename)`、`__test()`

**背景（已实测）**：Chromium 148 上 `video/mp4;codecs=avc1` 的 `isTypeSupported` 为 `true`；Safari 14.1+ 原生只出 mp4；Firefox 至今不支持 mp4（Bugzilla 1631143），必须落回 webm。

- [ ] **Step 1: 写失败的自检**

填入 `REC:ENCODER` 区：

```js
REC.Encoder = {};
REC.Encoder.__test = function(){
  var r = { pass: [], fail: [] };
  function ok(n, c){ if (c) r.pass.push(n); else r.fail.push(n); }
  var p = REC.Encoder.pickMime();
  ok('pickMime 返回结果', !!p);
  if (!p){ r.fail.push('本浏览器没有任何可用 mime'); return r; }
  ok('mime 可被 MediaRecorder 接受', MediaRecorder.isTypeSupported(p.mime));
  ok('ext 是 mp4 或 webm', p.ext === 'mp4' || p.ext === 'webm');
  ok('ext 与 mime 容器一致', p.mime.indexOf('mp4') >= 0 ? p.ext === 'mp4' : p.ext === 'webm');
  /* 端到端：拿一张离屏 canvas 真录 200ms，必须产出非空 Blob */
  var cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  var c2 = cv.getContext('2d');
  c2.fillStyle = '#ff5a8a'; c2.fillRect(0, 0, 64, 64);
  var st = cv.captureStream(30);
  var ses = REC.Encoder.start(st, p.mime);
  ok('start 返回 session', !!(ses && ses.rec));
  r.pass.push('端到端录制已异步发起（结果见控制台 REC.Encoder.__lastProbe）');
  REC.Encoder.stop(ses).then(function(b){
    REC.Encoder.__lastProbe = { size: b.size, type: b.type, ok: b.size > 0 };
  })['catch'](function(e){ REC.Encoder.__lastProbe = { error: String(e) }; });
  return r;
};
```

- [ ] **Step 2: 跑自检确认 fail**

浏览器执行 `REC.Encoder.__test()`。
预期：`fail` 含「pickMime 返回结果」——尚未实现。

- [ ] **Step 3: 实现**

```js
REC.Encoder = {};

/* 优先级：能出 mp4 就出 mp4（Chrome/Edge/Safari 都行），Firefox 落 webm */
REC.Encoder.MIMES = [
  { mime: 'video/mp4;codecs=avc1',  ext: 'mp4'  },
  { mime: 'video/mp4',              ext: 'mp4'  },
  { mime: 'video/webm;codecs=vp9',  ext: 'webm' },
  { mime: 'video/webm',             ext: 'webm' }
];

REC.Encoder.pickMime = function(){
  if (!window.MediaRecorder) return null;
  for (var i = 0; i < REC.Encoder.MIMES.length; i++){
    var m = REC.Encoder.MIMES[i];
    try{ if (MediaRecorder.isTypeSupported(m.mime)) return m; }catch(e){}
  }
  return null;
};

REC.Encoder.start = function(stream, mime){
  var chunks = [];
  var opt = { mimeType: mime };
  /* 1080p60 的线条动画，12Mbps 足够干净又不至于让文件大到没法分享 */
  opt.videoBitsPerSecond = 12000000;
  var rec = new MediaRecorder(stream, opt);
  rec.ondataavailable = function(e){ if (e.data && e.data.size) chunks.push(e.data); };
  rec.start(100);        /* 100ms 一个 chunk，避免长录制时内存里堆一整块 */
  return { rec: rec, chunks: chunks, mime: mime, stream: stream };
};

REC.Encoder.stop = function(ses){
  return new Promise(function(resolve, reject){
    if (!ses || !ses.rec) { reject(new Error('no session')); return; }
    ses.rec.onerror = function(e){ reject(e && e.error ? e.error : new Error('recorder error')); };
    ses.rec.onstop = function(){
      try{
        var tr = ses.stream.getTracks();
        for (var i = 0; i < tr.length; i++) tr[i].stop();
      }catch(e){}
      resolve(new Blob(ses.chunks, { type: ses.mime }));
    };
    if (ses.rec.state !== 'inactive') ses.rec.stop(); else ses.rec.onstop();
  });
};

REC.Encoder.download = function(blob, filename){
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
};
```

- [ ] **Step 4: 跑自检确认全 pass**

浏览器执行 `REC.Encoder.__test()`，`fail` 应为空。
再等 1 秒执行 `REC.Encoder.__lastProbe`。
预期：`{ size: <大于 0 的数>, type: 'video/mp4;codecs=avc1', ok: true }`（Firefox 上 type 为 webm，同样 `ok: true`）。

- [ ] **Step 5: 语法门禁 + 提交**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
```

```bash
git add app.html && git commit -m "feat(app): REC.Encoder —— mime 优先级探测与 MediaRecorder 封装"
```

---

## Task 4: `REC.Compositor` — 画幅与叠层

**Files:**
- Modify: `app.html`，**只填 `/* ===== REC:COMPOSITOR ===== */` 区内**

**Interfaces:**
- Consumes: `REC.Bridge.get()` 返回的 `handle`（字段见 Task 1 契约）、`REC.SIZES`、`REC.COLORS`、`REC.t`
- Produces: `begin(handle, cfg) -> ctxObj|null`、`frame(ctxObj, handle, info)`、`end(ctxObj)`、`__test()`
  - `ctxObj = { w, h, canvas, mode, restore }`；`mode` 为 `'clean'|'overlay'`；`canvas` 是**要交给 captureStream 的那张**
  - `info = { i, total, t }`（当前帧序号、总帧数、虚拟秒数）

**关键设计（别改成缩放贴图）**：目标画幅靠**临时重排 iframe 尺寸**实现，不靠缩放。把 iframe 的 CSS 尺寸设成 `目标宽/DPR × 目标高/DPR`，iframe 内 `window.innerWidth` 变化触发工具自己的 `resize()`，`W/H/FOCAL/CX/CY/bgGrad` 全部按新画幅重算，backing store 正好等于目标像素。工具因此在 9:16 下**真正按竖屏重新构图**（`FOCAL = 1.2·min(H, W·1.1)`），而缩放贴图会把横构图硬塞进竖框。

- [ ] **Step 1: 写失败的自检**

填入 `REC:COMPOSITOR` 区：

```js
REC.Compositor = {};
REC.Compositor.__test = function(){
  var r = { pass: [], fail: [] };
  function ok(n, c){ if (c) r.pass.push(n); else r.fail.push(n); }
  var h = REC.Bridge.get();
  if (!h){ r.fail.push('需要先载入一个工具（Bridge 不可用）'); return r; }
  var cfgs = [
    { visual: 'clean',   aspect: '16:9' },
    { visual: 'overlay', aspect: '9:16' },
    { visual: 'overlay', aspect: '1:1'  }
  ];
  for (var i = 0; i < cfgs.length; i++){
    var c = cfgs[i], tag = c.visual + '/' + c.aspect;
    var want = REC.SIZES[c.aspect];
    var o = REC.Compositor.begin(h, c);
    if (!o){ r.fail.push(tag + ': begin 返回 null'); continue; }
    ok(tag + ' 输出宽度正确', o.w === want[0]);
    ok(tag + ' 输出高度正确', o.h === want[1]);
    ok(tag + ' 尺寸为偶数（H.264 要求）', o.w % 2 === 0 && o.h % 2 === 0);
    ok(tag + ' canvas backing store 匹配', o.canvas.width === want[0] && o.canvas.height === want[1]);
    ok(tag + ' 工具 canvas 已按画幅重算', h.canvas.width === want[0] && h.canvas.height === want[1]);
    try{ REC.Compositor.frame(o, h, { i: 0, total: 60, t: 0 }); r.pass.push(tag + ' frame() 不抛错'); }
    catch(e){ r.fail.push(tag + ' frame() 抛错 ' + e); }
    REC.Compositor.end(o);
  }
  ok('end() 后 iframe 内联尺寸已清空', frame.style.width === '');
  ok('end() 后 stage 已摘掉 rec-live', document.querySelector('.stage').className.indexOf('rec-live') < 0);
  return r;
};
```

- [ ] **Step 2: 跑自检确认 fail**

浏览器开 `http://localhost:8777/app.html?tool=fourier-essence-3d`，执行 `REC.Compositor.__test()`。
预期：`fail` 含三条 `begin 返回 null`。

- [ ] **Step 3: 实现**

```js
REC.Compositor = {};

/* 工具内部就是这么算 DPR 的（math-viz-starter.html:379），必须一致，
   否则 backing store 对不上目标像素尺寸。 */
function _toolDpr(win){ return Math.min(2.5, win.devicePixelRatio || 1); }

REC.Compositor.begin = function(h, cfg){
  var size = REC.SIZES[cfg.aspect];
  if (!h || !size) return null;
  var w = size[0], hh = size[1];
  var stage = document.querySelector('.stage');
  var dpr = _toolDpr(h.win);

  /* 记住现场，end() 时逐字还原 */
  var prev = {
    fw: frame.style.width, fh: frame.style.height,
    ftr: frame.style.transform, fml: frame.style.marginLeft, fmt: frame.style.marginTop
  };

  /* 关键：改 iframe 的 CSS 尺寸 → iframe 内 window.innerWidth 变 → 工具 resize() 重算构图 */
  stage.classList.add('rec-live');
  frame.style.width  = (w / dpr) + 'px';
  frame.style.height = (hh / dpr) + 'px';
  /* 缩回视口内做预览；居中靠负 margin，避免 transform 影响 offset 计算 */
  var sc = Math.min(stage.clientWidth / (w / dpr), stage.clientHeight / (hh / dpr), 1);
  frame.style.marginLeft = (-(w / dpr) / 2) + 'px';
  frame.style.marginTop  = (-(hh / dpr) / 2) + 'px';
  frame.style.transform  = 'scale(' + sc + ')';

  /* 工具的 resize 监听是异步的，这里直接同步调一次，保证本函数返回时尺寸已生效 */
  if (h.resize) { try{ h.resize(); }catch(e){} }
  if (h.draw)   { try{ h.draw();   }catch(e){} }

  var o = { w: w, h: hh, mode: (cfg.visual === 'overlay' ? 'overlay' : 'clean'),
            canvas: null, _prev: prev, _stage: stage };
  if (o.mode === 'overlay'){
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = hh;
    o.canvas = cv; o.ctx = cv.getContext('2d');
  } else {
    o.canvas = h.canvas;
  }
  return o;
};

/* 每帧调用。clean 模式什么都不用做（captureStream 直接盯着工具 canvas）。 */
REC.Compositor.frame = function(o, h, info){
  if (!o || o.mode !== 'overlay') return;
  var c = o.ctx, w = o.w, hh = o.h;
  c.clearRect(0, 0, w, hh);
  c.drawImage(h.canvas, 0, 0, w, hh);

  var vert = hh > w;
  var pad = Math.round(w * 0.033);
  var base = Math.round(w * 0.0125);           /* 字号基准，随画幅缩放 */
  var sc = h.SCENES && h.curTab ? h.SCENES[h.curTab] : null;
  var d = byId(h.toolId);

  /* 标题：左上（竖屏时下移，给顶部留呼吸） */
  var ty = vert ? Math.round(hh * 0.055) : pad;
  if (d){
    c.save();
    c.textBaseline = 'top';
    c.fillStyle = '#7d8ca6';
    c.font = '600 ' + Math.round(base * 0.82) + 'px ui-sans-serif, -apple-system, "PingFang SC", sans-serif';
    c.fillText(String(REC.t(d.kicker) || '').toUpperCase(), pad, ty);
    c.fillStyle = '#dbe6f5';
    c.font = '600 ' + Math.round(base * 1.5) + 'px ui-sans-serif, -apple-system, "PingFang SC", sans-serif';
    c.fillText(REC.t(d.title) || '', pad, ty + Math.round(base * 1.25));
    c.restore();
  }

  /* 图例：左下，固定色序 rose → violet → emerald → orange */
  if (sc && sc.toggles){
    c.save();
    c.textBaseline = 'middle';
    c.font = Math.round(base) + 'px ui-sans-serif, -apple-system, "PingFang SC", sans-serif';
    var y = hh - pad, n = 0;
    for (var k = 0; k < sc.toggles.length; k++){
      var tg = sc.toggles[k];
      if (!h.state[tg.key]) continue;                     /* 只画已开启的曲线 */
      var col = REC.COLORS[n % REC.COLORS.length];
      c.fillStyle = col;
      c.beginPath(); c.arc(pad + base * 0.4, y, base * 0.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#93a3bd';
      c.fillText(String(REC.t(tg.label) || tg.key).replace(/<[^>]+>/g, ''), pad + base * 1.3, y);
      y -= base * 1.9; n++;
    }
    c.restore();
  }

  /* 读数：右上。工具的 readout() 返回 HTML，这里剥标签取纯文本，逐行画。 */
  if (sc && sc.readout){
    var txt = '';
    try{ txt = String(sc.readout()); }catch(e){ txt = ''; }
    var lines = txt.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|tr)>/gi, '\n')
                   .replace(/<[^>]+>/g, ' ').replace(/&minus;/g, '−')
                   .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
                   .split('\n');
    c.save();
    c.textAlign = 'right';
    c.textBaseline = 'top';
    c.font = 'italic ' + Math.round(base * 1.05) + 'px Georgia, "Songti SC", serif';
    c.fillStyle = '#dbe6f5';
    var ry = ty;
    for (var i = 0; i < lines.length; i++){
      var ln = lines[i].replace(/\s+/g, ' ').trim();
      if (!ln) continue;
      c.fillText(ln, w - pad, ry);
      ry += base * 1.6;
      if (ry > hh * 0.5) break;                          /* 读数再长也不许压到画面中部 */
    }
    c.restore();
  }
};

REC.Compositor.end = function(o){
  if (!o) return;
  frame.style.width      = o._prev.fw;
  frame.style.height     = o._prev.fh;
  frame.style.transform  = o._prev.ftr;
  frame.style.marginLeft = o._prev.fml;
  frame.style.marginTop  = o._prev.fmt;
  o._stage.classList.remove('rec-live');
  var h = REC.Bridge.get();
  if (h){ try{ h.resize(); h.draw(); }catch(e){} }
};
```

- [ ] **Step 4: 跑自检确认全 pass**

浏览器执行 `REC.Compositor.__test()`，`fail` 应为空（约 20 条 pass）。

肉眼验收：执行下面这段，应看到 iframe 变成竖屏比例并缩放居中，1 秒后复原。

```js
var h = REC.Bridge.get(), o = REC.Compositor.begin(h, {visual:'overlay',aspect:'9:16'});
setTimeout(function(){ REC.Compositor.end(o); }, 1000);
```

- [ ] **Step 5: 语法门禁 + 提交**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
```

```bash
git add app.html && git commit -m "feat(app): REC.Compositor —— 重排 iframe 定画幅与录制叠层"
```

---

## Task 5: `REC.Source` — 离线定长与实时两种驱动

**Files:**
- Modify: `app.html`，**只填 `/* ===== REC:SOURCE ===== */` 区内**

**Interfaces:**
- Consumes: `handle`（Task 1 契约）、`ctxObj`（`{w,h,canvas,mode}`）、`REC.CFG`、`REC.FPS`、`REC.Compositor.frame(o,h,info)`
- Produces: `offline(handle, ctxObj, cfg, onProgress) -> {stream, done, cancel}`、`realtime(handle, ctxObj, cfg) -> {stream, stop}`、`__test()`
  - `onProgress(k)`，`k ∈ [0,1]`
  - `done` 是 `Promise`，正常结束 resolve `{frames: Number, cancelled: Boolean}`

**两处必须做对的细节**：

1. **引擎的 tween 用真实时钟**：`math-viz-starter.html:809` 存 `t0: performance.now()`，`:675` 按 `(ts - tween.t0) / tween.dur` 求进度。离线模式比实时快，直接调 `applyView()` 会让运镜在第一帧就跑完。**做法是不用引擎的 tween**——自己按虚拟进度插值 `cam`。
2. **必须接管驱动**：置 `state.running = false` 停掉工具自己的积分，由本单元按固定 `dt = 1/REC.FPS` 推进。

- [ ] **Step 1: 写失败的自检**

填入 `REC:SOURCE` 区：

```js
REC.Source = {};
REC.Source.__test = function(){
  var r = { pass: [], fail: [] };
  function ok(n, c){ if (c) r.pass.push(n); else r.fail.push(n); }
  var h = REC.Bridge.get();
  if (!h){ r.fail.push('需要先载入一个工具（Bridge 不可用）'); return r; }
  ok('offline 是函数', typeof REC.Source.offline === 'function');
  ok('realtime 是函数', typeof REC.Source.realtime === 'function');
  ok('snapDuration 是函数', typeof REC.Source.snapDuration === 'function');
  /* 无缝循环吸附：omega=1 时周期 2π≈6.283，8s 应吸附到 2 个周期 12.566…
     取「不超过原时长的最大整数倍，至少 1 个周期」 */
  ok('时长吸附到周期整数倍', Math.abs(REC.Source.snapDuration(8, 1) - 6.283185307179586) < 1e-6);
  ok('吸附不足一个周期时给一个整周期', Math.abs(REC.Source.snapDuration(3, 1) - 6.283185307179586) < 1e-6);
  ok('omega 为 0 时原样返回', REC.Source.snapDuration(8, 0) === 8);

  /* 端到端：跑一段 0.5s 的离线渲染，帧数必须精确，且现场被还原 */
  var snap = REC.Bridge.snapshot();
  var o = REC.Compositor.begin(h, { visual: 'clean', aspect: '1:1' });
  var s = REC.Source.offline(h, o, { duration: 0.5, loop: false, orbit: false, viewTo: '' }, null);
  ok('offline 返回 stream', !!(s && s.stream && s.stream.getVideoTracks().length === 1));
  s.done.then(function(res){
    REC.Compositor.end(o);
    REC.Bridge.restore(snap);
    REC.Source.__lastProbe = {
      frames: res.frames,
      framesOk: res.frames === Math.round(0.5 * REC.FPS),
      restored: Math.abs(h.state.theta - snap.state.theta) < 1e-9,
      runningRestored: h.state.running === snap.state.running
    };
  });
  r.pass.push('端到端离线渲染已发起（结果见 REC.Source.__lastProbe）');
  return r;
};
```

- [ ] **Step 2: 跑自检确认 fail**

浏览器执行 `REC.Source.__test()`。
预期：`fail` 含「offline 是函数」等——尚未实现。

- [ ] **Step 3: 实现**

```js
REC.Source = {};

/* 无缝循环：把时长吸到动画周期 2π/ω 的整数倍。ω=0（静态场景）时不吸。 */
REC.Source.snapDuration = function(sec, omega){
  if (!omega) return sec;
  var period = 2 * Math.PI / Math.abs(omega);
  var n = Math.floor(sec / period);
  if (n < 1) n = 1;
  return n * period;
};

REC.Source.offline = function(h, o, cfg, onProgress){
  var total = Math.max(1, Math.round(cfg.duration * REC.FPS));
  var dt = 1 / REC.FPS;
  var stream = o.canvas.captureStream(0);         /* 0 = 只接受手动 requestFrame */
  var track = stream.getVideoTracks()[0];
  var cancelled = false;

  /* 接管驱动：停掉工具自己的积分，本函数按固定步长推进 */
  var wasRunning = h.state.running;
  h.state.running = false;

  /* 运镜的起止镜位。引擎的 tween 走真实时钟，离线模式必须自己插值。 */
  var cam0 = { az: h.cam.az, el: h.cam.el, dist: h.cam.dist,
               tx: h.cam.tx, ty: h.cam.ty, tz: h.cam.tz };
  var camTo = null;
  if (cfg.viewTo && h.SCENES && h.curTab){
    var sc = h.SCENES[h.curTab];
    var v = sc && sc.views && sc.views[cfg.viewTo];
    if (v) camTo = v.cam || v;
  }
  function ease(k){ return k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2; }

  var done = new Promise(function(resolve){
    var i = 0;
    function step(){
      if (cancelled){ h.state.running = wasRunning; resolve({ frames: i, cancelled: true }); return; }
      if (i >= total){ h.state.running = wasRunning; resolve({ frames: i, cancelled: false }); return; }
      var k = i / total;

      /* 1. 推进仿真（固定步长，与真实帧率无关） */
      h.state.t += dt;
      h.state.theta += h.state.omega * dt;
      if (h.pushSample) h.pushSample();

      /* 2. 运镜 */
      if (cfg.orbit) h.cam.az = cam0.az + 2 * Math.PI * k;
      if (camTo){
        var e = ease(Math.min(1, k / 0.6));       /* 前 60% 完成过渡，留时间看结果 */
        var f;
        for (f in cam0) if (typeof camTo[f] === 'number') h.cam[f] = cam0[f] + (camTo[f] - cam0[f]) * e;
      }

      /* 3. 绘制 + 合成 + 交帧 */
      h.draw();
      REC.Compositor.frame(o, h, { i: i, total: total, t: i * dt });
      if (track.requestFrame) track.requestFrame();
      else if (stream.requestFrame) stream.requestFrame();

      i++;
      if (onProgress) onProgress(i / total);
      requestAnimationFrame(step);               /* 让出主线程，编码器才有机会消费 */
    }
    requestAnimationFrame(step);
  });

  return { stream: stream, done: done, cancel: function(){ cancelled = true; } };
};

/* 实时录制：被动跟随工具自己的 rAF，能录下手动拖拽旋转、切 tab、拖滑块的全过程 */
REC.Source.realtime = function(h, o, cfg){
  var stream = o.canvas.captureStream(REC.FPS);
  var timer = null;
  if (o.mode === 'overlay'){
    /* overlay 模式的离屏画布不会自己更新，得自己按帧刷 */
    var i = 0;
    var tick = function(){
      REC.Compositor.frame(o, h, { i: i, total: 0, t: i / REC.FPS });
      i++;
      timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  }
  return {
    stream: stream,
    stop: function(){ if (timer) cancelAnimationFrame(timer); timer = null; }
  };
};
```

- [ ] **Step 4: 跑自检确认全 pass**

浏览器执行 `REC.Source.__test()`，`fail` 应为空。等 2 秒后执行 `REC.Source.__lastProbe`。
预期：`{ frames: 30, framesOk: true, restored: true, runningRestored: true }`。

`framesOk: true` 是这一任务的核心证据——离线驱动产帧数精确，不受真实帧率影响。

- [ ] **Step 5: 语法门禁 + 提交**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
```

```bash
git add app.html && git commit -m "feat(app): REC.Source —— 离线定长渲染与实时录制两种驱动"
```

---

## Task 6: `REC.UI` — 面板、设置与降级提示

**Files:**
- Modify: `app.html`，**只填 `/* ===== REC:UI ===== */` 区内**（Task 1 已经把 `#recBtn` / `#recPanel` 的 DOM 和 CSS 放好了）

**Interfaces:**
- Consumes: `REC.CFG`、`REC.SIZES`、`REC.t`、`REC.Bridge.available()`、`REC.Encoder.pickMime()`、外壳的 `LANG` / `curId` / `byId`
- Produces: `REC.UI.mount()`（Task 1 已在 `boot()` 末尾调用）、`REC.UI.__test()`

本任务**只做 UI 与配置**，不做录制编排（那是 Task 7）。`REC.UI.run` 先留一个抛 `not wired` 的桩，Task 7 替换。

- [ ] **Step 1: 写失败的自检**

填入 `REC:UI` 区：

```js
REC.UI = {};
REC.UI.__test = function(){
  var r = { pass: [], fail: [] };
  function ok(n, c){ if (c) r.pass.push(n); else r.fail.push(n); }
  REC.UI.mount();
  var btn = document.getElementById('recBtn');
  var pan = document.getElementById('recPanel');
  ok('录制按钮存在', !!btn);
  ok('面板已渲染出内容', !!pan && pan.innerHTML.length > 0);
  ok('面板默认收起', pan.className.indexOf('on') < 0);
  btn.click();
  ok('点按钮展开面板', pan.className.indexOf('on') >= 0);
  /* 画幅分段器：点 9:16 应写回 CFG */
  var seg = pan.querySelector('[data-k="aspect"][data-v="9:16"]');
  ok('存在 9:16 选项', !!seg);
  if (seg){ seg.click(); ok('点击写回 CFG.aspect', REC.CFG.aspect === '9:16'); 
            ok('选中态加了 on', seg.className.indexOf('on') >= 0); }
  var v = pan.querySelector('[data-k="visual"][data-v="clean"]');
  if (v){ v.click(); ok('点击写回 CFG.visual', REC.CFG.visual === 'clean'); }
  var dur = pan.querySelector('#recDur');
  ok('存在时长滑块', !!dur);
  if (dur){ ok('时长下限 3', +dur.min === 3); ok('时长上限 30', +dur.max === 30); }
  ok('存在开始按钮', !!pan.querySelector('#recGo'));
  ok('存在格式说明', pan.innerHTML.indexOf('mp4') >= 0 || pan.innerHTML.indexOf('webm') >= 0);
  REC.CFG.aspect = '16:9'; REC.CFG.visual = 'overlay';   /* 复位，别污染后续测试 */
  btn.click();
  ok('再点按钮收起面板', pan.className.indexOf('on') < 0);
  return r;
};
```

- [ ] **Step 2: 跑自检确认 fail**

浏览器执行 `REC.UI.__test()`。
预期：`fail` 含「面板已渲染出内容」——`mount()` 还是空壳。

- [ ] **Step 3: 实现**

```js
REC.UI = {};

REC.UI.L = {
  rec:      { zh: '录制',       en: 'Record' },
  title:    { zh: '录制视频',   en: 'Record video' },
  visual:   { zh: '画面内容',   en: 'Content' },
  clean:    { zh: '纯净',       en: 'Clean' },
  overlay:  { zh: '叠层',       en: 'Overlay' },
  screen:   { zh: '整页',       en: 'Screen' },
  aspect:   { zh: '画幅',       en: 'Aspect' },
  drive:    { zh: '驱动',       en: 'Drive' },
  offline:  { zh: '定长渲染',   en: 'Offline' },
  realtime: { zh: '实时录制',   en: 'Realtime' },
  dur:      { zh: '时长',       en: 'Duration' },
  loop:     { zh: '无缝循环',   en: 'Seamless loop' },
  orbit:    { zh: '自动环绕',   en: 'Auto orbit' },
  go:       { zh: '开始录制',   en: 'Start' },
  stop:     { zh: '停止',       en: 'Stop' },
  noBridge: { zh: '纯净 / 叠层模式需要通过本地服务器打开（file:// 下受同源限制）。可改用「整页」模式。',
              en: 'Clean / Overlay need the page served over http (file:// is blocked by same-origin). Use "Screen" instead.' },
  noMime:   { zh: '本浏览器不支持视频录制。',
              en: 'This browser cannot record video.' },
  willBe:   { zh: '将输出 ', en: 'Output: ' }
};

function _seg(key, opts){
  var s = '<div class="rec-seg">';
  for (var i = 0; i < opts.length; i++){
    var on = REC.CFG[key] === opts[i][0] ? ' on' : '';
    s += '<button class="' + on.replace(/^ /, '') + '" data-k="' + key + '" data-v="' + opts[i][0] + '">'
       + REC.t(REC.UI.L[opts[i][1]]) + '</button>';
  }
  return s + '</div>';
}

REC.UI.render = function(){
  var pan = document.getElementById('recPanel');
  if (!pan) return;
  var mime = REC.Encoder.pickMime();
  var okBridge = REC.Bridge.available();
  var note = '';
  if (!mime) note = REC.t(REC.UI.L.noMime);
  else if (!okBridge && REC.CFG.visual !== 'screen') note = REC.t(REC.UI.L.noBridge);
  else note = REC.t(REC.UI.L.willBe) + '.' + mime.ext;

  pan.innerHTML =
    '<h4>' + REC.t(REC.UI.L.title) + '</h4>' +
    '<div class="rec-row"><label>' + REC.t(REC.UI.L.visual) + '</label>' +
      _seg('visual', [['clean','clean'],['overlay','overlay'],['screen','screen']]) + '</div>' +
    '<div class="rec-row"><label>' + REC.t(REC.UI.L.aspect) + '</label>' +
      _seg('aspect', [['16:9','aspect'],['9:16','aspect'],['1:1','aspect']]) + '</div>' +
    '<div class="rec-row"><label>' + REC.t(REC.UI.L.drive) + '</label>' +
      _seg('drive', [['offline','offline'],['realtime','realtime']]) + '</div>' +
    '<div class="rec-row"><label>' + REC.t(REC.UI.L.dur) + ' · <span id="recDurVal">' + REC.CFG.duration + '</span>s</label>' +
      '<input id="recDur" type="range" min="3" max="30" step="1" value="' + REC.CFG.duration + '" style="width:100%"></div>' +
    '<div class="rec-row"><label class="rec-chk"><input type="checkbox" data-k="loop"' + (REC.CFG.loop ? ' checked' : '') + '> ' + REC.t(REC.UI.L.loop) + '</label></div>' +
    '<div class="rec-row"><label class="rec-chk"><input type="checkbox" data-k="orbit"' + (REC.CFG.orbit ? ' checked' : '') + '> ' + REC.t(REC.UI.L.orbit) + '</label></div>' +
    '<button class="rec-go" id="recGo"' + (mime ? '' : ' disabled') + '>' + REC.t(REC.UI.L.go) + '</button>' +
    '<div class="rec-bar"><i id="recBar"></i></div>' +
    '<div class="rec-note" id="recNote">' + note + '</div>';

  /* 画幅按钮的文案就是它的值本身，_seg 的字典取不到，这里直接回填 */
  var segs = pan.querySelectorAll('[data-k="aspect"]');
  for (var i = 0; i < segs.length; i++) segs[i].textContent = segs[i].getAttribute('data-v');
};

REC.UI.mount = function(){
  var btn = document.getElementById('recBtn');
  var pan = document.getElementById('recPanel');
  if (!btn || !pan || btn.__mounted) { if (btn && btn.__mounted) REC.UI.render(); return; }
  btn.__mounted = true;
  document.getElementById('recBtnTxt').textContent = REC.t(REC.UI.L.rec);
  REC.UI.render();

  btn.addEventListener('click', function(){
    pan.classList.toggle('on');
    if (pan.classList.contains('on')) REC.UI.render();
  });

  /* 事件委托：面板每次 render 都会重建内容，绑在容器上才不会丢 */
  pan.addEventListener('click', function(e){
    var el = e.target;
    var k = el.getAttribute && el.getAttribute('data-k');
    if (k && el.tagName === 'BUTTON'){
      REC.CFG[k] = el.getAttribute('data-v');
      REC.UI.render();
      return;
    }
    if (el.id === 'recGo') REC.UI.run();
  });
  pan.addEventListener('change', function(e){
    var el = e.target, k = el.getAttribute && el.getAttribute('data-k');
    if (k && el.type === 'checkbox') REC.CFG[k] = el.checked;
  });
  pan.addEventListener('input', function(e){
    if (e.target.id === 'recDur'){
      REC.CFG.duration = +e.target.value;
      document.getElementById('recDurVal').textContent = REC.CFG.duration;
    }
  });
};

/* 录制编排在 Task 7 接上 */
REC.UI.run = function(){ throw new Error('not wired'); };
```

- [ ] **Step 4: 跑自检确认全 pass**

浏览器执行 `REC.UI.__test()`，`fail` 应为空（约 14 条 pass）。
肉眼验收：右下角出现「录制」胶囊按钮，点开面板，三组分段器、时长滑块、两个勾选、开始按钮齐全，底部提示写着 `Output: .mp4`。

- [ ] **Step 5: 语法门禁 + 提交**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
```

```bash
git add app.html && git commit -m "feat(app): REC.UI —— 录制面板、配置项与降级提示"
```

---

## Task 7: 联调 —— 录制编排、现场恢复与验收矩阵

**必须最后做**，依赖 Task 2–6 全部合并。

**Files:**
- Modify: `app.html`（替换 `REC.UI.run` 的桩；在 `REC:UI` 区内，另在导航处加中断钩子）

**Interfaces:**
- Consumes: Task 2–6 的全部导出
- Produces: `REC.UI.run()`（真实现）、`REC.abort()`

- [ ] **Step 1: 写失败的自检**

在 `REC:UI` 区的 `__test` 里追加（放在 `return r;` 之前）：

```js
  ok('run 已接线（不再抛 not wired）', (function(){
    try{ REC.UI.run.toString().indexOf('not wired'); }catch(e){ return false; }
    return REC.UI.run.toString().indexOf('not wired') < 0;
  })());
  ok('abort 是函数', typeof REC.abort === 'function');
```

- [ ] **Step 2: 跑自检确认 fail**

浏览器执行 `REC.UI.__test()`。预期：那两条在 `fail` 里。

- [ ] **Step 3: 实现录制编排**

替换 `REC.UI.run` 的桩：

```js
REC.busy = null;      /* 录制中的现场，供 abort 用 */

REC.abort = function(){
  var b = REC.busy;
  if (!b) return;
  REC.busy = null;
  try{ if (b.src && b.src.cancel) b.src.cancel(); }catch(e){}
  try{ if (b.src && b.src.stop)   b.src.stop();   }catch(e){}
  try{ if (b.ses) REC.Encoder.stop(b.ses); }catch(e){}
  try{ if (b.ctxObj) REC.Compositor.end(b.ctxObj); }catch(e){}
  try{ if (b.snap) REC.Bridge.restore(b.snap); }catch(e){}
  var go = document.getElementById('recGo');
  if (go){ go.disabled = false; go.textContent = REC.t(REC.UI.L.go); }
  var bar = document.getElementById('recBar');
  if (bar) bar.style.width = '0';
};

REC.UI.run = function(){
  if (REC.busy){ REC.abort(); return; }
  var mime = REC.Encoder.pickMime();
  var note = document.getElementById('recNote');
  if (!mime){ if (note) note.textContent = REC.t(REC.UI.L.noMime); return; }

  var go = document.getElementById('recGo');
  var bar = document.getElementById('recBar');
  var cfg = REC.CFG;

  /* 模式 3：屏幕录制，不经 Bridge / Compositor，因此 file:// 下也能用 */
  if (cfg.visual === 'screen'){
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia){
      if (note) note.textContent = REC.t(REC.UI.L.noMime);
      return;
    }
    navigator.mediaDevices.getDisplayMedia({ video: { frameRate: REC.FPS }, audio: false })
      .then(function(st){
        var ses = REC.Encoder.start(st, mime.mime);
        REC.busy = { ses: ses, src: null, ctxObj: null, snap: null };
        go.textContent = REC.t(REC.UI.L.stop);
        /* 用户在浏览器的共享条上点「停止共享」也要收尾 */
        st.getVideoTracks()[0].addEventListener('ended', function(){ _finish(ses, mime); });
      })['catch'](function(){ if (note) note.textContent = REC.t(REC.UI.L.noMime); });
    return;
  }

  var h = REC.Bridge.get();
  if (!h){ if (note) note.textContent = REC.t(REC.UI.L.noBridge); return; }

  var snap = REC.Bridge.snapshot();
  var ctxObj = REC.Compositor.begin(h, cfg);
  if (!ctxObj){ if (note) note.textContent = REC.t(REC.UI.L.noBridge); return; }

  var dur = cfg.duration;
  if (cfg.loop) dur = REC.Source.snapDuration(dur, h.state.omega);

  if (cfg.drive === 'realtime'){
    var src = REC.Source.realtime(h, ctxObj, cfg);
    var ses = REC.Encoder.start(src.stream, mime.mime);
    REC.busy = { ses: ses, src: src, ctxObj: ctxObj, snap: snap };
    go.textContent = REC.t(REC.UI.L.stop);
    return;                       /* 由用户再点一次「停止」触发 _finish */
  }

  var src2 = REC.Source.offline(h, ctxObj, {
    duration: dur, loop: cfg.loop, orbit: cfg.orbit, viewTo: cfg.viewTo
  }, function(k){ if (bar) bar.style.width = Math.round(k * 100) + '%'; });

  var ses2 = REC.Encoder.start(src2.stream, mime.mime);
  REC.busy = { ses: ses2, src: src2, ctxObj: ctxObj, snap: snap };
  go.disabled = true;
  src2.done.then(function(){ _finish(ses2, mime); });
};

function _finish(ses, mime){
  var b = REC.busy;
  REC.busy = null;
  REC.Encoder.stop(ses).then(function(blob){
    var id = curId || 'mathviz';
    var name = id + '-' + REC.CFG.aspect.replace(':', 'x') + '-' + REC.CFG.duration + 's.' + mime.ext;
    REC.Encoder.download(blob, name);
  })['finally'](function(){
    if (b && b.src && b.src.stop) try{ b.src.stop(); }catch(e){}
    if (b && b.ctxObj) REC.Compositor.end(b.ctxObj);
    if (b && b.snap)   REC.Bridge.restore(b.snap);
    var go = document.getElementById('recGo');
    if (go){ go.disabled = false; go.textContent = REC.t(REC.UI.L.go); }
    var bar = document.getElementById('recBar');
    if (bar) bar.style.width = '0';
  });
}
```

- [ ] **Step 4: 加中断钩子（切工具 / 关页面时无条件恢复现场）**

在 `go(id, push)` 函数体第一行（`app.html:1023` 附近）加：

```js
  REC.abort();
```

在 `boot()` 之后的启动 IIFE 之前加：

```js
window.addEventListener('beforeunload', function(){ REC.abort(); });
```

- [ ] **Step 5: 跑全量自检**

```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html | node --check /dev/stdin
```

浏览器执行 `REC.selftest()`。
预期：`fail` 为**空数组**，`pass` 约 60 条。

- [ ] **Step 6: 手工验收矩阵**

在 `http://localhost:8777/app.html?tool=fourier-essence-3d` 逐项走，每项都要真的下载到文件并能播放：

| # | 画面 | 画幅 | 驱动 | 预期 |
|---|---|---|---|---|
| 1 | 叠层 | 16:9 | 定长 | 1920×1080 mp4，标题/读数/图例在，8s 左右 |
| 2 | 叠层 | 9:16 | 定长 | 1080×1920，构图按竖屏重排（不是拉伸） |
| 3 | 叠层 | 1:1 | 定长 | 1080×1080 |
| 4 | 纯净 | 16:9 | 定长 | 只有画布，无任何叠层文字 |
| 5 | 纯净 | 16:9 | 定长 + 自动环绕 | 镜头转满一圈，首尾可无缝衔接 |
| 6 | 叠层 | 16:9 | 实时 | 录制中手动拖拽旋转，视频里能看到 |
| 7 | 整页 | — | — | 侧边栏与参数面板都在画面里 |

每次录完必须确认：**面板参数、镜位、动画相位与录制前一致**（现场已还原）。

- [ ] **Step 7: 降级路径验收**

直接双击 `app.html` 用 `file://` 打开：
- 选「纯净 / 叠层」→ 提示语出现，点开始不崩、不下载空文件
- 选「整页」→ 可正常录制并下载

- [ ] **Step 8: 回归检查**

```bash
git diff --name-only main
```
预期：只有 `app.html`、`.claude/launch.json`、`docs/superpowers/**`。**`outputs/` 与 `tools.json` 必须零改动。**

关掉录制面板后，切工具、搜索、语言切换、Ctrl+B 收侧栏全部与改造前一致。

- [ ] **Step 9: 提交**

```bash
git add app.html && git commit -m "feat(app): 录制编排、中断恢复与全链路联调"
```

---

## Self-Review 记录

**Spec 覆盖**：落点 app.html → Task 1；三种画面模式 → Task 4（clean/overlay）+ Task 7（screen）；三种画幅 → Task 4；两种驱动 → Task 5；离线运镜（锁定/环绕/视角过渡）→ Task 5 Step 3；mime 优先级与 mp4 优先 → Task 3；无缝循环吸附 → Task 5 `snapDuration`；eval 桥 → Task 2；现场恢复四条路径 → Task 2（snapshot/restore）+ Task 7（Step 4 的 `go()` 与 `beforeunload` 钩子）+ `_finish`；错误降级 → Task 6（提示文案）+ Task 7（三处 `noBridge`/`noMime` 分支）；验收矩阵 → Task 7 Step 6–8。无遗漏。

**已知取舍（有意为之，非遗漏）**：
- `REC.CFG.viewTo`（视角过渡）在 Task 5 已实现驱动逻辑，但 Task 6 的面板**没有暴露选择器**——工具间 `views` 的 key 各不相同，需要动态读 `SCENES[curTab].views` 才能列出。留作后续迭代，当前可经控制台设 `REC.CFG.viewTo = 'key'` 使用。这是刻意收窄的范围，不是漏掉。
- 音频不录（本仓库工具无声）。
